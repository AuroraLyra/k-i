import type { ThemeStylePreset } from '@/types/domain';

export const defaultGlobalThemePresetId = 'global-default';
export const defaultOnlineThemePresetId = 'online-default';
export const defaultOfflineThemePresetId = 'offline-default';
export const onlineThemeExportMime = 'application/link-online-theme+json';
const exportMagic = 'LINK_THEME_STYLE_V2';
const legacyExportMagic = 'LINK_ONLINE_THEME_V1';
const pngChannelCount = 3;
const pngPayloadWidth = 256;
const exportPosterWidth = 1080;
const exportPosterHeight = 1350;

export type ThemeStyleExportScope = 'global' | 'online' | 'offline';

export const defaultGlobalThemeCss = `/* LINK 默认全站样式（安全模式）。
  默认状态不会覆盖任何页面或弹窗，Home、VOOM、Services、Settings 等页面继续使用各自原本的内置样式。

  点击右上角 + 新建全站样式时，会提供可编辑的完整起始模板；只有保存并主动应用自定义预设后，才会覆盖整个网站。

  常用全站选择器：
  1. 普通子页面：#app .mobile-shell > .screen:not(.chat-room):not(.offline-room)
  2. 顶部栏：#app .screen .top-bar
  3. 底部导航：#app .mobile-shell .bottom-tabs
  4. 卡片/面板：#app .screen :is([class$="-card"], [class$="-panel"], [class$="-block"])
  5. 表单：#app .screen :is(input, textarea, select)
  6. AppModal 弹窗：body .modal-backdrop、body .modal-panel、body .modal-header、body .modal-body
  7. 其他浮层：body :is([class$="-sheet"], [class$="-popover"], [class$="-menu"], [class$="-layer"])
  8. 线上聊天与 Stickers 请继续到“线上”主题细调；线下阅读页请到“线下”主题细调。 */
`;

export const globalThemeStarterCss = `/* LINK 全站自定义样式起始模板。
  这份样式作用于整个网站：所有子页面、顶部栏、底部导航、卡片、表单、按钮、弹窗、抽屉、浮层和提示。
  保存并应用后才会生效；线上与线下主题会在它之后加载，可继续覆盖聊天页和线下阅读页的专用细节。

  小白改法：
  1. 想改全站配色，先改 :root 里的 --global-* 变量。
  2. 想改所有普通子页面底色，搜 .screen:not(.chat-room):not(.offline-room)。
  3. 想改顶部栏，搜 .top-bar；底部导航搜 .bottom-tabs 和 [class$="-tabs"]。
  4. 想改所有卡片/面板，搜 [class$="-card"]、[class$="-panel"] 和 [class$="-block"]。
  5. 想改输入框，搜 input/textarea/select；想改按钮，搜 button 和 .primary-action。
  6. 想改全部 AppModal 弹窗，搜 .modal-backdrop、.modal-panel、.modal-header、.modal-body。
  7. 想改其他抽屉/浮层，搜 [class$="-sheet"]、[class$="-popover"]、[class$="-menu"]、[class$="-layer"]。
  8. 线上聊天、Chat Settings、Stickers 键盘请到“线上”主题继续细调；线下阅读页请到“线下”主题细调。
  9. scoped 页面样式权重较高时，可在选择器前加 #app，最后再按需给单个属性加 !important。
  10. 常用属性：background 背景，color 文字，border-radius 圆角，border 边框，box-shadow 阴影。 */
:root {
  --global-ink: #111111;
  --global-muted: #727a82;
  --global-subtle: #8a8f94;
  --global-line: rgba(17, 17, 17, 0.06);
  --global-page: #f4f7f5;
  --global-surface: rgba(255, 255, 255, 0.92);
  --global-surface-strong: #ffffff;
  --global-soft: #f0f3f1;
  --global-accent-soft: #eef8f1;
  --global-accent: #06c755;
  --global-danger: #d73850;
  --global-radius: 20px;
  --global-shadow: 0 14px 34px rgba(21, 30, 26, 0.07);
  --link-green: var(--global-accent);
}

html,
body,
#app {
  background: var(--global-page);
  color: var(--global-ink);
}

#app .mobile-shell {
  background: var(--global-page);
  color: var(--global-ink);
}

#app .mobile-shell > .screen:not(.chat-room):not(.offline-room) {
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.44), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(6, 199, 85, 0.14), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 54%, #edf3f1 100%);
  color: var(--global-ink);
}

#app .screen:not(.chat-room):not(.offline-room) .top-bar {
  background: rgba(251, 252, 251, 0.9);
  color: var(--global-ink);
  border-color: var(--global-line);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

#app .screen:not(.chat-room):not(.offline-room) .top-title,
#app .screen:not(.chat-room):not(.offline-room) :where(h1, h2, h3, h4, strong) {
  color: var(--global-ink);
}

#app .screen:not(.chat-room):not(.offline-room) :where(p, small, time, .subtitle, .description, .empty-state) {
  color: var(--global-muted);
}

#app .screen:not(.chat-room):not(.offline-room) :is(.bottom-tabs, [class$="-bottom-tabs"], [class$="-tabs"]),
#app .mobile-shell > :is(.bottom-tabs, [class$="-bottom-tabs"]) {
  border-color: var(--global-line);
  background: rgba(255, 255, 255, 0.94);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

#app .screen:not(.chat-room):not(.offline-room) :is(.bottom-tabs, [class$="-bottom-tabs"], [class$="-tabs"]) button {
  color: var(--global-subtle);
}

#app .screen:not(.chat-room):not(.offline-room) :is(.bottom-tabs, [class$="-bottom-tabs"], [class$="-tabs"]) button.active {
  color: var(--global-accent);
}

#app .screen:not(.chat-room):not(.offline-room) :is([class$="-card"], [class$="-panel"], [class$="-block"]) {
  border-color: var(--global-line);
  background-color: var(--global-surface);
  color: var(--global-ink);
  box-shadow: var(--global-shadow);
}

#app .screen:not(.chat-room):not(.offline-room) :is(.section-card, .settings-card, .list-card, .empty-shell, .placeholder-panel) {
  border-color: var(--global-line);
  border-radius: var(--global-radius);
  background: var(--global-surface);
  color: var(--global-ink);
  box-shadow: var(--global-shadow);
}

#app .screen:not(.chat-room):not(.offline-room) :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, select) {
  border-color: var(--global-line);
  background: rgba(250, 252, 250, 0.96);
  color: var(--global-ink);
  caret-color: var(--global-accent);
}

#app .screen:not(.chat-room):not(.offline-room) :is(input, textarea)::placeholder {
  color: var(--global-subtle);
}

#app .screen:not(.chat-room):not(.offline-room) :is(input, textarea, select):focus {
  border-color: rgba(6, 199, 85, 0.34);
  box-shadow: 0 0 0 3px rgba(6, 199, 85, 0.1);
}

#app .screen:not(.chat-room):not(.offline-room) :is(button, [role="button"]) {
  border-color: transparent;
}

#app .screen:not(.chat-room):not(.offline-room) :is(.primary-action, .footer-save, .save-button, .send-button) {
  background: var(--global-accent);
  color: #ffffff;
}

#app .screen:not(.chat-room):not(.offline-room) :is(.secondary-action, .ghost-button, .card-action, .section-action) {
  background: var(--global-soft);
  color: #2d333a;
}

#app .screen:not(.chat-room):not(.offline-room) :is(.danger-action, .danger, .delete-button) {
  color: var(--global-danger);
}

#app .screen:not(.chat-room):not(.offline-room) :is(.switch-track, [role="switch"]) {
  background-color: #dfe8e4;
}

#app .screen:not(.chat-room):not(.offline-room) :is(.switch-card input:checked + .switch-track, [role="switch"][aria-checked="true"]) {
  background-color: var(--global-accent);
}

body .modal-backdrop {
  background: rgba(17, 24, 20, 0.34);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

body .modal-panel {
  border-color: rgba(255, 255, 255, 0.82);
  background: var(--global-surface-strong);
  color: var(--global-ink);
  box-shadow: 0 24px 64px rgba(17, 24, 20, 0.2);
}

body .modal-header {
  border-color: var(--global-line);
  background: rgba(255, 255, 255, 0.92);
  color: var(--global-ink);
}

body .modal-body {
  background: transparent;
  color: var(--global-ink);
}

body .modal-panel :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), textarea, select) {
  border-color: var(--global-line);
  background: var(--global-soft);
  color: var(--global-ink);
}

body :is([class$="-sheet"], [class$="-popover"], [class$="-menu"], [class$="-layer"]) {
  --global-popup-surface: var(--global-surface-strong);
  --global-popup-line: var(--global-line);
  color: var(--global-ink);
}

body :is(.action-menu, .context-menu, .tool-popover, .picker-popover, .notice-panel, .toast-card) {
  border-color: var(--global-line);
  background: var(--global-popup-surface, var(--global-surface-strong));
  color: var(--global-ink);
  box-shadow: var(--global-shadow);
}
`;

export const defaultOnlineThemeCss = `/* LINK 线上页默认完整样式。
  复制后可自由修改；聊天页建议保留 .chat-room 前缀，聊天设置保留 .chat-settings-page 前缀，Stickers 弹窗保留 .sticker-keyboard-layer 前缀，避免影响其他页面。

  小白改法：
  1. 想改整页底色，搜 .chat-room，改 background。
  2. 想改顶部栏，搜 .chat-header；顶部按钮搜 .icon-button。
  3. 想改聊天气泡，搜 .bubble；自己的气泡搜 .message-row.user .bubble。
  4. 想改消息里的安全 HTML（如 details/summary/p），搜 .message-html-content。
  5. 想改 5 分钟时间分割，搜 .message-time-divider。
  6. 想改底部输入栏，搜 .composer；输入框搜 .composer-input；发送按钮搜 .send-button。
  7. 想改输入框里的表情包笑脸按钮，搜 .sticker-button；只改笑脸图标搜 .sticker-button svg。
  8. 想改 Stickers 弹窗，搜 .sticker-keyboard-layer；贴纸卡片搜 .sticker-tile。
  9. 想改 Chat Settings，搜 .chat-settings-page；设置卡片搜 .settings-block，开关搜 .switch-card。
  10. 常用属性：background 改背景，color 改文字，width/height 改大小，stroke-width 改图标粗细，border-radius 改圆角，box-shadow 改阴影。 */
.chat-room {
  --online-ink: #111111;
  --online-muted: #727a82;
  --online-subtle: #8a8f94;
  --online-line: rgba(17, 17, 17, 0.06);
  --online-card: rgba(255, 255, 255, 0.88);
  --online-card-strong: #ffffff;
  --online-soft: #f0f1f2;
  --online-soft-green: #eef8f1;
  --online-green: #06c755;
  --online-danger: #d73850;
  background: #f4f7f2;
  color: var(--online-ink);
}

.chat-room .chat-header {
  min-height: 42px;
  padding: calc(3px + var(--safe-top)) calc(10px + var(--safe-right)) 3px calc(10px + var(--safe-left));
  background: transparent;
  backdrop-filter: none;
}

.chat-room .chat-header .chat-title-row,
.chat-room .chat-header .icon-row {
  display: flex;
  align-items: center;
  gap: var(--top-icon-gap);
}

.chat-room .chat-header .chat-person strong {
  color: #111111;
  font-size: var(--compact-heading-font-size);
  font-weight: 800;
}

.chat-room .chat-header .icon-button,
.chat-room .composer .icon-button,
.chat-room .composer .voice-button {
  color: #141414;
  background: transparent;
  border-radius: 8px;
}

.chat-room .message-list {
  padding: 10px 10px calc(8px + var(--keyboard-inset));
  scroll-padding-bottom: calc(8px + var(--keyboard-inset));
  background: transparent;
}

.chat-room .history-loader,
.chat-room .typing-indicator,
.chat-room .message-meta {
  color: #727a82;
}

.chat-room .message-time-divider {
  display: flex;
  justify-content: center;
  margin: 12px 0 8px;
  pointer-events: none;
}

.chat-room .message-time-divider time {
  max-width: calc(100% - 32px);
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(245, 246, 248, 0.82);
  color: #7b828a;
  font-size: 11px;
  font-weight: 680;
  line-height: 1.2;
  box-shadow: 0 1px 6px rgba(17, 20, 24, 0.06);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.chat-room .message-row {
  gap: 10px;
  margin: 7px 0;
}

.chat-room .message-row.user {
  justify-content: flex-end;
}

.chat-room .avatar-button,
.chat-room .avatar.mini {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.chat-room .bubble-wrap {
  max-width: min(80%, 300px);
  gap: 5px;
}

.chat-room .bubble {
  min-width: 32px;
  max-width: 100%;
  padding: 7px 11px;
  border-radius: 15px;
  background: #ffffff;
  color: #111111;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}

.chat-room .message-html-content {
  display: block;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.chat-room .message-html-content :where(p, ul, ol, blockquote, pre, details, h1, h2, h3, h4, h5, h6, hr) {
  margin: 0 0 0.55em;
}

.chat-room .message-html-content > :last-child {
  margin-bottom: 0;
}

.chat-room .message-html-content :where(summary) {
  cursor: pointer;
  font-weight: 850;
}

.chat-room .message-html-content :where(ul, ol) {
  padding-left: 1.35em;
}

.chat-room .message-html-content :where(pre, code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.chat-room .message-html-content :where(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.chat-room .message-html-content :where(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-room .message-row.user .bubble {
  background: #5ce46f;
  color: #111111;
}

.chat-room .bubble.narration,
.chat-room .message-row.system .bubble.narration {
  background: rgba(17, 17, 17, 0.06);
  color: #5f6872;
  font-style: italic;
}

.chat-room .bubble.sticker,
.chat-room .bubble.image {
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.chat-room .sticker-image {
  max-width: min(132px, 38vw);
  max-height: min(132px, 38vw);
  object-fit: contain;
}

.chat-room .chat-image-card {
  overflow: hidden;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(17, 20, 24, 0.08);
}

.chat-room .chat-image-card img {
  display: block;
  max-width: min(220px, 64vw);
  max-height: min(280px, 72vw);
  object-fit: cover;
}

.chat-room .chat-image-card figcaption {
  padding: 12px;
  color: #4a5158;
}

.chat-room .voice-message {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 120px;
  padding: 9px 10px;
  border-radius: 15px;
  background: #ffffff;
  color: #111111;
  border: 1px solid rgba(17, 17, 17, 0.05);
  box-shadow: 0 8px 24px rgba(17, 20, 24, 0.08);
}

.chat-room .voice-wave span,
.chat-room .voice-preview-wave span {
  background: currentColor;
}

.chat-room .voice-transcript,
.chat-room .quote-card {
  max-width: 100%;
  margin: 0;
  padding: 7px 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  color: #59616a;
}

.chat-room .line-location-card {
  overflow: hidden;
  width: 100%;
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.chat-room .location-preview-card {
  overflow: hidden;
  width: min(188px, 55vw);
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.chat-room .line-location-map,
.chat-room .location-preview-card .link-location-map {
  display: block;
  position: relative;
  height: 70px;
  overflow: hidden;
  background: #dce8d8;
}

.chat-room .line-location-body,
.chat-room .location-preview-card .link-location-body {
  display: grid;
  gap: 2px;
  padding: 5px 7px 6px;
  border-bottom: 0;
}

.chat-room .line-location-footer,
.chat-room .location-preview-card .link-location-footer {
  display: grid;
  gap: 4px;
  padding: 0 6px;
}

.chat-room .line-location-kicker,
.chat-room .line-website-kicker,
.chat-room .transfer-request-chip {
  color: #7a828b;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
}

.chat-room .transfer-request-card,
.chat-room .transfer-compose-preview {
  display: grid;
  width: min(196px, 57vw);
  border-radius: 10px;
  background: #ffffff;
  color: #111111;
  box-shadow: 0 9px 22px rgba(22, 27, 33, 0.08);
}

.chat-room .transfer-request-card {
  gap: 0;
  width: 100%;
  padding: 0;
}

.chat-room .transfer-compose-preview {
  gap: 10px;
  padding: 12px;
}

.chat-room .transfer-request-brand,
.chat-room .transfer-compose-brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 900;
}

.chat-room .transfer-request-mark {
  display: inline-grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: #06c755;
  color: #ffffff;
}

.chat-room .transfer-request-main strong,
.chat-room .transfer-compose-main strong {
  font-size: 24px;
  line-height: 1;
}

.chat-room .location-actions,
.chat-room .transfer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-room .transfer-request-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 7px;
  padding: 7px 8px 8px;
}

.chat-room .transfer-request-action,
.chat-room .primary-action,
.chat-room .secondary-action,
.chat-room .danger-action {
  min-height: 34px;
  padding: 0 12px;
  border-radius: 10px;
  font-weight: 800;
}

.chat-room .transfer-request-action {
  min-width: 0;
  min-height: 26px;
  padding: 0;
  border-radius: 9px;
}

.chat-room .transfer-request-action--accept,
.chat-room .primary-action {
  background: #06c755;
  color: #ffffff;
}

.chat-room .transfer-request-action--reject,
.chat-room .secondary-action {
  background: #eef0f2;
  color: #2b3036;
}

.chat-room .selection-toolbar .secondary-action {
  background: transparent;
}

.chat-room .line-website-card {
  display: grid;
  gap: 10px;
  width: min(222px, 64vw);
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  color: #202329;
  box-shadow: 0 8px 20px rgba(17, 20, 24, 0.06);
}

.chat-room .composer {
  min-height: calc(52px + var(--safe-bottom));
  padding: 6px calc(8px + var(--safe-right)) calc(6px + var(--safe-bottom)) calc(8px + var(--safe-left));
  background: transparent;
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
}

.chat-room .composer-input {
  align-items: center;
  height: auto;
  min-height: 34px;
  padding: 5px 10px;
  border-radius: 17px;
  background: #f0f1f2;
  color: #777b80;
}

.chat-room .composer-input textarea {
  min-height: 22px;
  line-height: 1.35;
  color: #111111;
}

/* 输入栏表情包按钮：按钮本体改 .sticker-button，笑脸线条改 .sticker-button svg。 */
.chat-room .composer .sticker-button {
  display: grid;
  place-items: center;
  flex: 0 0 24px;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 50%;
  background: transparent;
  color: #777b80;
}

.chat-room .composer .sticker-button svg {
  width: 20px;
  height: 20px;
  stroke-width: 2;
}

.chat-room .composer .sticker-button:active {
  background: rgba(0, 0, 0, 0.06);
}

.chat-room .composer .sticker-button:disabled {
  opacity: 0.45;
}

.chat-room .composer-quote,
.chat-room .sticker-suggestions .suggestion-chip {
  background: rgba(240, 241, 242, 0.96);
  color: #2d333a;
}

.chat-room .text-action {
  background: #eff1f3;
  color: #2d333a;
}

.chat-room .send-button {
  background: #06c755;
  color: #ffffff;
}

.chat-settings-page,
.sticker-keyboard-layer {
  --online-ink: #111111;
  --online-muted: #727a82;
  --online-subtle: #8a8f94;
  --online-line: rgba(17, 17, 17, 0.06);
  --online-card: rgba(255, 255, 255, 0.88);
  --online-card-strong: #ffffff;
  --online-soft: #f0f1f2;
  --online-soft-green: #eef8f1;
  --online-green: #06c755;
  --online-danger: #d73850;
  color: var(--online-ink);
}

.chat-settings-page {
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.44), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(6, 199, 85, 0.16), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 54%, #edf3f1 100%);
}

.chat-settings-page .chat-settings-topbar {
  min-height: 46px;
  background: rgba(251, 252, 251, 0.9);
  color: var(--online-ink);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.chat-settings-page .chat-settings-title-button,
.chat-settings-page .chat-settings-title-button .top-title {
  color: inherit;
}

.chat-settings-page .chat-settings-main {
  padding: 10px calc(16px + var(--safe-right)) 16px calc(16px + var(--safe-left));
  background: transparent;
}

.chat-settings-page .chat-settings-panel,
.chat-settings-page .control-panel,
.chat-settings-page .panel-section {
  display: grid;
  min-width: 0;
  gap: 14px;
  color: var(--online-ink);
}

.chat-settings-page .chat-settings-tabs {
  gap: 4px;
  padding: 8px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid var(--online-line);
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.chat-settings-page .chat-settings-tab {
  min-height: 48px;
  border-radius: 14px;
  color: var(--online-subtle);
  font-weight: 800;
}

.chat-settings-page .chat-settings-tab.active {
  background: var(--online-soft-green);
  color: var(--online-ink);
}

.chat-settings-page .settings-block,
.chat-settings-page .memory-hero,
.chat-settings-page .profile-preview,
.chat-settings-page .manual-summary-card,
.chat-settings-page .memory-records,
.chat-settings-page .profile-section,
.chat-settings-page .local-book-bind,
.chat-settings-page .image-reference-card,
.chat-settings-page .call-simple-card {
  min-width: 0;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 24px;
  background: var(--online-card);
  box-shadow: 0 14px 36px rgba(21, 30, 26, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.chat-settings-page .settings-block,
.chat-settings-page .manual-summary-card,
.chat-settings-page .memory-records,
.chat-settings-page .local-book-bind,
.chat-settings-page .call-simple-card {
  display: grid;
  gap: 14px;
  padding: 14px;
}

.chat-settings-page .section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.chat-settings-page .section-header div,
.chat-settings-page .memory-card-head div,
.chat-settings-page .strategy-copy,
.chat-settings-page .switch-card div,
.chat-settings-page .profile-preview div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.chat-settings-page .section-header span,
.chat-settings-page .memory-card-head span,
.chat-settings-page .strategy-copy span {
  color: var(--online-subtle);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  line-height: 1.2;
  text-transform: uppercase;
}

.chat-settings-page .section-header strong {
  color: var(--online-ink);
  font-size: var(--compact-heading-font-size);
  font-weight: 900;
  line-height: 1.15;
}

.chat-settings-page .memory-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 12px;
  min-height: 118px;
  padding: 18px;
  background:
    radial-gradient(circle at 94% 6%, rgba(6, 199, 85, 0.14), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(247, 249, 248, 0.92));
}

.chat-settings-page .memory-hero strong {
  color: var(--online-ink);
  font-size: 30px;
  font-weight: 900;
  line-height: 1;
}

.chat-settings-page .memory-hero p,
.chat-settings-page .manual-summary-card p,
.chat-settings-page .time-awareness-note,
.chat-settings-page .empty-note,
.chat-settings-page .switch-card span:not(.switch-track),
.chat-settings-page .compact-field small,
.chat-settings-page .upload-card span,
.chat-settings-page .profile-preview span,
.chat-settings-page .character-photo-empty {
  margin: 0;
  color: var(--online-muted);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.55;
}

.chat-settings-page .manual-summary-button,
.chat-settings-page .summary-submit,
.chat-settings-page .primary-setting-action {
  background: var(--online-green);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(6, 199, 85, 0.16);
}

.chat-settings-page .secondary-action,
.chat-settings-page .setting-action-button,
.chat-settings-page .background-thumb-actions button:first-child,
.chat-settings-page .character-photo-actions button,
.chat-settings-page .call-text-button {
  background: var(--online-soft-green);
  color: #1f6b3a;
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.08);
}

.chat-settings-page .danger-action,
.chat-settings-page .background-thumb-actions button:last-child,
.chat-settings-page .character-photo-actions button:last-child,
.chat-settings-page .call-clear-button {
  background: rgba(239, 68, 90, 0.1);
  color: var(--online-danger);
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.08);
}

.chat-settings-page .manual-summary-button,
.chat-settings-page .summary-submit,
.chat-settings-page .setting-action-button,
.chat-settings-page .secondary-action,
.chat-settings-page .danger-action,
.chat-settings-page .background-thumb-actions button,
.chat-settings-page .character-photo-actions button,
.chat-settings-page .call-text-button,
.chat-settings-page .sticker-bind-trigger,
.chat-settings-page .local-book-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 42px;
  padding: 0 12px;
  overflow: hidden;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-settings-page button:disabled,
.chat-settings-page .manual-summary-button:disabled,
.chat-settings-page .summary-submit:disabled,
.chat-settings-page .secondary-action:disabled,
.chat-settings-page .danger-action:disabled {
  background: rgba(239, 242, 240, 0.86);
  color: #a0aaa5;
  box-shadow: none;
  cursor: default;
}

.chat-settings-page .field,
.chat-settings-page .profile-avatar-stack {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.chat-settings-page .field > span,
.chat-settings-page .field-stack span,
.chat-settings-page .batch-head span,
.chat-settings-page .memory-hidden-editor span {
  max-width: 100%;
  overflow: hidden;
  color: #4c5357;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-settings-page .field input,
.chat-settings-page .field textarea,
.chat-settings-page .field select,
.chat-settings-page .memory-card textarea,
.chat-settings-page .memory-hidden-editor input,
.chat-settings-page .character-photo-url-row input,
.chat-settings-page .local-theme-style-field select,
.chat-settings-page .model-select-shell,
.chat-settings-page .sticker-bind-trigger,
.chat-settings-page .switch-card,
.chat-settings-page .compact-field,
.chat-settings-page .upload-card,
.chat-settings-page .time-awareness-note,
.chat-settings-page .empty-note,
.chat-settings-page .merge-picker,
.chat-settings-page .memory-card,
.chat-settings-page .background-url-card,
.chat-settings-page .background-upload-card,
.chat-settings-page .background-color-card,
.chat-settings-page .background-thumb-card,
.chat-settings-page .bubble-preview,
.chat-settings-page .sticker-group-popover,
.chat-settings-page .character-photo-card {
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 16px;
  background: rgba(250, 252, 250, 0.96);
  color: var(--online-ink);
  box-shadow: 0 8px 18px rgba(30, 55, 45, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.chat-settings-page .field input,
.chat-settings-page .field textarea,
.chat-settings-page .field select,
.chat-settings-page .memory-hidden-editor input,
.chat-settings-page .character-photo-url-row input,
.chat-settings-page .local-theme-style-field select {
  width: 100%;
  min-height: 44px;
  padding: 11px 12px;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.4;
}

.chat-settings-page .field textarea,
.chat-settings-page .memory-card textarea {
  min-height: 132px;
  max-width: 100%;
  resize: vertical;
  overflow-wrap: anywhere;
}

.chat-settings-page .field:focus-within input,
.chat-settings-page .field:focus-within textarea,
.chat-settings-page .field:focus-within select,
.chat-settings-page .model-select-shell:focus-within {
  box-shadow: inset 0 0 0 1px rgba(6, 199, 85, 0.35), 0 0 0 3px rgba(6, 199, 85, 0.1);
}

.chat-settings-page .switch-card,
.chat-settings-page .compact-field {
  min-height: 66px;
  padding: 12px;
}

.chat-settings-page .switch-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
}

.chat-settings-page .switch-card strong,
.chat-settings-page .sticker-bind-trigger strong,
.chat-settings-page .upload-card strong,
.chat-settings-page .profile-preview strong,
.chat-settings-page .strategy-copy strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--online-ink);
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-settings-page .switch-card strong,
.chat-settings-page .sticker-bind-trigger strong,
.chat-settings-page .upload-card strong,
.chat-settings-page .strategy-copy strong {
  font-size: 14px;
}

.chat-settings-page .switch-track {
  position: relative;
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  border-radius: 999px;
  background: #dfe8e4;
  box-shadow: inset 0 0 0 1px rgba(31, 107, 58, 0.08);
}

.chat-settings-page .switch-track::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(31, 107, 58, 0.18);
  transition: transform 0.18s ease;
}

.chat-settings-page .switch-card input:checked + .switch-track {
  background: var(--online-green);
  box-shadow: 0 8px 16px rgba(6, 199, 85, 0.18), inset 0 0 0 1px rgba(6, 199, 85, 0.18);
}

.chat-settings-page .switch-card input:checked + .switch-track::after {
  transform: translateX(18px);
}

.chat-settings-page .memory-strategy-stack,
.chat-settings-page .strategy-group,
.chat-settings-page .strategy-control-grid,
.chat-settings-page .background-manager,
.chat-settings-page .background-library,
.chat-settings-page .image-profile-grid,
.chat-settings-page .character-photo-import-panel,
.chat-settings-page .memory-records,
.chat-settings-page .memory-timeline-list {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.chat-settings-page .strategy-group {
  padding: 14px;
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.52);
}

.chat-settings-page .memory-toggle-grid,
.chat-settings-page .range-grid,
.chat-settings-page .color-grid,
.chat-settings-page .manual-summary-actions,
.chat-settings-page .merge-actions,
.chat-settings-page .memory-actions,
.chat-settings-page .background-thumb-actions,
.chat-settings-page .local-theme-style-grid,
.chat-settings-page .profile-avatar-grid,
.chat-settings-page .appearance-tools-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.chat-settings-page .appearance-tools-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chat-settings-page .memory-merge-dashboard {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.chat-settings-page .memory-merge-dashboard span {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 10px;
  border-radius: 14px;
  background: rgba(248, 251, 249, 0.9);
  text-align: center;
}

.chat-settings-page .memory-merge-dashboard strong {
  color: var(--online-ink);
  font-size: 16px;
  font-weight: 900;
}

.chat-settings-page .memory-merge-dashboard small,
.chat-settings-page .record-header em,
.chat-settings-page .memory-card-head em,
.chat-settings-page .timeline-meta em {
  color: var(--online-muted);
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
  line-height: 1.2;
}

.chat-settings-page .timeline-copy,
.chat-settings-page .timeline-summary-event,
.chat-settings-page .timeline-summary-field,
.chat-settings-page .timeline-profile-table-shell,
.chat-settings-page .timeline-graph-card,
.chat-settings-page .timeline-event-details dl {
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
}

.chat-settings-page .timeline-copy,
.chat-settings-page .timeline-summary-event,
.chat-settings-page .timeline-summary-field,
.chat-settings-page .timeline-event-details dl {
  padding: 8px;
}

.chat-settings-page .timeline-card-heading,
.chat-settings-page .timeline-foldout > button {
  width: 100%;
  min-width: 0;
  color: inherit;
}

.chat-settings-page .timeline-card-heading em,
.chat-settings-page .timeline-summary-field span,
.chat-settings-page .timeline-summary-event dt,
.chat-settings-page .timeline-summary-event header span {
  color: #326743;
  font-weight: 950;
}

.chat-settings-page .timeline-card-heading strong,
.chat-settings-page .timeline-summary-heading,
.chat-settings-page .timeline-summary-event header strong,
.chat-settings-page .graph-node text,
.chat-settings-page .timeline-profile-table-shell th {
  color: var(--online-ink);
}

.chat-settings-page .timeline-summary-field p,
.chat-settings-page .timeline-summary-paragraph,
.chat-settings-page .timeline-summary-list,
.chat-settings-page .timeline-summary-event dd,
.chat-settings-page .timeline-profile-table-shell td {
  color: #5f666b;
  overflow-wrap: anywhere;
}

.chat-settings-page .timeline-summary-code {
  max-height: 150px;
  padding: 8px;
  overflow: auto;
  border-radius: 12px;
  background: #202421;
  color: #f7fff9;
}

.chat-settings-page .memory-card {
  position: relative;
  display: grid;
  gap: 12px;
  padding: 14px;
  background: #fffdf9;
}

.chat-settings-page .memory-card-head,
.chat-settings-page .memory-hidden-editor,
.chat-settings-page .character-photo-url-row,
.chat-settings-page .call-button-row,
.chat-settings-page .inline-input-action,
.chat-settings-page .editor-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chat-settings-page .memory-hidden-editor {
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
}

.chat-settings-page .profile-section {
  display: grid;
  grid-template-columns: clamp(82px, 25vw, 104px) minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  padding: 14px;
}

.chat-settings-page .avatar-card,
.chat-settings-page .profile-fields,
.chat-settings-page .identity-row,
.chat-settings-page .local-book-list,
.chat-settings-page .character-photo-library,
.chat-settings-page .character-photo-card,
.chat-settings-page .image-reference-fields {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.chat-settings-page .identity-row,
.chat-settings-page .character-photo-library {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.chat-settings-page .avatar-preview,
.chat-settings-page .profile-preview .avatar,
.chat-settings-page .image-reference-preview,
.chat-settings-page .image-reference-preview img,
.chat-settings-page .character-photo-thumb,
.chat-settings-page .background-thumb {
  overflow: hidden;
  background: #eef3f1;
  object-fit: cover;
}

.chat-settings-page .avatar-preview,
.chat-settings-page .profile-preview .avatar {
  width: 62px;
  height: 62px;
  border-radius: 20px;
}

.chat-settings-page .image-reference-card {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 12px;
}

.chat-settings-page .image-reference-preview,
.chat-settings-page .image-reference-preview img,
.chat-settings-page .image-reference-preview span {
  width: 92px;
  height: 92px;
  border-radius: 16px;
}

.chat-settings-page .background-thumb,
.chat-settings-page .bubble-preview {
  background-position: center;
  background-size: cover;
}

.chat-settings-page .background-thumb-card.active,
.chat-settings-page .local-book-row.selected {
  border-color: rgba(6, 199, 85, 0.32);
  background: #f7fffa;
  color: #146b3f;
  box-shadow: 0 10px 24px rgba(31, 120, 74, 0.09), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.chat-settings-page .preview-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  min-width: 0;
}

.chat-settings-page .user-preview-row {
  justify-content: flex-end;
}

.chat-settings-page .preview-bubble {
  max-width: min(76%, 280px);
  padding: 9px 12px;
  border-radius: 16px;
  overflow-wrap: anywhere;
}

.chat-settings-page .model-select-shell,
.chat-settings-page .provider-model-card {
  display: grid;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.chat-settings-page .model-select-shell {
  grid-template-columns: auto auto minmax(0, 1fr);
  min-height: 50px;
  padding: 6px;
}

.chat-settings-page .model-select-shell img,
.chat-settings-page .provider-model-card img {
  width: 30px;
  height: 30px;
  border-radius: 10px;
  object-fit: cover;
}

.chat-settings-page .audio-preview {
  width: 100%;
  min-width: 0;
}

.chat-settings-page .memory-confirm-card {
  display: grid;
  gap: 10px;
  padding: 16px;
  border-radius: 20px;
  background: var(--online-card-strong);
  color: var(--online-ink);
}

.chat-settings-page .memory-confirm-actions,
.modal-panel .memory-confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.modal-panel .memory-confirm-card {
  color: var(--online-ink, #111111);
}

.sticker-keyboard-layer .sticker-keyboard-dismiss {
  background: transparent;
}

.sticker-keyboard-layer .sticker-keyboard-panel {
  border-top: 1px solid var(--online-line);
  background: linear-gradient(180deg, rgba(255, 252, 253, 0.98), rgba(247, 249, 252, 0.98));
  box-shadow: 0 -10px 36px rgba(39, 35, 43, 0.12);
}

.sticker-keyboard-layer .sticker-sheet,
.sticker-keyboard-layer .sticker-sheet-modal {
  color: #211f22;
}

.sticker-keyboard-layer .sticker-head,
.sticker-keyboard-layer .editor-head,
.sticker-keyboard-layer .group-editor,
.sticker-keyboard-layer .head-actions,
.sticker-keyboard-layer .batch-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.sticker-keyboard-layer .sticker-head,
.sticker-keyboard-layer .editor-head,
.sticker-keyboard-layer .batch-head {
  justify-content: space-between;
}

.sticker-keyboard-layer .sticker-head strong {
  color: #8c848c;
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
}

.sticker-keyboard-layer .head-search-row,
.sticker-keyboard-layer .search-row,
.sticker-keyboard-layer .group-editor,
.sticker-keyboard-layer .import-row,
.sticker-keyboard-layer .editor-fields,
.sticker-keyboard-layer .editor-actions,
.sticker-keyboard-layer .manage-bar,
.sticker-keyboard-layer .manage-panel,
.sticker-keyboard-layer .sticker-editor,
.sticker-keyboard-layer .empty-stickers,
.sticker-keyboard-layer .sticker-grid,
.sticker-keyboard-layer .group-tabs {
  display: grid;
  min-width: 0;
}

.sticker-keyboard-layer .head-search-row,
.sticker-keyboard-layer .search-row {
  grid-template-columns: 20px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 4px;
  min-height: 30px;
  padding: 0 3px 0 8px;
  border-radius: 10px;
  background: rgba(244, 245, 247, 0.96);
}

.sticker-keyboard-layer .group-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
}

.sticker-keyboard-layer .group-pill,
.sticker-keyboard-layer .manage-choice,
.sticker-keyboard-layer .text-action,
.sticker-keyboard-layer .link-action,
.sticker-keyboard-layer .close-button,
.sticker-keyboard-layer .head-icon,
.sticker-keyboard-layer .icon-action,
.sticker-keyboard-layer .mini-action,
.sticker-keyboard-layer .save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  border-radius: 12px;
  font-weight: 900;
}

.sticker-keyboard-layer .close-button,
.sticker-keyboard-layer .head-icon,
.sticker-keyboard-layer .icon-action {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  color: #211f22;
}

.sticker-keyboard-layer .group-pill {
  flex: 0 0 auto;
  gap: 6px;
  max-width: min(160px, 48vw);
  min-height: 26px;
  padding: 0 11px;
  background: rgba(255, 255, 255, 0.72);
  color: #68616b;
  line-height: 1;
  white-space: nowrap;
}

.sticker-keyboard-layer .group-pill.active,
.sticker-keyboard-layer .head-icon.active,
.sticker-keyboard-layer .manage-choice.active {
  background: #111111;
  color: #ffffff;
}

.sticker-keyboard-layer .group-pill span,
.sticker-keyboard-layer .manage-choice span,
.sticker-keyboard-layer .manage-choice small,
.sticker-keyboard-layer .sticker-tile > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sticker-keyboard-layer .group-pill small {
  display: none;
}

.sticker-keyboard-layer .tool-popover,
.sticker-keyboard-layer .manage-bar,
.sticker-keyboard-layer .manage-panel,
.sticker-keyboard-layer .sticker-editor,
.sticker-keyboard-layer .empty-stickers,
.sticker-keyboard-layer .sticker-tile {
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.78);
}

.sticker-keyboard-layer .tool-popover,
.sticker-keyboard-layer .sticker-editor {
  border-radius: 14px;
  box-shadow: 0 14px 36px rgba(37, 34, 40, 0.14);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.sticker-keyboard-layer .manage-bar,
.sticker-keyboard-layer .manage-panel,
.sticker-keyboard-layer .sticker-editor,
.sticker-keyboard-layer .empty-stickers {
  gap: 8px;
  padding: 8px;
  border-radius: 16px;
}

.sticker-keyboard-layer .manage-choice-row,
.sticker-keyboard-layer .group-action-grid,
.sticker-keyboard-layer .batch-action-row,
.sticker-keyboard-layer .editor-actions {
  display: grid;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.sticker-keyboard-layer .manage-choice-row,
.sticker-keyboard-layer .group-action-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sticker-keyboard-layer .batch-action-row {
  grid-template-columns: minmax(0, 1fr) auto auto;
}

.sticker-keyboard-layer .manage-choice,
.sticker-keyboard-layer .text-action,
.sticker-keyboard-layer .link-action {
  min-height: 32px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.86);
  color: #211f22;
  font-size: 11px;
  white-space: nowrap;
}

.sticker-keyboard-layer .manage-choice {
  display: grid;
  justify-items: start;
  gap: 3px;
  min-height: 50px;
  padding: 8px 10px;
  text-align: left;
}

.sticker-keyboard-layer .text-action.danger,
.sticker-keyboard-layer .icon-action.danger {
  color: var(--online-danger);
}

.sticker-keyboard-layer input,
.sticker-keyboard-layer textarea,
.sticker-keyboard-layer select {
  min-width: 0;
  min-height: 28px;
  border: 0;
  border-radius: 9px;
  background: rgba(244, 245, 247, 0.96);
  color: #211f22;
  font: inherit;
  font-size: 11px;
  font-weight: 800;
  outline: none;
  padding: 5px 8px;
}

.sticker-keyboard-layer textarea {
  min-height: 32px;
  resize: vertical;
}

.sticker-keyboard-layer .sticker-grid {
  flex: 1 1 auto;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  align-items: start;
  gap: 6px;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-right: 2px;
  -webkit-overflow-scrolling: touch;
}

.sticker-keyboard-layer .sticker-tile {
  position: relative;
  display: grid;
  align-content: start;
  gap: 5px;
  min-width: 0;
  padding: 6px;
  border-radius: 13px;
  text-align: left;
}

.sticker-keyboard-layer .sticker-tile.selected,
.sticker-keyboard-layer .sticker-tile.checked {
  border-color: rgba(17, 17, 17, 0.14);
  box-shadow: 0 10px 24px rgba(17, 17, 17, 0.08);
}

.sticker-keyboard-layer .sticker-tile img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  object-fit: contain;
  background: transparent;
}

.sticker-keyboard-layer .sticker-tile > span {
  display: -webkit-box;
  min-height: 30px;
  color: #39343a;
  font-size: 8px;
  font-weight: 700;
  line-height: 1.25;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.sticker-keyboard-layer .tile-check {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
}

.sticker-keyboard-layer .tile-check span {
  display: block;
  width: 18px;
  height: 18px;
  border: 1.5px solid rgba(17, 17, 17, 0.2);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.92);
}

.sticker-keyboard-layer .tile-check input:checked + span {
  border-color: #111111;
  background: #111111;
}

.sticker-keyboard-layer .empty-stickers {
  place-items: center;
  min-height: 0;
  color: #8e8890;
}

.sticker-keyboard-layer .empty-stickers strong {
  color: #4f4850;
  font-size: 18px;
}

.sticker-keyboard-layer button:disabled,
.sticker-keyboard-layer .sticker-tile:disabled,
.sticker-keyboard-layer .text-action:disabled,
.sticker-keyboard-layer .link-action:disabled,
.sticker-keyboard-layer .icon-action:disabled {
  opacity: 0.42;
  cursor: default;
}

@media (max-width: 380px) {
  .chat-settings-page .settings-block,
  .chat-settings-page .manual-summary-card,
  .chat-settings-page .memory-records {
    padding: 12px;
    border-radius: 22px;
  }

  .chat-settings-page .memory-hero {
    padding: 16px;
  }

  .chat-settings-page .switch-card,
  .chat-settings-page .compact-field {
    min-height: 62px;
    padding: 10px;
  }
}

@media (max-width: 340px) {
  .chat-settings-page .memory-hero,
  .chat-settings-page .inline-input-action,
  .chat-settings-page .profile-preview,
  .chat-settings-page .profile-section,
  .chat-settings-page .image-reference-card {
    grid-template-columns: 1fr;
  }

  .chat-settings-page .memory-toggle-grid,
  .chat-settings-page .strategy-control-grid,
  .chat-settings-page .range-grid,
  .chat-settings-page .color-grid,
  .chat-settings-page .manual-summary-actions,
  .chat-settings-page .merge-actions,
  .chat-settings-page .memory-actions,
  .chat-settings-page .background-thumb-actions,
  .chat-settings-page .local-theme-style-grid,
  .chat-settings-page .profile-avatar-grid,
  .chat-settings-page .appearance-tools-grid,
  .chat-settings-page .identity-row,
  .chat-settings-page .character-photo-library,
  .sticker-keyboard-layer .manage-choice-row,
  .sticker-keyboard-layer .group-action-grid,
  .sticker-keyboard-layer .batch-action-row {
    grid-template-columns: 1fr;
  }

  .chat-settings-page .manual-summary-button,
  .chat-settings-page .setting-action-button {
    width: 100%;
  }
}
`;

export const defaultOfflineThemeCss = `/* LINK 线下页默认完整样式。
  复制后可自由修改；建议所有选择器都保留 .offline-room 前缀，避免影响其他页面。

  小白改法：
  1. 想改整页底色，搜 .offline-room，改 background。
  2. 想改顶部栏，搜 .offline-topbar；顶部图标按钮搜 .offline-icon-button。
  3. 想改用户与角色的黑灰，改 --offline-user-accent、--offline-user-mark、--offline-character-accent、--offline-character-mark。
  4. 想改剧情选项，搜 .plot-choice-panel 和 .plot-choice-list button。
  5. 想改底部输入栏，搜 .offline-composer；输入文字框搜 .offline-composer textarea；发送按钮搜 .send-button。
  6. 常用属性：background 改背景，color 改文字，border-radius 改圆角，padding 改内边距，box-shadow 改阴影。 */
.offline-room {
  --offline-ink: #272727;
  --offline-muted: #999999;
  --offline-line: #dedede;
  --offline-user-accent: #202020;
  --offline-user-mark: #242424;
  --offline-character-accent: #dfdfdd;
  --offline-character-mark: #969694;
  color: var(--offline-ink);
  background: #fbfbfa;
}

.offline-room .offline-topbar {
  position: relative;
  inset: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: calc(56px + var(--safe-top));
  padding: calc(10px + var(--safe-top)) calc(12px + var(--safe-right)) 10px calc(12px + var(--safe-left));
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  backdrop-filter: none;
}

.offline-room .offline-topbar-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.offline-room .offline-topbar-actions--right {
  justify-content: flex-end;
}

.offline-room .offline-icon-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #333333;
  box-shadow: none;
}

.offline-room .offline-title-block {
  display: none;
}

.offline-room .offline-scroll {
  padding: 26px calc(18px + var(--safe-right)) calc(30px + var(--keyboard-inset)) calc(18px + var(--safe-left));
  background: #fbfbfa;
  scroll-padding-bottom: calc(138px + var(--keyboard-inset));
}

.offline-room .chapter-stream {
  display: grid;
  gap: 0;
  max-width: 680px;
  margin: 0 auto;
}

.offline-room .chapter-entry {
  display: grid;
  position: relative;
  gap: 14px;
  overflow: visible;
  margin: 34px 0;
  padding: 8px 18px 28px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.offline-room .chapter-entry--user {
  margin-right: 24px;
  border-left: 3px solid var(--offline-user-accent);
}

.offline-room .chapter-entry--char {
  border-right: 3px solid var(--offline-character-accent);
}

.offline-room .chapter-speaker-mark {
  color: var(--offline-character-mark) !important;
}

.offline-room .chapter-entry--user .chapter-speaker-mark {
  color: var(--offline-user-mark) !important;
}

.offline-room .chapter-entry--hidden {
  border-color: #bdbdbb;
  background: linear-gradient(90deg, rgba(241, 241, 239, 0.5), transparent);
}

.offline-room .chapter-entry-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  color: #a0a09e;
  font-size: 9px;
  font-weight: 400;
  letter-spacing: 0.12em;
  line-height: 1.1;
}

.offline-room .chapter-speaker-mark {
  min-width: 27px;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 23px !important;
  font-weight: 700 !important;
  letter-spacing: -0.08em;
  line-height: 1;
}

.offline-room .chapter-floor-label i {
  display: none;
}

.offline-room .chapter-floor-label b {
  color: #777775;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 9px;
  font-weight: 400;
}

.offline-room .chapter-entry-tools,
.offline-room .reply-variant-switcher,
.offline-room .floor-edit-actions,
.offline-room .floor-jump-actions,
.offline-room .regenerate-prompt-actions,
.offline-room .delete-confirm-actions {
  display: grid;
  gap: 8px;
}

.offline-room .chapter-entry-tools {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.offline-room .chapter-entry-tools time {
  color: #aaaaa8;
  font-family: Georgia, 'Times New Roman', serif;
}

.offline-room .chapter-entry-tools button {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #777775;
}

.offline-room .chapter-entry p,
.offline-room .chapter-entry-body {
  margin: 0;
  color: #3d3d3b;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.045em;
  line-height: 2;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.offline-room .chapter-entry-html :where(p, ul, ol, blockquote, pre, details, h1, h2, h3, h4, h5, h6, hr) {
  margin: 0 0 0.62em;
}

.offline-room .chapter-entry-html > :last-child {
  margin-bottom: 0;
}

.offline-room .chapter-entry-html :where(summary) {
  cursor: pointer;
  font-weight: 900;
}

.offline-room .chapter-entry-html :where(ul, ol) {
  padding-left: 1.35em;
}

.offline-room .chapter-entry-html :where(pre, code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.offline-room .chapter-entry-html :where(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.offline-room .chapter-entry-html :where(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.offline-room .chapter-entry--user p,
.offline-room .chapter-entry--user .chapter-entry-body {
  color: #666664;
  font-weight: 400;
}

.offline-room .inner-voice-segment {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #8a8a88;
  font-style: italic;
  font-weight: 400;
  text-decoration: underline;
  text-decoration-color: #dadad8;
  text-underline-offset: 0.22em;
}

.offline-room .dialogue-segment {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #262626;
  font-weight: 600;
  box-shadow: inset 0 -0.42em 0 #efefed;
}

.offline-room .plot-choice-panel,
.offline-room .floor-edit-panel,
.offline-room .typing-card {
  border: 1px solid #d8d8d6;
  border-radius: 0;
  background: transparent;
}

.offline-room .plot-choice-panel,
.offline-room .floor-edit-panel {
  display: grid;
  gap: 0;
  padding: 0;
}

.offline-room .plot-choice-toggle,
.offline-room .plot-choice-list button,
.offline-room .floor-edit-actions button {
  min-height: 40px;
  border-radius: 0;
  background: transparent;
  color: #6f6f6d;
  font-size: 10px;
  font-weight: 400;
}

.offline-room .floor-edit-panel textarea,
.offline-room .regenerate-prompt-sheet textarea,
.offline-room .floor-jump-sheet input {
  border: 0;
  border-top: 1px solid #d5d5d3;
  border-bottom: 1px solid #d5d5d3;
  border-radius: 0;
  background: transparent;
  color: #333331;
}

.offline-room .offline-empty {
  display: grid;
  place-items: center;
  gap: 13px;
  min-height: 46vh;
  padding: 60px 20px;
  border-bottom: 1px solid #dededc;
  color: #999997;
  text-align: center;
}

.offline-room .offline-empty strong {
  color: #3d3d3b;
  font-size: 16px;
  font-weight: 500;
}

.offline-room .offline-empty span {
  font-size: 12px;
  line-height: 1.45;
}

.offline-room .typing-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 76px;
  padding: 16px;
  border-right: 0;
  border-left: 0;
  color: #797977;
  box-shadow: none;
}

.offline-room .offline-dock {
  display: grid;
  gap: 7px;
  padding: 8px calc(12px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 0;
  background: rgba(251, 251, 250, 0.96);
  backdrop-filter: blur(14px);
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
}

.offline-room .offline-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 8px;
}

.offline-room .offline-primary-tools,
.offline-room .offline-floor-tools {
  display: grid;
  gap: 0;
  min-width: 0;
  border: 1px solid #d9d9d7;
}

.offline-room .offline-primary-tools {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.offline-room .offline-floor-tools {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.offline-room .tool-button,
.offline-room .icon-tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 36px;
  padding: 0 3px;
  border: 0;
  border-right: 1px solid #dfdfdd;
  border-radius: 0;
  background: transparent;
  color: #686866;
  font-size: 9px;
  font-weight: 400;
  white-space: nowrap;
}

.offline-room .tool-button.active,
.offline-room .icon-tool-button.active {
  border-color: #292929;
  background: #292929;
  color: #ffffff;
}

.offline-room .tool-button--danger.active {
  border-color: #292929;
  background: #292929;
}

.offline-room .tool-button:disabled,
.offline-room .icon-tool-button:disabled {
  opacity: 0.28;
}

.offline-room .offline-composer {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 42px;
  align-items: end;
  gap: 0;
  padding: 0;
  border: 1px solid #d8d8d6;
  border-radius: 0;
  background: #ffffff;
}

.offline-room .offline-composer-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 42px;
  padding: 0;
  border: 0;
  border-right: 1px solid #e1e1df;
  border-radius: 0;
  background: transparent;
  color: #b1b1af;
}

.offline-room .offline-composer-mark.active {
  background: #292929;
  color: #ffffff;
}

.offline-room .offline-composer textarea {
  min-height: 42px;
  max-height: 120px;
  resize: none;
  padding: 11px 12px 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #383836;
  font-size: 14px;
  line-height: 1.5;
}

.offline-room .offline-composer textarea::placeholder {
  color: #aaa9a7;
}

.offline-room .send-button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border: 0;
  border-radius: 0;
  background: #292929;
  color: #ffffff;
  box-shadow: none;
}

.offline-room .send-button:disabled {
  background: #f0f0ee;
  box-shadow: none;
}

.offline-room .floor-jump-sheet,
.offline-room .regenerate-prompt-sheet,
.offline-room .delete-confirm-sheet {
  width: min(100%, 520px);
  padding: 30px calc(22px + var(--safe-right)) calc(22px + var(--safe-bottom)) calc(22px + var(--safe-left));
  border: 0;
  border-top: 1px solid #cfcfcd;
  border-radius: 0;
  background: #fbfbfa;
  box-shadow: 0 -18px 48px rgba(0, 0, 0, 0.08);
}

@media (max-width: 520px) {
  .offline-room .offline-toolbar {
    grid-template-columns: repeat(3, minmax(50px, 1.35fr)) repeat(5, minmax(26px, 1fr));
    gap: 0;
    border: 1px solid #d9d9d7;
  }

  .offline-room .offline-primary-tools,
  .offline-room .offline-floor-tools {
    display: contents;
  }
}
`;

interface ThemeExportPayload {
  magic: string;
  version: 1 | 2;
  exportedAt: number;
  scope?: ThemeStyleExportScope;
  presets: ThemeStylePreset[];
}

interface ThemeStylePngExportOptions {
  scope?: ThemeStyleExportScope;
  coverImageDataUrl?: string | null;
}

interface DecodedThemeStylePngPayload {
  scope: ThemeStyleExportScope | null;
  presets: ThemeStylePreset[];
}

function normalizePresetForExport(preset: ThemeStylePreset): ThemeStylePreset {
  return {
    id: preset.id,
    name: preset.name,
    css: preset.css,
    source: preset.source,
    createdAt: preset.createdAt,
    updatedAt: preset.updatedAt
  };
}

function createThemeStyleExportJson(presets: ThemeStylePreset[], options: ThemeStylePngExportOptions = {}) {
  return JSON.stringify({
    magic: exportMagic,
    version: 2,
    exportedAt: Date.now(),
    scope: options.scope,
    presets: presets.map(normalizePresetForExport)
  } satisfies ThemeExportPayload);
}

export function createOnlineThemeExportPayload(presets: ThemeStylePreset[]) {
  return createThemeStyleExportJson(presets, { scope: 'online' });
}

export const createThemeStyleExportPayload = createOnlineThemeExportPayload;

function createPayloadBytes(json: string) {
  const encoded = new TextEncoder().encode(json);
  const payload = new Uint8Array(4 + encoded.length);
  const view = new DataView(payload.buffer);
  view.setUint32(0, encoded.length, false);
  payload.set(encoded, 4);
  return payload;
}

function getCanvasContext(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('当前浏览器无法创建 PNG 画布。');
  return { canvas, context };
}

function createRoundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const resolvedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, resolvedRadius);
  context.arcTo(x + width, y + height, x, y + height, resolvedRadius);
  context.arcTo(x, y + height, x, y, resolvedRadius);
  context.arcTo(x, y, x + width, y, resolvedRadius);
  context.closePath();
}

function drawImageCover(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
}

function drawPosterBackground(
  context: CanvasRenderingContext2D,
  scope: ThemeStyleExportScope,
  coverImage: HTMLImageElement | null
) {
  const width = exportPosterWidth;
  const height = exportPosterHeight;

  if (coverImage) {
    drawImageCover(context, coverImage, width, height);
    const overlay = context.createLinearGradient(0, 0, 0, height);
    overlay.addColorStop(0, 'rgba(10, 14, 18, 0.12)');
    overlay.addColorStop(0.46, 'rgba(10, 14, 18, 0.24)');
    overlay.addColorStop(1, 'rgba(10, 14, 18, 0.72)');
    context.fillStyle = overlay;
    context.fillRect(0, 0, width, height);
    return;
  }

  const background = context.createLinearGradient(0, 0, width, height);
  if (scope === 'offline') {
    background.addColorStop(0, '#fbfbfa');
    background.addColorStop(0.45, '#eeeeec');
    background.addColorStop(1, '#d7d7d4');
  } else if (scope === 'global') {
    background.addColorStop(0, '#f8eff2');
    background.addColorStop(0.45, '#eff8f3');
    background.addColorStop(1, '#edf5ff');
  } else {
    background.addColorStop(0, '#eef8f0');
    background.addColorStop(0.38, '#f4fbf5');
    background.addColorStop(1, '#eff7f1');
  }
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = scope === 'offline' ? 'rgba(32, 32, 32, 0.12)' : scope === 'global' ? 'rgba(221, 168, 190, 0.17)' : 'rgba(108, 219, 146, 0.2)';
  context.beginPath();
  context.arc(width * 0.18, height * 0.14, width * 0.22, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = scope === 'offline' ? 'rgba(255, 255, 255, 0.3)' : scope === 'global' ? 'rgba(164, 222, 195, 0.2)' : 'rgba(191, 242, 214, 0.22)';
  context.beginPath();
  context.arc(width * 0.84, height * 0.1, width * 0.18, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(255, 255, 255, 0.42)';
  context.fillRect(0, height * 0.58, width, height * 0.42);
}

function drawPosterText(
  context: CanvasRenderingContext2D,
  presets: ThemeStylePreset[],
  scope: ThemeStyleExportScope,
  hasCoverImage: boolean
) {
  const cardX = 76;
  const cardY = 118;
  const cardWidth = exportPosterWidth - 152;
  const cardHeight = exportPosterHeight - 236;
  createRoundedRectPath(context, cardX, cardY, cardWidth, cardHeight, 42);
  context.fillStyle = hasCoverImage ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.76)';
  context.fill();
  context.strokeStyle = hasCoverImage ? 'rgba(255, 255, 255, 0.32)' : 'rgba(255, 255, 255, 0.92)';
  context.lineWidth = 2;
  context.stroke();

  const accent = scope === 'offline' ? '#292929' : scope === 'global' ? '#7c5b75' : '#0a8a44';
  const secondary = hasCoverImage ? 'rgba(255, 255, 255, 0.82)' : '#5f6771';
  const primary = hasCoverImage ? '#ffffff' : '#111111';
  const body = hasCoverImage ? 'rgba(255, 255, 255, 0.92)' : '#2a3139';
  const names = presets.slice(0, 4).map((entry) => entry.name.trim() || '未命名样式');

  context.fillStyle = accent;
  context.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('LINK THEME SHARE', cardX + 56, cardY + 84);

  context.fillStyle = primary;
  context.font = '900 74px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(scope === 'offline' ? '线下样式' : scope === 'global' ? '全站样式' : '线上样式', cardX + 56, cardY + 182);

  context.fillStyle = secondary;
  context.font = '600 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(`导出 ${presets.length} 个自定义预设`, cardX + 56, cardY + 236);

  context.fillStyle = body;
  context.font = '500 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('导入方式：在 LINK 主题页选择 PNG 导入。', cardX + 56, cardY + 310);

  const chipTop = cardY + 366;
  names.forEach((name, index) => {
    const chipY = chipTop + index * 110;
    createRoundedRectPath(context, cardX + 48, chipY, cardWidth - 96, 78, 24);
    context.fillStyle = hasCoverImage ? 'rgba(12, 16, 22, 0.2)' : 'rgba(255, 255, 255, 0.84)';
    context.fill();
    context.strokeStyle = hasCoverImage ? 'rgba(255, 255, 255, 0.14)' : 'rgba(17, 17, 17, 0.05)';
    context.stroke();

    context.fillStyle = primary;
    context.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(name, cardX + 80, chipY + 50, cardWidth - 160);
  });

  if (presets.length > names.length) {
    context.fillStyle = secondary;
    context.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(`还有 ${presets.length - names.length} 个预设包含在图片里`, cardX + 56, cardY + cardHeight - 96);
  }
}

function createPosterCanvas(
  presets: ThemeStylePreset[],
  options: ThemeStylePngExportOptions,
  coverImage: HTMLImageElement | null
) {
  const { canvas, context } = getCanvasContext(exportPosterWidth, exportPosterHeight);
  const scope = options.scope === 'offline' || options.scope === 'global' ? options.scope : 'online';
  drawPosterBackground(context, scope, coverImage);
  drawPosterText(context, presets, scope, Boolean(coverImage));
  return { canvas, context };
}

function embedPayloadIntoImageData(data: Uint8ClampedArray, payload: Uint8Array) {
  const capacityBits = (data.length / 4) * pngChannelCount;
  const requiredBits = payload.length * 8;
  if (requiredBits > capacityBits) {
    throw new Error('选择的封面图可写入空间不足，请改用更大的图片后重试。');
  }

  let bitIndex = 0;
  for (let index = 0; index < data.length && bitIndex < requiredBits; index += 4) {
    for (let channel = 0; channel < pngChannelCount && bitIndex < requiredBits; channel += 1) {
      const byte = payload[bitIndex >> 3] ?? 0;
      const bit = (byte >> (7 - (bitIndex % 8))) & 1;
      data[index + channel] = (data[index + channel] & 0xfe) | bit;
      bitIndex += 1;
    }
  }
}

function createLegacyPayloadCanvas(payload: Uint8Array) {
  const pixelCount = Math.ceil(payload.length / pngChannelCount);
  const width = pngPayloadWidth;
  const height = Math.max(1, Math.ceil(pixelCount / width));
  const { canvas, context } = getCanvasContext(width, height);
  const imageData = context.createImageData(width, height);

  for (let index = 0; index < imageData.data.length; index += 4) {
    const byteIndex = (index / 4) * pngChannelCount;
    imageData.data[index] = payload[byteIndex] ?? 255;
    imageData.data[index + 1] = payload[byteIndex + 1] ?? 255;
    imageData.data[index + 2] = payload[byteIndex + 2] ?? 255;
    imageData.data[index + 3] = 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas;
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('PNG 样式图片读取失败。')), { once: true });
    image.src = dataUrl;
  });
}

async function loadCoverImage(dataUrl: string | null | undefined) {
  if (!dataUrl) return null;
  return loadImageFromDataUrl(dataUrl);
}

export async function encodeOnlineThemePresetsToPng(
  presets: ThemeStylePreset[],
  options: ThemeStylePngExportOptions = {}
) {
  const payload = createPayloadBytes(createThemeStyleExportJson(presets, options));
  const coverImage = await loadCoverImage(options.coverImageDataUrl);

  if (!coverImage && !options.coverImageDataUrl) {
    const { canvas, context } = createPosterCanvas(presets, options, null);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    embedPayloadIntoImageData(imageData.data, payload);
    context.putImageData(imageData, 0, 0);
    return canvas.toDataURL('image/png');
  }

  if (!coverImage) {
    const legacyCanvas = createLegacyPayloadCanvas(payload);
    return legacyCanvas.toDataURL('image/png');
  }

  const { canvas, context } = createPosterCanvas(presets, options, coverImage);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  embedPayloadIntoImageData(imageData.data, payload);
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export const encodeThemeStylePresetsToPng = encodeOnlineThemePresetsToPng;

function parseThemeExportPayload(payloadBytes: Uint8Array): DecodedThemeStylePngPayload {
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<ThemeExportPayload>;
  const scope = payload.scope === 'global' || payload.scope === 'offline' || payload.scope === 'online' ? payload.scope : null;
  const validMagic = payload.magic === exportMagic || payload.magic === legacyExportMagic;
  const validVersion = payload.version === 1 || payload.version === 2;
  if (!validMagic || !validVersion || !Array.isArray(payload.presets)) {
    throw new Error('这张 PNG 不是 LINK 样式预设。');
  }
  return {
    scope,
    presets: payload.presets
  };
}

function decodePayloadBytesFromLsb(data: Uint8ClampedArray) {
  const totalBytes = Math.floor(((data.length / 4) * pngChannelCount) / 8);
  if (totalBytes < 4) throw new Error('这张 PNG 不包含 LINK 样式数据。');

  const bytes = new Uint8Array(totalBytes);
  let byteIndex = 0;
  let bitOffset = 0;
  let currentByte = 0;

  for (let index = 0; index < data.length && byteIndex < totalBytes; index += 4) {
    for (let channel = 0; channel < pngChannelCount && byteIndex < totalBytes; channel += 1) {
      currentByte = (currentByte << 1) | (data[index + channel] & 1);
      bitOffset += 1;
      if (bitOffset === 8) {
        bytes[byteIndex] = currentByte;
        byteIndex += 1;
        bitOffset = 0;
        currentByte = 0;
      }
    }
  }

  const length = new DataView(bytes.buffer, 0, 4).getUint32(0, false);
  if (!Number.isFinite(length) || length <= 0 || length > bytes.length - 4) {
    throw new Error('这张 PNG 的样式数据不完整。');
  }
  return bytes.slice(4, 4 + length);
}

function decodePayloadBytesFromRawRgb(data: Uint8ClampedArray) {
  const bytes: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    bytes.push(data[index], data[index + 1], data[index + 2]);
  }

  if (bytes.length < 4) throw new Error('这张 PNG 不包含 LINK 样式数据。');
  const lengthView = new DataView(new Uint8Array(bytes.slice(0, 4)).buffer);
  const length = lengthView.getUint32(0, false);
  if (!Number.isFinite(length) || length <= 0 || length > bytes.length - 4) {
    throw new Error('这张 PNG 的样式数据不完整。');
  }
  return new Uint8Array(bytes.slice(4, 4 + length));
}

export async function decodeOnlineThemePresetsFromPng(dataUrl: string) {
  const image = await loadImageFromDataUrl(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const { context } = getCanvasContext(width, height);
  context.drawImage(image, 0, 0);
  const { data } = context.getImageData(0, 0, width, height);

  try {
    return parseThemeExportPayload(decodePayloadBytesFromLsb(data));
  } catch {
    return parseThemeExportPayload(decodePayloadBytesFromRawRgb(data));
  }
}

export const decodeThemeStylePresetsFromPng = decodeOnlineThemePresetsFromPng;