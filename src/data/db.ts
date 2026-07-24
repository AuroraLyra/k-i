import { openDB, unwrap, type DBSchema, type IDBPDatabase } from 'idb';
import { toRaw } from 'vue';
import type { AppSettings, AppSnapshot, CharacterProfile, ChatImageAttachment, ChatMessage, Conversation, ConversationSettings, FanficBook, FanficChapter, FanficComment, FanficGenerationJob, FanficTopic, FavoriteMessageRecord, GeneratedImageRecord, MusicCommentThread, MusicTrack, ProfileHomepageRecord, ProfileTheme, SmallTheater, SmallTheaterTopic, Sticker, StickerGroup, UserProfile, VisualProfile, VoomPost, WorldBookEntry } from '@/types/domain';
import type { CommerceSnapshot, ShopCartItem, ShopMoment, ShopOrder, ShopProduct, ShopStorefront, ShopWishlistItem, WalletAccount, WalletTransaction } from '@/types/commerce';
import type { MemoryAssertion, MemoryEdge, MemoryEmbeddingCache, MemoryEntity, MemoryEpisode, MemoryStateSnapshot, MemoryTheme } from '@/types/memory';
import { compressInlineImageDataUrl } from '@/utils/imageFile';
import { collectStoredMediaLocators, externalizeLargeMediaRefs, pruneStoredMediaCache } from '@/utils/mediaStorage';
import { normalizeUserProfile, removeVisualProfileAvatar } from '@/utils/profile';
import { normalizeAppSettings } from '@/utils/settings';
import { isLegacyGanadiSticker, isLegacyGanadiStickerGroup, isRecentStickerGroupId } from '@/utils/stickers';
import { normalizeWorldBooks } from '@/utils/worldBook';
import { defaultCharacters, defaultConversations, defaultMessages, defaultProfileHomepages, defaultProfileThemes, defaultSettings, defaultSmallTheaterTopics, defaultSmallTheaters, defaultStickerGroups, defaultStickers, defaultUsers, defaultVoomPosts, defaultWorldBooks } from './seed';

interface LinkDb extends DBSchema {
  user: { key: string; value: UserProfile };
  characters: { key: string; value: CharacterProfile };
  conversations: { key: string; value: Conversation; indexes: { byChar: string } };
  messages: { key: string; value: ChatMessage; indexes: { byConversation: string } };
  voomPosts: { key: string; value: VoomPost; indexes: { byChar: string; byConversation: string } };
  profileThemes: { key: string; value: ProfileTheme; indexes: { byChar: string } };
  profileHomepages: { key: string; value: ProfileHomepageRecord; indexes: { byChar: string; byConversation: string } };
  smallTheaterTopics: { key: string; value: SmallTheaterTopic; indexes: { byChar: string } };
  smallTheaters: { key: string; value: SmallTheater; indexes: { byChar: string; byConversation: string } };
  fanficBooks: { key: string; value: FanficBook; indexes: { byUser: string; byCharacter: string; byUpdatedAt: number } };
  fanficChapters: { key: string; value: FanficChapter; indexes: { byBook: string; byOrder: number } };
  fanficComments: { key: string; value: FanficComment; indexes: { byBook: string; byChapter: string } };
  fanficTopics: { key: string; value: FanficTopic; indexes: { bySource: string } };
  fanficGenerationJobs: { key: string; value: FanficGenerationJob; indexes: { byBook: string } };
  musicFavoriteTracks: { key: string; value: MusicTrack };
  musicCommentThreads: { key: string; value: MusicCommentThread };
  worldBooks: { key: string; value: WorldBookEntry; indexes: { byScope: string } };
  stickerGroups: { key: string; value: StickerGroup };
  stickers: { key: string; value: Sticker };
  conversationSettings: { key: string; value: ConversationSettings };
  memoryEpisodes: { key: string; value: MemoryEpisode; indexes: { byBrain: string; byConversation: string; byOccurredAt: number } };
  memoryEntities: { key: string; value: MemoryEntity; indexes: { byBrain: string } };
  memoryAssertions: { key: string; value: MemoryAssertion; indexes: { byBrain: string; bySubject: string; byUpdatedAt: number } };
  memoryEdges: { key: string; value: MemoryEdge; indexes: { byBrain: string; byFrom: string; byTo: string } };
  memoryThemes: { key: string; value: MemoryTheme; indexes: { byBrain: string } };
  memoryStateSnapshots: { key: string; value: MemoryStateSnapshot; indexes: { byBrain: string; byKind: string } };
  memoryEmbeddings: { key: string; value: MemoryEmbeddingCache; indexes: { byBrain: string; byOwner: string } };
  generatedImages: { key: string; value: GeneratedImageRecord; indexes: { byProvider: string; byCreatedAt: number } };
  favorites: { key: string; value: FavoriteMessageRecord; indexes: { byConversation: string; byFavoritedAt: number } };
  walletAccounts: { key: string; value: WalletAccount; indexes: { byOwner: string } };
  walletTransactions: { key: string; value: WalletTransaction; indexes: { byWallet: string; byCreatedAt: number } };
  shopStorefronts: { key: string; value: ShopStorefront; indexes: { byOwnerCharacter: string } };
  shopProducts: { key: string; value: ShopProduct; indexes: { byStore: string; byCategory: string } };
  shopCartItems: { key: string; value: ShopCartItem; indexes: { byUser: string } };
  shopWishlistItems: { key: string; value: ShopWishlistItem; indexes: { byUser: string } };
  shopOrders: { key: string; value: ShopOrder; indexes: { byUser: string; byPurchaser: string; byCreatedAt: number } };
  shopMoments: { key: string; value: ShopMoment; indexes: { byCharacter: string; byCreatedAt: number } };
  settings: { key: string; value: AppSettings };
}

let dbPromise: Promise<IDBPDatabase<LinkDb>> | undefined;
let backupReadLockDepth = 0;
let backupReadLockReleased: Promise<void> | null = null;
let releaseBackupReadLock: (() => void) | null = null;

const storeNames = ['user', 'characters', 'conversations', 'messages', 'voomPosts', 'profileThemes', 'profileHomepages', 'smallTheaterTopics', 'smallTheaters', 'fanficBooks', 'fanficChapters', 'fanficComments', 'fanficTopics', 'fanficGenerationJobs', 'musicFavoriteTracks', 'musicCommentThreads', 'worldBooks', 'stickerGroups', 'stickers', 'conversationSettings', 'memoryEpisodes', 'memoryEntities', 'memoryAssertions', 'memoryEdges', 'memoryThemes', 'memoryStateSnapshots', 'memoryEmbeddings', 'generatedImages', 'favorites', 'walletAccounts', 'walletTransactions', 'shopStorefronts', 'shopProducts', 'shopCartItems', 'shopWishlistItems', 'shopOrders', 'shopMoments', 'settings'] as const;
const legacyDefaultUserIds = new Set(['1008600002']);
const legacyDefaultCharacterIds = new Set(['2000100001', '2000100002', '2000100003']);
const legacyDefaultConversationIds = new Set(['conv_2000100001', 'conv_2000100002', 'conv_2000100003']);
const legacyDefaultWorldBookIds = new Set(['wb_global_online', 'wb_global_offline', 'wb_local_campus', 'wb_local_art', 'wb_local_tokyo']);
const legacyDefaultVoomPostIds = new Set(['voom_seed_1']);
const inlineImageCompressionOptions = { maxDimension: 800, quality: 0.62, minBytes: 160 * 1024 };
const inlineAvatarCompressionOptions = { maxDimension: 320, quality: 0.76, minBytes: 56 * 1024 };
const inlineProfileImageCompressionOptions = { maxDimension: 960, quality: 0.72, minBytes: 160 * 1024 };
const generatedImageFullQualityMs = 7 * 24 * 60 * 60 * 1000;
const startupMaintenanceIntervalMs = 24 * 60 * 60 * 1000;
const startupMaintenanceStorageKey = 'link:storage-maintenance:2026-07-generated-media-v2';
let startupMaintenancePromise: Promise<void> | null = null;

async function waitForBackupReadLock() {
  while (backupReadLockDepth > 0 && backupReadLockReleased) await backupReadLockReleased;
}

export async function withBackupReadLock<T>(task: () => Promise<T>): Promise<T> {
  backupReadLockDepth += 1;
  backupReadLockReleased ??= new Promise<void>((resolve) => {
    releaseBackupReadLock = resolve;
  });

  try {
    return await task();
  } finally {
    backupReadLockDepth = Math.max(0, backupReadLockDepth - 1);
    if (backupReadLockDepth === 0) {
      releaseBackupReadLock?.();
      backupReadLockReleased = null;
      releaseBackupReadLock = null;
    }
  }
}

function isInlineImageDataUrl(value: string | undefined) {
  return /^data:image\//i.test(String(value ?? '').trim());
}

async function compactInlineImageValue(value: string | undefined, options = inlineImageCompressionOptions) {
  if (!isInlineImageDataUrl(value)) return value;
  try {
    return await compressInlineImageDataUrl(String(value), options);
  } catch {
    return value;
  }
}

function isFreshGeneratedInlineImage(createdAt: number | undefined, provider: string | undefined) {
  const normalizedProvider = String(provider ?? '').trim();
  if (!normalizedProvider || normalizedProvider === 'local' || normalizedProvider === 'mock') return false;
  const timestamp = Number(createdAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp < generatedImageFullQualityMs;
}

async function compactInlineImageValueByAge(value: string | undefined, createdAt: number | undefined, provider: string | undefined, options = inlineImageCompressionOptions) {
  if (isFreshGeneratedInlineImage(createdAt, provider)) return value;
  return await compactInlineImageValue(value, options);
}

async function compactVisualProfileInlineImages<T extends Partial<VisualProfile> | undefined>(profile: T): Promise<T> {
  if (!profile) return profile;
  let changed = false;
  const nextProfile = { ...profile } as Partial<VisualProfile>;

  if (typeof nextProfile.avatar === 'string') {
    const nextAvatar = await compactInlineImageValue(nextProfile.avatar, inlineAvatarCompressionOptions);
    if (nextAvatar !== nextProfile.avatar) {
      nextProfile.avatar = nextAvatar ?? nextProfile.avatar;
      changed = true;
    }
  }

  if (typeof nextProfile.backgroundImage === 'string') {
    const nextBackground = await compactInlineImageValue(nextProfile.backgroundImage, inlineProfileImageCompressionOptions);
    if (nextBackground !== nextProfile.backgroundImage) {
      nextProfile.backgroundImage = nextBackground ?? nextProfile.backgroundImage;
      changed = true;
    }
  }

  if (Array.isArray(nextProfile.highlights)) {
    const nextHighlights = await Promise.all(nextProfile.highlights.map(async (highlight) => {
      const nextImage = await compactInlineImageValue(highlight.image, inlineProfileImageCompressionOptions);
      if (nextImage === highlight.image) return highlight;
      changed = true;
      return { ...highlight, image: nextImage ?? highlight.image };
    }));
    nextProfile.highlights = nextHighlights;
  }

  if (Array.isArray(nextProfile.moments)) {
    const nextMoments = await Promise.all(nextProfile.moments.map(async (moment) => {
      const nextImage = await compactInlineImageValue(moment.image, inlineProfileImageCompressionOptions);
      if (nextImage === moment.image) return moment;
      changed = true;
      return { ...moment, image: nextImage ?? moment.image };
    }));
    nextProfile.moments = nextMoments;
  }

  return (changed ? nextProfile : profile) as T;
}

async function compactUserProfileInlineImages(user: UserProfile): Promise<UserProfile> {
  let changed = false;
  const nextAvatar = await compactInlineImageValue(user.avatar, inlineAvatarCompressionOptions);
  if (nextAvatar !== user.avatar) changed = true;

  const nextProfile = await compactVisualProfileInlineImages(user.profile);
  if (nextProfile !== user.profile) changed = true;

  return changed ? { ...user, avatar: nextAvatar ?? user.avatar, profile: nextProfile } : user;
}

async function compactCharacterProfileInlineImages(character: CharacterProfile): Promise<CharacterProfile> {
  let changed = false;
  const nextAvatar = await compactInlineImageValue(character.avatar, inlineAvatarCompressionOptions);
  if (nextAvatar !== character.avatar) changed = true;

  const nextReferenceImage = await compactInlineImageValue(character.imageProfile?.referenceImage, inlineProfileImageCompressionOptions);
  if (nextReferenceImage !== character.imageProfile?.referenceImage) changed = true;

  const nextPhotos = character.imageProfile?.photos
    ? await Promise.all(character.imageProfile.photos.map(async (photo) => {
        const nextImageUrl = await compactInlineImageValueByAge(photo.imageUrl, photo.createdAt, photo.provider, inlineProfileImageCompressionOptions) ?? photo.imageUrl;
        if (nextImageUrl === photo.imageUrl) return photo;
        changed = true;
        return { ...photo, imageUrl: nextImageUrl, updatedAt: Date.now() };
      }))
    : character.imageProfile?.photos;

  const nextBoundUserProfile = await compactVisualProfileInlineImages(character.boundUserProfile);
  if (nextBoundUserProfile !== character.boundUserProfile) changed = true;

  const rawProfile = character.profile as Partial<VisualProfile> | undefined;
  const compactedProfile = await compactVisualProfileInlineImages(rawProfile);
  const nextProfile = ('avatar' in (compactedProfile ?? {}))
    ? removeVisualProfileAvatar(compactedProfile) as CharacterProfile['profile']
    : compactedProfile as CharacterProfile['profile'];
  if (compactedProfile !== rawProfile || nextProfile !== compactedProfile) changed = true;

  return changed
    ? {
        ...character,
        avatar: nextAvatar ?? character.avatar,
        imageProfile: character.imageProfile ? { ...character.imageProfile, referenceImage: nextReferenceImage ?? character.imageProfile.referenceImage, photos: nextPhotos ?? character.imageProfile.photos } : character.imageProfile,
        boundUserProfile: nextBoundUserProfile,
        profile: nextProfile
      }
    : character;
}

async function compactChatImageAttachment(image: ChatImageAttachment, messageCreatedAt = 0): Promise<ChatImageAttachment> {
  let changed = false;
  const nextUrl = await compactInlineImageValueByAge(image.url, messageCreatedAt, image.provider);
  if (nextUrl !== image.url) changed = true;

  const nextCandidates = image.candidates
    ? await Promise.all(image.candidates.map(async (candidate) => {
        const nextImage = await compactInlineImageValueByAge(candidate.image, candidate.createdAt, candidate.provider) ?? candidate.image;
        if (nextImage !== candidate.image) changed = true;
        return nextImage === candidate.image ? candidate : { ...candidate, image: nextImage };
      }))
    : image.candidates;

  return changed ? { ...image, url: nextUrl, candidates: nextCandidates } : image;
}

async function compactMessageInlineImages(message: ChatMessage): Promise<ChatMessage> {
  let changed = false;
  const nextImage = message.image ? await compactChatImageAttachment(message.image, message.createdAt) : message.image;
  if (nextImage !== message.image) changed = true;

  const nextQuoteImage = message.quote?.image ? await compactChatImageAttachment(message.quote.image, message.createdAt) : message.quote?.image;
  if (nextQuoteImage !== message.quote?.image) changed = true;

  return changed
    ? {
        ...message,
        image: nextImage,
        quote: message.quote ? { ...message.quote, image: nextQuoteImage } : message.quote
      }
    : message;
}

async function compactVoomPostInlineImages(post: VoomPost): Promise<VoomPost> {
  let changed = false;
  const nextAuthorAvatar = await compactInlineImageValue(post.authorAvatar, inlineAvatarCompressionOptions);
  if (nextAuthorAvatar !== post.authorAvatar) changed = true;

  const nextImage = await compactInlineImageValueByAge(post.image, post.createdAt, post.imageProvider);
  if (nextImage !== post.image) changed = true;

  const nextCandidates = post.imageCandidates
    ? await Promise.all(post.imageCandidates.map(async (candidate) => {
        const nextCandidateImage = await compactInlineImageValueByAge(candidate.image, candidate.createdAt, candidate.provider) ?? candidate.image;
        if (nextCandidateImage !== candidate.image) changed = true;
        return nextCandidateImage === candidate.image ? candidate : { ...candidate, image: nextCandidateImage };
      }))
    : post.imageCandidates;

  return changed ? { ...post, authorAvatar: nextAuthorAvatar ?? post.authorAvatar, image: nextImage, imageCandidates: nextCandidates } : post;
}

async function compactFanficBookInlineImages(book: FanficBook): Promise<FanficBook> {
  const nextCoverImage = await compactInlineImageValue(book.coverImage, inlineProfileImageCompressionOptions) ?? book.coverImage;
  return nextCoverImage === book.coverImage ? book : { ...book, coverImage: nextCoverImage, updatedAt: Date.now() };
}

async function compactStickerInlineImages(sticker: Sticker): Promise<Sticker> {
  const nextCachedImageUrl = await compactInlineImageValue(sticker.cachedImageUrl, inlineProfileImageCompressionOptions) ?? sticker.cachedImageUrl;
  return nextCachedImageUrl === sticker.cachedImageUrl ? sticker : { ...sticker, cachedImageUrl: nextCachedImageUrl };
}

async function compactGeneratedImageRecord(record: GeneratedImageRecord): Promise<GeneratedImageRecord> {
  const nextImageUrl = await compactInlineImageValueByAge(record.imageUrl, record.createdAt, record.provider) ?? record.imageUrl;
  return nextImageUrl === record.imageUrl ? record : { ...record, imageUrl: nextImageUrl };
}

async function compactWorldBookInlineImages(entry: WorldBookEntry): Promise<WorldBookEntry> {
  const nextCoverImage = await compactInlineImageValue(entry.coverImage) ?? entry.coverImage;
  return nextCoverImage === entry.coverImage ? entry : { ...entry, coverImage: nextCoverImage };
}

async function compactFavoriteInlineImages(record: FavoriteMessageRecord): Promise<FavoriteMessageRecord> {
  let changed = false;
  const nextAuthorAvatar = await compactInlineImageValue(record.authorAvatar, inlineAvatarCompressionOptions);
  if (nextAuthorAvatar !== record.authorAvatar) changed = true;

  const nextCharacterAvatar = await compactInlineImageValue(record.characterAvatar, inlineAvatarCompressionOptions);
  if (nextCharacterAvatar !== record.characterAvatar) changed = true;

  const nextUserAvatar = await compactInlineImageValue(record.userAvatar, inlineAvatarCompressionOptions);
  if (nextUserAvatar !== record.userAvatar) changed = true;

  const nextMessage = await compactMessageInlineImages(record.message);
  if (nextMessage !== record.message) changed = true;

  return changed
    ? {
        ...record,
        authorAvatar: nextAuthorAvatar,
        characterAvatar: nextCharacterAvatar,
        userAvatar: nextUserAvatar,
        message: nextMessage
      }
    : record;
}

async function compactSettingsInlineImages(entry: AppSettings): Promise<AppSettings> {
  let changed = false;
  const nextOpenAiLastImageUrl = await compactInlineImageValue(entry.imageOpenAi.lastImageUrl) ?? entry.imageOpenAi.lastImageUrl;
  const nextNovelAiLastImageUrl = await compactInlineImageValue(entry.imageNovelAi.lastImageUrl) ?? entry.imageNovelAi.lastImageUrl;
  const nextPollinationsLastImageUrl = await compactInlineImageValue(entry.imagePollinations.lastImageUrl) ?? entry.imagePollinations.lastImageUrl;
  const nextPollinationsReferenceImage = await compactInlineImageValue(entry.imagePollinations.referenceImage) ?? entry.imagePollinations.referenceImage;
  changed ||= nextOpenAiLastImageUrl !== entry.imageOpenAi.lastImageUrl;
  changed ||= nextNovelAiLastImageUrl !== entry.imageNovelAi.lastImageUrl;
  changed ||= nextPollinationsLastImageUrl !== entry.imagePollinations.lastImageUrl;
  changed ||= nextPollinationsReferenceImage !== entry.imagePollinations.referenceImage;

  return changed
    ? {
        ...entry,
        imageOpenAi: { ...entry.imageOpenAi, lastImageUrl: nextOpenAiLastImageUrl },
        imageNovelAi: { ...entry.imageNovelAi, lastImageUrl: nextNovelAiLastImageUrl },
        imagePollinations: {
          ...entry.imagePollinations,
          lastImageUrl: nextPollinationsLastImageUrl,
          referenceImage: nextPollinationsReferenceImage
        }
      }
    : entry;
}

async function compactValueForStore<TStore extends StoreName>(storeName: TStore, value: LinkDb[TStore]['value']): Promise<LinkDb[TStore]['value']> {
  if (storeName === 'user') return await compactUserProfileInlineImages(value as UserProfile) as LinkDb[TStore]['value'];
  if (storeName === 'characters') return await compactCharacterProfileInlineImages(value as CharacterProfile) as LinkDb[TStore]['value'];
  if (storeName === 'messages') return await compactMessageInlineImages(value as ChatMessage) as LinkDb[TStore]['value'];
  if (storeName === 'voomPosts') return await compactVoomPostInlineImages(value as VoomPost) as LinkDb[TStore]['value'];
  if (storeName === 'fanficBooks') return await compactFanficBookInlineImages(value as FanficBook) as LinkDb[TStore]['value'];
  if (storeName === 'stickers') return await compactStickerInlineImages(value as Sticker) as LinkDb[TStore]['value'];
  if (storeName === 'generatedImages') return await compactGeneratedImageRecord(value as GeneratedImageRecord) as LinkDb[TStore]['value'];
  if (storeName === 'worldBooks') return await compactWorldBookInlineImages(value as WorldBookEntry) as LinkDb[TStore]['value'];
  if (storeName === 'favorites') return await compactFavoriteInlineImages(value as FavoriteMessageRecord) as LinkDb[TStore]['value'];
  if (storeName === 'settings') return await compactSettingsInlineImages(value as AppSettings) as LinkDb[TStore]['value'];
  return value;
}

async function compactSnapshotInlineImages(snapshot: AppSnapshot): Promise<AppSnapshot> {
  const users: UserProfile[] = [];
  for (const user of snapshot.users) users.push(await compactUserProfileInlineImages(user));

  const characters: CharacterProfile[] = [];
  for (const character of snapshot.characters) characters.push(await compactCharacterProfileInlineImages(character));

  const messages: ChatMessage[] = [];
  for (const message of snapshot.messages) messages.push(await compactMessageInlineImages(message));

  const voomPosts: VoomPost[] = [];
  for (const post of snapshot.voomPosts) voomPosts.push(await compactVoomPostInlineImages(post));

  const profileHomepages = snapshot.profileHomepages ?? [];
  const smallTheaterTopics = snapshot.smallTheaterTopics ?? [];
  const smallTheaters = snapshot.smallTheaters ?? [];
  const profileThemes = snapshot.profileThemes ?? [];

  const fanficBooks: FanficBook[] = [];
  for (const book of snapshot.fanficBooks ?? []) fanficBooks.push(await compactFanficBookInlineImages(book));

  const generatedImages: GeneratedImageRecord[] = [];
  for (const record of snapshot.generatedImages ?? []) generatedImages.push(await compactGeneratedImageRecord(record));

  const stickers: Sticker[] = [];
  for (const sticker of snapshot.stickers) stickers.push(await compactStickerInlineImages(sticker));

  const worldBooks: WorldBookEntry[] = [];
  for (const entry of snapshot.worldBooks) worldBooks.push(await compactWorldBookInlineImages(entry));

  const favorites: FavoriteMessageRecord[] = [];
  for (const record of snapshot.favorites ?? []) favorites.push(await compactFavoriteInlineImages(record));

  return {
    ...snapshot,
    users,
    characters,
    messages,
    voomPosts,
    profileThemes,
    profileHomepages,
    smallTheaterTopics,
    smallTheaters,
    fanficBooks,
    stickers,
    worldBooks,
    generatedImages,
    favorites,
    settings: await compactSettingsInlineImages(snapshot.settings)
  };
}

async function compactStoredInlineImagesForStore<TStore extends StoreName>(storeName: TStore) {
  const db = await getDb();
  const keys = await db.getAllKeys(storeName);
  let changed = 0;

  for (const key of keys) {
    const value = await db.get(storeName, key as never);
    if (!value) continue;
    const compactedValue = await compactValueForStore(storeName, value);
    const externalizedValue = await externalizeLargeMediaRefs(compactedValue);
    if (externalizedValue === value) continue;

    const persistableValue = toPersistableValue(externalizedValue);
    if (storeName === 'settings') await db.put('settings', persistableValue as AppSettings, key as string);
    else await db.put(storeName, persistableValue as never);
    changed += 1;
  }

  return changed;
}

export async function compactStoredInlineImages() {
  let changed = 0;
  changed += await compactStoredInlineImagesForStore('user');
  changed += await compactStoredInlineImagesForStore('characters');
  changed += await compactStoredInlineImagesForStore('messages');
  changed += await compactStoredInlineImagesForStore('voomPosts');
  changed += await compactStoredInlineImagesForStore('fanficBooks');
  changed += await compactStoredInlineImagesForStore('generatedImages');
  changed += await compactStoredInlineImagesForStore('stickers');
  changed += await compactStoredInlineImagesForStore('worldBooks');
  changed += await compactStoredInlineImagesForStore('favorites');
  changed += await compactStoredInlineImagesForStore('settings');
  await pruneUnusedStoredMediaCache();
  return changed;
}

export function scheduleStartupStorageMaintenance() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  try {
    const lastRunAt = Number(window.localStorage.getItem(startupMaintenanceStorageKey) ?? 0);
    if (Number.isFinite(lastRunAt) && now - lastRunAt < startupMaintenanceIntervalMs) return;
  } catch {
    return;
  }

  const runMaintenance = () => {
    startupMaintenancePromise ??= compactStoredInlineImages()
      .then(() => {
        try {
          window.localStorage.setItem(startupMaintenanceStorageKey, String(Date.now()));
        } catch {
          return;
        }
      })
      .catch(() => undefined)
      .finally(() => {
        startupMaintenancePromise = null;
      });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => runMaintenance(), { timeout: 6000 });
    return;
  }

  globalThis.setTimeout(runMaintenance, 1800);
}

function migrationRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function migrationString(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function migrationTimestamp(value: unknown, fallback: number) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : fallback;
}

function migrationTokenEstimate(text: string) {
  const cjkCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = text.replace(/[\u3400-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjkCount * 1.1 + latinWords * 1.35));
}

function migrateArchivedSummaries(database: IDBDatabase, transaction: IDBTransaction) {
  if (!database.objectStoreNames.contains('conversationMemories')) return;

  const summaryRequest = transaction.objectStore('conversationMemories').getAll();
  const conversationRequest = transaction.objectStore('conversations').getAll();
  const characterRequest = transaction.objectStore('characters').getAll();
  const userRequest = transaction.objectStore('user').getAll();
  const episodeRequest = transaction.objectStore('memoryEpisodes').getAll();
  const entityRequest = transaction.objectStore('memoryEntities').getAll();
  let summaries: unknown[] = [];
  let conversations: unknown[] = [];
  let characters: unknown[] = [];
  let users: unknown[] = [];
  let episodes: unknown[] = [];
  let entities: unknown[] = [];
  let completedRequests = 0;

  const finishMigration = () => {
    completedRequests += 1;
    if (completedRequests < 6) return;

    const conversationsById = new Map(conversations.flatMap((value) => {
      const record = migrationRecord(value);
      const id = migrationString(record?.id);
      return record && id ? [[id, record] as const] : [];
    }));
    const charactersById = new Map(characters.flatMap((value) => {
      const record = migrationRecord(value);
      const id = migrationString(record?.id);
      return record && id ? [[id, record] as const] : [];
    }));
    const usersById = new Map(users.flatMap((value) => {
      const record = migrationRecord(value);
      const id = migrationString(record?.id);
      return record && id ? [[id, record] as const] : [];
    }));
    const existingSourceHashes = new Set(episodes.flatMap((value) => {
      const sourceHash = migrationString(migrationRecord(value)?.sourceHash);
      return sourceHash ? [sourceHash] : [];
    }));
    const existingEntityIds = new Set(entities.flatMap((value) => {
      const id = migrationString(migrationRecord(value)?.id);
      return id ? [id] : [];
    }));
    const episodeStore = transaction.objectStore('memoryEpisodes');
    const entityStore = transaction.objectStore('memoryEntities');
    const assertionStore = transaction.objectStore('memoryAssertions');
    const edgeStore = transaction.objectStore('memoryEdges');

    summaries.forEach((value) => {
      const summaryRecord = migrationRecord(value);
      const summaryId = migrationString(summaryRecord?.id);
      const conversationId = migrationString(summaryRecord?.conversationId);
      const summary = migrationString(summaryRecord?.summary);
      const conversation = conversationsById.get(conversationId);
      if (!summaryId || !conversation || !summary) return;
      const characterId = migrationString(conversation.charId);
      const userId = migrationString(conversation.userId);
      const character = charactersById.get(characterId);
      const user = usersById.get(userId);
      if (!character || !user) return;

      const archivedSourceHash = `archived-summary:${summaryId}`;
      if (existingSourceHashes.has(archivedSourceHash) || existingSourceHashes.has(`legacy:${summaryId}`)) return;
      const brainId = `brain:${characterId}:${userId}`;
      const selfEntityId = `${brainId}:self`;
      const userEntityId = `${brainId}:user`;
      const characterName = migrationString(character.name) || migrationString(character.nickname) || '角色';
      const userName = migrationString(user.name) || migrationString(user.nickname) || '用户';
      const now = Date.now();
      const createdAt = migrationTimestamp(summaryRecord?.createdAt, now);
      const updatedAt = migrationTimestamp(summaryRecord?.updatedAt, createdAt);
      const startFloor = Math.max(0, Math.floor(Number(summaryRecord?.startFloor) || 0));
      const endFloor = Math.max(startFloor, Math.floor(Number(summaryRecord?.endFloor) || startFloor));
      const sourceMessageIds = Array.isArray(summaryRecord?.sourceMessageIds)
        ? summaryRecord.sourceMessageIds.map(migrationString).filter(Boolean)
        : [];
      const episodeId = `memory:v16:episode:${encodeURIComponent(summaryId)}`;
      const assertionId = `memory:v16:assertion:${encodeURIComponent(summaryId)}`;
      const edgeId = `memory:v16:edge:${encodeURIComponent(summaryId)}`;
      const narrative = `我曾把这段经历记作：${summary}`;

      if (!existingEntityIds.has(selfEntityId)) {
        void entityStore.put({
          id: selfEntityId,
          brainId,
          type: 'character',
          name: characterName,
          normalizedName: characterName.toLocaleLowerCase(),
          aliases: [migrationString(character.nickname)].filter((name) => Boolean(name && name !== characterName)),
          description: `${characterName}本人`,
          createdAt,
          updatedAt
        } satisfies MemoryEntity);
        existingEntityIds.add(selfEntityId);
      }
      if (!existingEntityIds.has(userEntityId)) {
        void entityStore.put({
          id: userEntityId,
          brainId,
          type: 'user',
          name: userName,
          normalizedName: userName.toLocaleLowerCase(),
          aliases: [migrationString(user.nickname)].filter((name) => Boolean(name && name !== userName)),
          description: `与我共享这些经历的${userName}`,
          createdAt,
          updatedAt
        } satisfies MemoryEntity);
        existingEntityIds.add(userEntityId);
      }

      void episodeStore.put({
        id: episodeId,
        brainId,
        characterId,
        userId,
        conversationId,
        channel: 'system',
        status: 'active',
        sourceMessageIds,
        sourceHash: archivedSourceHash,
        startFloor,
        endFloor,
        sourceTokenEstimate: migrationTokenEstimate(summary),
        title: startFloor || endFloor ? `历史记忆 · ${startFloor}-${endFloor}楼` : '历史记忆',
        narrative,
        location: '',
        emotion: '',
        valence: 0,
        arousal: 0.2,
        salience: 0.55,
        participantEntityIds: [selfEntityId, userEntityId],
        themeIds: [],
        occurredAt: createdAt,
        occurredEndAt: updatedAt,
        learnedAt: createdAt,
        createdAt,
        updatedAt
      } satisfies MemoryEpisode);
      void assertionStore.put({
        id: assertionId,
        brainId,
        subjectEntityId: selfEntityId,
        predicate: '过去共同经历的记录',
        objectText: summary,
        kind: 'interpretation',
        status: 'current',
        epistemicKind: 'inferred',
        perspectiveText: narrative,
        confidence: 0.55,
        importance: 0.55,
        emotionalWeight: 0.25,
        relationshipImpact: 0.1,
        evidenceMessageIds: sourceMessageIds,
        sourceEpisodeIds: [episodeId],
        themeIds: [],
        searchText: `${characterName} ${userName} ${summary}`,
        validFrom: createdAt,
        learnedAt: createdAt,
        recallCount: 0,
        pinned: false,
        accessibility: 0.72,
        createdAt,
        updatedAt
      } satisfies MemoryAssertion);
      void edgeStore.put({
        id: edgeId,
        brainId,
        fromId: episodeId,
        toId: assertionId,
        type: 'supports',
        weight: 1,
        createdAt,
        updatedAt
      } satisfies MemoryEdge);
      existingSourceHashes.add(archivedSourceHash);
    });

    database.deleteObjectStore('conversationMemories');
  };

  summaryRequest.onsuccess = () => { summaries = summaryRequest.result; finishMigration(); };
  conversationRequest.onsuccess = () => { conversations = conversationRequest.result; finishMigration(); };
  characterRequest.onsuccess = () => { characters = characterRequest.result; finishMigration(); };
  userRequest.onsuccess = () => { users = userRequest.result; finishMigration(); };
  episodeRequest.onsuccess = () => { episodes = episodeRequest.result; finishMigration(); };
  entityRequest.onsuccess = () => { entities = entityRequest.result; finishMigration(); };
}

export function getDb() {
  dbPromise ??= openDB<LinkDb>('link-local-db', 16, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      if (!db.objectStoreNames.contains('user')) db.createObjectStore('user', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('characters')) db.createObjectStore('characters', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('conversations')) {
        const conversationStore = db.createObjectStore('conversations', { keyPath: 'id' });
        conversationStore.createIndex('byChar', 'charId');
      }
      if (!db.objectStoreNames.contains('messages')) {
        const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
        messageStore.createIndex('byConversation', 'conversationId');
      }
      if (!db.objectStoreNames.contains('voomPosts')) {
        const voomStore = db.createObjectStore('voomPosts', { keyPath: 'id' });
        voomStore.createIndex('byChar', 'charId');
        voomStore.createIndex('byConversation', 'conversationId');
      }
      if (!db.objectStoreNames.contains('profileThemes')) {
        const profileThemeStore = db.createObjectStore('profileThemes', { keyPath: 'id' });
        profileThemeStore.createIndex('byChar', 'charId');
      }
      if (!db.objectStoreNames.contains('profileHomepages')) {
        const profileHomepageStore = db.createObjectStore('profileHomepages', { keyPath: 'id' });
        profileHomepageStore.createIndex('byChar', 'charId');
        profileHomepageStore.createIndex('byConversation', 'conversationId');
      }
      if (!db.objectStoreNames.contains('smallTheaterTopics')) {
        const topicStore = db.createObjectStore('smallTheaterTopics', { keyPath: 'id' });
        topicStore.createIndex('byChar', 'charId');
      }
      if (!db.objectStoreNames.contains('smallTheaters')) {
        const theaterStore = db.createObjectStore('smallTheaters', { keyPath: 'id' });
        theaterStore.createIndex('byChar', 'charId');
        theaterStore.createIndex('byConversation', 'conversationId');
      }
      if (!db.objectStoreNames.contains('fanficBooks')) {
        const fanficBookStore = db.createObjectStore('fanficBooks', { keyPath: 'id' });
        fanficBookStore.createIndex('byUser', 'userId');
        fanficBookStore.createIndex('byCharacter', 'characterId');
        fanficBookStore.createIndex('byUpdatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('fanficChapters')) {
        const fanficChapterStore = db.createObjectStore('fanficChapters', { keyPath: 'id' });
        fanficChapterStore.createIndex('byBook', 'bookId');
        fanficChapterStore.createIndex('byOrder', 'order');
      }
      if (!db.objectStoreNames.contains('fanficComments')) {
        const fanficCommentStore = db.createObjectStore('fanficComments', { keyPath: 'id' });
        fanficCommentStore.createIndex('byBook', 'bookId');
        fanficCommentStore.createIndex('byChapter', 'chapterId');
      }
      if (!db.objectStoreNames.contains('fanficTopics')) {
        const fanficTopicStore = db.createObjectStore('fanficTopics', { keyPath: 'id' });
        fanficTopicStore.createIndex('bySource', 'source');
      }
      if (!db.objectStoreNames.contains('fanficGenerationJobs')) {
        const fanficJobStore = db.createObjectStore('fanficGenerationJobs', { keyPath: 'id' });
        fanficJobStore.createIndex('byBook', 'bookId');
      }
      if (!db.objectStoreNames.contains('musicFavoriteTracks')) db.createObjectStore('musicFavoriteTracks', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('musicCommentThreads')) db.createObjectStore('musicCommentThreads', { keyPath: 'trackKey' });
      if (!db.objectStoreNames.contains('worldBooks')) {
        const worldBookStore = db.createObjectStore('worldBooks', { keyPath: 'id' });
        worldBookStore.createIndex('byScope', 'scope');
      }
      if (!db.objectStoreNames.contains('stickerGroups')) db.createObjectStore('stickerGroups', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('stickers')) db.createObjectStore('stickers', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('conversationSettings')) db.createObjectStore('conversationSettings', { keyPath: 'conversationId' });
      if (!db.objectStoreNames.contains('memoryEpisodes')) {
        const store = db.createObjectStore('memoryEpisodes', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
        store.createIndex('byConversation', 'conversationId');
        store.createIndex('byOccurredAt', 'occurredAt');
      }
      if (!db.objectStoreNames.contains('memoryEntities')) {
        const store = db.createObjectStore('memoryEntities', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
      }
      if (!db.objectStoreNames.contains('memoryAssertions')) {
        const store = db.createObjectStore('memoryAssertions', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
        store.createIndex('bySubject', 'subjectEntityId');
        store.createIndex('byUpdatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('memoryEdges')) {
        const store = db.createObjectStore('memoryEdges', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
        store.createIndex('byFrom', 'fromId');
        store.createIndex('byTo', 'toId');
      }
      if (!db.objectStoreNames.contains('memoryThemes')) {
        const store = db.createObjectStore('memoryThemes', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
      }
      if (!db.objectStoreNames.contains('memoryStateSnapshots')) {
        const store = db.createObjectStore('memoryStateSnapshots', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
        store.createIndex('byKind', 'kind');
      }
      if (!db.objectStoreNames.contains('memoryEmbeddings')) {
        const store = db.createObjectStore('memoryEmbeddings', { keyPath: 'id' });
        store.createIndex('byBrain', 'brainId');
        store.createIndex('byOwner', 'ownerId');
      }
      const migrationDb = unwrap(db);
      migrateArchivedSummaries(migrationDb, unwrap(transaction));
      if (migrationDb.objectStoreNames.contains('conversationMemoryAtoms')) migrationDb.deleteObjectStore('conversationMemoryAtoms');
      if (!db.objectStoreNames.contains('generatedImages')) {
        const generatedImageStore = db.createObjectStore('generatedImages', { keyPath: 'id' });
        generatedImageStore.createIndex('byProvider', 'provider');
        generatedImageStore.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('favorites')) {
        const favoriteStore = db.createObjectStore('favorites', { keyPath: 'id' });
        favoriteStore.createIndex('byConversation', 'conversationId');
        favoriteStore.createIndex('byFavoritedAt', 'favoritedAt');
      }
      if (!db.objectStoreNames.contains('walletAccounts')) {
        const store = db.createObjectStore('walletAccounts', { keyPath: 'id' });
        store.createIndex('byOwner', 'ownerId');
      }
      if (!db.objectStoreNames.contains('walletTransactions')) {
        const store = db.createObjectStore('walletTransactions', { keyPath: 'id' });
        store.createIndex('byWallet', 'walletId');
        store.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('shopStorefronts')) {
        const store = db.createObjectStore('shopStorefronts', { keyPath: 'id' });
        store.createIndex('byOwnerCharacter', 'ownerCharacterId');
      }
      if (!db.objectStoreNames.contains('shopProducts')) {
        const store = db.createObjectStore('shopProducts', { keyPath: 'id' });
        store.createIndex('byStore', 'storeId');
        store.createIndex('byCategory', 'category');
      }
      if (!db.objectStoreNames.contains('shopCartItems')) {
        const store = db.createObjectStore('shopCartItems', { keyPath: 'id' });
        store.createIndex('byUser', 'userId');
      }
      if (!db.objectStoreNames.contains('shopWishlistItems')) {
        const store = db.createObjectStore('shopWishlistItems', { keyPath: 'id' });
        store.createIndex('byUser', 'userId');
      }
      if (!db.objectStoreNames.contains('shopOrders')) {
        const store = db.createObjectStore('shopOrders', { keyPath: 'id' });
        store.createIndex('byUser', 'userId');
        store.createIndex('byPurchaser', 'purchaserId');
        store.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('shopMoments')) {
        const store = db.createObjectStore('shopMoments', { keyPath: 'id' });
        store.createIndex('byCharacter', 'characterId');
        store.createIndex('byCreatedAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');

      if (oldVersion < 4) {
        const stickerGroupStore = transaction.objectStore('stickerGroups');
        const stickerStore = transaction.objectStore('stickers');
        defaultStickerGroups.forEach((group) => {
          void stickerGroupStore.put(group);
        });
        defaultStickers.forEach((sticker) => {
          void stickerStore.put(sticker);
        });
      }
    }
  });
  return dbPromise;
}

export async function seedDatabase() {
  const db = await getDb();
  const existingUser = await db.get('user', defaultUsers[0].id);
  if (existingUser) return;

  const tx = db.transaction(['user', 'characters', 'conversations', 'messages', 'voomPosts', 'profileThemes', 'profileHomepages', 'smallTheaterTopics', 'smallTheaters', 'musicFavoriteTracks', 'musicCommentThreads', 'worldBooks', 'stickerGroups', 'stickers', 'conversationSettings', 'generatedImages', 'favorites', 'settings'], 'readwrite');
  await Promise.all(defaultUsers.map((user) => tx.objectStore('user').put(user)));
  await Promise.all(defaultCharacters.map((character) => tx.objectStore('characters').put(character)));
  await Promise.all(defaultConversations.map((conversation) => tx.objectStore('conversations').put(conversation)));
  await Promise.all(defaultMessages.map((message) => tx.objectStore('messages').put(message)));
  await Promise.all(defaultVoomPosts.map((post) => tx.objectStore('voomPosts').put(post)));
  await Promise.all(defaultProfileThemes.map((theme) => tx.objectStore('profileThemes').put(theme)));
  await Promise.all(defaultProfileHomepages.map((homepage) => tx.objectStore('profileHomepages').put(homepage)));
  await Promise.all(defaultSmallTheaterTopics.map((topic) => tx.objectStore('smallTheaterTopics').put(topic)));
  await Promise.all(defaultSmallTheaters.map((theater) => tx.objectStore('smallTheaters').put(theater)));
  await Promise.all(defaultWorldBooks.map((entry) => tx.objectStore('worldBooks').put(entry)));
  await Promise.all(defaultStickerGroups.map((entry) => tx.objectStore('stickerGroups').put(entry)));
  await Promise.all(defaultStickers.map((entry) => tx.objectStore('stickers').put(entry)));
  await tx.objectStore('settings').put(defaultSettings, 'main');
  await tx.done;
}

async function pruneLegacyDefaultData() {
  const db = await getDb();
  const tx = db.transaction(storeNames, 'readwrite');
  const userStore = tx.objectStore('user');
  const messageStore = tx.objectStore('messages');
  const voomStore = tx.objectStore('voomPosts');
  const settingsStore = tx.objectStore('settings');
  const stickerGroupStore = tx.objectStore('stickerGroups');
  const stickerStore = tx.objectStore('stickers');
  const conversationSettingsStore = tx.objectStore('conversationSettings');
  const [users, messages, voomPosts, settings, stickerGroups, stickers, conversationSettings] = await Promise.all([
    userStore.getAll(),
    messageStore.getAll(),
    voomStore.getAll(),
    settingsStore.get('main'),
    stickerGroupStore.getAll(),
    stickerStore.getAll(),
    conversationSettingsStore.getAll()
  ]);

  const removedStickerGroupIds = new Set(
    stickerGroups
      .filter((group) => isLegacyGanadiStickerGroup(group) || isRecentStickerGroupId(group.id))
      .map((group) => group.id)
  );

  users.forEach((user) => {
    if (legacyDefaultUserIds.has(user.id)) {
      void userStore.delete(user.id);
      return;
    }

    const boundCharacterIds = user.boundCharacterIds.filter((id) => !legacyDefaultCharacterIds.has(id));
    if (boundCharacterIds.length !== user.boundCharacterIds.length) {
      void userStore.put({ ...user, boundCharacterIds });
    }
  });

  legacyDefaultCharacterIds.forEach((id) => void tx.objectStore('characters').delete(id));
  legacyDefaultConversationIds.forEach((id) => {
    void tx.objectStore('conversations').delete(id);
    void tx.objectStore('conversationSettings').delete(id);
  });
  legacyDefaultWorldBookIds.forEach((id) => void tx.objectStore('worldBooks').delete(id));
  messages
    .filter((message) => legacyDefaultConversationIds.has(message.conversationId))
    .forEach((message) => void messageStore.delete(message.id));
  voomPosts
    .filter((post) => legacyDefaultVoomPostIds.has(post.id) || legacyDefaultCharacterIds.has(post.charId) || (post.conversationId && legacyDefaultConversationIds.has(post.conversationId)))
    .forEach((post) => void voomStore.delete(post.id));
  removedStickerGroupIds.forEach((id) => void stickerGroupStore.delete(id));
  stickers
    .filter((sticker) => isLegacyGanadiSticker(sticker) || sticker.groupIds.some((id) => removedStickerGroupIds.has(id) || isRecentStickerGroupId(id)))
    .forEach((sticker) => void stickerStore.delete(sticker.id));
  conversationSettings.forEach((entry) => {
    const characterStickerGroupIds = entry.characterStickerGroupIds.filter((id) => !removedStickerGroupIds.has(id) && !isRecentStickerGroupId(id));
    if (characterStickerGroupIds.length !== entry.characterStickerGroupIds.length) {
      void conversationSettingsStore.put({ ...entry, characterStickerGroupIds });
    }
  });

  if (settings && legacyDefaultUserIds.has(settings.activeUserId)) {
    void settingsStore.put({ ...settings, activeUserId: defaultSettings.activeUserId }, 'main');
  }

  await tx.done;
}

export async function loadSnapshot() {
  await seedDatabase();
  await pruneLegacyDefaultData();
  const db = await getDb();
  const [users, characters, conversations, messages, voomPosts, profileThemes, profileHomepages, smallTheaterTopics, smallTheaters, fanficBooks, fanficChapters, fanficComments, fanficTopics, fanficGenerationJobs, musicFavoriteTracks, musicCommentThreads, worldBooks, stickerGroups, stickers, conversationSettings, memoryEpisodes, memoryEntities, memoryAssertions, memoryEdges, memoryThemes, memoryStateSnapshots, memoryEmbeddings, generatedImages, favorites, walletAccounts, walletTransactions, shopStorefronts, shopProducts, shopCartItems, shopWishlistItems, shopOrders, shopMoments, settings] = await Promise.all([
    db.getAll('user'),
    db.getAll('characters'),
    db.getAll('conversations'),
    db.getAll('messages'),
    db.getAll('voomPosts'),
    db.getAll('profileThemes'),
    db.getAll('profileHomepages'),
    db.getAll('smallTheaterTopics'),
    db.getAll('smallTheaters'),
    db.getAll('fanficBooks'),
    db.getAll('fanficChapters'),
    db.getAll('fanficComments'),
    db.getAll('fanficTopics'),
    db.getAll('fanficGenerationJobs'),
    db.getAll('musicFavoriteTracks'),
    db.getAll('musicCommentThreads'),
    db.getAll('worldBooks'),
    db.getAll('stickerGroups'),
    db.getAll('stickers'),
    db.getAll('conversationSettings'),
    db.getAll('memoryEpisodes'),
    db.getAll('memoryEntities'),
    db.getAll('memoryAssertions'),
    db.getAll('memoryEdges'),
    db.getAll('memoryThemes'),
    db.getAll('memoryStateSnapshots'),
    db.getAll('memoryEmbeddings'),
    db.getAll('generatedImages'),
    db.getAll('favorites'),
    db.getAll('walletAccounts'),
    db.getAll('walletTransactions'),
    db.getAll('shopStorefronts'),
    db.getAll('shopProducts'),
    db.getAll('shopCartItems'),
    db.getAll('shopWishlistItems'),
    db.getAll('shopOrders'),
    db.getAll('shopMoments'),
    db.get('settings', 'main')
  ]);

  return {
    users: users.map((user) => normalizeUserProfile(user)),
    characters,
    conversations,
    messages,
    voomPosts,
    profileThemes,
    profileHomepages,
    smallTheaterTopics,
    smallTheaters,
    fanficBooks,
    fanficChapters,
    fanficComments,
    fanficTopics,
    fanficGenerationJobs,
    musicFavoriteTracks,
    musicCommentThreads,
    worldBooks: normalizeWorldBooks(worldBooks),
    stickerGroups,
    stickers,
    conversationSettings,
    memoryEpisodes,
    memoryEntities,
    memoryAssertions,
    memoryEdges,
    memoryThemes,
    memoryStateSnapshots,
    memoryEmbeddings,
    generatedImages,
    favorites,
    walletAccounts,
    walletTransactions,
    shopStorefronts,
    shopProducts,
    shopCartItems,
    shopWishlistItems,
    shopOrders,
    shopMoments,
    settings: normalizeAppSettings(settings ?? defaultSettings)
  };
}

export async function loadCommerceSnapshot(): Promise<CommerceSnapshot> {
  const db = await getDb();
  const [walletAccounts, walletTransactions, shopStorefronts, shopProducts, shopCartItems, shopWishlistItems, shopOrders, shopMoments] = await Promise.all([
    db.getAll('walletAccounts'),
    db.getAll('walletTransactions'),
    db.getAll('shopStorefronts'),
    db.getAll('shopProducts'),
    db.getAll('shopCartItems'),
    db.getAll('shopWishlistItems'),
    db.getAll('shopOrders'),
    db.getAll('shopMoments')
  ]);
  return { walletAccounts, walletTransactions, shopStorefronts, shopProducts, shopCartItems, shopWishlistItems, shopOrders, shopMoments };
}

export async function replaceSnapshot(snapshot: AppSnapshot) {
  snapshot = await compactSnapshotInlineImages(snapshot);
  snapshot = await externalizeLargeMediaRefs(snapshot);
  const db = await getDb();
  const tx = db.transaction(storeNames, 'readwrite');

  const userStore = tx.objectStore('user');
  void userStore.clear();
  snapshot.users.forEach((entry) => void userStore.put(toPersistableValue(entry)));

  const characterStore = tx.objectStore('characters');
  void characterStore.clear();
  snapshot.characters.forEach((entry) => void characterStore.put(toPersistableValue(entry)));

  const conversationStore = tx.objectStore('conversations');
  void conversationStore.clear();
  snapshot.conversations.forEach((entry) => void conversationStore.put(toPersistableValue(entry)));

  const messageStore = tx.objectStore('messages');
  void messageStore.clear();
  snapshot.messages.forEach((entry) => void messageStore.put(toPersistableValue(entry)));

  const voomStore = tx.objectStore('voomPosts');
  void voomStore.clear();
  snapshot.voomPosts.forEach((entry) => void voomStore.put(toPersistableValue(entry)));

  const profileThemeStore = tx.objectStore('profileThemes');
  void profileThemeStore.clear();
  (snapshot.profileThemes ?? []).forEach((entry) => void profileThemeStore.put(toPersistableValue(entry)));

  const profileHomepageStore = tx.objectStore('profileHomepages');
  void profileHomepageStore.clear();
  (snapshot.profileHomepages ?? []).forEach((entry) => void profileHomepageStore.put(toPersistableValue(entry)));

  const smallTheaterTopicStore = tx.objectStore('smallTheaterTopics');
  void smallTheaterTopicStore.clear();
  (snapshot.smallTheaterTopics ?? []).forEach((entry) => void smallTheaterTopicStore.put(toPersistableValue(entry)));

  const smallTheaterStore = tx.objectStore('smallTheaters');
  void smallTheaterStore.clear();
  (snapshot.smallTheaters ?? []).forEach((entry) => void smallTheaterStore.put(toPersistableValue(entry)));

  const fanficBookStore = tx.objectStore('fanficBooks');
  void fanficBookStore.clear();
  (snapshot.fanficBooks ?? []).forEach((entry) => void fanficBookStore.put(toPersistableValue(entry)));

  const fanficChapterStore = tx.objectStore('fanficChapters');
  void fanficChapterStore.clear();
  (snapshot.fanficChapters ?? []).forEach((entry) => void fanficChapterStore.put(toPersistableValue(entry)));

  const fanficCommentStore = tx.objectStore('fanficComments');
  void fanficCommentStore.clear();
  (snapshot.fanficComments ?? []).forEach((entry) => void fanficCommentStore.put(toPersistableValue(entry)));

  const fanficTopicStore = tx.objectStore('fanficTopics');
  void fanficTopicStore.clear();
  (snapshot.fanficTopics ?? []).forEach((entry) => void fanficTopicStore.put(toPersistableValue(entry)));

  const fanficGenerationJobStore = tx.objectStore('fanficGenerationJobs');
  void fanficGenerationJobStore.clear();
  (snapshot.fanficGenerationJobs ?? []).forEach((entry) => void fanficGenerationJobStore.put(toPersistableValue(entry)));

  const musicFavoriteTrackStore = tx.objectStore('musicFavoriteTracks');
  void musicFavoriteTrackStore.clear();
  (snapshot.musicFavoriteTracks ?? []).forEach((entry) => void musicFavoriteTrackStore.put(toPersistableValue(entry)));

  const musicCommentThreadStore = tx.objectStore('musicCommentThreads');
  void musicCommentThreadStore.clear();
  (snapshot.musicCommentThreads ?? []).forEach((entry) => void musicCommentThreadStore.put(toPersistableValue(entry)));

  const worldBookStore = tx.objectStore('worldBooks');
  void worldBookStore.clear();
  snapshot.worldBooks.forEach((entry) => void worldBookStore.put(toPersistableValue(entry)));

  const stickerGroupStore = tx.objectStore('stickerGroups');
  void stickerGroupStore.clear();
  snapshot.stickerGroups.forEach((entry) => void stickerGroupStore.put(toPersistableValue(entry)));

  const stickerStore = tx.objectStore('stickers');
  void stickerStore.clear();
  snapshot.stickers.forEach((entry) => void stickerStore.put(toPersistableValue(entry)));

  const conversationSettingsStore = tx.objectStore('conversationSettings');
  void conversationSettingsStore.clear();
  snapshot.conversationSettings.forEach((entry) => void conversationSettingsStore.put(toPersistableValue(entry)));

  const memoryEpisodeStore = tx.objectStore('memoryEpisodes');
  void memoryEpisodeStore.clear();
  (snapshot.memoryEpisodes ?? []).forEach((entry) => void memoryEpisodeStore.put(toPersistableValue(entry)));

  const memoryEntityStore = tx.objectStore('memoryEntities');
  void memoryEntityStore.clear();
  (snapshot.memoryEntities ?? []).forEach((entry) => void memoryEntityStore.put(toPersistableValue(entry)));

  const memoryAssertionStore = tx.objectStore('memoryAssertions');
  void memoryAssertionStore.clear();
  (snapshot.memoryAssertions ?? []).forEach((entry) => void memoryAssertionStore.put(toPersistableValue(entry)));

  const memoryEdgeStore = tx.objectStore('memoryEdges');
  void memoryEdgeStore.clear();
  (snapshot.memoryEdges ?? []).forEach((entry) => void memoryEdgeStore.put(toPersistableValue(entry)));

  const memoryThemeStore = tx.objectStore('memoryThemes');
  void memoryThemeStore.clear();
  (snapshot.memoryThemes ?? []).forEach((entry) => void memoryThemeStore.put(toPersistableValue(entry)));

  const memoryStateStore = tx.objectStore('memoryStateSnapshots');
  void memoryStateStore.clear();
  (snapshot.memoryStateSnapshots ?? []).forEach((entry) => void memoryStateStore.put(toPersistableValue(entry)));

  const memoryEmbeddingStore = tx.objectStore('memoryEmbeddings');
  void memoryEmbeddingStore.clear();
  (snapshot.memoryEmbeddings ?? []).forEach((entry) => void memoryEmbeddingStore.put(toPersistableValue(entry)));

  const generatedImageStore = tx.objectStore('generatedImages');
  void generatedImageStore.clear();
  (snapshot.generatedImages ?? []).forEach((entry) => void generatedImageStore.put(toPersistableValue(entry)));

  const favoriteStore = tx.objectStore('favorites');
  void favoriteStore.clear();
  (snapshot.favorites ?? []).forEach((entry) => void favoriteStore.put(toPersistableValue(entry)));

  const walletAccountStore = tx.objectStore('walletAccounts');
  void walletAccountStore.clear();
  (snapshot.walletAccounts ?? []).forEach((entry) => void walletAccountStore.put(toPersistableValue(entry)));

  const walletTransactionStore = tx.objectStore('walletTransactions');
  void walletTransactionStore.clear();
  (snapshot.walletTransactions ?? []).forEach((entry) => void walletTransactionStore.put(toPersistableValue(entry)));

  const shopStorefrontStore = tx.objectStore('shopStorefronts');
  void shopStorefrontStore.clear();
  (snapshot.shopStorefronts ?? []).forEach((entry) => void shopStorefrontStore.put(toPersistableValue(entry)));

  const shopProductStore = tx.objectStore('shopProducts');
  void shopProductStore.clear();
  (snapshot.shopProducts ?? []).forEach((entry) => void shopProductStore.put(toPersistableValue(entry)));

  const shopCartItemStore = tx.objectStore('shopCartItems');
  void shopCartItemStore.clear();
  (snapshot.shopCartItems ?? []).forEach((entry) => void shopCartItemStore.put(toPersistableValue(entry)));

  const shopWishlistItemStore = tx.objectStore('shopWishlistItems');
  void shopWishlistItemStore.clear();
  (snapshot.shopWishlistItems ?? []).forEach((entry) => void shopWishlistItemStore.put(toPersistableValue(entry)));

  const shopOrderStore = tx.objectStore('shopOrders');
  void shopOrderStore.clear();
  (snapshot.shopOrders ?? []).forEach((entry) => void shopOrderStore.put(toPersistableValue(entry)));

  const shopMomentStore = tx.objectStore('shopMoments');
  void shopMomentStore.clear();
  (snapshot.shopMoments ?? []).forEach((entry) => void shopMomentStore.put(toPersistableValue(entry)));

  const settingsStore = tx.objectStore('settings');
  void settingsStore.clear();
  void settingsStore.put(toPersistableValue(snapshot.settings), 'main');

  await tx.done;
}

type StoreName = typeof storeNames[number];

function toPersistableValue<T>(value: T): T {
  return stripVueProxy(value, new WeakMap()) as T;
}

function stripVueProxy(value: unknown, seen: WeakMap<object, unknown>): unknown {
  const rawValue = toRaw(value);
  if (!rawValue || typeof rawValue !== 'object') return rawValue;

  if (rawValue instanceof Date) return new Date(rawValue);
  if (rawValue instanceof Blob) return rawValue;
  if (rawValue instanceof ArrayBuffer) return rawValue.slice(0);
  if (ArrayBuffer.isView(rawValue)) return rawValue;

  const cachedValue = seen.get(rawValue);
  if (cachedValue) return cachedValue;

  if (Array.isArray(rawValue)) {
    const nextValue: unknown[] = [];
    seen.set(rawValue, nextValue);
    rawValue.forEach((entry) => nextValue.push(stripVueProxy(entry, seen)));
    return nextValue;
  }

  if (rawValue instanceof Map) {
    const nextValue = new Map<unknown, unknown>();
    seen.set(rawValue, nextValue);
    rawValue.forEach((entryValue, entryKey) => {
      nextValue.set(stripVueProxy(entryKey, seen), stripVueProxy(entryValue, seen));
    });
    return nextValue;
  }

  if (rawValue instanceof Set) {
    const nextValue = new Set<unknown>();
    seen.set(rawValue, nextValue);
    rawValue.forEach((entry) => nextValue.add(stripVueProxy(entry, seen)));
    return nextValue;
  }

  const prototype = Object.getPrototypeOf(rawValue);
  if (prototype !== Object.prototype && prototype !== null) return rawValue;

  const nextValue: Record<string, unknown> = {};
  seen.set(rawValue, nextValue);
  Object.entries(rawValue).forEach(([key, entry]) => {
    nextValue[key] = stripVueProxy(entry, seen);
  });
  return nextValue;
}

export async function putEntity<TStore extends StoreName>(storeName: TStore, value: LinkDb[TStore]['value'], key?: LinkDb[TStore]['key']) {
  await waitForBackupReadLock();
  const db = await getDb();
  const compactedValue = await compactValueForStore(storeName, value);
  const externalizedValue = await externalizeLargeMediaRefs(compactedValue);
  const persistableValue = toPersistableValue(externalizedValue);
  if (key !== undefined) {
    await db.put(storeName, persistableValue as never, key as never);
    return;
  }
  await db.put(storeName, persistableValue as never);
}

export async function putFanficChapterBundle(book: FanficBook, chapter: FanficChapter, comments: FanficComment[]) {
  await waitForBackupReadLock();
  const db = await getDb();
  const compactedBook = await compactFanficBookInlineImages(book);
  const externalizedBook = await externalizeLargeMediaRefs(compactedBook);
  const tx = db.transaction(['fanficBooks', 'fanficChapters', 'fanficComments'], 'readwrite');
  await tx.objectStore('fanficBooks').put(toPersistableValue(externalizedBook));
  await tx.objectStore('fanficChapters').put(toPersistableValue(chapter));
  for (const comment of comments) await tx.objectStore('fanficComments').put(toPersistableValue(comment));
  await tx.done;
}

export async function putFanficHotspotComments(chapter: FanficChapter, comments: FanficComment[]) {
  await waitForBackupReadLock();
  const db = await getDb();
  const tx = db.transaction(['fanficChapters', 'fanficComments'], 'readwrite');
  await tx.objectStore('fanficChapters').put(toPersistableValue(chapter));
  for (const comment of comments) await tx.objectStore('fanficComments').put(toPersistableValue(comment));
  await tx.done;
}

export async function pruneUnusedStoredMediaCache() {
  const db = await getDb();
  const values = await Promise.all(storeNames.map((storeName) => db.getAll(storeName)));
  await pruneStoredMediaCache(collectStoredMediaLocators(values));
}

export async function deleteEntity<TStore extends StoreName>(storeName: TStore, key: LinkDb[TStore]['key']) {
  await waitForBackupReadLock();
  const db = await getDb();
  await db.delete(storeName, key as never);
}
