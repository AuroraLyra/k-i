package top.babylink.app;

import android.app.Activity;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LinkDisplay")
public class LinkDisplayPlugin extends Plugin {
    private static final String PREFERENCES = "link_display";
    private static final String FULLSCREEN_KEY = "fullscreen_enabled";
    private static final long[] RETRY_DELAYS_MS = {60L, 250L, 750L};

    @PluginMethod
    public void setFullscreen(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("The display activity is unavailable.");
            return;
        }
        getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(FULLSCREEN_KEY, enabled)
            .apply();
        activity.runOnUiThread(() -> {
            applyFullscreen(activity, enabled);
            activity.getWindow().getDecorView().postDelayed(() -> {
                WindowInsetsCompat insets = androidx.core.view.ViewCompat.getRootWindowInsets(activity.getWindow().getDecorView());
                boolean statusBarVisible = insets != null && insets.isVisible(WindowInsetsCompat.Type.statusBars());
                boolean navigationBarVisible = insets != null && insets.isVisible(WindowInsetsCompat.Type.navigationBars());
                JSObject result = new JSObject();
                result.put("enabled", enabled);
                result.put("applied", !enabled || (insets != null && !statusBarVisible && !navigationBarVisible));
                result.put("statusBarVisible", statusBarVisible);
                result.put("navigationBarVisible", navigationBarVisible);
                call.resolve(result);
            }, 600L);
        });
    }

    static void applyStoredFullscreen(Activity activity) {
        boolean enabled = activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getBoolean(FULLSCREEN_KEY, true);
        applyFullscreen(activity, enabled);
    }

    private static void applyFullscreen(Activity activity, boolean enabled) {
        if (activity == null || activity.isFinishing() || (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1 && activity.isDestroyed())) return;
        applySystemBars(activity, enabled);
        View decorView = activity.getWindow().getDecorView();
        for (long delay : RETRY_DELAYS_MS) {
            decorView.postDelayed(() -> {
                if (isCurrentPreference(activity, enabled)) applySystemBars(activity, enabled);
            }, delay);
        }
    }

    private static boolean isCurrentPreference(Activity activity, boolean enabled) {
        return activity.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getBoolean(FULLSCREEN_KEY, true) == enabled;
    }

    private static void applySystemBars(Activity activity, boolean enabled) {
        Window window = activity.getWindow();
        View decorView = window.getDecorView();
        if (enabled) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            window.clearFlags(WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            else window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            WindowManager.LayoutParams attributes = window.getAttributes();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS;
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            }
            window.setAttributes(attributes);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setStatusBarColor(Color.TRANSPARENT);
                window.setNavigationBarColor(Color.TRANSPARENT);
                window.setStatusBarContrastEnforced(false);
                window.setNavigationBarContrastEnforced(false);
            }
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
                decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                );
            }
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController platformController = window.getInsetsController();
                if (platformController != null) {
                    platformController.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    platformController.hide(WindowInsets.Type.systemBars());
                }
            }
        } else {
            WindowCompat.setDecorFitsSystemWindows(window, true);
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            WindowManager.LayoutParams attributes = window.getAttributes();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                attributes.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT;
                window.setAttributes(attributes);
            }
            decorView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.show(WindowInsetsCompat.Type.systemBars());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController platformController = window.getInsetsController();
                if (platformController != null) platformController.show(WindowInsets.Type.systemBars());
            }
        }
    }
}