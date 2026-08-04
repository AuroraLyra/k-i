export const defaultGlobalBottomBarOffset = 0;
export const minGlobalBottomBarOffset = -24;
export const maxGlobalBottomBarOffset = 24;
export const globalBottomBarOffsetStep = 2;

export function normalizeGlobalBottomBarOffset(value: unknown) {
  const numericValue = Number(value);
  const finiteValue = Number.isFinite(numericValue) ? numericValue : defaultGlobalBottomBarOffset;
  const steppedValue = Math.round(finiteValue / globalBottomBarOffsetStep) * globalBottomBarOffsetStep;
  return Math.min(maxGlobalBottomBarOffset, Math.max(minGlobalBottomBarOffset, steppedValue));
}