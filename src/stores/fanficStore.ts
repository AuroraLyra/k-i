import { computed, onScopeDispose, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { builtInFanficTopics } from '@/data/fanficTopics';
import { applyFanficChapterMutation, deleteEntity, loadFanficSnapshot, putEntity, putFanficChapterBundle, putFanficHotspotComments, pruneUnusedStoredMediaCache } from '@/data/db';
import {
  fetchFanficTrendKeywords,
  generateFanficBookPlan,
  generateFanficChapter,
  generateFanficHotspotComments,
  generateFanficCover,
  generateFanficTrendTopics,
  type FanficCreationPreferences
} from '@/services/fanfic';
import { persistFanficStartupCache, readFanficStartupCache } from '@/services/fanficStartupCache';
import type { FanficBook, FanficChapter, FanficComment, FanficGenerationJob, FanficTopic } from '@/types/domain';
import { createFanficProfileFingerprint, createProceduralFanficCover, getFanficLocalWorldBookSourceText, normalizeFanficBook, requireFanficTrueNames, selectFanficLocalWorldBooks } from '@/utils/fanfic';
import { collectFanficChapterContinuity, resequenceFanficChapters } from '@/utils/fanficChapter';
import { createId } from '@/utils/id';
import { hydrateStoredMediaRefs } from '@/utils/mediaStorage';
import { useAppStore } from './appStore';

export interface CreateFanficBookInput {
  characterId: string;
  topicId: string;
  preferences: FanficCreationPreferences;
}

function uniqueStrings(values: string[], limit = 40) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(-limit);
}

function normalizeTopic(topic: FanficTopic): FanficTopic {
  return {
    ...topic,
    source: ['built-in', 'trend', 'ai', 'custom'].includes(topic.source) ? topic.source : 'custom',
    title: String(topic.title ?? '').trim(),
    hook: String(topic.hook ?? '').trim(),
    setting: String(topic.setting ?? '').trim(),
    conflict: String(topic.conflict ?? '').trim(),
    relationship: String(topic.relationship ?? '').trim(),
    tags: uniqueStrings(Array.isArray(topic.tags) ? topic.tags : [], 8),
    trendKeywords: uniqueStrings(Array.isArray(topic.trendKeywords) ? topic.trendKeywords : [], 6),
    createdAt: Number(topic.createdAt) || Date.now()
  };
}

function normalizeChapter(chapter: FanficChapter): FanficChapter {
  const paragraphs = Array.isArray(chapter.paragraphs) && chapter.paragraphs.length
    ? chapter.paragraphs.map((paragraph, index) => ({ id: String(paragraph.id ?? `${chapter.id}_p${index + 1}`), text: String(paragraph.text ?? '').trim() })).filter((paragraph) => paragraph.text)
    : String(chapter.content ?? '').split(/\n{2,}/).map((text, index) => ({ id: `${chapter.id}_p${index + 1}`, text: text.trim() })).filter((paragraph) => paragraph.text);
  return {
    ...chapter,
    content: paragraphs.map((paragraph) => paragraph.text).join('\n\n'),
    paragraphs,
    continuity: uniqueStrings(Array.isArray(chapter.continuity) ? chapter.continuity : [], 20),
    hotspots: Array.isArray(chapter.hotspots) ? chapter.hotspots : [],
    nextDirections: uniqueStrings(Array.isArray(chapter.nextDirections) ? chapter.nextDirections : [], 3),
    wordCount: Number(chapter.wordCount) || [...paragraphs.map((paragraph) => paragraph.text).join('').replace(/\s+/g, '')].length,
    status: chapter.status || 'published'
  };
}

function normalizeComment(comment: FanficComment): FanficComment {
  const legacyComment = comment as FanficComment & { authorType?: string; origin?: string };
  const authorType = ['author', 'reader', 'character', 'user'].includes(String(legacyComment.authorType))
    ? legacyComment.authorType as FanficComment['authorType']
    : 'reader';
  return {
    ...comment,
    authorType,
    origin: legacyComment.origin === 'manual' || authorType === 'user' ? 'manual' : 'generated',
    authorId: String(comment.authorId ?? '').trim() || undefined,
    authorName: String(comment.authorName ?? '').trim(),
    avatarSeed: String(comment.avatarSeed ?? comment.id),
    content: String(comment.content ?? '').trim(),
    likes: Math.max(0, Math.round(Number(comment.likes) || 0)),
    createdAt: Number(comment.createdAt) || Date.now()
  };
}

export const useFanficStore = defineStore('fanfic', () => {
  const appStore = useAppStore();
  const startupCache = readFanficStartupCache();
  const ready = ref(false);
  const hydratePromise = ref<Promise<void> | null>(null);
  const books = ref<FanficBook[]>((startupCache?.books ?? []).map(normalizeFanficBook));
  const chapters = ref<FanficChapter[]>((startupCache?.chapters ?? []).map(normalizeChapter));
  const comments = ref<FanficComment[]>([]);
  const startupTopics = (startupCache?.topics ?? []).map(normalizeTopic);
  const topics = ref<FanficTopic[]>([...builtInFanficTopics, ...startupTopics].filter((topic, index, entries) => entries.findIndex((entry) => entry.id === topic.id) === index));
  const jobs = ref<FanficGenerationJob[]>((startupCache?.jobs ?? []).map((job) => ({ ...job, progress: Number(job.progress) || (job.stage === 'completed' ? 100 : 0) })));
  const generatingBookIds = ref<string[]>([]);
  const generatingHotspotKeys = ref<string[]>([]);
  const mutatingChapterIds = ref<string[]>([]);
  const refreshingTrends = ref(false);
  const trendStatus = ref('');
  const hotspotGenerationPromises = new Map<string, Promise<FanficComment[]>>();
  let startupCacheSaveTimer: number | undefined;

  const sortedBooks = computed(() => [...books.value].sort((left, right) => right.updatedAt - left.updatedAt));
  const builtInTopics = computed(() => topics.value.filter((topic) => topic.source === 'built-in'));
  const trendTopics = computed(() => topics.value.filter((topic) => topic.source === 'trend' && (!topic.expiresAt || topic.expiresAt > Date.now())));
  const customTopics = computed(() => topics.value.filter((topic) => topic.source === 'custom' || topic.source === 'ai'));
  const activeJobs = computed(() => jobs.value.filter((job) => !['completed', 'failed'].includes(job.stage)));

  async function hydrate() {
    if (ready.value) return;
    if (hydratePromise.value) return hydratePromise.value;
    hydratePromise.value = (async () => {
      await appStore.hydrate();
      const snapshot = await hydrateStoredMediaRefs(await loadFanficSnapshot());
      books.value = (snapshot.fanficBooks ?? []).map(normalizeFanficBook);
      chapters.value = (snapshot.fanficChapters ?? []).map(normalizeChapter);
      comments.value = (snapshot.fanficComments ?? []).map(normalizeComment).filter((comment) => comment.content && comment.authorName);
      topics.value = (snapshot.fanficTopics ?? []).map(normalizeTopic).filter((topic) => topic.title && topic.hook);
      jobs.value = (snapshot.fanficGenerationJobs ?? []).map((job) => ({ ...job, progress: Number(job.progress) || (job.stage === 'completed' ? 100 : 0) }));
      await ensureBuiltInTopics();
      await removeExpiredTrendTopics();
      ready.value = true;
      persistStartupState();
    })().finally(() => {
      hydratePromise.value = null;
    });
    return hydratePromise.value;
  }

  function persistStartupState() {
    if (!ready.value) return;
    if (startupCacheSaveTimer !== undefined) window.clearTimeout(startupCacheSaveTimer);
    startupCacheSaveTimer = undefined;
    persistFanficStartupCache({
      books: books.value,
      chapters: chapters.value,
      topics: topics.value,
      jobs: jobs.value
    });
  }

  function scheduleStartupStatePersistence() {
    if (!ready.value) return;
    if (startupCacheSaveTimer !== undefined) window.clearTimeout(startupCacheSaveTimer);
    startupCacheSaveTimer = window.setTimeout(persistStartupState, 800);
  }

  const stopStartupStateWatch = watch(
    [ready, books, chapters, topics, jobs],
    scheduleStartupStatePersistence,
    { deep: true }
  );
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') persistStartupState();
  };
  window.addEventListener('pagehide', persistStartupState);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  onScopeDispose(() => {
    stopStartupStateWatch();
    if (startupCacheSaveTimer !== undefined) window.clearTimeout(startupCacheSaveTimer);
    window.removeEventListener('pagehide', persistStartupState);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  async function ensureBuiltInTopics() {
    const currentBuiltInIds = new Set(builtInFanficTopics.map((topic) => topic.id));
    const obsoleteBuiltInIds = topics.value
      .filter((topic) => topic.source === 'built-in' && !currentBuiltInIds.has(topic.id))
      .map((topic) => topic.id);
    if (obsoleteBuiltInIds.length) {
      const obsoleteIdSet = new Set(obsoleteBuiltInIds);
      topics.value = topics.value.filter((topic) => !obsoleteIdSet.has(topic.id));
      await Promise.all(obsoleteBuiltInIds.map((id) => deleteEntity('fanficTopics', id)));
    }
    const byId = new Map(topics.value.map((topic) => [topic.id, topic]));
    const updates: FanficTopic[] = [];
    builtInFanficTopics.forEach((topic) => {
      const existing = byId.get(topic.id);
      if (!existing) {
        topics.value.push(topic);
        updates.push(topic);
        return;
      }
      const nextTopic = { ...topic, createdAt: existing.createdAt || topic.createdAt };
      const index = topics.value.findIndex((entry) => entry.id === topic.id);
      topics.value[index] = nextTopic;
      if (JSON.stringify(existing) !== JSON.stringify(nextTopic)) updates.push(nextTopic);
    });
    await Promise.all(updates.map((topic) => putEntity('fanficTopics', topic)));
  }

  async function removeExpiredTrendTopics() {
    const expiredIds = topics.value.filter((topic) => topic.source === 'trend' && topic.expiresAt && topic.expiresAt <= Date.now()).map((topic) => topic.id);
    if (!expiredIds.length) return;
    topics.value = topics.value.filter((topic) => !expiredIds.includes(topic.id));
    await Promise.all(expiredIds.map((id) => deleteEntity('fanficTopics', id)));
  }

  function bookById(bookId: string) {
    return books.value.find((book) => book.id === bookId) ?? null;
  }

  function topicById(topicId: string) {
    return topics.value.find((topic) => topic.id === topicId) ?? null;
  }

  function chaptersForBook(bookId: string) {
    return chapters.value.filter((chapter) => chapter.bookId === bookId).sort((left, right) => left.order - right.order);
  }

  function chapterById(chapterId: string) {
    return chapters.value.find((chapter) => chapter.id === chapterId) ?? null;
  }

  function commentsForBook(bookId: string) {
    return comments.value.filter((comment) => comment.bookId === bookId && comment.scope === 'book').sort((left, right) => left.createdAt - right.createdAt);
  }

  function commentsForChapter(chapterId: string) {
    return comments.value.filter((comment) => comment.chapterId === chapterId && comment.scope === 'chapter').sort((left, right) => left.createdAt - right.createdAt);
  }

  function commentsForHotspot(chapterId: string, hotspotId: string) {
    return commentsForChapter(chapterId).filter((comment) => comment.hotspotId === hotspotId);
  }

  function latestJobForBook(bookId: string) {
    return jobs.value.filter((job) => job.bookId === bookId).sort((left, right) => right.updatedAt - left.updatedAt)[0] ?? null;
  }

  function isGenerating(bookId: string) {
    return generatingBookIds.value.includes(bookId);
  }

  function hotspotGenerationKey(chapterId: string, hotspotId: string) {
    return `${chapterId}:${hotspotId}`;
  }

  function isGeneratingHotspot(chapterId: string, hotspotId: string) {
    return generatingHotspotKeys.value.includes(hotspotGenerationKey(chapterId, hotspotId));
  }

  async function saveBook(book: FanficBook) {
    const normalized = normalizeFanficBook({ ...book, updatedAt: Date.now() });
    const index = books.value.findIndex((entry) => entry.id === normalized.id);
    if (index >= 0) books.value[index] = normalized;
    else books.value.unshift(normalized);
    await putEntity('fanficBooks', normalized);
    return normalized;
  }

  async function saveJob(job: FanficGenerationJob) {
    const index = jobs.value.findIndex((entry) => entry.id === job.id);
    if (index >= 0) jobs.value[index] = job;
    else jobs.value.push(job);
    await putEntity('fanficGenerationJobs', job);
    return job;
  }

  async function updateJob(job: FanficGenerationJob, patch: Partial<FanficGenerationJob>) {
    return await saveJob({ ...job, ...patch, updatedAt: Date.now() });
  }

  function createJob(bookId: string, chapterOrder?: number): FanficGenerationJob {
    const now = Date.now();
    return {
      id: createId('fanfic_job'),
      bookId,
      chapterOrder,
      stage: 'planning',
      label: '正在准备同人文设定',
      progress: 8,
      error: '',
      createdAt: now,
      updatedAt: now
    };
  }

  async function generateAndPersistChapter(book: FanficBook, order: number, direction: string, job: FanficGenerationJob) {
    const character = appStore.characters.find((entry) => entry.id === book.characterId);
    const user = appStore.users.find((entry) => entry.id === book.userId);
    if (!character || !user) throw new Error('这篇同人文绑定的用户或角色已不存在。');
    const localWorldBooks = selectFanficLocalWorldBooks(character, appStore.worldBooks);
    job = await updateJob(job, { stage: 'writing', label: `正在生成第 ${order} 章正文`, progress: 50, error: '' });
    const chapter = await generateFanficChapter({
      book,
      order,
      previousChapters: chaptersForBook(book.id),
      user,
      character,
      localWorldBooks,
      direction,
      settings: appStore.settings ?? undefined
    });
    job = await updateJob(job, { stage: 'writing', label: `正在保存第 ${order} 章正文`, progress: 70, error: '' });
    const nextContinuity = uniqueStrings([...book.continuity, ...chapter.continuity], 40);
    const nextBook: FanficBook = {
      ...book,
      continuity: nextContinuity,
      status: order >= book.chapterTarget ? 'completed' : 'serializing',
      updatedAt: Date.now()
    };
    await putFanficChapterBundle(nextBook, chapter, []);
    const bookIndex = books.value.findIndex((entry) => entry.id === nextBook.id);
    if (bookIndex >= 0) books.value[bookIndex] = nextBook;
    const chapterIndex = chapters.value.findIndex((entry) => entry.id === chapter.id);
    if (chapterIndex >= 0) chapters.value[chapterIndex] = chapter;
    else chapters.value.push(chapter);
    return { book: nextBook, chapter, job };
  }

  async function createBook(input: CreateFanficBookInput) {
    await hydrate();
    const user = appStore.user;
    const character = appStore.charactersForActiveUser.find((entry) => entry.id === input.characterId);
    const topic = topicById(input.topicId);
    if (!user) throw new Error('没有找到当前用户。');
    if (!character) throw new Error('请选择当前账号绑定的角色。');
    if (!topic) throw new Error('请选择一个题材。');
    if (!appStore.settings) throw new Error('应用设置尚未加载。');
    const { userName, characterName } = requireFanficTrueNames(user, character);
    const localWorldBooks = selectFanficLocalWorldBooks(character, appStore.worldBooks);
    const localWorldBookText = getFanficLocalWorldBookSourceText(localWorldBooks);
    const bookId = createId('fanfic_book');
    let job = createJob(bookId, 1);
    await saveJob(job);
    try {
      job = await updateJob(job, { stage: 'planning', label: '正在参考双方设定创建全新世界', progress: 24 });
      const plan = await generateFanficBookPlan({
        userName,
        characterName,
        user,
        character,
        localWorldBooks,
        topic,
        preferences: input.preferences,
        settings: appStore.settings
      });
      const now = Date.now();
      let book: FanficBook = normalizeFanficBook({
        id: bookId,
        workType: 'user-character-au-fanfic',
        userId: user.id,
        characterId: character.id,
        userName,
        characterName,
        title: plan.title,
        authorName: plan.authorName,
        summary: plan.summary,
        genre: plan.genre,
        tags: plan.tags,
        topicId: topic.id,
        topicTitle: topic.title,
        topicPitch: plan.topicPitch,
        sourceLabel: topic.source === 'trend' ? '联网趋势灵感 · 原创 AU 同人' : topic.source === 'built-in' ? '内置 AU 同人题材' : '自定义 AU 同人题材',
        tone: plan.tone,
        pov: plan.pov,
        endingPreference: plan.endingPreference,
        contentBoundaries: plan.contentBoundaries,
        chapterTarget: input.preferences.chapterTarget,
        coverImage: '',
        coverPrompt: plan.coverPrompt,
        coverPalette: plan.coverPalette,
        status: 'serializing',
        storyBible: plan.storyBible,
        continuity: [],
        profileFingerprint: createFanficProfileFingerprint(user, character, localWorldBookText),
        createdAt: now,
        updatedAt: now
      });
      book.coverImage = createProceduralFanficCover({ title: book.title, authorName: book.authorName, palette: book.coverPalette, motif: book.tags[0] });
      book = await saveBook(book);
      generatingBookIds.value.push(book.id);
      try {
        const generated = await generateAndPersistChapter(book, 1, input.preferences.extraGuidance, job);
        book = generated.book;
        job = generated.job;
        job = await updateJob(job, { stage: 'cover', label: '正在制作同人文封面', progress: 88 });
        try {
          const generatedCover = await generateFanficCover(book, appStore.settings);
          if (generatedCover) book = await saveBook({ ...book, coverImage: generatedCover });
        } catch (error) {
          console.warn('Fanfic cover generation failed, using procedural cover.', error);
        }
        await updateJob(job, { stage: 'completed', label: '第一章与高潮评论点已完成', progress: 100, error: '' });
      } catch (error) {
        book = await saveBook({ ...book, status: 'paused' });
        const failedJob = latestJobForBook(book.id) ?? job;
        await updateJob(failedJob, { stage: 'failed', label: '第一章生成或保存失败，可在书籍页重试', progress: 100, error: error instanceof Error ? error.message : '第一章生成失败。' });
      } finally {
        generatingBookIds.value = generatingBookIds.value.filter((id) => id !== book.id);
      }
      return book;
    } catch (error) {
      await updateJob(job, { stage: 'failed', label: '同人文创建失败', progress: 100, error: error instanceof Error ? error.message : '同人文创建失败。' });
      throw error;
    }
  }

  async function generateNextChapter(bookId: string, direction = '') {
    await hydrate();
    const book = bookById(bookId);
    if (!book) throw new Error('没有找到这篇同人文。');
    if (isGenerating(bookId)) return null;
    const currentChapters = chaptersForBook(bookId);
    const order = (currentChapters.at(-1)?.order ?? 0) + 1;
    if (order > book.chapterTarget) throw new Error('这篇同人文已经完成计划章节。');
    generatingBookIds.value.push(bookId);
    let job = createJob(bookId, order);
    job.stage = 'writing';
    job.label = `正在生成第 ${order} 章与高潮评论点`;
    job.progress = 42;
    await saveJob(job);
    try {
      const generated = await generateAndPersistChapter(book, order, direction, job);
      await updateJob(generated.job, { stage: 'completed', label: `第 ${order} 章与高潮评论点已完成`, progress: 100, error: '' });
      return generated.chapter;
    } catch (error) {
      const failedJob = latestJobForBook(bookId) ?? job;
      await updateJob(failedJob, { stage: 'failed', label: `第 ${order} 章生成或保存失败`, progress: 100, error: error instanceof Error ? error.message : '章节生成失败。' });
      throw error;
    } finally {
      generatingBookIds.value = generatingBookIds.value.filter((id) => id !== bookId);
    }
  }

  async function regenerateChapter(chapterId: string, direction = '') {
    await hydrate();
    const currentChapter = chapterById(chapterId);
    if (!currentChapter) throw new Error('没有找到这个同人文章节。');
    const book = bookById(currentChapter.bookId);
    if (!book) throw new Error('没有找到这篇同人文。');
    if (isGenerating(book.id)) throw new Error('这篇同人文正在生成其他章节，请稍后再试。');
    if (generatingHotspotKeys.value.some((key) => key.startsWith(`${chapterId}:`))) throw new Error('本章评论仍在生成，请完成后再重新生成正文。');
    const character = appStore.characters.find((entry) => entry.id === book.characterId);
    const user = appStore.users.find((entry) => entry.id === book.userId);
    if (!character || !user) throw new Error('这篇同人文绑定的用户或角色已不存在。');
    const previousChapters = chaptersForBook(book.id).filter((chapter) => chapter.order < currentChapter.order);
    const promptBook: FanficBook = { ...book, continuity: collectFanficChapterContinuity(previousChapters) };
    const localWorldBooks = selectFanficLocalWorldBooks(character, appStore.worldBooks);
    const chapterCommentIds = commentsForChapter(chapterId).map((comment) => comment.id);
    generatingBookIds.value.push(book.id);
    mutatingChapterIds.value.push(chapterId);
    let job = createJob(book.id, currentChapter.order);
    job.stage = 'writing';
    job.label = `正在重新生成第 ${currentChapter.order} 章正文`;
    job.progress = 42;
    await saveJob(job);
    try {
      const generatedChapter = await generateFanficChapter({
        book: promptBook,
        order: currentChapter.order,
        previousChapters,
        user,
        character,
        localWorldBooks,
        direction,
        settings: appStore.settings ?? undefined,
        chapterId: currentChapter.id,
        createdAt: currentChapter.createdAt
      });
      job = await updateJob(job, { label: `正在替换第 ${currentChapter.order} 章并清理旧评论`, progress: 78 });
      const nextChapters = chaptersForBook(book.id).map((chapter) => chapter.id === chapterId ? generatedChapter : chapter);
      const nextBook: FanficBook = {
        ...book,
        continuity: collectFanficChapterContinuity(nextChapters),
        status: nextChapters.length >= book.chapterTarget ? 'completed' : 'serializing',
        lastReadParagraphId: book.lastReadChapterId === chapterId ? generatedChapter.paragraphs[0]?.id : book.lastReadParagraphId,
        updatedAt: Date.now()
      };
      await applyFanficChapterMutation({
        book: nextBook,
        chapters: [generatedChapter],
        deleteCommentIds: chapterCommentIds
      });
      const bookIndex = books.value.findIndex((entry) => entry.id === book.id);
      if (bookIndex >= 0) books.value[bookIndex] = nextBook;
      const chapterIndex = chapters.value.findIndex((entry) => entry.id === chapterId);
      if (chapterIndex >= 0) chapters.value[chapterIndex] = generatedChapter;
      comments.value = comments.value.filter((comment) => comment.chapterId !== chapterId);
      try {
        await updateJob(job, { stage: 'completed', label: `第 ${currentChapter.order} 章已重新生成`, progress: 100, error: '' });
      } catch (error) {
        console.warn('Fanfic chapter was replaced, but the generation job status could not be saved.', error);
      }
      return generatedChapter;
    } catch (error) {
      const failedJob = latestJobForBook(book.id) ?? job;
      await updateJob(failedJob, { stage: 'failed', label: `第 ${currentChapter.order} 章重新生成失败，原章已保留`, progress: 100, error: error instanceof Error ? error.message : '章节重新生成失败。' });
      throw error;
    } finally {
      generatingBookIds.value = generatingBookIds.value.filter((id) => id !== book.id);
      mutatingChapterIds.value = mutatingChapterIds.value.filter((id) => id !== chapterId);
    }
  }

  async function deleteChapter(chapterId: string) {
    await hydrate();
    const currentChapter = chapterById(chapterId);
    if (!currentChapter) throw new Error('没有找到这个同人文章节。');
    const book = bookById(currentChapter.bookId);
    if (!book) throw new Error('没有找到这篇同人文。');
    if (isGenerating(book.id)) throw new Error('这篇同人文正在生成章节，请稍后再试。');
    if (generatingHotspotKeys.value.some((key) => key.startsWith(`${chapterId}:`))) throw new Error('本章评论仍在生成，请完成后再删除章节。');
    const currentChapters = chaptersForBook(book.id);
    const deletedIndex = currentChapters.findIndex((chapter) => chapter.id === chapterId);
    const remainingChapters = resequenceFanficChapters(currentChapters.filter((chapter) => chapter.id !== chapterId));
    const fallbackChapter = remainingChapters[Math.min(deletedIndex, remainingChapters.length - 1)] ?? null;
    const chapterCommentIds = commentsForChapter(chapterId).map((comment) => comment.id);
    const lastReadChapterDeleted = book.lastReadChapterId === chapterId;
    const nextBook: FanficBook = {
      ...book,
      continuity: collectFanficChapterContinuity(remainingChapters),
      status: remainingChapters.length >= book.chapterTarget ? 'completed' : 'serializing',
      lastReadChapterId: lastReadChapterDeleted ? fallbackChapter?.id : book.lastReadChapterId,
      lastReadParagraphId: lastReadChapterDeleted ? fallbackChapter?.paragraphs[0]?.id : book.lastReadParagraphId,
      updatedAt: Date.now()
    };
    mutatingChapterIds.value.push(chapterId);
    try {
      await applyFanficChapterMutation({
        book: nextBook,
        chapters: remainingChapters,
        deleteChapterIds: [chapterId],
        deleteCommentIds: chapterCommentIds
      });
      const bookIndex = books.value.findIndex((entry) => entry.id === book.id);
      if (bookIndex >= 0) books.value[bookIndex] = nextBook;
      chapters.value = [...chapters.value.filter((chapter) => chapter.bookId !== book.id), ...remainingChapters];
      comments.value = comments.value.filter((comment) => comment.chapterId !== chapterId);
      return fallbackChapter;
    } finally {
      mutatingChapterIds.value = mutatingChapterIds.value.filter((id) => id !== chapterId);
    }
  }

  async function regenerateCover(bookId: string) {
    await hydrate();
    const book = bookById(bookId);
    if (!book) throw new Error('没有找到这篇同人文。');
    const proceduralCover = createProceduralFanficCover({ title: book.title, authorName: book.authorName, palette: [...book.coverPalette].reverse(), motif: book.tags[0] });
    let nextBook = await saveBook({ ...book, coverImage: proceduralCover });
    try {
      const generatedCover = await generateFanficCover(nextBook, appStore.settings ?? undefined);
      if (generatedCover) nextBook = await saveBook({ ...nextBook, coverImage: generatedCover });
    } catch (error) {
      console.warn('Fanfic cover regeneration failed, using procedural cover.', error);
    }
    return nextBook;
  }

  async function refreshTrendTopics() {
    await hydrate();
    if (refreshingTrends.value) return trendTopics.value;
    refreshingTrends.value = true;
    trendStatus.value = '正在读取公开题材趋势';
    try {
      const trend = await fetchFanficTrendKeywords();
      trendStatus.value = '正在把趋势重组为原创题材';
      const generatedTopics = await generateFanficTrendTopics({ keywords: trend.keywords, settings: appStore.settings ?? undefined });
      const oldTrendIds = topics.value.filter((topic) => topic.source === 'trend').map((topic) => topic.id);
      topics.value = [...topics.value.filter((topic) => topic.source !== 'trend'), ...generatedTopics];
      await Promise.all([
        ...oldTrendIds.map((id) => deleteEntity('fanficTopics', id)),
        ...generatedTopics.map((topic) => putEntity('fanficTopics', topic))
      ]);
      trendStatus.value = `${trend.sourceLabel} · 已更新 ${generatedTopics.length} 个原创题材`;
      return generatedTopics;
    } finally {
      refreshingTrends.value = false;
    }
  }

  async function createCustomTopic(input: Pick<FanficTopic, 'title' | 'hook' | 'setting' | 'conflict' | 'relationship' | 'tags'>) {
    await hydrate();
    if (!input.title.trim() || !input.hook.trim()) throw new Error('自定义题材至少需要名称和故事钩子。');
    const topic: FanficTopic = {
      id: createId('fanfic_topic_custom'),
      source: 'custom',
      title: input.title.trim(),
      hook: input.hook.trim(),
      setting: input.setting.trim(),
      conflict: input.conflict.trim(),
      relationship: input.relationship.trim(),
      tags: uniqueStrings(input.tags, 8),
      trendKeywords: [],
      createdAt: Date.now()
    };
    topics.value.push(topic);
    await putEntity('fanficTopics', topic);
    return topic;
  }

  async function generateHotspotComments(chapterId: string, hotspotId: string) {
    await hydrate();
    const existingComments = commentsForHotspot(chapterId, hotspotId);
    if (existingComments.some((comment) => comment.origin === 'generated')) return existingComments;
    const key = hotspotGenerationKey(chapterId, hotspotId);
    const pending = hotspotGenerationPromises.get(key);
    if (pending) return await pending;

    const promise = (async () => {
      generatingHotspotKeys.value.push(key);
      try {
        const chapter = chapterById(chapterId);
        if (!chapter) throw new Error('没有找到这个同人文章节。');
        if (mutatingChapterIds.value.includes(chapterId)) throw new Error('本章正文正在更新，请完成后再生成评论。');
        const hotspot = chapter.hotspots.find((entry) => entry.id === hotspotId);
        if (!hotspot) throw new Error('没有找到这个高潮评论点。');
        const book = bookById(chapter.bookId);
        if (!book) throw new Error('没有找到这篇同人文。');
        const character = appStore.characters.find((entry) => entry.id === book.characterId);
        if (!character) throw new Error('这篇同人文绑定的角色已不存在。');
        const commentCharacters = [
          character,
          ...appStore.characters.filter((entry) => entry.boundUserId === book.userId && entry.id !== character.id)
        ];
        const generatedComments = await generateFanficHotspotComments({
          book,
          chapter,
          hotspotId,
          characters: commentCharacters,
          settings: appStore.settings ?? undefined
        });
        const alreadyGenerated = commentsForHotspot(chapterId, hotspotId).filter((comment) => comment.origin === 'generated');
        if (alreadyGenerated.length) return alreadyGenerated;
        const nextCommentCount = commentsForHotspot(chapterId, hotspotId).length + generatedComments.length;
        const nextChapter: FanficChapter = {
          ...chapter,
          hotspots: chapter.hotspots.map((entry) => entry.id === hotspotId ? { ...entry, commentCount: nextCommentCount } : entry),
          updatedAt: Date.now()
        };
        await putFanficHotspotComments(nextChapter, generatedComments);
        const chapterIndex = chapters.value.findIndex((entry) => entry.id === chapterId);
        if (chapterIndex >= 0) chapters.value[chapterIndex] = nextChapter;
        comments.value.push(...generatedComments);
        return generatedComments;
      } finally {
        generatingHotspotKeys.value = generatingHotspotKeys.value.filter((entry) => entry !== key);
        hotspotGenerationPromises.delete(key);
      }
    })();
    hotspotGenerationPromises.set(key, promise);
    return await promise;
  }

  async function addUserComment(input: { bookId: string; content: string; chapterId?: string; hotspotId?: string; parentId?: string }) {
    await hydrate();
    const user = appStore.user;
    const content = input.content.trim();
    if (!user?.name.trim()) throw new Error('请先填写用户真名。');
    if (!content) return null;
    const comment: FanficComment = {
      id: createId('fanfic_comment'),
      bookId: input.bookId,
      chapterId: input.chapterId,
      hotspotId: input.hotspotId,
      scope: input.chapterId ? 'chapter' : 'book',
      authorType: 'user',
      origin: 'manual',
      authorId: user.id,
      authorName: user.name.trim(),
      avatarSeed: user.id,
      content,
      parentId: input.parentId,
      likes: 0,
      createdAt: Date.now()
    };
    comments.value.push(comment);
    await putEntity('fanficComments', comment);
    return comment;
  }

  async function likeComment(commentId: string) {
    const index = comments.value.findIndex((comment) => comment.id === commentId);
    if (index < 0) return;
    comments.value[index] = { ...comments.value[index], likes: comments.value[index].likes + 1 };
    await putEntity('fanficComments', comments.value[index]);
  }

  async function updateReadingProgress(bookId: string, chapterId: string, paragraphId = '') {
    const book = bookById(bookId);
    if (!book) return;
    await saveBook({ ...book, lastReadChapterId: chapterId, lastReadParagraphId: paragraphId });
  }

  async function dismissJob(jobId: string) {
    jobs.value = jobs.value.filter((job) => job.id !== jobId);
    await deleteEntity('fanficGenerationJobs', jobId);
  }

  async function deleteBook(bookId: string) {
    const chapterIds = chapters.value.filter((chapter) => chapter.bookId === bookId).map((chapter) => chapter.id);
    const commentIds = comments.value.filter((comment) => comment.bookId === bookId).map((comment) => comment.id);
    const jobIds = jobs.value.filter((job) => job.bookId === bookId).map((job) => job.id);
    books.value = books.value.filter((book) => book.id !== bookId);
    chapters.value = chapters.value.filter((chapter) => chapter.bookId !== bookId);
    comments.value = comments.value.filter((comment) => comment.bookId !== bookId);
    jobs.value = jobs.value.filter((job) => job.bookId !== bookId);
    await Promise.all([
      deleteEntity('fanficBooks', bookId),
      ...chapterIds.map((id) => deleteEntity('fanficChapters', id)),
      ...commentIds.map((id) => deleteEntity('fanficComments', id)),
      ...jobIds.map((id) => deleteEntity('fanficGenerationJobs', id))
    ]);
    await pruneUnusedStoredMediaCache();
  }

  async function deleteCharacterFanficData(characterId: string) {
    const normalizedCharacterId = characterId.trim();
    if (!normalizedCharacterId) return 0;
    await hydrate();

    const relatedBooks = books.value.filter((book) => book.characterId === normalizedCharacterId);
    const relatedBookIds = new Set(relatedBooks.map((book) => book.id));
    if (!relatedBookIds.size) return 0;
    const relatedChapters = chapters.value.filter((chapter) => relatedBookIds.has(chapter.bookId));
    const relatedComments = comments.value.filter((comment) => relatedBookIds.has(comment.bookId));
    const relatedJobs = jobs.value.filter((job) => relatedBookIds.has(job.bookId));

    books.value = books.value.filter((book) => !relatedBookIds.has(book.id));
    chapters.value = chapters.value.filter((chapter) => !relatedBookIds.has(chapter.bookId));
    comments.value = comments.value.filter((comment) => !relatedBookIds.has(comment.bookId));
    jobs.value = jobs.value.filter((job) => !relatedBookIds.has(job.bookId));
    generatingBookIds.value = generatingBookIds.value.filter((bookId) => !relatedBookIds.has(bookId));
    await Promise.all([
      ...relatedBooks.map((book) => deleteEntity('fanficBooks', book.id)),
      ...relatedChapters.map((chapter) => deleteEntity('fanficChapters', chapter.id)),
      ...relatedComments.map((comment) => deleteEntity('fanficComments', comment.id)),
      ...relatedJobs.map((job) => deleteEntity('fanficGenerationJobs', job.id))
    ]);
    await pruneUnusedStoredMediaCache();
    return relatedBooks.length + relatedChapters.length + relatedComments.length + relatedJobs.length;
  }

  async function clearAllFanficData() {
    await hydrate();
    const entries = {
      books: [...books.value],
      chapters: [...chapters.value],
      comments: [...comments.value],
      topics: topics.value.filter((topic) => topic.source !== 'built-in'),
      jobs: [...jobs.value]
    };
    books.value = [];
    chapters.value = [];
    comments.value = [];
    topics.value = topics.value.filter((topic) => topic.source === 'built-in');
    jobs.value = [];
    generatingBookIds.value = [];
    generatingHotspotKeys.value = [];
    await Promise.all([
      ...entries.books.map((entry) => deleteEntity('fanficBooks', entry.id)),
      ...entries.chapters.map((entry) => deleteEntity('fanficChapters', entry.id)),
      ...entries.comments.map((entry) => deleteEntity('fanficComments', entry.id)),
      ...entries.topics.map((entry) => deleteEntity('fanficTopics', entry.id)),
      ...entries.jobs.map((entry) => deleteEntity('fanficGenerationJobs', entry.id))
    ]);
    await pruneUnusedStoredMediaCache();
    persistStartupState();
    return entries.books.length + entries.chapters.length + entries.comments.length + entries.topics.length + entries.jobs.length;
  }

  return {
    ready,
    books,
    chapters,
    comments,
    topics,
    jobs,
    sortedBooks,
    builtInTopics,
    trendTopics,
    customTopics,
    activeJobs,
    refreshingTrends,
    trendStatus,
    hydrate,
    bookById,
    topicById,
    chaptersForBook,
    chapterById,
    commentsForBook,
    commentsForChapter,
    commentsForHotspot,
    latestJobForBook,
    isGenerating,
    isGeneratingHotspot,
    createBook,
    generateNextChapter,
    regenerateChapter,
    deleteChapter,
    generateHotspotComments,
    regenerateCover,
    refreshTrendTopics,
    createCustomTopic,
    addUserComment,
    likeComment,
    updateReadingProgress,
    dismissJob,
    deleteBook,
    deleteCharacterFanficData,
    clearAllFanficData
  };
});