import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireSession } from './auth.js';
import { config } from './config.js';
import { createTimeoutSignal, validatePublicUrl } from './security.js';

const assetDownloadMaxRedirects = 4;
const webPageMaxRedirects = 6;
const textProxyMaxResponseBytes = 5 * 1024 * 1024;
const mcpProxyMaxResponseBytes = 5 * 1024 * 1024;
const mcpProxyJobTtlMs = 15 * 60 * 1000;
const fontAssetExtensionPattern = /\.(?:css|woff2?|ttf|otf)(?:$|[?#])/i;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const skippedMcpRequestHeaders = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'cookie',
  'host',
  'origin',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-fetch-user',
  'user-agent'
]);

interface McpProxyJobResponse {
  status: number;
  statusText: string;
  headers: {
    contentType?: string;
    contentLength?: string;
    mcpSessionId?: string;
  };
  bodyBase64: string;
}

type McpProxyJob = {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
} & (
  | { status: 'pending' }
  | { status: 'done'; response: McpProxyJobResponse }
  | { status: 'error'; error: string }
);

const mcpProxyJobs = new Map<string, McpProxyJob>();

function bodyBuffer(request: FastifyRequest) {
  if (request.body === undefined || request.body === null) return undefined;
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);
  return Buffer.from(JSON.stringify(request.body));
}

async function relayResponse(reply: Parameters<typeof requireSession>[1], upstream: Response, maxBytes = Number.POSITIVE_INFINITY) {
  reply.code(upstream.status);
  const contentType = upstream.headers.get('content-type');
  const contentLength = upstream.headers.get('content-length');
  if (contentLength && Number(contentLength) > maxBytes) {
    return await reply.code(413).send({ error: 'upstream_response_too_large', message: '上游资源超过允许的下载大小。' });
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.byteLength > maxBytes) {
    return await reply.code(413).send({ error: 'upstream_response_too_large', message: '上游资源超过允许的下载大小。' });
  }
  if (contentType) reply.header('Content-Type', contentType);
  if (contentLength) reply.header('Content-Length', contentLength);
  reply.header('Cache-Control', 'no-store');
  return reply.send(body);
}

async function relayMcpResponse(reply: Parameters<typeof requireSession>[1], upstream: Response) {
  reply.code(upstream.status);
  const contentType = upstream.headers.get('content-type');
  const contentLength = upstream.headers.get('content-length');
  const sessionId = upstream.headers.get('mcp-session-id');
  if (contentLength && Number(contentLength) > mcpProxyMaxResponseBytes) {
    return await reply.code(413).send({ error: { code: 'mcp_response_too_large', message: 'MCP 返回内容超过允许大小。' } });
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.byteLength > mcpProxyMaxResponseBytes) {
    return await reply.code(413).send({ error: { code: 'mcp_response_too_large', message: 'MCP 返回内容超过允许大小。' } });
  }
  if (contentType) reply.header('Content-Type', contentType);
  if (contentLength) reply.header('Content-Length', contentLength);
  if (sessionId) reply.header('Mcp-Session-Id', sessionId);
  reply.header('Cache-Control', 'no-store');
  return reply.send(body);
}

function createMcpJobResponse(status: number, statusText: string, payload: Buffer, headers: McpProxyJobResponse['headers'] = {}): McpProxyJobResponse {
  return {
    status,
    statusText,
    headers: {
      ...headers,
      contentLength: String(payload.byteLength)
    },
    bodyBase64: payload.toString('base64')
  };
}

function createMcpErrorJobResponse(status: number, code: string, message: string): McpProxyJobResponse {
  return createMcpJobResponse(status, 'MCP Proxy Error', Buffer.from(JSON.stringify({ error: { code, message } }), 'utf8'), {
    contentType: 'application/json; charset=utf-8'
  });
}

function createMcpProxyHeaders(request: FastifyRequest) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    const normalizedName = name.toLowerCase();
    if (skippedMcpRequestHeaders.has(normalizedName) || normalizedName.startsWith('proxy-')) continue;
    if (Array.isArray(value)) headers.set(name, value.join(', '));
    else if (typeof value === 'string' && value) headers.set(name, value);
  }
  headers.set('Accept', headers.get('Accept') || 'application/json, text/event-stream');
  return headers;
}

function sweepMcpProxyJobs() {
  const expiredBefore = Date.now() - mcpProxyJobTtlMs;
  for (const [jobId, job] of mcpProxyJobs) {
    if (job.updatedAt < expiredBefore) mcpProxyJobs.delete(jobId);
  }
}

async function resolveMcpProxyResponse(upstream: Response): Promise<McpProxyJobResponse> {
  const contentType = upstream.headers.get('content-type') || undefined;
  const contentLength = upstream.headers.get('content-length') || undefined;
  const mcpSessionId = upstream.headers.get('mcp-session-id') || undefined;
  if (contentLength && Number(contentLength) > mcpProxyMaxResponseBytes) {
    await upstream.body?.cancel().catch(() => undefined);
    return createMcpErrorJobResponse(413, 'mcp_response_too_large', 'MCP 返回内容超过允许大小。');
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  if (body.byteLength > mcpProxyMaxResponseBytes) {
    return createMcpErrorJobResponse(413, 'mcp_response_too_large', 'MCP 返回内容超过允许大小。');
  }
  return createMcpJobResponse(upstream.status, upstream.statusText, body, { contentType, contentLength, mcpSessionId });
}

function startMcpProxyJob(sessionId: string, target: URL, request: FastifyRequest) {
  sweepMcpProxyJobs();
  const jobId = randomUUID();
  const headers = createMcpProxyHeaders(request);
  const body = bodyBuffer(request);
  const now = Date.now();
  mcpProxyJobs.set(jobId, { sessionId, status: 'pending', createdAt: now, updatedAt: now });
  void (async () => {
    try {
      const upstream = await fetch(target, {
        method: 'POST',
        headers,
        body,
        redirect: 'manual',
        signal: createTimeoutSignal(config.modelRequestTimeoutMs)
      });
      mcpProxyJobs.set(jobId, { sessionId, status: 'done', response: await resolveMcpProxyResponse(upstream), createdAt: now, updatedAt: Date.now() });
    } catch (error) {
      mcpProxyJobs.set(jobId, { sessionId, status: 'error', error: error instanceof Error ? error.message : 'MCP 上游请求失败。', createdAt: now, updatedAt: Date.now() });
    }
  })();
  return jobId;
}

async function parseTarget(rawTarget: string) {
  return await validatePublicUrl(rawTarget, config.allowInsecureUpstreams ? ['http:', 'https:'] : ['https:']);
}

async function fetchPublicWebPage(rawTarget: string) {
  let target = await validatePublicUrl(rawTarget, ['http:', 'https:'], true);
  for (let redirectCount = 0; redirectCount <= webPageMaxRedirects; redirectCount += 1) {
    const upstream = await fetch(target, {
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36 BabyLink/1.0'
      },
      redirect: 'manual',
      signal: createTimeoutSignal(config.upstreamTimeoutMs)
    });
    if (!redirectStatuses.has(upstream.status)) return { upstream, target };
    const location = upstream.headers.get('location');
    if (!location) return { upstream, target };
    await upstream.body?.cancel();
    if (redirectCount === webPageMaxRedirects) throw new Error('网页重定向次数过多。');
    target = await validatePublicUrl(new URL(location, target).href, ['http:', 'https:'], true);
  }
  throw new Error('网页重定向次数过多。');
}

async function fetchPublicAsset(rawTarget: string, accept: string) {
  let target = await parseTarget(rawTarget);
  for (let redirectCount = 0; redirectCount <= assetDownloadMaxRedirects; redirectCount += 1) {
    const upstream = await fetch(target, {
      headers: {
        Accept: accept,
        'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 BabyLink-Font-Cache/1.0',
        Referer: `${target.protocol}//${target.host}/`
      },
      redirect: 'manual',
      signal: createTimeoutSignal(config.modelRequestTimeoutMs)
    });
    if (![301, 302, 303, 307, 308].includes(upstream.status)) return { upstream, target };
    const location = upstream.headers.get('location');
    if (!location) return { upstream, target };
    if (redirectCount === assetDownloadMaxRedirects) throw new Error('字体资源重定向次数过多。');
    target = await parseTarget(new URL(location, target).href);
  }
  throw new Error('字体资源重定向次数过多。');
}

function isFontAssetResponse(contentType: string, target: URL) {
  const normalizedType = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return normalizedType === 'text/css'
    || normalizedType.startsWith('font/')
    || ['application/octet-stream', 'application/font-woff', 'application/x-font-ttf', 'application/x-font-otf', 'application/vnd.ms-fontobject'].includes(normalizedType)
    || fontAssetExtensionPattern.test(target.href);
}

export async function registerUpstreamProxy(app: FastifyInstance) {
  app.post('/__mcp-proxy/jobs', { bodyLimit: config.proxyBodyLimitBytes }, async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    try {
      const target = await parseTarget(String((request.query as { url?: unknown }).url ?? ''));
      return await reply.code(202).send({ jobId: startMcpProxyJob(session.sessionId, target, request) });
    } catch (error) {
      return await reply.code(502).send({ error: { code: 'mcp_proxy_job_failed', message: error instanceof Error ? error.message : 'MCP 作业创建失败。' } });
    }
  });

  app.get('/__mcp-proxy/jobs/:jobId', async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    sweepMcpProxyJobs();
    const jobId = String((request.params as { jobId?: unknown }).jobId ?? '');
    const job = mcpProxyJobs.get(jobId);
    if (!job || job.sessionId !== session.sessionId) return await reply.code(404).send({ error: { code: 'mcp_proxy_job_not_found', message: 'MCP 作业不存在或已过期。' } });
    if (job.status === 'pending') return await reply.code(202).send({ status: 'pending' });
    if (job.status === 'error') {
      mcpProxyJobs.delete(jobId);
      return await reply.code(502).send({ error: { code: 'mcp_proxy_job_failed', message: job.error } });
    }
    mcpProxyJobs.delete(jobId);
    return await reply.send({ status: 'done', response: job.response });
  });

  app.route({
    method: ['POST', 'DELETE'],
    url: '/__mcp-proxy',
    bodyLimit: config.proxyBodyLimitBytes,
    handler: async (request, reply) => {
      if (!await requireSession(request, reply)) return;
      try {
        const target = await parseTarget(String((request.query as { url?: unknown }).url ?? ''));
        const method = request.method === 'DELETE' ? 'DELETE' : 'POST';
        const upstream = await fetch(target, {
          method,
          headers: createMcpProxyHeaders(request),
          redirect: 'manual',
          signal: createTimeoutSignal(config.modelRequestTimeoutMs),
          ...(method === 'POST' ? { body: bodyBuffer(request) } : {})
        });
        return await relayMcpResponse(reply, upstream);
      } catch (error) {
        return await reply.code(502).send({ error: { code: 'mcp_proxy_request_failed', message: error instanceof Error ? error.message : 'MCP 上游请求失败。' } });
      }
    }
  });

  app.get('/__web-page-proxy', async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    try {
      const { upstream, target } = await fetchPublicWebPage(String((request.query as { url?: unknown }).url ?? ''));
      reply.header('X-Link-Proxy-Final-Url', target.href);
      return await relayResponse(reply, upstream, textProxyMaxResponseBytes);
    } catch (error) {
      return await reply.code(502).send({ error: { code: 'web_page_request_failed', message: error instanceof Error ? error.message : '网页上游请求失败。' } });
    }
  });

  app.route({
    method: ['GET', 'POST'],
    url: '/__text-proxy',
    bodyLimit: config.proxyBodyLimitBytes,
    handler: async (request, reply) => {
      if (!await requireSession(request, reply)) return;
      try {
        const target = await parseTarget(String((request.query as { url?: unknown }).url ?? ''));
        const headers = new Headers();
        for (const name of ['authorization', 'accept', 'content-type']) {
          const value = request.headers[name];
          if (typeof value === 'string' && value) headers.set(name, value);
        }
        const upstream = await fetch(target, {
          method: request.method,
          headers,
          signal: createTimeoutSignal(config.modelRequestTimeoutMs),
          ...(request.method === 'POST' ? { body: bodyBuffer(request) } : {})
        });
        return await relayResponse(reply, upstream, textProxyMaxResponseBytes);
      } catch (error) {
        return await reply.code(502).send({ error: { code: 'proxy_request_failed', message: error instanceof Error ? error.message : '上游请求失败。' } });
      }
    }
  });

  app.post('/__image-proxy', { bodyLimit: config.proxyBodyLimitBytes }, async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    try {
      const target = await parseTarget(String((request.query as { url?: unknown }).url ?? ''));
      const headers = new Headers();
      for (const name of ['authorization', 'accept', 'content-type']) {
        const value = request.headers[name];
        if (typeof value === 'string' && value) headers.set(name, value);
      }
      const upstream = await fetch(target, { method: 'POST', headers, body: bodyBuffer(request), signal: createTimeoutSignal(config.modelRequestTimeoutMs) });
      return await relayResponse(reply, upstream);
    } catch (error) {
      return await reply.code(502).send({ error: { code: 'proxy_request_failed', message: error instanceof Error ? error.message : '图片上游请求失败。' } });
    }
  });

  app.get('/__image-download', async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    try {
      const target = await parseTarget(String((request.query as { url?: unknown }).url ?? ''));
      const headers = new Headers({ Accept: String(request.headers.accept ?? 'image/*,*/*;q=0.8') });
      const authorization = request.headers.authorization;
      if (authorization) headers.set('Authorization', authorization);
      const upstream = await fetch(target, { headers, signal: createTimeoutSignal(config.modelRequestTimeoutMs) });
      return await relayResponse(reply, upstream);
    } catch (error) {
      return await reply.code(502).send({ error: 'image_download_failed', message: error instanceof Error ? error.message : '图片下载失败。' });
    }
  });

  app.get('/__asset-download', async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    try {
      const rawTarget = String((request.query as { url?: unknown }).url ?? '');
      const { upstream, target } = await fetchPublicAsset(rawTarget, String(request.headers.accept ?? '*/*'));
      if (upstream.ok && !isFontAssetResponse(upstream.headers.get('content-type') ?? '', target)) {
        return await reply.code(415).send({ error: 'unsupported_asset_type', message: '链接返回的内容不是受支持的字体或 CSS 文件。' });
      }
      return await relayResponse(reply, upstream, config.uploadBodyLimitBytes);
    } catch (error) {
      return await reply.code(502).send({ error: 'asset_download_failed', message: error instanceof Error ? error.message : '字体资源下载失败。' });
    }
  });

  app.post('/__openai-image-generate', { bodyLimit: config.proxyBodyLimitBytes }, async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    const payload = request.body as Record<string, unknown> | null;
    const endpoint = String(payload?.endpoint ?? '').trim();
    const apiKey = String(payload?.apiKey ?? '').trim();
    const model = String(payload?.model ?? '').trim();
    const prompt = String(payload?.prompt ?? '').trim();
    const size = String(payload?.size ?? '').trim();
    if (!endpoint || !apiKey || !model || !prompt) return await reply.code(400).send({ error: { code: 'missing_required_fields', message: '缺少生图请求参数。' } });
    try {
      const target = await parseTarget(endpoint);
      const upstream = await fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt, ...(size ? { size } : {}), n: 1 }),
        signal: createTimeoutSignal(config.modelRequestTimeoutMs)
      });
      return await relayResponse(reply, upstream);
    } catch (error) {
      return await reply.code(502).send({ error: { code: 'proxy_request_failed', message: error instanceof Error ? error.message : '生图上游请求失败。' } });
    }
  });

  app.post('/__openai-models', async (request, reply) => {
    if (!await requireSession(request, reply)) return;
    const payload = request.body as Record<string, unknown> | null;
    const apiUrl = String(payload?.apiUrl ?? '').trim().replace(/\/+$/, '');
    const apiKey = String(payload?.apiKey ?? '').trim();
    if (!apiUrl) return await reply.code(400).send({ error: { code: 'missing_api_url', message: '缺少 API URL。' } });
    try {
      const target = await parseTarget(`${apiUrl}/models`);
      const upstream = await fetch(target, {
        headers: { Accept: 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
        signal: createTimeoutSignal()
      });
      return await relayResponse(reply, upstream);
    } catch (error) {
      return await reply.code(502).send({ error: { code: 'proxy_request_failed', message: error instanceof Error ? error.message : '模型列表请求失败。' } });
    }
  });
}