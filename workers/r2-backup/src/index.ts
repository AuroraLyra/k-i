interface Env {
  BACKUPS: R2Bucket;
  ALLOWED_ORIGIN?: string;
}

interface DeviceAuthRecord {
  version: 1;
  tokenHash: string;
  origin: string;
  pairedAt: number;
}

interface PairRequest {
  appOrigin?: string;
  token?: string;
}

interface StartUploadRequest {
  byteLength?: number;
  exportedAt?: number;
}

interface CompleteUploadRequest {
  uploadId?: string;
  exportedAt?: number;
  parts?: Array<{ partNumber?: number; etag?: string }>;
}

const latestBackupKey = 'babylink/latest.link';
const deviceAuthKey = '.babylink/device-auth.json';
const maxBackupBytes = 80 * 1024 * 1024 * 1024;
const maxMultipartParts = 10_000;
const recommendedPartBytes = 8 * 1024 * 1024;

function configuredOrigins(env: Env) {
  return String(env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map((value) => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value.trim());
    const localHostname = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(localHostname && url.protocol === 'http:')) {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

function requestOrigin(request: Request) {
  return normalizeOrigin(request.headers.get('Origin') ?? '');
}

function originIsAllowed(origin: string, env: Env, pairedOrigin = '') {
  if (!origin) return true;
  const configured = configuredOrigins(env);
  if (configured.includes('*') || configured.includes(origin)) return true;
  return Boolean(pairedOrigin && pairedOrigin === origin);
}

function corsOrigin(request: Request, env: Env, pairedOrigin = '') {
  const origin = requestOrigin(request);
  const configured = configuredOrigins(env);
  if (configured.includes('*')) return '*';
  if (origin && originIsAllowed(origin, env, pairedOrigin)) return origin;
  if (pairedOrigin) return pairedOrigin;
  return configured[0] ?? '*';
}

function withCors(response: Response, request: Request, env: Env, pairedOrigin = '') {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', corsOrigin(request, env, pairedOrigin));
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function errorResponse(message: string, status = 400) {
  return json({ error: 'r2_backup_error', message }, status);
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const bytes = new Uint8Array(digest);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function readDeviceAuth(env: Env) {
  const object = await env.BACKUPS.get(deviceAuthKey);
  if (!object) return null;
  try {
    const value = await object.text();
    const record = JSON.parse(value) as Partial<DeviceAuthRecord>;
    if (record.version !== 1 || !record.tokenHash || !record.origin) return null;
    return record as DeviceAuthRecord;
  } catch {
    return null;
  }
}

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

async function requireDeviceAuth(request: Request, env: Env): Promise<DeviceAuthRecord | Response> {
  const auth = await readDeviceAuth(env);
  if (!auth) return errorResponse('设备尚未配对，请先从 LINK 备份页连接此 Worker。', 401);
  const origin = requestOrigin(request);
  if (!originIsAllowed(origin, env, auth.origin)) return errorResponse('此 Worker 未授权当前 LINK 来源。', 403);
  const header = request.headers.get('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || (await sha256Base64Url(token)) !== auth.tokenHash) return errorResponse('设备连接密钥无效。', 401);
  return auth;
}

async function pairDevice(request: Request, env: Env) {
  const origin = requestOrigin(request);
  const payload = await readJson<PairRequest>(request);
  const appOrigin = normalizeOrigin(String(payload?.appOrigin ?? origin));
  const token = String(payload?.token ?? '').trim();
  if (!appOrigin || !token || token.length < 32) return errorResponse('配对信息不完整。', 400);
  if (!origin || origin !== appOrigin) return errorResponse('配对来源必须与 LINK 页面来源一致。', 403);
  if (!originIsAllowed(origin, env, appOrigin)) return errorResponse('当前 LINK 来源未被允许。', 403);
  if (await readDeviceAuth(env)) return errorResponse('此 Worker 已经配对；如需更换设备，请删除 R2 中的 .babylink/device-auth.json 后重试。', 409);

  const record: DeviceAuthRecord = {
    version: 1,
    tokenHash: await sha256Base64Url(token),
    origin: appOrigin,
    pairedAt: Date.now()
  };
  await env.BACKUPS.put(deviceAuthKey, JSON.stringify(record), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });
  return json({ paired: true, token });
}

async function getStatus(env: Env, auth: DeviceAuthRecord) {
  const object = await env.BACKUPS.head(latestBackupKey);
  return json({
    pairedAt: auth.pairedAt,
    exists: Boolean(object),
    byteLength: object?.size ?? 0,
    uploadedAt: object?.uploaded?.getTime() ?? 0,
    etag: object?.etag ?? ''
  });
}

async function startUpload(request: Request, env: Env) {
  const payload = await readJson<StartUploadRequest>(request);
  const byteLength = Number(payload?.byteLength ?? 0);
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0 || byteLength > maxBackupBytes) {
    return errorResponse('备份大小无效或超过 80 GB 限制。', 413);
  }
  const upload = await env.BACKUPS.createMultipartUpload(latestBackupKey, {
    httpMetadata: { contentType: 'application/vnd.babylink.encrypted-backup' },
    customMetadata: {
      exportedAt: String(Number(payload?.exportedAt ?? Date.now()) || Date.now()),
      encrypted: 'true'
    }
  });
  return json({ uploadId: upload.uploadId, partBytes: recommendedPartBytes });
}

async function uploadPart(request: Request, env: Env) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get('uploadId')?.trim() ?? '';
  const partNumber = Number(url.searchParams.get('partNumber') ?? 0);
  if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > maxMultipartParts) {
    return errorResponse('分片参数无效。', 400);
  }
  if (!request.body) return errorResponse('分片内容为空。', 400);
  const upload = env.BACKUPS.resumeMultipartUpload(latestBackupKey, uploadId);
  const part = await upload.uploadPart(partNumber, request.body);
  return json({ etag: part.etag, partNumber });
}

async function completeUpload(request: Request, env: Env) {
  const payload = await readJson<CompleteUploadRequest>(request);
  const uploadId = String(payload?.uploadId ?? '').trim();
  const parts = Array.isArray(payload?.parts)
    ? payload.parts.map((part) => ({ partNumber: Number(part?.partNumber ?? 0), etag: String(part?.etag ?? '').trim() }))
    : [];
  if (!uploadId || !parts.length || parts.length > maxMultipartParts || parts.some((part) => !Number.isInteger(part.partNumber) || part.partNumber < 1 || part.partNumber > maxMultipartParts || !part.etag)) {
    return errorResponse('完成上传的分片清单无效。', 400);
  }
  const uniquePartNumbers = new Set(parts.map((part) => part.partNumber));
  if (uniquePartNumbers.size !== parts.length || parts.some((part, index) => index > 0 && part.partNumber <= parts[index - 1].partNumber)) {
    return errorResponse('分片顺序无效。', 400);
  }
  const upload = env.BACKUPS.resumeMultipartUpload(latestBackupKey, uploadId);
  const completed = await upload.complete(parts);
  return json({ completed: true, etag: completed.etag, byteLength: completed.size, exportedAt: Number(payload?.exportedAt ?? 0) || 0 });
}

async function abortUpload(request: Request, env: Env) {
  const uploadId = new URL(request.url).searchParams.get('uploadId')?.trim() ?? '';
  if (!uploadId) return errorResponse('上传会话无效。', 400);
  await env.BACKUPS.resumeMultipartUpload(latestBackupKey, uploadId).abort();
  return json({ aborted: true });
}

async function downloadBackup(env: Env) {
  const object = await env.BACKUPS.get(latestBackupKey);
  if (!object) return errorResponse('你的 R2 中还没有 BabyLink 备份。', 404);
  const headers = new Headers({
    'Content-Type': 'application/vnd.babylink.encrypted-backup',
    'Cache-Control': 'no-store',
    ETag: object.etag
  });
  if (object.size) headers.set('Content-Length', String(object.size));
  if (object.uploaded) headers.set('Last-Modified', object.uploaded.toUTCString());
  return new Response(object.body, { headers });
}

async function handleRequest(request: Request, env: Env) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  if (path === '/api/pair' && request.method === 'POST') return await pairDevice(request, env);
  if (path === '/health' && request.method === 'GET') return json({ ok: true, service: 'babylink-r2-backup' });

  const auth = await requireDeviceAuth(request, env);
  if (auth instanceof Response) return auth;

  if (path === '/api/status' && request.method === 'GET') return await getStatus(env, auth);
  if (path === '/api/backup' && request.method === 'GET') return await downloadBackup(env);
  if (path === '/api/backup/start' && request.method === 'POST') return await startUpload(request, env);
  if (path === '/api/backup/part' && request.method === 'PUT') return await uploadPart(request, env);
  if (path === '/api/backup/complete' && request.method === 'POST') return await completeUpload(request, env);
  if (path === '/api/backup/abort' && request.method === 'DELETE') return await abortUpload(request, env);
  return errorResponse('未找到 R2 备份接口。', 404);
}

export default {
  async fetch(request: Request, env: Env) {
    try {
      const auth = await readDeviceAuth(env);
      const response = await handleRequest(request, env);
      return withCors(response, request, env, auth?.origin ?? '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'R2 Worker 请求失败。';
      return withCors(errorResponse(message, 500), request, env);
    }
  }
} satisfies ExportedHandler<Env>;