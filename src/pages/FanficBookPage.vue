<template>
  <section v-if="book" class="screen no-tabs book-page fanfic-font-scope">
    <header class="top-bar book-topbar">
      <button class="header-button" type="button" aria-label="返回书架" @click="goBack"><ChevronLeft :size="21" /></button>
      <span><small>USER × CHARACTER FANWORK</small><strong>同人文详情</strong></span>
      <button class="header-button" type="button" aria-label="更多操作" @click="showActions = !showActions"><MoreHorizontal :size="21" /></button>
      <section v-if="showActions" class="action-menu">
        <button type="button" :disabled="covering" @click="refreshCover"><ImagePlus :size="15" />重新生成封面</button>
        <button class="danger" type="button" @click="removeBook"><Trash2 :size="15" />删除整篇同人文</button>
      </section>
    </header>

    <main class="book-main">
      <section class="book-hero">
        <FanficBookCover :book="book" size="large" show-status />
        <span class="book-identity">
          <small>{{ book.sourceLabel }}</small>
          <h1>{{ book.title }}</h1>
          <p>{{ book.authorName }} · 著</p>
          <span class="hero-tags"><em v-for="tag in book.tags" :key="tag">#{{ tag }}</em></span>
          <dl><div><dt>同人对象</dt><dd>{{ book.userName }} × {{ book.characterName }}</dd></div><div><dt>进度</dt><dd>{{ chapterList.length }} / {{ book.chapterTarget }} 章</dd></div><div><dt>字数</dt><dd>{{ totalWords.toLocaleString() }} 字</dd></div></dl>
        </span>
      </section>

      <section v-if="latestJob && latestJob.stage !== 'completed'" class="job-card" :class="latestJob.stage">
        <span><LoaderCircle v-if="latestJob.stage !== 'failed'" class="spin" :size="17" /><CircleAlert v-else :size="17" /></span>
        <span><strong>{{ latestJob.label }}</strong><small>{{ latestJob.error || '正文与高潮评论点完成后会出现在目录。' }}</small><i><b :style="{ width: `${latestJob.progress}%` }"></b></i></span>
      </section>

      <section class="summary-card">
        <small>ABOUT THIS STORY</small>
        <h2>故事简介</h2>
        <p>{{ book.summary }}</p>
        <blockquote>{{ book.topicPitch }}</blockquote>
      </section>

      <button v-if="chapterList.length" class="continue-button" type="button" @click="continueReading"><BookOpenText :size="17" /><span><small>CONTINUE READING</small><strong>{{ continueLabel }}</strong></span><ArrowRight :size="18" /></button>

      <section class="chapter-section">
        <header class="section-title"><span><small>CONTENTS</small><h2>章节目录</h2></span><em>{{ chapterList.length }} CHAPTERS</em></header>
        <div v-if="chapterList.length" class="chapter-list">
          <button v-for="chapter in chapterList" :key="chapter.id" type="button" @click="openChapter(chapter.id)">
            <span class="chapter-order">{{ String(chapter.order).padStart(2, '0') }}</span>
            <span><strong>{{ chapter.title }}</strong><small>{{ chapter.wordCount }} 字 · {{ chapter.hotspots.length }} 个评论点 · {{ fanficStore.commentsForChapter(chapter.id).length }} 条章评</small></span>
            <ChevronRight :size="16" />
          </button>
        </div>
        <section v-else class="chapter-empty"><Feather :size="24" /><strong>第一章还未完成</strong><p>{{ latestJob?.error || '可以根据作品设定继续生成第一章与高潮评论点。' }}</p></section>
      </section>

      <section v-if="book.status !== 'completed'" class="next-chapter-card">
        <header><span><small>NEXT CHAPTER</small><h2>{{ nextOrder === 1 ? '生成第一章' : `续写第 ${nextOrder} 章` }}</h2></span><Sparkles :size="20" /></header>
        <p>章节会同时生成正文与几个高潮评论点，但不生成评论内容；进入阅读页点击某个热点后，才调用 API 加载该点评论。</p>
        <div v-if="directionOptions.length" class="direction-list">
          <button v-for="direction in directionOptions" :key="direction" type="button" :class="{ selected: selectedDirection === direction }" @click="selectedDirection = selectedDirection === direction ? '' : direction">{{ direction }}</button>
        </div>
        <label><span>自定义方向（可选）</span><textarea v-model="customDirection" maxlength="500" rows="3" placeholder="例如：让误会在本章解决，但留下更大的世界谜题"></textarea></label>
        <button class="generate-button" type="button" :disabled="generating" @click="generateChapter"><LoaderCircle v-if="generating" class="spin" :size="16" /><Sparkles v-else :size="16" />{{ generating ? '正在生成章节' : nextOrder === 1 ? '生成第一章' : '生成下一章' }}</button>
        <p v-if="generateError" class="error-note">{{ generateError }}</p>
      </section>

      <section class="originality-card">
        <ShieldCheck :size="22" />
        <span><small>AU FANWORK NOTE</small><strong>{{ book.userName }} × {{ book.characterName }} 原创 AU 同人</strong><p>本作明确以两人为同人对象。双方人物设定与所选角色绑定的局部世界书会在创作时直接读取，但仅作为性格、表达、边界与世界灵感参考，不代表必须逐条照搬或已经发生；正文不读取聊天、记忆、普通全局世界书或其他绑定角色资料。其他绑定角色资料只用于作品外评论区发言。</p></span>
      </section>

      <section class="book-comments">
        <header class="section-title"><span><small>FANWORK COMMUNITY</small><h2>评论区</h2></span><em>{{ bookCommentList.length }} COMMENTS</em></header>
        <FanficCommentList :comments="bookCommentList" :book="book" @like="fanficStore.likeComment" @reply="replyToComment" />
        <form class="comment-form" @submit.prevent="submitComment">
          <small v-if="replyTarget">回复 {{ replyTarget.authorName }} <button type="button" @click="replyTargetId = ''">取消</button></small>
          <span><input v-model="commentDraft" maxlength="500" placeholder="以你的真名留下评论" /><button type="submit" :disabled="!commentDraft.trim()"><Send :size="15" /></button></span>
        </form>
      </section>
    </main>
  </section>

  <section v-else class="screen no-tabs missing-page fanfic-font-scope"><BookX :size="34" /><h1>没有找到这篇同人文</h1><button type="button" @click="goBack">返回书架</button></section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, BookOpenText, BookX, ChevronLeft, ChevronRight, CircleAlert, Feather, ImagePlus, LoaderCircle, MoreHorizontal, Send, ShieldCheck, Sparkles, Trash2 } from 'lucide-vue-next';
import FanficBookCover from '@/components/fanfic/FanficBookCover.vue';
import FanficCommentList from '@/components/fanfic/FanficCommentList.vue';
import { useFanficStore } from '@/stores/fanficStore';

const props = defineProps<{ bookId: string }>();
const router = useRouter();
const fanficStore = useFanficStore();
const showActions = ref(false);
const covering = ref(false);
const generating = ref(false);
const selectedDirection = ref('');
const customDirection = ref('');
const generateError = ref('');
const commentDraft = ref('');
const replyTargetId = ref('');

const book = computed(() => fanficStore.bookById(props.bookId));
const chapterList = computed(() => fanficStore.chaptersForBook(props.bookId));
const bookCommentList = computed(() => fanficStore.commentsForBook(props.bookId));
const latestJob = computed(() => fanficStore.latestJobForBook(props.bookId));
const totalWords = computed(() => chapterList.value.reduce((total, chapter) => total + chapter.wordCount, 0));
const nextOrder = computed(() => (chapterList.value.at(-1)?.order ?? 0) + 1);
const directionOptions = computed(() => chapterList.value.at(-1)?.nextDirections ?? []);
const replyTarget = computed(() => bookCommentList.value.find((comment) => comment.id === replyTargetId.value) ?? null);
const continueLabel = computed(() => {
  const target = chapterList.value.find((chapter) => chapter.id === book.value?.lastReadChapterId) ?? chapterList.value[0];
  return target ? `第 ${target.order} 章 · ${target.title}` : '开始阅读';
});

onMounted(async () => {
  await fanficStore.hydrate();
});

function goBack() { void router.push({ name: 'fanfic' }); }
function openChapter(chapterId: string) { void router.push({ name: 'fanfic-reader', params: { bookId: props.bookId, chapterId } }); }

function continueReading() {
  const target = chapterList.value.find((chapter) => chapter.id === book.value?.lastReadChapterId) ?? chapterList.value[0];
  if (target) openChapter(target.id);
}

async function generateChapter() {
  if (generating.value) return;
  generating.value = true;
  generateError.value = '';
  try {
    const direction = customDirection.value.trim() || selectedDirection.value;
    const chapter = await fanficStore.generateNextChapter(props.bookId, direction);
    selectedDirection.value = '';
    customDirection.value = '';
    if (chapter) openChapter(chapter.id);
  } catch (error) {
    generateError.value = error instanceof Error ? error.message : '章节生成失败。';
  } finally {
    generating.value = false;
  }
}

async function refreshCover() {
  if (covering.value) return;
  covering.value = true;
  showActions.value = false;
  try { await fanficStore.regenerateCover(props.bookId); } finally { covering.value = false; }
}

async function removeBook() {
  showActions.value = false;
  if (!window.confirm(`删除同人文《${book.value?.title}》及全部章节和评论？此操作无法撤销。`)) return;
  await fanficStore.deleteBook(props.bookId);
  goBack();
}

function replyToComment(commentId: string) { replyTargetId.value = commentId; }

async function submitComment() {
  const content = commentDraft.value.trim();
  if (!content) return;
  await fanficStore.addUserComment({ bookId: props.bookId, content, parentId: replyTargetId.value || undefined });
  commentDraft.value = '';
  replyTargetId.value = '';
}
</script>

<style scoped>
.book-page { background: #faf8f4; color: #302b2d; }
.book-topbar { background: rgba(250,248,244,.9); }
.book-topbar > span { display: grid; place-items: center; gap: 1px; }
.book-topbar small { color: #a08489; font-size: 7px; font-weight: 900; letter-spacing: .15em; }
.book-topbar strong { font-family: Georgia, "Songti SC", serif; font-size: 14px; }
.header-button { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: #5e5557; }
.action-menu { position: absolute; top: calc(52px + var(--safe-top)); right: 13px; z-index: 30; display: grid; width: 170px; padding: 6px; border: 1px solid rgba(59,50,52,.08); border-radius: 15px; background: rgba(255,255,255,.96); box-shadow: 0 18px 42px rgba(49,41,43,.15); backdrop-filter: blur(16px); }
.action-menu button { display: flex; align-items: center; gap: 8px; min-height: 38px; padding: 0 10px; border-radius: 10px; color: #655b5d; font-size: 10px; text-align: left; }
.action-menu .danger { color: #a05459; }
.book-main { display: grid; gap: 18px; padding: 12px 16px 34px; }
.book-hero { display: grid; grid-template-columns: minmax(130px, 43%) minmax(0,1fr); align-items: center; gap: 17px; }
.book-identity { display: grid; gap: 8px; min-width: 0; }
.book-identity > small, .summary-card > small, .section-title small, .next-chapter-card header small, .originality-card small { color: #a17f86; font-size: 8px; font-weight: 900; letter-spacing: .14em; }
.book-identity h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 23px; line-height: 1.16; }
.book-identity > p { margin: 0; color: #867b7d; font-size: 9px; }
.hero-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.hero-tags em { padding: 4px 6px; border-radius: 999px; background: #eee9e5; color: #827678; font-size: 7px; font-style: normal; }
.book-identity dl { display: grid; gap: 5px; margin: 2px 0 0; }
.book-identity dl div { display: grid; grid-template-columns: 35px minmax(0,1fr); gap: 5px; font-size: 8px; }
.book-identity dt { color: #a09697; }
.book-identity dd { margin: 0; overflow: hidden; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.job-card { display: grid; grid-template-columns: 38px minmax(0,1fr); gap: 9px; padding: 11px; border-radius: 17px; background: #eaf2eb; color: #4f6655; }
.job-card.failed { background: #f8e9e9; color: #8b5a5f; }
.job-card > span:first-child { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 13px; background: rgba(255,255,255,.65); }
.job-card > span:last-child { display: grid; gap: 3px; }
.job-card strong { font-size: 10px; }
.job-card small { font-size: 8px; line-height: 1.4; }
.job-card i { height: 3px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.8); }
.job-card b { display: block; height: 100%; background: currentColor; }
.summary-card, .next-chapter-card, .book-comments { padding: 17px; border: 1px solid rgba(67,57,59,.055); border-radius: 24px; background: rgba(255,255,255,.68); box-shadow: 0 12px 30px rgba(56,47,49,.045); }
.summary-card h2, .next-chapter-card h2, .section-title h2 { margin: 4px 0 0; font-family: Georgia, "Songti SC", serif; font-size: 18px; }
.summary-card > p { margin: 12px 0; color: #685f61; font-size: 11px; line-height: 1.85; }
.summary-card blockquote { margin: 0; padding: 10px 12px; border-left: 3px solid #c6a8ae; border-radius: 0 12px 12px 0; background: #f5edef; color: #806b70; font-family: Georgia, "Songti SC", serif; font-size: 10px; line-height: 1.6; }
.continue-button { display: grid; grid-template-columns: 34px minmax(0,1fr) 20px; align-items: center; gap: 10px; min-height: 58px; padding: 9px 12px; border-radius: 19px; background: #363133; color: #fff; text-align: left; box-shadow: 0 15px 30px rgba(42,35,37,.16); }
.continue-button > svg:first-child { margin: auto; }
.continue-button span { display: grid; gap: 2px; }
.continue-button small { color: #d6c8cb; font-size: 7px; font-weight: 900; letter-spacing: .13em; }
.continue-button strong { overflow: hidden; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-section { display: grid; gap: 11px; }
.section-title { display: flex; align-items: end; justify-content: space-between; }
.section-title > span { display: grid; gap: 1px; }
.section-title em { color: #9d9294; font-size: 8px; font-style: normal; letter-spacing: .08em; }
.chapter-list { display: grid; overflow: hidden; border: 1px solid rgba(67,57,59,.05); border-radius: 21px; background: rgba(255,255,255,.6); }
.chapter-list button { display: grid; grid-template-columns: 34px minmax(0,1fr) 18px; align-items: center; gap: 10px; min-height: 64px; padding: 9px 12px; text-align: left; }
.chapter-list button + button { border-top: 1px solid rgba(68,59,61,.06); }
.chapter-order { font-family: Georgia, serif; color: #ad9398; font-size: 13px; font-style: italic; }
.chapter-list button > span:nth-child(2) { display: grid; gap: 4px; min-width: 0; }
.chapter-list strong { overflow: hidden; font-family: Georgia, "Songti SC", serif; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.chapter-list small { color: #998e90; font-size: 8px; }
.chapter-empty { display: grid; place-items: center; gap: 6px; padding: 28px; border: 1px dashed #d8cfcc; border-radius: 21px; color: #8c8082; text-align: center; }
.chapter-empty p { margin: 0; font-size: 9px; line-height: 1.5; }
.next-chapter-card { display: grid; gap: 12px; background: linear-gradient(145deg, #f1e3e6, #e6eee7); }
.next-chapter-card header { display: flex; align-items: center; justify-content: space-between; color: #705c62; }
.next-chapter-card header > span { display: grid; }
.next-chapter-card > p { margin: 0; color: #756b6d; font-size: 9px; line-height: 1.55; }
.direction-list { display: grid; gap: 6px; }
.direction-list button { padding: 9px 10px; border: 1px solid rgba(73,64,66,.08); border-radius: 12px; background: rgba(255,255,255,.58); color: #675d5f; font-size: 9px; line-height: 1.45; text-align: left; }
.direction-list button.selected { border-color: #607963; background: #e0ece2; color: #47604c; }
.next-chapter-card label { display: grid; gap: 5px; }
.next-chapter-card label span { font-size: 8px; font-weight: 800; }
.next-chapter-card textarea { width: 100%; padding: 10px; border: 1px solid rgba(72,63,65,.08); border-radius: 12px; outline: 0; background: rgba(255,255,255,.62); font-size: 10px; line-height: 1.5; resize: vertical; }
.generate-button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 40px; border-radius: 13px; background: #363133; color: #fff; font-size: 10px; font-weight: 850; }
.generate-button:disabled { opacity: .55; }
.error-note { margin: 0; padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,.55); color: #9a5d62; }
.originality-card { display: grid; grid-template-columns: 32px minmax(0,1fr); gap: 10px; padding: 15px; border-radius: 21px; background: #edf3ed; color: #57705d; }
.originality-card > span { display: grid; gap: 4px; }
.originality-card strong { color: #405747; font-size: 11px; }
.originality-card p { margin: 0; font-size: 8px; line-height: 1.65; }
.book-comments { display: grid; gap: 17px; }
.comment-form { display: grid; gap: 5px; padding-top: 12px; border-top: 1px solid rgba(68,59,61,.07); }
.comment-form > small { color: #8e787d; font-size: 8px; }
.comment-form > small button { color: #a14f58; font-size: 8px; }
.comment-form > span { display: grid; grid-template-columns: minmax(0,1fr) 36px; gap: 7px; }
.comment-form input { min-width: 0; padding: 0 11px; border: 1px solid #e3dcda; border-radius: 12px; background: #faf8f6; font-size: 10px; }
.comment-form > span button { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 12px; background: #3a3436; color: #fff; }
.comment-form button:disabled { opacity: .4; }
.missing-page { display: grid; place-items: center; align-content: center; gap: 10px; background: #faf8f4; color: #84787a; }
.missing-page h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 20px; }
.missing-page button { min-height: 36px; padding: 0 13px; border-radius: 12px; background: #363133; color: #fff; font-size: 10px; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>