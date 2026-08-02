import { computed, ref, toRaw, watch } from 'vue';
import { defineStore } from 'pinia';
import { applyMemoryStoreMutation, deleteEntity, loadSnapshot, pruneUnusedStoredMediaCache, putEntity, replaceSnapshot, scheduleStartupStorageMaintenance } from '@/data/db';
import { defaultSettings } from '@/data/seed';
import type { AppSettings, AppSnapshot, CharacterProfile, CharacterProfileHistoryEntry, CharacterProfileHistoryField, ChatCallAttachment, ChatCallMode, ChatCallStatus, ChatGobangAttachment, ChatImageAttachment, ChatImageCandidate, ChatLinkPreviewAttachment, ChatLocationAttachment, ChatMcpOperation, ChatMessage, ChatMessageQuote, ChatMode, ChatModelOverrides, ChatModelScope, ChatMusicListenInviteAttachment, ChatMusicListenInviteStatus, ChatOfflineInvitationAttachment, ChatOfflineInvitationStatus, ChatSmallTheaterLinkAttachment, ChatTransferAttachment, ChatTransferStatus, ChatVoiceAttachment, Conversation, ConversationSettings, CoupleSpaceState, FavoriteMessageKind, FavoriteMessageRecord, GenerateReplyInput, GeneratedImageRecord, GroupDiscoveryCandidate, GroupMember, GroupNpcDraft, ImageModuleId, MusicCommentThread, MusicListeningContext, MusicTrack, ProfileHomepageRecord, ProfileTheme, SmallTheater, SmallTheaterTopic, Sticker, StickerGroup, UserProfile, VisualProfile, VoomComment, VoomFrequency, VoomImageCandidate, VoomPost, VoomPostVisibility, WorldBookEntry } from '@/types/domain';
import type { CharacterEconomySnapshot, ChatCommerceAttachment, ChatShopShareAttachment } from '@/types/commerce';
import type { MemoryAssertion, MemoryCompressionStats, MemoryEdge, MemoryEmbeddingCache, MemoryEntity, MemoryEpisode, MemoryRecallResult, MemoryStateSnapshot, MemoryTheme } from '@/types/memory';
import { createAccountId, createId } from '@/utils/id';
import { getCharacterAiName, getCharacterInitialProfile, getCharacterVoomAuthorName, getCharacterVoomDisplayName, getFriendRelationship, isCharacterFriend, normalizeCharacterMindStateLines, normalizeCharacterProfile } from '@/utils/character';
import { getUserAiName, getUserDisplayName, getUserVoomAuthorName, normalizeUserProfile, normalizeVisualProfile } from '@/utils/profile';
import { getImageGenerationSize, getImagePromptPresetForProvider, getSelectedImageModelOption, isImageModelSelectionDisabled, mergeVendorModels, normalizeAppSettings, normalizeChatModelOverrides } from '@/utils/settings';
import { createTabooWorldBook, isTabooWorldBook, normalizeWorldBookEntry, normalizeWorldBooks } from '@/utils/worldBook';
import { createDefaultSmallTheaterTopics, defaultSmallTheaterTopicDrafts, normalizeSmallTheaterTopic } from '@/utils/smallTheater';
import { createDefaultProfileTheme, extractProfileThemeContent, isDefaultProfileTheme, normalizeProfileTheme, normalizeProfileThemesForCharacter, normalizeProfileThemeContentLines, renderProfileThemeHtml, selectRandomEnabledProfileTheme } from '@/utils/profileThemes';
import { getSmallTheaterVisibleText } from '@/utils/smallTheaterHtml';
import { RECENT_STICKER_GROUP_NAME, cacheStickerImageUrl, createStickerFromDraft, createStickerGroup, getStickerDisplayImageUrl, isLegacyGanadiSticker, isLegacyGanadiStickerGroup, isRecentStickerGroupId, normalizeSticker, normalizeStickerGroup, shouldLocalizeStickerImageUrl, sortRecentStickers, type StickerImportDraft } from '@/utils/stickers';
import { getConversationActiveMessages, getConversationFloorCount, getConversationFloors, getMessageFloorMap, getRecentCompleteFloorMessages, normalizeConversationSettings } from '@/utils/memory';
import { resolveMemoryEpisodeFloorRange } from '@/utils/memoryFloors';
import { selectMemoryCaptureFloors } from '@/utils/memoryCapture';
import { formatContentWithChineseTranslation, normalizeTranslationText } from '@/utils/translation';
import { discoverGeneratedGroups, estimateRoleplayReplyInputTokens, fetchVendorModels, generateCoupleSpaceSnapshot, generateGroupChatReply, generateImageByProvider, generateRoleplayReply, generateSmallTheater, generateUserVoomComments, generateVoomCommentReplies, generateVoomPost, hasSelectedTextGenerationConfig, hasTextGenerationConfig, requestTextEmbedding, requestTextEmbeddings, shouldAutoGenerateMoment, type GroupDiscoveryCharacterContext, type RoleplayCallResponse, type RoleplayGobangResponse, type RoleplayReplyResult, type RoleplayReplySegment } from '@/services/ai';
import { fetchMusicCoverUrl, mergeMusicTrack, refreshPlayableMusicTrack, searchMusicTracks } from '@/services/music';
import { useMusicPlayerStore } from '@/stores/musicPlayerStore';
import { useCommerceStore } from '@/stores/commerceStore';
import { useRoleOperationsStore } from '@/stores/roleOperationsStore';
import { downloadEncryptedCloudBackup, isCloudBackupConnected, uploadEncryptedCloudBackup } from '@/services/cloudBackup';
import { GitHubBackupError, downloadGitHubBackup, downloadGitHubBackupVersion, ensureGitHubBackupRepository, formatGitHubBackupError, listGitHubBackupHistory, uploadGitHubBackup } from '@/services/githubBackup';
import { dismissLinkCallNotification, showLinkNotification } from '@/services/keepAlive';
import { persistFanficStartupCache } from '@/services/fanficStartupCache';
import { playRingtone } from '@/services/ringtone';
import { synthesizeSpeech } from '@/services/tts';
import { classifyGobangApiError, generateGobangMove, GobangApiError } from '@/services/gobang';
import { createLinkBackupFile, parseLinkBackupFileText, parseLinkBackupText, stickerBackupPlaceholder } from '@/utils/backup';
import { markRestoredGlobalNoticesSeen } from '@/utils/globalNotices';
import { getVoomFrequencyChance, stripVoomCommentReplyPrefix } from '@/utils/voom';
import { compressInlineImageDataUrl } from '@/utils/imageFile';
import { collectStoredMediaLocators, hydrateStoredMediaRefs, isLocalMediaCacheUrl, materializeStoredMediaRefs } from '@/utils/mediaStorage';
import { normalizeCoupleSpaceState } from '@/utils/coupleSpace';
import { applyGobangMove, createGobangGame, respondGobangInvitation, updateGobangApiState } from '@/utils/gobang';
import { createMemoryAssertionDedupeKey, createMemoryBrainId, createMemorySourceHash, createRecallUpserts, estimateMemoryTokens, fadeMemoryAccessibility, hashMemoryText, integrateMemoryExtraction, isMemorySourceSnapshotCurrent, latestMemoryStates, memoryId, recallCharacterMemory, refreshMemoryThemeReports, resolveMemoryEpisodeForgottenReason } from '@/utils/memoryGraph';
import { consolidateMemoryThemeReport, extractTemporalMemory, generateTemporalMemoryDiary } from '@/services/memoryExtraction';
import { registerTabooWorldBookProvider } from '@/services/tabooWorldBook';
import { createUserTimeSnapshot } from '@/utils/timeAwareness';
import { normalizeNarrativeText } from '@/utils/structuredText';
import { normalizeMcpResultAttachments } from '@/utils/mcpResults';
import { formatChatMcpOperation, formatChatMcpOperations } from '@/utils/mcpOperations';
import { createChatLinkPreview, fetchChatLinkPreview } from '@/services/linkPreview';

interface CreateUserVoomPostPayload {
  userId: string;
  content: string;
  image?: string;
  imageDescription?: string;
  visibility: VoomPostVisibility;
  characterIds: string[];
}

interface RoleplayReplyInputBundle {
  conversation: Conversation;
  character: CharacterProfile;
  boundUser: UserProfile;
  chatSettings: ConversationSettings;
  modelOverride: string;
  input: GenerateReplyInput;
  activeProfileTheme: ProfileTheme | null;
}

interface BuildRoleplayReplyInputOptions {
  mode?: ChatMode;
  proactive?: boolean;
  replyInstruction?: string;
  excludeSourceMessageIds?: string[];
  timeAwarenessNow?: number;
}

interface PendingMemoryCaptureRequest {
  force: boolean;
  waiters: Array<{
    resolve: (episode: MemoryEpisode | null) => void;
    reject: (error: unknown) => void;
  }>;
}

interface PersistableMemoryGraph {
  brainId: string;
  episodes: MemoryEpisode[];
  entities: MemoryEntity[];
  assertions: MemoryAssertion[];
  edges: MemoryEdge[];
  themes: MemoryTheme[];
  stateSnapshots: MemoryStateSnapshot[];
  embeddings: MemoryEmbeddingCache[];
}

interface RoleplayCallSessionOptions {
  callId: string;
  mode: ChatCallMode;
  forceVoice?: boolean;
}

interface RoleplayGobangSessionOptions {
  gameId: string;
}

export type AppActiveCallStatus = 'outgoing-ringing' | 'incoming-ringing' | 'active' | 'ended';

export interface AppActiveCallState {
  conversationId: string;
  callId: string;
  eventMessageId: string;
  mode: ChatCallMode;
  direction: 'incoming' | 'outgoing';
  status: AppActiveCallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  muted: boolean;
  cameraEnabled: boolean;
  speakerEnabled: boolean;
  generatedBackgroundUrl?: string;
  minimized: boolean;
  floatPosition: { x: number; y: number };
  peerName: string;
  avatar: string;
  subtitle: string;
  updatedAt: number;
}

interface RequestRoleplayReplyOptions {
  generateMoment?: boolean;
  proactive?: boolean;
  replyInstruction?: string;
  generatedReplyPayload?: string;
  preparedReplyInput?: RoleplayReplyInputBundle;
  replyVariantGroupId?: string;
  replyVariantIndex?: number;
  excludeSourceMessageIds?: string[];
  callSession?: RoleplayCallSessionOptions;
  callResponseTargetMessageId?: string;
  gobangSession?: RoleplayGobangSessionOptions;
  gobangResponseTargetMessageId?: string;
  relationshipEvent?: 'character-reapply';
  blockedInteraction?: boolean;
}

type BackupProgressCallback = (label: string, percent: number) => void | Promise<void>;

interface ImportBackupOptions {
  sourceByteSize?: number;
  onProgress?: BackupProgressCallback;
}

interface ImportBackupResult {
  slimmedForMobile: boolean;
  persistentStorageGranted: boolean;
}

interface ConfigAlertAction {
  label: string;
  runningLabel?: string;
  run: () => void | Promise<void>;
}

interface ConfigAlertState {
  open: boolean;
  title: string;
  message: string;
  action?: ConfigAlertAction;
}

export type DataCleanupAction = 'generated-images' | 'message-media' | 'user-sent-images' | 'sticker-local-cache' | 'image-candidates' | 'voice-audio';
export type ClearableDataSection = 'messages' | 'favorites' | 'voomPosts' | 'smallTheaters' | 'music' | 'worldBooks' | 'stickers' | 'conversationSettings' | 'characterMemory' | 'generatedImages';

const globalSharedLibraryOwnerId = '__global__';

interface ProfileHistorySource {
  sourceConversationId?: string;
  sourceReplyBatchId?: string;
}

const oneDayMs = 24 * 60 * 60 * 1000;

function mergeMemoryEntities<T extends { id: string }>(current: T[], upserts: T[]): T[] {
  if (!upserts.length) return current;
  const nextById = new Map(current.map((item) => [item.id, item]));
  upserts.forEach((item) => nextById.set(item.id, item));
  return [...nextById.values()];
}

function getCharacterTrackedMood(character: CharacterProfile) {
  return normalizeCharacterMindStateLines(character.mindState?.lines).join('\n');
}

function replaceMemoryContextTokens(value: string, characterName: string, userName: string) {
  return String(value ?? '')
    .replace(/\{\{\s*char\s*\}\}/gi, characterName)
    .replace(/<\s*char\s*>/gi, characterName)
    .replace(/\{\{\s*user\s*\}\}/gi, userName)
    .replace(/<\s*user\s*>/gi, userName);
}

function buildMemoryCharacterContext(character: CharacterProfile, boundUser: UserProfile) {
  const characterName = getCharacterAiName(character);
  const userName = getUserAiName(boundUser);
  return [
    `角色真实姓名：${characterName}`,
    character.nickname ? `角色当前昵称：${character.nickname}` : '',
    character.signature ? `角色个性签名：${replaceMemoryContextTokens(character.signature, characterName, userName)}` : '',
    character.description ? `角色详细设定：\n${replaceMemoryContextTokens(character.description, characterName, userName)}` : '',
    `当前互动对象：${userName}`,
    boundUser.nickname ? `互动对象昵称：${boundUser.nickname}` : '',
    boundUser.signature ? `互动对象签名：${replaceMemoryContextTokens(boundUser.signature, characterName, userName)}` : '',
    boundUser.description ? `互动对象资料：\n${replaceMemoryContextTokens(boundUser.description, characterName, userName)}` : ''
  ].filter(Boolean).join('\n\n').slice(0, 10_000);
}

function buildMemoryWorldBookContext(
  character: CharacterProfile,
  boundUser: UserProfile,
  mode: ChatMode,
  books: WorldBookEntry[],
  activationText: string
) {
  const characterName = getCharacterAiName(character);
  const userName = getUserAiName(boundUser);
  const normalizedActivationText = activationText.toLocaleLowerCase();
  const selectedBooks = books.filter((book) => {
    if (!book.enabled || isTabooWorldBook(book)) return false;
    if (book.scope === 'local') return character.localWorldBookIds.includes(book.id);
    return book.scope === (mode === 'online' ? 'global-online' : 'global-offline');
  });
  const blocks = selectedBooks.flatMap((book) => {
    const legacyContent = book.content.trim()
      ? [`【${book.title || '未命名世界书'}】\n${book.content}`]
      : [];
    const entries = [...book.entries]
      .filter((entry) => {
        if (!entry.enabled || entry.probability <= 0) return false;
        if (book.scope === 'local' || entry.activation === 'constant' || entry.activation === 'priority') return true;
        const matches = (key: string) => entry.caseSensitive
          ? activationText.includes(key)
          : normalizedActivationText.includes(key.toLocaleLowerCase());
        return entry.keys.some(matches) && (!entry.secondaryKeys.length || entry.secondaryKeys.some(matches));
      })
      .sort((left, right) => Number(right.activation === 'priority') - Number(left.activation === 'priority') || left.order - right.order)
      .map((entry) => `【${book.title || '未命名世界书'} / ${entry.title || '未命名条目'}】\n${entry.content}`);
    return [...legacyContent, ...entries];
  });
  return replaceMemoryContextTokens(blocks.join('\n\n'), characterName, userName).slice(0, 14_000);
}

function createCharacterProfileHistoryEntries(previousCharacter: CharacterProfile, nextCharacter: CharacterProfile, source: ProfileHistorySource = {}): CharacterProfileHistoryEntry[] {
  const createdAt = Date.now();
  const changes: Array<{ field: CharacterProfileHistoryField; previousValue: string; nextValue: string }> = [
    { field: 'nickname', previousValue: previousCharacter.nickname, nextValue: nextCharacter.nickname },
    { field: 'signature', previousValue: previousCharacter.signature, nextValue: nextCharacter.signature },
    { field: 'mood', previousValue: getCharacterTrackedMood(previousCharacter), nextValue: getCharacterTrackedMood(nextCharacter) }
  ];

  return changes.flatMap((change) => {
    const previousValue = String(change.previousValue ?? '').trim();
    const nextValue = String(change.nextValue ?? '').trim();
    if (previousValue === nextValue) return [];
    return [{
      id: createId('profile-history'),
      field: change.field,
      previousValue,
      nextValue,
      createdAt,
      ...(source.sourceConversationId ? { sourceConversationId: source.sourceConversationId } : {}),
      ...(source.sourceReplyBatchId ? { sourceReplyBatchId: source.sourceReplyBatchId } : {})
    }];
  });
}

export const useAppStore = defineStore('app', () => {
  const ready = ref(false);
  let hydratePromise: Promise<void> | null = null;
  let githubBackupRunning = false;
  let cloudBackupRunning = false;
  let stickerImportCacheQueue = Promise.resolve();
  const capturingMemoryConversationIds = new Set<string>();
  const capturingMemoryBrainIds = new Set<string>();
  const rebuildingMemoryBrainIds = new Set<string>();
  const pendingMemoryCaptureRequests = new Map<string, PendingMemoryCaptureRequest>();
  const generatingMomentConversationIds = new Set<string>();
  const generatingSmallTheaterConversationIds = new Set<string>();
  const regeneratingChatImageMessageIds = new Set<string>();
  const regeneratingVoomImagePostIds = new Set<string>();
  const activeReplyRunIds = new Map<string, string>();
  const activeGobangRequestIds = new Map<string, string>();
  const replyCancelVersions = new Map<string, number>();
  const characterReadReceiptTimers = new Map<string, number>();
  const replyingConversationIds = ref<string[]>([]);
  const loadingReply = computed(() => replyingConversationIds.value.length > 0);
  const replyingVoomCommentPostIds = ref<string[]>([]);
  const suppressedVoomNoticeKeys = ref<string[]>([]);
  const configAlert = ref<ConfigAlertState>({ open: false, title: '提示', message: '' });
  const users = ref<UserProfile[]>([]);
  const characters = ref<CharacterProfile[]>([]);
  const conversations = ref<Conversation[]>([]);
  const activeConversationId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const activeCall = ref<AppActiveCallState | null>(null);
  const voomPosts = ref<VoomPost[]>([]);
  const profileThemes = ref<ProfileTheme[]>([]);
  const profileHomepages = ref<ProfileHomepageRecord[]>([]);
  const smallTheaterTopics = ref<SmallTheaterTopic[]>([]);
  const smallTheaters = ref<SmallTheater[]>([]);
  const musicFavoriteTracks = ref<MusicTrack[]>([]);
  const musicCommentThreads = ref<MusicCommentThread[]>([]);
  const worldBooks = ref<WorldBookEntry[]>([]);
  registerTabooWorldBookProvider(() => worldBooks.value);
  const stickerGroups = ref<StickerGroup[]>([]);
  const stickers = ref<Sticker[]>([]);
  const conversationSettings = ref<ConversationSettings[]>([]);
  const memoryEpisodes = ref<MemoryEpisode[]>([]);
  const memoryEntities = ref<MemoryEntity[]>([]);
  const memoryAssertions = ref<MemoryAssertion[]>([]);
  const memoryEdges = ref<MemoryEdge[]>([]);
  const memoryThemes = ref<MemoryTheme[]>([]);
  const memoryStateSnapshots = ref<MemoryStateSnapshot[]>([]);
  const memoryEmbeddings = ref<MemoryEmbeddingCache[]>([]);
  const generatedImages = ref<GeneratedImageRecord[]>([]);
  const musicPlayer = useMusicPlayerStore();
  const favorites = ref<FavoriteMessageRecord[]>([]);
  const settings = ref<AppSettings | null>(null);
  const user = computed(() => {
    if (!users.value.length) return null;
    const activeUserId = settings.value?.activeUserId?.trim();
    return users.value.find((item) => item.id === activeUserId) ?? users.value[0] ?? null;
  });

  const charactersForActiveUser = computed(() => {
    const activeUserId = user.value?.id;
    const scopedCharacters = activeUserId ? characters.value.filter((character) => character.boundUserId === activeUserId) : characters.value;
    return scopedCharacters.filter(isCharacterFriend);
  });
  const conversationsForActiveUser = computed(() => {
    const activeUserId = user.value?.id;
    return activeUserId ? conversations.value.filter((conversation) => conversation.userId === activeUserId) : conversations.value;
  });
  const displayAllFriends = computed(() => settings.value?.friendsDisplayScope === 'all-users');
  const charactersForFriendsDisplay = computed(() => displayAllFriends.value ? characters.value.filter(isCharacterFriend) : charactersForActiveUser.value);
  const conversationsForFriendsDisplay = computed(() => displayAllFriends.value ? conversations.value : conversationsForActiveUser.value);
  const sortedConversations = computed(() => [...conversationsForActiveUser.value].sort((a, b) => b.updatedAt - a.updatedAt));
  const sortedVoomPosts = computed(() => [...voomPosts.value].sort((a, b) => b.createdAt - a.createdAt));
  const sortedProfileHomepages = computed(() => [...profileHomepages.value].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)));
  const sortedSmallTheaters = computed(() => [...smallTheaters.value].sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt)));
  const sortedStickerGroups = computed(() => [...stickerGroups.value].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? a.createdAt) - (b.sortOrder ?? b.createdAt);
    if (orderDiff) return orderDiff;
    const createdDiff = a.createdAt - b.createdAt;
    if (createdDiff) return createdDiff;
    return a.id.localeCompare(b.id);
  }));
  const sortedStickers = computed(() => [...stickers.value].sort((a, b) => b.updatedAt - a.updatedAt));
  const recentStickers = computed(() => sortRecentStickers(stickers.value));
  const unreadConversationCount = computed(() => conversationsForActiveUser.value.reduce((total, conversation) => total + conversation.unreadCount, 0));
  const accounts = computed(() => users.value);

  const usersById = computed(() => new Map(users.value.map((account) => [account.id, account])));
  const charactersById = computed(() => new Map(characters.value.map((character) => [character.id, character])));
  const conversationsById = computed(() => new Map(conversations.value.map((conversation) => [conversation.id, conversation])));
  const messagesByConversationId = computed(() => {
    const groupedMessages = new Map<string, ChatMessage[]>();
    for (const message of messages.value) {
      const conversationMessages = groupedMessages.get(message.conversationId) ?? [];
      conversationMessages.push(message);
      groupedMessages.set(message.conversationId, conversationMessages);
    }
    for (const conversationMessages of groupedMessages.values()) {
      conversationMessages.sort((leftMessage, rightMessage) => leftMessage.createdAt - rightMessage.createdAt);
    }
    return groupedMessages;
  });
  const conversationSettingsById = computed(() => new Map(conversationSettings.value.map((entry) => [entry.conversationId, entry])));
  const normalizedConversationSettingsById = computed(() => {
    const normalizedSettings = new Map<string, ConversationSettings>();
    for (const entry of conversationSettings.value) {
      const conversation = conversationsById.value.get(entry.conversationId);
      normalizedSettings.set(entry.conversationId, normalizeConversationSettings(entry, entry.conversationId, conversation?.activeMode));
    }
    for (const conversation of conversations.value) {
      if (normalizedSettings.has(conversation.id)) continue;
      const character = charactersById.value.get(conversation.charId);
      normalizedSettings.set(conversation.id, normalizeConversationSettings({ voomFrequency: character?.voomFrequency }, conversation.id, conversation.activeMode));
    }
    return normalizedSettings;
  });
  const stickersByPrimaryGroupId = computed(() => {
    const groupedStickers = new Map<string, Sticker[]>();
    for (const sticker of sortedStickers.value) {
      const groupId = sticker.groupIds[0] ?? '';
      if (!groupId) continue;
      const groupStickers = groupedStickers.get(groupId) ?? [];
      groupStickers.push(sticker);
      groupedStickers.set(groupId, groupStickers);
    }
    return groupedStickers;
  });

  function normalizeStickerLibrary(rawGroups: StickerGroup[], rawStickers: Sticker[]) {
    const removedGroupIds = new Set<string>();
    const removedStickerIds = new Set<string>();
    const normalizedGroups = rawGroups
      .map((entry) => normalizeStickerGroup(entry))
      .filter((entry): entry is StickerGroup => Boolean(entry))
      .filter((entry) => {
        if (isRecentStickerGroupId(entry.id) || isLegacyGanadiStickerGroup(entry)) {
          removedGroupIds.add(entry.id);
          return false;
        }
        return true;
      });
    const fallbackGroupId = normalizedGroups[0]?.id ?? '';
    const normalizedStickers = rawStickers
      .map((entry) => normalizeSticker(entry, fallbackGroupId))
      .filter((entry): entry is Sticker => Boolean(entry))
      .filter((entry) => {
        if (isLegacyGanadiSticker(entry) || entry.groupIds.some((id) => removedGroupIds.has(id) || isRecentStickerGroupId(id))) {
          removedStickerIds.add(entry.id);
          return false;
        }
        return true;
      });
    return {
      groups: normalizedGroups,
      stickers: normalizedStickers,
      removedGroupIds: [...removedGroupIds],
      removedStickerIds: [...removedStickerIds]
    };
  }

  function normalizeSnapshotForRestore(snapshot: AppSnapshot): AppSnapshot {
    const normalizedUsers = snapshot.users.map((entry) => normalizeUserProfile(entry));
    if (!normalizedUsers.length) throw new Error('备份文件里没有用户资料。');

    const fallbackUserId = snapshot.settings.activeUserId || normalizedUsers[0].id;
    const stickerLibrary = normalizeStickerLibrary(snapshot.stickerGroups, snapshot.stickers);

    const normalizedSettings = normalizeAppSettings({
      ...defaultSettings,
      ...snapshot.settings,
      activeUserId: snapshot.settings.activeUserId || normalizedUsers[0].id
    });
    const sharedLibraryData = normalizeSharedLibraryData({
      profileThemes: snapshot.profileThemes ?? [],
      smallTheaterTopics: snapshot.smallTheaterTopics ?? [],
      settings: normalizedSettings
    });

    return {
      users: normalizedUsers,
      characters: snapshot.characters.map((entry) => normalizeCharacterProfile(entry, fallbackUserId)),
      conversations: snapshot.conversations,
      messages: snapshot.messages,
      voomPosts: snapshot.voomPosts,
      profileThemes: sharedLibraryData.profileThemes,
      profileHomepages: normalizeStoredProfileHomepages(snapshot.profileHomepages ?? []),
      smallTheaterTopics: sharedLibraryData.smallTheaterTopics,
      smallTheaters: snapshot.smallTheaters ?? [],
      fanficBooks: snapshot.fanficBooks ?? [],
      fanficChapters: snapshot.fanficChapters ?? [],
      fanficComments: snapshot.fanficComments ?? [],
      fanficTopics: snapshot.fanficTopics ?? [],
      fanficGenerationJobs: snapshot.fanficGenerationJobs ?? [],
      musicFavoriteTracks: snapshot.musicFavoriteTracks ?? [],
      musicCommentThreads: snapshot.musicCommentThreads ?? [],
      worldBooks: normalizeWorldBooks(snapshot.worldBooks),
      stickerGroups: stickerLibrary.groups,
      stickers: stickerLibrary.stickers,
      conversationSettings: snapshot.conversationSettings.map((entry) => normalizeConversationSettings({
        ...entry,
        characterStickerGroupIds: entry.characterStickerGroupIds.filter((id) => !isRecentStickerGroupId(id) && !stickerLibrary.removedGroupIds.includes(id))
      }, entry.conversationId, snapshot.conversations.find((conversation) => conversation.id === entry.conversationId)?.activeMode)),
      memoryEpisodes: snapshot.memoryEpisodes ?? [],
      memoryEntities: snapshot.memoryEntities ?? [],
      memoryAssertions: snapshot.memoryAssertions ?? [],
      memoryEdges: snapshot.memoryEdges ?? [],
      memoryThemes: snapshot.memoryThemes ?? [],
      memoryStateSnapshots: snapshot.memoryStateSnapshots ?? [],
      memoryEmbeddings: snapshot.memoryEmbeddings ?? [],
      generatedImages: normalizeGeneratedImages(snapshot.generatedImages ?? []),
      favorites: normalizeFavorites(snapshot.favorites ?? []),
      walletAccounts: snapshot.walletAccounts ?? [],
      walletTransactions: snapshot.walletTransactions ?? [],
      shopStorefronts: snapshot.shopStorefronts ?? [],
      shopProducts: snapshot.shopProducts ?? [],
      shopCartItems: snapshot.shopCartItems ?? [],
      shopWishlistItems: snapshot.shopWishlistItems ?? [],
      shopOrders: snapshot.shopOrders ?? [],
      shopMoments: snapshot.shopMoments ?? [],
      roleSocialAccounts: snapshot.roleSocialAccounts ?? [],
      userSocialAccounts: snapshot.userSocialAccounts ?? [],
      roleContentDrafts: snapshot.roleContentDrafts ?? [],
      roleOutboundTasks: snapshot.roleOutboundTasks ?? [],
      roleOperationPolicies: snapshot.roleOperationPolicies ?? [],
      roleOperationAudits: snapshot.roleOperationAudits ?? [],
      settings: sharedLibraryData.settings
    };
  }


  function keepDeviceBackupSettings(snapshot: AppSnapshot): AppSnapshot {
    const currentGitHubBackup = settings.value?.githubBackup;
    const currentCloudBackup = settings.value?.cloudBackup;
    if (!currentGitHubBackup && !currentCloudBackup) return snapshot;

    return {
      ...snapshot,
      settings: normalizeAppSettings({
        ...snapshot.settings,
        ...(currentGitHubBackup ? { githubBackup: currentGitHubBackup } : {}),
        ...(currentCloudBackup ? { cloudBackup: currentCloudBackup } : {})
      })
    };
  }

  function applySnapshotToStore(snapshot: AppSnapshot) {
    const sharedLibraryData = normalizeSharedLibraryData({
      profileThemes: snapshot.profileThemes ?? [],
      smallTheaterTopics: snapshot.smallTheaterTopics ?? [],
      settings: snapshot.settings
    });
    users.value = snapshot.users;
    characters.value = snapshot.characters;
    conversations.value = snapshot.conversations;
    voomPosts.value = snapshot.voomPosts.map((post) => normalizeStoredVoomPostIdentityReferences(post));
    messages.value = snapshot.messages
      .map((message) => normalizeStoredMessageAuthorReference(message))
      .map((message) => normalizeStoredVoomEventMessage(message, voomPosts.value));
    profileThemes.value = sharedLibraryData.profileThemes;
    profileHomepages.value = normalizeStoredProfileHomepages(snapshot.profileHomepages ?? []);
    smallTheaterTopics.value = sharedLibraryData.smallTheaterTopics;
    smallTheaters.value = normalizeStoredSmallTheaters(snapshot.smallTheaters ?? []);
    musicFavoriteTracks.value = snapshot.musicFavoriteTracks ?? [];
    musicCommentThreads.value = normalizeStoredMusicCommentThreads(snapshot.musicCommentThreads ?? []);
    worldBooks.value = snapshot.worldBooks;
    stickerGroups.value = snapshot.stickerGroups;
    stickers.value = snapshot.stickers;
    conversationSettings.value = snapshot.conversationSettings;
    memoryEpisodes.value = snapshot.memoryEpisodes ?? [];
    memoryEntities.value = snapshot.memoryEntities ?? [];
    memoryAssertions.value = snapshot.memoryAssertions ?? [];
    memoryEdges.value = snapshot.memoryEdges ?? [];
    memoryThemes.value = snapshot.memoryThemes ?? [];
    memoryStateSnapshots.value = snapshot.memoryStateSnapshots ?? [];
    memoryEmbeddings.value = snapshot.memoryEmbeddings ?? [];
    generatedImages.value = snapshot.generatedImages;
    favorites.value = normalizeFavorites(snapshot.favorites ?? []);
    settings.value = sharedLibraryData.settings;
    activeConversationId.value = null;
    ready.value = true;
  }

  function prepareSnapshotForStore(snapshot: AppSnapshot): AppSnapshot {
    const sharedLibraryData = normalizeSharedLibraryData({
      profileThemes: snapshot.profileThemes ?? [],
      smallTheaterTopics: snapshot.smallTheaterTopics ?? [],
      settings: snapshot.settings
    });
    const normalizedVoomPosts = snapshot.voomPosts.map((post) => normalizeStoredVoomPostIdentityReferences(post));
    return {
      ...snapshot,
      profileThemes: sharedLibraryData.profileThemes,
      smallTheaterTopics: sharedLibraryData.smallTheaterTopics,
      messages: snapshot.messages
        .map((message) => normalizeStoredMessageAuthorReference(message))
        .map((message) => normalizeStoredVoomEventMessage(message, normalizedVoomPosts)),
      voomPosts: normalizedVoomPosts,
      profileHomepages: normalizeStoredProfileHomepages(snapshot.profileHomepages ?? []),
      smallTheaters: normalizeStoredSmallTheaters(snapshot.smallTheaters ?? []),
      musicCommentThreads: normalizeStoredMusicCommentThreads(snapshot.musicCommentThreads ?? []),
      favorites: normalizeFavorites(snapshot.favorites ?? []),
      settings: sharedLibraryData.settings
    };
  }

  function stripRestoreEmbeddingCache(snapshot: AppSnapshot): AppSnapshot {
    return {
      ...snapshot,
      memoryEmbeddings: []
    };
  }

  async function requestPersistentStorage() {
    const storage = typeof navigator === 'undefined' ? undefined : navigator.storage;
    if (!storage?.persist) return false;
    try {
      if (storage.persisted && await storage.persisted()) return true;
      return await storage.persist();
    } catch {
      return false;
    }
  }

  function normalizeImportPersistenceError(error: unknown) {
    const errorName = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : '';
    if (/quota|storage|disk|space|abort/i.test(`${errorName} ${message}`)) {
      return new Error('本机存储空间不足，导入没有写入。请先到“设置 > 数据管理”清理生成图历史、消息媒体缓存、语音音频缓存后再试，或改用安装后的 PWA/空间更大的浏览器。');
    }
    return error instanceof Error ? error : new Error('导入失败，当前本地数据未被替换。');
  }

  function normalizeInterruptedGobangRequest(message: ChatMessage) {
    const game = message.gobang;
    if (!game || (game.invitationStatus ?? 'accepted') !== 'accepted' || game.status !== 'active' || game.turn !== 'char' || game.apiState?.status !== 'requesting') return message;
    const interruptedGame = updateGobangApiState(game, {
      ...game.apiState,
      status: 'interrupted',
      errorCode: 'interrupted',
      error: '上一次角色落子请求已中断，请重试这一手。'
    });
    return {
      ...message,
      content: formatGobangContent(interruptedGame),
      gobang: interruptedGame,
      editedAt: interruptedGame.updatedAt
    };
  }

  async function hydrate() {
    if (ready.value) return;
    if (hydratePromise) return hydratePromise;
    hydratePromise = (async () => {
    const storedSnapshot = await loadSnapshot();
    persistFanficStartupCache({
      books: storedSnapshot.fanficBooks ?? [],
      chapters: storedSnapshot.fanficChapters ?? [],
      topics: storedSnapshot.fanficTopics ?? [],
      jobs: storedSnapshot.fanficGenerationJobs ?? []
    });
    const snapshot = await hydrateStoredMediaRefs(storedSnapshot);
    users.value = snapshot.users.map((entry) => normalizeUserProfile(entry));
    const fallbackUserId = snapshot.settings.activeUserId || snapshot.users[0]?.id || '';
    characters.value = snapshot.characters.map((entry) => normalizeCharacterProfile(entry, fallbackUserId));
    conversations.value = snapshot.conversations;
    voomPosts.value = snapshot.voomPosts.map((post) => normalizeStoredVoomPostIdentityReferences(post));
    messages.value = snapshot.messages
      .map((message) => normalizeInterruptedGobangRequest(normalizeStoredMessageAuthorReference(message)))
      .map((message) => normalizeStoredVoomEventMessage(message, voomPosts.value));
    profileThemes.value = normalizeStoredProfileThemes(snapshot.profileThemes ?? []);
    profileHomepages.value = normalizeStoredProfileHomepages(snapshot.profileHomepages ?? []);
    smallTheaterTopics.value = snapshot.smallTheaterTopics ?? [];
    smallTheaters.value = normalizeStoredSmallTheaters(snapshot.smallTheaters ?? []);
    musicFavoriteTracks.value = snapshot.musicFavoriteTracks ?? [];
    musicCommentThreads.value = normalizeStoredMusicCommentThreads(snapshot.musicCommentThreads ?? []);
    worldBooks.value = snapshot.worldBooks;
    const tabooWorldBook = worldBooks.value.find((book) => isTabooWorldBook(book));
    if (tabooWorldBook) await putEntity('worldBooks', tabooWorldBook);
    const stickerLibrary = normalizeStickerLibrary(snapshot.stickerGroups, snapshot.stickers);
    stickerGroups.value = stickerLibrary.groups;
    stickers.value = stickerLibrary.stickers;
    favorites.value = normalizeFavorites(snapshot.favorites ?? []);
    if (stickerLibrary.removedGroupIds.length || stickerLibrary.removedStickerIds.length) {
      await Promise.all([
        ...stickerLibrary.removedGroupIds.map((groupId) => deleteEntity('stickerGroups', groupId)),
        ...stickerLibrary.removedStickerIds.map((stickerId) => deleteEntity('stickers', stickerId)),
        ...stickerLibrary.stickers.map((sticker) => putEntity('stickers', sticker))
      ]);
    }
    const changedIdentityMessages = messages.value.filter((message, index) => message !== snapshot.messages[index]);
    const changedIdentityPosts = voomPosts.value.filter((post, index) => post !== snapshot.voomPosts[index]);
    const rawSmallTheaters = snapshot.smallTheaters ?? [];
    const changedIdentityTheaters = smallTheaters.value.filter((theater, index) => theater !== rawSmallTheaters[index]);
    const rawMusicThreads = snapshot.musicCommentThreads ?? [];
    const changedIdentityMusicThreads = musicCommentThreads.value.filter((thread, index) => thread !== rawMusicThreads[index]);
    const rawFavorites = snapshot.favorites ?? [];
    const keptFavoriteIds = new Set(favorites.value.map((favorite) => favorite.id));
    const removedFavoriteIds = rawFavorites
      .filter((favorite) => favorite?.id && !keptFavoriteIds.has(favorite.id))
      .map((favorite) => favorite.id);
    const changedIdentityFavorites = favorites.value.filter((favorite, index) => JSON.stringify(favorite) !== JSON.stringify(rawFavorites[index]));
    if (changedIdentityMessages.length || changedIdentityPosts.length || changedIdentityTheaters.length || changedIdentityMusicThreads.length || changedIdentityFavorites.length || removedFavoriteIds.length) {
      await Promise.all([
        ...changedIdentityMessages.map((message) => putEntity('messages', message)),
        ...changedIdentityPosts.map((post) => putEntity('voomPosts', createPersistableVoomPost(post))),
        ...changedIdentityTheaters.map((theater) => putEntity('smallTheaters', theater)),
        ...changedIdentityMusicThreads.map((thread) => putEntity('musicCommentThreads', thread)),
        ...changedIdentityFavorites.map((favorite) => putEntity('favorites', favorite)),
        ...removedFavoriteIds.map((favoriteId) => deleteEntity('favorites', favoriteId))
      ]);
    }
    conversationSettings.value = snapshot.conversationSettings.map((entry) => normalizeConversationSettings({
      ...entry,
      characterStickerGroupIds: entry.characterStickerGroupIds.filter((id) => !isRecentStickerGroupId(id) && !stickerLibrary.removedGroupIds.includes(id))
    }, entry.conversationId, snapshot.conversations.find((conversation) => conversation.id === entry.conversationId)?.activeMode));
    memoryEpisodes.value = snapshot.memoryEpisodes ?? [];
    memoryEntities.value = snapshot.memoryEntities ?? [];
    memoryAssertions.value = snapshot.memoryAssertions ?? [];
    memoryEdges.value = snapshot.memoryEdges ?? [];
    memoryThemes.value = snapshot.memoryThemes ?? [];
    memoryStateSnapshots.value = snapshot.memoryStateSnapshots ?? [];
    memoryEmbeddings.value = snapshot.memoryEmbeddings ?? [];
    generatedImages.value = normalizeGeneratedImages(snapshot.generatedImages ?? []);
    favorites.value = normalizeFavorites(favorites.value);
    settings.value = normalizeAppSettings({
      ...snapshot.settings,
      activeUserId: snapshot.settings.activeUserId || snapshot.users[0]?.id || ''
    });
    const rawProfileThemes = profileThemes.value;
    const rawSmallTheaterTopics = smallTheaterTopics.value;
    const rawSettings = settings.value;
    const sharedLibraryData = normalizeSharedLibraryData({
      profileThemes: rawProfileThemes,
      smallTheaterTopics: rawSmallTheaterTopics,
      settings: rawSettings
    });
    const sharedLibraryChanged = sharedLibraryData.removedProfileThemeIds.length > 0
      || sharedLibraryData.removedSmallTheaterTopicIds.length > 0
      || rawProfileThemes.length !== sharedLibraryData.profileThemes.length
      || rawSmallTheaterTopics.length !== sharedLibraryData.smallTheaterTopics.length
      || rawProfileThemes.some((theme, index) => theme.id !== sharedLibraryData.profileThemes[index]?.id || theme.charId !== sharedLibraryData.profileThemes[index]?.charId || theme.enabled !== sharedLibraryData.profileThemes[index]?.enabled)
      || rawSmallTheaterTopics.some((topic, index) => topic.id !== sharedLibraryData.smallTheaterTopics[index]?.id || topic.charId !== sharedLibraryData.smallTheaterTopics[index]?.charId || topic.enabled !== sharedLibraryData.smallTheaterTopics[index]?.enabled)
      || JSON.stringify(rawSettings.profileThemeEnabledByCharacter) !== JSON.stringify(sharedLibraryData.settings.profileThemeEnabledByCharacter)
      || JSON.stringify(rawSettings.smallTheaterTopicEnabledByCharacter) !== JSON.stringify(sharedLibraryData.settings.smallTheaterTopicEnabledByCharacter);
    profileThemes.value = sharedLibraryData.profileThemes;
    smallTheaterTopics.value = sharedLibraryData.smallTheaterTopics;
    settings.value = sharedLibraryData.settings;
    if (sharedLibraryChanged) {
      await Promise.all([
        ...profileThemes.value.map((theme) => putEntity('profileThemes', theme)),
        ...smallTheaterTopics.value.map((topic) => putEntity('smallTheaterTopics', topic)),
        ...sharedLibraryData.removedProfileThemeIds.map((themeId) => deleteEntity('profileThemes', themeId)),
        ...sharedLibraryData.removedSmallTheaterTopicIds.map((topicId) => deleteEntity('smallTheaterTopics', topicId)),
        putEntity('settings', settings.value, 'main')
      ]);
    }
    syncPendingIncomingCall();
    ready.value = true;
    queueMissingStickerImageCaches();
    const storedTransferMessages = messages.value.filter((message) => message.transfer && !message.transfer.responseToMessageId && message.sender !== 'system');
    for (const transferMessage of storedTransferMessages) {
      try {
        await syncChatTransferLedger(transferMessage);
      } catch (error) {
        console.warn('Stored chat transfer ledger reconciliation failed.', error);
      }
    }
    scheduleStartupStorageMaintenance();
    void refreshEnabledVendorModels();
    })().finally(() => {
      hydratePromise = null;
    });
    return hydratePromise;
  }

  function userById(id: string) {
    return usersById.value.get(id);
  }

  function characterById(id: string) {
    return charactersById.value.get(id);
  }

  function conversationById(id: string) {
    return conversationsById.value.get(id);
  }

  function setActiveCall(nextCall: Omit<AppActiveCallState, 'updatedAt'>) {
    activeCall.value = {
      ...nextCall,
      floatPosition: { ...nextCall.floatPosition },
      updatedAt: Date.now()
    };
  }

  function patchActiveCall(conversationId: string, patch: Partial<Omit<AppActiveCallState, 'conversationId' | 'updatedAt'>>) {
    if (!activeCall.value || activeCall.value.conversationId !== conversationId) return;
    activeCall.value = {
      ...activeCall.value,
      ...patch,
      floatPosition: patch.floatPosition ? { ...patch.floatPosition } : activeCall.value.floatPosition,
      updatedAt: Date.now()
    };
  }

  function clearActiveCall(conversationId?: string) {
    if (conversationId && activeCall.value?.conversationId !== conversationId) return;
    activeCall.value = null;
  }

  function setActiveConversation(conversationId: string | null) {
    activeConversationId.value = conversationId;
  }

  function unreadCountAfterIncomingMessage(conversation: Conversation, messageCount: number) {
    return activeConversationId.value === conversation.id ? 0 : conversation.unreadCount + messageCount;
  }

  function messagesForConversation(id: string) {
    return messagesByConversationId.value.get(id) ?? [];
  }

  function normalizeGeneratedImages(entries: GeneratedImageRecord[]) {
    return entries
      .map((entry) => ({
        ...entry,
        provider: (['openai', 'novelai', 'pollinations'].includes(entry.provider) ? entry.provider : 'openai') as ImageModuleId,
        imageUrl: String(entry.imageUrl ?? '').trim(),
        title: String(entry.title ?? '').trim(),
        prompt: String(entry.prompt ?? '').trim(),
        negativePrompt: String(entry.negativePrompt ?? '').trim(),
        model: String(entry.model ?? '').trim(),
        size: String(entry.size ?? '').trim(),
        source: ['settings', 'world-book', 'voom'].includes(entry.source) ? entry.source : 'settings',
        createdAt: Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
      } satisfies GeneratedImageRecord))
      .filter((entry) => entry.id && entry.imageUrl);
  }

  function generatedImagesForProvider(provider: ImageModuleId) {
    return generatedImages.value
      .filter((entry) => entry.provider === provider)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  function settingsForConversation(id: string) {
    const cachedSettings = normalizedConversationSettingsById.value.get(id);
    if (cachedSettings) return cachedSettings;
    const existing = conversationSettingsById.value.get(id);
    const conversation = conversationById(id);
    if (existing) return normalizeConversationSettings(existing, id, conversation?.activeMode);
    const character = conversation ? characterById(conversation.charId) : null;
    return normalizeConversationSettings({ voomFrequency: character?.voomFrequency }, id, conversation?.activeMode);
  }

  function stickersForGroup(groupId: string) {
    if (isRecentStickerGroupId(groupId)) return recentStickers.value;
    if (!groupId || groupId === 'all') return sortedStickers.value;
    return stickersByPrimaryGroupId.value.get(groupId) ?? [];
  }

  function stickersForGroups(groupIds: string[]) {
    const groupIdSet = new Set(groupIds.map((id) => id.trim()).filter((id) => Boolean(id) && !isRecentStickerGroupId(id)));
    if (!groupIdSet.size) return [];
    const resolvedStickers: Sticker[] = [];
    const seenStickerIds = new Set<string>();
    for (const groupId of groupIdSet) {
      const groupStickers = stickersByPrimaryGroupId.value.get(groupId) ?? [];
      for (const sticker of groupStickers) {
        if (seenStickerIds.has(sticker.id)) continue;
        seenStickerIds.add(sticker.id);
        resolvedStickers.push(sticker);
      }
    }
    return resolvedStickers;
  }

  function resolveCharacterStickerSelections(selections: string[] | undefined, allowedStickers: Sticker[]) {
    if (!selections?.length || !allowedStickers.length) return [];
    const byId = new Map(allowedStickers.map((sticker) => [sticker.id.toLocaleLowerCase(), sticker]));
    const byDescription = new Map(allowedStickers.map((sticker) => [sticker.description.toLocaleLowerCase(), sticker]));
    const resolved: Sticker[] = [];
    const seenIds = new Set<string>();
    for (const selection of selections) {
      const key = selection.trim().toLocaleLowerCase();
      if (!key) continue;
      const sticker = byId.get(key) ?? byDescription.get(key);
      if (!sticker || seenIds.has(sticker.id)) continue;
      seenIds.add(sticker.id);
      resolved.push(sticker);
    }
    return resolved.slice(0, 4);
  }

  function visibleMessagesForConversation(id: string) {
    return getConversationActiveMessages(messagesForConversation(id));
  }

  function promptMessagesForConversation(id: string) {
    const activeMessages = visibleMessagesForConversation(id);
    const memorySettings = settingsForConversation(id).memory;
    const conversationEpisodes = memoryGraphForConversation(id).episodes.filter((episode) => episode.conversationId === id);
    const forgottenMessageIds = new Set(
      conversationEpisodes
        .filter((episode) => episode.status === 'forgotten' && episode.forgottenReason !== 'source-invalidated')
        .flatMap((episode) => episode.sourceMessageIds)
    );
    const recallableMessages = activeMessages.filter((message) => !forgottenMessageIds.has(message.id));
    if (!memorySettings.enabled || !memorySettings.compressionEnabled) {
      return getRecentCompleteFloorMessages(recallableMessages, memorySettings.recentFloorLimit);
    }
    const archivedMessageIds = new Set(
      conversationEpisodes
        .filter((episode) => episode.status === 'active')
        .flatMap((episode) => episode.sourceMessageIds)
    );
    if (!archivedMessageIds.size && !forgottenMessageIds.size) return recallableMessages;
    const recentMessageIds = new Set(
      getRecentCompleteFloorMessages(recallableMessages, memorySettings.recentFloorLimit).map((message) => message.id)
    );
    return recallableMessages.filter((message) => !forgottenMessageIds.has(message.id)
      && (!archivedMessageIds.has(message.id) || recentMessageIds.has(message.id)));
  }

  function hiddenMessageIdsForConversation(id: string) {
    void id;
    return new Set<string>();
  }

  function memoryBrainIdForConversation(id: string) {
    const conversation = conversationById(id);
    if (!conversation?.charId || !conversation.userId) return '';
    return createMemoryBrainId(conversation.charId, conversation.userId);
  }

  function memoryGraphForConversation(id: string) {
    const brainId = memoryBrainIdForConversation(id);
    const rawEpisodes = memoryEpisodes.value.filter((item) => item.brainId === brainId);
    const rawEntities = memoryEntities.value.filter((item) => item.brainId === brainId);
    const rawAssertions = memoryAssertions.value.filter((item) => item.brainId === brainId);
    const rawThemes = memoryThemes.value.filter((item) => item.brainId === brainId);
    const rawStates = memoryStateSnapshots.value.filter((item) => item.brainId === brainId);
    const sourceMessagesByConversation = new Map<string, ChatMessage[]>();
    const sourceFloorMapsByConversation = new Map<string, Map<string, number>>();
    const sourceMessagesForConversation = (conversationId: string) => {
      const cached = sourceMessagesByConversation.get(conversationId);
      if (cached) return cached;
      const sourceMessages = messagesForConversation(conversationId);
      sourceMessagesByConversation.set(conversationId, sourceMessages);
      sourceFloorMapsByConversation.set(conversationId, getMessageFloorMap(sourceMessages));
      return sourceMessages;
    };
    return {
      brainId,
      episodes: rawEpisodes.map((episode) => {
        const sourceMessageIds = new Set(episode.sourceMessageIds);
        const sourceMessages = sourceMessagesForConversation(episode.conversationId);
        const episodeMessages = sourceMessages.filter((message) => sourceMessageIds.has(message.id));
        const episodeFloorMap = sourceFloorMapsByConversation.get(episode.conversationId) ?? new Map<string, number>();
        const sourceFloors = episodeMessages.map((message) => episodeFloorMap.get(message.id) ?? 0).filter(Boolean);
        const floorRange = resolveMemoryEpisodeFloorRange(sourceFloors, episode.startFloor, episode.endFloor);
        const legacyFloorTitle = /^历史记忆 · \d+[-–]\d+楼$/.test(episode.title);
        return {
          ...episode,
          forgottenReason: resolveMemoryEpisodeForgottenReason(episode, new Set(sourceMessages.map((message) => message.id))),
          startFloor: floorRange.startFloor,
          endFloor: floorRange.endFloor,
          title: legacyFloorTitle && !episode.manuallyEditedAt && floorRange.startFloor > 0
            ? `历史记忆 · ${floorRange.startFloor}-${floorRange.endFloor}楼`
            : episode.title,
          sourceTokenEstimate: Math.max(0, Number(episode.sourceTokenEstimate) || estimateMemoryTokens(episodeMessages.map((message) => messageReadableContent(message)).join('\n'))),
          occurredEndAt: Number(episode.occurredEndAt) || (episodeMessages.length ? Math.max(...episodeMessages.map((message) => message.createdAt || episode.occurredAt)) : episode.occurredAt)
        };
      }),
      entities: rawEntities,
      assertions: rawAssertions,
      edges: memoryEdges.value.filter((item) => item.brainId === brainId),
      themes: rawThemes.map((theme) => ({ ...theme, reportAssertionCount: Math.max(0, Number(theme.reportAssertionCount) || 0) })),
      stateSnapshots: rawStates,
      embeddings: memoryEmbeddings.value.filter((item) => item.brainId === brainId)
    };
  }

  function memoryTimelineForConversation(id: string) {
    return [...memoryGraphForConversation(id).episodes].sort((left, right) => right.occurredAt - left.occurredAt);
  }

  function memoryThemesForConversation(id: string) {
    return [...memoryGraphForConversation(id).themes].sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function memoryStatesForConversation(id: string) {
    return latestMemoryStates(memoryGraphForConversation(id).stateSnapshots);
  }

  function recallMemoryForConversation(id: string, queryText = ''): MemoryRecallResult {
    const graph = memoryGraphForConversation(id);
    const budgetTokens = settingsForConversation(id).memory.recallTokenBudget;
    if (!graph.brainId) return { items: [], episodes: [], themes: [], states: [], contextText: '', estimatedTokens: 0, budgetTokens };
    return recallCharacterMemory({
      ...graph,
      brainId: graph.brainId,
      query: queryText,
      maxTokens: budgetTokens,
      timeAwarenessEnabled: settingsForConversation(id).timeAwareness.enabled
    });
  }

  function memoryCompressionStatsForConversation(id: string): MemoryCompressionStats {
    const activeMessages = visibleMessagesForConversation(id);
    const graph = memoryGraphForConversation(id);
    const memorySettings = settingsForConversation(id).memory;
    const activeEpisodes = graph.episodes.filter((episode) => episode.conversationId === id && episode.status === 'active');
    const archivedMessageIds = new Set(activeEpisodes.flatMap((episode) => episode.sourceMessageIds));
    const floorMap = getMessageFloorMap(activeMessages);
    const archivedFloorIds = new Set(
      activeMessages.flatMap((message) => archivedMessageIds.has(message.id) ? [floorMap.get(message.id) ?? 0] : []).filter(Boolean)
    );
    const promptMessages = promptMessagesForConversation(id);
    const promptFloorIds = new Set(promptMessages.map((message) => floorMap.get(message.id) ?? 0).filter(Boolean));
    const archivedMessages = activeMessages.filter((message) => archivedMessageIds.has(message.id));
    const recall = graph.brainId && memorySettings.enabled
      ? recallCharacterMemory({
          ...graph,
          brainId: graph.brainId,
          query: getLastUserTurnText(activeMessages),
          maxTokens: memorySettings.recallTokenBudget,
          timeAwarenessEnabled: settingsForConversation(id).timeAwareness.enabled
        })
      : null;
    return {
      compressionActive: Boolean(memorySettings.enabled && memorySettings.compressionEnabled),
      totalMessages: activeMessages.length,
      totalFloors: getConversationFloorCount(activeMessages),
      archivedMessages: archivedMessages.length,
      archivedFloors: archivedFloorIds.size,
      promptMessages: promptMessages.length,
      promptFloors: promptFloorIds.size,
      uncapturedMessages: activeMessages.length - archivedMessages.length,
      memoryTokens: recall?.estimatedTokens ?? 0,
      memoryBudgetTokens: memorySettings.recallTokenBudget,
      sourceTokenEstimate: estimateMemoryTokens(archivedMessages.map((message) => messageReadableContent(message)).join('\n')),
      recallTokenEstimate: recall?.estimatedTokens ?? 0,
      recallTokenBudget: memorySettings.recallTokenBudget
    };
  }

  function memoryContextForConversation(id: string, queryText = '', options: { includeResolved?: boolean; maxTokens?: number; storeDebug?: boolean; excludeSourceMessageIds?: string[] } = {}) {
    if (!settingsForConversation(id).memory.enabled) return '';
    const excludedIds = new Set(options.excludeSourceMessageIds ?? []);
    const graph = memoryGraphForConversation(id);
    const recall = recallCharacterMemory({
      ...graph,
      brainId: graph.brainId,
      assertions: graph.assertions.filter((assertion) => !assertion.evidenceMessageIds.some((messageId) => excludedIds.has(messageId))),
      query: queryText,
      maxTokens: options.maxTokens ?? settingsForConversation(id).memory.recallTokenBudget,
      timeAwarenessEnabled: settingsForConversation(id).timeAwareness.enabled
    });
    void options.includeResolved;
    void options.storeDebug;
    return recall.contextText;
  }

  async function memoryQueryVectorForConversation(id: string, queryText: string, modelOverride = '') {
    void id;
    void queryText;
    void modelOverride;
    return [];
  }

  async function memoryContextForConversationAsync(id: string, queryText = '', options: { includeResolved?: boolean; maxTokens?: number; storeDebug?: boolean; embeddingModelOverride?: string; queryVector?: number[]; excludeSourceMessageIds?: string[] } = {}) {
    if (!settingsForConversation(id).memory.enabled) return '';
    const excludedIds = new Set(options.excludeSourceMessageIds ?? []);
    const graph = memoryGraphForConversation(id);
    let queryVector = options.queryVector ?? [];
    const memorySettings = settingsForConversation(id).memory;
    const embeddingModelOverride = options.embeddingModelOverride?.trim() ?? '';
    if (!queryVector.length && queryText.trim() && memorySettings.embeddingEnabled && embeddingModelOverride) {
      try {
        queryVector = await requestTextEmbedding(settings.value ?? undefined, queryText, embeddingModelOverride);
      } catch (error) {
        console.warn('Memory query embedding fell back to lexical recall.', error);
      }
    }
    const recall = recallCharacterMemory({
      ...graph,
      brainId: graph.brainId,
      assertions: graph.assertions.filter((assertion) => !assertion.evidenceMessageIds.some((messageId) => excludedIds.has(messageId))),
      query: queryText,
      maxTokens: options.maxTokens ?? memorySettings.recallTokenBudget,
      queryVector,
      timeAwarenessEnabled: settingsForConversation(id).timeAwareness.enabled
    });
    const now = Date.now();
    const recalled = createRecallUpserts(recall.items, now);
    const recalledIds = new Set(recalled.map((assertion) => assertion.id));
    const faded = settingsForConversation(id).memory.naturalForgettingEnabled
      ? graph.assertions
          .map((assertion) => fadeMemoryAccessibility(assertion, now))
          .filter((assertion) => {
            const previous = memoryAssertions.value.find((item) => item.id === assertion.id);
            return !recalledIds.has(assertion.id) && Boolean(previous && (assertion.accessibility !== previous.accessibility || assertion.updatedAt !== previous.updatedAt));
          })
      : [];
    const upserts = [...recalled, ...faded];
    if (upserts.length) {
      try {
        await applyMemoryStoreMutation({ put: { assertions: upserts } });
        memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, upserts);
      } catch (error) {
        console.warn('Memory recall accessibility persistence failed.', error);
      }
    }
    if (!recall.contextText) return '';
    return recall.contextText;
  }

  function getLastUserTurnText(conversationMessages: ChatMessage[]) {
    const lastUserMessages = [...conversationMessages].reverse().filter((message, index, reversedMessages) => {
      const previousMessages = reversedMessages.slice(0, index);
      return message.sender === 'user' && !previousMessages.some((previous) => previous.sender === 'char');
    }).reverse();
    return lastUserMessages.map((message) => messageReadableContent(message)).join('\n');
  }

  function characterEconomySnapshotForPrompt(characterId: string): CharacterEconomySnapshot | undefined {
    const commerceStore = useCommerceStore();
    const wallet = commerceStore.walletForCharacter(characterId);
    if (!wallet) return undefined;
    const reservedTransferCents = messages.value.reduce((sum, message) => {
      if (message.sender !== 'char'
        || message.mode !== 'online'
        || message.replyVariantState === 'inactive'
        || message.status === 'failed'
        || !message.transfer
        || message.transfer.responseToMessageId
        || message.transfer.status !== 'pending') return sum;
      const conversation = conversationById(message.conversationId);
      if (!conversation || conversation.kind === 'group' || conversation.charId !== characterId) return sum;
      const amountCents = Math.round(Number(String(message.transfer.amount).replace(/[￥¥,\s]/g, '')) * 100);
      return Number.isFinite(amountCents) && amountCents > 0 ? sum + amountCents : sum;
    }, 0);
    return {
      balanceCents: wallet.balanceCents,
      reservedTransferCents,
      availableCents: Math.max(0, wallet.balanceCents - reservedTransferCents),
      monthlyIncomeCents: wallet.monthlyIncomeCents,
      savingsGoalCents: wallet.savingsGoalCents,
      giftAllowanceCents: wallet.giftAllowanceCents,
      spendingTraits: [...wallet.spendingTraits]
    };
  }

  async function buildRoleplayReplyInputForConversation(conversationId: string, options: BuildRoleplayReplyInputOptions = {}): Promise<RoleplayReplyInputBundle | null> {
    const conversation = conversationById(conversationId);
    if (!conversation) return null;
    const character = characterById(conversation.charId);
    if (!character) return null;
    const boundUser = userById(conversation.userId || character.boundUserId) ?? user.value;
    if (!boundUser) return null;

    const mode = options.mode ?? conversation.activeMode;
    const conversationMessages = messagesForConversation(conversationId).filter((message) => message.replyVariantState !== 'inactive');
    const userMessageText = getLastUserTurnText(conversationMessages);
    const chatSettings = settingsForConversation(conversationId);
    const promptMessages = promptMessagesForConversation(conversationId);
    const modelOverride = getConversationTextModelOverride(chatSettings, mode);
    const availableCharacterStickers = stickersForGroups(chatSettings.characterStickerGroupIds);
    const activeProfileTheme = mode === 'online'
      ? selectRandomEnabledProfileTheme(await ensureProfileThemesForCharacter(character.id))
      : null;
    let characterEconomy: CharacterEconomySnapshot | undefined;
    if (mode === 'online' && conversation.kind !== 'group') {
      const commerceStore = useCommerceStore();
      await commerceStore.ensureReady(users.value, characters.value);
      characterEconomy = characterEconomySnapshotForPrompt(character.id);
    }
    const memorySummary = await memoryContextForConversationAsync(conversationId, userMessageText, {
      storeDebug: false,
      embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings),
      excludeSourceMessageIds: options.excludeSourceMessageIds
    });

    return {
      conversation,
      character,
      boundUser,
      chatSettings,
      modelOverride,
      activeProfileTheme,
      input: {
        user: boundUser,
        character,
        boundUser,
        mode,
        messages: promptMessages,
        historyMessageLimit: promptMessages.length,
        worldBooks: worldBooks.value,
        conversationSummary: conversation.summary,
        memorySummary,
        stickerVisionEnabled: chatSettings.stickerVisionEnabled,
        narrationModeEnabled: chatSettings.narrationModeEnabled,
        offlineInvitationEnabled: chatSettings.offlineInvitationEnabled,
        timeAwareness: chatSettings.timeAwareness,
        timeAwarenessNow: options.timeAwarenessNow,
        offlineSettings: chatSettings.offline,
        musicListening: musicListeningContextForConversation(conversationId),
        characterEconomy,
        replyInstruction: options.replyInstruction
          ? options.replyInstruction
          : options.proactive
          ? `这不是用户刚发来的新消息，而是${getCharacterAiName(character)}在自己的生活节奏里主动联系${getUserAiName(boundUser)}。请基于最近对话、关系状态、时间流逝和角色当前生活，生成一组自然的主动消息；不要假装用户刚说了什么，也不要替用户发言。`
          : undefined,
        activeProfileTheme: activeProfileTheme
          ? {
              id: activeProfileTheme.id,
              name: activeProfileTheme.name,
              prompt: activeProfileTheme.prompt,
              regex: activeProfileTheme.regex,
              css: activeProfileTheme.css,
              template: activeProfileTheme.template,
              source: activeProfileTheme.source,
              builtIn: activeProfileTheme.builtIn
            }
          : undefined,
        availableStickers: availableCharacterStickers.map((sticker) => ({
          stickerId: sticker.id,
          description: sticker.description,
          imageUrl: getStickerDisplayImageUrl(sticker)
        })),
        userMessage: userMessageText,
        settings: settings.value ?? undefined,
        modelOverride,
        requestRecovery: chatSettings.requestRecovery,
        persistSettings: saveSettings
      }
    };
  }

  function nextReplyTokenCountForConversation(id: string) {
    const conversation = conversationById(id);
    if (!conversation) return 0;
    const character = characterById(conversation.charId);
    if (!character) return 0;
    const boundUser = userById(conversation.userId || character.boundUserId) ?? user.value;
    if (!boundUser) return 0;
    const chatSettings = settingsForConversation(id);
    const promptMessages = promptMessagesForConversation(id);
    const availableCharacterStickers = stickersForGroups(chatSettings.characterStickerGroupIds);
    const conversationMessages = messagesForConversation(id).filter((message) => message.replyVariantState !== 'inactive');
    const lastUserMessages = [...conversationMessages].reverse().filter((message, index, reversedMessages) => {
      const previousMessages = reversedMessages.slice(0, index);
      return message.sender === 'user' && !previousMessages.some((previous) => previous.sender === 'char');
    }).reverse();
    const userMessageText = lastUserMessages.map((message) => messageReadableContent(message)).join('\n');
    return estimateRoleplayReplyInputTokens({
      user: boundUser,
      character,
      boundUser,
      mode: conversation.activeMode,
      messages: promptMessages,
      historyMessageLimit: promptMessages.length,
      worldBooks: worldBooks.value,
      conversationSummary: conversation.summary,
      memorySummary: memoryContextForConversation(id, userMessageText, { storeDebug: false }),
      stickerVisionEnabled: chatSettings.stickerVisionEnabled,
      narrationModeEnabled: chatSettings.narrationModeEnabled,
      offlineInvitationEnabled: chatSettings.offlineInvitationEnabled,
      timeAwareness: chatSettings.timeAwareness,
      offlineSettings: chatSettings.offline,
      musicListening: musicListeningContextForConversation(id),
      characterEconomy: conversation.activeMode === 'online' && conversation.kind !== 'group' ? characterEconomySnapshotForPrompt(character.id) : undefined,
      availableStickers: availableCharacterStickers.map((sticker) => ({
        stickerId: sticker.id,
        description: sticker.description,
        imageUrl: getStickerDisplayImageUrl(sticker)
      })),
      userMessage: userMessageText,
      settings: settings.value ?? undefined,
      modelOverride: getConversationTextModelOverride(chatSettings, conversation.activeMode)
    });
  }

  async function nextReplyTokenCountForConversationAsync(id: string) {
    const bundle = await buildRoleplayReplyInputForConversation(id, { timeAwarenessNow: Date.now() });
    return bundle ? estimateRoleplayReplyInputTokens(bundle.input) : 0;
  }

  function lastMessageForConversation(id: string) {
    const conversationMessages = messagesForConversation(id);
    return conversationMessages[conversationMessages.length - 1];
  }

  function showConfigAlert(message: string, title = '提示', action?: ConfigAlertAction) {
    const validAction = action && typeof action.run === 'function' ? action : undefined;
    configAlert.value = { open: true, title, message, ...(validAction ? { action: validAction } : {}) };
  }

  function hasConfiguredTextModel(modelOverride = '') {
    return hasSelectedTextGenerationConfig(settings.value ?? undefined, modelOverride);
  }

  function availableTextModelOverride(modelOverride = '') {
    const normalizedOverride = modelOverride.trim();
    return hasConfiguredTextModel(normalizedOverride) ? normalizedOverride : '';
  }

  function normalizeAvailableModelOverrides(overrides?: Partial<ChatModelOverrides> | null): ChatModelOverrides {
    const normalizedOverrides = normalizeChatModelOverrides(overrides);
    return normalizeChatModelOverrides({
      online: availableTextModelOverride(normalizedOverrides.online),
      offline: availableTextModelOverride(normalizedOverrides.offline),
      summary: availableTextModelOverride(normalizedOverrides.summary),
      embedding: availableTextModelOverride(normalizedOverrides.embedding),
      voom: availableTextModelOverride(normalizedOverrides.voom),
      theater: availableTextModelOverride(normalizedOverrides.theater),
      content: availableTextModelOverride(normalizedOverrides.content)
    });
  }

  function getGlobalTextModelOverride(scope: ChatModelScope) {
    return availableTextModelOverride(settings.value?.modelOverrides[scope] ?? '');
  }

  function modelOverridesForConversation(id: string): ChatModelOverrides {
    const chatSettings = settingsForConversation(id);
    const conversation = conversationById(id);
    if (conversation?.kind === 'group') return normalizeAvailableModelOverrides(chatSettings.modelOverrides);
    const character = conversation ? characterById(conversation.charId) : null;
    const characterOverrides = normalizeAvailableModelOverrides(character?.modelOverrides);
    const legacyConversationOverrides = normalizeAvailableModelOverrides(chatSettings.modelOverrides);

    return normalizeChatModelOverrides({
      online: characterOverrides.online || legacyConversationOverrides.online,
      offline: characterOverrides.offline || legacyConversationOverrides.offline,
      summary: characterOverrides.summary || legacyConversationOverrides.summary,
      embedding: characterOverrides.embedding || legacyConversationOverrides.embedding,
      voom: characterOverrides.voom || legacyConversationOverrides.voom,
      theater: characterOverrides.theater || legacyConversationOverrides.theater,
      content: ''
    });
  }

  async function clearUnavailableModelOverrides() {
    if (!settings.value) return;
    const normalizedGlobalOverrides = normalizeAvailableModelOverrides(settings.value.modelOverrides);
    const globalOverridesChanged = JSON.stringify(normalizedGlobalOverrides) !== JSON.stringify(settings.value.modelOverrides);
    const characterUpdates = characters.value.flatMap((character) => {
      if (!character.modelOverrides) return [];
      const normalizedOverrides = normalizeAvailableModelOverrides(character.modelOverrides);
      if (JSON.stringify(normalizedOverrides) === JSON.stringify(normalizeChatModelOverrides(character.modelOverrides))) return [];
      return [{ ...character, modelOverrides: normalizedOverrides }];
    });
    const conversationUpdates = conversationSettings.value.flatMap((chatSettings) => {
      const normalizedOverrides = normalizeAvailableModelOverrides(chatSettings.modelOverrides);
      if (JSON.stringify(normalizedOverrides) === JSON.stringify(chatSettings.modelOverrides)) return [];
      return [normalizeConversationSettings({ ...chatSettings, modelOverrides: normalizedOverrides }, chatSettings.conversationId, conversationById(chatSettings.conversationId)?.activeMode)];
    });
    if (!globalOverridesChanged && !characterUpdates.length && !conversationUpdates.length) return;

    if (globalOverridesChanged && settings.value) {
      settings.value = normalizeAppSettings({ ...settings.value, modelOverrides: normalizedGlobalOverrides });
    }
    if (characterUpdates.length) {
      const updatesById = new Map(characterUpdates.map((character) => [character.id, character]));
      characters.value = characters.value.map((character) => updatesById.get(character.id) ?? character);
    }
    if (conversationUpdates.length) {
      const updatesById = new Map(conversationUpdates.map((chatSettings) => [chatSettings.conversationId, chatSettings]));
      conversationSettings.value = conversationSettings.value.map((chatSettings) => updatesById.get(chatSettings.conversationId) ?? chatSettings);
    }

    await Promise.all([
      ...(globalOverridesChanged && settings.value ? [putEntity('settings', settings.value, 'main')] : []),
      ...characterUpdates.map((character) => putEntity('characters', character)),
      ...conversationUpdates.map((chatSettings) => putEntity('conversationSettings', chatSettings))
    ]);
  }

  function getConversationTextModelOverride(chatSettings: ConversationSettings, scope: ChatModelScope, fallbackScope?: ChatModelScope) {
    if (scope === 'content') return getGlobalTextModelOverride(scope);
    const localOverrides = modelOverridesForConversation(chatSettings.conversationId);
    const localOverride = localOverrides[scope]?.trim() ?? '';
    if (localOverride) return localOverride;

    const globalOverride = getGlobalTextModelOverride(scope);
    if (globalOverride) return globalOverride;

    if (fallbackScope && fallbackScope !== scope) {
      const fallbackLocalOverride = localOverrides[fallbackScope]?.trim() ?? '';
      if (fallbackLocalOverride) return fallbackLocalOverride;
      return getGlobalTextModelOverride(fallbackScope);
    }

    return '';
  }

  function getMemorySummaryModelOverride(chatSettings: ConversationSettings) {
    return modelOverridesForConversation(chatSettings.conversationId).summary?.trim()
      || getGlobalTextModelOverride('summary');
  }

  function getMemoryEmbeddingModelOverride(chatSettings: ConversationSettings) {
    return modelOverridesForConversation(chatSettings.conversationId).embedding?.trim()
      || getGlobalTextModelOverride('embedding');
  }

  async function clearLegacyModelOverridesForCharacter(characterId: string) {
    const emptyOverrides = normalizeChatModelOverrides(null);
    const updates = conversationSettings.value
      .filter((entry) => conversationById(entry.conversationId)?.charId === characterId)
      .filter((entry) => Object.values(normalizeChatModelOverrides(entry.modelOverrides)).some(Boolean))
      .map((entry) => normalizeConversationSettings({
        ...entry,
        modelOverrides: emptyOverrides
      }, entry.conversationId, conversationById(entry.conversationId)?.activeMode));

    if (!updates.length) return;

    const updatesById = new Map(updates.map((entry) => [entry.conversationId, entry]));
    conversationSettings.value = conversationSettings.value.map((entry) => updatesById.get(entry.conversationId) ?? entry);
    await Promise.all(updates.map((entry) => putEntity('conversationSettings', entry)));
  }

  async function saveCharacterModelOverridesForConversation(conversationId: string, nextOverrides: ChatModelOverrides) {
    const normalizedOverrides = normalizeChatModelOverrides(nextOverrides);
    const conversation = conversationById(conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const chatSettings = settingsForConversation(conversationId);

    if (character && conversation?.kind !== 'group') {
      await saveCharacter({
        ...character,
        modelOverrides: normalizedOverrides
      });
      await clearLegacyModelOverridesForCharacter(character.id);
      return;
    }

    await saveConversationSettings({
      ...chatSettings,
      modelOverrides: normalizedOverrides
    });
  }

  function isReplyingVoomComments(postId: string) {
    return replyingVoomCommentPostIds.value.includes(postId);
  }

  function suppressVoomNoticeKeys(keys: string[]) {
    const nextKeys = keys.map((key) => key.trim()).filter(Boolean);
    if (!nextKeys.length) return;
    suppressedVoomNoticeKeys.value = [...new Set([...suppressedVoomNoticeKeys.value, ...nextKeys])];
  }

  function consumeSuppressedVoomNoticeKey(key: string) {
    const normalizedKey = key.trim();
    if (!normalizedKey || !suppressedVoomNoticeKeys.value.includes(normalizedKey)) return false;
    suppressedVoomNoticeKeys.value = suppressedVoomNoticeKeys.value.filter((entry) => entry !== normalizedKey);
    return true;
  }

  function voomPostGlobalNoticeKey(postId: string) {
    return `post:${postId}`;
  }

  function voomCommentGlobalNoticeKey(postId: string, commentId: string) {
    return `comment:${postId}:${commentId}`;
  }

  function isConversationReplying(conversationId: string) {
    return replyingConversationIds.value.includes(conversationId);
  }

  function startConversationReply(conversationId: string) {
    if (isConversationReplying(conversationId)) return '';
    const runId = createId('replyRun');
    activeReplyRunIds.set(conversationId, runId);
    replyingConversationIds.value = [...replyingConversationIds.value, conversationId];
    return runId;
  }

  function finishConversationReply(conversationId: string, runId?: string) {
    if (runId && activeReplyRunIds.get(conversationId) !== runId) return;
    activeReplyRunIds.delete(conversationId);
    replyingConversationIds.value = replyingConversationIds.value.filter((id) => id !== conversationId);
  }

  function cancelConversationReply(conversationId: string) {
    replyCancelVersions.set(conversationId, (replyCancelVersions.get(conversationId) ?? 0) + 1);
    activeReplyRunIds.delete(conversationId);
    replyingConversationIds.value = replyingConversationIds.value.filter((id) => id !== conversationId);
  }

  function isReplyRunCancelled(conversationId: string, cancelVersion: number) {
    return (replyCancelVersions.get(conversationId) ?? 0) !== cancelVersion;
  }

  function proactiveReplyCooldownMs(frequency: VoomFrequency) {
    return {
      'very-low': 6 * 60 * 60 * 1000,
      low: 3 * 60 * 60 * 1000,
      medium: 60 * 60 * 1000,
      high: 30 * 60 * 1000,
      'very-high': 10 * 60 * 1000,
      always: 2 * 60 * 1000
    }[frequency];
  }

  async function touchProactiveReplyAttempt(chatSettings: ConversationSettings, timestamp = Date.now()) {
    await saveConversationSettings({
      ...chatSettings,
      proactiveReply: {
        ...chatSettings.proactiveReply,
        lastTriggeredAt: timestamp
      }
    });
  }

  function conversationForVoomPost(post: VoomPost) {
    const explicitConversation = post.conversationId ? conversationById(post.conversationId) : null;
    if (explicitConversation) return explicitConversation;

    const firstConversationId = post.conversationIds?.find(Boolean);
    if (firstConversationId) return conversationById(firstConversationId) ?? null;

    return post.charId ? conversations.value.find((entry) => entry.charId === post.charId) ?? null : null;
  }

  function conversationsForVoomPost(post: VoomPost) {
    const explicitIds = post.conversationIds?.map((id) => id.trim()).filter(Boolean) ?? [];
    const candidates = explicitIds.length
      ? explicitIds.map((id) => conversationById(id))
      : [conversationForVoomPost(post)];
    const seen = new Set<string>();
    return candidates.filter((conversation): conversation is Conversation => {
      if (!conversation || seen.has(conversation.id)) return false;
      seen.add(conversation.id);
      return true;
    });
  }

  function isUserVoomPost(post: VoomPost) {
    return post.authorType === 'user'
      || (post.authorType !== 'character' && Boolean(String(post.userId ?? '').trim()));
  }

  function characterForVoomComment(comment: VoomComment) {
    const authorId = String(comment.authorId ?? '').trim();
    return authorId ? characters.value.find((character) => character.id === authorId) ?? null : null;
  }

  function userForVoomComment(comment: VoomComment) {
    const authorId = String(comment.authorId ?? '').trim();
    return authorId ? users.value.find((entry) => entry.id === authorId) ?? null : null;
  }

  function voomAiNameForIdentity(authorName = '', authorId = '') {
    const normalizedAuthorId = authorId.trim();
    const normalizedAuthorName = authorName.trim().toLocaleLowerCase();
    if (normalizedAuthorId) {
      const identifiedCharacter = characters.value.find((entry) => entry.id === normalizedAuthorId);
      if (identifiedCharacter) return getCharacterAiName(identifiedCharacter);
      const identifiedUser = users.value.find((entry) => entry.id === normalizedAuthorId);
      if (identifiedUser) return getUserAiName(identifiedUser);
      return authorName;
    }
    const character = characters.value.find((entry) => {
      return [entry.id, entry.nickname, entry.name, getCharacterAiName(entry), getCharacterVoomAuthorName(entry)]
        .map((name) => name.trim().toLocaleLowerCase())
        .includes(normalizedAuthorName);
    });
    if (character) return getCharacterAiName(character);
    const matchedUser = users.value.find((entry) => {
      if (normalizedAuthorId && entry.id === normalizedAuthorId) return true;
      return [entry.id, getUserDisplayName(entry), getUserVoomAuthorName(entry), getUserAiName(entry)]
        .map((name) => name.trim().toLocaleLowerCase())
        .includes(normalizedAuthorName);
    });
    return matchedUser ? getUserAiName(matchedUser) : authorName;
  }

  function normalizeStoredMessageAuthorReference(message: ChatMessage) {
    const quoteAuthorName = message.quote?.sender === 'user'
      ? voomAiNameForIdentity(message.quote.authorName, conversationById(message.conversationId)?.userId)
      : message.quote?.sender === 'char'
        ? voomAiNameForIdentity(message.quote.authorName, conversationById(message.conversationId)?.charId)
        : message.quote?.authorName;
    const nextQuote = message.quote && quoteAuthorName && quoteAuthorName !== message.quote.authorName
      ? { ...message.quote, authorName: quoteAuthorName }
      : message.quote;
    return nextQuote !== message.quote
      ? { ...message, quote: nextQuote }
      : message;
  }

  function normalizeStoredVoomPostIdentityReferences(post: VoomPost) {
    const postConversation = conversationForVoomPost(post);
    const userPost = isUserVoomPost(post);
    const postCharacter = userPost ? null : characterById(post.charId) ?? (postConversation ? characterById(postConversation.charId) : null);
    const postUser = post.userId ? userById(post.userId) : null;
    const authorName = userPost
      ? postUser ? getUserAiName(postUser) : post.authorName
      : postCharacter
        ? getCharacterAiName(postCharacter)
        : post.authorName;
    const likes = post.likes.map((like) => voomAiNameForIdentity(like)).filter(Boolean);
    const comments = post.comments.map((comment) => {
      const nextAuthorName = comment.authorId ? voomAiNameForIdentity(comment.authorName, comment.authorId) : comment.authorName;
      return nextAuthorName === comment.authorName ? comment : { ...comment, authorName: nextAuthorName };
    });
    return authorName !== post.authorName
      || likes.length !== post.likes.length
      || likes.some((like, index) => like !== post.likes[index])
      || comments.some((comment, index) => comment !== post.comments[index])
      ? { ...post, authorName, likes, comments }
      : post;
  }

  function normalizeStoredMusicCommentThreads(threads: MusicCommentThread[]) {
    return threads.map((thread) => {
      let changed = false;
      const comments = thread.comments.map((comment) => {
        const nextAuthorName = voomAiNameForIdentity(comment.authorName, comment.authorId);
        if (nextAuthorName === comment.authorName) return comment;
        changed = true;
        return { ...comment, authorName: nextAuthorName };
      });
      return changed ? { ...thread, comments } : thread;
    });
  }

  function normalizeStoredSmallTheaters(theaters: SmallTheater[]) {
    return theaters.map((theater) => {
      const character = characterById(theater.charId) ?? (theater.conversationId ? characterById(conversationById(theater.conversationId)?.charId ?? '') : null);
      const authorName = character ? getCharacterAiName(character) : voomAiNameForIdentity(theater.authorName, theater.charId);
      const updatedAt = theater.updatedAt ?? theater.createdAt;
      return authorName !== theater.authorName || updatedAt !== theater.updatedAt ? { ...theater, authorName, updatedAt } : theater;
    });
  }

  function normalizeStoredProfileThemes(themes: ProfileTheme[]) {
    return themes
      .map((theme) => normalizeProfileTheme(theme, theme.charId))
      .filter((theme): theme is ProfileTheme => Boolean(theme));
  }

  function normalizeStoredSmallTheaterTopics(topics: SmallTheaterTopic[]) {
    return topics
      .map((topic) => normalizeSmallTheaterTopic(topic, topic.charId))
      .filter((topic): topic is SmallTheaterTopic => Boolean(topic));
  }

  function normalizeSharedLibraryText(value: unknown) {
    return String(value ?? '').replace(/\r\n/g, '\n').trim();
  }

  function profileThemeSharedKey(theme: ProfileTheme) {
    return [
      theme.builtIn || theme.source === 'built-in' ? 'built-in' : theme.source,
      normalizeSharedLibraryText(theme.name).toLocaleLowerCase(),
      normalizeSharedLibraryText(theme.prompt),
      normalizeSharedLibraryText(theme.regex),
      normalizeSharedLibraryText(theme.template),
      normalizeSharedLibraryText(theme.css)
    ].join('\u001f');
  }

  function smallTheaterTopicSharedKey(topic: SmallTheaterTopic) {
    return [
      topic.builtIn ? 'built-in' : 'custom',
      normalizeSharedLibraryText(topic.title).toLocaleLowerCase(),
      normalizeSharedLibraryText(topic.prompt)
    ].join('\u001f');
  }

  function selectSharedLibraryRecord<T extends { id: string; charId: string; createdAt: number }>(items: T[]) {
    return [...items].sort((first, second) => {
      const firstIsGlobal = first.charId === globalSharedLibraryOwnerId ? 0 : 1;
      const secondIsGlobal = second.charId === globalSharedLibraryOwnerId ? 0 : 1;
      if (firstIsGlobal !== secondIsGlobal) return firstIsGlobal - secondIsGlobal;
      if (first.createdAt !== second.createdAt) return first.createdAt - second.createdAt;
      return first.id.localeCompare(second.id);
    })[0];
  }

  function cloneEnabledByCharacter(input: Record<string, Record<string, boolean>> | undefined) {
    return Object.fromEntries(
      Object.entries(input ?? {}).map(([characterId, entry]) => [characterId, { ...entry }])
    ) as Record<string, Record<string, boolean>>;
  }

  function setEnabledOverrideInPlace(enabledByCharacter: Record<string, Record<string, boolean>>, characterId: string, itemId: string, enabled: boolean) {
    const normalizedCharacterId = characterId.trim();
    const normalizedItemId = itemId.trim();
    if (!normalizedCharacterId || !normalizedItemId) return;
    enabledByCharacter[normalizedCharacterId] = {
      ...(enabledByCharacter[normalizedCharacterId] ?? {}),
      [normalizedItemId]: enabled
    };
  }

  function remapEnabledOverrideInPlace(enabledByCharacter: Record<string, Record<string, boolean>>, fromItemId: string, toItemId: string) {
    if (fromItemId === toItemId) return;
    Object.values(enabledByCharacter).forEach((entry) => {
      if (!(fromItemId in entry)) return;
      entry[toItemId] = entry[fromItemId];
      delete entry[fromItemId];
    });
  }

  function removeEnabledOverrideIds(enabledByCharacter: Record<string, Record<string, boolean>>, itemIds: string[]) {
    const itemIdSet = new Set(itemIds);
    const normalized: Record<string, Record<string, boolean>> = {};
    Object.entries(enabledByCharacter).forEach(([characterId, entry]) => {
      const nextEntry = Object.fromEntries(Object.entries(entry).filter(([itemId]) => !itemIdSet.has(itemId))) as Record<string, boolean>;
      if (Object.keys(nextEntry).length) normalized[characterId] = nextEntry;
    });
    return normalized;
  }

  function discardCharacterEnabledOverrides(settingsEntry: AppSettings, characterId: string) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return settingsEntry;
    const { [normalizedCharacterId]: _topicEntry, ...smallTheaterTopicEnabledByCharacter } = settingsEntry.smallTheaterTopicEnabledByCharacter;
    const { [normalizedCharacterId]: _themeEntry, ...profileThemeEnabledByCharacter } = settingsEntry.profileThemeEnabledByCharacter;
    const { [normalizedCharacterId]: _voomAutoCleanupEntry, ...voomAutoCleanup } = settingsEntry.voomAutoCleanup;
    const { [normalizedCharacterId]: _theaterAutoCleanupEntry, ...smallTheaterAutoCleanup } = settingsEntry.smallTheaterAutoCleanup;
    const { [normalizedCharacterId]: _homepageAutoCleanupEntry, ...profileHomepageAutoCleanup } = settingsEntry.profileHomepageAutoCleanup;
    const { [normalizedCharacterId]: _topicDefaultsEntry, ...smallTheaterTopicDefaultsInitialized } = settingsEntry.smallTheaterTopicDefaultsInitialized;
    const voomReadAtByUser = Object.fromEntries(Object.entries(settingsEntry.voomReadAtByUser).map(([userId, readAtByCharacter]) => {
      const { [normalizedCharacterId]: _readAt, ...nextReadAtByCharacter } = readAtByCharacter;
      return [userId, nextReadAtByCharacter];
    }));
    return normalizeAppSettings({
      ...settingsEntry,
      voomReadAtByUser,
      voomAutoCleanup,
      smallTheaterAutoCleanup,
      profileHomepageAutoCleanup,
      smallTheaterTopicEnabledByCharacter,
      profileThemeEnabledByCharacter,
      smallTheaterTopicDefaultsInitialized
    });
  }

  function normalizeSharedLibraryData(input: Pick<AppSnapshot, 'profileThemes' | 'smallTheaterTopics' | 'settings'>) {
    const normalizedSettings = normalizeAppSettings(input.settings);
    let profileThemeEnabledByCharacter = cloneEnabledByCharacter(normalizedSettings.profileThemeEnabledByCharacter);
    let smallTheaterTopicEnabledByCharacter = cloneEnabledByCharacter(normalizedSettings.smallTheaterTopicEnabledByCharacter);
    const removedProfileThemeIds: string[] = [];
    const removedSmallTheaterTopicIds: string[] = [];

    const profileThemeGroups = new Map<string, ProfileTheme[]>();
    normalizeStoredProfileThemes(input.profileThemes ?? []).forEach((theme) => {
      const key = profileThemeSharedKey(theme);
      profileThemeGroups.set(key, [...(profileThemeGroups.get(key) ?? []), theme]);
    });
    const profileThemes = [...profileThemeGroups.values()].map((group) => {
      const representative = selectSharedLibraryRecord(group);
      group.forEach((theme) => {
        if (theme.charId && theme.charId !== globalSharedLibraryOwnerId) {
          setEnabledOverrideInPlace(profileThemeEnabledByCharacter, theme.charId, representative.id, theme.enabled);
        }
        remapEnabledOverrideInPlace(profileThemeEnabledByCharacter, theme.id, representative.id);
        if (theme.id !== representative.id) removedProfileThemeIds.push(theme.id);
      });
      return { ...representative, charId: globalSharedLibraryOwnerId, enabled: true } satisfies ProfileTheme;
    }).sort((first, second) => first.createdAt - second.createdAt);

    const smallTheaterTopicGroups = new Map<string, SmallTheaterTopic[]>();
    normalizeStoredSmallTheaterTopics(input.smallTheaterTopics ?? []).forEach((topic) => {
      const key = smallTheaterTopicSharedKey(topic);
      smallTheaterTopicGroups.set(key, [...(smallTheaterTopicGroups.get(key) ?? []), topic]);
    });
    const smallTheaterTopics = [...smallTheaterTopicGroups.values()].map((group) => {
      const representative = selectSharedLibraryRecord(group);
      group.forEach((topic) => {
        if (topic.charId && topic.charId !== globalSharedLibraryOwnerId) {
          setEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, topic.charId, representative.id, topic.enabled);
        }
        remapEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, topic.id, representative.id);
        if (topic.id !== representative.id) removedSmallTheaterTopicIds.push(topic.id);
      });
      return { ...representative, charId: globalSharedLibraryOwnerId, enabled: true } satisfies SmallTheaterTopic;
    }).sort((first, second) => first.createdAt - second.createdAt);

    const settingsEntry = normalizeAppSettings({
      ...normalizedSettings,
      profileThemeEnabledByCharacter,
      smallTheaterTopicEnabledByCharacter
    });

    return {
      profileThemes,
      smallTheaterTopics,
      settings: settingsEntry,
      removedProfileThemeIds,
      removedSmallTheaterTopicIds
    };
  }

  function normalizeStoredProfileHomepages(homepages: ProfileHomepageRecord[]) {
    const normalizedHomepages: ProfileHomepageRecord[] = [];
    for (const entry of homepages ?? []) {
      const id = String(entry?.id ?? '').trim() || createId('profile-homepage');
      const charId = String(entry?.charId ?? '').trim();
      const conversationId = String(entry?.conversationId ?? '').trim();
      const themeId = String(entry?.themeId ?? '').trim();
      const themeName = String(entry?.themeName ?? '').trim() || '主页主题';
      const content = String(entry?.content ?? '').trim();
      const html = String(entry?.html ?? '').trim();
      const css = String(entry?.css ?? '').trim();
      const createdAt = Math.max(0, Number(entry?.createdAt) || Date.now());
      const updatedAt = Math.max(0, Number(entry?.updatedAt) || createdAt);
      const replyBatchId = String(entry?.replyBatchId ?? '').trim();
      if (!charId || !conversationId || !themeId || (!content && !html)) continue;
      normalizedHomepages.push({
        id,
        charId,
        conversationId,
        ...(replyBatchId ? { replyBatchId } : {}),
        themeId,
        themeName,
        content,
        html,
        css,
        createdAt,
        updatedAt
      });
    }
    return normalizedHomepages;
  }

  function voomCommentAiAuthorName(comment: VoomComment) {
    const commentUser = userForVoomComment(comment);
    if (commentUser) return getUserAiName(commentUser);
    const character = characterForVoomComment(comment);
    return character ? getCharacterAiName(character) : comment.authorName;
  }

  function formatVoomCommentEvent(comment: VoomComment, comments: VoomComment[]) {
    const parentComment = comment.parentId ? comments.find((entry) => entry.id === comment.parentId) : undefined;
    const parentName = parentComment ? voomCommentAiAuthorName(parentComment) : '';
    const authorName = voomCommentAiAuthorName(comment);
    const content = formatContentWithChineseTranslation(comment.content, comment.contentTranslation);
    return parentName
      ? `【VOOM 评论】${authorName} 回复 ${parentName}: ${content}`
      : `【VOOM 评论】${authorName}: ${content}`;
  }

  function voomAuthorNameForPost(post: VoomPost) {
    if (isUserVoomPost(post)) {
      const postUser = post.userId ? userById(post.userId) : null;
      return postUser ? getUserDisplayName(postUser) : post.authorName;
    }
    const character = characterById(post.charId);
    if (character) return getCharacterVoomDisplayName(character);
    return post.authorName;
  }

  function voomAiAuthorNameForPost(post: VoomPost) {
    if (isUserVoomPost(post)) {
      const postUser = post.userId ? userById(post.userId) : null;
      return postUser ? getUserAiName(postUser) : post.authorName;
    }
    const postConversation = conversationForVoomPost(post);
    const character = characterById(post.charId) ?? (postConversation ? characterById(postConversation.charId) : null);
    if (character) return getCharacterAiName(character);
    return post.authorName;
  }

  function notificationPreview(content: string, fallback: string) {
    const normalizedContent = content.replace(/\s+/g, ' ').trim() || fallback;
    return normalizedContent.length > 120 ? `${normalizedContent.slice(0, 117)}...` : normalizedContent;
  }

  function notifyCharacterMessages(conversation: Conversation, charMessages: ChatMessage[]) {
    const character = characterById(conversation.charId);
    const displayName = character ? getCharacterVoomDisplayName(character) : conversation.title || '角色';
    const incomingCallMessage = charMessages.find((message) => message.call?.direction === 'incoming' && message.call.status === 'ringing');
    if (incomingCallMessage?.call) {
      const callModeText = incomingCallMessage.call.mode === 'video' ? '视频通话' : '语音通话';
      void playRingtone(settings.value, 'call', conversation.charId);
      void showLinkNotification(settings.value?.keepAlive, {
        kind: 'call',
        title: displayName,
        body: `邀请你${callModeText}`,
        tag: `link-call-${incomingCallMessage.call.callId}`,
        icon: character?.avatar,
        url: `/chats/${conversation.id}`,
        conversationId: conversation.id,
        callId: incomingCallMessage.call.callId,
        callMode: incomingCallMessage.call.mode
      });
      return;
    }
    const messages = charMessages.map((message) => notificationPreview(messageReadableContent(message), '发来了新消息'));
    const body = messages.join('\n') || '发来了新消息';
    void playRingtone(settings.value, 'message', conversation.charId);
    void showLinkNotification(settings.value?.keepAlive, {
      kind: 'message',
      title: displayName,
      body,
      messages,
      tag: `link-message-${conversation.id}`,
      icon: character?.avatar,
      url: `/chats/${conversation.id}`
    });
  }

  function notifyVoomPost(post: VoomPost, conversation?: Conversation | null) {
    if (isUserVoomPost(post)) return;
    const characterId = post.charId || conversation?.charId || '';
    const character = characterId ? characterById(characterId) : null;
    const authorName = voomAuthorNameForPost(post);
    const body = notificationPreview(formatContentWithChineseTranslation(post.content, post.contentTranslation), '发布了新的 VOOM 动态');
    void playRingtone(settings.value, 'voom', characterId);
    void showLinkNotification(settings.value?.keepAlive, {
      kind: 'voom',
      title: `${authorName} 发布了 VOOM`,
      body,
      tag: `link-voom-post-${post.id}`,
      icon: character?.avatar || post.authorAvatar,
      url: '/voom'
    });
  }

  function formatVoomLikeEvent(likes: string[], authorName: string) {
    const likeNames = likes.map((like) => voomAiNameForIdentity(like)).filter(Boolean);
    return `【VOOM】${likeNames.join('、')} 赞了 ${authorName.trim() || '用户'} 的动态。`;
  }

  function formatVoomPostEvent(post: VoomPost, authorName = voomAiAuthorNameForPost(post)) {
    const imageEventText = post.imageDescription ? `配图：${post.imageDescription}` : post.image ? '配图：本地图片' : '';
    return [
      `【VOOM】${authorName} 发布了动态：${formatContentWithChineseTranslation(post.content, post.contentTranslation)}`,
      imageEventText
    ].filter(Boolean).join('\n');
  }

  function normalizeStoredVoomEventMessage(message: ChatMessage, posts: VoomPost[]) {
    if (message.sender !== 'system' || !message.voomPostId) return message;
    const post = posts.find((entry) => entry.id === message.voomPostId);
    if (!post) return message;

    const authorName = voomAiAuthorNameForPost(post);
    let content = '';
    if (message.voomEventType === 'post') {
      content = formatVoomPostEvent(post, authorName);
    } else if (message.voomEventType === 'like' || message.voomEventType === 'unlike') {
      const match = message.content.match(/^【VOOM】(.+?) (赞了|取消赞了) .+ 的动态。$/);
      if (!match) return message;
      content = `【VOOM】${match[1]} ${match[2]} ${authorName} 的动态。`;
    } else {
      return message;
    }

    return content === message.content ? message : { ...message, content };
  }

  async function syncChatTransferLedger(message: ChatMessage) {
    if (!message.transfer || message.transfer.responseToMessageId || (message.sender !== 'user' && message.sender !== 'char')) return;
    const conversation = conversationById(message.conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const activeUser = conversation ? userById(conversation.userId) ?? user.value : null;
    if (!conversation || conversation.kind === 'group' || !character || !activeUser) return;
    const commerceStore = useCommerceStore();
    await commerceStore.ensureReady(users.value, characters.value);
    await commerceStore.syncChatTransfer({
      messageId: message.id,
      conversationId: conversation.id,
      userId: activeUser.id,
      userName: getUserAiName(activeUser),
      characterId: character.id,
      characterName: getCharacterAiName(character),
      sender: message.sender === 'char' ? 'character' : 'user',
      amount: message.transfer.amount,
      status: message.transfer.status,
      note: message.transfer.note
    });
  }

  function createPersistableVoomPost(post: VoomPost): VoomPost {
    const rawPost = toRaw(post);
    return {
      ...rawPost,
      conversationIds: rawPost.conversationIds ? [...rawPost.conversationIds] : undefined,
      proactiveCommentExpansionCharacterIds: rawPost.proactiveCommentExpansionCharacterIds ? [...new Set(rawPost.proactiveCommentExpansionCharacterIds.map((id) => id.trim()).filter(Boolean))] : undefined,
      visibleCharacterIds: rawPost.visibleCharacterIds ? [...rawPost.visibleCharacterIds] : undefined,
      imageCandidates: rawPost.imageCandidates?.map((candidate) => ({ ...toRaw(candidate) })),
      comments: rawPost.comments.map((comment) => ({ ...toRaw(comment) })),
      likes: [...rawPost.likes]
    };
  }

  async function syncCharacterAvatarReferences(character: CharacterProfile) {
    const characterId = character.id;
    const avatar = character.avatar;
    const changedPosts: VoomPost[] = [];
    const changedFavorites: FavoriteMessageRecord[] = [];
    const changedTheaters: SmallTheater[] = [];

    voomPosts.value = voomPosts.value.map((post) => {
      if (isUserVoomPost(post) || post.charId !== characterId || post.authorAvatar === avatar) return post;
      const nextPost = { ...post, authorAvatar: avatar };
      changedPosts.push(nextPost);
      return nextPost;
    });

    favorites.value = favorites.value.map((favorite) => {
      const favoriteConversation = conversationById(favorite.conversationId);
      const favoriteGroupMember = groupMemberForMessage(favoriteConversation, favorite.message);
      const belongsToCharacter = favoriteConversation?.kind === 'group'
        ? favoriteGroupMember?.identityType === 'character' && favoriteGroupMember.identityId === characterId
        : favorite.characterId === characterId || favoriteConversation?.charId === characterId;
      if (!belongsToCharacter) return favorite;

      const nextAuthorAvatar = favorite.sender === 'char' ? avatar : favorite.authorAvatar;
      if (favorite.characterAvatar === avatar && favorite.authorAvatar === nextAuthorAvatar) return favorite;

      const nextFavorite = {
        ...favorite,
        authorAvatar: nextAuthorAvatar,
        characterAvatar: avatar
      };
      changedFavorites.push(nextFavorite);
      return nextFavorite;
    });

    smallTheaters.value = smallTheaters.value.map((theater) => {
      if (theater.charId !== characterId || theater.authorAvatar === avatar) return theater;
      const nextTheater = { ...theater, authorAvatar: avatar };
      changedTheaters.push(nextTheater);
      return nextTheater;
    });

    if (!changedPosts.length && !changedFavorites.length && !changedTheaters.length) return;

    await Promise.all([
      ...changedPosts.map((post) => putEntity('voomPosts', createPersistableVoomPost(post))),
      ...changedFavorites.map((favorite) => putEntity('favorites', toRaw(favorite))),
      ...changedTheaters.map((theater) => putEntity('smallTheaters', toRaw(theater)))
    ]);
  }

  function createVoomImageCandidate(input: Omit<VoomImageCandidate, 'id' | 'createdAt'> & Partial<Pick<VoomImageCandidate, 'id' | 'createdAt'>>): VoomImageCandidate {
    return {
      id: input.id || createId('voom-image'),
      image: input.image,
      description: input.description,
      generationPrompt: input.generationPrompt,
      negativePrompt: input.negativePrompt,
      referenceImage: input.referenceImage,
      seed: input.seed,
      provider: input.provider,
      model: input.model,
      size: input.size,
      createdAt: input.createdAt ?? Date.now()
    };
  }

  function createChatImageCandidate(input: Omit<ChatImageCandidate, 'id' | 'createdAt'> & Partial<Pick<ChatImageCandidate, 'id' | 'createdAt'>>): ChatImageCandidate {
    return {
      id: input.id || createId('chat-image'),
      image: input.image,
      description: input.description,
      generationPrompt: input.generationPrompt,
      negativePrompt: input.negativePrompt,
      referenceImage: input.referenceImage,
      seed: input.seed,
      provider: input.provider,
      model: input.model,
      size: input.size,
      createdAt: input.createdAt ?? Date.now()
    };
  }

  function imageSizeToDimensions(size = '') {
    const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10));
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? { width, height }
      : {};
  }

  function normalizeDuplicateKey(value = '') {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  function estimateVoiceDuration(content: string, duration?: number) {
    if (Number.isFinite(duration) && duration && duration > 0) return Math.max(1, Math.round(duration));
    return Math.max(1, Math.ceil(content.trim().length / 4));
  }

  function callModeLabel(mode: ChatCallMode) {
    return mode === 'video' ? '视频通话' : '语音通话';
  }

  function callStatusLabel(status: ChatCallStatus) {
    return {
      ringing: '呼叫中',
      accepted: '已接听',
      rejected: '已拒绝',
      missed: '未接听',
      busy: '忙线',
      cancelled: '已取消呼叫',
      ended: '已结束',
      failed: '呼叫失败'
    }[status];
  }

  function formatCallDuration(seconds: number | undefined) {
    const duration = Math.max(0, Math.floor(Number(seconds) || 0));
    if (!duration) return '';
    const minutes = Math.floor(duration / 60);
    const restSeconds = duration % 60;
    return `${minutes}:${String(restSeconds).padStart(2, '0')}`;
  }

  function formatPromptDuration(seconds: number | undefined) {
    const duration = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    const restSeconds = duration % 60;
    if (hours) return `${hours}小时${minutes}分${restSeconds}秒`;
    if (minutes) return `${minutes}分${restSeconds}秒`;
    return `${restSeconds}秒`;
  }

  function normalizeCallAttachment(call: ChatCallAttachment): ChatCallAttachment {
    const now = Date.now();
    const status: ChatCallStatus = ['ringing', 'accepted', 'rejected', 'missed', 'busy', 'cancelled', 'ended', 'failed'].includes(call.status)
      ? call.status
      : 'ringing';
    const startedAt = Number.isFinite(call.startedAt) && call.startedAt > 0 ? call.startedAt : now;
    const rawConnectedAt = Number(call.connectedAt);
    const rawEndedAt = Number(call.endedAt);
    const rawDuration = Number(call.duration);
    const connectedAt = Number.isFinite(rawConnectedAt) && rawConnectedAt > 0 ? rawConnectedAt : undefined;
    const endedAt = Number.isFinite(rawEndedAt) && rawEndedAt > 0 ? rawEndedAt : undefined;
    const duration = Number.isFinite(rawDuration) && rawDuration > 0
      ? Math.max(1, Math.round(rawDuration))
      : connectedAt && endedAt && endedAt > connectedAt
        ? Math.max(1, Math.round((endedAt - connectedAt) / 1000))
        : undefined;
    return {
      callId: call.callId.trim() || createId('call'),
      mode: call.mode === 'video' ? 'video' : 'voice',
      direction: call.direction === 'incoming' ? 'incoming' : 'outgoing',
      status,
      startedAt,
      connectedAt,
      endedAt,
      duration
    };
  }

  function callParticipantNames(conversationId: string) {
    const conversation = conversationById(conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const boundUser = character ? userById(character.boundUserId) : null;
    return {
      characterName: character ? getCharacterAiName(character) : '角色',
      userName: getUserAiName(boundUser ?? user.value)
    };
  }

  function formatCallContent(call: ChatCallAttachment, names?: { characterName: string; userName: string }) {
    const normalizedCall = normalizeCallAttachment(call);
    const directionText = `${normalizedCall.direction === 'incoming' ? names?.characterName ?? '角色' : names?.userName ?? '用户'}发起`;
    const durationText = formatCallDuration(normalizedCall.duration);
    return `[${callModeLabel(normalizedCall.mode)}] ${directionText} · ${callStatusLabel(normalizedCall.status)}${durationText ? ` · ${durationText}` : ''}`;
  }

  function callEndPromptContent(conversationId: string, call: ChatCallAttachment, actor: 'user' | 'char' = 'user') {
    const normalizedCall = normalizeCallAttachment(call);
    const names = callParticipantNames(conversationId);
    const actorName = actor === 'char' ? names.characterName : names.userName;
    const otherName = actor === 'char' ? names.userName : names.characterName;
    const callLabel = callModeLabel(normalizedCall.mode);
    const inviteLabel = normalizedCall.mode === 'video' ? '视频呼叫' : '语音呼叫';
    const durationText = formatPromptDuration(normalizedCall.duration);
    if (normalizedCall.status === 'rejected') return `${actorName}拒绝了${otherName}拨来的${inviteLabel}。`;
    if (normalizedCall.status === 'cancelled') return `${actorName}取消了拨给${otherName}的${inviteLabel}。`;
    return `${actorName}挂断了和${otherName}的${callLabel}，通话时长${durationText}。`;
  }

  async function appendCallEndPromptMessage(conversationId: string, call: ChatCallAttachment, actor: 'user' | 'char' = 'user') {
    const normalizedCall = normalizeCallAttachment(call);
    const createdAt = (normalizedCall.endedAt ?? Date.now()) + 1;
    return appendConversationEvent(conversationId, callEndPromptContent(conversationId, normalizedCall, actor), { mode: 'online', createdAt });
  }

  function syncPendingIncomingCall() {
    if (activeCall.value) return;
    const message = [...messages.value].reverse().find((entry) => entry.call?.direction === 'incoming' && entry.call.status === 'ringing');
    const conversation = message ? conversationById(message.conversationId) : null;
    const character = conversation ? characterById(conversation.charId) : null;
    if (!message?.call || !conversation || !character) return;
    setActiveCall({
      conversationId: conversation.id,
      callId: message.call.callId,
      eventMessageId: message.id,
      mode: message.call.mode,
      direction: 'incoming',
      status: 'incoming-ringing',
      startedAt: message.call.startedAt,
      muted: false,
      cameraEnabled: false,
      speakerEnabled: true,
      generatedBackgroundUrl: '',
      minimized: false,
      floatPosition: { x: 16, y: 92 },
      peerName: getCharacterVoomDisplayName(character),
      avatar: character.avatar,
      subtitle: message.call.mode === 'video' ? '视频通话来电' : '语音通话来电'
    });
  }

  async function respondToIncomingCall(conversationId: string, callId: string, response: 'accepted' | 'rejected') {
    const active = activeCall.value;
    if (!active || active.conversationId !== conversationId || active.callId !== callId || active.direction !== 'incoming' || active.status !== 'incoming-ringing') return false;
    const eventMessage = messages.value.find((message) => message.id === active.eventMessageId && message.call?.callId === callId);
    if (!eventMessage?.call || eventMessage.call.status !== 'ringing') return false;
    const respondedAt = Date.now();
    if (response === 'rejected') {
      const updatedMessage = await updateCallEventMessage(eventMessage.id, { status: 'rejected', endedAt: respondedAt });
      if (updatedMessage?.call) await appendCallEndPromptMessage(conversationId, updatedMessage.call, 'user');
      clearActiveCall(conversationId);
      return true;
    }

    const connectedAt = eventMessage.call.connectedAt ?? respondedAt;
    const updatedMessage = await updateCallEventMessage(eventMessage.id, { status: 'accepted', connectedAt });
    if (!updatedMessage?.call) return false;
    patchActiveCall(conversationId, {
      status: 'active',
      connectedAt,
      minimized: false,
      subtitle: updatedMessage.call.mode === 'video' ? '视频通话中' : '语音通话中'
    });
    const conversation = conversationById(conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    if (conversation && character) {
      const scene = updatedMessage.call.mode === 'video' ? '视频通话' : '语音通话';
      const names = callParticipantNames(conversationId);
      void requestRoleplayReply(conversationId, {
        callSession: {
          callId,
          mode: updatedMessage.call.mode,
          forceVoice: true
        },
        replyInstruction: `${names.userName}刚刚接听了${names.characterName}主动拨来的${scene}。当前正在通话中，请让${names.characterName}先用适合朗读的短句自然开口，可以连续发送 1-3 个短句；这些句子会作为通话字幕并播放 TTS。`
      });
    }
    return true;
  }

  function callMessageSender(call: ChatCallAttachment): ChatMessage['sender'] {
    return call.direction === 'incoming' ? 'char' : 'user';
  }

  function callStatusFromResponse(status: RoleplayCallResponse['status']): ChatCallStatus {
    if (status === 'accepted') return 'accepted';
    if (status === 'busy') return 'busy';
    if (status === 'missed') return 'missed';
    return 'rejected';
  }

  function findPendingOutgoingCallMessage(conversationId: string, preferredMessageId?: string) {
    const isPendingOutgoingCall = (message: ChatMessage) => message.conversationId === conversationId
      && message.call?.direction === 'outgoing'
      && message.call.status === 'ringing';
    const preferredMessage = preferredMessageId
      ? messages.value.find((message) => message.id === preferredMessageId && isPendingOutgoingCall(message))
      : null;
    if (preferredMessage) return preferredMessage;
    return [...messages.value].reverse().find(isPendingOutgoingCall) ?? null;
  }

  function findOutgoingCallResponseTarget(conversationId: string, preferredMessageId?: string) {
    const normalizedMessageId = String(preferredMessageId ?? '').trim();
    if (!normalizedMessageId) return null;
    return messages.value.find((message) => message.id === normalizedMessageId
      && message.conversationId === conversationId
      && message.call?.direction === 'outgoing') ?? null;
  }

  function gobangStatusFromResponse(status: RoleplayGobangResponse['status']) {
    return status === 'accepted' ? 'accepted' as const : 'rejected' as const;
  }

  function findPendingOutgoingGobangMessage(conversationId: string, preferredMessageId?: string) {
    const isPendingOutgoingGobang = (message: ChatMessage) => message.conversationId === conversationId
      && message.gobang?.direction === 'outgoing'
      && (message.gobang.invitationStatus ?? 'accepted') === 'pending';
    const normalizedMessageId = String(preferredMessageId ?? '').trim();
    if (normalizedMessageId) {
      return messages.value.find((message) => message.id === normalizedMessageId && isPendingOutgoingGobang(message)) ?? null;
    }
    return [...messages.value].reverse().find(isPendingOutgoingGobang) ?? null;
  }

  function estimateJsonBytes(value: unknown) {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch {
      return 0;
    }
  }

  function sampleArrayEntries<T>(entries: T[], maxSamples = 6) {
    if (entries.length <= maxSamples) return entries;
    const sampledEntries: T[] = [];
    const step = Math.max(1, Math.floor(entries.length / maxSamples));
    for (let index = 0; index < entries.length && sampledEntries.length < maxSamples; index += step) {
      sampledEntries.push(entries[index]);
    }
    const lastEntry = entries.at(-1);
    if (lastEntry && sampledEntries[sampledEntries.length - 1] !== lastEntry) sampledEntries[sampledEntries.length - 1] = lastEntry;
    return sampledEntries;
  }

  function estimateArrayJsonBytes(entries: unknown[]) {
    if (!entries.length) return 0;
    if (entries.length <= 20) return estimateJsonBytes(entries);
    const sampledEntries = sampleArrayEntries(entries);
    const sampledBytes = sampledEntries.reduce<number>((total, entry) => total + estimateJsonBytes(entry), 0);
    return Math.round(sampledBytes / Math.max(1, sampledEntries.length) * entries.length);
  }

  function estimateGroupedArrayJsonBytes(groups: unknown[][]) {
    return groups.reduce((total, group) => total + estimateArrayJsonBytes(group), 0);
  }

  function estimateTransformedFreedBytes<T>(entries: T[], transform: (entry: T) => unknown) {
    if (!entries.length) return 0;
    const sampledEntries = entries.length <= 20 ? entries : sampleArrayEntries(entries);
    const sampledFreedBytes = sampledEntries.reduce<number>((total, entry) => total + estimateFreedBytes(entry, transform(entry)), 0);
    return Math.round(sampledFreedBytes / Math.max(1, sampledEntries.length) * entries.length);
  }

  function isInlineMediaUrl(value = '') {
    return /^data:(?:image|audio)\//i.test(value.trim());
  }

  function isLocalMediaUrl(value = '') {
    return isInlineMediaUrl(value) || isLocalMediaCacheUrl(value);
  }

  async function compactInlineDisplayImage(value = '') {
    const imageUrl = value.trim();
    if (!/^data:image\//i.test(imageUrl)) return value;
    try {
      return await compressInlineImageDataUrl(imageUrl, { maxDimension: 800, quality: 0.62, minBytes: 160 * 1024 });
    } catch {
      return value;
    }
  }

  function stripInlineMediaUrl(value: string | undefined, fallback = '') {
    const normalizedValue = String(value ?? '').trim();
    return isLocalMediaUrl(normalizedValue) ? fallback : normalizedValue;
  }

  function stripMessageStickerCache(sticker: NonNullable<ChatMessage['sticker']>) {
    const { cachedImageUrl: _cachedImageUrl, ...restSticker } = sticker;
    return {
      ...restSticker,
      imageUrl: stripInlineMediaUrl(sticker.imageUrl, stickerBackupPlaceholder)
    };
  }

  function stripStickerLocalCache(sticker: Sticker): Sticker {
    const { cachedImageUrl: _cachedImageUrl, cachedImageUpdatedAt: _cachedImageUpdatedAt, ...restSticker } = sticker;
    return {
      ...restSticker,
      imageUrl: stripInlineMediaUrl(sticker.imageUrl, stickerBackupPlaceholder)
    };
  }

  function stripChatImageCache(image: ChatImageAttachment): ChatImageAttachment {
    return {
      ...image,
      url: stripInlineMediaUrl(image.url),
      candidates: image.candidates?.map((candidate) => ({ ...candidate, image: stripInlineMediaUrl(candidate.image) })).filter((candidate) => candidate.image)
    };
  }

  function isUserSentInlineImage(image: ChatImageAttachment | undefined) {
    return Boolean(image && (image.kind === 'photo' || image.kind === 'local') && isLocalMediaUrl(image.url));
  }

  function stripUserSentImageAttachment(image: ChatImageAttachment): ChatImageAttachment {
    return {
      ...image,
      kind: 'description',
      url: '',
      candidates: undefined
    };
  }

  function stripUserSentImageData(message: ChatMessage): ChatMessage {
    let changed = false;
    const nextImage = message.sender === 'user' && isUserSentInlineImage(message.image)
      ? stripUserSentImageAttachment(message.image!)
      : message.image;
    if (nextImage !== message.image) changed = true;

    const nextQuoteImage = message.quote?.sender === 'user' && isUserSentInlineImage(message.quote.image)
      ? stripUserSentImageAttachment(message.quote.image!)
      : message.quote?.image;
    if (nextQuoteImage !== message.quote?.image) changed = true;

    return changed
      ? {
        ...message,
        image: nextImage,
        quote: message.quote ? { ...message.quote, image: nextQuoteImage } : message.quote
      }
      : message;
  }

  function stripVoiceAudioCache(voice: ChatVoiceAttachment): ChatVoiceAttachment {
    return {
      ...voice,
      audioUrl: stripInlineMediaUrl(voice.audioUrl)
    };
  }

  function stripMessageMediaCache(message: ChatMessage): ChatMessage {
    return {
      ...message,
      sticker: message.sticker ? stripMessageStickerCache(message.sticker) : undefined,
      image: message.image ? stripChatImageCache(message.image) : undefined,
      voice: message.voice ? stripVoiceAudioCache(message.voice) : undefined,
      quote: message.quote ? {
        ...message.quote,
        sticker: message.quote.sticker ? stripMessageStickerCache(message.quote.sticker) : undefined,
        image: message.quote.image ? stripChatImageCache(message.quote.image) : undefined,
        voice: message.quote.voice ? stripVoiceAudioCache(message.quote.voice) : undefined
      } : undefined
    };
  }

  function stripImageCandidates(message: ChatMessage): ChatMessage {
    return message.image?.candidates?.length
      ? { ...message, image: { ...message.image, candidates: undefined } }
      : message;
  }

  function stripVoiceAudio(message: ChatMessage): ChatMessage {
    return message.voice?.audioUrl || message.quote?.voice?.audioUrl
      ? {
        ...message,
        voice: message.voice ? { ...message.voice, audioUrl: '' } : undefined,
        quote: message.quote?.voice ? { ...message.quote, voice: { ...message.quote.voice, audioUrl: '' } } : message.quote
      }
      : message;
  }

  function estimateFreedBytes(beforeValue: unknown, afterValue: unknown) {
    return Math.max(0, estimateJsonBytes(beforeValue) - estimateJsonBytes(afterValue));
  }

  function normalizeLocationAttachment(location: ChatLocationAttachment): ChatLocationAttachment | null {
    const name = location.name.trim();
    const distance = location.distance.trim();
    if (!name || !distance) return null;
    return {
      name,
      address: location.address?.trim() || undefined,
      distance
    };
  }

  function formatLocationContent(location: ChatLocationAttachment) {
    return `[定位] ${[location.name, location.address, location.distance].map((item) => item?.trim()).filter(Boolean).join(' · ')}`;
  }

  function normalizeTransferAttachment(transfer: Pick<ChatTransferAttachment, 'amount' | 'note'>): ChatTransferAttachment | null {
    const amount = String(transfer.amount ?? '').replace(/[￥¥,\s]/g, '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return null;
    return {
      amount,
      currency: 'CNY',
      note: transfer.note?.trim() || undefined,
      status: 'pending'
    };
  }

  function formatTransferContent(transfer: Pick<ChatTransferAttachment, 'amount' | 'note' | 'status'>) {
    const statusText = {
      pending: '待处理',
      accepted: '已接收',
      rejected: '已拒绝'
    }[transfer.status];
    return `[转账] ¥${transfer.amount}${transfer.note ? ` · ${transfer.note}` : ''} · ${statusText}`;
  }

  function formatTransferReceiptContent(transfer: Pick<ChatTransferAttachment, 'amount' | 'note' | 'status'>) {
    const statusText = transfer.status === 'accepted'
      ? '已接收'
      : transfer.status === 'rejected'
        ? '已拒绝'
        : '待处理';
    return `[转账回执] ${statusText} ¥${transfer.amount}${transfer.note ? ` · ${transfer.note}` : ''}`;
  }

  function formatTransferMessageContent(transfer: ChatTransferAttachment) {
    return transfer.responseToMessageId
      ? formatTransferReceiptContent(transfer)
      : formatTransferContent(transfer);
  }

  function normalizeCommerceAttachment(commerce: Extract<RoleplayReplySegment, { type: 'commerce' }>, character: CharacterProfile): ChatCommerceAttachment | null {
    const totalAmount = String(commerce.totalAmount ?? '').replace(/[￥¥,\s]/g, '').trim();
    const storeName = String(commerce.storeName ?? '').trim();
    const items = (commerce.items ?? []).map((item) => ({
      name: String(item.name ?? '').trim(),
      quantity: Math.min(99, Math.max(1, Math.floor(Number(item.quantity) || 1))),
      price: item.price && /^\d+(?:\.\d{1,2})?$/.test(String(item.price).trim()) ? String(item.price).trim() : undefined
    })).filter((item) => item.name).slice(0, 8);
    if (!storeName || !items.length || !/^\d+(?:\.\d{1,2})?$/.test(totalAmount) || Number(totalAmount) <= 0) return null;
    return {
      orderId: createId('order'),
      kind: commerce.kind,
      storeName,
      items,
      totalAmount,
      currency: 'CNY',
      status: commerce.kind === 'takeout' ? 'preparing' : 'paid',
      eta: commerce.eta?.trim() || undefined,
      note: commerce.note?.trim() || undefined,
      cardMessage: commerce.cardMessage?.trim() || undefined,
      purchaserCharacterId: character.id,
      purchaserName: getCharacterAiName(character)
    };
  }

  function formatCommerceContent(commerce: ChatCommerceAttachment) {
    const kindText = commerce.kind === 'takeout' ? '外卖' : commerce.kind === 'gift' ? '礼物' : '购物';
    return `[${kindText}订单] ${commerce.storeName} · ${commerce.items.map((item) => `${item.name}×${item.quantity}`).join('、')} · ¥${commerce.totalAmount}`;
  }

  function formatShopShareContent(share: ChatShopShareAttachment) {
    const kindText = {
      product: '商城商品',
      'character-pick': '共同挑选',
      wishlist: '共同愿望单',
      storefront: '角色店铺',
      moment: '商城晒单',
      order: '商城订单'
    }[share.kind];
    const priceText = typeof share.priceCents === 'number' ? ` · ¥${(share.priceCents / 100).toFixed(2)}` : '';
    const noteText = share.note?.trim() ? ` · ${share.note.trim()}` : '';
    return `[${kindText}] ${share.title}${share.storeName ? ` · ${share.storeName}` : ''}${priceText}${noteText}`;
  }

  function musicTrackArtists(track?: MusicTrack | null) {
    return track?.artists?.filter(Boolean).join(' / ') || '未知歌手';
  }

  function musicTrackTitle(track?: MusicTrack | null) {
    if (!track) return '一起听';
    const artists = musicTrackArtists(track);
    return artists ? `${track.name} - ${artists}` : track.name;
  }

  function normalizeMusicListenInviteAttachment(payload: Partial<Pick<ChatMusicListenInviteAttachment, 'note' | 'track'>> = {}): ChatMusicListenInviteAttachment {
    return {
      status: 'pending',
      note: payload.note?.trim() || undefined,
      track: payload.track
    };
  }

  function formatMusicListenInviteContent(invitation: Pick<ChatMusicListenInviteAttachment, 'status' | 'note' | 'track'>) {
    const statusText = {
      pending: '等待选择',
      accepted: '正在一起听',
      rejected: '已拒绝'
    }[invitation.status];
    return `[一起听] ${musicTrackTitle(invitation.track)}${invitation.note ? ` · ${invitation.note}` : ''} · ${statusText}`;
  }

  function musicListeningContextForConversation(conversationId: string): MusicListeningContext | undefined {
    const partner = musicPlayer.listeningPartner;
    if (!partner || partner.conversationId !== conversationId) return undefined;
    const conversation = conversationById(conversationId);
    const character = characterById(partner.characterId || conversation?.charId || '');
    const boundUser = userById(partner.userId || conversation?.userId || '') ?? user.value;
    return {
      active: true,
      conversationId,
      characterId: partner.characterId,
      characterName: character ? getCharacterAiName(character) : '角色',
      userId: partner.userId,
      inviter: partner.inviter,
      joinedAt: partner.joinedAt,
      currentTrack: musicPlayer.currentTrack ?? undefined,
      currentTime: musicPlayer.currentTime,
      duration: musicPlayer.duration,
      lyricLine: musicPlayer.currentLyricLine || undefined
    };
  }

  function syncMusicFavoriteTracks(tracks: MusicTrack[]) {
    musicFavoriteTracks.value = [...tracks].sort((left, right) => (right.addedAt ?? 0) - (left.addedAt ?? 0));
  }

  async function saveMusicFavoriteTrack(track: MusicTrack) {
    const now = Date.now();
    const existing = musicFavoriteTracks.value.find((entry) => entry.id === track.id);
    const nextTrack = mergeMusicTrack(track, {
      addedAt: existing?.addedAt ?? track.addedAt ?? now,
      updatedAt: now
    });
    const nextTracks = musicFavoriteTracks.value.filter((entry) => entry.id !== nextTrack.id);
    syncMusicFavoriteTracks([nextTrack, ...nextTracks]);
    await putEntity('musicFavoriteTracks', nextTrack);
    return nextTrack;
  }

  function musicSourceForSearch(source?: string) {
    const normalizedSource = source?.trim().toLocaleLowerCase();
    return normalizedSource === 'kuwo' || normalizedSource === 'joox' ? normalizedSource : 'netease';
  }

  async function withMusicCover(track: MusicTrack) {
    if (track.coverUrl || !track.picId) return track;
    const coverUrl = await fetchMusicCoverUrl(track);
    return coverUrl ? mergeMusicTrack(track, { coverUrl }) : track;
  }

  async function ensurePlayableMusicTrack(track: MusicTrack) {
    return refreshPlayableMusicTrack(track);
  }

  async function resolveMusicTrackFromAction(action: { query?: string; source?: string; track?: Partial<MusicTrack> } | null | undefined) {
    if (!action) return null;
    const draft = action.track;
    if (draft?.id && draft.platformId && draft.source && draft.name) {
      return withMusicCover({
        id: draft.id,
        platformId: draft.platformId,
        urlId: draft.urlId,
        source: draft.source,
        name: draft.name,
        artists: draft.artists ?? [],
        album: draft.album ?? '',
        picId: draft.picId ?? '',
        lyricId: draft.lyricId ?? '',
        coverUrl: draft.coverUrl,
        audioUrl: draft.audioUrl,
        duration: draft.duration,
        addedAt: draft.addedAt,
        updatedAt: draft.updatedAt
      });
    }
    const query = action.query?.trim() || draft?.name?.trim() || '';
    if (!query) return null;
    const tracks = await searchMusicTracks(query, musicSourceForSearch(action.source), 1, 8);
    return tracks[0] ? withMusicCover(tracks[0]) : null;
  }

  async function playMusicTrackForConversation(conversationId: string, track: MusicTrack) {
    const playableTrack = await ensurePlayableMusicTrack(track);
    musicPlayer.setCurrentTrack(playableTrack);
    await musicPlayer.playTrack(playableTrack);
    if (musicFavoriteTracks.value.some((entry) => entry.id === playableTrack.id)) await saveMusicFavoriteTrack(playableTrack);
    return playableTrack;
  }

  async function playMusicQueueTrack(track: MusicTrack) {
    musicPlayer.setLoadingAudioTrackId(track.id);
    try {
      const playableTrack = await ensurePlayableMusicTrack(track);
      await musicPlayer.playTrack(playableTrack, { restart: true });
      if (musicFavoriteTracks.value.some((entry) => entry.id === playableTrack.id)) await saveMusicFavoriteTrack(playableTrack);
      return playableTrack;
    } finally {
      if (musicPlayer.loadingAudioTrackId === track.id) musicPlayer.setLoadingAudioTrackId('');
    }
  }

  async function saveMusicFavoriteTrackIfNeeded(track: MusicTrack) {
    if (musicFavoriteTracks.value.some((entry) => entry.id === track.id)) await saveMusicFavoriteTrack(track);
  }

  function playbackQueueWithCurrent() {
    const storedQueue = musicPlayer.playbackQueue.length ? musicPlayer.playbackQueue : musicFavoriteTracks.value;
    const currentTrack = musicPlayer.currentTrack;
    if (!currentTrack || storedQueue.some((track) => track.id === currentTrack.id)) return storedQueue;
    return [currentTrack, ...storedQueue];
  }

  function randomPlaybackQueueTrack(queue: MusicTrack[]) {
    const currentTrackId = musicPlayer.currentTrack?.id || '';
    if (queue.length <= 1) return queue[0] ?? null;
    const candidates = queue.filter((track) => track.id !== currentTrackId);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? queue[0] ?? null;
  }

  function nextPlaybackQueueTrack(direction: -1 | 1 = 1, options: { ignoreRepeatOne?: boolean } = {}) {
    const queue = playbackQueueWithCurrent();
    if (!queue.length) return null;
    const currentTrack = musicPlayer.currentTrack;
    if (!options.ignoreRepeatOne && musicPlayer.playbackMode === 'repeat-one' && currentTrack) return currentTrack;
    if (musicPlayer.playbackMode === 'shuffle') return randomPlaybackQueueTrack(queue);
    const currentIndex = currentTrack ? queue.findIndex((track) => track.id === currentTrack.id) : -1;
    const normalizedIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = normalizedIndex + direction;
    if (musicPlayer.playbackMode === 'sequence' && (nextIndex < 0 || nextIndex >= queue.length)) return null;
    return queue[(nextIndex + queue.length) % queue.length] ?? null;
  }

  async function playNextMusicTrackAfterEnded() {
    const nextTrack = nextPlaybackQueueTrack(1);
    if (!nextTrack) return;
    try {
      await playMusicQueueTrack(nextTrack);
    } catch (error) {
      console.warn('Music queue autoplay failed.', error);
    }
  }

  async function playNextMusicTrackAfterRecoveryFailure(failedTrackId: string) {
    const nextTrack = nextPlaybackQueueTrack(1, { ignoreRepeatOne: true });
    if (!nextTrack || nextTrack.id === failedTrackId) return;
    try {
      await playMusicQueueTrack(nextTrack);
    } catch (error) {
      console.warn('Music queue recovery fallback failed.', error);
    }
  }

  let recoveringMusicPlayback = false;

  async function recoverCurrentMusicPlayback() {
    if (recoveringMusicPlayback) return;
    const track = musicPlayer.currentTrack;
    if (!track) return;
    recoveringMusicPlayback = true;
    const resumeSecond = musicPlayer.lastGoodTime || musicPlayer.currentTime || 0;
    const safeResumeSecond = Math.max(0, resumeSecond - 1);
    musicPlayer.setLoadingAudioTrackId(track.id);
    let lastError: unknown = null;
    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const playableTrack = await ensurePlayableMusicTrack(track);
          await musicPlayer.playTrack(playableTrack, { restart: true, resumeAt: safeResumeSecond });
          await saveMusicFavoriteTrackIfNeeded(playableTrack);
          return;
        } catch (error) {
          lastError = error;
        }
      }
      console.warn('Music playback recovery failed.', musicPlayer.playbackRecoveryReason, lastError);
      await playNextMusicTrackAfterRecoveryFailure(track.id);
    } finally {
      recoveringMusicPlayback = false;
      if (musicPlayer.loadingAudioTrackId === track.id) musicPlayer.setLoadingAudioTrackId('');
    }
  }

  watch(() => musicPlayer.playbackEndedTick, (tick, previousTick) => {
    if (!tick || tick === previousTick) return;
    void playNextMusicTrackAfterEnded();
  });

  watch(() => musicPlayer.playbackRecoveryTick, (tick, previousTick) => {
    if (!tick || tick === previousTick) return;
    void recoverCurrentMusicPlayback();
  });

  function startMusicListenTogether(conversationId: string, inviter: 'user' | 'char') {
    const conversation = conversationById(conversationId);
    if (!conversation) return false;
    const character = characterById(conversation.charId);
    const boundUser = userById(conversation.userId || character?.boundUserId || '') ?? user.value;
    if (!character || !boundUser) return false;
    musicPlayer.startListenTogether({
      conversationId,
      characterId: character.id,
      userId: boundUser.id,
      inviter
    });
    return true;
  }

  async function stopMusicListenTogether(conversationId: string, actor: 'user' | 'char' = 'user') {
    const partner = musicPlayer.listeningPartner;
    if (!partner || partner.conversationId !== conversationId) return false;
    const conversation = conversationById(conversationId);
    if (!conversation) {
      musicPlayer.stopListenTogether(partner.characterId);
      return false;
    }
    const names = callParticipantNames(conversationId);
    const actorName = actor === 'char' ? names.characterName : names.userName;
    const otherName = actor === 'char' ? names.userName : names.characterName;
    const durationText = formatPromptDuration(Math.max(0, Math.round((Date.now() - partner.joinedAt) / 1000)));
    const trackName = musicPlayer.currentTrack?.name.trim();
    await appendConversationEvent(
      conversationId,
      `${actorName}关闭了和${otherName}的一起听，已一起听${durationText}${trackName ? `，关闭时正在播放《${trackName}》` : ''}。`,
      { mode: 'online' }
    );
    musicPlayer.stopListenTogether(partner.characterId);
    return true;
  }

  async function applyCharacterMusicActions(conversationId: string, actions: Array<{ type: string; query?: string; source?: string; track?: Partial<MusicTrack> }>) {
    if (!musicPlayer.isListeningWithConversation(conversationId)) return [];
    const conversation = conversationById(conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const characterName = character ? getCharacterAiName(character) : '角色';
    const notices: string[] = [];
    for (const action of actions.slice(0, 4)) {
      try {
        if (action.type === 'favorite_current') {
          const track = musicPlayer.currentTrack;
          if (track) {
            await saveMusicFavoriteTrack(track);
            notices.push(`${characterName}把《${track.name}》加入了我的喜欢音乐。`);
          }
          continue;
        }
        const track = await resolveMusicTrackFromAction(action);
        if (!track) continue;
        if (action.type === 'favorite_track') {
          await saveMusicFavoriteTrack(track);
          notices.push(`${characterName}把《${track.name}》加入了我的喜欢音乐。`);
          continue;
        }
        if (action.type === 'play') {
          const playableTrack = await playMusicTrackForConversation(conversationId, track);
          notices.push(`${characterName}切到了《${playableTrack.name}》。`);
        }
      } catch (error) {
        console.warn('Music action failed.', error);
      }
    }
    return notices;
  }

  function createSmallTheaterUrl(theaterId: string) {
    return `/theaters/${encodeURIComponent(theaterId)}`;
  }

  function normalizeSmallTheaterLinkAttachment(theater: SmallTheater): ChatSmallTheaterLinkAttachment {
    const visibleContent = getSmallTheaterVisibleText(theater.html).slice(0, 20000);
    return {
      theaterId: theater.id,
      title: theater.title.trim() || '小剧场',
      summary: theater.summary.trim() || '互动番外页面',
      url: createSmallTheaterUrl(theater.id),
      content: visibleContent || theater.summary.trim() || theater.title.trim() || '这个小剧场暂时没有可提取的正文。'
    };
  }

  function formatSmallTheaterLinkContent(link: Pick<ChatSmallTheaterLinkAttachment, 'title' | 'summary' | 'url'>) {
    return `[网站链接] ${link.title}${link.summary ? ` · ${link.summary}` : ''} · ${link.url}`;
  }

  function formatLinkPreviewContent(link: Pick<ChatLinkPreviewAttachment, 'title' | 'description' | 'url'>) {
    return `[链接卡片] ${link.title}${link.description ? ` · ${link.description}` : ''} · ${link.url}`;
  }

  function formatOfflineInvitationContent(invitation: Pick<ChatOfflineInvitationAttachment, 'status'>) {
    const statusText = {
      pending: '等待选择',
      accepted: '已接受',
      rejected: '已拒绝'
    }[invitation.status];
    return `[线下邀请] ${statusText}`;
  }

  function formatGobangContent(game: ChatGobangAttachment) {
    const invitationStatus = game.invitationStatus ?? 'accepted';
    const inviter = game.direction === 'incoming' ? '角色' : '用户';
    if (invitationStatus === 'pending') return `[五子棋邀请] ${inviter}发起，等待${game.direction === 'incoming' ? '用户' : '角色'}回应。`;
    if (invitationStatus === 'rejected') return `[五子棋邀请] ${inviter}发起，对方已拒绝。`;
    if (invitationStatus === 'cancelled') return `[五子棋邀请] ${inviter}发起，邀请已取消。`;
    const userStone = game.userStone === 'black' ? '黑棋' : '白棋';
    const status = {
      active: `对局进行中，当前轮到${game.turn === 'user' ? '用户' : '角色'}落子`,
      'user-won': '用户五子连珠并获胜',
      'char-won': '角色五子连珠并获胜',
      draw: '棋盘落满，双方平局',
      resigned: '用户认输，角色获胜'
    }[game.status];
    const latestDialogues = game.moves
      .filter((move) => move.player === 'char' && move.dialogue?.trim())
      .slice(-6)
      .map((move) => formatContentWithChineseTranslation(move.dialogue?.trim() ?? '', move.dialogueTranslation))
      .filter(Boolean);
    const apiNotice = game.apiState?.status === 'failed' || game.apiState?.status === 'interrupted'
      ? '角色本手 API 落子失败，等待用户决定是否重试。'
      : '';
    return [
      `[五子棋] 用户执${userStone}；${status}；已落 ${game.moves.length} 手。`,
      latestDialogues.length ? `角色最近的真实桌边对白：${latestDialogues.join(' / ')}` : '',
      apiNotice
    ].filter(Boolean).join(' ');
  }

  function normalizeOfflineInvitationAttachment(prompt: string): ChatOfflineInvitationAttachment | null {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) return null;
    return {
      prompt: normalizedPrompt,
      status: 'pending'
    };
  }

  async function appendConversationEvent(conversationId: string, content: string, options: Partial<Pick<ChatMessage, 'mode' | 'voomPostId' | 'voomCommentId' | 'voomEventType' | 'replyBatchId' | 'createdAt' | 'contextOnly'>> = {}) {
    const conversation = conversationById(conversationId);
    if (!conversation || !content.trim()) return null;
    const contextOnly = Boolean(options.contextOnly);
    const message: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'system',
      mode: options.mode ?? conversation.activeMode,
      content: content.trim(),
      createdAt: options.createdAt ?? Date.now(),
      displayStyle: contextOnly ? undefined : 'narration',
      contextOnly: contextOnly || undefined,
      status: 'sent',
      voomPostId: options.voomPostId,
      voomCommentId: options.voomCommentId,
      voomEventType: options.voomEventType,
      replyBatchId: options.replyBatchId
    };
    messages.value.push(message);
    await putEntity('messages', message);
    const nextConversation = { ...conversation, updatedAt: message.createdAt };
    const index = conversations.value.findIndex((item) => item.id === conversationId);
    if (index >= 0) conversations.value[index] = nextConversation;
    await putEntity('conversations', nextConversation);
    return message;
  }

  async function appendCallEventMessage(conversationId: string, call: ChatCallAttachment) {
    const conversation = conversationById(conversationId);
    if (!conversation) return null;
    const normalizedCall = normalizeCallAttachment(call);
    const message: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: callMessageSender(normalizedCall),
      mode: 'online',
      content: formatCallContent(normalizedCall, callParticipantNames(conversationId)),
      call: normalizedCall,
      callId: normalizedCall.callId,
      callMode: normalizedCall.mode,
      createdAt: normalizedCall.startedAt,
      status: 'sent',
      readAt: conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(message);
    await putEntity('messages', message);
    const nextConversation = { ...conversation, updatedAt: message.createdAt, activeMode: 'online' as const };
    const index = conversations.value.findIndex((item) => item.id === conversationId);
    if (index >= 0) conversations.value[index] = nextConversation;
    await putEntity('conversations', nextConversation);
    return message;
  }

  async function updateCallEventMessage(messageId: string, patch: Partial<Omit<ChatCallAttachment, 'callId' | 'mode' | 'direction' | 'startedAt'>>) {
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    if (!existingMessage.call) return null;
    const nextCall = normalizeCallAttachment({
      ...existingMessage.call,
      ...patch
    });
    const nextMessage: ChatMessage = {
      ...existingMessage,
      sender: callMessageSender(nextCall),
      content: formatCallContent(nextCall, callParticipantNames(existingMessage.conversationId)),
      call: nextCall,
      callId: nextCall.callId,
      callMode: nextCall.mode,
      editedAt: Date.now()
    };
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    await touchConversationAfterMessageChange(nextMessage.conversationId, nextMessage.editedAt);
    if (existingMessage.call.status === 'ringing' && nextCall.status !== 'ringing') void dismissLinkCallNotification(nextCall.callId);
    return nextMessage;
  }

  function expandMessageIds(messageIds: string | string[]) {
    const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
    return [...new Set(ids.flatMap((id) => String(id).split('__')).map((id) => id.trim()).filter(Boolean))];
  }

  function expandMessageIdsForDeletion(messageIds: string | string[]) {
    const ids = expandMessageIds(messageIds);
    const idSet = new Set(ids);
    const callKeys = new Set(messages.value
      .filter((message) => idSet.has(message.id) && message.call?.callId)
      .map((message) => `${message.conversationId}:${message.call?.callId}`));
    const gobangKeys = new Set(messages.value
      .filter((message) => idSet.has(message.id) && message.gobang?.gameId)
      .map((message) => `${message.conversationId}:${message.gobang?.gameId}`));
    const transferSourceIds = new Set(messages.value
      .filter((message) => idSet.has(message.id) && message.transfer && !message.transfer.responseToMessageId)
      .map((message) => message.id));

    if (!callKeys.size && !gobangKeys.size && !transferSourceIds.size) return ids;
    for (const message of messages.value) {
      if (message.callId && callKeys.has(`${message.conversationId}:${message.callId}`)) idSet.add(message.id);
      if (message.gobangId && gobangKeys.has(`${message.conversationId}:${message.gobangId}`)) idSet.add(message.id);
      if (message.transfer?.responseToMessageId && transferSourceIds.has(message.transfer.responseToMessageId)) idSet.add(message.id);
    }
    return [...idSet];
  }

  function isRoleplayNarrationMessage(message: ChatMessage) {
    return message.sender === 'system'
      && message.displayStyle === 'narration'
      && !message.voomPostId
      && !message.voomCommentId
      && !message.voomEventType;
  }

  function cloneMessageQuote(quote?: ChatMessageQuote | null): ChatMessageQuote | undefined {
    if (!quote?.messageId || !quote.content.trim()) return undefined;
    return {
      messageId: quote.messageId,
      sender: quote.sender,
      authorName: quote.authorName.trim() || '未知',
      authorType: quote.authorType,
      authorId: quote.authorId,
      content: quote.content.trim(),
      sticker: quote.sticker ? { ...quote.sticker } : undefined,
      image: quote.image ? { ...quote.image } : undefined,
      voice: quote.voice ? { ...quote.voice } : undefined,
      location: quote.location ? { ...quote.location } : undefined,
      transfer: quote.transfer ? { ...quote.transfer } : undefined,
      commerce: quote.commerce ? { ...quote.commerce, items: quote.commerce.items.map((item) => ({ ...item })) } : undefined,
      shopShare: quote.shopShare ? { ...quote.shopShare } : undefined,
      musicListenInvite: quote.musicListenInvite ? { ...quote.musicListenInvite } : undefined,
      linkPreview: quote.linkPreview ? { ...quote.linkPreview } : undefined,
      theaterLink: quote.theaterLink ? { ...quote.theaterLink } : undefined,
      offlineInvitation: quote.offlineInvitation ? { ...quote.offlineInvitation } : undefined,
      call: quote.call ? { ...quote.call } : undefined
    };
  }

  function messageReadableContent(message: ChatMessage) {
    if (message.mcpOperations?.length) return formatChatMcpOperations(message.mcpOperations).trim();
    if (message.sticker) return `[Sticker] ${message.sticker.description}`.trim();
    if (message.image) return `[图片] ${message.image.description}`.trim();
    if (message.voice) return `[语音] ${message.voice.transcript}`.trim();
    if (message.location) return formatLocationContent(message.location).trim();
    if (message.transfer) return formatTransferMessageContent(message.transfer).trim();
    if (message.commerce) return formatCommerceContent(message.commerce).trim();
    if (message.shopShare) return formatShopShareContent(message.shopShare).trim();
    if (message.musicListenInvite) return formatMusicListenInviteContent(message.musicListenInvite).trim();
    if (message.linkPreview) return formatLinkPreviewContent(message.linkPreview).trim();
    if (message.theaterLink) return formatSmallTheaterLinkContent(message.theaterLink).trim();
    if (message.offlineInvitation) return formatOfflineInvitationContent(message.offlineInvitation).trim();
    if (message.call) return formatCallContent(message.call, callParticipantNames(message.conversationId)).trim();
    if (message.gobang) return formatGobangContent(message.gobang).trim();
    return message.content.trim();
  }

  function favoriteKindForMessage(message: ChatMessage): FavoriteMessageKind {
    if (message.sticker) return 'sticker';
    if (message.image) return 'image';
    if (message.voice) return 'voice';
    if (message.location) return 'location';
    if (message.transfer) return 'transfer';
    if (message.commerce) return 'commerce';
    if (message.shopShare) return 'shopShare';
    if (message.musicListenInvite) return 'musicListenInvite';
    if (message.theaterLink) return 'theaterLink';
    if (message.offlineInvitation) return 'offlineInvitation';
    if (message.call) return 'call';
    if (message.displayStyle === 'narration') return 'narration';
    return 'text';
  }

  function canFavoriteMessage(message: ChatMessage) {
    if (message.voice) return true;
    if (message.image) return Boolean(message.image.url);
    if (message.sticker || message.location || message.transfer || message.commerce || message.shopShare || message.musicListenInvite || message.linkPreview || message.theaterLink || message.offlineInvitation || message.call || message.gobang) return false;
    return Boolean(message.content.trim() || message.displayStyle === 'narration');
  }

  function groupMemberForMessage(conversation: Conversation | undefined, message: Pick<ChatMessage, 'authorId' | 'authorName' | 'authorType'>) {
    if (conversation?.kind !== 'group') return undefined;
    return conversation.groupMembers?.find((member) => (message.authorId && (member.id === message.authorId || member.identityId === message.authorId))
      || (message.authorType === member.identityType && Boolean(message.authorName?.trim()) && member.trueName === message.authorName?.trim()));
  }

  function characterForMessageVoice(message: ChatMessage) {
    const conversation = conversationById(message.conversationId);
    if (!conversation) return null;
    if (conversation.kind !== 'group') return characterById(conversation.charId);
    const groupMember = groupMemberForMessage(conversation, message);
    if (groupMember?.identityType === 'character' && groupMember.identityId) return characterById(groupMember.identityId);
    return characterById(conversation.charId);
  }

  function normalizeFavorites(entries: FavoriteMessageRecord[]) {
    return entries
      .filter((entry) => entry?.id && entry.sourceMessageId && entry.message)
      .map((entry) => {
        const conversation = conversationById(entry.conversationId);
        const message = normalizeStoredMessageAuthorReference(entry.message);
        const groupMember = groupMemberForMessage(conversation, message);
        const character = conversation?.kind === 'group'
          ? groupMember?.identityType === 'character' && groupMember.identityId ? characterById(groupMember.identityId) : null
          : entry.characterId
            ? characterById(entry.characterId)
            : conversation
              ? characterById(conversation.charId)
              : null;
        const boundUser = entry.userId ? userById(entry.userId) : conversation ? userById(conversation.userId) : null;
        const authorName = groupMember?.trueName || (entry.sender === 'char'
          ? character ? getCharacterAiName(character) : voomAiNameForIdentity(entry.authorName, entry.characterId)
          : entry.sender === 'user'
            ? boundUser ? getUserAiName(boundUser) : voomAiNameForIdentity(entry.authorName, entry.userId)
            : '系统');
        return {
          ...entry,
          authorName,
          authorAvatar: groupMember?.avatar || character?.avatar || entry.authorAvatar,
          characterId: character?.id,
          characterName: character ? getCharacterAiName(character) : conversation?.kind === 'group' ? undefined : entry.characterName ? voomAiNameForIdentity(entry.characterName, entry.characterId) : undefined,
          characterAvatar: character?.avatar,
          userName: boundUser ? getUserAiName(boundUser) : entry.userName ? voomAiNameForIdentity(entry.userName, entry.userId) : undefined,
          message,
          kind: favoriteKindForMessage(message),
          messageCreatedAt: Number.isFinite(entry.messageCreatedAt) ? entry.messageCreatedAt : message.createdAt,
          favoritedAt: Number.isFinite(entry.favoritedAt) ? entry.favoritedAt : Date.now()
        };
      })
      .filter((entry) => canFavoriteMessage(entry.message))
      .sort((left, right) => right.favoritedAt - left.favoritedAt);
  }

  const sortedFavorites = computed(() => [...favorites.value].sort((left, right) => right.favoritedAt - left.favoritedAt));

  function messageAuthorName(message: ChatMessage) {
    if (message.authorName?.trim()) return message.authorName.trim();
    const conversation = conversationById(message.conversationId);
    if (message.sender === 'char') {
      const character = conversation ? characterById(conversation.charId) : null;
      return character ? getCharacterAiName(character) : '角色';
    }
    if (message.sender === 'user') {
      const character = conversation ? characterById(conversation.charId) : null;
      const boundUser = character ? userById(character.boundUserId) : null;
      return getUserAiName(boundUser ?? user.value);
    }
    return '系统';
  }

  function createMessageQuoteSnapshot(message: ChatMessage): ChatMessageQuote | null {
    const content = messageReadableContent(message);
    if (!content) return null;
    return {
      messageId: message.id,
      sender: message.sender,
      authorName: messageAuthorName(message),
      authorType: message.authorType,
      authorId: message.authorId,
      content,
      sticker: message.sticker ? { ...message.sticker } : undefined,
      image: message.image ? { ...message.image } : undefined,
      voice: message.voice ? { ...message.voice } : undefined,
      location: message.location ? { ...message.location } : undefined,
      transfer: message.transfer ? { ...message.transfer } : undefined,
      commerce: message.commerce ? { ...message.commerce, items: message.commerce.items.map((item) => ({ ...item })) } : undefined,
      shopShare: message.shopShare ? { ...message.shopShare } : undefined,
      musicListenInvite: message.musicListenInvite ? { ...message.musicListenInvite } : undefined,
      linkPreview: message.linkPreview ? { ...message.linkPreview } : undefined,
      theaterLink: message.theaterLink ? { ...message.theaterLink } : undefined,
      offlineInvitation: message.offlineInvitation ? { ...message.offlineInvitation } : undefined,
      call: message.call ? { ...message.call } : undefined
    };
  }

  function createFavoriteSnapshot(message: ChatMessage): FavoriteMessageRecord {
    const conversation = conversationById(message.conversationId);
    const groupMember = groupMemberForMessage(conversation, message);
    const character = groupMember?.identityType === 'character' && groupMember.identityId
      ? characterById(groupMember.identityId)
      : conversation?.kind !== 'group' && conversation
        ? characterById(conversation.charId)
        : null;
    const boundUser = conversation ? userById(conversation.userId) : null;
    const authorName = messageAuthorName(message);
    const authorAvatar = groupMember?.avatar || (message.sender === 'char'
      ? character?.avatar
      : message.sender === 'user'
        ? boundUser?.avatar || user.value?.avatar
        : undefined);

    return {
      id: createId('fav'),
      sourceMessageId: message.id,
      conversationId: message.conversationId,
      mode: message.mode,
      kind: favoriteKindForMessage(message),
      sender: message.sender,
      authorName,
      authorAvatar,
      characterId: character?.id,
      characterName: character ? getCharacterAiName(character) : undefined,
      characterAvatar: character?.avatar,
      userId: boundUser?.id,
      userName: boundUser ? getUserAiName(boundUser) : undefined,
      userAvatar: boundUser?.avatar,
      summary: messageReadableContent(message),
      message: toRaw(message),
      messageCreatedAt: message.createdAt,
      favoritedAt: Date.now()
    };
  }

  function isMessageFavorited(messageId: string) {
    return favorites.value.some((entry) => entry.sourceMessageId === messageId);
  }

  async function addFavoriteMessage(message: ChatMessage) {
    if (!canFavoriteMessage(message)) return null;
    const existing = favorites.value.find((entry) => entry.sourceMessageId === message.id);
    if (existing) return existing;
    const favorite = createFavoriteSnapshot(message);
    favorites.value = normalizeFavorites([favorite, ...favorites.value]);
    await putEntity('favorites', favorite);
    return favorite;
  }

  async function deleteFavorite(favoriteId: string) {
    const index = favorites.value.findIndex((entry) => entry.id === favoriteId);
    if (index < 0) return false;
    favorites.value.splice(index, 1);
    await deleteEntity('favorites', favoriteId);
    return true;
  }

  async function touchConversationAfterMessageChange(conversationId: string, fallbackTime = Date.now()) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    const remainingMessages = messagesForConversation(conversationId);
    const latestMessage = remainingMessages[remainingMessages.length - 1];
    const nextConversation = {
      ...conversation,
      updatedAt: latestMessage?.createdAt ?? fallbackTime,
      unreadCount: 0
    };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
  }

  async function invalidateMemoryEpisodesForMessages(messageIds: Iterable<string>, allowRecapture: boolean) {
    const idSet = new Set(messageIds);
    const affectedEpisodeIds = memoryEpisodes.value
      .filter((episode) => episode.status === 'active' && episode.sourceMessageIds.some((id) => idSet.has(id)))
      .map((episode) => episode.id);
    for (const episodeId of affectedEpisodeIds) {
      await deleteMemoryEpisode(episodeId, { allowRecapture, forgottenReason: 'source-invalidated' });
    }
  }

  async function deleteMessages(messageIds: string | string[]) {
    const ids = expandMessageIdsForDeletion(messageIds);
    if (!ids.length) return 0;
    const idSet = new Set(ids);
    const messagesToRemove = messages.value.filter((message) => idSet.has(message.id));
    if (!messagesToRemove.length) return 0;
    const changedGroupSourceIds = new Map<string, string[]>();
    for (const message of messagesToRemove) {
      const conversation = conversationById(message.conversationId);
      if (conversation?.kind !== 'group' || message.contextOnly) continue;
      changedGroupSourceIds.set(conversation.id, [...(changedGroupSourceIds.get(conversation.id) ?? []), message.id]);
    }
    const affectedConversationIds = [...new Set(messagesToRemove.map((message) => message.conversationId))];
    await invalidateMemoryEpisodesForMessages(ids, false);
    messages.value = messages.value.filter((message) => !idSet.has(message.id));
    await Promise.all(messagesToRemove.map((message) => deleteEntity('messages', message.id)));
    await Promise.all([...changedGroupSourceIds].map(([groupId, sourceMessageIds]) => refreshGroupSyncedContexts(groupId, sourceMessageIds)));
    await Promise.all(affectedConversationIds.map((conversationId) => touchConversationAfterMessageChange(conversationId)));
    queueStoredMediaPrune();
    return messagesToRemove.length;
  }

  async function saveMessages(nextMessages: ChatMessage[]) {
    if (!nextMessages.length) return;
    const nextById = new Map(nextMessages.map((message) => [message.id, message]));
    messages.value = messages.value.map((message) => nextById.get(message.id) ?? message);
    await Promise.all(nextMessages.map((message) => putEntity('messages', message)));
    const affectedConversationIds = [...new Set(nextMessages.map((message) => message.conversationId))];
    await Promise.all(affectedConversationIds.map((conversationId) => touchConversationAfterMessageChange(conversationId)));
  }

  async function updateMessageContent(messageId: string, content: string) {
    const trimmedContent = content.trim();
    if (!trimmedContent) return null;
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    const nextMessage: ChatMessage = {
      ...existingMessage,
      content: existingMessage.sticker
        ? `[Sticker] ${trimmedContent}`
        : existingMessage.image
          ? `[图片] ${trimmedContent}`
          : existingMessage.voice
            ? `[语音] ${trimmedContent}`
            : existingMessage.location
              ? `[定位] ${trimmedContent}`
          : trimmedContent,
      sticker: existingMessage.sticker ? { ...existingMessage.sticker, description: trimmedContent } : existingMessage.sticker,
      image: existingMessage.image ? { ...existingMessage.image, description: trimmedContent } : existingMessage.image,
      voice: existingMessage.voice ? { ...existingMessage.voice, transcript: trimmedContent } : existingMessage.voice,
      location: existingMessage.location ? { ...existingMessage.location, name: trimmedContent } : existingMessage.location,
      editedAt: Date.now()
    };
    await invalidateMemoryEpisodesForMessages([messageId], true);
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    const conversation = conversationById(nextMessage.conversationId);
    if (conversation?.kind === 'group') await refreshGroupSyncedContexts(conversation.id, [nextMessage.id]);
    await touchConversationAfterMessageChange(nextMessage.conversationId, nextMessage.editedAt);
    void maybeAutoCaptureConversationMemory(nextMessage.conversationId);
    return nextMessage;
  }

  async function updateMessageLocation(messageId: string, location: ChatLocationAttachment) {
    const normalizedLocation = normalizeLocationAttachment(location);
    if (!normalizedLocation) return null;
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    if (!existingMessage.location) return null;
    const editedAt = Date.now();
    const nextMessage: ChatMessage = {
      ...existingMessage,
      content: formatLocationContent(normalizedLocation),
      location: normalizedLocation,
      editedAt
    };
    await invalidateMemoryEpisodesForMessages([messageId], true);
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    await touchConversationAfterMessageChange(nextMessage.conversationId, editedAt);
    void maybeAutoCaptureConversationMemory(nextMessage.conversationId);
    return nextMessage;
  }

  async function updateMessageTransfer(messageId: string, transfer: Pick<ChatTransferAttachment, 'amount' | 'note' | 'status'>) {
    const amount = String(transfer.amount ?? '').replace(/[￥¥,\s]/g, '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) return null;
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    if (!existingMessage.transfer) return null;
    const isReceipt = Boolean(existingMessage.transfer.responseToMessageId);
    const requestedStatus: ChatTransferStatus = ['accepted', 'rejected'].includes(transfer.status) ? transfer.status : 'pending';
    const status: ChatTransferStatus = isReceipt && requestedStatus === 'pending'
      ? existingMessage.transfer.status === 'rejected' ? 'rejected' : 'accepted'
      : requestedStatus;
    const relatedReceiptMessages = messages.value.filter((message) => message.transfer?.responseToMessageId === existingMessage.id);
    const editedAt = Date.now();
    const note = transfer.note?.trim() || undefined;
    await invalidateMemoryEpisodesForMessages([
      existingMessage.id,
      ...relatedReceiptMessages.map((message) => message.id),
      ...(existingMessage.transfer.responseToMessageId ? [existingMessage.transfer.responseToMessageId] : [])
    ], true);

    if (isReceipt) {
      const respondedAt = existingMessage.transfer.respondedAt ?? editedAt;
      const nextTransfer: ChatTransferAttachment = {
        ...existingMessage.transfer,
        amount,
        currency: existingMessage.transfer.currency ?? 'CNY',
        note,
        status,
        respondedAt,
        responseToMessageId: existingMessage.transfer.responseToMessageId
      };
      const nextMessage: ChatMessage = {
        ...existingMessage,
        content: formatTransferReceiptContent(nextTransfer),
        transfer: nextTransfer,
        editedAt
      };
      messages.value[messageIndex] = nextMessage;

      const originalMessageIndex = messages.value.findIndex((message) => message.id === nextTransfer.responseToMessageId);
      const originalMessage = originalMessageIndex >= 0 ? messages.value[originalMessageIndex] : null;
      const nextMessages: ChatMessage[] = [nextMessage];
      if (originalMessage?.transfer) {
        const { responseToMessageId, ...originalTransferBase } = originalMessage.transfer;
        void responseToMessageId;
        const originalTransfer: ChatTransferAttachment = {
          ...originalTransferBase,
          amount,
          currency: originalTransferBase.currency ?? 'CNY',
          note,
          status,
          respondedAt
        };
        const nextOriginalMessage: ChatMessage = {
          ...originalMessage,
          content: formatTransferContent(originalTransfer),
          transfer: originalTransfer,
          editedAt
        };
        messages.value[originalMessageIndex] = nextOriginalMessage;
        nextMessages.push(nextOriginalMessage);
      }

      const originalTransferMessage = nextMessages.find((message) => !message.transfer?.responseToMessageId);
      if (originalTransferMessage) await syncChatTransferLedger(originalTransferMessage);
      await Promise.all(nextMessages.map((message) => putEntity('messages', message)));
      await touchConversationAfterMessageChange(nextMessage.conversationId, editedAt);
      void maybeAutoCaptureConversationMemory(nextMessage.conversationId);
      return nextMessage;
    }

    const receiptRespondedAt = relatedReceiptMessages.find((message) => message.transfer?.respondedAt)?.transfer?.respondedAt;
    const respondedAt = status === 'pending' ? undefined : existingMessage.transfer.respondedAt ?? receiptRespondedAt ?? editedAt;
    const nextTransfer: ChatTransferAttachment = {
      ...existingMessage.transfer,
      amount,
      currency: existingMessage.transfer.currency ?? 'CNY',
      note,
      status,
      ...(respondedAt ? { respondedAt } : {})
    };
    if (status === 'pending') delete nextTransfer.respondedAt;
    delete nextTransfer.responseToMessageId;
    const nextMessage: ChatMessage = {
      ...existingMessage,
      content: formatTransferContent(nextTransfer),
      transfer: nextTransfer,
      editedAt
    };
    messages.value[messageIndex] = nextMessage;
    await syncChatTransferLedger(nextMessage);
    await putEntity('messages', nextMessage);
    if (status === 'pending') {
      if (relatedReceiptMessages.length) await deleteMessages(relatedReceiptMessages.map((message) => message.id));
      await touchConversationAfterMessageChange(nextMessage.conversationId, editedAt);
      void maybeAutoCaptureConversationMemory(nextMessage.conversationId);
      return nextMessage;
    }

    const receiptMessages = relatedReceiptMessages.length
      ? relatedReceiptMessages.map((receiptMessage) => {
          const receiptTransfer: ChatTransferAttachment = {
            ...receiptMessage.transfer,
            amount: nextTransfer.amount,
            currency: nextTransfer.currency,
            note: nextTransfer.note,
            status,
            respondedAt,
            responseToMessageId: nextMessage.id
          };
          const nextReceiptMessage: ChatMessage = {
            ...receiptMessage,
            content: formatTransferReceiptContent(receiptTransfer),
            transfer: receiptTransfer,
            editedAt
          };
          const receiptIndex = messages.value.findIndex((message) => message.id === receiptMessage.id);
          if (receiptIndex >= 0) messages.value[receiptIndex] = nextReceiptMessage;
          return nextReceiptMessage;
        })
      : (() => {
          const receiptTransfer: ChatTransferAttachment = {
            amount: nextTransfer.amount,
            currency: nextTransfer.currency,
            note: nextTransfer.note,
            status,
            respondedAt,
            responseToMessageId: nextMessage.id
          };
          return [{
            id: createId('msg'),
            conversationId: nextMessage.conversationId,
            sender: nextMessage.sender === 'char' ? 'user' : 'char',
            mode: nextMessage.mode,
            content: formatTransferReceiptContent(receiptTransfer),
            transfer: receiptTransfer,
            createdAt: editedAt + 1,
            status: 'sent' as const
          } satisfies ChatMessage];
        })();

    if (!relatedReceiptMessages.length) messages.value.push(...receiptMessages);
    await Promise.all(receiptMessages.map((message) => putEntity('messages', message)));
    await touchConversationAfterMessageChange(nextMessage.conversationId, editedAt);
    void maybeAutoCaptureConversationMemory(nextMessage.conversationId);
    return nextMessage;
  }

  async function generateMessageVoiceAudio(messageId: string, options: { force?: boolean } = {}) {
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) throw new Error('语音消息不存在。');

    const existingMessage = messages.value[messageIndex];
    if (!existingMessage.voice) throw new Error('这条消息不是语音消息。');
    if (existingMessage.voice.audioUrl && !options.force) return existingMessage.voice.audioUrl;
    if (existingMessage.sender !== 'char') throw new Error('这条语音没有可播放的本地录音。');

    const currentSettings = settings.value;
    if (!currentSettings) throw new Error('设置尚未载入。');

    const character = characterForMessageVoice(existingMessage);
    const generated = await synthesizeSpeech(existingMessage.voice.transcript, currentSettings, {
      minimaxVoiceId: character?.minimaxVoiceId
    });
    const nextMessage: ChatMessage = {
      ...existingMessage,
      voice: {
        ...existingMessage.voice,
        audioUrl: generated.audioUrl,
        mimeType: generated.mimeType,
        ttsProvider: generated.provider,
        ttsVoiceId: generated.voiceId,
        ttsGeneratedAt: Date.now()
      }
    };
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    return generated.audioUrl;
  }

  async function recallMessage(messageId: string, options: { actor?: 'user' | 'char'; replyBatchId?: string } = {}) {
    const [id] = expandMessageIds(messageId);
    if (!id) return null;
    const targetMessage = messages.value.find((message) => message.id === id);
    if (!targetMessage || targetMessage.sender === 'system') return null;
    if (options.actor && targetMessage.sender !== options.actor) return null;
    const conversation = conversationById(targetMessage.conversationId);
    if (!conversation) return null;
    const actorName = targetMessage.sender === 'user' ? '你' : messageAuthorName(targetMessage);
    const recalledContent = messageReadableContent(targetMessage);
    await deleteMessages(targetMessage.id);
    const recallEvent = await appendConversationEvent(
      targetMessage.conversationId,
      `${actorName}撤回了一条消息：${recalledContent}`,
      { mode: targetMessage.mode, replyBatchId: options.replyBatchId }
    );
    if (conversation.kind === 'group' && recallEvent) await syncGroupEventsToCharacterConversations(conversation, [recallEvent]);
    return recallEvent;
  }

  async function recordVoomPostEvents(post: VoomPost, mode?: ChatMode) {
    const targetConversations = conversationsForVoomPost(post);
    if (!targetConversations.length) return;
    const authorName = voomAiAuthorNameForPost(post);

    for (const targetConversation of targetConversations) {
      const eventMode = mode ?? targetConversation.activeMode;
      await appendConversationEvent(
        targetConversation.id,
        formatVoomPostEvent(post, authorName),
        { mode: eventMode, voomPostId: post.id, voomEventType: 'post', createdAt: post.createdAt }
      );
      if (post.likes.length) {
        await appendConversationEvent(
          targetConversation.id,
          formatVoomLikeEvent(post.likes, authorName),
          { mode: eventMode, voomPostId: post.id, voomEventType: 'like', createdAt: post.createdAt + 1 }
        );
      }
      for (const [index, comment] of post.comments.entries()) {
        await appendConversationEvent(
          targetConversation.id,
          formatVoomCommentEvent(comment, post.comments),
          { mode: eventMode, voomPostId: post.id, voomCommentId: comment.id, voomEventType: 'comment', createdAt: comment.createdAt ?? post.createdAt + post.likes.length + index + 1 }
        );
      }
    }
  }

  async function saveUserProfile(nextUser: UserProfile) {
    const normalizedUser = normalizeUserProfile(nextUser);
    const index = users.value.findIndex((item) => item.id === normalizedUser.id);
    if (index >= 0) users.value[index] = normalizedUser;
    else users.value.unshift(normalizedUser);
    await putEntity('user', normalizedUser);
  }

  async function saveUsers(nextUsers: UserProfile[]) {
    users.value = nextUsers.map((entry) => normalizeUserProfile(entry));
    await Promise.all(users.value.map((entry) => putEntity('user', entry)));
  }

  async function setActiveUser(userId: string) {
    if (!settings.value) return;
    const normalizedSettings = normalizeAppSettings({ ...settings.value, activeUserId: userId });
    settings.value = normalizedSettings;
    await putEntity('settings', normalizedSettings, 'main');
  }

  async function markVoomCharactersRead(characterIds: string[]) {
    if (!settings.value || !user.value) return;
    const readableCharacterIds = [...new Set(characterIds.map((id) => id.trim()).filter(Boolean))];
    if (!readableCharacterIds.length) return;

    const userId = user.value.id;
    const currentUserReadAt = settings.value.voomReadAtByUser[userId] ?? {};
    const nextUserReadAt = { ...currentUserReadAt };
    const now = Date.now();
    let changed = false;

    for (const characterId of readableCharacterIds) {
      if ((nextUserReadAt[characterId] ?? 0) >= now) continue;
      nextUserReadAt[characterId] = now;
      changed = true;
    }

    if (!changed) return;
    const normalizedSettings = normalizeAppSettings({
      ...settings.value,
      voomReadAtByUser: {
        ...settings.value.voomReadAtByUser,
        [userId]: nextUserReadAt
      }
    });
    settings.value = normalizedSettings;
    await putEntity('settings', normalizedSettings, 'main');
  }

  async function saveVisualProfile(nextProfile: VisualProfile) {
    if (!user.value) return;
    await saveUserProfile({
      ...user.value,
      profile: normalizeVisualProfile({
        ...nextProfile,
        nickname: user.value.nickname,
        bio: user.value.signature
      }, user.value)
    });
  }

  async function saveCharacter(nextCharacter: CharacterProfile, options: { profileHistorySource?: ProfileHistorySource } = {}) {
    const existingCharacter = characters.value.find((character) => character.id === nextCharacter.id);
    const characterToNormalize = existingCharacter?.initialProfile && !nextCharacter.initialProfile
      ? { ...nextCharacter, initialProfile: existingCharacter.initialProfile }
      : nextCharacter;
    const normalizedCharacterBase = normalizeCharacterProfile(characterToNormalize, user.value?.id || users.value[0]?.id || '');
    const profileHistoryEntries = existingCharacter
      ? createCharacterProfileHistoryEntries(existingCharacter, normalizedCharacterBase, options.profileHistorySource)
      : [];
    const profileHistory = [
      ...(normalizedCharacterBase.profileHistory?.length ? normalizedCharacterBase.profileHistory : existingCharacter?.profileHistory ?? []),
      ...profileHistoryEntries
    ];
    const normalizedCharacter = profileHistory.length
      ? { ...normalizedCharacterBase, profileHistory }
      : normalizedCharacterBase;
    const index = characters.value.findIndex((character) => character.id === normalizedCharacter.id);
    if (index >= 0) characters.value[index] = normalizedCharacter;
    else characters.value.push(normalizedCharacter);

    if (existingCharacter?.boundUserId !== normalizedCharacter.boundUserId) {
      const previousUser = existingCharacter ? userById(existingCharacter.boundUserId) : null;
      if (previousUser) {
        await saveUserProfile({
          ...previousUser,
          boundCharacterIds: previousUser.boundCharacterIds.filter((id) => id !== normalizedCharacter.id)
        });
      }
      const nextBoundUser = userById(normalizedCharacter.boundUserId);
      if (nextBoundUser) {
        await saveUserProfile({
          ...nextBoundUser,
          boundCharacterIds: [...new Set([...nextBoundUser.boundCharacterIds, normalizedCharacter.id])]
        });
      }
    }

    await putEntity('characters', normalizedCharacter);
    await syncCharacterAvatarReferences(normalizedCharacter);

    const linkedConversation = conversations.value.find((conversation) => conversation.charId === normalizedCharacter.id);
    if (linkedConversation) {
      const nextConversation = {
        ...linkedConversation,
        title: normalizedCharacter.nickname,
        userId: normalizedCharacter.boundUserId
      };
      const conversationIndex = conversations.value.findIndex((conversation) => conversation.id === nextConversation.id);
      if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
      await putEntity('conversations', nextConversation);
    }
  }

  async function saveCharacterSnapshot(nextCharacter: CharacterProfile) {
    const normalizedCharacter = normalizeCharacterProfile(nextCharacter, user.value?.id || users.value[0]?.id || '');
    const index = characters.value.findIndex((character) => character.id === normalizedCharacter.id);
    if (index >= 0) characters.value[index] = normalizedCharacter;
    else characters.value.push(normalizedCharacter);
    await putEntity('characters', normalizedCharacter);
    await syncCharacterAvatarReferences(normalizedCharacter);
  }

  async function deleteCharacterProfileHistoryEntry(characterId: string, entryId: string) {
    const character = characterById(characterId);
    if (!character?.profileHistory?.length) return;
    const nextProfileHistory = character.profileHistory.filter((entry) => entry.id !== entryId);
    if (nextProfileHistory.length === character.profileHistory.length) return;
    await saveCharacterSnapshot({
      ...character,
      profileHistory: nextProfileHistory
    });
  }

  async function clearCharacterProfileHistory(characterId: string) {
    const character = characterById(characterId);
    if (!character?.profileHistory?.length) return;
    await saveCharacterSnapshot({
      ...character,
      profileHistory: []
    });
  }

  async function updateCharacterMindState(characterId: string, lines: unknown, conversationId: string, options: { replyBatchId?: string; profileTheme?: ProfileTheme | null; profileThemeContent?: string } = {}) {
    const character = characterById(characterId);
    const mindStateLines = normalizeCharacterMindStateLines(lines);
    if (!character) return;
    const sourceReplyBatchId = String(options.replyBatchId ?? '').trim();
    const profileTheme = options.profileTheme ?? null;
    const isDefaultTheme = isDefaultProfileTheme(profileTheme);
    const profileThemeContent = extractProfileThemeContent(options.profileThemeContent ?? '', profileTheme?.regex ?? '');
    const profileThemeLines = normalizeProfileThemeContentLines(profileThemeContent);
    const profileThemeHtml = profileTheme && !isDefaultTheme ? renderProfileThemeHtml(profileThemeContent, profileTheme.template) : '';
    const nextMindStateLines = isDefaultTheme
      ? (mindStateLines.length ? mindStateLines : profileThemeLines).slice(0, 5)
      : normalizeCharacterMindStateLines(character.mindState?.lines);
    if (!nextMindStateLines.length && !profileThemeLines.length) return;

    await saveCharacter({
      ...character,
      mindState: {
        lines: nextMindStateLines,
        profileThemeId: profileTheme?.id,
        profileThemeName: profileTheme?.name,
        profileThemeContent: profileThemeLines.join('\n') || (isDefaultTheme ? nextMindStateLines.join('\n') : undefined),
        profileThemeHtml: profileThemeHtml || undefined,
        profileThemeCss: profileTheme?.css || undefined,
        updatedAt: Date.now(),
        readAt: character.mindState?.readAt ?? 0,
        sourceConversationId: conversationId,
        sourceReplyBatchId: sourceReplyBatchId || undefined
      }
    }, {
      profileHistorySource: {
        sourceConversationId: conversationId,
        sourceReplyBatchId: sourceReplyBatchId || undefined
      }
    });

    if (profileTheme && !isDefaultTheme && (profileThemeHtml || profileThemeContent)) {
      await createProfileHomepageRecord({
        charId: character.id,
        conversationId,
        replyBatchId: sourceReplyBatchId || undefined,
        themeId: profileTheme.id,
        themeName: profileTheme.name,
        content: profileThemeContent,
        html: profileThemeHtml,
        css: profileTheme.css || ''
      });
    }
  }

  function findRegeneratedReplyMoodHistoryEntry(character: CharacterProfile, conversationId: string, messagesToRemove: ChatMessage[]) {
    const moodEntries = (character.profileHistory ?? []).filter((entry) => entry.field === 'mood');
    if (!moodEntries.length) return null;

    const replyBatchIds = new Set(messagesToRemove
      .map((message) => String(message.replyBatchId ?? '').trim())
      .filter(Boolean));
    const directEntry = [...moodEntries].reverse().find((entry) => {
      const sourceConversationId = String(entry.sourceConversationId ?? '').trim();
      const sourceReplyBatchId = String(entry.sourceReplyBatchId ?? '').trim();
      return sourceReplyBatchId
        && replyBatchIds.has(sourceReplyBatchId)
        && (!sourceConversationId || sourceConversationId === conversationId);
    });
    if (directEntry) return directEntry;

    const messageTimestamps = messagesToRemove
      .map((message) => Number(message.createdAt))
      .filter((timestamp) => Number.isFinite(timestamp));
    const windowStart = messageTimestamps.length ? Math.min(...messageTimestamps) - 60_000 : Number.NEGATIVE_INFINITY;
    const windowEnd = messageTimestamps.length ? Math.max(...messageTimestamps) + 60_000 : Number.POSITIVE_INFINITY;
    const currentMood = getCharacterTrackedMood(character);

    return [...moodEntries].reverse().find((entry) => {
      const sourceConversationId = String(entry.sourceConversationId ?? '').trim();
      const sourceReplyBatchId = String(entry.sourceReplyBatchId ?? '').trim();
      if (sourceConversationId && sourceConversationId !== conversationId) return false;
      if (sourceReplyBatchId && replyBatchIds.size && !replyBatchIds.has(sourceReplyBatchId)) return false;
      if (entry.createdAt < windowStart || entry.createdAt > windowEnd) return false;
      return !currentMood || normalizeCharacterMindStateLines(entry.nextValue).join('\n') === currentMood;
    }) ?? null;
  }

  async function rollbackCharacterMoodForOnlineRegeneration(conversation: Conversation, messagesToRemove: ChatMessage[]) {
    const character = characterById(conversation.charId);
    if (!character?.profileHistory?.length) return;
    const moodEntryToRemove = findRegeneratedReplyMoodHistoryEntry(character, conversation.id, messagesToRemove);
    if (!moodEntryToRemove) return;

    const nextProfileHistory = character.profileHistory.filter((entry) => entry.id !== moodEntryToRemove.id);
    const currentMood = getCharacterTrackedMood(character);
    const removedMood = normalizeCharacterMindStateLines(moodEntryToRemove.nextValue).join('\n');
    const sourceReplyBatchId = String(moodEntryToRemove.sourceReplyBatchId ?? '').trim();
    const shouldRestoreMindState = currentMood === removedMood
      || Boolean(sourceReplyBatchId && character.mindState?.sourceReplyBatchId === sourceReplyBatchId);
    const restoredLines = normalizeCharacterMindStateLines(moodEntryToRemove.previousValue);
    const restoredMood = restoredLines.join('\n');
    const previousMatchingMoodEntry = [...nextProfileHistory].reverse().find((entry) => entry.field === 'mood'
      && entry.createdAt <= moodEntryToRemove.createdAt
      && normalizeCharacterMindStateLines(entry.nextValue).join('\n') === restoredMood);
    const previousMoodEntry = previousMatchingMoodEntry
      ?? [...nextProfileHistory].reverse().find((entry) => entry.field === 'mood' && entry.createdAt <= moodEntryToRemove.createdAt);
    const restoredUpdatedAt = previousMoodEntry?.createdAt ?? Math.max(0, moodEntryToRemove.createdAt - 1);
    const restoredMindState = restoredLines.length
      ? {
        lines: restoredLines,
        updatedAt: restoredUpdatedAt,
        readAt: Math.min(character.mindState?.readAt ?? 0, restoredUpdatedAt),
        sourceConversationId: previousMoodEntry?.sourceConversationId,
        sourceReplyBatchId: previousMoodEntry?.sourceReplyBatchId
      }
      : undefined;

    await saveCharacterSnapshot({
      ...character,
      profileHistory: nextProfileHistory,
      mindState: shouldRestoreMindState ? restoredMindState : character.mindState
    });
  }

  async function markCharacterMindStateRead(characterId: string) {
    const character = characterById(characterId);
    if (!character?.mindState?.lines.length) return;
    if (character.mindState.readAt >= character.mindState.updatedAt) return;

    await saveCharacter({
      ...character,
      mindState: {
        ...character.mindState,
        readAt: Date.now()
      }
    });
  }

  async function saveConversationSettings(nextSettings: ConversationSettings) {
    const conversation = conversationById(nextSettings.conversationId);
    const normalizedSettings = normalizeConversationSettings(nextSettings, nextSettings.conversationId, conversation?.activeMode);
    const index = conversationSettings.value.findIndex((entry) => entry.conversationId === normalizedSettings.conversationId);
    if (index >= 0) conversationSettings.value[index] = normalizedSettings;
    else conversationSettings.value.push(normalizedSettings);

    const character = conversation ? characterById(conversation.charId) : null;
    if (character && character.voomFrequency !== normalizedSettings.voomFrequency) {
      const normalizedCharacter = normalizeCharacterProfile({ ...character, voomFrequency: normalizedSettings.voomFrequency }, character.boundUserId);
      const characterIndex = characters.value.findIndex((entry) => entry.id === normalizedCharacter.id);
      if (characterIndex >= 0) characters.value[characterIndex] = normalizedCharacter;
      await putEntity('characters', normalizedCharacter);
    }

    await putEntity('conversationSettings', normalizedSettings);
  }

  async function saveStickerGroup(nextGroup: StickerGroup) {
    if (isRecentStickerGroupId(nextGroup.id)) {
      showConfigAlert('“最近”是固定分组，不能更改。', '无法保存分组');
      return;
    }
    const normalizedGroup = normalizeStickerGroup({ ...nextGroup, updatedAt: Date.now() });
    if (!normalizedGroup) return;
    if (normalizedGroup.name.trim() === RECENT_STICKER_GROUP_NAME) {
      showConfigAlert('“最近”是固定分组名，请换一个名称。', '无法保存分组');
      return;
    }
    const index = stickerGroups.value.findIndex((group) => group.id === normalizedGroup.id);
    if (index >= 0) stickerGroups.value[index] = normalizedGroup;
    else stickerGroups.value.push(normalizedGroup);
    await putEntity('stickerGroups', normalizedGroup);
  }

  async function addStickerGroup(name: string) {
    if (name.trim() === RECENT_STICKER_GROUP_NAME) {
      showConfigAlert('“最近”是固定分组名，请换一个名称。', '无法创建分组');
      return;
    }
    const group = createStickerGroup(name);
    stickerGroups.value.push(group);
    await putEntity('stickerGroups', group);
    return group;
  }

  async function deleteStickerGroup(groupId: string) {
    if (isRecentStickerGroupId(groupId)) {
      showConfigAlert('“最近”是固定分组，不能删除。', '无法删除分组');
      return false;
    }
    const deletingGroup = stickerGroups.value.find((group) => group.id === groupId);
    if (!deletingGroup) return false;
    const fallbackGroup = stickerGroups.value.find((group) => group.id !== groupId);
    stickerGroups.value = stickerGroups.value.filter((group) => group.id !== groupId);
    const affectedStickers = stickers.value.filter((sticker) => sticker.groupIds.includes(groupId));
    await Promise.all([
      deleteEntity('stickerGroups', groupId),
      ...affectedStickers.map((sticker) => {
        const nextGroupIds = sticker.groupIds.filter((id) => id !== groupId);
        const normalizedSticker = normalizeSticker({
          ...sticker,
          groupIds: nextGroupIds.length ? nextGroupIds : fallbackGroup ? [fallbackGroup.id] : [],
          updatedAt: Date.now()
        }, fallbackGroup?.id ?? '');
        if (!normalizedSticker) return Promise.resolve();
        const index = stickers.value.findIndex((item) => item.id === normalizedSticker.id);
        if (index >= 0) stickers.value[index] = normalizedSticker;
        return putEntity('stickers', normalizedSticker);
      })
    ]);
    return true;
  }

  async function moveStickerGroup(groupId: string, direction: 'up' | 'down') {
    const orderedGroups = [...sortedStickerGroups.value];
    const currentIndex = orderedGroups.findIndex((group) => group.id === groupId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedGroups.length) return false;

    const reorderedGroups = [...orderedGroups];
    [reorderedGroups[currentIndex], reorderedGroups[targetIndex]] = [reorderedGroups[targetIndex], reorderedGroups[currentIndex]];
    const now = Date.now();
    const updates = reorderedGroups.map((group, index) => ({
      ...group,
      sortOrder: (index + 1) * 1000,
      updatedAt: group.id === groupId || group.id === orderedGroups[targetIndex].id ? now : group.updatedAt
    } satisfies StickerGroup));
    const updateMap = new Map(updates.map((group) => [group.id, group]));
    stickerGroups.value = stickerGroups.value.map((group) => updateMap.get(group.id) ?? group);
    await Promise.all(updates.map((group) => putEntity('stickerGroups', group)));
    return true;
  }

  async function saveSticker(nextSticker: Sticker) {
    const fallbackGroupId = stickerGroups.value[0]?.id ?? '';
    const groupIds = nextSticker.groupIds.filter((id) => !isRecentStickerGroupId(id));
    const previousSticker = stickers.value.find((sticker) => sticker.id === nextSticker.id);
    const normalizedSticker = normalizeSticker({
      ...nextSticker,
      cachedImageUrl: previousSticker && previousSticker.imageUrl === nextSticker.imageUrl ? nextSticker.cachedImageUrl : undefined,
      cachedImageUpdatedAt: previousSticker && previousSticker.imageUrl === nextSticker.imageUrl ? nextSticker.cachedImageUpdatedAt : undefined,
      groupIds,
      updatedAt: Date.now()
    }, fallbackGroupId);
    if (!normalizedSticker) return;
    const index = stickers.value.findIndex((sticker) => sticker.id === normalizedSticker.id);
    if (index >= 0) stickers.value[index] = normalizedSticker;
    else stickers.value.unshift(normalizedSticker);
    await putEntity('stickers', normalizedSticker);
    if (!normalizedSticker.cachedImageUrl) queueStickerCache(normalizedSticker);
  }

  function isPersistableStickerSourceUrl(imageUrl: string) {
    return /^https?:\/\//i.test(imageUrl.trim());
  }

  async function persistStickerCacheInBackground(sticker: Sticker, options: { readImageUrl?: () => Promise<string>; cleanupImageUrl?: () => void } = {}) {
    try {
      const cachedImageUrl = await cacheStickerImageUrl(sticker.imageUrl, options.readImageUrl);
      const currentSticker = stickers.value.find((item) => item.id === sticker.id);
      if (!currentSticker) return;
      if (currentSticker.imageUrl !== sticker.imageUrl) return;
      let nextSticker = currentSticker;
      if (cachedImageUrl) {
        nextSticker = {
          ...currentSticker,
          imageUrl: isPersistableStickerSourceUrl(currentSticker.imageUrl) ? currentSticker.imageUrl : stickerBackupPlaceholder,
          cachedImageUrl,
          cachedImageUpdatedAt: Date.now()
        };
      } else if (!isPersistableStickerSourceUrl(currentSticker.imageUrl)) {
        nextSticker = { ...currentSticker, imageUrl: stickerBackupPlaceholder };
      }
      const index = stickers.value.findIndex((item) => item.id === nextSticker.id);
      if (index >= 0) stickers.value[index] = nextSticker;
      await putEntity('stickers', nextSticker);
    } catch {
      return;
    } finally {
      options.cleanupImageUrl?.();
    }
  }

  function queueStickerCache(sticker: Sticker, options: { readImageUrl?: () => Promise<string>; cleanupImageUrl?: () => void } = {}) {
    stickerImportCacheQueue = stickerImportCacheQueue
      .then(() => persistStickerCacheInBackground(sticker, options))
      .catch((error) => {
        console.warn('Sticker background persistence failed.', error);
        options.cleanupImageUrl?.();
      });
  }

  async function prepareImportedSticker(draft: StickerImportDraft, groupIds: string[]) {
    const sticker = createStickerFromDraft(draft, groupIds);
    try {
      const cachedImageUrl = String(draft.cacheImageUrl
        ? await draft.cacheImageUrl()
        : await cacheStickerImageUrl(sticker.imageUrl)).trim();
      if (!/^data:image\//i.test(cachedImageUrl)) {
        throw new Error('贴纸图片无法写入本地缓存。请检查图片链接后重试。');
      }
      return {
        ...sticker,
        imageUrl: isPersistableStickerSourceUrl(sticker.imageUrl) ? sticker.imageUrl : stickerBackupPlaceholder,
        cachedImageUrl,
        cachedImageUpdatedAt: Date.now()
      } satisfies Sticker;
    } finally {
      draft.cleanupImageUrl?.();
    }
  }

  async function importStickers(drafts: StickerImportDraft[], groupIds: string[]) {
    const fallbackGroupId = stickerGroups.value[0]?.id ?? '';
    const existingGroupIds = new Set(stickerGroups.value.map((group) => group.id));
    const targetGroupIds = [...new Set((groupIds.length ? groupIds : [fallbackGroupId]).filter((id) => Boolean(id) && !isRecentStickerGroupId(id) && existingGroupIds.has(id)))];
    if (!targetGroupIds.length) {
      drafts.forEach((draft) => draft.cleanupImageUrl?.());
      return [];
    }
    const existingKeys = new Set(stickers.value.map((sticker) => `${sticker.description.toLocaleLowerCase()}::${sticker.imageUrl}`));
    const createdStickers: Sticker[] = [];
    try {
      for (const draft of drafts) {
        const sourceSticker = createStickerFromDraft(draft, targetGroupIds);
        const key = `${sourceSticker.description.toLocaleLowerCase()}::${sourceSticker.imageUrl}`;
        if (existingKeys.has(key)) {
          draft.cleanupImageUrl?.();
          continue;
        }
        existingKeys.add(key);
        createdStickers.push(await prepareImportedSticker(draft, targetGroupIds));
      }
    } catch (error) {
      drafts.forEach((draft) => draft.cleanupImageUrl?.());
      throw error;
    }
    if (!createdStickers.length) return [];
    stickers.value.unshift(...createdStickers);
    await Promise.all(createdStickers.map((sticker) => putEntity('stickers', sticker)));
    return createdStickers;
  }

  function queueMissingStickerImageCaches(targetStickers = stickers.value) {
    targetStickers
      .filter((sticker) => !sticker.cachedImageUrl && shouldLocalizeStickerImageUrl(sticker.imageUrl))
      .forEach((sticker) => queueStickerCache(sticker));
  }

  async function deleteSticker(stickerId: string) {
    const index = stickers.value.findIndex((sticker) => sticker.id === stickerId);
    if (index < 0) return;
    stickers.value.splice(index, 1);
    await deleteEntity('stickers', stickerId);
    queueStoredMediaPrune();
  }

  async function deleteStickers(stickerIds: string[]) {
    const idSet = new Set(stickerIds.map((item) => item.trim()).filter(Boolean));
    if (!idSet.size) return 0;
    const deletableIds = stickers.value.filter((sticker) => idSet.has(sticker.id)).map((sticker) => sticker.id);
    if (!deletableIds.length) return 0;
    stickers.value = stickers.value.filter((sticker) => !idSet.has(sticker.id));
    await Promise.all(deletableIds.map((stickerId) => deleteEntity('stickers', stickerId)));
    queueStoredMediaPrune();
    return deletableIds.length;
  }

  async function moveStickersToGroup(stickerIds: string[], groupId: string) {
    const normalizedGroupId = groupId.trim();
    if (!normalizedGroupId || isRecentStickerGroupId(normalizedGroupId)) return 0;
    const targetGroup = stickerGroups.value.find((group) => group.id === normalizedGroupId);
    if (!targetGroup) return 0;
    const idSet = new Set(stickerIds.map((item) => item.trim()).filter(Boolean));
    if (!idSet.size) return 0;
    const updates = stickers.value
      .filter((sticker) => idSet.has(sticker.id))
      .map((sticker) => normalizeSticker({
        ...sticker,
        groupIds: [normalizedGroupId],
        updatedAt: Date.now()
      }, normalizedGroupId))
      .filter((sticker): sticker is Sticker => Boolean(sticker));
    if (!updates.length) return 0;
    const updateMap = new Map(updates.map((sticker) => [sticker.id, sticker]));
    stickers.value = stickers.value.map((sticker) => updateMap.get(sticker.id) ?? sticker);
    await Promise.all(updates.map((sticker) => putEntity('stickers', sticker)));
    return updates.length;
  }

  async function addCharacter(payload: Pick<CharacterProfile, 'name' | 'nickname' | 'avatar' | 'description' | 'signature' | 'boundUserId'> & Partial<Pick<CharacterProfile, 'userNote' | 'localWorldBookIds' | 'voomFrequency'>>) {
    if (!user.value) return;
    const character = normalizeCharacterProfile({
      id: createAccountId(),
      nickname: payload.nickname,
      name: payload.name,
      avatar: payload.avatar,
      description: payload.description,
      signature: payload.signature,
      initialProfile: {
        nickname: payload.nickname,
        signature: payload.signature
      },
      userNote: payload.userNote ?? '',
      boundUserId: payload.boundUserId,
      subtitle: '刚刚成为好友',
      lastSeen: '现在',
      localWorldBookIds: payload.localWorldBookIds ?? [],
      voomFrequency: payload.voomFrequency ?? 'medium',
      relationship: { status: 'friend', updatedAt: Date.now() }
    }, payload.boundUserId);
    const conversation: Conversation = {
      id: `conv_${character.id}`,
      userId: payload.boundUserId,
      charId: character.id,
      title: getCharacterVoomDisplayName(character),
      activeMode: 'online',
      updatedAt: Date.now(),
      unreadCount: 0,
      summary: '刚成为好友，还没有太多共同经历。'
    };
    characters.value.unshift(character);
    conversations.value.unshift(conversation);
    const boundUser = userById(payload.boundUserId);
    if (boundUser) {
      await saveUserProfile({
        ...boundUser,
        boundCharacterIds: [...new Set([...boundUser.boundCharacterIds, character.id])]
      });
    }
    await Promise.all([putEntity('characters', character), putEntity('conversations', conversation)]);
  }

  async function setCharacterRelationship(
    characterId: string,
    status: NonNullable<CharacterProfile['relationship']>['status'],
    options: { reason?: string; requestMessage?: string; requestedAt?: number; notice?: string } = {}
  ) {
    const character = characterById(characterId);
    if (!character) return false;
    const current = getFriendRelationship(character);
    const reason = String(options.reason ?? '').trim();
    const requestMessage = String(options.requestMessage ?? '').trim();
    const now = Date.now();
    await saveCharacterSnapshot({
      ...character,
      relationship: {
        status,
        updatedAt: now,
        ...(reason ? { reason } : {}),
        ...(['pending-user-request', 'pending-character-request'].includes(status) && requestMessage ? { requestMessage } : {}),
        ...(['pending-user-request', 'pending-character-request'].includes(status) ? { requestedAt: options.requestedAt ?? now } : {})
      }
    });
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === characterId);
    if (conversation && options.notice && (current.status !== status || current.reason !== reason)) {
      await appendConversationEvent(conversation.id, options.notice, { mode: 'online' });
    }
    return true;
  }

  function characterRelationshipNames(character: CharacterProfile) {
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === character.id);
    const boundUser = userById(conversation?.userId || character.boundUserId) ?? user.value;
    return {
      characterName: getCharacterAiName(character),
      userName: getUserAiName(boundUser)
    };
  }

  async function blockCharacter(characterId: string) {
    const character = characterById(characterId);
    if (!character || !isCharacterFriend(character)) return false;
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === characterId);
    if (conversation) cancelConversationReply(conversation.id);
    const { characterName, userName } = characterRelationshipNames(character);
    return setCharacterRelationship(characterId, 'blocked-by-user', {
      notice: `${userName}已将${characterName}加入黑名单。`
    });
  }

  async function unblockCharacter(characterId: string) {
    const character = characterById(characterId);
    if (!character || getFriendRelationship(character).status !== 'blocked-by-user') return false;
    const { characterName, userName } = characterRelationshipNames(character);
    return setCharacterRelationship(characterId, 'friend', {
      notice: `${userName}已将${characterName}移出黑名单，可以继续聊天。`
    });
  }

  async function removeCharacterFriend(characterId: string) {
    const character = characterById(characterId);
    if (!character || !isCharacterFriend(character)) return false;
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === characterId);
    if (conversation) cancelConversationReply(conversation.id);
    const { characterName, userName } = characterRelationshipNames(character);
    return setCharacterRelationship(characterId, 'deleted-by-user', {
      notice: `${userName}已删除${characterName}，可重新发送好友申请。`
    });
  }

  async function requestCharacterFriend(characterId: string, message: string) {
    const character = characterById(characterId);
    if (!character) return false;
    const relationship = getFriendRelationship(character);
    if (!['blocked-by-character', 'deleted-by-character', 'deleted-by-user'].includes(relationship.status)) return false;
    const { characterName, userName } = characterRelationshipNames(character);
    const verification = message.trim().slice(0, 120) || `${userName}想重新添加${characterName}为好友。`;
    const changed = await setCharacterRelationship(characterId, 'pending-user-request', {
      requestMessage: verification,
      requestedAt: Date.now(),
      notice: `${userName}已向${characterName}发送好友验证：${verification}`
    });
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === characterId);
    if (changed && conversation) {
      await requestRoleplayReply(conversation.id, {
        replyInstruction: `关系事件：${userName}在${characterName}拉黑或删除${userName}后，重新向${characterName}发来好友验证：“${verification}”。${characterName}必须结合${characterName}的人设、最近冲突和关系记忆，在 messageActions.relationshipAction 明确输出 accept_request 或 reject_request。`
      });
    }
    return changed;
  }

  async function applyCharacterRelationshipAction(characterId: string, action: NonNullable<RoleplayReplyResult['messageActions']>['relationshipAction']) {
    if (!action) return false;
    const character = characterById(characterId);
    if (!character) return false;
    const relationship = getFriendRelationship(character);
    const { characterName, userName } = characterRelationshipNames(character);
    const rawReason = String(action.reason ?? '').trim();
    const reason = rawReason;
    if (action.type === 'block' && relationship.status === 'friend') {
      return setCharacterRelationship(characterId, 'blocked-by-character', {
        reason,
        notice: `${characterName}已将${userName}加入黑名单。${reason ? ` 原因：${reason}` : ''}`
      });
    }
    if (action.type === 'delete' && relationship.status === 'friend') {
      return setCharacterRelationship(characterId, 'deleted-by-character', {
        reason,
        notice: `${characterName}已删除与${userName}的好友关系。${reason ? ` 原因：${reason}` : ''}`
      });
    }
    if (action.type === 'request_friend' && ['blocked-by-user', 'deleted-by-user'].includes(relationship.status)) {
      const requestMessage = reason || `${characterName}想重新添加${userName}为好友。`;
      return setCharacterRelationship(characterId, 'pending-character-request', {
        reason,
        requestMessage,
        requestedAt: Date.now(),
        notice: `${characterName}请求添加${userName}为好友：${requestMessage}`
      });
    }
    if (action.type === 'accept_request' && relationship.status === 'pending-user-request') {
      return setCharacterRelationship(characterId, 'friend', {
        reason,
        notice: `${characterName}已通过${userName}的好友申请。`
      });
    }
    if (action.type === 'reject_request' && relationship.status === 'pending-user-request') {
      return setCharacterRelationship(characterId, 'blocked-by-character', {
        reason,
        notice: `${characterName}拒绝了${userName}的好友申请。${reason ? ` 原因：${reason}` : ''}`
      });
    }
    return false;
  }

  async function respondCharacterFriendRequest(characterId: string, decision: 'accepted' | 'rejected') {
    const character = characterById(characterId);
    if (!character || getFriendRelationship(character).status !== 'pending-character-request') return false;
    const { characterName, userName } = characterRelationshipNames(character);
    if (decision === 'accepted') {
      return setCharacterRelationship(characterId, 'friend', {
        notice: `${userName}已通过${characterName}的好友申请，可以继续聊天。`
      });
    }
    return setCharacterRelationship(characterId, 'blocked-by-user', {
      notice: `${userName}已拒绝${characterName}的好友申请。`
    });
  }

  function groupCharacterContext(character: CharacterProfile): GroupDiscoveryCharacterContext {
    const privateConversation = conversations.value.find((conversation) => conversation.kind !== 'group' && conversation.charId === character.id && conversation.userId === character.boundUserId);
    const recentMessages = privateConversation ? visibleMessagesForConversation(privateConversation.id).filter((message) => message.replyVariantState !== 'inactive').slice(-18) : [];
    const boundUser = userById(character.boundUserId) ?? user.value;
    const recentConversation = recentMessages.map((message) => {
      const speaker = message.sender === 'user' ? getUserAiName(boundUser) : message.sender === 'char' ? getCharacterAiName(character) : '系统';
      return `${speaker}：${messageReadableContent(message)}`;
    }).join('\n');
    return {
      character,
      conversationSummary: privateConversation?.summary ?? '',
      memorySummary: privateConversation ? memoryContextForConversation(privateConversation.id, recentConversation, { storeDebug: false }) : '',
      recentConversation,
      localWorldBooks: worldBooks.value.filter((book) => book.scope === 'local' && character.localWorldBookIds.includes(book.id))
    };
  }

  async function discoverGroups(characterIds: string[]) {
    const activeUser = user.value;
    if (!activeUser) return [];
    const selectedCharacters = [...new Set(characterIds)].flatMap((id) => {
      const character = characterById(id);
      return character && character.boundUserId === activeUser.id ? [character] : [];
    });
    if (!selectedCharacters.length) throw new Error('请至少选择一个当前账号绑定的角色。');
    return discoverGeneratedGroups({
      user: activeUser,
      characters: selectedCharacters.map(groupCharacterContext),
      settings: settings.value ?? undefined,
      modelOverride: getGlobalTextModelOverride('content')
    });
  }

  async function createGroup(name: string, characterIds: string[], announcement = '', npcMembers: GroupNpcDraft[] = []) {
    const activeUser = user.value;
    const normalizedName = name.trim();
    if (!activeUser || !normalizedName) throw new Error('请填写群名称。');
    const selectedCharacters = [...new Set(characterIds)].flatMap((id) => {
      const character = characterById(id);
      return character && character.boundUserId === activeUser.id ? [character] : [];
    });
    if (!selectedCharacters.length) throw new Error('请至少选择一个当前账号绑定的角色。');
    const joinedAt = Date.now();
    const userMemberId = `member_user_${activeUser.id}`;
    const normalizedNpcMembers = npcMembers.map((npc): GroupMember => ({
      id: createId('member-npc'),
      identityType: 'npc',
      trueName: npc.trueName.trim(),
      nickname: npc.nickname.trim() || npc.trueName.trim(),
      avatar: npc.avatar?.trim() || undefined,
      description: npc.description.trim(),
      role: 'member',
      joinedAt
    })).filter((npc) => npc.trueName && npc.description);
    const candidate: GroupDiscoveryCandidate = {
      id: createId('group-candidate'), name: normalizedName,
      description: `${getUserAiName(activeUser)}创建的群聊。`, announcement: announcement.trim(), ownerMemberId: userMemberId,
      discoveryReason: '由当前用户创建', recentMessages: [],
      members: [...selectedCharacters.map((character): GroupMember => ({
        id: `member_character_${character.id}`, identityType: 'character', identityId: character.id,
        trueName: getCharacterAiName(character), nickname: character.nickname || getCharacterAiName(character),
        avatar: character.avatar, description: character.description, role: 'member', joinedAt
      })), ...normalizedNpcMembers]
    };
    const conversation = await joinGeneratedGroup(candidate);
    if (!conversation) return;
    const members = conversation.groupMembers?.map((member) => ({ ...member, role: member.identityType === 'user' ? 'owner' as const : member.role === 'owner' ? 'member' as const : member.role })) ?? [];
    const nextConversation = { ...conversation, groupMembers: members, summary: `${getUserAiName(activeUser)}创建了群聊「${normalizedName}」。` };
    conversations.value = conversations.value.map((item) => item.id === conversation.id ? nextConversation : item);
    await putEntity('conversations', nextConversation);
    return nextConversation;
  }

  async function joinGeneratedGroup(candidate: GroupDiscoveryCandidate) {
    const activeUser = user.value;
    if (!activeUser) throw new Error('当前没有可用的用户账号。');
    const joinedAt = Date.now();
    const userMember: GroupMember = {
      id: `member_user_${activeUser.id}`, identityType: 'user', identityId: activeUser.id,
      trueName: getUserAiName(activeUser), nickname: activeUser.nickname || getUserAiName(activeUser),
      avatar: activeUser.avatar, description: activeUser.description, role: 'member', joinedAt, membershipStatus: 'active'
    };
    const members = [...candidate.members.map((member) => ({ ...member, joinedAt: member.joinedAt || joinedAt, membershipStatus: member.membershipStatus ?? 'active' as const })), userMember];
    const firstCharacter = members.find((member) => member.identityType === 'character' && member.identityId);
    if (!firstCharacter?.identityId) throw new Error('该群没有可关联的已有角色。');
    const conversation: Conversation = {
      id: createId('group'), userId: activeUser.id, charId: firstCharacter.identityId, title: candidate.name,
      activeMode: 'online', updatedAt: joinedAt, unreadCount: 0,
      summary: `${getUserAiName(activeUser)}刚加入群聊「${candidate.name}」。${candidate.description}`,
      kind: 'group', groupAvatar: candidate.avatar || firstCharacter.avatar,
      groupAnnouncement: candidate.announcement, groupMembers: members, joinedAt,
      groupAnonymousId: createId('anonymous'), groupAnonymousName: `匿名用户${Math.floor(1000 + Math.random() * 9000)}`
    };
    const initialMessages: ChatMessage[] = candidate.recentMessages.map((message, index) => {
      const member = members.find((item) => item.id === message.authorMemberId);
      return {
        id: createId('msg'), conversationId: conversation.id, sender: member?.identityType === 'user' ? 'user' : 'char',
        authorType: member?.identityType ?? 'npc', authorId: member?.identityId || member?.id,
        authorName: member?.trueName || '群成员', mode: 'online', content: message.content,
        createdAt: joinedAt - Math.max(0, Math.abs(message.createdAtOffsetMinutes ?? index + 1)) * 60_000, status: 'sent'
      };
    });
    const joinEvent: ChatMessage = {
      id: createId('msg'), conversationId: conversation.id, sender: 'system', authorType: 'system', authorName: '系统',
      mode: 'online', content: `${getUserAiName(activeUser)}加入了群聊`, createdAt: joinedAt, status: 'sent'
    };
    conversations.value.unshift(conversation);
    messages.value.push(...initialMessages, joinEvent);
    await Promise.all([putEntity('conversations', conversation), ...initialMessages.map((message) => putEntity('messages', message)), putEntity('messages', joinEvent)]);
    await syncGroupEventsToCharacterConversations(conversation, [...initialMessages, joinEvent]);
    return conversation;
  }

  function groupUserMessageIdentity(conversation: Conversation) {
    if (conversation.kind !== 'group') return {};
    const activeUser = userById(conversation.userId) ?? user.value;
    return activeUser ? {
      authorType: 'user' as const,
      authorId: activeUser.id,
      authorName: getUserAiName(activeUser)
    } : {};
  }

  function groupUserMember(conversation: Conversation) {
    return conversation.groupMembers?.find((member) => member.identityType === 'user' && member.identityId === conversation.userId) ?? null;
  }

  function isActiveGroupMember(member: GroupMember | null | undefined) {
    return Boolean(member && (member.membershipStatus ?? 'active') === 'active');
  }

  function canCurrentUserManageGroup(conversation: Conversation) {
    const member = groupUserMember(conversation);
    return isActiveGroupMember(member) && (member?.role === 'owner' || member?.role === 'admin');
  }

  function canCurrentUserSendGroupMessage(conversation: Conversation) {
    if (!isActiveGroupMember(groupUserMember(conversation))) {
      showConfigAlert('当前账号已经退出群聊或正在等待申请审核，只能使用匿名小号发言。', '无法实名发送');
      return false;
    }
    if (conversation.groupMessagePermission === 'admins' && !canCurrentUserManageGroup(conversation)) {
      showConfigAlert('当前群只允许群主和管理员发言。', '无法发送');
      return false;
    }
    return true;
  }

  async function saveGroupConversation(conversation: Conversation) {
    conversations.value = conversations.value.map((entry) => entry.id === conversation.id ? conversation : entry);
    await putEntity('conversations', conversation);
    return conversation;
  }

  async function appendGroupSystemEvent(conversation: Conversation, content: string) {
    const createdAt = Date.now();
    const message: ChatMessage = {
      id: createId('msg'), conversationId: conversation.id, sender: 'system', authorType: 'system', authorName: '系统',
      mode: 'online', content: content.trim(), createdAt, status: 'sent'
    };
    messages.value.push(message);
    const nextConversation = { ...conversation, updatedAt: createdAt };
    await Promise.all([putEntity('messages', message), saveGroupConversation(nextConversation)]);
    await syncGroupEventsToCharacterConversations(nextConversation, [message]);
    return message;
  }

  async function appendGroupUserMessage(conversationId: string, content: string, quote?: ChatMessageQuote | null) {
    const conversation = conversationById(conversationId);
    const activeUser = userById(conversation?.userId ?? '') ?? user.value;
    const trimmedContent = content.trim();
    if (!conversation || conversation.kind !== 'group' || !activeUser || !trimmedContent) return;
    if (!canCurrentUserSendGroupMessage(conversation)) return;
    const linkPreview = conversation.activeMode === 'online' ? createChatLinkPreview(trimmedContent) : null;
    const message: ChatMessage = {
      id: createId('msg'), conversationId, sender: 'user', authorType: 'user', authorId: activeUser.id,
      authorName: getUserAiName(activeUser), mode: conversation.activeMode, content: trimmedContent,
      ...(linkPreview ? { linkPreview } : {}), quote: cloneMessageQuote(quote), createdAt: Date.now(), status: 'sent'
    };
    messages.value.push(message);
    const nextConversation = { ...conversation, updatedAt: message.createdAt, unreadCount: 0 };
    conversations.value = conversations.value.map((item) => item.id === conversationId ? nextConversation : item);
    await Promise.all([putEntity('messages', message), putEntity('conversations', nextConversation)]);
    if (linkPreview) void hydrateUserMessageLinkPreview(message.id, linkPreview);
    await syncGroupEventsToCharacterConversations(nextConversation, [message]);
    return message;
  }

  async function appendAnonymousGroupMessage(conversationId: string, content: string) {
    const conversation = conversationById(conversationId);
    const trimmedContent = content.trim();
    if (!conversation || conversation.kind !== 'group' || !trimmedContent) return;
    const linkPreview = createChatLinkPreview(trimmedContent);
    const anonymousId = conversation.groupAnonymousId || createId('anonymous');
    const anonymousName = conversation.groupAnonymousName || `匿名用户${Math.floor(1000 + Math.random() * 9000)}`;
    const ensuredConversation = conversation.groupAnonymousId && conversation.groupAnonymousName ? conversation : { ...conversation, groupAnonymousId: anonymousId, groupAnonymousName: anonymousName };
    const message: ChatMessage = {
      id: createId('msg'), conversationId, sender: 'user', authorType: 'user', authorId: anonymousId, authorName: anonymousName,
      mode: 'online', content: trimmedContent, ...(linkPreview ? { linkPreview } : {}), createdAt: Date.now(), status: 'sent'
    };
    messages.value.push(message);
    const nextConversation = { ...ensuredConversation, updatedAt: message.createdAt, unreadCount: 0 };
    await Promise.all([putEntity('messages', message), saveGroupConversation(nextConversation)]);
    if (linkPreview) void hydrateUserMessageLinkPreview(message.id, linkPreview);
    await syncGroupEventsToCharacterConversations(nextConversation, [message]);
    return message;
  }

  async function leaveGroupConversation(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group') return false;
    const member = groupUserMember(conversation);
    if (!isActiveGroupMember(member)) return false;
    const exitedAt = Date.now();
    const members = conversation.groupMembers?.map((entry) => entry.id === member?.id ? { ...entry, membershipStatus: 'left' as const, exitedAt } : entry) ?? [];
    const nextConversation = await saveGroupConversation({ ...conversation, groupMembers: members, updatedAt: exitedAt });
    await appendGroupSystemEvent(nextConversation, `${member?.trueName || getUserAiName(userById(conversation.userId) ?? user.value)}退出了群聊`);
    return true;
  }

  async function applyToRejoinGroup(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group') return false;
    const member = groupUserMember(conversation);
    if (!member || (member.membershipStatus ?? 'active') === 'active') return false;
    if (conversation.groupJoinPolicy === 'invite-only') {
      showConfigAlert('当前群仅允许通过邀请重新加入。', '无法申请加入');
      return false;
    }
    if (conversation.groupJoinPolicy === 'open') {
      const joinedAt = Date.now();
      const members = conversation.groupMembers?.map((entry) => entry.id === member.id ? { ...entry, membershipStatus: 'active' as const, joinedAt, exitedAt: undefined } : entry) ?? [];
      const nextConversation = await saveGroupConversation({ ...conversation, groupMembers: members, joinedAt, updatedAt: joinedAt });
      await appendGroupSystemEvent(nextConversation, `${member.trueName}重新加入了群聊`);
      return true;
    }
    const members = conversation.groupMembers?.map((entry) => entry.id === member.id ? { ...entry, membershipStatus: 'pending' as const } : entry) ?? [];
    const nextConversation = await saveGroupConversation({ ...conversation, groupMembers: members, updatedAt: Date.now() });
    await appendGroupSystemEvent(nextConversation, `${member.trueName}申请重新加入群聊`);
    await requestGroupReply(conversationId, { instruction: `${member.trueName}刚刚提交了重新加入群聊的申请。请由群主或管理员结合群性质与当前关系自然回应，并在 membershipDecision 作出通过、拒绝或暂不处理的决定。`, allowPrivateInitiation: false });
    return true;
  }

  async function inviteCharactersToGroup(conversationId: string, characterIds: string[]) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group' || !isActiveGroupMember(groupUserMember(conversation))) throw new Error('只有仍在群内时才能邀请成员。');
    if (conversation.groupInvitePermission === 'admins' && !canCurrentUserManageGroup(conversation)) throw new Error('当前群只允许群主和管理员邀请成员。');
    const selected = [...new Set(characterIds)].flatMap((characterId) => {
      const character = characterById(characterId);
      return character && character.boundUserId === conversation.userId ? [character] : [];
    });
    if (!selected.length) throw new Error('请选择至少一个当前账号绑定的角色。');
    const existingCharacterIds = new Set(conversation.groupMembers?.filter((member) => member.identityType === 'character').map((member) => member.identityId) ?? []);
    const invited = selected.filter((character) => !existingCharacterIds.has(character.id));
    if (!invited.length) throw new Error('所选角色已经在群聊中。');
    const joinedAt = Date.now();
    const newMembers: GroupMember[] = invited.map((character) => ({
      id: `member_character_${character.id}_${conversation.id}`, identityType: 'character', identityId: character.id,
      trueName: getCharacterAiName(character), nickname: character.nickname || getCharacterAiName(character), avatar: character.avatar,
      description: character.description, role: 'member', joinedAt, membershipStatus: 'active'
    }));
    const nextConversation = await saveGroupConversation({ ...conversation, groupMembers: [...(conversation.groupMembers ?? []), ...newMembers], updatedAt: joinedAt });
    const actorName = groupUserMember(nextConversation)?.trueName || getUserAiName(userById(conversation.userId) ?? user.value);
    await appendGroupSystemEvent(nextConversation, `${actorName}邀请${newMembers.map((member) => member.trueName).join('、')}加入了群聊`);
    return newMembers;
  }

  async function updateManagedGroupProfile(conversationId: string, payload: {
    title: string;
    announcement: string;
    joinPolicy?: NonNullable<Conversation['groupJoinPolicy']>;
    invitePermission?: NonNullable<Conversation['groupInvitePermission']>;
    messagePermission?: NonNullable<Conversation['groupMessagePermission']>;
    historyVisibleToNewMembers?: boolean;
  }) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group' || !canCurrentUserManageGroup(conversation)) throw new Error('只有当前账号作为群主或管理员时才能修改群资料。');
    const title = payload.title.trim();
    const announcement = payload.announcement.trim();
    if (!title) throw new Error('群名称不能为空。');
    const actorName = groupUserMember(conversation)?.trueName || getUserAiName(userById(conversation.userId) ?? user.value);
    let nextConversation = conversation;
    if (title !== conversation.title) {
      const previousTitle = conversation.title;
      nextConversation = await saveGroupConversation({ ...nextConversation, title, updatedAt: Date.now() });
      await appendGroupSystemEvent(nextConversation, `${actorName}将群名从「${previousTitle}」修改为「${title}」`);
    }
    if (announcement !== (nextConversation.groupAnnouncement ?? '')) {
      nextConversation = await saveGroupConversation({ ...nextConversation, groupAnnouncement: announcement, updatedAt: Date.now() });
      await appendGroupSystemEvent(nextConversation, announcement ? `${actorName}更新了群公告：${announcement}` : `${actorName}清空了群公告`);
    }
    const managedSettings = {
      groupJoinPolicy: payload.joinPolicy ?? nextConversation.groupJoinPolicy ?? 'approval',
      groupInvitePermission: payload.invitePermission ?? nextConversation.groupInvitePermission ?? 'members',
      groupMessagePermission: payload.messagePermission ?? nextConversation.groupMessagePermission ?? 'members',
      groupHistoryVisibleToNewMembers: payload.historyVisibleToNewMembers ?? nextConversation.groupHistoryVisibleToNewMembers ?? true
    };
    const settingsChanged = Object.entries(managedSettings).some(([key, value]) => nextConversation[key as keyof Conversation] !== value);
    if (settingsChanged) {
      nextConversation = await saveGroupConversation({ ...nextConversation, ...managedSettings, updatedAt: Date.now() });
      await appendGroupSystemEvent(nextConversation, `${actorName}更新了群聊权限与加入设置`);
    }
    return nextConversation;
  }

  async function updateGroupAvatar(conversationId: string, avatar: string) {
    const conversation = conversationById(conversationId);
    const member = conversation?.kind === 'group' ? groupUserMember(conversation) : undefined;
    if (!conversation || conversation.kind !== 'group' || !isActiveGroupMember(member)) throw new Error('只有当前群成员可以修改群头像。');
    const groupAvatar = avatar.trim() || undefined;
    if (groupAvatar === conversation.groupAvatar) return conversation;
    const nextConversation = await saveGroupConversation({ ...conversation, groupAvatar, updatedAt: Date.now() });
    await appendGroupSystemEvent(nextConversation, `${member?.trueName || '群成员'}修改了群头像`);
    return nextConversation;
  }

  async function updateGroupNpcAvatar(conversationId: string, memberId: string, avatar: string) {
    const conversation = conversationById(conversationId);
    const actor = conversation?.kind === 'group' ? groupUserMember(conversation) : undefined;
    const npc = conversation?.kind === 'group' ? conversation.groupMembers?.find((member) => member.id === memberId && member.identityType === 'npc') : undefined;
    if (!conversation || conversation.kind !== 'group' || !isActiveGroupMember(actor)) throw new Error('只有当前群成员可以修改 NPC 头像。');
    if (!npc) throw new Error('NPC 群成员不存在。');
    const normalizedAvatar = avatar.trim() || undefined;
    if (normalizedAvatar === npc.avatar) return conversation;
    const groupMembers = conversation.groupMembers?.map((member) => member.id === memberId ? { ...member, avatar: normalizedAvatar } : member);
    const nextConversation = await saveGroupConversation({ ...conversation, groupMembers, updatedAt: Date.now() });
    const changedFavorites: FavoriteMessageRecord[] = [];
    favorites.value = favorites.value.map((favorite) => {
      if (favorite.conversationId !== conversationId || groupMemberForMessage(conversation, favorite.message)?.id !== memberId) return favorite;
      const nextFavorite = { ...favorite, authorAvatar: normalizedAvatar };
      changedFavorites.push(nextFavorite);
      return nextFavorite;
    });
    await Promise.all(changedFavorites.map((favorite) => putEntity('favorites', toRaw(favorite))));
    await appendGroupSystemEvent(nextConversation, `${actor?.trueName || '群成员'}修改了${npc.trueName}的头像`);
    return nextConversation;
  }

  async function updateGroupPersonalPreferences(conversationId: string, payload: { pinned?: boolean; muted?: boolean; nickname?: string }) {
    const conversation = conversationById(conversationId);
    const member = conversation?.kind === 'group' ? groupUserMember(conversation) : undefined;
    if (!conversation || conversation.kind !== 'group' || !isActiveGroupMember(member)) throw new Error('只有群内成员可以修改本群偏好。');
    const nickname = payload.nickname?.trim();
    const groupMembers = nickname === undefined ? conversation.groupMembers : conversation.groupMembers?.map((entry) => entry.id === member?.id ? { ...entry, nickname: nickname || entry.trueName } : entry);
    const nextConversation = await saveGroupConversation({
      ...conversation,
      groupPinned: payload.pinned ?? conversation.groupPinned ?? false,
      groupMuted: payload.muted ?? conversation.groupMuted ?? false,
      groupMembers,
      updatedAt: Date.now()
    });
    if (nickname !== undefined && nickname !== (member?.nickname || member?.trueName)) {
      await appendGroupSystemEvent(nextConversation, `${member?.trueName}将群内昵称修改为「${nickname || member?.trueName}」`);
    }
    return nextConversation;
  }

  function groupMessageContextContent(message: ChatMessage | ChatMessageQuote) {
    if (message.sticker) return `[Sticker] ${message.sticker.description}`;
    if (message.image) {
      if (message.image.kind === 'description') return `[图片描述卡片] ${message.image.description}`;
      return `[${message.image.kind === 'photo' ? '相机照片' : '本地图片'}] ${message.image.description}${message.image.aiHint ? `；补充线索：${message.image.aiHint}` : ''}`;
    }
    if (message.voice) return `[语音] ${message.voice.transcript}`;
    return message.content.trim();
  }

  function renderSyncedGroupContext(group: Conversation, sourceMessages: ChatMessage[]) {
    const eventText = sourceMessages.map((message) => {
      const quoteText = message.quote ? `（引用${message.quote.authorName}：${groupMessageContextContent(message.quote)}）` : '';
      return `${message.authorName || '群成员'}：${quoteText}${groupMessageContextContent(message)}`;
    }).join('\n');
    return eventText ? `【角色亲历的群聊事件｜${group.title}】\n${eventText}` : '';
  }

  async function syncGroupEventsToCharacterConversations(group: Conversation, sourceMessages: ChatMessage[]) {
    if (!sourceMessages.length) return;
    const characterIds = new Set(group.groupMembers?.filter((member) => member.identityType === 'character' && (member.membershipStatus ?? 'active') === 'active').map((member) => member.identityId).filter((id): id is string => Boolean(id)) ?? []);
    const targets = conversations.value.filter((conversation) => conversation.kind !== 'group' && characterIds.has(conversation.charId));
    await Promise.all(targets.flatMap((conversation) => sourceMessages.map(async (sourceMessage, index) => {
      const content = renderSyncedGroupContext(group, [sourceMessage]);
      if (!content) return;
      const alreadySynced = messages.value.some((message) => message.conversationId === conversation.id
        && message.contextOnly
        && message.sourceConversationId === group.id
        && message.sourceMessageIds?.length === 1
        && message.sourceMessageIds[0] === sourceMessage.id);
      if (alreadySynced) return;
      const contextMessage: ChatMessage = {
        id: createId('msg'), conversationId: conversation.id, sender: 'system', authorType: 'system', authorName: '系统',
        mode: conversation.activeMode, content,
        sourceConversationId: group.id, sourceMessageIds: [sourceMessage.id],
        contextOnly: true, createdAt: Date.now() + index, status: 'sent'
      };
      messages.value.push(contextMessage);
      await putEntity('messages', contextMessage);
    })));
  }

  async function refreshGroupSyncedContexts(groupId: string, changedSourceMessageIds: string[]) {
    const changedIds = new Set(changedSourceMessageIds.map((id) => id.trim()).filter(Boolean));
    if (!changedIds.size) return;
    const affectedContexts = messages.value.filter((message) => message.contextOnly
      && message.sourceConversationId === groupId
      && message.sourceMessageIds?.some((sourceId) => changedIds.has(sourceId)));
    const sourceIdsToRebuild = new Set([...changedIds, ...affectedContexts.flatMap((message) => message.sourceMessageIds ?? [])]);
    if (affectedContexts.length) {
      const affectedContextIds = new Set(affectedContexts.map((message) => message.id));
      messages.value = messages.value.filter((message) => !affectedContextIds.has(message.id));
      await Promise.all(affectedContexts.map((message) => deleteEntity('messages', message.id)));
    }
    const group = conversationById(groupId);
    if (!group || group.kind !== 'group') return;
    const remainingSources = messages.value.filter((message) => message.conversationId === groupId
      && !message.contextOnly
      && sourceIdsToRebuild.has(message.id));
    await syncGroupEventsToCharacterConversations(group, remainingSources);
  }

  async function triggerGroupPrivateInitiations(group: Conversation, initiations: Array<{ characterId: string; reason: string }>) {
    for (const initiation of initiations.slice(0, 1)) {
      const character = characterById(initiation.characterId);
      const privateConversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.charId === initiation.characterId && entry.userId === group.userId);
      if (!character || !privateConversation || isConversationReplying(privateConversation.id)) continue;
      if (privateConversation.activeMode !== 'online') await updateConversationMode(privateConversation.id, 'online');
      await requestRoleplayReply(privateConversation.id, {
        proactive: true,
        replyInstruction: `你刚刚参与了群聊「${group.title}」，现在因为“${initiation.reason}”自然地想单独联系${getUserAiName(userById(group.userId) ?? user.value)}。请在一对一线上聊天里主动发一组符合当前关系和语境的消息；不要说自己是被系统安排来私聊，也不要复述整段群聊。`
      });
    }
  }

  async function requestGroupReply(conversationId: string, options: { proactive?: boolean; instruction?: string; allowPrivateInitiation?: boolean } = {}) {
    const conversation = conversationById(conversationId);
    const activeUser = userById(conversation?.userId ?? '') ?? user.value;
    if (!conversation || conversation.kind !== 'group' || !activeUser || !conversation.groupMembers?.length || isConversationReplying(conversationId)) return [];
    const runId = startConversationReply(conversationId);
    if (!runId) return [];
    try {
      const recentMessages = messagesForConversation(conversationId).filter((message) => !message.contextOnly).slice(-36);
      const groupMessageContent = (message: ChatMessage | ChatMessageQuote) => {
        if (message.sticker) return `[Sticker] ${message.sticker.description}`;
        if (message.image) {
          if (message.image.kind === 'description') return `发送了一张图片，图片内容为“${message.image.description}”。`;
          const kindLabel = message.image.kind === 'photo' ? '相机照片' : '本地图片';
          const hintText = message.image.aiHint ? ` 图片内容线索：${message.image.aiHint}。` : '';
          return `发送了一张${kindLabel}，真实图片已随请求附带，可直接识图。${hintText}`;
        }
        if (message.voice) return `发送了一条语音消息，语音内容为“${message.voice.transcript}”。`;
        return message.content;
      };
      const history = recentMessages.map((message) => {
        const quoteText = message.quote
          ? `【引用 ${message.quote.authorName}：${groupMessageContent(message.quote)}】\n`
          : '';
        return `[${message.id}] ${message.authorName || (message.sender === 'user' ? getUserAiName(activeUser) : '系统')}：${quoteText}${groupMessageContent(message)}`;
      }).join('\n');
      const characterContexts = conversation.groupMembers.flatMap((member) => {
        if (member.identityType !== 'character' || !member.identityId) return [];
        const character = characterById(member.identityId);
        return character ? [groupCharacterContext(character)] : [];
      });
      const chatSettings = settingsForConversation(conversationId);
      const availableGroupStickers = stickersForGroups(chatSettings.characterStickerGroupIds);
      const generated = await generateGroupChatReply({
        user: activeUser, groupName: conversation.title, announcement: conversation.groupAnnouncement ?? '',
        members: conversation.groupMembers, history, messages: recentMessages, stickerVisionEnabled: chatSettings.stickerVisionEnabled,
        memorySummary: memoryContextForConversation(conversationId, history, { storeDebug: false }),
        characterContexts,
        worldBooks: worldBooks.value,
        availableStickers: availableGroupStickers.map((sticker) => ({ id: sticker.id, description: sticker.description })),
        proactive: options.proactive,
        instruction: options.instruction,
        membershipStatus: groupUserMember(conversation)?.membershipStatus ?? 'active',
        mode: conversation.activeMode,
        settings: settings.value ?? undefined,
        modelOverride: getConversationTextModelOverride(chatSettings, conversation.activeMode)
      });
      const baseTime = Date.now();
      const replyBatchId = createId('group-reply');
      const generatedMessages = generated.messages.map((entry, index) => {
        const member = conversation.groupMembers?.find((item) => item.id === entry.authorMemberId);
        const sticker = entry.type === 'sticker' ? availableGroupStickers.find((item) => item.id === entry.stickerId) : null;
        const quotedMessage = entry.quoteMessageId
          ? recentMessages.find((message) => message.id === entry.quoteMessageId && message.sender !== 'system')
          : undefined;
        const content = entry.type === 'voice' ? `[语音] ${entry.content}` : entry.type === 'image' ? `[图片描述卡片] ${entry.content}` : entry.type === 'sticker' ? `[Sticker] ${sticker?.description || entry.content}` : entry.content;
        return {
          id: createId('msg'), conversationId, sender: 'char' as const, authorType: member?.identityType ?? 'npc',
          authorId: member?.identityId || member?.id, authorName: member?.trueName || '群成员', mode: conversation.activeMode,
          content,
          voice: entry.type === 'voice' ? { source: 'text' as const, transcript: entry.content, duration: estimateVoiceDuration(entry.content) } : undefined,
          image: entry.type === 'image' ? { kind: 'description' as const, description: entry.content } : undefined,
          sticker: sticker ? { stickerId: sticker.id, description: sticker.description, imageUrl: sticker.imageUrl, cachedImageUrl: sticker.cachedImageUrl } : undefined,
          quote: quotedMessage ? createMessageQuoteSnapshot(quotedMessage) ?? undefined : undefined,
          replyBatchId, createdAt: baseTime + index, status: 'sent' as const
        } satisfies ChatMessage;
      });
      const latestConversation = conversationById(conversationId) ?? conversation;
      const nextConversation = { ...latestConversation, updatedAt: generatedMessages.at(-1)?.createdAt ?? baseTime };
      if (generatedMessages.length) {
        messages.value.push(...generatedMessages);
        conversations.value = conversations.value.map((item) => item.id === conversationId ? nextConversation : item);
        await Promise.all([...generatedMessages.map((message) => putEntity('messages', message)), putEntity('conversations', nextConversation)]);
        await syncGroupEventsToCharacterConversations(nextConversation, generatedMessages);
      }
      if (generated.membershipDecision) {
        const latestGroup = conversationById(conversationId) ?? nextConversation;
        const applicant = groupUserMember(latestGroup);
        if (applicant?.membershipStatus === 'pending') {
          const approved = generated.membershipDecision === 'approve';
          const members = latestGroup.groupMembers?.map((member) => member.id === applicant.id ? { ...member, membershipStatus: approved ? 'active' as const : 'left' as const, exitedAt: approved ? undefined : Date.now(), joinedAt: approved ? Date.now() : member.joinedAt } : member) ?? [];
          const decidedConversation = await saveGroupConversation({ ...latestGroup, groupMembers: members, updatedAt: Date.now() });
          await appendGroupSystemEvent(decidedConversation, approved ? `${applicant.trueName}的入群申请已通过` : `${applicant.trueName}的入群申请被拒绝`);
        }
      }
      if (options.allowPrivateInitiation !== false && generated.privateInitiations.length) {
        await triggerGroupPrivateInitiations(nextConversation, generated.privateInitiations);
      }
      void maybeAutoCaptureConversationMemory(conversationId);
      return generatedMessages;
    } catch (error) {
      showConfigAlert(error instanceof Error ? error.message : '群聊回复生成失败。', '无法生成群聊回复');
      return [];
    } finally {
      finishConversationReply(conversationId, runId);
    }
  }

  async function regenerateLatestGroupReply(conversationId: string, instruction = '') {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group' || isConversationReplying(conversationId)) return false;
    const conversationMessages = messagesForConversation(conversationId).filter((message) => !message.contextOnly && message.mode === conversation.activeMode);
    const latestReply = [...conversationMessages].reverse().find((message) => message.sender === 'char' && message.replyBatchId);
    if (!latestReply?.replyBatchId) {
      showConfigAlert('暂无可重新生成的群聊回复。', '无法重新回复');
      return false;
    }
    const removedMessages = conversationMessages.filter((message) => message.replyBatchId === latestReply.replyBatchId);
    await deleteMessages(removedMessages.map((message) => message.id));
    await requestGroupReply(conversationId, {
      instruction: instruction.trim() ? `用户要求重新生成上一轮群回复，并补充引导：${instruction.trim()}` : '用户要求重新生成上一轮群回复。请给出与被删除版本不同、但仍符合上下文的自然回复。'
    });
    return true;
  }

  async function deleteGroupConversation(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group') return false;
    cancelConversationReply(conversationId);
    const relatedMessages = messages.value.filter((message) => message.conversationId === conversationId || message.sourceConversationId === conversationId);
    const relatedSettings = conversationSettings.value.filter((entry) => entry.conversationId === conversationId);
    messages.value = messages.value.filter((message) => !relatedMessages.some((related) => related.id === message.id));
    conversationSettings.value = conversationSettings.value.filter((entry) => entry.conversationId !== conversationId);
    conversations.value = conversations.value.filter((entry) => entry.id !== conversationId);
    await Promise.all([
      deleteEntity('conversations', conversationId),
      ...relatedMessages.map((message) => deleteEntity('messages', message.id)),
      ...relatedSettings.map((entry) => deleteEntity('conversationSettings', entry.conversationId))
    ]);
    queueStoredMediaPrune();
    return true;
  }

  async function maybeRequestProactiveGroupReply(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind !== 'group' || conversation.activeMode !== 'online' || isConversationReplying(conversationId)) return false;
    const chatSettings = settingsForConversation(conversationId);
    if (!chatSettings.proactiveReply.enabled) return false;
    const now = Date.now();
    const cooldown = proactiveReplyCooldownMs(chatSettings.proactiveReply.frequency);
    if (chatSettings.proactiveReply.lastTriggeredAt && now - chatSettings.proactiveReply.lastTriggeredAt < cooldown) return false;
    await touchProactiveReplyAttempt(chatSettings, now);
    if (Math.random() >= getVoomFrequencyChance(chatSettings.proactiveReply.frequency)) return false;
    await requestGroupReply(conversationId, { proactive: true });
    return true;
  }

  async function runProactiveGroupScheduler() {
    for (const conversation of conversations.value.filter((entry) => entry.kind === 'group')) {
      await maybeRequestProactiveGroupReply(conversation.id);
    }
  }

  async function saveAccountProfile(nextUser: UserProfile) {
    const actualBoundCharacterIds = characters.value
      .filter((character) => character.boundUserId === nextUser.id)
      .map((character) => character.id);

    await saveUserProfile({
      ...nextUser,
      boundCharacterIds: actualBoundCharacterIds
    });
  }

  async function deleteUserProfile(userId: string) {
    const index = users.value.findIndex((account) => account.id === userId);
    if (index < 0 || users.value.length <= 1) return;

    const fallbackUser = users.value[index + 1] ?? users.value[index - 1] ?? null;
    if (!fallbackUser) return;

    const affectedCharacters = characters.value.filter((character) => character.boundUserId === userId);
    if (affectedCharacters.length) {
      await Promise.all(
        affectedCharacters.map((character) => saveCharacter({
          ...character,
          boundUserId: fallbackUser.id
        }))
      );
    }

    users.value.splice(index, 1);
    await deleteEntity('user', userId);

    if (settings.value?.activeUserId === userId) {
      settings.value = normalizeAppSettings({
        ...settings.value,
        activeUserId: fallbackUser.id
      });
      await putEntity('settings', settings.value, 'main');
    }
    queueStoredMediaPrune();
  }

  async function deleteCharacterProfile(characterId: string) {
    const character = characterById(characterId);
    if (!character) return false;
    const roleOperations = useRoleOperationsStore();

    const now = Date.now();
    const privateConversations = conversations.value.filter((entry) => entry.kind !== 'group' && entry.charId === characterId);
    const privateConversationIds = new Set(privateConversations.map((entry) => entry.id));
    privateConversations.forEach((entry) => cancelConversationReply(entry.id));

    const affectedGroupConversations = conversations.value.filter((entry) => entry.kind === 'group' && (entry.charId === characterId || entry.groupMembers?.some((member) => member.identityType === 'character' && member.identityId === characterId)));
    const removedGroupMemberIds = new Set(affectedGroupConversations.flatMap((entry) => entry.groupMembers
      ?.filter((member) => member.identityType === 'character' && member.identityId === characterId)
      .map((member) => member.id) ?? []));
    const removedGroupMessageIds = new Set(messages.value.flatMap((message) => {
      const groupConversation = affectedGroupConversations.find((entry) => entry.id === message.conversationId);
      if (!groupConversation) return [];
      const member = groupMemberForMessage(groupConversation, message);
      const belongsToCharacter = member?.identityType === 'character' && member.identityId === characterId
        || message.authorId === characterId
        || Boolean(message.authorId && removedGroupMemberIds.has(message.authorId));
      return belongsToCharacter ? [message.id] : [];
    }));
    const groupConversationUpdates = affectedGroupConversations.map((entry) => {
      const groupMembers = entry.groupMembers?.filter((member) => member.identityType !== 'character' || member.identityId !== characterId);
      const fallbackCharacterId = groupMembers?.find((member) => member.identityType === 'character' && member.identityId)?.identityId ?? '';
      return {
        ...entry,
        charId: entry.charId === characterId ? fallbackCharacterId : entry.charId,
        groupMembers,
        updatedAt: now
      };
    });

    const relatedMessages = messages.value.filter((message) => privateConversationIds.has(message.conversationId)
      || Boolean(message.sourceConversationId && privateConversationIds.has(message.sourceConversationId))
      || removedGroupMessageIds.has(message.id)
      || message.sourceMessageIds?.some((id) => removedGroupMessageIds.has(id)));
    const relatedMessageIds = new Set(relatedMessages.map((message) => message.id));
    const messageUpdates = messages.value.flatMap((message) => {
      if (relatedMessageIds.has(message.id) || !message.quote) return [];
      const quoteBelongsToCharacter = relatedMessageIds.has(message.quote.messageId)
        || message.quote.authorId === characterId
        || Boolean(message.quote.authorId && removedGroupMemberIds.has(message.quote.authorId));
      return quoteBelongsToCharacter ? [{ ...message, quote: undefined }] : [];
    });
    const messageUpdateMap = new Map(messageUpdates.map((message) => [message.id, message]));

    const relatedSettings = conversationSettings.value.filter((entry) => privateConversationIds.has(entry.conversationId));
    const relatedHomepages = profileHomepages.value.filter((entry) => entry.charId === characterId || privateConversationIds.has(entry.conversationId));
    const relatedTheaters = smallTheaters.value.filter((entry) => entry.charId === characterId || Boolean(entry.conversationId && privateConversationIds.has(entry.conversationId)));
    const relatedFavorites = favorites.value.filter((entry) => {
      const favoriteConversation = conversationById(entry.conversationId);
      const favoriteGroupMember = groupMemberForMessage(favoriteConversation, entry.message);
      return entry.characterId === characterId
        || privateConversationIds.has(entry.conversationId)
        || relatedMessageIds.has(entry.sourceMessageId)
        || favoriteGroupMember?.identityType === 'character' && favoriteGroupMember.identityId === characterId;
    });
    const relatedFavoriteIds = new Set(relatedFavorites.map((entry) => entry.id));
    const favoriteUpdates = favorites.value.flatMap((entry) => {
      if (relatedFavoriteIds.has(entry.id) || !entry.message.quote) return [];
      const quoteBelongsToCharacter = relatedMessageIds.has(entry.message.quote.messageId)
        || entry.message.quote.authorId === characterId
        || Boolean(entry.message.quote.authorId && removedGroupMemberIds.has(entry.message.quote.authorId));
      return quoteBelongsToCharacter ? [{ ...entry, message: { ...entry.message, quote: undefined } }] : [];
    });
    const favoriteUpdateMap = new Map(favoriteUpdates.map((entry) => [entry.id, entry]));

    const characterNameKeys = new Set([character.id, character.nickname, character.name, character.userNote, getCharacterVoomAuthorName(character)]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean));
    const postsToDelete: VoomPost[] = [];
    const postsToUpdate: VoomPost[] = [];
    for (const post of voomPosts.value) {
      const postConversationIds = post.conversationIds?.map((id) => id.trim()).filter(Boolean) ?? [];
      const isCharacterPost = post.charId === characterId || post.authorType !== 'user' && (Boolean(post.conversationId && privateConversationIds.has(post.conversationId)) || postConversationIds.some((id) => privateConversationIds.has(id)));
      if (isCharacterPost) {
        postsToDelete.push(post);
        continue;
      }

      const removedCommentIds = new Set<string>();
      for (const comment of post.comments) {
        const authorKey = String(comment.authorId ?? comment.authorName ?? '').trim().toLocaleLowerCase();
        if (characterNameKeys.has(authorKey)) removedCommentIds.add(comment.id);
      }
      let removedNestedComment = true;
      while (removedNestedComment) {
        removedNestedComment = false;
        for (const comment of post.comments) {
          if (comment.parentId && removedCommentIds.has(comment.parentId) && !removedCommentIds.has(comment.id)) {
            removedCommentIds.add(comment.id);
            removedNestedComment = true;
          }
        }
      }

      const nextConversationIds = postConversationIds.filter((id) => !privateConversationIds.has(id));
      const nextVisibleCharacterIds = post.visibleCharacterIds?.filter((id) => id !== characterId);
      const nextExpansionCharacterIds = post.proactiveCommentExpansionCharacterIds?.filter((id) => id !== characterId);
      const nextComments = removedCommentIds.size ? post.comments.filter((comment) => !removedCommentIds.has(comment.id)) : post.comments;
      const nextLikes = post.likes.filter((like) => !characterNameKeys.has(like.trim().toLocaleLowerCase()));
      const nextConversationId = post.conversationId && privateConversationIds.has(post.conversationId) ? nextConversationIds[0] : post.conversationId;
      const removedFromPostAudience = Boolean(post.conversationId && privateConversationIds.has(post.conversationId))
        || postConversationIds.some((id) => privateConversationIds.has(id))
        || post.visibleCharacterIds?.includes(characterId);
      const touchedPost = removedFromPostAudience
        || post.proactiveCommentExpansionCharacterIds?.includes(characterId)
        || nextComments.length !== post.comments.length
        || nextLikes.length !== post.likes.length;
      if (!touchedPost) continue;
      if (isUserVoomPost(post) && removedFromPostAudience && !nextConversationIds.length && (!nextVisibleCharacterIds || !nextVisibleCharacterIds.length)) {
        postsToDelete.push(post);
        continue;
      }
      postsToUpdate.push(createPersistableVoomPost({
        ...post,
        conversationId: nextConversationId || undefined,
        conversationIds: post.conversationIds ? nextConversationIds : undefined,
        proactiveCommentExpansionCharacterIds: post.proactiveCommentExpansionCharacterIds ? nextExpansionCharacterIds : undefined,
        visibleCharacterIds: post.visibleCharacterIds ? nextVisibleCharacterIds : undefined,
        comments: nextComments,
        likes: nextLikes
      }));
    }
    const postDeleteIds = new Set(postsToDelete.map((post) => post.id));
    const postUpdateMap = new Map(postsToUpdate.map((post) => [post.id, post]));

    const musicThreadUpdates = musicCommentThreads.value.flatMap((thread) => {
      const removedCommentIds = new Set(thread.comments.filter((comment) => characterNameKeys.has(String(comment.authorId ?? comment.authorName).trim().toLocaleLowerCase())).map((comment) => comment.id));
      let removedNestedComment = true;
      while (removedNestedComment) {
        removedNestedComment = false;
        for (const comment of thread.comments) {
          if (comment.parentId && removedCommentIds.has(comment.parentId) && !removedCommentIds.has(comment.id)) {
            removedCommentIds.add(comment.id);
            removedNestedComment = true;
          }
        }
      }
      return removedCommentIds.size ? [{ ...thread, comments: thread.comments.filter((comment) => !removedCommentIds.has(comment.id)), updatedAt: now }] : [];
    });
    const musicThreadUpdateMap = new Map(musicThreadUpdates.map((thread) => [thread.trackKey, thread]));

    const otherCharacterLocalWorldBookIds = new Set(characters.value.filter((entry) => entry.id !== characterId).flatMap((entry) => entry.localWorldBookIds));
    const relatedLocalWorldBooks = worldBooks.value.filter((book) => book.scope === 'local' && character.localWorldBookIds.includes(book.id) && !otherCharacterLocalWorldBookIds.has(book.id));
    const owner = userById(character.boundUserId);
    const nextSettings = settings.value ? discardCharacterEnabledOverrides(settings.value, characterId) : null;
    const brainIdPrefix = `brain:${characterId}:`;
    const brainIds = new Set([
      createMemoryBrainId(character.id, character.boundUserId),
      ...privateConversations.map((entry) => createMemoryBrainId(character.id, entry.userId)),
      ...memoryEpisodes.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryEntities.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryAssertions.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryEdges.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryThemes.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryStateSnapshots.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId),
      ...memoryEmbeddings.value.filter((entry) => entry.brainId.startsWith(brainIdPrefix)).map((entry) => entry.brainId)
    ]);
    for (const brainId of brainIds) await clearMemoryBrainData(brainId);

    characters.value = characters.value.filter((entry) => entry.id !== characterId);
    const groupConversationUpdateMap = new Map(groupConversationUpdates.map((entry) => [entry.id, entry]));
    conversations.value = conversations.value
      .filter((entry) => !privateConversationIds.has(entry.id))
      .map((entry) => groupConversationUpdateMap.get(entry.id) ?? entry);
    messages.value = messages.value
      .filter((message) => !relatedMessageIds.has(message.id))
      .map((message) => messageUpdateMap.get(message.id) ?? message);
    conversationSettings.value = conversationSettings.value.filter((entry) => !privateConversationIds.has(entry.conversationId));
    profileHomepages.value = profileHomepages.value.filter((entry) => !relatedHomepages.some((related) => related.id === entry.id));
    smallTheaters.value = smallTheaters.value.filter((entry) => !relatedTheaters.some((related) => related.id === entry.id));
    favorites.value = favorites.value
      .filter((entry) => !relatedFavoriteIds.has(entry.id))
      .map((entry) => favoriteUpdateMap.get(entry.id) ?? entry);
    voomPosts.value = voomPosts.value
      .filter((post) => !postDeleteIds.has(post.id))
      .map((post) => postUpdateMap.get(post.id) ?? post);
    musicCommentThreads.value = musicCommentThreads.value.map((thread) => musicThreadUpdateMap.get(thread.trackKey) ?? thread);
    worldBooks.value = worldBooks.value.filter((book) => !relatedLocalWorldBooks.some((relatedBook) => relatedBook.id === book.id));
    if (nextSettings) settings.value = nextSettings;
    if (activeConversationId.value && privateConversationIds.has(activeConversationId.value)) activeConversationId.value = null;
    if (activeCall.value && privateConversationIds.has(activeCall.value.conversationId)) clearActiveCall(activeCall.value.conversationId);

    await deleteEntity('characters', characterId);

    if (owner) {
      await saveUserProfile({
        ...owner,
        boundCharacterIds: owner.boundCharacterIds.filter((id) => id !== characterId)
      });
    }

    await Promise.all([
      ...privateConversations.map((entry) => deleteEntity('conversations', entry.id)),
      ...groupConversationUpdates.map((entry) => putEntity('conversations', entry)),
      ...relatedMessages.map((message) => deleteEntity('messages', message.id)),
      ...messageUpdates.map((message) => putEntity('messages', message)),
      ...relatedSettings.map((entry) => deleteEntity('conversationSettings', entry.conversationId)),
      ...relatedHomepages.map((entry) => deleteEntity('profileHomepages', entry.id)),
      ...relatedTheaters.map((entry) => deleteEntity('smallTheaters', entry.id)),
      ...relatedFavorites.map((entry) => deleteEntity('favorites', entry.id)),
      ...favoriteUpdates.map((entry) => putEntity('favorites', toRaw(entry))),
      ...postsToDelete.map((post) => deleteEntity('voomPosts', post.id)),
      ...postsToUpdate.map((post) => putEntity('voomPosts', post)),
      ...musicThreadUpdates.map((thread) => putEntity('musicCommentThreads', thread)),
      ...relatedLocalWorldBooks.map((book) => deleteEntity('worldBooks', book.id)),
      ...(nextSettings ? [putEntity('settings', nextSettings, 'main')] : [])
    ]);
    await roleOperations.ensureReady();
    await roleOperations.removeCharacterData(characterId);
    queueStoredMediaPrune();
    return true;
  }

  async function clearCharacterHistory(characterId: string) {
    const character = characterById(characterId);
    if (!character) return false;

    const conversation = conversations.value.find((entry) => entry.charId === characterId);
    const conversationId = conversation?.id ?? '';
    const now = Date.now();
    const relatedMessages = conversationId ? messages.value.filter((message) => message.conversationId === conversationId) : [];
    const brainId = conversationId ? memoryBrainIdForConversation(conversationId) : createMemoryBrainId(character.id, character.boundUserId);
    const characterNameKeys = new Set([character.id, character.nickname, character.name, getCharacterVoomAuthorName(character)]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean));
    const postsToDelete: VoomPost[] = [];
    const postsToUpdate: VoomPost[] = [];
    const initialProfile = getCharacterInitialProfile(character);

    for (const post of voomPosts.value) {
      const postConversationIds = post.conversationIds?.map((id) => id.trim()).filter(Boolean) ?? [];
      const isCharacterPost = post.charId === characterId || (post.authorType !== 'user' && (post.conversationId === conversationId || postConversationIds.includes(conversationId)));
      if (isCharacterPost) {
        postsToDelete.push(post);
        continue;
      }

      const removedCommentIds = new Set<string>();
      for (const comment of post.comments) {
        const authorKey = String(comment.authorId ?? comment.authorName ?? '').trim().toLocaleLowerCase();
        if (characterNameKeys.has(authorKey)) removedCommentIds.add(comment.id);
      }

      let changed = true;
      while (changed) {
        changed = false;
        for (const comment of post.comments) {
          if (comment.parentId && removedCommentIds.has(comment.parentId) && !removedCommentIds.has(comment.id)) {
            removedCommentIds.add(comment.id);
            changed = true;
          }
        }
      }

      const nextConversationIds = postConversationIds.filter((id) => id !== conversationId);
      const nextVisibleCharacterIds = post.visibleCharacterIds?.filter((id) => id !== characterId);
      const nextComments = removedCommentIds.size ? post.comments.filter((comment) => !removedCommentIds.has(comment.id)) : post.comments;
      const nextLikes = post.likes.filter((like) => !characterNameKeys.has(like.trim().toLocaleLowerCase()));
      const nextConversationId = post.conversationId === conversationId ? nextConversationIds[0] : post.conversationId;
      const removedFromPostAudience = post.conversationId === conversationId || postConversationIds.includes(conversationId) || post.visibleCharacterIds?.includes(characterId);
      const touchedPost = post.conversationId === conversationId
        || postConversationIds.includes(conversationId)
        || post.visibleCharacterIds?.includes(characterId)
        || nextComments.length !== post.comments.length
        || nextLikes.length !== post.likes.length;

      if (!touchedPost) continue;

      if (isUserVoomPost(post) && removedFromPostAudience && !nextConversationIds.length && (!nextVisibleCharacterIds || !nextVisibleCharacterIds.length)) {
        postsToDelete.push(post);
        continue;
      }

      postsToUpdate.push(createPersistableVoomPost({
        ...post,
        conversationId: nextConversationId || undefined,
        conversationIds: post.conversationIds ? nextConversationIds : undefined,
        visibleCharacterIds: post.visibleCharacterIds ? nextVisibleCharacterIds : undefined,
        comments: nextComments,
        likes: nextLikes
      }));
    }

    const postDeleteIds = new Set(postsToDelete.map((post) => post.id));
    const postUpdateMap = new Map(postsToUpdate.map((post) => [post.id, post]));
    await clearMemoryBrainData(brainId);
    messages.value = messages.value.filter((message) => message.conversationId !== conversationId);
    voomPosts.value = voomPosts.value
      .filter((post) => !postDeleteIds.has(post.id))
      .map((post) => postUpdateMap.get(post.id) ?? post);

    const nextCharacter = normalizeCharacterProfile({
      ...character,
      nickname: initialProfile.nickname,
      signature: initialProfile.signature,
      initialProfile,
      subtitle: '刚刚成为好友',
      lastSeen: '现在',
      voomFrequency: 'medium',
      profileHistory: [],
      mindState: undefined,
      profile: undefined
    }, character.boundUserId);
    const characterIndex = characters.value.findIndex((entry) => entry.id === characterId);
    if (characterIndex >= 0) characters.value[characterIndex] = nextCharacter;

    const nextConversation = conversation ? {
      ...conversation,
      title: nextCharacter.nickname,
      userId: nextCharacter.boundUserId,
      activeMode: 'online' as const,
      updatedAt: now,
      unreadCount: 0,
      summary: '刚成为好友，还没有太多共同经历。'
    } : undefined;
    if (nextConversation) {
      const conversationIndex = conversations.value.findIndex((entry) => entry.id === nextConversation.id);
      if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    }

    await Promise.all([
      putEntity('characters', nextCharacter),
      ...(nextConversation ? [putEntity('conversations', nextConversation)] : []),
      ...relatedMessages.map((message) => deleteEntity('messages', message.id)),
      ...postsToDelete.map((post) => deleteEntity('voomPosts', post.id)),
      ...postsToUpdate.map((post) => putEntity('voomPosts', post))
    ]);
    queueStoredMediaPrune();

    return true;
  }

  async function saveWorldBook(entry: WorldBookEntry) {
    const normalizedEntry = normalizeWorldBookEntry(entry);
    const index = worldBooks.value.findIndex((book) => book.id === normalizedEntry.id);
    if (index >= 0) worldBooks.value[index] = normalizedEntry;
    else worldBooks.value.push(normalizedEntry);
    await putEntity('worldBooks', normalizedEntry);
  }

  async function deleteWorldBook(worldBookId: string) {
    if (isTabooWorldBook(worldBookId)) return;
    const index = worldBooks.value.findIndex((book) => book.id === worldBookId);
    if (index < 0) return;

    worldBooks.value.splice(index, 1);

    const affectedCharacters = characters.value.filter((character) => character.localWorldBookIds.includes(worldBookId));
    if (affectedCharacters.length) {
      await Promise.all(
        affectedCharacters.map((character) => {
          const nextCharacter = {
            ...character,
            localWorldBookIds: character.localWorldBookIds.filter((id) => id !== worldBookId)
          };
          const characterIndex = characters.value.findIndex((item) => item.id === nextCharacter.id);
          if (characterIndex >= 0) characters.value[characterIndex] = nextCharacter;
          return putEntity('characters', nextCharacter);
        })
      );
    }

    await deleteEntity('worldBooks', worldBookId);
    queueStoredMediaPrune();
  }

  type BackupImageCompactor = (value: string) => Promise<string>;

  function createBackupImageCompactor(): BackupImageCompactor {
    const compactedBySource = new Map<string, Promise<string>>();
    return async (value: string) => {
      const source = value.trim();
      if (!source) return value;
      let compacted = compactedBySource.get(source);
      if (!compacted) {
        compacted = compactInlineDisplayImage(source);
        compactedBySource.set(source, compacted);
      }
      return await compacted;
    };
  }

  async function compactChatImageForBackup(image: ChatImageAttachment, compactImage: BackupImageCompactor): Promise<ChatImageAttachment> {
    const sourceUrl = image.url?.trim() ?? '';
    const nextUrl = sourceUrl ? await compactImage(sourceUrl) : image.url;
    const nextCandidates = image.candidates
      ? await Promise.all(image.candidates.map(async (candidate) => ({
          ...candidate,
          image: await compactImage(candidate.image)
        })))
      : image.candidates;
    return {
      ...image,
      url: nextUrl,
      candidates: nextCandidates
    };
  }

  async function compactMessageForBackup(message: ChatMessage, compactImage: BackupImageCompactor): Promise<ChatMessage> {
    const nextImage = message.image ? await compactChatImageForBackup(message.image, compactImage) : message.image;
    const nextQuoteImage = message.quote?.image ? await compactChatImageForBackup(message.quote.image, compactImage) : message.quote?.image;
    return {
      ...message,
      image: nextImage,
      quote: message.quote ? { ...message.quote, image: nextQuoteImage } : message.quote
    };
  }

  async function compactVoomPostForBackup(post: VoomPost, compactImage: BackupImageCompactor): Promise<VoomPost> {
    const sourceImage = post.image?.trim() ?? '';
    const nextImage = sourceImage ? await compactImage(sourceImage) : post.image;
    const nextCandidates = post.imageCandidates
      ? await Promise.all(post.imageCandidates.map(async (candidate) => ({
          ...candidate,
          image: await compactImage(candidate.image)
        })))
      : post.imageCandidates;
    return {
      ...post,
      image: nextImage,
      imageCandidates: nextCandidates
    };
  }

  async function compactGeneratedImageForBackup(record: GeneratedImageRecord, compactImage: BackupImageCompactor): Promise<GeneratedImageRecord> {
    return {
      ...record,
      imageUrl: await compactImage(record.imageUrl)
    };
  }

  async function compactCharacterForBackup(character: CharacterProfile, compactImage: BackupImageCompactor): Promise<CharacterProfile> {
    const imageProfile = character.imageProfile;
    if (!imageProfile?.photos.length) return character;
    const photos = imageProfile.photos;
    const nextPhotos = await Promise.all(photos.map(async (photo) => ({
      ...photo,
      imageUrl: await compactImage(photo.imageUrl)
    })));
    return {
      ...character,
      imageProfile: {
        ...imageProfile,
        photos: nextPhotos
      }
    };
  }

  async function compactStickerForBackup(sticker: Sticker, compactImage: BackupImageCompactor): Promise<Sticker> {
    if (sticker.sourceType !== 'local-image') return sticker;
    const localImage = sticker.cachedImageUrl?.trim()
      || (sticker.imageUrl !== stickerBackupPlaceholder ? sticker.imageUrl.trim() : '');
    if (!localImage) {
      const { cachedImageUrl: _cachedImageUrl, cachedImageUpdatedAt: _cachedImageUpdatedAt, ...restSticker } = sticker;
      return { ...restSticker, imageUrl: stickerBackupPlaceholder };
    }
    return {
      ...sticker,
      imageUrl: stickerBackupPlaceholder,
      cachedImageUrl: await compactImage(localImage)
    };
  }

  async function compactSnapshotMediaForBackup(snapshot: AppSnapshot, onProgress?: BackupProgressCallback): Promise<AppSnapshot> {
    const compactImage = createBackupImageCompactor();
    const characters: CharacterProfile[] = [];
    for (const character of snapshot.characters) characters.push(await compactCharacterForBackup(character, compactImage));
    await onProgress?.('正在压缩角色图片', 62);

    const messages: ChatMessage[] = [];
    for (const message of snapshot.messages) messages.push(await compactMessageForBackup(message, compactImage));
    await onProgress?.('正在压缩聊天图片', 68);

    const voomPostsForBackup: VoomPost[] = [];
    for (const post of snapshot.voomPosts) voomPostsForBackup.push(await compactVoomPostForBackup(post, compactImage));
    await onProgress?.('正在压缩 VOOM 图片', 73);

    const generatedImagesForBackup: GeneratedImageRecord[] = [];
    for (const record of snapshot.generatedImages ?? []) generatedImagesForBackup.push(await compactGeneratedImageForBackup(record, compactImage));
    await onProgress?.('正在压缩生图记录', 78);

    const stickersForBackup: Sticker[] = [];
    for (const sticker of snapshot.stickers) stickersForBackup.push(await compactStickerForBackup(sticker, compactImage));
    await onProgress?.('正在压缩本地贴纸', 82);

    const favoritesForBackup: FavoriteMessageRecord[] = [];
    for (const favorite of snapshot.favorites ?? []) {
      favoritesForBackup.push({
        ...favorite,
        message: await compactMessageForBackup(favorite.message, compactImage)
      });
    }
    await onProgress?.('正在整理收藏内容', 85);

    return {
      ...snapshot,
      characters,
      messages,
      voomPosts: voomPostsForBackup,
      generatedImages: generatedImagesForBackup,
      stickers: stickersForBackup,
      favorites: favoritesForBackup
    };
  }

  async function createBackupFile(onProgress?: BackupProgressCallback) {
    if (!ready.value) await hydrate();
    await onProgress?.('正在读取本地数据库', 8);
    const sourceSnapshot = await loadSnapshot();
    const storedMediaTotal = collectStoredMediaLocators(sourceSnapshot).size;
    let storedMediaCompleted = 0;
    let lastMediaProgress = -1;
    const missingMedia = new Set<string>();
    await onProgress?.(storedMediaTotal ? `正在读取本地媒体 0/${storedMediaTotal}` : '本地媒体读取完成', storedMediaTotal ? 15 : 52);
    const snapshot = await materializeStoredMediaRefs(sourceSnapshot, {
      missing: 'empty',
      onMissing: (source) => missingMedia.add(source),
      onMaterialized: () => {
        storedMediaCompleted += 1;
        const percent = storedMediaTotal ? 15 + Math.round(storedMediaCompleted / storedMediaTotal * 37) : 52;
        if (percent === lastMediaProgress) return;
        lastMediaProgress = percent;
        void onProgress?.(`正在读取本地媒体 ${Math.min(storedMediaCompleted, storedMediaTotal)}/${storedMediaTotal}`, percent);
      }
    });
    await onProgress?.('正在整理备份内容', 56);
    const normalizedVoomPosts = snapshot.voomPosts.map((post) => normalizeStoredVoomPostIdentityReferences(post));
    const backupSnapshot = await compactSnapshotMediaForBackup({
      ...snapshot,
      messages: snapshot.messages
        .map((message) => normalizeStoredMessageAuthorReference(message))
        .map((message) => normalizeStoredVoomEventMessage(message, normalizedVoomPosts)),
      voomPosts: normalizedVoomPosts,
      smallTheaters: normalizeStoredSmallTheaters(snapshot.smallTheaters ?? []),
      musicCommentThreads: normalizeStoredMusicCommentThreads(snapshot.musicCommentThreads ?? []),
      favorites: normalizeFavorites(snapshot.favorites ?? [])
    }, onProgress);
    await onProgress?.('正在清洗敏感配置', 87);
    const backup = createLinkBackupFile(backupSnapshot, missingMedia.size);
    await onProgress?.('备份内容准备完成', 89);
    return backup;
  }

  async function importBackupSnapshot(snapshot: AppSnapshot, options: ImportBackupOptions = {}): Promise<ImportBackupResult> {
    await options.onProgress?.('正在整理导入数据', 45);
    const normalizedSnapshot = keepDeviceBackupSettings(normalizeSnapshotForRestore(snapshot));
    const slimmedForMobile = false;
    const restorableSnapshot = stripRestoreEmbeddingCache(normalizedSnapshot);
    const preparedSnapshot = prepareSnapshotForStore(restorableSnapshot);
    const persistentStorageGranted = await requestPersistentStorage();
    await options.onProgress?.('正在写入本地数据库', 75);

    try {
      await replaceSnapshot(preparedSnapshot);
    } catch (error) {
      throw normalizeImportPersistenceError(error);
    }

    await options.onProgress?.('正在刷新本地数据', 92);
    markRestoredGlobalNoticesSeen(preparedSnapshot);
    applySnapshotToStore(preparedSnapshot);
    const roleOperations = useRoleOperationsStore();
    roleOperations.applySnapshot(preparedSnapshot);
    queueMissingStickerImageCaches(preparedSnapshot.stickers);
    void refreshEnabledVendorModels();
    return { slimmedForMobile, persistentStorageGranted };
  }

  async function saveCloudBackupState(overrides: Partial<AppSettings['cloudBackup']>) {
    if (!settings.value) return;
    const normalizedSettings = normalizeAppSettings({
      ...settings.value,
      cloudBackup: {
        ...settings.value.cloudBackup,
        ...overrides
      }
    });
    settings.value = normalizedSettings;
    await putEntity('settings', normalizedSettings, 'main');
  }

  async function saveCloudBackupProgress(phase: AppSettings['cloudBackup']['progress']['phase'], label: string, percent: number) {
    await saveCloudBackupState({
      progress: {
        phase,
        label,
        percent: Math.min(100, Math.max(0, Math.round(percent))),
        updatedAt: Date.now()
      }
    });
  }

  function formatCloudBackupError(error: unknown) {
    return error instanceof Error ? error.message : '用户云备份失败。';
  }

  async function runCloudBackup(reason: 'manual' | 'auto' = 'manual') {
    if (cloudBackupRunning) return false;
    if (!settings.value) throw new Error('设置尚未载入。');
    const config = settings.value.cloudBackup;
    if (!isCloudBackupConnected(config)) throw new Error('请先连接一个用户自有云盘。');

    cloudBackupRunning = true;
    await saveCloudBackupState({ lastBackupStatus: 'running', lastBackupError: '' });
    await saveCloudBackupProgress('uploading', reason === 'auto' ? '正在准备自动加密备份' : '正在准备加密备份', 3);

    try {
      const backup = await createBackupFile(async (label, percent) => {
        await saveCloudBackupProgress('uploading', label, 3 + percent * 0.3);
      });
      let lastProgress = -1;
      const result = await uploadEncryptedCloudBackup(settings.value?.cloudBackup ?? config, backup, async (progress) => {
        if (progress.percent === lastProgress) return;
        lastProgress = progress.percent;
        await saveCloudBackupProgress('uploading', progress.label, 30 + progress.percent * 0.7);
      });
      await saveCloudBackupState({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: result.tokenExpiresAt,
        remoteFileId: result.remoteFileId,
        lastBackupAt: Date.now(),
        latestRemoteBackupAt: result.backup.exportedAt,
        lastBackupBytes: result.byteLength,
        lastBackupStatus: 'success',
        lastBackupError: '',
        progress: {
          phase: 'completed',
          label: reason === 'auto' ? '自动加密备份已完成' : '加密备份已完成',
          percent: 100,
          updatedAt: Date.now()
        }
      });
      return true;
    } catch (error) {
      const message = formatCloudBackupError(error);
      await saveCloudBackupState({
        lastBackupStatus: 'failed',
        lastBackupError: message,
        progress: { phase: 'failed', label: message, percent: 100, updatedAt: Date.now() }
      });
      throw error;
    } finally {
      cloudBackupRunning = false;
    }
  }

  async function restoreCloudBackup(options: ImportBackupOptions = {}) {
    if (cloudBackupRunning) return false;
    if (!settings.value) throw new Error('设置尚未载入。');
    const config = settings.value.cloudBackup;
    if (!isCloudBackupConnected(config)) throw new Error('请先连接一个用户自有云盘。');

    cloudBackupRunning = true;
    await saveCloudBackupState({ lastBackupStatus: 'running', lastBackupError: '' });
    await saveCloudBackupProgress('downloading', '正在下载云端密文', 5);

    try {
      let lastProgress = -1;
      const result = await downloadEncryptedCloudBackup(config, async (progress) => {
        if (progress.percent === lastProgress) return;
        lastProgress = progress.percent;
        await saveCloudBackupProgress('downloading', progress.label, progress.percent);
      });
      await saveCloudBackupState({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: result.tokenExpiresAt,
        remoteFileId: result.remoteFileId,
        latestRemoteBackupAt: result.backup.exportedAt,
        lastBackupBytes: result.byteLength,
        progress: { phase: 'restoring', label: '正在写入当前设备', percent: 45, updatedAt: Date.now() }
      });
      await importBackupSnapshot(result.backup.snapshot, {
        onProgress: async (label, percent) => {
          await saveCloudBackupProgress('restoring', label, 45 + percent * 0.55);
          await options.onProgress?.(label, percent);
        }
      });
      await saveCloudBackupState({
        lastBackupStatus: 'success',
        lastBackupError: '',
        progress: { phase: 'completed', label: '云端备份已恢复', percent: 100, updatedAt: Date.now() }
      });
      return true;
    } catch (error) {
      const message = formatCloudBackupError(error);
      await saveCloudBackupState({
        lastBackupStatus: 'failed',
        lastBackupError: message,
        progress: { phase: 'failed', label: message, percent: 100, updatedAt: Date.now() }
      });
      throw error;
    } finally {
      cloudBackupRunning = false;
    }
  }

  async function saveGitHubBackupState(overrides: Partial<AppSettings['githubBackup']>) {
    if (!settings.value) return;
    const normalizedSettings = normalizeAppSettings({
      ...settings.value,
      githubBackup: {
        ...settings.value.githubBackup,
        ...overrides
      }
    });
    settings.value = normalizedSettings;
    await putEntity('settings', normalizedSettings, 'main');
  }

  async function saveGitHubBackupProgress(phase: AppSettings['githubBackup']['progress']['phase'], label: string, percent: number) {
    await saveGitHubBackupState({
      progress: {
        phase,
        label,
        percent: Math.min(100, Math.max(0, Math.round(percent))),
        updatedAt: Date.now()
      }
    });
  }

  async function loadGitHubBackupHistory(limit = 3) {
    if (!settings.value) throw new Error('设置尚未载入。');

    const config = settings.value.githubBackup;
    if (!config.token || !config.owner || !config.repo) throw new Error('请先连接 GitHub 并创建备份仓库。');

    const historyItems = await listGitHubBackupHistory({
      token: config.token,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      path: config.path
    }, limit);

    return historyItems.map((item) => ({
      sha: item.sha,
      committedAt: Date.parse(item.committedAt) || 0,
      exportedAt: 0,
      message: item.message.trim()
    }));
  }

  async function syncGitHubBackupHistory(limit = 3) {
    await saveGitHubBackupProgress('checking', '正在检查 GitHub 备份记录', 15);

    try {
      const history = await loadGitHubBackupHistory(limit);
      const latest = history[0];
      await saveGitHubBackupState({
        history,
        latestRemoteBackupSha: latest?.sha ?? '',
        latestRemoteBackupAt: latest?.committedAt ?? 0,
        progress: {
          phase: history.length ? 'completed' : 'idle',
          label: history.length ? '已同步 GitHub 备份记录' : '',
          percent: history.length ? 100 : 0,
          updatedAt: Date.now()
        }
      });
      return history;
    } catch (error) {
      if (error instanceof GitHubBackupError && (error.status === 404 || error.status === 409)) {
        await saveGitHubBackupState({
          history: [],
          latestRemoteBackupSha: '',
          latestRemoteBackupAt: 0,
          pendingRestoreSha: '',
          pendingRestoreAt: 0,
          progress: {
            phase: 'idle',
            label: '',
            percent: 0,
            updatedAt: Date.now()
          }
        });
        return [];
      }
      await saveGitHubBackupProgress('failed', formatGitHubBackupError(error), 100);
      throw error;
    }
  }

  async function runGitHubBackup(reason: 'manual' | 'auto' = 'manual') {
    if (githubBackupRunning) return false;
    if (!settings.value) throw new Error('设置尚未载入。');

    const config = settings.value.githubBackup;
    if (!config.token || !config.owner || !config.repo) throw new Error('请先连接 GitHub 并创建备份仓库。');

    githubBackupRunning = true;
    await saveGitHubBackupState({ lastBackupStatus: 'running', lastBackupError: '' });
    await saveGitHubBackupProgress('checking', reason === 'auto' ? '正在准备自动备份' : '正在准备手动备份', 10);

    try {
      await saveGitHubBackupProgress('checking', reason === 'auto' ? '正在检查自动备份仓库' : '正在检查备份仓库', 25);
      const repository = await ensureGitHubBackupRepository({
        token: config.token,
        owner: config.owner,
        repo: config.repo
      });
      await saveGitHubBackupState({
        owner: repository.owner,
        repo: repository.repo,
        branch: repository.branch || config.branch || 'main'
      });
      const backup = await createBackupFile(async (label, percent) => {
        await saveGitHubBackupProgress('checking', label, 27 + percent * 0.42);
      });
      const activeConfig = settings.value?.githubBackup ?? config;
      await saveGitHubBackupProgress('uploading', reason === 'auto' ? '正在上传自动备份' : '正在上传手动备份', 65);
      await uploadGitHubBackup(
        {
          token: activeConfig.token,
          owner: activeConfig.owner,
          repo: activeConfig.repo,
          branch: activeConfig.branch,
          path: activeConfig.path
        },
        backup,
        `${reason === 'auto' ? 'Auto' : 'Manual'} LINK backup ${new Date().toISOString()}`,
        {
          onProgress: async ({ label, percent }) => {
            await saveGitHubBackupProgress('uploading', label, 65 + percent * 0.3);
          }
        }
      );
      const history = await loadGitHubBackupHistory(3).catch(() => activeConfig.history ?? []);
      const latest = history[0];
      await saveGitHubBackupState({
        lastBackupAt: Date.now(),
        lastBackupStatus: 'success',
        lastBackupError: '',
        latestRemoteBackupSha: latest?.sha ?? '',
        latestRemoteBackupAt: latest?.committedAt ?? Date.now(),
        pendingRestoreSha: '',
        pendingRestoreAt: 0,
        history,
        progress: {
          phase: 'completed',
          label: reason === 'auto' ? '自动备份已完成' : '手动备份已完成',
          percent: 100,
          updatedAt: Date.now()
        }
      });
      return true;
    } catch (error) {
      await saveGitHubBackupState({ lastBackupStatus: 'failed', lastBackupError: formatGitHubBackupError(error) });
      await saveGitHubBackupProgress('failed', formatGitHubBackupError(error), 100);
      throw error;
    } finally {
      githubBackupRunning = false;
    }
  }

  async function importGitHubBackup(ref = '') {
    if (githubBackupRunning) return false;
    if (!settings.value) throw new Error('设置尚未载入。');

    const config = settings.value.githubBackup;
    if (!config.token || !config.owner || !config.repo) throw new Error('请先连接 GitHub 并创建备份仓库。');

    githubBackupRunning = true;
    await saveGitHubBackupState({ lastBackupStatus: 'running', lastBackupError: '' });
    await saveGitHubBackupProgress('downloading', '正在下载 GitHub 备份', 25);

    try {
      let downloadProgressPercent = 25;
      const onDownloadProgress = async ({ label, percent }: { label: string; percent: number }) => {
        downloadProgressPercent = Math.max(downloadProgressPercent, percent);
        await saveGitHubBackupProgress('downloading', label, downloadProgressPercent);
      };
      const backupText = ref
        ? await downloadGitHubBackupVersion({
            token: config.token,
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            path: config.path
          }, ref, { onProgress: onDownloadProgress })
        : await downloadGitHubBackup({
            token: config.token,
            owner: config.owner,
            repo: config.repo,
            branch: config.branch,
            path: config.path
          }, { onProgress: onDownloadProgress });
      await saveGitHubBackupProgress('restoring', '正在解析 GitHub 备份', 76);
      const backupFile = parseLinkBackupFileText(backupText);
      const currentBackupConfig = settings.value.githubBackup;
      await saveGitHubBackupProgress('restoring', '正在恢复 GitHub 备份到本地', 77);
      let restoreProgressPercent = 76;
      await importBackupSnapshot(backupFile.snapshot, {
        sourceByteSize: new Blob([backupText]).size,
        onProgress: async (label, percent) => {
          const mappedPercent = 76 + Math.round(Math.min(100, Math.max(0, percent)) * 0.18);
          restoreProgressPercent = Math.max(restoreProgressPercent, mappedPercent);
          await saveGitHubBackupProgress('restoring', label, restoreProgressPercent);
        }
      });
      await saveGitHubBackupProgress('checking', '正在刷新 GitHub 备份记录', 96);
      const history = await loadGitHubBackupHistory(3).catch(() => currentBackupConfig.history ?? []);
      const latest = history[0];
      await saveGitHubBackupState({
        lastBackupAt: Date.now(),
        lastBackupStatus: 'success',
        lastBackupError: '',
        latestRemoteBackupSha: latest?.sha ?? ref,
        latestRemoteBackupAt: latest?.committedAt ?? currentBackupConfig.latestRemoteBackupAt,
        pendingRestoreSha: '',
        pendingRestoreAt: 0,
        history,
        progress: {
          phase: 'completed',
          label: 'GitHub 备份已恢复到本地',
          percent: 100,
          updatedAt: Date.now()
        }
      });
      return true;
    } catch (error) {
      await saveGitHubBackupState({ lastBackupStatus: 'failed', lastBackupError: formatGitHubBackupError(error) });
      await saveGitHubBackupProgress('failed', formatGitHubBackupError(error), 100);
      throw error;
    } finally {
      githubBackupRunning = false;
    }
  }

  async function hasGitHubBackup() {
    const history = await syncGitHubBackupHistory(3);
    return history.length > 0;
  }

  async function saveSettings(nextSettings: AppSettings) {
    const normalizedSettings = normalizeAppSettings(nextSettings);
    await putEntity('settings', normalizedSettings, 'main');
    settings.value = normalizedSettings;
    await clearUnavailableModelOverrides();
    void refreshEnabledVendorModels();
  }

  async function addGeneratedImage(record: Omit<GeneratedImageRecord, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) {
    const normalizedRecord = normalizeGeneratedImages([{
      id: record.id || createId('image'),
      provider: record.provider,
      imageUrl: record.imageUrl,
      title: record.title,
      prompt: record.prompt,
      negativePrompt: record.negativePrompt,
      model: record.model,
      size: record.size,
      source: record.source,
      createdAt: record.createdAt ?? Date.now()
    }])[0];
    if (!normalizedRecord) return null;

    generatedImages.value = [normalizedRecord, ...generatedImages.value.filter((entry) => entry.id !== normalizedRecord.id)];
    await putEntity('generatedImages', normalizedRecord);
    return normalizedRecord;
  }

  async function updateGeneratedImageUrl(imageId: string, imageUrl: string) {
    const normalizedImageId = imageId.trim();
    const normalizedImageUrl = imageUrl.trim();
    if (!normalizedImageId || !normalizedImageUrl) return null;
    const imageIndex = generatedImages.value.findIndex((entry) => entry.id === normalizedImageId);
    if (imageIndex < 0) return null;
    const nextRecord = normalizeGeneratedImages([{ ...generatedImages.value[imageIndex], imageUrl: normalizedImageUrl }])[0];
    if (!nextRecord) return null;
    generatedImages.value[imageIndex] = nextRecord;
    await putEntity('generatedImages', nextRecord);
    return nextRecord;
  }

  async function deleteGeneratedImage(imageId: string) {
    generatedImages.value = generatedImages.value.filter((entry) => entry.id !== imageId);
    await deleteEntity('generatedImages', imageId);
    queueStoredMediaPrune();
  }

  async function refreshEnabledVendorModels() {
    if (!settings.value?.apiVendors.length) return;

    let changed = false;
    const nextVendors = await Promise.all(
      settings.value.apiVendors.map(async (vendor) => {
        if (!vendor.enabled || !vendor.apiUrl.trim() || !vendor.apiKey.trim()) return vendor;

        try {
          const fetchedModelIds = await fetchVendorModels(vendor);
          const mergedVendor = mergeVendorModels(vendor, fetchedModelIds);
          if (JSON.stringify(mergedVendor.models) !== JSON.stringify(vendor.models)) {
            changed = true;
          }
          return mergedVendor;
        } catch {
          return vendor;
        }
      })
    );

    if (changed && settings.value) {
      const normalizedSettings = normalizeAppSettings({
        ...settings.value,
        apiVendors: nextVendors
      });
      settings.value = normalizedSettings;
      await putEntity('settings', normalizedSettings, 'main');
    }
    await clearUnavailableModelOverrides();
  }

  async function bindWorldBook(characterId: string, worldBookId: string, enabled: boolean) {
    const character = characterById(characterId);
    if (!character) return;
    const ids = new Set(character.localWorldBookIds);
    if (enabled) ids.add(worldBookId);
    else ids.delete(worldBookId);
    await saveCharacter({ ...character, localWorldBookIds: [...ids] });
  }

  async function updateConversationMode(conversationId: string, mode: ChatMode) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    const nextConversation = { ...conversation, activeMode: mode, updatedAt: Date.now() };
    const index = conversations.value.findIndex((item) => item.id === conversationId);
    conversations.value[index] = nextConversation;
    await putEntity('conversations', nextConversation);
  }

  async function markConversationRead(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    const unreadMessages = messagesForConversation(conversationId)
      .filter((message) => message.mode === 'online' && message.sender === 'char' && message.readAt === null)
      .map((message) => ({ ...message, readAt: Date.now() }));
    const tasks: Array<Promise<unknown>> = unreadMessages.map((message) => putEntity('messages', message));
    if (unreadMessages.length) {
      const readById = new Map(unreadMessages.map((message) => [message.id, message]));
      messages.value = messages.value.map((message) => readById.get(message.id) ?? message);
    }
    if (conversation.unreadCount > 0) {
      const nextConversation = { ...conversation, unreadCount: 0 };
      const index = conversations.value.findIndex((item) => item.id === conversationId);
      conversations.value[index] = nextConversation;
      tasks.push(putEntity('conversations', nextConversation));
    }
    await Promise.all(tasks);
  }

  async function markUserMessagesReadByCharacter(conversationId: string, sentBefore: number) {
    const unreadMessages = messagesForConversation(conversationId)
      .filter((message) => message.mode === 'online'
        && message.sender === 'user'
        && message.readAt === null
        && message.createdAt <= sentBefore)
      .map((message) => ({ ...message, readAt: Date.now() }));
    if (!unreadMessages.length) return;
    const readById = new Map(unreadMessages.map((message) => [message.id, message]));
    messages.value = messages.value.map((message) => readById.get(message.id) ?? message);
    await Promise.all(unreadMessages.map((message) => putEntity('messages', message)));
  }

  function scheduleCharacterReadReceipt(conversationId: string, sentBefore: number) {
    const previousTimer = characterReadReceiptTimers.get(conversationId);
    if (previousTimer !== undefined) window.clearTimeout(previousTimer);
    const unreadCount = messagesForConversation(conversationId)
      .filter((message) => message.mode === 'online' && message.sender === 'user' && message.readAt === null && message.createdAt <= sentBefore)
      .length;
    if (!unreadCount) return;
    const delay = 700 + Math.min(1_300, unreadCount * 180 + conversationId.length * 37 % 900);
    const timer = window.setTimeout(() => {
      characterReadReceiptTimers.delete(conversationId);
      void markUserMessagesReadByCharacter(conversationId, sentBefore);
    }, delay);
    characterReadReceiptTimers.set(conversationId, timer);
  }

  async function appendUserMessage(conversationId: string, content: string, quote?: ChatMessageQuote | null) {
    const trimmedContent = content.trim();
    const conversation = conversationById(conversationId);
    if (!trimmedContent || !conversation) return;
    if (conversation.kind === 'group' && !isActiveGroupMember(groupUserMember(conversation))) return;
    const privateCharacter = conversation.kind !== 'group' ? characterById(conversation.charId) : null;
    const privateMessageBlocked = Boolean(privateCharacter && !isCharacterFriend(privateCharacter));
    const linkPreview = conversation.activeMode === 'online' ? createChatLinkPreview(trimmedContent) : null;

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      ...groupUserMessageIdentity(conversation),
      mode: conversation.activeMode,
      content: trimmedContent,
      ...(linkPreview ? { linkPreview } : {}),
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: privateMessageBlocked ? 'failed' : 'sent',
      readAt: !privateMessageBlocked && conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    if (linkPreview) void hydrateUserMessageLinkPreview(userMessage.id, linkPreview);
    if (!privateMessageBlocked) void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function hydrateUserMessageLinkPreview(messageId: string, fallback: ChatLinkPreviewAttachment) {
    const preview = await fetchChatLinkPreview(fallback);
    if (!preview.fetchedAt) return;
    const index = messages.value.findIndex((message) => message.id === messageId);
    const current = messages.value[index];
    if (index < 0 || !current?.linkPreview || current.linkPreview.url !== fallback.url) return;
    const updatedMessage: ChatMessage = { ...current, linkPreview: preview };
    messages.value[index] = updatedMessage;
    await putEntity('messages', updatedMessage);
  }

  async function appendUserCallMessage(conversationId: string, content: string, callId: string, callMode: ChatCallMode) {
    const trimmedContent = content.trim();
    const conversation = conversationById(conversationId);
    if (!trimmedContent || !conversation || !callId.trim()) return;

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: 'online',
      content: trimmedContent,
      callId: callId.trim(),
      callMode,
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0, activeMode: 'online' as const };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserCallImageMessage(conversationId: string, image: ChatImageAttachment, callId: string, callMode: ChatCallMode) {
    const description = image.description.trim() || '视频通话画面';
    const normalizedCallId = callId.trim();
    const conversation = conversationById(conversationId);
    if (!description || !conversation || !normalizedCallId) return;

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: 'online',
      content: `[视频通话画面] ${description}`,
      image: {
        ...image,
        description,
        aiHint: image.aiHint?.trim() || undefined
      },
      callId: normalizedCallId,
      callMode,
      contextOnly: true,
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);

    const staleContextMessages = messages.value
      .filter((message) => message.conversationId === conversationId && message.callId === normalizedCallId && message.contextOnly && message.image)
      .sort((left, right) => left.createdAt - right.createdAt)
      .slice(0, -3);
    if (staleContextMessages.length) {
      const staleIds = new Set(staleContextMessages.map((message) => message.id));
      messages.value = messages.value.filter((message) => !staleIds.has(message.id));
      await Promise.all(staleContextMessages.map((message) => deleteEntity('messages', message.id)));
      queueStoredMediaPrune();
    }

    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0, activeMode: 'online' as const };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    return userMessage;
  }

  async function appendStickerMessage(conversationId: string, sticker: Sticker, quote?: ChatMessageQuote | null) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    if (conversation.kind === 'group' && !canCurrentUserSendGroupMessage(conversation)) return;
    const sentAt = Date.now();
    const resolvedSticker = {
      ...sticker,
      imageUrl: sticker.imageUrl,
      cachedImageUrl: sticker.cachedImageUrl,
      cachedImageUpdatedAt: sticker.cachedImageUpdatedAt,
      lastUsedAt: sentAt,
      updatedAt: sticker.updatedAt
    };

    const stickerIndex = stickers.value.findIndex((item) => item.id === resolvedSticker.id);
    if (stickerIndex >= 0) stickers.value[stickerIndex] = resolvedSticker;
    await putEntity('stickers', resolvedSticker);

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      ...groupUserMessageIdentity(conversation),
      mode: conversation.activeMode,
      content: `[Sticker] ${resolvedSticker.description}`,
      sticker: {
        stickerId: resolvedSticker.id,
        description: resolvedSticker.description,
        imageUrl: resolvedSticker.imageUrl,
        cachedImageUrl: resolvedSticker.cachedImageUrl
      },
      quote: cloneMessageQuote(quote),
      createdAt: sentAt,
      status: 'sent',
      readAt: conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    if (nextConversation.kind === 'group') await syncGroupEventsToCharacterConversations(nextConversation, [userMessage]);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function localizeRecentStickerMessagesForVision(conversationId: string) {
    const candidates = messagesForConversation(conversationId)
      .slice(-12)
      .filter((message) => message.sender === 'user' && message.sticker?.imageUrl && shouldLocalizeStickerImageUrl(message.sticker.imageUrl))
      .slice(-4);

    for (const message of candidates) {
      const sticker = message.sticker;
      if (!sticker) continue;
      const cachedImageUrl = sticker.cachedImageUrl || await cacheStickerImageUrl(sticker.imageUrl);
      const nextMessage: ChatMessage = {
        ...message,
        sticker: {
          ...sticker,
          cachedImageUrl
        }
      };
      const messageIndex = messages.value.findIndex((item) => item.id === nextMessage.id);
      if (messageIndex >= 0) messages.value[messageIndex] = nextMessage;
    }
  }

  function getDataInventory() {
    const sections = [
      {
        id: 'profiles',
        label: '账号与角色',
        description: '用户资料、角色资料、头像与绑定关系',
        count: users.value.length + characters.value.length + profileThemes.value.length + profileHomepages.value.length,
        bytes: estimateGroupedArrayJsonBytes([users.value, characters.value, profileThemes.value, profileHomepages.value]),
        protected: true
      },
      {
        id: 'chatData',
        label: '聊天与会话',
        description: '会话列表、聊天消息、单聊设置',
        count: conversations.value.length + messages.value.length + conversationSettings.value.length,
        bytes: estimateGroupedArrayJsonBytes([conversations.value, messages.value, conversationSettings.value]),
        clearable: true
      },
      {
        id: 'favorites',
        label: '收藏夹',
        description: '收藏消息与收藏时保存的快照',
        count: favorites.value.length,
        bytes: estimateArrayJsonBytes(favorites.value),
        clearable: true
      },
      {
        id: 'characterMemory',
        label: '角色记忆',
        description: '角色日记、事实关系、主题、成长状态与召回缓存',
        count: memoryEpisodes.value.length + memoryEntities.value.length + memoryAssertions.value.length + memoryEdges.value.length + memoryThemes.value.length + memoryStateSnapshots.value.length + memoryEmbeddings.value.length,
        bytes: estimateGroupedArrayJsonBytes([memoryEpisodes.value, memoryEntities.value, memoryAssertions.value, memoryEdges.value, memoryThemes.value, memoryStateSnapshots.value, memoryEmbeddings.value]),
        clearable: true
      },
      {
        id: 'worldBooks',
        label: '世界书',
        description: '全局与角色绑定的世界书条目',
        count: worldBooks.value.length,
        bytes: estimateArrayJsonBytes(worldBooks.value),
        clearable: true
      },
      {
        id: 'voomPosts',
        label: 'VOOM 动态',
        description: '动态、评论、点赞与配图信息',
        count: voomPosts.value.length,
        bytes: estimateArrayJsonBytes(voomPosts.value),
        clearable: true
      },
      {
        id: 'smallTheaters',
        label: '小剧场',
        description: '小剧场主题与生成内容',
        count: smallTheaterTopics.value.length + smallTheaters.value.length,
        bytes: estimateGroupedArrayJsonBytes([smallTheaterTopics.value, smallTheaters.value]),
        clearable: true
      },
      {
        id: 'music',
        label: '音乐',
        description: '音乐收藏与评论线程',
        count: musicFavoriteTracks.value.length + musicCommentThreads.value.length,
        bytes: estimateGroupedArrayJsonBytes([musicFavoriteTracks.value, musicCommentThreads.value]),
        clearable: true
      },
      {
        id: 'stickers',
        label: '贴纸',
        description: '贴纸分组、贴纸条目与本地缓存',
        count: stickerGroups.value.length + stickers.value.length,
        bytes: estimateGroupedArrayJsonBytes([stickerGroups.value, stickers.value]),
        clearable: true
      },
      {
        id: 'generatedImages',
        label: '生成图',
        description: '聊天与 VOOM 生成图历史',
        count: generatedImages.value.length,
        bytes: estimateArrayJsonBytes(generatedImages.value),
        clearable: true
      },
      {
        id: 'settings',
        label: '应用配置',
        description: 'API、TTS、生图、备份与全局偏好',
        count: 1,
        bytes: estimateJsonBytes(settings.value),
        protected: true
      }
    ];
    const totalBytes = sections.reduce((total, section) => total + section.bytes, 0);
    return { sections, totalBytes };
  }

  function estimateCleanupFreedBytes(action: DataCleanupAction) {
    if (action === 'generated-images') return estimateArrayJsonBytes(generatedImages.value);

    if (action === 'message-media') {
      return estimateTransformedFreedBytes(messages.value, (message) => stripMessageMediaCache(message));
    }

    if (action === 'user-sent-images') {
      const messageFreedBytes = estimateTransformedFreedBytes(messages.value, (message) => stripUserSentImageData(message));
      const favoriteFreedBytes = estimateTransformedFreedBytes(favorites.value, (favorite) => ({ ...favorite, message: stripUserSentImageData(favorite.message) }));
      return messageFreedBytes + favoriteFreedBytes;
    }

    if (action === 'sticker-local-cache') {
      return estimateTransformedFreedBytes(stickers.value, (sticker) => stripStickerLocalCache(sticker));
    }

    if (action === 'image-candidates') {
      const messageFreedBytes = estimateTransformedFreedBytes(messages.value, (message) => stripImageCandidates(message));
      const postFreedBytes = estimateTransformedFreedBytes(voomPosts.value, (post) => post.imageCandidates?.length ? { ...post, imageCandidates: undefined } : post);
      return messageFreedBytes + postFreedBytes;
    }

    if (action === 'voice-audio') {
      return estimateTransformedFreedBytes(messages.value, (message) => stripVoiceAudio(message));
    }

    return 0;
  }

  function queueStoredMediaPrune() {
    void pruneUnusedStoredMediaCache().catch(() => undefined);
  }

  async function finishDataCleanup(changed: number) {
    if (changed > 0) await pruneUnusedStoredMediaCache().catch(() => undefined);
    return changed;
  }

  async function cleanupData(action: DataCleanupAction) {
    if (action === 'generated-images') return finishDataCleanup(await clearDataSections(['generatedImages']));

    if (action === 'message-media') {
      const nextMessages = messages.value.map((message) => stripMessageMediaCache(message));
      const changedMessages = nextMessages.filter((message, index) => JSON.stringify(message) !== JSON.stringify(messages.value[index]));
      if (changedMessages.length) await saveMessages(changedMessages);
      return finishDataCleanup(changedMessages.length);
    }

    if (action === 'user-sent-images') {
      const nextMessages = messages.value.map((message) => stripUserSentImageData(message));
      const changedMessages = nextMessages.filter((message, index) => message !== messages.value[index]);
      const nextFavorites = favorites.value.map((favorite) => {
        const nextMessage = stripUserSentImageData(favorite.message);
        return nextMessage === favorite.message ? favorite : { ...favorite, message: nextMessage, kind: favoriteKindForMessage(nextMessage), summary: messageReadableContent(nextMessage) };
      });
      const changedFavorites = nextFavorites.filter((favorite, index) => favorite !== favorites.value[index]);
      if (changedMessages.length) await saveMessages(changedMessages);
      if (changedFavorites.length) {
        const favoriteMap = new Map(changedFavorites.map((favorite) => [favorite.id, favorite]));
        favorites.value = normalizeFavorites(favorites.value.map((favorite) => favoriteMap.get(favorite.id) ?? favorite));
        await Promise.all(changedFavorites.map((favorite) => putEntity('favorites', toRaw(favorite))));
      }
      return finishDataCleanup(changedMessages.length + changedFavorites.length);
    }

    if (action === 'sticker-local-cache') {
      const now = Date.now();
      const nextStickers = stickers.value.map((sticker) => ({ ...stripStickerLocalCache(sticker), updatedAt: sticker.cachedImageUrl || isLocalMediaUrl(sticker.imageUrl) ? now : sticker.updatedAt }));
      const changedStickers = nextStickers.filter((sticker, index) => JSON.stringify(sticker) !== JSON.stringify(stickers.value[index]));
      if (changedStickers.length) {
        const changedMap = new Map(changedStickers.map((sticker) => [sticker.id, sticker]));
        stickers.value = stickers.value.map((sticker) => changedMap.get(sticker.id) ?? sticker);
        await Promise.all(changedStickers.map((sticker) => putEntity('stickers', sticker)));
      }
      return finishDataCleanup(changedStickers.length);
    }

    if (action === 'image-candidates') {
      const nextMessages = messages.value.map((message) => stripImageCandidates(message));
      const changedMessages = nextMessages.filter((message, index) => message !== messages.value[index]);
      const nextPosts = voomPosts.value.map((post) => post.imageCandidates?.length ? { ...post, imageCandidates: undefined } : post);
      const changedPosts = nextPosts.filter((post, index) => post !== voomPosts.value[index]);
      if (changedMessages.length) await saveMessages(changedMessages);
      if (changedPosts.length) {
        const postMap = new Map(changedPosts.map((post) => [post.id, post]));
        voomPosts.value = voomPosts.value.map((post) => postMap.get(post.id) ?? post);
        await Promise.all(changedPosts.map((post) => putEntity('voomPosts', createPersistableVoomPost(post))));
      }
      return finishDataCleanup(changedMessages.length + changedPosts.length);
    }

    if (action === 'voice-audio') {
      const nextMessages = messages.value.map((message) => stripVoiceAudio(message));
      const changedMessages = nextMessages.filter((message, index) => message !== messages.value[index]);
      if (changedMessages.length) await saveMessages(changedMessages);
      return finishDataCleanup(changedMessages.length);
    }

    return finishDataCleanup(0);
  }

  async function clearDataSections(sectionIds: ClearableDataSection[]) {
    const sectionSet = new Set(sectionIds);
    let changed = 0;

    if (sectionSet.has('messages')) {
      changed += await deleteMessages(messages.value.map((message) => message.id));
    }
    if (sectionSet.has('favorites')) {
      const entries = [...favorites.value];
      favorites.value = [];
      await Promise.all(entries.map((entry) => deleteEntity('favorites', entry.id)));
      changed += entries.length;
    }
    if (sectionSet.has('voomPosts')) {
      const posts = [...voomPosts.value];
      voomPosts.value = [];
      await Promise.all(posts.map((post) => deleteEntity('voomPosts', post.id)));
      changed += posts.length;
    }
    if (sectionSet.has('smallTheaters')) {
      const topics = [...smallTheaterTopics.value];
      const theaters = [...smallTheaters.value];
      smallTheaterTopics.value = [];
      smallTheaters.value = [];
      await Promise.all([
        ...topics.map((topic) => deleteEntity('smallTheaterTopics', topic.id)),
        ...theaters.map((theater) => deleteEntity('smallTheaters', theater.id))
      ]);
      changed += topics.length + theaters.length;
    }
    if (sectionSet.has('music')) {
      const tracks = [...musicFavoriteTracks.value];
      const threads = [...musicCommentThreads.value];
      musicFavoriteTracks.value = [];
      musicCommentThreads.value = [];
      await Promise.all([
        ...tracks.map((track) => deleteEntity('musicFavoriteTracks', track.id)),
        ...threads.map((thread) => deleteEntity('musicCommentThreads', thread.trackKey))
      ]);
      changed += tracks.length + threads.length;
    }
    if (sectionSet.has('worldBooks')) {
      const books = worldBooks.value.filter((book) => !isTabooWorldBook(book));
      const currentTabooBook = worldBooks.value.find((book) => isTabooWorldBook(book));
      const emptyTabooBook = normalizeWorldBookEntry({
        ...(currentTabooBook ?? createTabooWorldBook()),
        content: '',
        entries: []
      });
      worldBooks.value = [emptyTabooBook];
      characters.value = characters.value.map((character) => ({ ...character, localWorldBookIds: [] }));
      await Promise.all([
        ...books.map((book) => deleteEntity('worldBooks', book.id)),
        putEntity('worldBooks', emptyTabooBook),
        ...characters.value.map((character) => putEntity('characters', character))
      ]);
      changed += books.length;
    }
    if (sectionSet.has('stickers')) {
      const groups = [...stickerGroups.value];
      const entries = [...stickers.value];
      stickerGroups.value = [];
      stickers.value = [];
      await Promise.all([
        ...groups.map((group) => deleteEntity('stickerGroups', group.id)),
        ...entries.map((sticker) => deleteEntity('stickers', sticker.id))
      ]);
      changed += groups.length + entries.length;
    }
    if (sectionSet.has('conversationSettings')) {
      const entries = [...conversationSettings.value];
      conversationSettings.value = [];
      await Promise.all(entries.map((entry) => deleteEntity('conversationSettings', entry.conversationId)));
      changed += entries.length;
    }
    if (sectionSet.has('characterMemory')) {
      const episodes = [...memoryEpisodes.value];
      const entities = [...memoryEntities.value];
      const assertions = [...memoryAssertions.value];
      const edges = [...memoryEdges.value];
      const themes = [...memoryThemes.value];
      const stateSnapshots = [...memoryStateSnapshots.value];
      const embeddings = [...memoryEmbeddings.value];
      memoryEpisodes.value = [];
      memoryEntities.value = [];
      memoryAssertions.value = [];
      memoryEdges.value = [];
      memoryThemes.value = [];
      memoryStateSnapshots.value = [];
      memoryEmbeddings.value = [];
      await Promise.all([
        ...episodes.map((entry) => deleteEntity('memoryEpisodes', entry.id)),
        ...entities.map((entry) => deleteEntity('memoryEntities', entry.id)),
        ...assertions.map((entry) => deleteEntity('memoryAssertions', entry.id)),
        ...edges.map((entry) => deleteEntity('memoryEdges', entry.id)),
        ...themes.map((entry) => deleteEntity('memoryThemes', entry.id)),
        ...stateSnapshots.map((entry) => deleteEntity('memoryStateSnapshots', entry.id)),
        ...embeddings.map((entry) => deleteEntity('memoryEmbeddings', entry.id))
      ]);
      changed += episodes.length + entities.length + assertions.length + edges.length + themes.length + stateSnapshots.length + embeddings.length;
    }
    if (sectionSet.has('generatedImages')) {
      const entries = [...generatedImages.value];
      generatedImages.value = [];
      await Promise.all(entries.map((entry) => deleteEntity('generatedImages', entry.id)));
      changed += entries.length;
    }
    return changed;
  }

  async function appendUserImageMessage(conversationId: string, content: string, image: ChatImageAttachment, quote?: ChatMessageQuote | null) {
    const trimmedContent = content.trim();
    const description = image.description.trim();
    const conversation = conversationById(conversationId);
    if (!trimmedContent || !description || !conversation) return;
    if (conversation.kind === 'group' && !canCurrentUserSendGroupMessage(conversation)) return;

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      ...groupUserMessageIdentity(conversation),
      mode: conversation.activeMode,
      content: trimmedContent,
      image: {
        ...image,
        description,
        aiHint: image.aiHint?.trim() || undefined
      },
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    if (nextConversation.kind === 'group') await syncGroupEventsToCharacterConversations(nextConversation, [userMessage]);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserVoiceMessage(conversationId: string, voice: ChatVoiceAttachment, quote?: ChatMessageQuote | null) {
    const transcript = voice.transcript.trim();
    const conversation = conversationById(conversationId);
    if (!transcript || !conversation) return;
    if (conversation.kind === 'group' && !canCurrentUserSendGroupMessage(conversation)) return;

    const duration = estimateVoiceDuration(transcript, voice.duration);
    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      ...groupUserMessageIdentity(conversation),
      mode: conversation.activeMode,
      content: `[语音] ${transcript}`,
      voice: {
        source: voice.source,
        transcript,
        duration,
        audioUrl: voice.audioUrl,
        mimeType: voice.mimeType
      },
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    if (nextConversation.kind === 'group') await syncGroupEventsToCharacterConversations(nextConversation, [userMessage]);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserLocationMessage(conversationId: string, location: ChatLocationAttachment, quote?: ChatMessageQuote | null) {
    const normalizedLocation = normalizeLocationAttachment(location);
    const conversation = conversationById(conversationId);
    if (!normalizedLocation || !conversation) return;

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: conversation.activeMode,
      content: formatLocationContent(normalizedLocation),
      location: normalizedLocation,
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserTransferMessage(conversationId: string, transfer: Pick<ChatTransferAttachment, 'amount' | 'note'>, quote?: ChatMessageQuote | null) {
    const normalizedTransfer = normalizeTransferAttachment(transfer);
    const conversation = conversationById(conversationId);
    if (!normalizedTransfer || !conversation) return;
    const commerceStore = useCommerceStore();
    await commerceStore.ensureReady(users.value, characters.value);
    const wallet = commerceStore.walletForUser(conversation.userId);
    const amountCents = Math.round(Number(normalizedTransfer.amount) * 100);
    if (!wallet || wallet.balanceCents < amountCents) {
      showConfigAlert('当前 Wallet 余额不足，请减少转账金额后再试。', '无法发起转账');
      return;
    }

    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: conversation.activeMode,
      content: formatTransferContent(normalizedTransfer),
      transfer: normalizedTransfer,
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.activeMode === 'online' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserCommerceMessage(conversationId: string, commerce: Pick<ChatCommerceAttachment, 'storeName' | 'items' | 'totalAmount' | 'eta' | 'note' | 'cardMessage'> & { kind: 'takeout' | 'gift' }) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind === 'group') return;
    const boundUser = userById(conversation.userId) ?? user.value;
    const character = characterById(conversation.charId);
    if (!boundUser || !character) return;
    const totalAmount = String(commerce.totalAmount ?? '').replace(/[￥¥,\s]/g, '').trim();
    const storeName = String(commerce.storeName ?? '').trim();
    const items = commerce.items.map((item) => ({
      name: String(item.name ?? '').trim(),
      quantity: Math.min(99, Math.max(1, Math.floor(Number(item.quantity) || 1))),
      price: item.price && /^\d+(?:\.\d{1,2})?$/.test(String(item.price).trim()) ? String(item.price).trim() : undefined
    })).filter((item) => item.name).slice(0, 8);
    if (!storeName || !items.length || !/^\d+(?:\.\d{1,2})?$/.test(totalAmount) || Number(totalAmount) <= 0) return;
    const sentAt = Date.now();
    const attachment: ChatCommerceAttachment = {
      orderId: createId('order'),
      kind: commerce.kind,
      storeName,
      items,
      totalAmount,
      currency: 'CNY',
      status: commerce.kind === 'takeout' ? 'preparing' : 'paid',
      eta: commerce.eta?.trim() || undefined,
      note: commerce.note?.trim() || undefined,
      cardMessage: commerce.cardMessage?.trim() || undefined,
      purchaserName: getUserAiName(boundUser)
    };
    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: 'online',
      content: formatCommerceContent(attachment),
      commerce: attachment,
      createdAt: sentAt,
      status: 'sent',
      readAt: null
    };
    const commerceStore = useCommerceStore();
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    await commerceStore.ensureReady(users.value, characters.value);
    try {
      await commerceStore.recordUserChatPurchase({
        attachment,
        userId: boundUser.id,
        userName: getUserAiName(boundUser),
        characterId: character.id,
        characterName: getCharacterAiName(character),
        conversationId,
        sourceMessageId: userMessage.id
      });
      messages.value.push(userMessage);
      await putEntity('messages', userMessage);
      const nextConversation = { ...conversation, activeMode: 'online' as const, updatedAt: sentAt, unreadCount: 0 };
      if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
      await putEntity('conversations', nextConversation);
    } catch (error) {
      messages.value = messages.value.filter((message) => message.id !== userMessage.id);
      if (conversationIndex >= 0) conversations.value[conversationIndex] = conversation;
      await Promise.allSettled([
        deleteEntity('messages', userMessage.id),
        putEntity('conversations', conversation),
        commerceStore.rollbackChatFinancialActions([userMessage.id])
      ]);
      throw error;
    }
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserMusicListenInviteMessage(conversationId: string, payload: Partial<Pick<ChatMusicListenInviteAttachment, 'note' | 'track'>> = {}, quote?: ChatMessageQuote | null) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    const invitation = normalizeMusicListenInviteAttachment({
      note: payload.note,
      track: payload.track ?? musicPlayer.currentTrack ?? undefined
    });
    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: 'online',
      content: formatMusicListenInviteContent(invitation),
      musicListenInvite: invitation,
      quote: cloneMessageQuote(quote),
      createdAt: Date.now(),
      status: 'sent',
      readAt: conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, activeMode: 'online' as const, updatedAt: userMessage.createdAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendUserSmallTheaterLinkMessage(conversationId: string, theater: SmallTheater, quote?: ChatMessageQuote | null) {
    const conversation = conversationById(conversationId);
    if (!conversation) return;
    const theaterLink = normalizeSmallTheaterLinkAttachment(theater);
    const sentAt = Date.now();
    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: 'user',
      mode: 'online',
      content: formatSmallTheaterLinkContent(theaterLink),
      theaterLink,
      quote: cloneMessageQuote(quote),
      createdAt: sentAt,
      status: 'sent',
      readAt: conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, activeMode: 'online' as const, updatedAt: sentAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function appendShopShareMessage(input: {
    characterId: string;
    userId?: string;
    sender: 'user' | 'char';
    share: ChatShopShareAttachment;
  }) {
    const targetUserId = input.userId?.trim() || user.value?.id || '';
    const conversation = conversations.value.find((entry) => entry.kind !== 'group' && entry.userId === targetUserId && entry.charId === input.characterId);
    if (!conversation) throw new Error('没有找到这个角色的线上单聊，请先在 Chats 中创建会话。');
    const sentAt = Date.now();
    const share = { ...input.share };
    const message: ChatMessage = {
      id: createId('msg'),
      conversationId: conversation.id,
      sender: input.sender,
      mode: 'online',
      content: formatShopShareContent(share),
      shopShare: share,
      createdAt: sentAt,
      status: 'sent',
      readAt: input.sender === 'user' ? null : undefined
    };
    messages.value.push(message);
    await putEntity('messages', message);
    const nextConversation: Conversation = {
      ...conversation,
      activeMode: 'online',
      updatedAt: sentAt,
      summary: formatShopShareContent(share),
      unreadCount: input.sender === 'char' ? unreadCountAfterIncomingMessage(conversation, 1) : 0
    };
    const conversationIndex = conversations.value.findIndex((entry) => entry.id === conversation.id);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversation.id);
    return { message, conversation: nextConversation };
  }

  async function appendUserGobangMessage(conversationId: string, gobang: ChatGobangAttachment) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind === 'group') return;
    const sentAt = Date.now();
    const userMessage: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender: gobang.direction === 'incoming' ? 'char' : 'user',
      mode: 'online',
      content: formatGobangContent(gobang),
      gobang: {
        ...gobang,
        moves: gobang.moves.map((move) => ({ ...move })),
        apiState: gobang.apiState ? { ...gobang.apiState } : undefined
      },
      createdAt: sentAt,
      status: 'sent',
      readAt: null
    };
    messages.value.push(userMessage);
    await putEntity('messages', userMessage);
    const nextConversation = { ...conversation, activeMode: 'online' as const, updatedAt: sentAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return userMessage;
  }

  async function updateGobangInvitationStatus(messageId: string, status: 'accepted' | 'rejected' | 'cancelled') {
    const message = messages.value.find((item) => item.id === messageId);
    if (!message?.gobang) return null;
    const nextGame = respondGobangInvitation(message.gobang, status);
    if (nextGame === message.gobang) return message;
    return updateGobangMessage(messageId, nextGame);
  }

  async function appendGobangSessionMessage(conversationId: string, gameId: string, sender: 'user' | 'char' | 'system', content: string, options: { translation?: string; narration?: boolean; createdAt?: number; replyBatchId?: string } = {}) {
    const conversation = conversationById(conversationId);
    const normalizedGameId = gameId.trim();
    const normalizedContent = content.trim();
    if (!conversation || !normalizedGameId || !normalizedContent) return null;
    const message: ChatMessage = {
      id: createId('msg'),
      conversationId,
      sender,
      mode: 'online',
      content: normalizedContent,
      translation: normalizeTranslationText(options.translation),
      gobangId: normalizedGameId,
      createdAt: options.createdAt ?? Date.now(),
      displayStyle: options.narration ? 'narration' : undefined,
      replyBatchId: options.replyBatchId,
      status: 'sent',
      readAt: sender === 'user' && conversation.kind !== 'group' ? null : undefined
    };
    messages.value.push(message);
    await putEntity('messages', message);
    const nextConversation = { ...conversation, activeMode: 'online' as const, updatedAt: message.createdAt, unreadCount: sender === 'user' ? 0 : conversation.unreadCount };
    const conversationIndex = conversations.value.findIndex((item) => item.id === conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    void maybeAutoCaptureConversationMemory(conversationId);
    return message;
  }

  async function updateGobangMessage(messageId: string, gobang: ChatGobangAttachment) {
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    if (!existingMessage.gobang || existingMessage.gobang.gameId !== gobang.gameId) return null;
    const nextMessage: ChatMessage = {
      ...existingMessage,
      content: formatGobangContent(gobang),
      gobang: {
        ...gobang,
        moves: gobang.moves.map((move) => ({ ...move })),
        apiState: gobang.apiState ? { ...gobang.apiState } : undefined
      },
      editedAt: gobang.updatedAt
    };
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    await touchConversationAfterMessageChange(nextMessage.conversationId, gobang.updatedAt);
    return nextMessage;
  }

  async function requestGobangMove(conversationId: string, messageId: string, options: { signal?: AbortSignal } = {}) {
    const sourceMessage = messages.value.find((message) => message.id === messageId && message.conversationId === conversationId);
    const sourceGame = sourceMessage?.gobang;
    if (!sourceGame || (sourceGame.invitationStatus ?? 'accepted') !== 'accepted' || sourceGame.status !== 'active' || sourceGame.turn !== 'char') return null;
    if (activeGobangRequestIds.has(sourceGame.gameId)) return null;

    const replyInputBundle = await buildRoleplayReplyInputForConversation(conversationId, {
      mode: 'online',
      timeAwarenessNow: Date.now()
    });
    if (!replyInputBundle) throw new GobangApiError('unknown', '无法读取当前角色和会话上下文。');

    const modelOverride = replyInputBundle.modelOverride;
    const modelSnapshot = modelOverride || settings.value?.model || '';
    if (!hasConfiguredTextModel(modelOverride)) {
      const failedGame = updateGobangApiState(sourceGame, {
        status: 'failed',
        model: modelSnapshot,
        errorCode: 'not-configured',
        error: '请先配置可用的线上聊天 API 模型，再让角色继续落子。'
      });
      await updateGobangMessage(messageId, failedGame);
      throw new GobangApiError('not-configured', failedGame.apiState?.error ?? '未配置线上聊天 API 模型。');
    }

    const requestId = createId('gobang-request');
    const requestRevision = sourceGame.revision ?? sourceGame.moves.length;
    activeGobangRequestIds.set(sourceGame.gameId, requestId);
    const requestingGame = updateGobangApiState(sourceGame, {
      status: 'requesting',
      requestId,
      requestRevision,
      requestedAt: Date.now(),
      model: modelSnapshot
    });
    await updateGobangMessage(messageId, requestingGame);

    try {
      const generatedTurn = await generateGobangMove(replyInputBundle.input, requestingGame, options.signal);
      const currentMessage = messages.value.find((message) => message.id === messageId && message.conversationId === conversationId);
      const currentGame = currentMessage?.gobang;
      if (!currentGame
        || currentGame.status !== 'active'
        || currentGame.turn !== 'char'
        || currentGame.apiState?.requestId !== requestId
        || (currentGame.revision ?? currentGame.moves.length) !== requestRevision) return null;

      const nextGame = applyGobangMove(currentGame, {
        row: generatedTurn.row,
        column: generatedTurn.column
      }, 'char', {
        dialogue: generatedTurn.dialogue,
        dialogueTranslation: generatedTurn.dialogueTranslation,
        apiModel: modelSnapshot,
        requestId
      });
      if (nextGame === currentGame) throw new GobangApiError('illegal-move', '角色模型返回的落子不合法，本手没有生效。');
      await updateGobangMessage(messageId, nextGame);
      await requestRoleplayReply(conversationId, {
        gobangSession: { gameId: nextGame.gameId },
        generatedReplyPayload: generatedTurn.replyPayload,
        preparedReplyInput: replyInputBundle
      });
      return nextGame;
    } catch (error) {
      const currentMessage = messages.value.find((message) => message.id === messageId && message.conversationId === conversationId);
      const currentGame = currentMessage?.gobang;
      const failure = classifyGobangApiError(error);
      if (currentGame?.apiState?.requestId === requestId) {
        await updateGobangMessage(messageId, updateGobangApiState(currentGame, {
          status: failure.code === 'interrupted' ? 'interrupted' : 'failed',
          requestId,
          requestRevision,
          requestedAt: currentGame.apiState.requestedAt,
          model: modelSnapshot,
          errorCode: failure.code,
          error: failure.message.slice(0, 800)
        }));
      }
      throw error;
    } finally {
      if (activeGobangRequestIds.get(sourceGame.gameId) === requestId) activeGobangRequestIds.delete(sourceGame.gameId);
    }
  }

  async function recoverInterruptedGobangMessage(messageId: string) {
    const message = messages.value.find((entry) => entry.id === messageId);
    const game = message?.gobang;
    if (!game || (game.invitationStatus ?? 'accepted') !== 'accepted' || game.status !== 'active' || game.turn !== 'char' || game.apiState?.status !== 'requesting') return game ?? null;
    const activeRequestId = activeGobangRequestIds.get(game.gameId);
    if (activeRequestId && activeRequestId === game.apiState?.requestId) return game;
    const interruptedGame = updateGobangApiState(game, {
      ...game.apiState,
      status: 'interrupted',
      errorCode: 'interrupted',
      error: '上一次角色落子请求已中断，请重试这一手。'
    });
    await updateGobangMessage(messageId, interruptedGame);
    return interruptedGame;
  }

  async function updateTransferStatus(messageId: string, status: ChatTransferStatus, actor: 'user' | 'char' = 'user', replyBatchId = '') {
    if (status === 'pending') return null;
    const message = messages.value.find((item) => item.id === messageId);
    if (!message?.transfer || message.transfer.status !== 'pending') return null;
    if (actor === 'user' && message.sender !== 'char') return null;
    if (actor === 'char' && message.sender !== 'user') return null;
    const respondedAt = Date.now();
    const nextTransfer = { ...message.transfer, status, respondedAt };
    const nextMessage: ChatMessage = {
      ...message,
      content: formatTransferContent(nextTransfer),
      transfer: nextTransfer,
      editedAt: respondedAt
    };
    await syncChatTransferLedger(nextMessage);
    const messageIndex = messages.value.findIndex((item) => item.id === messageId);
    if (messageIndex >= 0) messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    const receiptTransfer: ChatTransferAttachment = {
      amount: nextTransfer.amount,
      currency: nextTransfer.currency,
      note: nextTransfer.note,
      status,
      respondedAt,
      responseToMessageId: message.id
    };
    const existingReceiptIndex = messages.value.findIndex((item) => item.transfer?.responseToMessageId === message.id);
    const existingReceiptMessage = existingReceiptIndex >= 0 ? messages.value[existingReceiptIndex] : null;
    const receiptMessage: ChatMessage = existingReceiptMessage
      ? {
          ...existingReceiptMessage,
          sender: actor,
          content: formatTransferReceiptContent(receiptTransfer),
          transfer: receiptTransfer,
          replyBatchId: replyBatchId || existingReceiptMessage.replyBatchId,
          editedAt: respondedAt
        }
      : {
          id: createId('msg'),
          conversationId: message.conversationId,
          sender: actor,
          mode: message.mode,
          content: formatTransferReceiptContent(receiptTransfer),
          transfer: receiptTransfer,
          ...(replyBatchId ? { replyBatchId } : {}),
          createdAt: respondedAt + 1,
          status: 'sent'
        };
    if (existingReceiptIndex >= 0) messages.value[existingReceiptIndex] = receiptMessage;
    else messages.value.push(receiptMessage);
    await putEntity('messages', receiptMessage);
    const conversation = conversationById(message.conversationId);
    if (conversation) {
      if (actor === 'char') notifyCharacterMessages(conversation, [receiptMessage]);
      const nextConversation = {
        ...conversation,
        updatedAt: receiptMessage.createdAt,
        unreadCount: actor === 'char' ? unreadCountAfterIncomingMessage(conversation, 1) : 0
      };
      const conversationIndex = conversations.value.findIndex((item) => item.id === message.conversationId);
      if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
      await putEntity('conversations', nextConversation);
    }
    void maybeAutoCaptureConversationMemory(message.conversationId);
    return nextMessage;
  }

  async function updateMusicListenInviteStatus(messageId: string, status: ChatMusicListenInviteStatus, actor: 'user' | 'char' = 'user') {
    if (status === 'pending') return null;
    const message = messages.value.find((item) => item.id === messageId);
    if (!message?.musicListenInvite || message.musicListenInvite.status !== 'pending') return null;
    if (actor === 'user' && message.sender !== 'char') return null;
    if (actor === 'char' && message.sender !== 'user') return null;
    const respondedAt = Date.now();
    const nextInvitation: ChatMusicListenInviteAttachment = {
      ...message.musicListenInvite,
      status,
      respondedAt,
      startedAt: status === 'accepted' ? respondedAt : message.musicListenInvite.startedAt
    };
    const nextMessage: ChatMessage = {
      ...message,
      content: formatMusicListenInviteContent(nextInvitation),
      musicListenInvite: nextInvitation,
      editedAt: respondedAt
    };
    const messageIndex = messages.value.findIndex((item) => item.id === messageId);
    if (messageIndex >= 0) messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    if (status === 'accepted') {
      startMusicListenTogether(message.conversationId, message.sender === 'user' ? 'user' : 'char');
      if (nextInvitation.track) {
        void playMusicTrackForConversation(message.conversationId, nextInvitation.track).catch((error) => console.warn('Listen invite playback failed.', error));
      }
    }
    const conversation = conversationById(message.conversationId);
    if (conversation) {
      const nextConversation = {
        ...conversation,
        updatedAt: respondedAt,
        unreadCount: actor === 'char' ? unreadCountAfterIncomingMessage(conversation, 1) : 0
      };
      const conversationIndex = conversations.value.findIndex((item) => item.id === message.conversationId);
      if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
      await putEntity('conversations', nextConversation);
    }
    void maybeAutoCaptureConversationMemory(message.conversationId);
    return nextMessage;
  }

  async function acceptMusicListenInvite(messageId: string) {
    return updateMusicListenInviteStatus(messageId, 'accepted', 'user');
  }

  async function rejectMusicListenInvite(messageId: string) {
    return updateMusicListenInviteStatus(messageId, 'rejected', 'user');
  }

  function memoryChannelForConversation(conversation: Conversation, sourceMessages: ChatMessage[]): MemoryEpisode['channel'] {
    if (conversation.kind === 'group') return 'group';
    if (sourceMessages.some((message) => message.call || message.callId)) return 'call';
    if (sourceMessages.some((message) => message.voomPostId || message.voomCommentId)) return 'voom';
    return sourceMessages.at(-1)?.mode === 'offline' ? 'offline' : 'online';
  }

  async function persistMemoryGraphUpserts(upserts: ReturnType<typeof integrateMemoryExtraction>) {
    await applyMemoryStoreMutation({
      put: {
        episodes: [upserts.episode],
        entities: upserts.entities,
        assertions: upserts.assertions,
        edges: upserts.edges,
        themes: upserts.themes,
        stateSnapshots: upserts.stateSnapshots
      }
    });
    memoryEpisodes.value = mergeMemoryEntities(memoryEpisodes.value, [upserts.episode]);
    memoryEntities.value = mergeMemoryEntities(memoryEntities.value, upserts.entities);
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, upserts.assertions);
    memoryEdges.value = mergeMemoryEntities(memoryEdges.value, upserts.edges);
    memoryThemes.value = mergeMemoryEntities(memoryThemes.value, upserts.themes);
    memoryStateSnapshots.value = mergeMemoryEntities(memoryStateSnapshots.value, upserts.stateSnapshots);
    const character = characterById(upserts.episode.characterId);
    const boundUser = userById(upserts.episode.userId);
    if (!character || !boundUser) return;
    const themeCandidates = upserts.themes.filter((theme) => {
      const activeCount = memoryAssertions.value.filter((assertion) =>
        theme.assertionIds.includes(assertion.id)
        && (assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed')
      ).length;
      const reportedCount = Number(theme.reportAssertionCount) || 0;
      return activeCount >= 5 && (reportedCount <= 0 || activeCount - reportedCount >= 3);
    });
    const modelOverride = upserts.episode.conversationId
      ? getMemorySummaryModelOverride(settingsForConversation(upserts.episode.conversationId))
      : '';
    if (!themeCandidates.length || !modelOverride || !hasTextGenerationConfig(settings.value ?? undefined, modelOverride)) return;
    const consolidatedThemes = [] as MemoryTheme[];
    for (const theme of themeCandidates) {
      const activeAssertions = memoryAssertions.value.filter((assertion) =>
        theme.assertionIds.includes(assertion.id)
        && (assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed')
      );
      try {
        const report = await consolidateMemoryThemeReport({
          settings: settings.value ?? undefined,
          modelOverride,
          retryTransientFailures: settingsForConversation(upserts.episode.conversationId).requestRecovery.retryTransientFailures,
          characterName: getCharacterAiName(character),
          userName: getUserAiName(boundUser),
          theme,
          assertions: activeAssertions,
        });
        const activeCount = activeAssertions.length;
        consolidatedThemes.push({ ...theme, report, reportAssertionCount: activeCount, reportUpdatedAt: Date.now(), updatedAt: Date.now() });
      } catch (error) {
        console.warn('Memory theme consolidation failed; core memory remains committed.', error);
      }
    }
    if (consolidatedThemes.length) {
      try {
        await applyMemoryStoreMutation({ put: { themes: consolidatedThemes } });
        memoryThemes.value = mergeMemoryEntities(memoryThemes.value, consolidatedThemes);
      } catch (error) {
        console.warn('Memory theme report persistence failed; core memory remains committed.', error);
      }
    }
  }

  async function persistMemoryEmbeddingsForAssertions(conversationId: string, assertions: MemoryAssertion[], embeddingModelOverride = '') {
    const memorySettings = settingsForConversation(conversationId).memory;
    const embeddingModel = embeddingModelOverride.trim();
    if (!memorySettings.embeddingEnabled || !embeddingModel || !assertions.length) return;
    const existingByOwnerId = new Map(
      memoryEmbeddings.value
        .filter((embedding) => embedding.ownerType === 'assertion')
        .map((embedding) => [embedding.ownerId, embedding])
    );
    const candidates = assertions
      .filter((assertion) => assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed')
      .map((assertion) => {
        const text = (assertion.searchText || assertion.perspectiveText).trim();
        return { assertion, text, textHash: hashMemoryText(text), existing: existingByOwnerId.get(assertion.id) };
      })
      .filter((candidate) => candidate.text && (candidate.existing?.textHash !== candidate.textHash || candidate.existing.model !== embeddingModel));
    if (!candidates.length) return;
    const vectors = await requestTextEmbeddings(
      settings.value ?? undefined,
      candidates.map((candidate) => candidate.text),
      embeddingModel
    );
    const now = Date.now();
    const embeddings = candidates.flatMap((candidate, index): MemoryEmbeddingCache[] => {
      const vector = vectors[index];
      if (!vector?.length) return [];
      return [{
        id: `${candidate.assertion.brainId}:embedding:assertion:${candidate.assertion.id}`,
        brainId: candidate.assertion.brainId,
        ownerType: 'assertion',
        ownerId: candidate.assertion.id,
        model: embeddingModel,
        dimensions: vector.length,
        textHash: candidate.textHash,
        vector,
        createdAt: candidate.existing?.createdAt ?? now,
        updatedAt: now
      }];
    });
    if (!embeddings.length) return;
    await applyMemoryStoreMutation({ put: { embeddings } });
    memoryEmbeddings.value = mergeMemoryEntities(memoryEmbeddings.value, embeddings);
  }

  function schedulePendingMemoryCaptures(brainId: string) {
    const pendingEntries = [...pendingMemoryCaptureRequests.entries()]
      .filter(([conversationId]) => memoryBrainIdForConversation(conversationId) === brainId);
    for (const [conversationId, request] of pendingEntries) {
      pendingMemoryCaptureRequests.delete(conversationId);
      queueMicrotask(() => {
        void captureConversationMemory(conversationId, { force: request.force })
          .then((episode) => {
            request.waiters.forEach((waiter) => waiter.resolve(episode));
          })
          .catch((error) => {
            request.waiters.forEach((waiter) => waiter.reject(error));
          });
      });
    }
  }

  async function captureConversationMemory(conversationId: string, options: { force?: boolean; bypassBrainLock?: boolean } = {}): Promise<MemoryEpisode | null> {
    const conversation = conversationById(conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const boundUser = conversation ? userById(conversation.userId) : null;
    if (!conversation || !character || !boundUser) return null;
    if (conversation.kind === 'group') return null;
    const brainId = createMemoryBrainId(character.id, boundUser.id);
    if (!options.bypassBrainLock && (capturingMemoryBrainIds.has(brainId) || rebuildingMemoryBrainIds.has(brainId))) {
      return new Promise<MemoryEpisode | null>((resolve, reject) => {
        const request = pendingMemoryCaptureRequests.get(conversationId) ?? { force: false, waiters: [] };
        request.force ||= Boolean(options.force);
        request.waiters.push({ resolve, reject });
        pendingMemoryCaptureRequests.set(conversationId, request);
      });
    }
    const chatSettings = settingsForConversation(conversationId);
    if (!chatSettings.memory.enabled || (!options.force && !chatSettings.memory.autoCapture)) return null;
    const modelOverride = getMemorySummaryModelOverride(chatSettings);
    if (!modelOverride) {
      if (options.force) throw new Error('请先在模型切换中配置“总结、图谱模型”。记忆不会回退使用线上或线下聊天模型。');
      return null;
    }
    const graph = memoryGraphForConversation(conversationId);
    const capturedMessageIds = new Set(
      graph.episodes
        .filter((episode) => episode.conversationId === conversationId
          && (episode.status === 'active' || (episode.status === 'forgotten' && episode.forgottenReason !== 'source-invalidated')))
        .flatMap((episode) => episode.sourceMessageIds)
    );
    const activeMessages = getConversationActiveMessages(messagesForConversation(conversationId))
      .filter((message) => message.replyVariantState !== 'inactive' && message.status !== 'failed');
    const uncapturedFloors = getConversationFloors(activeMessages)
      .map((floorMessages, index) => ({
        floor: index + 1,
        messages: floorMessages.filter((message) => Boolean(messageReadableContent(message).trim()))
      }))
      .filter((entry) => entry.messages.length && entry.messages.some((message) => !capturedMessageIds.has(message.id)));
    const threshold = Math.max(2, chatSettings.memory.captureEvery);
    if (!uncapturedFloors.length) return null;
    const firstMode = uncapturedFloors[0].messages[0]?.mode;
    const modeSegment: typeof uncapturedFloors = [];
    for (const floor of uncapturedFloors) {
      if (floor.messages[0]?.mode !== firstMode) break;
      modeSegment.push(floor);
    }
    const selectedFloors = selectMemoryCaptureFloors(modeSegment, threshold, {
      force: options.force,
      forceLimit: Math.max(12, threshold),
      segmentClosed: modeSegment.length < uncapturedFloors.length
    });
    if (!selectedFloors.length) return null;
    const sourceMessages = selectedFloors.flatMap((entry) => entry.messages);
    const sourceHash = createMemorySourceHash(sourceMessages);
    const existingEpisode = graph.episodes.find((episode) => episode.sourceHash === sourceHash
      && (episode.status === 'active' || (episode.status === 'forgotten' && episode.forgottenReason !== 'source-invalidated')));
    if (existingEpisode) return existingEpisode;
    const startFloor = selectedFloors[0].floor;
    const endFloor = selectedFloors[selectedFloors.length - 1].floor;
    const characterName = getCharacterAiName(character);
    const userName = getUserAiName(boundUser);
    capturingMemoryConversationIds.add(conversationId);
    capturingMemoryBrainIds.add(brainId);
    try {
      const captureNow = Date.now();
      const timeSnapshot = createUserTimeSnapshot(new Date(captureNow));
      const extractionQuery = sourceMessages.map((message) => messageReadableContent(message)).join('\n');
      const characterContext = buildMemoryCharacterContext(character, boundUser);
      const sourceMode = sourceMessages.at(-1)?.mode ?? conversation.activeMode;
      const worldBookContext = buildMemoryWorldBookContext(character, boundUser, sourceMode, worldBooks.value, extractionQuery);
      const relatedAssertions = recallCharacterMemory({
        ...graph,
        brainId: graph.brainId,
        query: extractionQuery,
        maxTokens: Math.min(1_200, chatSettings.memory.recallTokenBudget),
        timeAwarenessEnabled: chatSettings.timeAwareness.enabled
      }).items.map((item) => item.assertion);
      const extractionAssertionMap = new Map<string, MemoryAssertion>();
      graph.assertions
        .filter((assertion) => assertion.pinned || assertion.status === 'open')
        .sort((left, right) => right.updatedAt - left.updatedAt)
        .slice(0, 12)
        .forEach((assertion) => extractionAssertionMap.set(assertion.id, assertion));
      relatedAssertions.forEach((assertion) => extractionAssertionMap.set(assertion.id, assertion));
      const extracted = await extractTemporalMemory({
        settings: settings.value ?? undefined,
        modelOverride,
        characterName,
        characterContext,
        userName,
        worldBookContext,
        messages: sourceMessages,
        currentAssertions: [...extractionAssertionMap.values()].slice(0, 30),
        timeAwareness: chatSettings.timeAwareness,
        captureNow,
        retryTransientFailures: chatSettings.requestRecovery.retryTransientFailures
      });
      const extraction = {
        ...extracted,
        assertions: chatSettings.memory.reflectionEnabled
          ? extracted.assertions
          : extracted.assertions.filter((assertion) => assertion.epistemicKind !== 'inferred'),
        stateDeltas: chatSettings.memory.growthEnabled
          ? extracted.stateDeltas
          : extracted.stateDeltas.filter((delta) => delta.kind !== 'adaptive-personality')
      };
      const latestActiveMessages = getConversationActiveMessages(messagesForConversation(conversationId))
        .filter((message) => message.replyVariantState !== 'inactive' && message.status !== 'failed');
      if (!isMemorySourceSnapshotCurrent(sourceMessages, latestActiveMessages)) return null;
      const latestGraph = memoryGraphForConversation(conversationId);
      const latestExistingEpisode = latestGraph.episodes.find((episode) => episode.sourceHash === sourceHash
        && (episode.status === 'active' || (episode.status === 'forgotten' && episode.forgottenReason !== 'source-invalidated')));
      if (latestExistingEpisode) return latestExistingEpisode;
      const upserts = integrateMemoryExtraction({
        ...latestGraph,
        brainId: latestGraph.brainId,
        characterId: character.id,
        characterName,
        userId: boundUser.id,
        userName,
        conversationId,
        startFloor,
        endFloor,
        channel: memoryChannelForConversation(conversation, sourceMessages),
        sourceMessages,
        extraction,
        timeAwarenessEnabled: chatSettings.timeAwareness.enabled,
        timeZone: timeSnapshot.timeZone,
        now: captureNow
      });
      await persistMemoryGraphUpserts(upserts);
      if (chatSettings.memory.embeddingEnabled) {
        try {
          await persistMemoryEmbeddingsForAssertions(conversationId, upserts.assertions, getMemoryEmbeddingModelOverride(chatSettings));
        } catch (error) {
          console.warn('Memory assertion embeddings fell back to lexical recall.', error);
        }
      }
      return upserts.episode;
    } finally {
      capturingMemoryConversationIds.delete(conversationId);
      capturingMemoryBrainIds.delete(brainId);
      schedulePendingMemoryCaptures(brainId);
    }
  }

  async function updateMemoryEpisode(
    episodeId: string,
    patch: Partial<Pick<MemoryEpisode, 'title' | 'narrative' | 'location' | 'emotion'>>
  ) {
    const episode = memoryEpisodes.value.find((item) => item.id === episodeId);
    if (!episode) throw new Error('没有找到这篇日记。');
    const title = String(patch.title ?? episode.title).replace(/\s+/g, ' ').trim().slice(0, 80);
    const narrative = normalizeNarrativeText(patch.narrative ?? episode.narrative);
    if (!title || !narrative) throw new Error('日记标题和正文不能为空。');
    const now = Date.now();
    const location = String(patch.location ?? episode.location).replace(/\s+/g, ' ').trim().slice(0, 160);
    const updated: MemoryEpisode = {
      ...episode,
      title,
      narrative,
      location,
      locations: patch.location === undefined
        ? episode.locations
        : location
          ? [{ actor: 'shared-scene', source: 'manual', label: location, evidenceMessageIds: [], confidence: 1 }]
          : [],
      emotion: String(patch.emotion ?? episode.emotion).replace(/\s+/g, ' ').trim().slice(0, 120),
      manuallyEditedAt: now,
      updatedAt: now
    };
    const subject = memoryEntities.value.find((entity) => entity.brainId === episode.brainId && entity.type === 'character');
    if (!subject) throw new Error('记忆主体已不存在，无法安全保存日记修改。');
    const existingManual = memoryAssertions.value.find((assertion) => assertion.brainId === episode.brainId
      && assertion.predicate === '用户修订日记'
      && assertion.sourceEpisodeIds.includes(episode.id));
    const manualAssertion: MemoryAssertion = {
      id: existingManual?.id ?? memoryId('assertion'),
      brainId: episode.brainId,
      subjectEntityId: subject.id,
      predicate: '用户修订日记',
      objectText: title,
      kind: 'interpretation',
      status: 'current',
      epistemicKind: 'observed',
      perspectiveText: narrative,
      confidence: 1,
      importance: Math.max(0.85, episode.salience),
      emotionalWeight: Math.max(0.3, Math.abs(episode.valence)),
      relationshipImpact: 0,
      evidenceMessageIds: episode.sourceMessageIds,
      sourceEpisodeIds: [episode.id],
      themeIds: episode.themeIds,
      searchText: `${title} ${narrative} ${location} ${updated.emotion}`.trim(),
      validFrom: episode.occurredAt,
      learnedAt: existingManual?.learnedAt ?? now,
      recallCount: existingManual?.recallCount ?? 0,
      lastRecalledAt: existingManual?.lastRecalledAt,
      pinned: true,
      accessibility: 1,
      createdAt: existingManual?.createdAt ?? now,
      updatedAt: now
    };
    const contentChanged = title !== episode.title || narrative !== episode.narrative;
    const supersededAssertions = contentChanged
      ? memoryAssertions.value
          .filter((assertion) => assertion.brainId === episode.brainId
            && assertion.id !== manualAssertion.id
            && assertion.sourceEpisodeIds.length === 1
            && assertion.sourceEpisodeIds[0] === episode.id
            && (assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed'))
          .map((assertion): MemoryAssertion => ({ ...assertion, status: 'superseded', validTo: now, supersededById: manualAssertion.id, updatedAt: now }))
      : [];
    const existingEdge = memoryEdges.value.find((edge) => edge.brainId === episode.brainId
      && edge.fromId === episode.id && edge.toId === manualAssertion.id && edge.type === 'supports');
    const manualEdge: MemoryEdge = {
      id: existingEdge?.id ?? memoryId('edge'),
      brainId: episode.brainId,
      fromId: episode.id,
      toId: manualAssertion.id,
      type: 'supports',
      weight: 1,
      createdAt: existingEdge?.createdAt ?? now,
      updatedAt: now
    };
    await applyMemoryStoreMutation({
      put: { episodes: [updated], assertions: [...supersededAssertions, manualAssertion], edges: [manualEdge] }
    });
    memoryEpisodes.value = mergeMemoryEntities(memoryEpisodes.value, [updated]);
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, [...supersededAssertions, manualAssertion]);
    memoryEdges.value = mergeMemoryEntities(memoryEdges.value, [manualEdge]);
    return updated;
  }

  async function deleteMemoryEpisode(episodeId: string, options: { allowRecapture?: boolean; forgottenReason?: 'user-request' | 'source-invalidated' } = {}) {
    const episode = memoryEpisodes.value.find((item) => item.id === episodeId);
    if (!episode || episode.status === 'forgotten') return false;
    const now = Date.now();
    const sourceMessageIds = new Set(episode.sourceMessageIds);
    const relatedAssertions = memoryAssertions.value.filter((assertion) => assertion.brainId === episode.brainId
      && assertion.sourceEpisodeIds.includes(episode.id));
    const forgottenAssertionIds = new Set<string>();
    const assertionUpserts = relatedAssertions.map((assertion): MemoryAssertion => {
      const remainingEpisodeIds = assertion.sourceEpisodeIds.filter((id) => id !== episode.id);
      if (remainingEpisodeIds.length) {
        return {
          ...assertion,
          sourceEpisodeIds: remainingEpisodeIds,
          evidenceMessageIds: assertion.evidenceMessageIds.filter((id) => !sourceMessageIds.has(id)),
          updatedAt: now
        };
      }
      forgottenAssertionIds.add(assertion.id);
      return {
        ...assertion,
        predicate: '已遗忘',
        objectEntityId: undefined,
        objectText: '',
        status: 'forgotten',
        perspectiveText: '',
        confidence: 0,
        importance: 0,
        emotionalWeight: 0,
        relationshipImpact: 0,
        evidenceMessageIds: [],
        sourceEpisodeIds: [episode.id],
        themeIds: [],
        searchText: '',
        validFrom: 0,
        validTo: now,
        forgottenDedupeKey: assertion.forgottenDedupeKey || createMemoryAssertionDedupeKey(assertion),
        pinned: false,
        accessibility: 0,
        updatedAt: now
      };
    });
    const tombstone: MemoryEpisode = {
      ...episode,
      status: 'forgotten',
      forgottenAt: now,
      forgottenReason: options.forgottenReason ?? 'user-request',
      sourceTokenEstimate: 0,
      title: '已遗忘',
      narrative: '',
      location: '',
      locations: [],
      emotion: '',
      valence: 0,
      arousal: 0,
      salience: 0,
      participantEntityIds: [],
      themeIds: [],
      occurredAt: 0,
      occurredEndAt: undefined,
      temporalBasis: 'sequence-only',
      timeZone: undefined,
      generation: undefined,
      manuallyEditedAt: undefined,
      updatedAt: now
    };
    const affectedThemes = memoryThemes.value.filter((theme) => theme.brainId === episode.brainId
      && (theme.episodeIds.includes(episode.id) || theme.assertionIds.some((id) => forgottenAssertionIds.has(id))));
    const themeUpserts = affectedThemes
      .map((theme): MemoryTheme => ({
        ...theme,
        episodeIds: theme.episodeIds.filter((id) => id !== episode.id),
        assertionIds: theme.assertionIds.filter((id) => !forgottenAssertionIds.has(id)),
        report: '',
        reportAssertionCount: 0,
        reportUpdatedAt: 0,
        updatedAt: now
      }))
      .filter((theme) => theme.episodeIds.length || theme.assertionIds.length);
    const deletedThemeIds = affectedThemes
      .filter((theme) => !themeUpserts.some((updated) => updated.id === theme.id))
      .map((theme) => theme.id);
    const stateSnapshotIds = memoryStateSnapshots.value.filter((state) => state.brainId === episode.brainId
      && (state.sourceEpisodeIds.includes(episode.id) || state.sourceAssertionIds.some((id) => forgottenAssertionIds.has(id))))
      .map((state) => state.id);
    const retainedAssertions = mergeMemoryEntities(memoryAssertions.value, assertionUpserts)
      .filter((assertion) => assertion.brainId === episode.brainId && assertion.status !== 'forgotten');
    const retainedEpisodes = memoryEpisodes.value.filter((item) => item.brainId === episode.brainId
      && item.id !== episode.id && item.status === 'active');
    const referencedEntityIds = new Set([
      ...retainedAssertions.flatMap((assertion) => [assertion.subjectEntityId, assertion.objectEntityId].filter(Boolean) as string[]),
      ...retainedEpisodes.flatMap((item) => item.participantEntityIds)
    ]);
    const entityIds = memoryEntities.value.filter((entity) => entity.brainId === episode.brainId
      && entity.type !== 'character' && entity.type !== 'user'
      && !referencedEntityIds.has(entity.id)).map((entity) => entity.id);
    const cleanedThemeUpserts = themeUpserts.map((theme): MemoryTheme => ({
      ...theme,
      entityIds: theme.entityIds.filter((id) => !entityIds.includes(id))
    }));
    const edgeIds = memoryEdges.value.filter((edge) => edge.brainId === episode.brainId
      && (edge.fromId === episode.id || edge.toId === episode.id
        || forgottenAssertionIds.has(edge.fromId) || forgottenAssertionIds.has(edge.toId)
        || deletedThemeIds.includes(edge.fromId) || deletedThemeIds.includes(edge.toId)
        || entityIds.includes(edge.fromId) || entityIds.includes(edge.toId))).map((edge) => edge.id);
    const embeddingIds = memoryEmbeddings.value.filter((embedding) => embedding.brainId === episode.brainId
      && ((embedding.ownerType === 'episode' && embedding.ownerId === episode.id)
        || (embedding.ownerType === 'assertion' && forgottenAssertionIds.has(embedding.ownerId))
        || (embedding.ownerType === 'theme' && deletedThemeIds.includes(embedding.ownerId))))
      .map((embedding) => embedding.id);
    const persistedAssertionUpserts = options.allowRecapture
      ? assertionUpserts.filter((assertion) => !forgottenAssertionIds.has(assertion.id))
      : assertionUpserts;

    await applyMemoryStoreMutation({
      put: { episodes: options.allowRecapture ? [] : [tombstone], assertions: persistedAssertionUpserts, themes: cleanedThemeUpserts },
      delete: {
        episodeIds: options.allowRecapture ? [episode.id] : [],
        entityIds,
        assertionIds: options.allowRecapture ? [...forgottenAssertionIds] : [],
        edgeIds,
        themeIds: deletedThemeIds,
        stateSnapshotIds,
        embeddingIds
      }
    });
    memoryEpisodes.value = options.allowRecapture
      ? memoryEpisodes.value.filter((item) => item.id !== episode.id)
      : mergeMemoryEntities(memoryEpisodes.value, [tombstone]);
    memoryAssertions.value = mergeMemoryEntities(
      options.allowRecapture
        ? memoryAssertions.value.filter((assertion) => !forgottenAssertionIds.has(assertion.id))
        : memoryAssertions.value,
      persistedAssertionUpserts
    );
    memoryThemes.value = mergeMemoryEntities(
      memoryThemes.value.filter((theme) => !deletedThemeIds.includes(theme.id)),
      cleanedThemeUpserts
    );
    memoryEntities.value = memoryEntities.value.filter((entity) => !entityIds.includes(entity.id));
    memoryEdges.value = memoryEdges.value.filter((edge) => !edgeIds.includes(edge.id));
    memoryStateSnapshots.value = memoryStateSnapshots.value.filter((state) => !stateSnapshotIds.includes(state.id));
    memoryEmbeddings.value = memoryEmbeddings.value.filter((embedding) => !embeddingIds.includes(embedding.id));
    return true;
  }

  async function regenerateMemoryEpisode(episodeId: string) {
    const episode = memoryEpisodes.value.find((item) => item.id === episodeId);
    if (!episode) throw new Error('没有找到这篇日记。');
    if (episode.status === 'forgotten') throw new Error('这篇日记已被遗忘，不能重新激活。');
    if (!episode.sourceMessageIds.length) throw new Error('这篇手动记忆没有可用于重生成的原始楼层。');
    const conversation = conversationById(episode.conversationId);
    const character = conversation ? characterById(conversation.charId) : null;
    const boundUser = conversation ? userById(conversation.userId) : null;
    if (!conversation || !character || !boundUser) throw new Error('这篇日记绑定的角色或账号已不存在。');
    const sourceMessageIds = new Set(episode.sourceMessageIds);
    const sourceMessages = messagesForConversation(conversation.id)
      .filter((message) => sourceMessageIds.has(message.id) && message.status !== 'failed');
    if (!sourceMessages.length) throw new Error('原始楼层已不存在，无法重新生成这篇日记。');
    const chatSettings = settingsForConversation(conversation.id);
    const modelOverride = getMemorySummaryModelOverride(chatSettings);
    if (!modelOverride) throw new Error('请先在模型切换中配置“总结、图谱模型”。记忆不会回退使用线上或线下聊天模型。');
    const graph = memoryGraphForConversation(conversation.id);
    if (capturingMemoryBrainIds.has(graph.brainId) || rebuildingMemoryBrainIds.has(graph.brainId)) throw new Error('当前角色记忆正在写入，请稍后再试。');
    const characterName = getCharacterAiName(character);
    const userName = getUserAiName(boundUser);
    const extractionQuery = sourceMessages.map((message) => messageReadableContent(message)).join('\n');
    const characterContext = buildMemoryCharacterContext(character, boundUser);
    const sourceMode = sourceMessages.at(-1)?.mode ?? conversation.activeMode;
    const worldBookContext = buildMemoryWorldBookContext(character, boundUser, sourceMode, worldBooks.value, extractionQuery);
    capturingMemoryConversationIds.add(conversation.id);
    capturingMemoryBrainIds.add(graph.brainId);
    try {
      const captureNow = Date.now();
      const timeSnapshot = createUserTimeSnapshot(new Date(captureNow));
      const diary = await generateTemporalMemoryDiary({
        settings: settings.value ?? undefined,
        modelOverride,
        characterName,
        characterContext,
        userName,
        worldBookContext,
        messages: sourceMessages,
        timeAwareness: chatSettings.timeAwareness,
        captureNow,
        retryTransientFailures: chatSettings.requestRecovery.retryTransientFailures
      });
      const regenerated = integrateMemoryExtraction({
        ...graph,
        brainId: graph.brainId,
        characterId: character.id,
        characterName,
        userId: boundUser.id,
        userName,
        conversationId: conversation.id,
        startFloor: episode.startFloor,
        endFloor: episode.endFloor,
        channel: memoryChannelForConversation(conversation, sourceMessages),
        sourceMessages,
        existingEpisode: episode,
        extraction: {
          ...diary,
          entities: [],
          assertions: [],
          themes: [],
          stateDeltas: [],
          generation: {
            diaryComplete: diary.generation.complete,
            graphComplete: episode.generation?.graphComplete ?? true,
            diaryFinishReason: diary.generation.finishReason,
            graphFinishReason: episode.generation?.graphFinishReason,
            diaryOutputTokens: diary.generation.outputTokens,
            graphOutputTokens: episode.generation?.graphOutputTokens,
            repairedJson: diary.generation.repairedJson
          }
        },
        timeAwarenessEnabled: chatSettings.timeAwareness.enabled,
        timeZone: timeSnapshot.timeZone,
        now: captureNow
      });
      const regeneratedEpisode: MemoryEpisode = {
        ...regenerated.episode,
        participantEntityIds: episode.participantEntityIds,
        themeIds: episode.themeIds,
        manuallyEditedAt: undefined,
        generation: regenerated.episode.generation
          ? { ...regenerated.episode.generation, repairedJson: regenerated.episode.generation.repairedJson || Boolean(episode.generation?.repairedJson) }
          : episode.generation
      };
      const existingManual = memoryAssertions.value.find((assertion) => assertion.brainId === episode.brainId
        && assertion.predicate === '用户修订日记'
        && assertion.sourceEpisodeIds.includes(episode.id));
      const regeneratedManual = existingManual
        ? {
            ...existingManual,
            objectText: regeneratedEpisode.title,
            perspectiveText: regeneratedEpisode.narrative,
            searchText: `${regeneratedEpisode.title} ${regeneratedEpisode.narrative} ${regeneratedEpisode.location} ${regeneratedEpisode.emotion}`.trim(),
            status: 'current' as const,
            accessibility: 1,
            updatedAt: captureNow
          }
        : undefined;
      await applyMemoryStoreMutation({ put: { episodes: [regeneratedEpisode], assertions: regeneratedManual ? [regeneratedManual] : [] } });
      memoryEpisodes.value = mergeMemoryEntities(memoryEpisodes.value, [regeneratedEpisode]);
      if (regeneratedManual) memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, [regeneratedManual]);
      return regeneratedEpisode;
    } finally {
      capturingMemoryConversationIds.delete(conversation.id);
      capturingMemoryBrainIds.delete(graph.brainId);
      schedulePendingMemoryCaptures(graph.brainId);
    }
  }

  async function maybeAutoCaptureConversationMemory(conversationId: string, force = false) {
    try {
      await captureConversationMemory(conversationId, { force });
    } catch (error) {
      console.error('Temporal memory capture failed.', error);
      showConfigAlert(error instanceof Error ? error.message : '记忆生成失败。', '记忆生成失败', {
        label: '重新生成',
        runningLabel: '重新生成中…',
        run: async () => {
          const episode = await captureConversationMemory(conversationId, { force: true });
          if (!episode) throw new Error('没有找到可重新生成的未编码对话。');
        }
      });
    }
  }

  async function setMemoryAssertionPinned(assertionId: string, pinned: boolean) {
    const assertion = memoryAssertions.value.find((item) => item.id === assertionId);
    if (!assertion) return;
    const updated = { ...assertion, pinned, accessibility: pinned ? 1 : assertion.accessibility, updatedAt: Date.now() };
    await applyMemoryStoreMutation({ put: { assertions: [updated] } });
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, [updated]);
  }

  async function refreshThemesForMemoryAssertions(assertions: MemoryAssertion[]) {
    const themeIds = [...new Set(assertions.flatMap((assertion) => assertion.themeIds))];
    if (!themeIds.length) return;
    const assertionsForReport = mergeMemoryEntities(memoryAssertions.value, assertions);
    const updatedThemes = refreshMemoryThemeReports(memoryThemes.value, assertionsForReport, themeIds);
    if (!updatedThemes.length) return;
    await applyMemoryStoreMutation({ put: { themes: updatedThemes } });
    memoryThemes.value = mergeMemoryEntities(memoryThemes.value, updatedThemes);
  }

  async function forgetMemoryAssertion(assertionId: string) {
    const assertion = memoryAssertions.value.find((item) => item.id === assertionId);
    if (!assertion) return;
    const now = Date.now();
    const updated: MemoryAssertion = {
      ...assertion,
      status: 'forgotten',
      forgottenDedupeKey: assertion.forgottenDedupeKey || createMemoryAssertionDedupeKey(assertion),
      objectEntityId: undefined,
      objectText: '',
      perspectiveText: '',
      evidenceMessageIds: [],
      themeIds: [],
      searchText: '',
      pinned: false,
      accessibility: 0,
      updatedAt: now
    };
    const edgeIds = memoryEdges.value.filter((edge) => edge.brainId === assertion.brainId
      && (edge.fromId === assertion.id || edge.toId === assertion.id)).map((edge) => edge.id);
    const embeddingIds = memoryEmbeddings.value.filter((embedding) => embedding.brainId === assertion.brainId
      && embedding.ownerType === 'assertion' && embedding.ownerId === assertion.id).map((embedding) => embedding.id);
    const themesAfterAssertionRemoval = memoryThemes.value
      .filter((theme) => theme.brainId === assertion.brainId && theme.assertionIds.includes(assertion.id))
      .map((theme): MemoryTheme => ({ ...theme, assertionIds: theme.assertionIds.filter((id) => id !== assertion.id), updatedAt: now }));
    const assertionsAfterForget = mergeMemoryEntities(memoryAssertions.value, [updated]);
    const updatedThemes = refreshMemoryThemeReports(themesAfterAssertionRemoval, assertionsAfterForget, themesAfterAssertionRemoval.map((theme) => theme.id), now);
    const affectedStates = memoryStateSnapshots.value
      .filter((state) => state.brainId === assertion.brainId && state.sourceAssertionIds.includes(assertion.id));
    const updatedStates = affectedStates
      .filter((state) => state.sourceAssertionIds.some((id) => id !== assertion.id))
      .map((state): MemoryStateSnapshot => ({
        ...state,
        sourceAssertionIds: state.sourceAssertionIds.filter((id) => id !== assertion.id),
        facets: state.facets.map((facet) => ({ ...facet, evidenceAssertionIds: facet.evidenceAssertionIds.filter((id) => id !== assertion.id) }))
      }));
    const stateSnapshotIds = affectedStates
      .filter((state) => !state.sourceAssertionIds.some((id) => id !== assertion.id))
      .map((state) => state.id);
    await applyMemoryStoreMutation({
      put: { assertions: [updated], themes: updatedThemes, stateSnapshots: updatedStates },
      delete: { edgeIds, stateSnapshotIds, embeddingIds }
    });
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, [updated]);
    memoryThemes.value = mergeMemoryEntities(memoryThemes.value, updatedThemes);
    memoryStateSnapshots.value = mergeMemoryEntities(
      memoryStateSnapshots.value.filter((state) => !stateSnapshotIds.includes(state.id)),
      updatedStates
    );
    memoryEdges.value = memoryEdges.value.filter((edge) => !edgeIds.includes(edge.id));
    memoryEmbeddings.value = memoryEmbeddings.value.filter((embedding) => !embeddingIds.includes(embedding.id));
  }

  async function correctMemoryAssertion(assertionId: string, correctedText: string) {
    const previous = memoryAssertions.value.find((item) => item.id === assertionId);
    const text = correctedText.replace(/\s+/g, ' ').trim();
    if (!previous || !text) return null;
    if (previous.status === 'forgotten') throw new Error('已遗忘的记忆不能直接纠正，请先创建新的明确记忆。');
    const now = Date.now();
    const perspectiveText = /(^|[，。！？\s])我/.test(text) ? text : `我现在记得：${text}`;
    const episode: MemoryEpisode = {
      id: memoryId('episode'),
      brainId: previous.brainId,
      characterId: previous.brainId.split(':')[1] ?? '',
      userId: previous.brainId.split(':')[2] ?? '',
      conversationId: memoryEpisodes.value.find((item) => item.id === previous.sourceEpisodeIds[0])?.conversationId ?? '',
      channel: 'system',
      status: 'active',
      sourceMessageIds: [],
      sourceHash: '',
      startFloor: 0,
      endFloor: 0,
      sourceTokenEstimate: 0,
      title: '我修正了一条记忆',
      narrative: perspectiveText,
      location: '',
      emotion: '',
      valence: 0,
      arousal: 0.2,
      salience: Math.max(0.7, previous.importance),
      participantEntityIds: [previous.subjectEntityId, ...(previous.objectEntityId ? [previous.objectEntityId] : [])],
      themeIds: [...previous.themeIds],
      occurredAt: now,
      occurredEndAt: now,
      learnedAt: now,
      createdAt: now,
      updatedAt: now
    };
    const corrected: MemoryAssertion = {
      ...previous,
      id: memoryId('assertion'),
      status: 'current',
      epistemicKind: 'told',
      perspectiveText,
      objectText: text,
      confidence: 1,
      evidenceMessageIds: [],
      sourceEpisodeIds: [episode.id],
      validFrom: now,
      validTo: undefined,
      learnedAt: now,
      supersededById: undefined,
      recallCount: 0,
      lastRecalledAt: undefined,
      pinned: previous.pinned,
      accessibility: 1,
      createdAt: now,
      updatedAt: now,
      searchText: `${previous.predicate} ${text} ${perspectiveText}`
    };
    const superseded: MemoryAssertion = { ...previous, status: 'superseded', supersededById: corrected.id, validTo: now, updatedAt: now };
    const edges: MemoryEdge[] = [
      {
        id: memoryId('edge'),
        brainId: previous.brainId,
        fromId: corrected.id,
        toId: previous.id,
        type: 'supersedes',
        weight: 1,
        createdAt: now,
        updatedAt: now
      },
      {
        id: memoryId('edge'),
        brainId: previous.brainId,
        fromId: episode.id,
        toId: corrected.id,
        type: 'supports',
        weight: 1,
        createdAt: now,
        updatedAt: now
      },
      ...corrected.themeIds.map((themeId): MemoryEdge => ({
        id: memoryId('edge'),
        brainId: previous.brainId,
        fromId: themeId,
        toId: corrected.id,
        type: 'contains',
        weight: 1,
        createdAt: now,
        updatedAt: now
      }))
    ];
    const updatedThemes = memoryThemes.value
      .filter((theme) => corrected.themeIds.includes(theme.id))
      .map((theme) => ({
        ...theme,
        assertionIds: [...new Set([...theme.assertionIds, corrected.id])],
        episodeIds: [...new Set([...theme.episodeIds, episode.id])],
        updatedAt: now
      }));
    await applyMemoryStoreMutation({
      put: { episodes: [episode], assertions: [superseded, corrected], edges, themes: updatedThemes }
    });
    memoryEpisodes.value = mergeMemoryEntities(memoryEpisodes.value, [episode]);
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, [superseded, corrected]);
    memoryEdges.value = mergeMemoryEntities(memoryEdges.value, edges);
    memoryThemes.value = mergeMemoryEntities(memoryThemes.value, updatedThemes);
    await refreshThemesForMemoryAssertions([corrected]);
    if (episode.conversationId) {
      try {
        const chatSettings = settingsForConversation(episode.conversationId);
        await persistMemoryEmbeddingsForAssertions(
          episode.conversationId,
          [corrected],
          getMemoryEmbeddingModelOverride(chatSettings)
        );
      } catch (error) {
        console.warn('Corrected memory embedding fell back to lexical recall.', error);
      }
    }
    return corrected;
  }

  async function clearMemoryBrainData(brainId: string) {
    if (!brainId) return 0;
    const episodes = memoryEpisodes.value.filter((item) => item.brainId === brainId);
    const entities = memoryEntities.value.filter((item) => item.brainId === brainId);
    const assertions = memoryAssertions.value.filter((item) => item.brainId === brainId);
    const edges = memoryEdges.value.filter((item) => item.brainId === brainId);
    const themes = memoryThemes.value.filter((item) => item.brainId === brainId);
    const stateSnapshots = memoryStateSnapshots.value.filter((item) => item.brainId === brainId);
    const embeddings = memoryEmbeddings.value.filter((item) => item.brainId === brainId);
    await applyMemoryStoreMutation({
      delete: {
        episodeIds: episodes.map((item) => item.id),
        entityIds: entities.map((item) => item.id),
        assertionIds: assertions.map((item) => item.id),
        edgeIds: edges.map((item) => item.id),
        themeIds: themes.map((item) => item.id),
        stateSnapshotIds: stateSnapshots.map((item) => item.id),
        embeddingIds: embeddings.map((item) => item.id)
      }
    });
    memoryEpisodes.value = memoryEpisodes.value.filter((item) => item.brainId !== brainId);
    memoryEntities.value = memoryEntities.value.filter((item) => item.brainId !== brainId);
    memoryAssertions.value = memoryAssertions.value.filter((item) => item.brainId !== brainId);
    memoryEdges.value = memoryEdges.value.filter((item) => item.brainId !== brainId);
    memoryThemes.value = memoryThemes.value.filter((item) => item.brainId !== brainId);
    memoryStateSnapshots.value = memoryStateSnapshots.value.filter((item) => item.brainId !== brainId);
    memoryEmbeddings.value = memoryEmbeddings.value.filter((item) => item.brainId !== brainId);
    return episodes.length + entities.length + assertions.length + edges.length + themes.length + stateSnapshots.length + embeddings.length;
  }

  async function restoreMemoryBrainData(graph: PersistableMemoryGraph) {
    await applyMemoryStoreMutation({
      put: {
        episodes: graph.episodes,
        entities: graph.entities,
        assertions: graph.assertions,
        edges: graph.edges,
        themes: graph.themes,
        stateSnapshots: graph.stateSnapshots,
        embeddings: graph.embeddings
      }
    });
    memoryEpisodes.value = mergeMemoryEntities(memoryEpisodes.value, graph.episodes);
    memoryEntities.value = mergeMemoryEntities(memoryEntities.value, graph.entities);
    memoryAssertions.value = mergeMemoryEntities(memoryAssertions.value, graph.assertions);
    memoryEdges.value = mergeMemoryEntities(memoryEdges.value, graph.edges);
    memoryThemes.value = mergeMemoryEntities(memoryThemes.value, graph.themes);
    memoryStateSnapshots.value = mergeMemoryEntities(memoryStateSnapshots.value, graph.stateSnapshots);
    memoryEmbeddings.value = mergeMemoryEntities(memoryEmbeddings.value, graph.embeddings);
  }

  async function rollbackMemoryBrainData(graph: PersistableMemoryGraph, error: unknown, operation: string): Promise<never> {
    try {
      await clearMemoryBrainData(graph.brainId);
      await restoreMemoryBrainData(graph);
    } catch (restoreError) {
      console.error(`${operation} rollback failed.`, restoreError);
      const originalMessage = error instanceof Error ? error.message : '记忆生成失败。';
      const restoreMessage = restoreError instanceof Error ? restoreError.message : '原记忆恢复失败。';
      throw new Error(`${originalMessage}\n\n原记忆恢复失败：${restoreMessage}`);
    }
    throw error;
  }

  function preservedMemoryGraphForRebuild(graph: ReturnType<typeof memoryGraphForConversation>): PersistableMemoryGraph {
    const now = Date.now();
    const episodes = graph.episodes
      .filter((episode) => episode.status === 'forgotten' || episode.channel === 'system' || Boolean(episode.manuallyEditedAt))
      .map((episode): MemoryEpisode => episode.status === 'forgotten'
        ? {
            ...episode,
            sourceTokenEstimate: 0,
            title: '已遗忘',
            narrative: '',
            location: '',
            locations: [],
            emotion: '',
            valence: 0,
            arousal: 0,
            salience: 0,
            participantEntityIds: [],
            themeIds: [],
            occurredAt: 0,
            occurredEndAt: 0,
            temporalBasis: 'sequence-only',
            timeZone: undefined,
            generation: undefined,
            manuallyEditedAt: undefined,
            forgottenAt: episode.forgottenAt ?? now,
            updatedAt: now
          }
        : { ...episode, occurredEndAt: episode.occurredEndAt ?? 0 });
    const preservedEpisodeIds = new Set(episodes.map((episode) => episode.id));
    const assertions = graph.assertions
      .filter((assertion) => assertion.status === 'forgotten'
        || assertion.sourceEpisodeIds.some((id) => preservedEpisodeIds.has(id)))
      .map((assertion): MemoryAssertion => assertion.status === 'forgotten'
        ? {
            ...assertion,
            predicate: '已遗忘',
            objectEntityId: undefined,
            objectText: '',
            perspectiveText: '',
            confidence: 0,
            importance: 0,
            emotionalWeight: 0,
            relationshipImpact: 0,
            evidenceMessageIds: [],
            themeIds: [],
            searchText: '',
            validFrom: 0,
            forgottenDedupeKey: assertion.forgottenDedupeKey || createMemoryAssertionDedupeKey(assertion),
            pinned: false,
            accessibility: 0,
            updatedAt: now
          }
        : assertion);
    const assertionIds = new Set(assertions.map((assertion) => assertion.id));
    const activeAssertionIds = new Set(assertions.filter((assertion) => assertion.status !== 'forgotten').map((assertion) => assertion.id));
    const activeEpisodeIds = new Set(episodes.filter((episode) => episode.status === 'active').map((episode) => episode.id));
    const themes = graph.themes
      .map((theme): MemoryTheme => ({
        ...theme,
        assertionIds: theme.assertionIds.filter((id) => activeAssertionIds.has(id)),
        episodeIds: theme.episodeIds.filter((id) => activeEpisodeIds.has(id))
      }))
      .filter((theme) => theme.assertionIds.length || theme.episodeIds.length);
    const themeIds = new Set(themes.map((theme) => theme.id));
    const referencedEntityIds = new Set([
      ...assertions.flatMap((assertion) => [assertion.subjectEntityId, assertion.objectEntityId].filter(Boolean) as string[]),
      ...episodes.flatMap((episode) => episode.participantEntityIds),
      ...themes.flatMap((theme) => theme.entityIds)
    ]);
    const entities = graph.entities.filter((entity) => entity.type === 'character' || entity.type === 'user' || referencedEntityIds.has(entity.id));
    const entityIds = new Set(entities.map((entity) => entity.id));
    const nodeIds = new Set([...preservedEpisodeIds, ...assertionIds, ...themeIds, ...entityIds]);
    const edges = graph.edges.filter((edge) => nodeIds.has(edge.fromId) && nodeIds.has(edge.toId));
    const stateSnapshots = graph.stateSnapshots
      .map((state) => ({
        ...state,
        sourceAssertionIds: state.sourceAssertionIds.filter((id) => activeAssertionIds.has(id)),
        sourceEpisodeIds: state.sourceEpisodeIds.filter((id) => activeEpisodeIds.has(id))
      }))
      .filter((state) => state.sourceAssertionIds.length > 0 || state.sourceEpisodeIds.length > 0);
    const embeddings = graph.embeddings.filter((embedding) =>
      (embedding.ownerType === 'assertion' && assertionIds.has(embedding.ownerId))
      || (embedding.ownerType === 'episode' && preservedEpisodeIds.has(embedding.ownerId))
      || (embedding.ownerType === 'theme' && themeIds.has(embedding.ownerId)));
    return { brainId: graph.brainId, episodes, entities, assertions, edges, themes, stateSnapshots, embeddings };
  }

  async function rebuildCharacterMemory(conversationId: string) {
    const graph = memoryGraphForConversation(conversationId);
    if (!graph.brainId) return 0;
    if (capturingMemoryBrainIds.has(graph.brainId) || rebuildingMemoryBrainIds.has(graph.brainId)) {
      throw new Error('当前角色记忆正在写入，请稍后再试。');
    }
    const preservedGraph = preservedMemoryGraphForRebuild(graph);
    rebuildingMemoryBrainIds.add(graph.brainId);
    try {
      await clearMemoryBrainData(graph.brainId);
      await restoreMemoryBrainData(preservedGraph);
      const sourceConversations = conversations.value
        .filter((conversation) => memoryBrainIdForConversation(conversation.id) === graph.brainId)
        .sort((left, right) => left.updatedAt - right.updatedAt);
      let captured = 0;
      for (const conversation of sourceConversations) {
        while (true) {
          const episode = await captureConversationMemory(conversation.id, { force: true, bypassBrainLock: true });
          if (!episode) break;
          captured += 1;
        }
      }
      return captured;
    } catch (error) {
      await rollbackMemoryBrainData(graph, error, 'Memory rebuild');
    } finally {
      rebuildingMemoryBrainIds.delete(graph.brainId);
      schedulePendingMemoryCaptures(graph.brainId);
    }
  }

  async function requestRoleplayReply(conversationId: string, options?: RequestRoleplayReplyOptions) {
    const conversation = conversationById(conversationId);
    if (!conversation || isConversationReplying(conversationId)) return;
    const character = characterById(conversation.charId);
    if (!character) return;
    const relationshipStatus = getFriendRelationship(character).status;
    const isCharacterReapplyEvent = options?.relationshipEvent === 'character-reapply'
      && ['blocked-by-user', 'deleted-by-user'].includes(relationshipStatus);
    const isBlockedInteraction = Boolean(options?.blockedInteraction && relationshipStatus !== 'friend');
    if (relationshipStatus !== 'friend' && relationshipStatus !== 'pending-user-request' && !isCharacterReapplyEvent && !isBlockedInteraction) return;
    const boundUser = userById(conversation.userId || character.boundUserId) ?? user.value;
    if (!boundUser) return;

    const chatSettings = settingsForConversation(conversationId);
    const modelOverride = getConversationTextModelOverride(chatSettings, conversation.activeMode);
    if (!hasConfiguredTextModel(modelOverride)) {
      if (!options?.proactive) {
        showConfigAlert('请先在设置或聊天菜单里配置可用的线上/线下聊天 API 模型，再让角色回复。', '需要配置 API 模型');
      }
      return;
    }

    const replyRunId = startConversationReply(conversationId);
    if (!replyRunId) return;
    const replyCancelVersion = replyCancelVersions.get(conversationId) ?? 0;
    const generationStartedAt = Date.now();
    if (conversation.activeMode === 'online' && conversation.kind !== 'group') {
      scheduleCharacterReadReceipt(conversationId, generationStartedAt);
    }
    try {
      if (chatSettings.stickerVisionEnabled) {
        await localizeRecentStickerMessagesForVision(conversationId);
      }
      const availableCharacterStickers = stickersForGroups(chatSettings.characterStickerGroupIds);
      const replyInputBundle = options?.preparedReplyInput ?? await buildRoleplayReplyInputForConversation(conversationId, {
        timeAwarenessNow: generationStartedAt,
        proactive: options?.proactive,
        replyInstruction: options?.replyInstruction,
        excludeSourceMessageIds: options?.excludeSourceMessageIds
      });
      if (!replyInputBundle) return;
      const mcpOperationMessageIds = new Map<string, string>();
      const publishMcpOperation = async (operation: ChatMcpOperation) => {
        const existingMessageId = mcpOperationMessageIds.get(operation.id);
        const nextMessage: ChatMessage = {
          id: existingMessageId ?? createId('msg'),
          conversationId,
          sender: 'system',
          authorType: 'system',
          authorName: `${getCharacterAiName(character)} · MCP`,
          mode: conversation.activeMode,
          content: formatChatMcpOperation(operation),
          mcpOperations: [operation],
          replyBatchId: existingMessageId ? undefined : createId('mcp_turn'),
          createdAt: operation.requestedAt,
          status: 'sent'
        };
        if (existingMessageId) {
          const existingIndex = messages.value.findIndex((message) => message.id === existingMessageId);
          if (existingIndex >= 0) messages.value[existingIndex] = nextMessage;
        } else {
          mcpOperationMessageIds.set(operation.id, nextMessage.id);
          messages.value.push(nextMessage);
        }
        await putEntity('messages', nextMessage);
      };
      replyInputBundle.input.onMcpOperation = publishMcpOperation;
      const replyPayload = options?.generatedReplyPayload ?? await generateRoleplayReply(replyInputBundle.input);
      if (isReplyRunCancelled(conversationId, replyCancelVersion)) return [];
      const parsedReply = JSON.parse(replyPayload) as RoleplayReplyResult;
      for (const operation of parsedReply.mcpOperations ?? []) {
        if (!mcpOperationMessageIds.has(operation.id)) await publishMcpOperation(operation);
      }
      const apiTrace = parsedReply.apiTrace;
      const mcpResultAttachments = normalizeMcpResultAttachments(parsedReply.mcpResults);
      const replyBatchId = createId('reply');
      const replyVariantFields = options?.replyVariantGroupId
        ? {
          replyVariantGroupId: options.replyVariantGroupId,
          replyVariantIndex: Math.max(0, Math.floor(Number(options.replyVariantIndex) || 0)),
          replyVariantState: 'active' as const
        }
        : {};
      const callFields = options?.callSession
        ? {
          callId: options.callSession.callId,
          callMode: options.callSession.mode
        }
        : {};
      const gobangFields = options?.gobangSession
        ? { gobangId: options.gobangSession.gameId }
        : {};
      const forceCallVoice = Boolean(options?.callSession?.forceVoice);
      const replyTexts = Array.isArray(parsedReply.replies) ? parsedReply.replies : [parsedReply.reply];
      const replyTranslations = Array.isArray(parsedReply.replyTranslations) ? parsedReply.replyTranslations : [];
      const replyMessages = replyTexts
        .map((reply, index) => ({
          content: String(reply ?? '').trim(),
          translation: conversation.activeMode === 'online' ? normalizeTranslationText(replyTranslations[index]) : ''
        }))
        .filter((reply) => Boolean(reply.content));
      const plotChoices = conversation.activeMode === 'offline'
        ? [...new Set((parsedReply.plotChoices ?? []).map((choice) => String(choice ?? '').trim()).filter(Boolean))].slice(0, 6)
        : [];
      const orderedSegments = Array.isArray(parsedReply.segments)
        ? parsedReply.segments
          .flatMap((segment): RoleplayReplySegment[] => {
            if (segment.type === 'reply') {
              const content = String(segment.content ?? '').trim();
              if (!content) return [];
              const translation = conversation.activeMode === 'online' ? normalizeTranslationText(segment.translation) : '';
              return [{ type: 'reply', content, ...(translation ? { translation } : {}) }];
            }
            if (segment.type === 'narration') {
              if (conversation.activeMode !== 'online' || !chatSettings.narrationModeEnabled) return [];
              const content = String(segment.content ?? '').trim();
              return content ? [{ type: 'narration', content }] : [];
            }
            if (segment.type === 'sticker') {
              const stickers = Array.isArray(segment.stickers) ? segment.stickers.map((sticker) => String(sticker ?? '').trim()).filter(Boolean) : [];
              return stickers.length ? [{ type: 'sticker', stickers }] : [];
            }
            if (segment.type === 'image') {
              const description = String(segment.description ?? '').trim();
              const generationPrompt = String(segment.generationPrompt ?? '').trim();
              return description ? [{ type: 'image', description, ...(generationPrompt ? { generationPrompt } : {}) }] : [];
            }
            if (segment.type === 'voice') {
              const content = String(segment.content ?? '').trim();
              const translation = conversation.activeMode === 'online' ? normalizeTranslationText(segment.translation) : '';
              const duration = Number(segment.duration);
              return content ? [{ type: 'voice', content, ...(translation ? { translation } : {}), ...(Number.isFinite(duration) && duration > 0 ? { duration } : {}) }] : [];
            }
            if (segment.type === 'location') {
              const location = normalizeLocationAttachment({
                name: String(segment.name ?? '').trim(),
                address: String(segment.address ?? '').trim() || undefined,
                distance: String(segment.distance ?? '').trim()
              });
              return location ? [{ type: 'location', ...location }] : [];
            }
            if (segment.type === 'transfer') {
              const transfer = normalizeTransferAttachment({ amount: segment.amount, note: segment.note });
              return transfer ? [{ type: 'transfer', amount: transfer.amount, ...(transfer.note ? { note: transfer.note } : {}) }] : [];
            }
            if (segment.type === 'commerce') {
              const commerce = normalizeCommerceAttachment(segment, character);
              return commerce ? [{ type: 'commerce', kind: commerce.kind, storeName: commerce.storeName, items: commerce.items, totalAmount: commerce.totalAmount, ...(commerce.eta ? { eta: commerce.eta } : {}), ...(commerce.note ? { note: commerce.note } : {}), ...(commerce.cardMessage ? { cardMessage: commerce.cardMessage } : {}) }] : [];
            }
            if (segment.type === 'music_action') {
              const actionIndex = Number(segment.actionIndex);
              return [{ type: 'music_action', ...(Number.isFinite(actionIndex) && actionIndex >= 0 ? { actionIndex: Math.floor(actionIndex) } : {}) }];
            }
            return [];
          })
          .slice(0, 12)
        : [];
      const replyImages = (parsedReply.images ?? [])
        .map((image) => ({
          description: String(image.description ?? '').trim(),
          generationPrompt: String(image.generationPrompt ?? '').trim()
        }))
        .filter((image) => image.description)
        .slice(0, 3);
      const narrationMessages = conversation.activeMode === 'online' && chatSettings.narrationModeEnabled
        ? (parsedReply.narrations ?? [])
          .map((narration) => String(narration ?? '').trim())
          .filter(Boolean)
          .slice(0, 5)
        : [];
      const replyStickers = resolveCharacterStickerSelections(parsedReply.stickers, availableCharacterStickers);
      const replyStickerPlacements = (parsedReply.stickerPlacements ?? [])
        .map((placement) => {
          const rawReplyIndex = Number(placement.replyIndex);
          const replyIndex = Number.isFinite(rawReplyIndex)
            ? Math.min(Math.max(0, Math.floor(rawReplyIndex)), Math.max(0, replyMessages.length - 1))
            : 0;
          const position = placement.position === 'before' ? 'before' : 'after';
          const stickers = resolveCharacterStickerSelections(placement.stickers, availableCharacterStickers);
          return { replyIndex, position, stickers };
        })
        .filter((placement) => placement.stickers.length);
      const orderedReplyMessages = orderedSegments.filter((segment): segment is Extract<RoleplayReplySegment, { type: 'reply' }> => segment.type === 'reply');
      const effectiveReplyMessages = orderedSegments.length ? orderedReplyMessages : replyMessages;
      const hasOrderedSticker = orderedSegments.some((segment) => segment.type === 'sticker'
        && resolveCharacterStickerSelections(segment.stickers, availableCharacterStickers).length);
      const hasOrderedNarration = orderedSegments.some((segment) => segment.type === 'narration');
      const hasOrderedImage = orderedSegments.some((segment) => segment.type === 'image' && segment.description.trim());
      const hasOrderedVoice = orderedSegments.some((segment) => segment.type === 'voice' && segment.content.trim());
      const hasOrderedLocation = orderedSegments.some((segment) => segment.type === 'location' && segment.name.trim() && segment.distance.trim());
      const hasOrderedTransfer = orderedSegments.some((segment) => segment.type === 'transfer' && normalizeTransferAttachment({ amount: segment.amount, note: segment.note }));
      const hasOrderedCommerce = orderedSegments.some((segment) => segment.type === 'commerce' && normalizeCommerceAttachment(segment, character));
      const hasOrderedMusicAction = orderedSegments.some((segment) => segment.type === 'music_action');
      const recallMessageIds = parsedReply.messageActions?.recallMessageIds ?? [];
      const validRecallMessageIds = recallMessageIds.filter((messageId) => messages.value.some((message) => message.id === messageId && message.conversationId === conversationId && message.sender === 'char'));
      const validTransferDecisions = (parsedReply.messageActions?.transferDecisions ?? [])
        .map((decision) => ({
          messageId: String(decision.messageId ?? '').trim(),
          status: decision.status === 'accepted' ? 'accepted' as const : decision.status === 'rejected' ? 'rejected' as const : null
        }))
        .filter((decision): decision is { messageId: string; status: 'accepted' | 'rejected' } => Boolean(decision.messageId && decision.status && messages.value.some((message) => message.id === decision.messageId && message.conversationId === conversationId && message.sender === 'user' && message.transfer?.status === 'pending')));
      const validMusicListenInviteDecisions = (parsedReply.messageActions?.musicListenInviteDecisions ?? [])
        .map((decision) => ({
          messageId: String(decision.messageId ?? '').trim(),
          status: decision.status === 'accepted' ? 'accepted' as const : decision.status === 'rejected' ? 'rejected' as const : null
        }))
        .filter((decision): decision is { messageId: string; status: 'accepted' | 'rejected' } => Boolean(decision.messageId && decision.status && messages.value.some((message) => message.id === decision.messageId && message.conversationId === conversationId && message.sender === 'user' && message.musicListenInvite?.status === 'pending')));
      const musicListenInvite = conversation.activeMode === 'online'
        ? normalizeMusicListenInviteAttachment({
          note: parsedReply.messageActions?.musicListenInvite?.note,
          track: await resolveMusicTrackFromAction(parsedReply.messageActions?.musicListenInvite) ?? undefined
        })
        : null;
      const canSendMusicListenInvite = Boolean(musicListenInvite && (musicListenInvite.note || musicListenInvite.track));
      const offlineInvitation = conversation.activeMode === 'online' && chatSettings.offlineInvitationEnabled
        ? normalizeOfflineInvitationAttachment(parsedReply.messageActions?.offlineInvitation?.prompt ?? '')
        : null;
      const callInvite = conversation.activeMode === 'online' ? parsedReply.messageActions?.callInvite ?? null : null;
      const callResponse = conversation.activeMode === 'online' ? parsedReply.messageActions?.callResponse ?? null : null;
      const hasOpenGobang = messages.value.some((message) => {
        const game = message.conversationId === conversationId ? message.gobang : null;
        if (!game) return false;
        const invitationStatus = game.invitationStatus ?? 'accepted';
        return invitationStatus === 'pending' || (invitationStatus === 'accepted' && game.status === 'active');
      });
      const gobangInvite = conversation.activeMode === 'online' && !options?.gobangSession && !hasOpenGobang ? parsedReply.messageActions?.gobangInvite ?? null : null;
      const gobangResponse = conversation.activeMode === 'online' ? parsedReply.messageActions?.gobangResponse ?? null : null;
      const relationshipAction = conversation.activeMode === 'online' ? parsedReply.messageActions?.relationshipAction ?? null : null;
      const directCallResponseTargetMessage = findOutgoingCallResponseTarget(conversationId, options?.callResponseTargetMessageId);
      if (options?.callResponseTargetMessageId && directCallResponseTargetMessage?.call?.status !== 'ringing') {
        return [];
      }
      const callResponseTargetMessage = callResponse
        ? directCallResponseTargetMessage ?? findPendingOutgoingCallMessage(conversationId, options?.callResponseTargetMessageId)
        : null;
      const gobangResponseTargetMessage = gobangResponse
        ? findPendingOutgoingGobangMessage(conversationId, options?.gobangResponseTargetMessageId)
        : null;
      if (options?.gobangResponseTargetMessageId && !gobangResponseTargetMessage) return [];
      const quoteByReplyIndex = new Map<number, ChatMessageQuote>();
      for (const quoteAction of parsedReply.messageActions?.quotes ?? []) {
        const targetMessage = messages.value.find((message) => message.id === quoteAction.messageId && message.conversationId === conversationId && message.sender !== 'system');
        const quote = targetMessage ? createMessageQuoteSnapshot(targetMessage) : null;
        if (quote) quoteByReplyIndex.set(Math.max(0, Math.floor(quoteAction.replyIndex)), quote);
      }
      if (!effectiveReplyMessages.length && !replyStickers.length && !replyImages.length && !narrationMessages.length && !mcpResultAttachments.length && !hasOrderedSticker && !hasOrderedNarration && !hasOrderedImage && !hasOrderedVoice && !hasOrderedLocation && !hasOrderedTransfer && !hasOrderedCommerce && !hasOrderedMusicAction && !validRecallMessageIds.length && !validTransferDecisions.length && !validMusicListenInviteDecisions.length && !canSendMusicListenInvite && !(parsedReply.messageActions?.musicActions ?? []).length && !offlineInvitation && !callInvite && !callResponseTargetMessage && !gobangInvite && !gobangResponseTargetMessage && !relationshipAction) {
        showConfigAlert('AI 返回内容中没有可显示的聊天文本，请重试或检查模型输出格式。', '回复异常');
        return;
      }
      const profileUpdate = parsedReply.profileUpdate;
      if (profileUpdate && (profileUpdate.nickname || profileUpdate.signature)) {
        const nextCharacter = normalizeCharacterProfile({
          ...character,
          nickname: profileUpdate.nickname || character.nickname,
          signature: profileUpdate.signature || character.signature,
          subtitle: profileUpdate.signature || character.subtitle
        }, character.boundUserId);
        await saveCharacter(nextCharacter);
      }
      if (conversation.activeMode === 'online' && profileUpdate) {
        const activeProfileTheme = replyInputBundle.activeProfileTheme;
        const returnedThemeId = String(profileUpdate.profileThemeId ?? '').trim();
        const profileTheme = activeProfileTheme && (!returnedThemeId || returnedThemeId === activeProfileTheme.id)
          ? activeProfileTheme
          : null;
        if (profileTheme) await updateCharacterMindState(character.id, profileUpdate.innerMonologue ?? [], conversationId, {
          replyBatchId,
          profileTheme,
          profileThemeContent: profileUpdate.profileThemeContent
        });
      }
      for (const messageId of validRecallMessageIds) {
        await recallMessage(messageId, { actor: 'char', replyBatchId });
      }
      for (const decision of validTransferDecisions) {
        await updateTransferStatus(decision.messageId, decision.status, 'char', replyBatchId);
      }
      for (const decision of validMusicListenInviteDecisions) {
        await updateMusicListenInviteStatus(decision.messageId, decision.status, 'char');
      }
      if (callResponse && callResponseTargetMessage) {
        const status = callStatusFromResponse(callResponse.status);
        const respondedAt = Date.now();
        await updateCallEventMessage(callResponseTargetMessage.id, {
          status,
          connectedAt: status === 'accepted' ? respondedAt : undefined,
          endedAt: status === 'accepted' ? undefined : respondedAt
        });
      }
      if (gobangResponse && gobangResponseTargetMessage) {
        await updateGobangInvitationStatus(gobangResponseTargetMessage.id, gobangStatusFromResponse(gobangResponse.status));
      }
      const musicActionNotices = await applyCharacterMusicActions(conversationId, parsedReply.messageActions?.musicActions ?? []);
      const createdAt = Date.now();
      const charNarrationMessages = narrationMessages.map((content, index) => ({
        id: createId('msg'),
        conversationId,
        sender: 'system' as const,
        mode: conversation.activeMode,
        content,
        createdAt: createdAt + index,
        displayStyle: 'narration' as const,
        replyBatchId,
        ...replyVariantFields,
        ...callFields,
        ...gobangFields,
        status: 'sent' as const
      } satisfies ChatMessage));
      const charMessagesAfterNarration: ChatMessage[] = [];
      const orderedCharMessages: ChatMessage[] = [];
      let charMessageOffset = orderedSegments.length ? 0 : charNarrationMessages.length;
      let orderedReplyIndex = 0;
      const createStickerMessages = (stickersToSend: Sticker[]) => stickersToSend.map((sticker) => ({
        id: createId('msg'),
        conversationId,
        sender: 'char' as const,
        mode: conversation.activeMode,
        content: `[Sticker] ${sticker.description}`,
        sticker: {
          stickerId: sticker.id,
          description: sticker.description,
          imageUrl: sticker.imageUrl,
          cachedImageUrl: sticker.cachedImageUrl
        },
        replyBatchId,
        ...replyVariantFields,
        ...callFields,
        ...gobangFields,
        createdAt: createdAt + charMessageOffset++,
        status: 'sent' as const
      } satisfies ChatMessage));
      const appendStickerMessages = (stickersToSend: Sticker[]) => {
        charMessagesAfterNarration.push(...createStickerMessages(stickersToSend));
      };
      const appendOrderedStickerMessages = (stickersToSend: Sticker[]) => {
        orderedCharMessages.push(...createStickerMessages(stickersToSend));
      };
      const createImageMessage = async (description: string, generationPrompt = '') => {
        const image = await createCharacterImageAttachment(description, generationPrompt, character.id);
        if (!image) return null;
        return {
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: conversation.activeMode,
          content: `[图片] ${image.description}`,
          image,
          replyBatchId,
          ...replyVariantFields,
          ...callFields,
          ...gobangFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage;
      };
      const createVoiceMessage = (content: string, duration?: number, translation?: string, quote?: ChatMessageQuote) => ({
        id: createId('msg'),
        conversationId,
        sender: 'char' as const,
        mode: conversation.activeMode,
        content: `[语音] ${content}`,
        translation: translation || undefined,
        quote,
        voice: {
          source: 'text' as const,
          transcript: content,
          duration: estimateVoiceDuration(content, duration)
        },
        replyBatchId,
        ...replyVariantFields,
        ...callFields,
        ...gobangFields,
        createdAt: createdAt + charMessageOffset++,
        status: 'sent' as const
      } satisfies ChatMessage);
      const createTextReplyMessage = (content: string, translation?: string, quote?: ChatMessageQuote) => {
        if (forceCallVoice) return createVoiceMessage(content, undefined, translation, quote);
        return {
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: conversation.activeMode,
          content,
          translation: translation || undefined,
          quote,
          replyBatchId,
          ...replyVariantFields,
          ...callFields,
          ...gobangFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage;
      };
      const createLocationMessage = (location: ChatLocationAttachment) => ({
        id: createId('msg'),
        conversationId,
        sender: 'char' as const,
        mode: conversation.activeMode,
        content: formatLocationContent(location),
        location,
        replyBatchId,
        ...replyVariantFields,
        ...callFields,
        ...gobangFields,
        createdAt: createdAt + charMessageOffset++,
        status: 'sent' as const
      } satisfies ChatMessage);
      const createTransferMessage = (transfer: Pick<ChatTransferAttachment, 'amount' | 'note'>) => {
        const normalizedTransfer = normalizeTransferAttachment(transfer);
        if (!normalizedTransfer) return null;
        return {
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: conversation.activeMode,
          content: formatTransferContent(normalizedTransfer),
          transfer: normalizedTransfer,
          replyBatchId,
          ...replyVariantFields,
          ...callFields,
          ...gobangFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage;
      };
      const createCommerceMessage = (segment: Extract<RoleplayReplySegment, { type: 'commerce' }>) => {
        const commerce = normalizeCommerceAttachment(segment, character);
        if (!commerce) return null;
        return {
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: conversation.activeMode,
          content: formatCommerceContent(commerce),
          commerce,
          replyBatchId,
          ...replyVariantFields,
          ...callFields,
          ...gobangFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage;
      };
      const usedMusicActionNoticeIndexes = new Set<number>();
      const createMusicActionNoticeMessage = (notice: string) => ({
        id: createId('msg'),
        conversationId,
        sender: 'system' as const,
        mode: conversation.activeMode,
        content: notice,
        createdAt: createdAt + charMessageOffset++,
        displayStyle: 'narration' as const,
        replyBatchId,
        ...replyVariantFields,
        ...callFields,
        ...gobangFields,
        status: 'sent' as const
      } satisfies ChatMessage);
      const takeMusicActionNotice = (preferredIndex?: number) => {
        if (typeof preferredIndex === 'number' && musicActionNotices[preferredIndex] && !usedMusicActionNoticeIndexes.has(preferredIndex)) {
          usedMusicActionNoticeIndexes.add(preferredIndex);
          return musicActionNotices[preferredIndex];
        }
        const nextIndex = musicActionNotices.findIndex((notice, index) => Boolean(notice && !usedMusicActionNoticeIndexes.has(index)));
        if (nextIndex < 0) return '';
        usedMusicActionNoticeIndexes.add(nextIndex);
        return musicActionNotices[nextIndex];
      };
      const appendMusicActionNotice = (targetMessages: ChatMessage[], preferredIndex?: number) => {
        const notice = takeMusicActionNotice(preferredIndex);
        if (notice) targetMessages.push(createMusicActionNoticeMessage(notice));
      };
      const appendRemainingMusicActionNotices = (targetMessages: ChatMessage[]) => {
        while (usedMusicActionNoticeIndexes.size < musicActionNotices.length) appendMusicActionNotice(targetMessages);
      };
      const sentImageDescriptionKeys = new Set<string>();
      const appendImageMessage = async (description: string, targetMessages: ChatMessage[], generationPrompt = '') => {
        const imageKey = normalizeDuplicateKey(`${description}\n${generationPrompt}`);
        if (!imageKey || sentImageDescriptionKeys.has(imageKey)) return;
        sentImageDescriptionKeys.add(imageKey);
        const imageMessage = await createImageMessage(description, generationPrompt);
        if (imageMessage) targetMessages.push(imageMessage);
      };
      const appendPlacedStickers = (replyIndex: number, position: 'before' | 'after') => {
        for (const placement of replyStickerPlacements) {
          if (placement.replyIndex === replyIndex && placement.position === position) appendStickerMessages(placement.stickers);
        }
      };
      if (orderedSegments.length) {
        for (const segment of orderedSegments) {
          switch (segment.type) {
            case 'narration':
              orderedCharMessages.push({
                id: createId('msg'),
                conversationId,
                sender: 'system' as const,
                mode: conversation.activeMode,
                content: segment.content,
                createdAt: createdAt + charMessageOffset++,
                displayStyle: 'narration' as const,
                replyBatchId,
                ...replyVariantFields,
                ...callFields,
                ...gobangFields,
                status: 'sent' as const
              } satisfies ChatMessage);
              break;
            case 'reply':
              orderedCharMessages.push(createTextReplyMessage(segment.content, segment.translation, quoteByReplyIndex.get(orderedReplyIndex)));
              orderedReplyIndex += 1;
              break;
            case 'sticker':
              appendOrderedStickerMessages(resolveCharacterStickerSelections(segment.stickers, availableCharacterStickers));
              break;
            case 'image':
              await appendImageMessage(segment.description, orderedCharMessages, segment.generationPrompt);
              break;
            case 'location': {
              orderedCharMessages.push(createLocationMessage(segment));
              break;
            }
            case 'voice': {
              orderedCharMessages.push(createVoiceMessage(segment.content, segment.duration, segment.translation));
              break;
            }
            case 'transfer': {
              const transferMessage = createTransferMessage(segment);
              if (transferMessage) orderedCharMessages.push(transferMessage);
              break;
            }
            case 'commerce': {
              const commerceMessage = createCommerceMessage(segment);
              if (commerceMessage) orderedCharMessages.push(commerceMessage);
              break;
            }
            case 'music_action': {
              appendMusicActionNotice(orderedCharMessages, segment.actionIndex);
              break;
            }
          }
        }
      } else if (replyMessages.length) {
        replyMessages.forEach((reply, index) => {
          appendPlacedStickers(index, 'before');
          charMessagesAfterNarration.push(createTextReplyMessage(reply.content, reply.translation, quoteByReplyIndex.get(index)));
          appendPlacedStickers(index, 'after');
        });
      } else {
        replyStickerPlacements.forEach((placement) => appendStickerMessages(placement.stickers));
      }
      for (const image of replyImages) {
        await appendImageMessage(image.description, charMessagesAfterNarration, image.generationPrompt);
      }
      appendStickerMessages(replyStickers);
      const charMessages: ChatMessage[] = orderedSegments.length ? orderedCharMessages : [...charNarrationMessages, ...charMessagesAfterNarration];
      for (const mcpResult of mcpResultAttachments) {
        const itemSummary = mcpResult.items.slice(0, 3).map((item) => item.title).join('、');
        charMessages.push({
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: conversation.activeMode,
          content: `[MCP 结构化结果] ${mcpResult.serverName} · ${mcpResult.toolName}${itemSummary ? `：${itemSummary}` : ''}`,
          mcpResult,
          replyBatchId,
          ...replyVariantFields,
          ...callFields,
          ...gobangFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage);
      }
      if (isCharacterReapplyEvent || (isBlockedInteraction && ['blocked-by-user', 'deleted-by-user'].includes(relationshipStatus))) {
        charMessages.forEach((message) => {
          if (message.sender === 'char') {
            message.status = 'failed';
            message.readAt = undefined;
          }
        });
      }
      appendRemainingMusicActionNotices(charMessages);
      if (isReplyRunCancelled(conversationId, replyCancelVersion)) return [];
      if (offlineInvitation) {
        charMessages.push({
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: 'online' as const,
          content: formatOfflineInvitationContent(offlineInvitation),
          offlineInvitation,
          replyBatchId,
          ...replyVariantFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage);
      }
      if (canSendMusicListenInvite && musicListenInvite) {
        charMessages.push({
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: 'online' as const,
          content: formatMusicListenInviteContent(musicListenInvite),
          musicListenInvite,
          replyBatchId,
          ...replyVariantFields,
          createdAt: createdAt + charMessageOffset++,
          status: 'sent' as const
        } satisfies ChatMessage);
      }
      if (callInvite) {
        const call = normalizeCallAttachment({
          callId: createId('call'),
          mode: callInvite.mode,
          direction: 'incoming',
          status: 'ringing',
          startedAt: createdAt + charMessageOffset++
        });
        charMessages.push({
          id: createId('msg'),
          conversationId,
          sender: callMessageSender(call),
          mode: 'online' as const,
          content: formatCallContent(call, callParticipantNames(conversationId)),
          call,
          callId: call.callId,
          callMode: call.mode,
          createdAt: call.startedAt,
          status: 'sent' as const
        } satisfies ChatMessage);
      }
      if (gobangInvite && !hasOpenGobang) {
        const game = createGobangGame({
          gameId: createId('gobang'),
          starter: 'char',
          direction: 'incoming',
          invitationStatus: 'pending',
          createdAt: createdAt + charMessageOffset++
        });
        charMessages.push({
          id: createId('msg'),
          conversationId,
          sender: 'char' as const,
          mode: 'online' as const,
          content: formatGobangContent(game),
          gobang: game,
          createdAt: game.startedAt,
          status: 'sent' as const
        } satisfies ChatMessage);
      }
      if (plotChoices.length) {
        const plotChoiceMessage = charMessages.find((message) => message.sender === 'char' && !message.sticker && !message.image && !message.voice && !message.location && !message.transfer && !message.commerce && !message.musicListenInvite);
        if (plotChoiceMessage) plotChoiceMessage.plotChoices = plotChoices;
      }
      if (apiTrace) {
        const traceMessage = charMessages.find((message) => message.sender === 'char');
        if (traceMessage) traceMessage.apiTrace = apiTrace;
      }
      if (charMessages.length) {
        if (conversation.activeMode === 'online' && conversation.kind !== 'group') {
          await markUserMessagesReadByCharacter(conversationId, generationStartedAt);
          charMessages.forEach((message) => {
            if (message.sender === 'char' && message.mode === 'online') message.readAt = null;
          });
        }
        messages.value.push(...charMessages);
        await Promise.all(charMessages.map((message) => putEntity('messages', message)));
        syncPendingIncomingCall();
        const commerceMessages = charMessages.filter((message): message is ChatMessage & { commerce: ChatCommerceAttachment } => Boolean(message.commerce));
        if (commerceMessages.length) {
          const commerceStore = useCommerceStore();
          await commerceStore.ensureReady(users.value, characters.value);
          await Promise.all(commerceMessages.map((message) => commerceStore.recordChatPurchase({
            attachment: message.commerce,
            userId: conversation.userId,
            characterId: character.id,
            characterName: getCharacterAiName(character),
            conversationId,
            sourceMessageId: message.id
          })));
        }
        const incomingCharMessages = charMessages.filter((message) => message.sender === 'char');
        if (incomingCharMessages.length) notifyCharacterMessages(conversation, incomingCharMessages);
        const latestCharMessage = charMessages[charMessages.length - 1];
        const latestConversation = conversationById(conversationId) ?? conversation;
        const nextConversation = {
          ...latestConversation,
          updatedAt: latestCharMessage.createdAt,
          unreadCount: unreadCountAfterIncomingMessage(latestConversation, charMessages.length),
          activeMode: conversation.activeMode
        };
        const index = conversations.value.findIndex((item) => item.id === conversationId);
        conversations.value[index] = nextConversation;
        await putEntity('conversations', nextConversation);
      } else {
        await touchConversationAfterMessageChange(conversationId);
      }

      await applyCharacterRelationshipAction(character.id, relationshipAction);

      void maybeAutoCaptureConversationMemory(conversationId, Boolean(parsedReply.mcpOperations?.length));

      if (chatSettings.autoGenerateTheater && shouldAutoGenerateMoment(chatSettings.theaterFrequency)) {
        void createSmallTheaterFromConversation(conversationId, undefined, { silent: true }).catch((error) => {
          console.error(error);
        });
      }

      const shouldGenerateMoment = options?.generateMoment || (chatSettings.autoGenerateVoom && shouldAutoGenerateMoment(chatSettings.voomFrequency));
      if (shouldGenerateMoment) {
        finishConversationReply(conversationId, replyRunId);
        void createMomentFromConversation(conversationId).catch((error) => {
          console.error(error);
        });
      }
      return charMessages;
    } catch (error) {
      if (isReplyRunCancelled(conversationId, replyCancelVersion)) return [];
      if (options?.proactive) {
        console.error(error);
      } else {
        showConfigAlert(error instanceof Error ? error.message : 'AI 回复失败，请检查 API 模型配置。', '回复异常');
      }
    } finally {
      finishConversationReply(conversationId, replyRunId);
    }
  }

  async function sendMessage(conversationId: string, content: string, options?: { generateMoment?: boolean; quote?: ChatMessageQuote | null }) {
    const userMessage = await appendUserMessage(conversationId, content, options?.quote);
    if (!userMessage) return;
    await requestRoleplayReply(conversationId, options);
  }

  async function sendStickerMessage(conversationId: string, sticker: Sticker, quote?: ChatMessageQuote | null) {
    return appendStickerMessage(conversationId, sticker, quote);
  }

  async function updateOfflineInvitationStatus(messageId: string, status: ChatOfflineInvitationStatus, options: { started?: boolean } = {}) {
    const message = messages.value.find((item) => item.id === messageId);
    if (!message?.offlineInvitation) return null;
    if (message.offlineInvitation.status !== 'pending' && !options.started) return null;
    const now = Date.now();
    const nextInvitation: ChatOfflineInvitationAttachment = {
      ...message.offlineInvitation,
      status,
      respondedAt: message.offlineInvitation.respondedAt ?? now,
      startedAt: options.started ? message.offlineInvitation.startedAt ?? now : message.offlineInvitation.startedAt
    };
    const nextMessage: ChatMessage = {
      ...message,
      content: formatOfflineInvitationContent(nextInvitation),
      offlineInvitation: nextInvitation,
      editedAt: now
    };
    const messageIndex = messages.value.findIndex((item) => item.id === messageId);
    if (messageIndex >= 0) messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    return nextMessage;
  }

  async function rejectOfflineInvitation(messageId: string) {
    return updateOfflineInvitationStatus(messageId, 'rejected');
  }

  async function acceptOfflineInvitation(messageId: string) {
    const message = messages.value.find((item) => item.id === messageId);
    if (!message?.offlineInvitation || message.offlineInvitation.status !== 'pending') return false;
    const conversation = conversationById(message.conversationId);
    if (!conversation) return false;
    await updateConversationMode(message.conversationId, 'offline');
    await updateOfflineInvitationStatus(messageId, 'accepted', { started: true });
    const latestConversation = conversationById(message.conversationId) ?? conversation;
    const acceptedAt = Date.now();
    const nextConversation = { ...latestConversation, activeMode: 'offline' as const, updatedAt: acceptedAt, unreadCount: 0 };
    const conversationIndex = conversations.value.findIndex((item) => item.id === message.conversationId);
    if (conversationIndex >= 0) conversations.value[conversationIndex] = nextConversation;
    await putEntity('conversations', nextConversation);
    const openingPrompt = message.offlineInvitation.prompt.trim() || '用户接受了线下邀约。请从当前关系和氛围自然开启线下模块的新章节。';
    void requestRoleplayReply(message.conversationId, {
      replyInstruction: `用户刚刚点击接受了你发出的线下邀约，现在已经进入线下模块。请立刻生成线下模式的新章节正文，承接这份邀约：${openingPrompt}。可以描写两人见面和面对面互动，但不要让角色知道用户未提供的现实位置、行程、心理或决定；不要输出线上聊天气泡。`
    });
    return true;
  }

  async function rollbackFinancialActionsForOnlineRegeneration(messagesToRemove: ChatMessage[]) {
    const removedMessageIds = new Set(messagesToRemove.map((message) => message.id));
    const transferSourceIds = [...new Set(messagesToRemove
      .map((message) => message.transfer?.responseToMessageId?.trim() ?? '')
      .filter(Boolean))];
    const commerceStore = useCommerceStore();
    await commerceStore.ensureReady(users.value, characters.value);
    await commerceStore.rollbackChatFinancialActions([...removedMessageIds, ...transferSourceIds]);

    const transferSourcesToReset = transferSourceIds.flatMap((messageId) => {
      const sourceMessage = messages.value.find((message) => message.id === messageId);
      if (!sourceMessage?.transfer || removedMessageIds.has(sourceMessage.id) || sourceMessage.transfer.status === 'pending') return [];
      const nextTransfer: ChatTransferAttachment = { ...sourceMessage.transfer, status: 'pending' };
      delete nextTransfer.respondedAt;
      return [{
        ...sourceMessage,
        transfer: nextTransfer,
        content: formatTransferContent(nextTransfer),
        editedAt: Date.now()
      } satisfies ChatMessage];
    });
    if (!transferSourcesToReset.length) return;
    const nextById = new Map(transferSourcesToReset.map((message) => [message.id, message]));
    messages.value = messages.value.map((message) => nextById.get(message.id) ?? message);
    await Promise.all(transferSourcesToReset.map((message) => putEntity('messages', message)));
  }

  async function regenerateLatestReply(conversationId: string, options: { replyInstruction?: string } = {}) {
    const conversation = conversationById(conversationId);
    if (!conversation || isConversationReplying(conversationId)) return false;

    const conversationMessages = messagesForConversation(conversationId).filter((message) => message.mode === conversation.activeMode && message.replyVariantState !== 'inactive');
    let latestCharIndex = -1;
    for (let messageIndex = conversationMessages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      if (conversationMessages[messageIndex].sender === 'char') {
        latestCharIndex = messageIndex;
        break;
      }
    }

    if (latestCharIndex < 0) {
      showConfigAlert('暂无可重新生成的 AI 回复。', '无法重新回复');
      return false;
    }

    let firstCharIndex = latestCharIndex;
    while (firstCharIndex > 0 && conversationMessages[firstCharIndex - 1].sender === 'char') {
      firstCharIndex -= 1;
    }

    const latestCharMessage = conversationMessages[latestCharIndex];
    const messagesToRemove = latestCharMessage.replyBatchId
      ? conversationMessages.filter((message) => message.replyBatchId === latestCharMessage.replyBatchId)
      : conversationMessages.slice(firstCharIndex, latestCharIndex + 1);

    if (!latestCharMessage.replyBatchId) {
      for (let messageIndex = firstCharIndex - 1; messageIndex >= 0; messageIndex -= 1) {
        const previousMessage = conversationMessages[messageIndex];
        if (!isRoleplayNarrationMessage(previousMessage)) break;
        messagesToRemove.unshift(previousMessage);
      }
    }

    if (conversation.activeMode === 'offline') {
      const replyBatchId = latestCharMessage.replyBatchId || createId('reply');
      const replyVariantGroupId = latestCharMessage.replyVariantGroupId || createId('variant');
      const existingVariantIndexes = messagesForConversation(conversationId)
        .filter((message) => message.mode === conversation.activeMode && message.replyVariantGroupId === replyVariantGroupId)
        .map((message) => Math.max(0, Math.floor(Number(message.replyVariantIndex) || 0)));
      const nextVariantIndex = Math.max(0, ...existingVariantIndexes) + 1;
      await saveMessages(messagesToRemove.map((message) => ({
        ...message,
        replyBatchId: message.replyBatchId || replyBatchId,
        replyVariantGroupId,
        replyVariantIndex: message.replyVariantIndex ?? 0,
        replyVariantState: 'inactive' as const
      })));
      await requestRoleplayReply(conversationId, { replyVariantGroupId, replyVariantIndex: nextVariantIndex, replyInstruction: options.replyInstruction });
      return true;
    }

    await rollbackCharacterMoodForOnlineRegeneration(conversation, messagesToRemove);
  await rollbackFinancialActionsForOnlineRegeneration(messagesToRemove);
    const removedMessageIds = messagesToRemove.map((message) => message.id);
    await deleteMessages(messagesToRemove.map((message) => message.id));

    await requestRoleplayReply(conversationId, { excludeSourceMessageIds: removedMessageIds, replyInstruction: options.replyInstruction });
    return true;
  }

  async function applyReplyVariant(conversationId: string, replyVariantGroupId: string, replyBatchId: string) {
    const normalizedGroupId = replyVariantGroupId.trim();
    const normalizedBatchId = replyBatchId.trim();
    if (!normalizedGroupId || !normalizedBatchId) return false;
    const groupMessages = messagesForConversation(conversationId).filter((message) => message.replyVariantGroupId === normalizedGroupId);
    if (!groupMessages.some((message) => message.replyBatchId === normalizedBatchId)) return false;
    await saveMessages(groupMessages.map((message) => ({
      ...message,
      replyVariantState: message.replyBatchId === normalizedBatchId ? 'active' as const : 'inactive' as const
    })));
    return true;
  }

  async function maybeRequestProactiveReply(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation || conversation.kind === 'group' || conversation.activeMode !== 'online' || isConversationReplying(conversationId)) return false;
    const character = characterById(conversation.charId);
    const relationshipStatus = character ? getFriendRelationship(character).status : 'friend';
    const canConsiderReapply = ['blocked-by-user', 'deleted-by-user'].includes(relationshipStatus);
    if (relationshipStatus !== 'friend' && !canConsiderReapply) return false;
    const chatSettings = settingsForConversation(conversationId);
    if (!chatSettings.proactiveReply.enabled) return false;

    const conversationMessages = messagesForConversation(conversationId).filter((message) => message.mode === conversation.activeMode);
    const latestMessage = conversationMessages[conversationMessages.length - 1];
    if (latestMessage?.sender === 'user') return false;

    const now = Date.now();
    const cooldown = proactiveReplyCooldownMs(chatSettings.proactiveReply.frequency);
    if (chatSettings.proactiveReply.lastTriggeredAt && now - chatSettings.proactiveReply.lastTriggeredAt < cooldown) return false;

    await touchProactiveReplyAttempt(chatSettings, now);
    if (Math.random() >= getVoomFrequencyChance(chatSettings.proactiveReply.frequency)) return false;

    const { characterName, userName } = character ? characterRelationshipNames(character) : { characterName: '角色', userName: '用户' };

    await requestRoleplayReply(conversationId, canConsiderReapply
      ? {
        proactive: true,
        relationshipEvent: 'character-reapply',
        replyInstruction: `这是独立关系事件：${characterName}被${userName}拉黑或删除后，正在考虑是否重新申请${userName}为好友。普通聊天消息无法送达。只有${characterName}按人设和关系记忆确实想恢复联系时，才在 relationshipAction 输出 request_friend，并把 reason 写成简短好友验证；否则保持 null。`
      }
      : { proactive: true });
    return true;
  }

  async function runProactivePrivateScheduler() {
    for (const conversation of conversations.value.filter((entry) => entry.kind !== 'group' && entry.activeMode === 'online')) {
      await maybeRequestProactiveReply(conversation.id);
    }
  }

  function charactersForUserVoom(userId: string, visibility: VoomPostVisibility, characterIds: string[]) {
    const boundCharacters = characters.value.filter((character) => character.boundUserId === userId);
    if (visibility === 'public') return boundCharacters;
    const selectedIds = new Set(characterIds.map((id) => id.trim()).filter(Boolean));
    return boundCharacters.filter((character) => selectedIds.has(character.id));
  }

  function conversationsForCharacters(targetCharacters: CharacterProfile[]) {
    const seen = new Set<string>();
    return targetCharacters
      .map((character) => conversations.value.find((conversation) => conversation.charId === character.id))
      .filter((conversation): conversation is Conversation => {
        if (!conversation || seen.has(conversation.id)) return false;
        seen.add(conversation.id);
        return true;
      });
  }

  function resolveUserVoomCommentModelOverride(targetConversations: Conversation[]) {
    for (const targetConversation of targetConversations) {
      const chatSettings = settingsForConversation(targetConversation.id);
      const modelOverride = getConversationTextModelOverride(chatSettings, 'voom');
      if (modelOverride && hasConfiguredTextModel(modelOverride)) return modelOverride;
    }
    for (const targetConversation of targetConversations) {
      const chatSettings = settingsForConversation(targetConversation.id);
      const modelOverride = getConversationTextModelOverride(chatSettings, targetConversation.activeMode);
      if (modelOverride && hasConfiguredTextModel(modelOverride)) return modelOverride;
    }
    return hasConfiguredTextModel('') ? '' : null;
  }

  function resolveUserVoomCommentTimeAwareness(targetConversations: Conversation[]) {
    return {
      enabled: targetConversations.some((targetConversation) => settingsForConversation(targetConversation.id).timeAwareness.enabled)
    };
  }

  async function createInitialUserVoomComments(post: VoomPost, author: UserProfile, targetCharacters: CharacterProfile[], targetConversations: Conversation[]) {
    const modelOverride = resolveUserVoomCommentModelOverride(targetConversations);
    if (modelOverride === null) return [];

    let generatedComments: Awaited<ReturnType<typeof generateUserVoomComments>> = [];
    try {
      generatedComments = await generateUserVoomComments({
        author,
        content: post.content,
        imageDescription: post.imageDescription,
        createdAt: post.createdAt,
        targetCharacters,
        timeAwareness: resolveUserVoomCommentTimeAwareness(targetConversations),
        settings: settings.value ?? undefined,
        modelOverride
      });
    } catch (error) {
      console.warn('User VOOM comments generation failed.', error);
      return [];
    }

    const generatedIds = generatedComments.map(() => createId('comment'));
    const generatedIdByDraftId = new Map(generatedComments.flatMap((comment, index) => comment.draftId ? [[comment.draftId, generatedIds[index]]] : []));
    return generatedComments.map((comment, index) => {
      const resolvedParentId = comment.parentId ? generatedIdByDraftId.get(comment.parentId) : '';
      return {
        id: generatedIds[index],
        authorName: comment.authorName,
        authorId: comment.authorId,
        content: comment.content,
        contentTranslation: comment.contentTranslation,
        parentId: resolvedParentId && resolvedParentId !== generatedIds[index] ? resolvedParentId : undefined,
        createdAt: post.createdAt + index + 1
      } satisfies VoomComment;
    });
  }

  async function createUserVoomPost(payload: CreateUserVoomPostPayload) {
    const author = userById(payload.userId);
    const content = payload.content.trim();
    if (!author) {
      showConfigAlert('请选择一个要发布 VOOM 的用户账号。', '无法发布 VOOM');
      return null;
    }
    if (!content) {
      showConfigAlert('发布 VOOM 前请先填写正文。', '无法发布 VOOM');
      return null;
    }

    const visibility: VoomPostVisibility = payload.visibility === 'selected' ? 'selected' : 'public';
    const targetCharacters = charactersForUserVoom(author.id, visibility, payload.characterIds);
    if (!targetCharacters.length) {
      showConfigAlert('请选择至少一个可见角色，或先给该账号绑定角色。', '无法发布 VOOM');
      return null;
    }

    const targetConversations = conversationsForCharacters(targetCharacters);
    if (!targetConversations.length) {
      showConfigAlert('所选角色还没有可写入的对话。', '无法发布 VOOM');
      return null;
    }

    const image = await compactInlineDisplayImage(payload.image?.trim() || '');
    const imageDescription = payload.imageDescription?.trim() || '';
    const createdAt = Date.now();
    const post: VoomPost = {
      id: createId('voom'),
      charId: '',
      conversationId: targetConversations[0]?.id,
      conversationIds: targetConversations.map((conversation) => conversation.id),
      authorType: 'user',
      userId: author.id,
      visibility,
      visibleCharacterIds: targetCharacters.map((character) => character.id),
      authorName: getUserAiName(author),
      authorAvatar: author.avatar,
      content,
      image: image || undefined,
      imageDescription: imageDescription || undefined,
      imageProvider: image ? 'local' : imageDescription ? 'mock' : undefined,
      imageCandidates: image ? [createVoomImageCandidate({ image, description: imageDescription || content, provider: 'local' })] : undefined,
      createdAt,
      comments: [],
      likes: []
    };

    post.comments = await createInitialUserVoomComments(post, author, targetCharacters, targetConversations);
    voomPosts.value.unshift(post);
    await putEntity('voomPosts', post);
    await recordVoomPostEvents(post);
    return post;
  }

  async function createMomentFromConversation(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (generatingMomentConversationIds.has(conversationId)) return;
    if (!conversation) return;
    const character = characterById(conversation.charId);
    if (!character) return;
    const boundUser = userById(character.boundUserId) ?? user.value;
    if (!boundUser) return;
    const chatSettings = settingsForConversation(conversationId);
    const modelOverride = getConversationTextModelOverride(chatSettings, 'voom');
    if (!hasConfiguredTextModel(modelOverride)) {
      showConfigAlert('请先在聊天菜单里配置 VOOM 模型，或在设置里配置全局默认 API 模型。', '需要配置 API 模型');
      return;
    }
    generatingMomentConversationIds.add(conversationId);
    try {
      const recentVoomPosts = voomPosts.value
        .filter((post) => post.authorType !== 'user' && (post.charId === character.id || post.conversationId === conversationId || post.conversationIds?.includes(conversationId)))
        .sort((first, second) => second.createdAt - first.createdAt)
        .slice(0, 16);
      const moment = await generateVoomPost(
        {
          user: boundUser,
          character,
          boundUser,
          mode: conversation.activeMode,
          messages: visibleMessagesForConversation(conversationId),
          recentVoomPosts,
          worldBooks: worldBooks.value,
          conversationSummary: conversation.summary,
          memorySummary: await memoryContextForConversationAsync(conversationId, visibleMessagesForConversation(conversationId).slice(-8).map((message) => messageReadableContent(message)).join('\n'), {
            embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings)
          }),
          stickerVisionEnabled: chatSettings.stickerVisionEnabled,
          timeAwareness: chatSettings.timeAwareness,
          voomImageMode: chatSettings.voomImageMode,
          musicListening: musicListeningContextForConversation(conversationId)
        },
        settings.value ?? undefined,
        modelOverride
      );
      const characterAiName = getCharacterAiName(character);
      const characterVoomAuthorName = getCharacterVoomAuthorName(character);
      const characterAuthorAliases = new Set([character.id, character.name, character.nickname, characterAiName, characterVoomAuthorName]
        .map((name) => name.trim().toLocaleLowerCase())
        .filter(Boolean));
      const post: VoomPost = { ...moment, id: createId('voom'), conversationId: conversation.id, authorName: characterAiName, authorAvatar: character.avatar, createdAt: Date.now() };
      post.comments = post.comments.map((comment, index) => ({
        ...comment,
        authorName: characterAuthorAliases.has(comment.authorName.trim().toLocaleLowerCase()) ? characterAiName : comment.authorName,
        authorId: characterAuthorAliases.has(comment.authorName.trim().toLocaleLowerCase()) ? character.id : comment.authorId,
        createdAt: post.createdAt + post.likes.length + index + 1
      }));
      const resolvedPost = await generateVoomPostImageBeforePublish(post, chatSettings);
      voomPosts.value.unshift(resolvedPost);
      await putEntity('voomPosts', createPersistableVoomPost(resolvedPost));
      const latestConversation = conversationById(conversationId) ?? conversation;
      await recordVoomPostEvents(resolvedPost, latestConversation.activeMode);
      notifyVoomPost(resolvedPost, latestConversation);
      return resolvedPost;
    } finally {
      generatingMomentConversationIds.delete(conversationId);
    }
  }

  function smallTheaterTopicsForCharacter(characterId: string) {
    const normalizedCharacterId = characterId.trim();
    const localEnabled = settings.value?.smallTheaterTopicEnabledByCharacter?.[normalizedCharacterId] ?? {};
    return smallTheaterTopics.value
      .map((topic) => ({
        ...topic,
        enabled: localEnabled[topic.id] ?? topic.enabled
      }))
      .sort((first, second) => first.createdAt - second.createdAt);
  }

  function profileThemesForCharacter(characterId: string) {
    const normalizedCharacterId = characterId.trim();
    const localEnabled = settings.value?.profileThemeEnabledByCharacter?.[normalizedCharacterId] ?? {};
    return profileThemes.value
      .map((theme) => ({
        ...theme,
        enabled: localEnabled[theme.id] ?? theme.enabled
      }))
      .sort((first, second) => first.createdAt - second.createdAt);
  }

  function enabledProfileThemesForCharacter(characterId: string) {
    return profileThemesForCharacter(characterId).filter((theme) => theme.enabled);
  }
  function profileHomepagesForCharacter(characterId: string) {
    return profileHomepages.value
      .filter((homepage) => homepage.charId === characterId)
      .sort((first, second) => (second.updatedAt ?? second.createdAt) - (first.updatedAt ?? first.createdAt));
  }

  function smallTheatersForCharacter(characterId: string) {
    return smallTheaters.value
      .filter((theater) => theater.charId === characterId)
      .sort((first, second) => (second.updatedAt ?? second.createdAt) - (first.updatedAt ?? first.createdAt));
  }

  function smallTheaterById(theaterId: string) {
    return smallTheaters.value.find((theater) => theater.id === theaterId) ?? null;
  }

  async function markSmallTheaterDefaultsInitialized(characterId: string, timestamp: number) {
    if (!settings.value) return;
    const initialized = settings.value.smallTheaterTopicDefaultsInitialized ?? {};
    if (initialized[characterId]) return;
    settings.value = normalizeAppSettings({
      ...settings.value,
      smallTheaterTopicDefaultsInitialized: {
        ...initialized,
        [characterId]: timestamp
      }
    });
    await putEntity('settings', settings.value, 'main');
  }

  function shouldRefreshBuiltInSmallTheaterTopics(existingTopics: SmallTheaterTopic[]) {
    const builtInTopics = existingTopics.filter((topic) => topic.builtIn);
    if (!builtInTopics.length) return false;
    if (builtInTopics.length !== defaultSmallTheaterTopicDrafts.length) return true;
    return defaultSmallTheaterTopicDrafts.some((draft, index) => {
      const topic = builtInTopics[index];
      return !topic || topic.title !== draft.title || topic.prompt !== draft.prompt;
    });
  }

  async function refreshBuiltInSmallTheaterTopics(characterId: string, existingTopics: SmallTheaterTopic[]) {
    const builtInTopics = smallTheaterTopics.value.filter((topic) => topic.builtIn);
    const currentEnabledByTitle = new Map(existingTopics.filter((topic) => topic.builtIn).map((topic) => [topic.title, topic.enabled]));
    const timestamp = Math.min(...builtInTopics.map((topic) => topic.createdAt), Date.now());
    const defaultTopics = createDefaultSmallTheaterTopics(globalSharedLibraryOwnerId, timestamp).map((topic) => ({
      ...topic,
      enabled: true,
      updatedAt: Date.now()
    }));
    let smallTheaterTopicEnabledByCharacter = cloneEnabledByCharacter(settings.value?.smallTheaterTopicEnabledByCharacter);
    builtInTopics.forEach((topic) => {
      const replacementTopic = defaultTopics.find((entry) => entry.title === topic.title);
      if (!replacementTopic) return;
      if (topic.charId && topic.charId !== globalSharedLibraryOwnerId) {
        setEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, topic.charId, replacementTopic.id, topic.enabled);
      }
      remapEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, topic.id, replacementTopic.id);
    });
    defaultTopics.forEach((topic) => {
      const enabled = currentEnabledByTitle.get(topic.title);
      if (enabled !== undefined) setEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, characterId, topic.id, enabled);
    });

    smallTheaterTopics.value = [
      ...smallTheaterTopics.value.filter((topic) => !topic.builtIn),
      ...defaultTopics
    ];
    const nextSettings = settings.value ? normalizeAppSettings({
      ...settings.value,
      smallTheaterTopicEnabledByCharacter
    }) : null;
    if (nextSettings) settings.value = nextSettings;
    await Promise.all([
      ...builtInTopics.map((topic) => deleteEntity('smallTheaterTopics', topic.id)),
      ...defaultTopics.map((topic) => putEntity('smallTheaterTopics', topic)),
      ...(nextSettings ? [putEntity('settings', nextSettings, 'main')] : [])
    ]);
    return smallTheaterTopicsForCharacter(characterId);
  }

  async function ensureSmallTheaterTopicsForCharacter(characterId: string) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return [];
    const existingTopics = smallTheaterTopicsForCharacter(normalizedCharacterId);
    if (shouldRefreshBuiltInSmallTheaterTopics(existingTopics)) {
      return refreshBuiltInSmallTheaterTopics(normalizedCharacterId, existingTopics);
    }
    if (existingTopics.length || settings.value?.smallTheaterTopicDefaultsInitialized?.[globalSharedLibraryOwnerId]) return existingTopics;

    const timestamp = Date.now();
    const defaultTopics = createDefaultSmallTheaterTopics(globalSharedLibraryOwnerId, timestamp);
    smallTheaterTopics.value.push(...defaultTopics);
    await Promise.all(defaultTopics.map((topic) => putEntity('smallTheaterTopics', topic)));
    await markSmallTheaterDefaultsInitialized(globalSharedLibraryOwnerId, timestamp);
    return smallTheaterTopicsForCharacter(normalizedCharacterId);
  }

  async function ensureProfileThemesForCharacter(characterId: string) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return [];
    const existingThemes = profileThemesForCharacter(normalizedCharacterId);
    if (existingThemes.length) return existingThemes;

    const defaultTheme = createDefaultProfileTheme(globalSharedLibraryOwnerId, Date.now());
    profileThemes.value.push(defaultTheme);
    await putEntity('profileThemes', defaultTheme);
    return profileThemesForCharacter(normalizedCharacterId);
  }

  async function createProfileTheme(payload: Pick<ProfileTheme, 'name' | 'prompt'> & Partial<Pick<ProfileTheme, 'charId' | 'regex' | 'template' | 'css' | 'enabled'>>) {
    const now = Date.now();
    const theme = normalizeProfileTheme({
      ...payload,
      charId: globalSharedLibraryOwnerId,
      enabled: true,
      source: 'custom',
      createdAt: now,
      updatedAt: now
    }, globalSharedLibraryOwnerId);
    if (!theme) {
      showConfigAlert('请填写主页主题名称和提示词。', '无法保存主页主题');
      return null;
    }

    profileThemes.value.push(theme);
    await putEntity('profileThemes', theme);
    return theme;
  }

  async function refreshActiveProfileThemeSnapshot(theme: ProfileTheme) {
    if (isDefaultProfileTheme(theme)) return;
    const affectedCharacters = characters.value.filter((character) => character.mindState?.profileThemeId === theme.id);
    for (const character of affectedCharacters) {
      const mindState = character.mindState;
      if (!mindState) continue;
      const profileThemeContent = mindState.profileThemeContent ?? '';
      await saveCharacter({
        ...character,
        mindState: {
          ...mindState,
          profileThemeName: theme.name,
          profileThemeHtml: renderProfileThemeHtml(profileThemeContent, theme.template) || undefined,
          profileThemeCss: theme.css || undefined
        }
      });
    }
  }

  async function createProfileHomepageRecord(payload: Omit<ProfileHomepageRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now();
    const record = normalizeStoredProfileHomepages([{
      ...payload,
      id: createId('profile-homepage'),
      createdAt: now,
      updatedAt: now
    }])[0] ?? null;
    if (!record) return null;
    profileHomepages.value.unshift(record);
    await putEntity('profileHomepages', record);
    return record;
  }

  async function deleteProfileHomepage(recordId: string) {
    const record = profileHomepages.value.find((entry) => entry.id === recordId);
    if (!record) return false;
    profileHomepages.value = profileHomepages.value.filter((entry) => entry.id !== recordId);
    await deleteEntity('profileHomepages', recordId);
    return true;
  }

  function profileHomepagesForCleanup(characterIds: string[], olderThanDays: number) {
    const characterIdSet = new Set(characterIds.map((id) => id.trim()).filter(Boolean));
    const days = Math.max(1, Math.round(Number(olderThanDays) || 0));
    if (!characterIdSet.size || !days) return [];
    const cutoff = Date.now() - days * oneDayMs;
    return profileHomepages.value.filter((homepage) => characterIdSet.has(homepage.charId) && (homepage.updatedAt ?? homepage.createdAt) < cutoff);
  }

  async function cleanupProfileHomepagesForCharacters(characterIds: string[], olderThanDays: number) {
    const recordsToDelete = profileHomepagesForCleanup(characterIds, olderThanDays);
    for (const record of recordsToDelete) {
      await deleteProfileHomepage(record.id);
    }
    return recordsToDelete.length;
  }

  async function runProfileHomepageAutoCleanupForCharacters(characterIds: string[]) {
    if (!settings.value) return 0;
    const now = Date.now();
    const cleanupSettings = { ...settings.value.profileHomepageAutoCleanup };
    let removedCount = 0;
    let settingsChanged = false;

    for (const characterId of characterIds.map((id) => id.trim()).filter(Boolean)) {
      const entry = cleanupSettings[characterId];
      if (!entry?.enabled) continue;
      const days = Math.max(1, Math.round(Number(entry.days) || 0));
      if (entry.lastCleanupAt && now - entry.lastCleanupAt < days * oneDayMs) continue;
      removedCount += await cleanupProfileHomepagesForCharacters([characterId], days);
      cleanupSettings[characterId] = { ...entry, days, lastCleanupAt: now };
      settingsChanged = true;
    }

    if (settingsChanged) {
      await saveSettings({ ...settings.value, profileHomepageAutoCleanup: cleanupSettings });
    }
    return removedCount;
  }

  async function saveProfileTheme(theme: ProfileTheme) {
    const existingTheme = profileThemes.value.find((entry) => entry.id === theme.id);
    const normalizedTheme = normalizeProfileTheme({
      ...theme,
      charId: existingTheme?.charId ?? globalSharedLibraryOwnerId,
      enabled: existingTheme?.enabled ?? true,
      updatedAt: Date.now()
    }, existingTheme?.charId ?? globalSharedLibraryOwnerId);
    if (!normalizedTheme) {
      showConfigAlert('请填写主页主题名称和提示词。', '无法保存主页主题');
      return null;
    }

    const index = profileThemes.value.findIndex((entry) => entry.id === normalizedTheme.id);
    if (index >= 0) profileThemes.value[index] = normalizedTheme;
    else profileThemes.value.push(normalizedTheme);
    await putEntity('profileThemes', normalizedTheme);
    await refreshActiveProfileThemeSnapshot(normalizedTheme);
    return normalizedTheme;
  }

  async function importProfileThemes(characterId: string, themes: ProfileTheme[]) {
    const normalizedCharacterId = characterId.trim();
    const importedThemeDrafts = normalizeProfileThemesForCharacter(themes, globalSharedLibraryOwnerId);
    const normalizedThemes = importedThemeDrafts.map((theme) => ({
      ...theme,
      id: createId('profile-theme'),
      charId: globalSharedLibraryOwnerId,
      enabled: true,
      source: 'imported' as const,
      builtIn: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }));
    if (!normalizedThemes.length) return [];
    profileThemes.value.push(...normalizedThemes);
    let nextSettings = settings.value;
    let settingsToPersist: AppSettings | null = null;
    if (nextSettings && normalizedCharacterId) {
      const profileThemeEnabledByCharacter = cloneEnabledByCharacter(nextSettings.profileThemeEnabledByCharacter);
      importedThemeDrafts.forEach((theme, index) => {
        if (theme.enabled !== false) return;
        const savedTheme = normalizedThemes[index];
        if (savedTheme) setEnabledOverrideInPlace(profileThemeEnabledByCharacter, normalizedCharacterId, savedTheme.id, false);
      });
      nextSettings = normalizeAppSettings({ ...nextSettings, profileThemeEnabledByCharacter });
      settings.value = nextSettings;
      settingsToPersist = nextSettings;
    }
    await Promise.all([
      ...normalizedThemes.map((theme) => putEntity('profileThemes', theme)),
      ...(settingsToPersist ? [putEntity('settings', settingsToPersist, 'main')] : [])
    ]);
    return normalizedThemes;
  }

  async function deleteProfileTheme(themeId: string) {
    const theme = profileThemes.value.find((entry) => entry.id === themeId);
    if (!theme || theme.builtIn) return false;
    const targetKey = profileThemeSharedKey(theme);
    const deletedIds = profileThemes.value.filter((entry) => profileThemeSharedKey(entry) === targetKey).map((entry) => entry.id);
    profileThemes.value = profileThemes.value.filter((entry) => !deletedIds.includes(entry.id));
    const nextSettings = settings.value ? normalizeAppSettings({
      ...settings.value,
      profileThemeEnabledByCharacter: removeEnabledOverrideIds(settings.value.profileThemeEnabledByCharacter, deletedIds)
    }) : null;
    if (nextSettings) settings.value = nextSettings;
    await Promise.all([
      ...deletedIds.map((id) => deleteEntity('profileThemes', id)),
      ...(nextSettings ? [putEntity('settings', nextSettings, 'main')] : [])
    ]);
    return true;
  }

  async function createSmallTheaterTopic(payload: Pick<SmallTheaterTopic, 'title' | 'prompt'> & Partial<Pick<SmallTheaterTopic, 'charId' | 'enabled'>>) {
    const now = Date.now();
    const topic = normalizeSmallTheaterTopic({
      ...payload,
      charId: globalSharedLibraryOwnerId,
      enabled: true,
      builtIn: false,
      createdAt: now,
      updatedAt: now
    }, globalSharedLibraryOwnerId);
    if (!topic) {
      showConfigAlert('请填写小剧场题材标题。', '无法保存题材');
      return null;
    }

    smallTheaterTopics.value.push(topic);
    await putEntity('smallTheaterTopics', topic);
    return topic;
  }

  async function saveSmallTheaterTopic(topic: SmallTheaterTopic) {
    const existingTopic = smallTheaterTopics.value.find((entry) => entry.id === topic.id);
    const normalizedTopic = normalizeSmallTheaterTopic({
      ...topic,
      charId: existingTopic?.charId ?? globalSharedLibraryOwnerId,
      enabled: existingTopic?.enabled ?? true,
      updatedAt: Date.now()
    }, existingTopic?.charId ?? globalSharedLibraryOwnerId);
    if (!normalizedTopic) {
      showConfigAlert('请填写小剧场题材标题。', '无法保存题材');
      return null;
    }

    const index = smallTheaterTopics.value.findIndex((entry) => entry.id === normalizedTopic.id);
    if (index >= 0) smallTheaterTopics.value[index] = normalizedTopic;
    else smallTheaterTopics.value.push(normalizedTopic);
    await putEntity('smallTheaterTopics', normalizedTopic);
    return normalizedTopic;
  }

  async function deleteSmallTheaterTopic(topicId: string) {
    const topic = smallTheaterTopics.value.find((entry) => entry.id === topicId);
    if (!topic) return false;
    const targetKey = smallTheaterTopicSharedKey(topic);
    const deletedIds = smallTheaterTopics.value.filter((entry) => smallTheaterTopicSharedKey(entry) === targetKey).map((entry) => entry.id);
    smallTheaterTopics.value = smallTheaterTopics.value.filter((entry) => !deletedIds.includes(entry.id));
    const nextSettings = settings.value ? normalizeAppSettings({
      ...settings.value,
      smallTheaterTopicEnabledByCharacter: removeEnabledOverrideIds(settings.value.smallTheaterTopicEnabledByCharacter, deletedIds)
    }) : null;
    if (nextSettings) settings.value = nextSettings;
    await Promise.all([
      ...deletedIds.map((id) => deleteEntity('smallTheaterTopics', id)),
      ...(nextSettings ? [putEntity('settings', nextSettings, 'main')] : [])
    ]);
    return true;
  }

  async function setProfileThemeEnabledForCharacter(characterId: string, themeId: string, enabled: boolean) {
    const normalizedCharacterId = characterId.trim();
    const normalizedThemeId = themeId.trim();
    if (!settings.value || !normalizedCharacterId || !normalizedThemeId || !profileThemes.value.some((theme) => theme.id === normalizedThemeId)) return false;
    const profileThemeEnabledByCharacter = cloneEnabledByCharacter(settings.value.profileThemeEnabledByCharacter);
    setEnabledOverrideInPlace(profileThemeEnabledByCharacter, normalizedCharacterId, normalizedThemeId, enabled);
    await saveSettings({ ...settings.value, profileThemeEnabledByCharacter });
    return true;
  }

  async function setSmallTheaterTopicEnabledForCharacter(characterId: string, topicId: string, enabled: boolean) {
    const normalizedCharacterId = characterId.trim();
    const normalizedTopicId = topicId.trim();
    if (!settings.value || !normalizedCharacterId || !normalizedTopicId || !smallTheaterTopics.value.some((topic) => topic.id === normalizedTopicId)) return false;
    const smallTheaterTopicEnabledByCharacter = cloneEnabledByCharacter(settings.value.smallTheaterTopicEnabledByCharacter);
    setEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, normalizedCharacterId, normalizedTopicId, enabled);
    await saveSettings({ ...settings.value, smallTheaterTopicEnabledByCharacter });
    return true;
  }

  async function setSmallTheaterTopicsEnabledForCharacter(characterId: string, topicIds: string[], enabled: boolean) {
    const normalizedCharacterId = characterId.trim();
    if (!settings.value || !normalizedCharacterId) return false;
    const existingTopicIds = new Set(smallTheaterTopics.value.map((topic) => topic.id));
    const normalizedTopicIds = [...new Set(topicIds.map((topicId) => topicId.trim()).filter((topicId) => existingTopicIds.has(topicId)))];
    if (!normalizedTopicIds.length) return false;
    const smallTheaterTopicEnabledByCharacter = cloneEnabledByCharacter(settings.value.smallTheaterTopicEnabledByCharacter);
    normalizedTopicIds.forEach((topicId) => {
      setEnabledOverrideInPlace(smallTheaterTopicEnabledByCharacter, normalizedCharacterId, topicId, enabled);
    });
    await saveSettings({ ...settings.value, smallTheaterTopicEnabledByCharacter });
    return true;
  }

  async function deleteSmallTheater(theaterId: string) {
    const theater = smallTheaters.value.find((entry) => entry.id === theaterId);
    if (!theater) return false;
    smallTheaters.value = smallTheaters.value.filter((entry) => entry.id !== theaterId);
    await deleteEntity('smallTheaters', theaterId);
    queueStoredMediaPrune();
    return true;
  }

  function smallTheatersForCleanup(characterIds: string[], olderThanDays: number) {
    const characterIdSet = new Set(characterIds.map((id) => id.trim()).filter(Boolean));
    const days = Math.max(1, Math.round(Number(olderThanDays) || 0));
    if (!characterIdSet.size || !days) return [];
    const cutoff = Date.now() - days * oneDayMs;
    return smallTheaters.value.filter((theater) => characterIdSet.has(theater.charId) && (theater.updatedAt ?? theater.createdAt) < cutoff);
  }

  async function cleanupSmallTheatersForCharacters(characterIds: string[], olderThanDays: number) {
    const theatersToDelete = smallTheatersForCleanup(characterIds, olderThanDays);
    for (const theater of theatersToDelete) {
      await deleteSmallTheater(theater.id);
    }
    return theatersToDelete.length;
  }

  async function runSmallTheaterAutoCleanupForCharacters(characterIds: string[]) {
    if (!settings.value) return 0;
    const now = Date.now();
    const cleanupSettings = { ...settings.value.smallTheaterAutoCleanup };
    let removedCount = 0;
    let settingsChanged = false;

    for (const characterId of characterIds.map((id) => id.trim()).filter(Boolean)) {
      const entry = cleanupSettings[characterId];
      if (!entry?.enabled) continue;
      const days = Math.max(1, Math.round(Number(entry.days) || 0));
      if (entry.lastCleanupAt && now - entry.lastCleanupAt < days * oneDayMs) continue;
      removedCount += await cleanupSmallTheatersForCharacters([characterId], days);
      cleanupSettings[characterId] = { ...entry, days, lastCleanupAt: now };
      settingsChanged = true;
    }

    if (settingsChanged) {
      await saveSettings({ ...settings.value, smallTheaterAutoCleanup: cleanupSettings });
    }
    return removedCount;
  }

  async function saveCoupleSpaceState(characterId: string, nextState: CoupleSpaceState) {
    const character = characterById(characterId);
    const coupleSpace = normalizeCoupleSpaceState(nextState);
    if (!character || !coupleSpace) return null;
    await saveCharacterSnapshot({ ...character, coupleSpace });
    return coupleSpace;
  }

  async function refreshCoupleSpace(conversationId: string) {
    const conversation = conversationById(conversationId);
    if (!conversation) return null;
    const character = characterById(conversation.charId);
    if (!character?.coupleSpace?.consentGrantedAt) {
      showConfigAlert('请先确认双方自愿共享，再同步情侣空间。', '需要共享授权');
      return null;
    }
    const boundUser = userById(conversation.userId || character.boundUserId) ?? user.value;
    if (!boundUser) return null;
    const chatSettings = settingsForConversation(conversationId);
    const modelOverride = getGlobalTextModelOverride('content');
    if (!hasConfiguredTextModel(modelOverride)) {
      showConfigAlert('请先在设置的模型切换中配置全局内容创作模型，再同步情侣空间。', '需要配置模型');
      return null;
    }

    const visibleMessages = visibleMessagesForConversation(conversationId);
    const snapshot = await generateCoupleSpaceSnapshot({
      context: {
        user: boundUser,
        character,
        boundUser,
        mode: conversation.activeMode,
        messages: visibleMessages,
        worldBooks: worldBooks.value,
        conversationSummary: conversation.summary,
        memorySummary: await memoryContextForConversationAsync(conversationId, visibleMessages.slice(-10).map((message) => messageReadableContent(message)).join('\n'), {
          embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings)
        }),
        stickerVisionEnabled: chatSettings.stickerVisionEnabled,
        timeAwareness: chatSettings.timeAwareness,
        timeAwarenessNow: Date.now(),
        musicListening: musicListeningContextForConversation(conversationId)
      },
      previousSnapshot: character.coupleSpace.snapshot,
      settings: settings.value ?? undefined,
      modelOverride
    });
    const latestCharacter = characterById(character.id) ?? character;
    const currentState = normalizeCoupleSpaceState(latestCharacter.coupleSpace) ?? character.coupleSpace;
    const history = [
      ...(currentState.snapshot ? [currentState.snapshot] : []),
      ...currentState.history
    ].filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 11);
    await saveCoupleSpaceState(character.id, { ...currentState, snapshot, history });
    return snapshot;
  }

  async function createSmallTheaterFromConversation(conversationId: string, topicId?: string, options?: { silent?: boolean }) {
    const conversation = conversationById(conversationId);
    if (generatingSmallTheaterConversationIds.has(conversationId)) return null;
    if (!conversation) return null;
    const character = characterById(conversation.charId);
    if (!character) return null;
    const boundUser = userById(character.boundUserId) ?? user.value;
    if (!boundUser) return null;
    const chatSettings = settingsForConversation(conversationId);
    const modelOverride = getConversationTextModelOverride(chatSettings, 'theater');
    if (!hasConfiguredTextModel(modelOverride)) {
      if (!options?.silent) showConfigAlert('请先在聊天菜单里配置小剧场模型，或在设置里配置全局默认 API 模型。', '需要配置 API 模型');
      return null;
    }

    const topics = await ensureSmallTheaterTopicsForCharacter(character.id);
    const selectedTopic = topicId
      ? topics.find((topic) => topic.id === topicId)
      : (() => {
          const enabledTopics = topics.filter((topic) => topic.enabled);
          return enabledTopics[Math.floor(Math.random() * enabledTopics.length)] ?? null;
        })();
    if (!selectedTopic) {
      if (!options?.silent) showConfigAlert('请先开启或新增一个小剧场题材。', '无法生成小剧场');
      return null;
    }

    generatingSmallTheaterConversationIds.add(conversationId);
    try {
      const visibleMessages = visibleMessagesForConversation(conversationId);
      const recentVoomPosts = voomPosts.value
        .filter((post) => post.authorType !== 'user' && (post.charId === character.id || post.conversationId === conversationId || post.conversationIds?.includes(conversationId)))
        .sort((first, second) => second.createdAt - first.createdAt)
        .slice(0, 16);
      const result = await generateSmallTheater({
        context: {
          user: boundUser,
          character,
          boundUser,
          mode: conversation.activeMode,
          messages: visibleMessages,
          recentVoomPosts,
          worldBooks: worldBooks.value,
          conversationSummary: conversation.summary,
          memorySummary: await memoryContextForConversationAsync(conversationId, visibleMessages.slice(-8).map((message) => messageReadableContent(message)).join('\n'), {
            embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings)
          }),
          stickerVisionEnabled: chatSettings.stickerVisionEnabled,
          timeAwareness: chatSettings.timeAwareness,
          musicListening: musicListeningContextForConversation(conversationId)
        },
        topic: selectedTopic,
        settings: settings.value ?? undefined,
        modelOverride
      });
      const theater: SmallTheater = {
        id: createId('theater'),
        charId: character.id,
        conversationId: conversation.id,
        topicId: selectedTopic.id,
        topicTitle: selectedTopic.title,
        authorName: getCharacterAiName(character),
        authorAvatar: character.avatar,
        title: result.title,
        summary: result.summary,
        html: result.html,
        model: result.model,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      smallTheaters.value.unshift(theater);
      await putEntity('smallTheaters', theater);
      void playRingtone(settings.value, 'theater', character.id);
      void showLinkNotification(settings.value?.keepAlive, {
        kind: 'message',
        title: `${theater.authorName} 生成了小剧场`,
        body: notificationPreview(theater.summary, theater.title || '新的小剧场已生成'),
        tag: `link-theater-${theater.id}`,
        icon: theater.authorAvatar || character.avatar,
        url: createSmallTheaterUrl(theater.id)
      });
      return theater;
    } finally {
      generatingSmallTheaterConversationIds.delete(conversationId);
    }
  }

  async function continueSmallTheater(theaterId: string, updateGuidance?: string) {
    const theater = smallTheaterById(theaterId);
    if (!theater) return null;
    const lockKey = `theater:${theater.id}`;
    if (generatingSmallTheaterConversationIds.has(lockKey)) return null;
    const conversation = theater.conversationId ? conversationById(theater.conversationId) : conversations.value.find((entry) => entry.charId === theater.charId);
    if (!conversation) return null;
    const character = characterById(theater.charId) ?? characterById(conversation.charId);
    if (!character) return null;
    const boundUser = userById(character.boundUserId) ?? user.value;
    if (!boundUser) return null;
    const chatSettings = settingsForConversation(conversation.id);
    const modelOverride = getConversationTextModelOverride(chatSettings, 'theater');
    if (!hasConfiguredTextModel(modelOverride)) {
      showConfigAlert('请先在聊天菜单里配置小剧场模型，或在设置里配置全局默认 API 模型。', '需要配置 API 模型');
      return null;
    }

    const topics = await ensureSmallTheaterTopicsForCharacter(character.id);
    const now = Date.now();
    const selectedTopic = topics.find((topic) => topic.id === theater.topicId)
      ?? topics.find((topic) => topic.title === theater.topicTitle)
      ?? {
        id: theater.topicId || createId('topic'),
        charId: character.id,
        title: theater.topicTitle || '根据剧情随机发挥',
        prompt: theater.topicTitle || '根据原小剧场继续更新后续内容。',
        enabled: true,
        createdAt: theater.createdAt,
        updatedAt: now
      } satisfies SmallTheaterTopic;

    generatingSmallTheaterConversationIds.add(lockKey);
    try {
      const visibleMessages = visibleMessagesForConversation(conversation.id);
      const recentVoomPosts = voomPosts.value
        .filter((post) => post.authorType !== 'user' && (post.charId === character.id || post.conversationId === conversation.id || post.conversationIds?.includes(conversation.id)))
        .sort((first, second) => second.createdAt - first.createdAt)
        .slice(0, 16);
      const result = await generateSmallTheater({
        context: {
          user: boundUser,
          character,
          boundUser,
          mode: conversation.activeMode,
          messages: visibleMessages,
          recentVoomPosts,
          worldBooks: worldBooks.value,
          conversationSummary: conversation.summary,
          memorySummary: await memoryContextForConversationAsync(conversation.id, visibleMessages.slice(-8).map((message) => messageReadableContent(message)).join('\n'), {
            embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings)
          }),
          stickerVisionEnabled: chatSettings.stickerVisionEnabled,
          timeAwareness: chatSettings.timeAwareness,
          musicListening: musicListeningContextForConversation(conversation.id)
        },
        topic: selectedTopic,
        sourceTheater: theater,
        continuationGuidance: updateGuidance?.trim() || undefined,
        recentTheaters: smallTheatersForCharacter(character.id).filter((entry) => entry.id !== theater.id).slice(0, 8),
        settings: settings.value ?? undefined,
        modelOverride
      });
      const createdAt = Date.now();
      const nextTheater: SmallTheater = {
        id: createId('theater'),
        charId: character.id,
        conversationId: conversation.id,
        topicId: selectedTopic.id,
        topicTitle: selectedTopic.title,
        authorName: getCharacterAiName(character),
        authorAvatar: character.avatar,
        title: result.title,
        summary: result.summary,
        html: result.html,
        model: result.model,
        createdAt,
        updatedAt: createdAt
      };
      smallTheaters.value.unshift(nextTheater);
      await putEntity('smallTheaters', nextTheater);
      return nextTheater;
    } finally {
      generatingSmallTheaterConversationIds.delete(lockKey);
    }
  }

  async function forwardSmallTheaterToCharacter(theaterId: string, targetCharacterId: string) {
    const theater = smallTheaterById(theaterId);
    const targetCharacter = characterById(targetCharacterId);
    if (!theater || !targetCharacter) return null;
    const boundUser = userById(targetCharacter.boundUserId) ?? user.value;
    if (!boundUser) return null;
    const targetConversation = conversations.value.find((conversation) => conversation.charId === targetCharacter.id && conversation.userId === boundUser.id)
      ?? conversations.value.find((conversation) => conversation.charId === targetCharacter.id);
    if (!targetConversation) {
      showConfigAlert('没有找到这个角色的线上会话，暂时无法转发。', '无法转发小剧场');
      return null;
    }
    return appendUserSmallTheaterLinkMessage(targetConversation.id, theater);
  }

  function getVoomImageSizeLabel(provider: ImageModuleId) {
    if (!settings.value) return '720x1280';
    return getImageGenerationSize(settings.value, provider).size;
  }

  function isVoomPortraitPromptRequired(characterId = '') {
    return characterById(characterId)?.imageProfile?.voomPortraitModeEnabled !== false;
  }

  function buildVoomPortraitPrompt(post: VoomPost) {
    if (!isVoomPortraitPromptRequired(post.charId)) return '';
    const authorName = voomAuthorNameForPost(post).trim();
    const subject = authorName ? `发布角色「${authorName}」本人` : '发布角色本人';
    return [
      `VOOM 人像模式开启：图片必须以${subject}为明确主体`,
      '必须生成清晰可见的人像、半身像或全身像，人物占据画面主要视觉焦点',
      '即使描述包含环境、物品或氛围，也要把人物放在前景主体位置，不能生成纯风景、纯物品、抽象图、空镜或无人物画面'
    ].join(', ');
  }

  function normalizePromptPieces(...pieces: Array<string | undefined>) {
    return pieces.map((piece) => String(piece ?? '').trim()).filter(Boolean).join('\n');
  }

  function fillImageSceneTemplate(template: string, values: Record<string, string>) {
    const source = template.trim() || '{basePrompt}\n{characterAppearance}\n{faceConsistency}\n{generationPrompt}\n{sceneDescription}';
    return source.replace(/\{(basePrompt|sceneDescription|generationPrompt|characterAppearance|faceConsistency|postContent)\}/g, (_match, key: string) => values[key] ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n');
  }

  function getImageCharacterProfile(characterId: string) {
    const character = characterById(characterId);
    return character?.imageProfile;
  }

  function buildCharacterAppearancePrompt(characterId: string) {
    const imageProfile = getImageCharacterProfile(characterId);
    return normalizePromptPieces(
      imageProfile?.appearancePrompt ? `Character appearance: ${imageProfile.appearancePrompt}` : '',
      imageProfile?.facePrompt ? `Face identity lock: ${imageProfile.facePrompt}` : ''
    );
  }

  function getCharacterImageReference(characterId: string) {
    const imageProfile = getImageCharacterProfile(characterId);
    if (!imageProfile?.referenceImageEnabled) return '';
    return imageProfile.referenceImage.trim();
  }

  function getCharacterImageSeed(characterId: string) {
    return getImageCharacterProfile(characterId)?.seed.trim() ?? '';
  }

  function buildImageNegativePrompt(basePrompt: string, defaultNegativePrompt = '', extraNegativePrompt = '') {
    return normalizePromptPieces(basePrompt, defaultNegativePrompt, extraNegativePrompt);
  }

  function buildLocalImageGenerationPrompt(sceneDescription: string, scope: 'onlineChat' | 'voom', characterId: string, post?: VoomPost) {
    const character = characterById(characterId);
    const authorName = character ? getCharacterAiName(character) : 'the character';
    const scopeText = scope === 'voom'
      ? `A casual LINK VOOM social feed image posted by ${authorName}.`
      : `A private mobile chat image sent by ${authorName}.`;
    return normalizePromptPieces(
      scopeText,
      post?.content ? `Post text context: ${post.content}` : '',
      `Scene: ${sceneDescription}`
    );
  }

  function buildFinalImagePrompt(input: {
    scope: 'onlineChat' | 'voom';
    characterId: string;
    description: string;
    generationPrompt?: string;
    basePrompt: string;
    template?: string;
    post?: VoomPost;
  }) {
    const generationPrompt = String(input.generationPrompt ?? '').trim() || buildLocalImageGenerationPrompt(input.description, input.scope, input.characterId, input.post);
    const characterAppearance = buildCharacterAppearancePrompt(input.characterId);
    const faceConsistency = getCharacterImageReference(input.characterId)
      ? 'Use the character reference image as identity guidance; keep the same facial structure, eyes, nose, mouth, hairstyle, and overall likeness across generations.'
      : 'Keep the same character identity and consistent facial features across generations.';
    const postContent = input.post?.content?.trim() ?? '';
    const templatePrompt = fillImageSceneTemplate(input.template ?? '', {
      basePrompt: input.basePrompt,
      sceneDescription: input.description,
      generationPrompt,
      characterAppearance,
      faceConsistency,
      postContent
    });
    const voomPortraitPrompt = input.scope === 'voom' ? buildVoomPortraitPrompt(input.post ?? {} as VoomPost) : '';
    return {
      generationPrompt,
      positivePrompt: normalizePromptPieces(templatePrompt, voomPortraitPrompt)
    };
  }

  async function generateChatImageCandidate(description: string, generationPrompt = '', characterId = '') {
    const imageDescription = description.trim();
    const selectedModel = getSelectedImageModelOption(settings.value, 'onlineChat');
    if (!imageDescription || !settings.value || !selectedModel) return null;

    const provider = selectedModel.provider;
    const promptPreset = getImagePromptPresetForProvider(settings.value, provider);
    const promptBundle = buildFinalImagePrompt({
      scope: 'onlineChat',
      characterId,
      description: imageDescription,
      generationPrompt,
      basePrompt: promptPreset.positivePrompt,
      template: promptPreset.onlineChatTemplate
    });
    const referenceImage = getCharacterImageReference(characterId);
    const seed = getCharacterImageSeed(characterId);
    const negativePrompt = buildImageNegativePrompt(promptPreset.negativePrompt, promptPreset.defaultNegativePrompt);
    const imageSize = getImageGenerationSize(settings.value, provider);
    let imageSettings = settings.value;
    const imageOverrides = {
      positivePrompt: promptBundle.positivePrompt,
      negativePrompt,
      referenceImage,
      size: imageSize.size,
      width: imageSize.width,
      height: imageSize.height,
      model: selectedModel.model,
      seed
    };

    if (provider === 'openai') {
      const [vendorId, ...modelParts] = selectedModel.model.split('::');
      imageSettings = {
        ...settings.value,
        imageOpenAi: {
          ...settings.value.imageOpenAi,
          activeVendorId: vendorId || settings.value.imageOpenAi.activeVendorId
        }
      };
      imageOverrides.model = modelParts.join('::') || settings.value.imageModel;
    }

    const result = await generateImageByProvider(provider, imageSettings, imageOverrides);
    const imageUrl = result.imageUrl;
    return createChatImageCandidate({
      image: imageUrl,
      description: imageDescription,
      generationPrompt: promptBundle.generationPrompt,
      negativePrompt,
      referenceImage,
      seed,
      provider: result.provider,
      model: selectedModel.label,
      size: getVoomImageSizeLabel(result.provider)
    });
  }

  function imageAttachmentFromCandidate(candidate: ChatImageCandidate): ChatImageAttachment {
    return {
      kind: 'generated',
      description: candidate.description,
      generationPrompt: candidate.generationPrompt,
      negativePrompt: candidate.negativePrompt,
      referenceImage: candidate.referenceImage,
      seed: candidate.seed,
      url: candidate.image,
      provider: candidate.provider,
      model: candidate.model,
      size: candidate.size,
      candidates: [candidate],
      ...imageSizeToDimensions(candidate.size)
    };
  }

  function createChatImageDescriptionAttachment(description: string): ChatImageAttachment {
    return {
      kind: 'description',
      description,
      provider: 'mock'
    };
  }

  async function createCharacterImageAttachment(description: string, generationPrompt = '', characterId = '') {
    const imageDescription = description.trim();
    if (!imageDescription) return null;
    try {
      const candidate = await generateChatImageCandidate(imageDescription, generationPrompt, characterId);
      return candidate ? imageAttachmentFromCandidate(candidate) : createChatImageDescriptionAttachment(imageDescription);
    } catch (error) {
      showConfigAlert(error instanceof Error ? error.message : '聊天图片生成失败，已改为文字描述卡片。', '无法生成聊天图片');
      return createChatImageDescriptionAttachment(imageDescription);
    }
  }

  async function updateChatMessageImage(messageId: string, image: ChatImageAttachment) {
    const messageIndex = messages.value.findIndex((message) => message.id === messageId);
    if (messageIndex < 0) return null;
    const existingMessage = messages.value[messageIndex];
    const nextMessage: ChatMessage = {
      ...existingMessage,
      content: `[图片] ${image.description}`,
      image
    };
    messages.value[messageIndex] = nextMessage;
    await putEntity('messages', nextMessage);
    return nextMessage;
  }

  async function regenerateChatMessageImage(messageId: string, description: string) {
    const normalizedMessageId = messageId.trim();
    const imageDescription = description.trim();
    if (regeneratingChatImageMessageIds.has(normalizedMessageId)) {
      showConfigAlert('正在重新生成聊天图片，请等待当前生成完成。', '正在生成');
      return null;
    }
    const existingMessage = messages.value.find((message) => message.id === normalizedMessageId);
    if (!existingMessage?.image || !imageDescription) return null;
    if (!getSelectedImageModelOption(settings.value, 'onlineChat')) {
      showConfigAlert('请先在生图模型切换里选择一个已配置的生图模型。', '无法生成图片');
      return null;
    }
    regeneratingChatImageMessageIds.add(normalizedMessageId);
    try {
      const imageGenerationPrompt = existingMessage.image.generationPrompt ?? existingMessage.image.candidates?.at(-1)?.generationPrompt ?? '';
      const characterId = conversationById(existingMessage.conversationId)?.charId ?? '';
      const candidate = await generateChatImageCandidate(imageDescription, imageGenerationPrompt, characterId);
      if (!candidate) return null;
      const candidates = [...(existingMessage.image.candidates ?? []), candidate];
      return updateChatMessageImage(normalizedMessageId, {
        ...imageAttachmentFromCandidate(candidate),
        candidates
      });
    } catch (error) {
      showConfigAlert(error instanceof Error ? error.message : '聊天图片生成失败。', '无法生成图片');
      return null;
    } finally {
      regeneratingChatImageMessageIds.delete(normalizedMessageId);
    }
  }

  async function applyChatMessageImageCandidate(messageId: string, candidateId: string) {
    const normalizedMessageId = messageId.trim();
    if (regeneratingChatImageMessageIds.has(normalizedMessageId)) {
      showConfigAlert('正在重新生成聊天图片，请等待当前生成完成。', '正在生成');
      return null;
    }
    const existingMessage = messages.value.find((message) => message.id === normalizedMessageId);
    const candidate = existingMessage?.image?.candidates?.find((entry) => entry.id === candidateId);
    if (!existingMessage?.image || !candidate) return null;
    return updateChatMessageImage(normalizedMessageId, {
      ...imageAttachmentFromCandidate(candidate),
      candidates: existingMessage.image.candidates
    });
  }

  async function regenerateVoomPostImage(postId: string, description: string) {
    const normalizedPostId = postId.trim();
    if (regeneratingVoomImagePostIds.has(normalizedPostId)) {
      showConfigAlert('正在重新生成 VOOM 配图，请等待当前生成完成。', '正在生成');
      return null;
    }
    const post = voomPosts.value.find((entry) => entry.id === normalizedPostId);
    const selectedModel = getSelectedImageModelOption(settings.value, 'voom');
    const imageDescription = description.trim();
    if (!post || !settings.value) return null;
    if (!imageDescription) {
      showConfigAlert('请先填写 VOOM 配图描述。', '无法生成配图');
      return null;
    }
    if (!selectedModel) {
      showConfigAlert(isImageModelSelectionDisabled(settings.value.imageModelOverrides.voom)
        ? 'VOOM 生图已关闭，请先在生图模型切换里改回可用模型。'
        : '请先在生图模型切换里选择一个已配置的生图模型。', '无法生成配图');
      return null;
    }

    regeneratingVoomImagePostIds.add(normalizedPostId);
    const provider = selectedModel.provider;
    const promptPreset = getImagePromptPresetForProvider(settings.value, provider);
    const promptBundle = buildFinalImagePrompt({
      scope: 'voom',
      characterId: post.charId,
      description: imageDescription,
      generationPrompt: post.imageGenerationPrompt,
      basePrompt: promptPreset.positivePrompt,
      template: promptPreset.voomTemplate,
      post
    });
    const referenceImage = getCharacterImageReference(post.charId);
    const seed = getCharacterImageSeed(post.charId);
    const negativePrompt = buildImageNegativePrompt(
      promptPreset.negativePrompt,
      promptPreset.defaultNegativePrompt,
      isVoomPortraitPromptRequired(post.charId) ? 'no person, empty scene, scenery only, object only, abstract image, background only, missing person' : ''
    );
    const imageSize = getImageGenerationSize(settings.value, provider);
    let imageSettings = settings.value;
    const imageOverrides = {
      positivePrompt: promptBundle.positivePrompt,
      negativePrompt,
      referenceImage,
      size: imageSize.size,
      width: imageSize.width,
      height: imageSize.height,
      model: selectedModel.model,
      seed
    };

    if (provider === 'openai') {
      const [vendorId, ...modelParts] = selectedModel.model.split('::');
      imageSettings = {
        ...settings.value,
        imageOpenAi: {
          ...settings.value.imageOpenAi,
          activeVendorId: vendorId || settings.value.imageOpenAi.activeVendorId
        }
      };
      imageOverrides.model = modelParts.join('::') || settings.value.imageModel;
    }

    try {
      const result = await generateImageByProvider(provider, imageSettings, imageOverrides);
      const imageUrl = result.imageUrl;
      const latestPost = voomPosts.value.find((entry) => entry.id === normalizedPostId);
      if (!latestPost) return null;
      const nextCandidate = createVoomImageCandidate({
        image: imageUrl,
        description: imageDescription,
        generationPrompt: promptBundle.generationPrompt,
        negativePrompt,
        referenceImage,
        seed,
        provider: result.provider,
        model: selectedModel.label,
        size: getVoomImageSizeLabel(result.provider)
      });
      const nextPost = {
        ...latestPost,
        image: imageUrl,
        imageDescription,
        imageGenerationPrompt: promptBundle.generationPrompt,
        imageNegativePrompt: negativePrompt,
        imageReferenceImage: referenceImage,
        imageSeed: seed,
        imageProvider: result.provider,
        imageCandidates: [...(latestPost.imageCandidates ?? []), nextCandidate]
      };
      await saveVoomPost(nextPost);
      await addGeneratedImage({
        provider: result.provider,
        imageUrl,
        title: `${voomAuthorNameForPost(latestPost)} 的 VOOM 配图`,
        prompt: promptBundle.positivePrompt,
        negativePrompt,
        model: selectedModel.label,
        size: nextCandidate.size || getVoomImageSizeLabel(result.provider),
        source: 'voom'
      });
      return nextPost;
    } catch (error) {
      const latestPost = voomPosts.value.find((entry) => entry.id === normalizedPostId);
      if (!latestPost) return null;
      if (!latestPost.image) {
        await saveVoomPost({
          ...latestPost,
          image: '/load.jpg',
          imageDescription,
          imageProvider: 'local'
        });
      }
      showConfigAlert(error instanceof Error ? error.message : 'VOOM 配图生成失败。', '无法生成配图');
      return null;
    } finally {
      regeneratingVoomImagePostIds.delete(normalizedPostId);
    }
  }

  function stripVoomPostImageIntent(post: VoomPost): VoomPost {
    return {
      ...post,
      image: undefined,
      imageDescription: undefined,
      imageGenerationPrompt: undefined,
      imageNegativePrompt: undefined,
      imageReferenceImage: undefined,
      imageSeed: undefined,
      imageProvider: undefined,
      imageCandidates: undefined
    };
  }

  function shouldGenerateVoomPostImage(chatSettings: ConversationSettings) {
    if (chatSettings.voomImageMode === 'character-choice') return true;
    return chatSettings.voomImageEnabled && shouldAutoGenerateMoment(chatSettings.voomImageFrequency);
  }

  async function generateVoomPostImageBeforePublish(post: VoomPost, chatSettings: ConversationSettings) {
    const imageDescription = post.imageDescription?.trim() ?? '';
    if (!imageDescription || !shouldGenerateVoomPostImage(chatSettings)) return stripVoomPostImageIntent(post);
    const selectedModel = getSelectedImageModelOption(settings.value, 'voom');
    if (!settings.value || !selectedModel || !imageDescription) return post;

    regeneratingVoomImagePostIds.add(post.id);
    const provider = selectedModel.provider;
    const promptPreset = getImagePromptPresetForProvider(settings.value, provider);
    const promptBundle = buildFinalImagePrompt({
      scope: 'voom',
      characterId: post.charId,
      description: imageDescription,
      generationPrompt: post.imageGenerationPrompt,
      basePrompt: promptPreset.positivePrompt,
      template: promptPreset.voomTemplate,
      post
    });
    const referenceImage = getCharacterImageReference(post.charId);
    const seed = getCharacterImageSeed(post.charId);
    const negativePrompt = buildImageNegativePrompt(
      promptPreset.negativePrompt,
      promptPreset.defaultNegativePrompt,
      isVoomPortraitPromptRequired(post.charId) ? 'no person, empty scene, scenery only, object only, abstract image, background only, missing person' : ''
    );
    const imageSize = getImageGenerationSize(settings.value, provider);
    let imageSettings = settings.value;
    const imageOverrides = {
      positivePrompt: promptBundle.positivePrompt,
      negativePrompt,
      referenceImage,
      size: imageSize.size,
      width: imageSize.width,
      height: imageSize.height,
      model: selectedModel.model,
      seed
    };

    if (provider === 'openai') {
      const [vendorId, ...modelParts] = selectedModel.model.split('::');
      imageSettings = {
        ...settings.value,
        imageOpenAi: {
          ...settings.value.imageOpenAi,
          activeVendorId: vendorId || settings.value.imageOpenAi.activeVendorId
        }
      };
      imageOverrides.model = modelParts.join('::') || settings.value.imageModel;
    }

    try {
      const result = await generateImageByProvider(provider, imageSettings, imageOverrides);
      const imageUrl = result.imageUrl;
      const nextCandidate = createVoomImageCandidate({
        image: imageUrl,
        description: imageDescription,
        generationPrompt: promptBundle.generationPrompt,
        negativePrompt,
        referenceImage,
        seed,
        provider: result.provider,
        model: selectedModel.label,
        size: getVoomImageSizeLabel(result.provider)
      });
      const nextPost: VoomPost = {
        ...post,
        image: imageUrl,
        imageDescription,
        imageGenerationPrompt: promptBundle.generationPrompt,
        imageNegativePrompt: negativePrompt,
        imageReferenceImage: referenceImage,
        imageSeed: seed,
        imageProvider: result.provider,
        imageCandidates: [...(post.imageCandidates ?? []), nextCandidate]
      };
      await addGeneratedImage({
        provider: result.provider,
        imageUrl,
        title: `${voomAuthorNameForPost(post)} 的 VOOM 配图`,
        prompt: promptBundle.positivePrompt,
        negativePrompt,
        model: selectedModel.label,
        size: nextCandidate.size || getVoomImageSizeLabel(result.provider),
        source: 'voom'
      });
      return nextPost;
    } catch (error) {
      showConfigAlert(error instanceof Error ? error.message : 'VOOM 配图生成失败。', '无法生成配图');
      if (post.image) return post;
      return {
        ...post,
        image: '/load.jpg',
        imageDescription,
        imageProvider: 'local'
      } satisfies VoomPost;
    } finally {
      regeneratingVoomImagePostIds.delete(post.id);
    }
  }

  async function applyVoomPostImageCandidate(postId: string, candidateId: string) {
    const normalizedPostId = postId.trim();
    if (regeneratingVoomImagePostIds.has(normalizedPostId)) {
      showConfigAlert('正在重新生成 VOOM 配图，请等待当前生成完成。', '正在生成');
      return null;
    }
    const post = voomPosts.value.find((entry) => entry.id === normalizedPostId);
    const candidate = post?.imageCandidates?.find((entry) => entry.id === candidateId);
    if (!post || !candidate?.image) return null;
    const nextPost: VoomPost = {
      ...post,
      image: candidate.image,
      imageDescription: candidate.description || post.imageDescription,
      imageProvider: candidate.provider || post.imageProvider,
      imageCandidates: post.imageCandidates
    };
    await saveVoomPost(nextPost);
    return nextPost;
  }

  function hasVoomPost(postId: string) {
    return voomPosts.value.some((entry) => entry.id === postId);
  }

  async function saveVoomPost(nextPost: VoomPost) {
    const persistablePost = createPersistableVoomPost(nextPost);
    const index = voomPosts.value.findIndex((post) => post.id === nextPost.id);
    if (index >= 0) voomPosts.value[index] = persistablePost;
    else voomPosts.value.unshift(persistablePost);
    await putEntity('voomPosts', persistablePost);
  }

  async function deleteVoomPost(postId: string) {
    const normalizedPostId = postId.trim();
    const post = voomPosts.value.find((entry) => entry.id === normalizedPostId);
    if (!post) return false;

    const relatedMessageIds = messages.value
      .filter((message) => message.voomPostId === normalizedPostId)
      .map((message) => message.id);

    voomPosts.value = voomPosts.value.filter((entry) => entry.id !== normalizedPostId);
    replyingVoomCommentPostIds.value = replyingVoomCommentPostIds.value.filter((id) => id !== normalizedPostId);

    await Promise.all([
      deleteEntity('voomPosts', normalizedPostId),
      relatedMessageIds.length ? deleteMessages(relatedMessageIds) : Promise.resolve(0)
    ]);
    queueStoredMediaPrune();
    return true;
  }

  function voomPostsForCleanup(characterIds: string[], olderThanDays: number) {
    const characterIdSet = new Set(characterIds.map((id) => id.trim()).filter(Boolean));
    const days = Math.max(1, Math.round(Number(olderThanDays) || 0));
    if (!characterIdSet.size || !days) return [];
    const cutoff = Date.now() - days * oneDayMs;
    return voomPosts.value.filter((post) => post.authorType !== 'user' && characterIdSet.has(post.charId) && post.createdAt < cutoff);
  }

  async function cleanupVoomPostsForCharacters(characterIds: string[], olderThanDays: number) {
    const postsToDelete = voomPostsForCleanup(characterIds, olderThanDays);
    for (const post of postsToDelete) {
      await deleteVoomPost(post.id);
    }
    return postsToDelete.length;
  }

  async function runVoomAutoCleanupForCharacters(characterIds: string[]) {
    if (!settings.value) return 0;
    const now = Date.now();
    const cleanupSettings = { ...settings.value.voomAutoCleanup };
    let removedCount = 0;
    let settingsChanged = false;

    for (const characterId of characterIds.map((id) => id.trim()).filter(Boolean)) {
      const entry = cleanupSettings[characterId];
      if (!entry?.enabled) continue;
      const days = Math.max(1, Math.round(Number(entry.days) || 0));
      if (entry.lastCleanupAt && now - entry.lastCleanupAt < days * oneDayMs) continue;
      removedCount += await cleanupVoomPostsForCharacters([characterId], days);
      cleanupSettings[characterId] = { ...entry, days, lastCleanupAt: now };
      settingsChanged = true;
    }

    if (settingsChanged) {
      await saveSettings({ ...settings.value, voomAutoCleanup: cleanupSettings });
    }
    return removedCount;
  }

  async function addVoomComment(postId: string, content: string, parentId = '') {
    const post = voomPosts.value.find((entry) => entry.id === postId);
    const parentName = parentId ? post?.comments.find((entry) => entry.id === parentId)?.authorName ?? '' : '';
    const trimmedContent = stripVoomCommentReplyPrefix(content, parentName);
    if (!post || !trimmedContent) return;

    const currentUser = user.value;
    const comment: VoomComment = {
      id: createId('comment'),
      authorName: getUserAiName(currentUser),
      authorId: currentUser?.id,
      content: trimmedContent,
      parentId: parentId || undefined,
      createdAt: Date.now()
    };

    const targetConversations = conversationsForVoomPost(post);
    const nextPost = {
      ...post,
      conversationId: post.conversationId || targetConversations[0]?.id,
      conversationIds: targetConversations.length ? targetConversations.map((conversation) => conversation.id) : post.conversationIds,
      comments: [...post.comments, comment]
    };
    await saveVoomPost(nextPost);
    for (const conversation of targetConversations) {
      await appendConversationEvent(
        conversation.id,
        formatVoomCommentEvent(comment, nextPost.comments),
        { mode: conversation.activeMode, voomPostId: post.id, voomCommentId: comment.id, voomEventType: 'comment', createdAt: comment.createdAt }
      );
    }
  }

  async function toggleVoomLike(postId: string) {
    const post = voomPosts.value.find((entry) => entry.id === postId);
    const currentUserName = getUserAiName(user.value);
    if (!post) return;
    const currentUserLikeKeys = new Set([getUserAiName(user.value), getUserVoomAuthorName(user.value), getUserDisplayName(user.value)]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean));
    const wasLiked = post.likes.some((name) => currentUserLikeKeys.has(name.trim().toLocaleLowerCase()));

    const likes = wasLiked
      ? post.likes.filter((name) => !currentUserLikeKeys.has(name.trim().toLocaleLowerCase()))
      : [...post.likes, currentUserName];

    const targetConversations = conversationsForVoomPost(post);
    const authorName = voomAiAuthorNameForPost(post);
    await saveVoomPost({
      ...post,
      conversationId: post.conversationId || targetConversations[0]?.id,
      conversationIds: targetConversations.length ? targetConversations.map((conversation) => conversation.id) : post.conversationIds,
      likes
    });
    for (const conversation of targetConversations) {
      await appendConversationEvent(
        conversation.id,
        wasLiked
          ? `【VOOM】${currentUserName} 取消赞了 ${authorName} 的动态。`
          : formatVoomLikeEvent([currentUserName], authorName),
        { mode: conversation.activeMode, voomPostId: post.id, voomEventType: wasLiked ? 'unlike' : 'like' }
      );
    }
  }

  function voomPostCanBeRepliedByConversation(post: VoomPost, conversation: Conversation, character: CharacterProfile) {
    if (isReplyingVoomComments(post.id)) return false;
    if (post.conversationId === conversation.id || post.conversationIds?.includes(conversation.id)) return true;
    if (isUserVoomPost(post)) return post.visibleCharacterIds?.includes(character.id) ?? false;
    const postAuthor = post.charId ? characterById(post.charId) : null;
    if (postAuthor?.boundUserId === character.boundUserId) return true;
    return post.charId === character.id;
  }

  async function replyToVoomComments(postId: string, options: { actorConversationId?: string; silent?: boolean; suppressGlobalNotice?: boolean } = {}) {
    if (isReplyingVoomComments(postId)) return;

    const post = voomPosts.value.find((entry) => entry.id === postId);
    if (!post) return;

    const targetConversations = conversationsForVoomPost(post);
    const actorConversation = options.actorConversationId
      ? targetConversations.find((entry) => entry.id === options.actorConversationId) ?? conversationById(options.actorConversationId)
      : null;
    const conversation = actorConversation && actorConversation.charId ? actorConversation : targetConversations[0];
    if (!conversation) return;

    const character = characterById(conversation.charId);
    if (!character) return;

    const boundUser = userById(character.boundUserId) ?? user.value;
    if (!boundUser) return;
    const chatSettings = settingsForConversation(conversation.id);
    const modelOverride = getConversationTextModelOverride(chatSettings, 'voom', conversation.activeMode);
    if (!hasConfiguredTextModel(modelOverride)) {
      if (!options.silent) showConfigAlert('请先配置 VOOM 或当前聊天模式的 API 模型，再让角色回复评论区。', '需要配置 API 模型');
      return false;
    }

    replyingVoomCommentPostIds.value = [...replyingVoomCommentPostIds.value, postId];
    try {
      const boundUserAuthorKeys = [getUserVoomAuthorName(boundUser), getUserAiName(boundUser)]
        .map((name) => name.trim().toLocaleLowerCase())
        .filter(Boolean);
      const userComments = post.comments
        .filter((comment) => comment.authorId === boundUser.id || boundUserAuthorKeys.includes(comment.authorName.trim().toLocaleLowerCase()))
        .slice(-4)
        .map((comment) => ({ ...comment, authorName: getUserAiName(boundUser), authorId: boundUser.id }));
      const aiPost: VoomPost = {
        ...post,
        authorName: voomAiAuthorNameForPost(post),
        comments: post.comments.map((comment) => ({ ...comment, authorName: voomCommentAiAuthorName(comment) }))
      };
      const replies = await generateVoomCommentReplies({
        context: {
          user: boundUser,
          character,
          boundUser,
          mode: conversation.activeMode,
          messages: visibleMessagesForConversation(conversation.id),
          worldBooks: worldBooks.value,
          conversationSummary: conversation.summary,
          memorySummary: await memoryContextForConversationAsync(conversation.id, [post.content, post.imageDescription ?? '', ...userComments.map((comment) => comment.content)].join('\n'), {
            embeddingModelOverride: getMemoryEmbeddingModelOverride(chatSettings)
          }),
          stickerVisionEnabled: chatSettings.stickerVisionEnabled,
          timeAwareness: chatSettings.timeAwareness
        },
        post: aiPost,
        userComments,
        settings: settings.value ?? undefined,
        modelOverride
      });

      const createdAt = Date.now();
      const latestPost = voomPosts.value.find((entry) => entry.id === postId);
      if (!latestPost) return false;
      const existingCommentIds = new Set(latestPost.comments.map((comment) => comment.id));
      const generatedIds = replies.map(() => createId('comment'));
      const generatedIdByDraftId = new Map(replies.flatMap((reply, index) => reply.draftId ? [[reply.draftId, generatedIds[index]]] : []));
      const characterAiName = getCharacterAiName(character);
      const characterVoomAuthorName = getCharacterVoomAuthorName(character);
      const characterAuthorAliases = new Set([character.id, character.nickname, character.name, characterAiName, characterVoomAuthorName, ...(isUserVoomPost(post) ? [] : [post.authorName])]
        .map((name) => name.trim().toLocaleLowerCase())
        .filter(Boolean));
      const replyAuthorNameForIndex = (index: number) => {
        const authorName = replies[index]?.authorName.trim() ?? '';
        return characterAuthorAliases.has(authorName.toLocaleLowerCase()) ? characterAiName : authorName;
      };
      const replyParentName = (parentId: string) => {
        const existingComment = latestPost.comments.find((comment) => comment.id === parentId);
        if (existingComment) return existingComment.authorName;
        const generatedIndex = generatedIds.indexOf(parentId);
        return generatedIndex >= 0 ? replyAuthorNameForIndex(generatedIndex) : '';
      };
      const nextComments: VoomComment[] = replies.map((reply, index) => {
        const resolvedParentId = reply.parentId && existingCommentIds.has(reply.parentId)
          ? reply.parentId
          : reply.parentId
            ? generatedIdByDraftId.get(reply.parentId)
            : '';
        const parentName = resolvedParentId ? replyParentName(resolvedParentId) : '';
        return {
          id: generatedIds[index],
          authorName: replyAuthorNameForIndex(index),
          authorId: characterAuthorAliases.has((replies[index]?.authorName.trim() ?? '').toLocaleLowerCase()) ? character.id : undefined,
          content: stripVoomCommentReplyPrefix(reply.content, parentName),
          contentTranslation: reply.contentTranslation ? stripVoomCommentReplyPrefix(reply.contentTranslation, parentName) : undefined,
          parentId: resolvedParentId && resolvedParentId !== generatedIds[index] ? resolvedParentId : undefined,
          createdAt: createdAt + index
        };
      });
      if (!nextComments.length) return false;

      const nextPost = {
        ...latestPost,
        conversationId: latestPost.conversationId || conversation.id,
        conversationIds: targetConversations.map((targetConversation) => targetConversation.id),
        comments: [...latestPost.comments, ...nextComments]
      };
      if (options.suppressGlobalNotice) {
        suppressVoomNoticeKeys([
          voomPostGlobalNoticeKey(nextPost.id),
          ...nextComments.map((comment) => voomCommentGlobalNoticeKey(nextPost.id, comment.id))
        ]);
      }
      await saveVoomPost(nextPost);
      await Promise.all(targetConversations.flatMap((targetConversation) => nextComments.map((comment) => appendConversationEvent(
        targetConversation.id,
        formatVoomCommentEvent(comment, nextPost.comments),
        { mode: targetConversation.activeMode, voomPostId: post.id, voomCommentId: comment.id, voomEventType: 'reply', createdAt: comment.createdAt }
      ))));
      return true;
    } catch (error) {
      if (options.silent) console.warn('VOOM comment reply failed.', error);
      else showConfigAlert(error instanceof Error ? error.message : '评论区回复生成失败。', '无法回复评论');
      return false;
    } finally {
      replyingVoomCommentPostIds.value = replyingVoomCommentPostIds.value.filter((id) => id !== postId);
    }
  }

  return {
    ready,
    loadingReply,
    replyingVoomCommentPostIds,
    configAlert,
    users,
    user,
    accounts,
    characters,
    charactersForActiveUser,
    charactersForFriendsDisplay,
    conversations,
    activeCall,
    conversationsForActiveUser,
    conversationsForFriendsDisplay,
    sortedConversations,
    unreadConversationCount,
    messages,
    voomPosts,
    profileHomepages,
    smallTheaterTopics,
    smallTheaters,
    musicFavoriteTracks,
    musicCommentThreads,
    sortedVoomPosts,
    sortedProfileHomepages,
    sortedSmallTheaters,
    favorites,
    sortedFavorites,
    worldBooks,
    stickerGroups,
    stickers,
    sortedStickerGroups,
    sortedStickers,
    recentStickers,
    conversationSettings,
    memoryEpisodes,
    memoryEntities,
    memoryAssertions,
    memoryEdges,
    memoryThemes,
    memoryStateSnapshots,
    generatedImages,
    settings,
    hydrate,
    userById,
    characterById,
    conversationById,
    setActiveCall,
    patchActiveCall,
    clearActiveCall,
    setActiveConversation,
    messagesForConversation,
    profileThemesForCharacter,
    enabledProfileThemesForCharacter,
    profileHomepagesForCharacter,
    smallTheaterTopicsForCharacter,
    smallTheatersForCharacter,
    smallTheaterById,
    generatedImagesForProvider,
    settingsForConversation,
    modelOverridesForConversation,
    memoryGraphForConversation,
    memoryTimelineForConversation,
    memoryThemesForConversation,
    memoryStatesForConversation,
    recallMemoryForConversation,
    stickersForGroup,
    visibleMessagesForConversation,
    promptMessagesForConversation,
    hiddenMessageIdsForConversation,
    memoryContextForConversation,
    memoryCompressionStatsForConversation,
    captureConversationMemory,
    updateMemoryEpisode,
    deleteMemoryEpisode,
    regenerateMemoryEpisode,
    setMemoryAssertionPinned,
    forgetMemoryAssertion,
    correctMemoryAssertion,
    rebuildCharacterMemory,
    nextReplyTokenCountForConversation,
    nextReplyTokenCountForConversationAsync,
    lastMessageForConversation,
    createMessageQuoteSnapshot,
    canFavoriteMessage,
    isMessageFavorited,
    addFavoriteMessage,
    deleteFavorite,
    showConfigAlert,
    hasConfiguredTextModel,
    isReplyingVoomComments,
    consumeSuppressedVoomNoticeKey,
    isConversationReplying,
    cancelConversationReply,
    saveUserProfile,
    saveUsers,
    saveAccountProfile,
    deleteUserProfile,
    deleteCharacterProfile,
    blockCharacter,
    unblockCharacter,
    removeCharacterFriend,
    requestCharacterFriend,
    respondCharacterFriendRequest,
    clearCharacterHistory,
    setActiveUser,
    markVoomCharactersRead,
    saveVisualProfile,
    saveCharacter,
    saveCoupleSpaceState,
    refreshCoupleSpace,
    deleteCharacterProfileHistoryEntry,
    clearCharacterProfileHistory,
    markCharacterMindStateRead,
    addCharacter,
    discoverGroups,
    createGroup,
    joinGeneratedGroup,
    appendGroupUserMessage,
    appendAnonymousGroupMessage,
    requestGroupReply,
    leaveGroupConversation,
    applyToRejoinGroup,
    inviteCharactersToGroup,
    updateManagedGroupProfile,
    updateGroupAvatar,
    updateGroupNpcAvatar,
    updateGroupPersonalPreferences,
    regenerateLatestGroupReply,
    deleteGroupConversation,
    maybeRequestProactiveGroupReply,
    runProactiveGroupScheduler,
    saveConversationSettings,
    saveCharacterModelOverridesForConversation,
    saveStickerGroup,
    addStickerGroup,
    deleteStickerGroup,
    moveStickerGroup,
    saveSticker,
    importStickers,
    deleteSticker,
    deleteStickers,
    moveStickersToGroup,
    saveWorldBook,
    deleteWorldBook,
    createBackupFile,
    importBackupSnapshot,
    runCloudBackup,
    restoreCloudBackup,
    runGitHubBackup,
    importGitHubBackup,
    hasGitHubBackup,
    syncGitHubBackupHistory,
    saveSettings,
    addGeneratedImage,
    updateGeneratedImageUrl,
    deleteGeneratedImage,
    getDataInventory,
    estimateCleanupFreedBytes,
    cleanupData,
    clearDataSections,
    refreshEnabledVendorModels,
    bindWorldBook,
    updateConversationMode,
    markConversationRead,
    appendConversationEvent,
    appendCallEventMessage,
    updateCallEventMessage,
    appendCallEndPromptMessage,
    respondToIncomingCall,
    appendUserMessage,
    appendUserCallMessage,
    appendUserCallImageMessage,
    appendStickerMessage,
    appendUserImageMessage,
    appendUserVoiceMessage,
    appendUserLocationMessage,
    appendUserTransferMessage,
    appendUserCommerceMessage,
    appendUserMusicListenInviteMessage,
    appendUserSmallTheaterLinkMessage,
    appendShopShareMessage,
    appendUserGobangMessage,
    appendGobangSessionMessage,
    updateGobangInvitationStatus,
    requestGobangMove,
    recoverInterruptedGobangMessage,
    updateTransferStatus,
    updateMusicListenInviteStatus,
    acceptMusicListenInvite,
    rejectMusicListenInvite,
    stopMusicListenTogether,
    musicListeningContextForConversation,
    syncMusicFavoriteTracks,
    saveMusicFavoriteTrack,
    deleteMessages,
    updateMessageContent,
    updateMessageLocation,
    updateMessageTransfer,
    updateGobangMessage,
    generateMessageVoiceAudio,
    recallMessage,
    requestRoleplayReply,
    regenerateLatestReply,
    applyReplyVariant,
    maybeRequestProactiveReply,
    runProactivePrivateScheduler,
    sendMessage,
    sendStickerMessage,
    acceptOfflineInvitation,
    rejectOfflineInvitation,
    regenerateChatMessageImage,
    applyChatMessageImageCandidate,
    createUserVoomPost,
    createMomentFromConversation,
    ensureProfileThemesForCharacter,
    createProfileTheme,
    saveProfileTheme,
    setProfileThemeEnabledForCharacter,
    importProfileThemes,
    deleteProfileTheme,
    deleteProfileHomepage,
    cleanupProfileHomepagesForCharacters,
    runProfileHomepageAutoCleanupForCharacters,
    ensureSmallTheaterTopicsForCharacter,
    createSmallTheaterTopic,
    saveSmallTheaterTopic,
    setSmallTheaterTopicEnabledForCharacter,
    setSmallTheaterTopicsEnabledForCharacter,
    deleteSmallTheaterTopic,
    createSmallTheaterFromConversation,
    continueSmallTheater,
    forwardSmallTheaterToCharacter,
    deleteSmallTheater,
    cleanupSmallTheatersForCharacters,
    runSmallTheaterAutoCleanupForCharacters,
    regenerateVoomPostImage,
    applyVoomPostImageCandidate,
    cleanupVoomPostsForCharacters,
    runVoomAutoCleanupForCharacters,
    addVoomComment,
    toggleVoomLike,
    replyToVoomComments,
    deleteVoomPost,
  };
});