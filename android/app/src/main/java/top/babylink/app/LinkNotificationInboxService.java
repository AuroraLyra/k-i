package top.babylink.app;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

public class LinkNotificationInboxService extends NotificationListenerService {
    @Override
    public void onNotificationPosted(StatusBarNotification statusBarNotification) {
        if (statusBarNotification == null || getPackageName().equals(statusBarNotification.getPackageName())) return;
        Notification notification = statusBarNotification.getNotification();
        if (notification == null || notification.visibility == Notification.VISIBILITY_SECRET) return;
        Bundle extras = notification.extras;
        String title = firstText(extras, Notification.EXTRA_TITLE, Notification.EXTRA_TITLE_BIG);
        String text = firstText(extras, Notification.EXTRA_BIG_TEXT, Notification.EXTRA_TEXT, Notification.EXTRA_SUB_TEXT, Notification.EXTRA_INFO_TEXT);
        if (title.isEmpty() && text.isEmpty()) return;
        String packageName = statusBarNotification.getPackageName();
        String appName = packageName;
        try {
            appName = String.valueOf(getPackageManager().getApplicationLabel(getPackageManager().getApplicationInfo(packageName, 0)));
        } catch (Exception ignored) {
            appName = packageName;
        }
        LinkNotificationInboxStore.append(
            this,
            statusBarNotification.getKey(),
            packageName,
            appName,
            title,
            text,
            statusBarNotification.getPostTime(),
            classify(packageName, title, text, notification.category)
        );
    }

    private static String firstText(Bundle extras, String... keys) {
        if (extras == null) return "";
        for (String key : keys) {
            CharSequence value = extras.getCharSequence(key);
            if (value != null && !value.toString().trim().isEmpty()) return value.toString().trim();
        }
        return "";
    }

    private static String classify(String packageName, String title, String text, String notificationCategory) {
        String source = (packageName + " " + title + " " + text + " " + notificationCategory).toLowerCase();
        if (source.matches(".*(快递|取件|驿站|包裹|物流|express|delivery|courier).*")) return "delivery";
        if (source.matches(".*(外卖|骑手|送达|取餐|美团|饿了么|food).*")) return "food";
        if (source.matches(".*(会议|日程|邀请|腾讯会议|飞书|钉钉|meeting|calendar).*")) return "meeting";
        if (source.matches(".*(航班|火车|高铁|酒店|登机|出行|travel|flight|train).*")) return "travel";
        if (source.matches(".*(支付|订单|发货|退款|购物|淘宝|京东|拼多多|order|shopping).*")) return "shopping";
        if (Notification.CATEGORY_MESSAGE.equals(notificationCategory)) return "message";
        return "other";
    }
}