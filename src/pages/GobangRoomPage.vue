<template>
  <section v-if="conversation && character && gameMessage && game" class="screen no-tabs gobang-room">
    <main class="gobang-room-main">
      <section class="gobang-room-hero">
        <span class="gobang-room-eyebrow">LINK PLAY · PRIVATE TABLE</span>
        <div class="gobang-room-players">
          <figure>
            <img :src="userAvatar" :alt="userName" />
            <figcaption><strong>{{ userName }}</strong><small>{{ userStoneLabel }}</small></figcaption>
          </figure>
          <span class="gobang-room-versus"><i></i>VS<i></i></span>
          <figure>
            <button
              class="gobang-character-avatar"
              :class="{ 'has-unread-mind': hasUnreadMindState }"
              type="button"
              :aria-label="`查看${characterName}心声`"
              @click="openMindState"
            >
              <img :src="character.avatar" :alt="characterName" />
              <span v-if="hasUnreadMindState" class="gobang-mind-dot" aria-hidden="true"></span>
            </button>
            <figcaption><strong>{{ characterName }}</strong><small>{{ characterStoneLabel }}</small></figcaption>
          </figure>
        </div>
      </section>

      <GobangGamePanel
        class="gobang-room-board"
        :game="game"
        :character-name="characterName"
        :user-name="userName"
        :busy="gobangBusy"
        :disabled="interactionLocked"
        @place="placeStone"
        @retry="retryCharacterMove"
        @undo="undoMove"
        @resign="resignMatch"
        @new-game="goBack"
      />
    </main>

    <Transition name="gobang-conversation-scrim">
      <button v-if="conversationOpen" class="gobang-conversation-scrim" type="button" aria-label="关闭桌边会话" @click="closeConversation" />
    </Transition>

    <Transition name="gobang-conversation-drawer">
      <section v-if="conversationOpen" class="gobang-room-conversation" aria-label="桌边会话">
        <header>
          <div>
            <strong><MessageCircleMore :size="15" />桌边会话</strong>
            <small>{{ sessionMessages.length ? `${sessionMessages.length} 条记录` : '还没有记录' }}</small>
          </div>
          <button type="button" aria-label="收起桌边会话" @click="closeConversation">
            <ChevronDown :size="18" />
          </button>
        </header>
        <div ref="transcriptRef" class="gobang-room-transcript">
          <div v-if="!sessionMessages.length" class="gobang-room-empty">
            <span>落子与对白会出现在这里</span>
            <small>发送后可单独记录，也可以再请求角色回复</small>
          </div>
          <MessageBubble
            v-for="entry in sessionMessageEntries"
            :key="entry.message.id"
            :message="entry.message"
            :character="character"
            :user="conversationUser"
            :appearance="chatSettings.appearance"
            :group-position="entry.groupPosition"
            :hide-avatar="entry.message.sender === 'system'"
            :hide-message-time="false"
          />
          <div v-if="replyWaiting" class="gobang-room-typing"><i></i><i></i><i></i><span>{{ characterName }} 正在回复</span></div>
        </div>
      </section>
    </Transition>

    <button
      v-if="!conversationOpen"
      class="gobang-conversation-trigger"
      :class="{ 'has-update': hiddenConversationUpdate }"
      type="button"
      aria-label="打开桌边会话"
      @click="openConversation"
    >
      <MessageCircleMore :size="15" />
      <span>桌边会话</span>
      <small>{{ sessionMessages.length || '0' }}</small>
      <em v-if="conversationPreview">{{ conversationPreview }}</em>
      <ChevronUp :size="16" />
    </button>

    <form class="gobang-room-composer" @submit.prevent="sendOnly">
      <input v-model="draft" maxlength="500" :disabled="interactionLocked" enterkeyhint="send" placeholder="在棋桌边说点什么…" />
      <button class="gobang-send-only" type="submit" :disabled="interactionLocked || !draft.trim()">发送</button>
      <button class="gobang-reply-button" type="button" aria-label="请求角色回复" :disabled="interactionLocked || replyWaiting" @click="sendAndReply">
        <Send :size="17" />
      </button>
    </form>

    <AppModal v-model="showMindState" title="角色心声" :show-header="false" variant="profile-ins">
      <CharacterProfileSheet
        v-if="character"
        :character="character"
        :homepages="store.profileHomepagesForCharacter(character.id)"
        :posts="store.sortedVoomPosts"
        @save="saveCharacterProfile"
        @delete-history-entry="deleteCharacterProfileHistoryEntry"
        @clear-history="clearCharacterProfileHistory"
      />
    </AppModal>
  </section>
  <section v-else class="screen no-tabs gobang-room gobang-room-missing">
    <CircleOff :size="38" />
    <strong>这张棋桌已经不存在</strong>
    <button type="button" @click="goBack">返回聊天</button>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronDown, ChevronUp, CircleOff, MessageCircleMore, Send } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import CharacterProfileSheet from '@/components/chat/CharacterProfileSheet.vue';
import GobangGamePanel from '@/components/chat/GobangGamePanel.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import { useAppStore } from '@/stores/appStore';
import type { CharacterProfile, ChatGobangAttachment } from '@/types/domain';
import { getCharacterAiName, getCharacterDisplayName } from '@/utils/character';
import { firstUnreadCharacterMessageId, scrollMessageContainerToUnreadOrBottom } from '@/utils/messageScroll';
import { defaultProfileAvatar, getUserAiName, getUserDisplayName, normalizeVisualProfile } from '@/utils/profile';
import { applyGobangMove, gobangStoneForPlayer, resignGobangGame, undoGobangRound } from '@/utils/gobang';
import { resolveMessageGroupPositions } from '@/utils/messageGrouping';

const props = defineProps<{ id: string; messageId: string }>();
const store = useAppStore();
const router = useRouter();
const transcriptRef = ref<HTMLElement | null>(null);
const draft = ref('');
const gobangBusy = ref(false);
const showMindState = ref(false);
const conversationOpen = ref(false);
const hiddenConversationUpdate = ref(false);
let gobangRequestController: AbortController | null = null;
let gobangRunId = 0;

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => conversation.value ? store.characterById(conversation.value.charId) : undefined);
const conversationUser = computed(() => {
  const currentConversation = conversation.value;
  const currentCharacter = character.value;
  if (!currentConversation || !currentCharacter) return undefined;
  const userId = currentConversation.userId || currentCharacter.boundUserId;
  const user = userId ? store.userById(userId) : null;
  if (!user) return undefined;
  const profile = normalizeVisualProfile(currentCharacter.boundUserProfile, user);
  return {
    ...user,
    avatar: profile.avatar || user.avatar,
    profile: normalizeVisualProfile({
      ...profile,
      nickname: user.nickname,
      bio: user.signature
    }, user)
  };
});
const gameMessage = computed(() => store.messagesForConversation(props.id).find((message) => message.id === props.messageId && message.gobang) ?? null);
const game = computed(() => gameMessage.value?.gobang ?? null);
const chatSettings = computed(() => store.settingsForConversation(props.id));
const characterName = computed(() => character.value ? getCharacterDisplayName(character.value) : '角色');
const characterAiName = computed(() => character.value ? getCharacterAiName(character.value) : '角色');
const userName = computed(() => getUserDisplayName(conversationUser.value ?? store.user));
const userAiName = computed(() => getUserAiName(conversationUser.value ?? store.user));
const userAvatar = computed(() => conversationUser.value?.avatar || defaultProfileAvatar);
const sessionMessages = computed(() => store.messagesForConversation(props.id)
  .filter((message) => message.gobangId === game.value?.gameId && !message.contextOnly)
  .sort((left, right) => left.createdAt - right.createdAt));
const sessionMessageEntries = computed(() => {
  const messages = sessionMessages.value;
  const groupPositions = resolveMessageGroupPositions(messages);
  return messages.map((message, index) => ({ message, groupPosition: groupPositions[index] }));
});
const replyWaiting = computed(() => store.isConversationReplying(props.id));
const interactionLocked = computed(() => gobangBusy.value || replyWaiting.value || game.value?.status !== 'active');
const userStoneLabel = computed(() => game.value?.userStone === 'black' ? '黑棋' : '白棋');
const characterStoneLabel = computed(() => game.value && gobangStoneForPlayer(game.value, 'char') === 'black' ? '黑棋' : '白棋');
const hasUnreadMindState = computed(() => Boolean(character.value?.mindState?.lines.length
  && character.value.mindState.updatedAt > character.value.mindState.readAt));
const conversationPreview = computed(() => {
  const latestMessage = sessionMessages.value[sessionMessages.value.length - 1];
  const content = latestMessage?.content.replace(/\s+/g, ' ').trim() ?? '';
  return content.length > 18 ? `${content.slice(0, 18)}…` : content;
});

function resultNarration(currentGame: ChatGobangAttachment) {
  if (currentGame.status === 'user-won') return `[棋局结束] ${userAiName.value}在第 ${currentGame.moves.length} 手连成五子并获胜。`;
  if (currentGame.status === 'char-won') return `[棋局结束] ${characterAiName.value}在第 ${currentGame.moves.length} 手连成五子并获胜。`;
  if (currentGame.status === 'draw') return `[棋局结束] 棋盘在第 ${currentGame.moves.length} 手落满，双方平局。`;
  if (currentGame.status === 'resigned') return `[棋局结束] ${userAiName.value}向${characterAiName.value}认输。`;
  return '';
}

async function appendResultFloor(currentGame: ChatGobangAttachment) {
  const content = resultNarration(currentGame);
  if (!content || sessionMessages.value.some((message) => message.sender === 'system' && message.content === content)) return;
  await store.appendGobangSessionMessage(props.id, currentGame.gameId, 'system', content, {
    narration: true,
    createdAt: (currentGame.endedAt ?? currentGame.updatedAt) + 1
  });
}

async function scrollTranscript(options: { preferUnread?: boolean; unreadMessageId?: string } = {}) {
  await nextTick();
  const transcript = transcriptRef.value;
  if (!transcript) return;
  if (options.preferUnread) {
    scrollMessageContainerToUnreadOrBottom(transcript, sessionMessages.value, options.unreadMessageId);
  } else {
    transcript.scrollTop = transcript.scrollHeight;
  }
  if (conversationOpen.value) await store.markConversationRead(props.id);
}

async function openConversation() {
  const unreadMessageId = firstUnreadCharacterMessageId(sessionMessages.value);
  conversationOpen.value = true;
  hiddenConversationUpdate.value = false;
  await scrollTranscript({ preferUnread: true, unreadMessageId });
}

function closeConversation() {
  conversationOpen.value = false;
}

async function letCharacterMove() {
  const currentMessage = gameMessage.value;
  const currentGame = currentMessage?.gobang;
  if (!currentMessage || !currentGame || currentGame.status !== 'active' || currentGame.turn !== 'char' || gobangBusy.value) return;
  const runId = ++gobangRunId;
  gobangBusy.value = true;
  gobangRequestController?.abort();
  const controller = new AbortController();
  gobangRequestController = controller;
  const timeout = window.setTimeout(() => controller.abort(new DOMException('五子棋 API 请求超时', 'TimeoutError')), 120_000);
  try {
    const nextGame = await store.requestGobangMove(props.id, currentMessage.id, { signal: controller.signal });
    if (runId !== gobangRunId || !nextGame) return;
    navigator.vibrate?.(12);
    if (nextGame.status !== 'active') await appendResultFloor(nextGame);
    await scrollTranscript();
  } catch {
    return;
  } finally {
    window.clearTimeout(timeout);
    if (gobangRequestController === controller) gobangRequestController = null;
    if (runId === gobangRunId) gobangBusy.value = false;
  }
}

async function placeStone(row: number, column: number) {
  const currentMessage = gameMessage.value;
  const currentGame = currentMessage?.gobang;
  if (!currentMessage || !currentGame || interactionLocked.value) return;
  const nextGame = applyGobangMove(currentGame, { row, column }, 'user');
  if (nextGame === currentGame) return;
  navigator.vibrate?.(8);
  await store.updateGobangMessage(currentMessage.id, nextGame);
  if (nextGame.status !== 'active') {
    await appendResultFloor(nextGame);
    return;
  }
  await letCharacterMove();
}

async function retryCharacterMove() {
  if (replyWaiting.value) return;
  await letCharacterMove();
}

async function undoMove() {
  const currentMessage = gameMessage.value;
  const currentGame = currentMessage?.gobang;
  if (!currentMessage || !currentGame || interactionLocked.value) return;
  const nextGame = undoGobangRound(currentGame);
  if (nextGame === currentGame) return;
  await store.updateGobangMessage(currentMessage.id, nextGame);
  navigator.vibrate?.(6);
}

async function resignMatch() {
  const currentMessage = gameMessage.value;
  const currentGame = currentMessage?.gobang;
  if (!currentMessage || !currentGame || interactionLocked.value) return;
  const nextGame = resignGobangGame(currentGame);
  if (nextGame === currentGame) return;
  gobangRunId += 1;
  gobangRequestController?.abort();
  await store.updateGobangMessage(currentMessage.id, nextGame);
  await appendResultFloor(nextGame);
}

async function appendUserFloor(content: string) {
  const currentGame = game.value;
  if (!currentGame || !content.trim()) return null;
  return store.appendGobangSessionMessage(props.id, currentGame.gameId, 'user', content.trim());
}

async function sendOnly() {
  const content = draft.value.trim();
  if (!content || interactionLocked.value) return;
  draft.value = '';
  await appendUserFloor(content);
  await openConversation();
}

async function sendAndReply() {
  const currentGame = game.value;
  if (!currentGame || interactionLocked.value) return;
  await openConversation();
  const content = draft.value.trim();
  if (content) {
    draft.value = '';
    await appendUserFloor(content);
    await scrollTranscript();
  }
  const userCue = content
    ? `${userAiName.value}刚刚在五子棋桌边说：“${content}”。`
    : `${userAiName.value}点击了“回复”，希望${characterAiName.value}回应棋桌边最近还没有回应的内容。`;
  await store.requestRoleplayReply(props.id, {
    gobangSession: { gameId: currentGame.gameId },
    replyInstruction: `当前${characterAiName.value}与${userAiName.value}正在 LINK 的独立五子棋页面对局。${userCue}请继续使用与线上聊天完全一致的角色设定、世界书、记忆、现实时间和会话历史自然回复；旁白模式开启时按原规则输出旁白。不要替${userAiName.value}补写动作、心理或未说出口的话，也不要声称已经落子——实际落子只由独立的真实棋局 API 完成。`
  });
  await scrollTranscript();
}

function goBack() {
  void router.replace({ name: 'chat-room', params: { id: props.id } });
}

async function openMindState() {
  showMindState.value = true;
  if (character.value) await store.markCharacterMindStateRead(character.value.id);
}

async function saveCharacterProfile(nextCharacter: CharacterProfile) {
  await store.saveCharacter(nextCharacter);
}

async function deleteCharacterProfileHistoryEntry(entryId: string) {
  if (!character.value) return;
  await store.deleteCharacterProfileHistoryEntry(character.value.id, entryId);
}

async function clearCharacterProfileHistory() {
  if (!character.value) return;
  await store.clearCharacterProfileHistory(character.value.id);
}

onMounted(async () => {
  await store.hydrate();
  await store.ensureConversationMessagesLoaded(props.id);
  store.setActiveConversation(props.id);
  if (conversation.value?.activeMode !== 'online') await store.updateConversationMode(props.id, 'online');
  if (gameMessage.value) await store.recoverInterruptedGobangMessage(gameMessage.value.id);
  hiddenConversationUpdate.value = Boolean(firstUnreadCharacterMessageId(sessionMessages.value));
  const currentGame = game.value;
  if (currentGame && (currentGame.invitationStatus ?? 'accepted') === 'accepted' && currentGame.status === 'active' && currentGame.turn === 'char' && currentGame.apiState?.status === 'idle') {
    await letCharacterMove();
  }
});

watch(() => [props.id, props.messageId] as const, ([conversationId]) => {
  void (async () => {
    await store.ensureConversationMessagesLoaded(conversationId);
    store.setActiveConversation(conversationId);
    if (conversation.value?.activeMode !== 'online') await store.updateConversationMode(conversationId, 'online');
    if (gameMessage.value) await store.recoverInterruptedGobangMessage(gameMessage.value.id);
    hiddenConversationUpdate.value = Boolean(firstUnreadCharacterMessageId(sessionMessages.value));
  })();
});

watch(() => sessionMessages.value.length, (nextLength, previousLength) => {
  if (nextLength > previousLength && !conversationOpen.value) hiddenConversationUpdate.value = true;
  if (conversationOpen.value) void scrollTranscript();
});

onBeforeUnmount(() => {
  gobangRunId += 1;
  gobangRequestController?.abort();
  gobangRequestController = null;
  store.setActiveConversation(null);
});
</script>

<style scoped>
.gobang-room {
  --ink: #1f2826;
  --jade: #1f8f6a;
  --paper: #f4f1e9;
  display: flex;
  flex-direction: column;
  min-height: 100%;
  overflow: hidden;
  color: var(--ink);
  background:
    radial-gradient(circle at 12% -8%, rgba(76, 169, 132, .19), transparent 34%),
    linear-gradient(180deg, #f8faf7 0%, #eef2ec 48%, #e7ebe5 100%);
}

.gobang-room-main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: calc(10px + var(--safe-top)) calc(14px + var(--safe-right)) calc(132px + var(--safe-bottom)) calc(14px + var(--safe-left));
  scrollbar-width: none;
}
.gobang-room-main::-webkit-scrollbar { display: none; }

.gobang-room-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 7px; max-width: 560px; margin: 0 auto 10px; }
.gobang-narration-pill { display: flex; align-items: center; gap: 5px; padding: 5px 9px; border: 1px solid rgba(31,143,106,.15); border-radius: 999px; color: #267b60; background: rgba(255,255,255,.62); font-size: 9px; font-weight: 750; }
.gobang-mind-button { display: inline-flex; align-items: center; gap: 5px; min-height: 27px; padding: 5px 10px; border: 1px solid rgba(177,98,123,.14); border-radius: 999px; color: #985c70; background: rgba(255,248,251,.76); font-size: 9px; font-weight: 850; }
.gobang-room-hero { display: grid; justify-items: center; gap: 12px; max-width: 560px; margin: 2px auto 14px; }
.gobang-room-eyebrow { color: #718078; font-size: 9px; font-weight: 850; letter-spacing: .18em; }
.gobang-room-players { display: grid; grid-template-columns: minmax(0, 1fr) 74px minmax(0, 1fr); align-items: center; width: 100%; }
.gobang-room-players figure { display: grid; justify-items: center; gap: 7px; margin: 0; }
.gobang-room-players img { width: 54px; height: 54px; border: 3px solid rgba(255,255,255,.9); border-radius: 18px; object-fit: cover; box-shadow: 0 9px 26px rgba(36,55,48,.16); }
.gobang-room-players figcaption { display: grid; justify-items: center; gap: 1px; }
.gobang-room-players figcaption strong { max-width: 120px; overflow: hidden; font-size: 12px; font-weight: 850; text-overflow: ellipsis; white-space: nowrap; }
.gobang-room-players figcaption small { color: #84908b; font-size: 9px; }
.gobang-room-versus { display: flex; align-items: center; gap: 7px; color: #7b867f; font-size: 10px; font-weight: 900; }
.gobang-room-versus i { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, rgba(31,40,38,.18)); }
.gobang-room-versus i:last-child { transform: scaleX(-1); }

.gobang-room-board { max-width: 560px; margin: 0 auto; border: 1px solid rgba(31,40,38,.08); border-radius: 26px; background: rgba(255,255,255,.74); box-shadow: 0 18px 50px rgba(43, 61, 54, .11); }

.gobang-room-conversation { max-width: 560px; margin: 16px auto 0; overflow: hidden; border: 1px solid rgba(31,40,38,.08); border-radius: 22px; background: rgba(255,255,255,.72); box-shadow: 0 12px 34px rgba(43,61,54,.08); }
.gobang-room-conversation > header { display: flex; align-items: center; justify-content: space-between; padding: 13px 15px; border-bottom: 1px solid rgba(31,40,38,.07); }
.gobang-room-conversation > header span { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 820; }
.gobang-room-conversation > header small { color: #89938f; font-size: 8px; }
.gobang-room-transcript { display: grid; gap: 6px; max-height: 310px; min-height: 118px; overflow-y: auto; padding: 12px 10px; }
.gobang-room-empty { display: grid; place-content: center; justify-items: center; gap: 4px; min-height: 92px; color: #7d8a84; text-align: center; }
.gobang-room-empty span { font-size: 11px; font-weight: 760; }
.gobang-room-empty small { max-width: 260px; font-size: 9px; line-height: 1.5; }
.gobang-room-typing { display: flex; align-items: center; gap: 4px; padding: 8px 12px; color: #76837d; font-size: 9px; }
.gobang-room-typing i { width: 5px; height: 5px; border-radius: 50%; background: #5e9d84; animation: gobang-pulse 1s ease-in-out infinite; }
.gobang-room-typing i:nth-child(2) { animation-delay: .15s; }
.gobang-room-typing i:nth-child(3) { animation-delay: .3s; }
.gobang-room-typing span { margin-left: 4px; }

.gobang-room-composer { position: absolute; z-index: 6; right: 0; bottom: 0; left: 0; display: grid; grid-template-columns: 1fr auto 42px; gap: 8px; padding: 10px calc(13px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(13px + var(--safe-left)); border-top: 1px solid rgba(31,40,38,.09); background: rgba(247,249,246,.9); backdrop-filter: blur(24px) saturate(1.3); }
.gobang-room-composer input { min-width: 0; height: 42px; padding: 0 14px; border: 1px solid rgba(31,40,38,.1); border-radius: 15px; outline: 0; color: var(--ink); background: #fff; font-size: 13px; }
.gobang-room-composer input:focus { border-color: rgba(31,143,106,.42); box-shadow: 0 0 0 3px rgba(31,143,106,.08); }
.gobang-room-composer button { border: 0; font-weight: 800; }
.gobang-send-only { padding: 0 11px; border-radius: 13px; color: #4f615a; background: #e5ebe7; font-size: 10px; }
.gobang-reply-button { display: grid; width: 42px; height: 42px; place-items: center; border-radius: 14px; color: #fff; background: linear-gradient(145deg, #269b73, #167c5b); box-shadow: 0 8px 18px rgba(31,143,106,.23); }
.gobang-room-composer button:disabled { opacity: .42; }

.gobang-room-missing { display: grid; place-content: center; justify-items: center; gap: 12px; color: #66736d; text-align: center; }
.gobang-room-missing button { padding: 9px 16px; border: 0; border-radius: 12px; color: #fff; background: var(--jade); }

@keyframes gobang-pulse { 0%, 100% { opacity: .35; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-2px); } }

@media (min-width: 720px) {
  .gobang-room-main { padding-top: 22px; }
  .gobang-room-composer { right: max(0px, calc((100% - 680px) / 2)); left: max(0px, calc((100% - 680px) / 2)); border: 1px solid rgba(31,40,38,.08); border-bottom: 0; border-radius: 22px 22px 0 0; }
}

.gobang-room {
  position: relative;
  height: 100%;
  min-height: 0;
  padding-bottom: 0;
}

.gobang-room-main {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
  padding: calc(8px + var(--safe-top)) 12px calc(112px + var(--safe-bottom));
}

.gobang-room-hero {
  flex: 0 0 auto;
  gap: 12px;
  margin: 2px auto 14px;
}

.gobang-room-players {
  grid-template-columns: minmax(0, 1fr) 74px minmax(0, 1fr);
}

.gobang-room-players figure { gap: 7px; }

.gobang-room-players figure > img,
.gobang-character-avatar {
  width: 54px;
  height: 54px;
}

.gobang-character-avatar {
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  border-radius: 18px;
  background: transparent;
  line-height: 0;
}

.gobang-character-avatar img {
  width: 54px;
  height: 54px;
  border: 3px solid rgba(255,255,255,.9);
  border-radius: 18px;
  object-fit: cover;
  box-shadow: 0 9px 26px rgba(36,55,48,.16);
}

.gobang-character-avatar.has-unread-mind::before {
  position: absolute;
  z-index: 1;
  inset: -6px;
  border: 2px solid rgba(205,91,126,.82);
  border-radius: 21px;
  content: '';
  animation: gobang-mind-pulse 1.8s ease-out infinite;
  pointer-events: none;
}

.gobang-mind-dot {
  position: absolute;
  z-index: 2;
  top: -4px;
  right: -4px;
  width: 10px;
  height: 10px;
  border: 2px solid #f2f5f0;
  border-radius: 50%;
  background: #d5567c;
  box-shadow: 0 2px 6px rgba(150,51,84,.35);
}

.gobang-room-players figcaption strong { font-size: 12px; }
.gobang-room-players figcaption small { font-size: 9px; }
.gobang-room-versus { gap: 7px; font-size: 10px; }

.gobang-room-board {
  flex: 1 1 auto;
  width: 100%;
  max-width: 560px;
  min-height: 0;
  margin: 0 auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.gobang-room-board :deep(.gobang-panel) { gap: 8px; }
.gobang-room-board :deep(.gobang-board) { max-width: 100%; }

.gobang-conversation-scrim {
  position: absolute;
  z-index: 4;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  background: rgba(30,41,36,.08);
  backdrop-filter: blur(2px);
}

.gobang-room-conversation {
  position: absolute;
  z-index: 7;
  right: 10px;
  bottom: calc(70px + var(--safe-bottom));
  left: 10px;
  display: flex;
  flex-direction: column;
  width: auto;
  height: min(44vh, 348px);
  max-height: calc(var(--app-height) - var(--safe-top) - var(--safe-bottom) - 112px);
  min-height: 150px;
  margin: 0;
  overflow: hidden;
  border: 1px solid rgba(31,40,38,.1);
  border-radius: 22px;
  background: rgba(255,255,255,.94);
  box-shadow: 0 18px 46px rgba(43,61,54,.22);
  backdrop-filter: blur(22px) saturate(1.2);
}

.gobang-room-conversation > header {
  flex: 0 0 auto;
  padding: 10px 12px 9px 14px;
}

.gobang-room-conversation > header > div {
  display: grid;
  gap: 2px;
}

.gobang-room-conversation > header strong {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 850;
}

.gobang-room-conversation > header small { font-size: 8px; }

.gobang-room-conversation > header button {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 10px;
  color: #6c7872;
  background: #eef2ee;
}

.gobang-room-transcript {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  padding: 9px 10px 12px;
}

.gobang-conversation-trigger {
  position: absolute;
  z-index: 6;
  right: 50%;
  bottom: calc(72px + var(--safe-bottom));
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 132px;
  max-width: calc(100% - 28px);
  min-height: 32px;
  padding: 6px 8px 6px 11px;
  overflow: hidden;
  border: 1px solid rgba(31,40,38,.1);
  border-radius: 999px;
  color: #3d4c45;
  background: rgba(255,255,255,.91);
  box-shadow: 0 8px 22px rgba(43,61,54,.14);
  transform: translateX(50%);
  backdrop-filter: blur(18px);
}

.gobang-conversation-trigger span { flex: 0 0 auto; font-size: 10px; font-weight: 850; }
.gobang-conversation-trigger small { flex: 0 0 auto; color: #6f8178; font-size: 9px; }
.gobang-conversation-trigger em { min-width: 0; overflow: hidden; color: #8a9790; font-size: 8px; font-style: normal; text-overflow: ellipsis; white-space: nowrap; }
.gobang-conversation-trigger svg:last-child { flex: 0 0 auto; margin-left: auto; color: #75847c; }
.gobang-conversation-trigger.has-update { border-color: rgba(205,91,126,.35); animation: gobang-conversation-pulse 1.8s ease-in-out infinite; }

.gobang-room-composer {
  position: absolute;
  z-index: 8;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 8px 12px calc(8px + var(--safe-bottom));
}

.gobang-room-composer input { height: 40px; border-radius: 14px; }
.gobang-send-only { min-width: 42px; padding: 0 9px; }
.gobang-reply-button { width: 40px; height: 40px; border-radius: 13px; }

.gobang-conversation-scrim-enter-active,
.gobang-conversation-scrim-leave-active { transition: opacity .2s ease; }
.gobang-conversation-scrim-enter-from,
.gobang-conversation-scrim-leave-to { opacity: 0; }
.gobang-conversation-drawer-enter-active,
.gobang-conversation-drawer-leave-active { transition: opacity .22s ease, transform .22s ease; }
.gobang-conversation-drawer-enter-from,
.gobang-conversation-drawer-leave-to { opacity: 0; transform: translateY(18px); }

@keyframes gobang-mind-pulse {
  0% { opacity: .72; transform: scale(.94); }
  80%, 100% { opacity: 0; transform: scale(1.2); }
}

@keyframes gobang-conversation-pulse {
  0%, 100% { box-shadow: 0 8px 22px rgba(43,61,54,.14); }
  50% { box-shadow: 0 8px 24px rgba(205,91,126,.32); }
}

@media (max-height: 700px) and (max-width: 639px) {
  .gobang-room-main { padding-top: calc(5px + var(--safe-top)); }
  .gobang-room-hero { margin-bottom: 4px; }
  .gobang-room-players figure > img,
  .gobang-character-avatar { width: 43px; height: 43px; }
  .gobang-room-players figcaption strong { font-size: 10px; }
  .gobang-room-board :deep(.gobang-panel) { gap: 5px; }
  .gobang-room-board :deep(.gobang-turn-status) { min-height: 23px; }
  .gobang-room-board :deep(.gobang-turn-status h2) { font-size: 13px; }
  .gobang-room-board :deep(.gobang-actions > button) { min-height: 32px !important; }
}

@media (min-width: 720px) {
  .gobang-room-main { padding: 22px 18px calc(118px + var(--safe-bottom)); }
  .gobang-room-conversation { right: max(10px, calc((100% - 600px) / 2)); left: max(10px, calc((100% - 600px) / 2)); }
  .gobang-conversation-trigger { bottom: calc(78px + var(--safe-bottom)); }
  .gobang-room-composer { right: max(0px, calc((100% - 680px) / 2)); left: max(0px, calc((100% - 680px) / 2)); }
}
</style>