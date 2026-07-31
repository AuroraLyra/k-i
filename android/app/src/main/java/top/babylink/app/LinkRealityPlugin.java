package top.babylink.app;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Process;
import android.provider.AlarmClock;
import android.provider.Settings;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "LinkReality")
public class LinkRealityPlugin extends Plugin {
    private boolean hasUsageStatsAccess() {
        AppOpsManager appOps = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        if (appOps == null) return false;
        int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        if (mode == AppOpsManager.MODE_ALLOWED) return true;
        if (mode != AppOpsManager.MODE_DEFAULT) return false;
        return getContext().checkCallingOrSelfPermission("android.permission.PACKAGE_USAGE_STATS") == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void getAppUsageAccess(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasUsageStatsAccess());
        result.put("platform", "android");
        call.resolve(result);
    }

    @PluginMethod
    public void openAppUsageSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            .setData(Uri.parse("package:" + getContext().getPackageName()));
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        }
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("当前设备没有可用的使用情况访问设置入口。");
            return;
        }
        getActivity().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        result.put("granted", hasUsageStatsAccess());
        call.resolve(result);
    }

    @PluginMethod
    public void getAppUsage(PluginCall call) {
        long now = System.currentTimeMillis();
        long to = Math.min(now, call.getLong("to", now));
        long from = call.getLong("from", Long.MIN_VALUE);
        if (from == Long.MIN_VALUE) {
            Calendar localDayStart = Calendar.getInstance();
            localDayStart.setTimeInMillis(to);
            localDayStart.set(Calendar.HOUR_OF_DAY, 0);
            localDayStart.set(Calendar.MINUTE, 0);
            localDayStart.set(Calendar.SECOND, 0);
            localDayStart.set(Calendar.MILLISECOND, 0);
            from = localDayStart.getTimeInMillis();
        }
        int limit = Math.max(1, Math.min(200, call.getInt("limit", 50)));
        long maxRange = 31L * 24L * 60L * 60L * 1000L;
        from = Math.max(to - maxRange, Math.min(from, to - 1));

        JSObject result = new JSObject();
        result.put("permissionGranted", hasUsageStatsAccess());
        result.put("platform", "android");
        result.put("from", from);
        result.put("to", to);
        JSArray apps = new JSArray();
        result.put("apps", apps);
        if (!hasUsageStatsAccess()) {
            result.put("totalForegroundMs", 0L);
            call.resolve(result);
            return;
        }

        UsageStatsManager manager = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) {
            call.reject("当前设备不支持系统使用时长统计。");
            return;
        }
        List<UsageStats> usageStats = manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, from, to);
        Map<String, long[]> totals = new HashMap<>();
        if (usageStats != null) {
            for (UsageStats usage : usageStats) {
                long foregroundMs = Math.max(0L, usage.getTotalTimeInForeground());
                if (foregroundMs <= 0L) continue;
                long[] aggregate = totals.computeIfAbsent(usage.getPackageName(), key -> new long[] { 0L, 0L });
                aggregate[0] += foregroundMs;
                aggregate[1] = Math.max(aggregate[1], usage.getLastTimeUsed());
            }
        }

        List<Map.Entry<String, long[]>> ranked = new ArrayList<>(totals.entrySet());
        ranked.sort((left, right) -> Long.compare(right.getValue()[0], left.getValue()[0]));
        PackageManager packageManager = getContext().getPackageManager();
        long totalForegroundMs = 0L;
        for (long[] aggregate : totals.values()) totalForegroundMs += aggregate[0];
        for (int index = 0; index < ranked.size() && apps.length() < limit; index += 1) {
            Map.Entry<String, long[]> entry = ranked.get(index);
            String packageName = entry.getKey();
            long[] aggregate = entry.getValue();
            String appName = packageName;
            boolean systemApp = false;
            try {
                ApplicationInfo applicationInfo = packageManager.getApplicationInfo(packageName, 0);
                appName = String.valueOf(packageManager.getApplicationLabel(applicationInfo));
                systemApp = (applicationInfo.flags & ApplicationInfo.FLAG_SYSTEM) != 0;
            } catch (PackageManager.NameNotFoundException ignored) {
                // Keep the package name when the app was removed after the usage record was written.
            }
            JSObject item = new JSObject();
            item.put("appName", appName);
            item.put("packageName", packageName);
            item.put("foregroundMs", aggregate[0]);
            item.put("lastUsedAt", aggregate[1]);
            item.put("systemApp", systemApp);
            apps.put(item);
        }
        result.put("totalForegroundMs", totalForegroundMs);
        call.resolve(result);
    }

    @PluginMethod
    public void setSystemAlarm(PluginCall call) {
        Integer hour = call.getInt("hour");
        Integer minute = call.getInt("minute");
        String label = call.getString("label", "BabyLink");
        if (hour == null || minute == null || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            call.reject("闹钟时间无效。");
            return;
        }
        Intent intent = new Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, hour)
            .putExtra(AlarmClock.EXTRA_MINUTES, minute)
            .putExtra(AlarmClock.EXTRA_MESSAGE, label)
            .putExtra(AlarmClock.EXTRA_SKIP_UI, false);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("当前设备没有可用的系统时钟 App。");
            return;
        }
        getActivity().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }

    @PluginMethod
    public void openSystemWeather(PluginCall call) {
        String[] packages = {
            "com.google.android.apps.weather",
            "com.sec.android.daemonapp",
            "com.miui.weather2",
            "com.coloros.weather2",
            "com.huawei.android.totemweather"
        };
        for (String packageName : packages) {
            Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(packageName);
            if (intent == null) continue;
            getActivity().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("packageName", packageName);
            call.resolve(result);
            return;
        }
        Intent weatherIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("weather://"));
        if (weatherIntent.resolveActivity(getContext().getPackageManager()) != null) {
            getActivity().startActivity(weatherIntent);
            JSObject result = new JSObject();
            result.put("opened", true);
            result.put("packageName", "weather://");
            call.resolve(result);
            return;
        }
        call.reject("没有检测到可直接打开的系统天气 App。");
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
            .setData(Uri.parse("package:" + getContext().getPackageName()));
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("当前设备没有可用的系统设置入口。");
            return;
        }
        getActivity().startActivity(intent);
        JSObject result = new JSObject();
        result.put("opened", true);
        call.resolve(result);
    }
}
