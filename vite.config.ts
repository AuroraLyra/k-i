import { fileURLToPath, URL } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const base = process.env.BASE_PATH || '/';
const textProxyPath = '/__text-proxy';
const imageProxyPath = '/__image-proxy';
const openAiImageGeneratePath = '/__openai-image-generate';
const openAiModelsPath = '/__openai-models';
const imageDownloadPath = '/__image-download';
const assetDownloadPath = '/__asset-download';
const appServerProxyTarget = process.env.LINK_SERVER_PROXY_TARGET || 'http://127.0.0.1:3000';

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function getForwardHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name];
  if (Array.isArray(value)) return value.join(', ');
  return value;
}

function sendProxyError(response: ServerResponse, statusCode: number, message: string) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(message);
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function createProxyErrorPayload(message: string, code = 'proxy_request_failed') {
  return {
    error: {
      message,
      type: 'link_proxy_error',
      param: '',
      code
    }
  };
}

type LinkProxyHandler = (request: IncomingMessage, response: ServerResponse) => void | Promise<void>;

interface LinkProxyMiddlewares {
  use(path: string, handler: LinkProxyHandler): void;
}

function registerTextProxyMiddleware(middlewares: LinkProxyMiddlewares) {
  middlewares.use(textProxyPath, async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    const method = (request.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) {
      sendProxyError(response, 405, 'Text proxy only supports GET and POST requests.');
      return;
    }

    const requestUrl = new URL(request.url ?? '', 'http://localhost');
    const target = requestUrl.searchParams.get('url')?.trim() ?? '';

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      sendProxyError(response, 400, 'Text proxy target URL is invalid.');
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      sendProxyError(response, 400, 'Text proxy target URL must use http or https.');
      return;
    }

    try {
      const headers = new Headers();
      const contentType = getForwardHeader(request, 'content-type');
      const authorization = getForwardHeader(request, 'authorization');
      const accept = getForwardHeader(request, 'accept');
      if (contentType && method !== 'GET') headers.set('Content-Type', contentType);
      if (authorization) headers.set('Authorization', authorization);
      if (accept) headers.set('Accept', accept);

      const upstreamResponse = await fetch(targetUrl, {
        method,
        headers,
        ...(method === 'POST' ? { body: await readRequestBody(request) } : {})
      });

      response.statusCode = upstreamResponse.status;
      response.statusMessage = upstreamResponse.statusText;
      response.setHeader('X-Link-Proxy-Target-Host', targetUrl.host);
      const upstreamContentType = upstreamResponse.headers.get('content-type');
      if (upstreamContentType) response.setHeader('Content-Type', upstreamContentType);
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.setHeader('X-Link-Proxy-Error', 'upstream_unreachable');
      sendProxyError(response, 502, `OpenAI-compatible text proxy request failed: ${message}`);
    }
  });
}

function registerImageProxyMiddleware(middlewares: LinkProxyMiddlewares) {
  middlewares.use(imageProxyPath, async (request, response) => {
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (request.method !== 'POST') {
      sendProxyError(response, 405, 'Image proxy only supports POST requests.');
      return;
    }

    const requestUrl = new URL(request.url ?? '', 'http://localhost');
    const target = requestUrl.searchParams.get('url')?.trim() ?? '';

    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      sendProxyError(response, 400, 'Image proxy target URL is invalid.');
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      sendProxyError(response, 400, 'Image proxy target URL must use http or https.');
      return;
    }

    try {
      const headers = new Headers();
      const contentType = getForwardHeader(request, 'content-type');
      const authorization = getForwardHeader(request, 'authorization');
      const accept = getForwardHeader(request, 'accept');
      if (contentType) headers.set('Content-Type', contentType);
      if (authorization) headers.set('Authorization', authorization);
      if (accept) headers.set('Accept', accept);

      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: await readRequestBody(request)
      });

      response.statusCode = upstreamResponse.status;
      response.statusMessage = upstreamResponse.statusText;
      response.setHeader('X-Link-Proxy-Target-Host', targetUrl.host);
      const upstreamContentType = upstreamResponse.headers.get('content-type');
      if (upstreamContentType) response.setHeader('Content-Type', upstreamContentType);
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      response.setHeader('X-Link-Proxy-Error', 'upstream_unreachable');
      sendProxyError(response, 502, `OpenAI-compatible image proxy request failed: ${message}`);
    }
  });
}

function registerImageDownloadMiddleware(middlewares: LinkProxyMiddlewares) {
  middlewares.use(imageDownloadPath, async (request, response) => {
    if (request.method !== 'GET') {
      sendProxyError(response, 405, 'Image download proxy only supports GET requests.');
      return;
    }

    const requestUrl = new URL(request.url ?? '', 'http://localhost');
    const target = requestUrl.searchParams.get('url')?.trim() ?? '';
    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      sendProxyError(response, 400, 'Image download target URL is invalid.');
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      sendProxyError(response, 400, 'Image download target URL must use http or https.');
      return;
    }

    try {
      const headers = new Headers();
      const accept = getForwardHeader(request, 'accept');
      const authorization = getForwardHeader(request, 'authorization');
      const range = getForwardHeader(request, 'range');
      headers.set('Accept', accept || 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8');
      headers.set('User-Agent', 'Mozilla/5.0 AppleWebKit/537.36 Link-PWA-Image-Proxy/1.0');
      headers.set('Referer', `${targetUrl.protocol}//${targetUrl.host}/`);
      if (authorization) headers.set('Authorization', authorization);
      if (range) headers.set('Range', range);

      let upstreamResponse = await fetch(targetUrl, { method: 'GET', headers });
      if (!upstreamResponse.ok && authorization) {
        headers.delete('Authorization');
        upstreamResponse = await fetch(targetUrl, { method: 'GET', headers });
      }
      response.statusCode = upstreamResponse.status;
      response.statusMessage = upstreamResponse.statusText;
      response.setHeader('X-Link-Proxy-Target-Host', targetUrl.host);
      const upstreamContentType = upstreamResponse.headers.get('content-type');
      if (upstreamContentType) response.setHeader('Content-Type', upstreamContentType);
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendProxyError(response, 502, `Image download proxy request failed: ${message}`);
    }
  });
}

function registerAssetDownloadMiddleware(middlewares: LinkProxyMiddlewares) {
  middlewares.use(assetDownloadPath, async (request, response) => {
    if (request.method !== 'GET') {
      sendProxyError(response, 405, 'Asset download proxy only supports GET requests.');
      return;
    }

    const requestUrl = new URL(request.url ?? '', 'http://localhost');
    const target = requestUrl.searchParams.get('url')?.trim() ?? '';
    let targetUrl: URL;
    try {
      targetUrl = new URL(target);
    } catch {
      sendProxyError(response, 400, 'Asset download target URL is invalid.');
      return;
    }

    if (!['http:', 'https:'].includes(targetUrl.protocol)) {
      sendProxyError(response, 400, 'Asset download target URL must use http or https.');
      return;
    }

    try {
      const accept = getForwardHeader(request, 'accept') || '*/*';
      const upstreamResponse = await fetch(targetUrl, {
        headers: {
          Accept: accept,
          'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 BabyLink-Font-Cache/1.0',
          Referer: `${targetUrl.protocol}//${targetUrl.host}/`
        }
      });
      response.statusCode = upstreamResponse.status;
      response.statusMessage = upstreamResponse.statusText;
      response.setHeader('X-Link-Proxy-Target-Host', targetUrl.host);
      const upstreamContentType = upstreamResponse.headers.get('content-type');
      if (upstreamContentType) response.setHeader('Content-Type', upstreamContentType);
      response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendProxyError(response, 502, `Font asset download failed: ${message}`);
    }
  });
}

function registerOpenAiCompatibleMiddlewares(middlewares: LinkProxyMiddlewares) {
  registerTextProxyMiddleware(middlewares);
  registerImageProxyMiddleware(middlewares);
  registerImageDownloadMiddleware(middlewares);
  registerAssetDownloadMiddleware(middlewares);
}

export default defineConfig({
  base,
  server: {
    headers: {
      'Cache-Control': 'no-store'
    },
    proxy: {
      '/api': {
        target: appServerProxyTarget,
        changeOrigin: true,
        ws: true
      },
      '/__openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/__openai/, '')
      }
    }
  },
  plugins: [
    {
      name: 'link-openai-compatible-dev-proxy',
      configurePreviewServer(server) {
        registerOpenAiCompatibleMiddlewares(server.middlewares);
      },
      configureServer(server) {
        registerOpenAiCompatibleMiddlewares(server.middlewares);

        server.middlewares.use(openAiImageGeneratePath, async (request, response) => {
          if (request.method === 'OPTIONS') {
            response.statusCode = 204;
            response.end();
            return;
          }

          if (request.method !== 'POST') {
            sendJson(response, 405, createProxyErrorPayload('OpenAI image generation proxy only supports POST requests.', 'method_not_allowed'));
            return;
          }

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse((await readRequestBody(request)).toString('utf8')) as Record<string, unknown>;
          } catch {
            sendJson(response, 400, createProxyErrorPayload('OpenAI image generation proxy received invalid JSON.', 'invalid_json'));
            return;
          }

          const endpoint = String(payload.endpoint ?? '').trim();
          const apiKey = String(payload.apiKey ?? '').trim();
          const model = String(payload.model ?? '').trim();
          const prompt = String(payload.prompt ?? '').trim();
          const size = String(payload.size ?? '').trim();

          if (!endpoint || !apiKey || !model || !prompt) {
            sendJson(response, 400, createProxyErrorPayload('OpenAI image generation proxy requires endpoint, apiKey, model, and prompt.', 'missing_required_fields'));
            return;
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(endpoint);
          } catch {
            sendJson(response, 400, createProxyErrorPayload('OpenAI image generation endpoint is invalid.', 'invalid_endpoint'));
            return;
          }

          if (!['http:', 'https:'].includes(targetUrl.protocol)) {
            sendJson(response, 400, createProxyErrorPayload('OpenAI image generation endpoint must use http or https.', 'invalid_endpoint_protocol'));
            return;
          }

          try {
            const upstreamResponse = await fetch(targetUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                Authorization: `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                model,
                prompt,
                ...(size ? { size } : {}),
                n: 1
              })
            });

            response.statusCode = upstreamResponse.status;
            response.statusMessage = upstreamResponse.statusText;
            const upstreamContentType = upstreamResponse.headers.get('content-type');
            response.setHeader('Content-Type', upstreamContentType || 'application/json; charset=utf-8');
            response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(response, 502, createProxyErrorPayload(`OpenAI image generation proxy could not reach upstream: ${message}`, 'upstream_unreachable'));
          }
        });

        server.middlewares.use(openAiModelsPath, async (request, response) => {
          if (request.method === 'OPTIONS') {
            response.statusCode = 204;
            response.end();
            return;
          }

          if (request.method !== 'POST') {
            sendJson(response, 405, createProxyErrorPayload('OpenAI models proxy only supports POST requests.', 'method_not_allowed'));
            return;
          }

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse((await readRequestBody(request)).toString('utf8')) as Record<string, unknown>;
          } catch {
            sendJson(response, 400, createProxyErrorPayload('OpenAI models proxy received invalid JSON.', 'invalid_json'));
            return;
          }

          const apiUrl = String(payload.apiUrl ?? '').trim().replace(/\/+$/, '');
          const apiKey = String(payload.apiKey ?? '').trim();
          if (!apiUrl) {
            sendJson(response, 400, createProxyErrorPayload('OpenAI models proxy requires apiUrl.', 'missing_api_url'));
            return;
          }

          let targetUrl: URL;
          try {
            targetUrl = new URL(`${apiUrl}/models`);
          } catch {
            sendJson(response, 400, createProxyErrorPayload('OpenAI models endpoint is invalid.', 'invalid_endpoint'));
            return;
          }

          if (!['http:', 'https:'].includes(targetUrl.protocol)) {
            sendJson(response, 400, createProxyErrorPayload('OpenAI models endpoint must use http or https.', 'invalid_endpoint_protocol'));
            return;
          }

          try {
            const upstreamResponse = await fetch(targetUrl, {
              method: 'GET',
              headers: {
                Accept: 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
              }
            });

            response.statusCode = upstreamResponse.status;
            response.statusMessage = upstreamResponse.statusText;
            response.setHeader('Content-Type', upstreamResponse.headers.get('content-type') || 'application/json; charset=utf-8');
            response.end(Buffer.from(await upstreamResponse.arrayBuffer()));
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            sendJson(response, 502, createProxyErrorPayload(`OpenAI models proxy could not reach upstream: ${message}`, 'upstream_unreachable'));
          }
        });

      }
    },
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['link-icon.png', 'link-icon-192.png', 'link-icon-maskable.png', 'default-ringtone.mp3', 'link-sw-events.js'],
      manifest: {
        id: base,
        name: 'Link',
        short_name: 'Link',
        description: 'LINE style roleplay chat PWA',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display_override: ['fullscreen', 'standalone'],
        display: 'fullscreen',
        orientation: 'portrait',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'link-icon-192.png?v=2',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'link-icon.png?v=2',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        importScripts: ['link-sw-events.js'],
        navigateFallback: `${base}index.html`,
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,avif,gif,ico,woff,woff2,mp3,m4a,ogg,wav}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
});