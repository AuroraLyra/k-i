import { AsyncZipDeflate, strFromU8, strToU8, unzip, Zip } from 'fflate';
import { isNativeBackupSaveAvailable, saveNativeBackupArchive } from '@/services/nativeBackup';
import type { AppSettings, AppSnapshot, CharacterProfile, ChatImageAttachment, ChatImageCandidate, ChatMessage, ChatMessageQuote, ChatVoiceAttachment, FavoriteMessageRecord, GeneratedImageRecord, Sticker, VoomImageCandidate, VoomPost, WorldBookEntry } from '@/types/domain';

export interface LinkBackupFile {
  app: 'LINK';
  backupVersion: 1;
  exportedAt: number;
  omittedLocalMedia?: number;
  snapshot: AppSnapshot;
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

export interface PreparedBackupDestination {
  name: string;
  createWritable(): Promise<BackupWritableFileStream>;
}

export interface BackupArchiveSaveResult {
  method: 'native' | 'file-system' | 'browser-download';
  fileName: string;
  location: string;
}

export type BackupArchiveProgress = (label: string, percent: number) => void | Promise<void>;

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

function nextTextChunkEnd(text: string, offset: number, chunkCharacters: number) {
  let end = Math.min(text.length, offset + chunkCharacters);
  if (end < text.length) {
    const lastCodeUnit = text.charCodeAt(end - 1);
    const nextCodeUnit = text.charCodeAt(end);
    if (lastCodeUnit >= 0xd800 && lastCodeUnit <= 0xdbff && nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) end -= 1;
  }
  return end;
}

export async function createLinkBackupArchiveBlob(backup: LinkBackupFile, onProgress?: (percent: number) => void | Promise<void>) {
  await onProgress?.(2);
  const json = stringifyLinkBackupFile(backup);
  const outputChunks: ArrayBuffer[] = [];
  let resolveCompression!: () => void;
  let rejectCompression!: (error: Error) => void;
  const compressionCompleted = new Promise<void>((resolve, reject) => {
    resolveCompression = resolve;
    rejectCompression = reject;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      rejectCompression(error);
      return;
    }
    outputChunks.push(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
    if (final) resolveCompression();
  });
  const entry = new AsyncZipDeflate('link-backup.json', { level: 6 });
  entry.mtime = new Date(backup.exportedAt);
  zip.add(entry);

  const chunkCharacters = 256 * 1024;
  for (let offset = 0; offset < json.length;) {
    const end = nextTextChunkEnd(json, offset, chunkCharacters);
    entry.push(strToU8(json.slice(offset, end)), end === json.length);
    offset = end;
    await onProgress?.(8 + offset / Math.max(1, json.length) * 72);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  if (!json.length) entry.push(new Uint8Array(), true);
  zip.end();
  await onProgress?.(85);
  await compressionCompleted;
  zip.terminate();
  await onProgress?.(100);
  return new Blob(outputChunks, { type: 'application/zip' });
}

async function readBackupJsonFromZip(bytes: Uint8Array) {
  const files = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(bytes, {
      filter: (file) => /(?:^|\/)link-backup\.json$/i.test(file.name) || /\.json$/i.test(file.name)
    }, (error, result) => {
      if (error) reject(new Error('备份压缩包无法读取。'));
      else resolve(result);
    });
  });
  const fileName = Object.keys(files).find((name) => /(?:^|\/)link-backup\.json$/i.test(name))
    ?? Object.keys(files).find((name) => /\.json$/i.test(name));
  if (!fileName) throw new Error('备份压缩包里没有 JSON 备份文件。');
  return strFromU8(files[fileName]);
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
  const bytes = new Uint8Array(await file.arrayBuffer());
  const text = name.endsWith('.zip') || bytes[0] === 0x50 && bytes[1] === 0x4b
    ? await readBackupJsonFromZip(bytes)
    : strFromU8(bytes);
  return parseLinkBackupFileText(text);
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
  return typeof (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function';
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

async function downloadBlob(blob: Blob, filename: string, destination?: PreparedBackupDestination | null): Promise<BackupArchiveSaveResult> {
  if (destination) {
    const writable = await destination.createWritable();
    await writable.write(blob);
    await writable.close();
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
  }, 60_000);
  return { method: 'browser-download', fileName: filename, location: `浏览器下载记录 / ${filename}` };
}

export function downloadLinkBackupFile(backup: LinkBackupFile, filename: string) {
  const blob = new Blob([stringifyLinkBackupFile(backup)], { type: 'application/json;charset=utf-8' });
  void downloadBlob(blob, filename);
}

export async function downloadLinkBackupArchive(
  backup: LinkBackupFile,
  filename: string,
  options: { destination?: PreparedBackupDestination | null; onProgress?: BackupArchiveProgress } = {}
): Promise<BackupArchiveSaveResult> {
  const archive = await createLinkBackupArchiveBlob(backup, async (percent) => {
    await options.onProgress?.('正在分块压缩 ZIP', 89 + percent * 0.07);
  });
  if (isNativeBackupSaveAvailable()) {
    const result = await saveNativeBackupArchive(archive, filename, async (writtenBytes, totalBytes) => {
      await options.onProgress?.('正在写入系统文件', 96 + writtenBytes / Math.max(1, totalBytes) * 3);
    });
    if (!result?.saved) throw new Error('系统没有确认备份文件已保存。');
    await options.onProgress?.('系统已确认备份写入', 100);
    return { method: 'native', fileName: result.fileName, location: result.location };
  }
  await options.onProgress?.(options.destination ? '正在写入所选文件' : '正在交给浏览器下载', 98);
  const result = await downloadBlob(archive, filename, options.destination);
  await options.onProgress?.(result.method === 'file-system' ? '文件写入完成' : '已创建浏览器下载任务', 100);
  return result;
}