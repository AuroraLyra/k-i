package top.babylink.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Base64;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;
import java.util.ArrayList;
import java.util.List;

public class LinkKeepAliveService extends Service {
    public static final String ACTION_START = "top.babylink.app.action.START_KEEP_ALIVE";
    public static final String ACTION_STOP = "top.babylink.app.action.STOP_KEEP_ALIVE";
    public static final String EXTRA_WAKE_LOCK = "wakeLock";
    public static final String EXTRA_NOTIFICATION_KIND = "linkNotificationKind";
    public static final String EXTRA_CALL_ACTION = "linkCallAction";
    public static final String EXTRA_CONVERSATION_ID = "linkConversationId";
    public static final String EXTRA_CALL_ID = "linkCallId";
    public static final String EXTRA_CALL_MODE = "linkCallMode";
    public static final String EXTRA_NOTIFICATION_TAG = "linkNotificationTag";
    public static final String EXTRA_NOTIFICATION_ID = "linkNotificationId";

    private static final String KEEP_ALIVE_CHANNEL_ID = "babylink_keep_alive";
    private static final String LEGACY_MESSAGE_CHANNEL_ID = "babylink_messages";
    private static final String MESSAGE_CHANNEL_ID = "babylink_messages_v2";
    private static final String CALL_CHANNEL_ID = "babylink_calls_v1";
    private static final int KEEP_ALIVE_NOTIFICATION_ID = 2101;
    private static volatile boolean running;
    private static volatile boolean wakeLockActive;

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }
        boolean useWakeLock = intent == null || intent.getBooleanExtra(EXTRA_WAKE_LOCK, true);
        updateWakeLock(useWakeLock);
        startForeground(KEEP_ALIVE_NOTIFICATION_ID, buildKeepAliveNotification(this));
        running = true;
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        running = false;
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public static boolean isRunning() {
        return running;
    }

    public static boolean isWakeLockActive() {
        return wakeLockActive;
    }

    public static void createNotificationChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel keepAliveChannel = new NotificationChannel(
            KEEP_ALIVE_CHANNEL_ID,
            context.getString(R.string.keep_alive_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        keepAliveChannel.setDescription(context.getString(R.string.keep_alive_channel_description));
        keepAliveChannel.setShowBadge(false);
        manager.createNotificationChannel(keepAliveChannel);
        if (manager.getNotificationChannel(LEGACY_MESSAGE_CHANNEL_ID) != null) {
            manager.deleteNotificationChannel(LEGACY_MESSAGE_CHANNEL_ID);
        }
        NotificationChannel messageChannel = new NotificationChannel(
            MESSAGE_CHANNEL_ID,
            context.getString(R.string.message_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        messageChannel.setDescription(context.getString(R.string.message_channel_description));
        messageChannel.enableVibration(true);
        messageChannel.setVibrationPattern(new long[] { 0, 220, 120, 220 });
        messageChannel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
        messageChannel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        manager.createNotificationChannel(messageChannel);
        NotificationChannel callChannel = new NotificationChannel(
            CALL_CHANNEL_ID,
            context.getString(R.string.call_channel_name),
            NotificationManager.IMPORTANCE_HIGH
        );
        callChannel.setDescription(context.getString(R.string.call_channel_description));
        callChannel.enableVibration(true);
        callChannel.setVibrationPattern(new long[] { 0, 420, 180, 420, 180, 720 });
        callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        callChannel.setSound(
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
            new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        );
        manager.createNotificationChannel(callChannel);
    }

    public static void showNotification(Context context, String kind, String title, String body, List<String> messages, String tag, String icon, String url, String conversationId, String callId, String callMode) {
        if ("call".equals(kind) && callId != null && !callId.trim().isEmpty()) {
            showIncomingCallNotification(context, title, body, tag, icon, url, conversationId, callId, callMode);
            return;
        }
        showMessageNotification(context, title, body, messages, tag, icon, url);
    }

    private static void showIncomingCallNotification(Context context, String title, String body, String tag, String icon, String url, String conversationId, String callId, String callMode) {
        createNotificationChannels(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        String callerName = title == null || title.trim().isEmpty() ? context.getString(R.string.app_name) : title.trim();
        String mode = "video".equals(callMode) ? "video" : "voice";
        String callBody = body == null || body.trim().isEmpty()
            ? ("video".equals(mode) ? "邀请你视频通话" : "邀请你语音通话")
            : body.trim();
        String notificationTag = tag == null || tag.trim().isEmpty() ? "babylink-call-" + callId : tag.trim();
        int notificationId = 2300 + ((callId.hashCode() & 0x7fffffff) % 1000000);
        Bitmap avatar = decodeNotificationAvatar(icon);
        Person.Builder callerBuilder = new Person.Builder().setName(callerName).setImportant(true);
        if (avatar != null) callerBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        Person caller = callerBuilder.build();

        PendingIntent openIntent = createCallPendingIntent(context, notificationId, "open", url, conversationId, callId, mode, notificationTag, notificationId);
        PendingIntent rejectIntent = createCallPendingIntent(context, notificationId + 1, "rejected", url, conversationId, callId, mode, notificationTag, notificationId);
        PendingIntent acceptIntent = createCallPendingIntent(context, notificationId + 2, "accepted", url, conversationId, callId, mode, notificationTag, notificationId);
        NotificationCompat.CallStyle callStyle = NotificationCompat.CallStyle.forIncomingCall(caller, rejectIntent, acceptIntent)
            .setIsVideo("video".equals(mode));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_keep_alive_notification)
            .setContentTitle(callerName)
            .setContentText(callBody)
            .setContentIntent(openIntent)
            .setFullScreenIntent(openIntent, true)
            .setAutoCancel(false)
            .setOngoing(true)
            .setWhen(System.currentTimeMillis())
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))
            .setVibrate(new long[] { 0, 420, 180, 420, 180, 720 })
            .setStyle(callStyle)
            .addPerson(caller);
        if (avatar != null) builder.setLargeIcon(avatar);
        manager.notify(notificationTag, notificationId, builder.build());
    }

    private static PendingIntent createCallPendingIntent(Context context, int requestCode, String action, String url, String conversationId, String callId, String callMode, String notificationTag, int notificationId) {
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setAction(context.getPackageName() + ".CALL_" + action.toUpperCase() + "." + callId);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && !url.trim().isEmpty()) launchIntent.setData(Uri.parse(url));
        launchIntent.putExtra(EXTRA_NOTIFICATION_KIND, "call");
        launchIntent.putExtra(EXTRA_CALL_ACTION, action);
        launchIntent.putExtra(EXTRA_CONVERSATION_ID, conversationId == null ? "" : conversationId);
        launchIntent.putExtra(EXTRA_CALL_ID, callId);
        launchIntent.putExtra(EXTRA_CALL_MODE, callMode);
        launchIntent.putExtra(EXTRA_NOTIFICATION_TAG, notificationTag);
        launchIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
        return PendingIntent.getActivity(
            context,
            requestCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    public static void dismissCallNotification(Context context, String callId, String tag) {
        if (callId == null || callId.trim().isEmpty()) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        int notificationId = 2300 + ((callId.hashCode() & 0x7fffffff) % 1000000);
        String notificationTag = tag == null || tag.trim().isEmpty() ? "babylink-call-" + callId : tag.trim();
        manager.cancel(notificationTag, notificationId);
    }

    private static void showMessageNotification(Context context, String title, String body, List<String> messages, String tag, String icon, String url) {
        createNotificationChannels(context);
        List<String> notificationMessages = new ArrayList<>();
        if (messages != null) {
            for (String message : messages) {
                if (message != null && !message.trim().isEmpty()) notificationMessages.add(message.trim());
            }
        }
        if (notificationMessages.isEmpty() && body != null && !body.trim().isEmpty()) notificationMessages.add(body.trim());
        if (notificationMessages.isEmpty()) return;

        String notificationTitle = title == null || title.trim().isEmpty()
            ? context.getString(R.string.app_name)
            : title.trim();
        String notificationBody = String.join("\n", notificationMessages);
        String baseTag = tag == null || tag.trim().isEmpty() ? "babylink-message" : tag.trim();
        Bitmap avatar = decodeNotificationAvatar(icon);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        int notificationId = Math.max(1, baseTag.hashCode() & 0x7fffffff);
        long notificationTimestamp = System.currentTimeMillis();

        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setAction(context.getPackageName() + ".OPEN_MESSAGE." + baseTag);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (url != null && !url.trim().isEmpty()) launchIntent.setData(Uri.parse(url));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, MESSAGE_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_keep_alive_notification)
            .setContentTitle(notificationTitle)
            .setContentText(notificationBody)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setWhen(notificationTimestamp)
            .setShowWhen(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setDefaults(Notification.DEFAULT_ALL)
            .setVibrate(new long[] { 0, 220, 120, 220 })
            .setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(notificationBody));
        if (avatar != null) builder.setLargeIcon(avatar);
        manager.notify(baseTag, notificationId, builder.build());
    }

    private static Bitmap decodeNotificationAvatar(String source) {
        if (source == null || source.trim().isEmpty() || !source.startsWith("data:image/")) return null;
        int commaIndex = source.indexOf(',');
        if (commaIndex < 0 || commaIndex >= source.length() - 1) return null;
        try {
            byte[] bytes = Base64.decode(source.substring(commaIndex + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        } catch (IllegalArgumentException error) {
            return null;
        }
    }

    private static Notification buildKeepAliveNotification(Context context) {
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) launchIntent = new Intent(context, MainActivity.class);
        launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context,
            KEEP_ALIVE_NOTIFICATION_ID,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new NotificationCompat.Builder(context, KEEP_ALIVE_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_keep_alive_notification)
            .setContentTitle(context.getString(R.string.keep_alive_notification_title))
            .setContentText(context.getString(R.string.keep_alive_notification_text))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void updateWakeLock(boolean enabled) {
        if (!enabled) {
            releaseWakeLock();
            return;
        }
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager manager = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BabyLink:KeepAlive");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire();
        wakeLockActive = true;
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        wakeLockActive = false;
    }
}