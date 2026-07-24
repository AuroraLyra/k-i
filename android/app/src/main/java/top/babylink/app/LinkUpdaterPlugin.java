package top.babylink.app;

import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "LinkUpdater")
public class LinkUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 256L * 1024L * 1024L;
    private final ExecutorService updateExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void handleOnDestroy() {
        updateExecutor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo packageInfo = getInstalledPackageInfo(0);
            JSObject result = new JSObject();
            result.put("versionCode", versionCode(packageInfo));
            result.put("versionName", packageInfo.versionName == null ? "" : packageInfo.versionName);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to read app version.", exception);
        }
    }

    @PluginMethod
    public void openDownload(PluginCall call) {
        String rawUrl = call.getString("url", "");
        if (!isTrustedDownloadUrl(rawUrl)) {
            call.reject("Only trusted BabyLink HTTPS downloads are allowed.");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(rawUrl));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to open the system browser.", exception);
        }
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String rawUrl = call.getString("url", "");
        String expectedSha256 = call.getString("sha256", "").trim().toLowerCase(Locale.US);
        long expectedVersionCode = versionCodeFromPluginValue(call.getData().opt("versionCode"));
        if (!isTrustedDownloadUrl(rawUrl)) {
            call.reject("Only trusted BabyLink HTTPS downloads are allowed.");
            return;
        }
        if (!expectedSha256.matches("^[0-9a-f]{64}$") || expectedVersionCode < 1) {
            call.reject("Invalid update verification metadata.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(permissionIntent);
            JSObject result = new JSObject();
            result.put("status", "permission-required");
            call.resolve(result);
            return;
        }

        updateExecutor.execute(() -> {
            File apkFile = new File(getContext().getCacheDir(), "babylink-update.apk");
            try {
                downloadVerifiedApk(rawUrl, apkFile, expectedSha256);
                verifyApkIdentity(apkFile, expectedVersionCode);
                commitApkInstall(apkFile);
                JSObject result = new JSObject();
                result.put("status", "install-requested");
                call.resolve(result);
            } catch (Exception exception) {
                call.reject(exception.getMessage() == null ? "Unable to install update." : exception.getMessage(), exception);
            } finally {
                if (apkFile.exists()) apkFile.delete();
            }
        });
    }

    static long versionCodeFromPluginValue(Object value) {
        if (!(value instanceof Number)) return 0L;
        Number number = (Number) value;
        double doubleValue = number.doubleValue();
        if (!Double.isFinite(doubleValue) || doubleValue != Math.rint(doubleValue)) return 0L;
        long versionCode = number.longValue();
        return versionCode > 0 ? versionCode : 0L;
    }

    private boolean isTrustedDownloadUrl(String rawUrl) {
        try {
            Uri uri = Uri.parse(rawUrl);
            String host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme())
                && host != null
                && (host.equals("babylink.top") || host.endsWith(".babylink.top"));
        } catch (Exception exception) {
            return false;
        }
    }

    private void downloadVerifiedApk(String rawUrl, File destination, String expectedSha256) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(rawUrl).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(120_000);
        connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
        connection.connect();
        int responseCode = connection.getResponseCode();
        if (responseCode < 200 || responseCode >= 300) {
            connection.disconnect();
            throw new IllegalStateException("APK download failed with HTTP " + responseCode + ".");
        }
        long contentLength = connection.getContentLengthLong();
        if (contentLength > MAX_APK_BYTES) {
            connection.disconnect();
            throw new IllegalStateException("APK exceeds the allowed size.");
        }
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long totalBytes = 0;
        byte[] buffer = new byte[64 * 1024];
        try (InputStream input = connection.getInputStream(); OutputStream output = new FileOutputStream(destination, false)) {
            int read;
            while ((read = input.read(buffer)) != -1) {
                totalBytes += read;
                if (totalBytes > MAX_APK_BYTES) throw new IllegalStateException("APK exceeds the allowed size.");
                digest.update(buffer, 0, read);
                output.write(buffer, 0, read);
            }
            output.flush();
        } finally {
            connection.disconnect();
        }
        if (totalBytes < 1) throw new IllegalStateException("Downloaded APK is empty.");
        String actualSha256 = toHex(digest.digest());
        if (!MessageDigest.isEqual(actualSha256.getBytes(), expectedSha256.getBytes())) {
            throw new SecurityException("APK SHA-256 verification failed.");
        }
    }

    private void verifyApkIdentity(File apkFile, long expectedVersionCode) throws Exception {
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
            ? PackageManager.GET_SIGNING_CERTIFICATES
            : PackageManager.GET_SIGNATURES;
        PackageInfo archiveInfo = getContext().getPackageManager().getPackageArchiveInfo(apkFile.getAbsolutePath(), flags);
        if (archiveInfo == null || !getContext().getPackageName().equals(archiveInfo.packageName)) {
            throw new SecurityException("APK package name verification failed.");
        }
        long archiveVersionCode = versionCode(archiveInfo);
        long currentVersionCode = versionCode(getInstalledPackageInfo(0));
        if (archiveVersionCode != expectedVersionCode || archiveVersionCode <= currentVersionCode) {
            throw new SecurityException("APK version verification failed.");
        }
        Set<String> currentSigners = signerDigests(getInstalledPackageInfo(flags));
        Set<String> archiveSigners = signerDigests(archiveInfo);
        if (currentSigners.isEmpty() || !currentSigners.equals(archiveSigners)) {
            throw new SecurityException("APK signing certificate verification failed.");
        }
    }

    private void commitApkInstall(File apkFile) throws Exception {
        PackageInstaller installer = getContext().getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
        params.setAppPackageName(getContext().getPackageName());
        int sessionId = installer.createSession(params);
        try (PackageInstaller.Session session = installer.openSession(sessionId)) {
            try (InputStream input = new FileInputStream(apkFile);
                 OutputStream output = session.openWrite("babylink-update.apk", 0, apkFile.length())) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                session.fsync(output);
            }
            Intent statusIntent = new Intent(getContext(), LinkUpdateInstallReceiver.class);
            statusIntent.setAction(getContext().getPackageName() + ".UPDATE_INSTALL_STATUS");
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pendingIntent = PendingIntent.getBroadcast(getContext(), sessionId, statusIntent, flags);
            IntentSender statusReceiver = pendingIntent.getIntentSender();
            session.commit(statusReceiver);
        } catch (Exception exception) {
            installer.abandonSession(sessionId);
            throw exception;
        }
    }

    private PackageInfo getInstalledPackageInfo(int flags) throws PackageManager.NameNotFoundException {
        return getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), flags);
    }

    private long versionCode(PackageInfo packageInfo) {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
    }

    private Set<String> signerDigests(PackageInfo packageInfo) throws Exception {
        Signature[] signatures;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && packageInfo.signingInfo != null) {
            signatures = packageInfo.signingInfo.getApkContentsSigners();
        } else {
            signatures = packageInfo.signatures;
        }
        Set<String> digests = new HashSet<>();
        if (signatures == null) return digests;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        for (Signature signature : signatures) {
            digest.reset();
            digests.add(toHex(digest.digest(signature.toByteArray())));
        }
        return digests;
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value));
        return builder.toString();
    }
}