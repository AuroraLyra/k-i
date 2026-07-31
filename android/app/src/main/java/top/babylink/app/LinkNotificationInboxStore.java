package top.babylink.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class LinkNotificationInboxStore {
    private static final String PREFERENCES = "link_notification_inbox";
    private static final String ENTRIES = "entries";
    private static final int MAX_ENTRIES = 200;
    private static final long MAX_AGE_MS = 7L * 24L * 60L * 60L * 1000L;
    private static final Object LOCK = new Object();
    private static final Pattern SENSITIVE_CODE = Pattern.compile("(?i)(验证码|校验码|动态码|verification\\s*code|otp)([^0-9]{0,16})([0-9]{4,8})");

    private LinkNotificationInboxStore() {
    }

    static void append(Context context, String sourceKey, String packageName, String appName, String title, String text, long postedAt, String category) {
        synchronized (LOCK) {
            JSONArray current = readArray(context);
            JSONArray next = new JSONArray();
            String id = hash(sourceKey);
            JSONObject entry = new JSONObject();
            String sanitizedTitle = sanitize(title);
            String sanitizedText = sanitize(text);
            try {
                entry.put("id", id);
                entry.put("packageName", limit(packageName, 200));
                entry.put("appName", limit(appName, 120));
                entry.put("title", sanitizedTitle);
                entry.put("text", sanitizedText);
                entry.put("postedAt", postedAt);
                entry.put("category", category);
                entry.put("redacted", !sanitizedTitle.equals(limit(title, 300)) || !sanitizedText.equals(limit(text, 1200)));
            } catch (JSONException error) {
                return;
            }
            next.put(entry);

            long cutoff = System.currentTimeMillis() - MAX_AGE_MS;
            for (int index = 0; index < current.length() && next.length() < MAX_ENTRIES; index += 1) {
                JSONObject existing = current.optJSONObject(index);
                if (existing == null || id.equals(existing.optString("id")) || existing.optLong("postedAt", 0L) < cutoff) continue;
                next.put(existing);
            }
            writeArray(context, next);
        }
    }

    static JSONArray query(Context context, long from, int limit, String category) {
        synchronized (LOCK) {
            JSONArray current = readArray(context);
            JSONArray result = new JSONArray();
            for (int index = 0; index < current.length() && result.length() < limit; index += 1) {
                JSONObject entry = current.optJSONObject(index);
                if (entry == null || entry.optLong("postedAt", 0L) < from) continue;
                if (!category.isEmpty() && !category.equals(entry.optString("category"))) continue;
                result.put(entry);
            }
            return result;
        }
    }

    static void clear(Context context) {
        synchronized (LOCK) {
            writeArray(context, new JSONArray());
        }
    }

    private static JSONArray readArray(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        try {
            return new JSONArray(preferences.getString(ENTRIES, "[]"));
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private static void writeArray(Context context, JSONArray entries) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit()
            .putString(ENTRIES, entries.toString())
            .apply();
    }

    private static String sanitize(String value) {
        String limited = limit(value, 1200);
        Matcher matcher = SENSITIVE_CODE.matcher(limited);
        StringBuffer output = new StringBuffer();
        while (matcher.find()) matcher.appendReplacement(output, Matcher.quoteReplacement(matcher.group(1) + matcher.group(2) + "••••"));
        matcher.appendTail(output);
        return output.toString();
    }

    private static String limit(String value, int maxLength) {
        String normalized = value == null ? "" : value.replaceAll("[\\p{Cntrl}&&[^\\n\\t]]", "").trim();
        return normalized.length() > maxLength ? normalized.substring(0, maxLength) : normalized;
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder output = new StringBuilder();
            for (int index = 0; index < 12; index += 1) output.append(String.format(Locale.ROOT, "%02x", digest[index]));
            return output.toString();
        } catch (Exception ignored) {
            return Integer.toHexString(value.hashCode());
        }
    }
}