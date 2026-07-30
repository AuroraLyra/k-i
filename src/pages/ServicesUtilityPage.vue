<template>
  <section class="screen no-tabs service-utility-page">
    <header class="top-bar service-utility-topbar">
      <button class="service-utility-title" type="button" aria-label="返回 Services" @click="goBack">
        <h1 class="top-title">{{ meta.title }}</h1>
      </button>
      <span class="service-utility-chip">Services</span>
    </header>

    <main class="service-utility-main">
      <section class="service-utility-intro" :class="`tone-${mode}`">
        <span class="service-utility-icon" aria-hidden="true">
          <component :is="meta.icon" :size="24" stroke-width="1.8" />
        </span>
        <div>
          <p>{{ meta.kicker }}</p>
          <h2>{{ meta.heading }}</h2>
          <span>{{ meta.description }}</span>
        </div>
      </section>

      <section class="service-utility-panel" :class="`panel-${mode}`">
        <DataCenterPanel
          v-if="mode === 'backup'"
          :user-id="store.user?.id || '--'"
          :settings="currentSettings"
          :active-section="activeBackupTab"
          @change-section="activeBackupTab = $event"
        />
        <DataManagementPanel v-else-if="mode === 'data'" />
        <AccessAccountPanel v-else />
      </section>
    </main>

    <nav v-if="mode === 'backup'" class="service-utility-tabs" aria-label="备份方式">
      <button
        v-for="tab in backupTabs"
        :key="tab.id"
        class="service-utility-tab"
        :class="{ active: activeBackupTab === tab.id }"
        type="button"
        @click="activeBackupTab = tab.id"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Archive, Cloud, CloudUpload, Database, Github, KeyRound } from 'lucide-vue-next';
import AccessAccountPanel from '@/components/settings/AccessAccountPanel.vue';
import DataCenterPanel from '@/components/settings/DataCenterPanel.vue';
import DataManagementPanel from '@/components/settings/DataManagementPanel.vue';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings } from '@/types/domain';
import { normalizeAppSettings } from '@/utils/settings';

type UtilityMode = 'backup' | 'data' | 'access';
type BackupTab = 'local' | 'cloud' | 'github';

const props = defineProps<{ mode: UtilityMode }>();
const route = useRoute();
const router = useRouter();
const store = useAppStore();
const activeBackupTab = ref<BackupTab>('local');

const backupTabs = [
  { id: 'local' as BackupTab, label: 'Local', icon: Archive },
  { id: 'cloud' as BackupTab, label: 'Cloud', icon: Cloud },
  { id: 'github' as BackupTab, label: 'GitHub', icon: Github }
];

const pageMeta = {
  backup: {
    title: 'Backup',
    kicker: 'Private archive',
    heading: '把重要剧情留在自己手里',
    description: '本地压缩包、用户自有云盘与 GitHub 私有仓库集中管理。',
    icon: CloudUpload
  },
  data: {
    title: 'Data',
    kicker: 'Local storage',
    heading: '轻量整理本地空间',
    description: '查看数据组成、保护浏览器存储，并精准清理图片与贴纸缓存。',
    icon: Database
  },
  access: {
    title: 'QQ Access',
    kicker: 'Account security',
    heading: '只保留信任的登录设备',
    description: '查看 QQ 访问账号与设备，独立移除旧设备或退出当前会话。',
    icon: KeyRound
  }
} satisfies Record<UtilityMode, { title: string; kicker: string; heading: string; description: string; icon: typeof CloudUpload }>;

const mode = computed(() => props.mode);
const meta = computed(() => pageMeta[mode.value]);
const currentSettings = computed<AppSettings>(() => normalizeAppSettings(store.settings));

onMounted(() => {
  const requestedTab = String(route.query.tab ?? '');
  if (backupTabs.some((tab) => tab.id === requestedTab)) activeBackupTab.value = requestedTab as BackupTab;
  void store.hydrate();
});

function goBack() {
  void router.push({ name: 'services' });
}
</script>

<style scoped>
.service-utility-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 0% 0%, rgba(255, 215, 228, 0.68), transparent 29%),
    radial-gradient(circle at 100% 9%, rgba(191, 237, 211, 0.44), transparent 27%),
    linear-gradient(180deg, #fffafb 0%, #f7f7fb 54%, #eef6f1 100%);
}

.service-utility-topbar {
  flex: 0 0 auto;
  background: rgba(255, 251, 252, 0.82);
  backdrop-filter: blur(18px);
}

.service-utility-title {
  display: inline-flex;
  min-width: 0;
  margin-right: auto;
  padding: 0;
}

.service-utility-title .top-title {
  margin: 0;
}

.service-utility-chip {
  padding: 7px 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #8b8287;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: inset 0 0 0 1px rgba(22, 22, 22, 0.035);
}

.service-utility-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 12px 14px calc(24px + var(--safe-bottom));
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.service-utility-intro {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  align-items: center;
  gap: 13px;
  margin-bottom: 12px;
  padding: 18px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 18px 38px rgba(45, 38, 43, 0.075), inset 0 0 0 1px rgba(255, 255, 255, 0.82);
}

.service-utility-intro.tone-backup {
  background: linear-gradient(145deg, rgba(255, 247, 251, 0.96), rgba(245, 240, 251, 0.9));
}

.service-utility-intro.tone-data {
  background: linear-gradient(145deg, rgba(246, 252, 249, 0.96), rgba(231, 247, 239, 0.9));
}

.service-utility-intro.tone-access {
  background: linear-gradient(145deg, rgba(250, 249, 255, 0.96), rgba(237, 241, 253, 0.92));
}

.service-utility-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 21px;
  background: rgba(255, 255, 255, 0.86);
  color: #252228;
  box-shadow: 0 10px 24px rgba(44, 38, 42, 0.08);
}

.service-utility-intro div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.service-utility-intro p,
.service-utility-intro h2,
.service-utility-intro span {
  margin: 0;
}

.service-utility-intro p {
  color: #8e7882;
  font-size: 10px;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.service-utility-intro h2 {
  color: #1e1b1d;
  font-size: 18px;
  font-weight: 950;
  line-height: 1.22;
}

.service-utility-intro div > span {
  color: #7b7578;
  font-size: 11px;
  font-weight: 650;
  line-height: 1.5;
}

.service-utility-panel {
  min-width: 0;
  padding: 14px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 18px 42px rgba(30, 37, 33, 0.07), inset 0 0 0 1px rgba(22, 22, 22, 0.035);
}

.service-utility-panel.panel-data {
  padding: 12px;
}

.service-utility-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  padding: 7px calc(8px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(8px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.service-utility-tab {
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

.service-utility-tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.service-utility-tab.active {
  background: #eef8f1;
  color: #111111;
}

.service-utility-tab svg {
  width: 19px;
  height: 19px;
}

@media (max-width: 360px) {
  .service-utility-main {
    padding-inline: 10px;
  }

  .service-utility-panel {
    padding: 10px;
    border-radius: 22px;
  }
}
</style>
