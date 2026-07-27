<template>
  <section class="screen no-tabs create-page fanfic-font-scope">
    <header class="top-bar create-topbar">
      <button class="back-button" type="button" aria-label="返回书架" :disabled="creating" @click="goBack"><ChevronLeft :size="21" /></button>
      <span class="create-title"><small>NEW FANWORK</small><strong>创建同人文</strong></span>
      <button class="close-button" type="button" aria-label="关闭" :disabled="creating" @click="goBack"><X :size="19" /></button>
    </header>

    <nav class="stepper" aria-label="创建步骤">
      <button v-for="item in steps" :key="item.id" type="button" :class="{ active: step === item.id, done: step > item.id }" :disabled="creating || item.id > maxReachedStep" @click="step = item.id">
        <span>{{ item.id }}</span><small>{{ item.label }}</small>
      </button>
    </nav>

    <main class="create-main">
      <section v-if="step === 1" class="wizard-panel">
        <header class="wizard-heading"><small>01 · FANWORK SUBJECTS</small><h1>这一次，写你和谁？</h1><p>用户与所选角色是明确的同人对象，也是 AU 正文里的唯一双主角。</p></header>
        <article class="user-card">
          <span class="avatar-wrap"><img :src="appStore.user?.avatar" alt="用户头像" /></span>
          <span><small>USER · 固定同人对象</small><strong>{{ appStore.user?.name || '尚未填写真名' }}</strong><em>{{ appStore.user?.nickname }}</em></span>
          <CheckCircle2 v-if="appStore.user?.name.trim()" :size="19" />
          <CircleAlert v-else :size="19" />
        </article>
        <div class="character-list">
          <button v-for="character in appStore.charactersForActiveUser" :key="character.id" type="button" :class="{ selected: selectedCharacterId === character.id }" @click="selectedCharacterId = character.id">
            <img :src="character.avatar" :alt="character.name" />
            <span><strong>{{ character.name || '尚未填写真名' }}</strong><small>{{ character.nickname }}</small></span>
            <span class="select-mark"><Check v-if="selectedCharacterId === character.id" :size="14" stroke-width="3" /></span>
          </button>
        </div>
        <p v-if="!appStore.charactersForActiveUser.length" class="panel-notice">当前账号还没有可用角色，请先添加并绑定角色。</p>
        <p class="privacy-note"><ShieldCheck :size="15" /> 创作会直接读取双方真名、人物设定与所选角色启用的局部世界书作为参考，但不会把全部资料视为必须照搬的剧情。阅读时点击高潮评论点，才会另行读取同账号绑定角色的真名、签名和角色设定生成该点评论；全程不读取聊天、记忆、全局世界书或头像描述。</p>
      </section>

      <section v-else-if="step === 2" class="wizard-panel topic-panel">
        <header class="wizard-heading"><small>02 · STORY SEED</small><h1>挑一个全新的世界</h1><p>趋势只提供抽象类型标签，地点、职业、规则和事件会全部重新创造。</p></header>
        <nav class="topic-tabs">
          <button v-for="tab in topicTabs" :key="tab.id" type="button" :class="{ active: topicTab === tab.id }" @click="topicTab = tab.id">{{ tab.label }}</button>
        </nav>
        <section v-if="topicTab === 'trend'" class="trend-tools">
          <span><Radio :size="15" /><small>{{ fanficStore.trendStatus || '联网时只发送通用题材搜索词' }}</small></span>
          <button type="button" :disabled="fanficStore.refreshingTrends" @click="refreshTrends"><LoaderCircle v-if="fanficStore.refreshingTrends" class="spin" :size="14" /><RefreshCw v-else :size="14" />{{ fanficStore.refreshingTrends ? '刷新中' : '联网刷新' }}</button>
        </section>
        <section v-if="topicTab === 'built-in'" class="genre-library">
          <label class="genre-search">
            <Search :size="15" />
            <input v-model="builtInSearch" type="search" placeholder="搜索题材、赛道或分类" />
            <small>{{ filteredBuiltInCount }} 项</small>
          </label>
          <nav class="genre-family-tabs" aria-label="同人题材分类">
            <button v-for="group in fanficGenreGroups" :key="group.id" type="button" :class="{ active: selectedGenreGroupId === group.id && !builtInSearch.trim() }" @click="selectGenreGroup(group.id)">
              <strong>{{ group.shortLabel }}</strong><small>{{ group.sections.reduce((total, section) => total + section.topics.length, 0) }}</small>
            </button>
          </nav>
          <article v-if="!builtInSearch.trim()" class="genre-intro">
            <span><small>STORY GENRES</small><strong>{{ selectedGenreGroup.label }}</strong></span>
            <p>{{ selectedGenreGroup.description }}</p>
          </article>
          <div v-if="filteredBuiltInSections.length" class="genre-sections">
            <section v-for="section in filteredBuiltInSections" :key="`${section.groupId}_${section.id}`" class="genre-section">
              <header>
                <span><strong>{{ builtInSearch.trim() ? `${section.groupLabel} · ${section.label}` : section.label }}</strong><small>{{ section.description }}</small></span>
                <em>{{ section.topics.length }}</em>
              </header>
              <div class="genre-chip-grid">
                <button v-for="topic in section.topics" :key="topic.id" type="button" :class="{ selected: selectedTopicId === topic.id }" @click="selectedTopicId = topic.id">
                  <span>{{ topic.title }}</span><Check v-if="selectedTopicId === topic.id" :size="13" stroke-width="3" />
                </button>
              </div>
            </section>
          </div>
          <section v-else class="topic-empty"><SearchX :size="25" /><strong>没有匹配的题材</strong><p>换一个关键词，或切换上方分类继续浏览。</p></section>
          <article v-if="selectedTopic?.source === 'built-in'" class="selected-genre-preview">
            <small>已选择 · {{ selectedTopic.categoryLabel }} / {{ selectedTopic.subcategory }}</small>
            <strong>{{ selectedTopic.title }}</strong>
            <p>{{ selectedTopic.hook }}</p>
          </article>
        </section>
        <div v-if="topicTab !== 'built-in' && visibleTopics.length" class="topic-grid">
          <FanficTopicCard v-for="topic in visibleTopics" :key="topic.id" :topic="topic" :selected="selectedTopicId === topic.id" @select="selectedTopicId = $event" />
        </div>
        <section v-else-if="topicTab === 'trend'" class="topic-empty"><WifiOff :size="25" /><strong>还没有联网题材</strong><p>点击联网刷新；网络不可用时仍可使用内置原创题材。</p></section>
        <form v-if="topicTab === 'custom'" class="custom-topic" @submit.prevent="saveCustomTopic">
          <label><span>题材名称</span><input v-model="customTopic.title" maxlength="28" placeholder="例如：午夜气象站" /></label>
          <label><span>故事钩子</span><textarea v-model="customTopic.hook" maxlength="500" rows="4" placeholder="写下一个最想看到的原创起点"></textarea></label>
          <label><span>原创背景</span><textarea v-model="customTopic.setting" maxlength="300" rows="3" placeholder="时代、地点或世界规则"></textarea></label>
          <label><span>核心冲突</span><textarea v-model="customTopic.conflict" maxlength="300" rows="3" placeholder="两人必须共同解决什么"></textarea></label>
          <label><span>关系动力</span><input v-model="customTopic.relationship" maxlength="100" placeholder="例如：互不服输的临时搭档" /></label>
          <button type="submit"><Plus :size="14" /> 保存并选择题材</button>
        </form>
        <p v-if="topicError" class="error-note">{{ topicError }}</p>
      </section>

      <section v-else-if="step === 3" class="wizard-panel">
        <header class="wizard-heading"><small>03 · DIRECTION</small><h1>决定这本书的呼吸</h1><p>这些选项只控制叙事方式，不会复用人物原背景。</p></header>
        <div class="preference-grid">
          <fieldset><legend>叙事基调</legend><button v-for="option in toneOptions" :key="option" type="button" :class="{ selected: preferences.tone === option }" @click="preferences.tone = option">{{ option }}</button></fieldset>
          <fieldset><legend>叙事视角</legend><button v-for="option in povOptions" :key="option" type="button" :class="{ selected: preferences.pov === option }" @click="preferences.pov = option">{{ option }}</button></fieldset>
          <fieldset><legend>结局倾向</legend><button v-for="option in endingOptions" :key="option" type="button" :class="{ selected: preferences.endingPreference === option }" @click="preferences.endingPreference = option">{{ option }}</button></fieldset>
          <fieldset><legend>计划篇幅</legend><button v-for="option in chapterOptions" :key="option.value" type="button" :class="{ selected: preferences.chapterTarget === option.value }" @click="preferences.chapterTarget = option.value">{{ option.label }}</button></fieldset>
        </div>
        <label class="wide-field"><span>不要出现</span><input v-model="boundaryDraft" maxlength="240" placeholder="用逗号分隔，例如：背叛、重伤、开放式结局" /></label>
        <label class="wide-field"><span>额外方向（可选）</span><textarea v-model="preferences.extraGuidance" maxlength="600" rows="4" placeholder="例如：第一章先把冲突摆出来，感情慢一点，每章结尾留一个必须追下去的问题"></textarea></label>
      </section>

      <section v-else class="wizard-panel confirm-panel">
        <header class="wizard-heading"><small>04 · READY</small><h1>确认 AU 同人约定</h1><p>创建后会先生成作品基础设定，再生成第一章正文和高潮评论点，不会提前生成评论内容。</p></header>
        <article class="confirm-pair">
          <span><img :src="appStore.user?.avatar" alt="" /><strong>{{ appStore.user?.name }}</strong><small>用户真名</small></span>
          <HeartHandshake :size="24" />
          <span><img :src="selectedCharacter?.avatar" alt="" /><strong>{{ selectedCharacter?.name }}</strong><small>角色真名</small></span>
        </article>
        <article v-if="selectedTopic" class="confirm-topic"><small>{{ selectedTopic.source === 'trend' ? '联网趋势灵感' : selectedTopic.categoryLabel ? `${selectedTopic.categoryLabel} / ${selectedTopic.subcategory}` : '原创题材' }}</small><strong>{{ selectedTopic.title }}</strong><p>{{ selectedTopic.hook }}</p></article>
        <dl class="confirm-settings"><div><dt>基调</dt><dd>{{ preferences.tone }}</dd></div><div><dt>视角</dt><dd>{{ preferences.pov }}</dd></div><div><dt>结局</dt><dd>{{ preferences.endingPreference }}</dd></div><div><dt>篇幅</dt><dd>{{ preferences.chapterTarget }} 章 · 每章约 2500 字</dd></div></dl>
        <ul class="original-rules"><li><Check :size="14" /> 作品始终明确属于用户与所选角色，AU 剧情会结合题材与参考资料重新创作</li><li><Check :size="14" /> 双方设定与角色绑定局部世界书仅供参考，不要求逐条照搬；正文同时遵循故事圣经与已发布事实</li><li><Check :size="14" /> 章节只创建高潮评论点；用户点击某个热点后，模型才单独生成并缓存该点评论</li></ul>
        <label class="consent-row"><input v-model="consent" type="checkbox" /><span>同意将双方资料与所选角色启用的局部世界书发送给全局小剧场与同人文模型（未单独选择时跟随 API 默认模型）作为创作参考，并在点击高潮评论点时发送同账号绑定角色的真名、签名与角色设定；不发送聊天和记忆。</span></label>
        <p v-if="createError" class="error-note">{{ createError }}</p>
      </section>
    </main>

    <footer class="wizard-footer">
      <button v-if="step > 1" class="secondary" type="button" :disabled="creating" @click="step -= 1">上一步</button>
      <button v-if="step < 4" class="primary" type="button" :disabled="!canContinue" @click="nextStep">继续 <ArrowRight :size="15" /></button>
      <button v-else class="primary create-submit" type="button" :disabled="!canCreate || creating" @click="submitCreate"><Sparkles :size="15" /> 创建同人文与第一章</button>
    </footer>

    <section v-if="creating" class="creating-overlay" aria-live="polite">
      <span class="creating-orbit"><Sparkles :size="24" /><i></i></span>
      <small>CREATING YOUR AU FANWORK</small>
      <h2>{{ activeGenerationLabel }}</h2>
      <p>章节会同时生成正文和高潮评论点，不会在创建阶段请求任何评论内容。</p>
      <span class="progress-track"><i :style="{ width: `${activeGenerationProgress}%` }"></i></span>
      <em>{{ activeGenerationProgress }}%</em>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowRight, Check, CheckCircle2, ChevronLeft, CircleAlert, HeartHandshake, LoaderCircle, Plus, Radio, RefreshCw, Search, SearchX, ShieldCheck, Sparkles, WifiOff, X } from 'lucide-vue-next';
import FanficTopicCard from '@/components/fanfic/FanficTopicCard.vue';
import { fanficGenreGroups } from '@/data/fanficTopics';
import { useAppStore } from '@/stores/appStore';
import { useFanficStore } from '@/stores/fanficStore';
import type { FanficTopic } from '@/types/domain';

const router = useRouter();
const route = useRoute();
const appStore = useAppStore();
const fanficStore = useFanficStore();

const step = ref(1);
const maxReachedStep = ref(1);
const selectedCharacterId = ref('');
const selectedTopicId = ref('');
const topicTab = ref<'built-in' | 'trend' | 'custom'>('built-in');
const selectedGenreGroupId = ref(fanficGenreGroups[0].id);
const builtInSearch = ref('');
const topicError = ref('');
const createError = ref('');
const boundaryDraft = ref('');
const consent = ref(false);
const creating = ref(false);
const preferences = reactive({ tone: '', pov: '', endingPreference: '', chapterTarget: 12, contentBoundaries: [] as string[], extraGuidance: '' });
const customTopic = reactive({ title: '', hook: '', setting: '', conflict: '', relationship: '', tags: [] as string[] });

const steps = [{ id: 1, label: '对象' }, { id: 2, label: '题材' }, { id: 3, label: '方向' }, { id: 4, label: '确认' }];
const topicTabs = [{ id: 'built-in' as const, label: '内置原创' }, { id: 'trend' as const, label: '联网趋势' }, { id: 'custom' as const, label: '自定义' }];
const toneOptions = ['强冲突快节奏', '轻松日常高互动', '强情节悬疑推进', '慢热关系拉扯', '轻喜剧反转', '事业与能力升级', '冒险求生', '群像成长'];
const povOptions = ['第三人称双线推进', '第一人称交替', '第三人称限知'];
const endingOptions = ['HE 圆满收束', 'OE 留有余味', 'BE 遗憾收束'];
const chapterOptions = [{ value: 8, label: '短篇 · 8章' }, { value: 12, label: '中篇 · 12章' }, { value: 20, label: '长篇 · 20章' }];

const selectedCharacter = computed(() => appStore.charactersForActiveUser.find((character) => character.id === selectedCharacterId.value) ?? null);
const selectedTopic = computed(() => fanficStore.topicById(selectedTopicId.value));
const selectedGenreGroup = computed(() => fanficGenreGroups.find((group) => group.id === selectedGenreGroupId.value) ?? fanficGenreGroups[0]);
const filteredBuiltInSections = computed(() => {
  const search = builtInSearch.value.trim().toLocaleLowerCase();
  const groups = search ? fanficGenreGroups : [selectedGenreGroup.value];
  return groups.flatMap((group) => group.sections.map((section) => ({
    ...section,
    groupId: group.id,
    groupLabel: group.label,
    topics: fanficStore.builtInTopics.filter((topic) => {
      if (topic.categoryId !== group.id || topic.subcategory !== section.label) return false;
      if (!search) return true;
      return `${topic.title} ${topic.categoryLabel} ${topic.subcategory} ${topic.tags.join(' ')}`.toLocaleLowerCase().includes(search);
    })
  })).filter((section) => section.topics.length));
});
const filteredBuiltInCount = computed(() => filteredBuiltInSections.value.reduce((total, section) => total + section.topics.length, 0));
const visibleTopics = computed(() => topicTab.value === 'trend' ? fanficStore.trendTopics : fanficStore.customTopics);
const canContinue = computed(() => step.value === 1
  ? Boolean(appStore.user?.name.trim() && selectedCharacter.value?.name.trim())
  : step.value === 2
    ? Boolean(selectedTopic.value)
    : step.value === 3
      ? Boolean(preferences.tone && preferences.pov && preferences.endingPreference)
      : true);
const canCreate = computed(() => Boolean(selectedCharacter.value && selectedTopic.value && consent.value));
const currentJob = computed(() => [...fanficStore.jobs].sort((left, right) => right.updatedAt - left.updatedAt).find((job) => !['completed', 'failed'].includes(job.stage)) ?? null);
const activeGenerationLabel = computed(() => currentJob.value?.label || '正在准备 AU 同人文');
const activeGenerationProgress = computed(() => currentJob.value?.progress ?? 4);

onMounted(async () => {
  await fanficStore.hydrate();
  selectedCharacterId.value = appStore.charactersForActiveUser[0]?.id ?? '';
  const queryTopicId = String(route.query.topic ?? '');
  if (queryTopicId && fanficStore.topicById(queryTopicId)) {
    selectedTopicId.value = queryTopicId;
    const queryTopic = fanficStore.topicById(queryTopicId);
    const source = queryTopic?.source;
    topicTab.value = source === 'trend' ? 'trend' : source === 'custom' || source === 'ai' ? 'custom' : 'built-in';
    if (queryTopic?.categoryId) selectedGenreGroupId.value = queryTopic.categoryId;
  }
});

function goBack() { if (!creating.value) void router.push({ name: 'fanfic' }); }
function nextStep() { if (!canContinue.value) return; step.value += 1; maxReachedStep.value = Math.max(maxReachedStep.value, step.value); }
function selectGenreGroup(groupId: string) { selectedGenreGroupId.value = groupId; builtInSearch.value = ''; }

async function refreshTrends() {
  topicError.value = '';
  try {
    const refreshed = await fanficStore.refreshTrendTopics();
    if (refreshed[0]) selectedTopicId.value = refreshed[0].id;
  } catch (error) {
    topicError.value = error instanceof Error ? error.message : '联网题材刷新失败。';
  }
}

async function saveCustomTopic() {
  topicError.value = '';
  try {
    const topic = await fanficStore.createCustomTopic(customTopic as Pick<FanficTopic, 'title' | 'hook' | 'setting' | 'conflict' | 'relationship' | 'tags'>);
    selectedTopicId.value = topic.id;
  } catch (error) {
    topicError.value = error instanceof Error ? error.message : '题材保存失败。';
  }
}

async function submitCreate() {
  if (!canCreate.value || creating.value) return;
  creating.value = true;
  createError.value = '';
  preferences.contentBoundaries = boundaryDraft.value.split(/[，,、]/).map((entry) => entry.trim()).filter(Boolean);
  try {
    const book = await fanficStore.createBook({ characterId: selectedCharacterId.value, topicId: selectedTopicId.value, preferences: { ...preferences } });
    await router.replace({ name: 'fanfic-book', params: { bookId: book.id } });
  } catch (error) {
    createError.value = error instanceof Error ? error.message : '同人文创建失败。';
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.create-page { display: flex; flex-direction: column; overflow: hidden; background: #faf8f4; color: #302b2d; }
.create-topbar { flex: 0 0 auto; background: rgba(250, 248, 244, .92); }
.back-button, .close-button { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #5c5355; }
.create-title { display: grid; place-items: center; gap: 1px; }
.create-title small { color: #a1858a; font-size: 7px; font-weight: 900; letter-spacing: .17em; }
.create-title strong { font-family: Georgia, "Songti SC", serif; font-size: 15px; }
.stepper { flex: 0 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); padding: 6px 18px 12px; background: rgba(250, 248, 244, .94); }
.stepper button { position: relative; display: grid; place-items: center; gap: 4px; color: #afa5a6; }
.stepper button:not(:last-child)::after { content: ''; position: absolute; top: 11px; left: calc(50% + 15px); width: calc(100% - 30px); height: 1px; background: #ddd5d2; }
.stepper button.done:not(:last-child)::after { background: #6e8a76; }
.stepper button > span { z-index: 1; display: grid; place-items: center; width: 23px; height: 23px; border: 1px solid #d7cfcc; border-radius: 50%; background: #faf8f4; font-size: 8px; font-weight: 850; }
.stepper button.active > span, .stepper button.done > span { border-color: #607966; background: #607966; color: #fff; }
.stepper small { font-size: 8px; }
.create-main { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.wizard-panel { display: grid; gap: 16px; padding: 20px 17px 120px; }
.wizard-heading { display: grid; gap: 7px; padding: 4px 2px 7px; }
.wizard-heading small { color: #a6868c; font-size: 8px; font-weight: 950; letter-spacing: .15em; }
.wizard-heading h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 25px; line-height: 1.18; }
.wizard-heading p { margin: 0; color: #8b8183; font-size: 10px; line-height: 1.65; }
.user-card { display: grid; grid-template-columns: 48px minmax(0, 1fr) 22px; align-items: center; gap: 11px; padding: 12px; border-radius: 21px; background: linear-gradient(145deg, #f1e1e4, #eee8e4); }
.avatar-wrap, .user-card img { width: 48px; height: 48px; border-radius: 17px; object-fit: cover; }
.user-card > span:nth-child(2) { display: grid; gap: 2px; }
.user-card small { color: #9c7f84; font-size: 8px; font-weight: 850; letter-spacing: .08em; }
.user-card strong { font-size: 14px; }
.user-card em { color: #8e8284; font-size: 9px; font-style: normal; }
.character-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
.character-list button { position: relative; display: grid; grid-template-columns: 44px minmax(0, 1fr); align-items: center; gap: 9px; min-height: 72px; padding: 10px; border: 1px solid rgba(69, 60, 62, .07); border-radius: 20px; background: rgba(255, 255, 255, .65); text-align: left; }
.character-list button.selected { border-color: rgba(73, 108, 82, .42); background: #ecf3ed; }
.character-list img { width: 44px; height: 44px; border-radius: 15px; object-fit: cover; }
.character-list button > span:nth-child(2) { display: grid; gap: 3px; min-width: 0; }
.character-list strong, .character-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.character-list strong { font-size: 11px; }
.character-list small { color: #968b8d; font-size: 8px; }
.select-mark { position: absolute; top: 7px; right: 7px; display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid #d9d2d0; border-radius: 50%; color: #fff; }
.selected .select-mark { border-color: #55715d; background: #55715d; }
.privacy-note, .panel-notice { display: flex; align-items: flex-start; gap: 7px; margin: 0; padding: 11px 12px; border-radius: 16px; background: #f0f4ef; color: #617064; font-size: 9px; line-height: 1.55; }
.topic-tabs { display: flex; gap: 5px; padding: 4px; border-radius: 15px; background: #eee9e5; }
.topic-tabs button { flex: 1; min-height: 32px; border-radius: 11px; color: #8d8284; font-size: 9px; font-weight: 800; }
.topic-tabs button.active { background: #fff; color: #433c3e; box-shadow: 0 5px 14px rgba(54, 47, 48, .07); }
.trend-tools { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px; border-radius: 15px; background: #edf3ed; color: #5e7463; }
.trend-tools > span { display: flex; align-items: center; gap: 6px; min-width: 0; }
.trend-tools small { overflow: hidden; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.trend-tools button { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; min-height: 28px; padding: 0 9px; border-radius: 10px; background: #fff; font-size: 8px; font-weight: 800; }
.topic-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.genre-library { display: grid; gap: 13px; }
.genre-search { display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 7px; min-height: 43px; padding: 0 12px; border: 1px solid rgba(71, 62, 64, .08); border-radius: 15px; background: rgba(255, 255, 255, .74); color: #978b8d; }
.genre-search input { min-width: 0; border: 0; outline: 0; background: transparent; color: #40383b; font-size: 10px; }
.genre-search input::-webkit-search-cancel-button { display: none; }
.genre-search small { padding: 4px 7px; border-radius: 999px; background: #eee9e5; color: #897d7f; font-size: 8px; font-weight: 800; }
.genre-family-tabs { display: flex; gap: 7px; margin: 0 -17px; padding: 0 17px 4px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity; }
.genre-family-tabs::-webkit-scrollbar { display: none; }
.genre-family-tabs button { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; min-height: 37px; padding: 0 12px; border: 1px solid rgba(72, 64, 66, .08); border-radius: 13px; background: rgba(255, 255, 255, .66); color: #756b6d; scroll-snap-align: start; }
.genre-family-tabs button strong { font-size: 9px; }
.genre-family-tabs button small { display: grid; place-items: center; min-width: 20px; height: 18px; padding: 0 5px; border-radius: 999px; background: #eee9e5; font-size: 7px; }
.genre-family-tabs button.active { border-color: #657d6a; background: #607966; color: #fff; box-shadow: 0 8px 18px rgba(61, 85, 67, .15); }
.genre-family-tabs button.active small { background: rgba(255, 255, 255, .2); color: #fff; }
.genre-intro { display: grid; gap: 7px; padding: 14px; border-radius: 19px; background: linear-gradient(135deg, #efe1e4, #e6eee6); }
.genre-intro > span { display: grid; gap: 2px; }
.genre-intro small { color: #9a7e85; font-size: 7px; font-weight: 900; letter-spacing: .13em; }
.genre-intro strong { font-family: Georgia, "Songti SC", serif; font-size: 17px; }
.genre-intro p { margin: 0; color: #746a6c; font-size: 9px; line-height: 1.55; }
.genre-sections { display: grid; gap: 12px; }
.genre-section { display: grid; gap: 10px; padding: 13px; border: 1px solid rgba(70, 61, 63, .07); border-radius: 19px; background: rgba(255, 255, 255, .57); }
.genre-section > header { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.genre-section > header span { display: grid; gap: 3px; min-width: 0; }
.genre-section > header strong { color: #473f41; font-size: 11px; }
.genre-section > header small { color: #9a8f91; font-size: 8px; line-height: 1.4; }
.genre-section > header em { display: grid; place-items: center; flex: 0 0 auto; min-width: 23px; height: 23px; border-radius: 8px; background: #eee9e5; color: #8f8385; font-size: 8px; font-style: normal; font-weight: 850; }
.genre-chip-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; }
.genre-chip-grid button { display: flex; align-items: center; justify-content: space-between; gap: 5px; min-width: 0; min-height: 38px; padding: 7px 9px; border: 1px solid #e5ddda; border-radius: 12px; background: #faf8f5; color: #6f6567; text-align: left; }
.genre-chip-grid button span { min-width: 0; overflow: hidden; font-size: 8.5px; font-weight: 750; line-height: 1.35; text-overflow: ellipsis; }
.genre-chip-grid button svg { flex: 0 0 auto; }
.genre-chip-grid button.selected { border-color: #66806d; background: #e7f0e8; color: #426049; box-shadow: inset 0 0 0 1px rgba(90, 119, 98, .08); }
.selected-genre-preview { display: grid; gap: 5px; padding: 13px; border-radius: 18px; background: #3d3839; color: #fff; }
.selected-genre-preview small { color: #d7c6ca; font-size: 7.5px; font-weight: 800; }
.selected-genre-preview strong { font-family: Georgia, "Songti SC", serif; font-size: 15px; }
.selected-genre-preview p { margin: 0; color: #d9d3d2; font-size: 8.5px; line-height: 1.55; }
.topic-empty { display: grid; place-items: center; gap: 7px; padding: 34px; border: 1px dashed #d9d0cd; border-radius: 24px; color: #8e8385; text-align: center; }
.topic-empty p { margin: 0; font-size: 9px; line-height: 1.5; }
.custom-topic { display: grid; gap: 11px; }
.custom-topic label, .wide-field { display: grid; gap: 6px; }
.custom-topic label span, .wide-field span { color: #776c6e; font-size: 9px; font-weight: 800; }
.custom-topic input, .custom-topic textarea, .wide-field input, .wide-field textarea { width: 100%; padding: 10px 12px; border: 1px solid rgba(71, 62, 64, .09); border-radius: 14px; outline: none; background: rgba(255, 255, 255, .72); color: #3f383a; font-size: 11px; line-height: 1.5; resize: vertical; }
.custom-topic button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 38px; border-radius: 13px; background: #363133; color: #fff; font-size: 10px; font-weight: 800; }
.preference-grid { display: grid; gap: 15px; }
.preference-grid fieldset { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; border: 0; }
.preference-grid legend { width: 100%; margin-bottom: 2px; color: #766b6d; font-size: 9px; font-weight: 850; }
.preference-grid button { min-height: 33px; padding: 0 11px; border: 1px solid #e1dad7; border-radius: 12px; background: rgba(255,255,255,.66); color: #756b6d; font-size: 9px; }
.preference-grid button.selected { border-color: #647c69; background: #e6efe7; color: #43604a; font-weight: 850; }
.confirm-pair { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 11px; padding: 16px; border-radius: 24px; background: linear-gradient(145deg, #f0e0e4, #e5eee7); color: #765e64; }
.confirm-pair > span { display: grid; place-items: center; gap: 4px; min-width: 0; }
.confirm-pair img { width: 54px; height: 54px; border: 3px solid rgba(255,255,255,.72); border-radius: 50%; object-fit: cover; }
.confirm-pair strong { max-width: 110px; overflow: hidden; color: #3e3739; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.confirm-pair small { font-size: 8px; }
.confirm-topic { display: grid; gap: 6px; padding: 15px; border-radius: 20px; background: rgba(255,255,255,.7); }
.confirm-topic small { color: #a08388; font-size: 8px; font-weight: 900; letter-spacing: .1em; }
.confirm-topic strong { font-family: Georgia, "Songti SC", serif; font-size: 18px; }
.confirm-topic p { margin: 0; color: #7d7375; font-size: 10px; line-height: 1.6; }
.confirm-settings { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin: 0; }
.confirm-settings div { padding: 11px; border-radius: 15px; background: #eeeae6; }
.confirm-settings dt { color: #9a8f90; font-size: 8px; }
.confirm-settings dd { margin: 3px 0 0; font-size: 10px; font-weight: 800; }
.original-rules { display: grid; gap: 8px; margin: 0; padding: 13px; border-radius: 18px; background: #edf3ed; list-style: none; }
.original-rules li { display: flex; align-items: flex-start; gap: 7px; color: #586b5d; font-size: 9px; line-height: 1.55; }
.original-rules svg { flex: 0 0 auto; margin-top: 1px; }
.consent-row { display: grid; grid-template-columns: 20px minmax(0,1fr); align-items: flex-start; gap: 8px; color: #766b6d; font-size: 9px; line-height: 1.55; }
.consent-row input { width: 18px; height: 18px; accent-color: #5b7462; }
.error-note { margin: 0; padding: 10px 12px; border-radius: 13px; background: #f8eaea; color: #965e63; font-size: 9px; line-height: 1.5; }
.wizard-footer { position: absolute; right: 0; bottom: 0; left: 0; z-index: 20; display: flex; gap: 9px; padding: 10px calc(16px + var(--safe-right)) calc(10px + var(--safe-bottom)) calc(16px + var(--safe-left)); background: linear-gradient(180deg, rgba(250,248,244,0), rgba(250,248,244,.95) 22%); backdrop-filter: blur(12px); }
.wizard-footer button { min-height: 43px; border-radius: 15px; font-size: 10px; font-weight: 850; }
.wizard-footer .secondary { width: 92px; background: #ebe6e2; color: #655c5e; }
.wizard-footer .primary { display: flex; align-items: center; justify-content: center; gap: 5px; flex: 1; background: #363133; color: #fff; }
.wizard-footer button:disabled { opacity: .4; }
.creating-overlay { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; align-content: center; gap: 12px; padding: 30px; background: radial-gradient(circle at 50% 25%, rgba(236,211,217,.9), transparent 34%), linear-gradient(160deg, #faf8f4, #e9f0e8); text-align: center; }
.creating-orbit { position: relative; display: grid; place-items: center; width: 74px; height: 74px; border-radius: 50%; background: rgba(255,255,255,.72); color: #6d5960; box-shadow: 0 20px 50px rgba(67,56,59,.12); }
.creating-orbit i { position: absolute; inset: -8px; border: 1px dashed #a88f95; border-radius: 50%; animation: spin 8s linear infinite; }
.creating-overlay > small { margin-top: 8px; color: #a08087; font-size: 8px; font-weight: 950; letter-spacing: .16em; }
.creating-overlay h2 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 21px; }
.creating-overlay p { max-width: 290px; margin: 0; color: #83787a; font-size: 10px; line-height: 1.65; }
.progress-track { width: min(280px, 78vw); height: 5px; margin-top: 8px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.8); }
.progress-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #b68d96, #718f78); transition: width .35s ease; }
.creating-overlay em { color: #8f7c80; font-size: 9px; font-style: normal; font-weight: 850; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>