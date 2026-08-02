import type { AppSettings, CharacterProfile, ChatMessage, Conversation, ProfileHomepageRecord, ProfileTheme, SmallTheater, SmallTheaterTopic, Sticker, StickerGroup, UserProfile, VoomPost, WorldBookEntry } from '@/types/domain';
import { createUserVisualProfile, defaultProfileAvatar } from '@/utils/profile';
import { createDefaultKeepAliveSettings, createDefaultMcpSettings, createDefaultRealityMcpSettings, createDefaultRingtoneSettings, createDefaultThemeSettings } from '@/utils/settings';
import { createTabooWorldBook } from '@/utils/worldBook';

export const defaultUsers: UserProfile[] = [
  {
    id: '1008600001',
    nickname: 'Linker',
    name: 'momo',
    avatar: defaultProfileAvatar,
    description: '该用户很懒，什么也没留下',
    signature: 'link to your excutive character',
    boundCharacterIds: [],
    profile: createUserVisualProfile({
      id: '1008600001',
      nickname: 'Linker',
      name: 'momo',
      signature: 'link to your excutive character'
    })
  }
];

export const defaultCharacters: CharacterProfile[] = [];

export const defaultConversations: Conversation[] = [];

export const defaultStickerGroups: StickerGroup[] = [];

export const defaultStickers: Sticker[] = [];

export const defaultMessages: ChatMessage[] = [];

export const defaultWorldBooks: WorldBookEntry[] = [createTabooWorldBook()];

export const defaultVoomPosts: VoomPost[] = [];

export const defaultProfileThemes: ProfileTheme[] = [];

export const defaultProfileHomepages: ProfileHomepageRecord[] = [];

export const defaultSmallTheaterTopics: SmallTheaterTopic[] = [];

export const defaultSmallTheaters: SmallTheater[] = [];

export const defaultSettings: AppSettings = {
  activeUserId: '1008600001',
  friendsDisplayScope: 'active-user',
  homeCardImages: ['', '', ''],
  apiEndpoint: '',
  apiKey: '',
  model: 'gpt-compatible-model',
  modelOverrides: {
    online: '',
    offline: '',
    summary: '',
    embedding: '',
    voom: '',
    theater: '',
    content: ''
  },
  autoGenerateVoom: true,
  disclaimerAccepted: false,
  ttsEnabled: true,
  ttsVoice: 'male-qn-qingse',
  ttsPlaybackMode: 'manual',
  ttsProvider: 'minimax',
  ttsOpenAi: {
    activeVendorId: '',
    vendors: [],
    apiKey: '',
    apiUrl: 'https://api.openai.com/v1',
    model: 'tts-1',
    voice: 'alloy',
    responseFormat: 'mp3',
    speed: 1,
    instructions: ''
  },
  ttsMinimax: {
    enabled: false,
    apiKey: '',
    groupId: '',
    apiUrl: 'https://api.minimax.io/v1/t2a_v2',
    model: 'speech-02-hd',
    voiceId: 'male-qn-qingse',
    speed: 1,
    volume: 1,
    pitch: 0,
    sampleRate: 32000,
    bitrate: 128000,
    audioFormat: 'mp3',
    channel: 1
  },
  ttsDoubao: {
    apiUrl: 'https://openspeech.bytedance.com/api/v1/tts',
    appId: '',
    token: '',
    cluster: 'volcano_tts',
    voiceType: 'BV700_streaming',
    uid: 'link-user',
    encoding: 'mp3',
    sampleRate: 24000,
    speedRatio: 1,
    volumeRatio: 1,
    pitchRatio: 1,
    emotion: '',
    language: '',
    textType: 'plain',
    silenceDuration: 125,
    splitSentence: false,
    pureEnglishOpt: false
  },
  imageModel: 'gpt-image-1',
  imageSize: '1024x1024',
  imagePromptPrefix: '',
  imageOpenAi: {
    activeVendorId: '',
    size: '1024x1024',
    activePromptPresetId: 'openai_default',
    promptPresets: [{ id: 'openai_default', name: '默认预设', positivePrompt: '', negativePrompt: '' }],
    positivePrompt: '',
    negativePrompt: '',
    lastImageUrl: '',
    vendors: []
  },
  imageNovelAi: {
    endpointMode: 'proxy',
    apiUrl: 'https://image.novelai.net',
    proxyUrl: 'https://nai.lolidoll.cc.cd',
    customProxyUrl: '',
    apiKey: '',
    model: 'nai-diffusion-4-5-full',
    availableModels: [
      { id: 'nai-diffusion-4-5-full', label: 'NAI Diffusion Anime V4.5 Full' },
      { id: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion Anime V4.5 Curated' },
      { id: 'nai-diffusion-4-5-curated-preview', label: 'NAI Diffusion Anime V4.5 Curated Preview' },
      { id: 'nai-diffusion-4-full', label: 'NAI Diffusion Anime V4 Full' },
      { id: 'nai-diffusion-4-curated-preview', label: 'NAI Diffusion Anime V4 Curated Preview' },
      { id: 'nai-diffusion-3', label: 'NAI Diffusion Anime V3' },
      { id: 'nai-diffusion-furry-3', label: 'NAI Diffusion Furry V3' }
    ],
    activePromptPresetId: 'novelai_default',
    promptPresets: [{ id: 'novelai_default', name: '默认预设', positivePrompt: '', negativePrompt: '' }],
    positivePrompt: '',
    negativePrompt: '',
    width: 832,
    height: 1216,
    guidance: 6.5,
    steps: 28,
    sampler: 'k_euler_ancestral',
    ucPreset: 0,
    qualityToggle: true,
    sm: false,
    smDyn: false,
    dynamicThresholding: false,
    cfgRescale: 0,
    noiseSchedule: 'native',
    seed: '',
    lastImageUrl: ''
  },
  imagePollinations: {
    apiKey: '',
    referrer: 'link-pwa',
    model: 'zimage',
    availableModels: [
      { id: 'zimage', label: 'Z-Image' },
      { id: 'flux', label: 'Flux' },
      { id: 'gptimage', label: 'GPT Image' },
      { id: 'kontext', label: 'FLUX.1 Kontext' },
      { id: 'seedream5', label: 'Seedream 5' },
      { id: 'nanobanana', label: 'NanoBanana' },
      { id: 'klein', label: 'Klein' },
      { id: 'qwen-image', label: 'Qwen Image' }
    ],
    activePromptPresetId: 'pollinations_default',
    promptPresets: [{ id: 'pollinations_default', name: '默认预设', positivePrompt: '', negativePrompt: '' }],
    positivePrompt: '',
    negativePrompt: '',
    width: 1024,
    height: 1024,
    seed: '',
    safe: 'true',
    quality: 'medium',
    referenceImage: '',
    transparent: false,
    enhance: true,
    nologo: true,
    private: true,
    lastImageUrl: ''
  },
  imageModelOverrides: {
    voom: { provider: '', model: '' },
    onlineChat: { provider: '', model: '' },
    callBackground: { provider: '', model: '' }
  },
  voomImageProvider: '',
  voomImageModel: '',
  voomReadAtByUser: {},
  voomAutoCleanup: {},
  smallTheaterAutoCleanup: {},
  profileHomepageAutoCleanup: {},
  smallTheaterTopicEnabledByCharacter: {},
  profileThemeEnabledByCharacter: {},
  thoughtChainThemes: [],
  smallTheaterTopicDefaultsInitialized: {},
  keepAlive: createDefaultKeepAliveSettings(),
  ringtoneSettings: createDefaultRingtoneSettings(),
  themeSettings: createDefaultThemeSettings(),
  mcpSettings: createDefaultMcpSettings(),
  realityMcpSettings: createDefaultRealityMcpSettings(),
  imagePrivateOnly: true,
  imageGenerationEnabled: true,
  githubBackup: {
    enabled: false,
    token: '',
    owner: '',
    repo: 'link-private-backups',
    branch: 'main',
    path: 'link-backup.json',
    intervalMinutes: 30,
    lastBackupAt: 0,
    lastBackupStatus: 'idle',
    lastBackupError: '',
    latestRemoteBackupAt: 0,
    latestRemoteBackupSha: '',
    pendingRestoreSha: '',
    pendingRestoreAt: 0,
    history: [],
    progress: {
      phase: 'idle',
      label: '',
      percent: 0,
      updatedAt: 0
    }
  },
  cloudBackup: {
    enabled: false,
    provider: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: 0,
    accountLabel: '',
    workerUrl: '',
    workerToken: '',
    recoveryKey: '',
    remoteFileId: '',
    fileName: 'babylink-backup.link',
    intervalMinutes: 30,
    lastBackupAt: 0,
    lastBackupStatus: 'idle',
    lastBackupError: '',
    latestRemoteBackupAt: 0,
    lastBackupBytes: 0,
    progress: {
      phase: 'idle',
      label: '',
      percent: 0,
      updatedAt: 0
    }
  },
  apiVendors: []
};