<template>
  <MobileShell />
  <GlobalVoomNotice />
  <GlobalSmallTheaterNotice />
  <FirstRunDisclaimer v-if="showDisclaimer" :model-value="showDisclaimer" @complete="handleDisclaimerComplete" />
  <AppModal :model-value="store.configAlert.open" :title="store.configAlert.title" @update:model-value="setConfigAlertOpen">
    <section class="config-alert">
      <p>{{ store.configAlert.message }}</p>
      <button v-if="store.configAlert.action" type="button" :disabled="configAlertActionRunning" @click="runConfigAlertAction">
        {{ configAlertActionRunning ? (store.configAlert.action.runningLabel || '处理中…') : store.configAlert.action.label }}
      </button>
    </section>
  </AppModal>
  <audio ref="musicAudioRef" class="global-music-audio" preload="metadata"></audio>
  <section
    v-if="showGlobalCallFloating"
    class="global-call-floating"
    :class="`global-call-floating--${globalCall?.mode ?? 'voice'}`"
    :style="globalCallFloatingStyle"
    role="button"
    tabindex="0"
    aria-label="返回通话"
    @click="openGlobalCallFloating"
    @keydown.enter.prevent="openGlobalCallFloating"
    @keydown.space.prevent="openGlobalCallFloating"
    @pointercancel="endGlobalCallFloatDrag"
    @pointerdown="startGlobalCallFloatDrag"
    @pointermove="moveGlobalCallFloat"
    @pointerup="endGlobalCallFloatDrag"
  >
    <span class="global-call-floating-avatar" aria-hidden="true">
      <img v-if="globalCall?.avatar" :src="globalCall.avatar" alt="" draggable="false" />
    </span>
    <span class="global-call-floating-copy">
      <strong>{{ globalCall?.peerName || '通话中' }}</strong>
      <small>{{ globalCallSubtitle }}</small>
    </span>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MobileShell from '@/components/layout/MobileShell.vue';
import AppModal from '@/components/common/AppModal.vue';
import FirstRunDisclaimer from '@/components/common/FirstRunDisclaimer.vue';
import GlobalSmallTheaterNotice from '@/components/common/GlobalSmallTheaterNotice.vue';
import GlobalVoomNotice from '@/components/common/GlobalVoomNotice.vue';
import { startAccessHeartbeat } from '@/services/access';
import { uploadEncryptedWebDavBackup } from '@/services/webDavBackup';
import { syncKeepAlive } from '@/services/keepAlive';
import { setFullscreenEnabled } from '@/services/systemBars';
import { useAppStore } from '@/stores/appStore';
import { useMusicPlayerStore } from '@/stores/musicPlayerStore';
import type { ThemeFontEntry, ThemeStylePreset, ThemeStyleScopeSettings } from '@/types/domain';
import { defaultGlobalThemeCss, defaultGlobalThemePresetId, defaultOfflineThemeCss, defaultOfflineThemePresetId, defaultOnlineThemeCss, defaultOnlineThemePresetId } from '@/utils/themeStyles';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const musicPlayer = useMusicPlayerStore();
const musicAudioRef = ref<HTMLAudioElement | null>(null);
const configAlertActionRunning = ref(false);
let githubAutoBackupTimer: number | undefined;
let webDavAutoBackupTimer: number | undefined;
let webDavAutoBackupRunning = false;
let proactiveGroupTimer: number | undefined;
let stopAccessHeartbeat: (() => void) | undefined;
let globalCallFloatDrag: { pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null = null;
let suppressGlobalCallFloatClick = false;
const themeFontStyleId = 'link-theme-fonts';
const globalThemeStyleId = 'link-global-theme-styles';
const onlineThemeStyleId = 'link-online-theme-styles';
const offlineThemeStyleId = 'link-offline-theme-styles';
const systemFontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';

const showDisclaimer = computed(() => store.ready && !store.settings?.disclaimerAccepted);
const githubBackupScheduleKey = computed(() => {
  const backup = store.settings?.githubBackup;
  if (!store.ready || !backup?.enabled || !backup.token || !backup.owner || !backup.repo) return '';
  return [backup.owner, backup.repo, backup.branch, backup.path, backup.intervalMinutes].join('|');
});
const webDavBackupScheduleKey = computed(() => {
  const backup = store.settings?.webDavBackup;
  if (!store.ready || !backup?.enabled || !backup.url || !backup.username || !backup.password || !backup.recoveryKey) return '';
  return [backup.url, backup.username, backup.path, backup.intervalMinutes].join('|');
});
const themeFontSettings = computed(() => store.settings?.themeSettings.fonts ?? { activeFontId: '', entries: [] as ThemeFontEntry[] });
const globalThemeSettings = computed(() => store.settings?.themeSettings.global ?? { scale: 1, fullscreen: false, style: { activePresetId: '', presets: [] } });
const globalThemeStyleSettings = computed(() => globalThemeSettings.value.style ?? { activePresetId: '', presets: [] });
const onlineThemeSettings = computed(() => store.settings?.themeSettings.online ?? { activePresetId: '', presets: [] });
const offlineThemeSettings = computed(() => store.settings?.themeSettings.offline ?? { activePresetId: '', presets: [] });
const routeConversationId = computed(() => {
  if (!['chat-room', 'gobang-room', 'offline-room'].includes(String(route.name ?? ''))) return '';
  const rawId = route.params.id;
  return Array.isArray(rawId) ? String(rawId[0] ?? '') : String(rawId ?? '');
});
const routeCharacter = computed(() => {
  const conversation = routeConversationId.value ? store.conversationById(routeConversationId.value) : null;
  return conversation ? store.characterById(conversation.charId) : null;
});
const keepAliveSettings = computed(() => store.settings?.keepAlive ?? null);
const globalCall = computed(() => store.activeCall);
const routeChatConversationId = computed(() => {
  if (String(route.name ?? '') !== 'chat-room') return '';
  const rawId = route.params.id;
  return Array.isArray(rawId) ? String(rawId[0] ?? '') : String(rawId ?? '');
});
const showGlobalCallFloating = computed(() => {
  const call = globalCall.value;
  if (!call) return false;
  return routeChatConversationId.value !== call.conversationId;
});
const globalCallFloatingStyle = computed(() => {
  const position = globalCall.value?.floatPosition ?? { x: 16, y: 92 };
  return { transform: `translate3d(${position.x}px, ${position.y}px, 0)` };
});
const globalCallSubtitle = computed(() => {
  const call = globalCall.value;
  if (!call) return '';
  if (call.subtitle) return call.subtitle;
  if (call.status === 'incoming-ringing') return '来电中';
  if (call.status === 'outgoing-ringing') return '呼叫中';
  if (call.status === 'active') return call.mode === 'video' ? '视频通话中' : '语音通话中';
  return '通话已结束';
});

function clampGlobalCallFloatPosition(x: number, y: number) {
  if (typeof window === 'undefined') return { x, y };
  const padding = 8;
  const floatWidth = 166;
  const floatHeight = 64;
  return {
    x: Math.min(Math.max(padding, x), Math.max(padding, window.innerWidth - floatWidth - padding)),
    y: Math.min(Math.max(padding + 36, y), Math.max(padding + 36, window.innerHeight - floatHeight - padding))
  };
}

function updateGlobalCallFloatPosition(x: number, y: number) {
  const call = globalCall.value;
  if (!call) return;
  store.patchActiveCall(call.conversationId, { floatPosition: clampGlobalCallFloatPosition(x, y) });
}

async function openGlobalCallFloating() {
  if (suppressGlobalCallFloatClick) {
    suppressGlobalCallFloatClick = false;
    return;
  }
  const call = globalCall.value;
  if (!call) return;
  store.patchActiveCall(call.conversationId, { minimized: false });
  await router.push({ name: 'chat-room', params: { id: call.conversationId } });
}

function startGlobalCallFloatDrag(event: PointerEvent) {
  if (event.button !== 0) return;
  const call = globalCall.value;
  if (!call) return;
  const target = event.currentTarget as HTMLElement | null;
  target?.setPointerCapture?.(event.pointerId);
  globalCallFloatDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: call.floatPosition.x,
    originY: call.floatPosition.y,
    moved: false
  };
}

function moveGlobalCallFloat(event: PointerEvent) {
  const drag = globalCallFloatDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - drag.startX;
  const deltaY = event.clientY - drag.startY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 4) drag.moved = true;
  updateGlobalCallFloatPosition(drag.originX + deltaX, drag.originY + deltaY);
}

function endGlobalCallFloatDrag(event: PointerEvent) {
  const drag = globalCallFloatDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  const target = event.currentTarget as HTMLElement | null;
  target?.releasePointerCapture?.(event.pointerId);
  suppressGlobalCallFloatClick = drag.moved;
  globalCallFloatDrag = null;
  if (suppressGlobalCallFloatClick) window.setTimeout(() => {
    suppressGlobalCallFloatClick = false;
  }, 0);
}

function sanitizeCssText(value: string) {
  return value.replace(/[{};]/g, '').replace(/\s+/g, ' ').trim();
}

function escapeCssString(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function getThemeFontFamilyStack(entry: ThemeFontEntry | null) {
  const family = sanitizeCssText(entry?.family ?? '');
  if (!family) return '';
  return family.includes(',') ? family : `"${escapeCssString(family)}", ${systemFontStack}`;
}

function isStylesheetFontUrl(url: string) {
  const normalizedUrl = url.trim().toLowerCase();
  return normalizedUrl.endsWith('.css') || normalizedUrl.includes('fonts.googleapis.com/css') || normalizedUrl.includes('fontsapi.zeoseven.com');
}

function getThemeFontStyleElement() {
  let styleElement = document.getElementById(themeFontStyleId) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = themeFontStyleId;
    document.head.appendChild(styleElement);
  }
  return styleElement;
}

function getOnlineThemeStyleElement() {
  let styleElement = document.getElementById(onlineThemeStyleId) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = onlineThemeStyleId;
    document.head.appendChild(styleElement);
  }
  return styleElement;
}

function getGlobalThemeStyleElement() {
  let styleElement = document.getElementById(globalThemeStyleId) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = globalThemeStyleId;
    const onlineStyleElement = document.getElementById(onlineThemeStyleId);
    if (onlineStyleElement) document.head.insertBefore(styleElement, onlineStyleElement);
    else document.head.appendChild(styleElement);
  }
  return styleElement;
}

function getOfflineThemeStyleElement() {
  let styleElement = document.getElementById(offlineThemeStyleId) as HTMLStyleElement | null;
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = offlineThemeStyleId;
    document.head.appendChild(styleElement);
  }
  return styleElement;
}

function setAppFontFamily(fontFamilyStack: string) {
  const targets = [document.documentElement, document.body, document.getElementById('app')].filter((target): target is HTMLElement => Boolean(target));
  targets.forEach((target) => {
    if (fontFamilyStack) target.style.setProperty('--app-font-family', fontFamilyStack);
    else target.style.removeProperty('--app-font-family');
  });
}

function applyGlobalThemeScale() {
  if (typeof document === 'undefined') return;
  const scale = Math.min(1.2, Math.max(0.85, Number(globalThemeSettings.value.scale) || 1));
  const root = document.documentElement;
  root.style.setProperty('--app-display-scale', scale.toFixed(2));
  root.style.setProperty('--compact-page-font-size', `${13 * scale}px`);
  root.style.setProperty('--compact-copy-font-size', `${12 * scale}px`);
  root.style.setProperty('--compact-label-font-size', `${11 * scale}px`);
  root.style.setProperty('--compact-heading-font-size', `${17 * scale}px`);
  root.style.setProperty('--compact-control-font-size', `${13 * scale}px`);
  root.style.setProperty('--ios-control-font-size', `${Math.max(16, 16 * scale)}px`);
  root.style.setProperty('--top-title-size', `${22 * scale}px`);
  root.style.setProperty('--top-icon-size', `${22 * scale}px`);
  root.style.setProperty('--top-icon-button-width', `${28 * scale}px`);
  root.style.setProperty('--top-icon-button-height', `${32 * scale}px`);
  root.style.setProperty('--top-icon-gap', `${2 * scale}px`);
  root.style.setProperty('--tab-height', `${54 * scale}px`);
}

function applyThemeFonts() {
  if (typeof document === 'undefined') return;

  const enabledFontEntries = themeFontSettings.value.entries.filter((entry) => entry.enabled && entry.family.trim());
  const activeFontEntry = enabledFontEntries.find((entry) => entry.id === themeFontSettings.value.activeFontId) ?? null;
  const stylesheetImports: string[] = [];
  const fontFaces: string[] = [];

  enabledFontEntries
    .filter((entry) => entry.source !== 'family' && entry.url.trim())
    .forEach((entry) => {
      const escapedUrl = escapeCssString(entry.url.trim());
      if (entry.source === 'url' && isStylesheetFontUrl(entry.url)) {
        stylesheetImports.push(`@import url("${escapedUrl}");`);
        return;
      }

      fontFaces.push(`@font-face { font-family: "${escapeCssString(sanitizeCssText(entry.family))}"; src: url("${escapedUrl}"); font-weight: 100 900; font-style: normal; font-display: swap; }`);
    });

  getThemeFontStyleElement().textContent = [...stylesheetImports, ...fontFaces].join('\n');

  const fontFamilyStack = getThemeFontFamilyStack(activeFontEntry);
  setAppFontFamily(fontFamilyStack);
}

function resolveThemePresetCss(settings: ThemeStyleScopeSettings, defaultPresetId: string, defaultCss: string, localPresetId = '') {
  const localId = localPresetId.trim();
  if (localId === defaultPresetId) return defaultCss;
  const localPreset = localId ? settings.presets.find((entry: ThemeStylePreset) => entry.id === localId) : null;
  if (localPreset?.css.trim()) return localPreset.css.trim();

  const globalPreset = settings.activePresetId ? settings.presets.find((entry: ThemeStylePreset) => entry.id === settings.activePresetId) : null;
  return globalPreset?.css.trim() || defaultCss;
}

function applyOnlineThemeStyles() {
  if (typeof document === 'undefined') return;
  getOnlineThemeStyleElement().textContent = resolveThemePresetCss(
    onlineThemeSettings.value,
    defaultOnlineThemePresetId,
    defaultOnlineThemeCss,
    routeCharacter.value?.themeStyleBindings?.onlinePresetId
  );
}

function applyGlobalThemeStyles() {
  if (typeof document === 'undefined') return;
  getGlobalThemeStyleElement().textContent = resolveThemePresetCss(
    globalThemeStyleSettings.value,
    defaultGlobalThemePresetId,
    defaultGlobalThemeCss
  );
}

function applyOfflineThemeStyles() {
  if (typeof document === 'undefined') return;
  getOfflineThemeStyleElement().textContent = resolveThemePresetCss(
    offlineThemeSettings.value,
    defaultOfflineThemePresetId,
    defaultOfflineThemeCss,
    routeCharacter.value?.themeStyleBindings?.offlinePresetId
  );
}

function clearGitHubAutoBackupTimer() {
  if (!githubAutoBackupTimer) return;
  window.clearInterval(githubAutoBackupTimer);
  githubAutoBackupTimer = undefined;
}

function getGitHubBackupIntervalMs() {
  const minutes = Math.max(1, store.settings?.githubBackup.intervalMinutes ?? 30);
  return minutes * 60 * 1000;
}

function clearWebDavAutoBackupTimer() {
  if (webDavAutoBackupTimer === undefined) return;
  window.clearInterval(webDavAutoBackupTimer);
  webDavAutoBackupTimer = undefined;
}

function getWebDavBackupIntervalMs() {
  return Math.max(5, store.settings?.webDavBackup.intervalMinutes ?? 30) * 60 * 1000;
}

async function runWebDavAutoBackupIfDue() {
  const backupSettings = store.settings?.webDavBackup;
  if (webDavAutoBackupRunning || !store.settings || !backupSettings?.enabled || !backupSettings.url || !backupSettings.username || !backupSettings.password || !backupSettings.recoveryKey) return;
  if (backupSettings.lastBackupAt && Date.now() - backupSettings.lastBackupAt < getWebDavBackupIntervalMs()) return;
  webDavAutoBackupRunning = true;
  try {
    await store.saveSettings({ ...store.settings, webDavBackup: { ...backupSettings, lastBackupStatus: 'running', lastBackupError: '' } });
    const backup = await store.createBackupFile();
    await uploadEncryptedWebDavBackup(backupSettings, backup);
    if (store.settings) {
      await store.saveSettings({
        ...store.settings,
        webDavBackup: {
          ...store.settings.webDavBackup,
          lastBackupAt: Date.now(),
          latestRemoteBackupAt: backup.exportedAt,
          lastBackupStatus: 'success',
          lastBackupError: ''
        }
      });
    }
  } catch (error) {
    if (store.settings) {
      await store.saveSettings({
        ...store.settings,
        webDavBackup: {
          ...store.settings.webDavBackup,
          lastBackupStatus: 'failed',
          lastBackupError: error instanceof Error ? error.message : '自动 WebDAV 备份失败。'
        }
      }).catch(() => undefined);
    }
  } finally {
    webDavAutoBackupRunning = false;
  }
}

async function runGitHubAutoBackupIfDue() {
  const backup = store.settings?.githubBackup;
  if (!backup?.enabled || !backup.token || !backup.owner || !backup.repo) return;

  const intervalMs = getGitHubBackupIntervalMs();
  if (backup.lastBackupAt && Date.now() - backup.lastBackupAt < intervalMs) return;

  try {
    await store.runGitHubBackup('auto');
  } catch {
    return;
  }
}

watch(
  githubBackupScheduleKey,
  (scheduleKey) => {
    clearGitHubAutoBackupTimer();
    if (!scheduleKey) return;

    void runGitHubAutoBackupIfDue();
    githubAutoBackupTimer = window.setInterval(() => {
      void runGitHubAutoBackupIfDue();
    }, getGitHubBackupIntervalMs());
  },
  { immediate: true }
);

watch(
  webDavBackupScheduleKey,
  (scheduleKey) => {
    clearWebDavAutoBackupTimer();
    if (!scheduleKey) return;
    void runWebDavAutoBackupIfDue();
    webDavAutoBackupTimer = window.setInterval(() => void runWebDavAutoBackupIfDue(), getWebDavBackupIntervalMs());
  },
  { immediate: true }
);

watch(themeFontSettings, applyThemeFonts, { immediate: true, deep: true });
watch(globalThemeSettings, applyGlobalThemeScale, { immediate: true, deep: true });
watch(() => globalThemeSettings.value.fullscreen, (enabled) => void setFullscreenEnabled(Boolean(enabled)), { immediate: true });
watch(globalThemeStyleSettings, applyGlobalThemeStyles, { immediate: true, deep: true });
watch(onlineThemeSettings, applyOnlineThemeStyles, { immediate: true, deep: true });
watch(offlineThemeSettings, applyOfflineThemeStyles, { immediate: true, deep: true });
watch(routeCharacter, () => {
  applyOnlineThemeStyles();
  applyOfflineThemeStyles();
}, { immediate: true, deep: true });
watch(keepAliveSettings, syncKeepAlive, { immediate: true, deep: true });

watch(() => store.ready, (ready) => {
  if (proactiveGroupTimer !== undefined) window.clearInterval(proactiveGroupTimer);
  proactiveGroupTimer = undefined;
  if (!ready) return;
  void store.runProactiveGroupScheduler();
  proactiveGroupTimer = window.setInterval(() => {
    void store.runProactiveGroupScheduler();
  }, 60_000);
}, { immediate: true });

onMounted(() => {
  stopAccessHeartbeat = startAccessHeartbeat();
  document.addEventListener('visibilitychange', handleWebDavVisibilityChange);
  musicPlayer.setAudioElement(musicAudioRef.value);
});

function handleWebDavVisibilityChange() {
  if (document.visibilityState === 'visible') void runWebDavAutoBackupIfDue();
}

onBeforeUnmount(() => {
  stopAccessHeartbeat?.();
  document.removeEventListener('visibilitychange', handleWebDavVisibilityChange);
  clearGitHubAutoBackupTimer();
  clearWebDavAutoBackupTimer();
  if (proactiveGroupTimer !== undefined) window.clearInterval(proactiveGroupTimer);
  setAppFontFamily('');
  document.documentElement.style.removeProperty('--app-display-scale');
  document.documentElement.style.removeProperty('--compact-page-font-size');
  document.documentElement.style.removeProperty('--compact-copy-font-size');
  document.documentElement.style.removeProperty('--compact-label-font-size');
  document.documentElement.style.removeProperty('--compact-heading-font-size');
  document.documentElement.style.removeProperty('--compact-control-font-size');
  document.documentElement.style.removeProperty('--ios-control-font-size');
  document.documentElement.style.removeProperty('--top-title-size');
  document.documentElement.style.removeProperty('--top-icon-size');
  document.documentElement.style.removeProperty('--top-icon-button-width');
  document.documentElement.style.removeProperty('--top-icon-button-height');
  document.documentElement.style.removeProperty('--top-icon-gap');
  document.documentElement.style.removeProperty('--tab-height');
  document.getElementById(themeFontStyleId)?.remove();
  document.getElementById(onlineThemeStyleId)?.remove();
  document.getElementById(offlineThemeStyleId)?.remove();
  musicPlayer.setAudioElement(null);
});

async function handleDisclaimerComplete() {
  if (!store.settings) return;
  await store.saveSettings({
    ...store.settings,
    disclaimerAccepted: true
  });
}

function setConfigAlertOpen(value: boolean) {
  store.configAlert.open = value;
  if (!value) store.configAlert.action = undefined;
}

async function runConfigAlertAction() {
  const action = store.configAlert.action;
  if (!action || configAlertActionRunning.value) return;
  configAlertActionRunning.value = true;
  try {
    await action.run();
    setConfigAlertOpen(false);
  } catch (error) {
    store.configAlert.message = error instanceof Error ? error.message : '重新生成失败。';
  } finally {
    configAlertActionRunning.value = false;
  }
}
</script>

<style scoped>
.config-alert {
  display: grid;
  gap: 14px;
}

.config-alert p {
  margin: 0;
  color: #363a40;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.config-alert button {
  min-height: 42px;
  border: 0;
  border-radius: 12px;
  background: #17191d;
  color: #ffffff;
  font-weight: 800;
}

.config-alert button:disabled {
  opacity: 0.55;
}

.global-music-audio {
  display: none;
}

.global-call-floating {
  position: fixed;
  left: 0;
  top: 0;
  z-index: 220;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 166px;
  min-height: 64px;
  padding: 7px 10px 7px 8px;
  border: 1px solid rgba(31, 107, 58, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  color: #17211b;
  box-shadow: 0 14px 30px rgba(20, 30, 24, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.78);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-backdrop-filter: blur(18px) saturate(1.04);
  backdrop-filter: blur(18px) saturate(1.04);
}

.global-call-floating--video {
  border-color: rgba(35, 83, 132, 0.12);
}

.global-call-floating:active {
  cursor: grabbing;
}

.global-call-floating:focus-visible {
  outline: 2px solid rgba(6, 199, 85, 0.48);
  outline-offset: 3px;
}

.global-call-floating-avatar {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  overflow: hidden;
  border-radius: 15px;
  background: #edf8f1;
}

.global-call-floating-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.global-call-floating-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.global-call-floating-copy strong,
.global-call-floating-copy small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-call-floating-copy strong {
  font-size: 12px;
  font-weight: 900;
  line-height: 1.15;
}

.global-call-floating-copy small {
  color: #6d7671;
  font-size: 10px;
  font-weight: 750;
  line-height: 1.2;
}
</style>
