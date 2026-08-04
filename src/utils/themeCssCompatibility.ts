const legacyGroupEndSelector = /:not\(\s*:has\(\s*\+\s*\.message-row\.(user|char)\s*\)\s*\)/g;
const legacyGroupContinuationSelector = /:has\(\s*\+\s*\.message-row\.(user|char)\s*\)/g;
const legacyGroupedPreviousSelector = /\.message-row\.(user|char)\s*\+\s*\.message-row\.\1/g;
const onlineImageCompatibilityCss = `
.chat-room .bubble.image {
  min-width: 0 !important;
  max-width: 100% !important;
}

.chat-room .bubble.image .chat-image-card:not(.chat-image-card--description) {
  width: fit-content !important;
  min-width: 0 !important;
  max-width: var(--link-chat-image-max-width, min(220px, 64vw)) !important;
  height: auto !important;
  min-height: 0 !important;
  aspect-ratio: auto !important;
  overflow: hidden !important;
}

.chat-room .bubble.image .chat-image-card:not(.chat-image-card--description) > img {
  display: block !important;
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  max-height: var(--link-chat-image-max-height, min(360px, 62vh)) !important;
  aspect-ratio: auto !important;
  object-fit: var(--link-chat-image-fit, contain) !important;
}
`;

export function upgradeLegacyOnlineThemeCss(css: string) {
  return css
    .replace(legacyGroupEndSelector, ':is(.message-group-last, .message-group-single)')
    .replace(legacyGroupContinuationSelector, ':is(.message-group-first, .message-group-middle)')
    .replace(legacyGroupedPreviousSelector, (_selector, sender: string) => `.message-row.${sender}:is(.message-group-middle, .message-group-last)`);
}

export function ensureOnlineThemeImageCompatibility(css: string) {
  return `${css.trimEnd()}\n${onlineImageCompatibilityCss}`;
}