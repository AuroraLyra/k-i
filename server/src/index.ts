import { readFile } from 'node:fs/promises';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { getSessionIdentity, registerAuthRoutes } from './auth.js';
import { config } from './config.js';
import { closeDatabase, migrateDatabase, query } from './db.js';
import { registerNapCat } from './napcat.js';
import { registerUpstreamProxy } from './proxy.js';
import { registerReleaseRoutes } from './releases.js';
import { registerFanficTrendRoutes } from './fanfic.js';
import { registerLinkPreviewRoutes } from './linkPreview.js';

const app = Fastify({
  disableRequestLogging: true,
  logger: {
    level: config.production ? 'info' : 'debug',
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-link-challenge-token', 'res.headers.set-cookie']
  },
  trustProxy: config.trustProxy,
  bodyLimit: Math.max(config.proxyBodyLimitBytes, config.uploadBodyLimitBytes)
});

await app.register(cookie);
await app.register(rateLimit, { global: true, max: 240, timeWindow: '1 minute' });
await app.register(websocket, { options: { maxPayload: 2 * 1024 * 1024 } });

app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer', bodyLimit: config.uploadBodyLimitBytes }, (_request, body, done) => done(null, body));
app.addContentTypeParser('application/vnd.android.package-archive', { parseAs: 'buffer', bodyLimit: config.uploadBodyLimitBytes }, (_request, body, done) => done(null, body));
app.addContentTypeParser('application/xml', { parseAs: 'buffer', bodyLimit: config.proxyBodyLimitBytes }, (_request, body, done) => done(null, body));
app.addContentTypeParser('*', { parseAs: 'buffer', bodyLimit: config.uploadBodyLimitBytes }, (_request, body, done) => done(null, body));

const publicExactPaths = new Set([
  '/access',
  '/health',
  '/link-icon.png',
  '/link-icon-192.png',
  '/link-icon-maskable.png',
  '/link-sw-events.js',
  '/manifest.webmanifest',
  '/registerSW.js',
  '/sw.js',
  '/api/auth/config',
  '/api/auth/challenges'
]);
const appShellCacheControl = 'private, max-age=300, stale-while-revalidate=86400, stale-if-error=604800';
const databaseStartupRetryLimit = 12;
const databaseStartupRetryDelayMs = 1_000;

function isTransientDatabaseStartupError(error: unknown) {
  const record = error && typeof error === 'object' ? error as { code?: unknown; message?: unknown } : null;
  const code = String(record?.code ?? '');
  if (['57P03', '08001', '08003', '08006', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(code)) return true;
  const message = String(record?.message ?? '').toLowerCase();
  return message.includes('database system is in recovery mode') || message.includes('database system is starting up');
}

async function migrateDatabaseOnStartup() {
  for (let attempt = 1; attempt <= databaseStartupRetryLimit; attempt += 1) {
    try {
      await migrateDatabase();
      return;
    } catch (error) {
      if (!isTransientDatabaseStartupError(error) || attempt === databaseStartupRetryLimit) throw error;
      app.log.warn({ err: error, attempt, retryLimit: databaseStartupRetryLimit }, 'Database is temporarily unavailable during startup; retrying migration');
      await new Promise<void>((resolve) => setTimeout(resolve, databaseStartupRetryDelayMs * attempt));
    }
  }
}

app.addHook('onRequest', async (request, reply) => {
  const pathname = request.url.split('?')[0] || '/';
  if (pathname.startsWith('/api/admin/')) {
    if (!config.adminToken || request.headers.authorization !== `Bearer ${config.adminToken}`) {
      return await reply.code(401).send({ error: 'admin_auth_required' });
    }
    return;
  }
  if (publicExactPaths.has(pathname)
    || /^\/workbox-[^/]+\.js$/.test(pathname)
    || pathname.startsWith('/api/auth/challenges/')
    || pathname === '/api/napcat/onebot'
    || pathname === '/api/releases/altstore/source.json'
    || /^\/api\/releases\/[^/]+\/(?:download|altstore-download)$/.test(pathname)) return;

  const session = await getSessionIdentity(request);
  if (session) return;
  if (pathname.startsWith('/api/') || pathname.startsWith('/__')) {
    return await reply.code(401).send({ error: 'authentication_required', message: '请先通过 QQ 群验证登录。' });
  }
  const acceptsHtml = String(request.headers.accept ?? '').includes('text/html');
  if (request.method === 'GET' && acceptsHtml) return await reply.redirect('/access');
  return await reply.code(401).send({ error: 'authentication_required' });
});

app.get('/health', async () => {
  await query('SELECT 1');
  return { ok: true, service: 'babylink', time: Date.now() };
});

app.get('/access', async (_request, reply) => {
  const html = await readFile(config.accessPagePath, 'utf8');
  reply.header('Content-Type', 'text/html; charset=utf-8');
  reply.header('Cache-Control', 'no-store');
  return reply.send(html);
});

await registerAuthRoutes(app);
await registerNapCat(app);
await registerReleaseRoutes(app);
await registerUpstreamProxy(app);
await registerFanficTrendRoutes(app);
await registerLinkPreviewRoutes(app);

await app.register(fastifyStatic, {
  root: config.staticDir,
  prefix: '/',
  index: ['index.html'],
  cacheControl: true,
  maxAge: '1y',
  immutable: true,
  setHeaders(response, filePath) {
    if (filePath.endsWith('index.html')) {
      response.header('Cache-Control', appShellCacheControl);
    } else if (filePath.endsWith('sw.js') || filePath.endsWith('manifest.webmanifest') || filePath.endsWith('release-manifest.json')) {
      response.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
});

app.setNotFoundHandler(async (request, reply) => {
  if (request.url.startsWith('/api/') || request.url.startsWith('/__')) return await reply.code(404).send({ error: 'not_found' });
  reply.header('Cache-Control', appShellCacheControl);
  return await reply.sendFile('index.html', { maxAge: 0, immutable: false, cacheControl: false });
});

await migrateDatabaseOnStartup();

const cleanupTimer = setInterval(() => {
  void Promise.all([
    query("DELETE FROM login_challenges WHERE created_at < NOW() - INTERVAL '2 days'"),
    query("DELETE FROM sessions WHERE (expires_at < NOW() - INTERVAL '30 days') OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')"),
    query("DELETE FROM release_source_tokens WHERE (expires_at < NOW() - INTERVAL '30 days') OR (revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '30 days')"),
    query("DELETE FROM audit_logs WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')", [config.auditRetentionDays])
  ]).catch((error) => app.log.warn({ error }, 'Periodic database cleanup failed'));
}, 6 * 60 * 60 * 1000);
cleanupTimer.unref();
app.addHook('onClose', async () => clearInterval(cleanupTimer));

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await closeDatabase();
  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await closeDatabase();
  process.exit(1);
}