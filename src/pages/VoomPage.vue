<template>
  <section ref="voomPageRef" class="screen no-tabs voom-page" @scroll.passive="handleVoomPageScroll">
    <header class="top-bar">
      <button class="subpage-title-button" type="button" aria-label="返回主页" @click="goHome">
        <h1 class="top-title">LINK VOOM</h1>
      </button>
      <div class="icon-row">
        <button class="icon-button" type="button" aria-label="切换用户账号" @click="showAccountSwitcher = true">
          <UserCog :size="20" />
        </button>
        <button class="icon-button" type="button" aria-label="VOOM 清理设置" @click="openVoomCleanupSettings">
          <SlidersHorizontal :size="20" />
        </button>
        <button class="icon-button" type="button" aria-label="角色发布 VOOM" @click="openVoomPublisher">
          <Plus :size="20" />
        </button>
        <button class="icon-button" type="button" aria-label="用户发布 VOOM" @click="openUserVoomPublisher">
          <SquarePen :size="20" />
        </button>
      </div>
    </header>

    <section class="story-strip" aria-label="VOOM 动态筛选">
      <button class="story-button account-story" :class="{ active: !selectedVoomCharacterId }" type="button" :aria-label="`查看 ${activeUserDisplayName} 的 VOOM 动态`" @click="selectAccountVoomFeed">
        <span class="story-avatar">
          <img v-if="activeUserAvatar" :src="activeUserAvatar" alt="" aria-hidden="true" />
          <UserRound v-else :size="30" />
          <i v-if="accountHasUnreadVoom" class="story-unread" aria-hidden="true"></i>
          <i class="story-add" aria-hidden="true"><Plus :size="14" /></i>
        </span>
        <span class="story-name">{{ activeUserDisplayName }}</span>
      </button>

      <button
        v-for="character in voomStoryCharacters"
        :key="character.id"
        class="story-button"
        :class="{ active: selectedVoomCharacterId === character.id }"
        type="button"
        :aria-label="`只看 ${getCharacterVoomDisplayName(character)} 的 VOOM 动态`"
        @click="selectCharacterVoomFeed(character.id)"
      >
        <span class="story-avatar">
          <img :src="voomCharacterAvatar(character)" alt="" aria-hidden="true" />
          <i v-if="hasUnreadVoomForCharacter(character.id)" class="story-unread" aria-hidden="true"></i>
        </span>
        <span class="story-name">{{ getCharacterVoomDisplayName(character) }}</span>
      </button>
    </section>

    <div v-if="!hasFilteredVoomPosts" class="empty-state">
      <div>
        <h2>马上就开始使用LINK VOOM吧!</h2>
        <p>到LINK VOOM看看大家的近况吧!<br />您也试着分享看看吧!</p>
      </div>
    </div>

    <VoomPostCard
      v-for="post in visibleVoomPosts"
      :key="post.id"
      :post="post"
      :author-name="voomAuthorNameForPost(post)"
      :author-avatar="voomAuthorAvatarForPost(post)"
      :character-display-names="characterVoomDisplayNames"
      :character-author-aliases="characterVoomAuthorAliases"
      :current-user-id="store.user?.id"
      :current-user-name="activeUserVoomAuthorName"
      :can-regenerate-image="canRegenerateVoomImage"
      :regenerating-image="regeneratingImagePostIds.includes(post.id)"
      :replying-thread="store.isReplyingVoomComments(post.id)"
      @comment="handleComment"
      @regenerate-image="handleRegenerateImage"
      @apply-image="handleApplyImageCandidate"
      @delete-image="handleDeleteImageCandidate"
      @busy-action="store.showConfigAlert"
      @reply-thread="handleManualReplyThread"
      @toggle-like="store.toggleVoomLike"
      @delete-post="requestDeleteVoomPost"
    />

    <div v-if="hasMoreVoomPosts" ref="voomLoaderRef" class="voom-loader">继续下滑加载更多</div>

    <AppModal v-model="showDeletePostConfirm" title="确认删除" :show-header="false" variant="ins">
      <section class="voom-delete-confirm">
        <h3>删除这条 VOOM 动态？</h3>
        <p>删除后会同时移除相关对话事件，AI 不会再读取这部分信息。</p>
        <div class="voom-delete-actions">
          <button class="publisher-secondary" type="button" @click="cancelDeleteVoomPost">取消</button>
          <button class="voom-danger-button" type="button" @click="confirmDeleteVoomPost">删除</button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showAccountSwitcher" title="切换账号" variant="ins">
      <div class="account-list account-switch-list">
        <button
          v-for="account in store.accounts"
          :key="account.id"
          class="account-option"
          :class="{ active: store.user?.id === account.id }"
          type="button"
          @click="switchActiveAccount(account.id)"
        >
          <img :src="account.avatar" :alt="account.nickname || account.name" />
          <span>
            <strong>{{ account.nickname || account.name }}</strong>
            <small>{{ account.id }}</small>
          </span>
        </button>
      </div>
    </AppModal>

    <AppModal v-model="showVoomCleanupSettings" title="VOOM 清理" variant="ins">
      <section class="voom-cleanup-panel">
        <section class="cleanup-manual-card">
          <div class="cleanup-section-head">
            <span>手动清理</span>
            <small>{{ manualCleanupTargetPostCount }} 条可清理</small>
          </div>
          <div class="cleanup-compact-row">
            <label class="cleanup-select-field">
              <span>早于</span>
              <select :value="manualVoomCleanupPreset" @change="setManualVoomCleanupPresetFromEvent">
                <option v-for="option in cleanupPresetOptions" :key="`manual-${option.preset}`" :value="option.preset">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="manualVoomCleanupPreset === 'custom'" class="cleanup-days-field">
              <input v-model.number="manualVoomCleanupCustomDays" inputmode="numeric" min="1" max="3650" type="number" />
              <span>天</span>
            </label>
            <button class="cleanup-text-action danger" type="button" :disabled="voomCleanupRunning || !manualCleanupTargetPostCount" @click="runManualVoomCleanup">
              {{ voomCleanupRunning ? '清理中' : '清理' }}
            </button>
          </div>
        </section>

        <section v-if="activeCleanupCharacters.length" class="cleanup-character-list">
          <article v-for="character in activeCleanupCharacters" :key="character.id" class="cleanup-character-card">
            <div class="cleanup-character-top">
              <div class="cleanup-character-head">
                <img :src="voomCharacterAvatar(character)" :alt="getCharacterDisplayName(character)" />
                <span>
                  <strong>{{ getCharacterDisplayName(character) }}</strong>
                  <small>{{ character.name }}</small>
                </span>
              </div>
              <label class="cleanup-switch-card" :aria-label="`${getCharacterDisplayName(character)} 自动清理`">
                <input type="checkbox" :checked="voomCleanupSettingForCharacter(character.id).enabled" @change="updateVoomCleanupEnabled(character.id, $event)" />
                <span class="cleanup-switch-track"></span>
              </label>
            </div>

            <div class="cleanup-character-meta">
              <span>{{ voomCleanupSettingForCharacter(character.id).enabled ? `自动清理 ${voomCleanupSettingForCharacter(character.id).days} 天前` : '自动清理已关闭' }}</span>
              <small>{{ voomCleanupPostCountForCharacter(character.id, voomCleanupSettingForCharacter(character.id).days) }} 条可清理</small>
            </div>
            <div class="cleanup-compact-row character-row">
              <label class="cleanup-select-field">
                <span>早于</span>
                <select :value="voomCleanupSettingForCharacter(character.id).preset" @change="selectVoomCleanupPresetFromEvent(character.id, $event)">
                  <option v-for="option in cleanupPresetOptions" :key="`${character.id}-${option.preset}`" :value="option.preset">{{ option.label }}</option>
                </select>
              </label>
              <label v-if="voomCleanupSettingForCharacter(character.id).preset === 'custom'" class="cleanup-days-field">
                <input :value="voomCleanupSettingForCharacter(character.id).days" inputmode="numeric" min="1" max="3650" type="number" @change="updateVoomCleanupCustomDays(character.id, $event)" />
                <span>天</span>
              </label>
              <button class="cleanup-text-action" type="button" :disabled="voomCleanupRunning || !voomCleanupPostCountForCharacter(character.id, voomCleanupSettingForCharacter(character.id).days)" @click="cleanupCharacterBySetting(character.id)">
                清理
              </button>
            </div>
          </article>
        </section>

        <section v-else class="picker-empty">
          <strong>暂无角色</strong>
          <p>当前账号还没有绑定角色。</p>
        </section>

        <p v-if="voomCleanupNotice" class="cleanup-notice">{{ voomCleanupNotice }}</p>
      </section>
    </AppModal>

    <AppModal v-model="showVoomPublisher" title="发布 VOOM" variant="ins">
      <section class="voom-publisher">
        <div class="publisher-copy">
          <strong>选择发布角色</strong>
          <span>{{ publisherCharacters.length ? '将根据该角色最近的聊天与记忆生成动态。' : '当前账号还没有绑定可发布 VOOM 的角色。' }}</span>
        </div>

        <div v-if="publisherCharacters.length" class="publisher-list">
          <button
            class="publisher-option"
            :class="{ active: selectedPublisherId === randomPublisherId }"
            type="button"
            :disabled="creatingVoomPost"
            @click="selectedPublisherId = randomPublisherId"
          >
            <span class="random-avatar"><Shuffle :size="20" /></span>
            <span>
              <strong>随机角色</strong>
              <small>从当前账号绑定角色中抽取</small>
            </span>
          </button>

          <button
            v-for="character in publisherCharacters"
            :key="character.id"
            class="publisher-option"
            :class="{ active: selectedPublisherId === character.id }"
            type="button"
            :disabled="creatingVoomPost"
            @click="selectedPublisherId = character.id"
          >
            <img :src="voomCharacterAvatar(character)" :alt="getCharacterDisplayName(character)" />
            <span>
              <strong>{{ getCharacterDisplayName(character) }}</strong>
              <small>{{ character.name }}</small>
            </span>
          </button>
        </div>

        <section v-else class="picker-empty">
          <strong>暂无角色</strong>
          <p>请先在当前账号下添加并绑定角色。</p>
        </section>

        <div class="publisher-actions">
          <button class="publisher-secondary" type="button" :disabled="creatingVoomPost" @click="showVoomPublisher = false">取消</button>
          <button class="publisher-primary" type="button" :disabled="creatingVoomPost || !publisherCharacters.length" @click="confirmCreateVoomPost">
            <LoaderCircle v-if="creatingVoomPost" class="publisher-loading" :size="16" />
            <span>{{ creatingVoomPost ? '生成中' : '确认发布' }}</span>
          </button>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showUserVoomPublisher" title="发布 VOOM" variant="ins">
      <form class="user-voom-publisher" @submit.prevent="confirmCreateUserVoomPost">
        <label class="manual-field">
          <span>正文</span>
          <textarea v-model="userVoomContent" maxlength="500" placeholder="写点什么" :disabled="creatingUserVoomPost"></textarea>
        </label>

        <section class="manual-section">
          <div class="publisher-copy compact-copy">
            <strong>配图</strong>
            <span>可留空，也可以选择本地图片或文字描述卡片。</span>
          </div>
          <div class="media-tabs">
            <button type="button" :class="{ active: userVoomMediaMode === 'none' }" :disabled="creatingUserVoomPost" @click="setUserVoomMediaMode('none')">
              <X :size="15" />
              <span>无</span>
            </button>
            <button type="button" :class="{ active: userVoomMediaMode === 'image' }" :disabled="creatingUserVoomPost" @click="setUserVoomMediaMode('image')">
              <ImageIcon :size="15" />
              <span>图片</span>
            </button>
            <button type="button" :class="{ active: userVoomMediaMode === 'card' }" :disabled="creatingUserVoomPost" @click="setUserVoomMediaMode('card')">
              <FileText :size="15" />
              <span>卡片</span>
            </button>
          </div>

          <div v-if="userVoomMediaMode === 'image'" class="image-compose">
            <label class="image-upload">
              <input type="file" accept="image/*" :disabled="creatingUserVoomPost" @change="readUserVoomImage" />
              <img v-if="userVoomImage" :src="userVoomImage" alt="VOOM 图片预览" />
              <span v-else><Upload :size="18" />选择本地图片</span>
            </label>
            <label class="manual-field compact-field">
              <span>图片描述</span>
              <textarea v-model="userVoomImageDescription" maxlength="120" placeholder="可选，用于对话记录与评论区" :disabled="creatingUserVoomPost"></textarea>
            </label>
          </div>

          <label v-else-if="userVoomMediaMode === 'card'" class="manual-field compact-field">
            <span>文字描述卡片</span>
            <textarea v-model="userVoomImageDescription" maxlength="120" placeholder="写下卡片内容或画面描述" :disabled="creatingUserVoomPost"></textarea>
          </label>
        </section>

        <section class="manual-section">
          <div class="publisher-copy compact-copy">
            <strong>可见范围</strong>
            <span>{{ userVoomVisibilitySummary }}</span>
          </div>
          <div class="visibility-tabs">
            <button type="button" :class="{ active: userVoomVisibility === 'public' }" :disabled="creatingUserVoomPost" @click="selectUserVoomVisibility('public')">
              <Globe2 :size="15" />
              <span>公开</span>
            </button>
            <button type="button" :class="{ active: userVoomVisibility === 'selected' }" :disabled="creatingUserVoomPost" @click="selectUserVoomVisibility('selected')">
              <UserRound :size="15" />
              <span>指定角色</span>
            </button>
          </div>

          <div v-if="userVoomVisibility === 'selected' && userVoomAccountCharacters.length" class="target-list">
            <label v-for="character in userVoomAccountCharacters" :key="character.id" class="target-option">
              <input type="checkbox" :checked="selectedUserVoomCharacterIds.includes(character.id)" :disabled="creatingUserVoomPost" @change="toggleUserVoomCharacter(character.id)" />
              <img :src="voomCharacterAvatar(character)" :alt="getCharacterDisplayName(character)" />
              <span>
                <strong>{{ getCharacterDisplayName(character) }}</strong>
                <small>{{ character.name }}</small>
              </span>
            </label>
          </div>

          <section v-else-if="!userVoomAccountCharacters.length" class="picker-empty">
            <strong>暂无可见角色</strong>
            <p>这个账号还没有绑定角色。</p>
          </section>
        </section>

        <div class="publisher-actions">
          <button class="publisher-secondary" type="button" :disabled="creatingUserVoomPost" @click="showUserVoomPublisher = false">取消</button>
          <button class="publisher-primary" type="submit" :disabled="!canSubmitUserVoomPost || creatingUserVoomPost">
            <LoaderCircle v-if="creatingUserVoomPost" class="publisher-loading" :size="16" />
            <span>{{ creatingUserVoomPost ? '发布中' : '发布' }}</span>
          </button>
        </div>
      </form>
    </AppModal>

  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { FileText, Globe2, Image as ImageIcon, LoaderCircle, Plus, Shuffle, SlidersHorizontal, SquarePen, Upload, UserCog, UserRound, X } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import VoomPostCard from '@/components/voom/VoomPostCard.vue';
import { useAppStore } from '@/stores/appStore';
import type { CharacterProfile, CharacterVoomAutoCleanupSettings, VoomAutoCleanupPreset, VoomPost, VoomPostVisibility } from '@/types/domain';
import { getCharacterDisplayName, getCharacterVoomAuthorName, getCharacterVoomDisplayName } from '@/utils/character';
import { getUserDisplayName, getUserVoomAuthorName } from '@/utils/profile';
import { readChatImageFile } from '@/utils/imageFile';
import { getSelectedImageModelOption } from '@/utils/settings';

const store = useAppStore();
const router = useRouter();
const showAccountSwitcher = ref(false);
const showVoomCleanupSettings = ref(false);
const showVoomPublisher = ref(false);
const showUserVoomPublisher = ref(false);
const showDeletePostConfirm = ref(false);
const creatingVoomPost = ref(false);
const creatingUserVoomPost = ref(false);
const voomCleanupRunning = ref(false);
const voomCleanupNotice = ref('');
const regeneratingImagePostIds = ref<string[]>([]);
const voomPageRef = ref<HTMLElement | null>(null);
const voomLoaderRef = ref<HTMLElement | null>(null);
const initialVoomPostLimit = 12;
const visibleVoomPostLimit = ref(initialVoomPostLimit);
const randomPublisherId = 'random';
const selectedPublisherId = ref(randomPublisherId);
const selectedUserVoomAccountId = ref('');
const userVoomContent = ref('');
const userVoomMediaMode = ref<'none' | 'image' | 'card'>('none');
const userVoomImage = ref('');
const userVoomImageDescription = ref('');
const userVoomVisibility = ref<VoomPostVisibility>('public');
const selectedUserVoomCharacterIds = ref<string[]>([]);
const selectedVoomCharacterId = ref('');
const pendingDeletePostId = ref('');
const manualVoomCleanupPreset = ref<VoomAutoCleanupPreset>('7');
const manualVoomCleanupCustomDays = ref(14);

const cleanupPresetOptions: Array<{ preset: VoomAutoCleanupPreset; label: string; days: number }> = [
  { preset: '3', label: '3天', days: 3 },
  { preset: '7', label: '7天', days: 7 },
  { preset: '30', label: '一个月', days: 30 },
  { preset: 'custom', label: '自定义', days: 14 }
];

function goHome() {
  void router.push({ name: 'home' });
}

const publisherCharacters = computed(() => store.charactersForActiveUser);
const activeCleanupCharacters = computed(() => store.charactersForActiveUser);
const activeCleanupCharacterIds = computed(() => activeCleanupCharacters.value.map((character) => character.id));
const canRegenerateVoomImage = computed(() => Boolean(getSelectedImageModelOption(store.settings, 'voom')));
const activeUserDisplayName = computed(() => store.user ? getUserDisplayName(store.user) : '账号');
const activeUserVoomAuthorName = computed(() => getUserVoomAuthorName(store.user));
const activeUserAvatar = computed(() => store.user?.avatar || '');
const activeUserCharacterIds = computed(() => new Set(store.charactersForActiveUser.map((character) => character.id)));
const voomLatestPostAtByCharacter = computed(() => {
  const latestByCharacter = new Map<string, number>();
  for (const post of store.sortedVoomPosts) {
    if (post.authorType === 'user' || !post.charId) continue;
    latestByCharacter.set(post.charId, Math.max(latestByCharacter.get(post.charId) ?? 0, post.createdAt));
  }
  return latestByCharacter;
});
const voomStoryCharacters = computed(() => store.charactersForActiveUser
  .filter((character) => voomLatestPostAtByCharacter.value.has(character.id))
  .sort((a, b) => (voomLatestPostAtByCharacter.value.get(b.id) ?? 0) - (voomLatestPostAtByCharacter.value.get(a.id) ?? 0))
);
function matchesSelectedVoomFeed(post: VoomPost) {
  if (selectedVoomCharacterId.value) {
    return post.charId === selectedVoomCharacterId.value && post.authorType !== 'user';
  }

  const activeAccountId = store.user?.id ?? '';
  if (post.authorType === 'user') return Boolean(activeAccountId && post.userId === activeAccountId);
  return Boolean(post.charId && activeUserCharacterIds.value.has(post.charId));
}
const visibleVoomPostState = computed(() => {
  const posts: VoomPost[] = [];
  for (const post of store.sortedVoomPosts) {
    if (!matchesSelectedVoomFeed(post)) continue;
    if (posts.length >= visibleVoomPostLimit.value) return { posts, hasMore: true, hasAny: true };
    posts.push(post);
  }
  return { posts, hasMore: false, hasAny: Boolean(posts.length) };
});
const visibleVoomPosts = computed(() => visibleVoomPostState.value.posts);
const hasMoreVoomPosts = computed(() => visibleVoomPostState.value.hasMore);
const hasFilteredVoomPosts = computed(() => visibleVoomPostState.value.hasAny);
const accountHasUnreadVoom = computed(() => voomStoryCharacters.value.some((character) => hasUnreadVoomForCharacter(character.id)));
const characterVoomDisplayNames = computed(() => Object.fromEntries(store.characters.map((character) => [character.id, getCharacterVoomDisplayName(character)])));
const characterVoomAuthorAliases = computed(() => {
  const aliases: Record<string, string> = {};
  store.characters.forEach((character) => {
    const displayName = getCharacterVoomDisplayName(character);
    [character.userNote, character.name, character.nickname, getCharacterVoomAuthorName(character)]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean)
      .forEach((name) => {
        aliases[name] = displayName;
      });
  });
  return aliases;
});
const manualVoomCleanupDays = computed(() => manualVoomCleanupPreset.value === 'custom'
  ? normalizeVoomCleanupDays(manualVoomCleanupCustomDays.value)
  : Number(manualVoomCleanupPreset.value)
);
const manualCleanupTargetPostCount = computed(() => voomCleanupPostCountForCharacters(activeCleanupCharacterIds.value, manualVoomCleanupDays.value));

const voomPostLoadStep = 8;
const voomLoadThreshold = 320;
let voomLoadObserver: IntersectionObserver | undefined;

const selectedUserVoomAccount = computed(() => {
  const selectedId = selectedUserVoomAccountId.value.trim();
  return (selectedId ? store.userById(selectedId) : null) ?? store.user ?? store.accounts[0] ?? null;
});

const userVoomAccountCharacters = computed(() => {
  const accountId = selectedUserVoomAccount.value?.id;
  return accountId ? store.characters.filter((character) => character.boundUserId === accountId) : [];
});

const userVoomTargetCharacterIds = computed(() => {
  if (userVoomVisibility.value === 'public') return userVoomAccountCharacters.value.map((character) => character.id);
  const availableIds = new Set(userVoomAccountCharacters.value.map((character) => character.id));
  return selectedUserVoomCharacterIds.value.filter((id) => availableIds.has(id));
});

const userVoomVisibilitySummary = computed(() => {
  const total = userVoomAccountCharacters.value.length;
  if (userVoomVisibility.value === 'public') return total ? `公开给该账号绑定的 ${total} 个角色` : '该账号暂无绑定角色';
  return total ? `已选择 ${userVoomTargetCharacterIds.value.length} / ${total} 个角色` : '该账号暂无可选择角色';
});

const canSubmitUserVoomPost = computed(() => {
  if (!selectedUserVoomAccount.value || !userVoomContent.value.trim() || !userVoomTargetCharacterIds.value.length) return false;
  if (userVoomMediaMode.value === 'image') return Boolean(userVoomImage.value);
  if (userVoomMediaMode.value === 'card') return Boolean(userVoomImageDescription.value.trim());
  return true;
});

function voomAuthorNameForPost(post: VoomPost) {
  const character = store.characterById(post.charId);
  return character ? getCharacterVoomDisplayName(character) : post.authorName;
}

function voomCharacterAvatar(character: CharacterProfile) {
  return character.avatar;
}

function voomAuthorAvatarForPost(post: VoomPost) {
  if (post.authorType === 'user') return post.authorAvatar;
  const character = store.characterById(post.charId);
  return character ? voomCharacterAvatar(character) : post.authorAvatar;
}

function voomReadAtForCharacter(characterId: string) {
  const userId = store.user?.id ?? '';
  return userId ? store.settings?.voomReadAtByUser[userId]?.[characterId] ?? 0 : 0;
}

function hasUnreadVoomForCharacter(characterId: string) {
  const latestPostAt = voomLatestPostAtByCharacter.value.get(characterId) ?? 0;
  return latestPostAt > voomReadAtForCharacter(characterId);
}

function normalizeVoomCleanupDays(value: unknown) {
  const days = Math.round(Number(value) || 0);
  return Math.min(3650, Math.max(1, days || 7));
}

function defaultVoomCleanupSetting(): CharacterVoomAutoCleanupSettings {
  return { enabled: false, days: 7, preset: '7', lastCleanupAt: 0 };
}

function voomCleanupSettingForCharacter(characterId: string): CharacterVoomAutoCleanupSettings {
  return store.settings?.voomAutoCleanup?.[characterId] ?? defaultVoomCleanupSetting();
}

function voomCleanupPostCountForCharacters(characterIds: string[], olderThanDays: number) {
  const characterIdSet = new Set(characterIds);
  const cutoff = Date.now() - normalizeVoomCleanupDays(olderThanDays) * 24 * 60 * 60 * 1000;
  return store.sortedVoomPosts.filter((post) => post.authorType !== 'user' && characterIdSet.has(post.charId) && post.createdAt < cutoff).length;
}

function voomCleanupPostCountForCharacter(characterId: string, olderThanDays: number) {
  return voomCleanupPostCountForCharacters([characterId], olderThanDays);
}

async function saveVoomCleanupSetting(characterId: string, patch: Partial<CharacterVoomAutoCleanupSettings>) {
  if (!store.settings) return;
  const current = voomCleanupSettingForCharacter(characterId);
  const nextDays = normalizeVoomCleanupDays(patch.days ?? current.days);
  const nextSetting: CharacterVoomAutoCleanupSettings = {
    ...current,
    ...patch,
    days: nextDays,
    preset: patch.preset ?? current.preset,
    lastCleanupAt: Math.max(0, Number(patch.lastCleanupAt ?? current.lastCleanupAt) || 0)
  };
  await store.saveSettings({
    ...store.settings,
    voomAutoCleanup: {
      ...store.settings.voomAutoCleanup,
      [characterId]: nextSetting
    }
  });
}

function openVoomCleanupSettings() {
  voomCleanupNotice.value = '';
  showVoomCleanupSettings.value = true;
}

async function updateVoomCleanupEnabled(characterId: string, event: Event) {
  await saveVoomCleanupSetting(characterId, { enabled: (event.target as HTMLInputElement).checked });
}

async function selectVoomCleanupPreset(characterId: string, preset: VoomAutoCleanupPreset, days: number) {
  await saveVoomCleanupSetting(characterId, { preset, days: preset === 'custom' ? voomCleanupSettingForCharacter(characterId).days : days });
}

async function updateVoomCleanupCustomDays(characterId: string, event: Event) {
  await saveVoomCleanupSetting(characterId, { preset: 'custom', days: normalizeVoomCleanupDays((event.target as HTMLInputElement).value) });
}

function setManualVoomCleanupPreset(preset: VoomAutoCleanupPreset) {
  manualVoomCleanupPreset.value = preset;
}

function setManualVoomCleanupPresetFromEvent(event: Event) {
  setManualVoomCleanupPreset((event.target as HTMLSelectElement).value as VoomAutoCleanupPreset);
}

async function selectVoomCleanupPresetFromEvent(characterId: string, event: Event) {
  const preset = (event.target as HTMLSelectElement).value as VoomAutoCleanupPreset;
  const option = cleanupPresetOptions.find((entry) => entry.preset === preset) ?? cleanupPresetOptions[1];
  await selectVoomCleanupPreset(characterId, option.preset, option.days);
}

async function runManualVoomCleanup() {
  if (voomCleanupRunning.value || !activeCleanupCharacterIds.value.length) return;
  voomCleanupRunning.value = true;
  voomCleanupNotice.value = '';
  try {
    const count = await store.cleanupVoomPostsForCharacters(activeCleanupCharacterIds.value, manualVoomCleanupDays.value);
    voomCleanupNotice.value = count ? `已清理 ${count} 条 VOOM。` : '没有需要清理的 VOOM。';
  } finally {
    voomCleanupRunning.value = false;
    void refreshVoomLazyLoader();
  }
}

async function cleanupCharacterBySetting(characterId: string) {
  if (voomCleanupRunning.value) return;
  voomCleanupRunning.value = true;
  voomCleanupNotice.value = '';
  try {
    const count = await store.cleanupVoomPostsForCharacters([characterId], voomCleanupSettingForCharacter(characterId).days);
    voomCleanupNotice.value = count ? `已清理 ${count} 条 VOOM。` : '没有需要清理的 VOOM。';
  } finally {
    voomCleanupRunning.value = false;
    void refreshVoomLazyLoader();
  }
}

async function runAutoVoomCleanupForActiveUser() {
  if (voomCleanupRunning.value || !activeCleanupCharacterIds.value.length) return;
  voomCleanupRunning.value = true;
  try {
    await store.runVoomAutoCleanupForCharacters(activeCleanupCharacterIds.value);
  } finally {
    voomCleanupRunning.value = false;
    void refreshVoomLazyLoader();
  }
}

function handleManualReplyThread(postId: string) {
  void store.replyToVoomComments(postId, { suppressGlobalNotice: true });
}

function selectAccountVoomFeed() {
  selectedVoomCharacterId.value = '';
  void store.markVoomCharactersRead([...activeUserCharacterIds.value]);
}

function selectCharacterVoomFeed(characterId: string) {
  selectedVoomCharacterId.value = characterId;
  void store.markVoomCharactersRead([characterId]);
}

async function switchActiveAccount(userId: string) {
  await store.setActiveUser(userId);
  selectedVoomCharacterId.value = '';
  showAccountSwitcher.value = false;
}

function loadMoreVoomPosts() {
  if (!hasMoreVoomPosts.value) return;
  visibleVoomPostLimit.value += voomPostLoadStep;
}

function handleVoomPageScroll() {
  if ('IntersectionObserver' in window) return;
  const page = voomPageRef.value;
  if (!page || page.scrollHeight - page.scrollTop - page.clientHeight > voomLoadThreshold) return;
  loadMoreVoomPosts();
  void refreshVoomLazyLoader();
}

async function ensureVoomScrollable() {
  await nextTick();
  const page = voomPageRef.value;
  if (!page) return;
  while (hasMoreVoomPosts.value && page.scrollHeight <= page.clientHeight) {
    loadMoreVoomPosts();
    await nextTick();
  }
}

function disconnectVoomLoadObserver() {
  voomLoadObserver?.disconnect();
  voomLoadObserver = undefined;
}

function connectVoomLoadObserver() {
  disconnectVoomLoadObserver();
  const page = voomPageRef.value;
  const loader = voomLoaderRef.value;
  if (!page || !loader || !hasMoreVoomPosts.value || !('IntersectionObserver' in window)) return;

  voomLoadObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    loadMoreVoomPosts();
    void refreshVoomLazyLoader();
  }, {
    root: page,
    rootMargin: `0px 0px ${voomLoadThreshold}px 0px`,
    threshold: 0
  });
  voomLoadObserver.observe(loader);
}

async function refreshVoomLazyLoader() {
  await ensureVoomScrollable();
  await nextTick();
  connectVoomLoadObserver();
}

onMounted(() => {
  void refreshVoomLazyLoader();
  void runAutoVoomCleanupForActiveUser();
});

onBeforeUnmount(() => {
  disconnectVoomLoadObserver();
});

watch(() => store.sortedVoomPosts.length, () => {
  void refreshVoomLazyLoader();
});

watch(hasMoreVoomPosts, () => {
  void refreshVoomLazyLoader();
});

watch([() => selectedVoomCharacterId.value, () => store.user?.id], () => {
  visibleVoomPostLimit.value = initialVoomPostLimit;
  void refreshVoomLazyLoader();
});

watch([() => store.user?.id, () => activeCleanupCharacterIds.value.join('|')], () => {
  void runAutoVoomCleanupForActiveUser();
});

async function handleComment(postId: string, content: string, parentId?: string) {
  await store.addVoomComment(postId, content, parentId ?? '');
}

async function handleRegenerateImage(postId: string, description: string, generationPrompt: string) {
  if (regeneratingImagePostIds.value.includes(postId)) return;
  regeneratingImagePostIds.value = [...regeneratingImagePostIds.value, postId];
  try {
    await store.regenerateVoomPostImage(postId, description, generationPrompt);
  } finally {
    regeneratingImagePostIds.value = regeneratingImagePostIds.value.filter((id) => id !== postId);
  }
}

async function handleApplyImageCandidate(postId: string, candidateId: string) {
  if (regeneratingImagePostIds.value.includes(postId)) {
    store.showConfigAlert('正在重新生成 VOOM 配图，请等待当前生成完成。', '正在生成');
    return;
  }
  await store.applyVoomPostImageCandidate(postId, candidateId);
}

async function handleDeleteImageCandidate(postId: string, candidateId: string, imageUrl: string) {
  await store.deleteVoomPostImageCandidate(postId, candidateId, imageUrl);
}

function requestDeleteVoomPost(postId: string) {
  pendingDeletePostId.value = postId;
  showDeletePostConfirm.value = true;
}

function cancelDeleteVoomPost() {
  pendingDeletePostId.value = '';
  showDeletePostConfirm.value = false;
}

async function confirmDeleteVoomPost() {
  const postId = pendingDeletePostId.value;
  if (!postId) return;
  await store.deleteVoomPost(postId);
  pendingDeletePostId.value = '';
  showDeletePostConfirm.value = false;
}

function openVoomPublisher() {
  selectedPublisherId.value = randomPublisherId;
  showVoomPublisher.value = true;
}

function resetUserVoomDraft(accountId = store.user?.id || store.accounts[0]?.id || '') {
  selectedUserVoomAccountId.value = accountId;
  userVoomContent.value = '';
  userVoomMediaMode.value = 'none';
  userVoomImage.value = '';
  userVoomImageDescription.value = '';
  userVoomVisibility.value = 'public';
  selectedUserVoomCharacterIds.value = store.characters
    .filter((character) => character.boundUserId === accountId)
    .map((character) => character.id);
}

function openUserVoomPublisher() {
  resetUserVoomDraft();
  showUserVoomPublisher.value = true;
}

function setUserVoomMediaMode(mode: 'none' | 'image' | 'card') {
  userVoomMediaMode.value = mode;
  if (mode === 'none') {
    userVoomImage.value = '';
    userVoomImageDescription.value = '';
  } else if (mode === 'card') {
    userVoomImage.value = '';
  }
}

function selectUserVoomVisibility(visibility: VoomPostVisibility) {
  userVoomVisibility.value = visibility;
  if (visibility === 'selected' && !selectedUserVoomCharacterIds.value.length) {
    selectedUserVoomCharacterIds.value = userVoomAccountCharacters.value.map((character) => character.id);
  }
}

function toggleUserVoomCharacter(characterId: string) {
  selectedUserVoomCharacterIds.value = selectedUserVoomCharacterIds.value.includes(characterId)
    ? selectedUserVoomCharacterIds.value.filter((id) => id !== characterId)
    : [...selectedUserVoomCharacterIds.value, characterId];
}

async function readUserVoomImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !file.type.startsWith('image/')) {
    input.value = '';
    return;
  }

  try {
    const image = await readChatImageFile(file, 800, 0.72);
    userVoomImage.value = image.dataUrl;
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '图片读取失败。', '无法读取图片');
  } finally {
    input.value = '';
  }
}

function resolvePublisherCharacter() {
  if (!publisherCharacters.value.length) return null;
  if (selectedPublisherId.value === randomPublisherId) {
    return publisherCharacters.value[Math.floor(Math.random() * publisherCharacters.value.length)];
  }
  return publisherCharacters.value.find((character) => character.id === selectedPublisherId.value) ?? publisherCharacters.value[0];
}

async function confirmCreateVoomPost() {
  const character = resolvePublisherCharacter();
  const conversation = character ? store.conversations.find((item) => item.charId === character.id) : null;
  if (!conversation) {
    store.showConfigAlert('请先添加并绑定一个角色，再生成 VOOM。', '无法生成 VOOM');
    return;
  }
  creatingVoomPost.value = true;
  try {
    const post = await store.createMomentFromConversation(conversation.id);
    if (post) showVoomPublisher.value = false;
  } finally {
    creatingVoomPost.value = false;
  }
}

async function confirmCreateUserVoomPost() {
  if (creatingUserVoomPost.value) return;
  creatingUserVoomPost.value = true;
  try {
    const post = await store.createUserVoomPost({
      userId: selectedUserVoomAccount.value?.id ?? '',
      content: userVoomContent.value,
      image: userVoomMediaMode.value === 'image' ? userVoomImage.value : '',
      imageDescription: userVoomMediaMode.value === 'none' ? '' : userVoomImageDescription.value,
      visibility: userVoomVisibility.value,
      characterIds: userVoomVisibility.value === 'selected' ? userVoomTargetCharacterIds.value : []
    });
    if (post) {
      showUserVoomPublisher.value = false;
      resetUserVoomDraft(selectedUserVoomAccount.value?.id);
    }
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '用户 VOOM 发布失败。', '无法发布 VOOM');
  } finally {
    creatingUserVoomPost.value = false;
  }
}
</script>

<style scoped>
.voom-page {
  background: #ffffff;
  --top-icon-size: 20px;
  --top-icon-button-width: 26px;
  --top-icon-button-height: 30px;
  --top-icon-gap: 1px;
  overflow-x: hidden;
  overscroll-behavior-x: none;
  padding-bottom: calc(var(--safe-bottom) + 24px);
  scroll-padding-bottom: calc(var(--safe-bottom) + 24px);
}

.subpage-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: inherit;
}

.subpage-title-button .top-title {
  margin: 0;
  text-align: left;
}

.story-strip {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 8px 16px 14px;
  scrollbar-width: none;
}

.story-strip::-webkit-scrollbar {
  display: none;
}

.story-button {
  flex: 0 0 62px;
  display: grid;
  justify-items: center;
  gap: 6px;
  min-width: 0;
  padding: 0;
  color: #222222;
  font-size: 12px;
}

.story-button.active .story-avatar {
  box-shadow: 0 0 0 2px rgba(6, 199, 85, 0.28), 0 0 0 5px rgba(6, 199, 85, 0.08);
}

.story-name {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
  text-align: center;
}

.story-avatar {
  position: relative;
  display: grid;
  place-items: center;
  flex: 0 0 54px;
  width: 54px;
  height: 54px;
  overflow: visible;
  border-radius: 50%;
  background: #cfedfb;
  color: #ffffff;
}

.story-avatar > svg {
  width: 26px;
  height: 26px;
}

.story-avatar img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.story-add {
  position: absolute;
  right: -2px;
  bottom: 3px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #35cf64;
  color: #ffffff;
  font-style: normal;
}

.story-add svg {
  width: 12px;
  height: 12px;
}

.story-unread {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  border: 2px solid #ffffff;
  border-radius: 50%;
  background: #ff405a;
}

.empty-state h2 {
  margin: 0 0 6px;
  color: #222222;
  font-size: 18px;
}

.empty-state p {
  margin: 0;
  line-height: 1.55;
}

.voom-loader {
  padding: 14px 16px calc(18px + var(--safe-bottom));
  color: #8b929a;
  font-size: 12px;
  font-weight: 760;
  text-align: center;
}

.voom-delete-confirm {
  display: grid;
  gap: 12px;
  color: #202329;
}

.voom-delete-confirm h3,
.voom-delete-confirm p {
  margin: 0;
}

.voom-delete-confirm h3 {
  font-size: 18px;
  font-weight: 900;
}

.voom-delete-confirm p {
  color: #656a73;
  line-height: 1.6;
}

.voom-delete-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.voom-danger-button {
  display: inline-grid;
  place-items: center;
  height: 40px;
  border-radius: 8px;
  background: #fff1f2;
  color: #b42318;
  font-weight: 900;
}

.voom-danger-button:disabled {
  opacity: 0.52;
}

.voom-cleanup-panel {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.cleanup-manual-card {
  display: grid;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 1px solid rgba(17, 17, 17, 0.08);
}

.cleanup-section-head,
.cleanup-character-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cleanup-section-head span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #202329;
  font-weight: 900;
}

.cleanup-section-head small,
.cleanup-notice {
  color: #767b82;
  font-size: 12px;
}

.cleanup-character-list {
  display: grid;
  gap: 0;
  overflow: hidden;
  border-radius: 0;
  background: transparent;
}

.cleanup-character-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 13px 0;
  background: transparent;
}

.cleanup-character-card + .cleanup-character-card {
  border-top: 1px solid rgba(17, 17, 17, 0.06);
}

.cleanup-character-head {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  justify-content: flex-start;
  min-width: 0;
}

.cleanup-character-head img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--soft);
}

.cleanup-character-head span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cleanup-character-head strong,
.cleanup-character-head small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cleanup-character-head strong {
  color: #171717;
  font-size: 13px;
  font-weight: 850;
}

.cleanup-character-head small {
  color: #858a91;
  font-size: 11px;
}

.cleanup-character-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #68707a;
  font-size: 11px;
  font-weight: 760;
}

.cleanup-character-meta small {
  color: #9aa0a7;
  font-size: 11px;
}

.cleanup-compact-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.cleanup-compact-row:has(.cleanup-days-field) {
  grid-template-columns: minmax(0, 1fr) 72px auto;
}

.cleanup-select-field,
.cleanup-days-field {
  display: grid;
  align-items: center;
  min-width: 0;
}

.cleanup-select-field {
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
}

.cleanup-select-field span,
.cleanup-days-field span {
  color: #8b929a;
  font-size: 11px;
  font-weight: 800;
}

.cleanup-select-field select,
.cleanup-days-field input {
  width: 100%;
  height: 34px;
  min-width: 0;
  border: 0;
  border-radius: 9px;
  background: #f5f6f7;
  color: #222222;
  font: inherit;
  font-weight: 800;
}

.cleanup-select-field select {
  padding: 0 28px 0 10px;
}

.cleanup-days-field {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 5px;
}

.cleanup-days-field input {
  padding: 0 8px;
  text-align: center;
}

.cleanup-text-action {
  min-width: 44px;
  height: 34px;
  padding: 0 8px;
  border-radius: 9px;
  background: transparent;
  color: #12853f;
  font-size: 12px;
  font-weight: 900;
}

.cleanup-text-action.danger:not(:disabled) {
  color: #b42318;
}

.cleanup-text-action:disabled {
  color: #b8bec5;
}

.cleanup-switch-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  min-height: 28px;
  color: #202329;
  font-weight: 850;
}

.cleanup-switch-card input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.cleanup-switch-track {
  position: relative;
  width: 38px;
  height: 22px;
  border-radius: 999px;
  background: #dfe4ea;
  transition: background 0.2s ease;
}

.cleanup-switch-track::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  transition: transform 0.2s ease;
}

.cleanup-switch-card input:checked + .cleanup-switch-track {
  background: var(--link-green);
}

.cleanup-switch-card input:checked + .cleanup-switch-track::after {
  transform: translateX(16px);
}

.cleanup-notice {
  margin: 0;
  text-align: center;
}

.model-picker {
  display: grid;
  gap: 14px;
}

.voom-publisher {
  display: grid;
  gap: 14px;
}

.user-voom-publisher {
  display: grid;
  gap: 14px;
}

.manual-section {
  display: grid;
  gap: 10px;
}

.compact-copy strong {
  font-size: 15px;
}

.account-list,
.target-list {
  display: grid;
  gap: 8px;
}

.account-option,
.target-option {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 10px;
  border: 1px solid #edf0f2;
  border-radius: 8px;
  background: #ffffff;
  color: #171717;
  text-align: left;
}

.target-option {
  grid-template-columns: 20px 38px minmax(0, 1fr);
}

.account-option.active,
.target-option:has(input:checked) {
  border-color: rgba(6, 199, 85, 0.54);
  background: #effbf4;
}

.account-option img,
.target-option img {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--soft);
}

.account-option span,
.target-option span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.account-option strong,
.account-option small,
.target-option strong,
.target-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.account-option strong,
.target-option strong {
  font-size: 13px;
  font-weight: 850;
}

.account-option small,
.target-option small {
  color: #858a91;
  font-size: 11px;
}

.target-option input {
  width: 17px;
  height: 17px;
  accent-color: var(--link-green);
}

.manual-field {
  display: grid;
  gap: 6px;
}

.manual-field > span {
  color: #686b70;
  font-size: 12px;
  font-weight: 800;
}

.manual-field textarea {
  min-height: 86px;
  padding: 10px;
  border-radius: 8px;
  background: #ffffff;
  color: #171717;
  line-height: 1.5;
  resize: vertical;
}

.compact-field textarea {
  min-height: 62px;
}

.media-tabs,
.visibility-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.visibility-tabs {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.media-tabs button,
.visibility-tabs button {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 34px;
  padding: 0 8px;
  border: 1px solid #edf0f2;
  border-radius: 8px;
  background: #ffffff;
  color: #4f555c;
  font-weight: 850;
}

.media-tabs button.active,
.visibility-tabs button.active {
  border-color: rgba(6, 199, 85, 0.54);
  background: #effbf4;
  color: #12853f;
}

.image-compose {
  display: grid;
  gap: 10px;
}

.image-upload {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 136px;
  overflow: hidden;
  border: 1px dashed #d7dde2;
  border-radius: 8px;
  background: #ffffff;
  color: #697079;
  font-weight: 850;
}

.image-upload input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.image-upload img {
  width: 100%;
  height: 100%;
  max-height: 220px;
  object-fit: cover;
}

.image-upload span {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  gap: 6px;
}

.publisher-copy {
  display: grid;
  gap: 5px;
}

.publisher-copy strong {
  color: #151515;
  font-size: 18px;
  font-weight: 900;
}

.publisher-copy span {
  color: #767b82;
  font-size: 12px;
  line-height: 1.45;
}

.publisher-list {
  display: grid;
  gap: 10px;
}

.publisher-option {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px 10px;
  border: 1px solid #edf0f2;
  border-radius: 8px;
  background: #ffffff;
  color: #171717;
  text-align: left;
}

.publisher-option.active {
  border-color: rgba(6, 199, 85, 0.54);
  background: #effbf4;
}

.publisher-option:disabled {
  cursor: progress;
  opacity: 0.72;
}

.publisher-option img,
.random-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.publisher-option img {
  object-fit: cover;
}

.random-avatar {
  display: grid;
  place-items: center;
  background: #141414;
  color: #ffffff;
}

.publisher-option span:not(.random-avatar) {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.publisher-option strong,
.publisher-option small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publisher-option strong {
  font-size: 14px;
  font-weight: 850;
}

.publisher-option small {
  color: #858a91;
  font-size: 11px;
}

.publisher-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.user-voom-publisher > .publisher-actions {
  position: sticky;
  bottom: 0;
  z-index: 2;
  margin: 2px -13px -13px;
  padding: 10px 13px calc(12px + var(--safe-bottom));
  border-top: 1px solid rgba(236, 239, 241, 0.8);
  background: rgba(248, 249, 252, 0.96);
  backdrop-filter: blur(16px);
}

.publisher-secondary,
.publisher-primary {
  display: inline-grid;
  grid-auto-flow: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border-radius: 8px;
  font-weight: 900;
}

.publisher-secondary {
  background: #f1f3f5;
  color: #4f555c;
}

.publisher-primary {
  background: #171717;
  color: #ffffff;
}

.publisher-secondary:disabled,
.publisher-primary:disabled {
  cursor: progress;
  opacity: 0.7;
}

.publisher-loading {
  animation: publisher-spin 0.8s linear infinite;
}

@keyframes publisher-spin {
  to {
    transform: rotate(360deg);
  }
}

.picker-copy {
  display: grid;
  gap: 5px;
}

.picker-copy strong {
  color: #151515;
  font-size: 18px;
  font-weight: 900;
}

.picker-copy span {
  color: #767b82;
  font-size: 12px;
  line-height: 1.45;
}

.model-list {
  display: grid;
  gap: 10px;
}

.model-option {
  display: grid;
  gap: 5px;
  width: 100%;
  padding: 12px;
  border: 1px solid #edf0f2;
  border-radius: 8px;
  background: #ffffff;
  color: #171717;
  text-align: left;
}

.model-option.active {
  border-color: rgba(6, 199, 85, 0.54);
  background: #effbf4;
}

.model-provider {
  color: var(--link-green);
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

.model-option strong {
  overflow-wrap: anywhere;
  font-size: 14px;
  font-weight: 800;
  line-height: 1.35;
}

.model-option small {
  overflow-wrap: anywhere;
  color: #858a91;
  font-size: 11px;
  line-height: 1.35;
}

.picker-empty {
  display: grid;
  gap: 7px;
  padding: 14px;
  border-radius: 8px;
  background: var(--soft);
}

.picker-empty strong {
  color: #222222;
}

.picker-empty p {
  margin: 0;
  color: #6e747b;
  font-size: 12px;
  line-height: 1.55;
}
</style>