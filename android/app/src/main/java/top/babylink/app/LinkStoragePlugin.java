package top.babylink.app;

import android.os.StatFs;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "LinkStorage")
public class LinkStoragePlugin extends Plugin {
    private static final class DirectoryStats {
        long bytes;
        int fileCount;

        void add(DirectoryStats other) {
            bytes += other.bytes;
            fileCount += other.fileCount;
        }
    }

    @PluginMethod
    public void getOverview(PluginCall call) {
        getBridge().execute(() -> {
            try {
                call.resolve(buildOverview());
            } catch (Exception error) {
                call.reject("无法读取 App 存储信息。", error);
            }
        });
    }

    @PluginMethod
    public void clearTemporaryFiles(PluginCall call) {
        getBridge().execute(() -> {
            try {
                clearDirectoryContents(getContext().getCacheDir());
                File externalCacheDirectory = getContext().getExternalCacheDir();
                if (externalCacheDirectory != null) clearDirectoryContents(externalCacheDirectory);
                call.resolve(buildOverview());
            } catch (Exception error) {
                call.reject("清理 App 临时文件失败。", error);
            }
        });
    }

    private JSObject buildOverview() {
        DirectoryStats cacheStats = collectDirectoryStats(getContext().getCacheDir());
        File externalCacheDirectory = getContext().getExternalCacheDir();
        if (externalCacheDirectory != null) cacheStats.add(collectDirectoryStats(externalCacheDirectory));

        StatFs fileSystem = new StatFs(getContext().getFilesDir().getAbsolutePath());
        JSObject result = new JSObject();
        result.put("platform", "android");
        result.put("availableBytes", fileSystem.getAvailableBytes());
        result.put("totalBytes", fileSystem.getTotalBytes());
        result.put("cacheBytes", cacheStats.bytes);
        result.put("cacheFileCount", cacheStats.fileCount);
        return result;
    }

    private DirectoryStats collectDirectoryStats(File directory) {
        DirectoryStats stats = new DirectoryStats();
        if (directory == null || !directory.exists()) return stats;
        File[] children = directory.listFiles();
        if (children == null) return stats;

        for (File child : children) {
            if (child.isDirectory()) {
                stats.add(collectDirectoryStats(child));
            } else if (child.isFile()) {
                stats.bytes += Math.max(0L, child.length());
                stats.fileCount += 1;
            }
        }
        return stats;
    }

    private void clearDirectoryContents(File directory) {
        if (directory == null || !directory.exists()) return;
        File[] children = directory.listFiles();
        if (children == null) return;
        for (File child : children) deleteRecursively(child);
    }

    private void deleteRecursively(File target) {
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) {
                for (File child : children) deleteRecursively(child);
            }
        }
        if (target.exists() && !target.delete()) throw new IllegalStateException("无法删除临时文件：" + target.getName());
    }
}