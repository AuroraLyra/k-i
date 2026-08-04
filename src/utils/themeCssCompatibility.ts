const legacyGroupEndSelector = /:not\(\s*:has\(\s*\+\s*\.message-row\.(user|char)\s*\)\s*\)/g;
const legacyGroupContinuationSelector = /:has\(\s*\+\s*\.message-row\.(user|char)\s*\)/g;
const legacyGroupedPreviousSelector = /\.message-row\.(user|char)\s*\+\s*\.message-row\.\1/g;

export function upgradeLegacyOnlineThemeCss(css: string) {
  return css
    .replace(legacyGroupEndSelector, ':is(.message-group-last, .message-group-single)')
    .replace(legacyGroupContinuationSelector, ':is(.message-group-first, .message-group-middle)')
    .replace(legacyGroupedPreviousSelector, (_selector, sender: string) => `.message-row.${sender}:is(.message-group-middle, .message-group-last)`);
}