package top.babylink.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.AlarmClock;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LinkReality")
public class LinkRealityPlugin extends Plugin {
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
