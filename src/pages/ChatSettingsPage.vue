<template>
  <section v-if="conversation && character" class="screen no-tabs chat-settings-page" :class="{ 'memory-active': activeTab === 'memory' }">
    <header class="top-bar chat-settings-topbar">
      <button class="chat-settings-title-button" type="button" aria-label="返回聊天" @click="goBack">
        <h1 class="top-title">{{ isGroup ? 'Group Settings' : 'Chat Settings' }}</h1>
      </button>
    </header>

    <main class="chat-settings-main">
      <section class="chat-settings-panel">
        <GroupChatSettingsPanel v-if="isGroup" :conversation-id="props.id" :active-tab="activeTab as GroupSettingsTab" />
        <ChatControlPanel v-else :conversation-id="props.id" :character="character" :active-tab="activeTab as PanelTab" />
      </section>
    </main>

    <nav class="chat-settings-tabs" aria-label="Chat settings tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="chat-settings-tab"
        :class="{ active: activeTab === tab.id }"
        type="button"
        @pointerup="openTab(tab.id)"
        @click="openTab(tab.id)"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.shortLabel }}</span>
      </button>
    </nav>
  </section>
  <section v-else class="screen no-tabs empty-state">会话不存在</section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bot, BookOpenText, Image, Palette, Settings2, UserRound, UsersRound } from 'lucide-vue-next';
import ChatControlPanel, { type PanelTab } from '@/components/chat/ChatControlPanel.vue';
import GroupChatSettingsPanel, { type GroupSettingsTab } from '@/components/chat/GroupChatSettingsPanel.vue';
import { useAppStore } from '@/stores/appStore';

const chatTabs = [
  { id: 'memory' as PanelTab, shortLabel: 'Memory', icon: BookOpenText },
  { id: 'beauty' as PanelTab, shortLabel: 'Beauty', icon: Palette },
  { id: 'profile' as PanelTab, shortLabel: 'Profile', icon: UserRound },
  { id: 'image' as PanelTab, shortLabel: 'Image', icon: Image },
  { id: 'other' as PanelTab, shortLabel: 'More', icon: Settings2 }
] as const;
const groupTabs = [
  { id: 'group' as GroupSettingsTab, shortLabel: 'Group', icon: Settings2 },
  { id: 'members' as GroupSettingsTab, shortLabel: 'Members', icon: UsersRound },
  { id: 'memory' as GroupSettingsTab, shortLabel: 'Memory', icon: BookOpenText },
  { id: 'appearance' as GroupSettingsTab, shortLabel: 'Beauty', icon: Palette },
  { id: 'ai' as GroupSettingsTab, shortLabel: 'AI', icon: Bot }
] as const;

const props = defineProps<{
  id: string;
}>();

const route = useRoute();
const router = useRouter();
const store = useAppStore();
const activeTab = ref<PanelTab | GroupSettingsTab>('memory');

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => {
  if (!conversation.value) return undefined;
  if (conversation.value.kind !== 'group') return store.characterById(conversation.value.charId);
  return conversation.value.groupMembers?.flatMap((member) => member.identityType === 'character' && member.identityId ? [store.characterById(member.identityId)] : []).find(Boolean);
});
const isOfflineSettings = computed(() => route.name === 'offline-chat-settings');
const isGroup = computed(() => conversation.value?.kind === 'group');
const tabs = computed(() => isGroup.value ? groupTabs : chatTabs);

onMounted(() => {
  void store.hydrate();
});
watch(isGroup, (group) => { activeTab.value = group ? 'group' : 'memory'; }, { immediate: true });

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: isOfflineSettings.value ? 'offline-room' : conversation.value?.kind === 'group' ? 'group-chat' : 'chat-room', params: { id: props.id } });
}

function openTab(tab: PanelTab | GroupSettingsTab) {
  activeTab.value = tab;
}
</script>

<style scoped>
.chat-settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 0;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.58), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(6, 199, 85, 0.16), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 54%, #edf3f1 100%);
}

.chat-settings-page.memory-active,
.chat-settings-page.memory-active .chat-settings-topbar,
.chat-settings-page.memory-active .chat-settings-main {
  background: #ffffff;
}

.chat-settings-topbar {
  align-items: center;
  justify-content: space-between;
  background: rgba(251, 252, 251, 0.9);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.chat-settings-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.chat-settings-title-button .top-title {
  margin: 0;
  text-align: left;
}

.chat-settings-main {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px calc(16px + var(--safe-right)) 16px calc(16px + var(--safe-left));
}

.chat-settings-panel {
  display: grid;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 12px;
}

.chat-settings-tabs {
  position: relative;
  z-index: 20;
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 4px;
  padding: 8px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.chat-settings-tab {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-width: 0;
  min-height: 48px;
  padding: 6px 4px;
  border-radius: 14px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
  line-height: 1.1;
  overflow: hidden;
  white-space: nowrap;
  touch-action: manipulation;
}

.chat-settings-tab.active {
  background: #eef8f1;
  color: #111111;
}

.chat-settings-tab svg {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}

.chat-settings-tab span {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 420px) {
  .chat-settings-main {
    padding-inline: 12px;
  }
}

@media (max-width: 360px) {
  .chat-settings-tabs {
    gap: 3px;
    padding-inline: calc(8px + var(--safe-left));
    padding-right: calc(8px + var(--safe-right));
  }

  .chat-settings-tab {
    min-height: 46px;
    border-radius: 12px;
    font-size: 9px;
  }
}
</style>