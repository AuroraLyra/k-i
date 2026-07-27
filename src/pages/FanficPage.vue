<template>
  <section class="screen no-tabs fanfic-page fanfic-font-scope">
    <header class="top-bar fanfic-topbar">
      <button class="fanfic-wordmark" type="button" aria-label="返回主页" @click="goHome">
        <span>Fanfic</span>
        <small>stories about you two</small>
      </button>
      <div class="fanfic-actions">
        <button class="round-action" type="button" aria-label="搜索同人文" @click="showSearch = !showSearch"><Search :size="18" /></button>
        <button class="round-action primary" type="button" aria-label="新建同人文" @click="createBook"><Plus :size="20" /></button>
      </div>
    </header>

    <main class="fanfic-main">
      <label v-if="showSearch" class="search-panel">
        <Search :size="15" />
        <input v-model="searchText" autofocus placeholder="搜索同人文、作者或题材" />
        <button v-if="searchText" type="button" aria-label="清空搜索" @click="searchText = ''"><X :size="14" /></button>
      </label>

      <section v-if="latestActiveJob" class="generation-strip" :class="latestActiveJob.stage">
        <span class="generation-icon"><LoaderCircle v-if="latestActiveJob.stage !== 'failed'" class="spin" :size="16" /><CircleAlert v-else :size="16" /></span>
        <span><strong>{{ latestActiveJob.label }}</strong><small v-if="latestActiveJob.error">{{ latestActiveJob.error }}</small></span>
        <em v-if="latestActiveJob.stage !== 'failed'">{{ latestActiveJob.progress }}%</em>
        <button v-else class="job-dismiss" type="button" aria-label="关闭失败提示" @click="dismissGenerationJob(latestActiveJob.id)"><X :size="14" /></button>
      </section>

      <section v-if="continueBook && !searchText" class="continue-card" role="button" tabindex="0" @click="continueReading(continueBook)" @keydown.enter.prevent="continueReading(continueBook)">
        <FanficBookCover :book="continueBook" size="small" />
        <span class="continue-copy">
          <small>CONTINUE READING</small>
          <strong>{{ continueBook.title }}</strong>
          <p>{{ continueBook.summary }}</p>
          <span><BookOpen :size="13" /> {{ continueChapterLabel(continueBook) }}</span>
        </span>
        <ArrowUpRight :size="19" />
      </section>

      <section v-if="!searchText" class="inspiration-section">
        <header class="section-head">
          <span><small>INSPIRATION</small><strong>今天写什么</strong></span>
          <button type="button" @click="createBook">查看全部 <ChevronRight :size="13" /></button>
        </header>
        <div class="topic-scroller">
          <FanficTopicCard v-for="topic in featuredTopics" :key="topic.id" :topic="topic" compact @select="createFromTopic" />
        </div>
      </section>

      <section class="library-section">
        <header class="section-head">
          <span><small>MY FANWORKS</small><strong>{{ searchText ? '搜索结果' : '同人书架' }}</strong></span>
          <em>{{ filteredBooks.length }} 本</em>
        </header>

        <div v-if="filteredBooks.length" class="book-grid">
          <article v-for="book in filteredBooks" :key="book.id" class="book-card" role="button" tabindex="0" @click="openBook(book.id)" @keydown.enter.prevent="openBook(book.id)">
            <FanficBookCover :book="book" size="medium" show-status />
            <span class="book-copy">
              <strong>{{ book.title }}</strong>
              <small>{{ book.authorName }} · {{ chapterCount(book.id) }}/{{ book.chapterTarget }} 章</small>
              <span><em v-for="tag in book.tags.slice(0, 2)" :key="tag">{{ tag }}</em></span>
            </span>
          </article>
        </div>

        <section v-else class="empty-library">
          <span class="empty-mark"><BookHeart :size="30" /></span>
          <small>YOUR FIRST STORY</small>
          <h2>{{ searchText ? '没有找到这篇同人文' : '把你和角色写进全新的世界' }}</h2>
          <p>{{ searchText ? '换一个关键词，或回到书架继续阅读。' : '每篇作品都明确属于用户与所选角色；双方设定与角色绑定的局部世界书仅供创作参考，AU 背景与剧情由模型重新创作。' }}</p>
          <button v-if="!searchText" type="button" @click="createBook"><Sparkles :size="15" /> 创建第一篇同人文</button>
        </section>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowUpRight, BookHeart, BookOpen, ChevronRight, CircleAlert, LoaderCircle, Plus, Search, Sparkles, X } from 'lucide-vue-next';
import FanficBookCover from '@/components/fanfic/FanficBookCover.vue';
import FanficTopicCard from '@/components/fanfic/FanficTopicCard.vue';
import { useAppStore } from '@/stores/appStore';
import { useFanficStore } from '@/stores/fanficStore';
import type { FanficBook, FanficTopic } from '@/types/domain';

const router = useRouter();
const appStore = useAppStore();
const fanficStore = useFanficStore();
const showSearch = ref(false);
const searchText = ref('');

const activeUserBooks = computed(() => {
  const userId = appStore.user?.id;
  return fanficStore.sortedBooks.filter((book) => !userId || book.userId === userId);
});
const filteredBooks = computed(() => {
  const keyword = searchText.value.trim().toLocaleLowerCase();
  if (!keyword) return activeUserBooks.value;
  return activeUserBooks.value.filter((book) => [book.title, book.authorName, book.genre, book.topicTitle, ...book.tags].some((value) => value.toLocaleLowerCase().includes(keyword)));
});
const continueBook = computed(() => activeUserBooks.value.find((book) => fanficStore.chaptersForBook(book.id).length) ?? null);
const featuredTopicTitles = ['规则怪谈', '历史经营', '魔法校园', '星际军校', '末世基建流', '职场搞事业'];
const featuredTopics = computed(() => {
  const curatedTopics = featuredTopicTitles
    .map((title) => fanficStore.builtInTopics.find((topic) => topic.title === title))
    .filter((topic): topic is FanficTopic => Boolean(topic));
  return [...fanficStore.trendTopics.slice(0, 2), ...curatedTopics, ...fanficStore.builtInTopics]
    .filter((topic, index, topics) => topics.findIndex((entry) => entry.id === topic.id) === index)
    .slice(0, 6);
});
const latestActiveJob = computed(() => [...fanficStore.jobs].sort((left, right) => right.updatedAt - left.updatedAt).find((job) => job.stage === 'failed' || job.stage !== 'completed') ?? null);

onMounted(async () => {
  await fanficStore.hydrate();
});

function goHome() { void router.push({ name: 'home' }); }
function createBook() { void router.push({ name: 'fanfic-create' }); }
function createFromTopic(topicId: string) { void router.push({ name: 'fanfic-create', query: { topic: topicId } }); }
function dismissGenerationJob(jobId: string) { void fanficStore.dismissJob(jobId); }
function openBook(bookId: string) { void router.push({ name: 'fanfic-book', params: { bookId } }); }
function chapterCount(bookId: string) { return fanficStore.chaptersForBook(bookId).length; }

function continueChapterLabel(book: FanficBook) {
  const chapters = fanficStore.chaptersForBook(book.id);
  const chapter = chapters.find((entry) => entry.id === book.lastReadChapterId) ?? chapters[0];
  return chapter ? `继续第 ${chapter.order} 章 · ${chapter.title}` : '查看目录';
}

function continueReading(book: FanficBook) {
  const chapters = fanficStore.chaptersForBook(book.id);
  const chapter = chapters.find((entry) => entry.id === book.lastReadChapterId) ?? chapters[0];
  if (!chapter) return openBook(book.id);
  void router.push({ name: 'fanfic-reader', params: { bookId: book.id, chapterId: chapter.id } });
}
</script>

<style scoped>
.fanfic-page { background: #faf8f4; color: #2d292a; }
.fanfic-topbar { background: rgba(250, 248, 244, 0.9); }
.fanfic-wordmark { display: grid; gap: 1px; padding: 0; text-align: left; }
.fanfic-wordmark span { font-family: Georgia, "Songti SC", serif; font-size: 25px; font-style: italic; font-weight: 700; letter-spacing: -0.03em; }
.fanfic-wordmark small { color: #a49497; font-size: 7px; font-weight: 850; letter-spacing: 0.21em; text-transform: uppercase; }
.fanfic-actions { display: flex; gap: 8px; }
.round-action { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid rgba(64, 55, 57, 0.06); border-radius: 50%; background: rgba(255, 255, 255, 0.72); color: #4d4547; box-shadow: 0 8px 18px rgba(56, 45, 48, 0.05); }
.round-action.primary { background: #343032; color: #fff; }
.fanfic-main { display: grid; gap: 26px; padding: 10px 16px 30px; }
.search-panel { display: flex; align-items: center; gap: 9px; min-height: 42px; padding: 0 13px; border: 1px solid rgba(70, 61, 62, 0.07); border-radius: 16px; background: #fff; color: #93898b; box-shadow: 0 10px 28px rgba(56, 48, 50, 0.055); }
.search-panel input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: #3f393b; font-size: 12px; }
.search-panel button { display: grid; place-items: center; width: 28px; height: 28px; color: #9b9293; }
.generation-strip { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; align-items: center; gap: 9px; padding: 10px 12px; border-radius: 17px; background: #eef5ef; color: #46604e; }
.generation-strip.failed { background: #f9ecec; color: #875d60; }
.generation-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 12px; background: rgba(255, 255, 255, 0.68); }
.generation-strip > span:nth-child(2) { display: grid; gap: 2px; min-width: 0; }
.generation-strip strong { font-size: 10px; }
.generation-strip small { overflow: hidden; font-size: 8px; opacity: .8; text-overflow: ellipsis; white-space: nowrap; }
.generation-strip em { font-size: 9px; font-style: normal; font-weight: 850; }
.continue-card { display: grid; grid-template-columns: 90px minmax(0, 1fr) 20px; align-items: center; gap: 14px; padding: 12px; border-radius: 26px; background: linear-gradient(145deg, #f1e4e4, #e7eee7); box-shadow: 0 18px 42px rgba(57, 49, 50, 0.08); }
.continue-copy { display: grid; gap: 6px; min-width: 0; }
.continue-copy > small, .section-head small { color: #9a7e83; font-size: 8px; font-weight: 900; letter-spacing: 0.16em; }
.continue-copy strong { overflow: hidden; font-family: Georgia, "Songti SC", serif; font-size: 18px; line-height: 1.15; text-overflow: ellipsis; white-space: nowrap; }
.continue-copy p { display: -webkit-box; margin: 0; overflow: hidden; color: #756d6f; font-size: 9px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.continue-copy > span { display: flex; align-items: center; gap: 5px; color: #5d745f; font-size: 9px; font-weight: 800; }
.inspiration-section, .library-section { display: grid; gap: 13px; min-width: 0; }
.section-head { display: flex; align-items: end; justify-content: space-between; padding: 0 2px; }
.section-head > span { display: grid; gap: 3px; }
.section-head strong { font-family: Georgia, "Songti SC", serif; font-size: 18px; }
.section-head button { display: flex; align-items: center; gap: 1px; color: #8f8587; font-size: 9px; }
.section-head > em { color: #a29698; font-size: 9px; font-style: normal; }
.topic-scroller { display: flex; gap: 10px; margin: 0 -16px; padding: 2px 16px 12px; overflow-x: auto; scrollbar-width: none; }
.topic-scroller::-webkit-scrollbar { display: none; }
.book-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px 8px; }
.book-card { display: grid; gap: 7px; min-width: 0; }
.book-card :deep(.fanfic-cover) { border-radius: 14px; }
.book-card :deep(.fanfic-cover > em) { top: 7px; right: 7px; padding: 4px 6px; font-size: 7px; }
.book-copy { display: grid; gap: 3px; padding: 0 2px; }
.book-copy strong { overflow: hidden; font-family: Georgia, "Songti SC", serif; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.book-copy small { color: #948a8c; font-size: 8px; }
.book-copy > span { display: flex; gap: 3px; overflow: hidden; }
.book-copy em { flex: 0 0 auto; padding: 2px 5px; border-radius: 999px; background: #eee9e5; color: #897d7f; font-size: 6px; font-style: normal; }
.empty-library { display: grid; place-items: center; gap: 8px; padding: 42px 22px; border: 1px dashed rgba(104, 90, 93, 0.18); border-radius: 28px; background: rgba(255, 255, 255, 0.44); text-align: center; }
.empty-mark { display: grid; place-items: center; width: 58px; height: 58px; margin-bottom: 5px; border-radius: 22px; background: #f0e2e5; color: #836a70; transform: rotate(-4deg); }
.empty-library > small { color: #a48d91; font-size: 8px; font-weight: 900; letter-spacing: .17em; }
.empty-library h2 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 19px; }
.empty-library p { max-width: 260px; margin: 0; color: #8b8183; font-size: 10px; line-height: 1.65; }
.empty-library button { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; margin-top: 8px; padding: 0 15px; border-radius: 14px; background: #363133; color: #fff; font-size: 10px; font-weight: 800; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>