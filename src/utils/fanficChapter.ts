export interface NormalizedGeneratedFanficHotspot {
  paragraphIndex: number;
  label: string;
  excerpt: string;
  reason: string;
}

export interface NormalizedGeneratedFanficChapterPayload {
  chapter: {
    title: string;
    paragraphs: string[];
    summary: string;
    continuity: string[];
    hotspots: NormalizedGeneratedFanficHotspot[];
    nextDirections: string[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function uniqueStrings(values: string[], limit: number) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

function cleanStrings(values: string[], limit: number) {
  return values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

function splitLongTextBySentence(value: string) {
  if (value.length <= 320) return [value];
  const sentences = value.match(/[^。！？!?]+[。！？!?]?/g)?.map((entry) => entry.trim()).filter(Boolean) ?? [];
  if (sentences.length < 2) return [value];
  const paragraphs: string[] = [];
  let current = '';
  sentences.forEach((sentence) => {
    if (current && current.length + sentence.length > 220) {
      paragraphs.push(current);
      current = sentence;
      return;
    }
    current += sentence;
  });
  if (current) paragraphs.push(current);
  return paragraphs;
}

function splitParagraphText(value: string) {
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const blocks = text.split(/\n\s*\n+/).map((entry) => entry.trim()).filter(Boolean);
  if (blocks.length > 1) return blocks.flatMap(splitLongTextBySentence);
  const lines = text.split(/\n+/).map((entry) => entry.trim()).filter(Boolean);
  return lines.length > 1 ? lines.flatMap(splitLongTextBySentence) : splitLongTextBySentence(text);
}

function normalizeTextList(value: unknown, limit: number, objectKeys: string[]) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.flatMap((entry) => {
      if (typeof entry === 'string') return [entry];
      if (!isRecord(entry)) return [];
      const text = asText(firstField(entry, objectKeys));
      return text ? [text] : [];
    }), limit);
  }
  const text = asText(value);
  return text ? uniqueStrings(text.split(/\n+|[；;]+/), limit) : [];
}

function normalizeParagraphs(value: unknown) {
  if (Array.isArray(value)) {
    return cleanStrings(value.flatMap((entry) => {
      if (typeof entry === 'string') return splitParagraphText(entry);
      if (!isRecord(entry)) return [];
      return splitParagraphText(asText(firstField(entry, ['text', 'content', 'body', 'paragraph', '正文', '内容'])));
    }), 60);
  }
  return cleanStrings(splitParagraphText(asText(value)), 60);
}

function hasChapterFields(value: Record<string, unknown>) {
  return ['title', 'chapterTitle', 'paragraphs', 'content', 'body', 'text', '章名', '正文'].some((key) => value[key] !== undefined);
}

function resolveChapterSource(value: unknown) {
  const root = isRecord(value) ? value : {};
  if (isRecord(root.chapter)) return root.chapter;
  for (const key of ['data', 'result', 'payload']) {
    const candidate = root[key];
    if (!isRecord(candidate)) continue;
    if (isRecord(candidate.chapter)) return candidate.chapter;
    if (hasChapterFields(candidate)) return candidate;
  }
  return root;
}

function normalizeHotspots(value: unknown, paragraphs: string[]) {
  if (!Array.isArray(value)) return [];
  const entries = value.filter(isRecord);
  const numericIndexes = entries.map((entry) => Number(firstField(entry, ['paragraphIndex', 'paragraphNumber', 'index', 'paragraph', '段落序号', '段落索引']))).filter(Number.isFinite);
  const usesZeroBasedIndexes = numericIndexes.includes(0);
  return entries.map((entry) => {
    const excerpt = asText(firstField(entry, ['excerpt', 'quote', 'text', '摘录', '原文']));
    const rawIndex = Number(firstField(entry, ['paragraphIndex', 'paragraphNumber', 'index', 'paragraph', '段落序号', '段落索引']));
    const matchedIndex = excerpt ? paragraphs.findIndex((paragraph) => paragraph.includes(excerpt) || excerpt.includes(paragraph)) : -1;
    const paragraphIndex = Number.isFinite(rawIndex)
      ? Math.round(rawIndex) + (usesZeroBasedIndexes ? 1 : 0)
      : matchedIndex + 1;
    return {
      paragraphIndex,
      label: asText(firstField(entry, ['label', 'title', 'name', '标签', '名称'])),
      excerpt,
      reason: asText(firstField(entry, ['reason', 'impact', 'change', 'meaning', '原因', '意义', '变化']))
    };
  }).filter((entry) => entry.paragraphIndex >= 1
    && entry.paragraphIndex <= paragraphs.length
    && entry.label
    && entry.excerpt
    && entry.reason).slice(0, 3);
}

export function normalizeGeneratedFanficChapterPayload(value: unknown): NormalizedGeneratedFanficChapterPayload {
  const source = resolveChapterSource(value);
  const paragraphs = normalizeParagraphs(firstField(source, ['paragraphs', 'content', 'body', 'text', 'chapterContent', '正文', '内容']));
  return {
    chapter: {
      title: asText(firstField(source, ['title', 'chapterTitle', 'name', '章名', '标题'])),
      paragraphs,
      summary: asText(firstField(source, ['summary', 'chapterSummary', 'synopsis', '摘要', '本章摘要'])),
      continuity: normalizeTextList(firstField(source, ['continuity', 'facts', 'newFacts', 'factLedger', '连续性', '新增事实', '事实账本']), 16, ['text', 'content', 'fact', '内容', '事实']),
      hotspots: normalizeHotspots(firstField(source, ['hotspots', 'highlights', 'climaxes', 'keyMoments', '高潮', '高潮锚点']), paragraphs),
      nextDirections: normalizeTextList(firstField(source, ['nextDirections', 'directions', 'choices', 'nextChapterDirections', '下一章方向', '后续方向']), 3, ['text', 'content', 'direction', 'title', '方向', '内容'])
    }
  };
}

export function describeGeneratedFanficChapterIssues(value: unknown) {
  const chapter = normalizeGeneratedFanficChapterPayload(value).chapter;
  const issues: string[] = [];
  if (!chapter.paragraphs.length) issues.push('正文');
  return issues;
}

export function generatedFanficChapterPayloadIsComplete(value: unknown) {
  return describeGeneratedFanficChapterIssues(value).length === 0;
}