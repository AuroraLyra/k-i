import type { WorldBookEntry, WorldBookEntryActivation, WorldBookInsertionPosition, WorldBookLoreEntry, WorldBookScope } from '@/types/domain';
import { createId } from './id';

export const TABOO_WORLD_BOOK_ID = 'world-book-taboo';
export const TABOO_WORLD_BOOK_TITLE = '禁忌之书';

function encodeSvg(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function pickPalette(scope: WorldBookScope) {
  return {
    'global-online': ['#f6efe8', '#d9c1b1', '#7b5f52'],
    'global-offline': ['#f8f2ec', '#cfb4a5', '#5b463c'],
    local: ['#f7f0f3', '#d8bcc8', '#654d5e']
  }[scope];
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&apos;',
    '"': '&quot;'
  })[character] ?? character);
}

function isCjkCharacter(character: string) {
  const codePoint = character.codePointAt(0) ?? 0;
  return codePoint >= 0x3400 && codePoint <= 0x9fff || codePoint >= 0xf900 && codePoint <= 0xfaff;
}

function splitCoverTitle(title: string) {
  const characters = Array.from(title.trim() || 'World Book');
  const lineLength = characters.some((character) => isCjkCharacter(character)) ? 8 : 14;
  const maxLines = 3;
  const lines: string[] = [];

  for (let startIndex = 0; startIndex < characters.length && lines.length < maxLines; startIndex += lineLength) {
    lines.push(characters.slice(startIndex, startIndex + lineLength).join('').trim());
  }

  if (characters.length > lineLength * maxLines) {
    const lastLine = lines[lines.length - 1] ?? '';
    lines[lines.length - 1] = `${Array.from(lastLine).slice(0, Math.max(1, lineLength - 3)).join('')}...`;
  }

  return lines.filter(Boolean).length ? lines.filter(Boolean) : ['World Book'];
}

function renderCoverTitle(title: string, ink: string) {
  const lines = splitCoverTitle(title);
  const fontSize = lines.length > 2 ? 44 : lines.length > 1 ? 48 : 54;
  const startY = lines.length > 2 ? 392 : lines.length > 1 ? 420 : 450;
  const lineHeight = lines.length > 2 ? 56 : 62;
  const tspans = lines
    .map((line, index) => `<tspan x="360" y="${startY + index * lineHeight}">${escapeSvgText(line)}</tspan>`)
    .join('');
  return `<text text-anchor="middle" font-size="${fontSize}" fill="${ink}" font-weight="600" font-family="Iowan Old Style, Palatino Linotype, Times New Roman, Songti SC, serif">${tspans}</text>`;
}

export function createDefaultWorldBookCover(title: string, scope: WorldBookScope) {
  const [paper, accent, ink] = pickPalette(scope);
  const coverTitle = renderCoverTitle(title, ink);

  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1024">
      <defs>
        <linearGradient id="cover" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${paper}" />
          <stop offset="100%" stop-color="#fffdf9" />
        </linearGradient>
      </defs>
      <rect width="720" height="1024" rx="42" fill="url(#cover)" />
      <rect x="48" y="48" width="624" height="928" rx="34" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="6" />
      <rect x="88" y="88" width="544" height="168" rx="28" fill="${accent}" fill-opacity="0.14" />
      <path d="M126 826c82-126 162-188 246-188s164 62 246 188" fill="none" stroke="${accent}" stroke-opacity="0.32" stroke-width="12" stroke-linecap="round" />
      <circle cx="360" cy="410" r="116" fill="${accent}" fill-opacity="0.22" />
      <text x="360" y="182" text-anchor="middle" font-size="28" fill="${ink}" fill-opacity="0.72" font-family="Iowan Old Style, Palatino Linotype, Times New Roman, Songti SC, serif" letter-spacing="8">WORLD BOOK</text>
      ${coverTitle}
      <text x="360" y="902" text-anchor="middle" font-size="24" fill="${ink}" fill-opacity="0.68" font-family="Iowan Old Style, Palatino Linotype, Times New Roman, Songti SC, serif">Link Library Edition</text>
    </svg>
  `);
}

function createTabooWorldBookCover() {
  return encodeSvg(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 1024">
      <defs>
        <linearGradient id="taboo-cover" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#34252b" />
          <stop offset="58%" stop-color="#5b3e47" />
          <stop offset="100%" stop-color="#8b6870" />
        </linearGradient>
        <radialGradient id="taboo-glow" cx="50%" cy="36%" r="58%">
          <stop offset="0%" stop-color="#f2d9d4" stop-opacity="0.38" />
          <stop offset="100%" stop-color="#f2d9d4" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="720" height="1024" rx="42" fill="url(#taboo-cover)" />
      <rect width="720" height="1024" rx="42" fill="url(#taboo-glow)" />
      <rect x="52" y="52" width="616" height="920" rx="30" fill="none" stroke="#f7e9e4" stroke-opacity="0.38" stroke-width="3" />
      <circle cx="360" cy="374" r="112" fill="none" stroke="#f7e9e4" stroke-opacity="0.55" stroke-width="3" />
      <path d="M302 374c28-38 88-38 116 0-28 38-88 38-116 0Z" fill="none" stroke="#f7e9e4" stroke-width="5" />
      <circle cx="360" cy="374" r="15" fill="#f7e9e4" fill-opacity="0.86" />
      <text x="360" y="174" text-anchor="middle" font-size="24" fill="#f7e9e4" fill-opacity="0.72" font-family="Helvetica Neue, PingFang SC, sans-serif" letter-spacing="10">PRIVATE ARCHIVE</text>
      <text x="360" y="590" text-anchor="middle" font-size="58" fill="#fffaf7" font-weight="500" font-family="Songti SC, Noto Serif CJK SC, serif" letter-spacing="8">禁忌之书</text>
      <text x="360" y="650" text-anchor="middle" font-size="20" fill="#f7e9e4" fill-opacity="0.7" font-family="Helvetica Neue, PingFang SC, sans-serif" letter-spacing="5">SITEWIDE PRIORITY</text>
      <text x="360" y="898" text-anchor="middle" font-size="20" fill="#f7e9e4" fill-opacity="0.62" font-family="Helvetica Neue, PingFang SC, sans-serif">BABYLINK · DO NOT REMOVE</text>
    </svg>
  `);
}

function normalizeScope(scope: string | null | undefined): WorldBookScope {
  return scope === 'global-online' || scope === 'global-offline' || scope === 'local' ? scope : 'local';
}

function normalizeActivation(activation: string | null | undefined): WorldBookEntryActivation {
  return activation === 'keyword' || activation === 'constant' || activation === 'priority' ? activation : 'keyword';
}

function normalizePosition(position: string | null | undefined): WorldBookInsertionPosition {
  return position === 'before-chat' || position === 'after-chat' ? position : 'before-chat';
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }
  return [...new Set(String(value ?? '').split(/[，,、\n]/).map((item) => item.trim()).filter(Boolean))];
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function createWorldBookLoreEntry(entry: Partial<WorldBookLoreEntry> = {}): WorldBookLoreEntry {
  return {
    id: String(entry.id ?? createId('wbe')).trim() || createId('wbe'),
    title: String(entry.title ?? '').trim(),
    content: String(entry.content ?? '').trim(),
    enabled: entry.enabled ?? true,
    activation: normalizeActivation(entry.activation),
    keys: normalizeStringList(entry.keys),
    secondaryKeys: normalizeStringList(entry.secondaryKeys),
    position: normalizePosition(entry.position),
    order: normalizeNumber(entry.order, 100, 0, 9999),
    depth: normalizeNumber(entry.depth, 4, 0, 12),
    probability: normalizeNumber(entry.probability, 100, 0, 100),
    caseSensitive: Boolean(entry.caseSensitive)
  };
}

function normalizeLoreEntries(entry?: Partial<WorldBookEntry> | null): WorldBookLoreEntry[] {
  const entries = Array.isArray(entry?.entries)
    ? entry.entries.map((item) => createWorldBookLoreEntry(item)).filter((item) => item.title || item.content || item.keys.length || item.secondaryKeys.length)
    : [];
  const legacyContent = String(entry?.content ?? '').trim();
  if (entries.length) return entries;
  if (!legacyContent) return [];
  return [createWorldBookLoreEntry({
    title: String(entry?.title ?? '').trim() || '默认条目',
    content: legacyContent,
    activation: 'constant'
  })];
}

export function getWorldBookContentSummary(entry: Pick<WorldBookEntry, 'content' | 'entries'>) {
  const entryContent = entry.entries
    .map((item) => item.content.trim())
    .filter(Boolean)
    .join('\n\n');
  return entryContent || entry.content.trim();
}

export function normalizeWorldBookEntry(entry?: Partial<WorldBookEntry> | null): WorldBookEntry {
  const id = String(entry?.id ?? createId('wb')).trim() || createId('wb');
  const isTabooBook = id === TABOO_WORLD_BOOK_ID;
  const normalizedEntries = normalizeLoreEntries(entry);
  const entries = isTabooBook
    ? normalizedEntries.filter((item) => item.content.trim())
    : normalizedEntries;
  return {
    id,
    title: isTabooBook ? TABOO_WORLD_BOOK_TITLE : String(entry?.title ?? '').trim(),
    content: entries.map((item) => item.content).filter(Boolean).join('\n\n') || String(entry?.content ?? '').trim(),
    entries,
    scope: isTabooBook ? 'global-online' : normalizeScope(entry?.scope),
    enabled: isTabooBook ? true : entry?.enabled ?? true,
    coverImage: String(entry?.coverImage ?? '').trim()
  };
}

export function createTabooWorldBook(): WorldBookEntry {
  return {
    id: TABOO_WORLD_BOOK_ID,
    title: TABOO_WORLD_BOOK_TITLE,
    content: '',
    entries: [],
    scope: 'global-online',
    enabled: true,
    coverImage: ''
  };
}

export function isTabooWorldBook(entry: Pick<WorldBookEntry, 'id'> | string | null | undefined) {
  return (typeof entry === 'string' ? entry : entry?.id) === TABOO_WORLD_BOOK_ID;
}

export function getTabooWorldBookContent(entry: WorldBookEntry | null | undefined) {
  if (!entry || !isTabooWorldBook(entry)) return '';
  const entryBlocks = entry.entries
    .filter((item) => item.enabled && item.content.trim())
    .sort((left, right) => Number(right.activation === 'priority') - Number(left.activation === 'priority') || left.order - right.order)
    .map((item) => `【${item.title.trim() || '未命名条目'}】\n${item.content.trim()}`);
  return entryBlocks.join('\n\n') || entry.content.trim();
}

export function normalizeWorldBooks(entries: Array<Partial<WorldBookEntry> | null | undefined>) {
  const normalizedEntries = entries.map((entry) => normalizeWorldBookEntry(entry));
  const tabooBook = normalizedEntries.find((entry) => isTabooWorldBook(entry)) ?? createTabooWorldBook();
  return [tabooBook, ...normalizedEntries.filter((entry) => !isTabooWorldBook(entry))];
}

export function resolveWorldBookCover(entry: WorldBookEntry) {
  return entry.coverImage.trim() || (isTabooWorldBook(entry) ? createTabooWorldBookCover() : createDefaultWorldBookCover(entry.title, entry.scope));
}
