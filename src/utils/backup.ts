import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
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

function cloneSnapshot(snapshot: AppSnapshot): AppSnapshot {
  if (typeof structuredClone === 'function') return structuredClone(snapshot) as AppSnapshot;
  return JSON.parse(JSON.stringify(snapshot)) as AppSnapshot;
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
  const safeSnapshot = cloneSnapshot(snapshot);
  safeSnapshot.characters = safeSnapshot.characters.map((character) => sanitizeCharacterForBackup(character));
  safeSnapshot.messages = safeSnapshot.messages.map((message) => sanitizeMessageForBackup(message));
  safeSnapshot.voomPosts = safeSnapshot.voomPosts.map((post) => sanitizeVoomPostForBackup(post));
  safeSnapshot.worldBooks = safeSnapshot.worldBooks.map((entry) => sanitizeWorldBookForBackup(entry));
  safeSnapshot.stickers = safeSnapshot.stickers.map((sticker) => sanitizeStickerForBackup(sticker));
  safeSnapshot.generatedImages = safeSnapshot.generatedImages
    .map((record) => sanitizeGeneratedImageForBackup(record))
    .filter((record) => record.imageUrl);
  safeSnapshot.memoryEmbeddings = [];
  safeSnapshot.favorites = (safeSnapshot.favorites ?? []).map((record) => sanitizeFavoriteForBackup(record));
  safeSnapshot.settings = sanitizeSettingsForBackup(safeSnapshot.settings);
  return safeSnapshot;
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

export function createLinkBackupArchiveBlob(backup: LinkBackupFile) {
  const json = stringifyLinkBackupFile(backup);
  const zipped = zipSync({ 'link-backup.json': strToU8(json) }, { level: 6, mtime: new Date(backup.exportedAt) });
  return new Blob([zipped], { type: 'application/zip' });
}

function readBackupJsonFromZip(bytes: Uint8Array) {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('备份压缩包无法读取。');
  }

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
    ? readBackupJsonFromZip(bytes)
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

function downloadBlob(blob: Blob, filename: string) {
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
  }, 0);
}

export function downloadLinkBackupFile(backup: LinkBackupFile, filename: string) {
  const blob = new Blob([stringifyLinkBackupFile(backup)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, filename);
}

export async function downloadLinkBackupArchive(backup: LinkBackupFile, filename: string) {
  const archive = createLinkBackupArchiveBlob(backup);
  if (isNativeBackupSaveAvailable()) {
    await saveNativeBackupArchive(archive, filename);
    return;
  }
  downloadBlob(archive, filename);
}