import type { AppSettings, CharacterProfile, FanficBook, FanficStoryBible, UserProfile, WorldBookEntry } from '@/types/domain';

const defaultPalette = ['#f2d7d9', '#dce7de', '#f8f1e4'];

export function getFanficTextModelOverride(settings?: AppSettings) {
  return settings?.modelOverrides.theater?.trim() ?? '';
}

function uniqueStrings(values: unknown, limit = 12) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))].slice(0, limit);
}

export function selectFanficLocalWorldBooks(character: Pick<CharacterProfile, 'localWorldBookIds'>, worldBooks: WorldBookEntry[]) {
  const boundIds = new Set(character.localWorldBookIds ?? []);
  return worldBooks.filter((book) => book.scope === 'local' && book.enabled && boundIds.has(book.id));
}

export function serializeFanficLocalWorldBooks(worldBooks: WorldBookEntry[]) {
  return worldBooks
    .filter((book) => book.scope === 'local' && book.enabled)
    .map((book) => ({
      title: book.title,
      entries: (book.entries.length ? book.entries : [{ title: book.title, content: book.content, enabled: true }])
        .filter((entry) => entry.enabled && (entry.title.trim() || entry.content.trim()))
        .map((entry) => ({ title: entry.title, content: entry.content }))
    }))
    .filter((book) => book.entries.length);
}

export function getFanficLocalWorldBookSourceText(worldBooks: WorldBookEntry[]) {
  return serializeFanficLocalWorldBooks(worldBooks)
    .flatMap((book) => book.entries.map((entry) => `【${book.title || '未命名局部世界书'} / ${entry.title || '未命名条目'}】\n${entry.content}`))
    .join('\n\n');
}

export function requireFanficTrueNames(user: Pick<UserProfile, 'name'>, character: Pick<CharacterProfile, 'name'>) {
  const userName = user.name.trim();
  const characterName = character.name.trim();
  if (!userName) throw new Error('请先在账号资料中填写用户真名，再创建同人文。');
  if (!characterName) throw new Error('请先在角色资料中填写角色真名，再创建同人文。');
  if (userName === characterName) throw new Error('用户真名与角色真名不能完全相同。');
  return { userName, characterName };
}

export function createFanficProfileFingerprint(user: Pick<UserProfile, 'name' | 'description'>, character: Pick<CharacterProfile, 'name' | 'description'>, additionalSourceText = '') {
  const source = `${user.name}\u0000${user.description}\u0000${character.name}\u0000${character.description}\u0000${additionalSourceText}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fanfic-profile-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function defaultFanficStoryBible(): FanficStoryBible {
  return {
    premise: '',
    coreHook: '',
    storyEngine: '',
    stakes: '',
    era: '',
    locations: [],
    worldRules: [],
    supportingCharacters: [],
    relationshipArc: '',
    coreMystery: '',
    motifs: []
  };
}

export function normalizeFanficBook(book: FanficBook): FanficBook {
  const normalizedBook = { ...book } as FanficBook & Record<string, unknown>;
  delete normalizedBook.creativeDna;
  delete normalizedBook.outline;
  return {
    ...normalizedBook,
    workType: 'user-character-au-fanfic',
    tags: uniqueStrings(book.tags, 8),
    tone: String(book.tone ?? '').trim(),
    pov: String(book.pov ?? '').trim() || '第三人称双线推进',
    contentBoundaries: uniqueStrings(book.contentBoundaries, 12),
    storyBible: {
      ...defaultFanficStoryBible(),
      ...(book.storyBible ?? {}),
      coreHook: String(book.storyBible?.coreHook ?? '').trim(),
      storyEngine: String(book.storyBible?.storyEngine ?? '').trim(),
      stakes: String(book.storyBible?.stakes ?? '').trim(),
      locations: uniqueStrings(book.storyBible?.locations, 10),
      worldRules: uniqueStrings(book.storyBible?.worldRules, 12),
      motifs: uniqueStrings(book.storyBible?.motifs, 8),
      supportingCharacters: Array.isArray(book.storyBible?.supportingCharacters)
        ? book.storyBible.supportingCharacters.slice(0, 10).map((entry) => ({
            name: String(entry?.name ?? '').trim(),
            role: String(entry?.role ?? '').trim(),
            goal: String(entry?.goal ?? '').trim(),
            secret: String(entry?.secret ?? '').trim()
          })).filter((entry) => entry.name)
        : []
    },
    continuity: uniqueStrings(book.continuity, 40),
    profileFingerprint: String(book.profileFingerprint ?? '').trim()
  };
}

function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character] ?? character);
}

function wrapCoverTitle(title: string) {
  const characters = [...title.trim()];
  if (characters.length <= 8) return [characters.join('')];
  const splitAt = Math.ceil(characters.length / 2);
  return [characters.slice(0, splitAt).join(''), characters.slice(splitAt).join('')];
}

export function createProceduralFanficCover(input: { title: string; authorName: string; palette?: string[]; motif?: string }) {
  const palette = [...(input.palette ?? []), ...defaultPalette].slice(0, 3);
  const titleLines = wrapCoverTitle(input.title).map(escapeXml);
  const authorName = escapeXml(input.authorName);
  const motif = escapeXml(input.motif?.trim() || 'A STORY FOR TWO');
  const titleMarkup = titleLines.map((line, index) => `<text x="58" y="${470 + index * 76}" fill="#262323" font-size="58" font-weight="700" letter-spacing="2">${line}</text>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1152" viewBox="0 0 768 1152">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette[0]}"/><stop offset=".52" stop-color="${palette[1]}"/><stop offset="1" stop-color="${palette[2]}"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .075"/></feComponentTransfer></filter></defs>
    <rect width="768" height="1152" rx="36" fill="url(#bg)"/>
    <circle cx="632" cy="178" r="154" fill="#fff" opacity=".36"/><circle cx="125" cy="1005" r="205" fill="#fff" opacity=".24"/>
    <path d="M88 340C220 214 356 212 484 326S682 440 720 316" fill="none" stroke="#fff" stroke-width="3" opacity=".72"/>
    <rect x="44" y="44" width="680" height="1064" rx="26" fill="none" stroke="#fff" stroke-width="2" opacity=".68"/>
    <text x="58" y="102" fill="#4c4646" font-size="18" font-weight="700" letter-spacing="6">${motif}</text>
    ${titleMarkup}
    <line x1="58" y1="${650 + (titleLines.length - 1) * 40}" x2="270" y2="${650 + (titleLines.length - 1) * 40}" stroke="#403b3b" stroke-width="3"/>
    <text x="58" y="${710 + (titleLines.length - 1) * 40}" fill="#4c4646" font-size="24" letter-spacing="4">${authorName} · 著</text>
    <text x="58" y="1060" fill="#4c4646" font-size="16" letter-spacing="5">BABYLINK ORIGINAL</text>
    <rect width="768" height="1152" filter="url(#grain)" opacity=".45"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}