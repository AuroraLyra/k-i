<template>
  <section v-if="conversation && character" class="screen no-tabs small-theater-page">
    <header class="top-bar theater-topbar">
      <button class="theater-title-button" type="button" aria-label="返回聊天" @click="goBack">
        <h1 class="top-title">Small Theater</h1>
      </button>
      <div class="theater-header-actions">
        <button class="header-action-button" type="button" aria-label="小剧场清理设置" title="清理设置" @click="openTheaterCleanupSettings">
          <SlidersHorizontal :size="18" stroke-width="2.4" />
        </button>
        <button class="header-action-button" type="button" aria-label="新增题材" title="新增题材" @click="openCreateTopic">
          <Plus :size="18" stroke-width="2.4" />
        </button>
      </div>
    </header>

    <main class="theater-main">
      <section class="theater-panel">
      <section v-if="activeTab === 'topics'" class="theater-section topic-library-section" aria-label="题材管理">
        <header class="theater-section-head theater-editorial-head">
          <div>
            <p class="section-kicker">Story Library</p>
            <h2>题材管理</h2>
            <p class="theater-section-intro">600 种番外灵感，按氛围收藏。</p>
          </div>
          <span class="section-count theater-editorial-count">
            <strong>{{ enabledTopics.length }}</strong>
            <small>of {{ topics.length }} active</small>
          </span>
        </header>

        <section v-if="topics.length" class="topic-library-tools">
          <label class="topic-search-field">
            <Search :size="15" stroke-width="2" />
            <input v-model="topicSearchQuery" type="search" placeholder="搜索题材或提示词" />
            <span>{{ visibleTopicCount }}</span>
          </label>
          <nav class="topic-category-tabs" aria-label="小剧场题材分类">
            <button type="button" :class="{ active: activeTopicCategoryId === 'all' }" @click="activeTopicCategoryId = 'all'">
              <span>全部</span><small>{{ topics.length }}</small>
            </button>
            <button
              v-for="filter in topicCategoryFilters"
              :key="filter.id"
              type="button"
              :class="{ active: activeTopicCategoryId === filter.id }"
              @click="activeTopicCategoryId = filter.id"
            >
              <span>{{ filter.label }}</span><small>{{ filter.count }}</small>
            </button>
          </nav>
        </section>

        <section v-for="group in topicGroups" :key="group.category.id" class="topic-category-group" :aria-label="`${group.category.label}题材`">
          <header class="topic-category-head">
            <div>
              <small>{{ group.category.kicker }}</small>
              <strong>{{ group.category.label }}</strong>
            </div>
            <span class="topic-category-controls">
              <em>{{ topicsInCategory(group.category.id).filter((topic) => topic.enabled).length }}/{{ topicsInCategory(group.category.id).length }}</em>
              <button
                class="topic-switch topic-category-switch"
                :class="{ active: topicCategoryEnabledState(topicsInCategory(group.category.id)) === true, mixed: topicCategoryEnabledState(topicsInCategory(group.category.id)) === 'mixed' }"
                type="button"
                role="switch"
                :aria-label="`${group.category.label}分类总开关`"
                :aria-checked="topicCategoryEnabledState(topicsInCategory(group.category.id))"
                @click="toggleTopicCategory(group.category.id)"
              >
                <span></span>
              </button>
            </span>
          </header>
          <div class="topic-category-grid">
            <article
              v-for="topic in group.items"
              :key="topic.id"
              class="topic-card"
              :class="{ disabled: !topic.enabled }"
              role="button"
              tabindex="0"
              @click="openEditTopic(topic)"
              @keydown.enter.prevent="openEditTopic(topic)"
              @keydown.space.prevent="openEditTopic(topic)"
            >
              <span class="topic-archive-number">{{ smallTheaterTopicArchiveNumber(topic) }}</span>
              <span class="topic-card-copy">
                <small>{{ topic.builtIn ? 'Built-in story' : 'Personal story' }}</small>
                <strong class="topic-title">{{ topic.title }}</strong>
              </span>
              <button class="topic-switch" :class="{ active: topic.enabled }" type="button" role="switch" :aria-label="`${topic.title}题材开关`" :aria-checked="topic.enabled" @click.stop="toggleTopic(topic)">
                <span></span>
              </button>
            </article>
          </div>
        </section>

        <section v-if="topics.length && !topicGroups.length" class="theater-empty compact-topic-empty">
          <Search :size="24" stroke-width="1.6" />
          <h2>没有匹配的题材</h2>
          <p>换一个关键词或切换其他分类试试。</p>
        </section>

        <section v-if="!topics.length" class="theater-empty">
          <Sparkles :size="26" />
          <h2>还没有题材</h2>
          <p>新增一个题材后，就能让角色生成独立番外页面。</p>
          <button type="button" @click="openCreateTopic">新增题材</button>
        </section>
      </section>

      <section v-else class="theater-section theater-archive-section" aria-label="生成小剧场时间轴">
        <header class="theater-section-head theater-editorial-head">
          <div>
            <p class="section-kicker">Theater Archive</p>
            <h2>剧场时间轴</h2>
            <p class="theater-section-intro">每一次番外，都留在故事发生的那天。</p>
          </div>
          <span class="section-count theater-editorial-count">
            <strong>{{ theaters.length }}</strong>
            <small>entries</small>
          </span>
        </header>
        <section class="generate-panel">
          <header class="generate-panel-head">
            <span class="generate-panel-mark"><Sparkles :size="20" stroke-width="1.7" /></span>
            <div>
              <small>Create a scene</small>
              <strong>开启新一幕</strong>
              <p>从已启用的故事灵感里，选择这一场番外。</p>
            </div>
          </header>
          <div class="generate-panel-actions">
            <button class="generate-topic-trigger" type="button" :disabled="generatingTheater || !enabledTopics.length" @click="openGenerateTopicPicker">
              <Search :size="16" stroke-width="2" />
              <span>
                <small>{{ selectedTopicCategoryLabel }}</small>
                <strong>{{ selectedTopic?.title || '随机启用题材' }}</strong>
              </span>
              <ArrowUpRight :size="15" stroke-width="2" />
            </button>
            <button class="generate-button" type="button" :disabled="generatingTheater || !enabledTopics.length" @click="generateTheater">
              <LoaderCircle v-if="generatingTheater" class="spin" :size="17" />
              <Sparkles v-else :size="17" />
              <span>{{ generatingTheater ? '生成中' : '生成小剧场' }}</span>
            </button>
          </div>
        </section>

        <section v-if="theaters.length" class="theater-timeline">
          <article v-for="(theater, index) in theaters" :key="theater.id" class="theater-timeline-item">
            <div class="theater-timeline-stamp" aria-hidden="true">
              <span>{{ formatTheaterMonth(theaterTimestamp(theater)) }}</span>
              <strong>{{ formatTheaterDay(theaterTimestamp(theater)) }}</strong>
              <i></i>
            </div>
            <div class="theater-card" role="button" tabindex="0" @click="openTheater(theater.id)" @keydown.enter.prevent="openTheater(theater.id)">
              <span class="theater-card-content">
                <small>STORY {{ formatTheaterSequence(index) }} · {{ theater.topicTitle }}</small>
                <strong>{{ theater.title }}</strong>
                <em>{{ theater.summary }}</em>
              </span>
              <span class="theater-card-footer">
                <time>{{ formatTheaterClock(theaterTimestamp(theater)) }}</time>
                <span>Open theater <ArrowUpRight :size="14" stroke-width="2" /></span>
              </span>
              <span class="theater-card-actions" aria-label="小剧场操作">
                <button class="theater-card-action" type="button" aria-label="转发小剧场" title="转发" @click.stop="openForwardTheater(theater.id)">
                  <Send :size="15" stroke-width="2.2" />
                </button>
                <button class="theater-card-action" type="button" aria-label="更新小剧场" title="更新" :disabled="Boolean(updatingTheaterId)" :aria-busy="updatingTheaterId === theater.id" @click.stop="openUpdateTheater(theater.id)">
                  <LoaderCircle v-if="updatingTheaterId === theater.id" class="spin" :size="15" />
                  <RefreshCw v-else :size="15" stroke-width="2.2" />
                </button>
                <button class="theater-card-delete" type="button" aria-label="删除小剧场" title="删除" @click.stop="deleteTheater(theater.id)">
                  <Trash2 :size="15" stroke-width="2" />
                </button>
              </span>
            </div>
          </article>
        </section>

        <section v-if="!theaters.length" class="theater-empty">
          <Clapperboard :size="28" />
          <h2>等待第一幕开场</h2>
          <p>选择题材生成后，独立番外会按时间收进这本私人剧场档案。</p>
        </section>
      </section>
      </section>
    </main>

    <nav class="theater-bottom-tabs" aria-label="小剧场页面切换">
      <button type="button" :class="{ active: activeTab === 'topics' }" @click="setActiveTab('topics')">
        <ListChecks :size="20" />
        <span>题材管理</span>
      </button>
      <button type="button" :class="{ active: activeTab === 'cards' }" @click="setActiveTab('cards')">
        <PanelsTopLeft :size="20" />
        <span>剧场时间轴</span>
      </button>
    </nav>

    <AppModal v-model="showGenerateTopicPicker" title="选择生成题材" eyebrow="THEATER TOPICS" fixed-height variant="profile-theme">
      <section class="generate-topic-picker">
        <label class="generate-topic-search">
          <Search :size="16" stroke-width="2" />
          <input v-model="generateTopicSearchQuery" type="search" placeholder="搜索标题或提示词关键词" />
          <span>{{ generateTopicVisibleCount }}</span>
        </label>
        <div class="generate-topic-results">
          <button class="generate-topic-option random-option" :class="{ selected: !selectedTopicId }" type="button" @click="selectGenerateTopic('')">
            <span class="generate-topic-option-mark"><Sparkles :size="17" stroke-width="1.8" /></span>
            <span>
              <small>Surprise me</small>
              <strong>随机启用题材</strong>
            </span>
            <Check v-if="!selectedTopicId" :size="16" stroke-width="2.4" />
          </button>
          <section v-for="group in generateTopicGroups" :key="group.category.id" class="generate-topic-group">
            <header>
              <span>{{ group.category.label }}</span>
              <small>{{ group.items.length }}</small>
            </header>
            <button
              v-for="topic in group.items"
              :key="topic.id"
              class="generate-topic-option"
              :class="{ selected: selectedTopicId === topic.id }"
              type="button"
              @click="selectGenerateTopic(topic.id)"
            >
              <span class="generate-topic-index">{{ smallTheaterTopicArchiveNumber(topic) }}</span>
              <span>
                <small>{{ group.category.kicker }}</small>
                <strong>{{ topic.title }}</strong>
              </span>
              <Check v-if="selectedTopicId === topic.id" :size="16" stroke-width="2.4" />
            </button>
          </section>
          <section v-if="!generateTopicGroups.length" class="generate-topic-empty">
            <Search :size="22" stroke-width="1.6" />
            <strong>没有匹配题材</strong>
            <p>试试“校园”“轮回”“论坛”等关键词。</p>
          </section>
        </div>
      </section>
    </AppModal>

    <AppModal v-model="showTopicEditor" :title="editingTopicId ? '编辑题材' : '新增题材'" eyebrow="SMALL THEATER" variant="profile-theme">
      <form class="topic-editor" @submit.prevent="saveTopicDraft">
        <label>
          <span>题材名称</span>
          <input v-model="topicDraft.title" maxlength="36" placeholder="例如：论坛、群聊、深夜电台" />
        </label>
        <label>
          <span>扩展提示词</span>
          <textarea v-model="topicDraft.prompt" maxlength="8000" rows="6" placeholder="写清楚希望小剧场呈现的形式、语气和互动点。"></textarea>
        </label>
        <label class="topic-editor-switch">
          <input v-model="topicDraft.enabled" type="checkbox" />
          <span>启用这个题材</span>
        </label>
        <div class="topic-editor-actions" :class="{ editing: editingTopicId }">
          <button v-if="editingTopicId" class="danger" type="button" @click="deleteEditingTopic">删除</button>
          <button class="secondary" type="button" @click="showTopicEditor = false">取消</button>
          <button class="primary" type="submit">{{ editingTopicId ? '保存' : '保存' }}</button>
        </div>
      </form>
    </AppModal>

    <AppModal v-if="forwardTheaterTarget" v-model="showForwardModal" title="转发小剧场" :show-header="false" variant="profile-theme">
      <section class="theater-forward-sheet">
        <header>
          <span>Forward</span>
          <h3>转发给角色</h3>
          <p>{{ forwardTheaterTarget.title }}</p>
        </header>
        <button
          v-for="target in forwardTargets"
          :key="target.id"
          type="button"
          :disabled="Boolean(forwardingCharacterId)"
          @click="forwardTheater(target.id)"
        >
          <img :src="target.avatar" :alt="target.name" />
          <span>
            <strong>{{ characterLabel(target) }}</strong>
            <small>{{ forwardingCharacterId === target.id ? '转发中' : '发送为网站链接卡片' }}</small>
          </span>
        </button>
        <p v-if="!forwardTargets.length" class="theater-forward-empty">当前账号还没有绑定可转发的角色。</p>
      </section>
    </AppModal>

    <AppModal v-if="updateTheaterTarget" v-model="showUpdateModal" title="更新小剧场" :show-header="false" variant="profile-theme">
      <form class="theater-update-sheet" @submit.prevent="submitUpdateTheater">
        <header>
          <span>Update</span>
          <h3>更新小剧场</h3>
          <p>{{ updateTheaterTarget.title }}</p>
        </header>
        <label>
          <span>发展方向</span>
          <textarea v-model="updateGuidanceDraft" maxlength="1600" rows="5" placeholder="可选：例如想看后续误会升级、论坛继续扒细节、角色主动回应、转向甜一点或更刺激一点。"></textarea>
        </label>
        <div class="theater-update-actions">
          <button class="secondary" type="button" :disabled="Boolean(updatingTheaterId)" @click="closeUpdateTheater">取消</button>
          <button class="primary" type="submit" :disabled="Boolean(updatingTheaterId)">
            <LoaderCircle v-if="updatingTheaterId" class="spin" :size="16" />
            <span>{{ updateGuidanceDraft.trim() ? '按提示更新' : '直接更新' }}</span>
          </button>
        </div>
      </form>
    </AppModal>

    <AppModal v-model="showTheaterCleanupSettings" title="小剧场清理" eyebrow="SMALL THEATER" variant="profile-theme">
      <section class="theater-cleanup-panel">
        <section class="cleanup-character-card single-character">
          <div class="cleanup-character-top">
            <div class="cleanup-character-head">
              <img :src="character.avatar" :alt="characterLabel(character)" />
              <span>
                <strong>{{ characterLabel(character) }}</strong>
                <small>{{ theaterCleanupSetting.enabled ? `${theaterCleanupSetting.days} 天前自动清理` : '自动清理已关闭' }}</small>
              </span>
            </div>
            <label class="cleanup-switch-card" :aria-label="`${characterLabel(character)} 小剧场自动清理`">
              <input type="checkbox" :checked="theaterCleanupSetting.enabled" @change="updateTheaterCleanupEnabled" />
              <span class="cleanup-switch-track"></span>
            </label>
          </div>
          <div class="cleanup-compact-row character-row">
            <label class="cleanup-select-field">
              <span>早于</span>
              <select :value="theaterCleanupSetting.preset" @change="selectTheaterCleanupPresetFromEvent">
                <option v-for="option in cleanupPresetOptions" :key="`theater-${option.preset}`" :value="option.preset">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="theaterCleanupSetting.preset === 'custom'" class="cleanup-days-field">
              <input :value="theaterCleanupSetting.days" inputmode="numeric" min="1" max="3650" type="number" @change="updateTheaterCleanupCustomDays" />
              <span>天</span>
            </label>
            <button class="cleanup-text-action" type="button" :disabled="theaterCleanupRunning || !theaterCleanupCountForDays(theaterCleanupSetting.days)" @click="cleanupTheaterBySetting">
              清理
            </button>
          </div>
        </section>

        <section class="cleanup-manual-card">
          <div class="cleanup-section-head">
            <span>手动清理</span>
            <small>{{ manualTheaterCleanupCount }} 张可清理</small>
          </div>
          <div class="cleanup-compact-row">
            <label class="cleanup-select-field">
              <span>早于</span>
              <select :value="manualTheaterCleanupPreset" @change="setManualTheaterCleanupPresetFromEvent">
                <option v-for="option in cleanupPresetOptions" :key="`manual-theater-${option.preset}`" :value="option.preset">{{ option.label }}</option>
              </select>
            </label>
            <label v-if="manualTheaterCleanupPreset === 'custom'" class="cleanup-days-field">
              <input v-model.number="manualTheaterCleanupCustomDays" inputmode="numeric" min="1" max="3650" type="number" />
              <span>天</span>
            </label>
            <button class="cleanup-text-action danger" type="button" :disabled="theaterCleanupRunning || !manualTheaterCleanupCount" @click="runManualTheaterCleanup">
              {{ theaterCleanupRunning ? '清理中' : '清理' }}
            </button>
          </div>
        </section>

        <p v-if="theaterCleanupNotice" class="cleanup-notice">{{ theaterCleanupNotice }}</p>
      </section>
    </AppModal>
  </section>

  <section v-else class="screen no-tabs small-theater-page missing-theater">
    <header class="top-bar theater-topbar">
      <button class="theater-title-button" type="button" aria-label="返回" @click="goBack">
        <h1 class="top-title">Small Theater</h1>
      </button>
    </header>
    <section class="theater-empty">
      <Clapperboard :size="28" />
      <h2>没有找到这个小剧场入口</h2>
      <button type="button" @click="router.replace({ name: 'home' })">回到聊天列表</button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowUpRight, Check, Clapperboard, ListChecks, LoaderCircle, PanelsTopLeft, Plus, RefreshCw, Search, Send, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-vue-next';
import AppModal from '@/components/common/AppModal.vue';
import { useAppStore } from '@/stores/appStore';
import type { CharacterProfile, CharacterSmallTheaterAutoCleanupSettings, SmallTheater, SmallTheaterAutoCleanupPreset, SmallTheaterTopic } from '@/types/domain';
import { getCharacterDisplayName } from '@/utils/character';
import { smallTheaterTopicArchiveNumber, smallTheaterTopicCategories, smallTheaterTopicCategoryId } from '@/utils/smallTheaterCategories';
import type { SmallTheaterTopicCategory, SmallTheaterTopicCategoryId } from '@/utils/smallTheaterCategories';

const props = defineProps<{ id: string }>();

const route = useRoute();
const router = useRouter();
const store = useAppStore();

type SmallTheaterTab = 'topics' | 'cards';
type TopicCategorySelection = 'all' | SmallTheaterTopicCategoryId;

const activeTab = ref<SmallTheaterTab>(normalizeTheaterTab(route.query.tab));
const activeTopicCategoryId = ref<TopicCategorySelection>('all');
const topicSearchQuery = ref('');
const showTopicEditor = ref(false);
const editingTopicId = ref<string | null>(null);
const selectedTopicId = ref('');
const showGenerateTopicPicker = ref(false);
const generateTopicSearchQuery = ref('');
const generatingTheater = ref(false);
const updatingTheaterId = ref('');
const showForwardModal = ref(false);
const forwardingTheaterId = ref('');
const forwardingCharacterId = ref('');
const showUpdateModal = ref(false);
const showTheaterCleanupSettings = ref(false);
const theaterCleanupRunning = ref(false);
const theaterCleanupNotice = ref('');
const updateTheaterId = ref('');
const updateGuidanceDraft = ref('');
const manualTheaterCleanupPreset = ref<SmallTheaterAutoCleanupPreset>('7');
const manualTheaterCleanupCustomDays = ref(14);
const topicDraft = reactive({ title: '', prompt: '', enabled: true });

const cleanupPresetOptions: Array<{ preset: SmallTheaterAutoCleanupPreset; label: string; days: number }> = [
  { preset: '3', label: '3天', days: 3 },
  { preset: '7', label: '7天', days: 7 },
  { preset: '30', label: '一个月', days: 30 },
  { preset: 'custom', label: '自定义', days: 14 }
];

const theaterMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const theaterClockFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const conversation = computed(() => store.conversationById(props.id));
const character = computed(() => conversation.value ? store.characterById(conversation.value.charId) : null);
const topics = computed(() => character.value ? store.smallTheaterTopicsForCharacter(character.value.id) : []);
const theaters = computed(() => character.value ? store.smallTheatersForCharacter(character.value.id) : []);
const enabledTopics = computed(() => topics.value.filter((topic) => topic.enabled));
const selectedTopic = computed(() => selectedTopicId.value ? enabledTopics.value.find((topic) => topic.id === selectedTopicId.value) ?? null : null);
const selectedTopicCategoryLabel = computed(() => {
  const topic = selectedTopic.value;
  if (!topic) return 'All active stories';
  return smallTheaterTopicCategories.find((category) => category.id === smallTheaterTopicCategoryId(topic))?.label ?? '自定义';
});
const topicCategoryFilters = computed(() => smallTheaterTopicCategories
  .map((category) => ({ ...category, count: topicsInCategory(category.id).length }))
  .filter((category) => category.count > 0));
const topicGroups = computed(() => {
  const query = topicSearchQuery.value.trim().toLocaleLowerCase();
  const filteredTopics = topics.value.filter((topic) => (
    (activeTopicCategoryId.value === 'all' || smallTheaterTopicCategoryId(topic) === activeTopicCategoryId.value)
    && (!query || `${topic.title}\n${topic.prompt}`.toLocaleLowerCase().includes(query))
  ));
  return groupTopicsByCategory(filteredTopics);
});
const visibleTopicCount = computed(() => topicGroups.value.reduce((count, group) => count + group.items.length, 0));
const generateTopicGroups = computed(() => {
  const query = generateTopicSearchQuery.value.trim().toLocaleLowerCase();
  return groupTopicsByCategory(enabledTopics.value.filter((topic) => (
    !query || `${topic.title}\n${topic.prompt}`.toLocaleLowerCase().includes(query)
  )));
});
const generateTopicVisibleCount = computed(() => generateTopicGroups.value.reduce((count, group) => count + group.items.length, 0));
const forwardTheaterTarget = computed(() => forwardingTheaterId.value ? store.smallTheaterById(forwardingTheaterId.value) : null);
const forwardTargets = computed(() => store.charactersForActiveUser.filter((target) => store.conversationsForActiveUser.some((conversationItem) => conversationItem.charId === target.id)));
const updateTheaterTarget = computed(() => updateTheaterId.value ? store.smallTheaterById(updateTheaterId.value) : null);
const manualTheaterCleanupDays = computed(() => manualTheaterCleanupPreset.value === 'custom'
  ? normalizeTheaterCleanupDays(manualTheaterCleanupCustomDays.value)
  : Number(manualTheaterCleanupPreset.value)
);
const manualTheaterCleanupCount = computed(() => theaterCleanupCountForDays(manualTheaterCleanupDays.value));
const theaterCleanupSetting = computed(() => character.value ? theaterCleanupSettingForCharacter(character.value.id) : defaultTheaterCleanupSetting());

function normalizeTheaterTab(tab: unknown): SmallTheaterTab {
  return tab === 'topics' ? 'topics' : 'cards';
}

function groupTopicsByCategory(items: SmallTheaterTopic[]) {
  const topicsByCategory = new Map<SmallTheaterTopicCategoryId, SmallTheaterTopic[]>();
  items.forEach((topic) => {
    const categoryId = smallTheaterTopicCategoryId(topic);
    topicsByCategory.set(categoryId, [...(topicsByCategory.get(categoryId) ?? []), topic]);
  });
  return smallTheaterTopicCategories
    .map((category): { category: SmallTheaterTopicCategory; items: SmallTheaterTopic[] } => ({
      category,
      items: topicsByCategory.get(category.id) ?? []
    }))
    .filter((group) => group.items.length > 0);
}

function topicsInCategory(categoryId: SmallTheaterTopicCategoryId) {
  return topics.value.filter((topic) => smallTheaterTopicCategoryId(topic) === categoryId);
}

function topicCategoryEnabledState(items: SmallTheaterTopic[]): boolean | 'mixed' {
  const enabledCount = items.filter((topic) => topic.enabled).length;
  if (!enabledCount) return false;
  return enabledCount === items.length ? true : 'mixed';
}

async function toggleTopicCategory(categoryId: SmallTheaterTopicCategoryId) {
  const currentCharacter = character.value;
  const categoryTopics = topicsInCategory(categoryId);
  if (!currentCharacter || !categoryTopics.length) return;
  const enabled = categoryTopics.some((topic) => !topic.enabled);
  await store.setSmallTheaterTopicsEnabledForCharacter(currentCharacter.id, categoryTopics.map((topic) => topic.id), enabled);
}

function theaterTimestamp(theater: SmallTheater) {
  return theater.updatedAt ?? theater.createdAt;
}

function formatTheaterMonth(timestamp: number) {
  if (!timestamp) return '--';
  return theaterMonthFormatter.format(new Date(timestamp)).toUpperCase();
}

function formatTheaterDay(timestamp: number) {
  if (!timestamp) return '--';
  return String(new Date(timestamp).getDate()).padStart(2, '0');
}

function formatTheaterClock(timestamp: number) {
  if (!timestamp) return '未知时间';
  return theaterClockFormatter.format(new Date(timestamp));
}

function formatTheaterSequence(index: number) {
  return String(Math.max(1, theaters.value.length - index)).padStart(2, '0');
}

onMounted(async () => {
  await store.hydrate();
  if (character.value) {
    await store.ensureSmallTheaterTopicsForCharacter(character.value.id);
    await runAutoTheaterCleanupForCurrentCharacter();
  }
});

watch(() => character.value?.id, async (characterId) => {
  if (!characterId) return;
  await store.ensureSmallTheaterTopicsForCharacter(characterId);
  await runAutoTheaterCleanupForCurrentCharacter();
}, { immediate: true });

watch(() => route.query.tab, (tab) => {
  activeTab.value = normalizeTheaterTab(tab);
});

watch(showGenerateTopicPicker, (open) => {
  if (!open) generateTopicSearchQuery.value = '';
});

watch(enabledTopics, (items) => {
  if (selectedTopicId.value && !items.some((topic) => topic.id === selectedTopicId.value)) selectedTopicId.value = '';
});

function setActiveTab(tab: SmallTheaterTab) {
  activeTab.value = tab;
  void router.replace({ query: { ...route.query, tab } });
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.replace({ name: 'chat-room', params: { id: props.id } });
}

function openGenerateTopicPicker() {
  generateTopicSearchQuery.value = '';
  showGenerateTopicPicker.value = true;
}

function selectGenerateTopic(topicId: string) {
  selectedTopicId.value = topicId;
  showGenerateTopicPicker.value = false;
}

function openCreateTopic() {
  editingTopicId.value = null;
  topicDraft.title = '';
  topicDraft.prompt = '';
  topicDraft.enabled = true;
  showTopicEditor.value = true;
}

function openEditTopic(topic: SmallTheaterTopic) {
  editingTopicId.value = topic.id;
  topicDraft.title = topic.title;
  topicDraft.prompt = topic.prompt;
  topicDraft.enabled = topic.enabled;
  showTopicEditor.value = true;
}

async function saveTopicDraft() {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  const title = topicDraft.title.trim();
  const prompt = topicDraft.prompt.trim();
  if (!title) {
    store.showConfigAlert('请填写题材名称。', '无法保存题材');
    return;
  }

  const existingTopic = editingTopicId.value ? topics.value.find((topic) => topic.id === editingTopicId.value) : null;
  if (existingTopic) {
    await store.saveSmallTheaterTopic({ ...existingTopic, title, prompt });
    await store.setSmallTheaterTopicEnabledForCharacter(currentCharacter.id, existingTopic.id, topicDraft.enabled);
  } else {
    const createdTopic = await store.createSmallTheaterTopic({ charId: currentCharacter.id, title, prompt });
    if (createdTopic) await store.setSmallTheaterTopicEnabledForCharacter(currentCharacter.id, createdTopic.id, topicDraft.enabled);
  }
  showTopicEditor.value = false;
}

async function toggleTopic(topic: SmallTheaterTopic) {
  const currentCharacter = character.value;
  if (!currentCharacter) return;
  await store.setSmallTheaterTopicEnabledForCharacter(currentCharacter.id, topic.id, !topic.enabled);
}

async function deleteTopic(topic: SmallTheaterTopic) {
  if (!window.confirm(`删除题材“${topic.title}”？已生成的小剧场卡片会保留。`)) return false;
  await store.deleteSmallTheaterTopic(topic.id);
  return true;
}

async function deleteEditingTopic() {
  const topic = editingTopicId.value ? topics.value.find((item) => item.id === editingTopicId.value) : null;
  if (!topic) return;
  const deleted = await deleteTopic(topic);
  if (!deleted) return;
  editingTopicId.value = null;
  showTopicEditor.value = false;
}

async function generateTheater() {
  if (generatingTheater.value) return;
  generatingTheater.value = true;
  try {
    const theater = await store.createSmallTheaterFromConversation(props.id, selectedTopicId.value || undefined);
    if (theater) await router.push({ name: 'small-theater-detail', params: { theaterId: theater.id } });
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '小剧场生成失败。', '无法生成小剧场');
  } finally {
    generatingTheater.value = false;
  }
}

function openTheater(theaterId: string) {
  void router.push({ name: 'small-theater-detail', params: { theaterId } });
}

function characterLabel(target: CharacterProfile) {
  return getCharacterDisplayName(target);
}

function normalizeTheaterCleanupDays(value: unknown) {
  const days = Math.round(Number(value) || 0);
  return Math.min(3650, Math.max(1, days || 7));
}

function defaultTheaterCleanupSetting(): CharacterSmallTheaterAutoCleanupSettings {
  return { enabled: false, days: 7, preset: '7', lastCleanupAt: 0 };
}

function theaterCleanupSettingForCharacter(characterId: string): CharacterSmallTheaterAutoCleanupSettings {
  return store.settings?.smallTheaterAutoCleanup?.[characterId] ?? defaultTheaterCleanupSetting();
}

function theaterCleanupCountForDays(olderThanDays: number) {
  const cutoff = Date.now() - normalizeTheaterCleanupDays(olderThanDays) * 24 * 60 * 60 * 1000;
  return theaters.value.filter((theater) => (theater.updatedAt ?? theater.createdAt) < cutoff).length;
}

async function saveTheaterCleanupSetting(patch: Partial<CharacterSmallTheaterAutoCleanupSettings>) {
  const currentCharacter = character.value;
  if (!currentCharacter || !store.settings) return;
  const current = theaterCleanupSettingForCharacter(currentCharacter.id);
  const nextDays = normalizeTheaterCleanupDays(patch.days ?? current.days);
  const nextSetting: CharacterSmallTheaterAutoCleanupSettings = {
    ...current,
    ...patch,
    days: nextDays,
    preset: patch.preset ?? current.preset,
    lastCleanupAt: Math.max(0, Number(patch.lastCleanupAt ?? current.lastCleanupAt) || 0)
  };
  await store.saveSettings({
    ...store.settings,
    smallTheaterAutoCleanup: {
      ...store.settings.smallTheaterAutoCleanup,
      [currentCharacter.id]: nextSetting
    }
  });
}

function openTheaterCleanupSettings() {
  theaterCleanupNotice.value = '';
  showTheaterCleanupSettings.value = true;
}

async function updateTheaterCleanupEnabled(event: Event) {
  await saveTheaterCleanupSetting({ enabled: (event.target as HTMLInputElement).checked });
}

async function selectTheaterCleanupPreset(preset: SmallTheaterAutoCleanupPreset, days: number) {
  await saveTheaterCleanupSetting({ preset, days: preset === 'custom' ? theaterCleanupSetting.value.days : days });
}

async function selectTheaterCleanupPresetFromEvent(event: Event) {
  const preset = (event.target as HTMLSelectElement).value as SmallTheaterAutoCleanupPreset;
  const option = cleanupPresetOptions.find((entry) => entry.preset === preset) ?? cleanupPresetOptions[1];
  await selectTheaterCleanupPreset(option.preset, option.days);
}

async function updateTheaterCleanupCustomDays(event: Event) {
  await saveTheaterCleanupSetting({ preset: 'custom', days: normalizeTheaterCleanupDays((event.target as HTMLInputElement).value) });
}

function setManualTheaterCleanupPresetFromEvent(event: Event) {
  manualTheaterCleanupPreset.value = (event.target as HTMLSelectElement).value as SmallTheaterAutoCleanupPreset;
}

async function runManualTheaterCleanup() {
  const currentCharacter = character.value;
  if (theaterCleanupRunning.value || !currentCharacter) return;
  theaterCleanupRunning.value = true;
  theaterCleanupNotice.value = '';
  try {
    const count = await store.cleanupSmallTheatersForCharacters([currentCharacter.id], manualTheaterCleanupDays.value);
    theaterCleanupNotice.value = count ? `已清理 ${count} 张小剧场。` : '没有需要清理的小剧场。';
  } finally {
    theaterCleanupRunning.value = false;
  }
}

async function cleanupTheaterBySetting() {
  const currentCharacter = character.value;
  if (theaterCleanupRunning.value || !currentCharacter) return;
  theaterCleanupRunning.value = true;
  theaterCleanupNotice.value = '';
  try {
    const count = await store.cleanupSmallTheatersForCharacters([currentCharacter.id], theaterCleanupSetting.value.days);
    theaterCleanupNotice.value = count ? `已清理 ${count} 张小剧场。` : '没有需要清理的小剧场。';
  } finally {
    theaterCleanupRunning.value = false;
  }
}

async function runAutoTheaterCleanupForCurrentCharacter() {
  const currentCharacter = character.value;
  if (theaterCleanupRunning.value || !currentCharacter) return;
  theaterCleanupRunning.value = true;
  try {
    await store.runSmallTheaterAutoCleanupForCharacters([currentCharacter.id]);
  } finally {
    theaterCleanupRunning.value = false;
  }
}

function openForwardTheater(theaterId: string) {
  forwardingTheaterId.value = theaterId;
  showForwardModal.value = true;
}

async function forwardTheater(characterId: string) {
  if (forwardingCharacterId.value || !forwardingTheaterId.value) return;
  forwardingCharacterId.value = characterId;
  try {
    const message = await store.forwardSmallTheaterToCharacter(forwardingTheaterId.value, characterId);
    if (!message) return;
    showForwardModal.value = false;
    store.showConfigAlert('已作为网站链接卡片转发到对应线上聊天。', '转发成功');
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '小剧场转发失败。', '无法转发小剧场');
  } finally {
    forwardingCharacterId.value = '';
  }
}

function openUpdateTheater(theaterId: string) {
  updateTheaterId.value = theaterId;
  updateGuidanceDraft.value = '';
  showUpdateModal.value = true;
}

function closeUpdateTheater() {
  if (updatingTheaterId.value) return;
  showUpdateModal.value = false;
  updateTheaterId.value = '';
  updateGuidanceDraft.value = '';
}

async function submitUpdateTheater() {
  if (updatingTheaterId.value || !updateTheaterId.value) return;
  const theaterId = updateTheaterId.value;
  const guidance = updateGuidanceDraft.value.trim();
  updatingTheaterId.value = theaterId;
  try {
    const theater = await store.continueSmallTheater(theaterId, guidance || undefined);
    if (theater) {
      showUpdateModal.value = false;
      updateTheaterId.value = '';
      updateGuidanceDraft.value = '';
      store.showConfigAlert('已生成新的小剧场 HTML 卡片，原卡片已保留。', '更新成功');
    }
  } catch (error) {
    store.showConfigAlert(error instanceof Error ? error.message : '小剧场更新失败。', '无法更新小剧场');
  } finally {
    updatingTheaterId.value = '';
  }
}

async function deleteTheater(theaterId: string) {
  if (!window.confirm('删除这个小剧场卡片？')) return;
  await store.deleteSmallTheater(theaterId);
}

</script>

<style scoped>
.small-theater-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-bottom: 0;
  background:
    radial-gradient(circle at 8% 0%, rgba(255, 218, 227, 0.58), transparent 30%),
    radial-gradient(circle at 96% 8%, rgba(6, 199, 85, 0.16), transparent 28%),
    linear-gradient(180deg, #fbfcfb 0%, #f5f7f6 54%, #edf3f1 100%);
  color: #151719;
}

.theater-topbar {
  align-items: center;
  justify-content: space-between;
  background: rgba(251, 252, 251, 0.9);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.theater-title-button {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  margin-right: auto;
  padding: 0;
  color: inherit;
}

.theater-title-button .top-title {
  margin: 0;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
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
  color: #111111;
}

.theater-main {
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

.theater-panel {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  font-size: 12px;
}

.theater-section {
  display: grid;
  gap: 0;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14px 36px rgba(21, 30, 26, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.92);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.theater-section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px 8px;
}

.theater-section-head p,
.theater-section-head h2 {
  margin: 0;
}

.section-kicker {
  color: #8b928c;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theater-section-head h2 {
  margin-top: 2px;
  color: #111111;
  font-size: 17px;
  line-height: 1.25;
}

.section-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: #f6f7f7;
  color: #171717;
  font-size: 11px;
  font-weight: 900;
}

.topic-card,
.generate-panel,
.theater-card,
.theater-empty {
  min-width: 0;
  border: 1px solid rgba(20, 24, 22, 0.05);
  border-radius: 16px;
  background: #f6f7f7;
  box-shadow: none;
}

.topic-card {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 8px 2px;
  border: 0;
  border-bottom: 1px solid rgba(20, 24, 22, 0.06);
  border-radius: 0;
  background: transparent;
  cursor: pointer;
}

.topic-card:last-of-type {
  border-bottom: 0;
}

.topic-card.disabled {
  opacity: 0.58;
}

.topic-title {
  display: block;
  margin: 0;
  min-width: 0;
  overflow: hidden;
  color: #111111;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topic-switch {
  width: 38px;
  height: 22px;
  padding: 0;
  border-radius: 999px;
  background: #e6ebe8;
  box-shadow: inset 0 0 0 1px rgba(120, 128, 122, 0.12);
  transition: background 0.18s ease, box-shadow 0.18s ease;
}

.topic-switch span {
  display: block;
  width: 18px;
  height: 18px;
  margin: 2px 0 0 2px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(42, 35, 31, 0.18);
  transition: transform 0.18s ease;
}

.topic-switch.active {
  background: #c9ecd5;
  box-shadow: inset 0 0 0 1px rgba(91, 174, 120, 0.3);
}

.topic-switch.active span {
  transform: translateX(16px);
}

.theater-card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.theater-card-action,
.theater-card-delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: transparent;
  color: #4f9f6a;
}

.theater-card-action:disabled {
  opacity: 0.52;
}

.theater-card-action:active,
.theater-card-delete:active {
  background: rgba(201, 236, 213, 0.24);
}

.generate-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(108px, 116px);
  align-items: end;
  gap: 8px;
  padding: 12px;
}

.generate-panel label,
.topic-editor label {
  display: grid;
  gap: 7px;
  color: #5f6761;
  font-size: 12px;
  font-weight: 900;
}

.generate-panel select,
.topic-editor input,
.topic-editor textarea {
  width: 100%;
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 14px;
  background: #ffffff;
  color: #151719;
  font: inherit;
  box-shadow: none;
}

.generate-panel select,
.topic-editor input {
  height: 44px;
  padding: 0 12px;
}

.topic-editor textarea {
  min-height: 130px;
  padding: 10px 12px;
  resize: vertical;
}

.generate-button,
.theater-empty button,
.topic-editor-actions .primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  flex-wrap: nowrap;
  min-height: 42px;
  min-width: 0;
  padding: 0 12px;
  border-radius: 12px;
  background: #c9ecd5;
  color: #24613a;
  font-weight: 900;
  white-space: nowrap;
}

.generate-button {
  width: 100%;
}

.generate-button span,
.topic-editor-actions button {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generate-button:disabled {
  opacity: 0.5;
}

.spin {
  animation: theater-spin 0.8s linear infinite;
}

.theater-card {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 62px;
  padding: 12px 104px 12px 14px;
  border-color: rgba(129, 171, 145, 0.14);
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 252, 249, 0.92) 100%);
  box-shadow: 0 10px 24px rgba(36, 70, 47, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.86);
  text-align: left;
  cursor: pointer;
}

.theater-card:active {
  transform: translateY(1px);
  box-shadow: 0 6px 16px rgba(36, 70, 47, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.86);
}

.theater-topic-group {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-top: 8px;
}

.theater-topic-group + .theater-topic-group {
  margin-top: 2px;
  padding-top: 12px;
  border-top: 1px solid rgba(20, 24, 22, 0.06);
}

.theater-topic-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 2px;
  color: #7b625f;
  font-size: 11px;
  font-weight: 900;
}

.theater-topic-group-head span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-topic-group-head em {
  flex: 0 0 auto;
  min-width: 22px;
  height: 20px;
  border-radius: 999px;
  background: rgba(201, 236, 213, 0.48);
  color: #2f7b49;
  font-size: 10px;
  font-style: normal;
  line-height: 20px;
  text-align: center;
}

.theater-card-content {
  display: grid;
  gap: 5px;
  min-width: 0;
}

.theater-card-content strong,
.theater-card-content em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-card-content strong {
  color: #151719;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
}

.theater-card-content em {
  color: #8a928c;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
}

.theater-forward-sheet {
  display: grid;
  gap: 10px;
  color: #111827;
}

.theater-forward-sheet header {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding-bottom: 4px;
}

.theater-forward-sheet header span {
  color: #7b828c;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theater-forward-sheet h3,
.theater-forward-sheet p {
  margin: 0;
}

.theater-forward-sheet h3 {
  font-size: 18px;
  font-weight: 950;
  line-height: 1.25;
}

.theater-forward-sheet header p {
  color: #69717b;
  font-size: 12px;
  font-weight: 720;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.theater-forward-sheet button {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 58px;
  padding: 8px;
  border-radius: 14px;
  background: #f6f7f8;
  color: #111827;
  text-align: left;
}

.theater-forward-sheet button:disabled {
  opacity: 0.72;
}

.theater-forward-sheet img {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
}

.theater-forward-sheet button span {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.theater-forward-sheet strong,
.theater-forward-sheet small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-forward-sheet strong {
  font-size: 13px;
  font-weight: 900;
}

.theater-forward-sheet small,
.theater-forward-empty {
  color: #69717b;
  font-size: 11px;
  font-weight: 720;
}

.theater-update-sheet {
  display: grid;
  gap: 12px;
  color: #111827;
}

.theater-update-sheet header {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.theater-update-sheet header span {
  color: #7b828c;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.theater-update-sheet h3,
.theater-update-sheet p {
  margin: 0;
}

.theater-update-sheet h3 {
  font-size: 18px;
  font-weight: 950;
  line-height: 1.25;
}

.theater-update-sheet header p {
  color: #69717b;
  font-size: 12px;
  font-weight: 720;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.theater-update-sheet label {
  display: grid;
  gap: 7px;
  color: #5f6761;
  font-size: 12px;
  font-weight: 900;
}

.theater-update-sheet textarea {
  width: 100%;
  min-height: 128px;
  padding: 11px 12px;
  border: 1px solid rgba(42, 75, 60, 0.08);
  border-radius: 14px;
  background: #f6f7f8;
  color: #151719;
  font: inherit;
  font-size: 16px;
  line-height: 1.45;
  resize: vertical;
}

.theater-update-actions {
  display: grid;
  grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
  gap: 8px;
}

.theater-update-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 0;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  font-weight: 900;
  white-space: nowrap;
}

.theater-update-actions button span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.theater-update-actions .secondary {
  background: #f1f3f2;
  color: #5f6761;
}

.theater-update-actions .primary {
  background: #c9ecd5;
  color: #24613a;
}

.theater-update-actions button:disabled {
  opacity: 0.58;
}

.theater-cleanup-panel {
  display: grid;
  gap: 12px;
  color: #151719;
}

.cleanup-manual-card,
.cleanup-character-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 13px 0;
  border-top: 1px solid rgba(17, 17, 17, 0.06);
  background: transparent;
}

.cleanup-character-card.single-character {
  padding-top: 0;
  border-top: 0;
}

.cleanup-section-head,
.cleanup-character-top,
.cleanup-character-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-width: 0;
}

.cleanup-section-head span {
  color: #202329;
  font-size: 13px;
  font-weight: 900;
}

.cleanup-section-head small,
.cleanup-notice {
  color: #767b82;
  font-size: 12px;
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
  background: #f1f3f2;
}

.cleanup-character-head span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.cleanup-character-head strong,
.cleanup-character-head small {
  min-width: 0;
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
  background: #06c755;
}

.cleanup-switch-card input:checked + .cleanup-switch-track::after {
  transform: translateX(16px);
}

.cleanup-notice {
  margin: 0;
  text-align: center;
}

.theater-empty {
  display: grid;
  place-items: center;
  gap: 8px;
  min-height: 210px;
  padding: 22px;
  color: #69706a;
  text-align: center;
}

.theater-empty h2,
.theater-empty p {
  margin: 0;
}

.theater-empty h2 {
  color: #111111;
  font-size: 16px;
  font-weight: 900;
}

.theater-empty p {
  max-width: 260px;
  font-size: 13px;
  line-height: 1.55;
}

.theater-bottom-tabs {
  position: relative;
  z-index: 20;
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 8px calc(12px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(12px + var(--safe-left));
  border-top: 1px solid rgba(17, 17, 17, 0.05);
  background: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.theater-bottom-tabs button {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 48px;
  padding: 6px 4px;
  border-radius: 14px;
  color: #69706a;
  font-size: 10px;
  font-weight: 800;
}

.theater-bottom-tabs button span {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.theater-bottom-tabs button.active {
  background: #eef8f1;
  color: #111111;
}

.topic-editor {
  display: grid;
  gap: 14px;
}

.topic-editor-switch {
  display: flex !important;
  align-items: center;
  gap: 9px !important;
}

.topic-editor-switch input {
  display: inline-grid;
  place-items: center;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 1px solid rgba(91, 174, 120, 0.34);
  border-radius: 50%;
  appearance: none;
  background: #ffffff;
  box-shadow: inset 0 0 0 2px #ffffff;
}

.topic-editor-switch input:checked {
  background: #c9ecd5;
  border-color: #8dd5a5;
}

.topic-editor-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.topic-editor-actions.editing {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.topic-editor-actions .secondary,
.topic-editor-actions .danger {
  min-width: 0;
  min-height: 42px;
  border-radius: 14px;
  background: rgba(17, 17, 17, 0.06);
  color: #111111;
  font-weight: 900;
}

.topic-editor-actions .danger {
  background: rgba(201, 236, 213, 0.36);
  color: #2f7b49;
}

.missing-theater {
  min-height: var(--app-height);
}

@keyframes theater-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 360px) {
  .theater-topbar {
    gap: 8px;
  }

  .theater-main {
    padding-inline: 12px;
  }

  .theater-bottom-tabs {
    gap: 3px;
    padding-inline: calc(8px + var(--safe-left));
    padding-right: calc(8px + var(--safe-right));
  }

  .theater-bottom-tabs button {
    min-height: 46px;
    border-radius: 12px;
    font-size: 9px;
  }
}

.small-theater-page {
  background:
    radial-gradient(circle at 88% 3%, rgba(234, 214, 204, 0.38), transparent 25%),
    linear-gradient(180deg, #f8f5f0 0%, #f6f3ee 58%, #f9f7f3 100%);
  color: #302b29;
}

.theater-topbar {
  background: rgba(248, 245, 240, 0.88);
}

.header-action-button {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.64);
  color: #53453f;
  box-shadow: 0 8px 22px rgba(79, 60, 52, 0.045);
}

.theater-main {
  padding: 12px calc(12px + var(--safe-right)) 18px calc(12px + var(--safe-left));
}

.theater-panel {
  gap: 16px;
}

.theater-section {
  gap: 16px;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.theater-editorial-head {
  align-items: flex-start;
  padding: 10px 4px 8px;
}

.theater-editorial-head > div {
  display: grid;
  gap: 2px;
}

.theater-editorial-head .section-kicker {
  color: #a68e83;
  font-size: 8px;
  letter-spacing: 0.2em;
}

.theater-editorial-head h2 {
  margin-top: 1px;
  color: #302b29;
  font-family: Georgia, "Songti SC", serif;
  font-size: 27px;
  font-weight: 600;
  letter-spacing: -0.04em;
}

.theater-section-intro {
  margin: 4px 0 0;
  color: #9b8f88;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.theater-editorial-count {
  display: grid;
  gap: 0;
  width: 66px;
  height: 56px;
  padding: 0;
  border: 1px solid rgba(123, 100, 89, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: 0 12px 30px rgba(87, 68, 59, 0.06);
}

.theater-editorial-count strong {
  color: #4a403b;
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: 500;
  line-height: 1;
}

.theater-editorial-count small {
  color: #ad9a90;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.topic-library-tools {
  display: grid;
  gap: 10px;
}

.topic-search-field {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 0 13px;
  border: 1px solid rgba(132, 104, 91, 0.08);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.66);
  color: #9b867c;
  box-shadow: 0 10px 26px rgba(80, 61, 53, 0.04);
}

.topic-search-field input {
  min-width: 0;
  height: 42px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #493e39;
  font: inherit;
  font-size: 12px;
}

.topic-search-field input::-webkit-search-cancel-button {
  display: none;
}

.topic-search-field > span {
  color: #b09b91;
  font-family: Georgia, serif;
  font-size: 10px;
}

.topic-category-tabs {
  display: flex;
  gap: 7px;
  margin: 0 -12px;
  padding: 0 12px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.topic-category-tabs::-webkit-scrollbar {
  display: none;
}

.topic-category-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(130, 102, 90, 0.07);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.54);
  color: #8d7c74;
  font-size: 10px;
  font-weight: 850;
}

.topic-category-tabs button small {
  color: #b29e94;
  font-family: Georgia, serif;
  font-size: 8px;
}

.topic-category-tabs button.active {
  border-color: #574942;
  background: #574942;
  color: #ffffff;
  box-shadow: 0 9px 20px rgba(73, 55, 47, 0.12);
}

.topic-category-tabs button.active small {
  color: rgba(255, 255, 255, 0.68);
}

.topic-category-group {
  display: grid;
  gap: 10px;
  min-width: 0;
  content-visibility: auto;
  contain-intrinsic-size: 300px;
}

.topic-category-group + .topic-category-group {
  padding-top: 5px;
}

.topic-category-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 3px;
}

.topic-category-head > div {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.topic-category-head small {
  color: #b0978b;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.topic-category-head strong {
  color: #4a3e39;
  font-family: Georgia, "Songti SC", serif;
  font-size: 16px;
  font-weight: 600;
}

.topic-category-controls {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.topic-category-controls em {
  color: #a69389;
  font-family: Georgia, serif;
  font-size: 9px;
  font-style: normal;
}

.topic-category-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.topic-card {
  position: relative;
  display: grid;
  grid-template-columns: 31px minmax(0, 1fr);
  align-items: center;
  gap: 9px;
  min-height: 82px;
  padding: 12px 38px 12px 11px;
  overflow: hidden;
  border: 1px solid rgba(131, 105, 93, 0.075);
  border-radius: 21px 21px 8px 21px;
  background:
    radial-gradient(circle at 100% 0%, rgba(226, 207, 197, 0.42), transparent 31%),
    rgba(255, 255, 255, 0.68);
  box-shadow: 0 12px 27px rgba(81, 63, 55, 0.055);
}

.topic-card:nth-child(3n + 2) {
  background:
    radial-gradient(circle at 100% 0%, rgba(214, 218, 207, 0.48), transparent 31%),
    rgba(255, 255, 255, 0.68);
}

.topic-card:nth-child(3n) {
  background:
    radial-gradient(circle at 100% 0%, rgba(224, 214, 203, 0.5), transparent 31%),
    rgba(255, 255, 255, 0.68);
}

.topic-card:last-of-type {
  border-bottom: 1px solid rgba(131, 105, 93, 0.075);
}

.topic-card.disabled {
  opacity: 0.5;
}

.topic-archive-number {
  display: grid;
  place-items: center;
  min-height: 38px;
  border-right: 1px solid rgba(131, 105, 93, 0.1);
  color: #ad9589;
  font-family: Georgia, serif;
  font-size: 9px;
}

.topic-card-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.topic-card-copy small {
  overflow: hidden;
  color: #b09183;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.topic-title {
  color: #483d39;
  font-family: Georgia, "Songti SC", serif;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.35;
}

.topic-card > .topic-switch {
  position: absolute;
  top: 10px;
  right: 9px;
}

.topic-switch {
  width: 34px;
  height: 20px;
  background: #d9d0ca;
  box-shadow: none;
}

.topic-switch span {
  width: 16px;
  height: 16px;
  margin: 2px 0 0 2px;
}

.topic-switch.active {
  background: #8f766b;
  box-shadow: none;
}

.topic-switch.active span {
  transform: translateX(14px);
}

.topic-switch.mixed {
  background: #c2aea4;
}

.topic-switch.mixed span {
  transform: translateX(7px);
}

.topic-category-switch {
  width: 38px;
  height: 22px;
}

.topic-category-switch span {
  width: 18px;
  height: 18px;
}

.topic-category-switch.active span {
  transform: translateX(16px);
}

.compact-topic-empty {
  min-height: 240px;
  background: rgba(255, 255, 255, 0.5);
}

.theater-archive-section {
  gap: 16px;
}

.generate-panel {
  grid-template-columns: minmax(0, 1fr);
  gap: 14px;
  padding: 16px;
  border: 1px solid rgba(131, 105, 93, 0.075);
  border-radius: 27px 27px 27px 9px;
  background:
    radial-gradient(circle at 100% 0%, rgba(228, 205, 194, 0.5), transparent 32%),
    rgba(255, 255, 255, 0.62);
  box-shadow: 0 16px 36px rgba(81, 63, 55, 0.06);
}

.generate-panel-head {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  align-items: center;
  gap: 11px;
}

.generate-panel-mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 17px 17px 17px 6px;
  background: #eaded8;
  color: #775f55;
}

.generate-panel-head > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.generate-panel-head small {
  color: #a18478;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

.generate-panel-head strong {
  color: #443936;
  font-family: Georgia, "Songti SC", serif;
  font-size: 17px;
  font-weight: 600;
}

.generate-panel-head p {
  margin: 0;
  color: #95877f;
  font-size: 9px;
}

.generate-panel-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(116px, 126px);
  gap: 9px;
}

.generate-topic-trigger {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-width: 0;
  min-height: 48px;
  padding: 7px 11px;
  border: 1px solid rgba(128, 100, 88, 0.09);
  border-radius: 16px;
  background: #f5eee9;
  color: #8b756b;
  text-align: left;
}

.generate-topic-trigger > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.generate-topic-trigger small,
.generate-topic-trigger strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generate-topic-trigger small {
  color: #a38f85;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.generate-topic-trigger strong {
  color: #4b3f3a;
  font-size: 11px;
  font-weight: 850;
}

.generate-button {
  min-height: 48px;
  border-radius: 16px;
  background: #574942;
  color: #ffffff;
  box-shadow: 0 9px 21px rgba(73, 55, 47, 0.12);
  font-size: 10px;
}

.generate-topic-picker {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
  min-height: 0;
  color: #443a36;
}

.generate-topic-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 9px;
  min-height: 44px;
  padding: 0 13px;
  border: 1px solid rgba(132, 104, 91, 0.09);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.68);
  color: #9b867c;
}

.generate-topic-search input {
  min-width: 0;
  height: 42px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #493e39;
  font: inherit;
}

.generate-topic-search input::-webkit-search-cancel-button {
  display: none;
}

.generate-topic-search > span {
  color: #ad998f;
  font-family: Georgia, serif;
  font-size: 9px;
}

.generate-topic-results {
  display: grid;
  align-content: start;
  gap: 12px;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}

.generate-topic-results::-webkit-scrollbar {
  display: none;
}

.generate-topic-group {
  display: grid;
  gap: 7px;
  content-visibility: auto;
  contain-intrinsic-size: 220px;
}

.generate-topic-group > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 3px;
}

.generate-topic-group > header span {
  color: #7d6960;
  font-family: Georgia, "Songti SC", serif;
  font-size: 13px;
  font-weight: 600;
}

.generate-topic-group > header small {
  color: #ad998f;
  font-family: Georgia, serif;
  font-size: 8px;
}

.generate-topic-option {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 58px;
  padding: 9px 11px;
  border: 1px solid rgba(128, 100, 88, 0.07);
  border-radius: 19px 19px 19px 7px;
  background: rgba(255, 255, 255, 0.56);
  color: #8f796f;
  text-align: left;
}

.generate-topic-option.selected {
  border-color: rgba(121, 92, 79, 0.22);
  background: #ede1db;
  color: #6e554a;
}

.generate-topic-option > span:nth-child(2) {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.generate-topic-option small,
.generate-topic-option strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.generate-topic-option small {
  color: #aa9084;
  font-size: 6px;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.generate-topic-option strong {
  color: #493e39;
  font-family: Georgia, "Songti SC", serif;
  font-size: 12px;
  font-weight: 600;
}

.generate-topic-index,
.generate-topic-option-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 12px 12px 12px 5px;
  background: #f2e9e4;
  color: #92776b;
  font-family: Georgia, serif;
  font-size: 8px;
}

.random-option {
  background:
    radial-gradient(circle at 100% 0%, rgba(226, 205, 194, 0.46), transparent 31%),
    rgba(255, 255, 255, 0.62);
}

.generate-topic-empty {
  display: grid;
  place-items: center;
  gap: 5px;
  min-height: 220px;
  color: #a18f86;
  text-align: center;
}

.generate-topic-empty strong {
  color: #4a3e39;
  font-family: Georgia, "Songti SC", serif;
  font-size: 16px;
  font-weight: 600;
}

.generate-topic-empty p {
  margin: 0;
  font-size: 10px;
}

.theater-timeline {
  position: relative;
  display: grid;
  gap: 18px;
  padding: 3px 0 26px;
}

.theater-timeline::before {
  content: '';
  position: absolute;
  top: 15px;
  bottom: 12px;
  left: 27px;
  width: 1px;
  background: linear-gradient(180deg, rgba(170, 145, 132, 0.16), rgba(170, 145, 132, 0.46) 16%, rgba(170, 145, 132, 0.16));
}

.theater-timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  align-items: start;
  gap: 10px;
  min-width: 0;
}

.theater-timeline-stamp {
  position: relative;
  z-index: 1;
  display: grid;
  justify-items: center;
  padding-top: 9px;
  color: #76655c;
}

.theater-timeline-stamp span {
  color: #ab958a;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.theater-timeline-stamp strong {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.1;
}

.theater-timeline-stamp i {
  width: 7px;
  height: 7px;
  margin-top: 7px;
  border: 2px solid #f8f5f0;
  border-radius: 50%;
  background: #c8aa9b;
  box-shadow: 0 0 0 1px rgba(155, 126, 113, 0.24);
}

.theater-timeline .theater-card {
  position: relative;
  display: grid;
  gap: 14px;
  min-height: 148px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(131, 105, 93, 0.08);
  border-radius: 25px 25px 25px 8px;
  background:
    radial-gradient(circle at 100% 0%, rgba(229, 210, 200, 0.38), transparent 30%),
    rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 36px rgba(81, 63, 55, 0.075);
}

.theater-card-content {
  align-content: start;
  gap: 5px;
  padding-right: 86px;
}

.theater-card-content small {
  overflow: hidden;
  color: #b09285;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.theater-card-content strong {
  color: #3b3230;
  font-family: Georgia, "Songti SC", serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.theater-card-content em {
  display: -webkit-box;
  color: #8b7e78;
  font-size: 10px;
  line-height: 1.6;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.theater-card-actions {
  top: 10px;
  right: 10px;
  gap: 3px;
}

.theater-card-action,
.theater-card-delete {
  width: 27px;
  height: 27px;
  background: rgba(255, 255, 255, 0.56);
  color: #a58f85;
}

.theater-card-action:active,
.theater-card-delete:active {
  background: rgba(131, 99, 87, 0.1);
  color: #755f56;
}

.theater-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid rgba(126, 101, 90, 0.09);
}

.theater-card-footer time {
  color: #a79992;
  font-family: Georgia, serif;
  font-size: 9px;
  letter-spacing: 0.08em;
}

.theater-card-footer > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #705d55;
  font-size: 7px;
  font-weight: 900;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.theater-empty {
  min-height: min(52vh, 460px);
  border-color: rgba(131, 105, 93, 0.06);
  border-radius: 26px 26px 26px 9px;
  background: rgba(255, 255, 255, 0.48);
  color: #978b85;
}

.theater-empty h2 {
  color: #443a36;
  font-family: Georgia, "Songti SC", serif;
  font-size: 20px;
  font-weight: 600;
}

.theater-empty p {
  color: #978b85;
  font-size: 11px;
}

.theater-empty button {
  border-radius: 999px;
  background: #574942;
  color: #ffffff;
}

.theater-bottom-tabs {
  border-top-color: rgba(99, 77, 67, 0.05);
  background: rgba(253, 251, 248, 0.94);
}

.theater-bottom-tabs button.active {
  background: #efe5df;
  color: #4e403a;
}

.topic-editor,
.theater-forward-sheet,
.theater-update-sheet,
.theater-cleanup-panel {
  color: #443a36;
}

.topic-editor label,
.theater-update-sheet label {
  color: #7f6b62;
  font-size: 10px;
  letter-spacing: 0.04em;
}

.topic-editor input,
.topic-editor textarea,
.theater-update-sheet textarea {
  border: 1px solid rgba(128, 100, 88, 0.1);
  border-radius: 16px;
  outline: 0;
  background: rgba(255, 255, 255, 0.68);
  color: #443a36;
  box-shadow: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.topic-editor input:focus,
.topic-editor textarea:focus,
.theater-update-sheet textarea:focus {
  border-color: rgba(139, 108, 94, 0.28);
  box-shadow: 0 0 0 3px rgba(166, 135, 121, 0.08);
}

.topic-editor-switch {
  padding: 12px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.54);
}

.topic-editor-switch input {
  border-color: rgba(143, 118, 107, 0.3);
  accent-color: #8f766b;
}

.topic-editor-switch input:checked {
  border-color: #9e8276;
  background: #9e8276;
}

.topic-editor-actions button,
.theater-update-actions button {
  min-height: 42px;
  border-radius: 999px;
}

.topic-editor-actions .secondary,
.theater-update-actions .secondary {
  background: #e9dfd9;
  color: #6f5a51;
}

.topic-editor-actions .primary,
.theater-update-actions .primary {
  background: #51443e;
  color: #ffffff;
  box-shadow: 0 10px 22px rgba(76, 57, 49, 0.12);
}

.topic-editor-actions .danger {
  background: rgba(170, 92, 92, 0.1);
  color: #a25e5e;
}

.theater-forward-sheet,
.theater-update-sheet {
  gap: 12px;
}

.theater-forward-sheet header,
.theater-update-sheet header {
  gap: 3px;
  padding: 16px;
  border: 1px solid rgba(134, 103, 90, 0.07);
  border-radius: 26px 26px 26px 9px;
  background:
    radial-gradient(circle at top right, rgba(228, 205, 194, 0.68), transparent 34%),
    rgba(255, 255, 255, 0.62);
  box-shadow: 0 14px 34px rgba(75, 56, 48, 0.05);
}

.theater-forward-sheet header span,
.theater-update-sheet header span {
  color: #a18478;
  font-size: 8px;
  letter-spacing: 0.16em;
}

.theater-forward-sheet h3,
.theater-update-sheet h3 {
  color: #443936;
  font-family: Georgia, "Songti SC", serif;
  font-size: 19px;
  font-weight: 600;
}

.theater-forward-sheet header p,
.theater-update-sheet header p {
  color: #91837c;
  font-size: 10px;
  line-height: 1.6;
}

.theater-forward-sheet > button {
  min-height: 62px;
  padding: 9px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 20px 20px 20px 8px;
  background: rgba(255, 255, 255, 0.6);
  color: #493e39;
}

.theater-forward-sheet img {
  border: 2px solid rgba(255, 255, 255, 0.8);
  border-radius: 15px;
  box-shadow: 0 7px 16px rgba(75, 55, 48, 0.1);
}

.theater-forward-sheet strong {
  color: #493e39;
}

.theater-forward-sheet small,
.theater-forward-empty {
  color: #998a83;
}

.theater-update-sheet textarea {
  background: rgba(255, 255, 255, 0.66);
}

.theater-cleanup-panel {
  gap: 10px;
}

.theater-cleanup-panel .cleanup-manual-card,
.theater-cleanup-panel .cleanup-character-card {
  padding: 14px;
  border: 1px solid rgba(128, 100, 88, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.6);
  box-shadow: 0 12px 30px rgba(75, 56, 48, 0.045);
}

.theater-cleanup-panel .cleanup-character-card.single-character {
  padding-top: 14px;
  border-top: 1px solid rgba(128, 100, 88, 0.08);
}

.theater-cleanup-panel .cleanup-character-head img {
  border: 2px solid rgba(255, 255, 255, 0.82);
  border-radius: 14px;
  background: #eee4de;
  box-shadow: 0 7px 16px rgba(75, 55, 48, 0.1);
}

.theater-cleanup-panel .cleanup-character-head strong,
.theater-cleanup-panel .cleanup-section-head span {
  color: #493e39;
}

.theater-cleanup-panel .cleanup-character-head small,
.theater-cleanup-panel .cleanup-section-head small,
.theater-cleanup-panel .cleanup-notice {
  color: #9b8b84;
}

.theater-cleanup-panel .cleanup-select-field select,
.theater-cleanup-panel .cleanup-days-field input {
  border: 1px solid rgba(128, 100, 88, 0.1);
  border-radius: 12px;
  background: #f7f2ed;
  color: #493e39;
}

.theater-cleanup-panel .cleanup-text-action {
  border-radius: 12px;
  background: #eadfd9;
  color: #6e564c;
}

.theater-cleanup-panel .cleanup-text-action.danger:not(:disabled) {
  background: rgba(170, 92, 92, 0.1);
  color: #a25e5e;
}

.theater-cleanup-panel .cleanup-switch-track {
  background: #d9d0ca;
}

.theater-cleanup-panel .cleanup-switch-card input:checked + .cleanup-switch-track {
  background: #92776b;
}

@media (max-width: 480px) {
  .theater-main {
    padding-top: 8px;
  }

  .theater-archive-section {
    gap: 12px;
  }

  .generate-panel {
    gap: 10px;
    padding: 12px;
    border-radius: 20px 20px 20px 8px;
  }

  .generate-panel-head {
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 10px;
  }

  .generate-panel-mark {
    width: 40px;
    height: 40px;
    border-radius: 14px 14px 14px 6px;
  }

  .generate-panel-head strong {
    font-size: 15px;
    line-height: 1.2;
  }

  .generate-panel-head small {
    line-height: 1.1;
  }

  .generate-panel-head p {
    font-size: 8px;
    line-height: 1.25;
  }

  .generate-panel-actions {
    grid-template-columns: minmax(0, 1fr) minmax(108px, 116px);
    gap: 8px;
  }

  .generate-topic-trigger,
  .generate-button {
    min-height: 42px;
    border-radius: 14px;
  }

  .generate-topic-trigger {
    padding: 4px 10px;
  }

  .theater-empty {
    min-height: clamp(232px, 32vh, 288px);
    padding: 20px 18px;
    border-radius: 20px 20px 20px 8px;
  }

  .theater-timeline {
    gap: 10px;
    padding: 2px 0 16px;
  }

  .theater-timeline::before {
    left: 21px;
  }

  .theater-timeline-item {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px;
  }

  .theater-timeline-stamp {
    padding-top: 6px;
  }

  .theater-timeline-stamp strong {
    font-size: 18px;
  }

  .theater-timeline-stamp i {
    margin-top: 4px;
  }

  .theater-timeline .theater-card {
    gap: 8px;
    min-height: 0;
    padding: 11px 12px;
    border-radius: 18px 18px 18px 7px;
    box-shadow: 0 9px 20px rgba(81, 63, 55, 0.055);
  }

  .theater-card-content {
    gap: 2px;
    padding-right: 78px;
  }

  .theater-card-content small {
    line-height: 1.15;
  }

  .theater-card-content strong {
    font-size: 16px;
    line-height: 1.2;
  }

  .theater-card-content em {
    line-height: 1.35;
    -webkit-line-clamp: 1;
  }

  .theater-card-actions {
    top: 7px;
    right: 7px;
    gap: 1px;
  }

  .theater-card-footer {
    padding-top: 6px;
  }

  .theater-card-footer time,
  .theater-card-footer > span {
    line-height: 1.15;
  }
}

@media (max-width: 380px) {
  .topic-category-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .generate-panel-actions {
    grid-template-columns: minmax(0, 1fr) 108px;
    gap: 6px;
  }

  .generate-topic-trigger {
    gap: 6px;
    padding-inline: 8px;
  }

  .generate-button {
    gap: 5px;
    padding-inline: 8px;
  }
}
</style>