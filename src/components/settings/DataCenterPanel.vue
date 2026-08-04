<template>
  <section class="data-center">
    <section v-if="activeSection === 'local'" class="backup-card">
      <header class="card-head">
        <div>
          <span class="card-kicker">Local</span>
          <h3>本地备份</h3>
        </div>
      </header>

      <div class="action-row">
        <button class="primary-action local-export-action" type="button" :disabled="Boolean(localBusy)" @click="exportBackup">
          <span>导出压缩备份</span>
        </button>
        <label class="secondary-action file-action" :class="{ disabled: Boolean(localBusy) }" :aria-disabled="Boolean(localBusy)">
          <span>导入备份</span>
          <input type="file" accept=".zip,.json,application/zip,application/json" :disabled="Boolean(localBusy)" @change="importBackup" />
        </label>
      </div>

      <p class="card-note">默认导出 ZIP 压缩包，旧版 JSON 备份仍可导入。</p>

      <button class="secondary-action wide-action" type="button" :disabled="Boolean(localBusy) || diagnosticBusy" @click="copyRuntimeDiagnostic">
        <span>{{ diagnosticBusy ? '正在收集版本诊断' : '复制版本诊断' }}</span>
      </button>
      <p class="card-note">诊断仅包含网页构建、Service Worker、原生版本、数据库 schema 与本地存储估算，不包含聊天、主题或密钥。</p>

      <p v-if="localFeedback" class="feedback" :class="localFeedbackKind">{{ localFeedback }}</p>
    </section>

    <CloudBackupPanel v-else-if="activeSection === 'cloud'" :settings="settings" @open-github="emit('change-section', 'github')" />

    <section v-else class="backup-card github-card">
      <header class="card-head">
        <div>
          <span class="card-kicker">GitHub</span>
          <h3>自动备份</h3>
        </div>
        <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
      </header>

      <button class="secondary-action wide-action" type="button" :disabled="Boolean(githubBusy)" @click="openGitHubLogin">
        <Github :size="16" />
        <span>GitHub 一键登录</span>
      </button>

      <label class="field">
        <span>GitHub token</span>
        <div class="field-with-action">
          <input v-model="githubToken" type="password" autocomplete="off" placeholder="ghp_..." @change="() => saveGitHubDraft()" />
          <button class="icon-action" type="button" :disabled="Boolean(githubBusy) || !githubToken.trim()" aria-label="连接 GitHub" @click="connectGitHub">
            <Github :size="16" />
          </button>
        </div>
      </label>

      <div class="field-grid">
        <label class="field">
          <span>账号</span>
          <input v-model="ownerDraft" placeholder="username" @change="() => saveGitHubDraft()" />
        </label>
        <label class="field">
          <span>私有仓库</span>
          <input v-model="repoDraft" placeholder="link-private-backups" @change="() => saveGitHubDraft()" />
        </label>
      </div>

      <div class="field-grid">
        <label class="field">
          <span>备份路径</span>
          <input v-model="pathDraft" placeholder="link-backup.json" @change="() => saveGitHubDraft()" />
        </label>
        <label class="field">
          <span>间隔分钟</span>
          <input v-model.number="intervalDraft" min="1" max="1440" step="1" type="number" @change="() => saveGitHubDraft()" />
        </label>
      </div>

      <label class="toggle-card">
        <input type="checkbox" :checked="enabledDraft" @change="toggleAutoBackup" />
        <div>
          <strong>自动后台备份</strong>
          <span v-if="autoBackupLabel">{{ autoBackupLabel }}</span>
        </div>
      </label>

      <section v-if="showRestorePrompt" class="status-panel restore-panel">
        <strong>检测到 GitHub 上有较新的备份</strong>
        <p>检测时间 {{ formatHistoryTime(settings.githubBackup.latestRemoteBackupAt) }}，可以立即恢复到当前设备。</p>
        <div class="action-row compact-row">
          <button class="secondary-action" type="button" :disabled="Boolean(githubBusy)" @click="dismissRestorePrompt">
            <span>稍后再说</span>
          </button>
          <button class="primary-action" type="button" :disabled="Boolean(githubBusy)" @click="restoreLatestGitHubBackup">
            <span>立即恢复</span>
          </button>
        </div>
      </section>

      <section class="status-panel progress-panel" v-if="showProgressPanel">
        <div class="progress-head">
          <strong>{{ progressTitle }}</strong>
          <span>{{ progressPercentLabel }}</span>
        </div>
        <p>{{ progressLabel }}</p>
        <div class="progress-track" aria-hidden="true">
          <span class="progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
      </section>

      <section class="status-panel history-panel" v-if="historyList.length">
        <div class="history-head">
          <strong>最近三次 GitHub 备份</strong>
          <button class="text-action" type="button" :disabled="Boolean(githubBusy) || !isGitHubReady" @click="refreshGitHubHistory">刷新</button>
        </div>
        <button
          v-for="item in historyList"
          :key="item.sha"
          class="history-item"
          type="button"
          :disabled="Boolean(githubBusy)"
          @click="restoreHistoryItem(item.sha)"
        >
          <div>
            <strong>{{ formatHistoryTime(item.exportedAt || item.committedAt) }}</strong>
            <span>{{ historyItemLabel(item.message) }}</span>
          </div>
          <span>恢复</span>
        </button>
      </section>

      <div class="action-row github-actions">
        <button class="secondary-action" type="button" :disabled="Boolean(githubBusy) || !githubToken.trim()" @click="createPrivateRepository">
          <Lock :size="16" />
          <span>创建私有仓库</span>
        </button>
        <button class="secondary-action" type="button" :disabled="Boolean(githubBusy) || !isGitHubReady" @click="runGitHubImport">
          <Download :size="16" />
          <span>导入 GitHub 备份</span>
        </button>
        <button class="primary-action" type="button" :disabled="Boolean(githubBusy) || !isGitHubReady" @click="runManualGitHubBackup">
          <CloudUpload :size="16" />
          <span>立即备份</span>
        </button>
      </div>

      <p v-if="githubFeedback" class="feedback" :class="githubFeedbackKind">{{ githubFeedback }}</p>
      <p v-else-if="settings.githubBackup.lastBackupError" class="feedback error">{{ settings.githubBackup.lastBackupError }}</p>
    </section>

  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CloudUpload, Download, Github, Lock } from 'lucide-vue-next';
import CloudBackupPanel from '@/components/settings/CloudBackupPanel.vue';
import { writeClipboardText } from '@/services/clipboard';
import { buildGitHubLoginUrl, ensureGitHubBackupRepository, fetchGitHubViewer, findGitHubBackupRepository, formatGitHubBackupError, getGitHubOAuthWorkerOrigin } from '@/services/githubBackup';
import { formatRuntimeDiagnostics } from '@/services/runtimeDiagnostics';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, GitHubBackupHistoryRecord, GitHubBackupSettings } from '@/types/domain';
import { canPrepareBackupDestination, createBackupArchiveFilename, downloadLinkBackupArchive, parseLinkBackupBlob, prepareBackupDestination, type PreparedBackupDestination } from '@/utils/backup';

const props = defineProps<{
  userId: string;
  settings: AppSettings;
  activeSection: 'local' | 'cloud' | 'github';
}>();
const emit = defineEmits<{ 'change-section': [section: 'local' | 'cloud' | 'github'] }>();

const store = useAppStore();
const localBusy = ref('');
const localFeedback = ref('');
const localFeedbackKind = ref<'success' | 'error'>('success');
const diagnosticBusy = ref(false);
const githubBusy = ref('');
const githubFeedback = ref('');
const githubFeedbackKind = ref<'success' | 'error'>('success');
const githubToken = ref('');
const ownerDraft = ref('');
const repoDraft = ref('');
const branchDraft = ref('main');
const pathDraft = ref('link-backup.json');
const intervalDraft = ref(30);
const enabledDraft = ref(false);
let githubLoginWindow: Window | null = null;

interface GitHubOAuthMessage {
  type: 'link:github-oauth';
  token?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  error?: string;
}

const githubSettings = computed(() => props.settings.githubBackup);
const isGitHubReady = computed(() => Boolean(githubToken.value.trim() && ownerDraft.value.trim() && repoDraft.value.trim()));
const historyList = computed(() => githubSettings.value.history ?? []);
const progress = computed(() => githubSettings.value.progress);
const progressPercent = computed(() => Math.min(100, Math.max(0, progress.value.percent || 0)));
const progressPercentLabel = computed(() => `${progressPercent.value}%`);
const progressLabel = computed(() => progress.value.label || '');
const progressTitle = computed(() => progress.value.phase === 'completed' ? '备份状态' : progress.value.phase === 'failed' ? '备份失败' : '进行中');
const showProgressPanel = computed(() => progress.value.phase !== 'idle' && Boolean(progress.value.label));
const showRestorePrompt = computed(() => Boolean(githubSettings.value.pendingRestoreSha && githubSettings.value.latestRemoteBackupAt));
const statusClass = computed(() => {
  if (githubSettings.value.lastBackupStatus === 'running') return 'running';
  if (githubSettings.value.lastBackupStatus === 'failed') return 'failed';
  if (githubSettings.value.lastBackupStatus === 'success') return 'success';
  return githubSettings.value.enabled ? 'success' : 'idle';
});
const statusLabel = computed(() => {
  if (githubSettings.value.lastBackupStatus === 'running') return '备份中';
  if (githubSettings.value.lastBackupStatus === 'failed') return '失败';
  if (githubSettings.value.lastBackupAt) return formatBackupTime(githubSettings.value.lastBackupAt);
  return githubSettings.value.enabled ? '已开启' : '未开启';
});
const autoBackupLabel = computed(() => enabledDraft.value ? `每 ${normalizedInterval()} 分钟` : '');

watch(
  () => [
    githubSettings.value.token,
    githubSettings.value.owner,
    githubSettings.value.repo,
    githubSettings.value.branch,
    githubSettings.value.path,
    githubSettings.value.intervalMinutes,
    githubSettings.value.enabled
  ],
  () => syncGitHubDraft(),
  { immediate: true }
);

const githubOAuthMessageListener = (event: MessageEvent) => {
  void handleGitHubOAuthMessage(event);
};

onMounted(() => {
  window.addEventListener('message', githubOAuthMessageListener);
});

onBeforeUnmount(() => {
  window.removeEventListener('message', githubOAuthMessageListener);
});

function isGitHubOAuthMessage(value: unknown): value is GitHubOAuthMessage {
  return Boolean(value && typeof value === 'object' && (value as { type?: string }).type === 'link:github-oauth');
}

function syncGitHubDraft() {
  githubToken.value = githubSettings.value.token;
  ownerDraft.value = githubSettings.value.owner;
  repoDraft.value = githubSettings.value.repo;
  branchDraft.value = githubSettings.value.branch;
  pathDraft.value = githubSettings.value.path;
  intervalDraft.value = githubSettings.value.intervalMinutes;
  enabledDraft.value = githubSettings.value.enabled;
}

function normalizedInterval() {
  return Math.min(1440, Math.max(1, Math.round(Number(intervalDraft.value) || githubSettings.value.intervalMinutes || 30)));
}

function buildGitHubDraft(overrides: Partial<GitHubBackupSettings> = {}): GitHubBackupSettings {
  const currentGitHubSettings = store.settings?.githubBackup ?? githubSettings.value;
  return {
    ...currentGitHubSettings,
    token: githubToken.value.trim(),
    owner: ownerDraft.value.trim().replace(/^@/, ''),
    repo: repoDraft.value.trim() || 'link-private-backups',
    branch: branchDraft.value.trim() || 'main',
    path: pathDraft.value.trim().replace(/^\/+/, '') || 'link-backup.json',
    intervalMinutes: normalizedInterval(),
    enabled: enabledDraft.value,
    ...overrides
  };
}

async function saveGitHubDraft(overrides: Partial<GitHubBackupSettings> = {}) {
  const currentSettings = store.settings ?? props.settings;
  await store.saveSettings({
    ...currentSettings,
    githubBackup: buildGitHubDraft(overrides)
  });
}

function setLocalFeedback(message: string, kind: 'success' | 'error' = 'success') {
  localFeedback.value = message;
  localFeedbackKind.value = kind;
}

function setGitHubFeedback(message: string, kind: 'success' | 'error' = 'success') {
  githubFeedback.value = message;
  githubFeedbackKind.value = kind;
}

function formatBackupTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatHistoryTime(timestamp: number) {
  if (!timestamp) return '未知时间';
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
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

async function waitForBusyPaint() {
  await nextTick();
  await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function historyItemLabel(message: string) {
  return message.replace(/^Auto LINK backup |^Manual LINK backup /, '').trim() || 'GitHub 备份';
}

async function exportBackup() {
  if (!store.beginLocalBackupOperation('exporting')) {
    setLocalFeedback('已有备份或导入正在进行，请完成后再试。', 'error');
    return;
  }
  localBusy.value = 'export';
  localFeedback.value = '';

  try {
    const fileName = createBackupArchiveFilename(props.userId);
    let destination: PreparedBackupDestination | null = null;
    if (canPrepareBackupDestination()) {
      try {
        destination = await prepareBackupDestination(fileName);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setLocalFeedback('已取消导出。');
          return;
        }
        throw error;
      }
    }
    const archive = await store.createBackupArchive((label, percent) => {
      setLocalFeedback(`${label} ${Math.round(percent)}%`);
    });
    const saved = await downloadLinkBackupArchive(archive, fileName, {
      destination,
      onProgress: (label, percent) => setLocalFeedback(`${label} ${Math.round(percent)}%`)
    });
    const omittedHint = archive.backup.omittedLocalMedia ? ` 已跳过 ${archive.backup.omittedLocalMedia} 个此前丢失的本地媒体文件。` : '';
    setLocalFeedback(saved.method === 'browser-download'
      ? `已创建浏览器下载任务，请到“${saved.location}”确认文件。${omittedHint}`
      : saved.method === 'native-share'
        ? `已打开系统保存或分享面板；请选择“保存到设备/文件”并确认。关闭或取消面板不会生成本地备份。${omittedHint}`
      : `备份已写入“${saved.location}”。${omittedHint}`);
  } catch (error) {
    setLocalFeedback(error instanceof Error ? error.message : '导出失败。', 'error');
  } finally {
    store.endLocalBackupOperation();
    localBusy.value = '';
  }
}

async function copyRuntimeDiagnostic() {
  diagnosticBusy.value = true;
  try {
    await writeClipboardText(await formatRuntimeDiagnostics());
    setLocalFeedback('版本诊断已复制，可安全发送给技术支持。');
  } catch (error) {
    setLocalFeedback(error instanceof Error ? error.message : '无法复制版本诊断。', 'error');
  } finally {
    diagnosticBusy.value = false;
  }
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const confirmMessage = file.size >= 48 * 1024 * 1024
    ? `这个完整备份文件有 ${formatBytes(file.size)}，包含本地媒体，导入需要足够的设备存储空间。导入会替换当前本地数据，继续吗？`
    : '导入备份会替换当前本地数据，继续吗？';
  if (!window.confirm(confirmMessage)) {
    input.value = '';
    return;
  }

  localBusy.value = 'import';
  localFeedback.value = '';
  if (!store.beginLocalBackupOperation('importing')) {
    setLocalFeedback('已有备份或导入正在进行，请完成后再试。', 'error');
    input.value = '';
    localBusy.value = '';
    return;
  }
  setLocalFeedback(`正在读取备份文件 ${formatBytes(file.size)}`);
  await waitForBusyPaint();

  try {
    const backup = await parseLinkBackupBlob(file);
    const result = await store.importBackupSnapshot(backup.snapshot, {
      sourceByteSize: file.size,
      onProgress: (label, percent) => setLocalFeedback(`${label} ${Math.round(percent)}%`)
    });
    const persistenceHint = result.persistentStorageGranted ? '' : ' 当前浏览器未授予持久存储；如果退出后仍丢数据，建议安装为 PWA 后再导入。';
    setLocalFeedback(`完整备份已导入。${persistenceHint}`);
  } catch (error) {
    setLocalFeedback(error instanceof Error ? error.message : '导入失败。', 'error');
  } finally {
    input.value = '';
    store.endLocalBackupOperation();
    localBusy.value = '';
  }
}

function openGitHubLogin() {
  const login = buildGitHubLoginUrl();
  githubLoginWindow = window.open(login.url, 'link-github-oauth', 'width=480,height=720');
  setGitHubFeedback(login.mode === 'worker'
    ? '已打开 GitHub 授权页，授权完成后会自动查找已有备份；找不到时才创建私有仓库。'
    : login.mode === 'oauth'
      ? '已打开 GitHub 授权页。静态前端仍需要后端回调来自动换取 token。'
      : '已打开 GitHub token 页面。创建后把 token 粘贴回来，点右侧图标会自动查找已有备份。');
}

async function handleGitHubOAuthMessage(event: MessageEvent) {
  const workerOrigin = getGitHubOAuthWorkerOrigin();
  if (!workerOrigin || event.origin !== workerOrigin) return;
  if (!isGitHubOAuthMessage(event.data)) return;

  const message = event.data;
  if (message.error) {
    setGitHubFeedback(message.error, 'error');
    return;
  }
  if (!message.token || !message.owner) {
    setGitHubFeedback('GitHub 登录结果不完整。', 'error');
    return;
  }

  await completeGitHubOAuthSetup(message);
}

async function completeGitHubOAuthSetup(message: GitHubOAuthMessage) {
  if (!message.token || !message.owner) return;
  githubBusy.value = 'oauth';
  githubFeedback.value = '';
  githubToken.value = message.token;
  ownerDraft.value = message.owner;
  repoDraft.value = message.repo?.trim() || repoDraft.value || 'link-private-backups';
  branchDraft.value = message.branch?.trim() || branchDraft.value || 'main';
  enabledDraft.value = true;

  try {
    setGitHubFeedback('GitHub 已授权，正在自动查找已有 LINK 备份...');
    const discoveredBackup = await findGitHubBackupRepository({
      token: message.token,
      owner: message.owner,
      preferredRepo: repoDraft.value,
      preferredPath: pathDraft.value
    });

    if (discoveredBackup) {
      ownerDraft.value = discoveredBackup.owner;
      repoDraft.value = discoveredBackup.repo;
      branchDraft.value = discoveredBackup.branch || branchDraft.value;
      pathDraft.value = discoveredBackup.path;
      await saveGitHubDraft({
        token: message.token,
        owner: discoveredBackup.owner,
        repo: discoveredBackup.repo,
        branch: discoveredBackup.branch || branchDraft.value,
        path: discoveredBackup.path,
        enabled: true,
        lastBackupStatus: 'idle',
        lastBackupError: ''
      });
      const history = await store.syncGitHubBackupHistory();
      const latest = history[0];
      githubLoginWindow?.close();
      await saveGitHubDraft({
        pendingRestoreSha: latest?.sha ?? '',
        pendingRestoreAt: latest?.committedAt ?? 0
      });
      if (latest && window.confirm(`已找到 ${discoveredBackup.owner}/${discoveredBackup.repo} 的 GitHub 备份，要立即导入到当前设备吗？`)) {
        await store.importGitHubBackup(latest.sha);
        setGitHubFeedback(`已从 ${discoveredBackup.owner}/${discoveredBackup.repo} 导入 GitHub 备份。`);
        return;
      }
      setGitHubFeedback(`已自动连接 ${discoveredBackup.owner}/${discoveredBackup.repo}，可点“立即恢复”或“导入 GitHub 备份”。`);
      return;
    }

    const repository = await ensureGitHubBackupRepository(buildGitHubDraft({
      token: message.token,
      owner: message.owner,
      repo: repoDraft.value,
      branch: branchDraft.value,
      enabled: true,
      lastBackupStatus: 'idle',
      lastBackupError: ''
    }));
    ownerDraft.value = repository.owner;
    repoDraft.value = repository.repo;
    branchDraft.value = repository.branch || branchDraft.value;
    await saveGitHubDraft({
      token: message.token,
      owner: repository.owner,
      repo: repository.repo,
      branch: repository.branch || branchDraft.value,
      enabled: true,
      lastBackupStatus: 'idle',
      lastBackupError: ''
    });
    const hasRemoteBackup = await store.hasGitHubBackup();
    githubLoginWindow?.close();
    if (hasRemoteBackup) {
      const latestRemote = store.settings?.githubBackup;
      await saveGitHubDraft({
        pendingRestoreSha: latestRemote?.latestRemoteBackupSha ?? '',
        pendingRestoreAt: latestRemote?.latestRemoteBackupAt ?? 0
      });
      setGitHubFeedback(`已连接 ${repository.owner}/${repository.repo}，检测到 GitHub 上已有备份，可选择恢复。`);
      return;
    }
    await store.runGitHubBackup('manual');
    setGitHubFeedback(`没有找到已有 LINK 备份，已创建 ${repository.owner}/${repository.repo} 并完成首次备份。`);
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function connectGitHub() {
  githubBusy.value = 'connect';
  githubFeedback.value = '';

  try {
    const viewer = await fetchGitHubViewer(githubToken.value);
    ownerDraft.value = viewer.login;
    setGitHubFeedback('已连接 GitHub，正在自动查找已有 LINK 备份...');
    const discoveredBackup = await findGitHubBackupRepository({
      token: githubToken.value,
      owner: viewer.login,
      preferredRepo: repoDraft.value,
      preferredPath: pathDraft.value
    });
    if (discoveredBackup) {
      ownerDraft.value = discoveredBackup.owner;
      repoDraft.value = discoveredBackup.repo;
      branchDraft.value = discoveredBackup.branch || branchDraft.value;
      pathDraft.value = discoveredBackup.path;
      await saveGitHubDraft({
        owner: discoveredBackup.owner,
        repo: discoveredBackup.repo,
        branch: discoveredBackup.branch || branchDraft.value,
        path: discoveredBackup.path,
        lastBackupStatus: 'idle',
        lastBackupError: ''
      });
      await refreshGitHubHistory();
      setGitHubFeedback(`已自动连接 ${discoveredBackup.owner}/${discoveredBackup.repo}，可直接导入 GitHub 备份。`);
      return;
    }
    await saveGitHubDraft({ owner: viewer.login, lastBackupStatus: 'idle', lastBackupError: '' });
    await refreshGitHubHistory();
    setGitHubFeedback(`已连接 ${viewer.login}，但没有在私有仓库中找到 LINK 备份。`);
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function createPrivateRepository() {
  githubBusy.value = 'repo';
  githubFeedback.value = '';

  try {
    const repository = await ensureGitHubBackupRepository(buildGitHubDraft());
    ownerDraft.value = repository.owner;
    repoDraft.value = repository.repo;
    branchDraft.value = repository.branch || branchDraft.value;
    await saveGitHubDraft({ owner: repository.owner, repo: repository.repo, branch: repository.branch || branchDraft.value, lastBackupStatus: 'idle', lastBackupError: '' });
    setGitHubFeedback(`${repository.owner}/${repository.repo} 已就绪。`);
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function refreshGitHubHistory() {
  githubBusy.value = 'history';
  githubFeedback.value = '';

  try {
    await saveGitHubDraft();
    const history = await store.syncGitHubBackupHistory();
    const latest = history[0];
    await saveGitHubDraft({
      pendingRestoreSha: latest?.sha ?? '',
      pendingRestoreAt: latest?.committedAt ?? 0
    });
    setGitHubFeedback(history.length ? 'GitHub 备份记录已同步。' : 'GitHub 上还没有备份记录。');
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function restoreHistoryItem(sha: string) {
  if (!window.confirm('恢复该历史备份会替换当前本地数据，继续吗？')) return;

  githubBusy.value = 'history-restore';
  githubFeedback.value = '';

  try {
    await saveGitHubDraft();
    await store.importGitHubBackup(sha);
    setGitHubFeedback('已恢复所选 GitHub 历史备份。');
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function restoreLatestGitHubBackup() {
  const sha = githubSettings.value.pendingRestoreSha || githubSettings.value.latestRemoteBackupSha;
  if (!sha) return;
  await restoreHistoryItem(sha);
}

async function dismissRestorePrompt() {
  await saveGitHubDraft({ pendingRestoreSha: '', pendingRestoreAt: 0 });
  setGitHubFeedback('已保留当前本地数据，可稍后手动恢复 GitHub 备份。');
}

async function toggleAutoBackup(event: Event) {
  const input = event.target as HTMLInputElement;
  const checked = input.checked;

  if (checked && !isGitHubReady.value) {
    input.checked = false;
    enabledDraft.value = false;
    setGitHubFeedback('请先连接 GitHub 并创建仓库。', 'error');
    return;
  }

  enabledDraft.value = checked;
  await saveGitHubDraft({ enabled: checked, lastBackupStatus: checked ? githubSettings.value.lastBackupStatus : 'idle', lastBackupError: '' });
  setGitHubFeedback(checked ? '自动备份已开启。' : '自动备份已关闭。');
}

async function runManualGitHubBackup() {
  githubBusy.value = 'backup';
  githubFeedback.value = '';

  try {
    await saveGitHubDraft();
    await store.runGitHubBackup('manual');
    setGitHubFeedback(`已备份到 ${ownerDraft.value}/${repoDraft.value}。`);
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}

async function runGitHubImport() {
  if (!window.confirm('从 GitHub 导入会替换当前本地数据，继续吗？')) return;

  githubBusy.value = 'import';
  githubFeedback.value = '';

  try {
    await saveGitHubDraft();
    await store.importGitHubBackup();
    setGitHubFeedback(`已从 ${ownerDraft.value}/${repoDraft.value} 导入备份。`);
  } catch (error) {
    setGitHubFeedback(formatGitHubBackupError(error), 'error');
  } finally {
    githubBusy.value = '';
  }
}
</script>

<style scoped>
.data-center {
  display: grid;
  gap: 14px;
}

.backup-card {
  display: grid;
  gap: 12px;
  padding: 14px;
  border-radius: 14px;
  background: var(--soft);
}

.card-head,
.field-with-action,
.toggle-card,
.progress-head,
.history-head {
  display: flex;
  align-items: center;
}

.card-head {
  justify-content: space-between;
  gap: 12px;
}

.card-kicker {
  display: block;
  margin-bottom: 3px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.card-head h3 {
  margin: 0;
  font-size: 17px;
  line-height: 1.15;
}

.action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  min-width: 0;
}

.compact-row {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.github-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.github-actions .primary-action {
  grid-column: 1 / -1;
}

.github-actions .primary-action,
.github-actions .secondary-action {
  gap: 4px;
  padding: 0 8px;
  font-size: 12px;
}

.primary-action,
.secondary-action,
.icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.primary-action,
.secondary-action {
  gap: 6px;
  width: 100%;
  min-width: 0;
  padding: 0 12px;
}

.primary-action span,
.secondary-action span {
  min-width: 0;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.primary-action svg,
.secondary-action svg,
.icon-action svg {
  flex: 0 0 auto;
}

.wide-action {
  width: 100%;
}

.status-panel {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
}

.status-panel p {
  margin: 0;
  color: var(--muted);
}

.card-note,
.mini-copy {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
}

.progress-head,
.history-head {
  justify-content: space-between;
  gap: 12px;
}

.progress-track {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #111111, #4e8cff);
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(17, 17, 17, 0.04);
  text-align: left;
}

.history-item strong,
.history-item span,
.text-action {
  font-size: 12px;
}

.history-item div {
  display: grid;
  gap: 2px;
}

.text-action {
  color: #111111;
  font-weight: 800;
}

.primary-action {
  background: #111111;
  color: #ffffff;
}

.local-export-action {
  background: rgba(232, 235, 239, 0.98);
  color: #202321;
}

.secondary-action {
  position: relative;
  background: rgba(255, 255, 255, 0.84);
  color: #202321;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.primary-action:disabled,
.secondary-action:disabled,
.secondary-action.disabled,
.icon-action:disabled {
  cursor: not-allowed;
  opacity: 0.52;
}

.file-action input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.github-card {
  background: linear-gradient(180deg, #f8faf9, #edf3ef);
}

.status-badge {
  flex: 0 0 auto;
  max-width: 108px;
  padding: 6px 9px;
  border-radius: 999px;
  background: rgba(17, 17, 17, 0.08);
  color: #3d433f;
  font-size: 11px;
  font-weight: 900;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge.success {
  background: #dff5e6;
  color: #136c36;
}

.status-badge.failed {
  background: #ffe1e1;
  color: #a82424;
}

.status-badge.running {
  background: #e4ecff;
  color: #315ab6;
}

.field,
.toggle-card {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field span,
.toggle-card span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.field input {
  min-width: 0;
  width: 100%;
  min-height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.86);
  padding: 11px 12px;
  color: #161917;
  font-size: 13px;
}

.field-with-action {
  gap: 8px;
  min-width: 0;
}

.icon-action {
  flex: 0 0 38px;
  width: 38px;
  padding: 0;
  background: #111111;
  color: #ffffff;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.toggle-card {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
}

.toggle-card input {
  width: 18px;
  height: 18px;
}

.toggle-card strong {
  font-size: 13px;
}

.feedback {
  margin: 0;
  color: #136c36;
  font-size: 12px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.feedback.error {
  color: #a82424;
}

@media (max-width: 380px) {
  .github-actions {
    grid-template-columns: 1fr;
  }

  .github-actions .primary-action {
    grid-column: auto;
  }
}

@media (max-width: 360px) {
  .data-center {
    gap: 12px;
  }

  .backup-card {
    gap: 11px;
    padding: 12px;
    border-radius: 12px;
  }

  .field-grid {
    grid-template-columns: 1fr;
  }

  .github-actions {
    grid-template-columns: 1fr;
  }

  .github-actions .primary-action {
    grid-column: auto;
  }

  .primary-action,
  .secondary-action {
    padding: 0 10px;
    font-size: 12px;
  }

}
</style>