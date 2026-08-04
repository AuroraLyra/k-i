<template>
  <section class="screen no-tabs profile-page">
    <header class="top-bar profile-topbar">
      <button class="account-title-button" type="button" aria-label="返回主页" @click="goHome">
        <h1 class="top-title">Account</h1>
      </button>
      <div class="profile-top-actions">
        <button class="icon-button" type="button" aria-label="新建账号" @click="createAccount">
          <Plus :size="24" />
        </button>
        <button class="icon-button account-settings-button" type="button" aria-label="账号显示设置" @click="showAccountSettings = true">
          <Settings :size="20" style="width: 20px; height: 20px;" />
        </button>
      </div>
    </header>

    <main class="profile-content">
      <AccountManagerPanel
        ref="accountManagerRef"
        :accounts="store.accounts"
        :active-user-id="store.user?.id || ''"
        :characters="store.characters"
        @switch="switchAccount"
        @delete="deleteAccount"
        @move-character="moveCharacter"
      />
    </main>

    <AppModal v-model="showAccountSettings" title="账号显示设置" variant="ins">
      <section class="account-settings-sheet">
        <div class="settings-intro">
          <p class="eyebrow">Friends scope</p>
          <h2>选择 Friends 列表展示范围</h2>
          <p>这个设置会影响 Home、Chats 和账号页的 Friends 列表，方便你决定只看当前账号，还是管理全部账号的角色。</p>
        </div>

        <div class="scope-options" role="radiogroup" aria-label="Friends 显示范围">
          <button
            class="scope-option"
            :class="{ selected: !showAllFriends }"
            type="button"
            role="radio"
            :aria-checked="!showAllFriends"
            @click="setFriendsDisplayScope('active-user')"
          >
            <span class="option-kicker">Mine</span>
            <strong>只显示当前账号角色</strong>
            <span>只显示当前正在使用账号绑定的 Friends，适合专注聊天和整理自己的账号。</span>
          </button>
          <button
            class="scope-option"
            :class="{ selected: showAllFriends }"
            type="button"
            role="radio"
            :aria-checked="showAllFriends"
            @click="setFriendsDisplayScope('all-users')"
          >
            <span class="option-kicker">All</span>
            <strong>显示所有账号角色</strong>
            <span>显示全部账号绑定的 Friends，适合跨账号查看、搜索和移动角色。</span>
          </button>
        </div>

        <p class="settings-note">
          当前模式：{{ showAllFriends ? '显示所有账号角色' : '只显示当前账号角色' }}。这个设置只改变列表显示范围，不会修改角色绑定关系。
        </p>
      </section>
    </AppModal>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { onBeforeRouteLeave, useRouter } from 'vue-router';
import { Plus, Settings } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import AccountManagerPanel from '@/components/profile/AccountManagerPanel.vue';
import { useAppStore } from '@/stores/appStore';
import type { FriendsDisplayScope, UserProfile } from '@/types/domain';

const store = useAppStore();
const router = useRouter();
const accountManagerRef = ref<InstanceType<typeof AccountManagerPanel> | null>(null);
const showAccountSettings = ref(false);
const showAllFriends = computed(() => store.settings?.friendsDisplayScope === 'all-users');

onBeforeRouteLeave(() => persistPendingAccounts());
onBeforeUnmount(() => {
  void persistPendingAccounts();
});

function goHome() {
  void router.push({ name: 'home' });
}

async function persistPendingAccounts() {
  const accounts = accountManagerRef.value?.collectPendingAccounts() ?? [];
  if (!accounts.length) return;
  await Promise.all(accounts.map((account) => store.saveAccountProfile(account)));
  accountManagerRef.value?.markAccountsSaved(accounts);
}

async function switchAccount(userId: string) {
  await store.setActiveUser(userId);
}

async function deleteAccount(userId: string) {
  await store.deleteUserProfile(userId);
}

async function moveCharacter(payload: { characterId: string; userId: string }) {
  const character = store.characterById(payload.characterId);
  if (!character || character.boundUserId === payload.userId) return;
  await store.saveCharacter({
    ...character,
    boundUserId: payload.userId
  });
}

function createAccount() {
  accountManagerRef.value?.createAccount();
}

async function setFriendsDisplayScope(scope: FriendsDisplayScope) {
  if (!store.settings) return;
  if (store.settings.friendsDisplayScope === scope) return;
  await store.saveSettings({
    ...store.settings,
    friendsDisplayScope: scope
  });
}
</script>

<style scoped>
.profile-page {
  background:
    radial-gradient(circle at top left, rgba(255, 217, 228, 0.72), transparent 30%),
    linear-gradient(180deg, #fff9fa, #f5f7fb 58%, #eef5ef);
}

.profile-content {
  padding: 14px 16px 28px;
}

.account-title-button {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.account-title-button .top-title {
  margin: 0;
  text-align: left;
}

.profile-top-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.account-settings-sheet {
  display: grid;
  gap: 14px;
}

.settings-intro {
  display: grid;
  gap: 6px;
}

.settings-intro .eyebrow {
  margin: 0;
  color: #ef7f9d;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.settings-intro h2 {
  margin: 0;
  color: #231f25;
  font-size: 18px;
  line-height: 1.2;
}

.settings-intro p:not(.eyebrow),
.settings-note {
  margin: 0;
  color: #747782;
  font-size: 12px;
  line-height: 1.55;
}

.scope-options {
  display: grid;
  gap: 10px;
}

.scope-option {
  display: grid;
  gap: 6px;
  width: 100%;
  padding: 13px;
  border: 1px solid rgba(17, 17, 17, 0.07);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  color: #2b2f36;
  text-align: left;
  box-shadow: 0 8px 22px rgba(45, 39, 45, 0.06);
}

.scope-option.selected {
  border-color: rgba(239, 127, 157, 0.5);
  background: linear-gradient(180deg, #ffffff, #fff4f7);
  box-shadow: 0 12px 28px rgba(239, 127, 157, 0.16);
}

.option-kicker {
  color: #ef7f9d;
  font-size: 11px;
  font-weight: 900;
}

.scope-option strong {
  font-size: 14px;
  line-height: 1.25;
}

.scope-option span:last-child {
  color: #747782;
  font-size: 12px;
  line-height: 1.5;
}

.settings-note {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.62);
}
</style>
