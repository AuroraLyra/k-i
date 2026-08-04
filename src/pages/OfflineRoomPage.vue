<template>
  <section v-if="conversation && character" class="screen no-tabs offline-room">
    <OfflineMemoryPanel v-if="showMemoryPanel" :conversation-id="props.id" :character="character" @back="closeMemoryPanel" />

    <template v-else>
    <header class="offline-topbar">
      <div class="offline-topbar-actions">
        <button class="offline-icon-button" type="button" aria-label="返回" @click="goBack">
          <ArrowLeft :size="21" />
        </button>
        <button class="offline-icon-button" type="button" aria-label="回到线上聊天" @click="exitOffline">
          <MessageCircle :size="20" />
        </button>
      </div>
      <div class="offline-title-block">
        <span class="offline-title-avatar">
          <img :src="character.avatar" :alt="characterDisplayName" />
          <i aria-hidden="true"></i>
        </span>
        <span class="offline-title-copy">
          <small>offline manuscript</small>
          <strong>{{ characterDisplayName }}</strong>
        </span>
      </div>
      <div class="offline-topbar-actions offline-topbar-actions--right">
        <button class="offline-icon-button" type="button" aria-label="角色记忆" @click="openMemoryPanel">
          <NotebookTabs :size="20" :stroke-width="1.9" />
        </button>
        <button class="offline-icon-button" type="button" aria-label="线下设置" @click="openOfflineSettings">
          <Settings2 :size="20" />
        </button>
      </div>
    </header>

    <main ref="offlineScrollRef" class="offline-scroll" @scroll.passive="handleOfflineScroll">
      <section class="chapter-stream" aria-label="线下章节记录">
        <header class="chapter-stream-head">
          <div>
            <span>dialogue</span>
            <strong>{{ chapterFloors.length ? `${chapterFloors.length} 个章节楼层` : '等待第一幕开始' }}</strong>
          </div>
          <span class="chapter-stream-status"><i aria-hidden="true"></i> chapter</span>
        </header>

        <button
          v-if="hasEarlierFloors"
          class="floor-history-loader"
          type="button"
          :disabled="loadingEarlierFloors || loadingLaterFloors"
          @click="loadEarlierFloors"
        >
          {{ loadingEarlierFloors ? '正在加载更早楼层' : `上滑加载更早楼层 · 还有 ${earlierFloorCount} 层` }}
        </button>

        <article
          v-for="floor in visibleChapterFloors"
          :key="floor.id"
          :data-floor-id="floor.id"
          :class="['chapter-entry', `chapter-entry--${floor.sender}`, { 'chapter-entry--hidden': floor.hidden, 'chapter-entry--delete-target': truncateDeleteMode, 'chapter-entry--editing': isEditingFloor(floor) }]"
          @click="handleFloorClick(floor)"
        >
          <div class="chapter-entry-meta">
            <span class="chapter-floor-label">
              <span class="chapter-speaker-mark">{{ floor.sender === 'user' ? 'Q.' : floor.sender === 'char' ? 'A.' : 'N.' }}</span>
              <i aria-hidden="true"></i>
              <b>{{ floor.floorNumber }}</b>
            </span>
            <div class="chapter-entry-tools">
              <em v-if="floor.hidden">已隐藏</em>
              <time>{{ formatChatTime(floor.createdAt) }}</time>
              <button type="button" aria-label="编辑该楼层" @click.stop="startEditFloor(floor)">
                <PencilLine :size="14" />
              </button>
            </div>
          </div>

          <div v-if="isEditingFloor(floor)" class="floor-edit-panel" @click.stop>
            <textarea v-model="floorEditDraft" rows="5" placeholder="编辑该楼层文字" />
            <div class="floor-edit-actions">
              <button type="button" @click="copyEditingFloor">复制</button>
              <button type="button" :disabled="!floorEditDraft.trim()" @click="confirmFloorEdit(floor)">确认</button>
              <button type="button" @click="cancelFloorEdit">取消</button>
              <button type="button" class="danger" @click="requestDeleteSingleFloor(floor)">删除</button>
            </div>
          </div>

          <template v-else>
            <div v-if="htmlContentForFloor(floor)" class="chapter-entry-body chapter-entry-html" v-html="htmlContentForFloor(floor)"></div>
            <p v-else class="chapter-entry-body">
              <template v-for="(segment, index) in contentSegmentsForFloor(floor)" :key="`${floor.id}-${index}`">
                <span :class="{ 'inner-voice-segment': segment.innerVoice, 'dialogue-segment': segment.dialogue }">{{ segment.text }}</span>
              </template>
            </p>

            <div v-if="replyOptionsForFloor(floor).length" class="reply-variant-switcher" @click.stop>
              <button type="button" aria-label="上一条回复" @click="moveReplyOption(floor, -1)">
                <ChevronLeft :size="15" />
              </button>
              <span>{{ replyOptionPositionLabel(floor) }}</span>
              <button type="button" aria-label="下一条回复" @click="moveReplyOption(floor, 1)">
                <ChevronRight :size="15" />
              </button>
            </div>

            <div v-if="plotChoicesForFloor(floor).length" class="plot-choice-panel" :class="{ expanded: plotChoicesExpanded(floor) }" @click.stop>
              <button class="plot-choice-toggle" type="button" @click="togglePlotChoices(floor)">
                <span>剧情走向</span>
                <strong>{{ plotChoicesForFloor(floor).length }} 条</strong>
                <ChevronDown :size="13" />
              </button>
              <div v-if="plotChoicesExpanded(floor)" class="plot-choice-list">
                <button
                  v-for="(choice, index) in plotChoicesForFloor(floor)"
                  :key="`${floor.id}-${index}`"
                  type="button"
                  :class="{ active: selectedPlotChoiceKey === `${floor.id}-${index}` }"
                  @click="applyPlotChoice(floor, choice, index)"
                >
                  {{ choice }}
                </button>
              </div>
            </div>
          </template>

          <span v-if="truncateDeleteMode" class="delete-floor-hint">点击后确认删除本楼以及以下楼层</span>
        </article>

        <button
          v-if="hasLaterFloors"
          class="floor-history-loader"
          type="button"
          :disabled="loadingEarlierFloors || loadingLaterFloors"
          @click="loadLaterFloors"
        >
          {{ loadingLaterFloors ? '正在加载后续楼层' : `下滑加载后续楼层 · 还有 ${laterFloorCount} 层` }}
        </button>

        <section v-if="currentConversationReplying && !hasLaterFloors" class="typing-card" aria-live="polite">
          <span class="typing-dots"><i></i><i></i><i></i></span>
          <strong>{{ characterDisplayName }} 正在回复中</strong>
        </section>

        <section v-if="!chapterFloors.length && !currentConversationReplying" class="offline-empty">
          <BookOpenText :size="32" />
          <strong>还没有章节</strong>
          <span>输入一句行动、对白或场景，开始这一幕。</span>
        </section>
      </section>
    </main>

    <footer class="offline-dock">
      <div v-show="showOfflineToolbar" id="offline-toolbar" class="offline-toolbar">
        <div class="offline-primary-tools">
          <button class="tool-button" type="button" :disabled="currentConversationReplying" @click="continueOfflineChapter">
            <span>继续这一幕</span>
          </button>
          <button class="tool-button" type="button" :disabled="!canRegenerate || currentConversationReplying" @click="openRegeneratePromptDialog">
            <span>重写回复</span>
          </button>
          <button class="tool-button tool-button--danger" type="button" :class="{ active: truncateDeleteMode }" :disabled="!chapterFloors.length" @click="toggleTruncateDeleteMode">
            <span>整理楼层</span>
          </button>
        </div>
        <div class="offline-floor-tools" aria-label="楼层导航">
          <button class="icon-tool-button" type="button" :disabled="!chapterFloors.length" aria-label="跳转首楼" @click="jumpToFirstFloor">
            <ChevronsUp :size="16" />
          </button>
          <button class="icon-tool-button" type="button" :disabled="!chapterFloors.length" aria-label="跳转上一楼" @click="jumpToPreviousFloor">
            <ChevronUp :size="17" />
          </button>
          <button class="icon-tool-button" type="button" :class="{ active: showJumpDialog }" :disabled="!chapterFloors.length" aria-label="选择楼层跳转" @click="openJumpDialog">
            <ListTree :size="17" />
          </button>
          <button class="icon-tool-button" type="button" :disabled="!chapterFloors.length" aria-label="跳转下一楼" @click="jumpToNextFloor">
            <ChevronDown :size="17" />
          </button>
          <button class="icon-tool-button" type="button" :disabled="!chapterFloors.length" aria-label="跳转底楼" @click="jumpToLastFloor">
            <ChevronsDown :size="16" />
          </button>
        </div>
      </div>

      <form class="offline-composer" @submit.prevent="send">
        <button
          class="offline-composer-mark"
          type="button"
          :class="{ active: showOfflineToolbar }"
          :aria-label="showOfflineToolbar ? '隐藏底部工具' : '显示底部工具'"
          :aria-expanded="showOfflineToolbar"
          aria-controls="offline-toolbar"
          @click="showOfflineToolbar = !showOfflineToolbar"
        >✦</button>
        <textarea
          ref="composerRef"
          v-model="draft"
          rows="1"
          :disabled="currentConversationReplying"
          placeholder="输入行动或对白"
          @pointerdown="captureKeyboardScrollAnchor"
          @touchstart.passive="captureKeyboardScrollAnchor"
          @focus="startKeyboardScrollGuard"
          @blur="stopKeyboardScrollGuard"
        />
        <button class="send-button" type="submit" :disabled="currentConversationReplying || !draft.trim()" aria-label="发送"></button>
      </form>
    </footer>

    <div v-if="showJumpDialog" class="floor-jump-backdrop" role="dialog" aria-modal="true" aria-label="选择楼层跳转" @click.self="closeJumpDialog">
      <form class="floor-jump-sheet" @submit.prevent="confirmFloorJump">
        <span>楼层跳转</span>
        <h2>前往指定楼层</h2>
        <p>输入 1 到 {{ chapterFloors.length }} 之间的楼层，确认后会跳到该楼层开头。</p>
        <label>
          <span>楼层</span>
          <input v-model="jumpFloorDraft" inputmode="numeric" pattern="[0-9]*" type="number" min="1" :max="chapterFloors.length" />
        </label>
        <div class="floor-jump-actions">
          <button type="button" @click="closeJumpDialog">取消</button>
          <button type="submit">跳转</button>
        </div>
      </form>
    </div>

    <div v-if="showRegeneratePromptDialog" class="regenerate-prompt-backdrop" role="dialog" aria-modal="true" aria-label="重回引导" @click.self="closeRegeneratePromptDialog">
      <form class="regenerate-prompt-sheet" @submit.prevent="confirmRegeneratePrompt">
        <span>重回引导</span>
        <h2>重新生成这一章</h2>
        <p>可以写剧情方向、禁止事项或语气要求；留空会按当前上下文直接重新生成。</p>
        <label>
          <span>可选引导</span>
          <textarea v-model="regeneratePromptDraft" maxlength="600" rows="5" placeholder="例如：往暧昧拉扯走；不要让角色立刻服软；禁止替用户做决定。"></textarea>
        </label>
        <div class="regenerate-prompt-actions">
          <button type="button" @click="closeRegeneratePromptDialog">取消</button>
          <button type="submit" :disabled="currentConversationReplying">重回</button>
        </div>
      </form>
    </div>

    <div v-if="pendingDelete" class="delete-confirm-backdrop" role="dialog" aria-modal="true" @click.self="cancelPendingDelete">
      <section class="delete-confirm-sheet">
        <span>删除确认</span>
        <h2>{{ pendingDelete.title }}</h2>
        <p>{{ pendingDelete.message }}</p>
        <div class="delete-confirm-actions">
          <button type="button" @click="cancelPendingDelete">取消</button>
          <button type="button" @click="confirmPendingDelete">确认删除</button>
        </div>
      </section>
    </div>

    </template>
  </section>
  <section v-else class="screen no-tabs empty-state">会话不存在</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, BookOpenText, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsDown, ChevronsUp, ListTree, MessageCircle, NotebookTabs, PencilLine, Settings2 } from 'lucide-vue-next';
import OfflineMemoryPanel from '@/components/chat/OfflineMemoryPanel.vue';
import { useAppStore } from '@/stores/appStore';
import type { ChatMessage } from '@/types/domain';
import { getCharacterDisplayName } from '@/utils/character';
import { useKeyboardScrollGuard } from '@/utils/keyboardScrollGuard';
import { getConversationFloors } from '@/utils/memory';
import { renderSafeMessageHtml } from '@/utils/messageHtml';
import { getUserAiName } from '@/utils/profile';
import { formatChatTime } from '@/utils/time';
import { isVoomNarrationMessage } from '@/utils/voomMessages';

const props = defineProps<{
  id: string;
}>();

const offlineDraftStoragePrefix = 'link.offline.draft.';
function offlineDraftKey(conversationId: string) { return `${offlineDraftStoragePrefix}${conversationId}`; }
function readOfflineDraft(conversationId: string) {
  try { return window.sessionStorage.getItem(offlineDraftKey(conversationId)) ?? ''; } catch { return ''; }
}
function writeOfflineDraft(conversationId: string, content: string) {
  try {
    const key = offlineDraftKey(conversationId);
    if (content) window.sessionStorage.setItem(key, content);
    else window.sessionStorage.removeItem(key);
  } catch { return; }
}

const floorPageSize = 24;
const maxRenderedFloorCount = floorPageSize * 3;
const floorLoadThreshold = 96;
const store = useAppStore();
const router = useRouter();
const route = useRoute();
const draft = ref(readOfflineDraft(props.id));
const showOfflineToolbar = ref(false);
const truncateDeleteMode = ref(false);
const showJumpDialog = ref(false);
const showRegeneratePromptDialog = ref(false);
const jumpFloorDraft = ref('1');
const regeneratePromptDraft = ref('');
const showMemoryPanel = ref(false);
const selectedReplyOptionIds = ref<Record<string, string>>({});
const selectedPlotChoiceKey = ref('');
const expandedPlotChoiceFloorIds = ref<Set<string>>(new Set());
const editingFloorId = ref('');
const floorEditDraft = ref('');
const offlineScrollRef = ref<HTMLElement | null>(null);
const composerRef = ref<HTMLTextAreaElement | null>(null);
const loadingEarlierFloors = ref(false);
const loadingLaterFloors = ref(false);
const conversation = computed(() => store.conversationById(props.id));
const isGroup = computed(() => conversation.value?.kind === 'group');
const character = computed(() => {
  if (!conversation.value) return undefined;
  if (conversation.value.kind !== 'group') return store.characterById(conversation.value.charId);
  return conversation.value.groupMembers?.flatMap((member) => member.identityType === 'character' && member.identityId ? [store.characterById(member.identityId)] : []).find(Boolean);
});
const conversationUser = computed(() => (conversation.value ? store.userById(conversation.value.userId) : undefined));
const characterDisplayName = computed(() => isGroup.value ? `${conversation.value?.title ?? '群聊'}（${conversation.value?.groupMembers?.filter((member) => (member.membershipStatus ?? 'active') === 'active').length ?? 0}）` : character.value ? getCharacterDisplayName(character.value) : '');
const characterTrueName = computed(() => character.value?.name.trim() || characterDisplayName.value || '角色');
const userTrueName = computed(() => getUserAiName(conversationUser.value));
const currentConversationReplying = computed(() => store.isConversationReplying(props.id));
const offlineAllMessages = computed(() => store.messagesForConversation(props.id).filter((message) => message.mode === 'offline' && !isVoomNarrationMessage(message)));
const hiddenMessageIds = computed(() => store.hiddenMessageIdsForConversation(props.id));
const chapterFloors = computed(() => getConversationFloors(offlineAllMessages.value).map((messages, index) => createChapterFloor(messages, index)));
const visibleFloorStartIndex = ref(Math.max(0, chapterFloors.value.length - floorPageSize));
const visibleFloorEndIndex = ref(chapterFloors.value.length);
const visibleChapterFloors = computed(() => chapterFloors.value.slice(visibleFloorStartIndex.value, visibleFloorEndIndex.value));
const earlierFloorCount = computed(() => visibleFloorStartIndex.value);
const laterFloorCount = computed(() => Math.max(0, chapterFloors.value.length - visibleFloorEndIndex.value));
const hasEarlierFloors = computed(() => earlierFloorCount.value > 0);
const hasLaterFloors = computed(() => laterFloorCount.value > 0);
const latestOfflineMessage = computed(() => offlineAllMessages.value.filter((message) => message.replyVariantState !== 'inactive').at(-1));
const canRegenerate = computed(() => latestOfflineMessage.value?.sender === 'char');
const bottomRestoreDelays = [40, 120, 260, 520];
const { captureKeyboardScrollAnchor, releaseKeyboardScrollGuard, startKeyboardScrollGuard, stopKeyboardScrollGuard } = useKeyboardScrollGuard(offlineScrollRef);

function syncOfflineTransientOperations() {
  const conversationKey = props.id;
  writeOfflineDraft(conversationKey, draft.value);
  store.setAppUpdateTransientOperation(`offline-draft:${conversationKey}`, '存在未发送的线下章节草稿', Boolean(draft.value.trim()));
  store.setAppUpdateTransientOperation(`offline-regenerate:${conversationKey}`, '存在未提交的线下重写指令', showRegeneratePromptDialog.value && Boolean(regeneratePromptDraft.value.trim()));
  store.setAppUpdateTransientOperation(`offline-floor-edit:${conversationKey}`, '存在未保存的线下楼层编辑', Boolean(floorEditDraft.value.trim()));
  store.setAppUpdateTransientOperation(`offline-jump:${conversationKey}`, '存在未提交的线下跳转输入', showJumpDialog.value && Boolean(jumpFloorDraft.value.trim()));
}

watch([
  draft,
  showRegeneratePromptDialog,
  regeneratePromptDraft,
  floorEditDraft,
  showJumpDialog,
  jumpFloorDraft
], syncOfflineTransientOperations, { immediate: true });

interface ChapterFloor {
  id: string;
  floorNumber: number;
  messages: ChatMessage[];
  sender: ChatMessage['sender'];
  createdAt: number;
  content: string;
  replyBatchId: string;
  replyVariantGroupId: string;
  hidden: boolean;
  authorNames: string[];
}

interface ReplyOption {
  id: string;
  batchId: string;
  messageId: string;
  messageIds: string[];
  label: string;
  content: string;
  plotChoices: string[];
  active: boolean;
}

interface ContentSegment {
  text: string;
  innerVoice: boolean;
  dialogue: boolean;
}

interface PendingDelete {
  type: 'single' | 'following';
  floorId: string;
  floorNumber: number;
  title: string;
  message: string;
}

interface FloorScrollAnchor {
  floorId: string;
  viewportTop: number;
}

const pendingDelete = ref<PendingDelete | null>(null);

function isMemoryPanelRoute() {
  return route.query.panel === 'memory';
}

function queryWithoutMemoryPanel() {
  const { panel, ...query } = route.query;
  return query;
}

function canReturnToOfflineRoom() {
  const backPath = window.history.state?.back;
  return typeof backPath === 'string' && backPath.startsWith(`/offline/${props.id}`) && !backPath.includes('/settings');
}

function openMemoryPanel() {
  truncateDeleteMode.value = false;
  cancelFloorEdit();
  if (isMemoryPanelRoute()) {
    showMemoryPanel.value = true;
    return;
  }
  void router.push({
    name: 'offline-room',
    params: { id: props.id },
    query: { ...route.query, panel: 'memory' }
  });
}

function closeMemoryPanel() {
  if (!showMemoryPanel.value) return;
  if (isMemoryPanelRoute() && canReturnToOfflineRoom()) {
    router.back();
    return;
  }
  showMemoryPanel.value = false;
  if (isMemoryPanelRoute()) {
    void router.replace({ name: 'offline-room', params: { id: props.id }, query: queryWithoutMemoryPanel() });
  }
}

function createChapterFloor(messages: ChatMessage[], index: number): ChapterFloor {
  const primary = messages[0];
  return {
    id: messages.map((message) => message.id).join('__'),
    floorNumber: index + 1,
    messages,
    sender: primary?.sender ?? 'system',
    createdAt: primary?.createdAt ?? Date.now(),
    content: floorContent(messages),
    replyBatchId: primary?.replyBatchId ?? '',
    replyVariantGroupId: primary?.replyVariantGroupId ?? '',
    hidden: messages.some((message) => hiddenMessageIds.value.has(message.id)),
    authorNames: [...new Set(messages.map((message) => message.authorName?.trim()).filter((name): name is string => Boolean(name)))]
  };
}

function floorContent(messages: ChatMessage[]) {
  return messages.map((message) => message.content.trim()).filter(Boolean).join('\n\n');
}

function replyOptionKey(floor: ChapterFloor) {
  if (floor.replyVariantGroupId) return `variant:${floor.replyVariantGroupId}`;
  if (floor.replyBatchId) return `batch:${floor.replyBatchId}`;
  return '';
}

function replyOptionsForFloor(floor: ChapterFloor): ReplyOption[] {
  if (floor.sender !== 'char') return [];
  if (floor.replyVariantGroupId) {
    const grouped = new Map<string, ChatMessage[]>();
    offlineAllMessages.value
      .filter((message) => message.replyVariantGroupId === floor.replyVariantGroupId && Boolean(message.replyBatchId))
      .forEach((message) => {
        const batchId = message.replyBatchId ?? '';
        grouped.set(batchId, [...(grouped.get(batchId) ?? []), message]);
      });
    return [...grouped.entries()]
      .map(([batchId, messages], index) => ({
        id: batchId,
        batchId,
        messageId: messages[0]?.id ?? batchId,
        messageIds: messages.map((message) => message.id),
        label: `回复 ${index + 1}`,
        content: floorContent(messages),
        plotChoices: uniquePlotChoices(messages),
        active: messages.some((message) => message.replyVariantState !== 'inactive')
      }))
      .sort((first, second) => {
        const firstMessage = grouped.get(first.batchId)?.[0];
        const secondMessage = grouped.get(second.batchId)?.[0];
        return (firstMessage?.replyVariantIndex ?? 0) - (secondMessage?.replyVariantIndex ?? 0)
          || (firstMessage?.createdAt ?? 0) - (secondMessage?.createdAt ?? 0);
      });
  }
  if (!floor.replyBatchId) return [];
  const batchMessages = offlineAllMessages.value.filter((message) => message.replyBatchId === floor.replyBatchId && message.sender === 'char');
  if (batchMessages.length <= 1) return [];
  return batchMessages.map((message, index) => ({
    id: message.id,
    batchId: floor.replyBatchId,
    messageId: message.id,
    messageIds: [message.id],
    label: `回复 ${index + 1}`,
    content: message.content,
    plotChoices: uniquePlotChoices([message]),
    active: floor.messages.some((floorMessage) => floorMessage.id === message.id)
  }));
}

function uniquePlotChoices(messages: ChatMessage[]) {
  return [...new Set(messages.flatMap((message) => message.plotChoices ?? []).map((choice) => choice.trim()).filter(Boolean))].slice(0, 6);
}

function plotChoicesForFloor(floor: ChapterFloor) {
  return selectedReplyOption(floor)?.plotChoices ?? uniquePlotChoices(floor.messages);
}

function plotChoicesExpanded(floor: ChapterFloor) {
  return expandedPlotChoiceFloorIds.value.has(floor.id);
}

function togglePlotChoices(floor: ChapterFloor) {
  const nextIds = new Set(expandedPlotChoiceFloorIds.value);
  if (nextIds.has(floor.id)) {
    nextIds.delete(floor.id);
  } else {
    nextIds.add(floor.id);
  }
  expandedPlotChoiceFloorIds.value = nextIds;
}

function selectedReplyOption(floor: ChapterFloor) {
  const options = replyOptionsForFloor(floor);
  if (!options.length) return null;
  const key = replyOptionKey(floor);
  return options.find((option) => option.id === selectedReplyOptionIds.value[key]) ?? options.find((option) => option.active) ?? options[0];
}

function selectReplyOption(floor: ChapterFloor, optionId: string) {
  const key = replyOptionKey(floor);
  if (!key) return;
  selectedReplyOptionIds.value = { ...selectedReplyOptionIds.value, [key]: optionId };
}

function selectedReplyOptionIndex(floor: ChapterFloor) {
  const options = replyOptionsForFloor(floor);
  const selected = selectedReplyOption(floor);
  if (!options.length || !selected) return 0;
  return Math.max(0, options.findIndex((option) => option.id === selected.id));
}

function replyOptionPositionLabel(floor: ChapterFloor) {
  const options = replyOptionsForFloor(floor);
  if (!options.length) return '';
  return `${selectedReplyOptionIndex(floor) + 1} / ${options.length}`;
}

async function moveReplyOption(floor: ChapterFloor, direction: -1 | 1) {
  const options = replyOptionsForFloor(floor);
  if (options.length <= 1) return;
  const nextIndex = (selectedReplyOptionIndex(floor) + direction + options.length) % options.length;
  selectReplyOption(floor, options[nextIndex].id);
  await applySelectedReplyOption(floor);
}

function hasPendingReplyOption(floor: ChapterFloor) {
  const option = selectedReplyOption(floor);
  return Boolean(option && !option.active);
}

function displayContentForFloor(floor: ChapterFloor) {
  return selectedReplyOption(floor)?.content || floor.content;
}

function floorSenderName(floor: ChapterFloor) {
  if (isGroup.value && floor.authorNames.length) return floor.authorNames.join('、');
  if (floor.sender === 'user') return userTrueName.value;
  if (floor.sender === 'char') return characterTrueName.value;
  return '事件';
}

function displayInnerVoiceText(content: string) {
  return content.replace(/^\s*心理描写[：:]\s*/, '');
}

function parseStyledContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const pattern = /(\*([^*]+)\*|“[^”]+”)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(content))) {
    if (match.index > cursor) {
      segments.push({ text: content.slice(cursor, match.index), innerVoice: false, dialogue: false });
    }
    const isInnerVoice = match[0].startsWith('*');
    segments.push({
      text: isInnerVoice ? displayInnerVoiceText(match[2]) : match[0],
      innerVoice: isInnerVoice,
      dialogue: !isInnerVoice
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), innerVoice: false, dialogue: false });
  }

  return segments.length ? segments : [{ text: content, innerVoice: false, dialogue: false }];
}

function contentSegmentsForFloor(floor: ChapterFloor) {
  return parseStyledContentSegments(displayContentForFloor(floor));
}

function htmlContentForFloor(floor: ChapterFloor) {
  return renderSafeMessageHtml(displayContentForFloor(floor));
}

function isEditingFloor(floor: ChapterFloor) {
  return editingFloorId.value === floor.id;
}

function editableMessageIdsForFloor(floor: ChapterFloor) {
  const selectedOption = selectedReplyOption(floor);
  if (selectedOption?.messageIds.length) return selectedOption.messageIds;
  return floor.messages.map((message) => message.id);
}

function startEditFloor(floor: ChapterFloor) {
  editingFloorId.value = floor.id;
  floorEditDraft.value = displayContentForFloor(floor);
  truncateDeleteMode.value = false;
  showJumpDialog.value = false;
  showMemoryPanel.value = false;
}

function cancelFloorEdit() {
  editingFloorId.value = '';
  floorEditDraft.value = '';
}

async function copyEditingFloor() {
  const content = floorEditDraft.value.trim();
  if (!content) return;
  try {
    await navigator.clipboard.writeText(content);
    store.showConfigAlert('已复制该楼层文字。', '已复制');
  } catch {
    store.showConfigAlert('当前浏览器不允许写入剪贴板。', '复制失败');
  }
}

async function confirmFloorEdit(floor: ChapterFloor) {
  const content = floorEditDraft.value.trim();
  if (!content) return;
  const selectedOption = selectedReplyOption(floor);
  if (selectedOption && !selectedOption.active && floor.replyVariantGroupId) {
    await store.applyReplyVariant(props.id, floor.replyVariantGroupId, selectedOption.batchId);
  }
  const [primaryMessageId, ...extraMessageIds] = editableMessageIdsForFloor(floor);
  if (!primaryMessageId) return;
  await store.updateMessageContent(primaryMessageId, content);
  if (extraMessageIds.length) await store.deleteMessages(extraMessageIds);
  cancelFloorEdit();
}

function applyPlotChoice(floor: ChapterFloor, choice: string, index: number) {
  draft.value = choice;
  selectedPlotChoiceKey.value = `${floor.id}-${index}`;
  void nextTick(() => composerRef.value?.focus());
}

async function syncConversationState(id: string) {
  await store.markConversationRead(id);
  const currentConversation = store.conversationById(id);
  if (currentConversation?.activeMode !== 'offline') {
    await store.updateConversationMode(id, 'offline');
  }
}

function setFloorWindow(startIndex: number, endIndex: number) {
  const floorCount = chapterFloors.value.length;
  if (!floorCount) {
    visibleFloorStartIndex.value = 0;
    visibleFloorEndIndex.value = 0;
    return;
  }
  const safeStartIndex = Math.min(Math.max(0, Math.floor(startIndex)), floorCount - 1);
  const safeEndIndex = Math.min(floorCount, Math.max(safeStartIndex + 1, Math.floor(endIndex)));
  visibleFloorStartIndex.value = safeStartIndex;
  visibleFloorEndIndex.value = safeEndIndex;
}

function resetFloorWindowToLatest() {
  const floorCount = chapterFloors.value.length;
  setFloorWindow(Math.max(0, floorCount - floorPageSize), floorCount);
  loadingEarlierFloors.value = false;
  loadingLaterFloors.value = false;
}

function setFloorWindowAround(targetIndex: number) {
  const floorCount = chapterFloors.value.length;
  if (!floorCount) return;
  const safeTargetIndex = Math.min(Math.max(0, targetIndex), floorCount - 1);
  const leadingFloorCount = Math.floor(floorPageSize / 3);
  let startIndex = Math.max(0, safeTargetIndex - leadingFloorCount);
  let endIndex = Math.min(floorCount, startIndex + floorPageSize);
  startIndex = Math.max(0, endIndex - floorPageSize);
  setFloorWindow(startIndex, endIndex);
}

function syncFloorWindowAfterChange(floors: ChapterFloor[], previousFloors: ChapterFloor[]) {
  if (!floors.length) {
    setFloorWindow(0, 0);
    return;
  }
  if (!previousFloors.length) {
    resetFloorWindowToLatest();
    return;
  }

  const previousStartIndex = Math.min(visibleFloorStartIndex.value, Math.max(0, previousFloors.length - 1));
  const previousEndIndex = Math.min(Math.max(previousStartIndex + 1, visibleFloorEndIndex.value), previousFloors.length);
  if (previousEndIndex >= previousFloors.length) {
    const addedFloorCount = Math.max(0, floors.length - previousFloors.length);
    const previousWindowSize = Math.max(floorPageSize, previousEndIndex - previousStartIndex);
    const nextWindowSize = Math.min(maxRenderedFloorCount, previousWindowSize + addedFloorCount);
    setFloorWindow(Math.max(0, floors.length - nextWindowSize), floors.length);
    return;
  }

  const firstVisibleFloorId = previousFloors[previousStartIndex]?.id;
  const lastVisibleFloorId = previousFloors[previousEndIndex - 1]?.id;
  const nextStartIndex = floors.findIndex((floor) => floor.id === firstVisibleFloorId);
  const nextLastIndex = floors.findIndex((floor) => floor.id === lastVisibleFloorId);
  if (nextStartIndex >= 0 && nextLastIndex >= nextStartIndex) {
    setFloorWindow(nextStartIndex, Math.min(nextLastIndex + 1, nextStartIndex + maxRenderedFloorCount));
    return;
  }
  setFloorWindowAround(Math.min(previousStartIndex, floors.length - 1));
}

function renderedFloorElement(floorId: string) {
  const scrollElement = offlineScrollRef.value;
  if (!scrollElement) return null;
  return [...scrollElement.querySelectorAll<HTMLElement>('[data-floor-id]')]
    .find((element) => element.dataset.floorId === floorId) ?? null;
}

function captureFloorScrollAnchor(edge: 'first' | 'last'): FloorScrollAnchor | null {
  const floor = edge === 'first' ? visibleChapterFloors.value[0] : visibleChapterFloors.value.at(-1);
  if (!floor) return null;
  const element = renderedFloorElement(floor.id);
  if (!element) return null;
  return { floorId: floor.id, viewportTop: element.getBoundingClientRect().top };
}

function restoreFloorScrollAnchor(anchor: FloorScrollAnchor | null) {
  if (!anchor) return;
  const scrollElement = offlineScrollRef.value;
  const element = renderedFloorElement(anchor.floorId);
  if (!scrollElement || !element) return;
  scrollElement.scrollTop += element.getBoundingClientRect().top - anchor.viewportTop;
}

async function loadEarlierFloors() {
  if (!hasEarlierFloors.value || loadingEarlierFloors.value || loadingLaterFloors.value) return;
  loadingEarlierFloors.value = true;
  const anchor = captureFloorScrollAnchor('first');
  const nextStartIndex = Math.max(0, visibleFloorStartIndex.value - floorPageSize);
  const nextEndIndex = Math.min(visibleFloorEndIndex.value, nextStartIndex + maxRenderedFloorCount);
  setFloorWindow(nextStartIndex, nextEndIndex);
  await nextTick();
  restoreFloorScrollAnchor(anchor);
  loadingEarlierFloors.value = false;
}

async function loadLaterFloors() {
  if (!hasLaterFloors.value || loadingLaterFloors.value || loadingEarlierFloors.value) return;
  loadingLaterFloors.value = true;
  const anchor = captureFloorScrollAnchor('last');
  const nextEndIndex = Math.min(chapterFloors.value.length, visibleFloorEndIndex.value + floorPageSize);
  const nextStartIndex = Math.max(visibleFloorStartIndex.value, nextEndIndex - maxRenderedFloorCount);
  setFloorWindow(nextStartIndex, nextEndIndex);
  await nextTick();
  restoreFloorScrollAnchor(anchor);
  loadingLaterFloors.value = false;
}

function handleOfflineScroll() {
  const scrollElement = offlineScrollRef.value;
  if (!scrollElement || loadingEarlierFloors.value || loadingLaterFloors.value) return;
  if (hasEarlierFloors.value && scrollElement.scrollTop <= floorLoadThreshold) {
    void loadEarlierFloors();
    return;
  }
  const bottomOffset = scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;
  if (hasLaterFloors.value && bottomOffset <= floorLoadThreshold) void loadLaterFloors();
}

function scrollOfflineToBottomNow() {
  const scrollElement = offlineScrollRef.value;
  if (!scrollElement) return;
  scrollElement.scrollTop = scrollElement.scrollHeight;
}

function restoreOfflineBottomAfterLayout() {
  scrollOfflineToBottomNow();
  window.requestAnimationFrame(scrollOfflineToBottomNow);
  for (const delay of bottomRestoreDelays) window.setTimeout(scrollOfflineToBottomNow, delay);
}

async function scrollOfflineToBottom() {
  await nextTick();
  restoreOfflineBottomAfterLayout();
}

function messageIdsForFloor(floor: ChapterFloor) {
  const ids = new Set(floor.messages.map((message) => message.id));
  floor.messages.forEach((message) => {
    if (!message.replyVariantGroupId) return;
    offlineAllMessages.value
      .filter((candidate) => candidate.replyVariantGroupId === message.replyVariantGroupId)
      .forEach((candidate) => ids.add(candidate.id));
  });
  return [...ids];
}

function requestDeleteSingleFloor(floor: ChapterFloor) {
  pendingDelete.value = {
    type: 'single',
    floorId: floor.id,
    floorNumber: floor.floorNumber,
    title: `删除 ${floor.floorNumber}F？`,
    message: `将删除这一楼 ${floorSenderName(floor)} 的内容，删除后不可恢复。`
  };
}

function requestDeleteFloorAndFollowing(floor: ChapterFloor) {
  pendingDelete.value = {
    type: 'following',
    floorId: floor.id,
    floorNumber: floor.floorNumber,
    title: `删除 ${floor.floorNumber}F 及以下？`,
    message: `将从 ${floor.floorNumber}F 开始删除本楼以及以下楼层，删除后不可恢复。`
  };
}

function cancelPendingDelete() {
  pendingDelete.value = null;
}

async function performSingleFloorDelete(floor: ChapterFloor) {
  await store.deleteMessages(messageIdsForFloor(floor));
}

async function performFloorAndFollowingDelete(floor: ChapterFloor) {
  const startIndex = chapterFloors.value.findIndex((entry) => entry.id === floor.id);
  if (startIndex < 0) return;
  const ids = chapterFloors.value.slice(startIndex).flatMap((entry) => messageIdsForFloor(entry));
  await store.deleteMessages([...new Set(ids)]);
  truncateDeleteMode.value = false;
}

async function confirmPendingDelete() {
  const target = pendingDelete.value;
  if (!target) return;
  const floor = chapterFloors.value.find((entry) => entry.id === target.floorId);
  pendingDelete.value = null;
  if (editingFloorId.value === target.floorId) cancelFloorEdit();
  if (!floor) return;
  if (target.type === 'single') {
    await performSingleFloorDelete(floor);
    return;
  }
  await performFloorAndFollowingDelete(floor);
}

function handleFloorClick(floor: ChapterFloor) {
  if (!truncateDeleteMode.value) return;
  requestDeleteFloorAndFollowing(floor);
}

function toggleTruncateDeleteMode() {
  truncateDeleteMode.value = !truncateDeleteMode.value;
  showJumpDialog.value = false;
  cancelFloorEdit();
}

function floorScrollTop(floor: ChapterFloor) {
  const scrollElement = offlineScrollRef.value;
  const target = renderedFloorElement(floor.id);
  if (!scrollElement || !target) return null;
  const scrollRect = scrollElement.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return scrollElement.scrollTop + targetRect.top - scrollRect.top;
}

async function ensureFloorRendered(floor: ChapterFloor) {
  const floorIndex = chapterFloors.value.findIndex((entry) => entry.id === floor.id);
  if (floorIndex < 0) return false;
  if (floorIndex < visibleFloorStartIndex.value || floorIndex >= visibleFloorEndIndex.value) {
    setFloorWindowAround(floorIndex);
    await nextTick();
  }
  return Boolean(renderedFloorElement(floor.id));
}

async function jumpToFloorStart(floor: ChapterFloor | undefined, behavior: ScrollBehavior = 'auto') {
  if (!floor || !await ensureFloorRendered(floor)) return false;
  const scrollElement = offlineScrollRef.value;
  const top = floorScrollTop(floor);
  if (!scrollElement || top === null) return false;
  scrollElement.scrollTo({ top, behavior });
  return true;
}

function currentFloorIndex() {
  const scrollElement = offlineScrollRef.value;
  if (!scrollElement || !chapterFloors.value.length) return 0;
  const currentTop = scrollElement.scrollTop + 2;
  let activeIndex = visibleFloorStartIndex.value;
  visibleChapterFloors.value.forEach((floor, index) => {
    const top = floorScrollTop(floor);
    if (top !== null && top <= currentTop) activeIndex = visibleFloorStartIndex.value + index;
  });
  return activeIndex;
}

function jumpToFirstFloor() {
  void jumpToFloorStart(chapterFloors.value[0]);
}

function jumpToPreviousFloor() {
  void jumpToFloorStart(chapterFloors.value[Math.max(0, currentFloorIndex() - 1)]);
}

function jumpToNextFloor() {
  void jumpToFloorStart(chapterFloors.value[Math.min(chapterFloors.value.length - 1, currentFloorIndex() + 1)]);
}

function jumpToLastFloor() {
  void jumpToFloorStart(chapterFloors.value.at(-1));
}

function openJumpDialog() {
  if (!chapterFloors.value.length) return;
  jumpFloorDraft.value = String(chapterFloors.value[currentFloorIndex()]?.floorNumber ?? 1);
  truncateDeleteMode.value = false;
  showRegeneratePromptDialog.value = false;
  showJumpDialog.value = true;
  cancelFloorEdit();
}

function closeJumpDialog() {
  showJumpDialog.value = false;
}

function openRegeneratePromptDialog() {
  if (!canRegenerate.value || currentConversationReplying.value) return;
  regeneratePromptDraft.value = '';
  truncateDeleteMode.value = false;
  showJumpDialog.value = false;
  cancelFloorEdit();
  showRegeneratePromptDialog.value = true;
}

function closeRegeneratePromptDialog() {
  showRegeneratePromptDialog.value = false;
}

function regeneratePromptInstruction() {
  const instruction = regeneratePromptDraft.value.trim();
  if (!instruction) return undefined;
  return `本次是用户点击“重回”要求重新生成上一段线下章节。请优先遵守以下额外引导，同时继续遵守角色设定、线下规则和禁止替用户做关键决定的边界：${instruction}`;
}

async function confirmFloorJump() {
  const floorNumber = Math.min(Math.max(1, Math.floor(Number(jumpFloorDraft.value) || 1)), chapterFloors.value.length);
  closeJumpDialog();
  await jumpToFloorStart(chapterFloors.value[floorNumber - 1]);
}

function focusedMessageId() {
  const value = route.query.focus;
  if (Array.isArray(value)) return value[0] ?? '';
  return typeof value === 'string' ? value : '';
}

async function scrollToFocusedFloor(messageId: string) {
  const floor = chapterFloors.value.find((entry) => entry.id === messageId || entry.messages.some((message) => message.id === messageId));
  if (!floor) return false;
  if (!await jumpToFloorStart(floor)) return false;
  const target = renderedFloorElement(floor.id);
  if (!target) return false;
  target.classList.add('chapter-entry--focus');
  window.setTimeout(() => target.classList.remove('chapter-entry--focus'), 1400);
  return true;
}

async function applySelectedReplyOption(floor: ChapterFloor) {
  const option = selectedReplyOption(floor);
  if (!option || option.active) return;
  if (floor.replyVariantGroupId) {
    await store.applyReplyVariant(props.id, floor.replyVariantGroupId, option.batchId);
    return;
  }
  const siblingIds = offlineAllMessages.value
    .filter((message) => message.replyBatchId === option.batchId && message.sender === 'char' && message.id !== option.messageId)
    .map((message) => message.id);
  if (siblingIds.length) await store.deleteMessages(siblingIds);
}

onMounted(async () => {
  await store.hydrate();
  await store.ensureConversationMessagesLoaded(props.id);
  await syncConversationState(props.id);
  resetFloorWindowToLatest();
  const focusId = focusedMessageId();
  if (focusId) {
    await scrollToFocusedFloor(focusId);
  } else {
    await scrollOfflineToBottom();
  }
});

watch(() => props.id, (id, previousId) => {
  if (previousId) store.setAppUpdateTransientOperation(`offline-draft:${previousId}`, '', false);
  if (previousId) store.setAppUpdateTransientOperation(`offline-regenerate:${previousId}`, '', false);
  if (previousId) store.setAppUpdateTransientOperation(`offline-floor-edit:${previousId}`, '', false);
  if (previousId) store.setAppUpdateTransientOperation(`offline-jump:${previousId}`, '', false);
  draft.value = readOfflineDraft(id);
  selectedPlotChoiceKey.value = '';
  expandedPlotChoiceFloorIds.value = new Set();
  truncateDeleteMode.value = false;
  showJumpDialog.value = false;
  jumpFloorDraft.value = '1';
  showRegeneratePromptDialog.value = false;
  regeneratePromptDraft.value = '';
  selectedReplyOptionIds.value = {};
  cancelFloorEdit();
  pendingDelete.value = null;
  void (async () => {
    await store.ensureConversationMessagesLoaded(id);
    await syncConversationState(id);
    resetFloorWindowToLatest();
    const focusId = focusedMessageId();
    if (focusId) {
      await scrollToFocusedFloor(focusId);
    } else {
      await scrollOfflineToBottom();
    }
  })();
});

onBeforeUnmount(() => {
  writeOfflineDraft(props.id, draft.value);
  store.setAppUpdateTransientOperation(`offline-draft:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`offline-regenerate:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`offline-floor-edit:${props.id}`, '', false);
  store.setAppUpdateTransientOperation(`offline-jump:${props.id}`, '', false);
  void store.flushConversationMemory(props.id);
});

watch(() => route.query.focus, (value) => {
  const focusId = Array.isArray(value) ? value[0] ?? '' : typeof value === 'string' ? value : '';
  if (focusId) void scrollToFocusedFloor(focusId);
}, { flush: 'post' });

watch(() => route.query.panel, () => {
  showMemoryPanel.value = isMemoryPanelRoute();
}, { immediate: true });

watch(chapterFloors, (floors, previousFloors) => {
  syncFloorWindowAfterChange(floors, previousFloors);
  if (currentConversationReplying.value) jumpToLastFloor();
});

function latestCharacterFloor() {
  return [...chapterFloors.value].reverse().find((floor) => floor.sender === 'char');
}

async function jumpToLatestCharacterFloor(previousFloorId = '') {
  await nextTick();
  const latestFloor = latestCharacterFloor();
  if (!latestFloor || latestFloor.id === previousFloorId) return;
  await jumpToFloorStart(latestFloor);
}

async function send() {
  const content = draft.value.trim();
  if (!content) return;
  const previousCharacterFloorId = latestCharacterFloor()?.id ?? '';
  releaseKeyboardScrollGuard();
  draft.value = '';
  if (isGroup.value) {
    await store.appendGroupUserMessage(props.id, content);
    await store.requestGroupReply(props.id, { instruction: '用户在线下群聊场景中输入了新的行动、对白或场景。请承接已有线下章节，由在场且自然会行动或回应的群成员推进共同剧情。', allowPrivateInitiation: false });
  } else {
    await store.sendMessage(props.id, content);
  }
  await jumpToLatestCharacterFloor(previousCharacterFloorId);
}

async function continueOfflineChapter() {
  if (currentConversationReplying.value) return;
  const previousCharacterFloorId = latestCharacterFloor()?.id ?? '';
  releaseKeyboardScrollGuard();
  draft.value = '';
  truncateDeleteMode.value = false;
  showJumpDialog.value = false;
  cancelFloorEdit();
  if (isGroup.value) {
    await store.requestGroupReply(props.id, { instruction: '用户点击了群聊线下页面的“继续”按钮，没有输入新的行动或对白。请直接承接最近线下章节、共同记忆和当前氛围，由合适的群成员续写下一章节正文；不要替用户发言或添加用户未表达的新决定。', allowPrivateInitiation: false });
  } else {
    await store.requestRoleplayReply(props.id, {
      replyInstruction: '用户点击了线下页面的“继续”按钮，没有输入新的行动或对白。请直接承接最近线下章节、记忆和当前氛围，续写下一章节正文；不要替用户发言或添加用户未表达的新决定。'
    });
  }
  await jumpToLatestCharacterFloor(previousCharacterFloorId);
}

async function regenerateLatestReply(replyInstruction?: string) {
  if (!canRegenerate.value) return;
  const previousCharacterFloorId = latestCharacterFloor()?.id ?? '';
  if (isGroup.value) await store.regenerateLatestGroupReply(props.id, replyInstruction);
  else await store.regenerateLatestReply(props.id, { replyInstruction });
  await jumpToLatestCharacterFloor(previousCharacterFloorId);
}

async function confirmRegeneratePrompt() {
  if (currentConversationReplying.value) return;
  const replyInstruction = regeneratePromptInstruction();
  closeRegeneratePromptDialog();
  await regenerateLatestReply(replyInstruction);
}

function openOfflineSettings() {
  void router.push({ name: 'offline-chat-settings', params: { id: props.id } });
}

function goBack() {
  router.back();
}

async function exitOffline() {
  await store.updateConversationMode(props.id, 'online');
  await router.replace({ name: isGroup.value ? 'group-chat' : 'chat-room', params: { id: props.id } });
}
</script>

<style scoped>
.offline-room {
  --offline-ink: #252226;
  --offline-muted: #8f858c;
  --offline-line: rgba(46, 37, 43, 0.09);
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-bottom: 0;
  color: var(--offline-ink);
  background:
    linear-gradient(135deg, rgba(255, 229, 237, 0.74) 0%, rgba(247, 242, 255, 0.58) 38%, rgba(237, 250, 244, 0.74) 100%),
    #fbf8fa;
}

.offline-topbar {
  position: relative;
  z-index: 10;
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) 84px;
  align-items: center;
  gap: 8px;
  padding: calc(10px + var(--safe-top)) calc(14px + var(--safe-right)) 10px calc(14px + var(--safe-left));
  border-bottom: 1px solid rgba(255, 255, 255, 0.56);
  background: rgba(255, 255, 255, 0.62);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
}

.offline-topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.offline-topbar-actions--right {
  justify-content: flex-end;
}

.offline-icon-button {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: #2d282d;
  box-shadow: 0 10px 24px rgba(77, 58, 71, 0.08);
}

.offline-icon-button:active {
  transform: translateY(1px);
}

.offline-title-block {
  display: grid;
  justify-items: center;
  min-width: 0;
  gap: 2px;
}

.offline-title-block span {
  color: #b28b99;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}

.offline-title-block strong {
  max-width: 100%;
  overflow: hidden;
  color: #211d21;
  font-size: 16px;
  font-weight: 900;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offline-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 14px calc(14px + var(--safe-right)) calc(18px + var(--keyboard-inset)) calc(14px + var(--safe-left));
  -webkit-overflow-scrolling: touch;
  overflow-anchor: none;
  scroll-padding-bottom: calc(112px + var(--keyboard-inset));
}

.chapter-stream {
  display: grid;
  gap: 12px;
  max-width: 720px;
  margin: 0 auto;
}

.floor-history-loader {
  justify-self: center;
  min-height: 32px;
  padding: 6px 12px;
  border: 1px solid rgba(182, 154, 166, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: #8f7883;
  font-size: 11px;
  font-weight: 850;
  line-height: 1.2;
  box-shadow: 0 8px 20px rgba(96, 74, 88, 0.06);
}

.floor-history-loader:disabled {
  opacity: 0.55;
}

.chapter-entry {
  display: grid;
  gap: 9px;
  padding: 15px;
  border: 1px solid var(--offline-line);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow: 0 14px 34px rgba(96, 74, 88, 0.08);
}

.chapter-entry--focus {
  animation: chapter-focus-pulse 1.2s ease-out;
}

@keyframes chapter-focus-pulse {
  0%, 100% {
    box-shadow: 0 14px 34px rgba(96, 74, 88, 0.08);
  }
  35% {
    box-shadow: 0 0 0 4px rgba(139, 82, 104, 0.18), 0 14px 34px rgba(96, 74, 88, 0.08);
  }
}

.chapter-entry--delete-target {
  cursor: pointer;
  outline: 1px dashed rgba(166, 77, 91, 0.44);
  outline-offset: -5px;
}

.chapter-entry--user {
  background: rgba(255, 250, 252, 0.82);
}

.chapter-entry--char {
  background: rgba(255, 255, 255, 0.78);
}

.chapter-entry--hidden {
  border-style: dashed;
  border-color: rgba(143, 133, 140, 0.24);
  background: rgba(245, 241, 244, 0.56);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.68), 0 10px 24px rgba(96, 74, 88, 0.05);
}

.chapter-entry--hidden p {
  color: #716870;
}

.chapter-entry--editing {
  border-color: rgba(38, 33, 38, 0.18);
  background: rgba(255, 255, 255, 0.86);
}

.chapter-entry-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: #a59aa1;
  font-size: 10px;
  font-weight: 900;
  line-height: 1.1;
  text-transform: none;
}

.chapter-entry-meta > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chapter-entry-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.chapter-entry-tools button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: #6d6269;
}

.chapter-entry-tools em {
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(143, 133, 140, 0.12);
  color: #8d8188;
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

.floor-edit-panel {
  display: grid;
  gap: 7px;
}

.floor-edit-panel textarea {
  min-height: 128px;
  resize: vertical;
  padding: 10px 11px;
  border: 1px solid rgba(182, 154, 166, 0.2);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  color: #282328;
  font-size: 12px;
  font-weight: 750;
  line-height: 1.65;
}

.floor-edit-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.floor-edit-actions button {
  min-height: 30px;
  padding: 0 6px;
  border: 1px solid rgba(182, 154, 166, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #695d65;
  font-size: 11px;
  font-weight: 900;
}

.floor-edit-actions button:nth-child(2) {
  background: #262126;
  color: #ffffff;
}

.floor-edit-actions button.danger {
  background: rgba(166, 77, 91, 0.1);
  color: #a64d5b;
}

.floor-edit-actions button:disabled {
  opacity: 0.42;
}

.reply-variant-switcher {
  display: inline-flex;
  align-items: center;
  justify-self: center;
  gap: 8px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.reply-variant-switcher > button:not(.apply-reply-button) {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 0;
  background: transparent;
  color: #322d32;
}

.reply-variant-switcher > span {
  min-width: 38px;
  color: #5f555d;
  font-size: 11px;
  font-weight: 900;
  line-height: 1;
  text-align: center;
}

.chapter-entry p,
.chapter-entry-body {
  margin: 0;
  color: #282328;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chapter-entry-html :deep(p),
.chapter-entry-html :deep(ul),
.chapter-entry-html :deep(ol),
.chapter-entry-html :deep(blockquote),
.chapter-entry-html :deep(pre),
.chapter-entry-html :deep(details),
.chapter-entry-html :deep(h1),
.chapter-entry-html :deep(h2),
.chapter-entry-html :deep(h3),
.chapter-entry-html :deep(h4),
.chapter-entry-html :deep(h5),
.chapter-entry-html :deep(h6),
.chapter-entry-html :deep(hr) {
  margin: 0 0 0.62em;
}

.chapter-entry-html :deep(:last-child) {
  margin-bottom: 0;
}

.chapter-entry-html :deep(summary) {
  cursor: pointer;
  font-weight: 900;
}

.chapter-entry-html :deep(ul),
.chapter-entry-html :deep(ol) {
  padding-left: 1.35em;
}

.chapter-entry-html :deep(pre),
.chapter-entry-html :deep(code) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.chapter-entry-html :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  white-space: pre-wrap;
}

.chapter-entry-html :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.inner-voice-segment {
  padding: 0 0.28em;
  border-radius: 6px;
  background: linear-gradient(180deg, rgba(255, 236, 244, 0.12) 18%, rgba(214, 155, 178, 0.28) 100%);
  color: #7e4d5f;
  font-style: italic;
  font-weight: 800;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.dialogue-segment {
  padding: 0.02em 0.38em 0.08em;
  border-radius: 5px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 15%, rgba(171, 143, 158, 0.2) 100%);
  color: #241f24;
  font-weight: 850;
  box-shadow: inset 0 -1px 0 rgba(38, 33, 38, 0.12);
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}

.plot-choice-panel {
  display: grid;
  gap: 5px;
  padding: 6px;
  border: 1px solid rgba(182, 154, 166, 0.16);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.42);
}

.plot-choice-toggle {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 18px;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 7px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.58);
  color: #9d7382;
  text-align: left;
}

.plot-choice-toggle span,
.plot-choice-toggle strong {
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
}

.plot-choice-toggle svg {
  justify-self: center;
  transition: transform 0.16s ease;
}

.plot-choice-panel.expanded .plot-choice-toggle svg {
  transform: rotate(180deg);
}

.plot-choice-list {
  display: grid;
  gap: 5px;
}

.plot-choice-list button {
  min-height: 28px;
  padding: 6px 7px;
  border: 1px solid rgba(182, 154, 166, 0.18);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.64);
  color: #4d454c;
  font-size: 10px;
  font-weight: 760;
  line-height: 1.35;
  text-align: left;
}

.plot-choice-list button.active {
  border-color: #262126;
  background: #262126;
  color: #ffffff;
}

.delete-floor-hint {
  justify-self: start;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(166, 77, 91, 0.1);
  color: #a64d5b;
  font-size: 11px;
  font-weight: 900;
}

.chapter-entry--user p {
  font-weight: 800;
}

.chapter-entry--user .chapter-entry-body {
  font-weight: 800;
}

.offline-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 38vh;
  padding: 28px 18px;
  color: #a09299;
  text-align: center;
}

.offline-empty strong {
  color: #383139;
  font-size: 16px;
}

.offline-empty span {
  font-size: 12px;
  line-height: 1.45;
}

.typing-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 54px;
  padding: 13px 15px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  color: #695d65;
  box-shadow: 0 14px 34px rgba(96, 74, 88, 0.08);
}

.typing-card strong {
  font-size: 12px;
  font-weight: 900;
}

.typing-dots {
  display: inline-flex;
  gap: 4px;
}

.typing-dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b28b99;
  animation: typing-bounce 0.9s ease-in-out infinite;
}

.typing-dots i:nth-child(2) {
  animation-delay: 0.14s;
}

.typing-dots i:nth-child(3) {
  animation-delay: 0.28s;
}

@keyframes typing-bounce {
  0%, 80%, 100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

.offline-dock {
  position: relative;
  z-index: 12;
  flex: 0 0 auto;
  display: grid;
  gap: 8px;
  padding: 10px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(255, 255, 255, 0.62);
  background: rgba(255, 255, 255, 0.72);
  -webkit-backdrop-filter: blur(22px);
  backdrop-filter: blur(22px);
  transform: translate3d(0, calc(0px - var(--keyboard-inset)), 0);
  will-change: transform;
}

.offline-toolbar {
  display: grid;
  grid-template-columns: repeat(3, minmax(40px, 1.15fr)) repeat(5, minmax(29px, 0.85fr));
  gap: 4px;
}

.tool-button,
.icon-tool-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 0;
  min-height: 32px;
  padding: 0 4px;
  border: 1px solid rgba(182, 154, 166, 0.26);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.72);
  color: #685b63;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.tool-button {
  width: 100%;
}

.icon-tool-button {
  width: 100%;
  padding: 0;
}

.tool-button.active,
.icon-tool-button.active {
  border-color: #262126;
  background: #262126;
  color: #ffffff;
}

.tool-button--danger.active {
  border-color: #a64d5b;
  background: #a64d5b;
}

.tool-button:disabled,
.icon-tool-button:disabled {
  opacity: 0.42;
  cursor: default;
}

.offline-composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 42px;
  align-items: end;
  gap: 8px;
}

.offline-composer textarea {
  min-height: 42px;
  max-height: 118px;
  resize: none;
  padding: 11px 12px;
  border: 1px solid rgba(182, 154, 166, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  color: #262126;
  font-size: 14px;
  line-height: 1.45;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.offline-composer textarea::placeholder {
  color: #aaa0a7;
}

.send-button {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: #222026;
  color: #ffffff;
  box-shadow: 0 14px 28px rgba(34, 32, 38, 0.18);
}

.send-button:disabled {
  background: rgba(34, 32, 38, 0.24);
  box-shadow: none;
  cursor: default;
}

.floor-jump-backdrop,
.regenerate-prompt-backdrop {
  position: fixed;
  inset: 0;
  z-index: 44;
  display: grid;
  place-items: center;
  padding: 18px calc(16px + var(--safe-right)) calc(18px + var(--safe-bottom)) calc(16px + var(--safe-left));
  background: rgba(37, 34, 38, 0.22);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.floor-jump-sheet,
.regenerate-prompt-sheet {
  display: grid;
  gap: 12px;
  width: min(100%, 360px);
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 22px 52px rgba(79, 58, 72, 0.2);
}

.floor-jump-sheet > span,
.regenerate-prompt-sheet > span {
  color: #b28b99;
  font-size: 10px;
  font-weight: 950;
  line-height: 1;
  text-transform: uppercase;
}

.floor-jump-sheet h2,
.floor-jump-sheet p,
.regenerate-prompt-sheet h2,
.regenerate-prompt-sheet p {
  margin: 0;
}

.floor-jump-sheet h2,
.regenerate-prompt-sheet h2 {
  color: #211d21;
  font-size: 18px;
  font-weight: 950;
  line-height: 1.2;
}

.floor-jump-sheet p,
.regenerate-prompt-sheet p {
  color: #8f858c;
  font-size: 12px;
  font-weight: 760;
  line-height: 1.45;
}

.floor-jump-sheet label,
.regenerate-prompt-sheet label {
  display: grid;
  gap: 7px;
}

.floor-jump-sheet label span,
.regenerate-prompt-sheet label span {
  color: #695d65;
  font-size: 11px;
  font-weight: 900;
}

.floor-jump-sheet input,
.regenerate-prompt-sheet textarea {
  min-height: 44px;
  padding: 9px 11px;
  border: 1px solid rgba(182, 154, 166, 0.22);
  border-radius: 8px;
  outline: 0;
  background: rgba(255, 255, 255, 0.82);
  color: #262126;
  font-size: 16px;
  font-weight: 900;
}

.regenerate-prompt-sheet textarea {
  min-height: 118px;
  resize: vertical;
  font-size: 14px;
  font-weight: 760;
  line-height: 1.5;
}

.floor-jump-actions,
.regenerate-prompt-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.floor-jump-actions button,
.regenerate-prompt-actions button {
  min-height: 38px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.74);
  color: #695d65;
  font-size: 12px;
  font-weight: 900;
}

.floor-jump-actions button:last-child,
.regenerate-prompt-actions button:last-child {
  background: #262126;
  color: #ffffff;
}

.regenerate-prompt-actions button:disabled {
  opacity: 0.42;
  cursor: default;
}

.delete-confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 45;
  display: grid;
  place-items: center;
  padding: 18px calc(16px + var(--safe-right)) calc(18px + var(--safe-bottom)) calc(16px + var(--safe-left));
  background: rgba(37, 34, 38, 0.28);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
}

.delete-confirm-sheet {
  display: grid;
  gap: 9px;
  width: min(100%, 360px);
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 24px 64px rgba(49, 35, 46, 0.22);
}

.delete-confirm-sheet > span {
  color: #b28b99;
  font-size: 10px;
  font-weight: 900;
}

.delete-confirm-sheet h2 {
  margin: 0;
  color: #211d21;
  font-size: 18px;
  font-weight: 900;
  line-height: 1.25;
}

.delete-confirm-sheet p {
  margin: 0;
  color: #5d535b;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.55;
}

.delete-confirm-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 3px;
}

.delete-confirm-actions button {
  min-height: 38px;
  border-radius: 8px;
  background: rgba(38, 33, 38, 0.07);
  color: #302a30;
  font-size: 13px;
  font-weight: 900;
}

.delete-confirm-actions button:last-child {
  background: #a64d5b;
  color: #ffffff;
}

</style>

<style scoped src="@/styles/offlineRoomCanvasEditorial.css"></style>
<style scoped src="@/styles/offlineRoomControlsEditorial.css"></style>