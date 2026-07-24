<template>
  <section class="memory-studio" :class="`surface-${surface}`">
    <header class="studio-header">
      <div class="profile-row">
        <div class="avatar-frame">
          <img v-if="character?.avatar" :src="character.avatar" :alt="characterName" />
          <BookOpen v-else :size="24" aria-hidden="true" />
          <span class="avatar-dot"><Sparkles :size="11" /></span>
        </div>
        <div class="profile-copy">
          <span class="eyebrow">PRIVATE CHARACTER DIARY</span>
          <h1>{{ characterName }}</h1>
          <p>记录我的认知与记忆</p>
        </div>
        <button class="icon-button" type="button" :aria-label="settingsExpanded ? '收起设置' : '打开设置'" @click="settingsExpanded = !settingsExpanded">
          <SlidersHorizontal :size="18" />
        </button>
      </div>
      <div class="story-strip" aria-label="记忆分类">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id">
          <span class="story-bubble" :class="`story-${tab.id}`"><component :is="tab.icon" :size="15" /></span>
          <small>{{ tab.label }}</small>
        </button>
      </div>
    </header>

    <section class="compression-note" aria-label="上下文压缩效果">
      <div class="compression-copy">
        <span class="eyebrow">MEMORY COMPRESSION</span>
        <strong>{{ compressionHeadline }}</strong>
        <p v-if="stats.compressionActive">旧楼层仍保存在时间轴里，但回复时由角色记忆代替原文进入模型。</p>
        <p v-else>打开压缩后，已形成日记的旧楼层会退出回复上下文；消息本身不会被删除。</p>
      </div>
      <div class="compression-numbers">
        <span><b>{{ stats.archivedFloors }}</b><small>已归档楼层</small></span>
        <span><b>{{ stats.promptMessages }}</b><small>本轮原文</small></span>
        <span><b>{{ stats.memoryTokens }}/{{ stats.memoryBudgetTokens }}</b><small>记忆 tokens</small></span>
      </div>
    </section>

    <section v-if="settingsExpanded" class="settings-sheet">
      <div class="sheet-heading">
        <div><span class="eyebrow">MEMORY SETTINGS</span><h2>让记忆变得更轻</h2></div>
        <button class="icon-button" type="button" aria-label="关闭设置" @click="settingsExpanded = false"><X :size="17" /></button>
      </div>
      <div class="settings-list">
        <label class="setting-line"><span><strong>启用角色记忆</strong><small>回复时召回这个角色与 {{ userName }} 的共享 brain。</small></span><input v-model="memoryDraft.enabled" type="checkbox" @change="saveMemorySettings" /></label>
        <label class="setting-line"><span><strong>压缩旧楼层</strong><small>已写入日记的旧原文不再重复发送给模型。</small></span><input v-model="memoryDraft.compressionEnabled" type="checkbox" @change="saveMemorySettings" /></label>
        <label class="setting-line"><span><strong>自动写日记</strong><small>每积累几个完整楼层，就编码一次角色主观记忆。</small></span><input v-model="memoryDraft.autoCapture" type="checkbox" @change="saveMemorySettings" /></label>
        <label class="number-line"><span><strong>每批楼层</strong><small>建议 6–12 个完整楼层。</small></span><input v-model.number="memoryDraft.captureEvery" type="number" min="2" max="40" @change="saveMemorySettings" /></label>
        <label class="number-line"><span><strong>保留最近原文</strong><small>保证眼前聊天的语气和上下文连续。</small></span><input v-model.number="memoryDraft.recentMessageLimit" type="number" min="6" max="24" @change="saveMemorySettings" /></label>
        <label class="number-line"><span><strong>记忆召回预算</strong><small>越低越省 token，建议 600–1200。</small></span><input v-model.number="memoryDraft.recallTokenBudget" type="number" min="300" max="2400" step="50" @change="saveMemorySettings" /></label>
        <label class="setting-line"><span><strong>允许缓慢成长</strong><small>关系与印象只依据重复证据逐步变化。</small></span><input v-model="memoryDraft.growthEnabled" type="checkbox" @change="saveMemorySettings" /></label>
      </div>
      <div class="settings-actions">
        <button class="text-button" type="button" :disabled="busy || !memoryDraft.enabled" @click="rebuildConfirming = true"><RefreshCw :size="14" />从时间轴重建</button>
        <div v-if="rebuildConfirming" class="confirm-row"><span>只重建派生记忆，不改消息。</span><button type="button" @click="rebuildConfirming = false">取消</button><button class="danger-button" type="button" :disabled="busy" @click="rebuildMemory">确认</button></div>
      </div>
    </section>

    <p v-if="actionMessage" class="action-toast" :class="`toast-${actionTone}`">{{ actionMessage }}</p>

    <section v-if="activeTab === 'diary'" class="diary-section">
      <div class="section-intro"><div><span class="eyebrow">MY MEMORY</span><h2>我记得的片段</h2></div><button class="capture-button" type="button" :disabled="busy || !memoryDraft.enabled" @click="captureNow"><LoaderCircle v-if="capturing" :size="15" class="spin" /><Plus v-else :size="15" />{{ capturing ? '正在写' : '写入最新一页' }}</button></div>
      <label class="search-box"><Search :size="15" /><input v-model="searchQuery" type="search" placeholder="找一段经历、一个约定或一种感觉" /><button v-if="searchQuery" type="button" aria-label="清空搜索" @click="searchQuery = ''"><X :size="14" /></button></label>
      <template v-if="diaryGroups.length">
        <div class="diary-timeline">
          <section v-for="group in diaryGroups" :key="group.label" class="month-group">
          <h3>{{ group.label }}</h3>
          <article v-for="episode in group.entries" :key="episode.id" class="diary-entry">
            <div class="date-rail"><span>{{ dayOf(episode.occurredAt) }}</span><i></i></div>
            <div class="diary-card">
              <header class="diary-card-head">
                <div class="diary-card-meta"><em>{{ channelLabel(episode.channel) }}</em><span>{{ formatDate(episode.occurredAt) }}</span></div>
                <div class="diary-card-actions">
                  <button type="button" :disabled="busy || !episode.sourceMessageIds.length" :aria-label="`重新生成${memoryText(episode.title)}`" title="重新生成" @click="regenerateEpisode(episode)"><LoaderCircle v-if="regeneratingEpisodeId === episode.id" :size="15" class="spin" /><RefreshCw v-else :size="15" /></button>
                  <button type="button" :disabled="busy" :aria-label="`编辑${memoryText(episode.title)}`" title="编辑" @click="startEpisodeEdit(episode)"><Pencil :size="15" /></button>
                </div>
              </header>
              <template v-if="editingEpisodeId === episode.id">
                <div class="diary-editor">
                  <label><span>标题</span><input v-model="episodeEditDraft.title" maxlength="80" /></label>
                  <label><span>正文</span><textarea v-model="episodeEditDraft.narrative" rows="8" maxlength="1800"></textarea></label>
                  <div class="diary-editor-row"><label><span>地点</span><input v-model="episodeEditDraft.location" maxlength="80" placeholder="可留空" /></label><label><span>情绪</span><input v-model="episodeEditDraft.emotion" maxlength="80" placeholder="可留空" /></label></div>
                </div>
                <div class="diary-edit-actions"><button type="button" @click="cancelEpisodeEdit">取消</button><button class="save-button" type="button" :disabled="!episodeEditDraft.title.trim() || !episodeEditDraft.narrative.trim()" @click="saveEpisodeEdit(episode)">保存日记</button></div>
              </template>
              <template v-else>
                <h4>{{ memoryText(episode.title) }}</h4>
                <p>{{ memoryText(episode.narrative) }}</p>
                <footer><span v-if="episode.location"><MapPin :size="12" />{{ memoryText(episode.location) }}</span><span v-if="episode.emotion"><Heart :size="12" />{{ memoryText(episode.emotion) }}</span><span v-if="episode.startFloor > 0"><Layers3 :size="12" />{{ episode.startFloor }}–{{ episode.endFloor }}楼</span></footer>
                <div v-if="episode.themeIds.length" class="tag-row"><span v-for="tag in themeNames(episode.themeIds).slice(0, 3)" :key="tag">#{{ memoryText(tag) }}</span></div>
              </template>
            </div>
          </article>
          </section>
        </div>
        <button v-if="remainingDiaryEntries > 0" class="diary-load-more" type="button" @click="loadMoreDiaryEntries">再看更早的 {{ Math.min(diaryPageSize, remainingDiaryEntries) }} 页<span>还剩 {{ remainingDiaryEntries }} 页</span></button>
      </template>
      <div v-else class="empty-diary"><BookOpen :size="30" /><strong>这里还没有第一篇日记</strong><p>继续和 {{ userName }} 相处，角色会把真正重要的片段写下来。</p><button class="capture-button" type="button" :disabled="busy || !memoryDraft.enabled" @click="captureNow">写入最新对话</button></div>
    </section>

    <section v-else-if="activeTab === 'us'" class="content-section">
      <div class="section-intro"><div><span class="eyebrow">ABOUT US</span><h2>我对我们的理解</h2></div><HeartHandshake :size="23" class="section-icon" /></div>
      <div class="state-grid"><article v-for="state in relationshipStates" :key="state.id" class="state-note"><span>{{ stateLabel(state.kind) }}</span><p>{{ memoryText(state.summary) }}</p><small>{{ formatDate(state.createdAt) }}</small><div v-if="state.facets.length" class="facet-chips"><em v-for="facet in state.facets.slice(0, 4)" :key="facet.key">{{ memoryText(facet.label) }} · {{ trendLabel(facet.trend) }}</em></div></article></div>
      <div class="belief-list"><header><span class="eyebrow">LIVING IMPRESSIONS</span><h3>印象会随着证据改变</h3></header><article v-for="assertion in relationshipAssertions" :key="assertion.id" class="belief-card"><span class="belief-kind">{{ kindLabel(assertion.kind) }}</span><p>{{ memoryText(assertion.perspectiveText) }}</p><small>{{ formatDate(assertion.validFrom) }} · {{ certaintyLabel(assertion.confidence) }}</small></article><p v-if="!relationshipAssertions.length" class="muted-empty">还没有足够的重复证据，角色不会凭空给关系下结论。</p></div>
    </section>

    <section v-else-if="activeTab === 'collections'" class="content-section">
      <div class="section-intro"><div><span class="eyebrow">MEMORY COLLECTIONS</span><h2>反复想起的主题</h2></div><Layers3 :size="23" class="section-icon" /></div>
      <div class="collection-grid"><article v-for="theme in filteredThemes" :key="theme.id" class="collection-card"><header><span class="collection-symbol">#</span><div><h3>{{ memoryText(theme.name) }}</h3><small>{{ activeThemeAssertionCount(theme) }} 条有效认知 · {{ theme.episodeIds.length }} 段经历</small></div></header><p>{{ memoryText(theme.report) || '这个主题正在形成，等更多经历让它变得清晰。' }}</p><footer><span v-if="theme.reportAssertionCount >= 5"><Sparkles :size="12" />已整理成长期印象</span><span>{{ formatDate(theme.updatedAt) }} 更新</span></footer></article></div>
      <p v-if="!filteredThemes.length" class="muted-empty">当相似的原子记忆反复出现，它们会自动聚成一个主题家族。</p>
    </section>

    <section v-else class="content-section archive-section">
      <div class="section-intro"><div><span class="eyebrow">ARCHIVE</span><h2>我的认知底稿</h2></div><Archive :size="23" class="section-icon" /></div>
      <p class="archive-hint">这里的纠正、珍藏和遗忘只影响角色可召回的认知；聊天消息和日记原文仍然保留。</p>
      <article v-for="assertion in visibleAssertions" :key="assertion.id" class="archive-item" :class="{ pinned: assertion.pinned, disputed: assertion.status === 'disputed' }">
        <header><span>{{ kindLabel(assertion.kind) }} · {{ certaintyLabel(assertion.confidence) }}</span><button type="button" :aria-label="assertion.pinned ? '取消珍藏' : '珍藏记忆'" @click="togglePinned(assertion)"><Bookmark :size="16" :fill="assertion.pinned ? 'currentColor' : 'none'" /></button></header>
        <textarea v-if="editingAssertionId === assertion.id" v-model="correctionDraft" rows="3" maxlength="520"></textarea><p v-else>{{ memoryText(assertion.perspectiveText) }}</p>
        <div class="archive-meta"><span>{{ subjectName(assertion.subjectEntityId) }}</span><span v-if="assertion.status === 'open'">仍待完成</span><span v-if="assertion.status === 'disputed'">存在矛盾</span><span>{{ assertion.evidenceMessageIds.length }} 条证据</span></div>
        <footer v-if="editingAssertionId === assertion.id"><button type="button" @click="cancelCorrection">取消</button><button class="save-button" type="button" :disabled="!correctionDraft.trim()" @click="saveCorrection(assertion)">保存纠正</button></footer><footer v-else><div class="tag-row"><span v-for="tag in themeNames(assertion.themeIds).slice(0, 3)" :key="tag">#{{ memoryText(tag) }}</span></div><div class="archive-actions"><button type="button" @click="startCorrection(assertion)"><Pencil :size="13" />纠正</button><button type="button" @click="confirmingForgetId = assertion.id"><EyeOff :size="13" />遗忘</button></div></footer>
        <div v-if="confirmingForgetId === assertion.id" class="forget-row"><span>让角色忘掉这条可召回认知？</span><button type="button" @click="confirmingForgetId = ''">取消</button><button class="danger-button" type="button" @click="forgetAssertion(assertion)">确认</button></div>
      </article>
      <p v-if="!visibleAssertions.length" class="muted-empty">还没有可管理的原子认知。</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { Archive, BookOpen, Bookmark, EyeOff, Heart, HeartHandshake, Layers3, LoaderCircle, MapPin, Pencil, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-vue-next';
import { useAppStore } from '@/stores/appStore';
import type { ChatMemorySettings } from '@/types/domain';
import type { MemoryAssertion, MemoryChannel, MemoryEpisode, MemoryStateKind, MemoryStateSnapshot, MemoryTheme } from '@/types/memory';
import { getCharacterAiName } from '@/utils/character';
import { getUserAiName } from '@/utils/profile';

type MemoryTab = 'diary' | 'us' | 'collections' | 'archive';
type DiaryGroup = { label: string; entries: MemoryEpisode[] };
const diaryPageSize = 20;

const props = withDefaults(defineProps<{ conversationId: string; surface?: 'embedded' | 'page' }>(), { surface: 'embedded' });
const store = useAppStore();
const activeTab = ref<MemoryTab>('diary');
const searchQuery = ref('');
const visibleDiaryCount = ref(diaryPageSize);
const settingsExpanded = ref(false);
const capturing = ref(false);
const rebuilding = ref(false);
const rebuildConfirming = ref(false);
const regeneratingEpisodeId = ref('');
const editingEpisodeId = ref('');
const episodeEditDraft = reactive({ title: '', narrative: '', location: '', emotion: '' });
const editingAssertionId = ref('');
const correctionDraft = ref('');
const confirmingForgetId = ref('');
const actionMessage = ref('');
const actionTone = ref<'success' | 'warning'>('success');
const memoryDraft = reactive<ChatMemorySettings>({ ...store.settingsForConversation(props.conversationId).memory });

const conversation = computed(() => store.conversationById(props.conversationId));
const character = computed(() => conversation.value ? store.characterById(conversation.value.charId) : undefined);
const boundUser = computed(() => conversation.value ? store.userById(conversation.value.userId) : undefined);
const characterName = computed(() => character.value ? getCharacterAiName(character.value) : '角色');
const userName = computed(() => boundUser.value ? getUserAiName(boundUser.value) : '用户');
const graph = computed(() => store.memoryGraphForConversation(props.conversationId));
const currentSettings = computed(() => store.settingsForConversation(props.conversationId));
const stats = computed(() => store.memoryCompressionStatsForConversation(props.conversationId));
const busy = computed(() => capturing.value || rebuilding.value || Boolean(regeneratingEpisodeId.value));
const timeline = computed(() => [...graph.value.episodes].filter((episode) => episode.status === 'active').sort((left, right) => (right.occurredAt || 0) - (left.occurredAt || 0)));
const activeAssertions = computed(() => graph.value.assertions.filter((assertion) => ['current', 'open', 'disputed'].includes(assertion.status)).sort((left, right) => Number(right.pinned) - Number(left.pinned) || right.updatedAt - left.updatedAt));
const userEntityId = computed(() => graph.value.entities.find((entity) => entity.type === 'user')?.id ?? `${graph.value.brainId}:user`);
const normalizedQuery = computed(() => normalizeSearch(searchQuery.value));
const filteredTimeline = computed(() => !normalizedQuery.value ? timeline.value : timeline.value.filter((episode) => normalizeSearch(`${episode.title} ${episode.narrative} ${episode.location} ${episode.emotion}`).includes(normalizedQuery.value)));
const visibleTimeline = computed(() => filteredTimeline.value.slice(0, visibleDiaryCount.value));
const remainingDiaryEntries = computed(() => Math.max(0, filteredTimeline.value.length - visibleTimeline.value.length));
const filteredThemes = computed(() => [...graph.value.themes].filter((theme) => !normalizedQuery.value || normalizeSearch(`${theme.name} ${theme.report} ${theme.description}`).includes(normalizedQuery.value)).sort((left, right) => right.updatedAt - left.updatedAt));
const visibleAssertions = computed(() => activeAssertions.value.filter((assertion) => !normalizedQuery.value || normalizeSearch(`${assertion.perspectiveText} ${assertion.searchText}`).includes(normalizedQuery.value)));
const relationshipAssertions = computed(() => activeAssertions.value.filter((assertion) => assertion.subjectEntityId === userEntityId.value || ['relationship', 'conflict', 'promise', 'open-loop', 'boundary', 'impression'].includes(assertion.kind)).slice(0, 20));
const relationshipStates = computed(() => graph.value.stateSnapshots.filter((state) => ['relationship', 'user-impression'].includes(state.kind)).sort((left, right) => right.createdAt - left.createdAt).slice(0, 8));
const compressionHeadline = computed(() => stats.value.archivedFloors ? `我已经把 ${stats.value.archivedFloors} 个旧楼层收进日记` : '日记会在对话积累后接管旧楼层');
const diaryGroups = computed<DiaryGroup[]>(() => {
  const groups = new Map<string, MemoryEpisode[]>();
  for (const episode of visibleTimeline.value) {
    const date = new Date(episode.occurredAt || episode.createdAt || Date.now());
    const label = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    groups.set(label, [...(groups.get(label) ?? []), episode]);
  }
  return [...groups.entries()].map(([label, entries]) => ({ label, entries }));
});
const tabs = [
  { id: 'diary' as const, label: 'Diary', icon: BookOpen },
  { id: 'us' as const, label: 'Us', icon: HeartHandshake },
  { id: 'collections' as const, label: 'Themes', icon: Layers3 },
  { id: 'archive' as const, label: 'Archive', icon: Archive }
];

watch(currentSettings, (settings) => Object.assign(memoryDraft, settings.memory), { immediate: true });
watch(searchQuery, () => { visibleDiaryCount.value = diaryPageSize; });
watch(() => props.conversationId, () => {
  activeTab.value = 'diary';
  searchQuery.value = '';
  visibleDiaryCount.value = diaryPageSize;
  editingEpisodeId.value = '';
  regeneratingEpisodeId.value = '';
  editingAssertionId.value = '';
  confirmingForgetId.value = '';
  Object.assign(memoryDraft, store.settingsForConversation(props.conversationId).memory);
});

async function saveMemorySettings() {
  memoryDraft.captureEvery = Math.min(40, Math.max(2, Math.round(Number(memoryDraft.captureEvery) || 8)));
  memoryDraft.recentMessageLimit = Math.min(24, Math.max(6, Math.round(Number(memoryDraft.recentMessageLimit) || 10)));
  memoryDraft.recallTokenBudget = Math.min(2400, Math.max(300, Math.round(Number(memoryDraft.recallTokenBudget) || 900)));
  await store.saveConversationSettings({ ...currentSettings.value, conversationId: props.conversationId, memory: { ...memoryDraft } });
}

async function captureNow() {
  try {
    await performCaptureNow();
  } catch (error) {
    showMemoryGenerationError(error, '记忆生成失败', performCaptureNow);
  }
}

async function performCaptureNow() {
  capturing.value = true;
  try {
    const episode = await store.captureConversationMemory(props.conversationId, { force: true });
    setMessage(episode ? `已把「${memoryText(episode.title)}」写进日记。` : '暂时没有尚未编码的完整楼层。', episode ? 'success' : 'warning');
  } finally {
    capturing.value = false;
  }
}

async function rebuildMemory() {
  try {
    await performRebuildMemory();
  } catch (error) {
    showMemoryGenerationError(error, '记忆重建失败', performRebuildMemory);
  }
}

async function performRebuildMemory() {
  rebuilding.value = true;
  try {
    const count = await store.rebuildCharacterMemory(props.conversationId);
    rebuildConfirming.value = false;
    setMessage(`已按时间轴重建 ${count} 页日记，消息没有被改动。`, 'success');
  } finally {
    rebuilding.value = false;
  }
}

function showMemoryGenerationError(error: unknown, title: string, retry: () => Promise<void>) {
  store.showConfigAlert(error instanceof Error ? error.message : `${title}。`, title, {
    label: '重新生成',
    runningLabel: '重新生成中…',
    run: retry
  });
}

function startEpisodeEdit(episode: MemoryEpisode) {
  editingEpisodeId.value = episode.id;
  episodeEditDraft.title = memoryText(episode.title);
  episodeEditDraft.narrative = memoryText(episode.narrative);
  episodeEditDraft.location = memoryText(episode.location);
  episodeEditDraft.emotion = memoryText(episode.emotion);
}

function cancelEpisodeEdit() {
  editingEpisodeId.value = '';
  Object.assign(episodeEditDraft, { title: '', narrative: '', location: '', emotion: '' });
}

async function saveEpisodeEdit(episode: MemoryEpisode) {
  try {
    await store.updateMemoryEpisode(episode.id, { ...episodeEditDraft });
    cancelEpisodeEdit();
    setMessage('这篇日记已保存。', 'success');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : '保存日记失败。', 'warning');
  }
}

async function regenerateEpisode(episode: MemoryEpisode) {
  try {
    await performEpisodeRegeneration(episode);
  } catch (error) {
    showMemoryGenerationError(error, '日记重生成失败', () => performEpisodeRegeneration(episode));
  }
}

async function performEpisodeRegeneration(episode: MemoryEpisode) {
  regeneratingEpisodeId.value = episode.id;
  try {
    const updated = await store.regenerateMemoryEpisode(episode.id);
    if (editingEpisodeId.value === episode.id) cancelEpisodeEdit();
    setMessage(`已重新写好「${memoryText(updated.title)}」。`, 'success');
  } finally {
    regeneratingEpisodeId.value = '';
  }
}

function loadMoreDiaryEntries() {
  visibleDiaryCount.value += diaryPageSize;
}

async function togglePinned(assertion: MemoryAssertion) { await store.setMemoryAssertionPinned(assertion.id, !assertion.pinned); }
function startCorrection(assertion: MemoryAssertion) { editingAssertionId.value = assertion.id; correctionDraft.value = memoryText(assertion.perspectiveText); confirmingForgetId.value = ''; }
function cancelCorrection() { editingAssertionId.value = ''; correctionDraft.value = ''; }
async function saveCorrection(assertion: MemoryAssertion) { if (!correctionDraft.value.trim()) return; await store.correctMemoryAssertion(assertion.id, correctionDraft.value.trim()); cancelCorrection(); setMessage('已保留旧证据，并写入新的认知。', 'success'); }
async function forgetAssertion(assertion: MemoryAssertion) { await store.forgetMemoryAssertion(assertion.id); confirmingForgetId.value = ''; setMessage('这条认知不再参与角色回复。', 'success'); }
function setMessage(message: string, tone: 'success' | 'warning') { actionMessage.value = message; actionTone.value = tone; window.setTimeout(() => { if (actionMessage.value === message) actionMessage.value = ''; }, 4500); }
function normalizeSearch(value: string) { return String(value ?? '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, ''); }
function memoryText(value: string) { return String(value ?? ''); }
function themeNames(themeIds: string[]) { const map = new Map(graph.value.themes.map((theme) => [theme.id, theme.name])); return themeIds.map((id) => map.get(id)).filter((name): name is string => Boolean(name)); }
function activeThemeAssertionCount(theme: MemoryTheme) { return activeAssertions.value.filter((assertion) => theme.assertionIds.includes(assertion.id)).length; }
function subjectName(entityId: string) { return memoryText(graph.value.entities.find((entity) => entity.id === entityId)?.name || '这件事'); }
function dayOf(timestamp: number) { return String(new Date(timestamp || Date.now()).getDate()).padStart(2, '0'); }
function formatDate(timestamp: number) { return Number.isFinite(timestamp) && timestamp > 0 ? new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(timestamp) : '时间未标记'; }
function channelLabel(channel: MemoryChannel) { return ({ online: '线上', offline: '线下', group: '群聊', voom: '动态', 'couple-space': '共同空间', call: '通话', system: '纠正' } satisfies Record<MemoryChannel, string>)[channel]; }
function stateLabel(kind: MemoryStateKind) { return ({ relationship: '我们的关系', 'user-impression': `我对 ${userName.value} 的印象`, 'adaptive-personality': '我的变化', mood: '我的情绪', 'current-context': '当时的情境' } satisfies Record<MemoryStateKind, string>)[kind]; }
function trendLabel(trend: MemoryStateSnapshot['facets'][number]['trend']) { return trend === 'up' ? '变深' : trend === 'down' ? '变淡' : '稳定'; }
function certaintyLabel(value: number) { return `确信 ${Math.round(Math.min(1, Math.max(0, Number(value) || 0)) * 100)}%`; }
function kindLabel(kind: MemoryAssertion['kind']) { return ({ fact: '事实', preference: '偏好', promise: '约定', conflict: '冲突', relationship: '关系', impression: '印象', growth: '成长', emotion: '情绪', 'open-loop': '未完成', interpretation: '理解', boundary: '边界' } satisfies Record<MemoryAssertion['kind'], string>)[kind]; }
</script>

<style scoped>
.memory-studio{--ink:#28282d;--muted:#8c8990;--paper:#fffdfa;--blush:#f4dfe2;--mint:#dceee7;--blue:#e2eaf3;display:grid;gap:18px;min-width:0;padding:2px;color:var(--ink);font-family:"Avenir Next","Noto Sans SC",sans-serif}.studio-header{display:grid;gap:18px;padding:18px 16px 8px;border:1px solid rgba(68,55,60,.07);border-radius:28px;background:linear-gradient(145deg,#fffdf9 0%,#fff8f5 65%,#f4f1f7 100%);box-shadow:0 16px 40px rgba(98,72,78,.08)}.profile-row{display:flex;align-items:center;gap:12px;min-width:0}.avatar-frame{position:relative;display:grid;flex:0 0 auto;width:58px;height:58px;place-items:center;border:4px solid #fff;border-radius:50%;background:var(--mint);color:#6f8e83;box-shadow:0 5px 16px rgba(97,78,82,.13)}.avatar-frame img{width:100%;height:100%;border-radius:50%;object-fit:cover}.avatar-dot{position:absolute;right:-2px;bottom:0;display:grid;width:21px;height:21px;place-items:center;border:2px solid #fff;border-radius:50%;background:#d9a9b4;color:#fff}.profile-copy{min-width:0;flex:1}.eyebrow{display:block;color:#b28e98;font-size:9px;font-weight:800;letter-spacing:.16em;line-height:1.4}.profile-copy h1,.section-intro h2,.sheet-heading h2{overflow:hidden;margin:1px 0;font-family:Georgia,"Noto Serif SC",serif;font-size:21px;font-weight:500;letter-spacing:.01em;text-overflow:ellipsis;white-space:nowrap}.profile-copy p{margin:3px 0 0;color:var(--muted);font-size:11px;line-height:1.5}.icon-button{display:grid;flex:0 0 auto;width:34px;height:34px;place-items:center;border:1px solid rgba(68,55,60,.08);border-radius:50%;background:rgba(255,255,255,.7);color:#82727a}.story-strip{display:flex;justify-content:space-around;gap:10px;overflow:auto;padding:2px 4px 4px}.story-strip button{display:grid;flex:0 0 auto;gap:5px;justify-items:center;border:0;background:transparent;color:#958e93;font-size:10px}.story-strip button.active{color:#493f45}.story-bubble{display:grid;width:38px;height:38px;place-items:center;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 7px rgba(84,67,73,.1)}.story-diary{background:var(--blush)}.story-us{background:var(--mint)}.story-collections{background:var(--blue)}.story-archive{background:#eee9e5}.story-strip button.active .story-bubble{outline:1px solid #9e7d88;outline-offset:2px}.compression-note{display:grid;gap:14px;padding:15px 16px;border:1px solid rgba(68,55,60,.07);border-radius:22px;background:#faf6f2}.compression-copy strong{display:block;margin-top:3px;font-family:Georgia,"Noto Serif SC",serif;font-size:17px;font-weight:500}.compression-copy p{margin:5px 0 0;color:var(--muted);font-size:11px;line-height:1.55}.compression-numbers{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.compression-numbers span{display:grid;gap:2px;padding:9px 4px;border-radius:14px;background:rgba(255,255,255,.72);text-align:center}.compression-numbers b{font-size:16px;font-weight:600}.compression-numbers small{color:var(--muted);font-size:9px}.settings-sheet{display:grid;gap:16px;padding:17px;border:1px solid rgba(68,55,60,.08);border-radius:22px;background:var(--paper);box-shadow:0 12px 30px rgba(88,65,70,.07)}.sheet-heading,.section-intro{display:flex;align-items:center;justify-content:space-between;gap:12px}.sheet-heading h2{font-size:18px}.settings-list{display:grid;gap:1px;border-top:1px solid #f0ebea}.setting-line,.number-line{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #f0ebea}.setting-line span,.number-line span{display:grid;gap:3px;min-width:0}.setting-line strong,.number-line strong{font-size:12px;font-weight:600}.setting-line small,.number-line small{color:var(--muted);font-size:10px;line-height:1.4}.setting-line input{appearance:none;width:38px;height:22px;flex:0 0 auto;border-radius:20px;background:#ddd8d7;transition:.2s}.setting-line input:checked{background:#c796a5}.setting-line input:before{display:block;width:18px;height:18px;margin:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0002;content:"";transition:.2s}.setting-line input:checked:before{transform:translateX(16px)}.number-line input{width:70px;padding:7px;border:1px solid #e8dfdf;border-radius:10px;background:#fff;text-align:center;font-size:12px}.settings-actions{display:grid;gap:10px}.text-button,.confirm-row button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:0;background:transparent;color:#9d7180;font-size:11px}.confirm-row{display:flex;align-items:center;justify-content:flex-end;gap:9px;color:var(--muted);font-size:10px}.danger-button{padding:6px 11px!important;border-radius:9px!important;background:#b97884!important;color:#fff!important}.action-toast{margin:0;padding:10px 13px;border-radius:13px;font-size:11px}.toast-success{background:#edf6f1;color:#5e8876}.toast-warning{background:#fff0ed;color:#ae756e}.section-intro h2{font-size:20px}.section-icon{color:#b78e9b}.capture-button{display:inline-flex;align-items:center;gap:5px;padding:8px 11px;border:1px solid #e5ccd2;border-radius:14px;background:#fff6f7;color:#a36f7d;font-size:11px}.capture-button:disabled{opacity:.5}.search-box{display:flex;align-items:center;gap:7px;padding:9px 12px;border:1px solid #eee7e5;border-radius:14px;background:#fff;color:#b2a8ac}.search-box input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--ink);font-size:11px}.search-box button{display:grid;padding:0;border:0;background:transparent;color:#a99ba1}.diary-section,.content-section{display:grid;gap:16px}.diary-timeline{display:grid;gap:23px}.month-group{display:grid;gap:11px}.month-group>h3{margin:0 0 0 51px;color:#9d8b91;font-family:Georgia,"Noto Serif SC",serif;font-size:14px;font-weight:500}.diary-entry{display:grid;grid-template-columns:42px minmax(0,1fr);gap:10px}.date-rail{position:relative;display:grid;align-content:start;justify-items:center;gap:7px;color:#aa8792}.date-rail span{font-family:Georgia,serif;font-size:15px}.date-rail i{position:absolute;top:24px;bottom:-35px;width:1px;background:#eadbde}.diary-entry:last-child .date-rail i{display:none}.diary-card{padding:15px;border:1px solid rgba(93,69,75,.08);border-radius:5px 20px 20px 20px;background:var(--paper);box-shadow:0 8px 21px rgba(91,69,75,.06)}.diary-card header{display:flex;justify-content:space-between;gap:8px;color:#b1a3a7;font-size:9px;letter-spacing:.04em}.diary-card header em{padding:2px 7px;border-radius:8px;background:#f5edef;color:#a7868e;font-style:normal}.diary-card h4{margin:9px 0 7px;font-family:Georgia,"Noto Serif SC",serif;font-size:17px;font-weight:500;line-height:1.35}.diary-card p{margin:0;color:#5f5b60;font-family:"Noto Serif SC",serif;font-size:12px;line-height:1.8;white-space:pre-wrap}.diary-card footer,.archive-meta{display:flex;flex-wrap:wrap;gap:9px;margin-top:12px;color:#a49a9e;font-size:9px}.diary-card footer span{display:inline-flex;align-items:center;gap:3px}.tag-row{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.tag-row span{padding:3px 7px;border-radius:9px;background:#f3eef1;color:#a78390;font-size:9px}.empty-diary{display:grid;justify-items:center;gap:8px;padding:45px 20px;border:1px dashed #e8dfe0;border-radius:22px;background:#fffdfa;text-align:center;color:#b3a6aa}.empty-diary strong{color:#766b70;font-family:Georgia,serif;font-size:16px;font-weight:500}.empty-diary p{max-width:240px;margin:0;font-size:11px;line-height:1.6}.state-grid,.collection-grid{display:grid;gap:11px}.state-note,.collection-card,.belief-card,.archive-item{padding:15px;border:1px solid rgba(93,69,75,.08);border-radius:17px;background:var(--paper);box-shadow:0 7px 18px rgba(91,69,75,.04)}.state-note>span,.belief-kind{color:#b18491;font-size:10px;font-weight:700;letter-spacing:.04em}.state-note p{margin:8px 0;color:#625c61;font-family:"Noto Serif SC",serif;font-size:13px;line-height:1.7}.state-note small,.belief-card small{color:#b2a6aa;font-size:9px}.facet-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.facet-chips em{padding:3px 7px;border-radius:9px;background:#edf5f1;color:#779588;font-size:9px;font-style:normal}.belief-list{display:grid;gap:9px}.belief-list header{display:grid;gap:3px}.belief-list h3{margin:0;font-family:Georgia,serif;font-size:16px;font-weight:500}.belief-card p{margin:7px 0;font-family:"Noto Serif SC",serif;font-size:12px;line-height:1.7}.muted-empty{margin:0;padding:25px;border-radius:16px;background:#faf7f4;color:#aca1a5;font-size:11px;line-height:1.7;text-align:center}.collection-card header{display:flex;align-items:center;gap:10px}.collection-symbol{display:grid;width:32px;height:32px;place-items:center;border-radius:11px;background:var(--blue);color:#7891a8;font-family:Georgia,serif;font-size:18px}.collection-card h3{margin:0;font-family:Georgia,"Noto Serif SC",serif;font-size:16px;font-weight:500}.collection-card header small{color:var(--muted);font-size:9px}.collection-card>p{margin:13px 0 0;color:#645e62;font-family:"Noto Serif SC",serif;font-size:12px;line-height:1.75}.collection-card footer{display:flex;justify-content:space-between;gap:8px;margin-top:13px;color:#afa2a7;font-size:9px}.collection-card footer span{display:inline-flex;align-items:center;gap:3px}.archive-hint{margin:0;color:var(--muted);font-size:11px;line-height:1.6}.archive-section{gap:12px}.archive-item{display:grid;gap:9px}.archive-item.pinned{border-color:#e3c1ca;background:#fff9fa}.archive-item.disputed{border-color:#e8c9bd}.archive-item header,.archive-item footer{display:flex;align-items:center;justify-content:space-between;gap:8px}.archive-item header>span{color:#a68a91;font-size:9px}.archive-item header button{display:grid;padding:3px;border:0;background:transparent;color:#bb8a97}.archive-item p{margin:0;color:#5e585d;font-family:"Noto Serif SC",serif;font-size:12px;line-height:1.75}.archive-item textarea{width:100%;padding:9px;border:1px solid #e3d2d5;border-radius:11px;outline:0;resize:vertical;font-size:12px;line-height:1.6}.archive-meta{margin:0}.archive-meta span{padding-right:8px;border-right:1px solid #eee4e4}.archive-meta span:last-child{border:0}.archive-actions{display:flex;gap:8px}.archive-actions button,.archive-item footer>button{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border:0;border-radius:8px;background:#f7f1f1;color:#997984;font-size:10px}.archive-actions button:last-child{background:#fbf0ed;color:#ad7d73}.save-button{background:#e9f3ee!important;color:#6e927f!important}.forget-row{display:flex;align-items:center;gap:7px;color:#a98288;font-size:10px}.forget-row span{flex:1}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(min-width:680px){.memory-studio{max-width:760px;margin:0 auto}.compression-note{grid-template-columns:minmax(0,1fr) 240px;align-items:center}.state-grid,.collection-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.diary-card{padding:18px}}
.memory-studio,
.memory-studio * {
  font-family: var(--app-current-font-family) !important;
}
.diary-card .diary-card-head{align-items:flex-start}.diary-card-meta{display:flex;min-width:0;align-items:center;gap:7px}.diary-card-meta span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.diary-card-actions{display:flex;flex:0 0 auto;gap:4px}.diary-card-actions button{display:grid;width:26px;height:26px;padding:0;place-items:center;border:0;border-radius:50%;background:transparent;color:#9d7883}.diary-card-actions button:disabled{opacity:.45}.diary-editor{display:grid;gap:10px;margin-top:12px}.diary-editor label{display:grid;gap:5px;color:#9b8d92;font-size:9px}.diary-editor input,.diary-editor textarea{width:100%;padding:9px 10px;border:1px solid #eadfe1;border-radius:10px;outline:0;background:#fff;color:var(--ink);font-size:12px;line-height:1.65;resize:vertical}.diary-editor input:focus,.diary-editor textarea:focus{border-color:#d7b8c0;box-shadow:0 0 0 2px rgba(215,184,192,.15)}.diary-editor-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.diary-edit-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%;margin-top:12px}.diary-edit-actions button{width:100%;padding:9px 10px;border:0;border-radius:10px;background:#f4eff0;color:#8f7e84;font-size:10px}.diary-edit-actions button:disabled{opacity:.45}
.diary-load-more{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 14px;border:1px solid #eadfe1;border-radius:13px;background:#fffaf9;color:#946f7a;font-size:11px}.diary-load-more span{color:#b4a5aa;font-size:9px}
</style>