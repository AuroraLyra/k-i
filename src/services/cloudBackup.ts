import type { CloudBackupProvider, CloudBackupSettings } from '@/types/domain';
import { decryptLinkBackupBlob, decryptLinkBackupFile, encryptLinkBackupBlob, encryptLinkBackupFile } from '@/services/encryptedBackup';
import { createLinkBackupArchiveTemporaryFile, isLinkBackupArchive, parseLinkBackupBlob, parseLinkBackupFileText, stringifyLinkBackupFile, type LinkBackupArchive, type LinkBackupFile } from '@/utils/backup';
import { canUseBackupTemporaryFiles, createBackupTemporaryFileWriter, type BackupTemporaryFile } from '@/utils/backupTemporaryFile';

const oauthStateStorageKey = 'link:cloud-backup-oauth';
const cloudBackupMimeType = 'application/vnd.babylink.encrypted-backup';
const googleDriveApi = 'https://www.googleapis.com/drive/v3';
const googleDriveUploadApi = 'https://www.googleapis.com/upload/drive/v3';
const microsoftGraphApi = 'https://graph.microsoft.com/v1.0';
const dropboxApi = 'https://api.dropboxapi.com/2';
const dropboxContentApi = 'https://content.dropboxapi.com/2';
const r2UploadPartBytes = 8 * 1024 * 1024;
const driveUploadPartBytes = 10 * 1024 * 1024;

export const cloudBackupProviderLabels: Record<CloudBackupProvider, string> = {
  'google-drive': 'Google Drive',
  onedrive: 'OneDrive',
  dropbox: 'Dropbox',
  'r2-worker': 'Cloudflare R2'
};

interface PendingCloudOAuth {
  provider: Exclude<CloudBackupProvider, 'r2-worker'>;
  state: string;
  verifier: string;
  redirectUri: string;
  createdAt: number;
}

interface OAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
  account_id?: string;
}

interface CloudAuthSession {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

export interface CloudOAuthConnection extends CloudAuthSession {
  provider: Exclude<CloudBackupProvider, 'r2-worker'>;
  accountLabel: string;
}

export interface CloudBackupTransferProgress {
  label: string;
  percent: number;
}

export interface CloudBackupTransferResult extends CloudAuthSession {
  backup: LinkBackupFile;
  remoteFileId: string;
  byteLength: number;
}

interface CloudBackupDownloadResult {
  file: Blob;
  remoteFileId: string;
  cleanup?: () => Promise<void>;
}

export type CloudBackupProgressCallback = (progress: CloudBackupTransferProgress) => void | Promise<void>;

export class CloudBackupError extends Error {
  constructor(message: string, readonly status = 0) {
    super(message);
    this.name = 'CloudBackupError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function createRandomBase64Url(byteLength: number) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function createCodeChallenge(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64Url(new Uint8Array(digest));
}

function getCloudOAuthClientId(provider: Exclude<CloudBackupProvider, 'r2-worker'>) {
  if (provider === 'google-drive') return String(import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID ?? '').trim();
  if (provider === 'onedrive') return String(import.meta.env.VITE_ONEDRIVE_CLIENT_ID ?? '').trim();
  return String(import.meta.env.VITE_DROPBOX_APP_KEY ?? '').trim();
}

function getCloudOAuthRedirectUri() {
  const basePath = String(import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/');
  return new URL(`${basePath}services/backup/oauth/callback`, window.location.origin).toString();
}

function getOAuthTokenEndpoint(provider: Exclude<CloudBackupProvider, 'r2-worker'>) {
  if (provider === 'google-drive') return 'https://oauth2.googleapis.com/token';
  if (provider === 'onedrive') return 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
  return 'https://api.dropboxapi.com/oauth2/token';
}

function buildAuthorizationUrl(pending: PendingCloudOAuth, challenge: string) {
  const clientId = getCloudOAuthClientId(pending.provider);
  if (!clientId) throw new CloudBackupError(`${cloudBackupProviderLabels[pending.provider]} 尚未配置 OAuth Client ID。`);

  if (pending.provider === 'google-drive') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: pending.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      state: pending.state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      access_type: 'offline',
      prompt: 'consent'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  if (pending.provider === 'onedrive') {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: pending.redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'Files.ReadWrite.AppFolder User.Read offline_access',
      state: pending.state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: pending.redirectUri,
    response_type: 'code',
    token_access_type: 'offline',
    state: pending.state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });
  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
}

export function isCloudOAuthProviderConfigured(provider: Exclude<CloudBackupProvider, 'r2-worker'>) {
  return Boolean(getCloudOAuthClientId(provider));
}

export async function startCloudOAuth(provider: Exclude<CloudBackupProvider, 'r2-worker'>) {
  const popup = window.open('about:blank', 'link-cloud-backup-oauth', 'popup=yes,width=520,height=720');
  try {
    const pending: PendingCloudOAuth = {
      provider,
      state: createRandomBase64Url(24),
      verifier: createRandomBase64Url(64),
      redirectUri: getCloudOAuthRedirectUri(),
      createdAt: Date.now()
    };
    const url = buildAuthorizationUrl(pending, await createCodeChallenge(pending.verifier));
    localStorage.setItem(oauthStateStorageKey, JSON.stringify(pending));
    if (popup) popup.location.href = url;
    else window.location.assign(url);
    return popup;
  } catch (error) {
    popup?.close();
    throw error;
  }
}

function readPendingOAuth(): PendingCloudOAuth {
  let pending: PendingCloudOAuth | null = null;
  try {
    pending = JSON.parse(localStorage.getItem(oauthStateStorageKey) ?? 'null') as PendingCloudOAuth | null;
  } catch {
    pending = null;
  }
  if (!pending?.provider || !pending.state || !pending.verifier || !pending.redirectUri || Date.now() - pending.createdAt > 15 * 60 * 1000) {
    throw new CloudBackupError('云盘登录已过期，请返回备份页重新连接。');
  }
  return pending;
}

async function parseErrorResponse(response: Response, fallback: string) {
  try {
    const body = await response.clone().json() as Record<string, unknown>;
    const nested = isRecord(body.error) ? body.error : null;
    const message = String(body.error_description ?? body.error_summary ?? body.message ?? nested?.message ?? '').trim();
    if (message) return message;
  } catch {
    const text = await response.text().catch(() => '');
    if (text.trim()) return text.trim().slice(0, 500);
  }
  return fallback;
}

async function exchangeOAuthCode(pending: PendingCloudOAuth, code: string): Promise<CloudAuthSession> {
  const body = new URLSearchParams({
    client_id: getCloudOAuthClientId(pending.provider),
    code,
    code_verifier: pending.verifier,
    redirect_uri: pending.redirectUri,
    grant_type: 'authorization_code'
  });
  const response = await fetch(getOAuthTokenEndpoint(pending.provider), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as OAuthTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new CloudBackupError(payload.error_description || payload.error || `连接 ${cloudBackupProviderLabels[pending.provider]} 失败。`, response.status);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? '',
    tokenExpiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 3600)) * 1000
  };
}

async function fetchCloudAccountLabel(provider: Exclude<CloudBackupProvider, 'r2-worker'>, accessToken: string) {
  try {
    if (provider === 'google-drive') {
      const response = await fetch(`${googleDriveApi}/about?fields=user(displayName,emailAddress)`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { user?: { displayName?: string; emailAddress?: string } };
      return body.user?.emailAddress || body.user?.displayName || cloudBackupProviderLabels[provider];
    }
    if (provider === 'onedrive') {
      const response = await fetch(`${microsoftGraphApi}/me?$select=displayName,userPrincipalName`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const body = await response.json() as { displayName?: string; userPrincipalName?: string };
      return body.userPrincipalName || body.displayName || cloudBackupProviderLabels[provider];
    }
    const response = await fetch(`${dropboxApi}/users/get_current_account`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` } });
    const body = await response.json() as { email?: string; name?: { display_name?: string } };
    return body.email || body.name?.display_name || cloudBackupProviderLabels[provider];
  } catch {
    return cloudBackupProviderLabels[provider];
  }
}

export async function completeCloudOAuthCallback(search = window.location.search): Promise<CloudOAuthConnection> {
  const params = new URLSearchParams(search);
  const pending = readPendingOAuth();
  const state = params.get('state') ?? '';
  const code = params.get('code') ?? '';
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) throw new CloudBackupError(oauthError);
  if (!state || state !== pending.state) throw new CloudBackupError('云盘登录状态校验失败，请重新连接。');
  if (!code) throw new CloudBackupError('云盘登录没有返回授权码。');
  const auth = await exchangeOAuthCode(pending, code);
  localStorage.removeItem(oauthStateStorageKey);
  return {
    provider: pending.provider,
    ...auth,
    accountLabel: await fetchCloudAccountLabel(pending.provider, auth.accessToken)
  };
}

async function refreshCloudAuth(settings: CloudBackupSettings): Promise<CloudAuthSession> {
  if (settings.provider === 'r2-worker') {
    return { accessToken: '', refreshToken: '', tokenExpiresAt: 0 };
  }
  if (!settings.provider) throw new CloudBackupError('请先连接一个用户自有云盘。');
  if (settings.accessToken && (!settings.tokenExpiresAt || settings.tokenExpiresAt > Date.now() + 90_000)) {
    return { accessToken: settings.accessToken, refreshToken: settings.refreshToken, tokenExpiresAt: settings.tokenExpiresAt };
  }
  if (!settings.refreshToken) throw new CloudBackupError(`${cloudBackupProviderLabels[settings.provider]} 登录已过期，请点一下重新连接。`);

  const body = new URLSearchParams({
    client_id: getCloudOAuthClientId(settings.provider),
    refresh_token: settings.refreshToken,
    grant_type: 'refresh_token'
  });
  if (settings.provider === 'onedrive') body.set('scope', 'Files.ReadWrite.AppFolder User.Read offline_access');
  const response = await fetch(getOAuthTokenEndpoint(settings.provider), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const payload = await response.json().catch(() => ({})) as OAuthTokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new CloudBackupError(payload.error_description || payload.error || `${cloudBackupProviderLabels[settings.provider]} 登录已过期，请重新连接。`, response.status);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || settings.refreshToken,
    tokenExpiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 3600)) * 1000
  };
}

function normalizeFileName(value: string) {
  return value.trim().split('/').filter(Boolean).pop()?.replace(/[\\:*?"<>|]/g, '-') || 'babylink-backup.link';
}

function encodePath(value: string) {
  return value.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/');
}

async function emitProgress(callback: CloudBackupProgressCallback | undefined, label: string, percent: number) {
  await callback?.({ label, percent: Math.min(100, Math.max(0, Math.round(percent))) });
}

async function saveCloudDownloadResponse(response: Response, remoteFileId = ''): Promise<CloudBackupDownloadResult> {
  if (!canUseBackupTemporaryFiles() || !response.body) {
    return { file: await response.blob(), remoteFileId };
  }

  const writer = await createBackupTemporaryFileWriter('link-cloud-download');
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value?.byteLength) await writer.write(new Blob([value], { type: cloudBackupMimeType }));
    }
    const file = await writer.close();
    return { file: file.file, remoteFileId, cleanup: file.cleanup };
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    await writer.abort();
    throw error;
  }
}

function responseCanRetry(response: Response) {
  return response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
}

async function waitBeforeRetry(attempt: number) {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 250 * 2 ** attempt));
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit, attempts = 3) {
  let lastResponse: Response | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      if (!responseCanRetry(response) || attempt === attempts - 1) return response;
      lastResponse = response;
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
    }
    await waitBeforeRetry(attempt);
  }
  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new CloudBackupError('网络连接失败，请稍后重试。');
}

async function uploadResumableBlob(url: string, blob: Blob, partBytes: number, headers: Record<string, string>, onProgress?: CloudBackupProgressCallback) {
  let offset = 0;
  let finalResponse: Response | null = null;
  while (offset < blob.size) {
    const endExclusive = Math.min(offset + partBytes, blob.size);
    const chunk = blob.slice(offset, endExclusive);
    const response = await fetchWithRetry(url, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': cloudBackupMimeType,
        'Content-Range': `bytes ${offset}-${endExclusive - 1}/${blob.size}`
      },
      body: chunk
    });
    if (!(response.ok || response.status === 202 || response.status === 308)) {
      throw new CloudBackupError(await parseErrorResponse(response, `分片上传失败（${response.status}）。`), response.status);
    }
    finalResponse = response;
    offset = endExclusive;
    await emitProgress(onProgress, '正在分片上传加密备份', 35 + (offset / blob.size) * 60);
  }
  if (!finalResponse) throw new CloudBackupError('没有可上传的备份内容。');
  return finalResponse;
}

function escapeGoogleQuery(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function findGoogleDriveFile(accessToken: string, fileName: string) {
  const query = `name = '${escapeGoogleQuery(fileName)}' and 'appDataFolder' in parents and trashed = false`;
  const params = new URLSearchParams({ spaces: 'appDataFolder', q: query, fields: 'files(id,name,modifiedTime,size)', pageSize: '10' });
  const response = await fetch(`${googleDriveApi}/files?${params.toString()}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '无法读取 Google Drive 应用备份目录。'), response.status);
  const body = await response.json() as { files?: Array<{ id?: string }> };
  return body.files?.find((entry) => entry.id)?.id ?? '';
}

async function uploadGoogleDrive(settings: CloudBackupSettings, auth: CloudAuthSession, blob: Blob, onProgress?: CloudBackupProgressCallback) {
  const fileName = normalizeFileName(settings.fileName);
  const existingId = settings.remoteFileId || await findGoogleDriveFile(auth.accessToken, fileName);
  const endpoint = existingId
    ? `${googleDriveUploadApi}/files/${encodeURIComponent(existingId)}?uploadType=resumable`
    : `${googleDriveUploadApi}/files?uploadType=resumable`;
  const response = await fetch(endpoint, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/json;charset=utf-8',
      'X-Upload-Content-Type': cloudBackupMimeType,
      'X-Upload-Content-Length': String(blob.size)
    },
    body: JSON.stringify(existingId ? { name: fileName } : { name: fileName, parents: ['appDataFolder'], mimeType: cloudBackupMimeType })
  });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '无法创建 Google Drive 可恢复上传。'), response.status);
  const location = response.headers.get('location');
  if (!location) throw new CloudBackupError('Google Drive 没有返回可恢复上传地址。');
  const completed = await uploadResumableBlob(location, blob, driveUploadPartBytes, { Authorization: `Bearer ${auth.accessToken}` }, onProgress);
  const body = await completed.clone().json().catch(() => ({})) as { id?: string };
  return body.id || existingId;
}

async function downloadGoogleDrive(settings: CloudBackupSettings, auth: CloudAuthSession) {
  const fileName = normalizeFileName(settings.fileName);
  const fileId = settings.remoteFileId || await findGoogleDriveFile(auth.accessToken, fileName);
  if (!fileId) throw new CloudBackupError('Google Drive 中还没有 BabyLink 备份。', 404);
  const response = await fetch(`${googleDriveApi}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '下载 Google Drive 备份失败。'), response.status);
  return await saveCloudDownloadResponse(response, fileId);
}

async function uploadOneDrive(settings: CloudBackupSettings, auth: CloudAuthSession, blob: Blob, onProgress?: CloudBackupProgressCallback) {
  const fileName = encodePath(normalizeFileName(settings.fileName));
  const response = await fetch(`${microsoftGraphApi}/me/drive/special/approot:/${fileName}:/createUploadSession`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace', name: normalizeFileName(settings.fileName) } })
  });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '无法创建 OneDrive 可恢复上传。'), response.status);
  const body = await response.json() as { uploadUrl?: string };
  if (!body.uploadUrl) throw new CloudBackupError('OneDrive 没有返回可恢复上传地址。');
  await uploadResumableBlob(body.uploadUrl, blob, driveUploadPartBytes, {}, onProgress);
  return '';
}

async function downloadOneDrive(settings: CloudBackupSettings, auth: CloudAuthSession) {
  const fileName = encodePath(normalizeFileName(settings.fileName));
  const response = await fetch(`${microsoftGraphApi}/me/drive/special/approot:/${fileName}:/content`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '下载 OneDrive 备份失败。'), response.status);
  return await saveCloudDownloadResponse(response);
}

async function uploadDropbox(settings: CloudBackupSettings, auth: CloudAuthSession, blob: Blob, onProgress?: CloudBackupProgressCallback) {
  const filePath = `/${normalizeFileName(settings.fileName)}`;
  let offset = 0;
  const firstEnd = Math.min(driveUploadPartBytes, blob.size);
  const startResponse = await fetchWithRetry(`${dropboxContentApi}/files/upload_session/start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ close: false })
    },
    body: blob.slice(0, firstEnd)
  });
  if (!startResponse.ok) throw new CloudBackupError(await parseErrorResponse(startResponse, 'Dropbox 分片上传启动失败。'), startResponse.status);
  const startBody = await startResponse.json() as { session_id?: string };
  if (!startBody.session_id) throw new CloudBackupError('Dropbox 没有返回上传会话。');
  offset = firstEnd;
  await emitProgress(onProgress, '正在分片上传加密备份', 35 + (offset / blob.size) * 60);

  if (offset === blob.size) {
    const finishResponse = await fetchWithRetry(`${dropboxContentApi}/files/upload_session/finish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({
          cursor: { session_id: startBody.session_id, offset },
          commit: { path: filePath, mode: 'overwrite', autorename: false, mute: true }
        })
      },
      body: new Blob()
    });
    if (!finishResponse.ok) throw new CloudBackupError(await parseErrorResponse(finishResponse, 'Dropbox 分片上传提交失败。'), finishResponse.status);
    return '';
  }

  while (offset < blob.size) {
    const end = Math.min(offset + driveUploadPartBytes, blob.size);
    const final = end === blob.size;
    const endpoint = final ? 'upload_session/finish' : 'upload_session/append_v2';
    const argument = final
      ? { cursor: { session_id: startBody.session_id, offset }, commit: { path: filePath, mode: 'overwrite', autorename: false, mute: true } }
      : { cursor: { session_id: startBody.session_id, offset }, close: false };
    const response = await fetchWithRetry(`${dropboxContentApi}/files/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify(argument)
      },
      body: blob.slice(offset, end)
    });
    if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, 'Dropbox 分片上传失败。'), response.status);
    offset = end;
    await emitProgress(onProgress, '正在分片上传加密备份', 35 + (offset / blob.size) * 60);
  }
  return '';
}

async function downloadDropbox(settings: CloudBackupSettings, auth: CloudAuthSession) {
  const response = await fetch(`${dropboxContentApi}/files/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path: `/${normalizeFileName(settings.fileName)}` })
    }
  });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '下载 Dropbox 备份失败。'), response.status);
  return await saveCloudDownloadResponse(response);
}

function normalizeWorkerUrl(value: string) {
  const url = new URL(value.trim());
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new CloudBackupError('R2 Worker 必须使用 HTTPS。');
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/+$/, '');
}

async function r2WorkerRequest(settings: Pick<CloudBackupSettings, 'workerUrl' | 'workerToken'>, path: string, init: RequestInit = {}) {
  const workerUrl = normalizeWorkerUrl(settings.workerUrl);
  const headers = new Headers(init.headers);
  if (settings.workerToken) headers.set('Authorization', `Bearer ${settings.workerToken}`);
  const response = await fetch(`${workerUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, `R2 Worker 请求失败（${response.status}）。`), response.status);
  return response;
}

async function r2WorkerRequestWithRetry(settings: Pick<CloudBackupSettings, 'workerUrl' | 'workerToken'>, path: string, init: RequestInit = {}) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await r2WorkerRequest(settings, path, init);
    } catch (error) {
      lastError = error;
      const status = error instanceof CloudBackupError ? error.status : 0;
      if (attempt === 2 || status > 0 && ![408, 425, 429].includes(status) && status < 500) throw error;
      await waitBeforeRetry(attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new CloudBackupError('R2 分片上传失败。');
}

export async function pairR2Worker(workerUrl: string) {
  const normalizedUrl = normalizeWorkerUrl(workerUrl);
  const workerToken = createRandomBase64Url(32);
  const response = await fetch(`${normalizedUrl}/api/pair`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appOrigin: window.location.origin, token: workerToken })
  });
  if (!response.ok) throw new CloudBackupError(await parseErrorResponse(response, '连接 R2 Worker 失败。'), response.status);
  const body = await response.json().catch(() => ({})) as { token?: string };
  return { workerUrl: normalizedUrl, workerToken: body.token || workerToken };
}

async function uploadR2Worker(settings: CloudBackupSettings, blob: Blob, exportedAt: number, onProgress?: CloudBackupProgressCallback) {
  const startResponse = await r2WorkerRequest(settings, '/api/backup/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ byteLength: blob.size, exportedAt, fileName: normalizeFileName(settings.fileName) })
  });
  const start = await startResponse.json() as { uploadId?: string };
  if (!start.uploadId) throw new CloudBackupError('R2 Worker 没有返回分片上传会话。');
  const parts: Array<{ partNumber: number; etag: string }> = [];

  try {
    for (let offset = 0, partNumber = 1; offset < blob.size; offset += r2UploadPartBytes, partNumber += 1) {
      const end = Math.min(offset + r2UploadPartBytes, blob.size);
      const response = await r2WorkerRequestWithRetry(settings, `/api/backup/part?uploadId=${encodeURIComponent(start.uploadId)}&partNumber=${partNumber}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: blob.slice(offset, end)
      });
      const body = await response.json() as { etag?: string };
      if (!body.etag) throw new CloudBackupError(`R2 第 ${partNumber} 个分片没有返回校验值。`);
      parts.push({ partNumber, etag: body.etag });
      await emitProgress(onProgress, '正在分片上传到你的 R2', 35 + (end / blob.size) * 60);
    }

    await r2WorkerRequest(settings, '/api/backup/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: start.uploadId, parts, exportedAt })
    });
  } catch (error) {
    await r2WorkerRequest(settings, `/api/backup/abort?uploadId=${encodeURIComponent(start.uploadId)}`, { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
  return '';
}

async function downloadR2Worker(settings: CloudBackupSettings) {
  const response = await r2WorkerRequest(settings, '/api/backup');
  return await saveCloudDownloadResponse(response);
}

export function getR2WorkerDeployUrl() {
  const configured = String(import.meta.env.VITE_R2_WORKER_DEPLOY_URL ?? '').trim();
  if (configured) return configured;
  const template = String(import.meta.env.VITE_R2_WORKER_TEMPLATE_URL ?? 'https://github.com/KizunaRP/LINK/tree/main/workers/r2-backup').trim();
  return `https://deploy.workers.cloudflare.com/?url=${encodeURIComponent(template)}`;
}

export function isCloudBackupConnected(settings: CloudBackupSettings) {
  return Boolean(settings.recoveryKey && isCloudBackupAccountConnected(settings));
}

export function isCloudBackupAccountConnected(settings: CloudBackupSettings) {
  if (!settings.provider) return false;
  if (settings.provider === 'r2-worker') return Boolean(settings.workerUrl && settings.workerToken);
  return Boolean(settings.accessToken || settings.refreshToken);
}

export async function testCloudBackupConnection(settings: CloudBackupSettings) {
  if (!settings.provider) throw new CloudBackupError('请先连接一个用户自有云盘。');
  if (settings.provider === 'r2-worker') {
    await r2WorkerRequest(settings, '/api/status');
    return { accessToken: '', refreshToken: '', tokenExpiresAt: 0 };
  }
  const auth = await refreshCloudAuth(settings);
  await fetchCloudAccountLabel(settings.provider, auth.accessToken);
  return auth;
}

export async function uploadEncryptedCloudBackup(settings: CloudBackupSettings, backup: LinkBackupFile | LinkBackupArchive, onProgress?: CloudBackupProgressCallback): Promise<CloudBackupTransferResult> {
  if (!isCloudBackupConnected(settings)) throw new CloudBackupError('请先连接云盘并生成恢复密钥。');
  await emitProgress(onProgress, '正在设备内加密备份', 5);
  let archiveFile: BackupTemporaryFile | null = null;
  let encryptedFile: BackupTemporaryFile | null = null;
  try {
    const archive = isLinkBackupArchive(backup) ? backup : null;
    if (archive) {
      if (canUseBackupTemporaryFiles()) {
        archiveFile = await createLinkBackupArchiveTemporaryFile(archive, 'link-cloud-backup.zip', async (percent) => {
          await emitProgress(onProgress, '正在准备云端归档', percent * 0.2);
        });
        encryptedFile = await encryptLinkBackupFile(archiveFile.file, settings.recoveryKey, archive.backup.exportedAt, async (percent) => {
          await emitProgress(onProgress, '正在设备内分块加密', 5 + percent * 0.25);
        });
      } else if (archive.media.length) {
        throw new CloudBackupError('当前浏览器不支持含本地媒体的大文件云端备份。请使用最新 Chrome 或安装 BabyLink App 后重试。');
      }
    }
    const plainBackup = isLinkBackupArchive(backup) ? backup.backup : backup;
    const encrypted = encryptedFile?.file ?? await encryptLinkBackupBlob(stringifyLinkBackupFile(plainBackup), settings.recoveryKey, plainBackup.exportedAt, async (percent) => {
      await emitProgress(onProgress, '正在设备内分块加密', 5 + percent * 0.25);
    });
    const exportedAt = isLinkBackupArchive(backup) ? backup.backup.exportedAt : backup.exportedAt;
    const auth = await refreshCloudAuth(settings);
    let remoteFileId = settings.remoteFileId;
    if (settings.provider === 'google-drive') remoteFileId = await uploadGoogleDrive(settings, auth, encrypted, onProgress);
    else if (settings.provider === 'onedrive') remoteFileId = await uploadOneDrive(settings, auth, encrypted, onProgress);
    else if (settings.provider === 'dropbox') remoteFileId = await uploadDropbox(settings, auth, encrypted, onProgress);
    else await uploadR2Worker(settings, encrypted, exportedAt, onProgress);
    await emitProgress(onProgress, '云端加密备份已完成', 100);
    return { backup: isLinkBackupArchive(backup) ? backup.backup : backup, remoteFileId, byteLength: encrypted.size, ...auth };
  } finally {
    await archiveFile?.cleanup();
    await encryptedFile?.cleanup();
  }
}

export async function downloadEncryptedCloudBackup(settings: CloudBackupSettings, onProgress?: CloudBackupProgressCallback): Promise<CloudBackupTransferResult> {
  if (!isCloudBackupConnected(settings)) throw new CloudBackupError('请先连接云盘并填写恢复密钥。');
  await emitProgress(onProgress, '正在从你的云盘下载密文', 10);
  const auth = await refreshCloudAuth(settings);
  let result: CloudBackupDownloadResult;
  if (settings.provider === 'google-drive') result = await downloadGoogleDrive(settings, auth);
  else if (settings.provider === 'onedrive') result = await downloadOneDrive(settings, auth);
  else if (settings.provider === 'dropbox') result = await downloadDropbox(settings, auth);
  else result = await downloadR2Worker(settings);
  try {
    await emitProgress(onProgress, '正在设备内解密备份', 55);
    let backup: LinkBackupFile;
    if (canUseBackupTemporaryFiles()) {
      let decryptedFile: BackupTemporaryFile | null = null;
      try {
        decryptedFile = await decryptLinkBackupFile(result.file, settings.recoveryKey, async (percent) => {
          await emitProgress(onProgress, '正在设备内分块解密', 55 + percent * 0.4);
        });
        backup = await parseLinkBackupBlob(decryptedFile.file);
      } finally {
        await decryptedFile?.cleanup();
      }
    } else {
      const text = await decryptLinkBackupBlob(result.file, settings.recoveryKey, async (percent) => {
        await emitProgress(onProgress, '正在设备内分块解密', 55 + percent * 0.4);
      });
      backup = parseLinkBackupFileText(text);
    }
    await emitProgress(onProgress, '云端备份已解密', 100);
    return { backup, remoteFileId: result.remoteFileId, byteLength: result.file.size, ...auth };
  } finally {
    await result.cleanup?.();
  }
}