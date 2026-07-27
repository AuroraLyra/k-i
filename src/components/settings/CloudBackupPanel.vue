<template>
  <section class="backup-card cloud-backup-card">
    <header class="card-head">
      <div>
        <span class="card-kicker">Bring your own storage</span>
        <h3>一键连接自己的云盘</h3>
      </div>
      <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
    </header>

    <p class="security-note">
      备份只在当前设备加密，并直传到你自己的云盘。LINK 服务器不接收备份、云盘 Token 或恢复密钥。
    </p>

    <div class="provider-list" aria-label="选择云备份提供商">
      <button
        v-for="provider in oauthProviders"
        :key="provider.id"
        class="provider-button"
        :class="[`provider-${provider.id}`, { connected: cloudSettings.provider === provider.id }]"
        type="button"
        :disabled="Boolean(busy) || !isCloudOAuthProviderConfigured(provider.id)"
        @click="connectOAuthProvider(provider.id)"
      >
        <span class="provider-logo" aria-hidden="true">{{ provider.mark }}</span>
        <span class="provider-copy">
          <strong>{{ provider.label }}</strong>
          <small>{{ cloudSettings.provider === provider.id ? connectedAccountLabel : isCloudOAuthProviderConfigured(provider.id) ? '点一下即可连接' : '暂未配置' }}</small>
        </span>
        <span class="provider-state">{{ busy === `connect-${provider.id}` ? '连接中…' : cloudSettings.provider === provider.id ? '已连接' : isCloudOAuthProviderConfigured(provider.id) ? '连接' : '不可用' }}</span>
      </button>

      <button
        class="provider-button provider-r2-worker"
        :class="{ connected: cloudSettings.provider === 'r2-worker' }"
        type="button"
        :disabled="Boolean(busy)"
        @click="openR2Setup"
      >
        <span class="provider-logo cloudflare-mark" aria-hidden="true">R2</span>
        <span class="provider-copy">
          <strong>Cloudflare R2</strong>
          <small>{{ cloudSettings.provider === 'r2-worker' ? connectedAccountLabel : '大数据 · 用户自有 Worker' }}</small>
        </span>
        <span class="provider-state">{{ cloudSettings.provider === 'r2-worker' ? '已连接' : '部署' }}</span>
      </button>
    </div>

    <section v-if="showR2Setup && cloudSettings.provider !== 'r2-worker'" class="r2-setup-card">
      <div class="r2-setup-head">
        <span class="provider-logo cloudflare-mark" aria-hidden="true">R2</span>
        <div>
          <strong>部署到你的 Cloudflare</strong>
          <p>Cloudflare 会在你的账号创建 Worker 和 R2；部署完成后只需粘贴一次 Worker 地址。</p>
        </div>
      </div>
      <button class="deploy-action" type="button" @click="deployR2Worker">
        <ExternalLink :size="17" />
        <span>一键部署并打开 Cloudflare</span>
      </button>
      <label class="field">
        <span>部署完成后粘贴 Worker 地址</span>
        <div class="field-with-action">
          <input v-model="workerUrlDraft" type="url" autocomplete="url" placeholder="https://babylink-r2-backup.xxx.workers.dev" />
          <button class="icon-action connect-worker-action" type="button" :disabled="Boolean(busy)" @click="connectR2Worker">
            {{ busy === 'connect-r2' ? '连接中' : workerUrlDraft.trim() ? '连接' : '粘贴连接' }}
          </button>
        </div>
      </label>
    </section>

    <section v-if="isConnected" class="connected-panel">
      <div class="connection-row">
        <span class="connection-icon"><ShieldCheck :size="18" /></span>
        <div>
          <strong>{{ activeProviderLabel }} 已连接</strong>
          <small>{{ connectedAccountLabel }}</small>
        </div>
        <button class="text-action danger" type="button" :disabled="Boolean(busy)" @click="disconnectCloud">断开</button>
      </div>

      <label class="field recovery-field">
        <span>恢复密钥</span>
        <div class="field-with-action">
          <input
            v-model="recoveryKeyDraft"
            :type="showRecoveryKey ? 'text' : 'password'"
            autocomplete="off"
            placeholder="跨设备恢复时粘贴恢复密钥"
            @change="saveRecoveryKey"
          />
          <button class="icon-action compact-icon-action" type="button" :aria-label="showRecoveryKey ? '隐藏恢复密钥' : '显示恢复密钥'" @click="showRecoveryKey = !showRecoveryKey">
            <EyeOff v-if="showRecoveryKey" :size="15" />
            <Eye v-else :size="15" />
          </button>
          <button class="icon-action key-copy-action" type="button" @click="copyRecoveryKey">复制</button>
        </div>
      </label>
      <p class="key-note">密钥只保存在当前设备。首次连接会自动生成，请保存到密码管理器；丢失后任何人都无法恢复备份。</p>

      <div class="backup-preferences">
        <label class="toggle-card">
          <input type="checkbox" :checked="cloudSettings.enabled" @change="toggleAutoBackup" />
          <div>
            <strong>应用运行时自动备份</strong>
            <span>{{ cloudSettings.enabled ? `每 ${normalizedInterval()} 分钟检查一次` : '关闭' }}</span>
          </div>
        </label>
        <label class="interval-field">
          <span>间隔</span>
          <input v-model.number="intervalDraft" type="number" min="5" max="1440" step="5" @change="saveInterval" />
          <small>分钟</small>
        </label>
      </div>

      <section v-if="showProgress" class="progress-panel">
        <div class="progress-head">
          <strong>{{ cloudSettings.progress.label }}</strong>
          <span>{{ progressPercent }}%</span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <span :style="{ width: `${progressPercent}%` }" />
        </div>
      </section>

      <div class="action-row cloud-actions">
        <button class="secondary-action" type="button" :disabled="Boolean(busy)" @click="testConnection">
          <RefreshCw :size="15" />
          <span>测试</span>
        </button>
        <button class="secondary-action" type="button" :disabled="Boolean(busy)" @click="restoreBackup">
          <Download :size="15" />
          <span>恢复</span>
        </button>
        <button class="primary-action" type="button" :disabled="Boolean(busy)" @click="backupNow">
          <CloudUpload :size="15" />
          <span>立即备份</span>
        </button>
      </div>

      <p v-if="cloudSettings.lastBackupAt" class="last-backup-note">
        最近备份 {{ formatTime(cloudSettings.lastBackupAt) }}<template v-if="cloudSettings.lastBackupBytes"> · {{ formatBytes(cloudSettings.lastBackupBytes) }}</template>
      </p>
    </section>

    <p v-if="feedback" class="feedback" :class="feedbackKind">{{ feedback }}</p>
    <p v-else-if="cloudSettings.lastBackupError" class="feedback error">{{ cloudSettings.lastBackupError }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { CloudUpload, Download, ExternalLink, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-vue-next';
import { cloudBackupProviderLabels, getR2WorkerDeployUrl, isCloudBackupConnected, isCloudOAuthProviderConfigured, pairR2Worker, startCloudOAuth, testCloudBackupConnection, type CloudOAuthConnection } from '@/services/cloudBackup';
import { createBackupRecoveryKey } from '@/services/encryptedBackup';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, CloudBackupProvider, CloudBackupSettings } from '@/types/domain';

const props = defineProps<{ settings: AppSettings }>();
const store = useAppStore();
const workerUrlDraft = ref('');
const recoveryKeyDraft = ref('');
const intervalDraft = ref(30);
const showR2Setup = ref(false);
const showRecoveryKey = ref(false);
const busy = ref('');
const feedback = ref('');
const feedbackKind = ref<'success' | 'error'>('success');

const oauthProviders = [
  { id: 'google-drive' as const, label: 'Google Drive', mark: 'G' },
  { id: 'onedrive' as const, label: 'OneDrive', mark: 'O' },
  { id: 'dropbox' as const, label: 'Dropbox', mark: 'D' }
];

interface CloudOAuthMessage {
  type: 'link:cloud-oauth';
  connection?: CloudOAuthConnection;
  error?: string;
}

const cloudSettings = computed(() => props.settings.cloudBackup);
const isConnected = computed(() => isCloudBackupConnected(cloudSettings.value));
const activeProviderLabel = computed(() => cloudSettings.value.provider ? cloudBackupProviderLabels[cloudSettings.value.provider] : '云盘');
const connectedAccountLabel = computed(() => cloudSettings.value.accountLabel || (cloudSettings.value.provider === 'r2-worker' ? '你的 Cloudflare 账号' : '你的私有空间'));
const progressPercent = computed(() => Math.min(100, Math.max(0, Math.round(cloudSettings.value.progress.percent || 0))));
const showProgress = computed(() => !['idle'].includes(cloudSettings.value.progress.phase) && Boolean(cloudSettings.value.progress.label));
const statusClass = computed(() => cloudSettings.value.lastBackupStatus === 'failed'
  ? 'failed'
  : cloudSettings.value.lastBackupStatus === 'running'
    ? 'running'
    : isConnected.value
      ? 'success'
      : 'idle');
const statusLabel = computed(() => {
  if (cloudSettings.value.lastBackupStatus === 'running') return '备份中';
  if (cloudSettings.value.lastBackupStatus === 'failed') return '失败';
  if (isConnected.value) return '已连接';
  return '未连接';
});

watch(() => props.settings.cloudBackup, (settings) => {
  workerUrlDraft.value = settings.workerUrl;
  recoveryKeyDraft.value = settings.recoveryKey;
  intervalDraft.value = settings.intervalMinutes;
  if (settings.provider === 'r2-worker') showR2Setup.value = true;
}, { immediate: true, deep: true });

const oauthMessageListener = (event: MessageEvent) => {
  if (event.origin !== window.location.origin || !isCloudOAuthMessage(event.data)) return;
  void handleOAuthMessage(event.data);
};

onMounted(() => window.addEventListener('message', oauthMessageListener));
onBeforeUnmount(() => window.removeEventListener('message', oauthMessageListener));

function isCloudOAuthMessage(value: unknown): value is CloudOAuthMessage {
  return Boolean(value && typeof value === 'object' && (value as { type?: string }).type === 'link:cloud-oauth');
}

function setFeedback(message: string, kind: 'success' | 'error' = 'success') {
  feedback.value = message;
  feedbackKind.value = kind;
}

function normalizedInterval() {
  return Math.min(1440, Math.max(5, Math.round(Number(intervalDraft.value) || 30)));
}

async function saveCloudSettings(overrides: Partial<CloudBackupSettings>) {
  const current = store.settings ?? props.settings;
  await store.saveSettings({
    ...current,
    cloudBackup: { ...current.cloudBackup, ...overrides }
  });
}

async function applyOAuthConnection(connection: CloudOAuthConnection) {
  const current = store.settings?.cloudBackup ?? cloudSettings.value;
  const recoveryKey = current.recoveryKey || createBackupRecoveryKey();
  recoveryKeyDraft.value = recoveryKey;
  await saveCloudSettings({
    enabled: false,
    provider: connection.provider,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    tokenExpiresAt: connection.tokenExpiresAt,
    accountLabel: connection.accountLabel,
    workerUrl: '',
    workerToken: '',
    recoveryKey,
    remoteFileId: '',
    lastBackupAt: 0,
    lastBackupStatus: 'idle',
    lastBackupError: '',
    latestRemoteBackupAt: 0,
    lastBackupBytes: 0,
    progress: { phase: 'completed', label: '云盘连接成功，自动备份已开启', percent: 100, updatedAt: Date.now() }
  });
  await navigator.clipboard.writeText(recoveryKey).catch(() => undefined);
  setFeedback(`${cloudBackupProviderLabels[connection.provider]} 已连接，正在完成首次加密备份…`);
  try {
    await store.runCloudBackup('manual');
    setFeedback(`${cloudBackupProviderLabels[connection.provider]} 已连接并完成首次加密备份；恢复密钥已尝试复制。`);
  } catch (error) {
    setFeedback(`${cloudBackupProviderLabels[connection.provider]} 已连接，但首次备份失败：${error instanceof Error ? error.message : '请稍后重试。'}`, 'error');
  } finally {
    await saveCloudSettings({ enabled: true });
  }
}

async function handleOAuthMessage(message: CloudOAuthMessage) {
  if (message.error) {
    setFeedback(message.error, 'error');
    return;
  }
  if (!message.connection) return;
  busy.value = 'saving-connection';
  try {
    await applyOAuthConnection(message.connection);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '保存云盘连接失败。', 'error');
  } finally {
    busy.value = '';
  }
}

async function connectOAuthProvider(provider: Exclude<CloudBackupProvider, 'r2-worker'>) {
  busy.value = `connect-${provider}`;
  feedback.value = '';
  try {
    await startCloudOAuth(provider);
    setFeedback(`请在新窗口完成 ${cloudBackupProviderLabels[provider]} 授权。`);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '无法打开云盘授权。', 'error');
  } finally {
    busy.value = '';
  }
}

function openR2Setup() {
  showR2Setup.value = true;
  feedback.value = '';
}

function deployR2Worker() {
  window.open(getR2WorkerDeployUrl(), '_blank', 'noopener,noreferrer');
  setFeedback('部署完成后复制 workers.dev 地址，粘贴到下方即可连接。');
}

async function connectR2Worker() {
  busy.value = 'connect-r2';
  feedback.value = '';
  try {
    if (!workerUrlDraft.value.trim()) {
      workerUrlDraft.value = (await navigator.clipboard.readText().catch(() => '')).trim();
    }
    if (!workerUrlDraft.value.trim()) throw new Error('请先复制部署完成后的 workers.dev 地址。');
    const connection = await pairR2Worker(workerUrlDraft.value);
    const current = store.settings?.cloudBackup ?? cloudSettings.value;
    const recoveryKey = current.recoveryKey || createBackupRecoveryKey();
    recoveryKeyDraft.value = recoveryKey;
    await saveCloudSettings({
      enabled: false,
      provider: 'r2-worker',
      accessToken: '',
      refreshToken: '',
      tokenExpiresAt: 0,
      accountLabel: '你的 Cloudflare R2',
      workerUrl: connection.workerUrl,
      workerToken: connection.workerToken,
      recoveryKey,
      remoteFileId: '',
      lastBackupAt: 0,
      lastBackupStatus: 'idle',
      lastBackupError: '',
      latestRemoteBackupAt: 0,
      lastBackupBytes: 0,
      progress: { phase: 'completed', label: 'R2 已连接，自动备份已开启', percent: 100, updatedAt: Date.now() }
    });
    await navigator.clipboard.writeText(recoveryKey).catch(() => undefined);
    setFeedback('你的 R2 已连接，正在完成首次加密备份…');
    try {
      await store.runCloudBackup('manual');
      setFeedback('你的 R2 已连接并完成首次加密备份；恢复密钥已尝试复制。');
    } catch (error) {
      setFeedback(`你的 R2 已连接，但首次备份失败：${error instanceof Error ? error.message : '请稍后重试。'}`, 'error');
    } finally {
      await saveCloudSettings({ enabled: true });
    }
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '连接 R2 Worker 失败。', 'error');
  } finally {
    busy.value = '';
  }
}

async function disconnectCloud() {
  if (!window.confirm('断开后不会删除你云盘中的加密备份，确定断开吗？')) return;
  await saveCloudSettings({
    enabled: false,
    provider: '',
    accessToken: '',
    refreshToken: '',
    tokenExpiresAt: 0,
    accountLabel: '',
    workerUrl: '',
    workerToken: '',
    remoteFileId: '',
    lastBackupStatus: 'idle',
    lastBackupError: '',
    progress: { phase: 'idle', label: '', percent: 0, updatedAt: Date.now() }
  });
  setFeedback('云盘已断开，云端密文没有被删除。');
}

async function saveRecoveryKey() {
  const recoveryKey = recoveryKeyDraft.value.trim();
  if (recoveryKey.length < 24) {
    setFeedback('恢复密钥格式不正确。', 'error');
    return;
  }
  await saveCloudSettings({ recoveryKey });
  setFeedback('恢复密钥已保存在当前设备。');
}

async function copyRecoveryKey() {
  if (!recoveryKeyDraft.value) return;
  try {
    await navigator.clipboard.writeText(recoveryKeyDraft.value);
    setFeedback('恢复密钥已复制，请保存到密码管理器。');
  } catch {
    showRecoveryKey.value = true;
    setFeedback('无法自动复制，已显示恢复密钥，请手动复制。', 'error');
  }
}

async function saveInterval() {
  intervalDraft.value = normalizedInterval();
  await saveCloudSettings({ intervalMinutes: intervalDraft.value });
  setFeedback(`自动备份间隔已设为 ${intervalDraft.value} 分钟。`);
}

async function toggleAutoBackup(event: Event) {
  const checked = (event.target as HTMLInputElement).checked;
  if (checked && !isConnected.value) {
    (event.target as HTMLInputElement).checked = false;
    setFeedback('请先连接自己的云盘。', 'error');
    return;
  }
  await saveCloudSettings({ enabled: checked });
  setFeedback(checked ? '自动加密备份已开启。' : '自动备份已关闭。');
}

async function testConnection() {
  busy.value = 'test';
  feedback.value = '';
  try {
    const auth = await testCloudBackupConnection(cloudSettings.value);
    await saveCloudSettings({ ...auth, lastBackupError: '' });
    setFeedback(`${activeProviderLabel.value} 连接正常。`);
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '云盘连接测试失败。', 'error');
  } finally {
    busy.value = '';
  }
}

async function backupNow() {
  busy.value = 'backup';
  feedback.value = '';
  try {
    await store.runCloudBackup('manual');
    setFeedback('端到端加密备份已保存到你的云盘。');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '云端备份失败。', 'error');
  } finally {
    busy.value = '';
  }
}

async function restoreBackup() {
  if (!window.confirm('恢复会替换当前设备的本地数据，确定继续吗？')) return;
  busy.value = 'restore';
  feedback.value = '';
  try {
    await store.restoreCloudBackup({ onProgress: (label, percent) => setFeedback(`${label} ${Math.round(percent)}%`) });
    setFeedback('你的云端加密备份已恢复。');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '云端恢复失败。', 'error');
  } finally {
    busy.value = '';
  }
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
</script>

<style scoped>
.cloud-backup-card { display: grid; gap: 13px; padding: 14px; border: 1px solid rgba(29,119,82,.12); border-radius: 16px; background: linear-gradient(155deg, rgba(250,253,252,.98), rgba(239,248,244,.96)); }
.card-head, .field-with-action, .connection-row, .r2-setup-head, .progress-head { display: flex; align-items: center; }
.card-head { justify-content: space-between; gap: 12px; }
.card-kicker { display: block; margin-bottom: 3px; color: var(--muted); font-size: 10px; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; }
.card-head h3 { margin: 0; font-size: 17px; }
.status-badge { max-width: 94px; padding: 6px 9px; border-radius: 999px; background: rgba(17,17,17,.08); color: #4e5551; font-size: 11px; font-weight: 900; white-space: nowrap; }
.status-badge.success { background: #dff5e6; color: #136c36; }
.status-badge.failed { background: #ffe1e1; color: #a82424; }
.status-badge.running { background: #e4ecff; color: #315ab6; }
.security-note { margin: 0; padding: 12px 13px; border-radius: 15px; background: rgba(20,145,79,.08); color: #356349; font-size: 12px; line-height: 1.6; }
.provider-list { display: grid; gap: 8px; }
.provider-button { display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 10px; width: 100%; min-height: 60px; padding: 10px 12px; border: 1px solid rgba(22,22,22,.055); border-radius: 16px; background: rgba(255,255,255,.86); color: #181b19; text-align: left; box-shadow: 0 8px 24px rgba(30,45,37,.035); }
.provider-button:disabled { opacity: .62; }
.provider-button.connected { border-color: rgba(22,146,78,.26); background: #f4fcf7; box-shadow: inset 0 0 0 1px rgba(22,146,78,.07); }
.provider-logo { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: #f1f3f2; color: #252927; font-size: 16px; font-weight: 950; }
.provider-google-drive .provider-logo { background: #eef5ff; color: #3373d1; }
.provider-onedrive .provider-logo { background: #e9f5ff; color: #0877c9; }
.provider-dropbox .provider-logo { background: #edf2ff; color: #1968e9; }
.cloudflare-mark { background: #fff0e3; color: #d95d00; font-size: 12px; }
.provider-copy { display: grid; gap: 2px; min-width: 0; }
.provider-copy strong { font-size: 13px; }
.provider-copy small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.provider-state { padding: 5px 8px; border-radius: 999px; background: rgba(17,17,17,.055); color: #666c68; font-size: 10px; font-weight: 900; }
.connected .provider-state { background: #dcf4e4; color: #16723b; }
.r2-setup-card, .connected-panel { display: grid; gap: 12px; padding: 13px; border-radius: 16px; background: rgba(255,255,255,.72); }
.r2-setup-head { align-items: flex-start; gap: 10px; }
.r2-setup-head > div:last-child { min-width: 0; }
.r2-setup-head strong { font-size: 13px; }
.r2-setup-head p { margin: 3px 0 0; color: var(--muted); font-size: 11px; line-height: 1.5; }
.deploy-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 42px; border-radius: 13px; background: #f48120; color: #fff; font-size: 12px; font-weight: 900; }
.field { display: grid; gap: 6px; min-width: 0; }
.field > span { color: var(--muted); font-size: 11px; font-weight: 800; }
.field input { min-width: 0; width: 100%; min-height: 40px; padding: 10px 11px; border-radius: 12px; background: rgba(255,255,255,.94); color: #171918; font-size: 13px; }
.field-with-action { gap: 7px; min-width: 0; }
.icon-action { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; min-height: 40px; padding: 0 11px; border-radius: 12px; background: #111; color: #fff; font-size: 11px; font-weight: 900; }
.connect-worker-action { min-width: 58px; }
.compact-icon-action { width: 40px; padding: 0; }
.key-copy-action { min-width: 48px; }
.connection-row { gap: 9px; }
.connection-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: #e0f5e7; color: #18703d; }
.connection-row > div { display: grid; gap: 2px; min-width: 0; margin-right: auto; }
.connection-row strong { font-size: 13px; }
.connection-row small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-action { padding: 4px 0; color: #53615a; font-size: 11px; font-weight: 850; }
.text-action.danger { color: #b04444; }
.key-note, .last-backup-note { margin: -4px 0 0; color: var(--muted); font-size: 10.5px; line-height: 1.5; }
.backup-preferences { display: grid; grid-template-columns: minmax(0,1fr) 98px; gap: 8px; }
.toggle-card { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 9px; padding: 10px; border-radius: 13px; background: #f7faf8; }
.toggle-card input { width: 18px; height: 18px; }
.toggle-card div { display: grid; gap: 1px; min-width: 0; }
.toggle-card strong { font-size: 12px; }
.toggle-card span { color: var(--muted); font-size: 10px; }
.interval-field { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 5px; padding: 7px 9px; border-radius: 13px; background: #f7faf8; }
.interval-field span, .interval-field small { color: var(--muted); font-size: 10px; font-weight: 800; }
.interval-field input { width: 100%; min-width: 0; padding: 5px 3px; border-radius: 8px; background: #fff; text-align: center; font-size: 12px; }
.interval-field small { grid-column: 2; text-align: center; }
.progress-panel { display: grid; gap: 7px; padding: 11px; border-radius: 13px; background: #f2f6ff; }
.progress-head { justify-content: space-between; gap: 8px; color: #3f557b; font-size: 11px; }
.progress-track { height: 5px; overflow: hidden; border-radius: 999px; background: rgba(68,95,145,.14); }
.progress-track span { display: block; height: 100%; border-radius: inherit; background: #607fbd; transition: width .2s ease; }
.action-row { display: grid; gap: 8px; }
.cloud-actions { grid-template-columns: .72fr .92fr 1.25fr; }
.primary-action, .secondary-action { display: inline-flex; align-items: center; justify-content: center; gap: 5px; width: 100%; min-width: 0; min-height: 40px; padding: 0 8px; border-radius: 12px; font-size: 11px; font-weight: 900; white-space: nowrap; }
.primary-action { background: #111; color: #fff; }
.secondary-action { background: #f2f5f3; color: #252a27; }
.primary-action:disabled, .secondary-action:disabled { opacity: .52; }
.feedback { margin: 0; color: #136c36; font-size: 12px; line-height: 1.45; overflow-wrap: anywhere; }
.feedback.error { color: #a82424; }
@media (max-width: 380px) {
  .backup-preferences { grid-template-columns: 1fr; }
  .interval-field { grid-template-columns: auto 72px auto; }
  .interval-field small { grid-column: auto; }
  .cloud-actions { grid-template-columns: 1fr; }
}
</style>