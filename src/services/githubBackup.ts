import { createLinkBackupArchiveTemporaryFile, isLinkBackupArchive, isLinkBackupChunkManifest, linkBackupSnapshotArrayKeys, parseLinkBackupBlob, parseLinkBackupFileText, stringifyLinkBackupFile, type LinkBackupArchive, type LinkBackupChunkManifest, type LinkBackupFile } from '@/utils/backup';
import { canUseBackupTemporaryFiles, createBackupTemporaryFileWriter, type BackupTemporaryFile } from '@/utils/backupTemporaryFile';
import type { AppSnapshot } from '@/types/domain';

export interface GitHubViewer {
  login: string;
}

const githubBackupChunkSize = 512 * 1024;
const githubIncrementalRetainCount = 8;

export interface GitHubBackupRepository {
  owner: string;
  repo: string;
  branch: string;
  private: boolean;
  htmlUrl: string;
}

export interface GitHubBackupTarget {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
}

export interface GitHubBackupDiscoveryInput {
  token: string;
  owner: string;
  preferredRepo?: string;
  preferredPath?: string;
}

export interface GitHubBackupDiscoveryResult extends GitHubBackupRepository {
  path: string;
}

export interface GitHubBackupHistoryItem {
  sha: string;
  committedAt: string;
  message: string;
  downloadPath: string;
}

export interface GitHubBackupUploadProgress {
  label: string;
  percent: number;
}

export interface GitHubBackupUploadOptions {
  retainIncrementalManifests?: number;
  onProgress?: (progress: GitHubBackupUploadProgress) => void | Promise<void>;
}

export interface GitHubBackupDownloadOptions {
  onProgress?: (progress: GitHubBackupUploadProgress) => void | Promise<void>;
}

interface GitHubIncrementalBackupManifest {
  app: 'LINK';
  backupVersion: 2;
  incremental: true;
  exportedAt: number;
  base: {
    path: string;
    exportedAt: number;
  };
  increments: GitHubIncrementalBackupEntry[];
}

interface GitHubIncrementalBackupEntry {
  id: string;
  path: string;
  exportedAt: number;
  baseExportedAt: number;
  changes: number;
  deletions: number;
  settingsChanged: boolean;
}

interface GitHubIncrementalBackupDelta {
  app: 'LINK';
  backupVersion: 2;
  incrementalDelta: true;
  exportedAt: number;
  baseExportedAt: number;
  changed: Partial<Record<BackupArrayKey, unknown[]>>;
  deleted: Partial<Record<BackupArrayKey, string[]>>;
  settings?: AppSnapshot['settings'];
}

interface GitHubArchiveBackupManifest {
  app: 'LINK';
  backupVersion: 2;
  archive: 'zip-parts-v1';
  exportedAt: number;
  originalByteLength: number;
  chunks: LinkBackupChunkManifest['chunks'];
}

type BackupArrayKey = typeof linkBackupSnapshotArrayKeys[number];

export interface GitHubLoginUrl {
  url: string;
  mode: 'worker' | 'oauth' | 'token';
}

interface GitHubRepositoryResponse {
  name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
}

interface GitHubRepositoryListResponse extends GitHubRepositoryResponse {
  updated_at?: string;
}

interface GitHubContentResponse {
  content?: string;
  encoding?: string;
  sha?: string;
  type?: string;
  download_url?: string;
}

interface GitHubErrorPayload {
  message?: string;
  documentation_url?: string;
}

interface GitHubCommitHistoryResponse {
  sha: string;
  commit: {
    message: string;
    committer: {
      date: string;
    };
  };
}

export class GitHubBackupError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly rateLimitRemaining = '',
    readonly rateLimitReset = ''
  ) {
    super(message);
    this.name = 'GitHubBackupError';
  }
}

interface RemoteBackupState {
  text: string;
  backup: LinkBackupFile;
  manifest?: GitHubIncrementalBackupManifest;
  rootChunkPaths: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeRepoName(repo: string) {
  return repo.trim().replace(/[^A-Za-z0-9._-]/g, '-').replace(/^-+|-+$/g, '') || 'link-private-backups';
}

function encodePath(path: string) {
  return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

function normalizeBackupPath(pathValue: string) {
  return pathValue.trim().replace(/^\/+/, '') || 'link-backup.json';
}

function createBackupId(timestamp = Date.now()) {
  return new Date(timestamp).toISOString().replace(/[:.]/g, '-');
}

function encodeBase64(text: string) {
  const bytes = new TextEncoder().encode(text);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function encodeBytesBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }

  return btoa(binary);
}

function decodeBytesBase64(text: string, label = 'GitHub 分片备份') {
  const normalized = text.replace(/\s+/g, '');
  let binary = '';
  try {
    binary = atob(normalized);
  } catch {
    throw new GitHubBackupError(`${label} 内容不是有效的 base64 数据。`);
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64(text: string) {
  const normalized = text.replace(/\s+/g, '');
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function createOAuthState() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
}

export function buildGitHubLoginUrl(): GitHubLoginUrl {
  const workerUrl = String(import.meta.env.VITE_GITHUB_OAUTH_WORKER_URL ?? '').trim().replace(/\/+$/, '');
  if (workerUrl) {
    const params = new URLSearchParams({ app_origin: window.location.origin });
    return { mode: 'worker', url: `${workerUrl}/github/login?${params.toString()}` };
  }

  const clientId = String(import.meta.env.VITE_GITHUB_OAUTH_CLIENT_ID ?? '').trim();
  const redirectUri = String(import.meta.env.VITE_GITHUB_OAUTH_REDIRECT_URI ?? window.location.origin).trim();

  if (clientId) {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'repo',
      state: createOAuthState()
    });
    return { mode: 'oauth', url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }

  const params = new URLSearchParams({
    scopes: 'repo',
    description: 'LINK private backup'
  });
  return { mode: 'token', url: `https://github.com/settings/tokens/new?${params.toString()}` };
}

export function getGitHubOAuthWorkerOrigin() {
  const workerUrl = String(import.meta.env.VITE_GITHUB_OAUTH_WORKER_URL ?? '').trim();
  if (!workerUrl) return '';

  try {
    return new URL(workerUrl).origin;
  } catch {
    return '';
  }
}

async function parseGitHubError(response: Response) {
  try {
    const body = await response.json() as GitHubErrorPayload;
    return body.message || response.statusText || 'GitHub 请求失败。';
  } catch {
    return response.statusText || 'GitHub 请求失败。';
  }
}

function createGitHubHttpError(response: Response, message: string) {
  return new GitHubBackupError(
    message,
    response.status,
    response.headers.get('x-ratelimit-remaining') ?? '',
    response.headers.get('x-ratelimit-reset') ?? ''
  );
}

async function githubApiFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.headers ?? {})
      }
    });
  } catch {
    throw new GitHubBackupError('无法连接 GitHub，请检查网络、代理、浏览器拦截或跨域设置。');
  }

  if (!response.ok) {
    throw createGitHubHttpError(response, await parseGitHubError(response));
  }

  if (response.status === 204) return undefined as T;
  return await response.json() as T;
}

async function githubApiFetchText(path: string, token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: 'application/vnd.github.raw',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
  } catch {
    throw new GitHubBackupError('无法下载 GitHub 文件，请检查网络、代理、浏览器拦截或跨域设置。');
  }

  if (!response.ok) {
    throw createGitHubHttpError(response, await parseGitHubError(response));
  }

  return await response.text();
}

async function fetchGitHubDownloadUrl(url: string, token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `Bearer ${token}`
      }
    });
  } catch {
    throw new GitHubBackupError('无法下载 GitHub 原始文件，请检查网络、代理或浏览器拦截设置。');
  }

  if (!response.ok) {
    throw createGitHubHttpError(response, await parseGitHubError(response));
  }

  return await response.text();
}

async function readGitHubFileText(apiPath: string, token: string, missingMessage: string) {
  const content = await githubApiFetch<GitHubContentResponse>(apiPath, token);
  if (content.type && content.type !== 'file') throw new GitHubBackupError('备份路径不是文件。');
  if (content.content) {
    if (content.encoding && content.encoding !== 'base64') throw new GitHubBackupError(`暂不支持的 GitHub 内容编码：${content.encoding}`);
    return decodeBase64(content.content);
  }

  if (content.download_url) return await fetchGitHubDownloadUrl(content.download_url, token);

  try {
    const rawText = await githubApiFetchText(apiPath, token);
    if (rawText) return rawText;
  } catch {
    // Fall through to the explicit missing-content error below.
  }

  throw new GitHubBackupError(missingMessage);
}

function toBackupRepository(response: GitHubRepositoryResponse): GitHubBackupRepository {
  return {
    owner: response.owner.login,
    repo: response.name,
    branch: response.default_branch || 'main',
    private: response.private,
    htmlUrl: response.html_url
  };
}

function looksLikeLinkBackupRoot(text: string) {
  const parsed = parseJsonRecord(text);
  return Boolean(
    isGitHubIncrementalBackupManifest(parsed)
    || isLinkBackupChunkManifest(parsed)
    || isGitHubArchiveBackupManifest(parsed)
    || parsed?.app === 'LINK'
    || isRecord(parsed?.snapshot)
  );
}

function rankBackupRepositoryCandidate(repo: GitHubRepositoryListResponse, preferredRepo: string) {
  const name = repo.name.toLocaleLowerCase();
  const preferred = preferredRepo.toLocaleLowerCase();
  if (preferred && name === preferred) return 0;
  if (name === 'link-private-backups') return 1;
  if (/link.*backup|backup.*link/i.test(repo.name)) return 2;
  if (/link|backup/i.test(repo.name)) return 3;
  return 4;
}

export async function findGitHubBackupRepository(input: GitHubBackupDiscoveryInput): Promise<GitHubBackupDiscoveryResult | null> {
  const token = input.token.trim();
  const owner = input.owner.trim() || (await fetchGitHubViewer(token)).login;
  const preferredRepo = normalizeRepoName(input.preferredRepo ?? 'link-private-backups');
  const preferredPath = normalizeBackupPath(input.preferredPath ?? 'link-backup.json');
  if (!token) throw new GitHubBackupError('请先填写 GitHub token。');

  const repositories = await githubApiFetch<GitHubRepositoryListResponse[]>(
    '/user/repos?visibility=all&affiliation=owner&sort=updated&direction=desc&per_page=100',
    token
  );
  const candidateRepos = repositories
    .filter((repo) => repo.owner.login === owner && repo.private)
    .sort((left, right) => rankBackupRepositoryCandidate(left, preferredRepo) - rankBackupRepositoryCandidate(right, preferredRepo))
    .slice(0, 24);
  const backupPaths = [...new Set([preferredPath, 'link-backup.json'])];

  for (const repo of candidateRepos) {
    for (const path of backupPaths) {
      try {
        const text = await downloadGitHubBackupTextAtPath({ token, owner, repo: repo.name, branch: repo.default_branch || 'main', path }, path, repo.default_branch || 'main', '');
        if (!looksLikeLinkBackupRoot(text)) continue;
        return {
          ...toBackupRepository(repo),
          path
        };
      } catch (error) {
        if (error instanceof GitHubBackupError && error.status === 404) continue;
        throw error;
      }
    }
  }

  return null;
}

export async function fetchGitHubViewer(token: string): Promise<GitHubViewer> {
  if (!token.trim()) throw new GitHubBackupError('请先填写 GitHub token。');
  return await githubApiFetch<GitHubViewer>('/user', token.trim());
}

export async function ensureGitHubBackupRepository(target: Pick<GitHubBackupTarget, 'token' | 'owner' | 'repo'>): Promise<GitHubBackupRepository> {
  const token = target.token.trim();
  if (!token) throw new GitHubBackupError('请先填写 GitHub token。');

  const repo = normalizeRepoName(target.repo);
  const owner = target.owner.trim() || (await fetchGitHubViewer(token)).login;

  try {
    const existing = await githubApiFetch<GitHubRepositoryResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, token);
    if (!existing.private) throw new GitHubBackupError('同名仓库不是私有仓库，请更换仓库名或先在 GitHub 改为私有。');
    return toBackupRepository(existing);
  } catch (error) {
    if (!(error instanceof GitHubBackupError) || error.status !== 404) throw error;
  }

  const created = await githubApiFetch<GitHubRepositoryResponse>('/user/repos', token, {
    method: 'POST',
    body: JSON.stringify({
      name: repo,
      private: true,
      auto_init: true,
      description: 'LINK app private backups'
    })
  });

  return toBackupRepository(created);
}

async function emitUploadProgress(options: GitHubBackupUploadOptions | undefined, label: string, percent: number) {
  await options?.onProgress?.({ label, percent: Math.min(100, Math.max(0, Math.round(percent))) });
}

function parseJsonRecord(text: string) {
  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isGitHubIncrementalBackupManifest(value: unknown): value is GitHubIncrementalBackupManifest {
  return Boolean(
    isRecord(value)
    && value.app === 'LINK'
    && value.backupVersion === 2
    && value.incremental === true
    && isRecord(value.base)
    && typeof value.base.path === 'string'
    && Array.isArray(value.increments)
  );
}

function isGitHubIncrementalBackupDelta(value: unknown): value is GitHubIncrementalBackupDelta {
  return Boolean(
    isRecord(value)
    && value.app === 'LINK'
    && value.backupVersion === 2
    && value.incrementalDelta === true
    && isRecord(value.changed)
    && isRecord(value.deleted)
  );
}

function isGitHubArchiveBackupManifest(value: unknown): value is GitHubArchiveBackupManifest {
  return Boolean(
    isRecord(value)
    && value.app === 'LINK'
    && value.backupVersion === 2
    && value.archive === 'zip-parts-v1'
    && Number.isInteger(value.originalByteLength)
    && Number(value.originalByteLength) > 0
    && Array.isArray(value.chunks)
  );
}

function getEntryKey(storeName: BackupArrayKey, value: unknown) {
  if (!isRecord(value)) return '';
  const key = storeName === 'conversationSettings'
    ? value.conversationId
    : storeName === 'musicCommentThreads'
      ? value.trackKey
      : value.id;
  return String(key ?? '').trim();
}

function createEntryMap(storeName: BackupArrayKey, entries: unknown[]) {
  const map = new Map<string, unknown>();
  entries.forEach((entry) => {
    const key = getEntryKey(storeName, entry);
    if (key) map.set(key, entry);
  });
  return map;
}

function valuesAreEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function createIncrementalDelta(previous: LinkBackupFile, next: LinkBackupFile): GitHubIncrementalBackupDelta & { changeCount: number; deletionCount: number; settingsChanged: boolean } {
  const changed: GitHubIncrementalBackupDelta['changed'] = {};
  const deleted: GitHubIncrementalBackupDelta['deleted'] = {};
  let changeCount = 0;
  let deletionCount = 0;

  for (const storeName of linkBackupSnapshotArrayKeys) {
    const previousEntries = createEntryMap(storeName, previous.snapshot[storeName] ?? []);
    const nextEntries = createEntryMap(storeName, next.snapshot[storeName] ?? []);
    const changedEntries: unknown[] = [];
    const deletedKeys: string[] = [];

    nextEntries.forEach((entry, key) => {
      if (!previousEntries.has(key) || !valuesAreEqual(previousEntries.get(key), entry)) changedEntries.push(entry);
    });

    previousEntries.forEach((_entry, key) => {
      if (!nextEntries.has(key)) deletedKeys.push(key);
    });

    if (changedEntries.length) changed[storeName] = changedEntries;
    if (deletedKeys.length) deleted[storeName] = deletedKeys;
    changeCount += changedEntries.length;
    deletionCount += deletedKeys.length;
  }

  const settingsChanged = !valuesAreEqual(previous.snapshot.settings, next.snapshot.settings);
  return {
    app: 'LINK',
    backupVersion: 2,
    incrementalDelta: true,
    exportedAt: next.exportedAt,
    baseExportedAt: previous.exportedAt,
    changed,
    deleted,
    ...(settingsChanged ? { settings: next.snapshot.settings } : {}),
    changeCount,
    deletionCount,
    settingsChanged
  };
}

function applyIncrementalDelta(backup: LinkBackupFile, delta: GitHubIncrementalBackupDelta): LinkBackupFile {
  const snapshot = typeof structuredClone === 'function'
    ? structuredClone(backup.snapshot) as AppSnapshot
    : JSON.parse(JSON.stringify(backup.snapshot)) as AppSnapshot;

  for (const storeName of linkBackupSnapshotArrayKeys) {
    const entries = createEntryMap(storeName, snapshot[storeName] ?? []);
    delta.deleted[storeName]?.forEach((key) => entries.delete(key));
    delta.changed[storeName]?.forEach((entry) => {
      const key = getEntryKey(storeName, entry);
      if (key) entries.set(key, entry);
    });
    snapshot[storeName] = [...entries.values()] as never;
  }

  if (delta.settings) snapshot.settings = delta.settings;

  return {
    app: 'LINK',
    backupVersion: 1,
    exportedAt: delta.exportedAt,
    snapshot
  };
}

function incrementalDirForPath(path: string) {
  return `${normalizeBackupPath(path)}.incremental`;
}

async function uploadGitHubBackupContent(
  target: GitHubBackupTarget,
  pathValue: string,
  content: string,
  message: string,
  options?: GitHubBackupUploadOptions,
  progressStart = 0,
  progressEnd = progressStart
) {
  const bytes = new TextEncoder().encode(content);
  if (bytes.length > githubBackupChunkSize) {
    await uploadGitHubChunkedContent(target, pathValue, bytes, message, options, progressStart, progressEnd);
    return;
  }

  await uploadGitHubTextFile(target, pathValue, content, message);
  if (progressEnd > progressStart) await emitUploadProgress(options, `已上传 ${normalizeBackupPath(pathValue)}`, progressEnd);
}

async function uploadGitHubTextFile(target: GitHubBackupTarget, pathValue: string, content: string, message: string) {
  const token = target.token.trim();
  const owner = target.owner.trim();
  const repo = normalizeRepoName(target.repo);
  const branch = target.branch.trim() || 'main';
  const path = normalizeBackupPath(pathValue);
  let sha = '';

  if (!token || !owner || !repo) throw new GitHubBackupError('GitHub 备份配置不完整。');

  try {
    const existing = await githubApiFetch<GitHubContentResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, token);
    if (existing.type && existing.type !== 'file') throw new GitHubBackupError('备份路径已被非文件内容占用。');
    sha = existing.sha ?? '';
  } catch (error) {
    if (!(error instanceof GitHubBackupError) || error.status !== 404) throw error;
  }

  await githubApiFetch<GitHubContentResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: encodeBase64(content),
      branch,
      ...(sha ? { sha } : {})
    })
  });
}

async function uploadGitHubChunkedContent(
  target: GitHubBackupTarget,
  pathValue: string,
  bytes: Uint8Array,
  message: string,
  options?: GitHubBackupUploadOptions,
  progressStart = 0,
  progressEnd = progressStart
) {
  const path = normalizeBackupPath(pathValue);
  const exportedAt = Date.now();
  const backupId = createBackupId(exportedAt);
  const partDir = `${path}.parts/${backupId}`;
  const chunks: LinkBackupChunkManifest['chunks'] = [];
  const totalChunks = Math.max(1, Math.ceil(bytes.length / githubBackupChunkSize));

  for (let offset = 0, index = 0; offset < bytes.length; offset += githubBackupChunkSize, index += 1) {
    const chunk = bytes.slice(offset, Math.min(offset + githubBackupChunkSize, bytes.length));
    const chunkPath = `${partDir}/part-${String(index + 1).padStart(4, '0')}.b64`;
    chunks.push({ index, path: chunkPath, byteLength: chunk.byteLength });
    await uploadGitHubTextFile(target, chunkPath, encodeBytesBase64(chunk), `${message} part ${index + 1}`);
    const percent = progressStart + (index + 1) / totalChunks * Math.max(0, progressEnd - progressStart);
    await emitUploadProgress(options, `正在上传 GitHub 分片 ${index + 1}/${totalChunks}`, percent);
  }

  const manifest: LinkBackupChunkManifest = {
    app: 'LINK',
    backupVersion: 1,
    chunked: true,
    exportedAt,
    encoding: 'base64-bytes',
    originalByteLength: bytes.byteLength,
    chunkSize: githubBackupChunkSize,
    chunks
  };
  await uploadGitHubTextFile(target, path, JSON.stringify(manifest), `${message} manifest (${chunks.length} parts)`);
  if (progressEnd > progressStart) await emitUploadProgress(options, `GitHub 分片 ${chunks.length}/${chunks.length} 已提交`, progressEnd);
}

async function uploadGitHubArchive(target: GitHubBackupTarget, archive: LinkBackupArchive, message: string, options?: GitHubBackupUploadOptions) {
  if (!canUseBackupTemporaryFiles()) throw new GitHubBackupError('当前浏览器不支持大文件 GitHub 备份，请使用最新 Chrome 或安装 BabyLink App。');
  const archiveFile = await createLinkBackupArchiveTemporaryFile(archive, 'link-github-backup.zip', async (percent) => {
    await emitUploadProgress(options, '正在准备 GitHub 媒体归档', percent * 0.3);
  });
  const backupId = createBackupId(archive.backup.exportedAt);
  const partDir = `${normalizeBackupPath(target.path)}.archive/${backupId}`;
  const chunks: LinkBackupChunkManifest['chunks'] = [];
  const totalChunks = Math.max(1, Math.ceil(archiveFile.file.size / githubBackupChunkSize));

  try {
    let previousArchiveChunks: LinkBackupChunkManifest['chunks'] = [];
    try {
      const previousText = await downloadGitHubBackupTextAtPath(target, target.path, target.branch.trim() || 'main', '');
      const previousManifest = parseJsonRecord(previousText);
      if (isGitHubArchiveBackupManifest(previousManifest)) previousArchiveChunks = previousManifest.chunks;
    } catch (error) {
      if (!(error instanceof GitHubBackupError) || error.status !== 404) throw error;
    }
    for (let offset = 0, index = 0; offset < archiveFile.file.size; offset += githubBackupChunkSize, index += 1) {
      const chunk = new Uint8Array(await archiveFile.file.slice(offset, Math.min(offset + githubBackupChunkSize, archiveFile.file.size)).arrayBuffer());
      const chunkPath = `${partDir}/part-${String(index + 1).padStart(5, '0')}.b64`;
      chunks.push({ index, path: chunkPath, byteLength: chunk.byteLength });
      await uploadGitHubTextFile(target, chunkPath, encodeBytesBase64(chunk), `${message} archive part ${index + 1}`);
      await emitUploadProgress(options, `正在上传 GitHub 归档分片 ${index + 1}/${totalChunks}`, 35 + Math.round((index + 1) / totalChunks * 60));
    }
    const manifest: GitHubArchiveBackupManifest = {
      app: 'LINK',
      backupVersion: 2,
      archive: 'zip-parts-v1',
      exportedAt: archive.backup.exportedAt,
      originalByteLength: archiveFile.file.size,
      chunks
    };
    await uploadGitHubTextFile(target, target.path, JSON.stringify(manifest), `${message} archive manifest (${chunks.length} parts)`);
    for (const chunk of previousArchiveChunks) {
      await deleteGitHubFileIfExists(target, chunk.path, `${message} cleanup previous archive part ${chunk.index + 1}`);
    }
    await emitUploadProgress(options, 'GitHub 媒体归档已完成', 100);
  } finally {
    await archiveFile.cleanup();
  }
}

async function deleteGitHubFileIfExists(target: GitHubBackupTarget, pathValue: string, message: string) {
  const token = target.token.trim();
  const owner = target.owner.trim();
  const repo = normalizeRepoName(target.repo);
  const branch = target.branch.trim() || 'main';
  const path = normalizeBackupPath(pathValue);
  if (!token || !owner || !repo) return;

  let sha = '';
  try {
    const existing = await githubApiFetch<GitHubContentResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`, token);
    if (existing.type && existing.type !== 'file') return;
    sha = existing.sha ?? '';
  } catch (error) {
    if (error instanceof GitHubBackupError && error.status === 404) return;
    throw error;
  }

  if (!sha) return;
  await githubApiFetch<GitHubContentResponse>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}`, token, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch })
  });
}

async function deleteGitHubBackupContentIfExists(target: GitHubBackupTarget, pathValue: string, message: string) {
  try {
    const text = await downloadGitHubBackupTextAtPath(target, pathValue, target.branch.trim() || 'main', '');
    const parsed = parseJsonRecord(text);
    if (isLinkBackupChunkManifest(parsed) || isGitHubArchiveBackupManifest(parsed)) {
      for (const chunk of parsed.chunks) {
        await deleteGitHubFileIfExists(target, chunk.path, `${message} chunk ${chunk.index + 1}`);
      }
    }
  } catch (error) {
    if (!(error instanceof GitHubBackupError) || error.status !== 404) throw error;
  }
  await deleteGitHubFileIfExists(target, pathValue, message);
}

async function downloadGitHubBackupTextAtPath(target: GitHubBackupTarget, pathValue: string, ref: string, missingMessage: string) {
  const token = target.token.trim();
  const owner = target.owner.trim();
  const repo = normalizeRepoName(target.repo);
  const normalizedRef = ref.trim() || target.branch.trim() || 'main';
  const path = normalizeBackupPath(pathValue);

  if (!token || !owner || !repo) throw new GitHubBackupError('GitHub 备份配置不完整。');

  return await readGitHubFileText(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodePath(path)}?ref=${encodeURIComponent(normalizedRef)}`,
    token,
    missingMessage
  );
}

async function resolveGitHubBackupText(target: GitHubBackupTarget, text: string, ref: string, options?: GitHubBackupDownloadOptions) {
  const parsed = parseJsonRecord(text);
  if (isGitHubIncrementalBackupManifest(parsed)) return await resolveIncrementalBackupText(target, parsed, ref, options);
  if (!isLinkBackupChunkManifest(parsed)) return text;

  const chunks = [...parsed.chunks].sort((left, right) => left.index - right.index);
  const merged = new Uint8Array(parsed.originalByteLength);
  let offset = 0;
  await emitUploadProgress(options, `正在准备 GitHub 分片备份（${chunks.length} 个）`, 30);
  for (const [index, chunk] of chunks.entries()) {
    const chunkPercent = 30 + Math.round(index / Math.max(chunks.length, 1) * 40);
    await emitUploadProgress(options, `正在下载 GitHub 分片 ${index + 1}/${chunks.length}`, chunkPercent);
    const chunkText = await downloadGitHubBackupTextAtPath(target, chunk.path, ref, `未找到 GitHub 分片备份：${chunk.path}`);
    const chunkBytes = decodeBytesBase64(chunkText, `GitHub 分片备份 ${chunk.path}`);
    if (chunkBytes.byteLength !== chunk.byteLength) throw new GitHubBackupError('GitHub 分片备份大小校验失败。');
    merged.set(chunkBytes, offset);
    offset += chunkBytes.byteLength;
    await emitUploadProgress(options, `已下载 GitHub 分片 ${index + 1}/${chunks.length}`, 30 + Math.round((index + 1) / Math.max(chunks.length, 1) * 40));
  }
  if (offset !== parsed.originalByteLength) throw new GitHubBackupError('GitHub 分片备份不完整。');
  await emitUploadProgress(options, '正在合并 GitHub 分片备份', 72);
  return new TextDecoder().decode(merged);
}

async function downloadGitHubArchiveFile(target: GitHubBackupTarget, manifest: GitHubArchiveBackupManifest, ref: string, options?: GitHubBackupDownloadOptions) {
  if (!canUseBackupTemporaryFiles()) throw new GitHubBackupError('当前浏览器不支持大文件 GitHub 备份恢复，请使用最新 Chrome 或安装 BabyLink App。');
  const chunks = [...manifest.chunks].sort((left, right) => left.index - right.index);
  if (!chunks.length) throw new GitHubBackupError('GitHub 媒体归档没有分片。');
  const writer = await createBackupTemporaryFileWriter('link-github-restored.zip');
  let writtenBytes = 0;
  try {
    for (const [index, chunk] of chunks.entries()) {
      await emitUploadProgress(options, `正在下载 GitHub 归档分片 ${index + 1}/${chunks.length}`, 30 + Math.round(index / chunks.length * 45));
      const chunkText = await downloadGitHubBackupTextAtPath(target, chunk.path, ref, `未找到 GitHub 归档分片：${chunk.path}`);
      const chunkBytes = decodeBytesBase64(chunkText, `GitHub 归档分片 ${chunk.path}`);
      if (chunkBytes.byteLength !== chunk.byteLength) throw new GitHubBackupError('GitHub 归档分片大小校验失败。');
      await writer.write(new Blob([chunkBytes], { type: 'application/zip' }));
      writtenBytes += chunkBytes.byteLength;
    }
    if (writtenBytes !== manifest.originalByteLength) throw new GitHubBackupError('GitHub 媒体归档不完整。');
    await emitUploadProgress(options, '正在校验 GitHub 媒体归档', 78);
    return await writer.close();
  } catch (error) {
    await writer.abort();
    throw error;
  }
}

async function downloadResolvedGitHubBackupTextAtPath(target: GitHubBackupTarget, pathValue: string, ref: string, missingMessage: string, options?: GitHubBackupDownloadOptions) {
  const text = await downloadGitHubBackupTextAtPath(target, pathValue, ref, missingMessage);
  return await resolveGitHubBackupText(target, text, ref, options);
}

async function resolveIncrementalBackupText(target: GitHubBackupTarget, manifest: GitHubIncrementalBackupManifest, ref: string, options?: GitHubBackupDownloadOptions) {
  await emitUploadProgress(options, '正在下载 GitHub 增量基线', 30);
  const baseText = await downloadResolvedGitHubBackupTextAtPath(target, manifest.base.path, ref, `未找到 GitHub 增量基线：${manifest.base.path}`, options);
  let backup = parseLinkBackupFileText(baseText);
  const increments = [...manifest.increments].sort((left, right) => left.exportedAt - right.exportedAt);

  for (const [index, entry] of increments.entries()) {
    const stepPercent = 35 + Math.round(index / Math.max(increments.length, 1) * 35);
    await emitUploadProgress(options, `正在下载 GitHub 增量 ${index + 1}/${increments.length}`, stepPercent);
    const deltaText = await downloadResolvedGitHubBackupTextAtPath(target, entry.path, ref, `未找到 GitHub 增量备份：${entry.path}`, options);
    const delta = parseJsonRecord(deltaText);
    if (!isGitHubIncrementalBackupDelta(delta)) throw new GitHubBackupError(`GitHub 增量备份格式不正确：${entry.path}`);
    backup = applyIncrementalDelta(backup, delta);
  }

  await emitUploadProgress(options, '正在合成 GitHub 增量备份', 75);
  return stringifyLinkBackupFile(backup);
}

async function loadRemoteBackupState(target: GitHubBackupTarget): Promise<RemoteBackupState> {
  const branch = target.branch.trim() || 'main';
  const rootText = await downloadGitHubBackupTextAtPath(target, target.path, branch, '未找到 GitHub 备份文件内容。');
  const rootParsed = parseJsonRecord(rootText);
  const rootChunkPaths = isLinkBackupChunkManifest(rootParsed) ? rootParsed.chunks.map((chunk) => chunk.path) : [];
  const resolvedText = await resolveGitHubBackupText(target, rootText, branch);
  const manifest = isGitHubIncrementalBackupManifest(rootParsed) ? rootParsed : undefined;
  return {
    text: resolvedText,
    backup: parseLinkBackupFileText(resolvedText),
    manifest,
    rootChunkPaths
  };
}

async function cleanupGitHubBackupContents(target: GitHubBackupTarget, paths: string[]) {
  const uniquePaths = [...new Set(paths.map((path) => path.trim()).filter(Boolean))];
  for (const path of uniquePaths) {
    await deleteGitHubBackupContentIfExists(target, path, `Cleanup LINK backup ${path}`);
  }
}

function createIncrementalManifest(basePath: string, baseExportedAt: number, increments: GitHubIncrementalBackupEntry[], exportedAt: number): GitHubIncrementalBackupManifest {
  return {
    app: 'LINK',
    backupVersion: 2,
    incremental: true,
    exportedAt,
    base: {
      path: basePath,
      exportedAt: baseExportedAt
    },
    increments
  };
}

export async function uploadGitHubBackup(target: GitHubBackupTarget, content: string | LinkBackupFile | LinkBackupArchive, message: string, options: GitHubBackupUploadOptions = {}) {
  if (typeof content !== 'string' && isLinkBackupArchive(content)) {
    if (canUseBackupTemporaryFiles()) await uploadGitHubArchive(target, content, message, options);
    else if (content.media.length) throw new GitHubBackupError('当前浏览器不支持含本地媒体的大文件 GitHub 备份。请使用最新 Chrome 或安装 BabyLink App 后重试。');
    else await uploadGitHubBackup(target, content.backup, message, options);
    return;
  }
  const nextBackup = typeof content === 'string' ? parseLinkBackupFileText(content) : content;
  let serializedContent = typeof content === 'string' ? content : '';
  const getSerializedContent = () => {
    serializedContent ||= stringifyLinkBackupFile(nextBackup);
    return serializedContent;
  };
  const exportedAt = nextBackup.exportedAt || Date.now();
  const backupId = createBackupId(exportedAt);
  const incrementalDir = incrementalDirForPath(target.path);
  const retainCount = Math.max(1, Math.round(options.retainIncrementalManifests ?? githubIncrementalRetainCount));
  let remoteState: RemoteBackupState | null = null;
  let cleanupPaths: string[] = [];

  await emitUploadProgress(options, '正在检查远端增量基线', 5);
  try {
    remoteState = await loadRemoteBackupState(target);
  } catch (error) {
    if (!(error instanceof GitHubBackupError) || error.status !== 404) throw error;
  }

  if (!remoteState) {
    const basePath = `${incrementalDir}/base-${backupId}.json`;
    await emitUploadProgress(options, '正在上传首个全量基线', 35);
    await uploadGitHubBackupContent(target, basePath, getSerializedContent(), `${message} base`, options, 35, 82);
    const manifest = createIncrementalManifest(basePath, nextBackup.exportedAt, [], exportedAt);
    await emitUploadProgress(options, '正在写入增量入口 manifest', 85);
    await uploadGitHubBackupContent(target, target.path, JSON.stringify(manifest), `${message} manifest`, options, 85, 98);
    await emitUploadProgress(options, '增量备份已完成', 100);
    return;
  }

  await emitUploadProgress(options, '正在计算本次增量差异', 25);
  const delta = createIncrementalDelta(remoteState.backup, nextBackup);
  let basePath = remoteState.manifest?.base.path ?? `${incrementalDir}/base-${createBackupId(remoteState.backup.exportedAt || Date.now())}.json`;
  let baseExportedAt = remoteState.manifest?.base.exportedAt ?? remoteState.backup.exportedAt;
  let increments = remoteState.manifest ? [...remoteState.manifest.increments] : [];

  if (!remoteState.manifest) {
    await emitUploadProgress(options, '正在迁移旧全量备份为增量基线', 38);
    await uploadGitHubBackupContent(target, basePath, remoteState.text, `${message} previous base`, options, 38, 50);
    cleanupPaths.push(...remoteState.rootChunkPaths);
  }

  if (delta.changeCount || delta.deletionCount || delta.settingsChanged) {
    const deltaPath = `${incrementalDir}/delta-${backupId}.json`;
    const deltaEntry: GitHubIncrementalBackupEntry = {
      id: backupId,
      path: deltaPath,
      exportedAt: delta.exportedAt,
      baseExportedAt: delta.baseExportedAt,
      changes: delta.changeCount,
      deletions: delta.deletionCount,
      settingsChanged: delta.settingsChanged
    };
    await emitUploadProgress(options, `正在上传增量变更（${delta.changeCount} 改 / ${delta.deletionCount} 删）`, 55);
    const { changeCount: _changeCount, deletionCount: _deletionCount, settingsChanged: _settingsChanged, ...persistableDelta } = delta;
    await uploadGitHubBackupContent(target, deltaPath, JSON.stringify(persistableDelta), `${message} delta`, options, 55, 82);
    increments.push(deltaEntry);
  } else {
    await emitUploadProgress(options, '本次没有数据变化，正在刷新 manifest', 65);
  }

  if (increments.length > retainCount) {
    const compactBasePath = `${incrementalDir}/base-${backupId}-compact.json`;
    cleanupPaths.push(basePath, ...increments.map((entry) => entry.path));
    basePath = compactBasePath;
    baseExportedAt = nextBackup.exportedAt;
    increments = [];
    await emitUploadProgress(options, '增量链过长，正在压缩为新基线', 72);
    await uploadGitHubBackupContent(target, compactBasePath, getSerializedContent(), `${message} compact base`, options, 72, 84);
  }

  const manifest = createIncrementalManifest(basePath, baseExportedAt, increments, exportedAt);
  await emitUploadProgress(options, '正在写入增量入口 manifest', 86);
  await uploadGitHubBackupContent(target, target.path, JSON.stringify(manifest), `${message} manifest (${increments.length} deltas)`, options, 86, 92);

  if (cleanupPaths.length) {
    await emitUploadProgress(options, '正在清理旧增量文件', 94);
    await cleanupGitHubBackupContents(target, cleanupPaths);
  }

  await emitUploadProgress(options, '增量备份已完成', 100);
}

export async function downloadGitHubBackup(target: GitHubBackupTarget, options: GitHubBackupDownloadOptions = {}) {
  const branch = target.branch.trim() || 'main';
  const text = await downloadGitHubBackupTextAtPath(target, target.path, branch, '未找到 GitHub 备份文件内容。');
  return await resolveGitHubBackupText(target, text, branch, options);
}

export async function downloadGitHubBackupFile(target: GitHubBackupTarget, ref = '', options: GitHubBackupDownloadOptions = {}) {
  const resolvedRef = ref.trim() || target.branch.trim() || 'main';
  const text = await downloadGitHubBackupTextAtPath(target, target.path, resolvedRef, '未找到 GitHub 备份文件内容。');
  const parsed = parseJsonRecord(text);
  if (isGitHubArchiveBackupManifest(parsed)) {
    const archiveFile = await downloadGitHubArchiveFile(target, parsed, resolvedRef, options);
    try {
      return await parseLinkBackupBlob(archiveFile.file);
    } finally {
      await archiveFile.cleanup();
    }
  }
  return parseLinkBackupFileText(await resolveGitHubBackupText(target, text, resolvedRef, options));
}

export async function listGitHubBackupHistory(target: GitHubBackupTarget, limit = 3): Promise<GitHubBackupHistoryItem[]> {
  const token = target.token.trim();
  const owner = target.owner.trim();
  const repo = normalizeRepoName(target.repo);
  const branch = target.branch.trim() || 'main';
  const path = target.path.trim().replace(/^\/+/, '') || 'link-backup.json';

  if (!token || !owner || !repo) throw new GitHubBackupError('GitHub 备份配置不完整。');

  const commits = await githubApiFetch<GitHubCommitHistoryResponse[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?path=${encodePath(path)}&sha=${encodeURIComponent(branch)}&per_page=${Math.min(Math.max(limit, 1), 20)}`, token);
  return commits.map((commit) => ({
    sha: commit.sha,
    committedAt: commit.commit.committer.date,
    message: commit.commit.message,
    downloadPath: path
  }));
}

export async function downloadGitHubBackupVersion(target: GitHubBackupTarget, ref: string, options: GitHubBackupDownloadOptions = {}) {
  const text = await downloadGitHubBackupTextAtPath(target, target.path, ref, '未找到指定版本的 GitHub 备份文件内容。');
  return await resolveGitHubBackupText(target, text, ref, options);
}

export function formatGitHubBackupError(error: unknown) {
  if (error instanceof GitHubBackupError) {
    if (/GitHub (?:增量|分片)/.test(error.message) && /未找到|不正确|不完整|base64/.test(error.message)) {
      return `${error.message} 请刷新备份记录后重试；如果仍失败，请先恢复较新的历史版本，或重新完成一次 GitHub 备份来重建增量链。`;
    }
    if (error.status === 401) return 'GitHub token 无效或已过期，请重新登录或粘贴新 token。';
    if (error.status === 403) {
      if (error.rateLimitRemaining === '0') {
        const resetAt = Number(error.rateLimitReset) > 0 ? new Date(Number(error.rateLimitReset) * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
        return resetAt ? `GitHub API 主限流已用完，约 ${resetAt} 后再试。` : 'GitHub API 主限流已用完，请稍后再试。';
      }
      if (/secondary rate limit|abuse detection|too many requests/i.test(error.message)) return 'GitHub 触发二级限流，请等几分钟后再备份，或降低自动备份频率。';
      if (/resource not accessible|permission|scope|access/i.test(error.message)) return 'GitHub token 权限不足，请使用允许访问该私有仓库内容的 fine-grained token，或经典 token 的 repo 权限。';
      return 'GitHub 拒绝了请求，可能是权限不足、限流、网络代理或浏览器拦截。';
    }
    if (error.status === 404) return '没有找到 GitHub 仓库或备份文件，请先创建私有仓库并完成一次备份。';
    if (error.status === 409) return 'GitHub 仓库还没有可用分支，请先创建私有仓库或检查默认分支。';
    if (error.status === 422) return `GitHub 拒绝了本次操作：${error.message}`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'GitHub 备份失败。';
}