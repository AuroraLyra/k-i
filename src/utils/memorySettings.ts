import type { ChatMemorySettings } from '@/types/domain';

export const chatMemorySettingLimits = {
  captureEvery: { minimum: 2, maximum: 120, step: 1, defaultValue: 12 },
  recentFloorLimit: { minimum: 6, maximum: 120, step: 1, defaultValue: 100 },
  recallTokenBudget: { minimum: 300, maximum: 50_000, step: 100, defaultValue: 20_000 }
} as const;

export type ChatMemoryNumericSetting = keyof typeof chatMemorySettingLimits;

export const chatMemoryDefaultsMigrationVersion = 2;

export function normalizeChatMemorySetting(
  setting: ChatMemoryNumericSetting,
  value: unknown,
  fallback: number = chatMemorySettingLimits[setting].defaultValue
) {
  const limits = chatMemorySettingLimits[setting];
  const normalized = Math.round(Number(value) || fallback);
  return Math.min(limits.maximum, Math.max(limits.minimum, normalized));
}

export function applyCurrentChatMemoryDefaults(memory: ChatMemorySettings): ChatMemorySettings {
  void memory;
  return {
    enabled: true,
    compressionEnabled: true,
    autoCapture: true,
    captureEvery: chatMemorySettingLimits.captureEvery.defaultValue,
    recentFloorLimit: chatMemorySettingLimits.recentFloorLimit.defaultValue,
    recallTokenBudget: chatMemorySettingLimits.recallTokenBudget.defaultValue,
    growthEnabled: true,
    naturalForgettingEnabled: true,
    reflectionEnabled: true,
    embeddingEnabled: true,
    embeddingModel: ''
  };
}