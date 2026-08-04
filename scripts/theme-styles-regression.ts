import { ensureOnlineThemeImageCompatibility, upgradeLegacyOnlineThemeCss } from '../src/utils/themeCssCompatibility';
import { defaultGlobalThemeCss, defaultOfflineThemeCss, defaultOnlineThemeCss, themeStyleTemplateVersion } from '../src/utils/themeStyles';

function expectMatch(value: string, pattern: RegExp) {
  if (!pattern.test(value)) throw new Error(`Expected theme CSS to match ${pattern}.`);
}

function expectNoMatch(value: string, pattern: RegExp) {
  if (pattern.test(value)) throw new Error(`Expected theme CSS not to match ${pattern}.`);
}

const legacyCss = `
.chat-room .message-row.user:not(:has(+ .message-row.user)) .bubble::after { display: block; }
.chat-room .message-row.char:not(:has( + .message-row.char )) .avatar-button { visibility: visible; }
.chat-room .message-row.user:has(+ .message-row.user) .bubble { margin-bottom: 0; }
.chat-room .message-row.char + .message-row.char .bubble { border-radius: 10px; }
.other-card:has(+ .other-card) { opacity: 0.8; }
`;

const upgradedCss = upgradeLegacyOnlineThemeCss(legacyCss);
expectMatch(upgradedCss, /\.message-row\.user:is\(\.message-group-last, \.message-group-single\) \.bubble::after/);
expectMatch(upgradedCss, /\.message-row\.char:is\(\.message-group-last, \.message-group-single\) \.avatar-button/);
expectMatch(upgradedCss, /\.message-row\.user:is\(\.message-group-first, \.message-group-middle\) \.bubble/);
expectMatch(upgradedCss, /\.message-row\.char:is\(\.message-group-middle, \.message-group-last\) \.bubble/);
expectMatch(upgradedCss, /\.other-card:has\(\+ \.other-card\)/);
expectNoMatch(upgradedCss, /\.message-row\.(?:user|char):not\(\s*:has/);

const compatibleImageCss = ensureOnlineThemeImageCompatibility(`
.chat-room .chat-image-card { width: 154px; aspect-ratio: 1 / 1; }
.chat-room .chat-image-card img { height: 154px; object-fit: cover; }
`);
expectMatch(compatibleImageCss, /--link-chat-image-max-width/);
expectMatch(compatibleImageCss, /object-fit: var\(--link-chat-image-fit, contain\) !important/);
expectMatch(compatibleImageCss, /aspect-ratio: auto !important/);

for (const css of [defaultGlobalThemeCss, defaultOnlineThemeCss, defaultOfflineThemeCss]) {
  expectMatch(css, new RegExp(`模板版本：${themeStyleTemplateVersion.replaceAll('.', '\\.')}`));
}

for (const position of ['single', 'first', 'middle', 'last']) {
  expectMatch(defaultOnlineThemeCss, new RegExp(`\\.message-group-${position}`));
  expectMatch(defaultOnlineThemeCss, new RegExp(`\\.bubble-group-${position}`));
  expectMatch(defaultOnlineThemeCss, new RegExp(`\\.bubble-wrap-group-${position}`));
}

console.log('Theme style regression checks passed.');