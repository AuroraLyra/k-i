import type { ChatMemorySettings, ChatMode, ConversationOfflineSettings, ConversationSettings, OfflineInterruptionMode, OfflineParagraphMode, OfflinePerspective, OfflinePromptPreset, OfflineRetellMode, OfflineTonePreset, RingtoneAsset, VoomImageMode } from '@/types/domain';
import { createId } from './id';
import { normalizeChatModelOverrides } from './settings';
import { defaultTimeAwarenessSettings, normalizeTimeAwarenessSettings } from './timeAwareness';
import { normalizeVoomFrequency } from './voom';
export { getConversationActiveMessages, getConversationFloorCount, getConversationFloors, getMessageFloorMap, getMessagesInFloorRange } from './memoryFloors';

export const defaultChatMemorySettings: ChatMemorySettings = {
  enabled: true,
  compressionEnabled: true,
  autoCapture: true,
  captureEvery: 8,
  recentMessageLimit: 10,
  recallTokenBudget: 900,
  growthEnabled: true,
  naturalForgettingEnabled: true,
  reflectionEnabled: true,
  embeddingEnabled: false,
  embeddingModel: ''
};

export const defaultOfflineWritingStylePresets: OfflinePromptPreset[] = [
  {
    id: 'baimiao',
    name: '白描',
    content: '采用白描式叙事。只照亮此刻正在发生的人、物、动作和对话；少写背景和解释。语言朴素透明，不用华丽辞藻、夸张比喻或情绪宣告。用具体物件、动作、停顿和空间距离承载情绪，让读者自己读出未说出口的东西。'
  },
  {
    id: 'dialogue-driven',
    name: '对话推进',
    content: '让对白承担主要推进力。叙述只保留必要动作、停顿和空间变化，每句对白都要符合人物身份、情绪和关系距离。允许欲言又止、岔开话题、沉默和答非所问。'
  },
  {
    id: 'sensory-slow',
    name: '慢镜头感官',
    content: '放慢关键瞬间。用声音、温度、气味、触感和细小动作呈现场景，不急着解释情绪。每一段都围绕当下可感知的细节展开，避免跳场和总结式叙述。'
  }
];

export const defaultOfflineTonePresets: OfflinePromptPreset[] = [
  {
    id: 'daily',
    name: '日常',
    content: '基调是平实的日常。重点写生活正在继续：消息、饭点、天气、工作或学习的残留、房间里的物件、临时被打断的琐事。情绪轻轻落在动作里，不要突然拔高。'
  },
  {
    id: 'push-pull',
    name: '拉扯',
    content: '基调是克制的拉扯。人物会靠近又收回，说出口的话比真实想法少半寸。用停顿、改口、避开视线、重复小动作和空间距离表现试探，不要让关系进展过快。'
  },
  {
    id: 'ambiguous',
    name: '暧昧',
    content: '基调是低温暧昧。亲近感来自细节和误差：一句普通话被听出别的意思，一次短暂停留，一件被顺手整理的小事。不要直白告白，保留不确定和余温。'
  },
  {
    id: 'romance',
    name: '热恋',
    content: '基调是明亮而具体的热恋。互动可以更直接、更柔软，但仍要有真实生活的边界和琐碎感。用对话、触碰前后的停顿、分享日常和自然照顾呈现热度，不写油腻情话。'
  },
  {
    id: 'bittersweet',
    name: '酸涩',
    content: '基调是酸涩和留白。人物不是彻底崩溃，而是在正常行动里露出细小裂缝：收好的东西、没说完的话、过期的票据、冷掉的水。情绪要克制，结尾保留余味。'
  }
];

const defaultWritingStylePresetId = defaultOfflineWritingStylePresets[0].id;
const defaultTonePresetId = defaultOfflineTonePresets[0].id;

export const defaultOfflineSettings: ConversationOfflineSettings = {
  enhanceAppearance: true,
  enhanceOutfit: true,
  expandLength: true,
  characterPsychology: true,
  paragraphMode: 'mixed',
  perspective: 'omniscient-third',
  interruptionMode: 'strict',
  retellMode: 'retell',
  wordCount: '800-1200字',
  writingStylePresetId: defaultWritingStylePresetId,
  writingStylePresets: defaultOfflineWritingStylePresets,
  writingStyle: defaultOfflineWritingStylePresets[0].content,
  tonePresetId: defaultTonePresetId,
  tonePresets: defaultOfflineTonePresets,
  tone: 'daily',
  customTone: defaultOfflineTonePresets[0].content
};

const offlineParagraphModes: OfflineParagraphMode[] = ['long', 'short', 'mixed'];
const offlinePerspectives: OfflinePerspective[] = ['omniscient-third', 'character-third', 'character-second', 'user-first', 'user-second'];
const offlineInterruptionModes: OfflineInterruptionMode[] = ['advance', 'strict'];
const offlineRetellModes: OfflineRetellMode[] = ['retell', 'direct'];
const offlineTonePresets: OfflineTonePreset[] = ['daily', 'push-pull', 'ambiguous', 'romance', 'bittersweet', 'custom'];
const voomImageModes: VoomImageMode[] = ['character-choice', 'manual'];

function normalizeStringOption<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  const normalizedValue = String(value ?? '').trim() as T;
  return allowed.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeOptionalRingtoneAsset(asset: Partial<RingtoneAsset> | null | undefined): RingtoneAsset | undefined {
  const url = String(asset?.url ?? '').trim();
  if (!url) return undefined;
  return {
    id: String(asset?.id ?? '').trim() || createId('call-audio'),
    name: String(asset?.name ?? '').trim() || '通话音频',
    url,
    mimeType: String(asset?.mimeType ?? '').trim() || 'audio/mpeg',
    size: Math.max(0, Math.round(Number(asset?.size ?? 0) || 0)),
    source: asset?.source === 'default' ? 'default' : 'imported',
    updatedAt: Math.max(0, Number(asset?.updatedAt ?? 0) || 0)
  };
}

function normalizePromptPreset(preset: Partial<OfflinePromptPreset> | null | undefined, fallback: OfflinePromptPreset, index: number): OfflinePromptPreset {
  const id = String(preset?.id ?? '').trim() || `${fallback.id}_${index}`;
  const name = String(preset?.name ?? '').trim() || fallback.name;
  const content = String(preset?.content ?? '').trim() || fallback.content;
  return { id, name, content };
}

function mergePromptPresets(defaults: OfflinePromptPreset[], presets: unknown): OfflinePromptPreset[] {
  const sourcePresets = Array.isArray(presets) && presets.length ? presets : defaults;
  const customPresets = sourcePresets
    .map((preset, index) => normalizePromptPreset(preset as Partial<OfflinePromptPreset>, defaults[index % defaults.length], index))
    .filter((preset) => preset.id && preset.name && preset.content);
  const byId = new Map<string, OfflinePromptPreset>();
  customPresets.forEach((preset) => {
    byId.set(preset.id, preset);
  });
  const normalized = [...byId.values()];
  return normalized.length ? normalized : defaults.map((preset) => ({ ...preset }));
}

function normalizeActivePresetId(presetId: unknown, presets: OfflinePromptPreset[], fallbackId: string) {
  const normalizedId = String(presetId ?? '').trim();
  if (presets.some((preset) => preset.id === normalizedId)) return normalizedId;
  if (presets.some((preset) => preset.id === fallbackId)) return fallbackId;
  return presets[0]?.id ?? fallbackId;
}

function legacyTonePresetId(settings: Partial<ConversationOfflineSettings> | null | undefined) {
  const tone = normalizeStringOption(settings?.tone, offlineTonePresets, defaultOfflineSettings.tone);
  return tone === 'custom' ? '' : tone;
}

export function activeOfflineWritingStylePreset(settings: ConversationOfflineSettings) {
  return settings.writingStylePresets.find((preset) => preset.id === settings.writingStylePresetId) ?? settings.writingStylePresets[0] ?? defaultOfflineWritingStylePresets[0];
}

export function activeOfflineTonePreset(settings: ConversationOfflineSettings) {
  return settings.tonePresets.find((preset) => preset.id === settings.tonePresetId) ?? settings.tonePresets[0] ?? defaultOfflineTonePresets[0];
}

export function normalizeOfflineSettings(settings: Partial<ConversationOfflineSettings> | null | undefined): ConversationOfflineSettings {
  const isLegacyOfflineSettings = Boolean(settings && !('retellMode' in settings));
  const legacyWritingStyle = String(settings?.writingStyle ?? '').trim();
  const writingStylePresets = mergePromptPresets(defaultOfflineWritingStylePresets, settings?.writingStylePresets);
  if (legacyWritingStyle && !['白描', defaultOfflineWritingStylePresets[0].content].includes(legacyWritingStyle) && !writingStylePresets.some((preset) => preset.content === legacyWritingStyle)) {
    writingStylePresets.push({ id: 'legacy-writing-style', name: '旧文风', content: legacyWritingStyle });
  }
  const writingStylePresetId = normalizeActivePresetId(settings?.writingStylePresetId || (legacyWritingStyle && !['白描', defaultOfflineWritingStylePresets[0].content].includes(legacyWritingStyle) ? 'legacy-writing-style' : defaultWritingStylePresetId), writingStylePresets, defaultWritingStylePresetId);

  const legacyCustomTone = String(settings?.customTone ?? '').trim();
  const tonePresets = mergePromptPresets(defaultOfflineTonePresets, settings?.tonePresets);
  if (legacyCustomTone && !tonePresets.some((preset) => preset.content === legacyCustomTone)) {
    tonePresets.push({ id: 'legacy-tone', name: '旧基调', content: legacyCustomTone });
  }
  const tonePresetId = normalizeActivePresetId(settings?.tonePresetId || legacyTonePresetId(settings) || (legacyCustomTone ? 'legacy-tone' : defaultTonePresetId), tonePresets, defaultTonePresetId);
  const activeWritingStyle = writingStylePresets.find((preset) => preset.id === writingStylePresetId) ?? defaultOfflineWritingStylePresets[0];
  const activeTone = tonePresets.find((preset) => preset.id === tonePresetId) ?? defaultOfflineTonePresets[0];

  return {
    enhanceAppearance: settings?.enhanceAppearance ?? defaultOfflineSettings.enhanceAppearance,
    enhanceOutfit: settings?.enhanceOutfit ?? defaultOfflineSettings.enhanceOutfit,
    expandLength: isLegacyOfflineSettings ? defaultOfflineSettings.expandLength : settings?.expandLength ?? defaultOfflineSettings.expandLength,
    characterPsychology: settings?.characterPsychology ?? defaultOfflineSettings.characterPsychology,
    paragraphMode: normalizeStringOption(settings?.paragraphMode, offlineParagraphModes, defaultOfflineSettings.paragraphMode),
    perspective: normalizeStringOption(settings?.perspective, offlinePerspectives, defaultOfflineSettings.perspective),
    interruptionMode: normalizeStringOption(settings?.interruptionMode, offlineInterruptionModes, defaultOfflineSettings.interruptionMode),
    retellMode: normalizeStringOption(settings?.retellMode, offlineRetellModes, defaultOfflineSettings.retellMode),
    wordCount: isLegacyOfflineSettings && String(settings?.wordCount ?? '').trim() === '1200-1800字'
      ? defaultOfflineSettings.wordCount
      : String(settings?.wordCount ?? defaultOfflineSettings.wordCount).trim() || defaultOfflineSettings.wordCount,
    writingStylePresetId,
    writingStylePresets,
    writingStyle: activeWritingStyle.content,
    tonePresetId,
    tonePresets,
    tone: normalizeStringOption(settings?.tone, offlineTonePresets, defaultOfflineSettings.tone),
    customTone: activeTone.content
  };
}

export const defaultCharacterStickerGroupIds: string[] = [];
const legacyDefaultBackgroundColor = '#8fa2af';
const defaultBackgroundColor = '#ffffff';
const legacyDefaultUserBubbleColor = '#5ce46f';
const defaultUserBubbleColor = '#eeeeee';

export const defaultConversationSettings: Omit<ConversationSettings, 'conversationId'> = {
  memory: defaultChatMemorySettings,
  modelOverrides: normalizeChatModelOverrides(null),
  appearance: {
    backgroundImage: '',
    backgroundImages: [],
    backgroundColor: defaultBackgroundColor,
    userBubbleColor: defaultUserBubbleColor,
    userTextColor: '#111111',
    characterBubbleColor: '#ffffff',
    characterTextColor: '#111111',
    narrationBubbleColor: '#f2f3f5',
    narrationTextColor: '#5f6872',
    showMessageTime: true,
    showReadStatus: true,
    showUserAvatar: false,
    showCharacterAvatar: true,
    showOnlyFirstAvatarInReply: true,
    hideVoomNarration: true
  },
  call: {
    ambientEnabled: false,
    ambientVolume: 0.16
  },
  narrationModeEnabled: true,
  autoGenerateVoom: true,
  voomFrequency: 'medium',
  voomImageMode: 'character-choice',
  voomImageEnabled: true,
  voomImageFrequency: 'always',
  autoGenerateTheater: true,
  theaterFrequency: 'medium',
  stickerVisionEnabled: true,
  stickerSuggestionsEnabled: true,
  offlineInvitationEnabled: true,
  characterStickerGroupIds: defaultCharacterStickerGroupIds,
  timeAwareness: defaultTimeAwarenessSettings,
  proactiveReply: {
    enabled: false,
    frequency: 'medium',
    lastTriggeredAt: 0
  },
  offline: defaultOfflineSettings
};

export function normalizeConversationSettings(settings: Partial<ConversationSettings> | null | undefined, conversationId: string, _mode: ChatMode = 'online'): ConversationSettings {
  const memoryDefaults = defaultChatMemorySettings;
  const memory = settings?.memory ?? memoryDefaults;
  const appearance = settings?.appearance ?? defaultConversationSettings.appearance;
  const call = settings?.call ?? defaultConversationSettings.call;
  const modelOverrides = normalizeChatModelOverrides(settings?.modelOverrides ?? defaultConversationSettings.modelOverrides);
  const isLegacySettings = Boolean(settings && !Object.prototype.hasOwnProperty.call(settings, 'stickerSuggestionsEnabled'));
  const rawBackgroundColor = String(appearance.backgroundColor ?? defaultConversationSettings.appearance.backgroundColor).trim();
  const backgroundColor = !rawBackgroundColor || rawBackgroundColor.toLowerCase() === legacyDefaultBackgroundColor
    ? defaultBackgroundColor
    : rawBackgroundColor;
  const rawUserBubbleColor = String(appearance.userBubbleColor ?? defaultConversationSettings.appearance.userBubbleColor).trim();
  const userBubbleColor = !rawUserBubbleColor || rawUserBubbleColor.toLowerCase() === legacyDefaultUserBubbleColor
    ? defaultUserBubbleColor
    : rawUserBubbleColor;
  const activeBackgroundImage = String(appearance.backgroundImage ?? '').trim();
  const backgroundImages = [
    activeBackgroundImage,
    ...(Array.isArray(appearance.backgroundImages) ? appearance.backgroundImages : [])
  ].map((image) => String(image ?? '').trim()).filter(Boolean);
  const voomFrequency = normalizeVoomFrequency(settings?.voomFrequency, defaultConversationSettings.voomFrequency);
  const voomImageMode = normalizeStringOption(settings?.voomImageMode, voomImageModes, defaultConversationSettings.voomImageMode);
  const voomImageFrequency = normalizeVoomFrequency(settings?.voomImageFrequency, defaultConversationSettings.voomImageFrequency);
  const theaterFrequency = normalizeVoomFrequency(settings?.theaterFrequency, defaultConversationSettings.theaterFrequency);
  const proactiveReply = settings?.proactiveReply ?? defaultConversationSettings.proactiveReply;
  const callAmbientSound = normalizeOptionalRingtoneAsset(call.ambientSound);
  const ambientVolume = Math.min(0.6, Math.max(0.02, Number(call.ambientVolume) || defaultConversationSettings.call.ambientVolume));

  return {
    conversationId,
    memory: {
      enabled: memory.enabled ?? memoryDefaults.enabled,
      compressionEnabled: memory.compressionEnabled ?? memoryDefaults.compressionEnabled,
      autoCapture: memory.autoCapture ?? memoryDefaults.autoCapture,
      captureEvery: Math.min(40, Math.max(2, Math.round(Number(memory.captureEvery) || memoryDefaults.captureEvery))),
      recentMessageLimit: Math.min(24, Math.max(6, Math.round(Number(memory.recentMessageLimit) || memoryDefaults.recentMessageLimit))),
      recallTokenBudget: Math.min(2400, Math.max(300, Math.round(Number(memory.recallTokenBudget) || memoryDefaults.recallTokenBudget))),
      growthEnabled: memory.growthEnabled ?? memoryDefaults.growthEnabled,
      naturalForgettingEnabled: memory.naturalForgettingEnabled ?? memoryDefaults.naturalForgettingEnabled,
      reflectionEnabled: memory.reflectionEnabled ?? memoryDefaults.reflectionEnabled,
      embeddingEnabled: memory.embeddingEnabled ?? memoryDefaults.embeddingEnabled,
      embeddingModel: String(memory.embeddingModel ?? memoryDefaults.embeddingModel).trim()
    },
    modelOverrides,
    appearance: {
      backgroundImage: activeBackgroundImage,
      backgroundImages: [...new Set(backgroundImages)],
      backgroundColor,
      userBubbleColor,
      userTextColor: String(appearance.userTextColor ?? defaultConversationSettings.appearance.userTextColor).trim() || defaultConversationSettings.appearance.userTextColor,
      characterBubbleColor: String(appearance.characterBubbleColor ?? defaultConversationSettings.appearance.characterBubbleColor).trim() || defaultConversationSettings.appearance.characterBubbleColor,
      characterTextColor: String(appearance.characterTextColor ?? defaultConversationSettings.appearance.characterTextColor).trim() || defaultConversationSettings.appearance.characterTextColor,
      narrationBubbleColor: String(appearance.narrationBubbleColor ?? defaultConversationSettings.appearance.narrationBubbleColor).trim() || defaultConversationSettings.appearance.narrationBubbleColor,
      narrationTextColor: String(appearance.narrationTextColor ?? defaultConversationSettings.appearance.narrationTextColor).trim() || defaultConversationSettings.appearance.narrationTextColor,
      showMessageTime: appearance.showMessageTime ?? defaultConversationSettings.appearance.showMessageTime,
      showReadStatus: appearance.showReadStatus ?? defaultConversationSettings.appearance.showReadStatus,
      showUserAvatar: appearance.showUserAvatar ?? defaultConversationSettings.appearance.showUserAvatar,
      showCharacterAvatar: appearance.showCharacterAvatar ?? defaultConversationSettings.appearance.showCharacterAvatar,
      showOnlyFirstAvatarInReply: appearance.showOnlyFirstAvatarInReply ?? defaultConversationSettings.appearance.showOnlyFirstAvatarInReply,
      hideVoomNarration: true
    },
    call: {
      ...(callAmbientSound ? { ambientSound: callAmbientSound } : {}),
      ambientEnabled: Boolean(call.ambientEnabled ?? defaultConversationSettings.call.ambientEnabled),
      ambientVolume
    },
    narrationModeEnabled: isLegacySettings ? defaultConversationSettings.narrationModeEnabled : settings?.narrationModeEnabled ?? defaultConversationSettings.narrationModeEnabled,
    autoGenerateVoom: settings?.autoGenerateVoom ?? defaultConversationSettings.autoGenerateVoom,
    voomFrequency,
    voomImageMode,
    voomImageEnabled: settings?.voomImageEnabled ?? defaultConversationSettings.voomImageEnabled,
    voomImageFrequency,
    autoGenerateTheater: settings?.autoGenerateTheater ?? defaultConversationSettings.autoGenerateTheater,
    theaterFrequency,
    stickerVisionEnabled: settings?.stickerVisionEnabled ?? defaultConversationSettings.stickerVisionEnabled,
    stickerSuggestionsEnabled: settings?.stickerSuggestionsEnabled ?? defaultConversationSettings.stickerSuggestionsEnabled,
    offlineInvitationEnabled: settings?.offlineInvitationEnabled ?? defaultConversationSettings.offlineInvitationEnabled,
    characterStickerGroupIds: Array.isArray(settings?.characterStickerGroupIds)
      ? [...new Set(settings.characterStickerGroupIds.map((item) => String(item).trim()).filter(Boolean))]
      : [...defaultConversationSettings.characterStickerGroupIds],
    timeAwareness: normalizeTimeAwarenessSettings(settings?.timeAwareness),
    proactiveReply: {
      enabled: proactiveReply.enabled ?? defaultConversationSettings.proactiveReply.enabled,
      frequency: normalizeVoomFrequency(proactiveReply.frequency, defaultConversationSettings.proactiveReply.frequency),
      lastTriggeredAt: Math.max(0, Math.floor(Number(proactiveReply.lastTriggeredAt) || 0))
    },
    offline: normalizeOfflineSettings(settings?.offline)
  };
}

export function estimateTokenCount(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = normalized.replace(/[\u3400-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjkCount * 1.1 + latinWords * 1.35));
}
