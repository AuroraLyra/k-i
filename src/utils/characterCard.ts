import { decompressSync } from 'fflate';
import type { WorldBookEntry } from '@/types/domain';
import { readTextDocumentFile } from '@/utils/documentText';
import { createId } from '@/utils/id';
import { createWorldBookLoreEntry } from '@/utils/worldBook';

export interface ImportedCharacterCard {
  avatar: string;
  nickname: string;
  name: string;
  signature: string;
  description: string;
  worldBooks: WorldBookEntry[];
}

interface CharacterBookSource {
  name?: unknown;
  title?: unknown;
  comment?: unknown;
  entries?: Array<Record<string, unknown>>;
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取文件失败。')));
    reader.readAsText(file);
  });
}

function readFileAsArrayBuffer(file: File) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result as ArrayBuffer));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取文件失败。')));
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('读取文件失败。')));
    reader.readAsDataURL(file);
  });
}

function decodeBase64Utf8(value: string) {
  const binary = atob(value.trim());
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toDicebearAvatar(seed: string) {
  const label = (seed.trim() || 'NewFriend')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="32" fill="#f2f2f2"/><circle cx="64" cy="50" r="24" fill="#111" opacity=".82"/><path d="M28 108c8-22 24-34 36-34s28 12 36 34" fill="#111" opacity=".82"/><text x="64" y="121" text-anchor="middle" font-size="12" font-family="Arial, sans-serif" fill="#666">${label}</text></svg>`)}`;
}

function collectDescriptionSections(source: Record<string, unknown>) {
  const sections: string[] = [];
  const description = String(source.description ?? '').trim();
  const personality = String(source.personality ?? '').trim();
  const scenario = String(source.scenario ?? '').trim();

  if (description) sections.push(description);
  if (personality) sections.push(`性格\n${personality}`);
  if (scenario) sections.push(`场景\n${scenario}`);

  return sections.join('\n\n').trim();
}

function documentFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'NewFriend';
}

function getCharacterBook(source: Record<string, unknown>) {
  const nested = source.data && typeof source.data === 'object' ? source.data as Record<string, unknown> : source;
  const extensions = nested.extensions && typeof nested.extensions === 'object' ? nested.extensions as Record<string, unknown> : {};
  return (nested.character_book ?? extensions.character_book ?? source.character_book ?? null) as CharacterBookSource | null;
}

function mapWorldBooks(book: CharacterBookSource | null, characterName: string, coverImage: string): WorldBookEntry[] {
  const entries = Array.isArray(book?.entries) ? book.entries : [];
  const mappedEntries = entries.map((entry, index) => {
    const keys = Array.isArray(entry.keys)
      ? entry.keys.map((item) => String(item).trim()).filter(Boolean)
      : String(entry.keys ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    const title = String(entry.comment ?? entry.name ?? keys[0] ?? `导入设定 ${index + 1}`).trim();
    const content = String(entry.content ?? '').trim();
    if (!title && !content) return null;

    const loreContent = keys.length ? `触发词：${keys.join('、')}\n\n${content || '暂无内容。'}` : (content || '暂无内容。');
    return createWorldBookLoreEntry({
      title: title || `导入设定 ${index + 1}`,
      content: loreContent,
      activation: keys.length ? 'keyword' : 'constant',
      keys,
      enabled: entry.enabled !== false
    });
  });

  const loreEntries = mappedEntries.filter((entry): entry is ReturnType<typeof createWorldBookLoreEntry> => entry !== null);
  if (!loreEntries.length) return [];

  const title = String(book?.name ?? book?.title ?? book?.comment ?? '').trim() || `${characterName}的角色世界书`;
  return [{
    id: createId('wb'),
    title,
    content: loreEntries.map((entry) => entry.content).filter(Boolean).join('\n\n'),
    entries: loreEntries,
    scope: 'local' as const,
    enabled: true,
    coverImage
  } satisfies WorldBookEntry];
}

function parseCardPayload(payload: string, avatar: string) {
  const parsed = JSON.parse(payload) as Record<string, unknown>;
  const source = parsed.data && typeof parsed.data === 'object'
    ? parsed.data as Record<string, unknown>
    : parsed;

  const name = String(source.name ?? parsed.name ?? 'NewFriend').trim() || 'NewFriend';
  const nickname = String(source.nickname ?? source.nick_name ?? parsed.nickname ?? '').trim();
  const resolvedAvatar = avatar || toDicebearAvatar(name);

  return {
    avatar: resolvedAvatar,
    nickname,
    name,
    signature: String(source.signature ?? parsed.signature ?? '').trim(),
    description: collectDescriptionSections(source) || '导入角色卡后尚未提供更多资料。',
    worldBooks: mapWorldBooks(getCharacterBook(parsed), name, resolvedAvatar)
  } satisfies ImportedCharacterCard;
}

export function parseCharacterDocumentText(text: string, fileName: string): ImportedCharacterCard {
  const normalizedText = text.replace(/^\uFEFF/, '').trim();
  if (!normalizedText) throw new Error('角色文档内容为空。');
  const name = documentFileName(fileName);
  return {
    avatar: toDicebearAvatar(name),
    nickname: '',
    name,
    signature: '',
    description: normalizedText,
    worldBooks: []
  };
}

function readUint32(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3];
}

function decodeChunkText(type: string, data: Uint8Array) {
  if (type === 'tEXt') {
    const separatorIndex = data.indexOf(0);
    if (separatorIndex < 0) return null;
    const keyword = new TextDecoder().decode(data.slice(0, separatorIndex));
    const text = new TextDecoder().decode(data.slice(separatorIndex + 1));
    return { keyword, text };
  }

  if (type === 'zTXt') {
    const separatorIndex = data.indexOf(0);
    if (separatorIndex < 0 || separatorIndex + 2 > data.length) return null;
    const keyword = new TextDecoder().decode(data.slice(0, separatorIndex));
    const compressed = data.slice(separatorIndex + 2);
    const text = new TextDecoder().decode(decompressSync(compressed));
    return { keyword, text };
  }

  if (type === 'iTXt') {
    let offset = 0;
    while (offset < data.length && data[offset] !== 0) offset += 1;
    const keyword = new TextDecoder().decode(data.slice(0, offset));
    offset += 1;
    const compressed = data[offset] === 1;
    offset += 2;
    while (offset < data.length && data[offset] !== 0) offset += 1;
    offset += 1;
    while (offset < data.length && data[offset] !== 0) offset += 1;
    offset += 1;
    const textBytes = data.slice(offset);
    const text = compressed ? new TextDecoder().decode(decompressSync(textBytes)) : new TextDecoder().decode(textBytes);
    return { keyword, text };
  }

  return null;
}

function extractPngCharacterPayload(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new Error('当前只支持 PNG 角色卡图片或 JSON 角色卡。');
  }

  let offset = 8;
  while (offset + 8 < bytes.length) {
    const length = readUint32(bytes, offset);
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    const chunk = bytes.slice(offset + 8, offset + 8 + length);
    const decoded = decodeChunkText(type, chunk);
    if (decoded?.keyword === 'chara') {
      return decoded.text;
    }
    offset += length + 12;
  }

  throw new Error('图片里没有找到可导入的 SillyTavern 角色卡数据。');
}

export async function importSillyTavernCharacterCard(file: File): Promise<ImportedCharacterCard> {
  const lowerName = file.name.toLowerCase();
  if (file.type === 'application/json' || lowerName.endsWith('.json')) {
    return parseCardPayload(await readFileAsText(file), '');
  }

  if (file.type === 'image/png' || lowerName.endsWith('.png')) {
    const [buffer, avatar] = await Promise.all([readFileAsArrayBuffer(file), readFileAsDataUrl(file)]);
    const payload = extractPngCharacterPayload(buffer);
    try {
      return parseCardPayload(decodeBase64Utf8(payload), avatar);
    } catch {
      return parseCardPayload(payload, avatar);
    }
  }

  if (/\.(?:txt|docx?)$/i.test(lowerName) || /text\/plain|msword|wordprocessingml/i.test(file.type)) {
    return parseCharacterDocumentText(await readTextDocumentFile(file), file.name);
  }

  throw new Error('请导入 PNG、JSON、TXT、DOC 或 DOCX 角色文件。');
}