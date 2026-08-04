import { Inflate, ZipDeflate, ZipPassThrough, inflateSync, strFromU8, strToU8, Zip } from 'fflate';
import { Capacitor } from '@capacitor/core';
import { createNativeBackupArchiveWriter, isNativeBackupSaveAvailable, isNativeBackupStreamAvailable, saveNativeBackupArchive, type NativeBackupSaveResult } from '@/services/nativeBackup';
import type { AppSettings, AppSnapshot, CharacterProfile, ChatImageAttachment, ChatImageCandidate, ChatMessage, ChatMessageQuote, ChatVoiceAttachment, FavoriteMessageRecord, GeneratedImageRecord, Sticker, VoomImageCandidate, VoomPost, WorldBookEntry } from '@/types/domain';
import { isStoredLinkMediaUrl, resolveLocalMediaBlob, storeLocalMediaBlobWithId } from '@/utils/mediaStorage';
import { canUseBackupTemporaryFiles, createBackupTemporaryFileWriter, type BackupTemporaryFile } from '@/utils/backupTemporaryFile';

export interface LinkBackupFile {
  app: 'LINK';
  backupVersion: 1;
  exportedAt: number;
  omittedLocalMedia?: number;
  snapshot: AppSnapshot;
}

export interface LinkBackupArchiveMedia {
  id: string;
  path: string;
  source: string;
  blob: Blob;
}

export interface LinkBackupArchive {
  backup: LinkBackupFile;
  media: LinkBackupArchiveMedia[];
}

interface LinkBackupArchiveManifest {
  app: 'LINK';
  backupVersion: 2;
  archive: 'zip-media-v1';
  exportedAt: number;
  omittedLocalMedia?: number;
  snapshot: AppSnapshot;
  media: Array<{
    id: string;
    path: string;
    mimeType: string;
    byteLength: number;
  }>;
}

interface BackupZipEntry {
  name: string;
  compression: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export interface LinkBackupChunkManifest {
  app: 'LINK';
  backupVersion: 1;
  chunked: true;
  exportedAt: number;
  encoding: 'base64-bytes';
  originalByteLength: number;
  chunkSize: number;
  chunks: Array<{
    index: number;
    path: string;
    byteLength: number;
  }>;
}

interface BackupWritableFileStream {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}

interface BackupArchiveWriter {
  write(chunk: Uint8Array): Promise<void>;
  close(): Promise<unknown>;
  abort(): Promise<void>;
}

export interface PreparedBackupDestination {
  name: string;
  createWritable(): Promise<BackupWritableFileStream>;
}

export interface BackupArchiveSaveResult {
  method: 'native' | 'native-share' | 'file-system' | 'browser-download';
  fileName: string;
  location: string;
}

export type BackupArchiveProgress = (label: string, percent: number) => void | Promise<void>;

const backupArchiveJsonPath = 'link-backup.json';
const backupArchiveMediaPrefix = 'link-backup-media://';
const backupArchiveMediaDirectory = 'media';
const backupArchiveTextChunkCharacters = 256 * 1024;
const backupArchiveBinaryChunkBytes = 512 * 1024;
const browserMemoryArchiveLimitBytes = 64 * 1024 * 1024;
const backupZipEndRecordBytes = 22;
const backupZipMaximumCommentBytes = 0xffff;

export const linkBackupSnapshotArrayKeys: Array<keyof Omit<AppSnapshot, 'settings'>> = [
  'users',
  'characters',
  'conversations',
  'messages',
  'voomPosts',
  'profileThemes',
  'profileHomepages',
  'smallTheaterTopics',
  'smallTheaters',
  'fanficBooks',
  'fanficChapters',
  'fanficComments',
  'fanficTopics',
  'fanficGenerationJobs',
  'musicFavoriteTracks',
  'musicCommentThreads',
  'worldBooks',
  'stickerGroups',
  'stickers',
  'conversationSettings',
  'memoryEpisodes',
  'memoryEntities',
  'memoryAssertions',
  'memoryEdges',
  'memoryThemes',
  'memoryStateSnapshots',
  'memoryEmbeddings',
  'generatedImages',
  'favorites',
  'walletAccounts',
  'walletTransactions',
  'shopStorefronts',
  'shopProducts',
  'shopCartItems',
  'shopWishlistItems',
  'shopOrders',
  'shopMoments'
];
const largeInlineAssetLength = 1024 * 1024;
export const stickerBackupPlaceholder = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isInlineMediaUrl(value: string) {
  return /^data:(?:image|audio)\//i.test(value.trim());
}

function isStoredLocalMediaUrl(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) return false;
  try {
    return new URL(normalizedValue, 'https://link.local').pathname.includes('/__link-media/');
  } catch {
    return normalizedValue.includes('/__link-media/');
  }
}

function stripStickerImageCache<T extends { imageUrl: string; cachedImageUrl?: string }>(sticker: T): T {
  const { cachedImageUrl: _cachedImageUrl, ...restSticker } = sticker;
  return {
    ...restSticker,
    imageUrl: isInlineMediaUrl(sticker.imageUrl) ? stickerBackupPlaceholder : stripLargeInlineAsset(sticker.imageUrl, stickerBackupPlaceholder)
  } as T;
}

function stripLargeInlineAsset(value: string | undefined, fallback = '') {
  const normalizedValue = String(value ?? '').trim();
  if (isStoredLocalMediaUrl(normalizedValue)) return fallback;
  if (!isInlineMediaUrl(normalizedValue)) return normalizedValue;
  return normalizedValue.length > largeInlineAssetLength ? fallback : normalizedValue;
}

function sanitizeImageCandidatesForBackup<T extends ChatImageCandidate | VoomImageCandidate>(candidates: T[] | undefined) {
  return candidates?.filter((candidate) => candidate.image.trim());
}

function sanitizeChatImageForBackup(image: ChatImageAttachment): ChatImageAttachment {
  return {
    ...image,
    candidates: sanitizeImageCandidatesForBackup(image.candidates)
  };
}

function sanitizeVoiceForBackup(voice: ChatVoiceAttachment): ChatVoiceAttachment {
  return {
    ...voice,
    audioUrl: stripLargeInlineAsset(voice.audioUrl)
  };
}

function sanitizeQuoteForBackup(quote: ChatMessageQuote): ChatMessageQuote {
  return {
    ...quote,
    sticker: quote.sticker ? stripStickerImageCache(quote.sticker) : undefined,
    image: quote.image ? sanitizeChatImageForBackup(quote.image) : undefined,
    voice: quote.voice ? sanitizeVoiceForBackup(quote.voice) : undefined
  };
}

function sanitizeMessageForBackup(message: ChatMessage): ChatMessage {
  return {
    ...message,
    sticker: message.sticker ? stripStickerImageCache(message.sticker) : undefined,
    image: message.image ? sanitizeChatImageForBackup(message.image) : undefined,
    voice: message.voice ? sanitizeVoiceForBackup(message.voice) : undefined,
    quote: message.quote ? sanitizeQuoteForBackup(message.quote) : undefined
  };
}

function sanitizeStickerForBackup(sticker: Sticker): Sticker {
  if (sticker.sourceType === 'local-image' && sticker.cachedImageUrl) {
    return {
      ...sticker,
      imageUrl: stickerBackupPlaceholder
    };
  }
  const { cachedImageUpdatedAt: _cachedImageUpdatedAt, ...safeSticker } = stripStickerImageCache(sticker);
  return safeSticker;
}

function sanitizeVoomPostForBackup(post: VoomPost): VoomPost {
  return {
    ...post,
    authorAvatar: stripLargeInlineAsset(post.authorAvatar),
    imageCandidates: sanitizeImageCandidatesForBackup(post.imageCandidates)
  };
}

function sanitizeCharacterForBackup(character: CharacterProfile): CharacterProfile {
  return {
    ...character,
    imageProfile: character.imageProfile
      ? {
          ...character.imageProfile,
          referenceImage: stripLargeInlineAsset(character.imageProfile.referenceImage),
          photos: character.imageProfile.photos
        }
      : character.imageProfile
  };
}

function sanitizeWorldBookForBackup(entry: WorldBookEntry): WorldBookEntry {
  return {
    ...entry,
    coverImage: stripLargeInlineAsset(entry.coverImage)
  };
}

function sanitizeGeneratedImageForBackup(record: GeneratedImageRecord): GeneratedImageRecord {
  return record;
}

function sanitizeFavoriteForBackup(record: FavoriteMessageRecord): FavoriteMessageRecord {
  return {
    ...record,
    authorAvatar: stripLargeInlineAsset(record.authorAvatar),
    characterAvatar: stripLargeInlineAsset(record.characterAvatar),
    userAvatar: stripLargeInlineAsset(record.userAvatar),
    message: sanitizeMessageForBackup(record.message)
  };
}

function sanitizeSettingsForBackup(settings: AppSettings): AppSettings {
  return {
    ...settings,
    githubBackup: {
      ...settings.githubBackup,
      enabled: false,
      token: '',
      lastBackupStatus: 'idle',
      lastBackupError: '',
      progress: {
        phase: 'idle',
        label: '',
        percent: 0,
        updatedAt: 0
      }
    },
    cloudBackup: {
      ...settings.cloudBackup,
      enabled: false,
      accessToken: '',
      refreshToken: '',
      tokenExpiresAt: 0,
      workerToken: '',
      recoveryKey: '',
      lastBackupStatus: 'idle',
      lastBackupError: '',
      progress: {
        phase: 'idle',
        label: '',
        percent: 0,
        updatedAt: 0
      }
    },
    imageOpenAi: {
      ...settings.imageOpenAi,
      lastImageUrl: ''
    },
    imageNovelAi: {
      ...settings.imageNovelAi,
      lastImageUrl: ''
    },
    imagePollinations: {
      ...settings.imagePollinations,
      lastImageUrl: '',
      referenceImage: stripLargeInlineAsset(settings.imagePollinations.referenceImage)
    }
  };
}

function sanitizeSnapshotForBackup(snapshot: AppSnapshot): AppSnapshot {
  return {
    ...snapshot,
    characters: snapshot.characters.map((character) => sanitizeCharacterForBackup(character)),
    messages: snapshot.messages.map((message) => sanitizeMessageForBackup(message)),
    voomPosts: snapshot.voomPosts.map((post) => sanitizeVoomPostForBackup(post)),
    worldBooks: snapshot.worldBooks.map((entry) => sanitizeWorldBookForBackup(entry)),
    stickers: snapshot.stickers.map((sticker) => sanitizeStickerForBackup(sticker)),
    generatedImages: snapshot.generatedImages
      .map((record) => sanitizeGeneratedImageForBackup(record))
      .filter((record) => record.imageUrl),
    memoryEmbeddings: [],
    favorites: (snapshot.favorites ?? []).map((record) => sanitizeFavoriteForBackup(record)),
    settings: sanitizeSettingsForBackup(snapshot.settings)
  };
}

function normalizeBackupSnapshot(value: unknown): AppSnapshot {
  if (!isRecord(value)) throw new Error('备份文件结构不正确。');

  const snapshot: Record<string, unknown> = {
    ...value,
    settings: isRecord(value.settings) ? value.settings : {}
  };

  for (const key of linkBackupSnapshotArrayKeys) {
    snapshot[key] = Array.isArray(value[key]) ? value[key] : [];
  }

  return snapshot as unknown as AppSnapshot;
}

function toLinkBackupFile(value: unknown): LinkBackupFile {
  if (isRecord(value) && isRecord(value.snapshot)) {
    return {
      app: value.app === 'LINK' ? 'LINK' : 'LINK',
      backupVersion: value.backupVersion === 1 ? 1 : 1,
      exportedAt: Math.max(0, Number(value.exportedAt ?? 0) || 0),
      omittedLocalMedia: Math.max(0, Math.floor(Number(value.omittedLocalMedia ?? 0) || 0)) || undefined,
      snapshot: normalizeBackupSnapshot(value.snapshot)
    };
  }

  return {
    app: 'LINK',
    backupVersion: 1,
    exportedAt: 0,
    snapshot: normalizeBackupSnapshot(value)
  };
}

export function isLinkBackupChunkManifest(value: unknown): value is LinkBackupChunkManifest {
  return Boolean(
    isRecord(value)
    && value.app === 'LINK'
    && value.backupVersion === 1
    && value.chunked === true
    && value.encoding === 'base64-bytes'
    && Array.isArray(value.chunks)
  );
}

export function createLinkBackupFile(snapshot: AppSnapshot, omittedLocalMedia = 0): LinkBackupFile {
  return {
    app: 'LINK',
    backupVersion: 1,
    exportedAt: Date.now(),
    ...(omittedLocalMedia > 0 ? { omittedLocalMedia } : {}),
    snapshot: sanitizeSnapshotForBackup(snapshot)
  };
}

export function stringifyLinkBackupFile(backup: LinkBackupFile) {
  return JSON.stringify(backup);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || value instanceof Date || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mediaExtension(mimeType: string) {
  const normalized = mimeType.toLocaleLowerCase();
  if (normalized.includes('svg')) return 'svg';
  if (normalized.includes('png')) return 'png';
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('gif')) return 'gif';
  if (normalized.includes('avif')) return 'avif';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3';
  if (normalized.includes('wav')) return 'wav';
  if (normalized.includes('webm')) return 'webm';
  if (normalized.includes('ogg') || normalized.includes('opus')) return 'ogg';
  if (normalized.includes('aac')) return 'aac';
  if (normalized.includes('flac')) return 'flac';
  if (normalized.includes('woff2')) return 'woff2';
  if (normalized.includes('woff')) return 'woff';
  if (normalized.includes('opentype') || normalized.includes('otf')) return 'otf';
  if (normalized.includes('truetype') || normalized.includes('ttf')) return 'ttf';
  return 'bin';
}

function createArchiveMediaReference(id: string) {
  return `${backupArchiveMediaPrefix}${id}`;
}

function readArchiveMediaReference(value: string) {
  const id = value.startsWith(backupArchiveMediaPrefix) ? value.slice(backupArchiveMediaPrefix.length).trim() : '';
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : '';
}

async function replaceStoredMediaReferencesForArchive<T>(value: T, mediaBySource: Map<string, Promise<LinkBackupArchiveMedia | null>>, missingMedia: Set<string>, onMediaResolved?: (completed: number) => void | Promise<void>): Promise<T> {
  if (typeof value === 'string') {
    const source = value.trim();
    if (!isStoredLinkMediaUrl(source)) return value;
    let media = mediaBySource.get(source);
    if (!media) {
      const mediaId = `m${String(mediaBySource.size + 1).padStart(6, '0')}`;
      media = resolveLocalMediaBlob(source).then(async (blob) => {
        if (!blob) {
          missingMedia.add(source);
          return null;
        }
        const extension = mediaExtension(blob.type);
        return {
          id: mediaId,
          path: `${backupArchiveMediaDirectory}/${mediaId}.${extension}`,
          source,
          blob
        };
      }).finally(async () => {
        await onMediaResolved?.(mediaBySource.size);
      });
      mediaBySource.set(source, media);
    }
    const resolved = await media;
    return (resolved ? createArchiveMediaReference(resolved.id) : '') as T;
  }

  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;

  if (Array.isArray(value)) {
    let changed = false;
    const nextEntries: unknown[] = [];
    for (const entry of value) {
      const nextEntry = await replaceStoredMediaReferencesForArchive(entry, mediaBySource, missingMedia, onMediaResolved);
      changed ||= nextEntry !== entry;
      nextEntries.push(nextEntry);
    }
    return (changed ? nextEntries : value) as T;
  }

  if (!isPlainRecord(value)) return value;
  let changed = false;
  const nextValue: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const nextEntry = await replaceStoredMediaReferencesForArchive(entry, mediaBySource, missingMedia, onMediaResolved);
    changed ||= nextEntry !== entry;
    nextValue[key] = nextEntry;
  }
  return (changed ? nextValue : value) as T;
}

export async function createLinkBackupArchive(snapshot: AppSnapshot, options: { onMediaResolved?: (completed: number) => void | Promise<void> } = {}): Promise<LinkBackupArchive> {
  const mediaBySource = new Map<string, Promise<LinkBackupArchiveMedia | null>>();
  const missingMedia = new Set<string>();
  const snapshotWithMediaReferences = await replaceStoredMediaReferencesForArchive(snapshot, mediaBySource, missingMedia, options.onMediaResolved);
  const media = (await Promise.all(mediaBySource.values())).filter((entry): entry is LinkBackupArchiveMedia => Boolean(entry));

  return {
    backup: createLinkBackupFile(snapshotWithMediaReferences, missingMedia.size),
    media
  };
}

export function isLinkBackupArchive(value: LinkBackupFile | LinkBackupArchive): value is LinkBackupArchive {
  return 'backup' in value && Array.isArray(value.media);
}

function toLinkBackupArchive(value: LinkBackupFile | LinkBackupArchive): LinkBackupArchive {
  return isLinkBackupArchive(value) ? value : { backup: value, media: [] };
}

function createLinkBackupArchiveManifest(archive: LinkBackupArchive): LinkBackupArchiveManifest {
  return {
    app: 'LINK',
    backupVersion: 2,
    archive: 'zip-media-v1',
    exportedAt: archive.backup.exportedAt,
    ...(archive.backup.omittedLocalMedia ? { omittedLocalMedia: archive.backup.omittedLocalMedia } : {}),
    snapshot: archive.backup.snapshot,
    media: archive.media.map((media) => ({
      id: media.id,
      path: media.path,
      mimeType: media.blob.type || 'application/octet-stream',
      byteLength: media.blob.size
    }))
  };
}

function nextTextChunkEnd(text: string, offset: number, chunkCharacters: number) {
  let end = Math.min(text.length, offset + chunkCharacters);
  if (end < text.length) {
    const lastCodeUnit = text.charCodeAt(end - 1);
    const nextCodeUnit = text.charCodeAt(end);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff && nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) end -= 1;
  }
  return end;
}

function yieldBackupWork() {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

async function streamLinkBackupArchive(archive: LinkBackupArchive, writer: Pick<BackupArchiveWriter, 'write'>, onProgress?: (percent: number) => void | Promise<void>) {
  const manifest = createLinkBackupArchiveManifest(archive);
  const json = JSON.stringify(manifest);
  const totalInputBytes = Math.max(1, new TextEncoder().encode(json).byteLength + archive.media.reduce((total, media) => total + media.blob.size, 0));
  let consumedInputBytes = 0;
  let writeChain = Promise.resolve();
  let zipError: Error | null = null;
  const enqueueChunk = (chunk: Uint8Array) => {
    if (!chunk.byteLength) return;
    const stableChunk = chunk.slice();
    writeChain = writeChain.then(async () => {
      await writer.write(stableChunk);
    });
  };
  const flush = async () => {
    await writeChain;
    if (zipError) throw zipError;
  };
  const reportProgress = async () => {
    await onProgress?.(Math.min(100, Math.round(consumedInputBytes / totalInputBytes * 100)));
  };
  const zip = new Zip((error, chunk) => {
    if (error) {
      zipError = error;
      return;
    }
    enqueueChunk(chunk);
  });

  try {
    const jsonEntry = new ZipDeflate(backupArchiveJsonPath, { level: 6 });
    jsonEntry.mtime = new Date(archive.backup.exportedAt);
    zip.add(jsonEntry);
    if (!json.length) {
      jsonEntry.push(new Uint8Array(), true);
      await flush();
    } else {
      for (let offset = 0; offset < json.length;) {
        const end = nextTextChunkEnd(json, offset, backupArchiveTextChunkCharacters);
        jsonEntry.push(strToU8(json.slice(offset, end)), end === json.length);
        consumedInputBytes += new TextEncoder().encode(json.slice(offset, end)).byteLength;
        offset = end;
        await flush();
        await reportProgress();
        await yieldBackupWork();
      }
    }

    for (const media of archive.media) {
      const mediaEntry = new ZipPassThrough(media.path);
      mediaEntry.mtime = new Date(archive.backup.exportedAt);
      zip.add(mediaEntry);
      for (let offset = 0; offset < media.blob.size;) {
        const end = Math.min(media.blob.size, offset + backupArchiveBinaryChunkBytes);
        const chunk = new Uint8Array(await media.blob.slice(offset, end).arrayBuffer());
        mediaEntry.push(chunk, end === media.blob.size);
        consumedInputBytes += chunk.byteLength;
        offset = end;
        await flush();
        await reportProgress();
        await yieldBackupWork();
      }
      if (!media.blob.size) {
        mediaEntry.push(new Uint8Array(), true);
        await flush();
      }
    }

    zip.end();
    await flush();
    await onProgress?.(100);
  } finally {
    zip.terminate();
  }
}

async function writeLinkBackupArchive(archive: LinkBackupArchive, writer: BackupArchiveWriter, onProgress?: (percent: number) => void | Promise<void>) {
  try {
    await streamLinkBackupArchive(archive, writer, onProgress);
    return await writer.close();
  } catch (error) {
    await writer.abort().catch(() => undefined);
    throw error;
  }
}

export async function createLinkBackupArchiveTemporaryFile(value: LinkBackupFile | LinkBackupArchive, filename = 'link-backup.zip', onProgress?: (percent: number) => void | Promise<void>): Promise<BackupTemporaryFile> {
  const temporaryWriter = await createBackupTemporaryFileWriter(filename);
  const archive = toLinkBackupArchive(value);
  const result = await writeLinkBackupArchive(archive, {
    write: async (chunk) => await temporaryWriter.write(new Blob([chunk], { type: 'application/zip' })),
    close: async () => await temporaryWriter.close(),
    abort: async () => await temporaryWriter.abort()
  }, onProgress);
  return result as BackupTemporaryFile;
}

export async function createLinkBackupArchiveBlob(value: LinkBackupFile | LinkBackupArchive, onProgress?: (percent: number) => void | Promise<void>) {
  const chunks: ArrayBuffer[] = [];
  const archive = toLinkBackupArchive(value);
  await writeLinkBackupArchive(archive, {
    async write(chunk) {
      chunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
    },
    async close() {},
    async abort() {
      chunks.splice(0);
    }
  }, onProgress);
  return new Blob(chunks, { type: 'application/zip' });
}

function isLinkBackupArchiveManifest(value: unknown): value is LinkBackupArchiveManifest {
  return Boolean(
    isRecord(value)
    && value.app === 'LINK'
    && value.backupVersion === 2
    && value.archive === 'zip-media-v1'
    && isRecord(value.snapshot)
    && Array.isArray(value.media)
  );
}

async function restoreArchiveMediaReferences<T>(value: T, mediaUrls: Map<string, string>): Promise<T> {
  if (typeof value === 'string') {
    const id = readArchiveMediaReference(value);
    return (id && mediaUrls.get(id) ? mediaUrls.get(id)! : value) as T;
  }
  if (!value || typeof value !== 'object' || value instanceof Date || value instanceof Blob || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const nextEntries: unknown[] = [];
    for (const entry of value) {
      const nextEntry = await restoreArchiveMediaReferences(entry, mediaUrls);
      changed ||= nextEntry !== entry;
      nextEntries.push(nextEntry);
    }
    return (changed ? nextEntries : value) as T;
  }
  if (!isPlainRecord(value)) return value;
  let changed = false;
  const nextValue: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const nextEntry = await restoreArchiveMediaReferences(entry, mediaUrls);
    changed ||= nextEntry !== entry;
    nextValue[key] = nextEntry;
  }
  return (changed ? nextValue : value) as T;
}

function readBackupZipUint16(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readBackupZipUint32(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function hasBackupZipSignature(bytes: Uint8Array, offset: number, signature: number) {
  return offset >= 0 && offset + 4 <= bytes.byteLength && readBackupZipUint32(bytes, offset) === signature;
}

async function readBackupZipDirectory(file: Blob) {
  const tailLength = Math.min(file.size, backupZipEndRecordBytes + backupZipMaximumCommentBytes);
  const tailOffset = file.size - tailLength;
  const tail = new Uint8Array(await file.slice(tailOffset).arrayBuffer());
  let endRecordOffset = -1;
  for (let offset = tail.byteLength - backupZipEndRecordBytes; offset >= 0; offset -= 1) {
    if (!hasBackupZipSignature(tail, offset, 0x06054b50)) continue;
    const commentBytes = readBackupZipUint16(tail, offset + 20);
    if (offset + backupZipEndRecordBytes + commentBytes !== tail.byteLength) continue;
    endRecordOffset = offset;
    break;
  }
  if (endRecordOffset < 0) throw new Error('备份压缩包无法读取。');

  const diskNumber = readBackupZipUint16(tail, endRecordOffset + 4);
  const centralDirectoryDisk = readBackupZipUint16(tail, endRecordOffset + 6);
  const entryCountOnDisk = readBackupZipUint16(tail, endRecordOffset + 8);
  const entryCount = readBackupZipUint16(tail, endRecordOffset + 10);
  const centralDirectorySize = readBackupZipUint32(tail, endRecordOffset + 12);
  const centralDirectoryOffset = readBackupZipUint32(tail, endRecordOffset + 16);
  if (diskNumber || centralDirectoryDisk || entryCountOnDisk !== entryCount) throw new Error('暂不支持分卷备份压缩包。');
  if (entryCount === 0xffff || centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) throw new Error('暂不支持 ZIP64 备份压缩包。');
  if (centralDirectoryOffset + centralDirectorySize > tailOffset + endRecordOffset) throw new Error('备份压缩包目录不完整。');

  const directory = new Uint8Array(await file.slice(centralDirectoryOffset, centralDirectoryOffset + centralDirectorySize).arrayBuffer());
  const entries = new Map<string, BackupZipEntry>();
  let offset = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (!hasBackupZipSignature(directory, offset, 0x02014b50) || offset + 46 > directory.byteLength) throw new Error('备份压缩包目录不完整。');
    const flags = readBackupZipUint16(directory, offset + 8);
    const compression = readBackupZipUint16(directory, offset + 10);
    const compressedSize = readBackupZipUint32(directory, offset + 20);
    const uncompressedSize = readBackupZipUint32(directory, offset + 24);
    const fileNameBytes = readBackupZipUint16(directory, offset + 28);
    const extraBytes = readBackupZipUint16(directory, offset + 30);
    const commentBytes = readBackupZipUint16(directory, offset + 32);
    const localHeaderOffset = readBackupZipUint32(directory, offset + 42);
    const nextOffset = offset + 46 + fileNameBytes + extraBytes + commentBytes;
    if (nextOffset > directory.byteLength) throw new Error('备份压缩包目录不完整。');
    if (flags & 1) throw new Error('暂不支持加密 ZIP 备份压缩包。');
    const name = strFromU8(directory.subarray(offset + 46, offset + 46 + fileNameBytes), !(flags & 0x0800));
    if (!name || entries.has(name)) throw new Error('备份压缩包目录结构不正确。');
    entries.set(name, { name, compression, compressedSize, uncompressedSize, localHeaderOffset });
    offset = nextOffset;
  }
  if (offset !== directory.byteLength) throw new Error('备份压缩包目录不完整。');
  return entries;
}

async function backupZipEntryDataOffset(file: Blob, entry: BackupZipEntry) {
  const header = new Uint8Array(await file.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30).arrayBuffer());
  if (header.byteLength !== 30 || !hasBackupZipSignature(header, 0, 0x04034b50)) throw new Error(`备份压缩包条目不完整：${entry.name}`);
  const fileNameBytes = readBackupZipUint16(header, 26);
  const extraBytes = readBackupZipUint16(header, 28);
  const dataOffset = entry.localHeaderOffset + 30 + fileNameBytes + extraBytes;
  if (dataOffset + entry.compressedSize > file.size) throw new Error(`备份压缩包条目不完整：${entry.name}`);
  return dataOffset;
}

async function readBackupZipEntryBytes(file: Blob, entry: BackupZipEntry) {
  const dataOffset = await backupZipEntryDataOffset(file, entry);
  const compressed = new Uint8Array(await file.slice(dataOffset, dataOffset + entry.compressedSize).arrayBuffer());
  if (compressed.byteLength !== entry.compressedSize) throw new Error(`备份压缩包条目不完整：${entry.name}`);
  const bytes = entry.compression === 0
    ? compressed
    : entry.compression === 8
      ? inflateSync(compressed)
      : null;
  if (!bytes) throw new Error(`备份压缩包使用了不支持的压缩方式：${entry.name}`);
  if (bytes.byteLength !== entry.uncompressedSize) throw new Error(`备份压缩包条目不完整：${entry.name}`);
  return bytes;
}

async function extractBackupZipEntry(file: Blob, entry: BackupZipEntry) {
  const dataOffset = await backupZipEntryDataOffset(file, entry);
  const writer = await createBackupTemporaryFileWriter(entry.name);
  let outputBytes = 0;
  let writeChain = Promise.resolve();
  try {
    if (entry.compression === 0) {
      if (entry.compressedSize !== entry.uncompressedSize) throw new Error(`备份压缩包条目不完整：${entry.name}`);
      for (let offset = 0; offset < entry.compressedSize; offset += backupArchiveBinaryChunkBytes) {
        const end = Math.min(entry.compressedSize, offset + backupArchiveBinaryChunkBytes);
        const chunk = file.slice(dataOffset + offset, dataOffset + end);
        if (chunk.size !== end - offset) throw new Error(`备份压缩包条目不完整：${entry.name}`);
        await writer.write(chunk);
        outputBytes += chunk.size;
      }
    } else if (entry.compression === 8) {
      const inflater = new Inflate((chunk) => {
        const stableChunk = chunk.slice();
        outputBytes += stableChunk.byteLength;
        writeChain = writeChain.then(async () => {
          if (stableChunk.byteLength) await writer.write(new Blob([stableChunk], { type: 'application/octet-stream' }));
        });
      });
      for (let offset = 0; offset < entry.compressedSize; offset += backupArchiveBinaryChunkBytes) {
        const end = Math.min(entry.compressedSize, offset + backupArchiveBinaryChunkBytes);
        const chunk = new Uint8Array(await file.slice(dataOffset + offset, dataOffset + end).arrayBuffer());
        if (chunk.byteLength !== end - offset) throw new Error(`备份压缩包条目不完整：${entry.name}`);
        inflater.push(chunk, end === entry.compressedSize);
        await writeChain;
      }
      if (!entry.compressedSize) inflater.push(new Uint8Array(), true);
      await writeChain;
    } else {
      throw new Error(`备份压缩包使用了不支持的压缩方式：${entry.name}`);
    }

    if (outputBytes !== entry.uncompressedSize) throw new Error(`备份压缩包条目不完整：${entry.name}`);
    const temporaryFile = await writer.close();
    if (temporaryFile.file.size !== entry.uncompressedSize) {
      await temporaryFile.cleanup();
      throw new Error(`备份压缩包条目不完整：${entry.name}`);
    }
    return temporaryFile;
  } catch (error) {
    await writer.abort().catch(() => undefined);
    throw error;
  }
}

async function parseLinkBackupArchiveManifest(manifest: LinkBackupArchiveManifest, file: Blob, entries: Map<string, BackupZipEntry>): Promise<LinkBackupFile> {
  const mediaUrls = new Map<string, string>();
  const declaredIds = new Set<string>();
  const declaredPaths = new Set<string>();
  const declaredMedia = manifest.media.map((entry) => {
    const id = String(entry?.id ?? '').trim();
    const path = String(entry?.path ?? '').trim();
    const mimeType = String(entry?.mimeType ?? '').trim() || 'application/octet-stream';
    const expectedBytes = Math.max(0, Math.floor(Number(entry?.byteLength ?? 0) || 0));
    if (!/^[A-Za-z0-9_-]+$/.test(id) || !path.startsWith(`${backupArchiveMediaDirectory}/`) || path.includes('..') || declaredIds.has(id) || declaredPaths.has(path)) {
      throw new Error('备份媒体目录结构不正确。');
    }
    declaredIds.add(id);
    declaredPaths.add(path);
    const zipEntry = entries.get(path);
    if (!zipEntry || zipEntry.uncompressedSize !== expectedBytes) throw new Error(`备份媒体文件不完整：${path}`);
    return { id, path, mimeType, zipEntry };
  });

  for (const entry of declaredMedia) {
    const mediaFile = await extractBackupZipEntry(file, entry.zipEntry);
    try {
      const storedUrl = await storeLocalMediaBlobWithId(`backup-${manifest.exportedAt}-${entry.id}.${mediaExtension(entry.mimeType)}`, new Blob([mediaFile.file], { type: entry.mimeType }));
      if (!storedUrl) throw new Error(`无法恢复备份媒体文件：${entry.path}`);
      mediaUrls.set(entry.id, storedUrl);
    } finally {
      await mediaFile.cleanup();
    }
  }
  const snapshot = await restoreArchiveMediaReferences(normalizeBackupSnapshot(manifest.snapshot), mediaUrls);
  return {
    app: 'LINK',
    backupVersion: 1,
    exportedAt: Math.max(0, Number(manifest.exportedAt ?? 0) || 0),
    omittedLocalMedia: Math.max(0, Math.floor(Number(manifest.omittedLocalMedia ?? 0) || 0)) || undefined,
    snapshot
  };
}

async function parseLinkBackupZipBlob(file: Blob): Promise<LinkBackupFile> {
  const entries = await readBackupZipDirectory(file);
  const manifestEntry = entries.get(backupArchiveJsonPath) ?? [...entries.values()].find((entry) => /\.json$/i.test(entry.name));
  if (!manifestEntry) throw new Error('备份压缩包里没有 JSON 备份文件。');
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(await readBackupZipEntryBytes(file, manifestEntry)));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('备份文件不是有效 JSON。');
    throw error;
  }
  if (isLinkBackupArchiveManifest(parsed)) return await parseLinkBackupArchiveManifest(parsed, file, entries);
  return toLinkBackupFile(parsed);
}

export function parseLinkBackupFileText(text: string): LinkBackupFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('备份文件不是有效 JSON。');
  }

  return toLinkBackupFile(parsed);
}

export function parseLinkBackupText(text: string): AppSnapshot {
  return parseLinkBackupFileText(text).snapshot;
}

export async function parseLinkBackupBlob(file: Blob): Promise<LinkBackupFile> {
  const name = file instanceof File ? file.name.toLocaleLowerCase() : '';
  const prefix = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (name.endsWith('.zip') || prefix[0] === 0x50 && prefix[1] === 0x4b) return await parseLinkBackupZipBlob(file);
  return parseLinkBackupFileText(await file.text());
}

export function createBackupFilename(userId: string) {
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const safeUserId = userId.trim() || 'local';
  return `link-backup-${safeUserId}-${suffix}.json`;
}

export function createBackupArchiveFilename(userId: string) {
  return createBackupFilename(userId).replace(/\.json$/i, '.zip');
}

export function canPrepareBackupDestination() {
  return !Capacitor.isNativePlatform()
    && typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
}

export async function prepareBackupDestination(filename: string): Promise<PreparedBackupDestination | null> {
  const picker = (window as Window & {
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<PreparedBackupDestination>;
  }).showSaveFilePicker;
  if (!picker) return null;
  return await picker({
    suggestedName: filename,
    types: [{ description: 'BabyLink ZIP 备份', accept: { 'application/zip': ['.zip'] } }]
  });
}

async function downloadBlob(blob: Blob, filename: string, destination?: PreparedBackupDestination | null, cleanup?: () => Promise<void>): Promise<BackupArchiveSaveResult> {
  if (destination) {
    const writable = await destination.createWritable();
    await writable.write(blob);
    await writable.close();
    await cleanup?.();
    return { method: 'file-system', fileName: destination.name || filename, location: destination.name || filename };
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
    void cleanup?.();
  }, 60_000);
  return { method: 'browser-download', fileName: filename, location: `浏览器下载记录 / ${filename}` };
}

export function downloadLinkBackupFile(backup: LinkBackupFile, filename: string) {
  const blob = new Blob([stringifyLinkBackupFile(backup)], { type: 'application/json;charset=utf-8' });
  void downloadBlob(blob, filename);
}

export async function downloadLinkBackupArchive(
  value: LinkBackupFile | LinkBackupArchive,
  filename: string,
  options: { destination?: PreparedBackupDestination | null; onProgress?: BackupArchiveProgress } = {}
): Promise<BackupArchiveSaveResult> {
  const archive = toLinkBackupArchive(value);
  const reportArchiveProgress = async (percent: number) => {
    await options.onProgress?.('正在分块压缩 ZIP', 89 + percent * 0.07);
  };

  if (isNativeBackupStreamAvailable()) {
    const nativeWriter = await createNativeBackupArchiveWriter(filename);
    if (nativeWriter) {
      const result = await writeLinkBackupArchive(archive, nativeWriter, reportArchiveProgress) as NativeBackupSaveResult;
      if (!result.saved) throw new Error('系统没有确认备份文件已保存。');
      await options.onProgress?.('系统已确认备份写入', 100);
      return { method: 'native', fileName: result.fileName, location: result.location };
    }
  }

  if (options.destination) {
    const writable = await options.destination.createWritable();
    const result = await writeLinkBackupArchive(archive, {
      write: async (chunk) => await writable.write(new Blob([chunk], { type: 'application/zip' })),
      close: async () => {
        await writable.close();
        return { method: 'file-system', fileName: options.destination?.name || filename, location: options.destination?.name || filename } as BackupArchiveSaveResult;
      },
      abort: async () => await writable.close().catch(() => undefined)
    }, reportArchiveProgress) as BackupArchiveSaveResult;
    await options.onProgress?.('文件写入完成', 100);
    return result;
  }

  if (canUseBackupTemporaryFiles()) {
    const temporaryArchive = await createLinkBackupArchiveTemporaryFile(archive, filename, reportArchiveProgress);
    try {
      if (isNativeBackupSaveAvailable()) {
        const saved = await saveNativeBackupArchive(temporaryArchive.file, filename, async (writtenBytes, totalBytes) => {
          await options.onProgress?.('正在写入系统文件', 96 + writtenBytes / Math.max(1, totalBytes) * 3);
        });
        if (!saved?.saved) throw new Error('系统没有确认备份文件已保存。');
        await options.onProgress?.(saved.requiresUserSave ? '已打开系统保存或分享面板' : '系统已确认备份写入', 100);
        return {
          method: saved.requiresUserSave ? 'native-share' : 'native',
          fileName: saved.fileName,
          location: saved.location
        };
      }
      await options.onProgress?.('正在交给浏览器下载', 98);
      return await downloadBlob(temporaryArchive.file, filename, null, temporaryArchive.cleanup);
    } finally {
      if (isNativeBackupSaveAvailable()) await temporaryArchive.cleanup();
    }
  }

  const estimatedBytes = archive.media.reduce((total, media) => total + media.blob.size, 0) + new Blob([JSON.stringify(createLinkBackupArchiveManifest(archive))]).size;
  if (estimatedBytes > browserMemoryArchiveLimitBytes) {
    throw new Error('当前浏览器不支持大文件流式保存。请使用最新版 Chrome、安装 BabyLink App，或选择系统文件保存位置后重试。');
  }
  const blob = await createLinkBackupArchiveBlob(archive, reportArchiveProgress);
  if (isNativeBackupSaveAvailable()) {
    const saved = await saveNativeBackupArchive(blob, filename, async (writtenBytes, totalBytes) => {
      await options.onProgress?.('正在写入系统文件', 96 + writtenBytes / Math.max(1, totalBytes) * 3);
    });
    if (!saved?.saved) throw new Error('系统没有确认备份文件已保存。');
    return { method: saved.requiresUserSave ? 'native-share' : 'native', fileName: saved.fileName, location: saved.location };
  }
  await options.onProgress?.('正在交给浏览器下载', 98);
  const result = await downloadBlob(blob, filename);
  await options.onProgress?.('已创建浏览器下载任务', 100);
  return result;
}