import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { getSessionIdentity, requireSession } from './auth.js';
import { config } from './config.js';
import { query } from './db.js';
import { createOpaqueToken, createSignedTicket, hashSecret, safeFileName, verifySignedTicket } from './security.js';

interface ReleaseRow {
  id: string;
  platform: 'android' | 'ios' | 'desktop-macos' | 'desktop-windows';
  version_code: number;
  version_name: string;
  minimum_version_code: number;
  file_name: string;
  sha256: string;
  file_size: string;
  notes: string;
  created_at: Date;
}

interface ReleaseSourceTokenRow {
  qq: string;
}

const iosSourceTokenLifetimeMs = 180 * 24 * 60 * 60 * 1000;
const releaseUploadIdPattern = /^[a-zA-Z0-9_-]{16,80}$/;

export function normalizeReleaseNotes(value: unknown) {
  const source = String(value ?? '').trim();
  if (!source) return '';
  let normalized = source;
  if (/%[0-9a-f]{2}/i.test(normalized)) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {}
  }
  if (/[\u00c0-\u00ff\u0152\u0153]/.test(normalized)) {
    const repaired = Buffer.from(normalized, 'latin1').toString('utf8');
    const normalizedCjkCount = normalized.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    const repairedCjkCount = repaired.match(/[\u3400-\u9fff]/g)?.length ?? 0;
    if (!repaired.includes('\ufffd') && repairedCjkCount > normalizedCjkCount) normalized = repaired;
  }
  return normalized.slice(0, 4000);
}

function isAdmin(request: FastifyRequest) {
  return Boolean(config.adminToken && request.headers.authorization === `Bearer ${config.adminToken}`);
}

function parseReleaseMetadata(request: FastifyRequest, reply: FastifyReply) {
  const platform = String(request.headers['x-link-platform'] ?? '');
  const versionCode = Number(request.headers['x-link-version-code'] ?? 0);
  const versionName = String(request.headers['x-link-version-name'] ?? '').trim().slice(0, 40);
  const minimumVersionCode = Math.max(1, Number(request.headers['x-link-minimum-version-code'] ?? 1) || 1);
  const encodedNotes = String(request.headers['x-link-release-notes-base64'] ?? '').trim();
  const legacyNotes = request.headers['x-link-release-notes'];
  const notes = encodedNotes
    ? normalizeReleaseNotes(Buffer.from(encodedNotes, 'base64').toString('utf8'))
    : normalizeReleaseNotes(legacyNotes);
  if (!['android', 'ios', 'desktop-macos', 'desktop-windows'].includes(platform) || !Number.isInteger(versionCode) || versionCode < 1 || !versionName) {
    void reply.code(400).send({ error: 'invalid_release_metadata' });
    return null;
  }
  return { platform, versionCode, versionName, minimumVersionCode, notes };
}

async function publishReleaseFile(metadata: NonNullable<ReturnType<typeof parseReleaseMetadata>>, sourcePath: string, sha256: string, fileSize: number) {
  const extensions: Record<string, string> = { android: 'apk', ios: 'ipa', 'desktop-macos': 'dmg', 'desktop-windows': 'exe' };
  const fileName = `babylink-${metadata.platform}-${metadata.versionCode}.${extensions[metadata.platform]}`;
  const finalPath = join(config.releaseDir, fileName);
  await rename(sourcePath, finalPath);
  const releaseId = randomUUID();
  await query(`
    INSERT INTO releases (id, platform, version_code, version_name, minimum_version_code, file_name, sha256, file_size, notes, published)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
    ON CONFLICT (platform, version_code) DO UPDATE SET
      version_name = EXCLUDED.version_name,
      minimum_version_code = EXCLUDED.minimum_version_code,
      file_name = EXCLUDED.file_name,
      sha256 = EXCLUDED.sha256,
      file_size = EXCLUDED.file_size,
      notes = EXCLUDED.notes,
      published = TRUE,
      created_at = NOW()
  `, [releaseId, metadata.platform, metadata.versionCode, metadata.versionName, metadata.minimumVersionCode, fileName, sha256, fileSize, metadata.notes]);
  return { ok: true, platform: metadata.platform, versionCode: metadata.versionCode, versionName: metadata.versionName, sha256, fileSize };
}

function createDownloadTicket(row: ReleaseRow, qq: string) {
  return createSignedTicket({ releaseId: row.id, qq, expiresAt: Date.now() + 5 * 60 * 1000 });
}

function releasePayload(row: ReleaseRow, qq: string, currentVersionCode = 0) {
  const ticket = createDownloadTicket(row, qq);
  return {
    id: row.id,
    platform: row.platform,
    versionCode: row.version_code,
    versionName: row.version_name,
    minimumVersionCode: row.minimum_version_code,
    mandatory: currentVersionCode > 0 && currentVersionCode < row.minimum_version_code,
    updateAvailable: currentVersionCode === 0 || currentVersionCode < row.version_code,
    sha256: row.sha256,
    fileSize: Number(row.file_size),
    notes: normalizeReleaseNotes(row.notes),
    publishedAt: row.created_at.getTime(),
    downloadUrl: `/api/releases/${row.id}/download?${new URLSearchParams({ ticket }).toString()}`,
    downloadExpiresAt: Date.now() + 5 * 60 * 1000
  };
}

async function createIosSourceToken(qq: string) {
  const token = createOpaqueToken(36);
  const expiresAt = new Date(Date.now() + iosSourceTokenLifetimeMs);
  await query(`
    INSERT INTO release_source_tokens (token_hash, qq, expires_at)
    VALUES ($1, $2, $3)
  `, [hashSecret(token), qq, expiresAt]);
  return { token, expiresAt: expiresAt.getTime() };
}

async function authorizeIosSourceToken(token: string) {
  if (!token || token.length > 256) return null;
  const result = await query<ReleaseSourceTokenRow>(`
    SELECT rst.qq
    FROM release_source_tokens rst
    JOIN users u ON u.qq = rst.qq AND u.status = 'active'
    WHERE rst.token_hash = $1
      AND rst.revoked_at IS NULL
      AND rst.expires_at > NOW()
      AND EXISTS (
        SELECT 1
        FROM memberships m
        JOIN allowed_groups g ON g.group_id = m.group_id AND g.enabled = TRUE
        WHERE m.qq = rst.qq
          AND m.active = TRUE
          AND m.last_seen_at > NOW() - ($2::int * INTERVAL '1 hour')
      )
    LIMIT 1
  `, [hashSecret(token), config.membershipMaxAgeHours]);
  return result.rows[0]?.qq ?? null;
}

async function sendReleaseFile(reply: FastifyReply, release: ReleaseRow) {
  const fileName = safeFileName(release.file_name);
  const filePath = join(config.releaseDir, fileName);
  try {
    await stat(filePath);
  } catch {
    return await reply.code(404).send({ error: 'release_file_missing' });
  }
  const contentTypes: Record<ReleaseRow['platform'], string> = {
    android: 'application/vnd.android.package-archive',
    ios: 'application/octet-stream',
    'desktop-macos': 'application/x-apple-diskimage',
    'desktop-windows': 'application/vnd.microsoft.portable-executable'
  };
  reply.header('Content-Type', contentTypes[release.platform]);
  reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
  reply.header('Content-Length', release.file_size);
  reply.header('X-Content-SHA256', release.sha256);
  reply.header('Cache-Control', 'private, no-store');
  return reply.send(createReadStream(filePath));
}

export async function registerReleaseRoutes(app: FastifyInstance) {
  await mkdir(config.releaseDir, { recursive: true });

  app.get('/api/releases/altstore/source-link', async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const grant = await createIosSourceToken(session.qq);
    const sourceUrl = `${config.appOrigin}/api/releases/altstore/source.json?${new URLSearchParams({ token: grant.token }).toString()}`;
    return {
      url: sourceUrl,
      altstoreUrl: `altstore://source?url=${encodeURIComponent(sourceUrl)}`,
      sidestoreUrl: `sidestore://source?url=${encodeURIComponent(sourceUrl)}`,
      expiresAt: grant.expiresAt
    };
  });

  app.get('/api/releases/altstore/source.json', async (request, reply) => {
    const token = String((request.query as { token?: unknown } | null)?.token ?? '');
    const qq = await authorizeIosSourceToken(token);
    if (!qq) return await reply.code(401).send({ error: 'source_authorization_required', message: '更新源授权已失效，请返回 BabyLink 重新复制。' });
    const result = await query<ReleaseRow>(`
      SELECT id, platform, version_code, version_name, minimum_version_code, file_name, sha256, file_size::text, notes, created_at
      FROM releases
      WHERE platform = 'ios' AND published = TRUE
      ORDER BY version_code DESC
      LIMIT 20
    `);
    const versions = result.rows.map((release) => ({
      version: release.version_name,
      buildVersion: String(release.version_code),
      date: release.created_at.toISOString(),
      downloadURL: `${config.appOrigin}/api/releases/${release.id}/altstore-download?${new URLSearchParams({ token }).toString()}`,
      size: Number(release.file_size),
      localizedDescription: normalizeReleaseNotes(release.notes) || `BabyLink ${release.version_name}`,
      minOSVersion: '15.0'
    }));
    reply.header('Content-Type', 'application/json; charset=utf-8');
    reply.header('Cache-Control', 'private, no-store');
    return {
      name: 'BabyLink',
      subtitle: 'BabyLink iOS 自签更新源',
      description: '供 AltStore 与 SideStore 获取 BabyLink 未签名 IPA 更新。安装与签名仍由外部签名工具完成。',
      iconURL: `${config.appOrigin}/link-icon-192.png`,
      website: config.appOrigin,
      tintColor: '#ff668b',
      featuredApps: versions.length ? ['top.babylink.app'] : [],
      news: [],
      apps: versions.length ? [{
        name: 'BabyLink',
        bundleIdentifier: 'top.babylink.app',
        developerName: 'BabyLink',
        subtitle: '沉浸式角色互动与陪伴',
        localizedDescription: 'BabyLink 官方自签 IPA。通过 AltStore 或 SideStore 签名后覆盖安装，可保留相同应用身份下的数据。',
        iconURL: `${config.appOrigin}/link-icon-192.png`,
        tintColor: '#ff668b',
        versions,
        appPermissions: {
          entitlements: [],
          privacy: {
            NSCameraUsageDescription: 'BabyLink 需要使用摄像头，以便在视频通话中显示你的实时画面。',
            NSMicrophoneUsageDescription: 'BabyLink 需要使用麦克风，以便在语音和视频通话中识别你的语音。',
            NSSpeechRecognitionUsageDescription: 'BabyLink 需要使用语音识别，以便将通话语音转换为文字字幕。'
          }
        }
      }] : []
    };
  });

  app.get('/api/releases/:id/altstore-download', async (request, reply) => {
    const id = String((request.params as { id?: string }).id ?? '');
    const token = String((request.query as { token?: unknown } | null)?.token ?? '');
    const qq = await authorizeIosSourceToken(token);
    if (!qq) return await reply.code(401).send({ error: 'source_authorization_required', message: '更新源授权已失效，请返回 BabyLink 重新复制。' });
    const result = await query<ReleaseRow>(`
      SELECT id, platform, version_code, version_name, minimum_version_code, file_name, sha256, file_size::text, notes, created_at
      FROM releases
      WHERE id = $1 AND platform = 'ios' AND published = TRUE
      LIMIT 1
    `, [id]);
    const release = result.rows[0];
    if (!release) return await reply.code(404).send({ error: 'release_not_found' });
    return await sendReleaseFile(reply, release);
  });

  app.get('/api/releases/latest', async (request, reply) => {
    const session = await requireSession(request, reply);
    if (!session) return;
    const queryValue = request.query as { platform?: unknown; versionCode?: unknown };
    const platform = String(queryValue.platform ?? 'android');
    const currentVersionCode = Math.max(0, Number(queryValue.versionCode ?? 0) || 0);
    if (!['android', 'ios', 'desktop-macos', 'desktop-windows'].includes(platform)) return await reply.code(400).send({ error: 'invalid_platform' });
    const result = await query<ReleaseRow>(`
      SELECT id, platform, version_code, version_name, minimum_version_code, file_name, sha256, file_size::text, notes, created_at
      FROM releases
      WHERE platform = $1 AND published = TRUE
      ORDER BY version_code DESC
      LIMIT 1
    `, [platform]);
    const release = result.rows[0];
    return release ? releasePayload(release, session.qq, currentVersionCode) : { platform, updateAvailable: false, release: null };
  });

  app.get('/api/releases/:id/download', async (request, reply) => {
    const id = String((request.params as { id?: string }).id ?? '');
    const session = await getSessionIdentity(request);
    const ticketValue = String((request.query as { ticket?: unknown } | null)?.ticket ?? '');
    const ticket = verifySignedTicket<{ releaseId?: unknown; qq?: unknown; expiresAt?: unknown }>(ticketValue);
    const ticketValid = ticket?.releaseId === id && Number(ticket.expiresAt ?? 0) > Date.now() && /^\d{5,12}$/.test(String(ticket.qq ?? ''));
    if (!session && !ticketValid) return await reply.code(401).send({ error: 'download_authorization_required', message: '下载票据无效或已经过期，请返回 BabyLink 重新获取。' });
    const result = await query<ReleaseRow>(`
      SELECT id, platform, version_code, version_name, minimum_version_code, file_name, sha256, file_size::text, notes, created_at
      FROM releases
      WHERE id = $1 AND published = TRUE
      LIMIT 1
    `, [id]);
    const release = result.rows[0];
    if (!release) return await reply.code(404).send({ error: 'release_not_found' });
    return await sendReleaseFile(reply, release);
  });

  app.put('/api/admin/releases/upload', { bodyLimit: config.uploadBodyLimitBytes }, async (request, reply) => {
    if (!isAdmin(request)) return await reply.code(401).send({ error: 'admin_auth_required' });
    const metadata = parseReleaseMetadata(request, reply);
    if (!metadata) return;
    if (!Buffer.isBuffer(request.body) || !request.body.length) return await reply.code(400).send({ error: 'release_file_required' });

    const temporaryPath = join(config.releaseDir, `.release-${randomUUID()}.tmp`);
    try {
      await writeFile(temporaryPath, request.body);
      const sha256 = createHash('sha256').update(request.body).digest('hex');
      return await publishReleaseFile(metadata, temporaryPath, sha256, request.body.byteLength);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      return await reply.code(500).send({ error: 'release_upload_failed', message: error instanceof Error ? error.message : '安装包保存失败。' });
    }
  });

  app.put('/api/admin/releases/upload-chunk', { bodyLimit: 16 * 1024 * 1024 }, async (request, reply) => {
    if (!isAdmin(request)) return await reply.code(401).send({ error: 'admin_auth_required' });
    const uploadId = String(request.headers['x-link-upload-id'] ?? '');
    const chunkIndex = Number(request.headers['x-link-chunk-index'] ?? -1);
    if (!releaseUploadIdPattern.test(uploadId) || !Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 10_000) {
      return await reply.code(400).send({ error: 'invalid_release_chunk' });
    }
    if (!Buffer.isBuffer(request.body) || !request.body.length) return await reply.code(400).send({ error: 'release_chunk_required' });
    const uploadDirectory = join(config.releaseDir, '.uploads', uploadId);
    await mkdir(uploadDirectory, { recursive: true });
    const chunkPath = join(uploadDirectory, `${String(chunkIndex).padStart(6, '0')}.part`);
    await writeFile(chunkPath, request.body);
    return { ok: true, uploadId, chunkIndex, size: request.body.byteLength };
  });

  app.post('/api/admin/releases/complete-upload', async (request, reply) => {
    if (!isAdmin(request)) return await reply.code(401).send({ error: 'admin_auth_required' });
    const metadata = parseReleaseMetadata(request, reply);
    if (!metadata) return;
    const uploadId = String(request.headers['x-link-upload-id'] ?? '');
    const chunkCount = Number(request.headers['x-link-chunk-count'] ?? 0);
    const expectedSha256 = String(request.headers['x-link-sha256'] ?? '').toLowerCase();
    if (!releaseUploadIdPattern.test(uploadId) || !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 10_000 || !/^[0-9a-f]{64}$/.test(expectedSha256)) {
      return await reply.code(400).send({ error: 'invalid_release_upload' });
    }
    const uploadDirectory = join(config.releaseDir, '.uploads', uploadId);
    const temporaryPath = join(config.releaseDir, `.release-${randomUUID()}.tmp`);
    try {
      const chunks = (await readdir(uploadDirectory)).filter((name) => name.endsWith('.part')).sort();
      if (chunks.length !== chunkCount) return await reply.code(409).send({ error: 'release_chunks_incomplete', received: chunks.length, expected: chunkCount });
      const hash = createHash('sha256');
      let fileSize = 0;
      await writeFile(temporaryPath, Buffer.alloc(0));
      for (let index = 0; index < chunks.length; index += 1) {
        const expectedName = `${String(index).padStart(6, '0')}.part`;
        if (chunks[index] !== expectedName) {
          await unlink(temporaryPath);
          return await reply.code(409).send({ error: 'release_chunks_out_of_order' });
        }
        const bytes = await readFile(join(uploadDirectory, expectedName));
        hash.update(bytes);
        fileSize += bytes.byteLength;
        await appendFile(temporaryPath, bytes);
      }
      const sha256 = hash.digest('hex');
      if (sha256 !== expectedSha256) {
        await unlink(temporaryPath);
        return await reply.code(422).send({ error: 'release_sha256_mismatch', actualSha256: sha256 });
      }
      const result = await publishReleaseFile(metadata, temporaryPath, sha256, fileSize);
      await rm(uploadDirectory, { recursive: true, force: true });
      return result;
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      return await reply.code(500).send({ error: 'release_upload_failed', message: error instanceof Error ? error.message : '安装包合并失败。' });
    }
  });
}