package top.babylink.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.widget.Toast;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "LinkBackup",
    permissions = {
        @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
    }
)
public class LinkBackupPlugin extends Plugin {
    private static final int MAX_ENCODED_ARCHIVE_LENGTH = 192 * 1024 * 1024;
    private static final int MAX_ENCODED_CHUNK_LENGTH = 2 * 1024 * 1024;
    private static final long MAX_ARCHIVE_BYTES = 1024L * 1024L * 1024L;
    private final ExecutorService archiveExecutor = Executors.newSingleThreadExecutor();
    private final Map<String, ArchiveSession> archiveSessions = new ConcurrentHashMap<>();

    private static final class ArchiveSession {
        final String id;
        final String requestedFileName;
        final long expectedBytes;
        final OutputStream output;
        final Uri uri;
        final File partialFile;
        final File finalFile;
        long writtenBytes;

        ArchiveSession(String id, String requestedFileName, long expectedBytes, OutputStream output, Uri uri, File partialFile, File finalFile) {
            this.id = id;
            this.requestedFileName = requestedFileName;
            this.expectedBytes = expectedBytes;
            this.output = output;
            this.uri = uri;
            this.partialFile = partialFile;
            this.finalFile = finalFile;
        }
    }

    @Override
    protected void handleOnDestroy() {
        for (ArchiveSession session : archiveSessions.values()) abortSession(session);
        archiveSessions.clear();
        archiveExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void beginArchive(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "beginStoragePermissionCallback");
            return;
        }
        beginArchiveData(call, true);
    }

    @PermissionCallback
    private void beginStoragePermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            call.reject("需要存储权限才能导出备份。");
            return;
        }
        beginArchiveData(call, true);
    }

    @PluginMethod
    public void beginArchiveStream(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "beginStreamStoragePermissionCallback");
            return;
        }
        beginArchiveData(call, false);
    }

    @PermissionCallback
    private void beginStreamStoragePermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            call.reject("需要存储权限才能导出备份。");
            return;
        }
        beginArchiveData(call, false);
    }

    private void beginArchiveData(PluginCall call, boolean requireExpectedBytes) {
        String fileName = sanitizeFileName(call.getString("fileName", "link-backup.zip"));
        Object totalBytesValue = call.getData().opt("totalBytes");
        long totalBytes = totalBytesValue instanceof Number ? ((Number) totalBytesValue).longValue() : 0L;
        if (requireExpectedBytes && (totalBytes <= 0 || totalBytes > MAX_ARCHIVE_BYTES)) {
            call.reject("备份大小无效或超过 1GB。");
            return;
        }
        final long archiveTotalBytes = requireExpectedBytes ? totalBytes : -1L;

        archiveExecutor.execute(() -> {
            try {
                ArchiveSession session = createArchiveSession(fileName, archiveTotalBytes);
                archiveSessions.put(session.id, session);
                JSObject result = new JSObject();
                result.put("sessionId", session.id);
                result.put("fileName", session.requestedFileName);
                result.put("location", archiveLocation(session));
                call.resolve(result);
            } catch (Exception error) {
                call.reject("无法创建系统备份文件。", error);
            }
        });
    }

    @PluginMethod
    public void appendArchiveChunk(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        String data = call.getString("data", "");
        if (sessionId.isEmpty() || data.isEmpty() || data.length() > MAX_ENCODED_CHUNK_LENGTH) {
            call.reject("备份分片无效。");
            return;
        }

        archiveExecutor.execute(() -> {
            ArchiveSession session = archiveSessions.get(sessionId);
            if (session == null) {
                call.reject("备份写入会话已失效。");
                return;
            }
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                long nextWrittenBytes = session.writtenBytes + bytes.length;
                if (nextWrittenBytes > MAX_ARCHIVE_BYTES
                    || session.expectedBytes >= 0 && nextWrittenBytes > session.expectedBytes) {
                    throw new IOException("备份分片超过允许大小。");
                }
                session.output.write(bytes);
                session.writtenBytes = nextWrittenBytes;
                JSObject result = new JSObject();
                result.put("writtenBytes", session.writtenBytes);
                call.resolve(result);
            } catch (Exception error) {
                archiveSessions.remove(sessionId);
                abortSession(session);
                call.reject("备份分片写入失败。", error);
            }
        });
    }

    @PluginMethod
    public void finishArchive(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        archiveExecutor.execute(() -> {
            ArchiveSession session = archiveSessions.remove(sessionId);
            if (session == null) {
                call.reject("备份写入会话已失效。");
                return;
            }
            try {
                if (session.writtenBytes <= 0 || session.expectedBytes >= 0 && session.writtenBytes != session.expectedBytes) {
                    throw new IOException("备份写入不完整：" + session.writtenBytes + "/" + session.expectedBytes + "。");
                }
                session.output.flush();
                session.output.close();
                String actualFileName = completeSession(session);
                String location = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? Environment.DIRECTORY_DOWNLOADS + "/BabyLink/" + actualFileName
                    : session.finalFile.getAbsolutePath();
                getActivity().runOnUiThread(() -> Toast.makeText(getContext(), "备份已保存到 " + location, Toast.LENGTH_LONG).show());
                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("fileName", actualFileName);
                result.put("location", location);
                call.resolve(result);
            } catch (Exception error) {
                abortSession(session);
                call.reject("备份保存失败。", error);
            }
        });
    }

    @PluginMethod
    public void abortArchive(PluginCall call) {
        String sessionId = call.getString("sessionId", "");
        archiveExecutor.execute(() -> {
            ArchiveSession session = archiveSessions.remove(sessionId);
            if (session != null) abortSession(session);
            call.resolve();
        });
    }

    @PluginMethod
    public void saveArchive(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionCallback");
            return;
        }
        saveArchiveData(call);
    }

    @PermissionCallback
    private void storagePermissionCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
            call.reject("需要存储权限才能导出备份。");
            return;
        }
        saveArchiveData(call);
    }

    private void saveArchiveData(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String requestedName = call.getString("fileName", "link-backup.zip");
        int commaIndex = dataUrl.indexOf(',');
        if (!dataUrl.startsWith("data:application/zip") || commaIndex < 0 || dataUrl.length() > MAX_ENCODED_ARCHIVE_LENGTH) {
            call.reject("备份数据无效或超过 144MB。");
            return;
        }

        String fileName = sanitizeFileName(requestedName);
        getBridge().execute(() -> {
            try {
                byte[] bytes = Base64.decode(dataUrl.substring(commaIndex + 1), Base64.DEFAULT);
                String actualFileName;
                String location;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    actualFileName = saveWithMediaStore(bytes, fileName);
                    location = Environment.DIRECTORY_DOWNLOADS + "/BabyLink/" + actualFileName;
                } else {
                    File backupFile = saveLegacy(bytes, fileName);
                    actualFileName = backupFile.getName();
                    location = backupFile.getAbsolutePath();
                }
                String toastLocation = location;
                getActivity().runOnUiThread(() -> Toast.makeText(getContext(), "备份已保存到 " + toastLocation, Toast.LENGTH_LONG).show());
                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("fileName", actualFileName);
                result.put("location", location);
                call.resolve(result);
            } catch (IllegalArgumentException error) {
                call.reject("备份数据无法解码。", error);
            } catch (Exception error) {
                call.reject("备份保存失败。", error);
            }
        });
    }

    private ArchiveSession createArchiveSession(String fileName, long totalBytes) throws Exception {
        String sessionId = UUID.randomUUID().toString();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
            values.put(MediaStore.Downloads.MIME_TYPE, "application/zip");
            values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BabyLink");
            values.put(MediaStore.Downloads.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("无法创建系统下载文件。");
            OutputStream output = resolver.openOutputStream(uri, "w");
            if (output == null) {
                resolver.delete(uri, null, null);
                throw new IOException("无法打开系统下载文件。");
            }
            return new ArchiveSession(sessionId, fileName, totalBytes, output, uri, null, null);
        }

        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "BabyLink");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("无法创建备份目录。");
        File finalFile = uniqueFile(directory, fileName);
        File partialFile = new File(directory, "." + finalFile.getName() + "." + sessionId + ".part");
        return new ArchiveSession(sessionId, finalFile.getName(), totalBytes, new FileOutputStream(partialFile), null, partialFile, finalFile);
    }

    private String completeSession(ArchiveSession session) throws Exception {
        if (session.uri != null) {
            return publishMediaStoreArchive(session.uri, session.requestedFileName, session.writtenBytes);
        }
        if (session.partialFile == null || session.finalFile == null || !session.partialFile.renameTo(session.finalFile)) {
            throw new IOException("无法完成备份文件写入。");
        }
        if (!session.finalFile.isFile() || session.finalFile.length() != session.writtenBytes) {
            throw new IOException("系统未确认备份文件写入完成。");
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { session.finalFile.getAbsolutePath() }, new String[] { "application/zip" }, null);
        return session.finalFile.getName();
    }

    private String publishMediaStoreArchive(Uri uri, String fallbackFileName, long expectedBytes) throws IOException {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.IS_PENDING, 0);
        if (resolver.update(uri, values, null, null) <= 0) {
            throw new IOException("系统未确认备份文件写入完成。");
        }
        try (Cursor cursor = resolver.query(uri, new String[] {
            MediaStore.Downloads.DISPLAY_NAME,
            MediaStore.Downloads.SIZE,
            MediaStore.Downloads.IS_PENDING
        }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String displayName = cursor.getString(0);
                long actualBytes = cursor.getLong(1);
                int pending = cursor.getInt(2);
                if (pending == 0 && actualBytes == expectedBytes) {
                    return displayName == null || displayName.isEmpty() ? fallbackFileName : displayName;
                }
            }
        } catch (Exception error) {
            throw new IOException("无法验证系统备份文件。", error);
        }
        throw new IOException("系统未确认备份文件已完整写入。");
    }

    private String archiveLocation(ArchiveSession session) {
        if (session.uri != null) return Environment.DIRECTORY_DOWNLOADS + "/BabyLink/" + session.requestedFileName;
        return session.finalFile == null ? "" : session.finalFile.getAbsolutePath();
    }

    private void abortSession(ArchiveSession session) {
        try {
            session.output.close();
        } catch (Exception ignored) {
        }
        if (session.uri != null) getContext().getContentResolver().delete(session.uri, null, null);
        if (session.partialFile != null && session.partialFile.exists()) session.partialFile.delete();
    }

    private String saveWithMediaStore(byte[] bytes, String fileName) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
        values.put(MediaStore.Downloads.MIME_TYPE, "application/zip");
        values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BabyLink");
        values.put(MediaStore.Downloads.IS_PENDING, 1);
        Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("无法创建系统备份文件。");
        try {
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("无法打开系统备份文件。");
                output.write(bytes);
            }
            return publishMediaStoreArchive(uri, fileName, bytes.length);
        } catch (Exception error) {
            resolver.delete(uri, null, null);
            throw error;
        }
    }

    @SuppressWarnings("deprecation")
    private File saveLegacy(byte[] bytes, String fileName) throws Exception {
        File directory = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "BabyLink");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("无法创建备份目录。");
        File backupFile = uniqueFile(directory, fileName);
        try (FileOutputStream output = new FileOutputStream(backupFile)) {
            output.write(bytes);
        }
        if (!backupFile.isFile() || backupFile.length() != bytes.length) {
            throw new IOException("系统未确认备份文件写入完成。");
        }
        MediaScannerConnection.scanFile(getContext(), new String[] { backupFile.getAbsolutePath() }, new String[] { "application/zip" }, null);
        return backupFile;
    }

    private static File uniqueFile(File directory, String fileName) {
        File candidate = new File(directory, fileName);
        if (!candidate.exists()) return candidate;
        String stem = fileName.substring(0, fileName.length() - 4);
        for (int index = 2; index < 10_000; index += 1) {
            candidate = new File(directory, stem + "-" + index + ".zip");
            if (!candidate.exists()) return candidate;
        }
        return new File(directory, stem + "-" + System.currentTimeMillis() + ".zip");
    }

    private static String sanitizeFileName(String requestedName) {
        String fileName = requestedName == null ? "" : requestedName.trim().replaceAll("[\\\\/:*?\"<>|]+", "-");
        if (fileName.isEmpty()) fileName = "link-backup";
        if (!fileName.matches("(?i).*\\.zip$")) fileName += ".zip";
        return fileName.length() > 160 ? fileName.substring(fileName.length() - 160) : fileName;
    }
}
