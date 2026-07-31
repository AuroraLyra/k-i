package top.babylink.app;

import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.Proxy;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

@CapacitorPlugin(name = "LinkMcpLocal")
public class LinkMcpLocalPlugin extends Plugin {
    private static final int MAX_REQUEST_BYTES = 1024 * 1024;
    private static final int MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
    private static final int MIN_TIMEOUT_MS = 3_000;
    private static final int MAX_TIMEOUT_MS = 120_000;
    private static final Set<String> FORBIDDEN_HEADERS = new HashSet<>();

    static {
        FORBIDDEN_HEADERS.add("connection");
        FORBIDDEN_HEADERS.add("content-length");
        FORBIDDEN_HEADERS.add("cookie");
        FORBIDDEN_HEADERS.add("host");
        FORBIDDEN_HEADERS.add("origin");
        FORBIDDEN_HEADERS.add("proxy-authorization");
        FORBIDDEN_HEADERS.add("proxy-connection");
        FORBIDDEN_HEADERS.add("te");
        FORBIDDEN_HEADERS.add("transfer-encoding");
        FORBIDDEN_HEADERS.add("upgrade");
    }

    private final Map<String, HttpURLConnection> activeRequests = new ConcurrentHashMap<>();
    private final Semaphore requestSlots = new Semaphore(4);

    @Override
    protected void handleOnDestroy() {
        for (HttpURLConnection connection : activeRequests.values()) connection.disconnect();
        activeRequests.clear();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void request(PluginCall call) {
        String requestId = call.getString("requestId", "").trim();
        String rawUrl = call.getString("url", "").trim();
        String method = call.getString("method", "POST").trim().toUpperCase(Locale.ROOT);
        String body = call.getString("body", "");
        Number timeoutValue = call.getData().opt("timeoutMs") instanceof Number
            ? (Number) call.getData().opt("timeoutMs")
            : Integer.valueOf(45_000);
        int timeoutMs = Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeoutValue.intValue()));
        if (requestId.isEmpty()) {
            call.reject("本机 MCP 请求缺少请求 ID。");
            return;
        }
        if (!(method.equals("POST") || method.equals("DELETE"))) {
            call.reject("本机 MCP 中继只允许 POST 和 DELETE。");
            return;
        }
        byte[] requestBody = body.getBytes(StandardCharsets.UTF_8);
        if (requestBody.length > MAX_REQUEST_BYTES) {
            call.reject("本机 MCP 请求体不能超过 1 MB。");
            return;
        }

        final URL target;
        try {
            target = validateTarget(rawUrl);
            validateHeaders(call.getObject("headers", new JSObject()));
        } catch (Exception error) {
            call.reject(error.getMessage());
            return;
        }

        getBridge().execute(() -> executeRequest(call, requestId, target, method, requestBody, timeoutMs));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String requestId = call.getString("requestId", "").trim();
        HttpURLConnection connection = activeRequests.remove(requestId);
        if (connection != null) connection.disconnect();
        call.resolve();
    }

    private void executeRequest(PluginCall call, String requestId, URL target, String method, byte[] body, int timeoutMs) {
        if (!requestSlots.tryAcquire()) {
            call.reject("本机 MCP 请求过多，请稍后重试。");
            return;
        }
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) target.openConnection(Proxy.NO_PROXY);
            activeRequests.put(requestId, connection);
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(Math.min(timeoutMs, 15_000));
            connection.setReadTimeout(timeoutMs);
            connection.setUseCaches(false);
            connection.setRequestMethod(method);
            applyHeaders(connection, call.getObject("headers", new JSObject()));
            if (method.equals("POST")) {
                connection.setDoOutput(true);
                connection.setFixedLengthStreamingMode(body.length);
                connection.getOutputStream().write(body);
            }

            int status = connection.getResponseCode();
            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > MAX_RESPONSE_BYTES) throw new IllegalStateException("本机 MCP 响应超过 4 MB。");
            InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
            byte[] responseBody = stream == null ? new byte[0] : readLimited(stream);

            JSObject responseHeaders = new JSObject();
            copyResponseHeader(connection, responseHeaders, "Content-Type", "contentType");
            copyResponseHeader(connection, responseHeaders, "Content-Length", "contentLength");
            copyResponseHeader(connection, responseHeaders, "Mcp-Session-Id", "mcpSessionId");
            JSObject result = new JSObject();
            result.put("status", status);
            result.put("statusText", String.valueOf(connection.getResponseMessage()));
            result.put("headers", responseHeaders);
            result.put("bodyBase64", Base64.encodeToString(responseBody, Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception error) {
            call.reject(error.getMessage() == null ? "本机 MCP 请求失败。" : error.getMessage(), error);
        } finally {
            activeRequests.remove(requestId);
            if (connection != null) connection.disconnect();
            requestSlots.release();
        }
    }

    private static URL validateTarget(String rawUrl) throws Exception {
        URL target = URI.create(rawUrl).toURL();
        String protocol = target.getProtocol().toLowerCase(Locale.ROOT);
        if (!(protocol.equals("http") || protocol.equals("https"))) throw new IllegalArgumentException("本机 MCP 地址协议无效。");
        if (target.getUserInfo() != null && !target.getUserInfo().isEmpty()) throw new IllegalArgumentException("本机 MCP 地址不能包含账号密码。");
        String hostname = target.getHost().toLowerCase(Locale.ROOT).replaceAll("\\.$", "");
        boolean namedLoopback = hostname.equals("localhost") || hostname.endsWith(".localhost");
        boolean literalLoopback = hostname.equals("127.0.0.1") || hostname.equals("::1") || hostname.equals("[::1]");
        if (!(namedLoopback || literalLoopback)) throw new IllegalArgumentException("本机 MCP 中继只允许 localhost、127.0.0.1 或 [::1]。");
        for (InetAddress address : InetAddress.getAllByName(target.getHost())) {
            if (!address.isLoopbackAddress()) throw new IllegalArgumentException("本机 MCP 主机没有解析到回环地址。");
        }
        return target;
    }

    private static void validateHeaders(JSObject headers) {
        Iterator<String> names = headers.keys();
        while (names.hasNext()) {
            String name = names.next().trim();
            String value = headers.optString(name, "");
            if (!name.matches("^[!#$%&'*+.^_`|~0-9A-Za-z-]+$") || value.contains("\r") || value.contains("\n")) {
                throw new IllegalArgumentException("本机 MCP 请求头无效。");
            }
            if (FORBIDDEN_HEADERS.contains(name.toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("本机 MCP 请求头不允许设置 " + name + "。");
            }
        }
    }

    private static void applyHeaders(HttpURLConnection connection, JSObject headers) {
        Iterator<String> names = headers.keys();
        while (names.hasNext()) {
            String name = names.next();
            connection.setRequestProperty(name, headers.optString(name, ""));
        }
    }

    private static byte[] readLimited(InputStream stream) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) != -1) {
                total += read;
                if (total > MAX_RESPONSE_BYTES) throw new IllegalStateException("本机 MCP 响应超过 4 MB。");
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static void copyResponseHeader(HttpURLConnection connection, JSObject target, String sourceName, String targetName) {
        String value = connection.getHeaderField(sourceName);
        if (value != null && !value.isEmpty()) target.put(targetName, value);
    }
}