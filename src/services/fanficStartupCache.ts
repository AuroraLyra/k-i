import type { FanficBook, FanficChapter, FanficGenerationJob, FanficParagraph, FanficTopic } from '@/types/domain';

export interface FanficStartupCacheState {
  books: FanficBook[];
  chapters: FanficChapter[];
  topics: FanficTopic[];
  jobs: FanficGenerationJob[];
}

interface FanficStartupCacheSnapshot extends FanficStartupCacheState {
  version: 1;
  savedAt: number;
}

interface FanficStartupCacheLevel {
  bookLimit: number;
  chapterTextLimit: number;
}

const fanficStartupCacheStorageKey = 'link:fanfic-startup-cache:v1';
const fanficStartupCacheVersion = 1;
const fanficStartupSerializedLimit = 1_500_000;
const fanficStartupMediaDataUrlLimit = 48 * 1024;
const fanficStartupCacheLevels: FanficStartupCacheLevel[] = [
  { bookLimit: 80, chapterTextLimit: 80_000 },
  { bookLimit: 40, chapterTextLimit: 24_000 },
  { bookLimit: 20, chapterTextLimit: 0 },
  { bookLimit: 8, chapterTextLimit: 0 }
];

function trimText(value: string, limit: number) {
  const normalizedValue = String(value ?? '').trim();
  return normalizedValue.length > limit ? normalizedValue.slice(0, limit) : normalizedValue;
}

function trimStrings(values: string[], entryLimit: number, textLimit: number) {
  return values.slice(-entryLimit).map((value) => trimText(value, textLimit)).filter(Boolean);
}

function sanitizeMediaUrl(value: string) {
  const normalizedValue = String(value ?? '').trim();
  if (/^blob:/i.test(normalizedValue)) return '';
  if (/^data:/i.test(normalizedValue) && normalizedValue.length > fanficStartupMediaDataUrlLimit) return '';
  return normalizedValue;
}

function createStartupBook(book: FanficBook): FanficBook {
  return {
    ...book,
    title: trimText(book.title, 300),
    authorName: trimText(book.authorName, 200),
    summary: trimText(book.summary, 4_000),
    topicPitch: trimText(book.topicPitch, 2_000),
    coverImage: sanitizeMediaUrl(book.coverImage),
    coverPrompt: trimText(book.coverPrompt, 1_000),
    tags: trimStrings(book.tags, 12, 100),
    contentBoundaries: trimStrings(book.contentBoundaries, 20, 300),
    continuity: trimStrings(book.continuity, 24, 600),
    storyBible: {
      ...book.storyBible,
      premise: trimText(book.storyBible.premise, 2_000),
      coreHook: trimText(book.storyBible.coreHook, 1_000),
      storyEngine: trimText(book.storyBible.storyEngine, 1_500),
      stakes: trimText(book.storyBible.stakes, 1_000),
      locations: trimStrings(book.storyBible.locations, 20, 300),
      worldRules: trimStrings(book.storyBible.worldRules, 20, 500),
      supportingCharacters: book.storyBible.supportingCharacters.slice(0, 20).map((character) => ({
        name: trimText(character.name, 100),
        role: trimText(character.role, 300),
        goal: trimText(character.goal, 500),
        secret: trimText(character.secret, 500)
      })),
      relationshipArc: trimText(book.storyBible.relationshipArc, 1_500),
      coreMystery: trimText(book.storyBible.coreMystery, 1_500),
      motifs: trimStrings(book.storyBible.motifs, 20, 200)
    }
  };
}

function createStartupParagraphs(chapter: FanficChapter, textLimit: number): FanficParagraph[] {
  if (textLimit <= 0) return [];
  const sourceParagraphs = chapter.paragraphs.length
    ? chapter.paragraphs
    : chapter.content.split(/\n{2,}/).map((text, index) => ({ id: `${chapter.id}_p${index + 1}`, text }));
  const paragraphs: FanficParagraph[] = [];
  let remaining = textLimit;
  for (const paragraph of sourceParagraphs) {
    if (remaining <= 0) break;
    const text = trimText(paragraph.text, remaining);
    if (!text) continue;
    paragraphs.push({ id: paragraph.id, text });
    remaining -= text.length;
  }
  return paragraphs;
}

function createStartupChapter(chapter: FanficChapter, keepContent: boolean, textLimit: number): FanficChapter {
  const paragraphs = keepContent ? createStartupParagraphs(chapter, textLimit) : [];
  return {
    ...chapter,
    title: trimText(chapter.title, 300),
    content: paragraphs.map((paragraph) => paragraph.text).join('\n\n'),
    paragraphs,
    summary: trimText(chapter.summary, 2_000),
    continuity: trimStrings(chapter.continuity, 20, 500),
    hotspots: keepContent ? chapter.hotspots.slice(0, 24).map((hotspot) => ({
      ...hotspot,
      label: trimText(hotspot.label, 200),
      excerpt: trimText(hotspot.excerpt, 800),
      reason: trimText(hotspot.reason, 800)
    })) : [],
    nextDirections: trimStrings(chapter.nextDirections, 3, 600)
  };
}

function createFanficStartupSnapshot(state: FanficStartupCacheState, level: FanficStartupCacheLevel): FanficStartupCacheSnapshot {
  const books = [...state.books]
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, level.bookLimit)
    .map(createStartupBook);
  const bookIds = new Set(books.map((book) => book.id));
  const chaptersByBook = new Map<string, FanficChapter[]>();
  state.chapters.forEach((chapter) => {
    if (!bookIds.has(chapter.bookId)) return;
    const entries = chaptersByBook.get(chapter.bookId) ?? [];
    entries.push(chapter);
    chaptersByBook.set(chapter.bookId, entries);
  });
  const readableChapterIds = new Set(books.map((book) => {
    const bookChapters = (chaptersByBook.get(book.id) ?? []).sort((left, right) => left.order - right.order);
    return bookChapters.find((chapter) => chapter.id === book.lastReadChapterId)?.id ?? bookChapters[0]?.id ?? '';
  }).filter(Boolean));
  const chapters = [...chaptersByBook.values()]
    .flat()
    .sort((left, right) => left.bookId.localeCompare(right.bookId) || left.order - right.order)
    .map((chapter) => createStartupChapter(chapter, readableChapterIds.has(chapter.id), level.chapterTextLimit));
  const topics = state.topics
    .filter((topic) => topic.source !== 'built-in')
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 40)
    .map((topic) => ({
      ...topic,
      title: trimText(topic.title, 200),
      hook: trimText(topic.hook, 1_000),
      setting: trimText(topic.setting, 1_000),
      conflict: trimText(topic.conflict, 1_000),
      relationship: trimText(topic.relationship, 1_000),
      tags: trimStrings(topic.tags, 8, 100),
      trendKeywords: trimStrings(topic.trendKeywords, 6, 100)
    }));
  const jobs = [...state.jobs].sort((left, right) => right.updatedAt - left.updatedAt).slice(0, 40);
  return { version: fanficStartupCacheVersion, savedAt: Date.now(), books, chapters, topics, jobs };
}

export function readFanficStartupCache(): FanficStartupCacheState | null {
  try {
    const snapshot = JSON.parse(window.localStorage.getItem(fanficStartupCacheStorageKey) ?? '') as Partial<FanficStartupCacheSnapshot> | null;
    if (snapshot?.version !== fanficStartupCacheVersion
      || !Array.isArray(snapshot.books)
      || !Array.isArray(snapshot.chapters)
      || !Array.isArray(snapshot.topics)
      || !Array.isArray(snapshot.jobs)) return null;
    return {
      books: snapshot.books,
      chapters: snapshot.chapters,
      topics: snapshot.topics,
      jobs: snapshot.jobs
    };
  } catch {
    return null;
  }
}

export function persistFanficStartupCache(state: FanficStartupCacheState) {
  for (const level of fanficStartupCacheLevels) {
    try {
      const serializedSnapshot = JSON.stringify(createFanficStartupSnapshot(state, level));
      if (serializedSnapshot.length > fanficStartupSerializedLimit) continue;
      window.localStorage.setItem(fanficStartupCacheStorageKey, serializedSnapshot);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

export function clearFanficStartupCache() {
  try {
    window.localStorage.removeItem(fanficStartupCacheStorageKey);
  } catch {
    return;
  }
}