package top.babylink.app;

import android.content.Intent;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

@CapacitorPlugin(name = "LinkNotificationInbox")
public class LinkNotificationInboxPlugin extends Plugin {
    @PluginMethod
    public void getAccess(PluginCall call) {
        call.resolve(accessResult());
    }

    @PluginMethod
    public void openAccessSettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
        if (intent.resolveActivity(getContext().getPackageManager()) == null) {
            call.reject("当前设备没有通知使用权设置入口。");
            return;
        }
        getActivity().startActivity(intent);
        JSObject result = accessResult();
        result.put("opened", true);
        call.resolve(result);
    }

    @PluginMethod
    public void getInbox(PluginCall call) {
        if (!hasAccess()) {
            JSObject result = accessResult();
            result.put("entries", new JSArray());
            call.resolve(result);
            return;
        }
        Object rawFrom = call.getData().opt("from");
        Object rawLimit = call.getData().opt("limit");
        long from = rawFrom instanceof Number ? ((Number) rawFrom).longValue() : System.currentTimeMillis() - 24L * 60L * 60L * 1000L;
        int limit = rawLimit instanceof Number ? ((Number) rawLimit).intValue() : 50;
        limit = Math.max(1, Math.min(200, limit));
        String category = call.getString("category", "").trim();
        JSONArray entries = LinkNotificationInboxStore.query(getContext(), Math.max(0L, from), limit, category);
        JSObject result = accessResult();
        result.put("from", from);
        result.put("category", category);
        result.put("entries", entries);
        call.resolve(result);
    }

    @PluginMethod
    public void clearInbox(PluginCall call) {
        LinkNotificationInboxStore.clear(getContext());
        JSObject result = new JSObject();
        result.put("cleared", true);
        call.resolve(result);
    }

    private boolean hasAccess() {
        return NotificationManagerCompat.getEnabledListenerPackages(getContext()).contains(getContext().getPackageName());
    }

    private JSObject accessResult() {
        JSObject result = new JSObject();
        result.put("granted", hasAccess());
        result.put("platform", "android");
        return result;
    }
}