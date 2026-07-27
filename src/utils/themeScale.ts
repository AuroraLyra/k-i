export const defaultGlobalThemeScale = 1;
export const minGlobalThemeScale = 0.625;
export const maxGlobalThemeScale = 1.5;
export const globalThemeScaleStep = 0.025;

export const minGlobalThemeScalePercent = minGlobalThemeScale * 100;
export const maxGlobalThemeScalePercent = maxGlobalThemeScale * 100;
export const globalThemeScaleStepPercent = globalThemeScaleStep * 100;

export function normalizeGlobalThemeScale(value: unknown) {
  const numericValue = Number(value);
  const finiteValue = Number.isFinite(numericValue) ? numericValue : defaultGlobalThemeScale;
  const steppedValue = Math.round(finiteValue / globalThemeScaleStep) * globalThemeScaleStep;
  return Math.min(maxGlobalThemeScale, Math.max(minGlobalThemeScale, Number(steppedValue.toFixed(3))));
}

export function normalizeGlobalThemeScalePercent(value: unknown) {
  return Number((normalizeGlobalThemeScale(Number(value) / 100) * 100).toFixed(1));
}