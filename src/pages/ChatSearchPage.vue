<template>
  <section v-if="conversation && character" class="screen no-tabs chat-search-page">
    <header class="search-topbar">
      <button class="icon-button" type="button" aria-label="返回" @click="router.back()">
        <ChevronLeft :size="23" />
      </button>
      <label class="search-box">
        <Search :size="17" />
        <input ref="searchInputRef" v-model="query" enterkeyhint="search" maxlength="80" placeholder="搜索聊天记录" />
      </label>
    </header>

    <main class="search-results" aria-live="polite">
      <div class="search-summary">
        <strong>{{ characterDisplayName }}</strong>
        <span>{{ resultSummary }}</span>
      </div>

      <button v-for="result in searchResults" :key="result.message.id" class="result-card" type="button" @click="openResult(result)">
        <div class="result-meta">
          <span :class="['mode-pill', `mode-pill--${result.message.mode}`]">{{ result.message.mode === 'offline' ? '线下' : '线上' }}</span>
          <strong>{{ senderName(result.message) }}</strong>
          <time>{{ formatChatTime(result.message.createdAt) }}</time>
        </div>
        <p>
          <template v-for="(segment, index) in result.segments" :key="index">
            <mark v-if="segment.match">{{ segment.text }}</mark>
            <span v-else>{{ segment.text }}</span>
          </template>
        </p>
      </button>

      <section v-if="!normalizedQuery" class="search-empty">
        <Search :size="30" />
        <strong>输入关键字搜索</strong>
        <span>{{ conversation.kind === 'group' ? '会同时搜索当前群的线上消息和群聊线下章节。' : '会同时搜索该角色的线上聊天和线下章节。' }}</span>
      </section>
      <section v-else-if="!searchResults.length" class="search-empty">
        <SearchX :size="30" />
        <strong>没有找到相关记录</strong>
        <span>换个关键词试试看。</span>
      </section>
    </main>
  </section>
  <section v-else class="screen no-tabs empty-state">会话不存在</section>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ChevronLeft, Search, SearchX } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import type { ChatMessage } from '@/types/domain';
import { getCharacterDisplayName } from '@/utils/character';
import { formatChatTime } from '@/utils/time';
import { isVoomNarrationMessage } from '@/utils/voomMessages';

interface HighlightSegment {
  text: string;
  match: boolean;
}

interface SearchResult {
  message: ChatMessage;
  text: string;
  segments: HighlightSegment[];
}

const props = defineProps<{
  id: string;
}>();

const store = useAppStore();
const router = useRouter();
const query = ref('');
const searchInputRef = ref<HTMLInputElement | null>(null);

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => {
  if (!conversation.value) return undefined;
  if (conversation.value.kind !== 'group') return store.characterById(conversation.value.charId);
  return conversation.value.groupMembers?.flatMap((member) => member.identityType === 'character' && member.identityId ? [store.characterById(member.identityId)] : []).find(Boolean);
});
const user = computed(() => (conversation.value ? store.userById(conversation.value.userId) : undefined));
const characterDisplayName = computed(() => conversation.value?.kind === 'group' ? conversation.value.title : character.value ? getCharacterDisplayName(character.value) : '该角色');
const userDisplayName = computed(() => user.value?.nickname || user.value?.name || '我');
const normalizedQuery = computed(() => query.value.trim().toLocaleLowerCase());
const searchableMessages = computed(() => store.messagesForConversation(props.id)
  .filter((message) => !isVoomNarrationMessage(message) && message.replyVariantState !== 'inactive')
  .map((message) => ({ message, text: searchableMessageText(message) }))
  .filter((entry) => entry.text.trim())
  .sort((first, second) => first.message.createdAt - second.message.createdAt));
const searchResults = computed<SearchResult[]>(() => {
  const needle = normalizedQuery.value;
  if (!needle) return [];
  return searchableMessages.value
    .filter((entry) => entry.text.toLocaleLowerCase().includes(needle))
    .map((entry) => ({
      ...entry,
      segments: highlightSegments(snippetForMatch(entry.text, needle), needle)
    }));
});
const resultSummary = computed(() => {
  if (!normalizedQuery.value) return '搜索线上与线下聊天记录';
  return `找到 ${searchResults.value.length} 条相关记录`;
});

function searchableMessageText(message: ChatMessage) {
  if (message.sticker) return message.sticker.description;
  if (message.image) return message.image.description;
  if (message.voice) return message.voice.transcript;
  if (message.location) return [message.location.name, message.location.address, message.location.distance].filter(Boolean).join(' ');
  if (message.transfer) return [message.content, message.transfer.amount, message.transfer.note].filter(Boolean).join(' ');
  if (message.commerce) return [message.content, message.commerce.storeName, message.commerce.totalAmount, message.commerce.items.map((item) => item.name).join(' '), message.commerce.cardMessage].filter(Boolean).join(' ');
  if (message.linkPreview) return [message.content, message.linkPreview.title, message.linkPreview.description, message.linkPreview.siteName, message.linkPreview.url].filter(Boolean).join(' ');
  if (message.theaterLink) return [message.content, message.theaterLink.title, message.theaterLink.summary, message.theaterLink.content].filter(Boolean).join(' ');
  if (message.offlineInvitation) return [message.content, message.offlineInvitation.prompt].filter(Boolean).join(' ');
  return message.content;
}

function snippetForMatch(text: string, needle: string) {
  const normalizedText = text.toLocaleLowerCase();
  const index = normalizedText.indexOf(needle);
  if (index < 0) return text.slice(0, 120);
  const start = Math.max(0, index - 38);
  const end = Math.min(text.length, index + needle.length + 70);
  return `${start > 0 ? '...' : ''}${text.slice(start, end)}${end < text.length ? '...' : ''}`;
}

function highlightSegments(text: string, needle: string): HighlightSegment[] {
  if (!needle) return [{ text, match: false }];
  const segments: HighlightSegment[] = [];
  const normalizedText = text.toLocaleLowerCase();
  let cursor = 0;
  let index = normalizedText.indexOf(needle);
  while (index >= 0) {
    if (index > cursor) segments.push({ text: text.slice(cursor, index), match: false });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    cursor = index + needle.length;
    index = normalizedText.indexOf(needle, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), match: false });
  return segments.length ? segments : [{ text, match: false }];
}

function senderName(message: ChatMessage) {
  if (conversation.value?.kind === 'group') return message.authorName || (message.sender === 'system' ? '系统' : '群成员');
  if (message.sender === 'char') return characterDisplayName.value;
  if (message.sender === 'user') return userDisplayName.value;
  return '系统旁白';
}

function openResult(result: SearchResult) {
  const routeName = result.message.mode === 'offline' ? 'offline-room' : conversation.value?.kind === 'group' ? 'group-chat' : 'chat-room';
  void router.push({ name: routeName, params: { id: props.id }, query: { focus: result.message.id } });
}

onMounted(async () => {
  await store.hydrate();
  await nextTick();
  searchInputRef.value?.focus();
});
</script>

<style scoped>
.chat-search-page {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f7f8fa;
}

.search-topbar {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: calc(8px + var(--safe-top)) calc(12px + var(--safe-right)) 8px calc(8px + var(--safe-left));
  background: rgba(255, 255, 255, 0.94);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
}

.search-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  min-width: 0;
  min-height: 36px;
  padding: 0 11px;
  border-radius: 12px;
  background: #edf0f3;
  color: #727981;
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #17191d;
  font-size: 14px;
  font-weight: 700;
}

.search-results {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px calc(12px + var(--safe-right)) calc(18px + var(--safe-bottom)) calc(12px + var(--safe-left));
}

.search-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 34px;
  color: #747a82;
  font-size: 12px;
  font-weight: 760;
}

.search-summary strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #202329;
  font-size: 13px;
  font-weight: 920;
}

.result-card {
  display: grid;
  gap: 8px;
  width: 100%;
  border-radius: 12px;
  padding: 11px 12px;
  background: #ffffff;
  color: #202329;
  text-align: left;
  box-shadow: 0 8px 22px rgba(18, 22, 28, 0.05);
}

.result-card:active {
  transform: scale(0.99);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  color: #7a818a;
  font-size: 11px;
  font-weight: 760;
}

.result-meta strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #202329;
  font-size: 12px;
  font-weight: 900;
}

.result-meta time {
  margin-left: auto;
  white-space: nowrap;
}

.mode-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 34px;
  min-height: 20px;
  border-radius: 999px;
  background: #eef2f6;
  color: #4f5c68;
  font-size: 10px;
  font-weight: 900;
}

.mode-pill--offline {
  background: #f7edf2;
  color: #8b5268;
}

.result-card p {
  margin: 0;
  color: #30343a;
  font-size: 13px;
  font-weight: 650;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.result-card mark {
  border-radius: 4px;
  padding: 0 2px;
  background: #dfe3e8;
  color: #15181c;
  font-weight: 900;
}

.search-empty {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  min-height: 46vh;
  color: #8a9098;
  text-align: center;
}

.search-empty strong {
  color: #272b31;
  font-size: 15px;
  font-weight: 920;
}

.search-empty span {
  max-width: 240px;
  font-size: 12px;
  font-weight: 720;
  line-height: 1.45;
}
</style>