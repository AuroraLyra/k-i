import type { FastifyInstance, FastifyRequest } from 'fastify';
import { requireSession } from './auth.js';
import { config } from './config.js';
import { createTimeoutSignal, validatePublicUrl } from './security.js';

function bodyBuffer(request: FastifyRequest) {
  if (request.body === undefined || request.body === null) return undefined;
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body);
  return Buffer.from(JSON.stringify(request.body));
}

async function relayResponse(reply: Parameters<typeof requireSession>[1], upstream: Response) {
  reply.code(upstream.status);
  const contentType = upstream.headers.get('content-type');
  const contentLength = upstream.headers.get('content-length');
  if (contentType) reply.header('Content-Type', contentType);
  if (contentLength) reply.header('Content-Length', contentLength);
  reply.header('Cache-Control', 'no-store');
  return reply.send(Buffer.from(await upstream.arrayBuffer()));
}

async function parseTarget(rawTarget: string) {
  return await validatePublicUrl(rawTarget, config.allowInsecureUpstreams ? ['http:', 'https:'] : ['https:']);
}

export async function registerUpstreamProxy(app: FastifyInstance) {
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
        return await relayResponse(reply, upstream);
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