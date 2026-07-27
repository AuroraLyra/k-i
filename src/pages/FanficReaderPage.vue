<template>
  <section v-if="book && chapter" class="screen no-tabs reader-page fanfic-font-scope" :class="[`theme-${readerTheme}`, { 'controls-hidden': controlsHidden }]">
    <header class="reader-header">
      <button type="button" aria-label="返回同人文详情" @click="goBook"><ChevronLeft :size="21" /></button>
      <span><small>{{ book.title }}</small><strong>第 {{ chapter.order }} 章</strong></span>
      <button type="button" aria-label="阅读设置" @click="showSettings = !showSettings"><Type :size="19" /></button>
    </header>

    <section v-if="showSettings" class="reader-settings">
      <span><small>字号</small><button type="button" @click="fontSize = Math.max(15, fontSize - 1)">A−</button><em>{{ fontSize }}</em><button type="button" @click="fontSize = Math.min(24, fontSize + 1)">A＋</button></span>
      <span><small>纸张</small><button v-for="theme in themes" :key="theme.id" type="button" :class="['theme-dot', theme.id, { selected: readerTheme === theme.id }]" :aria-label="theme.label" @click="readerTheme = theme.id"></button></span>
    </section>

    <main ref="scrollContainer" class="reader-scroll" @scroll.passive="handleScroll" @click="hideFloatingPanels">
      <article class="reader-article" :style="{ '--reader-font-size': `${fontSize}px` }">
        <header class="chapter-heading">
          <small>CHAPTER {{ String(chapter.order).padStart(2, '0') }}</small>
          <h1>{{ chapter.title }}</h1>
          <span><em>{{ chapter.wordCount }} 字</em><i></i><em>约 {{ readMinutes }} 分钟</em></span>
          <p>{{ chapter.summary }}</p>
        </header>

        <section class="chapter-body">
          <template v-for="(paragraph, index) in paragraphs" :key="paragraph.id">
            <p :data-paragraph-id="paragraph.id">{{ paragraph.text }}</p>
            <button v-for="hotspot in hotspotsAt(index)" :key="hotspot.id" class="hotspot-anchor" type="button" @click.stop="openHotspot(hotspot.id)">
              <span><MessageCircleHeart :size="15" /></span>
              <span><small>{{ hotspot.label || '读者沸腾处' }}</small><strong>{{ hotspotCommentLabel(hotspot.id) }}</strong></span>
              <ChevronRight :size="15" />
            </button>
          </template>
        </section>

        <footer class="chapter-ending">
          <span>— END OF CHAPTER {{ String(chapter.order).padStart(2, '0') }} —</span>
          <blockquote v-if="chapter.hotspots.at(-1)?.excerpt">“{{ chapter.hotspots.at(-1)?.excerpt }}”</blockquote>
          <section class="chapter-stats"><span><MessageCircle :size="14" /> {{ chapterComments.length }} 条章评</span><span><Heart :size="14" /> {{ totalLikes }} 次共鸣</span></section>
        </footer>

        <section v-if="generalChapterComments.length" class="general-comments">
          <header><small>CHAPTER DISCUSSION</small><strong>本章讨论</strong></header>
          <FanficCommentList :comments="generalChapterComments" :book="book" @like="fanficStore.likeComment" />
        </section>

        <section v-if="isLastChapter && book.status !== 'completed'" class="next-direction">
          <small>NEXT EPISODE</small>
          <h2>下一章，你想往哪里走？</h2>
          <p>选择一个方向，或写下自己的想法。章节会同时生成正文和高潮评论点，评论内容只在读者点击对应热点时按需加载。</p>
          <button v-for="direction in chapter.nextDirections" :key="direction" type="button" :class="{ selected: selectedDirection === direction }" @click="selectedDirection = selectedDirection === direction ? '' : direction">{{ direction }}</button>
          <textarea v-model="customDirection" maxlength="500" rows="3" placeholder="自定义下一章方向（可选）"></textarea>
          <button class="generate-next" type="button" :disabled="generating" @click="generateNext"><LoaderCircle v-if="generating" class="spin" :size="16" /><Sparkles v-else :size="16" />{{ generating ? '正在生成章节' : '生成下一章' }}</button>
          <em v-if="generateError">{{ generateError }}</em>
        </section>

        <nav class="chapter-navigation">
          <button type="button" :disabled="!previousChapter" @click="previousChapter && openChapter(previousChapter.id)"><ChevronLeft :size="17" /><span><small>PREVIOUS</small><strong>{{ previousChapter?.title || '已经是第一章' }}</strong></span></button>
          <button type="button" :disabled="!nextChapter" @click="nextChapter && openChapter(nextChapter.id)"><span><small>NEXT</small><strong>{{ nextChapter?.title || '等待下一章' }}</strong></span><ChevronRight :size="17" /></button>
        </nav>

        <button class="back-to-book" type="button" @click="goBook"><ListTree :size="15" /> 返回目录与整本评论</button>
      </article>
    </main>

    <span class="reading-progress"><i :style="{ width: `${currentProgress}%` }"></i></span>

    <Transition name="sheet">
      <section v-if="selectedHotspot" class="comment-overlay" @click.self="closeHotspot">
        <article class="comment-sheet">
          <header><span><small>LIVE REACTIONS</small><strong>{{ selectedHotspot.label }}</strong></span><button type="button" aria-label="关闭评论" @click="closeHotspot"><X :size="19" /></button></header>
          <blockquote>“{{ selectedHotspot.excerpt }}”</blockquote>
          <main>
            <FanficCommentList v-if="selectedHotspotComments.length" :comments="selectedHotspotComments" :book="book" @like="fanficStore.likeComment" @reply="replyToComment" />
            <span v-if="hotspotCommentsLoading" class="comments-loading"><LoaderCircle class="spin" :size="18" /><strong>正在生成这一刻的评论</strong><small>只会请求当前高潮点，完成后自动缓存</small></span>
            <span v-else-if="hotspotCommentError" class="comments-error"><CircleAlert :size="18" /><strong>评论生成失败</strong><small>{{ hotspotCommentError }}</small><button type="button" @click="retryHotspotComments">重新生成</button></span>
            <p v-else-if="!selectedHotspotComments.length" class="no-comments">点击后会为这一刻单独生成评论。</p>
          </main>
          <form @submit.prevent="submitHotspotComment">
            <small v-if="replyTarget">回复 {{ replyTarget.authorName }} <button type="button" @click="replyTargetId = ''">取消</button></small>
            <span><input v-model="commentDraft" maxlength="500" :placeholder="`评论这一刻 · ${book.userName}`" /><button type="submit" :disabled="hotspotCommentsLoading || !commentDraft.trim()"><Send :size="15" /></button></span>
          </form>
        </article>
      </section>
    </Transition>
  </section>

  <section v-else class="screen no-tabs missing-reader fanfic-font-scope"><BookX :size="34" /><h1>这一章暂时不存在</h1><button type="button" @click="goBook">返回同人文目录</button></section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { BookX, ChevronLeft, ChevronRight, CircleAlert, Heart, ListTree, LoaderCircle, MessageCircle, MessageCircleHeart, Send, Sparkles, Type, X } from 'lucide-vue-next';
import FanficCommentList from '@/components/fanfic/FanficCommentList.vue';
import { useFanficStore } from '@/stores/fanficStore';

const props = defineProps<{ bookId: string; chapterId: string }>();
const router = useRouter();
const fanficStore = useFanficStore();
const scrollContainer = ref<HTMLElement | null>(null);
const fontSize = ref(18);
const readerTheme = ref<'paper' | 'white' | 'night'>('paper');
const showSettings = ref(false);
const controlsHidden = ref(false);
const selectedHotspotId = ref('');
const replyTargetId = ref('');
const commentDraft = ref('');
const selectedDirection = ref('');
const customDirection = ref('');
const generating = ref(false);
const generateError = ref('');
const hotspotCommentError = ref('');
const currentProgress = ref(0);
let progressTimer = 0;
let previousScrollTop = 0;

const themes = [{ id: 'paper' as const, label: '米白纸张' }, { id: 'white' as const, label: '纯白纸张' }, { id: 'night' as const, label: '夜间模式' }];
const book = computed(() => fanficStore.bookById(props.bookId));
const chapter = computed(() => fanficStore.chapterById(props.chapterId));
const chapters = computed(() => fanficStore.chaptersForBook(props.bookId));
const chapterIndex = computed(() => chapters.value.findIndex((entry) => entry.id === props.chapterId));
const previousChapter = computed(() => chapterIndex.value > 0 ? chapters.value[chapterIndex.value - 1] : null);
const nextChapter = computed(() => chapterIndex.value >= 0 ? chapters.value[chapterIndex.value + 1] ?? null : null);
const isLastChapter = computed(() => chapterIndex.value === chapters.value.length - 1);
const chapterComments = computed(() => fanficStore.commentsForChapter(props.chapterId));
const generalChapterComments = computed(() => chapterComments.value.filter((comment) => !comment.hotspotId));
const paragraphs = computed(() => chapter.value?.paragraphs.length
  ? chapter.value.paragraphs
  : chapter.value?.content.split(/\n\s*\n/).map((text, index) => ({ id: `${props.chapterId}-paragraph-${index + 1}`, text: text.trim() })).filter((entry) => entry.text) ?? []);
const readMinutes = computed(() => Math.max(1, Math.ceil((chapter.value?.wordCount ?? 0) / 420)));
const selectedHotspot = computed(() => chapter.value?.hotspots.find((hotspot) => hotspot.id === selectedHotspotId.value) ?? null);
const selectedHotspotComments = computed(() => selectedHotspotId.value ? fanficStore.commentsForHotspot(props.chapterId, selectedHotspotId.value) : []);
const hotspotCommentsLoading = computed(() => Boolean(selectedHotspotId.value && fanficStore.isGeneratingHotspot(props.chapterId, selectedHotspotId.value)));
const replyTarget = computed(() => selectedHotspotComments.value.find((comment) => comment.id === replyTargetId.value) ?? null);
const totalLikes = computed(() => chapterComments.value.reduce((total, comment) => total + comment.likes, 0));

onMounted(async () => {
  await fanficStore.hydrate();
  await restoreProgress();
});

watch(() => props.chapterId, async () => {
  selectedHotspotId.value = '';
  hotspotCommentError.value = '';
  selectedDirection.value = '';
  customDirection.value = '';
  currentProgress.value = 0;
  await restoreProgress();
});

onBeforeUnmount(() => {
  window.clearTimeout(progressTimer);
  persistProgress();
});

function goBook() { void router.push({ name: 'fanfic-book', params: { bookId: props.bookId } }); }
function openChapter(chapterId: string) { void router.replace({ name: 'fanfic-reader', params: { bookId: props.bookId, chapterId } }); }

function hotspotsAt(index: number) {
  return chapter.value?.hotspots.filter((hotspot) => {
    if (hotspot.paragraphId === paragraphs.value[index]?.id) return true;
    const paragraphExists = paragraphs.value.some((paragraph) => paragraph.id === hotspot.paragraphId);
    return !paragraphExists && index === paragraphs.value.length - 1;
  }) ?? [];
}

function hotspotCommentCount(hotspotId: string) { return fanficStore.commentsForHotspot(props.chapterId, hotspotId).length; }

function hotspotCommentLabel(hotspotId: string) {
  const count = hotspotCommentCount(hotspotId);
  if (count) return `${count} 条评论正在讨论这一刻`;
  if (fanficStore.isGeneratingHotspot(props.chapterId, hotspotId)) return '正在生成这一刻的评论';
  return '点击生成这一刻的评论';
}

async function openHotspot(hotspotId: string) {
  selectedHotspotId.value = hotspotId;
  replyTargetId.value = '';
  commentDraft.value = '';
  hotspotCommentError.value = '';
  if (fanficStore.commentsForHotspot(props.chapterId, hotspotId).some((comment) => comment.origin === 'generated')) return;
  try {
    await fanficStore.generateHotspotComments(props.chapterId, hotspotId);
  } catch (error) {
    hotspotCommentError.value = error instanceof Error ? error.message : '评论生成失败，请重试。';
  }
}

function closeHotspot() { selectedHotspotId.value = ''; replyTargetId.value = ''; hotspotCommentError.value = ''; }
function replyToComment(commentId: string) { replyTargetId.value = commentId; }

async function retryHotspotComments() {
  if (!selectedHotspotId.value || hotspotCommentsLoading.value) return;
  hotspotCommentError.value = '';
  try {
    await fanficStore.generateHotspotComments(props.chapterId, selectedHotspotId.value);
  } catch (error) {
    hotspotCommentError.value = error instanceof Error ? error.message : '评论生成失败，请重试。';
  }
}

async function submitHotspotComment() {
  const content = commentDraft.value.trim();
  if (!content || !selectedHotspot.value) return;
  await fanficStore.addUserComment({
    bookId: props.bookId,
    chapterId: props.chapterId,
    hotspotId: selectedHotspot.value.id,
    content,
    parentId: replyTargetId.value || undefined,
  });
  commentDraft.value = '';
  replyTargetId.value = '';
}

function hideFloatingPanels() { showSettings.value = false; }

function handleScroll() {
  const element = scrollContainer.value;
  if (!element) return;
  const available = element.scrollHeight - element.clientHeight;
  currentProgress.value = available > 0 ? Math.min(100, Math.round((element.scrollTop / available) * 100)) : 100;
  controlsHidden.value = element.scrollTop > previousScrollTop && element.scrollTop > 90;
  previousScrollTop = element.scrollTop;
  window.clearTimeout(progressTimer);
  progressTimer = window.setTimeout(persistProgress, 500);
}

function persistProgress() {
  if (!chapter.value) return;
  const element = scrollContainer.value;
  const paragraphElements = element ? [...element.querySelectorAll<HTMLElement>('[data-paragraph-id]')] : [];
  const readingLine = (element?.scrollTop ?? 0) + 150;
  const activeParagraph = paragraphElements.filter((paragraph) => paragraph.offsetTop <= readingLine).at(-1) ?? paragraphElements[0];
  void fanficStore.updateReadingProgress(props.bookId, props.chapterId, activeParagraph?.dataset.paragraphId ?? '');
}

async function restoreProgress() {
  await nextTick();
  const element = scrollContainer.value;
  if (!element) return;
  const paragraphId = book.value?.lastReadChapterId === props.chapterId ? book.value.lastReadParagraphId : '';
  const paragraph = [...element.querySelectorAll<HTMLElement>('[data-paragraph-id]')].find((entry) => entry.dataset.paragraphId === paragraphId);
  element.scrollTop = paragraph ? Math.max(0, paragraph.offsetTop - 110) : 0;
  const available = element.scrollHeight - element.clientHeight;
  currentProgress.value = available > 0 ? Math.min(100, Math.round((element.scrollTop / available) * 100)) : 100;
  previousScrollTop = element.scrollTop;
  await fanficStore.updateReadingProgress(props.bookId, props.chapterId, paragraphId || paragraphs.value[0]?.id || '');
}

async function generateNext() {
  if (generating.value) return;
  generating.value = true;
  generateError.value = '';
  try {
    const direction = customDirection.value.trim() || selectedDirection.value;
    const generated = await fanficStore.generateNextChapter(props.bookId, direction);
    if (generated) openChapter(generated.id);
  } catch (error) {
    generateError.value = error instanceof Error ? error.message : '下一章生成失败。';
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped>
.reader-page { --reader-bg: #f7f1e7; --reader-card: #fbf7ef; --reader-text: #342e2c; --reader-muted: #8e817c; background: var(--reader-bg); color: var(--reader-text); transition: background .25s, color .25s; }
.reader-page.theme-white { --reader-bg: #fff; --reader-card: #fff; --reader-text: #272426; --reader-muted: #81797b; }
.reader-page.theme-night { --reader-bg: #211f20; --reader-card: #292627; --reader-text: #e9e1d7; --reader-muted: #aaa09a; }
.reader-header { position: absolute; inset: 0 0 auto; z-index: 20; display: flex; align-items: center; justify-content: space-between; min-height: calc(52px + var(--safe-top)); padding: var(--safe-top) calc(10px + var(--safe-right)) 0 calc(10px + var(--safe-left)); background: color-mix(in srgb, var(--reader-bg) 90%, transparent); border-bottom: 1px solid color-mix(in srgb, var(--reader-text) 7%, transparent); backdrop-filter: blur(14px); transition: transform .25s; }
.controls-hidden .reader-header { transform: translateY(-100%); }
.reader-header button { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; color: var(--reader-text); }
.reader-header > span { display: grid; place-items: center; gap: 1px; max-width: 60%; }
.reader-header small { max-width: 100%; overflow: hidden; color: var(--reader-muted); font-size: 7px; font-weight: 850; letter-spacing: .08em; text-overflow: ellipsis; white-space: nowrap; }
.reader-header strong { font-family: Georgia, "Songti SC", serif; font-size: 12px; }
.reader-settings { position: absolute; top: calc(58px + var(--safe-top)); right: 12px; z-index: 30; display: grid; gap: 10px; width: 205px; padding: 12px; border: 1px solid color-mix(in srgb, var(--reader-text) 8%, transparent); border-radius: 17px; background: color-mix(in srgb, var(--reader-card) 95%, transparent); box-shadow: 0 18px 42px rgba(30,25,26,.17); backdrop-filter: blur(15px); }
.reader-settings > span { display: flex; align-items: center; gap: 7px; }
.reader-settings small { width: 32px; color: var(--reader-muted); font-size: 8px; }
.reader-settings button:not(.theme-dot), .reader-settings em { display: grid; place-items: center; width: 32px; height: 28px; border-radius: 9px; background: color-mix(in srgb, var(--reader-text) 7%, transparent); color: var(--reader-text); font-size: 9px; font-style: normal; }
.theme-dot { width: 25px; height: 25px; border: 2px solid transparent; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(60,52,53,.12); }
.theme-dot.paper { background: #f7f1e7; }.theme-dot.white { background: #fff; }.theme-dot.night { background: #292627; }.theme-dot.selected { border-color: #a48289; }
.reader-scroll { position: absolute; inset: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.reader-article { width: min(100%, 680px); margin: 0 auto; padding: calc(82px + var(--safe-top)) max(24px, calc((100vw - 680px) / 2)) calc(38px + var(--safe-bottom)); }
.chapter-heading { display: grid; place-items: center; gap: 10px; margin-bottom: 39px; text-align: center; }
.chapter-heading > small { color: #a48387; font-family: Georgia, serif; font-size: 9px; font-style: italic; letter-spacing: .17em; }
.chapter-heading h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 28px; font-weight: 650; line-height: 1.3; }
.chapter-heading > span { display: flex; align-items: center; gap: 8px; color: var(--reader-muted); }
.chapter-heading em { font-size: 8px; font-style: normal; }
.chapter-heading i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; }
.chapter-heading p { max-width: 430px; margin: 5px 0 0; padding: 11px 14px; border-radius: 15px; background: color-mix(in srgb, var(--reader-text) 4%, transparent); color: var(--reader-muted); font-size: 9px; line-height: 1.65; }
.chapter-body { display: grid; }
.chapter-body p { margin: 0 0 1.28em; font-family: Georgia, "Songti SC", "STSong", serif; font-size: var(--reader-font-size); line-height: 2.05; letter-spacing: .03em; text-align: justify; }
.chapter-body p:first-child::first-letter { float: left; margin: .12em .12em 0 0; color: #9d747c; font-size: 3.2em; font-weight: 700; line-height: .8; }
.hotspot-anchor { display: grid; grid-template-columns: 34px minmax(0,1fr) 18px; align-items: center; gap: 9px; width: 100%; margin: 0 0 28px; padding: 9px 11px; border: 1px solid color-mix(in srgb, #b88b93 20%, transparent); border-radius: 16px; background: color-mix(in srgb, #eacfd4 30%, var(--reader-card)); color: color-mix(in srgb, #6f5056 82%, var(--reader-text)); text-align: left; }
.hotspot-anchor > span:first-child { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 12px; background: color-mix(in srgb, #fff 68%, transparent); }
.hotspot-anchor > span:nth-child(2) { display: grid; gap: 2px; }
.hotspot-anchor small { font-family: Georgia, "Songti SC", serif; font-size: 9px; }
.hotspot-anchor strong { font-size: 7px; opacity: .72; }
.chapter-ending { display: grid; place-items: center; gap: 17px; margin-top: 31px; padding: 34px 0 19px; border-top: 1px solid color-mix(in srgb, var(--reader-text) 9%, transparent); text-align: center; }
.chapter-ending > span { color: var(--reader-muted); font-family: Georgia, serif; font-size: 8px; letter-spacing: .15em; }
.chapter-ending blockquote { max-width: 470px; margin: 0; color: color-mix(in srgb, var(--reader-text) 74%, #a47c83); font-family: Georgia, "Songti SC", serif; font-size: 13px; font-style: italic; line-height: 1.8; }
.chapter-stats { display: flex; gap: 17px; color: var(--reader-muted); font-size: 8px; }
.chapter-stats span { display: flex; align-items: center; gap: 4px; }
.general-comments { display: grid; gap: 14px; margin-top: 22px; padding: 18px; border: 1px solid color-mix(in srgb, var(--reader-text) 7%, transparent); border-radius: 23px; background: color-mix(in srgb, var(--reader-card) 82%, transparent); }
.general-comments header { display: grid; gap: 2px; }
.general-comments header small { color: #a48387; font-size: 8px; font-weight: 900; letter-spacing: .13em; }
.general-comments header strong { font-family: Georgia, "Songti SC", serif; font-size: 17px; }
.next-direction { display: grid; gap: 9px; margin-top: 22px; padding: 18px; border-radius: 23px; background: color-mix(in srgb, #d9e6dc 55%, var(--reader-card)); }
.next-direction > small { color: #78907d; font-size: 8px; font-weight: 950; letter-spacing: .13em; }
.next-direction h2 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 18px; }
.next-direction p { margin: 0 0 4px; color: var(--reader-muted); font-size: 9px; line-height: 1.6; }
.next-direction > button:not(.generate-next) { padding: 9px 10px; border: 1px solid color-mix(in srgb, var(--reader-text) 9%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--reader-card) 72%, transparent); color: var(--reader-text); font-size: 9px; line-height: 1.45; text-align: left; }
.next-direction > button.selected { border-color: #657d69; background: #dbe8dd; color: #49604e; }
.next-direction textarea { padding: 10px; border: 1px solid color-mix(in srgb, var(--reader-text) 9%, transparent); border-radius: 12px; outline: 0; background: color-mix(in srgb, var(--reader-card) 78%, transparent); color: var(--reader-text); font-size: 10px; resize: vertical; }
.generate-next { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 39px; border-radius: 13px; background: #373234; color: #fff; font-size: 10px; font-weight: 850; }
.generate-next:disabled { opacity: .55; }
.next-direction > em { color: #9a5d63; font-size: 8px; font-style: normal; }
.chapter-navigation { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; margin-top: 24px; }
.chapter-navigation button { display: grid; grid-template-columns: 18px minmax(0,1fr); align-items: center; gap: 6px; min-height: 54px; padding: 8px 9px; border: 1px solid color-mix(in srgb, var(--reader-text) 8%, transparent); border-radius: 16px; background: color-mix(in srgb, var(--reader-card) 78%, transparent); color: var(--reader-text); text-align: left; }
.chapter-navigation button:last-child { grid-template-columns: minmax(0,1fr) 18px; text-align: right; }
.chapter-navigation button:disabled { opacity: .38; }
.chapter-navigation span { display: grid; gap: 2px; min-width: 0; }
.chapter-navigation small { color: var(--reader-muted); font-size: 7px; letter-spacing: .1em; }
.chapter-navigation strong { overflow: hidden; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
.back-to-book { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; min-height: 40px; margin-top: 9px; border-radius: 13px; color: var(--reader-muted); font-size: 9px; }
.reading-progress { position: absolute; right: 0; bottom: 0; left: 0; z-index: 25; height: 3px; background: color-mix(in srgb, var(--reader-text) 7%, transparent); }
.reading-progress i { display: block; height: 100%; background: linear-gradient(90deg,#b88992,#708e77); transition: width .12s linear; }
.comment-overlay { position: fixed; inset: 0; z-index: 80; display: flex; align-items: flex-end; background: rgba(30,25,27,.34); backdrop-filter: blur(3px); }
.comment-sheet { display: flex; flex-direction: column; width: 100%; max-height: min(78vh, 720px); padding-bottom: var(--safe-bottom); border-radius: 27px 27px 0 0; background: #fbf9f6; color: #302b2d; box-shadow: 0 -20px 60px rgba(31,25,27,.18); }
.comment-sheet > header { display: flex; align-items: center; justify-content: space-between; padding: 15px 17px 10px; }
.comment-sheet > header > span { display: grid; gap: 2px; }
.comment-sheet header small { color: #a17e85; font-size: 7px; font-weight: 950; letter-spacing: .15em; }
.comment-sheet header strong { font-family: Georgia, "Songti SC", serif; font-size: 16px; }
.comment-sheet header button { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #eee9e5; }
.comment-sheet > blockquote { margin: 0 17px 10px; padding: 10px 12px; border-left: 3px solid #c199a1; border-radius: 0 12px 12px 0; background: #f3e8ea; color: #755f64; font-family: Georgia, "Songti SC", serif; font-size: 10px; line-height: 1.6; }
.comment-sheet > main { flex: 1; min-height: 90px; overflow-y: auto; padding: 5px 17px 12px; }
.no-comments { color: #94898b; font-size: 9px; text-align: center; }
.comments-loading, .comments-error { display: grid; place-items: center; gap: 6px; padding: 22px 14px; color: #8d7f82; text-align: center; }
.comments-loading strong, .comments-error strong { color: #5f5557; font-size: 10px; }
.comments-loading small, .comments-error small { max-width: 280px; font-size: 8px; line-height: 1.55; }
.comments-error { color: #9b5e64; }
.comments-error button { min-height: 31px; margin-top: 3px; padding: 0 11px; border-radius: 10px; background: #8f5c62; color: #fff; font-size: 8px; font-weight: 800; }
.comment-sheet > form { display: grid; gap: 4px; padding: 10px 15px; border-top: 1px solid rgba(66,57,59,.07); }
.comment-sheet form > small { color: #8e747a; font-size: 8px; }.comment-sheet form > small button { color: #a24f58; font-size: 8px; }
.comment-sheet form > span { display: grid; grid-template-columns: minmax(0,1fr) 38px; gap: 7px; }
.comment-sheet input { min-width: 0; padding: 0 12px; border: 1px solid #e2dad8; border-radius: 13px; outline: 0; background: #f7f3f0; font-size: 10px; }
.comment-sheet form > span button { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 13px; background: #393335; color: #fff; }
.comment-sheet form button:disabled { opacity: .4; }
.sheet-enter-active,.sheet-leave-active { transition: opacity .22s; }.sheet-enter-active .comment-sheet,.sheet-leave-active .comment-sheet { transition: transform .22s ease; }.sheet-enter-from,.sheet-leave-to { opacity: 0; }.sheet-enter-from .comment-sheet,.sheet-leave-to .comment-sheet { transform: translateY(100%); }
.missing-reader { display: grid; place-items: center; align-content: center; gap: 10px; background: #faf8f4; color: #877b7d; }
.missing-reader h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 20px; }
.missing-reader button { min-height: 36px; padding: 0 13px; border-radius: 12px; background: #383234; color: #fff; font-size: 10px; }
.spin { animation: spin 1s linear infinite; }@keyframes spin { to { transform: rotate(360deg); } }
</style>