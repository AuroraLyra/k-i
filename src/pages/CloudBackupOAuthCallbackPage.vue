<template>
  <main class="oauth-callback-page">
    <section class="oauth-callback-card">
      <span class="oauth-mark" aria-hidden="true">☁</span>
      <h1>{{ failed ? '连接没有完成' : '正在连接你的云盘' }}</h1>
      <p>{{ message }}</p>
      <button v-if="failed" type="button" @click="returnToBackup">返回备份</button>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { completeCloudOAuthCallback, type CloudOAuthConnection } from '@/services/cloudBackup';
import { createBackupRecoveryKey } from '@/services/encryptedBackup';
import { useAppStore } from '@/stores/appStore';

const router = useRouter();
const store = useAppStore();
const message = ref('授权完成后会自动返回 BabyLink。');
const failed = ref(false);

function connectionMessage(connection: CloudOAuthConnection) {
  return { type: 'link:cloud-oauth', connection } as const;
}

async function saveConnection(connection: CloudOAuthConnection) {
  await store.hydrate();
  if (!store.settings) throw new Error('本地设置尚未载入。');
  const current = store.settings.cloudBackup;
  await store.saveSettings({
    ...store.settings,
    cloudBackup: {
      ...current,
      enabled: false,
      provider: connection.provider,
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken,
      tokenExpiresAt: connection.tokenExpiresAt,
      accountLabel: connection.accountLabel,
      workerUrl: '',
      workerToken: '',
      recoveryKey: current.recoveryKey || createBackupRecoveryKey(),
      remoteFileId: '',
      lastBackupAt: 0,
      lastBackupStatus: 'idle',
      lastBackupError: '',
      latestRemoteBackupAt: 0,
      lastBackupBytes: 0,
      progress: { phase: 'completed', label: '云盘连接成功，请选择备份或导入', percent: 100, updatedAt: Date.now() }
    }
  });
}

async function returnToBackup() {
  await router.replace({ name: 'service-backup', query: { tab: 'cloud' } });
}

onMounted(async () => {
  try {
    const connection = await completeCloudOAuthCallback();
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(connectionMessage(connection), window.location.origin);
      message.value = '连接成功，正在返回 BabyLink。';
      window.setTimeout(() => window.close(), 300);
      return;
    }
    await saveConnection(connection);
    message.value = '连接成功，正在返回备份页。';
    await returnToBackup();
  } catch (error) {
    failed.value = true;
    message.value = error instanceof Error ? error.message : '云盘连接失败，请重新尝试。';
  }
});
</script>

<style scoped>
.oauth-callback-page { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(155deg, #fff8fb, #eef7f2); color: #151515; }
.oauth-callback-card { width: min(360px, 100%); padding: 28px; border-radius: 24px; background: rgba(255,255,255,.92); text-align: center; box-shadow: 0 22px 60px rgba(31,42,36,.12); }
.oauth-mark { display: grid; place-items: center; width: 54px; height: 54px; margin: 0 auto 14px; border-radius: 18px; background: #e5f5ec; color: #177044; font-size: 28px; }
h1 { margin: 0 0 9px; font-size: 20px; }
p { margin: 0; color: #68716c; font-size: 13px; line-height: 1.65; }
button { min-height: 42px; margin-top: 18px; padding: 0 18px; border-radius: 13px; background: #111; color: #fff; font-weight: 850; }
</style>