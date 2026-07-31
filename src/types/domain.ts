export type ChatMode = 'online' | 'offline';

import type { CharacterEconomySnapshot, ChatCommerceAttachment, ChatShopShareAttachment, ShopCartItem, ShopMoment, ShopOrder, ShopProduct, ShopStorefront, ShopWishlistItem, WalletAccount, WalletTransaction } from './commerce';
import type { MemoryAssertion, MemoryEdge, MemoryEmbeddingCache, MemoryEntity, MemoryEpisode, MemoryStateSnapshot, MemoryTheme } from './memory';
import type { RoleContentDraft, RoleOperationAuditEntry, RoleOperationPolicy, RoleOutboundTask, RoleSocialAccount, UserSocialAccount } from './roleOperations';

export type AppTab = 'home' | 'voom' | 'music' | 'fanfic' | 'wallet';

export interface VisualProfileStats {
  posts: number;
  postsLabel: string;
  followers: string;
  followersLabel: string;
  following: string | number;
  followingLabel: string;
}

export interface VisualProfileLink {
  id: string;
  label: string;
  url: string;
}

export interface VisualProfileHighlight {
  id: string;
  title: string;
  image: string;
}

export interface VisualProfileMoment {
  id: string;
  title: string;
  image: string;
}

export interface VisualProfile {
  nickname: string;
  handle: string;
  avatar: string;
  bio: string;
  backgroundImage: string;
  location: string;
  mood: string;
  archiveLabel: string;
  editLabel: string;
  editorTitle: string;
  messageLabel: string;
  momentsLabel: string;
  accentColor: string;
  textColor: string;
  avatarBorderColor: string;
  stats: VisualProfileStats;
  tags: string[];
  chips: string[];
  links: VisualProfileLink[];
  highlights: VisualProfileHighlight[];
  moments: VisualProfileMoment[];
}

export type AvatarlessVisualProfile = Omit<VisualProfile, 'avatar'>;
export type UserVisualProfile = AvatarlessVisualProfile;
export type CharacterVisualProfile = AvatarlessVisualProfile;

export interface UserProfile {
  id: string;
  nickname: string;
  name: string;
  avatar: string;
  description: string;
  signature: string;
  boundCharacterIds: string[];
  profile: UserVisualProfile;
}

export interface CharacterMindState {
  lines: string[];
  profileThemeId?: string;
  profileThemeName?: string;
  profileThemeContent?: string;
  profileThemeHtml?: string;
  profileThemeCss?: string;
  updatedAt: number;
  readAt: number;
  sourceConversationId?: string;
  sourceReplyBatchId?: string;
}

export type ProfileThemeSource = 'built-in' | 'custom' | 'imported';

export interface ProfileTheme {
  id: string;
  charId: string;
  name: string;
  prompt: string;
  regex: string;
  template: string;
  css: string;
  enabled: boolean;
  source: ProfileThemeSource;
  builtIn?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ProfileHomepageRecord {
  id: string;
  charId: string;
  conversationId: string;
  replyBatchId?: string;
  themeId: string;
  themeName: string;
  content: string;
  html: string;
  css: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterInitialProfile {
  nickname: string;
  signature: string;
}

export type CharacterProfileHistoryField = 'nickname' | 'signature' | 'mood';

export interface CharacterProfileHistoryEntry {
  id: string;
  field: CharacterProfileHistoryField;
  previousValue: string;
  nextValue: string;
  createdAt: number;
  sourceConversationId?: string;
  sourceReplyBatchId?: string;
}

export interface CharacterImageProfile {
  appearancePrompt: string;
  facePrompt: string;
  referenceImage: string;
  referenceImageEnabled: boolean;
  voomPortraitModeEnabled: boolean;
  seed: string;
  photos: CharacterPhotoRecord[];
  hiddenSourcePhotoKeys: string[];
}

export type CharacterPhotoSourceType = 'manual-url' | 'manual-local' | 'call-generated';

export interface CharacterPhotoRecord {
  id: string;
  imageUrl: string;
  source: CharacterPhotoSourceType;
  title: string;
  prompt?: string;
  negativePrompt?: string;
  provider?: ChatImageProviderType;
  model?: string;
  size?: string;
  createdAt: number;
  updatedAt: number;
}

export type CoupleDeviceScreenStatus = 'using' | 'locked' | 'idle';

export type CoupleActivityCategory = 'sleep' | 'home' | 'travel' | 'work' | 'meal' | 'social' | 'errand' | 'leisure';

export interface CoupleRouteStop {
  name: string;
  time: string;
  endTime: string;
  kind: 'start' | 'pass' | 'stay' | 'arrival';
  category: CoupleActivityCategory;
  detail: string;
  companion: string;
  trace: string;
  privateThought: string;
}

export interface CoupleNetworkRecord {
  name: string;
  time: string;
  kind: 'wifi' | 'cellular' | 'offline';
}

export interface CoupleMomentRecord {
  time: string;
  category: string;
  title: string;
  detail: string;
  emoji: string;
  unspoken: string;
}

export interface CoupleAppUsageRecord {
  app: string;
  minutes: number;
  lastUsedAt: string;
  detail: string;
}

export interface CoupleNotificationRecord {
  app: string;
  time: string;
  title: string;
  preview: string;
  unread: boolean;
}

export interface CouplePhoneChatMessage {
  sender: 'character' | 'contact';
  time: string;
  text: string;
}

export interface CouplePhoneChatRecord {
  contact: string;
  relation: string;
  avatarEmoji: string;
  updatedAt: string;
  unread: number;
  summary: string;
  messages: CouplePhoneChatMessage[];
}

export interface CoupleFootprintRecord {
  kind: 'search' | 'browser' | 'map' | 'shopping';
  time: string;
  title: string;
  detail: string;
  reason: string;
}

export interface CoupleGalleryRecord {
  time: string;
  title: string;
  detail: string;
  emoji: string;
  palette: [string, string];
}

export interface CoupleNoteRecord {
  folder: string;
  title: string;
  content: string;
  updatedAt: string;
  pinned: boolean;
}

export interface CoupleLifeRecord {
  kind: 'alarm' | 'calendar' | 'order' | 'music' | 'draft';
  time: string;
  title: string;
  detail: string;
  status: string;
}

export interface CoupleSpaceSnapshot {
  id: string;
  generatedAt: number;
  location: {
    place: string;
    address: string;
    status: string;
    distance: string;
    transport: string;
    eta: string;
    stayMinutes: number;
    route: CoupleRouteStop[];
  };
  device: {
    battery: number;
    charging: boolean;
    screenStatus: CoupleDeviceScreenStatus;
    lastUnlockedAt: string;
    lastLockedAt: string;
    usageMinutes: number;
    activeApp: string;
    network: string;
    networkHistory: CoupleNetworkRecord[];
    appUsage: CoupleAppUsageRecord[];
    notifications: CoupleNotificationRecord[];
    chats: CouplePhoneChatRecord[];
    footprints: CoupleFootprintRecord[];
    gallery: CoupleGalleryRecord[];
    notes: CoupleNoteRecord[];
    lifeRecords: CoupleLifeRecord[];
  };
  bond: {
    mood: string;
    moodEmoji: string;
    missLevel: number;
    syncScore: number;
    nextPlan: string;
    whisper: string;
    daySummary: string;
    hiddenThought: string;
    keywords: string[];
  };
  moments: CoupleMomentRecord[];
}

export interface CoupleWishNote {
  id: string;
  content: string;
  createdAt: number;
}

export interface CoupleSpaceState {
  consentGrantedAt: number;
  relationshipLabel: string;
  startedAt: string;
  arrivalReminderEnabled: boolean;
  snapshot?: CoupleSpaceSnapshot;
  history: CoupleSpaceSnapshot[];
  wishes: CoupleWishNote[];
}

export type FriendRelationshipStatus =
  | 'friend'
  | 'blocked-by-user'
  | 'blocked-by-character'
  | 'pending-user-request'
  | 'pending-character-request'
  | 'deleted-by-user'
  | 'deleted-by-character';

export interface FriendRelationship {
  status: FriendRelationshipStatus;
  updatedAt: number;
  reason?: string;
  requestMessage?: string;
  requestedAt?: number;
}

export interface CharacterMcpBinding {
  overrideGlobal: boolean;
  serverIds: string[];
}

export interface CharacterProfile {
  id: string;
  nickname: string;
  name: string;
  avatar: string;
  description: string;
  signature: string;
  userNote: string;
  boundUserId: string;
  subtitle: string;
  lastSeen: string;
  localWorldBookIds: string[];
  voomFrequency: VoomFrequency;
  initialProfile?: CharacterInitialProfile;
  profileHistory?: CharacterProfileHistoryEntry[];
  boundUserProfile?: VisualProfile;
  profile?: CharacterVisualProfile;
  mindState?: CharacterMindState;
  modelOverrides?: ChatModelOverrides;
  minimaxVoiceId?: string;
  themeStyleBindings?: CharacterThemeStyleBindings;
  mcpBinding?: CharacterMcpBinding;
  imageProfile?: CharacterImageProfile;
  coupleSpace?: CoupleSpaceState;
  relationship?: FriendRelationship;
}

export type VoomFrequency = 'very-low' | 'low' | 'medium' | 'high' | 'very-high' | 'always';

export type VoomImageMode = 'character-choice' | 'manual';

export type VoomAutoCleanupPreset = '3' | '7' | '30' | 'custom';

export type SmallTheaterAutoCleanupPreset = VoomAutoCleanupPreset;

export type ProfileHomepageAutoCleanupPreset = VoomAutoCleanupPreset;

export interface CharacterVoomAutoCleanupSettings {
  enabled: boolean;
  days: number;
  preset: VoomAutoCleanupPreset;
  lastCleanupAt: number;
}

export interface CharacterSmallTheaterAutoCleanupSettings {
  enabled: boolean;
  days: number;
  preset: SmallTheaterAutoCleanupPreset;
  lastCleanupAt: number;
}

export interface CharacterProfileHomepageAutoCleanupSettings {
  enabled: boolean;
  days: number;
  preset: ProfileHomepageAutoCleanupPreset;
  lastCleanupAt: number;
}

export type ChatModelScope = 'online' | 'offline' | 'summary' | 'voom' | 'theater' | 'groupDiscovery';

export interface ChatModelOverrides {
  online: string;
  offline: string;
  summary: string;
  voom: string;
  theater: string;
  groupDiscovery: string;
}

export interface CharacterThemeStyleBindings {
  onlinePresetId: string;
  offlinePresetId: string;
}

export interface ChatAppearanceSettings {
  backgroundImage: string;
  backgroundImages: string[];
  backgroundColor: string;
  userBubbleColor: string;
  userTextColor: string;
  characterBubbleColor: string;
  characterTextColor: string;
  narrationBubbleColor: string;
  narrationTextColor: string;
  showMessageTime: boolean;
  showReadStatus: boolean;
  showUserAvatar: boolean;
  showCharacterAvatar: boolean;
  showOnlyFirstAvatarInReply: boolean;
  hideVoomNarration: boolean;
}

export interface ChatMemorySettings {
  enabled: boolean;
  compressionEnabled: boolean;
  autoCapture: boolean;
  captureEvery: number;
  recentFloorLimit: number;
  recallTokenBudget: number;
  growthEnabled: boolean;
  naturalForgettingEnabled: boolean;
  reflectionEnabled: boolean;
  embeddingEnabled: boolean;
  embeddingModel: string;
}

export interface ConversationTimeAwarenessSettings {
  enabled: boolean;
}

export interface ConversationProactiveReplySettings {
  enabled: boolean;
  frequency: VoomFrequency;
  lastTriggeredAt: number;
}

export interface ConversationCallSettings {
  ambientSound?: RingtoneAsset;
  ambientEnabled: boolean;
  ambientVolume: number;
}

export type OfflineParagraphMode = 'long' | 'short' | 'mixed';
export type OfflinePerspective = 'omniscient-third' | 'character-third' | 'character-second' | 'user-first' | 'user-second';
export type OfflineInterruptionMode = 'advance' | 'strict';
export type OfflineRetellMode = 'retell' | 'direct';
export type OfflineTonePreset = 'daily' | 'push-pull' | 'ambiguous' | 'romance' | 'bittersweet' | 'custom';
export type OfflineStructureKind = 'paragraph' | 'perspective' | 'interruption' | 'retell';

export interface OfflinePromptPreset {
  id: string;
  name: string;
  content: string;
}

export type OfflineStructurePresets = Record<OfflineStructureKind, OfflinePromptPreset[]>;
export type OfflineStructurePresetIds = Record<OfflineStructureKind, string>;

export interface ConversationOfflineSettings {
  enhanceAppearance: boolean;
  enhanceOutfit: boolean;
  expandLength: boolean;
  characterPsychology: boolean;
  emotionalGuidance: boolean;
  desireRestraint: boolean;
  antiToxicMasculinity: boolean;
  antiClicheRomance: boolean;
  dynamicWorldNarrative: boolean;
  paragraphMode: OfflineParagraphMode;
  perspective: OfflinePerspective;
  interruptionMode: OfflineInterruptionMode;
  retellMode: OfflineRetellMode;
  customStructurePresets: OfflineStructurePresets;
  activeCustomStructurePresetIds: OfflineStructurePresetIds;
  wordCount: string;
  writingStylePresetVersion: number;
  writingStylePresetId: string;
  writingStylePresets: OfflinePromptPreset[];
  writingStyle: string;
  tonePresetId: string;
  tonePresets: OfflinePromptPreset[];
  tone: OfflineTonePreset;
  customTone: string;
}

export interface ConversationSettings {
  conversationId: string;
  memory: ChatMemorySettings;
  modelOverrides: ChatModelOverrides;
  appearance: ChatAppearanceSettings;
  call: ConversationCallSettings;
  narrationModeEnabled: boolean;
  autoGenerateVoom: boolean;
  voomFrequency: VoomFrequency;
  voomImageMode: VoomImageMode;
  voomImageEnabled: boolean;
  voomImageFrequency: VoomFrequency;
  autoGenerateTheater: boolean;
  theaterFrequency: VoomFrequency;
  stickerVisionEnabled: boolean;
  stickerSuggestionsEnabled: boolean;
  offlineInvitationEnabled: boolean;
  characterStickerGroupIds: string[];
  timeAwareness: ConversationTimeAwarenessSettings;
  proactiveReply: ConversationProactiveReplySettings;
  offline: ConversationOfflineSettings;
}

export type GroupMemberIdentityType = 'user' | 'character' | 'npc';
export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface GroupMember {
  id: string;
  identityType: GroupMemberIdentityType;
  identityId?: string;
  trueName: string;
  nickname: string;
  avatar?: string;
  description?: string;
  role: GroupMemberRole;
  joinedAt: number;
  membershipStatus?: 'active' | 'left' | 'pending';
  exitedAt?: number;
}

export interface GroupNpcDraft {
  trueName: string;
  nickname: string;
  avatar?: string;
  description: string;
}

export interface GroupDiscoveryCandidate {
  id: string;
  name: string;
  avatar?: string;
  description: string;
  announcement: string;
  ownerMemberId: string;
  members: GroupMember[];
  recentMessages: Array<{
    authorMemberId: string;
    content: string;
    createdAtOffsetMinutes?: number;
  }>;
  discoveryReason: string;
}

export interface Conversation {
  id: string;
  userId: string;
  charId: string;
  title: string;
  activeMode: ChatMode;
  updatedAt: number;
  unreadCount: number;
  summary: string;
  kind?: 'private' | 'group';
  groupAvatar?: string;
  groupAnnouncement?: string;
  groupJoinPolicy?: 'open' | 'approval' | 'invite-only';
  groupInvitePermission?: 'members' | 'admins';
  groupMessagePermission?: 'members' | 'admins';
  groupHistoryVisibleToNewMembers?: boolean;
  groupPinned?: boolean;
  groupMuted?: boolean;
  groupMembers?: GroupMember[];
  joinedAt?: number;
  groupAnonymousId?: string;
  groupAnonymousName?: string;
}

export type StickerSourceType = 'url' | 'local-image' | 'text-file' | 'doc-file' | 'json-file' | 'manual';

export interface StickerGroup {
  id: string;
  name: string;
  sortOrder?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Sticker {
  id: string;
  description: string;
  imageUrl: string;
  cachedImageUrl?: string;
  cachedImageUpdatedAt?: number;
  groupIds: string[];
  sourceType: StickerSourceType;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChatStickerAttachment {
  stickerId: string;
  description: string;
  imageUrl: string;
  cachedImageUrl?: string;
}

export type ChatImageAttachmentKind = 'photo' | 'local' | 'description' | 'generated';

export type ChatImageProviderType = 'openai' | 'novelai' | 'pollinations' | 'mock' | 'local';

export interface ChatImageCandidate {
  id: string;
  image: string;
  description: string;
  generationPrompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  seed?: string;
  provider: ChatImageProviderType;
  model?: string;
  size?: string;
  createdAt: number;
}

export interface ChatImageAttachment {
  kind: ChatImageAttachmentKind;
  description: string;
  generationPrompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  seed?: string;
  aiHint?: string;
  url?: string;
  provider?: ChatImageProviderType;
  model?: string;
  size?: string;
  candidates?: ChatImageCandidate[];
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export type ChatVoiceAttachmentSource = 'recorded' | 'text';

export type TtsProviderType = 'openai' | 'minimax' | 'doubao';

export interface ChatVoiceAttachment {
  source: ChatVoiceAttachmentSource;
  transcript: string;
  duration: number;
  audioUrl?: string;
  mimeType?: string;
  ttsProvider?: TtsProviderType;
  ttsVoiceId?: string;
  ttsGeneratedAt?: number;
}

export interface ChatLocationAttachment {
  name: string;
  address?: string;
  distance: string;
}

export type ChatMcpResultItemKind = 'link' | 'product' | 'place' | 'media' | 'generic';

export interface ChatMcpResultItem {
  kind: ChatMcpResultItemKind;
  title: string;
  description?: string;
  url?: string;
  imageUrl?: string;
  imageUrls?: string[];
  price?: string;
  source?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  distance?: string;
  eta?: string;
}

export interface ChatMcpResultAttachment {
  serverId: string;
  serverName: string;
  toolName: string;
  items: ChatMcpResultItem[];
}

export type ChatApiReasoningFormat = 'openai-compatible' | 'gemini' | 'claude' | 'unknown';

export interface ChatApiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ChatMcpToolCallTrace {
  serverId: string;
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: 'success' | 'error';
  result: string;
}

export interface ChatApiTrace {
  generatedAt: number;
  model: string;
  requestId?: string;
  reasoning?: string;
  reasoningFormat?: ChatApiReasoningFormat;
  finishReason?: string;
  status?: string;
  usage?: ChatApiUsage;
  mcpToolCalls: ChatMcpToolCallTrace[];
}

export type ChatTransferStatus = 'pending' | 'accepted' | 'rejected';

export interface ChatTransferAttachment {
  amount: string;
  currency: 'CNY';
  note?: string;
  status: ChatTransferStatus;
  respondedAt?: number;
  responseToMessageId?: string;
}

export type ChatMusicListenInviteStatus = 'pending' | 'accepted' | 'rejected';

export interface ChatMusicListenInviteAttachment {
  status: ChatMusicListenInviteStatus;
  note?: string;
  track?: MusicTrack;
  respondedAt?: number;
  startedAt?: number;
}

export interface ChatSmallTheaterLinkAttachment {
  theaterId: string;
  title: string;
  summary: string;
  url: string;
  content: string;
}

export type ChatLinkPreviewPlatform = 'website' | 'xiaohongshu' | 'douyin' | 'taobao' | 'pinduoduo' | 'jd' | 'xianyu' | 'bilibili' | 'weibo' | 'zhihu' | 'kuaishou' | 'wechat' | 'meituan' | 'dianping' | 'ctrip' | 'eleme' | 'dewu';

export interface ChatLinkPreviewComment {
  author?: string;
  message: string;
  createdAt?: string;
  rating?: number;
}

export interface ChatLinkPreviewAttachment {
  platform: ChatLinkPreviewPlatform;
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  content?: string;
  comments?: ChatLinkPreviewComment[];
  readStatus?: 'complete' | 'platform-limited' | 'metadata-only';
  httpStatus?: number;
  siteName: string;
  fetchedAt: number;
}

export type ChatOfflineInvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface ChatOfflineInvitationAttachment {
  prompt: string;
  status: ChatOfflineInvitationStatus;
  respondedAt?: number;
  startedAt?: number;
}

export type ChatCallMode = 'voice' | 'video';

export type ChatCallDirection = 'incoming' | 'outgoing';

export type ChatCallStatus = 'ringing' | 'accepted' | 'rejected' | 'missed' | 'busy' | 'cancelled' | 'ended' | 'failed';

export interface ChatCallAttachment {
  callId: string;
  mode: ChatCallMode;
  direction: ChatCallDirection;
  status: ChatCallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  duration?: number;
}

export type ChatGobangPlayer = 'user' | 'char';

export type ChatGobangStone = 'black' | 'white';

export type ChatGobangDirection = 'incoming' | 'outgoing';

export type ChatGobangInvitationStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export type ChatGobangStatus = 'active' | 'user-won' | 'char-won' | 'draw' | 'resigned';

export type ChatGobangApiStatus = 'idle' | 'requesting' | 'failed' | 'interrupted';

export type ChatGobangApiErrorCode = 'not-configured' | 'network' | 'invalid-response' | 'illegal-move' | 'interrupted' | 'unknown';

export interface ChatGobangApiState {
  status: ChatGobangApiStatus;
  requestId?: string;
  requestRevision?: number;
  requestedAt?: number;
  model?: string;
  errorCode?: ChatGobangApiErrorCode;
  error?: string;
}

export interface ChatGobangMove {
  row: number;
  column: number;
  player: ChatGobangPlayer;
  createdAt: number;
  dialogue?: string;
  dialogueTranslation?: string;
  apiModel?: string;
  requestId?: string;
}

export interface ChatGobangAttachment {
  gameId: string;
  direction?: ChatGobangDirection;
  invitationStatus?: ChatGobangInvitationStatus;
  size: 15;
  status: ChatGobangStatus;
  turn: ChatGobangPlayer;
  starter: ChatGobangPlayer;
  userStone: ChatGobangStone;
  moves: ChatGobangMove[];
  undoCount: number;
  startedAt: number;
  respondedAt?: number;
  acceptedAt?: number;
  updatedAt: number;
  endedAt?: number;
  revision?: number;
  apiState?: ChatGobangApiState;
}

export interface ChatMessageQuote {
  messageId: string;
  sender: 'user' | 'char' | 'system';
  authorName: string;
  authorType?: GroupMemberIdentityType | 'system';
  authorId?: string;
  content: string;
  sticker?: ChatStickerAttachment;
  image?: ChatImageAttachment;
  voice?: ChatVoiceAttachment;
  location?: ChatLocationAttachment;
  mcpResult?: ChatMcpResultAttachment;
  transfer?: ChatTransferAttachment;
  commerce?: ChatCommerceAttachment;
  shopShare?: ChatShopShareAttachment;
  musicListenInvite?: ChatMusicListenInviteAttachment;
  linkPreview?: ChatLinkPreviewAttachment;
  theaterLink?: ChatSmallTheaterLinkAttachment;
  offlineInvitation?: ChatOfflineInvitationAttachment;
  call?: ChatCallAttachment;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  sender: 'user' | 'char' | 'system';
  authorType?: GroupMemberIdentityType | 'system';
  authorId?: string;
  authorName?: string;
  sourceConversationId?: string;
  sourceMessageIds?: string[];
  mode: ChatMode;
  content: string;
  translation?: string;
  createdAt: number;
  displayStyle?: 'default' | 'narration';
  voomPostId?: string;
  voomCommentId?: string;
  voomEventType?: 'post' | 'like' | 'unlike' | 'comment' | 'reply';
  sticker?: ChatStickerAttachment;
  image?: ChatImageAttachment;
  voice?: ChatVoiceAttachment;
  location?: ChatLocationAttachment;
  mcpResult?: ChatMcpResultAttachment;
  transfer?: ChatTransferAttachment;
  commerce?: ChatCommerceAttachment;
  shopShare?: ChatShopShareAttachment;
  musicListenInvite?: ChatMusicListenInviteAttachment;
  linkPreview?: ChatLinkPreviewAttachment;
  theaterLink?: ChatSmallTheaterLinkAttachment;
  offlineInvitation?: ChatOfflineInvitationAttachment;
  call?: ChatCallAttachment;
  gobang?: ChatGobangAttachment;
  gobangId?: string;
  callId?: string;
  callMode?: ChatCallMode;
  contextOnly?: boolean;
  quote?: ChatMessageQuote;
  replyBatchId?: string;
  replyVariantGroupId?: string;
  replyVariantIndex?: number;
  replyVariantState?: 'active' | 'inactive';
  plotChoices?: string[];
  apiTrace?: ChatApiTrace;
  status?: 'sending' | 'sent' | 'failed';
  readAt?: number | null;
  editedAt?: number;
}

export type FavoriteMessageKind = 'text' | 'image' | 'sticker' | 'voice' | 'location' | 'transfer' | 'commerce' | 'shopShare' | 'musicListenInvite' | 'theaterLink' | 'offlineInvitation' | 'call' | 'narration';

export interface FavoriteMessageRecord {
  id: string;
  sourceMessageId: string;
  conversationId: string;
  mode: ChatMode;
  kind: FavoriteMessageKind;
  sender: 'user' | 'char' | 'system';
  authorName: string;
  authorAvatar?: string;
  characterId?: string;
  characterName?: string;
  characterAvatar?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  summary: string;
  message: ChatMessage;
  messageCreatedAt: number;
  favoritedAt: number;
}

export type VoomPostAuthorType = 'character' | 'user';

export type VoomPostVisibility = 'public' | 'selected';

export type VoomImageProviderType = ImageProviderType | 'mock' | 'local';

export interface VoomImageCandidate {
  id: string;
  image: string;
  description: string;
  generationPrompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  seed?: string;
  provider: VoomImageProviderType;
  model?: string;
  size?: string;
  createdAt: number;
}

export interface VoomPost {
  id: string;
  charId: string;
  conversationId?: string;
  conversationIds?: string[];
  proactiveCommentExpansionCharacterIds?: string[];
  authorType?: VoomPostAuthorType;
  userId?: string;
  visibility?: VoomPostVisibility;
  visibleCharacterIds?: string[];
  authorName: string;
  authorAvatar: string;
  content: string;
  contentTranslation?: string;
  image?: string;
  imageDescription?: string;
  imageGenerationPrompt?: string;
  imageNegativePrompt?: string;
  imageReferenceImage?: string;
  imageSeed?: string;
  imageProvider?: VoomImageProviderType;
  imageCandidates?: VoomImageCandidate[];
  createdAt: number;
  comments: VoomComment[];
  likes: string[];
}

export interface VoomComment {
  id: string;
  authorName: string;
  content: string;
  contentTranslation?: string;
  authorId?: string;
  parentId?: string;
  createdAt?: number;
}

export interface SmallTheaterTopic {
  id: string;
  charId: string;
  title: string;
  prompt: string;
  enabled: boolean;
  builtIn?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SmallTheater {
  id: string;
  charId: string;
  conversationId?: string;
  topicId?: string;
  topicTitle: string;
  authorName: string;
  authorAvatar: string;
  title: string;
  summary: string;
  html: string;
  model?: string;
  createdAt: number;
  updatedAt?: number;
}

export type FanficTopicSource = 'built-in' | 'trend' | 'ai' | 'custom';

export interface FanficSupportingCharacter {
  name: string;
  role: string;
  goal: string;
  secret: string;
}

export interface FanficStoryBible {
  premise: string;
  coreHook: string;
  storyEngine: string;
  stakes: string;
  era: string;
  locations: string[];
  worldRules: string[];
  supportingCharacters: FanficSupportingCharacter[];
  relationshipArc: string;
  coreMystery: string;
  motifs: string[];
}

export interface FanficTopicSeed {
  openingProblem: string;
  immediateGoal: string;
  escalation: string;
  readerPromise: string;
}

export interface FanficTopic {
  id: string;
  source: FanficTopicSource;
  title: string;
  hook: string;
  setting: string;
  conflict: string;
  relationship: string;
  tags: string[];
  trendKeywords: string[];
  categoryId?: string;
  categoryLabel?: string;
  subcategory?: string;
  builtIn?: boolean;
  commercialSeed?: FanficTopicSeed;
  createdAt: number;
  expiresAt?: number;
}

export type FanficBookStatus = 'serializing' | 'completed' | 'paused';
export type FanficWorkType = 'user-character-au-fanfic';

export interface FanficBook {
  id: string;
  workType: FanficWorkType;
  userId: string;
  characterId: string;
  userName: string;
  characterName: string;
  title: string;
  authorName: string;
  summary: string;
  genre: string;
  tags: string[];
  topicId?: string;
  topicTitle: string;
  topicPitch: string;
  sourceLabel: string;
  tone: string;
  pov: string;
  endingPreference: string;
  contentBoundaries: string[];
  chapterTarget: number;
  coverImage: string;
  coverPrompt: string;
  coverPalette: string[];
  status: FanficBookStatus;
  storyBible: FanficStoryBible;
  continuity: string[];
  profileFingerprint: string;
  lastReadChapterId?: string;
  lastReadParagraphId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FanficParagraph {
  id: string;
  text: string;
}

export interface FanficChapterHotspot {
  id: string;
  paragraphId: string;
  label: string;
  excerpt: string;
  reason: string;
  commentCount: number;
}

export type FanficChapterStatus = 'draft' | 'published' | 'failed';

export interface FanficChapter {
  id: string;
  bookId: string;
  order: number;
  title: string;
  content: string;
  paragraphs: FanficParagraph[];
  summary: string;
  continuity: string[];
  hotspots: FanficChapterHotspot[];
  nextDirections: string[];
  wordCount: number;
  status: FanficChapterStatus;
  model?: string;
  createdAt: number;
  updatedAt: number;
}

export type FanficCommentScope = 'book' | 'chapter';
export type FanficCommentAuthorType = 'author' | 'reader' | 'character' | 'user';
export type FanficCommentOrigin = 'generated' | 'manual';

export interface FanficComment {
  id: string;
  bookId: string;
  chapterId?: string;
  hotspotId?: string;
  scope: FanficCommentScope;
  authorType: FanficCommentAuthorType;
  origin: FanficCommentOrigin;
  authorId?: string;
  authorName: string;
  avatarSeed: string;
  content: string;
  parentId?: string;
  likes: number;
  createdAt: number;
}

export type FanficGenerationStage = 'planning' | 'writing' | 'commenting' | 'cover' | 'completed' | 'failed';

export interface FanficGenerationJob {
  id: string;
  bookId: string;
  chapterOrder?: number;
  stage: FanficGenerationStage;
  label: string;
  progress: number;
  error: string;
  createdAt: number;
  updatedAt: number;
}

export type MusicSource = 'netease' | 'kuwo' | 'joox' | 'tencent' | 'tidal' | 'qobuz' | 'bilibili' | 'apple' | 'ytmusic' | 'spotify';

export interface MusicTrack {
  id: string;
  platformId: string;
  urlId?: string;
  source: MusicSource | string;
  name: string;
  artists: string[];
  album: string;
  picId: string;
  lyricId: string;
  coverUrl?: string;
  audioUrl?: string;
  duration?: number;
  addedAt?: number;
  updatedAt?: number;
}

export interface MusicComment {
  id: string;
  authorName: string;
  authorId?: string;
  authorType: 'user' | 'character' | 'passerby';
  avatar?: string;
  content: string;
  contentTranslation?: string;
  parentId?: string;
  createdAt: number;
}

export interface MusicCommentThread {
  trackKey: string;
  track: MusicTrack;
  comments: MusicComment[];
  expanded: boolean;
  generatedAt: number;
  updatedAt: number;
}

export interface MusicListeningContext {
  active: boolean;
  conversationId: string;
  characterId: string;
  characterName: string;
  userId: string;
  inviter: 'user' | 'char';
  joinedAt: number;
  currentTrack?: MusicTrack;
  currentTime: number;
  duration: number;
  lyricLine?: string;
}

export type WorldBookScope = 'global-online' | 'global-offline' | 'local';

export type WorldBookEntryActivation = 'keyword' | 'constant' | 'priority';

export type WorldBookInsertionPosition = 'before-chat' | 'after-chat';

export interface WorldBookLoreEntry {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  activation: WorldBookEntryActivation;
  keys: string[];
  secondaryKeys: string[];
  position: WorldBookInsertionPosition;
  order: number;
  depth: number;
  probability: number;
  caseSensitive: boolean;
}

export interface WorldBookEntry {
  id: string;
  title: string;
  content: string;
  entries: WorldBookLoreEntry[];
  scope: WorldBookScope;
  enabled: boolean;
  coverImage: string;
  includeInImageGeneration?: boolean;
}

export type ImageProviderType = 'openai' | 'novelai' | 'pollinations';

export type ImageModuleId = ImageProviderType;

export type ImageModelScope = 'voom' | 'onlineChat' | 'callBackground';

export interface ImageModelSelection {
  provider: ImageProviderType | '';
  model: string;
}

export interface GeneratedImageRecord {
  id: string;
  provider: ImageModuleId;
  imageUrl: string;
  title: string;
  prompt: string;
  negativePrompt: string;
  model: string;
  size: string;
  source: 'settings' | 'world-book' | 'voom';
  createdAt: number;
}

export interface ApiVendorModel {
  id: string;
  nickname: string;
  selected: boolean;
}

export interface ApiVendor {
  id: string;
  enabled: boolean;
  name: string;
  apiUrl: string;
  apiPath: string;
  apiKey: string;
  avatar: string;
  preferBase64ImageResponse: boolean;
  models: ApiVendorModel[];
}

export interface ImagePromptPreset {
  id: string;
  name: string;
  positivePrompt: string;
  negativePrompt: string;
  defaultNegativePrompt?: string;
  onlineChatTemplate?: string;
  voomTemplate?: string;
}

export type NovelAiEndpointMode = 'proxy' | 'official' | 'custom';

export interface NovelAiModelOption {
  id: string;
  label: string;
}

export interface PollinationsModelOption {
  id: string;
  label: string;
}

export interface OpenAiImageSettings {
  activeVendorId: string;
  size: string;
  activePromptPresetId: string;
  promptPresets: ImagePromptPreset[];
  positivePrompt: string;
  negativePrompt: string;
  lastImageUrl: string;
  vendors: ApiVendor[];
}

export interface NovelAiImageSettings {
  endpointMode: NovelAiEndpointMode;
  apiUrl: string;
  proxyUrl: string;
  customProxyUrl: string;
  apiKey: string;
  model: string;
  availableModels: NovelAiModelOption[];
  activePromptPresetId: string;
  promptPresets: ImagePromptPreset[];
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  guidance: number;
  steps: number;
  sampler: string;
  ucPreset: number;
  qualityToggle: boolean;
  sm: boolean;
  smDyn: boolean;
  dynamicThresholding: boolean;
  cfgRescale: number;
  noiseSchedule: string;
  seed: string;
  lastImageUrl: string;
}

export interface PollinationsImageSettings {
  apiKey: string;
  referrer: string;
  model: string;
  availableModels: PollinationsModelOption[];
  activePromptPresetId: string;
  promptPresets: ImagePromptPreset[];
  positivePrompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: string;
  safe: string;
  quality: string;
  referenceImage: string;
  transparent: boolean;
  enhance: boolean;
  nologo: boolean;
  private: boolean;
  lastImageUrl: string;
}

export type GitHubBackupStatus = 'idle' | 'running' | 'success' | 'failed';

export interface GitHubBackupHistoryRecord {
  sha: string;
  committedAt: number;
  exportedAt: number;
  message: string;
}

export interface GitHubBackupProgress {
  phase: 'idle' | 'checking' | 'uploading' | 'downloading' | 'restoring' | 'completed' | 'failed';
  label: string;
  percent: number;
  updatedAt: number;
}

export interface GitHubBackupSettings {
  enabled: boolean;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  path: string;
  intervalMinutes: number;
  lastBackupAt: number;
  lastBackupStatus: GitHubBackupStatus;
  lastBackupError: string;
  latestRemoteBackupAt: number;
  latestRemoteBackupSha: string;
  pendingRestoreSha: string;
  pendingRestoreAt: number;
  history: GitHubBackupHistoryRecord[];
  progress: GitHubBackupProgress;
}

export type CloudBackupProvider = 'google-drive' | 'onedrive' | 'dropbox' | 'r2-worker';

export type CloudBackupStatus = 'idle' | 'running' | 'success' | 'failed';

export interface CloudBackupProgress {
  phase: 'idle' | 'connecting' | 'uploading' | 'downloading' | 'restoring' | 'completed' | 'failed';
  label: string;
  percent: number;
  updatedAt: number;
}

export interface CloudBackupSettings {
  enabled: boolean;
  provider: CloudBackupProvider | '';
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  accountLabel: string;
  workerUrl: string;
  workerToken: string;
  recoveryKey: string;
  remoteFileId: string;
  fileName: string;
  intervalMinutes: number;
  lastBackupAt: number;
  lastBackupStatus: CloudBackupStatus;
  lastBackupError: string;
  latestRemoteBackupAt: number;
  lastBackupBytes: number;
  progress: CloudBackupProgress;
}

export type MinimaxTtsAudioFormat = 'mp3' | 'wav' | 'pcm';

export type OpenAiTtsAudioFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export type DoubaoTtsAudioFormat = 'mp3' | 'wav' | 'pcm' | 'ogg_opus';

export type DoubaoTtsTextType = 'plain' | 'ssml';

export interface OpenAiTtsSettings {
  activeVendorId: string;
  vendors: ApiVendor[];
  apiKey: string;
  apiUrl: string;
  model: string;
  voice: string;
  responseFormat: OpenAiTtsAudioFormat;
  speed: number;
  instructions: string;
}

export interface MinimaxTtsSettings {
  enabled: boolean;
  apiKey: string;
  groupId: string;
  apiUrl: string;
  model: string;
  voiceId: string;
  speed: number;
  volume: number;
  pitch: number;
  sampleRate: number;
  bitrate: number;
  audioFormat: MinimaxTtsAudioFormat;
  channel: 1 | 2;
}

export interface DoubaoTtsSettings {
  apiUrl: string;
  appId: string;
  token: string;
  cluster: string;
  voiceType: string;
  uid: string;
  encoding: DoubaoTtsAudioFormat;
  sampleRate: number;
  speedRatio: number;
  volumeRatio: number;
  pitchRatio: number;
  emotion: string;
  language: string;
  textType: DoubaoTtsTextType;
  silenceDuration: number;
  splitSentence: boolean;
  pureEnglishOpt: boolean;
}

export type RingtoneEventType = 'voom' | 'message' | 'theater' | 'call';

export type RingtoneSourceType = 'default' | 'imported';

export interface RingtoneAsset {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  source: RingtoneSourceType;
  updatedAt: number;
}

export interface CharacterRingtoneSettings {
  characterId: string;
  voom?: RingtoneAsset;
  message?: RingtoneAsset;
  theater?: RingtoneAsset;
  call?: RingtoneAsset;
}

export interface AppRingtoneSettings {
  enabled: boolean;
  global: Record<RingtoneEventType, RingtoneAsset>;
  characters: Record<string, CharacterRingtoneSettings>;
}

export interface AppKeepAliveSettings {
  enabled: boolean;
  silentAudio: boolean;
  notifications: boolean;
  wakeLock: boolean;
}

export type ThemeFontSource = 'url' | 'file' | 'family';

export interface ThemeFontEntry {
  id: string;
  name: string;
  family: string;
  source: ThemeFontSource;
  url: string;
  cachedUrl?: string;
  cachedCss?: string;
  cachedAssets?: string[];
  mimeType: string;
  size: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ThemeFontSettings {
  activeFontId: string;
  entries: ThemeFontEntry[];
}

export type ThemeStylePresetSource = 'custom' | 'imported';

export interface ThemeStylePreset {
  id: string;
  name: string;
  css: string;
  source: ThemeStylePresetSource;
  createdAt: number;
  updatedAt: number;
}

export interface ThemeStyleScopeSettings {
  activePresetId: string;
  presets: ThemeStylePreset[];
}

export interface ThemeGlobalSettings {
  scale: number;
  fullscreen: boolean;
  style: ThemeStyleScopeSettings;
}

export interface AppThemeSettings {
  fonts: ThemeFontSettings;
  global: ThemeGlobalSettings;
  online: ThemeStyleScopeSettings;
  offline: ThemeStyleScopeSettings;
}

export type McpServerKind = 'custom' | 'xiaohongshu' | 'qq' | 'reality' | 'notification-inbox' | 'termux' | 'taobao-search' | 'douyin-search' | 'xiaohongshu-search';

export type McpToolPolicy = 'disabled' | 'read-only' | 'all';

export type McpServerStatus = 'idle' | 'connected' | 'error';

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  enabled: boolean;
  write: boolean;
}

export interface McpServerConfig {
  id: string;
  name: string;
  kind: McpServerKind;
  description: string;
  url: string;
  headers: Record<string, string>;
  apiKey: string;
  apiKeyHeader: string;
  apiKeyPrefix: string;
  enabled: boolean;
  globalEnabled: boolean;
  toolPolicy: McpToolPolicy;
  timeoutMs: number;
  tools: McpToolDefinition[];
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
  lastStatus: McpServerStatus;
  lastCheckedAt: number;
  lastError: string;
}

export interface McpSettings {
  enabled: boolean;
  maxToolCallsPerReply: number;
  servers: McpServerConfig[];
}

export type RealityRecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RealityRecurrenceRule {
  frequency: RealityRecurrenceFrequency;
  interval: number;
  weekdays: number[];
  endAt: number;
  count: number;
}

export interface RealityReminder {
  id: string;
  title: string;
  body: string;
  at: number;
  createdAt: number;
  updatedAt: number;
  completed: boolean;
  completedAt: number;
  recurrence: RealityRecurrenceRule | null;
}

export interface RealityMemo {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface RealityCalendarEvent {
  id: string;
  systemEventId: string;
  title: string;
  startAt: number;
  endAt: number;
  location: string;
  notes: string;
  isAllDay: boolean;
  createdAt: number;
  updatedAt: number;
  recurrence: RealityRecurrenceRule | null;
}

export interface RealityMcpSettings {
  reminders: RealityReminder[];
  memos: RealityMemo[];
  calendarEvents: RealityCalendarEvent[];
}

export type FriendsDisplayScope = 'active-user' | 'all-users';

export interface AppSettings {
  activeUserId: string;
  friendsDisplayScope: FriendsDisplayScope;
  homeCardImages: string[];
  apiEndpoint: string;
  apiKey: string;
  model: string;
  modelOverrides: ChatModelOverrides;
  apiVendors: ApiVendor[];
  autoGenerateVoom: boolean;
  disclaimerAccepted: boolean;
  ttsEnabled: boolean;
  ttsVoice: string;
  ttsPlaybackMode: 'manual' | 'auto';
  ttsProvider: TtsProviderType;
  ttsOpenAi: OpenAiTtsSettings;
  ttsMinimax: MinimaxTtsSettings;
  ttsDoubao: DoubaoTtsSettings;
  imageModel: string;
  imageSize: string;
  imagePromptPrefix: string;
  imageOpenAi: OpenAiImageSettings;
  imageNovelAi: NovelAiImageSettings;
  imagePollinations: PollinationsImageSettings;
  imageModelOverrides: Record<ImageModelScope, ImageModelSelection>;
  voomImageProvider: ImageProviderType | '';
  voomImageModel: string;
  voomReadAtByUser: Record<string, Record<string, number>>;
  voomAutoCleanup: Record<string, CharacterVoomAutoCleanupSettings>;
  smallTheaterAutoCleanup: Record<string, CharacterSmallTheaterAutoCleanupSettings>;
  profileHomepageAutoCleanup: Record<string, CharacterProfileHomepageAutoCleanupSettings>;
  smallTheaterTopicEnabledByCharacter: Record<string, Record<string, boolean>>;
  profileThemeEnabledByCharacter: Record<string, Record<string, boolean>>;
  smallTheaterTopicDefaultsInitialized: Record<string, number>;
  keepAlive: AppKeepAliveSettings;
  ringtoneSettings: AppRingtoneSettings;
  themeSettings: AppThemeSettings;
  mcpSettings: McpSettings;
  realityMcpSettings: RealityMcpSettings;
  imagePrivateOnly: boolean;
  imageGenerationEnabled: boolean;
  githubBackup: GitHubBackupSettings;
  cloudBackup: CloudBackupSettings;
}

export interface AppSnapshot {
  users: UserProfile[];
  characters: CharacterProfile[];
  conversations: Conversation[];
  messages: ChatMessage[];
  voomPosts: VoomPost[];
  profileThemes: ProfileTheme[];
  profileHomepages: ProfileHomepageRecord[];
  smallTheaterTopics: SmallTheaterTopic[];
  smallTheaters: SmallTheater[];
  fanficBooks: FanficBook[];
  fanficChapters: FanficChapter[];
  fanficComments: FanficComment[];
  fanficTopics: FanficTopic[];
  fanficGenerationJobs: FanficGenerationJob[];
  musicFavoriteTracks: MusicTrack[];
  musicCommentThreads: MusicCommentThread[];
  worldBooks: WorldBookEntry[];
  stickerGroups: StickerGroup[];
  stickers: Sticker[];
  conversationSettings: ConversationSettings[];
  memoryEpisodes: MemoryEpisode[];
  memoryEntities: MemoryEntity[];
  memoryAssertions: MemoryAssertion[];
  memoryEdges: MemoryEdge[];
  memoryThemes: MemoryTheme[];
  memoryStateSnapshots: MemoryStateSnapshot[];
  memoryEmbeddings: MemoryEmbeddingCache[];
  generatedImages: GeneratedImageRecord[];
  favorites: FavoriteMessageRecord[];
  walletAccounts?: WalletAccount[];
  walletTransactions?: WalletTransaction[];
  shopStorefronts?: ShopStorefront[];
  shopProducts?: ShopProduct[];
  shopCartItems?: ShopCartItem[];
  shopWishlistItems?: ShopWishlistItem[];
  shopOrders?: ShopOrder[];
  shopMoments?: ShopMoment[];
  roleSocialAccounts?: RoleSocialAccount[];
  userSocialAccounts?: UserSocialAccount[];
  roleContentDrafts?: RoleContentDraft[];
  roleOutboundTasks?: RoleOutboundTask[];
  roleOperationPolicies?: RoleOperationPolicy[];
  roleOperationAudits?: RoleOperationAuditEntry[];
  settings: AppSettings;
}

export interface PromptContext {
  user: UserProfile;
  character: CharacterProfile;
  boundUser: UserProfile;
  mode: ChatMode;
  messages: ChatMessage[];
  recentVoomPosts?: VoomPost[];
  recentSmallTheaters?: SmallTheater[];
  worldBooks: WorldBookEntry[];
  conversationSummary: string;
  memorySummary?: string;
  historyMessageLimit?: number;
  stickerVisionEnabled?: boolean;
  narrationModeEnabled?: boolean;
  offlineInvitationEnabled?: boolean;
  availableStickers?: ChatStickerAttachment[];
  timeAwareness?: ConversationTimeAwarenessSettings;
  voomImageMode?: VoomImageMode;
  timeAwarenessNow?: number;
  offlineSettings?: ConversationOfflineSettings;
  replyInstruction?: string;
  activeProfileTheme?: Pick<ProfileTheme, 'id' | 'name' | 'prompt' | 'regex' | 'css' | 'template' | 'source' | 'builtIn'>;
  musicListening?: MusicListeningContext;
  characterEconomy?: CharacterEconomySnapshot;
}

export interface GenerateReplyInput extends PromptContext {
  userMessage: string;
  settings?: AppSettings;
  modelOverride?: string;
  persistSettings?: (settings: AppSettings) => Promise<void>;
}