<template>
  <section class="screen no-tabs settings-page">
    <header class="top-bar settings-topbar">
      <button class="settings-title-button" type="button" @click="goBack">
        <h1 class="top-title">{{ activeMeta.label }}</h1>
      </button>

      <div v-if="activeTab === 'api'" class="settings-header-actions">
        <button class="header-action-button" type="button" aria-label="切换调用模型" title="切换调用模型" @click="showModelSwitch = true">
          <SlidersHorizontal :size="18" stroke-width="2.4" />
        </button>
        <button class="header-action-button" type="button" aria-label="新增 API 配置" title="新增 API 配置" @click="openApiComposer">
          <Plus :size="18" stroke-width="2.4" />
        </button>
      </div>
      <div v-else-if="activeTab === 'image'" class="settings-header-actions image-header-actions">
        <ImageModelPickerButton />
      </div>
      <TtsModelPickerButton v-else-if="activeTab === 'tts'" />
    </header>

    <main class="settings-main">
      <section class="settings-panel">
        <ApiSettingsEditor v-if="activeTab === 'api'" :settings="currentSettings" :open-composer-tick="apiComposerTick" @save="saveSettings" />
        <TtsSettingsEditor v-else-if="activeTab === 'tts'" :settings="currentSettings" @save="saveSettings" />
        <ImageSettingsEditor v-else :settings="currentSettings" @save="saveSettings" />
      </section>
    </main>

    <nav class="settings-tabs" aria-label="设置分栏">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="settings-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        @click="openTab(tab.id)"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.shortLabel }}</span>
      </button>
    </nav>

    <ChatModelSwitchPanel v-model="showModelSwitch" variant="global" />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ImagePlus, Plus, SlidersHorizontal, Volume2 } from 'lucide-vue-next';
import ChatModelSwitchPanel from '@/components/chat/ChatModelSwitchPanel.vue';
import ApiSettingsEditor from '@/components/home/ApiSettingsEditor.vue';
import ImageSettingsEditor from '@/components/settings/ImageSettingsEditor.vue';
import ImageModelPickerButton from '@/components/settings/ImageModelPickerButton.vue';
import TtsModelPickerButton from '@/components/settings/TtsModelPickerButton.vue';
import TtsSettingsEditor from '@/components/settings/TtsSettingsEditor.vue';
import { useAppStore } from '@/stores/appStore';
import type { AppSettings } from '@/types/domain';
import { normalizeAppSettings } from '@/utils/settings';

type SettingsTab = 'api' | 'tts' | 'image';

const tabs = [
  {
    id: 'api' as SettingsTab,
    label: 'API',
    shortLabel: 'API',
    title: '聊天接口与模型',
    longDescription: '这里沿用首页原本的 API 能力，但改成独立设置页，避免用户资料和模型设置挤在同一个弹窗里。',
    icon: SlidersHorizontal
  },
  {
    id: 'tts' as SettingsTab,
    label: 'TTS',
    shortLabel: 'TTS',
    title: '语音播放偏好',
    longDescription: '语音设置用于约束未来的语音播报体验，先把偏好持久化下来，后续可以直接接入真实 TTS 服务。',
    icon: Volume2
  },
  {
    id: 'image' as SettingsTab,
    label: 'Image',
    shortLabel: 'Image',
    title: '图片生成配置',
    longDescription: '生图配置页用于收口图片生成相关参数，让后续在线聊天或线下 RP 的生图触发都能复用同一套配置。',
    icon: ImagePlus
  }
];

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const apiComposerTick = ref(0);
const showModelSwitch = ref(false);

const currentSettings = computed<AppSettings>(() => normalizeAppSettings(store.settings));

const activeTab = computed<SettingsTab>(() => {
  const tab = String(route.query.tab ?? 'api');
  return tabs.some((item) => item.id === tab) ? (tab as SettingsTab) : 'api';
});

const activeMeta = computed(() => tabs.find((tab) => tab.id === activeTab.value) ?? tabs[0]);

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}

function openTab(tab: SettingsTab) {
  if (tab === activeTab.value) return;
  void router.replace({ name: 'settings', query: { tab } });
}

function openApiComposer() {
  apiComposerTick.value += 1;
}

async function saveSettings(nextSettings: AppSettings) {
  await store.saveSettings(nextSettings);
}

</script>

<style scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 0;
  overflow-x: hidden;
  background:
    radial-gradient(circle at top left, rgba(6, 199, 85, 0.14), transparent 36%),
    linear-gradient(180deg, #fafcfb, #f4f6f5 56%, #eef2f1);
}

.settings-topbar {
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.settings-title-button {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 1 auto;
  margin-right: auto;
  padding: 0;
  color: inherit;
}

.settings-title-button .top-title {
  margin: 0;
}

.header-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 34px;
  width: 34px;
  min-height: 34px;
  padding: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
  font-size: 13px;
  font-weight: 800;
}

.settings-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.image-header-actions {
  gap: 6px;
}

.settings-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px 16px 18px;
}

.settings-panel {
  display: grid;
  min-width: 0;
  padding: 16px;
  border: 1px solid rgba(17, 17, 17, 0.04);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 14px 32px rgba(16, 24, 20, 0.06);
}

@media (max-width: 360px) {
  .settings-topbar {
    gap: 8px;
  }

  .settings-main {
    padding: 8px 10px 14px;
  }

  .settings-panel {
    padding: 10px;
    border-radius: 18px;
  }
}

.settings-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
  padding: 7px calc(8px + var(--safe-right)) calc(9px + var(--safe-bottom)) calc(8px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.settings-tab {
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

.settings-tab span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-tab.active {
  background: #eef8f1;
  color: #111111;
}

.settings-tab svg {
  width: 19px;
  height: 19px;
}
</style>