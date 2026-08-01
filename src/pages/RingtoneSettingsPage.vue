<template>
  <section class="screen no-tabs ringtone-page">
    <header class="top-bar ringtone-topbar">
      <button class="ringtone-title-button" type="button" :aria-label="activeTab === 'ringtones' ? '返回首页' : '返回 Services'" @click="goBack">
        <h1 class="top-title">{{ activeTabMeta.title }}</h1>
      </button>
      <button
        v-if="activeTab === 'ringtones'"
        class="ringtone-master-switch"
        :class="{ active: ringtoneSettings.enabled }"
        type="button"
        :aria-label="ringtoneSettings.enabled ? '关闭网站铃声' : '开启网站铃声'"
        :title="ringtoneSettings.enabled ? '关闭网站铃声' : '开启网站铃声'"
        @click="toggleRingtoneEnabled"
      >
        <i aria-hidden="true">
          <Volume2 v-if="ringtoneSettings.enabled" :size="14" />
          <VolumeX v-else :size="14" />
        </i>
      </button>
      <span v-else class="header-chip">{{ activeTabMeta.shortLabel }}</span>
    </header>

    <main class="ringtone-main">
      <section class="ringtone-panel">
        <section v-if="activeTab === 'keepalive'" class="keepalive-section" aria-label="保活通知">
          <div class="section-heading-row">
            <span>Keep Alive</span>
            <b>{{ keepAliveModeLabel }}</b>
          </div>

          <article class="keepalive-dashboard" :class="{ 'is-active': keepAliveStatus.enabled }">
            <div class="keepalive-hero">
              <span class="keepalive-orbit" aria-hidden="true">
                <span :class="['keepalive-pulse', { active: keepAliveStatus.enabled }]"></span>
                <BatteryCharging :size="22" />
              </span>

              <div class="keepalive-hero-copy">
                <small>{{ keepAlivePlatformLabel }}</small>
                <strong>保活与通知</strong>
                <span>{{ keepAliveSummary }}</span>
              </div>

              <button class="keepalive-power" type="button" :aria-label="keepAliveStatus.enabled ? '关闭保活' : '开启保活'" :title="keepAliveStatus.enabled ? '关闭保活' : '开启保活'" @click="toggleKeepAlive">
                <Power :size="18" />
              </button>
            </div>

            <div class="keepalive-status-strip" aria-label="保活概览">
              <span>
                <small>Signal</small>
                <strong>{{ keepAliveSignal }}</strong>
              </span>
              <span>
                <small>Mode</small>
                <strong>{{ keepAliveModeLabel }}</strong>
              </span>
              <span>
                <small>Notify</small>
                <strong>{{ notificationStateLabel }}</strong>
              </span>
            </div>
          </article>

          <div class="keepalive-states" aria-label="保活状态">
            <span :class="['keepalive-state', { active: keepAliveStatus.native ? keepAliveStatus.nativeServiceActive : keepAliveStatus.silentAudioActive || keepAliveStatus.webAudioActive }]">
              <VolumeX :size="15" />
              <span>
                <b>{{ keepAliveStatus.native ? '原生前台服务' : '音频保活' }}</b>
                <small>{{ keepAliveStatus.native ? 'Foreground' : '静音通道' }}</small>
              </span>
              <em>{{ keepAliveStatus.native ? nativeServiceStateLabel : audioStateLabel }}</em>
            </span>
            <span :class="['keepalive-state', { active: keepAliveStatus.notificationPermission === 'granted', warn: keepAliveStatus.notificationPermission === 'denied' }]">
              <BellRing :size="15" />
              <span>
                <b>系统通知</b>
                <small>角色提醒</small>
              </span>
              <em>{{ notificationStateLabel }}</em>
            </span>
            <span :class="['keepalive-state', { active: keepAliveStatus.native ? keepAliveStatus.nativeWakeLockActive : keepAliveStatus.wakeLockActive, muted: !keepAliveStatus.wakeLockSupported }]">
              <ShieldCheck :size="15" />
              <span>
                <b>{{ keepAliveStatus.native ? '后台唤醒' : '亮屏守护' }}</b>
                <small>{{ keepAliveStatus.native ? 'CPU Wake Lock' : '屏幕唤醒' }}</small>
              </span>
              <em>{{ wakeStateLabel }}</em>
            </span>
          </div>

          <button v-if="canRequestNotificationPermission" class="keepalive-auth" type="button" @click="authorizeNotifications">
            <BellRing :size="14" />
            <span>授权通知</span>
          </button>

          <button v-if="keepAliveStatus.native && !keepAliveStatus.batteryOptimizationsIgnored" class="keepalive-auth" type="button" @click="authorizeNativeBackground">
            <ShieldCheck :size="14" />
            <span>允许忽略电池优化</span>
          </button>

          <div class="keepalive-options">
            <label v-if="!keepAliveStatus.native" :class="['keepalive-option', { active: keepAliveSettings.silentAudio }]">
              <VolumeX :size="16" />
              <span>
                <b>静音音频</b>
                <small>Audio</small>
              </span>
              <input type="checkbox" :checked="keepAliveSettings.silentAudio" @change="updateKeepAliveOption('silentAudio', $event)" />
              <i aria-hidden="true"></i>
            </label>
            <label :class="['keepalive-option', { active: keepAliveSettings.notifications }]">
              <BellRing :size="16" />
              <span>
                <b>角色通知</b>
                <small>Notify</small>
              </span>
              <input type="checkbox" :checked="keepAliveSettings.notifications" @change="updateKeepAliveOption('notifications', $event)" />
              <i aria-hidden="true"></i>
            </label>
            <label :class="['keepalive-option', { active: keepAliveSettings.wakeLock }]">
              <ShieldCheck :size="16" />
              <span>
                <b>{{ keepAliveStatus.native ? '后台唤醒' : '亮屏守护' }}</b>
                <small>{{ keepAliveStatus.native ? 'CPU' : 'Wake' }}</small>
              </span>
              <input type="checkbox" :checked="keepAliveSettings.wakeLock" @change="updateKeepAliveOption('wakeLock', $event)" />
              <i aria-hidden="true"></i>
            </label>
          </div>

          <p v-if="keepAliveAlert" class="keepalive-note">{{ keepAliveAlert }}</p>
          <p class="keepalive-note">{{ backgroundReliabilityNote }}</p>
        </section>

        <section v-else-if="activeTab === 'updates'" class="app-update-section" aria-label="网站更新">
          <div class="section-heading-row">
            <span>Website Update</span>
            <b>{{ appUpdatePhaseLabel }}</b>
          </div>

          <article class="app-update-console" :class="[`is-${appUpdateStatus.phase}`, { 'is-ready': canInstallAppUpdate }]">
            <header class="app-update-console-head">
              <div class="app-update-title-copy">
                <small>{{ appUpdateRuntimeLabel }}</small>
                <strong>网站版本更新</strong>
                <span>{{ appUpdateCheckedLabel }}</span>
              </div>

              <span class="app-update-badge">{{ appUpdatePhaseLabel }}</span>
            </header>

            <div class="app-update-summary">
              <strong>{{ appUpdateStatus.message }}</strong>
              <span>{{ appUpdateStatus.detail }}</span>
            </div>

            <div class="app-update-flow" aria-label="更新状态">
              <span :class="['app-update-step', { active: appUpdateStatus.registrationReady, muted: !appUpdateStatus.supported }]">
                <Cloud :size="16" />
                <b>更新服务</b>
                <small>{{ appUpdateWorkerLabel }}</small>
              </span>
              <span :class="['app-update-step', { active: appUpdateStatus.hasWaitingWorker || appUpdateStatus.hasInstallingWorker }]">
                <Download :size="16" />
                <b>资源包</b>
                <small>{{ appUpdatePackageLabel }}</small>
              </span>
              <span :class="['app-update-step', { active: appUpdateStatus.controlled, warn: appUpdateStatus.phase === 'error' }]">
                <Smartphone :size="16" />
                <b>当前页面</b>
                <small>{{ appUpdateClientLabel }}</small>
              </span>
            </div>
          </article>

          <div class="app-update-actions" aria-label="更新操作">
            <button class="app-update-action primary" type="button" :disabled="!canCheckAppUpdate" @click="runAppUpdateCheck">
              <RefreshCw :size="16" :class="{ spin: appUpdateStatus.phase === 'checking' }" />
              <span>
                <b>检查并下载</b>
                <small>{{ appUpdateDownloadHint }}</small>
              </span>
            </button>
            <button class="app-update-action" type="button" :disabled="!canInstallAppUpdate" @click="runAppUpdateInstall">
              <CheckCircle2 :size="16" />
              <span>
                <b>安装并重载</b>
                <small>{{ canInstallAppUpdate ? '新版本就绪' : '等待下载' }}</small>
              </span>
            </button>
          </div>

          <p class="app-update-note" :class="{ warn: appUpdateStatus.phase === 'error' || appUpdateStatus.phase === 'unsupported' }">
            <AlertCircle v-if="appUpdateStatus.phase === 'error' || appUpdateStatus.phase === 'unsupported'" :size="14" />
            <CheckCircle2 v-else :size="14" />
            <span>{{ appUpdateBrowserNote }}</span>
          </p>

          <article v-if="nativeReleaseStatus.supported" class="native-release-card" :class="`is-${nativeReleaseStatus.phase}`">
            <header>
              <div>
                <small>{{ nativeReleaseStatus.platform === 'android' ? 'Android APK' : 'iOS IPA' }}</small>
                <strong>原生安装包</strong>
              </div>
              <span>{{ nativeReleasePhaseLabel }}</span>
            </header>

            <div class="native-release-copy">
              <strong>{{ nativeReleaseStatus.message }}</strong>
              <span v-if="nativeReleaseStatus.release">
                最新 {{ nativeReleaseStatus.release.versionName }} · {{ formatReleaseSize(nativeReleaseStatus.release.fileSize) }}
                <template v-if="nativeReleaseStatus.currentVersionCode"> · 当前 {{ nativeReleaseStatus.currentVersionName || nativeReleaseStatus.currentVersionCode }}</template>
              </span>
              <span v-else>{{ nativeReleaseStatus.native ? '当前运行在 Capacitor 原生壳中。' : '下载后仍需完成系统安装或自行签名。' }}</span>
              <p v-if="nativeReleaseStatus.release?.notes">{{ nativeReleaseStatus.release.notes }}</p>
              <p v-if="nativeReleaseStatus.release?.mandatory" class="mandatory">当前版本低于最低安全版本，必须更新原生壳。</p>
            </div>

            <div class="native-release-actions">
              <button type="button" :disabled="nativeReleaseBusy" @click="runNativeReleaseCheck">
                <RefreshCw :size="15" :class="{ spin: nativeReleaseStatus.phase === 'checking' }" />
                <span>检查安装包</span>
              </button>
              <button class="primary" type="button" :disabled="nativeReleaseBusy || (nativeReleaseStatus.platform === 'android' && !nativeReleaseStatus.release)" @click="runNativeReleaseAction">
                <Download :size="15" />
                <span>{{ nativeReleaseStatus.platform === 'ios' ? '复制更新源' : '应用内更新' }}</span>
              </button>
            </div>

            <label v-if="nativeReleaseStatus.platform === 'ios' && iosUpdateSource" class="native-release-source">
              <span>更新源地址</span>
              <input :value="iosUpdateSource.url" readonly inputmode="none" aria-label="iOS 更新源地址" @focus="selectIosUpdateSource" @click="selectIosUpdateSource" />
            </label>

            <p class="native-release-tip">
              {{ nativeReleaseStatus.platform === 'ios' ? 'AltStore 或 SideStore 可添加更新源；万能签请直接下载 IPA 后导入并签名安装。' : 'BabyLink 会先校验 APK 的 SHA-256、包名、版本号与签名证书，再交给 Android 系统确认覆盖安装。' }}
            </p>
            <button v-if="nativeReleaseStatus.platform === 'ios' && nativeReleaseStatus.release" class="native-release-manual" type="button" :disabled="nativeReleaseBusy" @click="downloadIosRelease">万能签：下载 IPA</button>
          </article>
        </section>

        <section v-else class="ringtone-content" :class="{ 'is-muted': !ringtoneSettings.enabled }" aria-label="铃声内容">
          <section v-if="ringtoneScopeTab === 'global'" class="global-section" aria-label="全局铃声">
            <div class="section-heading-row">
              <span>Global</span>
              <b>{{ ringtoneEventTypes.length }}</b>
            </div>
            <div class="ringtone-grid">
              <article v-for="eventType in ringtoneEventTypes" :key="eventType" class="ringtone-card">
                <RingtoneCardIcon :event-type="eventType" />
                <div class="ringtone-copy">
                  <strong>{{ eventMeta[eventType].label }}</strong>
                  <span>{{ globalRingtone(eventType).name }}</span>
                  <small>{{ formatAssetMeta(globalRingtone(eventType)) }}</small>
                </div>
                <div class="ringtone-actions">
                  <label class="icon-action" :aria-label="`导入${eventMeta[eventType].label}`" :title="`导入${eventMeta[eventType].label}`">
                    <Upload :size="16" />
                    <input type="file" :accept="audioAccept" @change="importRingtone('global', eventType, $event)" />
                  </label>
                  <button class="icon-action" type="button" :aria-label="`恢复默认${eventMeta[eventType].label}`" :title="`恢复默认${eventMeta[eventType].label}`" @click="resetGlobal(eventType)">
                    <RotateCcw :size="16" />
                  </button>
                </div>
                <audio class="audio-preview" controls preload="metadata" :src="globalRingtone(eventType).url"></audio>
              </article>
            </div>
          </section>

          <section v-else class="character-section" aria-label="角色铃声">
            <div class="section-heading-row">
              <span>Characters</span>
              <b>{{ store.characters.length }}</b>
            </div>

            <section v-if="!store.ready" class="empty-panel">
              <LoaderCircle :size="18" class="spin" />
              <p>正在加载铃声...</p>
            </section>

            <section v-else-if="!store.characters.length" class="empty-panel">
              <Music2 :size="20" />
              <p>暂无角色</p>
            </section>

            <article v-for="character in store.characters" v-else :key="character.id" class="character-row">
              <header class="character-head">
                <img class="avatar" :src="character.avatar" :alt="getCharacterDisplayName(character)" />
                <div>
                  <strong>{{ getCharacterDisplayName(character) }}</strong>
                  <span>{{ character.id }}</span>
                </div>
              </header>

              <div class="character-ringtones">
                <section v-for="eventType in ringtoneEventTypes" :key="eventType" class="mini-ringtone">
                  <div class="mini-ringtone-head">
                    <RingtoneCardIcon :event-type="eventType" />
                    <div>
                      <strong>{{ eventMeta[eventType].shortLabel }}</strong>
                      <span>{{ characterAssetLabel(character.id, eventType) }}</span>
                    </div>
                  </div>
                  <div class="mini-actions">
                    <label class="icon-action" :aria-label="`导入${getCharacterDisplayName(character)}的${eventMeta[eventType].label}`" :title="`导入${eventMeta[eventType].label}`">
                      <Upload :size="15" />
                      <input type="file" :accept="audioAccept" @change="importRingtone('character', eventType, $event, character.id)" />
                    </label>
                    <button class="icon-action" type="button" :disabled="!characterRingtone(character.id, eventType)" :aria-label="`继承全局${eventMeta[eventType].label}`" :title="`继承全局${eventMeta[eventType].label}`" @click="resetCharacter(character.id, eventType)">
                      <Undo2 :size="15" />
                    </button>
                  </div>
                  <audio class="audio-preview compact" controls preload="metadata" :src="effectiveRingtone(character.id, eventType).url"></audio>
                </section>
              </div>
            </article>
          </section>

          <p v-if="importError" class="import-error">{{ importError }}</p>
        </section>
      </section>
    </main>

    <nav v-if="activeTab === 'ringtones'" class="ringtone-tabs" aria-label="铃声范围">
      <button
        v-for="tab in ringtoneScopeTabs"
        :key="tab.id"
        class="ringtone-tab"
        :class="{ active: ringtoneScopeTab === tab.id }"
        type="button"
        @click="ringtoneScopeTab = tab.id"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

  </section>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, onBeforeUnmount, onMounted, ref, type PropType } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertCircle, BatteryCharging, BellRing, CheckCircle2, Clapperboard, Cloud, Download, Globe2, LoaderCircle, MessageCircle, Music2, Phone, Power, RadioTower, RefreshCw, RotateCcw, ShieldCheck, Smartphone, Undo2, Upload, UsersRound, Volume2, VolumeX } from 'lucide-vue-next';
import { checkForAppUpdate, getAppUpdateStatus, installDownloadedAppUpdate, refreshAppUpdateStatus, subscribeAppUpdateStatus, type AppUpdateStatus } from '@/services/appUpdate';
import { writeClipboardText } from '@/services/clipboard';
import { checkNativeRelease, createInitialNativeReleaseStatus, fetchIosUpdateSourceLink, installNativeRelease, openNativeReleaseDownload, type IosUpdateSourceLink, type NativeReleaseStatus } from '@/services/nativeRelease';
import { getKeepAliveStatus, requestKeepAliveNotificationPermission, requestNativeKeepAliveBatteryAccess, startKeepAlive, stopKeepAlive, subscribeKeepAliveStatus, type KeepAliveRuntimeStatus } from '@/services/keepAlive';
import { useAppStore } from '@/stores/appStore';
import type { AppKeepAliveSettings, AppRingtoneSettings, RingtoneAsset, RingtoneEventType } from '@/types/domain';
import { getCharacterDisplayName } from '@/utils/character';
import { createId } from '@/utils/id';
import { createDefaultRingtoneSettings, normalizeAppSettings, normalizeKeepAliveSettings, normalizeRingtoneSettings, ringtoneEventTypes } from '@/utils/settings';

type RingtoneScope = 'global' | 'character';
type RingtoneTab = 'keepalive' | 'ringtones' | 'updates';
type RingtoneScopeTab = 'global' | 'characters';

const audioAccept = 'audio/*,.mp3,.mpeg,.mpga,.m4a,.aac,.wav,.wave,.ogg,.oga,.opus,.webm,.flac,.caf,.aif,.aiff';
const supportedAudioExtensions = ['mp3', 'mpeg', 'mpga', 'm4a', 'aac', 'wav', 'wave', 'ogg', 'oga', 'opus', 'webm', 'flac', 'caf', 'aif', 'aiff'];
const mimeByExtension: Record<string, string> = {
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  wave: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  webm: 'audio/webm',
  flac: 'audio/flac',
  caf: 'audio/x-caf',
  aif: 'audio/aiff',
  aiff: 'audio/aiff'
};

const eventMeta = {
  voom: { label: 'Voom 发布', shortLabel: 'Voom' },
  message: { label: '消息发送', shortLabel: 'Message' },
  theater: { label: '小剧场生成', shortLabel: 'Theater' },
  call: { label: '来电铃声', shortLabel: 'Call' }
} satisfies Record<RingtoneEventType, { label: string; shortLabel: string }>;

const pageMeta = {
  keepalive: { title: 'Keep Alive', shortLabel: 'KEEP' },
  ringtones: { title: 'Ringtones', shortLabel: 'RINGS' },
  updates: { title: 'Update', shortLabel: 'UPDATE' }
} satisfies Record<RingtoneTab, { title: string; shortLabel: string }>;

const RingtoneCardIcon = defineComponent({
  props: {
    eventType: {
      type: String as PropType<RingtoneEventType>,
      required: true
    }
  },
  setup(props) {
    return () => h('span', { class: ['ringtone-mark', `ringtone-mark--${props.eventType}`] }, [
      h(props.eventType === 'voom' ? RadioTower : props.eventType === 'theater' ? Clapperboard : props.eventType === 'call' ? Phone : MessageCircle, { size: 18, strokeWidth: 2.2 })
    ]);
  }
});

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const activeTab = computed<RingtoneTab>(() => {
  if (route.name === 'service-keepalive') return 'keepalive';
  if (route.name === 'service-update') return 'updates';
  return 'ringtones';
});
const importError = ref('');
const notificationAuthMessage = ref('');
const keepAliveStatus = ref<KeepAliveRuntimeStatus>(getKeepAliveStatus());
const appUpdateStatus = ref<AppUpdateStatus>(getAppUpdateStatus());
const appUpdateBusy = ref(false);
const nativeReleaseStatus = ref<NativeReleaseStatus>(createInitialNativeReleaseStatus());
const nativeReleaseBusy = ref(false);
const iosUpdateSource = ref<IosUpdateSourceLink | null>(null);
const ringtoneScopeTab = ref<RingtoneScopeTab>('global');
let unsubscribeKeepAliveStatus: (() => void) | null = null;
let unsubscribeAppUpdateStatus: (() => void) | null = null;

const ringtoneScopeTabs = [
  { id: 'global' as RingtoneScopeTab, label: 'Global', icon: Globe2 },
  { id: 'characters' as RingtoneScopeTab, label: 'Characters', icon: UsersRound }
];

const activeTabMeta = computed(() => pageMeta[activeTab.value]);
const keepAliveSettings = computed(() => normalizeKeepAliveSettings(store.settings?.keepAlive));
const ringtoneSettings = computed(() => normalizeRingtoneSettings(store.settings?.ringtoneSettings));
const keepAliveModeLabel = computed(() => {
  if (!keepAliveStatus.value.enabled) return 'Ready';
  if (keepAliveStatus.value.native) return keepAliveStatus.value.nativeServiceActive ? 'Native' : 'Starting';
  return 'Active';
});
const keepAliveSummary = computed(() => {
  if (!keepAliveStatus.value.enabled) return keepAliveStatus.value.native ? '原生前台服务、通知与后台唤醒' : '静音音频、系统通知与心跳恢复';
  if (keepAliveStatus.value.nativeServiceActive) return 'Android 前台服务正在提高后台存活率';
  if (keepAliveStatus.value.silentAudioActive || keepAliveStatus.value.webAudioActive) return '音频通道已保持，后台运行仍取决于系统';
  return '等待一次触摸恢复音频通道';
});
const keepAliveSignal = computed(() => {
  if (!keepAliveStatus.value.enabled) return '未开启';
  if (keepAliveStatus.value.native) return keepAliveStatus.value.nativeServiceActive ? '原生运行' : '启动中';
  if (keepAliveStatus.value.silentAudioActive || keepAliveStatus.value.webAudioActive) return '运行中';
  return '待恢复';
});
const keepAlivePlatformLabel = computed(() => {
  const platformLabel = keepAliveStatus.value.platform === 'ios' ? 'iOS' : keepAliveStatus.value.platform === 'android' ? 'Android' : 'Desktop';
  if (keepAliveStatus.value.native) return `${platformLabel} App`;
  return keepAliveStatus.value.standalone ? `${platformLabel} PWA` : platformLabel;
});
const audioStateLabel = computed(() => keepAliveStatus.value.silentAudioActive || keepAliveStatus.value.webAudioActive ? '运行' : keepAliveSettings.value.silentAudio ? '待机' : '关闭');
const nativeServiceStateLabel = computed(() => keepAliveStatus.value.nativeServiceActive ? '运行' : keepAliveStatus.value.enabled ? '启动中' : '关闭');
const notificationStateLabel = computed(() => {
  if (!keepAliveStatus.value.notificationSupported) return '不支持';
  if (keepAliveStatus.value.notificationPermission === 'granted') return '允许';
  if (keepAliveStatus.value.notificationPermission === 'denied') return '拒绝';
  return '待授权';
});
const wakeStateLabel = computed(() => {
  if (!keepAliveStatus.value.wakeLockSupported) return '受限';
  if (keepAliveStatus.value.native ? keepAliveStatus.value.nativeWakeLockActive : keepAliveStatus.value.wakeLockActive) return '运行';
  return keepAliveSettings.value.wakeLock ? '待机' : '关闭';
});
const canRequestNotificationPermission = computed(() => keepAliveSettings.value.notifications
  && keepAliveStatus.value.notificationSupported
  && keepAliveStatus.value.notificationPermission === 'default');
const keepAliveAlert = computed(() => {
  if (notificationAuthMessage.value) return notificationAuthMessage.value;
  if (keepAliveStatus.value.lastError) return keepAliveStatus.value.lastError;
  if (keepAliveStatus.value.native && !keepAliveStatus.value.batteryOptimizationsIgnored) return '请允许忽略电池优化，减少系统在锁屏后停止后台服务。';
  if (keepAliveStatus.value.native && keepAliveStatus.value.enabled) return '原生前台服务已启用；Android 会显示一条不可滑除的保活通知。';
  if (keepAliveStatus.value.platform === 'ios' && !keepAliveStatus.value.standalone) return 'iOS 浏览器模式下，后台通知与音频会更容易被系统收紧。';
  if (keepAliveStatus.value.platform === 'android' && !keepAliveStatus.value.wakeLockSupported) return '当前 Android WebView 未开放亮屏守护，保活会使用音频与通知。';
  if (keepAliveStatus.value.notificationPermission === 'denied') return '系统通知权限已拒绝，角色事件仍会播放铃声。';
  return '';
});
const backgroundReliabilityNote = computed(() => {
  if (keepAliveStatus.value.native) {
    if (!keepAliveStatus.value.enabled) return 'Android 开启保活后会使用原生前台服务与 CPU 唤醒；建议同时允许忽略电池优化。主动消息仍不保证精确时间，强制停止后不会运行。';
    return keepAliveStatus.value.batteryOptimizationsIgnored
      ? 'Android 已使用原生前台服务与 CPU 唤醒，并已忽略电池优化。主动消息仍按尽力模式运行，不保证精确时间，强制停止后不会运行。'
      : 'Android 已使用原生前台服务与 CPU 唤醒；请允许忽略电池优化以提高锁屏存活率。主动消息仍不保证精确时间，强制停止后不会运行。';
  }
  if (keepAliveStatus.value.platform === 'ios') return 'iOS 可能暂停后台网页或 WebView；恢复 App 或页面时会立即补检，但锁屏和后台不保证，强制关闭后不会运行。';
  return '浏览器或 PWA 可能冻结后台定时器；恢复页面或重新联网时会立即补检，但后台不保证，关闭页面后不会运行。';
});
const appUpdatePhaseLabel = computed(() => {
  const phaseLabels: Record<AppUpdateStatus['phase'], string> = {
    idle: '准备',
    checking: '检查中',
    latest: '已最新',
    downloaded: '可安装',
    updated: '安装中',
    unsupported: '不可用',
    error: '错误'
  };
  return phaseLabels[appUpdateStatus.value.phase];
});
const appUpdateRuntimeLabel = computed(() => import.meta.env.PROD ? 'PWA' : 'Dev');
const appUpdateCheckedLabel = computed(() => formatUpdateTime(appUpdateStatus.value.lastCheckedAt));
const appUpdateWorkerLabel = computed(() => {
  if (!appUpdateStatus.value.supported) return '不可用';
  if (appUpdateStatus.value.registrationReady) return 'Service Worker';
  return '启动中';
});
const appUpdatePackageLabel = computed(() => {
  if (appUpdateStatus.value.hasWaitingWorker) return '已下载';
  if (appUpdateStatus.value.hasInstallingWorker || appUpdateStatus.value.phase === 'checking') return '下载中';
  if (appUpdateStatus.value.phase === 'latest') return '已最新';
  return '待检查';
});
const appUpdateClientLabel = computed(() => appUpdateStatus.value.controlled ? 'PWA 缓存' : '浏览器直连');
const canCheckAppUpdate = computed(() => appUpdateStatus.value.supported && appUpdateStatus.value.phase !== 'checking' && !appUpdateBusy.value);
const canInstallAppUpdate = computed(() => appUpdateStatus.value.hasWaitingWorker && !appUpdateBusy.value);
const appUpdateDownloadHint = computed(() => {
  if (appUpdateStatus.value.phase === 'checking') return '正在连接服务器';
  if (!appUpdateStatus.value.supported) return import.meta.env.PROD ? '当前浏览器不可用' : '生产环境可用';
  return '手动拉取最新资源';
});
const appUpdateBrowserNote = computed(() => {
  if (!import.meta.env.PROD) return '开发服务器会禁用 Service Worker；请用 npm run build 后的预览或线上 HTTPS 地址测试真实更新。';
  if (!appUpdateStatus.value.supported) return '只有支持 Service Worker 的安全上下文浏览器可以执行网页热更新。';
  return '检查会下载新资源；安装只会在新版本完整进入等待状态后启用。';
});
const nativeReleasePhaseLabel = computed(() => ({
  idle: '待检查',
  checking: '检查中',
  latest: '已最新',
  available: '可下载',
  opening: '处理中',
  unsupported: '不适用',
  error: '检查失败'
})[nativeReleaseStatus.value.phase]);

onMounted(() => {
  void store.hydrate();
  if (activeTab.value === 'keepalive') {
    unsubscribeKeepAliveStatus = subscribeKeepAliveStatus((nextStatus) => {
      keepAliveStatus.value = nextStatus;
    });
  }
  if (activeTab.value === 'updates') {
    unsubscribeAppUpdateStatus = subscribeAppUpdateStatus((nextStatus) => {
      appUpdateStatus.value = nextStatus;
    });
    void refreshAppUpdateStatus();
    if (nativeReleaseStatus.value.supported) void runNativeReleaseCheck();
  }
});

onBeforeUnmount(() => {
  unsubscribeKeepAliveStatus?.();
  unsubscribeAppUpdateStatus?.();
});

function goBack() {
  if (activeTab.value !== 'ringtones') {
    void router.push({ name: 'services' });
    return;
  }
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}

function formatUpdateTime(timestamp: number) {
  if (!timestamp) return '尚未检查';
  return `上次检查 ${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(timestamp)}`;
}

async function runAppUpdateCheck() {
  if (!canCheckAppUpdate.value) return;
  appUpdateBusy.value = true;
  try {
    await checkForAppUpdate();
  } finally {
    appUpdateBusy.value = false;
  }
}

async function runAppUpdateInstall() {
  if (!canInstallAppUpdate.value) return;
  appUpdateBusy.value = true;
  try {
    await installDownloadedAppUpdate();
  } finally {
    appUpdateBusy.value = false;
  }
}

async function runNativeReleaseCheck() {
  if (nativeReleaseBusy.value || !nativeReleaseStatus.value.supported) return;
  nativeReleaseBusy.value = true;
  nativeReleaseStatus.value = { ...nativeReleaseStatus.value, phase: 'checking', message: '正在检查受保护的安装包版本…' };
  try {
    nativeReleaseStatus.value = await checkNativeRelease();
    if (nativeReleaseStatus.value.platform === 'ios') {
      try {
        await loadIosUpdateSource();
      } catch {
        iosUpdateSource.value = null;
      }
    }
  } finally {
    nativeReleaseBusy.value = false;
  }
}

async function loadIosUpdateSource() {
  if (iosUpdateSource.value && iosUpdateSource.value.expiresAt > Date.now() + 60_000) return iosUpdateSource.value;
  iosUpdateSource.value = await fetchIosUpdateSourceLink();
  return iosUpdateSource.value;
}

function selectIosUpdateSource(event: Event) {
  if (event.currentTarget instanceof HTMLInputElement) event.currentTarget.select();
}

async function runNativeReleaseAction() {
  if (nativeReleaseBusy.value) return;
  nativeReleaseBusy.value = true;
  nativeReleaseStatus.value = {
    ...nativeReleaseStatus.value,
    phase: 'opening',
    message: nativeReleaseStatus.value.platform === 'ios' ? '正在生成受保护的更新源…' : '正在下载并校验 APK…'
  };
  try {
    if (nativeReleaseStatus.value.platform === 'ios') {
      const source = await loadIosUpdateSource();
      const expiry = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(source.expiresAt);
      try {
        await writeClipboardText(source.url);
        nativeReleaseStatus.value = { ...nativeReleaseStatus.value, phase: 'available', message: `更新源已复制，有效期至 ${expiry}。` };
      } catch {
        nativeReleaseStatus.value = { ...nativeReleaseStatus.value, phase: 'available', message: `自动复制失败，已在下方显示更新源；请长按复制。有效期至 ${expiry}。` };
      }
      return;
    }
    const release = nativeReleaseStatus.value.release;
    if (!release) throw new Error('请先检查并获取最新 Android 安装包。');
    const result = await installNativeRelease(release);
    nativeReleaseStatus.value = {
      ...nativeReleaseStatus.value,
      phase: result === 'permission-required' ? 'available' : 'opening',
      message: result === 'permission-required'
        ? '已打开“安装未知应用”授权页；授权后返回 BabyLink，再次点击应用内更新。'
        : result === 'browser-download'
          ? '当前版本的内置安装器存在兼容性问题，已打开浏览器；请下载 APK 后点击文件完成覆盖安装。'
          : 'APK 校验通过，正在等待 Android 系统确认覆盖安装。'
    };
  } catch (error) {
    nativeReleaseStatus.value = { ...nativeReleaseStatus.value, phase: 'error', message: error instanceof Error ? error.message : '原生更新操作失败。' };
  } finally {
    nativeReleaseBusy.value = false;
  }
}

async function downloadIosRelease() {
  const release = nativeReleaseStatus.value.release;
  if (!release || nativeReleaseBusy.value) return;
  nativeReleaseBusy.value = true;
  try {
    await openNativeReleaseDownload(release);
  } catch (error) {
    nativeReleaseStatus.value = { ...nativeReleaseStatus.value, phase: 'error', message: error instanceof Error ? error.message : '无法下载 IPA。' };
  } finally {
    nativeReleaseBusy.value = false;
  }
}

function cloneAsset(asset: RingtoneAsset): RingtoneAsset {
  return { ...asset };
}

function cloneRingtoneSettings(settings: AppRingtoneSettings): AppRingtoneSettings {
  return {
    enabled: settings.enabled,
    global: {
      voom: cloneAsset(settings.global.voom),
      message: cloneAsset(settings.global.message),
      theater: cloneAsset(settings.global.theater),
      call: cloneAsset(settings.global.call)
    },
    characters: Object.fromEntries(Object.entries(settings.characters).map(([characterId, entry]) => [
      characterId,
      {
        characterId: entry.characterId,
        ...(entry.voom ? { voom: cloneAsset(entry.voom) } : {}),
        ...(entry.message ? { message: cloneAsset(entry.message) } : {}),
        ...(entry.theater ? { theater: cloneAsset(entry.theater) } : {}),
        ...(entry.call ? { call: cloneAsset(entry.call) } : {})
      }
    ]))
  };
}

function globalRingtone(eventType: RingtoneEventType) {
  return ringtoneSettings.value.global[eventType];
}

function characterRingtone(characterId: string, eventType: RingtoneEventType) {
  return ringtoneSettings.value.characters[characterId]?.[eventType] ?? null;
}

function effectiveRingtone(characterId: string, eventType: RingtoneEventType) {
  return characterRingtone(characterId, eventType) ?? globalRingtone(eventType);
}

function characterAssetLabel(characterId: string, eventType: RingtoneEventType) {
  const customAsset = characterRingtone(characterId, eventType);
  return customAsset ? customAsset.name : '继承全局';
}

function formatAssetMeta(asset: RingtoneAsset) {
  if (asset.source === 'default') return 'Default';
  if (!asset.size) return asset.mimeType || 'Audio';
  const size = asset.size >= 1024 * 1024
    ? `${(asset.size / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(asset.size / 1024))} KB`;
  return `${asset.mimeType || 'Audio'} · ${size}`;
}

function formatReleaseSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '未知大小';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getFileExtension(fileName: string) {
  return fileName.split('.').pop()?.trim().toLowerCase() ?? '';
}

function inferMimeType(file: File) {
  return file.type || mimeByExtension[getFileExtension(file.name)] || 'audio/mpeg';
}

function isSupportedAudioFile(file: File) {
  if (file.type.startsWith('audio/')) return true;
  return supportedAudioExtensions.includes(getFileExtension(file.name));
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取音频失败')));
    reader.readAsDataURL(file);
  });
}

async function createImportedRingtoneAsset(file: File): Promise<RingtoneAsset> {
  if (!isSupportedAudioFile(file)) throw new Error('请选择 MP3、M4A、AAC、WAV、OGG、WEBM 或 FLAC 音频。');
  return {
    id: createId('ringtone'),
    name: file.name || '自定义铃声',
    url: await readFileAsDataUrl(file),
    mimeType: inferMimeType(file),
    size: file.size,
    source: 'imported',
    updatedAt: Date.now()
  };
}

async function saveRingtoneSettings(nextRingtoneSettings: AppRingtoneSettings) {
  const currentSettings = normalizeAppSettings(store.settings);
  await store.saveSettings({
    ...currentSettings,
    ringtoneSettings: normalizeRingtoneSettings(nextRingtoneSettings)
  });
}

async function toggleRingtoneEnabled() {
  const nextRingtoneSettings = cloneRingtoneSettings(ringtoneSettings.value);
  nextRingtoneSettings.enabled = !ringtoneSettings.value.enabled;
  await saveRingtoneSettings(nextRingtoneSettings);
}

async function saveKeepAliveSettings(nextKeepAliveSettings: AppKeepAliveSettings, requestNotifications = false) {
  const currentSettings = normalizeAppSettings(store.settings);
  const normalizedKeepAlive = normalizeKeepAliveSettings(nextKeepAliveSettings);
  await store.saveSettings({
    ...currentSettings,
    keepAlive: normalizedKeepAlive
  });
  if (normalizedKeepAlive.enabled) await startKeepAlive(normalizedKeepAlive, { requestNotifications });
  else stopKeepAlive();
}

async function toggleKeepAlive() {
  const nextEnabled = !keepAliveSettings.value.enabled;
  await saveKeepAliveSettings({ ...keepAliveSettings.value, enabled: nextEnabled }, nextEnabled && keepAliveSettings.value.notifications);
}

async function updateKeepAliveOption(option: keyof Pick<AppKeepAliveSettings, 'silentAudio' | 'notifications' | 'wakeLock'>, event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  if (option === 'notifications') notificationAuthMessage.value = '';
  await saveKeepAliveSettings({ ...keepAliveSettings.value, [option]: checked }, option === 'notifications' && checked && keepAliveSettings.value.enabled);
}

async function authorizeNotifications() {
  notificationAuthMessage.value = '正在请求通知权限...';
  const permission = await requestKeepAliveNotificationPermission();
  if (permission === 'granted') notificationAuthMessage.value = '通知已授权，角色消息和 VOOM 会通过系统通知提醒。';
  else if (permission === 'denied') notificationAuthMessage.value = `通知权限已被拒绝，请在${keepAliveStatus.value.native ? '应用' : '浏览器或系统'}设置里手动允许。`;
  else if (permission === 'unsupported') notificationAuthMessage.value = '当前浏览器不支持网页通知。';
  else notificationAuthMessage.value = '浏览器没有弹出授权窗口，请检查地址栏权限、系统通知设置，或安装为 PWA 后再试。';
  if (keepAliveSettings.value.enabled) await startKeepAlive(keepAliveSettings.value);
}

async function authorizeNativeBackground() {
  notificationAuthMessage.value = '正在打开 Android 电池优化授权…';
  const opened = await requestNativeKeepAliveBatteryAccess();
  notificationAuthMessage.value = opened ? '请在系统弹窗中允许 BabyLink 忽略电池优化。' : '当前版本不支持原生电池优化授权。';
}

async function importRingtone(scope: RingtoneScope, eventType: RingtoneEventType, event: Event, characterId = '') {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  try {
    importError.value = '';
    const asset = await createImportedRingtoneAsset(file);
    const nextRingtoneSettings = cloneRingtoneSettings(ringtoneSettings.value);
    if (scope === 'global') {
      nextRingtoneSettings.global[eventType] = asset;
    } else if (characterId) {
      nextRingtoneSettings.characters[characterId] = {
        ...(nextRingtoneSettings.characters[characterId] ?? { characterId }),
        characterId,
        [eventType]: asset
      };
    }
    await saveRingtoneSettings(nextRingtoneSettings);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : '导入音频失败';
  }
}

async function resetGlobal(eventType: RingtoneEventType) {
  const nextRingtoneSettings = cloneRingtoneSettings(ringtoneSettings.value);
  nextRingtoneSettings.global[eventType] = createDefaultRingtoneSettings().global[eventType];
  await saveRingtoneSettings(nextRingtoneSettings);
}

async function resetCharacter(characterId: string, eventType: RingtoneEventType) {
  const nextRingtoneSettings = cloneRingtoneSettings(ringtoneSettings.value);
  const nextCharacterSettings = nextRingtoneSettings.characters[characterId];
  if (!nextCharacterSettings) return;

  delete nextCharacterSettings[eventType];
  if (ringtoneEventTypes.every((currentEventType) => !nextCharacterSettings[currentEventType])) delete nextRingtoneSettings.characters[characterId];
  await saveRingtoneSettings(nextRingtoneSettings);
}
</script>

<style scoped>
.ringtone-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 0;
  overflow-x: hidden;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.54), transparent 30%),
    radial-gradient(circle at 94% 10%, rgba(6, 199, 85, 0.14), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 52%, #edf3f1 100%);
}

.ringtone-topbar {
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  min-width: 0;
  background: rgba(251, 252, 251, 0.9);
  backdrop-filter: blur(18px);
}

.ringtone-title-button {
  display: inline-flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  margin-right: auto;
  padding: 0;
  color: inherit;
}

.ringtone-title-button .top-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  color: rgba(17, 17, 17, 0.54);
  font-size: 12px;
  font-weight: 900;
  line-height: 1;
}

.ringtone-master-switch {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 42px;
  min-height: 34px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: rgba(17, 17, 17, 0.48);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.045), 0 8px 20px rgba(16, 24, 20, 0.045);
}

.ringtone-master-switch.active {
  color: #138046;
  background: #eef8f2;
}

.ringtone-master-switch i {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 24px;
  border-radius: 999px;
  background: #f1f3f2;
  color: #8a928e;
}

.ringtone-master-switch.active i {
  background: #06c755;
  color: #ffffff;
}

.ringtone-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px calc(16px + var(--safe-right)) calc(22px + var(--safe-bottom)) calc(16px + var(--safe-left));
}

.ringtone-panel {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 32px rgba(16, 24, 20, 0.06);
  container-type: inline-size;
}

.ringtone-content {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.ringtone-tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  padding: 7px calc(8px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(8px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.ringtone-tab {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 46px;
  padding: 6px 2px;
  border-radius: 13px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}

.ringtone-tab.active {
  background: #eef8f1;
  color: #111111;
}

.ringtone-tab svg {
  width: 19px;
  height: 19px;
}

.ringtone-tab span {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-section,
.keepalive-section,
.app-update-section,
.character-section {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.character-section {
  margin-top: 2px;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
  padding: 0 2px;
  color: #64736a;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-heading-row b {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  min-height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(241, 243, 246, 0.96);
  color: #79808a;
  font-size: 10px;
  font-weight: 900;
}

.ringtone-grid,
.character-ringtones {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.ringtone-card,
.keepalive-card,
.mini-ringtone,
.empty-panel {
  min-width: 0;
  border: 1px solid rgba(17, 17, 17, 0.04);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(248, 249, 252, 0.96));
  box-shadow: 0 12px 30px rgba(26, 30, 38, 0.05);
  overflow: hidden;
}

.keepalive-card {
  display: grid;
  gap: 14px;
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 34px rgba(24, 31, 28, 0.055);
}

.keepalive-card.is-active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(249, 252, 250, 0.96));
}

.keepalive-head,
.keepalive-identity {
  display: flex;
  align-items: center;
  min-width: 0;
}

.keepalive-head {
  justify-content: space-between;
  gap: 14px;
}

.keepalive-identity {
  gap: 11px;
  min-width: 0;
}

.keepalive-mark {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: #f4f7f5;
  color: #1d2923;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.045);
}

.keepalive-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.keepalive-copy strong {
  overflow: hidden;
  color: #171a1d;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-copy span {
  overflow: hidden;
  color: #7a8280;
  font-size: 11px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-power {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  width: 40px;
  height: 40px;
  min-height: 40px;
  border-radius: 14px;
  background: #f3f5f4;
  color: #717a76;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.045);
}

.keepalive-card.is-active .keepalive-power {
  background: #141a17;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(20, 26, 23, 0.16);
}

.keepalive-signal {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 10px 12px;
  border-radius: 16px;
  background: #f7f8f7;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.keepalive-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #c9cfcc;
}

.keepalive-dot.active {
  background: #06c755;
  box-shadow: 0 0 0 4px rgba(6, 199, 85, 0.12);
}

.keepalive-signal strong {
  overflow: hidden;
  color: #202522;
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-signal small {
  color: #848b88;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.keepalive-states,
.keepalive-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.keepalive-state {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  column-gap: 6px;
  row-gap: 3px;
  min-width: 0;
  min-height: 50px;
  padding: 9px 10px;
  border-radius: 16px;
  background: #f5f6f5;
  color: #737b77;
  line-height: 1;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.keepalive-state svg {
  grid-row: 1 / span 2;
}

.keepalive-state b {
  overflow: hidden;
  color: #272d2a;
  font-size: 10px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-state small {
  overflow: hidden;
  color: #8c938f;
  font-size: 10px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-state.active {
  background: #eef8f2;
  color: #138046;
}

.keepalive-state.warn {
  background: #fff3f5;
  color: #b51f36;
}

.keepalive-state.muted {
  color: #b0b7b3;
}

.keepalive-auth {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  min-height: 38px;
  border-radius: 999px;
  background: #141a17;
  color: #ffffff;
  font-size: 12px;
  font-weight: 900;
  box-shadow: 0 10px 22px rgba(20, 26, 23, 0.14);
}

.keepalive-auth:active {
  transform: translateY(1px);
}

.keepalive-option {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  min-height: 38px;
  padding: 0 10px 0 12px;
  border-radius: 999px;
  background: #f7f8f7;
  color: #6f7773;
  font-size: 11px;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.keepalive-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.keepalive-option span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-option i {
  position: relative;
  flex: 0 0 auto;
  width: 28px;
  height: 16px;
  border-radius: 999px;
  background: #dfe4e1;
}

.keepalive-option i::after {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(17, 17, 17, 0.12);
  content: '';
  transition: transform 0.16s ease;
}

.keepalive-option.active {
  background: #eef8f2;
  color: #138046;
}

.keepalive-option.active i {
  background: #06c755;
}

.keepalive-option.active i::after {
  transform: translateX(12px);
}

.keepalive-note {
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f7f8f7;
  color: #737b77;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.app-update-console {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.05);
  border-radius: 20px;
  background: rgba(250, 251, 250, 0.94);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86), 0 12px 28px rgba(16, 24, 20, 0.055);
  overflow: hidden;
}

.app-update-console.is-downloaded,
.app-update-console.is-ready {
  border-color: rgba(6, 199, 85, 0.16);
  background: #f2faf5;
}

.app-update-console.is-error,
.app-update-console.is-unsupported {
  border-color: rgba(239, 68, 90, 0.11);
  background: #fff8f9;
}

.app-update-console-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-update-title-copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.app-update-title-copy small {
  color: #138046;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.app-update-title-copy strong {
  overflow: hidden;
  color: #151a17;
  font-size: 16px;
  font-weight: 950;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-update-title-copy span {
  overflow: hidden;
  color: #6f7773;
  font-size: 11px;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-update-badge {
  flex: 0 0 auto;
  min-width: 50px;
  padding: 6px 9px;
  border-radius: 999px;
  background: #eef8f2;
  color: #138046;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  text-align: center;
  white-space: nowrap;
}

.app-update-console.is-error .app-update-badge,
.app-update-console.is-unsupported .app-update-badge {
  background: #fff0f2;
  color: #b51f36;
}

.app-update-summary {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  background: #ffffff;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
}

.app-update-summary strong {
  color: #1b201d;
  font-size: 13px;
  font-weight: 950;
  line-height: 1.25;
}

.app-update-summary span {
  color: #69716d;
  font-size: 11px;
  font-weight: 760;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.app-update-flow,
.app-update-actions {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.app-update-actions {
  grid-template-columns: 1fr;
}

.app-update-action,
.app-update-step {
  display: grid;
  align-items: center;
  min-width: 0;
  color: #737b77;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.app-update-action {
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
  min-height: 54px;
  padding: 10px 12px;
  border-radius: 17px;
  background: rgba(247, 248, 247, 0.94);
  text-align: left;
}

.app-update-action.primary {
  background: #eef8f2;
  color: #138046;
}

.app-update-action:disabled {
  color: #a9b0ac;
  background: rgba(247, 248, 247, 0.72);
}

.app-update-action span,
.app-update-step small {
  display: grid;
  min-width: 0;
}

.app-update-action b,
.app-update-action small,
.app-update-step b,
.app-update-step small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-update-action b,
.app-update-step b {
  color: #202722;
  font-size: 12px;
  font-weight: 950;
}

.app-update-action small,
.app-update-step small {
  color: #8b938f;
  font-size: 10px;
  font-weight: 850;
}

.app-update-action.primary small {
  color: #138046;
}

.app-update-step {
  grid-template-columns: 30px minmax(60px, auto) minmax(0, 1fr);
  gap: 8px;
  min-height: 40px;
  padding: 8px 10px;
  border-radius: 14px;
  background: #ffffff;
}

.app-update-step.active {
  background: #eef8f2;
  color: #138046;
}

.app-update-step.warn {
  background: #fff3f5;
  color: #b51f36;
}

.app-update-step.muted {
  color: #b0b7b3;
}

.app-update-note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 10px 12px;
  border-radius: 14px;
  background: #f7f8f7;
  color: #737b77;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.app-update-note.warn {
  background: #fff3f5;
  color: #b51f36;
}

.app-update-note svg {
  flex: 0 0 auto;
  margin-top: 1px;
}

.native-release-card {
  display: grid;
  gap: 13px;
  min-width: 0;
  width: 100%;
  padding: 16px;
  overflow: hidden;
  border: 1px solid rgba(44, 111, 75, 0.1);
  border-radius: 20px;
  background: linear-gradient(145deg, rgba(248, 253, 250, 0.98), rgba(236, 247, 241, 0.96));
}

.native-release-card > header,
.native-release-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.native-release-card > header > div,
.native-release-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.native-release-card > header small,
.native-release-copy > span,
.native-release-tip {
  color: var(--muted);
  font-size: 11px;
}

.native-release-source {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.native-release-source > span {
  color: #58635d;
  font-size: 10px;
  font-weight: 800;
}

.native-release-source input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  padding: 9px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  color: #315a45;
  font-size: 11px;
  line-height: 1.35;
  box-shadow: inset 0 0 0 1px rgba(44, 111, 75, 0.12);
}

.native-release-manual {
  justify-self: start;
  padding: 3px 0;
  color: #315a45;
  font-size: 11px;
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.native-release-card > header strong {
  font-size: 16px;
}

.native-release-card > header > span {
  max-width: 42vw;
  padding: 5px 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(28, 128, 71, 0.1);
  color: #197141;
  font-size: 10px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.native-release-card.is-error > header > span,
.native-release-copy .mandatory {
  color: #a92e2e;
}

.native-release-copy > strong {
  font-size: 14px;
}

.native-release-copy p {
  margin: 5px 0 0;
  max-width: 100%;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
  word-break: break-word;
}

.native-release-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
}

.native-release-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 40px;
  padding: 0 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.9);
  color: #24342b;
  font-size: 12px;
  font-weight: 850;
}

.native-release-actions button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.native-release-actions button.primary {
  background: #111111;
  color: #ffffff;
}

.native-release-actions button:disabled {
  opacity: 0.5;
}

.native-release-tip {
  margin: 0;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

@media (max-width: 340px) {
  .native-release-actions {
    grid-template-columns: 1fr;
  }
}

.keepalive-dashboard {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.045);
  border-radius: 26px;
  background:
    radial-gradient(circle at 18% 12%, rgba(6, 199, 85, 0.18), transparent 34%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 249, 0.94));
  box-shadow: 0 18px 42px rgba(22, 29, 26, 0.075);
  overflow: hidden;
}

.keepalive-dashboard.is-active {
  border-color: rgba(6, 199, 85, 0.13);
  background:
    radial-gradient(circle at 18% 12%, rgba(6, 199, 85, 0.24), transparent 34%),
    radial-gradient(circle at 94% 0%, rgba(255, 221, 232, 0.58), transparent 28%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(245, 252, 248, 0.95));
}

.keepalive-hero {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 44px;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.keepalive-orbit {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
  color: #17211b;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.045), 0 12px 24px rgba(20, 26, 23, 0.08);
}

.keepalive-pulse {
  position: absolute;
  right: 10px;
  top: 10px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #c8cfcb;
}

.keepalive-pulse.active {
  background: #06c755;
  box-shadow: 0 0 0 5px rgba(6, 199, 85, 0.14);
}

.keepalive-hero-copy {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.keepalive-hero-copy small {
  color: #138046;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.keepalive-hero-copy strong {
  overflow: hidden;
  color: #151a17;
  font-size: 17px;
  font-weight: 950;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-hero-copy span {
  display: -webkit-box;
  overflow: hidden;
  color: #6f7773;
  font-size: 12px;
  font-weight: 760;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.keepalive-status-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.keepalive-status-strip span {
  display: grid;
  gap: 4px;
  min-width: 0;
  min-height: 58px;
  align-content: center;
  padding: 10px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.64);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
}

.keepalive-status-strip small {
  overflow: hidden;
  color: #8b938f;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.05em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.keepalive-status-strip strong {
  overflow: hidden;
  color: #202722;
  font-size: 12px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-states {
  grid-template-columns: 1fr;
  gap: 9px;
}

.keepalive-state {
  grid-template-columns: auto minmax(0, 1fr) auto;
  justify-items: stretch;
  gap: 10px;
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 18px;
  background: rgba(247, 248, 247, 0.92);
}

.keepalive-state svg {
  grid-row: auto;
  align-self: center;
}

.keepalive-state > span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.keepalive-state b,
.keepalive-state small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-state b {
  font-size: 11px;
}

.keepalive-state em {
  align-self: center;
  min-width: 44px;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  color: #77807b;
  font-size: 10px;
  font-style: normal;
  font-weight: 900;
  text-align: center;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
}

.keepalive-state.active em {
  background: rgba(6, 199, 85, 0.12);
  color: #138046;
}

.keepalive-state.warn em {
  background: rgba(239, 68, 90, 0.1);
  color: #b51f36;
}

.keepalive-options {
  grid-template-columns: 1fr;
  gap: 10px;
}

.keepalive-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  min-height: 58px;
  padding: 10px 12px;
  border-radius: 20px;
  background: rgba(247, 248, 247, 0.94);
}

.keepalive-option > svg {
  color: #8a928e;
}

.keepalive-option.active > svg {
  color: #138046;
}

.keepalive-option span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.keepalive-option b,
.keepalive-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keepalive-option b {
  color: #202722;
  font-size: 12px;
  font-weight: 950;
}

.keepalive-option small {
  color: #8b938f;
  font-size: 10px;
  font-weight: 850;
}

.keepalive-option.active small {
  color: #138046;
}

.ringtone-card {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border-radius: 24px;
}

.ringtone-mark {
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 16px;
  color: #111111;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
}

.ringtone-mark--voom {
  background:
    radial-gradient(circle at top right, rgba(255, 221, 232, 0.9), transparent 34%),
    linear-gradient(135deg, #fff8fb, #f1f6fb 56%, #eef8f1);
}

.ringtone-mark--message {
  background:
    radial-gradient(circle at top left, rgba(215, 231, 255, 0.86), transparent 34%),
    linear-gradient(135deg, #f8fbff, #edf2fb 56%, #eef8f1);
}

.ringtone-mark--theater {
  background:
    radial-gradient(circle at top right, rgba(255, 235, 188, 0.88), transparent 34%),
    linear-gradient(135deg, #fffdf7, #f4f0ff 56%, #eef8f1);
}

.ringtone-mark--call {
  background:
    radial-gradient(circle at top right, rgba(214, 244, 224, 0.92), transparent 34%),
    linear-gradient(135deg, #f8fffb, #eef7f3 56%, #f3f2ff);
}

.ringtone-content.is-muted .ringtone-card,
.ringtone-content.is-muted .character-row {
  opacity: 0.68;
}

.ringtone-copy,
.mini-ringtone-head > div,
.character-head > div {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ringtone-copy strong,
.mini-ringtone-head strong,
.character-head strong {
  overflow: hidden;
  color: #191b1f;
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ringtone-copy span,
.mini-ringtone-head span,
.character-head span {
  overflow: hidden;
  color: #767d86;
  font-size: 11px;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ringtone-copy small {
  color: #9aa1a9;
  font-size: 10px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ringtone-actions,
.mini-actions {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.ringtone-actions {
  padding: 3px;
  border-radius: 999px;
  background: rgba(244, 246, 248, 0.72);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.035);
}

.icon-action {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  min-height: 30px;
  border-radius: 999px;
  background: transparent;
  color: #79808a;
}

.icon-action:active {
  background: rgba(255, 255, 255, 0.82);
  color: #138046;
}

.icon-action:disabled {
  color: #c2c7cc;
  background: transparent;
}

.icon-action input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.audio-preview {
  grid-column: 1 / -1;
  width: 100%;
  height: 36px;
  min-width: 0;
  border-radius: 999px;
  filter: saturate(0.9);
  accent-color: #06c755;
}

.audio-preview.compact {
  height: 34px;
}

.character-row {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(247, 248, 251, 0.94));
  box-shadow: 0 12px 30px rgba(26, 30, 38, 0.05);
}

.character-head {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.character-head .avatar {
  width: 42px;
  height: 42px;
  border-radius: 16px;
}

.mini-ringtone {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 10px;
  border-radius: 20px;
  background: rgba(244, 246, 248, 0.82);
  box-shadow: none;
}

.mini-actions .icon-action {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.04);
}

.mini-ringtone-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.mini-ringtone .ringtone-mark {
  width: 34px;
  height: 34px;
  border-radius: 14px;
}

.empty-panel {
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 10px;
  min-height: 180px;
  padding: 24px 16px;
  border-radius: 24px;
  background:
    radial-gradient(circle at top right, rgba(255, 221, 232, 0.72), transparent 34%),
    linear-gradient(135deg, #fff8fb, #f1f6fb 56%, #eef8f1);
  color: #767d86;
  font-size: 12px;
  font-weight: 800;
  text-align: center;
}

.empty-panel > svg {
  width: 40px;
  height: 40px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  color: #64736a;
  box-shadow: inset 0 0 0 1px rgba(17, 17, 17, 0.05);
}

.empty-panel p {
  margin: 0;
}

.import-error {
  position: sticky;
  bottom: 8px;
  margin: 12px 0 0;
  padding: 10px 12px;
  border-radius: 16px;
  background: rgba(255, 241, 244, 0.94);
  color: #b51f36;
  font-size: 12px;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px rgba(239, 68, 90, 0.08);
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@container (min-width: 520px) {
  .ringtone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (max-width: 360px) {
  .ringtone-panel {
    gap: 12px;
    padding: 12px;
    border-radius: 18px;
  }

  .ringtone-card,
  .keepalive-card,
  .character-row {
    gap: 10px;
    padding: 11px;
    border-radius: 20px;
  }

  .ringtone-card {
    grid-template-columns: 38px minmax(0, 1fr) max-content;
  }

  .ringtone-mark,
  .keepalive-mark,
  .character-head .avatar {
    width: 38px;
    height: 38px;
    border-radius: 14px;
  }

  .keepalive-power {
    width: 36px;
    height: 36px;
    min-height: 36px;
    border-radius: 14px;
  }

  .keepalive-signal {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .keepalive-signal small {
    grid-column: 2;
  }

  .keepalive-options,
  .keepalive-states {
    grid-template-columns: 1fr;
  }

  .ringtone-actions {
    grid-column: auto;
    justify-self: end;
  }

  .mini-ringtone {
    gap: 8px;
    padding: 9px;
    border-radius: 18px;
  }
}

@media (max-width: 420px) {
  .ringtone-main {
    padding: 8px max(10px, var(--safe-right)) calc(18px + var(--safe-bottom)) max(10px, var(--safe-left));
  }
}
</style>