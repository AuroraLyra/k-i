import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeMcpLocalResponse {
  status: number;
  statusText: string;
  headers?: {
    contentType?: string;
    contentLength?: string;
    mcpSessionId?: string;
  };
  bodyBase64?: string;
}

interface NativeMcpLocalPlugin {
  request(options: {
    requestId: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body: string;
    timeoutMs: number;
  }): Promise<NativeMcpLocalResponse>;
  cancel(options: { requestId: string }): Promise<void>;
}

const LinkMcpLocal = registerPlugin<NativeMcpLocalPlugin>('LinkMcpLocal');
let nextRequestId = 0;

export function nativeMcpLocalAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkMcpLocal');
}

function decodeBase64(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createAbortError() {
  return new DOMException('本机 MCP 请求已取消。', 'AbortError');
}

export async function fetchNativeMcpLocal(url: string, init: RequestInit, timeoutMs: number) {
  if (!nativeMcpLocalAvailable()) throw new Error('当前 Android App 没有本机 MCP 中继能力。');
  const requestId = `mcp-local-${Date.now()}-${++nextRequestId}`;
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const body = typeof init.body === 'string' ? init.body : '';
  const signal = init.signal;
  if (signal?.aborted) throw createAbortError();

  let rejectAbort: ((error: Error) => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const onAbort = () => {
    void LinkMcpLocal.cancel({ requestId }).catch(() => undefined);
    rejectAbort?.(createAbortError());
  };
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await Promise.race([
      LinkMcpLocal.request({
        requestId,
        url,
        method: String(init.method ?? 'POST').toUpperCase(),
        headers,
        body,
        timeoutMs
      }),
      abortPromise
    ]);
    const responseHeaders = new Headers();
    if (response.headers?.contentType) responseHeaders.set('Content-Type', response.headers.contentType);
    if (response.headers?.contentLength) responseHeaders.set('Content-Length', response.headers.contentLength);
    if (response.headers?.mcpSessionId) responseHeaders.set('Mcp-Session-Id', response.headers.mcpSessionId);
    const status = Math.max(100, Math.min(599, Math.round(Number(response.status) || 502)));
    const bytes = decodeBase64(String(response.bodyBase64 ?? ''));
    return new Response([204, 205, 304].includes(status) ? null : bytes, {
      status,
      statusText: response.statusText,
      headers: responseHeaders
    });
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}