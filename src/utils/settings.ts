import type { ApiVendor, ApiVendorModel, AppKeepAliveSettings, AppRingtoneSettings, AppSettings, AppThemeSettings, ChatModelOverrides, CharacterProfileHomepageAutoCleanupSettings, CharacterRingtoneSettings, CharacterSmallTheaterAutoCleanupSettings, CharacterVoomAutoCleanupSettings, CloudBackupProvider, CloudBackupSettings, DoubaoTtsAudioFormat, DoubaoTtsSettings, DoubaoTtsTextType, GitHubBackupSettings, ImageModelScope, ImageModelSelection, ImagePromptPreset, ImageProviderType, McpServerConfig, McpServerKind, McpSettings, McpToolDefinition, McpToolPolicy, MinimaxTtsAudioFormat, MinimaxTtsSettings, NovelAiImageSettings, OpenAiImageSettings, OpenAiTtsAudioFormat, OpenAiTtsSettings, PollinationsImageSettings, ProfileHomepageAutoCleanupPreset, RealityCalendarEvent, RealityMcpSettings, RealityRecurrenceRule, RealityReminder, RingtoneAsset, RingtoneEventType, SmallTheaterAutoCleanupPreset, ThemeFontEntry, ThemeFontSource, ThemeGlobalSettings, ThemeStylePreset, ThemeStylePresetSource, ThemeStyleScopeSettings, TtsProviderType, VoomAutoCleanupPreset } from '@/types/domain';
import { createBuiltinRealityMcpServer } from '@/data/realityMcp';
import { createId } from './id';
import { normalizeGlobalThemeScale } from './themeScale';

export const novelAiOfficialApiUrl = 'https://image.novelai.net';
export const novelAiProxyApiUrl = 'https://nai.lolidoll.cc.cd';

export const defaultNovelAiModels = [
  { id: 'nai-diffusion-4-5-full', label: 'NAI Diffusion Anime V4.5 Full' },
  { id: 'nai-diffusion-4-5-curated', label: 'NAI Diffusion Anime V4.5 Curated' },
  { id: 'nai-diffusion-4-5-curated-preview', label: 'NAI Diffusion Anime V4.5 Curated Preview' },
  { id: 'nai-diffusion-4-full', label: 'NAI Diffusion Anime V4 Full' },
  { id: 'nai-diffusion-4-curated-preview', label: 'NAI Diffusion Anime V4 Curated Preview' },
  { id: 'nai-diffusion-3', label: 'NAI Diffusion Anime V3' },
  { id: 'nai-diffusion-furry-3', label: 'NAI Diffusion Furry V3' }
];

const novelAiV4UcPresetValues = new Set([3, 4, 5, 6, 7]);

export function isNovelAiV4FamilyModel(model: string) {
  return /^nai-diffusion-4(?:-|$)/i.test(model.trim());
}

export function normalizeNovelAiUcPreset(model: string, ucPreset: unknown) {
  const normalized = Math.round(Number(ucPreset));
  if (isNovelAiV4FamilyModel(model)) {
    return novelAiV4UcPresetValues.has(normalized) ? normalized : 4;
  }
  return Number.isFinite(normalized) ? Math.min(7, Math.max(0, normalized)) : 0;
}

export const defaultPollinationsModels = [
  { id: 'zimage', label: 'Z-Image' },
  { id: 'flux', label: 'Flux' },
  { id: 'gptimage', label: 'GPT Image' },
  { id: 'kontext', label: 'FLUX.1 Kontext' },
  { id: 'seedream5', label: 'Seedream 5' },
  { id: 'nanobanana', label: 'NanoBanana' },
  { id: 'klein', label: 'Klein' },
  { id: 'qwen-image', label: 'Qwen Image' }
];

export interface ConfiguredImageModelOption {
  key: string;
  provider: ImageProviderType;
  providerLabel: string;
  label: string;
  detail: string;
  model: string;
}

export const disabledImageModelSelectionValue = '__disabled__';

const imageProviderOrder: ImageProviderType[] = ['openai', 'novelai', 'pollinations'];
const ttsProviderOrder: TtsProviderType[] = ['minimax', 'openai', 'doubao'];
const openAiTtsAudioFormats: OpenAiTtsAudioFormat[] = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
const doubaoTtsAudioFormats: DoubaoTtsAudioFormat[] = ['mp3', 'wav', 'pcm', 'ogg_opus'];
const doubaoTtsTextTypes: DoubaoTtsTextType[] = ['plain', 'ssml'];
const openAiImageGenerationPath = '/images/generations';
const openAiTtsSpeechPath = '/audio/speech';
const legacyOpenAiTtsVoice = 'alloy';
const defaultPromptPresetName = '默认预设';
const defaultOpenAiPromptPresetId = 'openai_default';
const defaultNovelAiPromptPresetId = 'novelai_default';
const defaultPollinationsPromptPresetId = 'pollinations_default';
export const ringtoneEventTypes: RingtoneEventType[] = ['voom', 'message', 'theater', 'call'];
export const defaultRingtoneFileName = '吉森信 - 前略 じーちゃん.mp3';

function getPublicAssetUrl(fileName: string) {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${fileName}`;
}

export const defaultRingtoneUrl = getPublicAssetUrl('default-ringtone.mp3');

export const openAiImageSizeOptions = ['1024x1024', '832x1216', '768x1152', '640x960', '1216x832', '1152x768'];

export const defaultImageNegativePrompt = 'inconsistent face, different identity, face swap, warped face, distorted eyes, asymmetrical eyes, bad anatomy, deformed hands, extra fingers, missing fingers, low quality, blurry, watermark, text artifacts';

export const defaultOnlineChatImagePromptTemplate = [
  '{basePrompt}',
  'A private mobile chat photo sent by the character, natural candid composition, believable phone camera framing.',
  '{characterAppearance}',
  '{faceConsistency}',
  '{generationPrompt}',
  'User-facing Chinese scene note: {sceneDescription}'
].join('\n');

export const defaultVoomImagePromptTemplate = [
  '{basePrompt}',
  'A LINK VOOM social feed image, casual lifestyle photo, natural mobile photography, coherent with the post text.',
  '{characterAppearance}',
  '{faceConsistency}',
  '{generationPrompt}',
  'User-facing Chinese scene note: {sceneDescription}'
].join('\n');

export function parseImageSize(size: string) {
  const [width, height] = size.split('x').map((value) => Number.parseInt(value, 10));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : { width: 720, height: 1280 };
}

export function getImageGenerationSize(settings: AppSettings, provider: ImageProviderType) {
  if (provider === 'novelai') {
    return {
      size: `${settings.imageNovelAi.width}x${settings.imageNovelAi.height}`,
      width: settings.imageNovelAi.width,
      height: settings.imageNovelAi.height
    };
  }
  if (provider === 'pollinations') {
    return {
      size: `${settings.imagePollinations.width}x${settings.imagePollinations.height}`,
      width: settings.imagePollinations.width,
      height: settings.imagePollinations.height
    };
  }
  const size = openAiImageSizeOptions.includes(settings.imageOpenAi.size) ? settings.imageOpenAi.size : defaultAppSettings.imageOpenAi.size;
  return { size, ...parseImageSize(size) };
}

const defaultVendorAvatar = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#fff8fb" />
      <stop offset="100%" stop-color="#e7f6eb" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="32" fill="url(#g)" />
  <circle cx="60" cy="48" r="24" fill="#111111" opacity="0.08" />
  <path d="M35 86c6-13 18-20 25-20s19 7 25 20" fill="#111111" opacity="0.12" />
  <circle cx="60" cy="48" r="18" fill="#111111" opacity="0.82" />
  <path d="M42 86c5-10 12-15 18-15s13 5 18 15" fill="#111111" opacity="0.82" />
</svg>
`)}`;

function normalizeVendorAvatar(avatar: string | null | undefined) {
  const trimmed = String(avatar ?? '').trim();
  if (!trimmed || trimmed === 'https://api.dicebear.com/9.x/shapes/svg?seed=OpenAI&backgroundColor=e8f5e9') {
    return defaultVendorAvatar;
  }
  return trimmed;
}

export function normalizeChatModelOverrides(overrides?: Partial<ChatModelOverrides> | null): ChatModelOverrides {
  return {
    online: String(overrides?.online ?? '').trim(),
    offline: String(overrides?.offline ?? '').trim(),
    summary: String(overrides?.summary ?? '').trim(),
    voom: String(overrides?.voom ?? '').trim(),
    theater: String(overrides?.theater ?? '').trim(),
    groupDiscovery: String(overrides?.groupDiscovery ?? '').trim()
  };
}

function createDefaultRingtoneAsset(): RingtoneAsset {
  return {
    id: 'ringtone_default_jichan',
    name: defaultRingtoneFileName,
    url: defaultRingtoneUrl,
    mimeType: 'audio/mpeg',
    size: 0,
    source: 'default',
    updatedAt: 0
  };
}

export function createDefaultRingtoneSettings(): AppRingtoneSettings {
  return {
    enabled: true,
    global: {
      voom: createDefaultRingtoneAsset(),
      message: createDefaultRingtoneAsset(),
      theater: createDefaultRingtoneAsset(),
      call: createDefaultRingtoneAsset()
    },
    characters: {}
  };
}

export function createDefaultKeepAliveSettings(): AppKeepAliveSettings {
  return {
    enabled: false,
    silentAudio: true,
    notifications: true,
    wakeLock: true
  };
}

export function createDefaultThemeSettings(): AppThemeSettings {
  const emptyStyleScope = { activePresetId: '', presets: [] } satisfies ThemeStyleScopeSettings;
  return {
    fonts: {
      activeFontId: '',
      entries: []
    },
    global: { scale: 1, fullscreen: true, style: { ...emptyStyleScope } },
    online: { ...emptyStyleScope },
    offline: { ...emptyStyleScope }
  };
}

export function createDefaultMcpSettings(): McpSettings {
  return {
    enabled: true,
    maxToolCallsPerReply: 3,
    servers: [createBuiltinRealityMcpServer()]
  };
}

export function createDefaultRealityMcpSettings(): RealityMcpSettings {
  return {
    reminders: [],
    calendarEvents: []
  };
}

const reservedMcpHeaders = new Set([
  'accept',
  'content-length',
  'content-type',
  'cookie',
  'host',
  'mcp-protocol-version',
  'mcp-session-id',
  'origin'
]);

function normalizeMcpHeaders(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const headers: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(value)) {
    const name = rawName.trim();
    if (!name || reservedMcpHeaders.has(name.toLowerCase())) continue;
    const headerValue = String(rawValue ?? '').trim();
    if (headerValue) headers[name] = headerValue;
  }
  return headers;
}

function normalizeMcpApiKeyHeader(value: unknown) {
  const header = String(value ?? '').trim() || 'Authorization';
  return reservedMcpHeaders.has(header.toLowerCase()) && header.toLowerCase() !== 'authorization'
    ? 'Authorization'
    : header;
}

function normalizeMcpServerKind(value: unknown): McpServerKind {
  return value === 'xiaohongshu'
    || value === 'qq'
    || value === 'reality'
    || value === 'taobao-search'
    || value === 'douyin-search'
    || value === 'xiaohongshu-search'
    ? value
    : 'custom';
}

function normalizeMcpToolPolicy(value: unknown): McpToolPolicy {
  return value === 'disabled' || value === 'all' ? value : 'read-only';
}

function normalizeMcpTool(value: unknown): McpToolDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<McpToolDefinition>;
  const name = String(source.name ?? '').trim();
  if (!name) return null;
  const inputSchema = source.inputSchema && typeof source.inputSchema === 'object' && !Array.isArray(source.inputSchema)
    ? source.inputSchema
    : { type: 'object', properties: {} };
  return {
    name,
    title: String(source.title ?? '').trim(),
    description: String(source.description ?? '').trim(),
    inputSchema,
    enabled: source.enabled !== false,
    write: Boolean(source.write)
  };
}

function normalizeMcpServer(value: unknown): McpServerConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<McpServerConfig>;
  const kind = normalizeMcpServerKind(source.kind);
  const id = String(source.id ?? '').trim();
  const url = kind === 'reality' ? 'builtin://reality' : String(source.url ?? '').trim();
  if (!id || (!url && kind !== 'reality')) return null;
  const fallback = kind === 'reality' ? createBuiltinRealityMcpServer() : null;
  const normalizedTools = Array.isArray(source.tools)
    ? source.tools.map(normalizeMcpTool).filter((tool): tool is McpToolDefinition => Boolean(tool))
    : [];
  const savedTools = new Map(normalizedTools.map((tool) => [tool.name, tool]));
  const tools = fallback
    ? fallback.tools.map((tool) => ({ ...tool, enabled: savedTools.get(tool.name)?.enabled ?? tool.enabled }))
    : normalizedTools;
  const timeoutMs = Math.round(Number(source.timeoutMs) || 45_000);
  return {
    id,
    name: String(source.name ?? '').trim() || fallback?.name || 'MCP Server',
    kind,
    description: String(source.description ?? '').trim() || fallback?.description || '',
    url,
    headers: normalizeMcpHeaders(source.headers),
    apiKey: String(source.apiKey ?? '').trim(),
    apiKeyHeader: normalizeMcpApiKeyHeader(source.apiKeyHeader),
    apiKeyPrefix: String(source.apiKeyPrefix ?? 'Bearer ').replace(/[\r\n]/g, ''),
    enabled: source.enabled !== false,
    globalEnabled: source.globalEnabled ?? fallback?.globalEnabled ?? false,
    toolPolicy: kind === 'reality' ? 'all' : normalizeMcpToolPolicy(source.toolPolicy),
    timeoutMs: Math.min(120_000, Math.max(3_000, timeoutMs)),
    tools: [...new Map(tools.map((tool) => [tool.name, tool])).values()],
    protocolVersion: String(source.protocolVersion ?? '').trim() || fallback?.protocolVersion || '',
    serverName: String(source.serverName ?? '').trim() || fallback?.serverName || '',
    serverVersion: String(source.serverVersion ?? '').trim() || fallback?.serverVersion || '',
    lastStatus: kind === 'reality'
      ? 'connected'
      : source.lastStatus === 'connected' || source.lastStatus === 'error'
        ? source.lastStatus
        : 'idle',
    lastCheckedAt: Math.max(0, Number(source.lastCheckedAt) || 0),
    lastError: String(source.lastError ?? '').trim()
  };
}

export function normalizeMcpSettings(settings?: Partial<McpSettings> | null): McpSettings {
  const fallback = createDefaultMcpSettings();
  const normalizedServers = Array.isArray(settings?.servers)
    ? settings.servers.map(normalizeMcpServer).filter((server): server is McpServerConfig => Boolean(server))
    : [];
  const realityServer = normalizedServers.find((server) => server.kind === 'reality') ?? fallback.servers[0];
  const servers = [realityServer, ...normalizedServers.filter((server) => server.id !== realityServer.id)];
  return {
    enabled: settings?.enabled !== false,
    maxToolCallsPerReply: Math.min(6, Math.max(1, Math.round(Number(settings?.maxToolCallsPerReply) || fallback.maxToolCallsPerReply))),
    servers: [...new Map(servers.map((server) => [server.id, server])).values()]
  };
}

function normalizeRealityReminder(value: unknown): RealityReminder | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<RealityReminder>;
  const id = String(source.id ?? '').trim();
  const title = String(source.title ?? '').trim();
  const at = Number(source.at);
  if (!id || !title || !Number.isFinite(at) || at <= 0) return null;
  const createdAt = Math.max(0, Number(source.createdAt) || Date.now());
  return {
    id,
    title,
    body: String(source.body ?? '').trim(),
    at,
    createdAt,
    updatedAt: Math.max(createdAt, Number(source.updatedAt) || createdAt),
    completed: Boolean(source.completed),
    completedAt: Math.max(0, Number(source.completedAt) || 0),
    recurrence: normalizeRealityRecurrence(source.recurrence)
  };
}

function normalizeRealityRecurrence(value: unknown): RealityRecurrenceRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<RealityRecurrenceRule>;
  const frequency = String(source.frequency ?? '');
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) return null;
  const weekdays = Array.isArray(source.weekdays)
    ? [...new Set(source.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))]
    : [];
  return {
    frequency: frequency as RealityRecurrenceRule['frequency'],
    interval: Math.min(365, Math.max(1, Math.round(Number(source.interval) || 1))),
    weekdays,
    endAt: Math.max(0, Number(source.endAt) || 0),
    count: Math.min(999, Math.max(0, Math.round(Number(source.count) || 0)))
  };
}

function normalizeRealityCalendarEvent(value: unknown): RealityCalendarEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Partial<RealityCalendarEvent>;
  const id = String(source.id ?? '').trim();
  const title = String(source.title ?? '').trim();
  const startAt = Number(source.startAt);
  if (!id || !title || !Number.isFinite(startAt) || startAt <= 0) return null;
  const rawEndAt = Number(source.endAt);
  const createdAt = Math.max(0, Number(source.createdAt) || Date.now());
  return {
    id,
    systemEventId: String(source.systemEventId ?? source.id ?? '').trim(),
    title,
    startAt,
    endAt: Number.isFinite(rawEndAt) && rawEndAt > startAt ? rawEndAt : startAt + 60 * 60_000,
    location: String(source.location ?? '').trim(),
    notes: String(source.notes ?? '').trim(),
    isAllDay: Boolean(source.isAllDay),
    createdAt,
    updatedAt: Math.max(createdAt, Number(source.updatedAt) || createdAt),
    recurrence: normalizeRealityRecurrence(source.recurrence)
  };
}

function normalizeRealityMcpSettings(settings?: Partial<RealityMcpSettings> | null): RealityMcpSettings {
  const reminders = Array.isArray(settings?.reminders)
    ? settings.reminders.map(normalizeRealityReminder).filter((reminder): reminder is RealityReminder => Boolean(reminder))
    : [];
  const calendarEvents = Array.isArray(settings?.calendarEvents)
    ? settings.calendarEvents.map(normalizeRealityCalendarEvent).filter((event): event is RealityCalendarEvent => Boolean(event))
    : [];
  return {
    reminders: [...new Map(reminders.map((reminder) => [reminder.id, reminder])).values()].sort((left, right) => left.at - right.at),
    calendarEvents: [...new Map(calendarEvents.map((event) => [event.id, event])).values()].sort((left, right) => left.startAt - right.startAt)
  };
}

export const defaultAppSettings: AppSettings = {
  activeUserId: '',
  friendsDisplayScope: 'active-user',
  homeCardImages: ['', '', ''],
  apiEndpoint: '',
  apiKey: '',
  model: 'gpt-compatible-model',
  modelOverrides: normalizeChatModelOverrides(null),
  apiVendors: [],
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
    activePromptPresetId: defaultOpenAiPromptPresetId,
    promptPresets: [{ id: defaultOpenAiPromptPresetId, name: defaultPromptPresetName, positivePrompt: '', negativePrompt: '' }],
    positivePrompt: '',
    negativePrompt: '',
    lastImageUrl: '',
    vendors: []
  },
  imageNovelAi: {
    endpointMode: 'proxy',
    apiUrl: novelAiOfficialApiUrl,
    proxyUrl: novelAiProxyApiUrl,
    customProxyUrl: '',
    apiKey: '',
    model: defaultNovelAiModels[0].id,
    availableModels: defaultNovelAiModels,
    activePromptPresetId: defaultNovelAiPromptPresetId,
    promptPresets: [{ id: defaultNovelAiPromptPresetId, name: defaultPromptPresetName, positivePrompt: '', negativePrompt: '' }],
    positivePrompt: '',
    negativePrompt: '',
    width: 832,
    height: 1216,
    guidance: 6.5,
    steps: 28,
    sampler: 'k_euler_ancestral',
    ucPreset: 4,
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
    availableModels: defaultPollinationsModels,
    activePromptPresetId: defaultPollinationsPromptPresetId,
    promptPresets: [{ id: defaultPollinationsPromptPresetId, name: defaultPromptPresetName, positivePrompt: '', negativePrompt: '' }],
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
  }
};

function normalizeImageProvider(provider: string | null | undefined): ImageProviderType | '' {
  const normalized = String(provider ?? '').trim();
  return imageProviderOrder.includes(normalized as ImageProviderType) ? normalized as ImageProviderType : '';
}

function normalizeFriendsDisplayScope(scope: string | null | undefined) {
  return scope === 'all-users' ? 'all-users' : 'active-user';
}

function normalizeHomeCardImages(images: unknown) {
  const entries = Array.isArray(images) ? images : [];
  return Array.from({ length: 3 }, (_, index) => String(entries[index] ?? '').trim());
}

function normalizeTtsProvider(provider: string | null | undefined): TtsProviderType | '' {
  const normalized = String(provider ?? '').trim().toLowerCase();
  return ttsProviderOrder.includes(normalized as TtsProviderType) ? normalized as TtsProviderType : '';
}

function normalizeLegacyTtsVoice(voice: string | null | undefined) {
  const normalized = String(voice ?? '').trim();
  return normalized && normalized !== legacyOpenAiTtsVoice ? normalized : '';
}

function normalizeImageModelSelection(selection: Partial<ImageModelSelection> | null | undefined, fallback?: Partial<ImageModelSelection> | null): ImageModelSelection {
  if (isImageModelSelectionDisabled(selection)) {
    return { provider: '', model: disabledImageModelSelectionValue };
  }
  const provider = normalizeImageProvider(selection?.provider ?? fallback?.provider);
  return {
    provider,
    model: String(selection?.model ?? fallback?.model ?? '').trim()
  };
}

export function isImageModelSelectionDisabled(selection: Partial<ImageModelSelection> | null | undefined) {
  return !normalizeImageProvider(selection?.provider) && String(selection?.model ?? '').trim() === disabledImageModelSelectionValue;
}

function normalizeImageModelOverrides(settings?: Partial<AppSettings> | null) {
  if (settings?.imageGenerationEnabled === false) {
    const disabledSelection = { provider: '', model: disabledImageModelSelectionValue } satisfies ImageModelSelection;
    return {
      voom: disabledSelection,
      onlineChat: disabledSelection,
      callBackground: disabledSelection
    } satisfies Record<ImageModelScope, ImageModelSelection>;
  }
  const legacySelection = {
    provider: settings?.voomImageProvider,
    model: settings?.voomImageModel
  };
  const overrides = settings?.imageModelOverrides;
  return {
    voom: normalizeImageModelSelection(overrides?.voom, legacySelection),
    onlineChat: normalizeImageModelSelection(overrides?.onlineChat, legacySelection),
    callBackground: normalizeImageModelSelection(overrides?.callBackground)
  } satisfies Record<ImageModelScope, ImageModelSelection>;
}

function normalizeVoomReadAtByUser(input: unknown): Record<string, Record<string, number>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, Record<string, number>> = {};
  for (const [userId, characterMap] of Object.entries(input)) {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId || !characterMap || typeof characterMap !== 'object' || Array.isArray(characterMap)) continue;

    const normalizedCharacterMap: Record<string, number> = {};
    for (const [characterId, readAt] of Object.entries(characterMap)) {
      const normalizedCharacterId = characterId.trim();
      const timestamp = Math.max(0, Number(readAt) || 0);
      if (normalizedCharacterId && timestamp > 0) normalizedCharacterMap[normalizedCharacterId] = timestamp;
    }
    if (Object.keys(normalizedCharacterMap).length) normalized[normalizedUserId] = normalizedCharacterMap;
  }

  return normalized;
}

function normalizeVoomCleanupDays(input: unknown) {
  const days = Math.round(Number(input) || 0);
  return Math.min(3650, Math.max(1, days || 7));
}

function normalizeVoomCleanupPreset(input: unknown, days: number): VoomAutoCleanupPreset {
  if (input === '3' || input === '7' || input === '30' || input === 'custom') return input;
  if (days === 3 || days === 7 || days === 30) return String(days) as VoomAutoCleanupPreset;
  return 'custom';
}

function normalizeSmallTheaterCleanupPreset(input: unknown, days: number): SmallTheaterAutoCleanupPreset {
  return normalizeVoomCleanupPreset(input, days);
}

function normalizeProfileHomepageCleanupPreset(input: unknown, days: number): ProfileHomepageAutoCleanupPreset {
  return normalizeVoomCleanupPreset(input, days);
}

function normalizeVoomAutoCleanup(input: unknown): Record<string, CharacterVoomAutoCleanupSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, CharacterVoomAutoCleanupSettings> = {};
  for (const [characterId, rawEntry] of Object.entries(input)) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entry = rawEntry as Partial<CharacterVoomAutoCleanupSettings>;
    const days = normalizeVoomCleanupDays(entry.days);
    normalized[normalizedCharacterId] = {
      enabled: Boolean(entry.enabled),
      days,
      preset: normalizeVoomCleanupPreset(entry.preset, days),
      lastCleanupAt: Math.max(0, Number(entry.lastCleanupAt) || 0)
    };
  }

  return normalized;
}

function normalizeSmallTheaterAutoCleanup(input: unknown): Record<string, CharacterSmallTheaterAutoCleanupSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, CharacterSmallTheaterAutoCleanupSettings> = {};
  for (const [characterId, rawEntry] of Object.entries(input)) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entry = rawEntry as Partial<CharacterSmallTheaterAutoCleanupSettings>;
    const days = normalizeVoomCleanupDays(entry.days);
    normalized[normalizedCharacterId] = {
      enabled: Boolean(entry.enabled),
      days,
      preset: normalizeSmallTheaterCleanupPreset(entry.preset, days),
      lastCleanupAt: Math.max(0, Number(entry.lastCleanupAt) || 0)
    };
  }

  return normalized;
}

function normalizeProfileHomepageAutoCleanup(input: unknown): Record<string, CharacterProfileHomepageAutoCleanupSettings> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, CharacterProfileHomepageAutoCleanupSettings> = {};
  for (const [characterId, rawEntry] of Object.entries(input)) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entry = rawEntry as Partial<CharacterProfileHomepageAutoCleanupSettings>;
    const days = normalizeVoomCleanupDays(entry.days);
    normalized[normalizedCharacterId] = {
      enabled: Boolean(entry.enabled),
      days,
      preset: normalizeProfileHomepageCleanupPreset(entry.preset, days),
      lastCleanupAt: Math.max(0, Number(entry.lastCleanupAt) || 0)
    };
  }

  return normalized;
}

function normalizeTimestampRecord(input: unknown): Record<string, number> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.trim();
    const timestamp = Math.max(0, Number(value) || 0);
    if (normalizedKey && timestamp > 0) normalized[normalizedKey] = timestamp;
  }
  return normalized;
}

function normalizeBooleanRecordMap(input: unknown): Record<string, Record<string, boolean>> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};

  const normalized: Record<string, Record<string, boolean>> = {};
  for (const [outerKey, rawEntry] of Object.entries(input)) {
    const normalizedOuterKey = outerKey.trim();
    if (!normalizedOuterKey || !rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;

    const normalizedEntry: Record<string, boolean> = {};
    for (const [innerKey, value] of Object.entries(rawEntry)) {
      const normalizedInnerKey = innerKey.trim();
      if (normalizedInnerKey && typeof value === 'boolean') normalizedEntry[normalizedInnerKey] = value;
    }
    if (Object.keys(normalizedEntry).length) normalized[normalizedOuterKey] = normalizedEntry;
  }

  return normalized;
}

function normalizeRingtoneAsset(asset: Partial<RingtoneAsset> | null | undefined, fallback?: RingtoneAsset): RingtoneAsset | null {
  const source = asset?.source === 'imported' ? 'imported' : fallback?.source ?? 'default';
  const url = source === 'default'
    ? String(fallback?.url ?? defaultRingtoneUrl).trim()
    : String(asset?.url ?? fallback?.url ?? '').trim();
  if (!url) return fallback ? { ...fallback } : null;
  return {
    id: String(asset?.id ?? fallback?.id ?? '').trim() || (source === 'default' ? 'ringtone_default_jichan' : createId('ringtone')),
    name: String(asset?.name ?? fallback?.name ?? '').trim() || defaultRingtoneFileName,
    url,
    mimeType: String(asset?.mimeType ?? fallback?.mimeType ?? '').trim() || 'audio/mpeg',
    size: Math.max(0, Math.round(Number(asset?.size ?? fallback?.size ?? 0) || 0)),
    source,
    updatedAt: Math.max(0, Number(asset?.updatedAt ?? fallback?.updatedAt ?? 0) || 0)
  };
}

function normalizeCharacterRingtoneSettings(entry: Partial<CharacterRingtoneSettings> | null | undefined): CharacterRingtoneSettings | null {
  const characterId = String(entry?.characterId ?? '').trim();
  if (!characterId) return null;

  const normalized: CharacterRingtoneSettings = { characterId };
  ringtoneEventTypes.forEach((eventType) => {
    const asset = normalizeRingtoneAsset(entry?.[eventType]);
    if (asset) normalized[eventType] = asset;
  });

  return ringtoneEventTypes.some((eventType) => normalized[eventType]) ? normalized : null;
}

export function normalizeRingtoneSettings(settings: Partial<AppRingtoneSettings> | null | undefined): AppRingtoneSettings {
  const fallback = createDefaultRingtoneSettings();
  const enabled = settings?.enabled === false ? false : fallback.enabled;
  const global = ringtoneEventTypes.reduce((result, eventType) => {
    result[eventType] = normalizeRingtoneAsset(settings?.global?.[eventType], fallback.global[eventType]) ?? fallback.global[eventType];
    return result;
  }, {} as Record<RingtoneEventType, RingtoneAsset>);

  const characters: Record<string, CharacterRingtoneSettings> = {};
  if (settings?.characters && typeof settings.characters === 'object' && !Array.isArray(settings.characters)) {
    Object.entries(settings.characters).forEach(([characterId, entry]) => {
      const normalized = normalizeCharacterRingtoneSettings({ ...entry, characterId });
      if (normalized) characters[normalized.characterId] = normalized;
    });
  }

  return { enabled, global, characters };
}

export function normalizeKeepAliveSettings(settings: Partial<AppKeepAliveSettings> | null | undefined): AppKeepAliveSettings {
  const fallback = createDefaultKeepAliveSettings();
  return {
    enabled: Boolean(settings?.enabled ?? fallback.enabled),
    silentAudio: settings?.silentAudio === false ? false : fallback.silentAudio,
    notifications: settings?.notifications === false ? false : fallback.notifications,
    wakeLock: settings?.wakeLock === false ? false : fallback.wakeLock
  };
}

function normalizeThemeFontSource(source: string | null | undefined): ThemeFontSource {
  if (source === 'file') return 'file';
  if (source === 'family') return 'family';
  return 'url';
}

function normalizeThemeFontFamily(family: string | null | undefined) {
  return String(family ?? '')
    .replace(/[{};]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getThemeFontNameFromUrl(url: string, index: number) {
  try {
    const parsedUrl = new URL(url);
    const fileName = decodeURIComponent(parsedUrl.pathname.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').trim();
    return fileName || parsedUrl.hostname || `字体 ${index + 1}`;
  } catch {
    const fileName = url.split('/').pop()?.split('?')[0]?.replace(/\.[a-z0-9]+$/i, '').trim();
    return fileName || `字体 ${index + 1}`;
  }
}

function normalizeThemeFontEntry(entry: Partial<ThemeFontEntry> | null | undefined, index: number): ThemeFontEntry | null {
  const source = normalizeThemeFontSource(entry?.source);
  const url = String(entry?.url ?? '').trim();
  if (source !== 'family' && !url) return null;

  const family = normalizeThemeFontFamily(entry?.family) || String(entry?.name ?? '').trim() || (source === 'url' ? getThemeFontNameFromUrl(url, index) : '');
  if (!family) return null;

  const name = String(entry?.name ?? '').trim() || family;
  const now = Date.now();

  return {
    id: String(entry?.id ?? '').trim() || createId('theme-font'),
    name,
    family,
    source,
    url: source === 'family' ? '' : url,
    cachedUrl: source === 'family' ? '' : String(entry?.cachedUrl ?? '').trim(),
    cachedCss: source === 'family' ? '' : String(entry?.cachedCss ?? '').trim(),
    cachedAssets: source === 'family' || !Array.isArray(entry?.cachedAssets)
      ? []
      : entry.cachedAssets.map((asset) => String(asset ?? '').trim()).filter(Boolean),
    mimeType: String(entry?.mimeType ?? '').trim(),
    size: Math.max(0, Math.round(Number(entry?.size ?? 0) || 0)),
    enabled: entry?.enabled !== false,
    createdAt: Math.max(0, Number(entry?.createdAt ?? now) || now),
    updatedAt: Math.max(0, Number(entry?.updatedAt ?? now) || now)
  };
}

function normalizeThemeStylePresetSource(source: string | null | undefined): ThemeStylePresetSource {
  return source === 'imported' ? 'imported' : 'custom';
}

function normalizeThemeStylePreset(entry: Partial<ThemeStylePreset> | null | undefined, index: number): ThemeStylePreset | null {
  const css = String(entry?.css ?? '').trim();
  if (!css) return null;
  const now = Date.now();
  return {
    id: String(entry?.id ?? '').trim() || createId('theme-style'),
    name: String(entry?.name ?? '').trim() || `线上样式 ${index + 1}`,
    css,
    source: normalizeThemeStylePresetSource(entry?.source),
    createdAt: Math.max(0, Number(entry?.createdAt ?? now) || now),
    updatedAt: Math.max(0, Number(entry?.updatedAt ?? now) || now)
  };
}

function normalizeThemeStyleScope(settings: Partial<ThemeStyleScopeSettings> | null | undefined): ThemeStyleScopeSettings {
  const presets = Array.isArray(settings?.presets)
    ? settings.presets
        .map((entry, index) => normalizeThemeStylePreset(entry, index))
        .filter((entry): entry is ThemeStylePreset => Boolean(entry))
    : [];
  const activePresetId = String(settings?.activePresetId ?? '').trim();
  return {
    activePresetId: presets.some((entry) => entry.id === activePresetId) ? activePresetId : '',
    presets
  };
}

function normalizeThemeGlobalSettings(settings: Partial<ThemeGlobalSettings> | null | undefined): ThemeGlobalSettings {
  return {
    scale: normalizeGlobalThemeScale(settings?.scale),
    fullscreen: settings?.fullscreen ?? true,
    style: normalizeThemeStyleScope(settings?.style)
  };
}

export function normalizeThemeSettings(settings: Partial<AppThemeSettings> | null | undefined): AppThemeSettings {
  const entries = Array.isArray(settings?.fonts?.entries)
    ? settings.fonts.entries
        .map((entry, index) => normalizeThemeFontEntry(entry, index))
        .filter((entry): entry is ThemeFontEntry => Boolean(entry))
    : [];
  const activeFontId = String(settings?.fonts?.activeFontId ?? '').trim();

  return {
    fonts: {
      activeFontId: entries.some((entry) => entry.id === activeFontId && entry.enabled) ? activeFontId : '',
      entries
    },
    global: normalizeThemeGlobalSettings(settings?.global),
    online: normalizeThemeStyleScope(settings?.online),
    offline: normalizeThemeStyleScope(settings?.offline)
  };
}

function normalizeMinimaxTtsSettings(settings: Partial<MinimaxTtsSettings> | null | undefined, legacy: { enabled?: boolean; voiceId?: string } = {}): MinimaxTtsSettings {
  const audioFormat = String(settings?.audioFormat ?? defaultAppSettings.ttsMinimax.audioFormat).trim().toLowerCase();
  const normalizedAudioFormat: MinimaxTtsAudioFormat = ['mp3', 'wav', 'pcm'].includes(audioFormat)
    ? audioFormat as MinimaxTtsAudioFormat
    : defaultAppSettings.ttsMinimax.audioFormat;
  const channel = Number(settings?.channel ?? defaultAppSettings.ttsMinimax.channel) === 2 ? 2 : 1;

  return {
    enabled: Boolean(settings?.enabled ?? legacy.enabled),
    apiKey: String(settings?.apiKey ?? '').trim(),
    groupId: String(settings?.groupId ?? '').trim(),
    apiUrl: String(settings?.apiUrl ?? defaultAppSettings.ttsMinimax.apiUrl).trim() || defaultAppSettings.ttsMinimax.apiUrl,
    model: String(settings?.model ?? defaultAppSettings.ttsMinimax.model).trim() || defaultAppSettings.ttsMinimax.model,
    voiceId: String(settings?.voiceId ?? legacy.voiceId ?? defaultAppSettings.ttsMinimax.voiceId).trim() || defaultAppSettings.ttsMinimax.voiceId,
    speed: Math.min(2, Math.max(0.5, Number(settings?.speed ?? defaultAppSettings.ttsMinimax.speed) || defaultAppSettings.ttsMinimax.speed)),
    volume: Math.min(10, Math.max(0.1, Number(settings?.volume ?? defaultAppSettings.ttsMinimax.volume) || defaultAppSettings.ttsMinimax.volume)),
    pitch: Math.min(12, Math.max(-12, Number(settings?.pitch ?? defaultAppSettings.ttsMinimax.pitch) || 0)),
    sampleRate: Math.round(Number(settings?.sampleRate ?? defaultAppSettings.ttsMinimax.sampleRate) || defaultAppSettings.ttsMinimax.sampleRate),
    bitrate: Math.round(Number(settings?.bitrate ?? defaultAppSettings.ttsMinimax.bitrate) || defaultAppSettings.ttsMinimax.bitrate),
    audioFormat: normalizedAudioFormat,
    channel
  };
}

function normalizeOpenAiTtsSettings(settings: Partial<OpenAiTtsSettings> | null | undefined, legacyVoice = ''): OpenAiTtsSettings {
  const responseFormat = String(settings?.responseFormat ?? defaultAppSettings.ttsOpenAi.responseFormat).trim().toLowerCase();
  const normalizedResponseFormat: OpenAiTtsAudioFormat = openAiTtsAudioFormats.includes(responseFormat as OpenAiTtsAudioFormat)
    ? responseFormat as OpenAiTtsAudioFormat
    : defaultAppSettings.ttsOpenAi.responseFormat;
  const voice = settings?.voice !== undefined ? settings.voice : (legacyVoice || defaultAppSettings.ttsOpenAi.voice);
  const normalizedVendors = Array.isArray(settings?.vendors)
    ? settings.vendors
        .map((vendor) => normalizeOpenAiTtsVendor(vendor))
        .filter((vendor) => vendor.name && (vendor.id !== 'tts_openai_legacy' || vendor.apiKey.trim()))
    : [];

  if (!normalizedVendors.length && settings?.apiKey?.trim()) {
    normalizedVendors.push(normalizeOpenAiTtsVendor({
      id: 'tts_openai_legacy',
      enabled: Boolean(settings?.apiKey?.trim()),
      name: 'OpenAI TTS',
      apiUrl: String(settings?.apiUrl ?? defaultAppSettings.ttsOpenAi.apiUrl).trim() || defaultAppSettings.ttsOpenAi.apiUrl,
      apiPath: openAiTtsSpeechPath,
      apiKey: String(settings?.apiKey ?? '').trim(),
      models: String(settings?.model ?? '').trim()
        ? [{ id: String(settings?.model ?? '').trim(), nickname: '', selected: true }]
        : []
    }, 'tts_openai_legacy'));
  }

  const activeVendorId = String(settings?.activeVendorId ?? '').trim();
  const activeVendor = normalizedVendors.find((vendor) => vendor.id === activeVendorId)
    ?? normalizedVendors.find((vendor) => vendor.enabled)
    ?? normalizedVendors[0]
    ?? null;
  const activeModel = activeVendor?.models.find((model) => model.selected) ?? activeVendor?.models[0] ?? null;
  const model = (activeModel?.id ?? String(settings?.model ?? defaultAppSettings.ttsOpenAi.model).trim()) || defaultAppSettings.ttsOpenAi.model;

  return {
    activeVendorId: activeVendor?.id ?? activeVendorId,
    vendors: normalizedVendors,
    apiKey: String(settings?.apiKey ?? '').trim(),
    apiUrl: String(settings?.apiUrl ?? defaultAppSettings.ttsOpenAi.apiUrl).trim() || defaultAppSettings.ttsOpenAi.apiUrl,
    model,
    voice: String(voice).trim(),
    responseFormat: normalizedResponseFormat,
    speed: Math.min(4, Math.max(0.25, Number(settings?.speed ?? defaultAppSettings.ttsOpenAi.speed) || defaultAppSettings.ttsOpenAi.speed)),
    instructions: String(settings?.instructions ?? '').trim()
  };
}

function normalizeDoubaoTtsSettings(settings: Partial<DoubaoTtsSettings> | null | undefined, legacyVoice = ''): DoubaoTtsSettings {
  const encoding = String(settings?.encoding ?? defaultAppSettings.ttsDoubao.encoding).trim().toLowerCase();
  const normalizedEncoding: DoubaoTtsAudioFormat = doubaoTtsAudioFormats.includes(encoding as DoubaoTtsAudioFormat)
    ? encoding as DoubaoTtsAudioFormat
    : defaultAppSettings.ttsDoubao.encoding;
  const textType = String(settings?.textType ?? defaultAppSettings.ttsDoubao.textType).trim().toLowerCase();
  const normalizedTextType: DoubaoTtsTextType = doubaoTtsTextTypes.includes(textType as DoubaoTtsTextType)
    ? textType as DoubaoTtsTextType
    : defaultAppSettings.ttsDoubao.textType;

  return {
    apiUrl: String(settings?.apiUrl ?? defaultAppSettings.ttsDoubao.apiUrl).trim() || defaultAppSettings.ttsDoubao.apiUrl,
    appId: String(settings?.appId ?? '').trim(),
    token: String(settings?.token ?? '').trim(),
    cluster: String(settings?.cluster ?? defaultAppSettings.ttsDoubao.cluster).trim() || defaultAppSettings.ttsDoubao.cluster,
    voiceType: String(settings?.voiceType ?? legacyVoice ?? defaultAppSettings.ttsDoubao.voiceType).trim() || defaultAppSettings.ttsDoubao.voiceType,
    uid: String(settings?.uid ?? defaultAppSettings.ttsDoubao.uid).trim() || defaultAppSettings.ttsDoubao.uid,
    encoding: normalizedEncoding,
    sampleRate: Math.round(Number(settings?.sampleRate ?? defaultAppSettings.ttsDoubao.sampleRate) || defaultAppSettings.ttsDoubao.sampleRate),
    speedRatio: Math.min(3, Math.max(0.2, Number(settings?.speedRatio ?? defaultAppSettings.ttsDoubao.speedRatio) || defaultAppSettings.ttsDoubao.speedRatio)),
    volumeRatio: Math.min(3, Math.max(0.1, Number(settings?.volumeRatio ?? defaultAppSettings.ttsDoubao.volumeRatio) || defaultAppSettings.ttsDoubao.volumeRatio)),
    pitchRatio: Math.min(3, Math.max(0.1, Number(settings?.pitchRatio ?? defaultAppSettings.ttsDoubao.pitchRatio) || defaultAppSettings.ttsDoubao.pitchRatio)),
    emotion: String(settings?.emotion ?? '').trim(),
    language: String(settings?.language ?? '').trim(),
    textType: normalizedTextType,
    silenceDuration: Math.max(0, Math.round(Number(settings?.silenceDuration ?? defaultAppSettings.ttsDoubao.silenceDuration) || defaultAppSettings.ttsDoubao.silenceDuration)),
    splitSentence: Boolean(settings?.splitSentence),
    pureEnglishOpt: Boolean(settings?.pureEnglishOpt)
  };
}

export function getTtsVoiceForProvider(settings: Pick<AppSettings, 'ttsProvider' | 'ttsOpenAi' | 'ttsMinimax' | 'ttsDoubao'>) {
  if (settings.ttsProvider === 'openai') return settings.ttsOpenAi.voice;
  if (settings.ttsProvider === 'doubao') return settings.ttsDoubao.voiceType;
  return settings.ttsMinimax.voiceId;
}

function normalizePromptPreset(preset: Partial<ImagePromptPreset> | null | undefined, fallbackName: string): ImagePromptPreset | null {
  const id = String(preset?.id ?? '').trim();
  if (!id) return null;

  return {
    id,
    name: String(preset?.name ?? fallbackName).trim(),
    positivePrompt: String(preset?.positivePrompt ?? '').trim(),
    negativePrompt: String(preset?.negativePrompt ?? '').trim(),
    defaultNegativePrompt: String(preset?.defaultNegativePrompt ?? defaultImageNegativePrompt).trim(),
    onlineChatTemplate: String(preset?.onlineChatTemplate ?? defaultOnlineChatImagePromptTemplate).trim(),
    voomTemplate: String(preset?.voomTemplate ?? defaultVoomImagePromptTemplate).trim()
  };
}

function normalizePromptPresetState(
  presets: Partial<ImagePromptPreset>[] | null | undefined,
  options: {
    activePresetId: string | null | undefined;
    defaultId: string;
    defaultName: string;
    legacyPositivePrompt: string;
    legacyNegativePrompt: string;
  }
) {
  const normalizedPresets = Array.isArray(presets)
    ? presets
        .map((preset, index) => normalizePromptPreset(preset, `${options.defaultName} ${index + 1}`))
        .filter((preset): preset is ImagePromptPreset => Boolean(preset))
        .map((preset, index) => ({
          ...preset,
          name: preset.name || `${options.defaultName} ${index + 1}`
        }))
    : [];

  const promptPresets = normalizedPresets.length
    ? normalizedPresets
    : [{
        id: options.defaultId,
        name: options.defaultName,
        positivePrompt: options.legacyPositivePrompt,
        negativePrompt: options.legacyNegativePrompt,
        defaultNegativePrompt: defaultImageNegativePrompt,
        onlineChatTemplate: defaultOnlineChatImagePromptTemplate,
        voomTemplate: defaultVoomImagePromptTemplate
      }];

  const requestedActiveId = String(options.activePresetId ?? '').trim();
  const activePreset = promptPresets.find((preset) => preset.id === requestedActiveId) ?? promptPresets[0];

  return {
    activePromptPresetId: activePreset.id,
    promptPresets,
    positivePrompt: activePreset.positivePrompt,
    negativePrompt: activePreset.negativePrompt
  };
}

function normalizeOpenAiImageSettings(
  settings: Partial<OpenAiImageSettings> | null | undefined,
  fallback: Pick<AppSettings, 'imageModel' | 'imageSize' | 'imagePromptPrefix'>
): OpenAiImageSettings {
  const vendors = Array.isArray(settings?.vendors)
    ? settings.vendors.map((vendor) => normalizeImageVendor(vendor)).filter((vendor) => vendor.name)
    : [];

  const activeVendorId = String(settings?.activeVendorId ?? '').trim();
  const promptState = normalizePromptPresetState(settings?.promptPresets, {
    activePresetId: settings?.activePromptPresetId,
    defaultId: defaultOpenAiPromptPresetId,
    defaultName: defaultPromptPresetName,
    legacyPositivePrompt: String(settings?.positivePrompt ?? fallback.imagePromptPrefix ?? '').trim(),
    legacyNegativePrompt: String(settings?.negativePrompt ?? '').trim()
  });

  return {
    activeVendorId,
    size: String(settings?.size ?? fallback.imageSize ?? defaultAppSettings.imageOpenAi.size).trim() || defaultAppSettings.imageOpenAi.size,
    activePromptPresetId: promptState.activePromptPresetId,
    promptPresets: promptState.promptPresets,
    positivePrompt: promptState.positivePrompt,
    negativePrompt: promptState.negativePrompt,
    lastImageUrl: String(settings?.lastImageUrl ?? '').trim(),
    vendors
  };
}

function normalizeNovelAiModelOption(model: Partial<{ id: string; label: string; name: string; nickname: string }> | string | null | undefined) {
  const id = typeof model === 'string' ? model.trim() : String(model?.id ?? model?.name ?? '').trim();
  if (!id) return null;
  const label = typeof model === 'string' ? id : String(model?.label ?? model?.nickname ?? model?.name ?? id).trim();
  return { id, label: label || id };
}

function normalizeNovelAiModels(models: NovelAiImageSettings['availableModels'] | null | undefined, selectedModel: string) {
  const byId = new Map(defaultNovelAiModels.map((model) => [model.id, model]));
  if (Array.isArray(models)) {
    models.forEach((model) => {
      const normalizedModel = normalizeNovelAiModelOption(model);
      if (normalizedModel) byId.set(normalizedModel.id, normalizedModel);
    });
  }
  if (selectedModel && !byId.has(selectedModel)) byId.set(selectedModel, { id: selectedModel, label: selectedModel });
  return [...byId.values()];
}

function normalizePollinationsModelOption(model: Partial<{ id: string; label: string; name: string; model: string; title: string }> | string | null | undefined) {
  const id = typeof model === 'string' ? model.trim() : String(model?.id ?? model?.model ?? model?.name ?? '').trim();
  if (!id) return null;
  const label = typeof model === 'string' ? id : String(model?.label ?? model?.title ?? model?.name ?? id).trim();
  return { id, label: label || id };
}

function normalizePollinationsModels(models: PollinationsImageSettings['availableModels'] | null | undefined, selectedModel: string) {
  const byId = new Map(defaultPollinationsModels.map((model) => [model.id, model]));
  if (Array.isArray(models)) {
    models.forEach((model) => {
      const normalizedModel = normalizePollinationsModelOption(model);
      if (normalizedModel) byId.set(normalizedModel.id, normalizedModel);
    });
  }
  if (selectedModel && !byId.has(selectedModel)) byId.set(selectedModel, { id: selectedModel, label: selectedModel });
  return [...byId.values()];
}

function normalizeNovelAiImageSettings(settings: Partial<NovelAiImageSettings> | null | undefined): NovelAiImageSettings {
  const promptState = normalizePromptPresetState(settings?.promptPresets, {
    activePresetId: settings?.activePromptPresetId,
    defaultId: defaultNovelAiPromptPresetId,
    defaultName: defaultPromptPresetName,
    legacyPositivePrompt: String(settings?.positivePrompt ?? '').trim(),
    legacyNegativePrompt: String(settings?.negativePrompt ?? '').trim()
  });

  const selectedModel = String(settings?.model ?? defaultAppSettings.imageNovelAi.model).trim() || defaultAppSettings.imageNovelAi.model;
  const endpointMode = settings?.endpointMode === 'official'
    ? 'official'
    : settings?.endpointMode === 'custom'
      ? 'custom'
      : 'proxy';

  return {
    endpointMode,
    apiUrl: novelAiOfficialApiUrl,
    proxyUrl: novelAiProxyApiUrl,
    customProxyUrl: String(settings?.customProxyUrl ?? '').trim(),
    apiKey: String(settings?.apiKey ?? '').trim(),
    model: selectedModel,
    availableModels: normalizeNovelAiModels(settings?.availableModels, selectedModel),
    activePromptPresetId: promptState.activePromptPresetId,
    promptPresets: promptState.promptPresets,
    positivePrompt: promptState.positivePrompt,
    negativePrompt: promptState.negativePrompt,
    width: Math.max(320, Number(settings?.width ?? defaultAppSettings.imageNovelAi.width) || defaultAppSettings.imageNovelAi.width),
    height: Math.max(320, Number(settings?.height ?? defaultAppSettings.imageNovelAi.height) || defaultAppSettings.imageNovelAi.height),
    guidance: Math.max(1, Number(settings?.guidance ?? defaultAppSettings.imageNovelAi.guidance) || defaultAppSettings.imageNovelAi.guidance),
    steps: Math.max(1, Math.round(Number(settings?.steps ?? defaultAppSettings.imageNovelAi.steps) || defaultAppSettings.imageNovelAi.steps)),
    sampler: String(settings?.sampler ?? defaultAppSettings.imageNovelAi.sampler).trim() || defaultAppSettings.imageNovelAi.sampler,
    ucPreset: normalizeNovelAiUcPreset(selectedModel, settings?.ucPreset ?? defaultAppSettings.imageNovelAi.ucPreset),
    qualityToggle: settings?.qualityToggle ?? defaultAppSettings.imageNovelAi.qualityToggle,
    sm: settings?.sm ?? defaultAppSettings.imageNovelAi.sm,
    smDyn: settings?.smDyn ?? defaultAppSettings.imageNovelAi.smDyn,
    dynamicThresholding: settings?.dynamicThresholding ?? defaultAppSettings.imageNovelAi.dynamicThresholding,
    cfgRescale: Math.max(0, Number(settings?.cfgRescale ?? defaultAppSettings.imageNovelAi.cfgRescale) || 0),
    noiseSchedule: String(settings?.noiseSchedule ?? defaultAppSettings.imageNovelAi.noiseSchedule).trim() || defaultAppSettings.imageNovelAi.noiseSchedule,
    seed: String(settings?.seed ?? '').trim(),
    lastImageUrl: String(settings?.lastImageUrl ?? '').trim()
  };
}

function normalizePollinationsImageSettings(settings: Partial<PollinationsImageSettings> | null | undefined): PollinationsImageSettings {
  const promptState = normalizePromptPresetState(settings?.promptPresets, {
    activePresetId: settings?.activePromptPresetId,
    defaultId: defaultPollinationsPromptPresetId,
    defaultName: defaultPromptPresetName,
    legacyPositivePrompt: String(settings?.positivePrompt ?? '').trim(),
    legacyNegativePrompt: String(settings?.negativePrompt ?? '').trim()
  });

  const selectedModel = String(settings?.model ?? defaultAppSettings.imagePollinations.model).trim() || defaultAppSettings.imagePollinations.model;

  return {
    apiKey: String(settings?.apiKey ?? '').trim(),
    referrer: String(settings?.referrer ?? defaultAppSettings.imagePollinations.referrer).trim() || defaultAppSettings.imagePollinations.referrer,
    model: selectedModel,
    availableModels: normalizePollinationsModels(settings?.availableModels, selectedModel),
    activePromptPresetId: promptState.activePromptPresetId,
    promptPresets: promptState.promptPresets,
    positivePrompt: promptState.positivePrompt,
    negativePrompt: promptState.negativePrompt,
    width: Math.max(320, Number(settings?.width ?? defaultAppSettings.imagePollinations.width) || defaultAppSettings.imagePollinations.width),
    height: Math.max(320, Number(settings?.height ?? defaultAppSettings.imagePollinations.height) || defaultAppSettings.imagePollinations.height),
    seed: String(settings?.seed ?? '').trim(),
    safe: String(settings?.safe ?? defaultAppSettings.imagePollinations.safe).trim() || defaultAppSettings.imagePollinations.safe,
    quality: String(settings?.quality ?? defaultAppSettings.imagePollinations.quality).trim() || defaultAppSettings.imagePollinations.quality,
    referenceImage: String(settings?.referenceImage ?? '').trim(),
    transparent: settings?.transparent ?? defaultAppSettings.imagePollinations.transparent,
    enhance: settings?.enhance ?? defaultAppSettings.imagePollinations.enhance,
    nologo: settings?.nologo ?? defaultAppSettings.imagePollinations.nologo,
    private: settings?.private ?? defaultAppSettings.imagePollinations.private,
    lastImageUrl: String(settings?.lastImageUrl ?? '').trim()
  };
}

function normalizeGitHubBackupSettings(settings: Partial<GitHubBackupSettings> | null | undefined): GitHubBackupSettings {
  const intervalMinutes = Math.min(1440, Math.max(1, Math.round(Number(settings?.intervalMinutes ?? defaultAppSettings.githubBackup.intervalMinutes) || defaultAppSettings.githubBackup.intervalMinutes)));
  const status = ['idle', 'running', 'success', 'failed'].includes(String(settings?.lastBackupStatus))
    ? settings?.lastBackupStatus as GitHubBackupSettings['lastBackupStatus']
    : defaultAppSettings.githubBackup.lastBackupStatus;

  return {
    enabled: Boolean(settings?.enabled),
    token: String(settings?.token ?? '').trim(),
    owner: String(settings?.owner ?? '').trim(),
    repo: String(settings?.repo ?? defaultAppSettings.githubBackup.repo).trim() || defaultAppSettings.githubBackup.repo,
    branch: String(settings?.branch ?? defaultAppSettings.githubBackup.branch).trim() || defaultAppSettings.githubBackup.branch,
    path: String(settings?.path ?? defaultAppSettings.githubBackup.path).trim().replace(/^\/+/, '') || defaultAppSettings.githubBackup.path,
    intervalMinutes,
    lastBackupAt: Math.max(0, Number(settings?.lastBackupAt ?? 0) || 0),
    lastBackupStatus: status,
    lastBackupError: String(settings?.lastBackupError ?? '').trim(),
    latestRemoteBackupAt: Math.max(0, Number(settings?.latestRemoteBackupAt ?? 0) || 0),
    latestRemoteBackupSha: String(settings?.latestRemoteBackupSha ?? '').trim(),
    pendingRestoreSha: String(settings?.pendingRestoreSha ?? '').trim(),
    pendingRestoreAt: Math.max(0, Number(settings?.pendingRestoreAt ?? 0) || 0),
    history: Array.isArray(settings?.history)
      ? settings.history
          .map((entry) => ({
            sha: String(entry?.sha ?? '').trim(),
            committedAt: Math.max(0, Number(entry?.committedAt ?? 0) || 0),
            exportedAt: Math.max(0, Number(entry?.exportedAt ?? 0) || 0),
            message: String(entry?.message ?? '').trim()
          }))
          .filter((entry) => entry.sha)
          .slice(0, 3)
      : [],
    progress: {
      phase: ['idle', 'checking', 'uploading', 'downloading', 'restoring', 'completed', 'failed'].includes(String(settings?.progress?.phase))
        ? String(settings?.progress?.phase) as GitHubBackupSettings['progress']['phase']
        : 'idle',
      label: String(settings?.progress?.label ?? '').trim(),
      percent: Math.min(100, Math.max(0, Number(settings?.progress?.percent ?? 0) || 0)),
      updatedAt: Math.max(0, Number(settings?.progress?.updatedAt ?? 0) || 0)
    }
  };
}

function normalizeCloudBackupSettings(settings: Partial<CloudBackupSettings> | null | undefined): CloudBackupSettings {
  const providers = new Set<CloudBackupProvider>(['google-drive', 'onedrive', 'dropbox', 'r2-worker']);
  const provider = providers.has(settings?.provider as CloudBackupProvider) ? settings?.provider as CloudBackupProvider : '';
  const intervalMinutes = Math.min(1440, Math.max(5, Math.round(Number(settings?.intervalMinutes ?? defaultAppSettings.cloudBackup.intervalMinutes) || defaultAppSettings.cloudBackup.intervalMinutes)));
  const status = ['idle', 'running', 'success', 'failed'].includes(String(settings?.lastBackupStatus))
    ? settings?.lastBackupStatus as CloudBackupSettings['lastBackupStatus']
    : 'idle';
  return {
    enabled: Boolean(settings?.enabled),
    provider,
    accessToken: String(settings?.accessToken ?? '').trim(),
    refreshToken: String(settings?.refreshToken ?? '').trim(),
    tokenExpiresAt: Math.max(0, Number(settings?.tokenExpiresAt ?? 0) || 0),
    accountLabel: String(settings?.accountLabel ?? '').trim(),
    workerUrl: String(settings?.workerUrl ?? '').trim().replace(/\/+$/, ''),
    workerToken: String(settings?.workerToken ?? '').trim(),
    recoveryKey: String(settings?.recoveryKey ?? '').trim(),
    remoteFileId: String(settings?.remoteFileId ?? '').trim(),
    fileName: String(settings?.fileName ?? defaultAppSettings.cloudBackup.fileName).trim().replace(/^\/+/, '') || defaultAppSettings.cloudBackup.fileName,
    intervalMinutes,
    lastBackupAt: Math.max(0, Number(settings?.lastBackupAt ?? 0) || 0),
    lastBackupStatus: status,
    lastBackupError: String(settings?.lastBackupError ?? '').trim(),
    latestRemoteBackupAt: Math.max(0, Number(settings?.latestRemoteBackupAt ?? 0) || 0),
    lastBackupBytes: Math.max(0, Number(settings?.lastBackupBytes ?? 0) || 0),
    progress: {
      phase: ['idle', 'connecting', 'uploading', 'downloading', 'restoring', 'completed', 'failed'].includes(String(settings?.progress?.phase))
        ? String(settings?.progress?.phase) as CloudBackupSettings['progress']['phase']
        : 'idle',
      label: String(settings?.progress?.label ?? '').trim(),
      percent: Math.min(100, Math.max(0, Number(settings?.progress?.percent ?? 0) || 0)),
      updatedAt: Math.max(0, Number(settings?.progress?.updatedAt ?? 0) || 0)
    }
  };
}

function normalizeVendorModel(model: Partial<ApiVendorModel> | null | undefined): ApiVendorModel | null {
  const id = String(model?.id ?? '').trim();
  if (!id) return null;
  return {
    id,
    nickname: String(model?.nickname ?? '').trim(),
    selected: Boolean(model?.selected)
  };
}

function splitLegacyEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  if (!trimmed) {
    return {
      apiUrl: 'https://api.openai.com/v1',
      apiPath: '/chat/completions'
    };
  }

  const normalized = trimmed.replace(/\/+$/, '');
  if (normalized.endsWith('/chat/completions')) {
    return {
      apiUrl: normalized.slice(0, -'/chat/completions'.length) || 'https://api.openai.com/v1',
      apiPath: '/chat/completions'
    };
  }

  return {
    apiUrl: normalized,
    apiPath: '/chat/completions'
  };
}

function normalizeVendor(vendor: Partial<ApiVendor> | null | undefined, fallbackId?: string, options: { allowEmptyApiUrl?: boolean } = {}): ApiVendor {
  const models = Array.isArray(vendor?.models)
    ? vendor.models
        .map((model) => normalizeVendorModel(model))
        .filter((model): model is ApiVendorModel => Boolean(model))
    : [];
  const rawApiUrl = String(vendor?.apiUrl ?? '').trim();
  const splitEndpoint = rawApiUrl ? splitLegacyEndpoint(rawApiUrl) : { apiUrl: '', apiPath: '/chat/completions' };
  const apiUrl = splitEndpoint.apiUrl;
  const apiPath = String(vendor?.apiPath ?? splitEndpoint.apiPath).trim() || splitEndpoint.apiPath;

  return {
    id: String(vendor?.id ?? fallbackId ?? createId('vendor')).trim() || createId('vendor'),
    enabled: Boolean(vendor?.enabled),
    name: String(vendor?.name ?? 'OpenAI').trim() || 'OpenAI',
    apiUrl: apiUrl || (options.allowEmptyApiUrl ? '' : 'https://api.openai.com/v1'),
    apiPath,
    apiKey: String(vendor?.apiKey ?? '').trim(),
    avatar: normalizeVendorAvatar(vendor?.avatar),
    preferBase64ImageResponse: Boolean(vendor?.preferBase64ImageResponse),
    models
  };
}

function shouldPreferBase64ImageResponse(vendor: Partial<ApiVendor> | null | undefined) {
  if (typeof vendor?.preferBase64ImageResponse === 'boolean') return vendor.preferBase64ImageResponse;
  const apiUrl = String(vendor?.apiUrl ?? '').trim().toLowerCase();
  return apiUrl === 'https://api.openai.com/v1' || apiUrl === 'https://api.openai.com';
}

function normalizeImageVendor(vendor: Partial<ApiVendor> | null | undefined, fallbackId?: string): ApiVendor {
  const normalizedVendor = normalizeVendor(vendor, fallbackId, { allowEmptyApiUrl: true });
  const apiPath = normalizeOpenAiImagePath(vendor?.apiPath);
  return {
    ...normalizedVendor,
    apiPath,
    preferBase64ImageResponse: shouldPreferBase64ImageResponse(vendor)
  };
}

function normalizeOpenAiTtsVendor(vendor: Partial<ApiVendor> | null | undefined, fallbackId?: string): ApiVendor {
  const normalizedVendor = normalizeVendor({
    apiPath: openAiTtsSpeechPath,
    ...vendor,
    apiUrl: normalizeOpenAiTtsApiUrl(String(vendor?.apiUrl ?? '').trim())
  }, fallbackId, { allowEmptyApiUrl: true });

  return {
    ...normalizedVendor,
    apiPath: normalizeOpenAiTtsPath(vendor?.apiPath),
    preferBase64ImageResponse: false
  };
}

export function createApiVendor(overrides: Partial<ApiVendor> = {}): ApiVendor {
  return normalizeVendor(overrides, undefined, { allowEmptyApiUrl: true });
}

export function createImageApiVendor(overrides: Partial<ApiVendor> = {}): ApiVendor {
  return normalizeImageVendor({ apiPath: openAiImageGenerationPath, ...overrides });
}

export function createOpenAiTtsVendor(overrides: Partial<ApiVendor> = {}): ApiVendor {
  return normalizeOpenAiTtsVendor({ apiPath: openAiTtsSpeechPath, ...overrides });
}

export function buildApiEndpoint(apiUrl: string, apiPath: string) {
  const url = apiUrl.trim().replace(/\/+$/, '');
  if (!url) return '';
  const path = `/${apiPath.trim().replace(/^\/+/, '')}`;
  return `${url}${path}`;
}

function buildOpenAiImageEndpoint(apiUrl: string, apiPath: string) {
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, '');
  if (!normalizedApiUrl) return '';
  const normalizedPath = normalizeOpenAiImagePath(apiPath);
  const endpoint = `${normalizedApiUrl}${normalizedPath}`;
  if (canUseLocalImageProxy() && /^https?:\/\//i.test(normalizedApiUrl)) {
    return `/__image-proxy?url=${encodeURIComponent(endpoint)}`;
  }
  return endpoint;
}

function buildOpenAiTtsEndpoint(apiUrl: string, apiPath: string) {
  const normalizedApiUrl = apiUrl.trim().replace(/\/+$/, '');
  if (!normalizedApiUrl) return '';
  if (normalizedApiUrl.endsWith(openAiTtsSpeechPath)) return normalizedApiUrl;
  return buildApiEndpoint(normalizedApiUrl, normalizeOpenAiTtsPath(apiPath));
}

function isLocalProxyHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized === '127.0.0.1'
    || normalized === '0.0.0.0'
    || normalized === '::1'
    || normalized === '[::1]'
    || /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    || /^169\.254\./.test(normalized);
}

function isLikelyViteProxyPort(port: string) {
  return port === '5173' || port === '4173';
}

function canUseLocalImageProxy() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  if (!['http:', 'https:'].includes(window.location.protocol)) return false;
  return isLocalProxyHostname(window.location.hostname) || isLikelyViteProxyPort(window.location.port);
}

function normalizeOpenAiImagePath(apiPath: unknown) {
  const normalizedPath = `/${String(apiPath ?? '').trim().replace(/^\/+/, '')}`;
  return !normalizedPath.trim() || normalizedPath === '/' || normalizedPath === '/chat/completions'
    ? openAiImageGenerationPath
    : normalizedPath;
}

function normalizeOpenAiTtsPath(apiPath: unknown) {
  const normalizedPath = `/${String(apiPath ?? '').trim().replace(/^\/+/, '')}`;
  return !normalizedPath.trim() || normalizedPath === '/' || normalizedPath === '/chat/completions'
    ? openAiTtsSpeechPath
    : normalizedPath;
}

function normalizeOpenAiTtsApiUrl(apiUrl: string) {
  const normalizedUrl = apiUrl.trim().replace(/\/+$/, '');
  return normalizedUrl.endsWith(openAiTtsSpeechPath)
    ? normalizedUrl.slice(0, -openAiTtsSpeechPath.length) || defaultAppSettings.ttsOpenAi.apiUrl
    : normalizedUrl;
}

export function getSelectedVendorModels(vendor: ApiVendor) {
  return vendor.models.filter((model) => model.selected);
}

export function getSelectedVendorModelCount(vendor: ApiVendor) {
  return getSelectedVendorModels(vendor).length;
}

export function mergeVendorModels(vendor: ApiVendor, modelIds: string[]) {
  const existingModels = new Map(vendor.models.map((model) => [model.id, model]));
  const hadSelectedModel = vendor.models.some((model) => model.selected);

  return normalizeVendor({
    ...vendor,
    models: modelIds
      .map((id) => String(id).trim())
      .filter(Boolean)
      .map((id, index) => {
        const existing = existingModels.get(id);
        return {
          id,
          nickname: existing?.nickname ?? '',
          selected: existing?.selected ?? (!hadSelectedModel && index === 0)
        };
      })
  }, vendor.id);
}

export function mergeImageVendorModels(vendor: ApiVendor, modelIds: string[]) {
  return normalizeImageVendor(mergeVendorModels(vendor, modelIds), vendor.id);
}

export function mergeOpenAiTtsVendorModels(vendor: ApiVendor, modelIds: string[]) {
  return normalizeOpenAiTtsVendor(mergeVendorModels(vendor, modelIds), vendor.id);
}

export function getPreferredApiVendor(settings?: AppSettings | null) {
  const vendors = settings?.apiVendors ?? [];
  return vendors.find((vendor) => vendor.enabled && vendor.models.length > 0)
    ?? vendors.find((vendor) => vendor.enabled)
    ?? vendors.find((vendor) => vendor.models.length > 0)
    ?? vendors[0]
    ?? null;
}

export function getPreferredImageVendor(settings?: AppSettings | null) {
  const vendors = settings?.imageOpenAi.vendors ?? [];
  const activeVendorId = settings?.imageOpenAi.activeVendorId?.trim();

  if (activeVendorId) {
    const activeVendor = vendors.find((vendor) => vendor.id === activeVendorId);
    if (activeVendor) return activeVendor;
  }

  return vendors.find((vendor) => vendor.enabled && vendor.models.length > 0)
    ?? vendors.find((vendor) => vendor.enabled)
    ?? vendors.find((vendor) => vendor.models.length > 0)
    ?? vendors[0]
    ?? null;
}

export function getPreferredOpenAiTtsVendor(settings?: AppSettings | null) {
  const vendors = settings?.ttsOpenAi.vendors ?? [];
  const activeVendorId = settings?.ttsOpenAi.activeVendorId?.trim();

  if (activeVendorId) {
    const activeVendor = vendors.find((vendor) => vendor.id === activeVendorId);
    if (activeVendor) return activeVendor;
  }

  return vendors.find((vendor) => vendor.enabled && vendor.models.length > 0)
    ?? vendors.find((vendor) => vendor.enabled)
    ?? vendors.find((vendor) => vendor.models.length > 0)
    ?? vendors[0]
    ?? null;
}

export function getResolvedApiConfig(settings?: AppSettings | null) {
  const preferredVendor = getPreferredApiVendor(settings);
  if (preferredVendor) {
    const preferredModel = preferredVendor.models.find((model) => model.selected)
      ?? preferredVendor.models[0]
      ?? null;
    return {
      endpoint: buildApiEndpoint(preferredVendor.apiUrl, preferredVendor.apiPath),
      apiKey: preferredVendor.apiKey,
      model: preferredModel?.id ?? settings?.model ?? ''
    };
  }

  return {
    endpoint: settings?.apiEndpoint?.trim() ?? '',
    apiKey: settings?.apiKey?.trim() ?? '',
    model: settings?.model?.trim() ?? ''
  };
}

export function getResolvedOpenAiImageConfig(settings?: AppSettings | null) {
  const preferredVendor = getPreferredImageVendor(settings);
  const imageSettings = settings?.imageOpenAi ?? defaultAppSettings.imageOpenAi;

  if (preferredVendor) {
    const preferredModel = preferredVendor.models.find((model) => model.selected)
      ?? preferredVendor.models[0]
      ?? null;

    return {
      endpoint: buildOpenAiImageEndpoint(preferredVendor.apiUrl, preferredVendor.apiPath || openAiImageGenerationPath),
      apiKey: preferredVendor.apiKey,
      model: preferredModel?.id ?? settings?.imageModel?.trim() ?? defaultAppSettings.imageModel,
      size: imageSettings.size,
      preferBase64ImageResponse: preferredVendor.preferBase64ImageResponse
    };
  }

  return {
    endpoint: '',
    apiKey: '',
    model: settings?.imageModel?.trim() ?? defaultAppSettings.imageModel,
    size: imageSettings.size,
    preferBase64ImageResponse: false
  };
}

export function getResolvedOpenAiTtsConfig(settings?: AppSettings | null) {
  const preferredVendor = getPreferredOpenAiTtsVendor(settings);
  const ttsSettings = settings?.ttsOpenAi ?? defaultAppSettings.ttsOpenAi;

  if (preferredVendor) {
    const preferredModel = preferredVendor.models.find((model) => model.selected)
      ?? preferredVendor.models[0]
      ?? null;

    return {
      endpoint: buildOpenAiTtsEndpoint(preferredVendor.apiUrl, preferredVendor.apiPath || openAiTtsSpeechPath),
      apiKey: preferredVendor.apiKey,
      model: preferredModel?.id ?? ttsSettings.model?.trim() ?? defaultAppSettings.ttsOpenAi.model
    };
  }

  return {
    endpoint: buildOpenAiTtsEndpoint(ttsSettings.apiUrl, openAiTtsSpeechPath),
    apiKey: ttsSettings.apiKey?.trim() ?? '',
    model: ttsSettings.model?.trim() ?? defaultAppSettings.ttsOpenAi.model
  };
}

export function isImageProviderConfigured(provider: ImageProviderType, settings?: AppSettings | null) {
  if (!settings) return false;

  if (provider === 'openai') {
    return settings.imageOpenAi.vendors.some((vendor) => {
      const model = vendor.models.find((item) => item.selected)?.id || vendor.models[0]?.id || settings.imageModel;
      return Boolean(vendor.apiUrl.trim() && vendor.apiPath.trim() && vendor.apiKey.trim() && model.trim());
    });
  }

  if (provider === 'novelai') {
    return Boolean(settings.imageNovelAi.apiKey.trim() && settings.imageNovelAi.model.trim());
  }

  return Boolean(settings.imagePollinations.apiKey.trim() && settings.imagePollinations.model.trim());
}

export function getConfiguredImageProviders(settings?: AppSettings | null) {
  return imageProviderOrder.filter((provider) => isImageProviderConfigured(provider, settings));
}

export function getPreferredVoomImageProvider(settings?: AppSettings | null): ImageProviderType | null {
  const configuredProviders = getConfiguredImageProviders(settings);
  const selectedProvider = normalizeImageProvider(settings?.imageModelOverrides?.voom.provider ?? settings?.voomImageProvider);
  if (selectedProvider && configuredProviders.includes(selectedProvider)) return selectedProvider;
  return configuredProviders[0] ?? null;
}

export function createImageModelKey(provider: ImageProviderType, model: string) {
  return `${provider}:${model.trim()}`;
}

export function getConfiguredImageModelOptions(settings?: AppSettings | null): ConfiguredImageModelOption[] {
  if (!settings) return [];

  const openAiOptions = settings.imageOpenAi.vendors.flatMap((vendor) => {
    if (!vendor.enabled || !vendor.apiUrl.trim() || !vendor.apiPath.trim() || !vendor.apiKey.trim()) return [];
    const selectedModels = vendor.models.filter((item) => item.selected);
    const models = selectedModels.length
      ? selectedModels
      : vendor.models[0]
        ? [vendor.models[0]]
        : settings.imageModel.trim()
          ? [{ id: settings.imageModel.trim(), nickname: '', selected: true }]
          : [];
    return models.flatMap((model) => {
      if (!model.id.trim()) return [];
      const modelSelection = `${vendor.id}::${model.id}`;
      return [{
        key: createImageModelKey('openai', modelSelection),
        provider: 'openai' as const,
        providerLabel: 'OpenAI',
        label: model.nickname || model.id,
        detail: vendor.name,
        model: modelSelection
      }];
    });
  });

  const novelAiOptions = settings.imageNovelAi.apiKey.trim() && settings.imageNovelAi.model.trim()
    ? [{
        key: createImageModelKey('novelai', settings.imageNovelAi.model),
        provider: 'novelai' as const,
        providerLabel: 'NovelAI',
        label: settings.imageNovelAi.availableModels.find((model) => model.id === settings.imageNovelAi.model)?.label || settings.imageNovelAi.model,
        detail: `${settings.imageNovelAi.width} x ${settings.imageNovelAi.height}`,
        model: settings.imageNovelAi.model
      }]
    : [];

  const pollinationsOptions = settings.imagePollinations.apiKey.trim() && settings.imagePollinations.model.trim()
    ? [{
        key: createImageModelKey('pollinations', settings.imagePollinations.model),
        provider: 'pollinations' as const,
        providerLabel: 'Pollinations',
        label: settings.imagePollinations.availableModels.find((model) => model.id === settings.imagePollinations.model)?.label || settings.imagePollinations.model,
        detail: `${settings.imagePollinations.width} x ${settings.imagePollinations.height}`,
        model: settings.imagePollinations.model
      }]
    : [];

  return [...openAiOptions, ...novelAiOptions, ...pollinationsOptions];
}

export function getSelectedImageModelOption(settings?: AppSettings | null, scope: ImageModelScope = 'voom') {
  const options = getConfiguredImageModelOptions(settings);
  const scopedSelection = settings?.imageModelOverrides?.[scope];
  if (isImageModelSelectionDisabled(scopedSelection)) return null;
  const voomSelection = settings?.imageModelOverrides?.voom;
  const selectedProvider = normalizeImageProvider(
    scopedSelection?.provider
    || (scope !== 'voom' ? voomSelection?.provider : '')
    || settings?.voomImageProvider
  );
  const selectedModel = String(
    scopedSelection?.model
    || (scope !== 'voom' ? voomSelection?.model : '')
    || settings?.voomImageModel
    || ''
  ).trim();
  const selectedKey = selectedProvider ? createImageModelKey(selectedProvider, selectedModel) : '';
  return options.find((option) => option.key === selectedKey) ?? options[0] ?? null;
}

export function getImagePromptPresetForProvider(settings: AppSettings, provider: ImageProviderType) {
  if (provider === 'openai') {
    return settings.imageOpenAi.promptPresets.find((preset) => preset.id === settings.imageOpenAi.activePromptPresetId)
      ?? settings.imageOpenAi.promptPresets[0]
      ?? defaultAppSettings.imageOpenAi.promptPresets[0];
  }
  if (provider === 'novelai') {
    return settings.imageNovelAi.promptPresets.find((preset) => preset.id === settings.imageNovelAi.activePromptPresetId)
      ?? settings.imageNovelAi.promptPresets[0]
      ?? defaultAppSettings.imageNovelAi.promptPresets[0];
  }
  return settings.imagePollinations.promptPresets.find((preset) => preset.id === settings.imagePollinations.activePromptPresetId)
    ?? settings.imagePollinations.promptPresets[0]
    ?? defaultAppSettings.imagePollinations.promptPresets[0];
}

export function normalizeAppSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const legacyImageModel = String((settings as { imageModel?: string } | null | undefined)?.imageModel ?? '').trim();
  const legacyImageSize = String((settings as { imageSize?: string } | null | undefined)?.imageSize ?? '').trim();
  const legacyImagePromptPrefix = String((settings as { imagePromptPrefix?: string } | null | undefined)?.imagePromptPrefix ?? '').trim();
  const explicitTtsProvider = normalizeTtsProvider(settings?.ttsProvider);
  const legacyTtsVoice = String(settings?.ttsVoice ?? '').trim();

  const settingsSource = settings ? { ...settings } as Partial<AppSettings> & Record<string, unknown> : {};
  const legacyCloudProperty = ['web', 'Dav', 'Backup'].join('');
  delete settingsSource[legacyCloudProperty];
  const merged = {
    ...defaultAppSettings,
    ...settingsSource
  };

  const legacyMinimaxEnabled = Boolean(settings?.ttsMinimax?.enabled ?? merged.ttsEnabled);
  const normalizedTtsProvider = explicitTtsProvider || (legacyMinimaxEnabled ? 'minimax' : defaultAppSettings.ttsProvider);
  const normalizedVendors = Array.isArray(settings?.apiVendors)
    ? settings.apiVendors.map((vendor) => normalizeVendor(vendor, undefined, { allowEmptyApiUrl: true })).filter((vendor) => vendor.name)
    : [];

  if (!normalizedVendors.length && (merged.apiEndpoint.trim() || merged.apiKey.trim())) {
    const legacyEndpoint = splitLegacyEndpoint(merged.apiEndpoint);
    normalizedVendors.push(normalizeVendor({
      id: 'vendor_legacy',
      enabled: true,
      name: 'Default Provider',
      apiUrl: legacyEndpoint.apiUrl,
      apiPath: legacyEndpoint.apiPath,
      apiKey: merged.apiKey,
      avatar: defaultVendorAvatar,
      models: merged.model.trim()
        ? [{ id: merged.model.trim(), nickname: '', selected: true }]
        : []
    }, 'vendor_legacy'));
  }

  const normalized = {
    ...merged,
    homeCardImages: normalizeHomeCardImages(settings?.homeCardImages),
    modelOverrides: normalizeChatModelOverrides(merged.modelOverrides),
    imageModelOverrides: normalizeImageModelOverrides(settings),
    apiVendors: normalizedVendors,
    imageOpenAi: normalizeOpenAiImageSettings(settings?.imageOpenAi, {
      imageModel: legacyImageModel || merged.imageModel,
      imageSize: legacyImageSize || merged.imageSize,
      imagePromptPrefix: legacyImagePromptPrefix || merged.imagePromptPrefix
    }),
    imageNovelAi: normalizeNovelAiImageSettings(settings?.imageNovelAi),
    imagePollinations: normalizePollinationsImageSettings(settings?.imagePollinations),
    ttsProvider: normalizedTtsProvider,
    ttsOpenAi: normalizeOpenAiTtsSettings(settings?.ttsOpenAi, normalizedTtsProvider === 'openai' ? legacyTtsVoice : ''),
    ttsMinimax: normalizeMinimaxTtsSettings(settings?.ttsMinimax, {
      enabled: normalizedTtsProvider === 'minimax',
      voiceId: normalizedTtsProvider === 'minimax' && normalizeLegacyTtsVoice(legacyTtsVoice)
        ? normalizeLegacyTtsVoice(legacyTtsVoice)
        : ''
    }),
    ttsDoubao: normalizeDoubaoTtsSettings(settings?.ttsDoubao, normalizedTtsProvider === 'doubao' ? legacyTtsVoice : ''),
    voomReadAtByUser: normalizeVoomReadAtByUser(settings?.voomReadAtByUser),
    voomAutoCleanup: normalizeVoomAutoCleanup(settings?.voomAutoCleanup),
    smallTheaterAutoCleanup: normalizeSmallTheaterAutoCleanup(settings?.smallTheaterAutoCleanup),
    profileHomepageAutoCleanup: normalizeProfileHomepageAutoCleanup(settings?.profileHomepageAutoCleanup),
    smallTheaterTopicEnabledByCharacter: normalizeBooleanRecordMap(settings?.smallTheaterTopicEnabledByCharacter),
    profileThemeEnabledByCharacter: normalizeBooleanRecordMap(settings?.profileThemeEnabledByCharacter),
    smallTheaterTopicDefaultsInitialized: normalizeTimestampRecord(settings?.smallTheaterTopicDefaultsInitialized),
    keepAlive: normalizeKeepAliveSettings(settings?.keepAlive),
    ringtoneSettings: normalizeRingtoneSettings(settings?.ringtoneSettings),
    themeSettings: normalizeThemeSettings(settings?.themeSettings),
    mcpSettings: normalizeMcpSettings(settings?.mcpSettings),
    realityMcpSettings: normalizeRealityMcpSettings(settings?.realityMcpSettings),
    githubBackup: normalizeGitHubBackupSettings(settings?.githubBackup),
    cloudBackup: normalizeCloudBackupSettings(settings?.cloudBackup)
  };

  const resolvedApiConfig = getResolvedApiConfig(normalized);
  const resolvedImageConfig = getResolvedOpenAiImageConfig(normalized);

  return {
    ...normalized,
    activeUserId: String(normalized.activeUserId ?? '').trim(),
    friendsDisplayScope: normalizeFriendsDisplayScope(normalized.friendsDisplayScope),
    ttsEnabled: true,
    ttsVoice: getTtsVoiceForProvider(normalized),
    ttsPlaybackMode: normalized.ttsPlaybackMode === 'auto' ? 'auto' : 'manual',
    apiEndpoint: resolvedApiConfig.endpoint,
    apiKey: resolvedApiConfig.apiKey,
    model: resolvedApiConfig.model || normalized.model,
    imageModel: resolvedImageConfig.model || normalized.imageModel,
    imageSize: normalized.imageOpenAi.size || normalized.imageSize,
    imagePromptPrefix: normalized.imageOpenAi.positivePrompt || normalized.imagePromptPrefix,
    imageModelOverrides: normalized.imageModelOverrides,
    voomImageProvider: normalized.imageModelOverrides.voom.provider,
    voomImageModel: normalized.imageModelOverrides.voom.model,
    imageOpenAi: {
      ...normalized.imageOpenAi,
      activeVendorId: normalized.imageOpenAi.activeVendorId
        || normalized.imageOpenAi.vendors.find((vendor) => vendor.enabled)?.id
        || normalized.imageOpenAi.vendors[0]?.id
        || ''
    }
  };
}