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
import { App as CapacitorApp } from '@capacitor/app';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MobileShell from '@/components/layout/MobileShell.vue';
import AppModal from '@/components/common/AppModal.vue';
import FirstRunDisclaimer from '@/components/common/FirstRunDisclaimer.vue';
import GlobalSmallTheaterNotice from '@/components/common/GlobalSmallTheaterNotice.vue';
import GlobalVoomNotice from '@/components/common/GlobalVoomNotice.vue';
import { startAccessHeartbeat } from '@/services/access';
import { syncKeepAlive } from '@/services/keepAlive';
import { setFullscreenEnabled } from '@/services/systemBars';
import { cacheThemeFontEntry, getThemeFontCss, getThemeFontFileUrl, hasPersistedThemeFontCache, isThemeFontStylesheetEntry } from '@/services/themeFontCache';
import { useAppStore } from '@/stores/appStore';
import { useMusicPlayerStore } from '@/stores/musicPlayerStore';
import type { ThemeFontEntry, ThemeStylePreset, ThemeStyleScopeSettings } from '@/types/domain';
import { normalizeGlobalThemeScale } from '@/utils/themeScale';
import { defaultGlobalThemeCss, defaultGlobalThemePresetId, defaultOfflineThemeCss, defaultOfflineThemePresetId, defaultOnlineThemeCss, defaultOnlineThemePresetId } from '@/utils/themeStyles';

const store = useAppStore();
const route = useRoute();
const router = useRouter();
const musicPlayer = useMusicPlayerStore();
const musicAudioRef = ref<HTMLAudioElement | null>(null);
const configAlertActionRunning = ref(false);
let githubAutoBackupTimer: number | undefined;
let cloudAutoBackupTimer: number | undefined;
let proactiveSchedulerTimer: number | undefined;
let proactiveSchedulerRunning = false;
let proactiveSchedulerRerun = false;
let stopCapacitorResumeListener: (() => void) | undefined;
let appMounted = false;
let stopAccessHeartbeat: (() => void) | undefined;
let globalCallFloatDrag: { pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null = null;
let suppressGlobalCallFloatClick = false;
const themeFontStyleId = 'link-theme-fonts';
const globalThemeStyleId = 'link-global-theme-styles';
const onlineThemeStyleId = 'link-online-theme-styles';
const offlineThemeStyleId = 'link-offline-theme-styles';
const systemFontStack = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif';
const legacyGlobalScaleVariableNames = [
  '--compact-page-font-size',
  '--compact-copy-font-size',
  '--compact-label-font-size',
  '--compact-heading-font-size',
  '--compact-control-font-size',
  '--ios-control-font-size',
  '--top-title-size',
  '--top-icon-size',
  '--top-icon-button-width',
  '--top-icon-button-height',
  '--top-icon-gap',
  '--tab-height'
];
const cachingThemeFontIds = new Set<string>();

const showDisclaimer = computed(() => store.ready && !store.settings?.disclaimerAccepted);
const githubBackupScheduleKey = computed(() => {
  const backup = store.settings?.githubBackup;
  if (!store.ready || !backup?.enabled || !backup.token || !backup.owner || !backup.repo) return '';
  return [backup.owner, backup.repo, backup.branch, backup.path, backup.intervalMinutes].join('|');
});
const cloudBackupScheduleKey = computed(() => {
  const backup = store.settings?.cloudBackup;
  if (!store.ready || !backup?.enabled || !backup.provider || !backup.recoveryKey) return '';
  const connected = backup.provider === 'r2-worker'
    ? Boolean(backup.workerUrl && backup.workerToken)
    : Boolean(backup.accessToken || backup.refreshToken);
  if (!connected) return '';
  return [backup.provider, backup.workerUrl, backup.fileName, backup.intervalMinutes].join('|');
});
const themeFontSettings = computed(() => store.settings?.themeSettings.fonts ?? { activeFontId: '', entries: [] as ThemeFontEntry[] });
const globalThemeSettings = computed(() => store.settings?.themeSettings.global ?? { scale: 1, fullscreen: true, style: { activePresetId: '', presets: [] } });
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
  const scale = normalizeGlobalThemeScale(globalThemeSettings.value.scale);
  const root = document.documentElement;
  root.style.setProperty('--app-display-scale', scale.toFixed(3));
  legacyGlobalScaleVariableNames.forEach((name) => root.style.removeProperty(name));
  document.body.style.setProperty('zoom', scale.toFixed(3));
}

function applyThemeFonts() {
  if (typeof document === 'undefined') return;

  const enabledFontEntries = themeFontSettings.value.entries.filter((entry) => entry.enabled && entry.family.trim());
  const activeFontEntry = enabledFontEntries.find((entry) => entry.id === themeFontSettings.value.activeFontId) ?? null;
  const stylesheetImports: string[] = [];
  const cachedStylesheets: string[] = [];
  const fontFaces: string[] = [];

  enabledFontEntries
    .filter((entry) => entry.source !== 'family' && entry.url.trim())
    .forEach((entry) => {
      if (entry.source === 'url' && isThemeFontStylesheetEntry(entry)) {
        const cachedCss = getThemeFontCss(entry);
        if (cachedCss) cachedStylesheets.push(cachedCss);
        else stylesheetImports.push(`@import url("${escapeCssString(entry.url.trim())}");`);
        return;
      }

      const escapedUrl = escapeCssString(getThemeFontFileUrl(entry));
      fontFaces.push(`@font-face { font-family: "${escapeCssString(sanitizeCssText(entry.family))}"; src: url("${escapedUrl}"); font-weight: 100 900; font-style: normal; font-display: swap; }`);
    });

  getThemeFontStyleElement().textContent = [...stylesheetImports, ...cachedStylesheets, ...fontFaces].join('\n');

  const fontFamilyStack = getThemeFontFamilyStack(activeFontEntry);
  setAppFontFamily(fontFamilyStack);
}

async function cacheActiveThemeFontForStartup() {
  const settings = store.settings;
  const activeFontId = settings?.themeSettings.fonts.activeFontId ?? '';
  const entry = settings?.themeSettings.fonts.entries.find((font) => font.id === activeFontId);
  if (!settings || !entry || hasPersistedThemeFontCache(entry) || cachingThemeFontIds.has(entry.id)) return;

  cachingThemeFontIds.add(entry.id);
  try {
    const cachedEntry = await cacheThemeFontEntry(entry);
    const latestSettings = store.settings;
    const latestEntry = latestSettings?.themeSettings.fonts.entries.find((font) => font.id === entry.id);
    if (!latestSettings || !latestEntry || latestEntry.url !== entry.url || hasPersistedThemeFontCache(latestEntry)) return;
    await store.saveSettings({
      ...latestSettings,
      themeSettings: {
        ...latestSettings.themeSettings,
        fonts: {
          ...latestSettings.themeSettings.fonts,
          entries: latestSettings.themeSettings.fonts.entries.map((font) => font.id === entry.id ? cachedEntry : font)
        }
      }
    });
  } catch (error) {
    console.warn('Theme font could not be cached for startup.', error);
  } finally {
    cachingThemeFontIds.delete(entry.id);
  }
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

function clearCloudAutoBackupTimer() {
  if (cloudAutoBackupTimer === undefined) return;
  window.clearInterval(cloudAutoBackupTimer);
  cloudAutoBackupTimer = undefined;
}

function getCloudBackupIntervalMs() {
  return Math.max(5, store.settings?.cloudBackup.intervalMinutes ?? 30) * 60 * 1000;
}

async function runCloudAutoBackupIfDue() {
  const backup = store.settings?.cloudBackup;
  if (!backup?.enabled || !backup.provider || !backup.recoveryKey) return;
  if (backup.lastBackupAt && Date.now() - backup.lastBackupAt < getCloudBackupIntervalMs()) return;
  try {
    await store.runCloudBackup('auto');
  } catch {
    return;
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
  cloudBackupScheduleKey,
  (scheduleKey) => {
    clearCloudAutoBackupTimer();
    if (!scheduleKey) return;
    void runCloudAutoBackupIfDue();
    cloudAutoBackupTimer = window.setInterval(() => void runCloudAutoBackupIfDue(), getCloudBackupIntervalMs());
  },
  { immediate: true }
);

watch(themeFontSettings, () => {
  applyThemeFonts();
  void cacheActiveThemeFontForStartup();
}, { immediate: true, deep: true });
watch(globalThemeSettings, applyGlobalThemeScale, { immediate: true, deep: true });
watch(
  () => store.ready ? globalThemeSettings.value.fullscreen : null,
  (enabled) => {
    if (enabled === null) return;
    void setFullscreenEnabled(Boolean(enabled));
  },
  { immediate: true }
);
watch(globalThemeStyleSettings, applyGlobalThemeStyles, { immediate: true, deep: true });
watch(onlineThemeSettings, applyOnlineThemeStyles, { immediate: true, deep: true });
watch(offlineThemeSettings, applyOfflineThemeStyles, { immediate: true, deep: true });
watch(routeCharacter, () => {
  applyOnlineThemeStyles();
  applyOfflineThemeStyles();
}, { immediate: true, deep: true });
watch(keepAliveSettings, syncKeepAlive, { immediate: true, deep: true });

async function runProactiveSchedulers() {
  if (!store.ready || !navigator.onLine) return;
  if (proactiveSchedulerRunning) {
    proactiveSchedulerRerun = true;
    return;
  }

  proactiveSchedulerRunning = true;
  try {
    do {
      proactiveSchedulerRerun = false;
      await Promise.all([
        store.runProactivePrivateScheduler(),
        store.runProactiveGroupScheduler()
      ]);
    } while (proactiveSchedulerRerun && store.ready);
  } catch (error) {
    console.error('Proactive message scheduler failed.', error);
  } finally {
    proactiveSchedulerRunning = false;
  }
}

function requestProactiveSchedulerRun() {
  void runProactiveSchedulers();
}

function clearProactiveSchedulerTimer() {
  if (proactiveSchedulerTimer === undefined) return;
  window.clearInterval(proactiveSchedulerTimer);
  proactiveSchedulerTimer = undefined;
}

watch(() => store.ready, (ready) => {
  clearProactiveSchedulerTimer();
  if (!ready) return;
  requestProactiveSchedulerRun();
  proactiveSchedulerTimer = window.setInterval(requestProactiveSchedulerRun, 60_000);
}, { immediate: true });

onMounted(() => {
  appMounted = true;
  stopAccessHeartbeat = startAccessHeartbeat();
  document.addEventListener('visibilitychange', handleCloudVisibilityChange);
  document.addEventListener('visibilitychange', requestProactiveSchedulerRun);
  window.addEventListener('pageshow', requestProactiveSchedulerRun, { passive: true });
  window.addEventListener('online', requestProactiveSchedulerRun, { passive: true });
  void CapacitorApp.addListener('resume', requestProactiveSchedulerRun).then((listener) => {
    if (!appMounted) {
      void listener.remove();
      return;
    }
    stopCapacitorResumeListener = () => void listener.remove();
  });
  musicPlayer.setAudioElement(musicAudioRef.value);
});

function handleCloudVisibilityChange() {
  if (document.visibilityState === 'visible') void runCloudAutoBackupIfDue();
}

onBeforeUnmount(() => {
  appMounted = false;
  stopAccessHeartbeat?.();
  stopCapacitorResumeListener?.();
  stopCapacitorResumeListener = undefined;
  document.removeEventListener('visibilitychange', handleCloudVisibilityChange);
  document.removeEventListener('visibilitychange', requestProactiveSchedulerRun);
  window.removeEventListener('pageshow', requestProactiveSchedulerRun);
  window.removeEventListener('online', requestProactiveSchedulerRun);
  clearGitHubAutoBackupTimer();
  clearCloudAutoBackupTimer();
  clearProactiveSchedulerTimer();
  setAppFontFamily('');
  document.documentElement.style.removeProperty('--app-display-scale');
  legacyGlobalScaleVariableNames.forEach((name) => document.documentElement.style.removeProperty(name));
  document.body.style.removeProperty('zoom');
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
