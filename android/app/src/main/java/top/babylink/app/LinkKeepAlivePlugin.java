package top.babylink.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(
    name = "LinkKeepAlive",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class LinkKeepAlivePlugin extends Plugin {
    @Override
    public void load() {
        LinkKeepAliveService.createNotificationChannels(getContext());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(createStatus());
    }

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), LinkKeepAliveService.class);
        intent.setAction(LinkKeepAliveService.ACTION_START);
        intent.putExtra(LinkKeepAliveService.EXTRA_WAKE_LOCK, call.getBoolean("wakeLock", true));
        ContextCompat.startForegroundService(getContext(), intent);
        JSObject result = createStatus();
        result.put("serviceActive", true);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), LinkKeepAliveService.class));
        JSObject result = createStatus();
        result.put("serviceActive", false);
        result.put("wakeLockActive", false);
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || notificationsGranted()) {
            call.resolve(createStatus());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsCallback");
    }

    @PermissionCallback
    private void notificationsCallback(PluginCall call) {
        call.resolve(createStatus());
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !batteryOptimizationsIgnored()) {
            intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        } else {
            intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void notify(PluginCall call) {
        if (!notificationsGranted()) {
            JSObject result = new JSObject();
            result.put("sent", false);
            call.resolve(result);
            return;
        }
        String title = call.getString("title", "BabyLink");
        String body = call.getString("body", "");
        JSArray rawMessages = call.getArray("messages");
        List<String> messages = new ArrayList<>();
        if (rawMessages != null) {
            for (int index = 0; index < rawMessages.length(); index += 1) {
                String message = rawMessages.optString(index, "").trim();
                if (!message.isEmpty()) messages.add(message);
            }
        }
        if (messages.isEmpty() && !body.trim().isEmpty()) messages.add(body);
        String tag = call.getString("tag", "babylink-message");
        String icon = call.getString("icon", "");
        String url = call.getString("url", "");
        String kind = call.getString("kind", "message");
        String conversationId = call.getString("conversationId", "");
        String callId = call.getString("callId", "");
        String callMode = call.getString("callMode", "voice");
        LinkKeepAliveService.showNotification(getContext(), kind, title, body, messages, tag, icon, url, conversationId, callId, callMode);
        JSObject result = new JSObject();
        result.put("sent", true);
        call.resolve(result);
    }

    @PluginMethod
    public void dismissCall(PluginCall call) {
        String callId = call.getString("callId", "");
        String tag = call.getString("tag", "");
        LinkKeepAliveService.dismissCallNotification(getContext(), callId, tag);
        call.resolve();
    }

    private JSObject createStatus() {
        JSObject result = new JSObject();
        result.put("serviceActive", LinkKeepAliveService.isRunning());
        result.put("wakeLockActive", LinkKeepAliveService.isWakeLockActive());
        result.put("notificationPermission", notificationPermission());
        result.put("batteryOptimizationsIgnored", batteryOptimizationsIgnored());
        return result;
    }

    private boolean notificationsGranted() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private String notificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return "granted";
        PermissionState state = getPermissionState("notifications");
        return state == PermissionState.PROMPT_WITH_RATIONALE ? PermissionState.PROMPT.toString() : state.toString();
    }

    private boolean batteryOptimizationsIgnored() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        PowerManager manager = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        return manager.isIgnoringBatteryOptimizations(getContext().getPackageName());
    }
}