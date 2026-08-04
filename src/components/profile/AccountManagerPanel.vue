<template>
  <section class="account-manager">
    <div v-if="currentAccount" class="account-stage">
      <div class="account-switcher">
        <button class="nav-button" type="button" aria-label="上一个账号" :disabled="draftAccounts.length <= 1" @click="showPreviousAccount">
          <ChevronLeft :size="18" />
        </button>
        <div class="switcher-copy">
          <strong>{{ getAccountDisplayName(currentAccount) }}</strong>
          <span>{{ currentIndex + 1 }} / {{ draftAccounts.length }}</span>
        </div>
        <button class="nav-button" type="button" aria-label="下一个账号" :disabled="draftAccounts.length <= 1" @click="showNextAccount">
          <ChevronRight :size="18" />
        </button>
      </div>

      <article class="account-card" :class="{ active: currentAccount.id === activeUserId }">
        <header class="account-head">
          <span class="active-pill">{{ currentAccount.id === activeUserId ? '当前使用中' : currentAccountPersisted ? '可切换' : '离开页面时保存' }}</span>

          <div class="account-summary">
            <img :src="currentAccount.avatar" :alt="getAccountDisplayName(currentAccount)" />
            <div>
              <div class="summary-title-row">
                <strong>{{ getAccountDisplayName(currentAccount) }}</strong>
                <span v-if="currentAccount.nickname.trim()">{{ currentAccount.name }}</span>
              </div>
              <small>ID {{ currentAccount.id }}</small>
              <p>{{ currentAccount.signature || '这个账号还没有个性签名。' }}</p>
            </div>
          </div>
        </header>

        <div class="form-grid account-form">
          <label class="field">
            <span>头像 URL</span>
            <input v-model="currentAccount.avatar" placeholder="https://..." />
          </label>

          <label class="upload-pill">
            <input type="file" accept="image/*" @change="readAvatar(currentAccount.id, $event)" />
            <span>本地导入头像</span>
          </label>

          <label class="field">
            <span>网名</span>
            <input v-model="currentAccount.nickname" />
          </label>

          <label class="field">
            <span>名字</span>
            <input v-model="currentAccount.name" required />
          </label>

          <label class="field wide-field">
            <span>个性签名</span>
            <input v-model="currentAccount.signature" />
          </label>

          <label class="field wide-field">
            <span>用户设定</span>
            <textarea v-model="currentAccount.description" rows="5" />
          </label>
        </div>

        <section class="bound-list">
          <button class="bound-head" type="button" :aria-expanded="boundListExpanded" :aria-controls="boundPanelId" @click="toggleBoundList">
            <span class="bound-head-copy">
              <strong>绑定角色</strong>
              <span>{{ currentBoundCharacters.length }} 个 Friends</span>
            </span>
            <ChevronDown class="bound-head-icon" :class="{ open: boundListExpanded }" :size="17" aria-hidden="true" />
          </button>
          <div v-if="boundListExpanded && currentBoundCharacters.length" :id="boundPanelId" class="bound-rows">
            <div v-for="character in currentBoundCharacters" :key="character.id" class="bound-row-card">
              <strong class="bound-row-name">{{ getCharacterAiName(character) }}</strong>
              <select :value="moveTargets[character.id] || nextAccountId(currentAccount.id)" @change="setMoveTarget(character.id, $event)">
                <option v-for="account in otherAccounts" :key="account.id" :value="account.id">移动到 {{ getAccountTrueName(account) }}</option>
              </select>
              <button class="ghost-button" type="button" :disabled="!otherAccounts.length" @click="moveCharacter(character.id)">
                移动角色
              </button>
            </div>
          </div>
          <p v-else-if="boundListExpanded" :id="boundPanelId">这个账号还没有绑定任何 Friends。</p>
        </section>

        <div class="card-actions dual-actions">
          <button class="danger-button" type="button" :disabled="!canDeleteCurrent" @click="requestDeleteCurrentAccount">
            {{ currentAccountPersisted ? '删除账号' : '移除草稿账号' }}
          </button>
          <button class="switch-button" type="button" :disabled="!currentAccountPersisted || currentAccount.id === activeUserId" @click="switchAccount(currentAccount.id)">
            {{ currentAccount.id === activeUserId ? '当前账号' : '切换账号' }}
          </button>
        </div>
      </article>
    </div>
  </section>

  <AppModal v-model="showDeleteConfirm" title="确认删除账号" :show-header="false" variant="ins">
    <section class="confirm-card account-delete-confirm">
      <p class="eyebrow">Delete check</p>
      <h3>确认删除这个账号？</h3>
      <p>
        <strong>{{ getAccountDisplayName(pendingDeleteAccount) }}</strong>
        ID {{ pendingDeleteAccount?.id || '-' }} 删除后不可恢复，绑定在这个账号下的 Friends 会自动转移到其他账号。
      </p>
      <p v-if="pendingDeleteBoundCharacters.length" class="confirm-note">
        当前有 {{ pendingDeleteBoundCharacters.length }} 个 Friends 绑定在这里。
      </p>
      <div class="confirm-actions">
        <button class="ghost-button" type="button" @click="cancelDeleteAccount">再想想</button>
        <button class="danger-button" type="button" @click="confirmDeleteAccount">确认删除</button>
      </div>
    </section>
  </AppModal>

  <AvatarCropperModal v-model="showAvatarEditor" :src="avatarEditorSource" @confirm="applyEditedAvatar" />
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import AvatarCropperModal from '@/components/image/AvatarCropperModal.vue';
import type { CharacterProfile, UserProfile } from '@/types/domain';
import { getCharacterAiName } from '@/utils/character';
import { createAccountId } from '@/utils/id';
import { readImageFileFromInput } from '@/utils/imageFile';
import { createUserVisualProfile, defaultProfileAvatar, getUserAiName, getUserDisplayName, normalizeUserProfile } from '@/utils/profile';

const props = defineProps<{
  accounts: UserProfile[];
  activeUserId: string;
  characters: CharacterProfile[];
}>();

const emit = defineEmits<{
  switch: [userId: string];
  delete: [userId: string];
  'move-character': [payload: { characterId: string; userId: string }];
}>();

const draftAccounts = reactive<UserProfile[]>([]);
const selectedAccountId = ref('');
const boundListExpanded = ref(false);
const showDeleteConfirm = ref(false);
const showAvatarEditor = ref(false);
const avatarEditorSource = ref('');
const pendingAvatarUserId = ref('');
const pendingDeleteAccountId = ref('');
const moveTargets = reactive<Record<string, string>>({});
const savedAccountSnapshots = new Map<string, string>();

watch(
  () => props.accounts,
  (accounts) => {
    const previousSelectedId = selectedAccountId.value;
    const normalizedAccounts = accounts.map((account) => normalizeUserProfile(cloneAccount(account)));
    savedAccountSnapshots.clear();
    normalizedAccounts.forEach((account) => savedAccountSnapshots.set(account.id, serializeAccount(account)));
    draftAccounts.splice(0, draftAccounts.length, ...normalizedAccounts);

    if (draftAccounts.some((account) => account.id === previousSelectedId)) {
      selectedAccountId.value = previousSelectedId;
      return;
    }

    selectedAccountId.value =
      draftAccounts.find((account) => account.id === props.activeUserId)?.id ??
      draftAccounts[0]?.id ??
      '';
  },
  { immediate: true, deep: true }
);

const currentIndex = computed(() => {
  const index = draftAccounts.findIndex((account) => account.id === selectedAccountId.value);
  return index >= 0 ? index : 0;
});

const currentAccount = computed(() => draftAccounts[currentIndex.value] ?? null);
const currentAccountPersisted = computed(() => currentAccount.value ? props.accounts.some((account) => account.id === currentAccount.value?.id) : false);
const boundPanelId = computed(() => `bound-characters-${currentAccount.value?.id ?? 'empty'}`);
const currentBoundCharacters = computed(() => {
  if (!currentAccount.value) return [];
  return props.characters.filter((character) => character.boundUserId === currentAccount.value?.id);
});
const pendingDeleteAccount = computed(() => draftAccounts.find((account) => account.id === pendingDeleteAccountId.value) ?? null);
const pendingDeleteBoundCharacters = computed(() => {
  if (!pendingDeleteAccount.value) return [];
  return props.characters.filter((character) => character.boundUserId === pendingDeleteAccount.value?.id);
});
const otherAccounts = computed(() => draftAccounts.filter((account) => account.id !== currentAccount.value?.id));
const canDeleteCurrent = computed(() => {
  if (!currentAccount.value) return false;
  if (!currentAccountPersisted.value) return true;
  return props.accounts.length > 1;
});

watch(selectedAccountId, () => {
  boundListExpanded.value = false;
});

function cloneAccount(account: UserProfile): UserProfile {
  return JSON.parse(JSON.stringify(account)) as UserProfile;
}

function serializeAccount(account: UserProfile) {
  return JSON.stringify(normalizeUserProfile(account));
}

function createAccount() {
  const draftAccount = normalizeUserProfile({
    id: createAccountId(),
    nickname: 'new.account',
    name: 'New User',
    avatar: defaultProfileAvatar,
    description: '在这里写这个账号希望被角色读到的用户设定。',
    signature: 'new signal online',
    boundCharacterIds: [],
    profile: props.accounts[0]?.profile ?? createUserVisualProfile({
      nickname: 'new.account',
      handle: 'new.account',
      name: 'New User',
      avatar: defaultProfileAvatar,
      signature: 'new signal online'
    })
  });

  draftAccounts.unshift(draftAccount);
  selectedAccountId.value = draftAccount.id;
}

function showPreviousAccount() {
  if (draftAccounts.length <= 1) return;
  const nextIndex = (currentIndex.value - 1 + draftAccounts.length) % draftAccounts.length;
  selectedAccountId.value = draftAccounts[nextIndex]?.id ?? selectedAccountId.value;
}

function showNextAccount() {
  if (draftAccounts.length <= 1) return;
  const nextIndex = (currentIndex.value + 1) % draftAccounts.length;
  selectedAccountId.value = draftAccounts[nextIndex]?.id ?? selectedAccountId.value;
}

function nextAccountId(currentUserId: string) {
  return draftAccounts.find((account) => account.id !== currentUserId)?.id ?? '';
}

function getAccountDisplayName(account: UserProfile | null | undefined) {
  return account ? getUserDisplayName(account) : '当前账号';
}

function getAccountTrueName(account: UserProfile | null | undefined) {
  return account ? getUserAiName(account) : '用户';
}

function setMoveTarget(characterId: string, event: Event) {
  const value = event.target instanceof HTMLSelectElement ? event.target.value : '';
  moveTargets[characterId] = value;
}

function toggleBoundList() {
  boundListExpanded.value = !boundListExpanded.value;
}

function switchAccount(userId: string) {
  selectedAccountId.value = userId;
  emit('switch', userId);
}

function normalizeAccountForSave(account: UserProfile) {
  const name = account.name.trim();
  if (!name) return null;
  return normalizeUserProfile({
    ...account,
    name,
    nickname: account.nickname.trim(),
    signature: account.signature.trim(),
    description: account.description.trim()
  });
}

function collectPendingAccounts() {
  return draftAccounts.flatMap((account) => {
    const normalizedAccount = normalizeAccountForSave(account);
    if (!normalizedAccount) return [];
    const snapshot = serializeAccount(normalizedAccount);
    return savedAccountSnapshots.get(normalizedAccount.id) === snapshot ? [] : [cloneAccount(normalizedAccount)];
  });
}

function markAccountsSaved(accounts: UserProfile[]) {
  accounts.forEach((account) => {
    savedAccountSnapshots.set(account.id, serializeAccount(account));
  });
}

function removeDraftAccount(userId: string) {
  const index = draftAccounts.findIndex((entry) => entry.id === userId);
  if (index < 0) return;
  draftAccounts.splice(index, 1);
  if (selectedAccountId.value !== userId) return;
  selectedAccountId.value = draftAccounts[index]?.id ?? draftAccounts[index - 1]?.id ?? '';
}

function requestDeleteCurrentAccount() {
  if (!currentAccount.value || !canDeleteCurrent.value) return;
  if (!currentAccountPersisted.value) {
    removeDraftAccount(currentAccount.value.id);
    return;
  }

  pendingDeleteAccountId.value = currentAccount.value.id;
  showDeleteConfirm.value = true;
}

function cancelDeleteAccount() {
  showDeleteConfirm.value = false;
  pendingDeleteAccountId.value = '';
}

function confirmDeleteAccount() {
  const userId = pendingDeleteAccountId.value;
  if (!userId) {
    cancelDeleteAccount();
    return;
  }

  if (!props.accounts.some((account) => account.id === userId)) {
    removeDraftAccount(userId);
    cancelDeleteAccount();
    return;
  }

  if (props.accounts.length > 1) {
    emit('delete', userId);
  }
  cancelDeleteAccount();
}

function moveCharacter(characterId: string) {
  if (!currentAccount.value) return;
  const userId = moveTargets[characterId] || nextAccountId(currentAccount.value.id);
  if (!userId) return;
  emit('move-character', { characterId, userId });
}

async function readAvatar(userId: string, event: Event) {
  const image = await readImageFileFromInput(event);
  if (!image) return;
  pendingAvatarUserId.value = userId;
  avatarEditorSource.value = image;
  showAvatarEditor.value = true;
}

function applyEditedAvatar(value: string) {
  const target = draftAccounts.find((entry) => entry.id === pendingAvatarUserId.value);
  if (target) target.avatar = value;
  pendingAvatarUserId.value = '';
}

defineExpose({
  createAccount,
  collectPendingAccounts,
  markAccountsSaved
});
</script>

<style scoped>
.account-manager,
.account-stage {
  display: grid;
  gap: 12px;
}

.account-switcher {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 38px;
  align-items: center;
  gap: 10px;
}

.nav-button,
.active-pill,
.upload-pill span,
.ghost-button,
.danger-button,
.switch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  font-weight: 900;
}

.nav-button {
  width: 38px;
  height: 38px;
  background: rgba(255, 255, 255, 0.88);
  color: #2b2f35;
  box-shadow: 0 10px 24px rgba(24, 28, 32, 0.08);
}

.switcher-copy {
  text-align: center;
}

.switcher-copy strong,
.switcher-copy span {
  display: block;
}

.switcher-copy strong {
  font-size: 13px;
}

.switcher-copy span {
  margin-top: 3px;
  color: #7a7f88;
  font-size: 11px;
}

.account-card {
  display: grid;
  gap: 10px;
  padding: 13px;
  border: 1px solid rgba(255, 255, 255, 0.88);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 20px 48px rgba(18, 24, 20, 0.08);
  font-size: 12px;
}

.account-card.active {
  outline: 2px solid rgba(233, 153, 183, 0.34);
}

.account-head {
  display: grid;
  gap: 9px;
}

.active-pill {
  justify-self: end;
}

.account-summary {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
}

.account-summary img {
  width: 54px;
  height: 54px;
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 12px 26px rgba(32, 36, 40, 0.12);
}

.account-summary strong,
.account-summary span,
.account-summary small,
.account-summary p {
  display: block;
}

.summary-title-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.account-summary strong {
  font-size: 17px;
}

.account-summary span,
.account-summary small {
  margin-top: 2px;
  color: #8b9099;
  font-size: 10px;
}

.account-summary p {
  margin: 4px 0 0;
  color: #50545b;
  font-size: 12px;
  line-height: 1.45;
}

.active-pill,
.upload-pill span {
  min-height: 24px;
  padding: 0 10px;
  font-size: 10px;
}

.account-form {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.wide-field {
  grid-column: 1 / -1;
}

.upload-pill {
  display: flex;
  align-items: center;
  align-self: end;
  min-width: 0;
}

.upload-pill input {
  display: none;
}

.upload-pill span {
  width: 100%;
  min-height: 34px;
  padding-inline: 12px;
  background: #f3f4f7;
  color: #2f3339;
}

.account-form {
  gap: 8px;
}

.account-form .field {
  gap: 4px;
  min-width: 0;
}

.account-form .field > span {
  font-size: 11px;
}

.account-form .field input,
.account-form .field textarea {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 7px 9px;
  border-radius: 10px;
  font-size: 12px;
}

.account-form .field textarea {
  min-height: 96px;
}

.bound-list {
  display: grid;
  gap: 10px;
  padding: 11px;
  border-radius: 16px;
  background: #f6f7fa;
}

.bound-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 0;
  color: #171717;
  text-align: left;
}

.bound-head-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.bound-head strong {
  font-size: 13px;
}

.bound-head-icon {
  flex: 0 0 auto;
  color: #5c626d;
  transition: transform 0.18s ease;
}

.bound-head-icon.open {
  transform: rotate(180deg);
}

.bound-head-copy > span,
.bound-list p {
  color: #818792;
  font-size: 11px;
}

.bound-rows {
  display: grid;
  gap: 8px;
}

.bound-row-card {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(92px, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 9px;
  border-radius: 14px;
  background: #ffffff;
}

.bound-row-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.bound-row-card select {
  width: 100%;
  min-width: 0;
  min-height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: #f3f4f7;
  color: #343842;
  font-size: 12px;
}

.ghost-button,
.danger-button,
.switch-button {
  min-height: 34px;
  border-radius: 12px;
  font-size: 12px;
}

.danger-button,
.switch-button {
  min-width: 0;
  width: 100%;
  padding-inline: 6px;
  white-space: nowrap;
}

.ghost-button {
  background: #ffffff;
  color: #171717;
  padding: 0 10px;
  white-space: nowrap;
}

.danger-button {
  background: #fff1f2;
  color: #b42318;
}

.switch-button {
  background: #f1f3f6;
  color: #171717;
}

.account-delete-confirm {
  display: grid;
  gap: 12px;
  color: #202329;
}

.account-delete-confirm .eyebrow {
  margin: 0;
  color: #b42318;
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}

.account-delete-confirm h3,
.account-delete-confirm p {
  margin: 0;
}

.account-delete-confirm h3 {
  font-size: 18px;
  font-weight: 900;
}

.account-delete-confirm p {
  color: #656a73;
  line-height: 1.6;
}

.account-delete-confirm strong {
  display: block;
  margin-bottom: 4px;
  color: #171717;
}

.confirm-note {
  padding: 9px 10px;
  border-radius: 12px;
  background: #fff1f2;
  color: #b42318 !important;
  font-weight: 800;
}

.confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 2px;
}

.card-actions {
  display: grid;
  gap: 7px;
}

.dual-actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 360px) {
  .account-form {
    gap: 7px;
  }

  .dual-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .danger-button,
  .switch-button {
    min-height: 40px;
    padding-inline: 4px;
    border-radius: 14px;
    font-size: 11px;
  }

  .bound-row-card {
    grid-template-columns: minmax(0, 0.72fr) minmax(88px, 1fr) auto;
    gap: 6px;
    padding: 10px;
  }

  .bound-row-card select,
  .ghost-button {
    min-height: 38px;
    padding-inline: 10px;
    font-size: 12px;
  }
}
</style>