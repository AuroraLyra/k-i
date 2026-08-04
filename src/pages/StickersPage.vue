<template>
  <section class="screen no-tabs stickers-page">
    <header class="top-bar stickers-topbar">
      <button class="stickers-title-button" type="button" aria-label="返回首页" @click="goBack">
        <h1 class="top-title">Stickers</h1>
      </button>

      <div class="stickers-actions">
        <button class="stickers-action-button" type="button" aria-label="分享 Stickers" @click="openShareModal">
          <Share2 :size="20" stroke-width="2.35" />
        </button>
        <button class="stickers-action-button" type="button" aria-label="导入 Stickers" @click="openImportModal">
          <Plus :size="20" stroke-width="2.4" />
        </button>
        <button class="stickers-action-button" type="button" aria-label="维护 Stickers" @click="openMaintenanceModal">
          <Settings2 :size="19" stroke-width="2.3" />
        </button>
        <button class="stickers-action-button" type="button" aria-label="管理 Stickers" @click="openManagePage">
          <PencilLine :size="19" stroke-width="2.3" />
        </button>
      </div>
    </header>

    <main class="stickers-main">
      <section v-if="store.ready" class="stickers-panel">
        <StickerLibraryPanel
          v-model:activeGroupId="activeGroupId"
          :show-close="false"
          :show-toolbar-actions="false"
          :allow-sticker-editing="false"
        />
      </section>
      <section v-else class="loading-card">
        <p>正在整理贴纸抽屉...</p>
      </section>
    </main>

    <StickerImportModal
      v-model="showImportModal"
      :active-tab="importTab"
      :groups="groups"
      :selected-group-id="importTargetGroupId"
      :text-value="importText"
      :selected-files="selectedFiles"
      :new-group-name="importNewGroupName"
      :feedback="importFeedback"
      :disabled="importDisabled"
      @update:active-tab="handleImportTabChange"
      @update:selected-group-id="importTargetGroupId = $event"
      @update:text-value="importText = $event"
      @update:selected-files="selectedFiles = $event"
      @update:new-group-name="importNewGroupName = $event"
      @create-group="createImportGroup"
      @submit="submitImport"
    />

    <StickerShareModal
      v-model="showShareModal"
      :groups="shareGroups"
      :default-group-id="activeGroupId"
      :feedback="shareFeedback"
      :disabled="sharing"
      @save="saveSelectedGroups"
      @submit="shareSelectedGroups"
    />

    <AppModal :model-value="showMaintenanceModal" title="Stickers 维护" :show-header="false" variant="ins" @update:model-value="showMaintenanceModal = $event">
      <section class="maintenance-modal">
        <div class="modal-head">
          <div>
            <p class="modal-kicker">Sticker Maintenance</p>
            <h3>检查并确认要删除的贴纸</h3>
          </div>
          <span class="mode-badge">{{ activeMaintenanceTab === 'invalid' ? '失效清理' : '去重检查' }}</span>
        </div>

        <nav class="tab-row" aria-label="Stickers 维护方式">
          <button class="tab-pill" :class="{ active: activeMaintenanceTab === 'invalid' }" type="button" @click="setMaintenanceTab('invalid')">失效清理</button>
          <button class="tab-pill" :class="{ active: activeMaintenanceTab === 'dedupe' }" type="button" @click="setMaintenanceTab('dedupe')">去重检查</button>
        </nav>

        <section class="maintenance-action-card">
          <div>
            <h4>{{ activeMaintenanceTab === 'invalid' ? '清理失效 Stickers' : '检查重复 Stickers' }}</h4>
            <p>{{ activeMaintenanceCopy }}</p>
          </div>
          <button class="scan-button" type="button" :disabled="Boolean(maintenanceBusy) || !store.sortedStickers.length" @click="scanActiveMaintenanceTab">
            <LoaderCircle v-if="isScanningActiveTab" :size="16" class="spin" />
            <ScanSearch v-else-if="activeMaintenanceTab === 'invalid'" :size="16" />
            <Layers2 v-else :size="16" />
            <span>{{ activeScanButtonLabel }}</span>
          </button>
        </section>

        <section v-if="activeMaintenanceCandidates.length" class="maintenance-results">
          <div class="results-head">
            <strong>将删除 {{ activeMaintenanceCandidates.length }} 个 Stickers</strong>
            <span>{{ activeMaintenanceTab === 'invalid' ? '失效项' : '重复项' }}</span>
          </div>
          <article v-for="item in activeMaintenanceCandidates" :key="item.sticker.id" class="candidate-row">
            <img :src="getStickerDisplayImageUrl(item.sticker)" :alt="item.sticker.description || 'Sticker'" />
            <div>
              <strong>{{ item.sticker.description || '未命名 Sticker' }}</strong>
              <span>{{ item.reason }}</span>
              <small v-if="item.keeper">保留：{{ item.keeper.description || '未命名 Sticker' }}</small>
              <small>{{ item.sticker.imageUrl || '无图片链接' }}</small>
            </div>
          </article>
        </section>

        <p v-if="maintenanceFeedback" class="feedback">{{ maintenanceFeedback }}</p>

        <div class="modal-actions">
          <button class="secondary-ghost" type="button" :disabled="maintenanceBusy === 'delete'" @click="closeMaintenanceModal">取消</button>
          <button class="save-button danger-save" type="button" :disabled="!activeMaintenanceCandidates.length || Boolean(maintenanceBusy)" @click="deleteActiveMaintenanceCandidates">
            <Trash2 :size="15" />
            <span>{{ maintenanceBusy === 'delete' ? '删除中' : '删除这些' }}</span>
          </button>
        </div>
      </section>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Layers2, LoaderCircle, PencilLine, Plus, ScanSearch, Settings2, Share2, Trash2 } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import StickerImportModal, { type StickerImportTab } from '@/components/stickers/StickerImportModal.vue';
import StickerLibraryPanel from '@/components/stickers/StickerLibraryPanel.vue';
import StickerShareModal, { type StickerShareGroupOption } from '@/components/stickers/StickerShareModal.vue';
import { shareNativeFile } from '@/services/nativeFile';
import { isNativePhotoLibrarySaveAvailable, saveNativeImage } from '@/services/nativeMedia';
import { useAppStore } from '@/stores/appStore';
import type { Sticker, StickerSourceType } from '@/types/domain';
import { RECENT_STICKER_GROUP_ID, createImageFileStickerDraft, getStickerDisplayImageUrl, parseStickerImportText, readStickerImportFile, type StickerImportDraft } from '@/utils/stickers';
import { createStickerSharePng, decodeStickerSharePng, isLikelyStickerSharePngFile, type StickerSharePackage } from '@/utils/stickerShare';

type MaintenanceTab = 'invalid' | 'dedupe';
type MaintenanceBusy = 'invalid' | 'dedupe' | 'delete';

interface MaintenanceCandidate {
  sticker: Sticker;
  reason: string;
  keeper?: Sticker;
}

const router = useRouter();
const store = useAppStore();
const activeGroupId = ref(RECENT_STICKER_GROUP_ID);
const showImportModal = ref(false);
const importTab = ref<StickerImportTab>('url');
const importTargetGroupId = ref('');
const importText = ref('');
const selectedFiles = ref<File[]>([]);
const importNewGroupName = ref('');
const importFeedback = ref('');
const importing = ref(false);
const showShareModal = ref(false);
const sharing = ref(false);
const shareFeedback = ref('');
const showMaintenanceModal = ref(false);
const activeMaintenanceTab = ref<MaintenanceTab>('invalid');
const maintenanceBusy = ref<MaintenanceBusy | null>(null);
const maintenanceFeedback = ref('');
const invalidScanProgress = ref({ checked: 0, total: 0 });
const invalidStickerCandidates = ref<MaintenanceCandidate[]>([]);
const duplicateStickerCandidates = ref<MaintenanceCandidate[]>([]);
const duplicateKeeperUpdates = ref<Sticker[]>([]);

const groups = computed(() => store.sortedStickerGroups ?? []);
const shareGroups = computed<StickerShareGroupOption[]>(() => groups.value.map((group) => ({
  id: group.id,
  name: group.name,
  stickerCount: store.stickersForGroup(group.id).length
})));
const importDisabled = computed(() => {
  if (importing.value) return true;
  if (importTab.value === 'file') return !selectedFiles.value.length;
  return !importTargetGroupId.value || !importText.value.trim();
});
const activeMaintenanceCandidates = computed(() => activeMaintenanceTab.value === 'invalid' ? invalidStickerCandidates.value : duplicateStickerCandidates.value);
const isScanningActiveTab = computed(() => maintenanceBusy.value === activeMaintenanceTab.value);
const activeScanButtonLabel = computed(() => {
  if (maintenanceBusy.value === 'invalid') return '扫描中';
  if (maintenanceBusy.value === 'dedupe') return '检查中';
  return activeMaintenanceTab.value === 'invalid' ? '扫描失效' : '扫描重复';
});
const activeMaintenanceCopy = computed(() => {
  if (maintenanceBusy.value === 'invalid') return `正在检查 ${invalidScanProgress.value.checked} / ${invalidScanProgress.value.total} 个贴纸图片。`;
  if (maintenanceBusy.value === 'dedupe') return `正在比对 ${invalidScanProgress.value.checked} / ${invalidScanProgress.value.total} 个贴纸的 URL 和图片内容。`;
  if (!store.sortedStickers.length) return '当前没有可维护的贴纸。';
  if (activeMaintenanceTab.value === 'invalid') return invalidStickerCandidates.value.length ? '已列出将删除的失效贴纸，确认后才会删除。' : '扫描无法加载、空描述或空图片链接的贴纸，先列出结果再确认删除。';
  return duplicateStickerCandidates.value.length ? '已列出将删除的重复贴纸，确认后才会删除。' : '检查 URL 完全相同，或可读取图片内容完全相同的贴纸。';
});

onMounted(() => {
  void store.hydrate();
});

watch(
  groups,
  (nextGroups) => {
    if (activeGroupId.value !== RECENT_STICKER_GROUP_ID && !nextGroups.some((group) => group.id === activeGroupId.value)) activeGroupId.value = RECENT_STICKER_GROUP_ID;
    const defaultGroupId = pickDefaultGroupId(nextGroups);
    if (!nextGroups.some((group) => group.id === importTargetGroupId.value)) importTargetGroupId.value = defaultGroupId;
  },
  { immediate: true }
);

function pickDefaultGroupId(sourceGroups = groups.value) {
  if (activeGroupId.value !== RECENT_STICKER_GROUP_ID && sourceGroups.some((group) => group.id === activeGroupId.value)) return activeGroupId.value;
  return sourceGroups[0]?.id ?? '';
}

function resetImportState() {
  importText.value = '';
  selectedFiles.value = [];
  importNewGroupName.value = '';
  importFeedback.value = '';
  importTargetGroupId.value = pickDefaultGroupId();
}

function openImportModal() {
  importTab.value = 'url';
  resetImportState();
  showShareModal.value = false;
  showMaintenanceModal.value = false;
  showImportModal.value = true;
}

function openShareModal() {
  shareFeedback.value = '';
  showImportModal.value = false;
  showMaintenanceModal.value = false;
  showShareModal.value = true;
}

function openMaintenanceModal() {
  showImportModal.value = false;
  maintenanceFeedback.value = '';
  invalidScanProgress.value = { checked: 0, total: 0 };
  showMaintenanceModal.value = true;
}

function closeMaintenanceModal() {
  if (maintenanceBusy.value) return;
  showMaintenanceModal.value = false;
}

function setMaintenanceTab(tab: MaintenanceTab) {
  if (maintenanceBusy.value) return;
  activeMaintenanceTab.value = tab;
  maintenanceFeedback.value = '';
}

function openManagePage() {
  showImportModal.value = false;
  showShareModal.value = false;
  showMaintenanceModal.value = false;
  void router.push({ name: 'stickers-manage' });
}

function downloadSharePng(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
}

async function shareStickerPng(blob: Blob, fileName: string) {
  if (await shareNativeFile(blob, fileName)) return '已打开系统分享面板。';
  const file = new File([blob], fileName, { type: 'image/png' });
  const canShareFiles = typeof navigator !== 'undefined'
    && typeof navigator.share === 'function'
    && (!navigator.canShare || navigator.canShare({ files: [file] }));
  if (canShareFiles) {
    await navigator.share({
      title: 'BabyLink Stickers 分享包',
      text: '这是一个 BabyLink Stickers PNG 分享包，请在 Stickers 页面点击 + 导入。',
      files: [file]
    });
    return '已打开系统分享面板。';
  }
  downloadSharePng(blob, fileName);
  return '当前设备不支持直接分享，已下载 PNG 文件。';
}

async function saveStickerPng(blob: Blob, fileName: string) {
  if (isNativePhotoLibrarySaveAvailable()) {
    const saved = await saveNativeImage(blob, fileName);
    if (saved) return 'PNG 已保存到系统相册。';
  }
  downloadSharePng(blob, fileName);
  return 'PNG 已下载；请在浏览器或系统下载中查看。';
}

async function exportSelectedGroups(groupIds: string[], delivery: (blob: Blob, fileName: string) => Promise<string>) {
  if (sharing.value) return;
  sharing.value = true;
  shareFeedback.value = '';
  try {
    const selectedGroupIds = new Set(groupIds);
    const result = await createStickerSharePng(
      groups.value.filter((group) => selectedGroupIds.has(group.id)),
      store.sortedStickers
    );
    shareFeedback.value = await delivery(result.blob, result.fileName);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      shareFeedback.value = '已取消分享。';
      return;
    }
    shareFeedback.value = error instanceof Error ? error.message : '贴纸分享失败，请重试。';
  } finally {
    sharing.value = false;
  }
}

async function saveSelectedGroups(groupIds: string[]) {
  await exportSelectedGroups(groupIds, saveStickerPng);
}

async function shareSelectedGroups(groupIds: string[]) {
  await exportSelectedGroups(groupIds, shareStickerPng);
}

function isRemoteImageUrl(value: string) {
  return /^https?:\/\//i.test(value.trim());
}

function createHashDownloadUrl(imageUrl: string) {
  return import.meta.env.DEV && isRemoteImageUrl(imageUrl)
    ? `/__image-download?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
}

function bytesToHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashStickerImage(sticker: Sticker) {
  const imageUrl = getStickerDisplayImageUrl(sticker);
  if (!imageUrl) return '';
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5500);
  try {
    const response = await fetch(createHashDownloadUrl(imageUrl), {
      headers: { Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' },
      signal: controller.signal
    });
    if (!response.ok) return '';
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    const imageBytes = await response.arrayBuffer();
    if (!imageBytes.byteLength) return '';
    const mimeKey = contentType.startsWith('image/') ? contentType : 'image/unknown';
    const digest = await crypto.subtle.digest('SHA-256', imageBytes);
    return `${mimeKey}:${bytesToHex(digest)}`;
  } catch {
    return '';
  } finally {
    window.clearTimeout(timeout);
  }
}

function validateStickerImage(sticker: Sticker) {
  const imageUrl = getStickerDisplayImageUrl(sticker);
  if (!sticker.description.trim()) return Promise.resolve({ valid: false, reason: '缺少描述' });
  if (!imageUrl) return Promise.resolve({ valid: false, reason: '缺少图片链接' });
  return new Promise<{ valid: boolean; reason: string }>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (valid: boolean, reason = '') => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve({ valid, reason });
    };
    const timer = window.setTimeout(() => finish(false, '图片加载超时'), 5500);
    image.onload = () => finish(Boolean(image.naturalWidth && image.naturalHeight), image.naturalWidth && image.naturalHeight ? '' : '图片尺寸异常');
    image.onerror = () => finish(false, '图片无法加载');
    image.src = imageUrl;
  });
}

async function scanInvalidStickers() {
  if (maintenanceBusy.value || !store.sortedStickers.length) return;
  maintenanceBusy.value = 'invalid';
  maintenanceFeedback.value = '';
  const sourceStickers = [...store.sortedStickers];
  const candidates: MaintenanceCandidate[] = [];
  let nextStickerIndex = 0;
  invalidScanProgress.value = { checked: 0, total: sourceStickers.length };
  try {
    const scanSticker = async () => {
      while (nextStickerIndex < sourceStickers.length) {
        const sticker = sourceStickers[nextStickerIndex];
        nextStickerIndex += 1;
        const { valid, reason } = await validateStickerImage(sticker);
        invalidScanProgress.value = { ...invalidScanProgress.value, checked: invalidScanProgress.value.checked + 1 };
        if (!valid) candidates.push({ sticker, reason });
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, sourceStickers.length) }, scanSticker));
    invalidStickerCandidates.value = candidates;
    maintenanceFeedback.value = candidates.length ? `发现 ${candidates.length} 个失效 Stickers，请确认后删除。` : '没有发现失效 Stickers。';
  } catch (error) {
    maintenanceFeedback.value = error instanceof Error ? error.message : '扫描失败，请重试。';
  } finally {
    maintenanceBusy.value = null;
  }
}

function buildDuplicateKeeperUpdates(candidates: MaintenanceCandidate[]) {
  const updates = new Map<string, Sticker>();
  for (const candidate of candidates) {
    if (!candidate.keeper) continue;
    const existingKeeper = updates.get(candidate.keeper.id) ?? candidate.keeper;
    const mergedGroupIds = [...new Set([...existingKeeper.groupIds, ...candidate.sticker.groupIds].filter(Boolean))];
    const mergedLastUsedAt = Math.max(existingKeeper.lastUsedAt ?? 0, candidate.sticker.lastUsedAt ?? 0) || undefined;
    updates.set(existingKeeper.id, {
      ...existingKeeper,
      groupIds: mergedGroupIds,
      lastUsedAt: mergedLastUsedAt
    });
  }
  return [...updates.values()];
}

async function scanDuplicateStickers() {
  if (maintenanceBusy.value || !store.sortedStickers.length) return;
  maintenanceBusy.value = 'dedupe';
  maintenanceFeedback.value = '';
  const sourceStickers = [...store.sortedStickers];
  const candidates: MaintenanceCandidate[] = [];
  const candidateIds = new Set<string>();
  const stickersByUrl = new Map<string, Sticker>();
  const stickersByHash = new Map<string, Sticker>();
  invalidScanProgress.value = { checked: 0, total: sourceStickers.length };
  try {
    for (const sticker of sourceStickers) {
      const imageUrl = sticker.imageUrl.trim();
      const sameUrlKeeper = imageUrl ? stickersByUrl.get(imageUrl) : undefined;
      if (sameUrlKeeper) {
        candidates.push({ sticker, keeper: sameUrlKeeper, reason: 'URL 完全相同' });
        candidateIds.add(sticker.id);
        invalidScanProgress.value = { ...invalidScanProgress.value, checked: invalidScanProgress.value.checked + 1 };
        continue;
      }
      if (imageUrl) stickersByUrl.set(imageUrl, sticker);

      const imageHash = await hashStickerImage(sticker);
      const sameImageKeeper = imageHash ? stickersByHash.get(imageHash) : undefined;
      if (sameImageKeeper && !candidateIds.has(sticker.id)) {
        candidates.push({ sticker, keeper: sameImageKeeper, reason: '图片内容完全相同' });
        candidateIds.add(sticker.id);
      } else if (imageHash) {
        stickersByHash.set(imageHash, sticker);
      }
      invalidScanProgress.value = { ...invalidScanProgress.value, checked: invalidScanProgress.value.checked + 1 };
    }
    duplicateStickerCandidates.value = candidates;
    duplicateKeeperUpdates.value = buildDuplicateKeeperUpdates(candidates);
    maintenanceFeedback.value = candidates.length ? `发现 ${candidates.length} 个重复 Stickers，请确认后删除。` : '没有发现重复 Stickers。';
  } catch (error) {
    maintenanceFeedback.value = error instanceof Error ? error.message : '检查失败，请重试。';
  } finally {
    maintenanceBusy.value = null;
  }
}

function scanActiveMaintenanceTab() {
  if (activeMaintenanceTab.value === 'invalid') void scanInvalidStickers();
  else void scanDuplicateStickers();
}

async function deleteActiveMaintenanceCandidates() {
  if (maintenanceBusy.value || !activeMaintenanceCandidates.value.length) return;
  maintenanceBusy.value = 'delete';
  maintenanceFeedback.value = '';
  const candidates = [...activeMaintenanceCandidates.value];
  try {
    if (activeMaintenanceTab.value === 'dedupe') {
      await Promise.all(duplicateKeeperUpdates.value.map((sticker) => store.saveSticker(sticker)));
    }
    const removedCount = await store.deleteStickers(candidates.map((candidate) => candidate.sticker.id));
    if (activeMaintenanceTab.value === 'invalid') invalidStickerCandidates.value = [];
    else {
      duplicateStickerCandidates.value = [];
      duplicateKeeperUpdates.value = [];
    }
    maintenanceFeedback.value = removedCount ? `已删除 ${removedCount} 个 Stickers。` : '没有删除任何 Stickers。';
  } catch (error) {
    maintenanceFeedback.value = error instanceof Error ? error.message : '删除失败，请重试。';
  } finally {
    maintenanceBusy.value = null;
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}

function handleImportTabChange(tab: StickerImportTab) {
  importTab.value = tab;
  importFeedback.value = '';
  importText.value = tab === 'url' ? importText.value : '';
  selectedFiles.value = [];
}

function importSourceTypeForFile(file: File): StickerSourceType {
  if (/\.json$/i.test(file.name)) return 'json-file';
  if (/\.docx?$/i.test(file.name)) return 'doc-file';
  if (file.type.startsWith('image/')) return 'local-image';
  if (/\.txt$/i.test(file.name) || file.type === 'text/plain') return 'text-file';
  return 'url';
}

async function buildImportContent(): Promise<{ drafts: StickerImportDraft[]; stickerPackages: StickerSharePackage[] }> {
  if (importTab.value === 'url') return { drafts: parseStickerImportText(importText.value, 'url'), stickerPackages: [] };

  const drafts: StickerImportDraft[] = [];
  const stickerPackages: StickerSharePackage[] = [];
  for (const file of selectedFiles.value) {
    const stickerPackage = await decodeStickerSharePng(file);
    if (stickerPackage) {
      stickerPackages.push(stickerPackage);
      continue;
    }
    if (isLikelyStickerSharePngFile(file)) throw new Error('这张 PNG 不是有效的 BabyLink Stickers 分享包，请确认发送方以文件形式转发。');
    if (file.type.startsWith('image/')) {
      drafts.push(createImageFileStickerDraft(file));
      continue;
    }
    const text = await readStickerImportFile(file);
    drafts.push(...parseStickerImportText(text, importSourceTypeForFile(file)));
  }
  return { drafts, stickerPackages };
}

async function submitImport() {
  if (importDisabled.value) return;
  importing.value = true;
  importFeedback.value = '';
  try {
    const { drafts, stickerPackages } = await buildImportContent();
    if (!drafts.length && !stickerPackages.length) {
      importFeedback.value = '没有识别到可导入的 Stickers 内容。';
      return;
    }
    if (drafts.length && !importTargetGroupId.value) {
      importFeedback.value = '请先添加并选择一个目标分组，再导入普通图片或文本。';
      return;
    }
    const importedSharePackages = await Promise.all(stickerPackages.map((stickerPackage) => store.importStickerSharePackage(stickerPackage)));
    const created = drafts.length ? await store.importStickers(drafts, [importTargetGroupId.value]) : [];
    const sharedStickerCount = importedSharePackages.reduce((total, result) => total + result.createdStickers.length, 0);
    if (!created.length && !sharedStickerCount) {
      importFeedback.value = '没有新增 Stickers。';
      return;
    }
    const createdShareGroup = importedSharePackages.flatMap((result) => result.createdGroups)[0];
    activeGroupId.value = createdShareGroup?.id ?? importTargetGroupId.value;
    resetImportState();
    showImportModal.value = false;
  } catch (error) {
    importFeedback.value = error instanceof Error ? error.message : '导入失败，请重试。';
  } finally {
    importing.value = false;
  }
}

async function createImportGroup() {
  const name = importNewGroupName.value.trim();
  if (!name) return;
  const group = await store.addStickerGroup(name);
  if (!group) return;
  importTargetGroupId.value = group.id;
  activeGroupId.value = group.id;
  importNewGroupName.value = '';
  importFeedback.value = `已添加分组“${group.name}”。`;
}

</script>

<style scoped>
.stickers-page {
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(circle at top left, rgba(255, 213, 226, 0.72), transparent 30%),
    radial-gradient(circle at top right, rgba(6, 199, 85, 0.1), transparent 28%),
    linear-gradient(180deg, #fffafc 0%, #f7f8fb 56%, #eef4f0 100%);
}

.stickers-topbar {
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
  background: rgba(255, 255, 255, 0.84);
  backdrop-filter: blur(18px);
}

.stickers-actions {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.stickers-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #111111;
}

.stickers-action-button.active {
  border-radius: 8px;
  background: #111111;
  color: #ffffff;
}

.stickers-action-button svg {
  pointer-events: none;
}

.stickers-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  margin-right: auto;
}

.stickers-title-button .top-title {
  margin: 0;
  text-align: left;
}

.stickers-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 16px 24px;
  -webkit-overflow-scrolling: touch;
}

.stickers-panel {
  display: grid;
  align-content: start;
  align-items: start;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 32px rgba(16, 24, 20, 0.06);
}

.loading-card {
  display: grid;
  place-items: center;
  min-height: 260px;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 32px rgba(16, 24, 20, 0.06);
  color: #6b6d73;
  font-size: 15px;
}

.stickers-panel :deep(.sticker-sheet) {
  min-height: 0;
  align-content: start;
}

.stickers-panel :deep(.group-tabs) {
  padding-bottom: 2px;
}

.stickers-panel :deep(.sticker-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding-bottom: 6px;
}

.stickers-panel :deep(.sticker-tile) {
  padding: 8px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 247, 250, 0.88));
}

.stickers-panel :deep(.empty-stickers) {
  min-height: 360px;
  border-radius: 22px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(249, 250, 252, 0.84));
}

.maintenance-modal {
  display: grid;
  gap: 12px;
}

.modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.modal-kicker {
  margin: 0;
  color: #8f8790;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.modal-head h3 {
  margin: 4px 0 0;
  color: #2a242c;
  font-size: 18px;
  line-height: 1.2;
}

.mode-badge {
  flex: 0 0 auto;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: #2a242c;
  font-size: 11px;
  font-weight: 800;
}

.tab-row,
.modal-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.tab-pill {
  width: 100%;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #6a636a;
  font-size: 12px;
  font-weight: 800;
}

.tab-pill.active,
.scan-button,
.save-button {
  background: #111111;
  color: #ffffff;
}

.maintenance-action-card,
.maintenance-results {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
}

.maintenance-action-card h4 {
  margin: 0 0 5px;
  color: #2a242c;
  font-size: 14px;
  font-weight: 850;
}

.maintenance-action-card p,
.candidate-row span,
.candidate-row small,
.feedback {
  margin: 0;
  color: #6a636a;
  font-size: 12px;
  line-height: 1.5;
}

.scan-button,
.secondary-ghost,
.save-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 800;
}

.scan-button:disabled,
.save-button:disabled,
.secondary-ghost:disabled {
  opacity: 0.4;
}

.results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.results-head strong,
.candidate-row strong {
  color: #2a242c;
  font-size: 13px;
  font-weight: 850;
}

.results-head span {
  flex: 0 0 auto;
  color: #8f8790;
  font-size: 11px;
  font-weight: 800;
}

.candidate-row {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
  padding: 8px;
  border-radius: 14px;
  background: rgba(242, 243, 246, 0.72);
}

.candidate-row img {
  width: 54px;
  height: 54px;
  border-radius: 12px;
  object-fit: cover;
  background: rgba(17, 17, 17, 0.08);
}

.candidate-row div {
  display: grid;
  align-content: start;
  gap: 2px;
  min-width: 0;
}

.candidate-row strong,
.candidate-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.secondary-ghost {
  background: rgba(17, 17, 17, 0.08);
  color: #251f26;
}

.danger-save {
  background: #111111;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 420px) {
  .stickers-main {
    padding-inline: 12px;
  }

  .stickers-panel {
    padding: 14px;
  }

  .scan-button {
    width: 100%;
  }
}
</style>