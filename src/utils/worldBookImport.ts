import type { WorldBookEntry, WorldBookEntryActivation, WorldBookInsertionPosition, WorldBookLoreEntry, WorldBookScope } from '@/types/domain';
import { readTextDocumentFile } from './documentText';
import { createId } from './id';
import { createWorldBookLoreEntry, normalizeWorldBookEntry } from './worldBook';

type UnknownRecord = Record<string, unknown>;

export type WorldBookImportSourceType = 'json-file' | 'text-file' | 'doc-file';

export interface WorldBookImportOptions {
  fileName?: string;
  defaultScope?: WorldBookScope;
  sourceType?: WorldBookImportSourceType;
}

export interface WorldBookImportResult {
  books: WorldBookEntry[];
  warnings: string[];
}

const entryCollectionKeys = ['entries', 'world_info', 'worldInfo', 'loreEntries', 'lorebookEntries'];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fileTitle(fileName = '') {
  return fileName.replace(/\.[^.]+$/, '').trim() || '导入世界书';
}

function textValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => textValue(item)).filter(Boolean).join('\n');
  return String(value ?? '').trim();
}

function normalizeTitle(value: string, fallback: string) {
  return value.trim() || fallback;
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  return [...new Set(String(value ?? '').split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean))];
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLocaleLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalizedValue)) return true;
    if (['false', '0', 'no', 'off'].includes(normalizedValue)) return false;
  }
  return fallback;
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function normalizeScope(value: unknown, fallback: WorldBookScope): WorldBookScope {
  const scope = textValue(value).toLocaleLowerCase();
  if (scope === 'global-online' || scope === 'online' || scope === 'global_online') return 'global-online';
  if (scope === 'global-offline' || scope === 'offline' || scope === 'global_offline' || scope === 'global') return 'global-offline';
  if (scope === 'local' || scope === 'character' || scope === '角色') return 'local';
  return fallback;
}

function normalizeActivation(record: UnknownRecord): WorldBookEntryActivation {
  const activation = textValue(record.activation ?? record.mode).toLocaleLowerCase();
  if (activation === 'keyword' || activation === 'constant' || activation === 'priority') return activation;
  if (normalizeBoolean(record.constant, false)) return 'constant';
  if (normalizeBoolean(record.priority, false)) return 'priority';
  return 'keyword';
}

function normalizePosition(value: unknown): WorldBookInsertionPosition {
  const position = textValue(value).toLocaleLowerCase();
  if (position.includes('after') || position === '1') return 'after-chat';
  return 'before-chat';
}

function entryCollectionFromRecord(record: UnknownRecord) {
  for (const key of entryCollectionKeys) {
    const value = record[key];
    const entries = collectEntryRecords(value);
    if (entries.length) return entries;
  }
  return [];
}

function collectEntryRecords(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (isRecord(value)) return Object.values(value).filter(isRecord);
  return [];
}

function looksLikeLoreEntry(record: UnknownRecord) {
  return ['content', 'text', 'value', 'key', 'keys', 'keyword', 'keywords', 'comment'].some((key) => key in record);
}

function createImportedLoreEntry(record: UnknownRecord, index: number): WorldBookLoreEntry {
  const keys = normalizeStringList(record.keys ?? record.key ?? record.keyword ?? record.keywords);
  const secondaryKeys = normalizeStringList(record.secondaryKeys ?? record.secondary_keys ?? record.keysecondary ?? record.secondary);
  const content = textValue(record.content ?? record.text ?? record.value ?? record.prompt ?? record.message);
  const title = normalizeTitle(
    textValue(record.title ?? record.comment ?? record.name ?? record.memo ?? record.note),
    keys.join('、') || `条目 ${index + 1}`
  );
  const disabled = normalizeBoolean(record.disable ?? record.disabled, false);
  const enabled = normalizeBoolean(record.enabled, !disabled) && !disabled;

  return createWorldBookLoreEntry({
    id: createId('wbe'),
    title,
    content,
    enabled,
    activation: normalizeActivation(record),
    keys,
    secondaryKeys,
    position: normalizePosition(record.position ?? record.insertionPosition),
    order: normalizeNumber(record.order ?? record.insertion_order ?? record.priority, 100 + index * 10, 0, 9999),
    depth: normalizeNumber(record.depth ?? record.scanDepth ?? record.scan_depth, 4, 0, 12),
    probability: normalizeNumber(record.probability ?? record.probabilityWeight ?? record.probability_percent, 100, 0, 100),
    caseSensitive: normalizeBoolean(record.caseSensitive ?? record.case_sensitive, false)
  });
}

function hasEntryContent(entry: WorldBookLoreEntry) {
  return Boolean(entry.title || entry.content || entry.keys.length || entry.secondaryKeys.length);
}

function plainTextEntry(title: string, content: string) {
  return createWorldBookLoreEntry({
    id: createId('wbe'),
    title,
    content,
    activation: 'constant',
    order: 100
  });
}

function createImportedBook(title: string, records: UnknownRecord[], metadata: UnknownRecord, defaultScope: WorldBookScope): WorldBookEntry | null {
  const entries = records.map((record, index) => createImportedLoreEntry(record, index)).filter(hasEntryContent);
  const directContent = textValue(metadata.content ?? metadata.text ?? metadata.value ?? metadata.prompt ?? metadata.message);
  if (!entries.length && directContent) entries.push(plainTextEntry('默认条目', directContent));
  if (!entries.length) return null;

  const content = entries.map((entry) => entry.content).filter(Boolean).join('\n\n') || directContent;
  const disabled = normalizeBoolean(metadata.disable ?? metadata.disabled, false);
  const enabled = normalizeBoolean(metadata.enabled, !disabled) && !disabled;

  return normalizeWorldBookEntry({
    id: createId('wb'),
    title: normalizeTitle(textValue(metadata.title ?? metadata.name), title),
    content,
    entries,
    scope: normalizeScope(metadata.scope ?? metadata.type, defaultScope),
    enabled,
    coverImage: textValue(metadata.coverImage ?? metadata.cover ?? metadata.avatar)
  });
}

function parseJsonWorldBooks(parsed: unknown, title: string, defaultScope: WorldBookScope): WorldBookEntry[] {
  if (Array.isArray(parsed)) {
    const records = parsed.filter(isRecord);
    if (!records.length) return [];
    const bookRecords = records.filter((record) => entryCollectionFromRecord(record).length);
    if (bookRecords.length) {
      return bookRecords
        .map((record, index) => createImportedBook(`${title} ${index + 1}`, entryCollectionFromRecord(record), record, defaultScope))
        .filter((book): book is WorldBookEntry => Boolean(book));
    }
    return [createImportedBook(title, records, { title }, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
  }

  if (!isRecord(parsed)) return [];

  const directEntries = entryCollectionFromRecord(parsed);
  if (directEntries.length) return [createImportedBook(title, directEntries, parsed, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));

  const entryMapRecords = Object.values(parsed).filter(isRecord);
  if (entryMapRecords.length && entryMapRecords.every((record) => looksLikeLoreEntry(record))) {
    return [createImportedBook(title, entryMapRecords, { title }, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
  }

  const nestedBooks = Object.entries(parsed).flatMap(([nestedTitle, value]) => {
    if (Array.isArray(value)) return [createImportedBook(nestedTitle, value.filter(isRecord), { title: nestedTitle }, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
    if (!isRecord(value)) return [];
    const nestedEntries = entryCollectionFromRecord(value);
    if (nestedEntries.length) return [createImportedBook(nestedTitle, nestedEntries, { ...value, title: textValue(value.title ?? value.name) || nestedTitle }, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
    if (looksLikeLoreEntry(value)) return [createImportedBook(nestedTitle, [value], { title: nestedTitle }, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
    return [];
  });
  if (nestedBooks.length) return nestedBooks;

  return [createImportedBook(title, [], parsed, defaultScope)].filter((book): book is WorldBookEntry => Boolean(book));
}

function createPlainTextBook(text: string, title: string, defaultScope: WorldBookScope) {
  const content = text.trim();
  if (!content) return null;
  return normalizeWorldBookEntry({
    id: createId('wb'),
    title,
    content,
    entries: [plainTextEntry('全文', content)],
    scope: defaultScope,
    enabled: true,
    coverImage: ''
  });
}

export function parseWorldBookImportText(text: string, options: WorldBookImportOptions = {}): WorldBookImportResult {
  const sourceType = options.sourceType ?? 'text-file';
  const defaultScope = options.defaultScope ?? 'local';
  const title = fileTitle(options.fileName);
  const trimmedText = text.replace(/^\uFEFF/, '').trim();
  const warnings: string[] = [];

  if (!trimmedText) return { books: [], warnings: ['文件内容为空。'] };

  if (sourceType === 'json-file' || /^[\[{]/.test(trimmedText)) {
    try {
      const books = parseJsonWorldBooks(JSON.parse(trimmedText), title, defaultScope);
      if (books.length) return { books, warnings };
      if (sourceType === 'json-file') return { books: [], warnings: ['JSON 中没有识别到世界书条目。'] };
    } catch (error) {
      if (sourceType === 'json-file') throw new Error('JSON 文件解析失败，请确认是有效的世界书 JSON。');
      warnings.push('文本开头像 JSON，但解析失败，已按纯文本导入。');
    }
  }

  const book = createPlainTextBook(trimmedText, title, defaultScope);
  return { books: book ? [book] : [], warnings };
}

export async function readWorldBookImportFile(file: File) {
  return readTextDocumentFile(file);
}

export function worldBookImportSourceTypeForFile(file: File): WorldBookImportSourceType {
  const lowerName = file.name.toLocaleLowerCase();
  if (/\.json$/i.test(lowerName) || file.type === 'application/json') return 'json-file';
  if (/\.docx?$/i.test(lowerName) || /word|msword/i.test(file.type)) return 'doc-file';
  return 'text-file';
}