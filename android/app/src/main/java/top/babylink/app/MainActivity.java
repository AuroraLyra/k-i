package top.babylink.app;

import android.app.NotificationManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
	private static final String APP_HOME_URL = "https://babylink.top/home";
	private String pendingNotificationUrl;
	private String pendingNotificationKind = "message";
	private String pendingNotificationAction = "open";
	private String pendingConversationId = "";
	private String pendingCallId = "";
	private String pendingCallMode = "voice";
	private int pendingNotificationDispatchAttempts;

	@Override
	public void onCreate(Bundle savedInstanceState) {
		registerPlugin(LinkUpdaterPlugin.class);
		registerPlugin(LinkKeepAlivePlugin.class);
		registerPlugin(LinkMediaPlugin.class);
		registerPlugin(LinkBackupPlugin.class);
		registerPlugin(LinkDisplayPlugin.class);
		super.onCreate(savedInstanceState);
		LinkDisplayPlugin.applyStoredFullscreen(this);
		getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
			@Override
			public void handleOnBackPressed() {
				WebView webView = getBridge() == null ? null : getBridge().getWebView();
				if (webView == null) return;
				String currentUrl = webView.getUrl();
				String path = currentUrl == null ? null : Uri.parse(currentUrl).getPath();
				if (isRootPath(path)) return;
				if (webView.canGoBack()) webView.goBack();
				else webView.loadUrl(APP_HOME_URL);
			}
		});
		openNotificationRoute(getIntent());
	}

	@Override
	protected void onNewIntent(Intent intent) {
		super.onNewIntent(intent);
		setIntent(intent);
		openNotificationRoute(intent);
	}

	@Override
	public void onResume() {
		super.onResume();
		LinkDisplayPlugin.applyStoredFullscreen(this);
		dispatchPendingNotificationRoute();
	}

	@Override
	protected void onPostResume() {
		super.onPostResume();
		LinkDisplayPlugin.applyStoredFullscreen(this);
	}

	@Override
	public void onWindowFocusChanged(boolean hasFocus) {
		super.onWindowFocusChanged(hasFocus);
		if (hasFocus) LinkDisplayPlugin.applyStoredFullscreen(this);
	}

	private void openNotificationRoute(Intent intent) {
		Uri uri = intent == null ? null : intent.getData();
		String host = uri == null ? null : uri.getHost();
		String path = uri == null ? null : uri.getPath();
		if (host == null || !(host.equals("babylink.top") || host.endsWith(".babylink.top"))) return;
		if (path == null || !(path.startsWith("/chats/") || path.equals("/voom") || path.equals("/voom/"))) return;
		pendingNotificationUrl = uri.toString();
		pendingNotificationKind = "call".equals(intent.getStringExtra(LinkKeepAliveService.EXTRA_NOTIFICATION_KIND))
			? "call"
			: path.startsWith("/voom") ? "voom" : "message";
		String callAction = intent.getStringExtra(LinkKeepAliveService.EXTRA_CALL_ACTION);
		pendingNotificationAction = "accepted".equals(callAction) ? "accepted" : "rejected".equals(callAction) ? "rejected" : "open";
		pendingConversationId = normalizeExtra(intent.getStringExtra(LinkKeepAliveService.EXTRA_CONVERSATION_ID));
		pendingCallId = normalizeExtra(intent.getStringExtra(LinkKeepAliveService.EXTRA_CALL_ID));
		pendingCallMode = "video".equals(intent.getStringExtra(LinkKeepAliveService.EXTRA_CALL_MODE)) ? "video" : "voice";
		pendingNotificationDispatchAttempts = 0;
		dismissNotification(intent);
		dispatchPendingNotificationRoute();
	}

	private void dispatchPendingNotificationRoute() {
		if (pendingNotificationUrl == null || pendingNotificationUrl.isEmpty()) return;
		WebView webView = getBridge() == null ? null : getBridge().getWebView();
		if (webView == null) return;
		String targetUrl = pendingNotificationUrl;
		String script = "(function(){if(!window.__LINK_NOTIFICATION_BRIDGE_READY__)return false;window.dispatchEvent(new CustomEvent('LINK_NOTIFICATION_CLICK',{detail:{type:'LINK_NOTIFICATION_CLICK',url:"
			+ JSONObject.quote(targetUrl)
			+ ",kind:"
			+ JSONObject.quote(pendingNotificationKind)
			+ ",action:"
			+ JSONObject.quote(pendingNotificationAction)
			+ ",conversationId:"
			+ JSONObject.quote(pendingConversationId)
			+ ",callId:"
			+ JSONObject.quote(pendingCallId)
			+ ",callMode:"
			+ JSONObject.quote(pendingCallMode)
			+ "}}));return true;})();";
		webView.post(() -> webView.evaluateJavascript(script, value -> {
			if ("true".equals(value) && targetUrl.equals(pendingNotificationUrl)) clearPendingNotificationRoute();
		}));
		pendingNotificationDispatchAttempts += 1;
		if (pendingNotificationDispatchAttempts >= 8) {
			clearPendingNotificationRoute();
			return;
		}
		webView.postDelayed(this::dispatchPendingNotificationRoute, 500);
	}

	private String normalizeExtra(String value) {
		return value == null ? "" : value.trim();
	}

	private void dismissNotification(Intent intent) {
		String notificationTag = normalizeExtra(intent.getStringExtra(LinkKeepAliveService.EXTRA_NOTIFICATION_TAG));
		int notificationId = intent.getIntExtra(LinkKeepAliveService.EXTRA_NOTIFICATION_ID, 0);
		if (notificationTag.isEmpty() || notificationId <= 0) return;
		NotificationManager manager = getSystemService(NotificationManager.class);
		if (manager != null) manager.cancel(notificationTag, notificationId);
	}

	private void clearPendingNotificationRoute() {
		pendingNotificationUrl = null;
		pendingNotificationKind = "message";
		pendingNotificationAction = "open";
		pendingConversationId = "";
		pendingCallId = "";
		pendingCallMode = "voice";
	}

	static boolean isRootPath(String path) {
		return path == null
			|| path.isEmpty()
			|| "/".equals(path)
			|| "/home".equals(path)
			|| "/home/".equals(path)
			|| "/access".equals(path)
			|| "/access/".equals(path);
	}
}
