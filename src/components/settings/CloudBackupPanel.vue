<template>
  <section class="backup-card cloud-backup-card">
    <header class="card-head">
      <div>
        <span class="card-kicker">Free personal cloud</span>
        <h3>免费云盘直连</h3>
      </div>
      <span class="status-badge" :class="statusClass">{{ statusLabel }}</span>
    </header>

    <p class="security-note">
      设备直接连接云盘官方接口，使用账号自带免费空间。LINK 服务器不接收、不存储、不转发备份、Token 或恢复密钥。
    </p>

    <div class="provider-list" aria-label="选择云备份提供商">
      <button
        v-for="provider in oauthProviders"
        :key="provider.id"
        class="provider-button"
        :class="[`provider-${provider.id}`, { connected: cloudSettings.provider === provider.id, unavailable: !isCloudOAuthProviderConfigured(provider.id) }]"
        type="button"
        :disabled="Boolean(busy)"
        @click="connectOAuthProvider(provider.id)"
      >
        <span class="provider-logo" aria-hidden="true">{{ provider.mark }}</span>
        <span class="provider-copy">
          <strong>{{ provider.label }}</strong>
          <small>{{ cloudSettings.provider === provider.id ? connectedAccountLabel : isCloudOAuthProviderConfigured(provider.id) ? provider.description : '当前版本缺少 OAuth 配置' }}</small>
        </span>
        <span class="provider-state">{{ busy === `connect-${provider.id}` ? '连接中…' : cloudSettings.provider === provider.id ? '已连接' : isCloudOAuthProviderConfigured(provider.id) ? '连接' : '查看原因' }}</span>
      </button>
    </div>

    <section v-if="!hasCloudAccount" class="setup-panel">
      <div class="setup-head">
        <strong>怎么使用</strong>
        <span>连接后和 GitHub 备份一样，可手动备份、自动备份和导入恢复。</span>
      </div>
      <div class="setup-steps">
        <div><b>1</b><span>选择上方云盘并完成官方账号授权。</span></div>
        <div><b>2</b><span>首次使用点“立即备份”；新设备先填写原恢复密钥再导入。</span></div>
        <div><b>3</b><span>开启自动备份后，应用运行时按设定间隔更新密文。</span></div>
      </div>
      <label class="toggle-card setup-toggle">
        <input type="checkbox" :checked="false" @change="toggleAutoBackup" />
        <div>
          <strong>应用运行时自动备份</strong>
          <span>连接云盘后可开启</span>
        </div>
      </label>
      <div class="action-row cloud-actions setup-actions">
        <button class="secondary-action" type="button" :disabled="Boolean(busy)" @click="requestCloudAction('restore')">
          <Download :size="15" />
          <span>导入云盘备份</span>
        </button>
        <button class="primary-action" type="button" :disabled="Boolean(busy)" @click="requestCloudAction('backup')">
          <CloudUpload :size="15" />
          <span>立即备份</span>
        </button>
      </div>
      <button v-if="noCloudProvidersConfigured" class="github-fallback" type="button" @click="emit('open-github')">
        当前云盘服务尚未配置，先使用 GitHub 免费自动备份
      </button>
    </section>

    <section v-else class="connected-panel">
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
          <span>导入云盘备份</span>
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
import { CloudUpload, Download, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-vue-next';
import { cloudBackupProviderLabels, isCloudBackupAccountConnected, isCloudBackupConnected, isCloudOAuthProviderConfigured, startCloudOAuth, testCloudBackupConnection, type CloudOAuthConnection } from '@/services/cloudBackup';
import { createBackupRecoveryKey } from '@/services/encryptedBackup';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings, CloudBackupProvider, CloudBackupSettings } from '@/types/domain';

const props = defineProps<{ settings: AppSettings }>();
const emit = defineEmits<{ 'open-github': [] }>();
const store = useAppStore();
const recoveryKeyDraft = ref('');
const intervalDraft = ref(30);
const showRecoveryKey = ref(false);
const busy = ref('');
const feedback = ref('');
const feedbackKind = ref<'success' | 'error'>('success');

const oauthProviders = [
  { id: 'google-drive' as const, label: 'Google Drive', mark: 'G', description: '推荐 · 官方免费空间' },
  { id: 'onedrive' as const, label: 'OneDrive', mark: 'O', description: '官方免费空间' },
  { id: 'dropbox' as const, label: 'Dropbox', mark: 'D', description: '官方免费空间' }
];

interface CloudOAuthMessage {
  type: 'link:cloud-oauth';
  connection?: CloudOAuthConnection;
  error?: string;
}

const cloudSettings = computed(() => props.settings.cloudBackup);
const hasCloudAccount = computed(() => isCloudBackupAccountConnected(cloudSettings.value));
const isReady = computed(() => isCloudBackupConnected(cloudSettings.value));
const noCloudProvidersConfigured = computed(() => oauthProviders.every((provider) => !isCloudOAuthProviderConfigured(provider.id)));
const activeProviderLabel = computed(() => cloudSettings.value.provider ? cloudBackupProviderLabels[cloudSettings.value.provider] : '云盘');
const connectedAccountLabel = computed(() => cloudSettings.value.accountLabel || (cloudSettings.value.provider === 'r2-worker' ? '你的 Cloudflare 账号' : '你的私有空间'));
const progressPercent = computed(() => Math.min(100, Math.max(0, Math.round(cloudSettings.value.progress.percent || 0))));
const showProgress = computed(() => !['idle'].includes(cloudSettings.value.progress.phase) && Boolean(cloudSettings.value.progress.label));
const statusClass = computed(() => cloudSettings.value.lastBackupStatus === 'failed'
  ? 'failed'
  : cloudSettings.value.lastBackupStatus === 'running'
    ? 'running'
    : hasCloudAccount.value
      ? 'success'
      : 'idle');
const statusLabel = computed(() => {
  if (cloudSettings.value.lastBackupStatus === 'running') return '备份中';
  if (cloudSettings.value.lastBackupStatus === 'failed') return '失败';
  if (hasCloudAccount.value && !isReady.value) return '待填密钥';
  if (hasCloudAccount.value) return '已连接';
  if (noCloudProvidersConfigured.value) return '待开通';
  return '未连接';
});

watch(() => props.settings.cloudBackup, (settings) => {
  recoveryKeyDraft.value = settings.recoveryKey;
  intervalDraft.value = settings.intervalMinutes;
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
    progress: { phase: 'completed', label: '云盘连接成功，请选择备份或导入', percent: 100, updatedAt: Date.now() }
  });
  await navigator.clipboard.writeText(recoveryKey).catch(() => undefined);
  setFeedback(`${cloudBackupProviderLabels[connection.provider]} 已连接。首次使用请点“立即备份”；如果云盘已有备份，请先填写原恢复密钥再导入。`);
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
  if (!isCloudOAuthProviderConfigured(provider)) {
    setFeedback(`${cloudBackupProviderLabels[provider]} 在当前安装版本中尚未配置 OAuth Client ID，并非你的账号问题。请使用已开通的云盘，或切换到 GitHub 免费备份。`, 'error');
    return;
  }
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
  if (checked && !isReady.value) {
    (event.target as HTMLInputElement).checked = false;
    setFeedback(hasCloudAccount.value ? '请先填写并保存恢复密钥。' : '请先连接自己的云盘。', 'error');
    return;
  }
  if (checked && !cloudSettings.value.lastBackupAt && !window.confirm('开启后会用当前设备数据更新云盘同名备份。如果你正在新设备恢复旧数据，请先取消并点击“导入云盘备份”。确定开启吗？')) {
    (event.target as HTMLInputElement).checked = false;
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
  if (!isReady.value) {
    setFeedback(hasCloudAccount.value ? '请先填写并保存恢复密钥。' : '请先连接自己的云盘。', 'error');
    return;
  }
  if (!cloudSettings.value.lastBackupAt && !window.confirm('立即备份会更新云盘中的同名备份。如果你是在新设备导入旧数据，请先取消并选择“导入云盘备份”。确定继续吗？')) return;
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
  if (!isReady.value) {
    setFeedback(hasCloudAccount.value ? '请先填写原设备保存的恢复密钥。' : '请先连接存有备份的云盘账号。', 'error');
    return;
  }
  if (!window.confirm('导入云盘备份会替换当前设备的本地数据，确定继续吗？')) return;
  busy.value = 'restore';
  feedback.value = '';
  try {
    await store.restoreCloudBackup({ onProgress: (label, percent) => setFeedback(`${label} ${Math.round(percent)}%`) });
    setFeedback('云盘加密备份已导入当前设备。');
  } catch (error) {
    setFeedback(error instanceof Error ? error.message : '云端恢复失败。', 'error');
  } finally {
    busy.value = '';
  }
}

function requestCloudAction(action: 'backup' | 'restore') {
  if (!hasCloudAccount.value) {
    setFeedback(noCloudProvidersConfigured.value
      ? '当前安装版本尚未配置云盘 OAuth。可点下方入口使用 GitHub，或等待维护者开通云盘服务。'
      : `请先连接上方任一云盘，再${action === 'backup' ? '创建备份' : '导入备份'}。`, 'error');
    return;
  }
  if (action === 'backup') void backupNow();
  else void restoreBackup();
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
.provider-button.unavailable:not(:disabled) { border-style: dashed; }
.provider-button.unavailable:not(:disabled) .provider-state { color: #8a6034; background: #fff2dd; }
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
.r2-setup-card, .connected-panel, .setup-panel { display: grid; gap: 12px; padding: 13px; border-radius: 16px; background: rgba(255,255,255,.72); }
.setup-head { display: grid; gap: 3px; }
.setup-head strong { font-size: 13px; }
.setup-head span { color: var(--muted); font-size: 11px; line-height: 1.5; }
.setup-steps { display: grid; gap: 8px; }
.setup-steps div { display: grid; grid-template-columns: 22px minmax(0,1fr); align-items: center; gap: 8px; color: #59635e; font-size: 11px; line-height: 1.45; }
.setup-steps b { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 8px; background: #e6f5ec; color: #15723c; font-size: 10px; }
.setup-toggle { margin-top: 1px; }
.setup-actions { grid-template-columns: repeat(2, minmax(0,1fr)); }
.github-fallback { min-height: 38px; padding: 8px 12px; border-radius: 12px; background: #f1f2f4; color: #454b48; font-size: 11px; font-weight: 850; line-height: 1.35; }
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