export const chatMemorySettingLimits = {
  captureEvery: { minimum: 2, maximum: 120, step: 1, defaultValue: 25 },
  recentFloorLimit: { minimum: 6, maximum: 120, step: 1, defaultValue: 20 },
  recallTokenBudget: { minimum: 300, maximum: 8_000, step: 100, defaultValue: 5_000 }
} as const;

export type ChatMemoryNumericSetting = keyof typeof chatMemorySettingLimits;

export function normalizeChatMemorySetting(
  setting: ChatMemoryNumericSetting,
  value: unknown,
  fallback: number = chatMemorySettingLimits[setting].defaultValue
) {
  const limits = chatMemorySettingLimits[setting];
  const normalized = Math.round(Number(value) || fallback);
  return Math.min(limits.maximum, Math.max(limits.minimum, normalized));
}