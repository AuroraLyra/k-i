<template>
  <section class="screen no-tabs add-page">
    <header class="top-bar add-topbar">
      <button class="add-title-button" type="button" aria-label="返回上一页" @click="goBack">
        <h1 class="top-title">Add</h1>
      </button>
      <button v-if="submitFormId" class="add-submit-button" type="submit" :form="submitFormId" :aria-label="submitLabel" :title="submitLabel">
        <Plus :size="18" stroke-width="2.4" aria-hidden="true" />
      </button>
      <span v-else class="header-spacer" aria-hidden="true"></span>
    </header>

    <main class="add-main">
      <AddFriendForm
        v-model:active-tab="activeFormTab"
        :accounts="store.accounts"
        :active-user-id="store.user?.id || ''"
        :local-books="localWorldBooks"
        :characters="store.charactersForActiveUser"
        :candidates="groupCandidates"
        :loading="groupLoading"
        :error="groupError"
        @scan-import-ready="scanImportReady = $event"
        @add="addFriend"
        @create-group="createGroup"
        @discover-groups="discoverGroups"
        @join-group="joinGroup"
      />
    </main>

    <nav class="add-tabs" aria-label="添加好友功能区">
      <button
        v-for="tab in addTabs"
        :key="tab.id"
        class="add-tab"
        :class="{ active: activeFormTab === tab.id }"
        type="button"
        @click="activeFormTab = tab.id"
      >
        <component :is="tab.icon" :size="20" stroke-width="2.1" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { LogIn, Plus, ScanLine, UserPlus, UsersRound } from 'lucide-vue-next';
import AddFriendForm from '@/components/home/AddFriendForm.vue';
import { useAppStore } from '@/stores/appStore';
import type { GroupDiscoveryCandidate, GroupNpcDraft, WorldBookEntry } from '@/types/domain';

type AddFormTab = 'add' | 'scan' | 'create-group' | 'join-group';

const addTabs = [
  { id: 'add' as AddFormTab, label: '添加好友', icon: UserPlus },
  { id: 'scan' as AddFormTab, label: '扫一扫', icon: ScanLine },
  { id: 'create-group' as AddFormTab, label: '创建群组', icon: UsersRound },
  { id: 'join-group' as AddFormTab, label: '加入群组', icon: LogIn }
] as const;

const router = useRouter();
const route = useRoute();
const store = useAppStore();
const requestedTab = String(route.query.tab ?? '');
const activeFormTab = ref<AddFormTab>(requestedTab === 'create-group' || requestedTab === 'join-group' ? requestedTab : 'add');
const scanImportReady = ref(false);
const groupCandidates = ref<GroupDiscoveryCandidate[]>([]);
const groupLoading = ref(false);
const groupError = ref('');

const localWorldBooks = computed(() => store.worldBooks.filter((book) => book.scope === 'local'));
const submitFormId = computed(() => {
  if (activeFormTab.value === 'add') return 'add-friend-form';
  if (activeFormTab.value === 'scan' && scanImportReady.value) return 'import-character-form';
  return '';
});
const submitLabel = computed(() => activeFormTab.value === 'scan' ? '导入角色' : '添加好友');

function fallbackRouteName() {
  const from = String(route.query.from ?? '').trim();
  return from === 'chats' ? 'chats' : 'home';
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: fallbackRouteName() });
}

async function addFriend(payload: {
  nickname: string;
  name: string;
  userNote: string;
  avatar: string;
  signature: string;
  description: string;
  boundUserId: string;
  localWorldBookIds?: string[];
  importedWorldBooks?: WorldBookEntry[];
}) {
  const importedBooks = payload.importedWorldBooks ?? [];
  const localWorldBookIds = [...new Set([...(payload.localWorldBookIds ?? []), ...importedBooks.map((worldBook) => worldBook.id)])];
  for (const worldBook of importedBooks) {
    await store.saveWorldBook(worldBook);
  }
  await store.addCharacter({
    ...payload,
    localWorldBookIds,
    voomFrequency: 'medium'
  });
  goBack();
}

async function createGroup(payload: { name: string; announcement: string; characterIds: string[]; npcMembers: GroupNpcDraft[] }) {
  groupError.value = '';
  groupLoading.value = true;
  try {
    const conversation = await store.createGroup(payload.name, payload.characterIds, payload.announcement, payload.npcMembers);
    if (conversation) await router.push({ name: 'group-chat', params: { id: conversation.id } });
  } catch (error) {
    groupError.value = error instanceof Error ? error.message : '创建群聊失败。';
  } finally {
    groupLoading.value = false;
  }
}

async function discoverGroups(characterIds: string[]) {
  groupError.value = '';
  groupLoading.value = true;
  try {
    groupCandidates.value = await store.discoverGroups(characterIds);
    if (!groupCandidates.value.length) groupError.value = 'API 没有生成可加入的群聊，请重试。';
  } catch (error) {
    groupError.value = error instanceof Error ? error.message : '查找群聊失败。';
  } finally {
    groupLoading.value = false;
  }
}

async function joinGroup(candidate: GroupDiscoveryCandidate) {
  groupError.value = '';
  groupLoading.value = true;
  try {
    const conversation = await store.joinGeneratedGroup(candidate);
    await router.push({ name: 'group-chat', params: { id: conversation.id } });
  } catch (error) {
    groupError.value = error instanceof Error ? error.message : '加入群聊失败。';
  } finally {
    groupLoading.value = false;
  }
}
</script>

<style scoped>
.add-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  height: 100%;
  overflow: hidden;
  padding-bottom: 0;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.58), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(6, 199, 85, 0.16), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 50%, #edf3f1 100%);
}

.add-topbar {
  align-items: center;
  justify-content: space-between;
  background: rgba(251, 252, 251, 0.9);
  backdrop-filter: blur(18px);
}

.add-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.add-title-button .top-title {
  margin: 0;
  text-align: left;
}

.header-spacer {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
}

.add-submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  border-radius: 999px;
  background: transparent;
  color: #111111;
  font-size: 13px;
  font-weight: 800;
  box-shadow: none;
}

.add-submit-button:active {
  transform: translateY(1px);
}

.add-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  max-width: min(100%, 720px);
  margin: 0 auto;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 10px calc(16px + var(--safe-right)) calc(18px + var(--safe-bottom)) calc(16px + var(--safe-left));
}

.add-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  flex: 0 0 auto;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  gap: 4px;
  overflow: hidden;
  padding: 8px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(18px);
}

.add-tab {
  display: grid;
  justify-items: center;
  gap: 4px;
  min-height: 48px;
  padding: 6px 4px;
  border-radius: 14px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 800;
}

.add-tab.active {
  background: #eef8f1;
  color: #111111;
}

.add-tab svg {
  width: 20px;
  height: 20px;
}

.add-tab span {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 420px) {
  .add-main {
    padding-inline: 12px;
  }
}
</style>