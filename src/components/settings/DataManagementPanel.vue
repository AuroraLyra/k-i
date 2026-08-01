<template>
  <section class="data-dashboard">
    <header class="storage-hero">
      <div class="hero-orb hero-orb-rose" aria-hidden="true"></div>
      <div class="hero-orb hero-orb-mint" aria-hidden="true"></div>

      <div class="hero-topline">
        <span class="hero-eyebrow">YOUR SPACE</span>
        <button class="refresh-button" type="button" :disabled="storageRefreshing || Boolean(dataBusy)" aria-label="刷新数据统计" @click="refreshDataSnapshot">
          <RefreshCw :size="16" :class="{ spinning: storageRefreshing }" />
        </button>
      </div>

      <div class="hero-main">
        <div>
          <p>{{ usageTitle }}</p>
          <strong>{{ storageUsageLabel }}</strong>
          <span>{{ usageDescription }}</span>
        </div>
        <span class="hero-chip">{{ runtime.label }}</span>
      </div>

      <div class="hero-meter" role="meter" aria-label="应用存储占用" :aria-valuenow="Math.round(storagePercent)" aria-valuemin="0" aria-valuemax="100">
        <span :style="{ width: `${displayedStoragePercent}%` }"></span>
      </div>

      <div class="hero-stats">
        <article>
          <span>业务数据</span>
          <strong>{{ managedDataLabel }}</strong>
        </article>
        <article>
          <span>媒体健康</span>
          <strong>{{ mediaHealthLabel }}</strong>
        </article>
        <article>
          <span>存储保护</span>
          <strong>{{ protectionStatusLabel }}</strong>
        </article>
      </div>
    </header>

    <nav class="data-tabs" aria-label="数据管理功能">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="data-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        @click="activeTab = tab.id"
      >
        <component :is="tab.icon" :size="16" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <p v-if="dataFeedback" class="feedback" :class="dataFeedbackKind" role="status">{{ dataFeedback }}</p>

    <section v-if="activeTab === 'overview'" class="tab-content overview-tab">
      <article class="focus-card">
        <span class="focus-mark"><Sparkles :size="18" /></span>
        <div>
          <p>SPACE CHECK</p>
          <h3>{{ overviewHeading }}</h3>
          <span>{{ overviewDescription }}</span>
        </div>
      </article>

      <section class="overview-grid" aria-label="本机数据概览">
        <article class="soft-card blush-card">
          <span class="card-label">内容资料</span>
          <strong>{{ contentSectionCount }} <small>组</small></strong>
          <p>聊天、记忆、作品与收藏</p>
        </article>
        <article class="soft-card mint-card">
          <span class="card-label">可优化</span>
          <strong>{{ cleanupReadyCount }} <small>类</small></strong>
          <p>不影响核心账号资料</p>
        </article>
      </section>

      <article class="next-step-card">
        <div>
          <span class="next-step-icon"><Database :size="18" /></span>
          <div>
            <p>QUICK LOOK</p>
            <strong>{{ largestStorageLabel }}</strong>
            <span>{{ largestStorageDescription }}</span>
          </div>
        </div>
        <button type="button" @click="activeTab = 'space'">查看</button>
      </article>

      <article class="gentle-note">
        <span><ShieldCheck :size="17" /></span>
        <p>{{ protectionSummary }}</p>
      </article>
    </section>

    <section v-else-if="activeTab === 'space'" class="tab-content space-tab">
      <header class="section-heading">
        <div>
          <p>STORAGE MAP</p>
          <h3>空间去了哪里</h3>
        </div>
        <span>{{ hasSnapshot ? `${storageEntries.length} 处` : '计算中' }}</span>
      </header>

      <div v-if="hasSnapshot" class="storage-list">
        <article v-for="entry in storageEntries" :key="entry.id" class="storage-entry">
          <span class="storage-dot" :class="`dot-${entry.id}`"></span>
          <div class="storage-entry-main">
            <div>
              <strong>{{ entry.label }}</strong>
              <span>{{ entry.description }}</span>
            </div>
            <small>{{ entry.available ? formatBytes(entry.bytes) : '暂不可读' }}</small>
          </div>
          <div class="entry-meter" aria-hidden="true"><span :style="{ width: `${entryShare(entry.bytes)}%` }"></span></div>
        </article>
      </div>
      <p v-else class="empty-state">正在统计浏览器、媒体库和离线资源…</p>

      <details class="content-details">
        <summary>
          <span>
            <Database :size="16" />
            <strong>查看内容分区</strong>
          </span>
          <small>{{ contentSectionCount }} 组</small>
        </summary>
        <div class="content-section-list">
          <article v-for="section in rankedContentSections" :key="section.id">
            <div>
              <strong>{{ section.label }}</strong>
              <span>{{ section.description }}</span>
            </div>
            <small>{{ section.count }} 项 · {{ formatBytes(section.bytes) }}</small>
          </article>
        </div>
      </details>

      <article class="media-health-card" :class="{ warning: mediaMissingCount > 0 }">
        <span><Images :size="19" /></span>
        <div>
          <strong>{{ mediaHealthTitle }}</strong>
          <p>{{ mediaHealthDescription }}</p>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'clean'" class="tab-content clean-tab">
      <header class="section-heading">
        <div>
          <p>SOFT CLEANUP</p>
          <h3>轻轻整理一下</h3>
        </div>
        <span>核心资料不动</span>
      </header>

      <p class="section-copy">下面项目主要清理可再生成的媒体、候选记录和缓存；每次操作前都会再次确认。</p>

      <div class="cleanup-grid">
        <button
          v-for="action in cleanupActionStats"
          :key="action.id"
          class="cleanup-card"
          :class="`tone-${action.tone}`"
          type="button"
          :disabled="Boolean(dataBusy)"
          @click="runCleanupAction(action.id)"
        >
          <span class="cleanup-icon">
            <span v-if="dataBusy === action.id" class="button-spinner" aria-hidden="true"></span>
            <component v-else :is="action.icon" :size="17" />
          </span>
          <span class="cleanup-copy">
            <strong>{{ action.label }}</strong>
            <small>{{ action.description }}</small>
          </span>
          <em>{{ action.freedLabel }}</em>
        </button>
      </div>

      <details class="deep-clean-details">
        <summary>
          <span>
            <Trash2 :size="16" />
            <strong>深度整理</strong>
          </span>
          <small>按分区删除</small>
        </summary>
        <p>这会永久移除相应内容。账号、角色与应用配置不会出现在这里。</p>
        <div class="deep-clean-list">
          <article v-for="section in clearableContentSections" :key="section.id">
            <div>
              <strong>{{ section.label }}</strong>
              <span>{{ section.description }}</span>
            </div>
            <button type="button" :disabled="Boolean(dataBusy)" @click="clearContentSection(section)">
              {{ section.id === 'commerce' ? '重置' : '清空' }}
            </button>
          </article>
        </div>
      </details>
    </section>

    <section v-else class="tab-content protect-tab">
      <header class="section-heading">
        <div>
          <p>KEEP IT SAFE</p>
          <h3>把故事留在设备里</h3>
        </div>
        <span>{{ runtime.isNative ? 'App' : 'PWA' }}</span>
      </header>

      <article v-if="runtime.isNative" class="native-storage-card">
        <div class="native-storage-top">
          <span class="native-icon"><Smartphone :size="20" /></span>
          <div>
            <p>APP TEMPORARY FILES</p>
            <strong>应用临时文件</strong>
            <span>{{ nativeStorageSummary }}</span>
          </div>
        </div>
        <div class="native-storage-stats">
          <span>可用空间 <strong>{{ nativeAvailableLabel }}</strong></span>
          <span>临时缓存 <strong>{{ nativeCacheLabel }}</strong></span>
        </div>
        <button class="protect-action dark" type="button" :disabled="protectionBusy === 'native' || !nativeStorageAvailable" @click="clearNativeTemporaryFiles">
          <span v-if="protectionBusy === 'native'" class="button-spinner" aria-hidden="true"></span>
          <Trash2 v-else :size="16" />
          清理临时文件
        </button>
      </article>

      <template v-else>
        <article class="protection-card" :class="`state-${protectionTone}`">
          <span class="protection-icon"><ShieldCheck :size="21" /></span>
          <div>
            <p>BROWSER PROTECTION</p>
            <strong>{{ protectionCardTitle }}</strong>
            <span>{{ protectionSummary }}</span>
          </div>
          <button class="protect-action" type="button" :disabled="protectionBusy === 'persist' || persistence.status === 'granted'" @click="enableStorageProtection">
            <span v-if="protectionBusy === 'persist'" class="button-spinner" aria-hidden="true"></span>
            <ShieldCheck v-else :size="16" />
            {{ persistence.status === 'granted' ? '已开启' : '开启保护' }}
          </button>
        </article>

        <article class="install-card">
          <span class="install-icon"><Smartphone :size="19" /></span>
          <div>
            <strong>{{ browserContext.installed ? '已从主屏幕运行' : '安装为 PWA 更稳定' }}</strong>
            <p>{{ browserContext.installed ? 'PWA 运行时能获得更稳定的存储和离线体验。' : '从主屏幕图标打开，比内置浏览器更不容易丢失本地资料。' }}</p>
          </div>
          <button class="text-button" type="button" :disabled="browserContext.installed || protectionBusy === 'install'" @click="runPwaInstallAction">
            {{ browserContext.installed ? '已安装' : browserContext.installPromptAvailable ? '安装' : '指引' }}
          </button>
        </article>

        <div v-if="installGuideOpen" class="install-guide">
          <strong>建议这样使用</strong>
          <span>使用系统浏览器，添加到主屏幕后从图标打开；避免无痕模式及微信、QQ 等内置浏览器。</span>
        </div>
      </template>

      <article class="backup-reminder">
        <span><Archive :size="18" /></span>
        <div>
          <strong>重要剧情，仍建议定期备份</strong>
          <p>数据保护降低清理风险，但不能替代本地或云端备份。</p>
        </div>
      </article>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Component } from 'vue';
import { Archive, Camera, Database, ImageOff, Images, MessageCircle, RefreshCw, ShieldCheck, Smartphone, Sparkles, Trash2, Volume2 } from 'lucide-vue-next';
import { useAppStore, type ClearableDataSection, type DataCleanupAction } from '@/stores/appStore';
import { useCommerceStore } from '@/stores/commerceStore';
import { useFanficStore } from '@/stores/fanficStore';
import { useRoleOperationsStore } from '@/stores/roleOperationsStore';
import { clearNativeTemporaryFiles as clearNativeTemporaryFilesOnDevice, getNativeStorageOverview, getStorageRuntime, isNativeStorageAvailable } from '@/services/nativeStorage';
import { clearPwaResourceCache, inspectStorageInventory, inspectSupplementalContentSections, type ContentStorageSection } from '@/services/storageInventory';
import type { NativeStorageOverview, StorageInventorySnapshot } from '@/types/storage';
import { getBrowserStorageContext, promptPwaInstall, pwaInstallPromptChangeEvent, queryPersistentStorage, requestPersistentStorage, type BrowserStorageContext, type StoragePersistenceResult } from '@/utils/storageProtection';

type DataTab = 'overview' | 'space' | 'clean' | 'protect';
type CleanupTone = 'rose' | 'peach' | 'mint' | 'lilac' | 'sky' | 'butter';

interface CleanupActionConfig {
  id: DataCleanupAction;
  label: string;
  description: string;
  icon: Component;
  tone: CleanupTone;
}

const store = useAppStore();
const runtime = getStorageRuntime();
const activeTab = ref<DataTab>('overview');
const dataBusy = ref('');
const storageRefreshing = ref(false);
const dataFeedback = ref('');
const dataFeedbackKind = ref<'success' | 'error'>('success');
const dataInventory = ref<ReturnType<typeof store.getDataInventory> | null>(null);
const supplementalSections = ref<ContentStorageSection[]>([]);
const storageInventory = ref<StorageInventorySnapshot | null>(null);
const cleanupEstimates = ref<Partial<Record<DataCleanupAction, number>>>({});
const browserContext = ref<BrowserStorageContext>(getBrowserStorageContext());
const persistence = ref<StoragePersistenceResult>({ status: 'unknown', persisted: false, supported: false });
const nativeOverview = ref<NativeStorageOverview | null>(null);
const protectionBusy = ref<'persist' | 'install' | 'native' | ''>('');
const installGuideOpen = ref(false);

const tabs = [
  { id: 'overview' as const, label: '概览', icon: Sparkles },
  { id: 'space' as const, label: '空间', icon: Database },
  { id: 'clean' as const, label: '整理', icon: Trash2 },
  { id: 'protect' as const, label: '守护', icon: ShieldCheck }
];

const cleanupActions: CleanupActionConfig[] = [
  { id: 'generated-images', label: '生成图历史', description: '清理已保存的生成图片', icon: Images, tone: 'rose' },
  { id: 'message-media', label: '消息媒体缓存', description: '移除聊天中的本地媒体副本', icon: MessageCircle, tone: 'peach' },
  { id: 'user-sent-images', label: '已发送图片', description: '移除聊天和收藏里的图片', icon: Camera, tone: 'mint' },
  { id: 'sticker-local-cache', label: '贴纸缓存', description: '清理本地贴纸副本', icon: ImageOff, tone: 'lilac' },
  { id: 'image-candidates', label: '图片候选', description: '清理已不用的候选记录', icon: Sparkles, tone: 'sky' },
  { id: 'voice-audio', label: '语音音频', description: '清理保存在消息内的音频', icon: Volume2, tone: 'butter' }
];

const sectionTargets: Partial<Record<string, ClearableDataSection[]>> = {
  chatData: ['messages', 'conversationSettings'],
  favorites: ['favorites'],
  characterMemory: ['characterMemory'],
  worldBooks: ['worldBooks'],
  voomPosts: ['voomPosts'],
  smallTheaters: ['smallTheaters'],
  music: ['music'],
  stickers: ['stickers'],
  generatedImages: ['generatedImages']
};

const hasSnapshot = computed(() => Boolean(storageInventory.value));
const contentSections = computed<ContentStorageSection[]>(() => [
  ...(dataInventory.value?.sections ?? []),
  ...supplementalSections.value
]);
const contentSectionCount = computed(() => contentSections.value.length);
const managedBytes = computed(() => storageInventory.value?.contentBytes ?? contentSections.value.reduce((total, section) => total + section.bytes, 0));
const managedDataLabel = computed(() => hasSnapshot.value ? formatBytes(managedBytes.value) : '计算中');
const storageUsageBytes = computed(() => storageInventory.value?.browserUsageBytes || managedBytes.value);
const storageUsageLabel = computed(() => hasSnapshot.value ? formatBytes(storageUsageBytes.value) : '读取中');
const storagePercent = computed(() => {
  const quota = storageInventory.value?.browserQuotaBytes ?? 0;
  return quota > 0 ? Math.min(100, storageUsageBytes.value / quota * 100) : 0;
});
const displayedStoragePercent = computed(() => hasSnapshot.value ? Math.max(storagePercent.value, 2) : 18);
const usageTitle = computed(() => runtime.isNative ? 'APP LOCAL STORAGE' : 'BROWSER STORAGE');
const usageDescription = computed(() => {
  if (!hasSnapshot.value) return '正在计算本机数据，请稍候';
  const quota = storageInventory.value?.browserQuotaBytes ?? 0;
  if (!quota) return '当前环境未提供站点配额';
  return `${formatBytes(quota)} 可用配额中的 ${formatPercent(storagePercent.value)}`;
});
const storageEntries = computed(() => storageInventory.value?.entries ?? []);
const rankedContentSections = computed(() => [...contentSections.value].sort((left, right) => right.bytes - left.bytes));
const clearableContentSections = computed(() => rankedContentSections.value.filter((section) => section.clearable));
const mediaMissingCount = computed(() => storageInventory.value?.mediaHealth.missing ?? 0);
const mediaHealthLabel = computed(() => {
  if (!hasSnapshot.value) return '检测中';
  const media = storageInventory.value?.mediaHealth;
  if (!media?.expected) return '暂无媒体';
  return media.missing ? `${media.missing} 待处理` : '良好';
});
const mediaHealthTitle = computed(() => {
  if (!hasSnapshot.value) return '正在检查媒体文件';
  const media = storageInventory.value?.mediaHealth;
  if (!media?.expected) return '还没有需要检查的本地媒体';
  return media.missing ? `${media.missing} 个媒体引用无法读取` : `${media.available} 个本地媒体可正常读取`;
});
const mediaHealthDescription = computed(() => {
  const media = storageInventory.value?.mediaHealth;
  if (!media?.expected) return '后续保存的图片和音频会在这里检查状态。';
  return media.missing ? '缺失文件会在相关聊天中显示为空；可从备份恢复原始数据。' : '图片、语音和贴纸的本地文件状态正常。';
});
const cleanupActionStats = computed(() => cleanupActions.map((action) => {
  const freedBytes = cleanupEstimates.value[action.id];
  return {
    ...action,
    freedBytes,
    freedLabel: typeof freedBytes === 'number' ? (freedBytes > 0 ? formatBytes(freedBytes) : '暂无可清理') : '计算中'
  };
}));
const cleanupReadyCount = computed(() => cleanupActionStats.value.filter((action) => (action.freedBytes ?? 0) > 0).length);
const largestStorageEntry = computed(() => [...storageEntries.value].sort((left, right) => right.bytes - left.bytes)[0]);
const largestStorageLabel = computed(() => largestStorageEntry.value ? `${largestStorageEntry.value.label}占用最多` : '正在整理空间地图');
const largestStorageDescription = computed(() => largestStorageEntry.value
  ? `${largestStorageEntry.value.description} · ${formatBytes(largestStorageEntry.value.bytes)}`
  : '稍后可查看每一类数据的占用情况。');
const overviewHeading = computed(() => {
  if (!hasSnapshot.value) return '正在为你整理本地空间';
  if (storagePercent.value >= 85) return '空间有点拥挤，整理一下会更舒服';
  if (mediaMissingCount.value) return '发现需要留意的本地媒体';
  if (cleanupReadyCount.value) return '有一些轻量缓存可以整理';
  return '空间状态轻盈又稳定';
});
const overviewDescription = computed(() => {
  if (!hasSnapshot.value) return '统计会包含应用资料、媒体文件和离线资源。';
  if (storagePercent.value >= 85) return '先去“整理”清掉可再生成的内容，再继续创作。';
  if (mediaMissingCount.value) return '请优先确认备份是否完整，避免覆盖缺失的原文件。';
  if (cleanupReadyCount.value) return '缓存不会影响账号与角色资料，想要更轻盈时可随时处理。';
  return '继续放心记录你和角色之间发生的每一个瞬间。';
});
const protectionTone = computed(() => {
  if (runtime.isNative) return 'safe';
  if (browserContext.value.embeddedBrowser || storagePercent.value >= 95) return 'danger';
  if (!browserContext.value.installed || persistence.value.status !== 'granted' || storagePercent.value >= 85) return 'warn';
  return 'safe';
});
const protectionStatusLabel = computed(() => {
  if (runtime.isNative) return 'App 管理';
  if (persistence.value.status === 'granted' && browserContext.value.installed) return '已加固';
  if (persistence.value.status === 'granted') return '已保护';
  return '待加固';
});
const protectionCardTitle = computed(() => protectionTone.value === 'safe' ? '浏览器存储已经更稳妥' : protectionTone.value === 'danger' ? '建议尽快换到稳定环境' : '再做一步，保存会更安心');
const protectionSummary = computed(() => {
  if (runtime.isNative) return '原生应用只会清理临时缓存，不会触碰你的角色、聊天和记忆资料。';
  if (browserContext.value.embeddedBrowser) return `${browserContext.value.embeddedBrowserLabel} 容易清理站点数据，建议改用系统浏览器或 PWA。`;
  if (storagePercent.value >= 95) return '浏览器空间接近上限，建议先整理可再生成的缓存并尽快备份。';
  if (persistence.value.status === 'unsupported') return '当前浏览器不支持存储保护，建议使用系统浏览器并安装为 PWA。';
  if (persistence.value.status !== 'granted') return '开启持久化保护可降低浏览器或系统自动清理本地资料的概率。';
  if (!browserContext.value.installed) return '持久化保护已开启；从主屏幕图标打开会更稳定。';
  return '已安装且已开启持久化保护，本地资料拥有更稳定的保存环境。';
});
const nativeStorageAvailable = computed(() => isNativeStorageAvailable());
const nativeAvailableLabel = computed(() => nativeOverview.value ? formatBytes(nativeOverview.value.availableBytes) : '暂不可读');
const nativeCacheLabel = computed(() => nativeOverview.value ? formatBytes(nativeOverview.value.cacheBytes) : '暂不可读');
const nativeStorageSummary = computed(() => nativeOverview.value
  ? `${nativeOverview.value.cacheFileCount} 个临时文件，可安全清理。`
  : nativeStorageAvailable.value ? '正在等待原生存储状态。' : '当前应用暂时无法读取临时缓存状态。');

const installPromptChangeListener = () => {
  browserContext.value = getBrowserStorageContext();
};

onMounted(() => {
  window.addEventListener(pwaInstallPromptChangeEvent, installPromptChangeListener);
  void refreshDataSnapshot();
});

onBeforeUnmount(() => {
  window.removeEventListener(pwaInstallPromptChangeEvent, installPromptChangeListener);
});

function setDataFeedback(message: string, kind: 'success' | 'error' = 'success') {
  dataFeedback.value = message;
  dataFeedbackKind.value = kind;
}

async function waitForBusyPaint() {
  await nextTick();
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(value >= 10 ? 0 : 1)}%`;
}

function entryShare(bytes: number) {
  const total = Math.max(1, storageEntries.value.reduce((sum, entry) => sum + entry.bytes, 0));
  return Math.max(bytes > 0 ? 4 : 0, Math.min(100, bytes / total * 100));
}

async function refreshDataSnapshot() {
  storageRefreshing.value = true;
  await waitForBusyPaint();
  try {
    const baseInventory = store.getDataInventory();
    const nextSupplementalSections = await inspectSupplementalContentSections();
    const sections = [...baseInventory.sections, ...nextSupplementalSections];
    const nextCleanupEstimates = cleanupActions.reduce<Partial<Record<DataCleanupAction, number>>>((estimates, action) => {
      estimates[action.id] = store.estimateCleanupFreedBytes(action.id);
      return estimates;
    }, {});
    const [nextStorageInventory, nextPersistence, nextNativeOverview] = await Promise.all([
      inspectStorageInventory(sections),
      queryPersistentStorage(),
      getNativeStorageOverview()
    ]);
    dataInventory.value = baseInventory;
    supplementalSections.value = nextSupplementalSections;
    storageInventory.value = nextStorageInventory;
    cleanupEstimates.value = nextCleanupEstimates;
    persistence.value = nextPersistence;
    nativeOverview.value = nextNativeOverview;
    browserContext.value = getBrowserStorageContext();
  } catch (error) {
    setDataFeedback(error instanceof Error ? error.message : '刷新数据统计失败，请稍后重试。', 'error');
  } finally {
    storageRefreshing.value = false;
  }
}

async function runCleanupAction(action: DataCleanupAction) {
  const cleanup = cleanupActionStats.value.find((item) => item.id === action);
  const actionLabel = cleanup?.label ?? '缓存';
  const freedBytes = cleanup?.freedBytes;
  const freedLabel = cleanup?.freedLabel ?? '未知大小';
  const prompt = typeof freedBytes !== 'number'
    ? `即将整理「${actionLabel}」，当前尚未完成大小统计。继续吗？`
    : freedBytes > 0
      ? `即将整理「${actionLabel}」，预计释放 ${freedLabel}。继续吗？`
      : `「${actionLabel}」目前没有可释放内容，仍要执行整理吗？`;
  if (!window.confirm(prompt)) return;

  dataBusy.value = action;
  dataFeedback.value = '';
  await waitForBusyPaint();
  try {
    const changed = await store.cleanupData(action);
    setDataFeedback(changed ? `已整理 ${changed} 项内容，空间统计已同步更新。` : '没有找到需要整理的缓存。');
    await refreshDataSnapshot();
  } catch (error) {
    setDataFeedback(error instanceof Error ? error.message : '整理失败，请稍后重试。', 'error');
  } finally {
    dataBusy.value = '';
  }
}

async function clearContentSection(section: ContentStorageSection) {
  const actionLabel = section.id === 'commerce' ? '重置' : '清空';
  const detail = section.id === 'commerce'
    ? '钱包与商店模拟数据会被移除；后续使用该功能时可能按需生成新的示例资料。'
    : '此操作会永久删除该分区内容，不能撤销。';
  if (!window.confirm(`确定${actionLabel}「${section.label}」吗？${detail}`)) return;

  dataBusy.value = `section:${section.id}`;
  dataFeedback.value = '';
  await waitForBusyPaint();
  try {
    const targets = sectionTargets[section.id];
    let changed = 0;
    if (targets) changed = await store.clearDataSections(targets);
    else if (section.id === 'fanfic') changed = await useFanficStore().clearAllFanficData();
    else if (section.id === 'commerce') changed = await useCommerceStore().clearAllCommerceData();
    else if (section.id === 'roleOperations') changed = await useRoleOperationsStore().clearAllRoleOperationsData();
    else return;
    setDataFeedback(changed ? `已${actionLabel} ${changed} 项「${section.label}」内容。` : `「${section.label}」目前没有可${actionLabel}的内容。`);
    await refreshDataSnapshot();
  } catch (error) {
    setDataFeedback(error instanceof Error ? error.message : `${actionLabel}失败，请稍后重试。`, 'error');
  } finally {
    dataBusy.value = '';
  }
}

async function enableStorageProtection() {
  protectionBusy.value = 'persist';
  dataFeedback.value = '';
  await waitForBusyPaint();
  try {
    const result = await requestPersistentStorage();
    persistence.value = result;
    browserContext.value = getBrowserStorageContext();
    if (result.status === 'granted') setDataFeedback('已开启浏览器持久化存储保护。');
    else if (result.status === 'unsupported') setDataFeedback('当前浏览器不支持持久化保护，建议改用系统浏览器或 PWA。', 'error');
    else setDataFeedback('浏览器暂未授予保护权限，请安装 PWA 或换用系统浏览器后再试。', 'error');
  } finally {
    protectionBusy.value = '';
  }
}

async function runPwaInstallAction() {
  if (browserContext.value.installed) return;
  protectionBusy.value = 'install';
  dataFeedback.value = '';
  await waitForBusyPaint();
  try {
    if (!browserContext.value.installPromptAvailable) {
      installGuideOpen.value = true;
      setDataFeedback('当前浏览器无法直接打开安装窗口，请按下方指引操作。');
      return;
    }
    const outcome = await promptPwaInstall();
    browserContext.value = getBrowserStorageContext();
    if (outcome === 'accepted') setDataFeedback('安装请求已提交，请从主屏幕图标打开 LINK。');
    else if (outcome === 'dismissed') setDataFeedback('已关闭安装窗口，可以稍后再安装。');
    else {
      installGuideOpen.value = true;
      setDataFeedback('当前浏览器无法直接安装，请按下方指引操作。', 'error');
    }
  } finally {
    protectionBusy.value = '';
  }
}

async function clearNativeTemporaryFiles() {
  if (!nativeStorageAvailable.value) return;
  if (!window.confirm('只会清理应用缓存和临时文件，不会删除角色、聊天、记忆或备份。继续吗？')) return;
  protectionBusy.value = 'native';
  dataFeedback.value = '';
  await waitForBusyPaint();
  try {
    const overview = await clearNativeTemporaryFilesOnDevice();
    nativeOverview.value = overview;
    setDataFeedback(overview ? '已清理应用临时文件。' : '当前无法清理原生临时文件。', overview ? 'success' : 'error');
    await refreshDataSnapshot();
  } catch (error) {
    setDataFeedback(error instanceof Error ? error.message : '清理临时文件失败，请稍后重试。', 'error');
  } finally {
    protectionBusy.value = '';
  }
}
</script>

<style scoped>
.data-dashboard {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding-bottom: 8px;
  color: #292428;
}

.storage-hero {
  position: relative;
  display: grid;
  gap: 15px;
  overflow: hidden;
  padding: 18px;
  border: 1px solid rgba(98, 70, 82, 0.06);
  border-radius: 25px;
  background: linear-gradient(140deg, #fff8fb 0%, #fbf7ff 49%, #f0faf5 100%);
  box-shadow: 0 15px 34px rgba(91, 65, 78, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.hero-orb {
  position: absolute;
  z-index: 0;
  border-radius: 999px;
  filter: blur(1px);
  pointer-events: none;
}

.hero-orb-rose {
  top: -32px;
  right: -20px;
  width: 116px;
  height: 116px;
  background: rgba(255, 202, 220, 0.43);
}

.hero-orb-mint {
  right: 70px;
  bottom: -54px;
  width: 122px;
  height: 122px;
  background: rgba(174, 231, 203, 0.36);
}

.hero-topline,
.hero-main,
.hero-stats,
.section-heading,
.next-step-card,
.focus-card,
.gentle-note,
.media-health-card,
.native-storage-top,
.native-storage-stats,
.protection-card,
.install-card,
.backup-reminder {
  position: relative;
  z-index: 1;
}

.hero-topline,
.hero-main,
.section-heading,
.next-step-card,
.media-health-card,
.native-storage-top,
.native-storage-stats,
.protection-card,
.install-card,
.backup-reminder {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.hero-eyebrow,
.section-heading p,
.focus-card p,
.next-step-card p,
.native-storage-top p,
.protection-card p {
  margin: 0;
  color: #a07988;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.13em;
  line-height: 1;
  text-transform: uppercase;
}

.refresh-button {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 33px;
  height: 33px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.76);
  color: #665b62;
  box-shadow: 0 5px 14px rgba(80, 61, 70, 0.08), inset 0 0 0 1px rgba(66, 44, 55, 0.04);
}

.refresh-button:disabled,
.cleanup-card:disabled,
.protect-action:disabled,
.text-button:disabled,
.deep-clean-list button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.spinning {
  animation: data-dashboard-spin 0.7s linear infinite;
}

.hero-main {
  align-items: flex-end;
}

.hero-main > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.hero-main p,
.hero-main span,
.hero-stats span,
.soft-card p,
.section-copy,
.focus-card > div > span,
.next-step-card span,
.gentle-note p,
.storage-entry span,
.content-section-list span,
.media-health-card p,
.native-storage-top span,
.protection-card > div > span,
.install-card p,
.install-guide span,
.backup-reminder p {
  color: #847980;
}

.hero-main p {
  margin: 0;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.1em;
}

.hero-main strong {
  color: #30292e;
  font-family: var(--app-current-font-family);
  font-size: 36px;
  font-weight: 650;
  letter-spacing: -0.04em;
  line-height: 0.95;
}

.hero-main span {
  font-size: 11px;
  font-weight: 700;
}

.hero-chip {
  flex: 0 0 auto;
  margin-bottom: 3px;
  padding: 7px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.69);
  color: #78646f;
  font-size: 10px;
  font-weight: 900;
  box-shadow: inset 0 0 0 1px rgba(89, 62, 76, 0.04);
}

.hero-meter,
.entry-meter {
  position: relative;
  z-index: 1;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(75, 57, 67, 0.09);
}

.hero-meter {
  height: 9px;
}

.hero-meter span,
.entry-meter span {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.hero-meter span {
  background: linear-gradient(90deg, #d68ba7, #9dcfb2 92%);
  box-shadow: 0 2px 8px rgba(149, 105, 126, 0.3);
  transition: width 0.35s ease;
}

.hero-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.hero-stats article {
  display: grid;
  gap: 5px;
  min-width: 0;
  padding: 10px 8px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.57);
  box-shadow: inset 0 0 0 1px rgba(91, 61, 75, 0.035);
  text-align: center;
}

.hero-stats span {
  overflow: hidden;
  font-size: 9px;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-stats strong {
  overflow: hidden;
  color: #504049;
  font-size: 12px;
  font-weight: 950;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  padding: 5px;
  border-radius: 17px;
  background: #f3f0f2;
}

.data-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 0;
  min-height: 39px;
  padding: 0 5px;
  border-radius: 13px;
  color: #93888e;
  font-size: 11px;
  font-weight: 850;
  transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
}

.data-tab span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.data-tab.active {
  background: rgba(255, 255, 255, 0.92);
  color: #3f343a;
  box-shadow: 0 4px 12px rgba(61, 48, 56, 0.08);
}

.feedback {
  margin: 0;
  padding: 10px 12px;
  border-radius: 13px;
  background: #eff9f2;
  color: #36734b;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.5;
}

.feedback.error {
  background: #fff0f0;
  color: #b55656;
}

.tab-content {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.focus-card,
.soft-card,
.next-step-card,
.gentle-note,
.storage-list,
.content-details,
.media-health-card,
.deep-clean-details,
.native-storage-card,
.protection-card,
.install-card,
.install-guide,
.backup-reminder {
  border: 1px solid rgba(63, 48, 57, 0.045);
  box-shadow: 0 10px 23px rgba(64, 50, 58, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.focus-card {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 15px;
  border-radius: 20px;
  background: linear-gradient(132deg, #fff8eb, #fff8fc 73%);
}

.focus-mark,
.next-step-icon,
.gentle-note > span,
.media-health-card > span,
.native-icon,
.protection-icon,
.install-icon,
.backup-reminder > span {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 14px;
}

.focus-mark {
  width: 39px;
  height: 39px;
  background: #ffe5b5;
  color: #a86835;
}

.focus-card > div,
.next-step-card > div,
.media-health-card > div,
.native-storage-top > div,
.protection-card > div,
.install-card > div,
.backup-reminder > div {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.focus-card h3,
.section-heading h3 {
  margin: 0;
  color: #3c3338;
  font-size: 17px;
  font-weight: 950;
  line-height: 1.25;
}

.focus-card > div > span,
.next-step-card span,
.gentle-note p,
.media-health-card p,
.native-storage-top span,
.protection-card > div > span,
.install-card p,
.install-guide span,
.backup-reminder p {
  font-size: 11px;
  font-weight: 650;
  line-height: 1.52;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.soft-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
}

.blush-card {
  background: linear-gradient(145deg, #fff2f5, #fffafd);
}

.mint-card {
  background: linear-gradient(145deg, #edf9f1, #f9fffb);
}

.card-label {
  color: #a17a88;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.09em;
}

.mint-card .card-label {
  color: #67947a;
}

.soft-card strong {
  color: #4f3943;
  font-size: 24px;
  font-weight: 900;
  line-height: 1;
}

.soft-card strong small {
  font-size: 11px;
}

.soft-card p {
  margin: 0;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.35;
}

.next-step-card {
  padding: 13px 14px;
  border-radius: 18px;
  background: #fff;
}

.next-step-card > div {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
}

.next-step-icon {
  width: 37px;
  height: 37px;
  background: #edf1ff;
  color: #5e6ba7;
}

.next-step-card strong,
.media-health-card strong,
.native-storage-top strong,
.protection-card strong,
.install-card strong,
.backup-reminder strong {
  color: #4b3d44;
  font-size: 13px;
  font-weight: 900;
  line-height: 1.25;
}

.next-step-card button,
.text-button,
.deep-clean-list button {
  flex: 0 0 auto;
  min-height: 31px;
  padding: 0 10px;
  border-radius: 10px;
  background: #f3eef1;
  color: #775b69;
  font-size: 11px;
  font-weight: 900;
}

.gentle-note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 17px;
  background: #f6fbf7;
}

.gentle-note > span {
  width: 32px;
  height: 32px;
  background: #dff2e5;
  color: #54876a;
}

.gentle-note p {
  margin: 0;
}

.section-heading > div {
  display: grid;
  gap: 5px;
}

.section-heading > span {
  flex: 0 0 auto;
  padding: 6px 8px;
  border-radius: 999px;
  background: #f4f0f2;
  color: #91828a;
  font-size: 10px;
  font-weight: 850;
}

.section-copy {
  margin: -2px 0 0;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.55;
}

.storage-list {
  display: grid;
  gap: 2px;
  padding: 5px;
  border-radius: 19px;
  background: #fff;
}

.storage-entry {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  column-gap: 9px;
  row-gap: 8px;
  padding: 10px;
  border-radius: 14px;
}

.storage-entry:nth-child(odd) {
  background: #fcfafb;
}

.storage-dot {
  width: 9px;
  height: 9px;
  margin-top: 5px;
  border-radius: 50%;
  background: #d8a1b7;
}

.dot-content { background: #d69aaf; }
.dot-local-storage { background: #a9b6df; }
.dot-opfs-media { background: #82b99b; }
.dot-media-indexed-db { background: #c59bdd; }
.dot-media-cache { background: #e5b67c; }
.dot-pwa-cache { background: #8bc3c2; }
.dot-native-cache { background: #8b9bc9; }

.storage-entry-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.storage-entry-main > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.storage-entry strong,
.content-section-list strong {
  color: #51444a;
  font-size: 12px;
  font-weight: 900;
}

.storage-entry span,
.content-section-list span {
  overflow: hidden;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.storage-entry-main small,
.content-section-list small {
  flex: 0 0 auto;
  color: #8a7a82;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

.entry-meter {
  grid-column: 2;
  height: 4px;
  background: #f0ecee;
}

.entry-meter span {
  background: linear-gradient(90deg, #dfabc0, #ba9fc6);
}

.empty-state {
  margin: 0;
  padding: 18px;
  border-radius: 18px;
  background: #faf7f8;
  color: #8c7e85;
  font-size: 12px;
  font-weight: 700;
  text-align: center;
}

.content-details,
.deep-clean-details {
  overflow: hidden;
  border-radius: 18px;
  background: #fff;
}

.content-details summary,
.deep-clean-details summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 13px;
  cursor: pointer;
  list-style: none;
}

.content-details summary::-webkit-details-marker,
.deep-clean-details summary::-webkit-details-marker {
  display: none;
}

.content-details summary > span,
.deep-clean-details summary > span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #67545e;
}

.content-details summary strong,
.deep-clean-details summary strong {
  font-size: 12px;
  font-weight: 900;
}

.content-details summary small,
.deep-clean-details summary small {
  color: #9a8c93;
  font-size: 10px;
  font-weight: 800;
}

.content-section-list {
  display: grid;
  gap: 1px;
  padding: 0 7px 7px;
}

.content-section-list article {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 12px;
  background: #faf9fa;
}

.content-section-list article > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.media-health-card {
  align-items: flex-start;
  padding: 13px;
  border-radius: 18px;
  background: #f4faf7;
}

.media-health-card.warning {
  background: #fff7ed;
}

.media-health-card > span {
  width: 37px;
  height: 37px;
  background: #dcefe4;
  color: #54856a;
}

.media-health-card.warning > span {
  background: #ffe2b9;
  color: #ab6c35;
}

.media-health-card p {
  margin: 0;
}

.cleanup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.cleanup-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 9px;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(66, 48, 58, 0.035);
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 7px 16px rgba(57, 45, 51, 0.035);
  text-align: left;
}

.cleanup-icon {
  display: grid;
  place-items: center;
  width: 33px;
  height: 33px;
  border-radius: 12px;
}

.cleanup-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.cleanup-copy strong {
  color: #53444b;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.25;
}

.cleanup-copy small {
  display: -webkit-box;
  overflow: hidden;
  color: #908188;
  font-size: 9px;
  font-weight: 650;
  line-height: 1.35;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cleanup-card em {
  grid-column: 1 / -1;
  overflow: hidden;
  color: #8f767f;
  font-size: 9px;
  font-style: normal;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tone-rose .cleanup-icon { background: #ffebf1; color: #bf718a; }
.tone-peach .cleanup-icon { background: #fff0df; color: #b77a48; }
.tone-mint .cleanup-icon { background: #e4f5e9; color: #5f9976; }
.tone-lilac .cleanup-icon { background: #f0e9fb; color: #876fb4; }
.tone-sky .cleanup-icon { background: #e7f3fd; color: #6288b2; }
.tone-butter .cleanup-icon { background: #fff4d7; color: #a88739; }

.deep-clean-details {
  background: #fff9f8;
}

.deep-clean-details > p {
  margin: 0;
  padding: 0 13px 11px;
  color: #947a80;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.5;
}

.deep-clean-list {
  display: grid;
  gap: 1px;
  padding: 0 7px 7px;
}

.deep-clean-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 8px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.75);
}

.deep-clean-list article > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.deep-clean-list strong {
  color: #61494f;
  font-size: 11px;
  font-weight: 900;
}

.deep-clean-list span {
  overflow: hidden;
  color: #987f85;
  font-size: 9px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deep-clean-list button {
  background: #f9e6e5;
  color: #b15f63;
}

.native-storage-card,
.protection-card,
.install-card,
.install-guide,
.backup-reminder {
  display: grid;
  gap: 13px;
  padding: 14px;
  border-radius: 20px;
}

.native-storage-card {
  background: linear-gradient(145deg, #f3f5ff, #fafaff);
}

.native-storage-top {
  align-items: flex-start;
  justify-content: flex-start;
}

.native-icon {
  width: 40px;
  height: 40px;
  background: #e3e8ff;
  color: #6473b8;
}

.native-storage-stats {
  gap: 8px;
  padding: 10px;
  border-radius: 13px;
  background: rgba(255, 255, 255, 0.68);
}

.native-storage-stats span {
  display: grid;
  gap: 3px;
  color: #8a839a;
  font-size: 10px;
  font-weight: 750;
}

.native-storage-stats strong {
  color: #5b607b;
  font-size: 12px;
  font-weight: 900;
}

.protect-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border-radius: 12px;
  background: #f0e6eb;
  color: #875d70;
  font-size: 11px;
  font-weight: 900;
}

.protect-action.dark {
  width: 100%;
  background: #50597e;
  color: #fff;
}

.protection-card {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  background: #f4fbf6;
}

.protection-card.state-warn {
  background: #fffaf1;
}

.protection-card.state-danger {
  background: #fff1f1;
}

.protection-icon {
  width: 41px;
  height: 41px;
  background: #dcefe2;
  color: #5c9670;
}

.state-warn .protection-icon {
  background: #ffebc7;
  color: #a57635;
}

.state-danger .protection-icon {
  background: #ffdfe0;
  color: #b55d62;
}

.protection-card .protect-action {
  grid-column: 1 / -1;
}

.install-card {
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  background: #fff;
}

.install-icon {
  width: 37px;
  height: 37px;
  background: #f0ebfa;
  color: #7b67a6;
}

.install-card p,
.backup-reminder p {
  margin: 0;
}

.install-guide {
  background: #fffaf4;
}

.install-guide strong {
  color: #8b674b;
  font-size: 12px;
  font-weight: 900;
}

.backup-reminder {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  background: #faf8fa;
}

.backup-reminder > span {
  width: 37px;
  height: 37px;
  background: #eee9ed;
  color: #806a76;
}

.button-spinner {
  display: block;
  width: 15px;
  height: 15px;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: data-dashboard-spin 0.66s linear infinite;
}

@keyframes data-dashboard-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 365px) {
  .storage-hero {
    padding: 15px;
  }

  .hero-main strong {
    font-size: 31px;
  }

  .data-tab {
    gap: 3px;
    font-size: 10px;
  }

  .cleanup-grid {
    grid-template-columns: 1fr;
  }

  .cleanup-card {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
  }

  .cleanup-card em {
    grid-column: auto;
  }
}
</style>