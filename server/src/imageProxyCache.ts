import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ImageProxyCacheMetadata {
  version: 1;
  contentType: string;
  createdAt: number;
  expiresAt: number;
  size: number;
}

export interface CachedImageProxyResponse {
  body: Buffer;
  contentType: string;
}

const cacheKeyPattern = /^[0-9a-f]{64}$/;
const sensitiveQueryNamePattern = /(?:token|auth|authorization|api[-_]?key|secret|signature|credential|policy|expires?|expiry|(?:^|[-_])key(?:$|[-_])|(?:^|[-_])sig(?:$|[-_])|^x-amz-|^x-goog-)/i;

export function createImageProxyCacheKey(target: URL, accept: string) {
  return createHash('sha256').update(`${target.href}\n${accept.trim().toLowerCase()}`).digest('hex');
}

export function isImageProxyUrlCacheable(target: URL, authorization = '') {
  if (authorization || target.username || target.password) return false;
  return [...target.searchParams.keys()].every((name) => !sensitiveQueryNamePattern.test(name));
}

export function imageProxyResponseCacheTtlMs(headers: Headers, defaultTtlMs: number) {
  const cacheControl = String(headers.get('cache-control') ?? '').toLowerCase();
  if (headers.has('set-cookie') || /(?:^|,)\s*(?:private|no-store|no-cache)(?:\s|,|=|$)/.test(cacheControl)) return 0;
  const vary = String(headers.get('vary') ?? '').toLowerCase().split(',').map((value) => value.trim());
  if (vary.includes('*') || vary.includes('authorization') || vary.includes('cookie')) return 0;
  const maxAgeMatch = cacheControl.match(/(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*"?(\d+)/);
  if (!maxAgeMatch) return defaultTtlMs;
  const maxAgeSeconds = Number(maxAgeMatch[1]);
  if (!Number.isSafeInteger(maxAgeSeconds) || maxAgeSeconds <= 0) return 0;
  return Math.min(defaultTtlMs, maxAgeSeconds * 1000);
}

export class ImageProxyCache {
  constructor(
    private readonly directory: string,
    private readonly maxTotalBytes: number,
    private readonly maxEntryBytes: number
  ) {}

  async initialize() {
    try {
      await mkdir(this.directory, { recursive: true });
      return true;
    } catch {
      return false;
    }
  }

  async read(key: string): Promise<CachedImageProxyResponse | null> {
    if (!cacheKeyPattern.test(key) || !await this.initialize()) return null;
    const bodyPath = this.bodyPath(key);
    const metadataPath = this.metadataPath(key);
    try {
      const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Partial<ImageProxyCacheMetadata>;
      if (metadata.version !== 1
        || typeof metadata.contentType !== 'string'
        || !metadata.contentType.toLowerCase().startsWith('image/')
        || !Number.isSafeInteger(metadata.expiresAt)
        || Number(metadata.expiresAt) <= Date.now()
        || !Number.isSafeInteger(metadata.size)
        || Number(metadata.size) < 1
        || Number(metadata.size) > this.maxEntryBytes) {
        await this.remove(key);
        return null;
      }
      const bodyStats = await stat(bodyPath);
      if (bodyStats.size !== metadata.size) {
        await this.remove(key);
        return null;
      }
      const body = await readFile(bodyPath);
      const accessedAt = new Date();
      void utimes(bodyPath, accessedAt, accessedAt).catch(() => undefined);
      return { body, contentType: metadata.contentType };
    } catch {
      return null;
    }
  }

  async write(key: string, body: Buffer, contentType: string, ttlMs: number) {
    if (!cacheKeyPattern.test(key)
      || !contentType.toLowerCase().startsWith('image/')
      || body.byteLength < 1
      || body.byteLength > this.maxEntryBytes
      || ttlMs <= 0
      || !await this.initialize()) return false;
    const temporaryId = randomUUID();
    const temporaryBodyPath = join(this.directory, `.${key}-${temporaryId}.body.tmp`);
    const temporaryMetadataPath = join(this.directory, `.${key}-${temporaryId}.json.tmp`);
    const createdAt = Date.now();
    const metadata: ImageProxyCacheMetadata = {
      version: 1,
      contentType,
      createdAt,
      expiresAt: createdAt + ttlMs,
      size: body.byteLength
    };
    try {
      await Promise.all([
        writeFile(temporaryBodyPath, body),
        writeFile(temporaryMetadataPath, JSON.stringify(metadata))
      ]);
      await rename(temporaryBodyPath, this.bodyPath(key));
      await rename(temporaryMetadataPath, this.metadataPath(key));
      await this.prune();
      return true;
    } catch {
      await Promise.all([
        rm(temporaryBodyPath, { force: true }).catch(() => undefined),
        rm(temporaryMetadataPath, { force: true }).catch(() => undefined)
      ]);
      return false;
    }
  }

  private bodyPath(key: string) {
    return join(this.directory, `${key}.body`);
  }

  private metadataPath(key: string) {
    return join(this.directory, `${key}.json`);
  }

  private async remove(key: string) {
    await Promise.all([
      rm(this.bodyPath(key), { force: true }),
      rm(this.metadataPath(key), { force: true })
    ]).catch(() => undefined);
  }

  private async prune() {
    try {
      const fileNames = (await readdir(this.directory)).filter((name) => name.endsWith('.body'));
      const entries = (await Promise.all(fileNames.map(async (fileName) => {
        const key = fileName.slice(0, -5);
        if (!cacheKeyPattern.test(key)) return null;
        const bodyStats = await stat(this.bodyPath(key));
        return { key, size: bodyStats.size, lastAccessedAt: bodyStats.mtimeMs };
      }))).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
      let totalBytes = entries.reduce((total, entry) => total + entry.size, 0);
      if (totalBytes <= this.maxTotalBytes) return;
      entries.sort((left, right) => left.lastAccessedAt - right.lastAccessedAt);
      for (const entry of entries) {
        if (totalBytes <= this.maxTotalBytes) break;
        await this.remove(entry.key);
        totalBytes -= entry.size;
      }
    } catch {}
  }
}