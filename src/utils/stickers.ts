import { unzipSync } from 'fflate';
import type { Sticker, StickerGroup, StickerSourceType } from '@/types/domain';
import { compressInlineImageDataUrl } from '@/utils/imageFile';
import { createId } from './id';

export interface StickerImportDraft {
  description: string;
  imageUrl: string;
  sourceType: StickerSourceType;
  cacheImageUrl?: () => Promise<string>;
  cleanupImageUrl?: () => void;
}

export const RECENT_STICKER_GROUP_ID = 'sticker_group_recent';
export const RECENT_STICKER_GROUP_NAME = '最近';
export const RECENT_STICKER_LIMIT = 25;
export const LEGACY_GANADI_STICKER_GROUP_ID = 'sticker_group_default';
export const LEGACY_GANADI_STICKER_GROUP_NAME = 'ganadi';
export const LEGACY_GANADI_STICKER_IDS = new Set([
  'sticker_ganadi_stare',
  'sticker_ganadi_speechless',
  'sticker_ganadi_like',
  'sticker_ganadi_love',
  'sticker_ganadi_wronged',
  'sticker_ganadi_cry',
  'sticker_ganadi_negotiate',
  'sticker_ganadi_escape',
  'sticker_ganadi_court',
  'sticker_ganadi_losing_water'
]);

const imageDownloadPath = '/__image-download';
const maxStickerImageBytes = 12 * 1024 * 1024;
const stickerCacheCompressionOptions = { maxDimension: 360, quality: 0.72, mimeType: 'image/webp' as const, minBytes: 0, force: true };
const urlPattern = /(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s<>"'，。；;、)\]}]*?\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#][^\s<>"'，。；;、)\]}]*)?|https?:\/\/[^\s<>"'，。；;、)\]}]+)/gi;
const imageExtensionPattern = /\.(?:png|jpe?g|gif|webp|avif|bmp|svg)(?:[?#].*)?$/i;

export function isRecentStickerGroupId(groupId: string) {
  return groupId === RECENT_STICKER_GROUP_ID;
}

export function isLegacyGanadiStickerGroup(group: Pick<StickerGroup, 'id' | 'name'>) {
  return group.id === LEGACY_GANADI_STICKER_GROUP_ID || group.name.trim().toLocaleLowerCase() === LEGACY_GANADI_STICKER_GROUP_NAME;
}

export function isLegacyGanadiSticker(sticker: Pick<Sticker, 'id' | 'groupIds'>) {
  return LEGACY_GANADI_STICKER_IDS.has(sticker.id) || sticker.groupIds.includes(LEGACY_GANADI_STICKER_GROUP_ID);
}

export function sortRecentStickers(stickers: Sticker[]) {
  return [...stickers]
    .filter((sticker) => Number(sticker.lastUsedAt) > 0)
    .sort((left, right) => {
      const usedDiff = (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0);
      if (usedDiff) return usedDiff;
      const updatedDiff = right.updatedAt - left.updatedAt;
      if (updatedDiff) return updatedDiff;
      return right.id.localeCompare(left.id);
    })
    .slice(0, RECENT_STICKER_LIMIT);
}

function isDataImageUrl(value: string) {
  return /^data:image\//i.test(value.trim());
}

function isRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function isFetchableLocalImageUrl(value: string) {
  return /^blob:/i.test(value.trim());
}

function inferImageMimeType(url: string) {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  if (/\.jpe?g$/i.test(pathname)) return 'image/jpeg';
  if (/\.gif$/i.test(pathname)) return 'image/gif';
  if (/\.webp$/i.test(pathname)) return 'image/webp';
  if (/\.avif$/i.test(pathname)) return 'image/avif';
  if (/\.bmp$/i.test(pathname)) return 'image/bmp';
  if (/\.svg$/i.test(pathname)) return 'image/svg+xml';
  return '';
}

function bytesStartWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function bytesMatchAscii(bytes: Uint8Array, offset: number, value: string) {
  if (bytes.length < offset + value.length) return false;
  for (let index = 0; index < value.length; index += 1) {
    if (bytes[offset + index] !== value.charCodeAt(index)) return false;
  }
  return true;
}

function inferImageMimeTypeFromBytes(bytes: Uint8Array) {
  if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytesMatchAscii(bytes, 0, 'GIF87a') || bytesMatchAscii(bytes, 0, 'GIF89a')) return 'image/gif';
  if (bytesMatchAscii(bytes, 0, 'RIFF') && bytesMatchAscii(bytes, 8, 'WEBP')) return 'image/webp';
  if (bytesMatchAscii(bytes, 4, 'ftyp') && ['avif', 'avis'].some((brand) => bytesMatchAscii(bytes, 8, brand) || bytesMatchAscii(bytes, 16, brand))) return 'image/avif';
  if (bytesStartWith(bytes, [0x42, 0x4d])) return 'image/bmp';

  const prefix = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 512)).trimStart();
  if (/^(?:<\?xml\s[^>]*>\s*)?<svg[\s>]/i.test(prefix)) return 'image/svg+xml';
  return '';
}

async function inferImageMimeTypeFromBlob(blob: Blob) {
  const bytes = new Uint8Array(await blob.slice(0, 512).arrayBuffer());
  return inferImageMimeTypeFromBytes(bytes);
}

function isGenericBinaryMimeType(mimeType: string) {
  return !mimeType || /^(?:application\/octet-stream|binary\/octet-stream|application\/x-binary)$/i.test(mimeType);
}

function createImageDownloadUrl(url: string) {
  if (!isRemoteImageUrl(url)) return url;
  if (typeof window !== 'undefined') {
    try {
      if (new URL(url).origin === window.location.origin) return url;
    } catch {
      return url;
    }
  }
  return `${imageDownloadPath}?url=${encodeURIComponent(url)}`;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片转码失败。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

export function getStickerDisplayImageUrl(sticker: Pick<Sticker, 'imageUrl' | 'cachedImageUrl'> | { imageUrl: string; cachedImageUrl?: string }) {
  return String(sticker.cachedImageUrl || sticker.imageUrl || '').trim();
}

export function shouldLocalizeStickerImageUrl(imageUrl: string) {
  const trimmed = imageUrl.trim();
  return Boolean(trimmed) && !isDataImageUrl(trimmed) && isRemoteImageUrl(trimmed);
}

export async function localizeStickerImageUrl(imageUrl: string) {
  const trimmed = imageUrl.trim();
  if (!trimmed || isDataImageUrl(trimmed)) return trimmed;
  if (!isRemoteImageUrl(trimmed) && !isFetchableLocalImageUrl(trimmed)) return trimmed;

  const downloadUrl = isFetchableLocalImageUrl(trimmed) ? trimmed : createImageDownloadUrl(trimmed);
  const candidates = [...new Set([downloadUrl, trimmed])];
  let response: Response | undefined;
  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const nextResponse = await fetch(candidate, {
        headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' }
      });
      response = nextResponse;
      const contentType = nextResponse.headers.get('content-type')?.split(';')[0]?.trim().toLocaleLowerCase() ?? '';
      const proxyReturnedHtml = candidate !== trimmed && nextResponse.ok && contentType === 'text/html';
      if (nextResponse.ok && !proxyReturnedHtml) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) {
    const message = lastError instanceof Error ? lastError.message : String(lastError ?? '网络请求失败');
    throw new Error(`贴纸图片下载失败，无法本地化：${message}。请改用本地图片导入，或通过可访问的图片代理/图床重新导入。`);
  }

  if (!response.ok) {
    throw new Error(`贴纸图片下载失败，状态码：${response.status}。请改用本地图片导入，或通过可访问的图片代理/图床重新导入。`);
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxStickerImageBytes) {
    throw new Error('贴纸图片超过 12MB，无法写入本地缓存。');
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const downloadedBlob = await response.blob();
  if (!downloadedBlob.size) throw new Error('贴纸图片下载结果为空。');
  if (downloadedBlob.size > maxStickerImageBytes) throw new Error('贴纸图片超过 12MB，无法写入本地缓存。');

  const declaredMimeType = downloadedBlob.type || contentType;
  const sniffedMimeType = await inferImageMimeTypeFromBlob(downloadedBlob);
  const mimeType = sniffedMimeType || (isGenericBinaryMimeType(declaredMimeType) ? inferImageMimeType(trimmed) : declaredMimeType);
  if (!mimeType.startsWith('image/')) {
    throw new Error(`贴纸链接返回的不是图片内容：${mimeType || '未知类型'}。`);
  }

  return readBlobAsDataUrl(downloadedBlob.type === mimeType ? downloadedBlob : new Blob([downloadedBlob], { type: mimeType }));
}

export async function cacheStickerImageUrl(imageUrl: string, readImageUrl?: () => Promise<string>) {
  const sourceDataUrl = readImageUrl ? await readImageUrl() : await localizeStickerImageUrl(imageUrl);
  const trimmed = sourceDataUrl.trim();
  if (!trimmed || !isDataImageUrl(trimmed)) return trimmed;
  try {
    return await compressInlineImageDataUrl(trimmed, stickerCacheCompressionOptions);
  } catch {
    return trimmed;
  }
}

export async function localizeStickerImportDraft(draft: StickerImportDraft): Promise<StickerImportDraft> {
  if (!shouldLocalizeStickerImageUrl(draft.imageUrl)) return draft;
  return {
    ...draft,
    imageUrl: await localizeStickerImageUrl(draft.imageUrl)
  };
}

export async function localizeStickerImportDrafts(drafts: StickerImportDraft[]) {
  const localizedDrafts: StickerImportDraft[] = [];
  for (const draft of drafts) {
    localizedDrafts.push(await localizeStickerImportDraft(draft));
  }
  return localizedDrafts;
}

function stripWrappingPunctuation(value: string) {
  return value
    .trim()
    .replace(/^[\s,，;；|｜\-–—*·•]+/, '')
    .replace(/[\s,，;；|｜]+$/, '')
    .trim();
}

function normalizeDescription(description: string, fallback = 'Sticker') {
  const normalized = description
    .replace(/^[-*•\d.)、\s]+/, '')
    .replace(/^描述\s*[:：]/i, '')
    .replace(/^名称\s*[:：]/i, '')
    .replace(/^name\s*[:：]/i, '')
    .trim();
  return normalized || fallback;
}

function looksLikeImageUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed) && (imageExtensionPattern.test(trimmed) || /postimg|imgur|image|photo|pic|media|cdn/i.test(trimmed));
}

function uniqueDrafts(drafts: StickerImportDraft[]) {
  const seen = new Set<string>();
  const result: StickerImportDraft[] = [];
  for (const draft of drafts) {
    const imageUrl = stripWrappingPunctuation(draft.imageUrl);
    const description = normalizeDescription(draft.description);
    if (!imageUrl || !description || !looksLikeImageUrl(imageUrl)) continue;
    const key = `${description.toLocaleLowerCase()}::${imageUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ description, imageUrl, sourceType: draft.sourceType });
  }
  return result;
}

function parseJsonImport(text: string, sourceType: StickerSourceType) {
  const trimmed = text.trim();
  if (!trimmed || !/^[\[{]/.test(trimmed)) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const entries = Array.isArray(parsed) ? parsed : Object.entries(parsed as Record<string, unknown>).map(([description, value]) => ({ description, value }));
    const drafts: StickerImportDraft[] = [];
    for (const entry of entries) {
      if (typeof entry === 'string') {
        drafts.push(...parseStickerImportText(entry, sourceType));
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      const record = entry as Record<string, unknown>;
      const description = String(record.description ?? record.text ?? record.name ?? record.title ?? record.label ?? '').trim();
      const imageUrl = String(record.imageUrl ?? record.url ?? record.src ?? record.image ?? record.value ?? '').trim();
      drafts.push({ description, imageUrl, sourceType });
    }
    return drafts;
  } catch {
    return [];
  }
}

function parseLineImport(line: string, sourceType: StickerSourceType) {
  const normalizedLine = line
    .replace(/\r/g, '\n')
    .replace(/[；;]+/g, '；')
    .replace(/[\t ]+/g, ' ')
    .trim();
  if (!normalizedLine) return [];

  const markdownMatches = [...normalizedLine.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|data:image\/[^\s)]+)\)/gi)];
  if (markdownMatches.length) {
    return markdownMatches.map((match) => ({
      description: match[1],
      imageUrl: match[2],
      sourceType
    }));
  }

  const urls = [...normalizedLine.matchAll(urlPattern)].map((match) => stripWrappingPunctuation(match[0]));
  if (!urls.length) return [];

  const matches = [...normalizedLine.matchAll(urlPattern)];
  return matches.map((match, index) => {
    const imageUrl = stripWrappingPunctuation(match[0]);
    const urlStart = match.index ?? normalizedLine.indexOf(imageUrl);
    const previousUrl = index > 0 ? matches[index - 1] : null;
    const previousEnd = previousUrl ? (previousUrl.index ?? 0) + previousUrl[0].length : 0;
    const nextUrl = matches[index + 1];
    const segmentBeforeUrl = normalizedLine.slice(previousEnd, urlStart).trim();
    const beforeUrl = segmentBeforeUrl || normalizedLine.slice(0, urlStart).trim();
    const afterUrl = nextUrl
      ? normalizedLine.slice(urlStart + match[0].length, nextUrl.index).trim()
      : normalizedLine.slice(urlStart + match[0].length).trim();
    const labelCandidate = stripWrappingPunctuation(
      beforeUrl
        .replace(/[\t|｜,，;；]+$/g, '')
        .replace(/[:：=]+$/g, '')
        .replace(/^[-*•\d.)、\s]+/, '')
    ) || stripWrappingPunctuation(afterUrl.replace(/^[:：=\t|｜,，;；]+/g, ''));

    return {
      description: normalizeDescription(labelCandidate, `Sticker ${index + 1}`),
      imageUrl,
      sourceType
    };
  });
}

export function parseStickerImportText(text: string, sourceType: StickerSourceType = 'manual') {
  const drafts = [
    ...parseJsonImport(text, sourceType),
    ...text
      .replace(/\r/g, '\n')
      .split(/\n+/)
      .flatMap((line) => parseLineImport(line, sourceType))
  ];
  return uniqueDrafts(drafts);
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function readZipDocumentText(file: File) {
  const buffer = await file.arrayBuffer();
  const files = unzipSync(new Uint8Array(buffer));
  const decoder = new TextDecoder();
  const documentEntries = Object.entries(files).filter(([name]) => /word\/document\.xml$|word\/header\d*\.xml$|word\/footer\d*\.xml$/i.test(name));
  const xml = documentEntries.map(([, bytes]) => decoder.decode(bytes)).join('\n');
  return decodeXmlEntities(xml.replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, ' '));
}

function readTextFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('文件读取失败。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });
}

export async function readStickerImportFile(file: File) {
  const lowerName = file.name.toLocaleLowerCase();
  if (/\.docx$/i.test(lowerName)) return readZipDocumentText(file);
  if (/\.doc$/i.test(lowerName)) {
    const text = await readTextFile(file);
    return text.replace(/\u0000/g, ' ');
  }
  return readTextFile(file);
}

export function readImageFileAsSticker(file: File) {
  return new Promise<StickerImportDraft>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片读取失败。'));
    reader.onload = () => {
      const fileName = file.name.replace(/\.[^.]+$/, '').trim() || '本地贴纸';
      resolve({
        description: fileName,
        imageUrl: String(reader.result ?? ''),
        sourceType: 'local-image'
      });
    };
    reader.readAsDataURL(file);
  });
}

export function createImageFileStickerDraft(file: File): StickerImportDraft {
  const objectUrl = URL.createObjectURL(file);
  const fileName = file.name.replace(/\.[^.]+$/, '').trim() || '本地贴纸';
  return {
    description: fileName,
    imageUrl: objectUrl,
    sourceType: 'local-image',
    cacheImageUrl: () => cacheStickerImageUrl(objectUrl, () => readBlobAsDataUrl(file)),
    cleanupImageUrl: () => URL.revokeObjectURL(objectUrl)
  };
}

export function createStickerGroup(name = '新分组'): StickerGroup {
  const now = Date.now();
  return {
    id: createId('sticker_group'),
    name: name.trim() || '新分组',
    sortOrder: now,
    createdAt: now,
    updatedAt: now
  };
}

export function createStickerFromDraft(draft: StickerImportDraft, groupIds: string[]): Sticker {
  const now = Date.now();
  return {
    id: createId('sticker'),
    description: normalizeDescription(draft.description),
    imageUrl: draft.imageUrl.trim(),
    groupIds: [...new Set(groupIds.filter(Boolean))],
    sourceType: draft.sourceType,
    createdAt: now,
    updatedAt: now
  };
}

export function normalizeStickerGroup(group: Partial<StickerGroup> | null | undefined): StickerGroup | null {
  const id = String(group?.id ?? '').trim();
  const name = String(group?.name ?? '').trim();
  if (!id || !name) return null;
  const createdAt = Number(group?.createdAt) || Date.now();
  return {
    id,
    name,
    ...(Number(group?.sortOrder) > 0 ? { sortOrder: Number(group?.sortOrder) } : {}),
    createdAt,
    updatedAt: Number(group?.updatedAt) || createdAt
  };
}

export function normalizeSticker(sticker: Partial<Sticker> | null | undefined, fallbackGroupId = ''): Sticker | null {
  const id = String(sticker?.id ?? '').trim();
  const description = normalizeDescription(String(sticker?.description ?? ''));
  const imageUrl = String(sticker?.imageUrl ?? '').trim();
  if (!id || !description || !imageUrl) return null;
  const createdAt = Number(sticker?.createdAt) || Date.now();
  const sourceType = ['url', 'local-image', 'text-file', 'doc-file', 'json-file', 'manual'].includes(String(sticker?.sourceType))
    ? sticker?.sourceType as StickerSourceType
    : 'manual';
  const normalizedGroupIds = [...new Set(
    Array.isArray(sticker?.groupIds)
      ? sticker.groupIds.map((item) => String(item).trim()).filter(Boolean)
      : []
  )];
  return {
    id,
    description,
    imageUrl,
    ...(String(sticker?.cachedImageUrl ?? '').trim() ? { cachedImageUrl: String(sticker?.cachedImageUrl ?? '').trim() } : {}),
    ...(Number(sticker?.cachedImageUpdatedAt) > 0 ? { cachedImageUpdatedAt: Number(sticker?.cachedImageUpdatedAt) } : {}),
    groupIds: normalizedGroupIds.length ? normalizedGroupIds : [fallbackGroupId].filter(Boolean),
    sourceType,
    ...(Number(sticker?.lastUsedAt) > 0 ? { lastUsedAt: Number(sticker?.lastUsedAt) } : {}),
    createdAt,
    updatedAt: Number(sticker?.updatedAt) || createdAt
  };
}
