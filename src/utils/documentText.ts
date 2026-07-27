import { unzipSync } from 'fflate';

const maxImportBytes = 25 * 1024 * 1024;
const maxDocumentXmlBytes = 12 * 1024 * 1024;
const compoundSignature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const zipSignatures = [[0x50, 0x4b, 0x03, 0x04], [0x50, 0x4b, 0x05, 0x06], [0x50, 0x4b, 0x07, 0x08]];
const freeSector = 0xffffffff;
const endOfChain = 0xfffffffe;
const maxRegularSector = 0xfffffffa;
const wordXmlPattern = /^word\/(?:document|header\d*|footer\d*|footnotes|endnotes)\.xml$/i;

interface CompoundDirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  size: number;
}

function hasSignature(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

function readUint16(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) throw new Error('文档结构不完整。');
  return bytes[offset] + bytes[offset + 1] * 0x100;
}

function readUint32(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) throw new Error('文档结构不完整。');
  return (bytes[offset] + bytes[offset + 1] * 0x100 + bytes[offset + 2] * 0x10000 + bytes[offset + 3] * 0x1000000) >>> 0;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&#x([\da-f]+);/gi, (match, code) => {
      const value = Number.parseInt(code, 16);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    })
    .replace(/&#(\d+);/g, (match, code) => {
      const value = Number.parseInt(code, 10);
      return Number.isFinite(value) && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function documentXmlToText(xml: string) {
  return normalizeExtractedText(decodeXmlEntities(xml
    .replace(/<w:tab\b[^>]*\/?\s*>/gi, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/?\s*>/gi, '\n')
    .replace(/<\/w:tc\s*>/gi, '\t')
    .replace(/<\/w:(?:p|tr)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')));
}

function documentXmlOrder(name: string) {
  if (/word\/document\.xml$/i.test(name)) return 0;
  if (/word\/header/i.test(name)) return 1;
  if (/word\/(?:footnotes|endnotes)/i.test(name)) return 2;
  return 3;
}

function readDocxText(bytes: Uint8Array) {
  let oversizedEntry = false;
  let files: ReturnType<typeof unzipSync>;
  try {
    files = unzipSync(bytes, {
      filter: (entry) => {
        if (!wordXmlPattern.test(entry.name)) return false;
        if (entry.originalSize > maxDocumentXmlBytes) {
          oversizedEntry = true;
          return false;
        }
        return true;
      }
    });
  } catch {
    throw new Error('DOCX 文件损坏或不是有效的 Word 文档。');
  }
  if (oversizedEntry) throw new Error('DOCX 正文过大，无法安全导入。');

  const entries = Object.entries(files)
    .filter(([name]) => wordXmlPattern.test(name))
    .sort(([left], [right]) => documentXmlOrder(left) - documentXmlOrder(right));
  if (!entries.some(([name]) => /word\/document\.xml$/i.test(name))) {
    throw new Error('DOCX 中没有找到可读取的正文。');
  }

  const decoder = new TextDecoder();
  const text = normalizeExtractedText(entries.map(([, value]) => documentXmlToText(decoder.decode(value))).filter(Boolean).join('\n\n'));
  if (!text) throw new Error('DOCX 正文为空。');
  return text;
}

function decodeBytes(bytes: Uint8Array, encoding: string, fatal = false) {
  try {
    return new TextDecoder(encoding, { fatal }).decode(bytes);
  } catch {
    return '';
  }
}

function decodePlainText(bytes: Uint8Array) {
  if (hasSignature(bytes, [0xef, 0xbb, 0xbf])) return decodeBytes(bytes.subarray(3), 'utf-8');
  if (hasSignature(bytes, [0xff, 0xfe])) return decodeBytes(bytes.subarray(2), 'utf-16le');
  if (hasSignature(bytes, [0xfe, 0xff])) return decodeBytes(bytes.subarray(2), 'utf-16be');

  const sampleLength = Math.min(bytes.length, 4096);
  let evenNulls = 0;
  let oddNulls = 0;
  for (let index = 0; index < sampleLength; index += 1) {
    if (bytes[index] !== 0) continue;
    if (index % 2) oddNulls += 1;
    else evenNulls += 1;
  }
  if (oddNulls > sampleLength / 8 && oddNulls > evenNulls * 3) return decodeBytes(bytes, 'utf-16le');
  if (evenNulls > sampleLength / 8 && evenNulls > oddNulls * 3) return decodeBytes(bytes, 'utf-16be');

  const utf8 = decodeBytes(bytes, 'utf-8', true);
  if (utf8) return utf8;
  return decodeBytes(bytes, 'gb18030') || decodeBytes(bytes, 'windows-1252');
}

function rtfEncoding(source: string) {
  const codePage = source.match(/\\ansicpg(\d+)/i)?.[1];
  if (codePage === '65001') return 'utf-8';
  if (codePage === '936') return 'gb18030';
  if (codePage === '950') return 'big5';
  if (codePage === '932') return 'shift_jis';
  if (codePage === '949') return 'euc-kr';
  return codePage ? `windows-${codePage}` : 'windows-1252';
}

function readRtfText(bytes: Uint8Array) {
  const initial = decodeBytes(bytes, 'windows-1252');
  const decoder = new TextDecoder(rtfEncoding(initial));
  const source = initial.replace(/(?:\\'[\da-f]{2})+/gi, (sequence) => {
    const values = [...sequence.matchAll(/\\'([\da-f]{2})/gi)].map((match) => Number.parseInt(match[1], 16));
    return decoder.decode(Uint8Array.from(values));
  });
  const skippedDestinations = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'objdata', 'filetbl', 'listtable', 'listoverridetable', 'revtbl', 'rsidtbl', 'generator', 'themedata', 'datastore', 'xmlnstbl', 'fldinst']);
  const output: string[] = [];
  const stack: Array<{ skip: boolean; unicodeFallback: number }> = [];
  let state = { skip: false, unicodeFallback: 1 };
  let fallbackCharacters = 0;

  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (character === '{') {
      stack.push(state);
      state = { ...state };
      index += 1;
      continue;
    }
    if (character === '}') {
      state = stack.pop() ?? { skip: false, unicodeFallback: 1 };
      fallbackCharacters = 0;
      index += 1;
      continue;
    }
    if (character === '\\') {
      const symbol = source[index + 1] ?? '';
      if (symbol === '*') {
        state.skip = true;
        index += 2;
        continue;
      }
      if ('\\{}'.includes(symbol)) {
        if (!state.skip && fallbackCharacters === 0) output.push(symbol);
        else if (fallbackCharacters > 0) fallbackCharacters -= 1;
        index += 2;
        continue;
      }
      if (symbol === '~') {
        if (!state.skip && fallbackCharacters === 0) output.push(' ');
        else if (fallbackCharacters > 0) fallbackCharacters -= 1;
        index += 2;
        continue;
      }
      const control = source.slice(index + 1).match(/^([a-z]+)(-?\d+)? ?/i);
      if (!control) {
        index += 2;
        continue;
      }
      const word = control[1].toLocaleLowerCase();
      const parameter = control[2] === undefined ? null : Number.parseInt(control[2], 10);
      index += control[0].length + 1;
      if (skippedDestinations.has(word)) state.skip = true;
      if (word === 'uc' && parameter !== null) state.unicodeFallback = Math.max(0, parameter);
      if (word === 'bin' && parameter !== null) index += Math.max(0, parameter);
      if (state.skip) continue;
      if (word === 'u' && parameter !== null) {
        output.push(String.fromCharCode(parameter < 0 ? parameter + 0x10000 : parameter));
        fallbackCharacters = state.unicodeFallback;
      } else if (word === 'par' || word === 'line' || word === 'page') {
        output.push('\n');
      } else if (word === 'tab') {
        output.push('\t');
      }
      continue;
    }
    if (character === '\r' || character === '\n') {
      index += 1;
      continue;
    }
    if (!state.skip) {
      if (fallbackCharacters > 0) fallbackCharacters -= 1;
      else output.push(character);
    }
    index += 1;
  }

  return normalizeExtractedText(output.join(''));
}

function readHtmlText(source: string) {
  return normalizeExtractedText(decodeXmlEntities(source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\b[^>]*>|<\/(?:p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')));
}

function joinByteChunks(chunks: Uint8Array[]) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function readCompoundWordStreams(bytes: Uint8Array) {
  if (!hasSignature(bytes, compoundSignature)) throw new Error('不是有效的旧版 DOC 文件。');
  const majorVersion = readUint16(bytes, 0x1a);
  const sectorSize = 2 ** readUint16(bytes, 0x1e);
  const miniSectorSize = 2 ** readUint16(bytes, 0x20);
  if (![512, 4096].includes(sectorSize) || miniSectorSize !== 64) throw new Error('DOC 使用了不支持的复合文档结构。');

  const maximumSectorCount = Math.ceil(bytes.length / sectorSize);
  const fatSectorCount = readUint32(bytes, 0x2c);
  if (fatSectorCount > maximumSectorCount) throw new Error('DOC 的分配表已损坏。');

  const readSector = (sectorId: number) => {
    if (sectorId >= maximumSectorCount || sectorId >= maxRegularSector) throw new Error('DOC 包含无效的扇区引用。');
    const offset = (sectorId + 1) * sectorSize;
    if (offset + sectorSize > bytes.length) throw new Error('DOC 扇区数据不完整。');
    return bytes.subarray(offset, offset + sectorSize);
  };

  const fatSectorIds: number[] = [];
  for (let index = 0; index < 109 && fatSectorIds.length < fatSectorCount; index += 1) {
    const sectorId = readUint32(bytes, 0x4c + index * 4);
    if (sectorId < maxRegularSector) fatSectorIds.push(sectorId);
  }

  let difatSectorId = readUint32(bytes, 0x44);
  const difatSectorCount = readUint32(bytes, 0x48);
  const seenDifatSectors = new Set<number>();
  for (let index = 0; index < difatSectorCount && fatSectorIds.length < fatSectorCount; index += 1) {
    if (difatSectorId >= maxRegularSector || seenDifatSectors.has(difatSectorId)) throw new Error('DOC 的扩展分配表已损坏。');
    seenDifatSectors.add(difatSectorId);
    const sector = readSector(difatSectorId);
    for (let offset = 0; offset < sectorSize - 4 && fatSectorIds.length < fatSectorCount; offset += 4) {
      const sectorId = readUint32(sector, offset);
      if (sectorId < maxRegularSector) fatSectorIds.push(sectorId);
    }
    difatSectorId = readUint32(sector, sectorSize - 4);
  }
  if (fatSectorIds.length < fatSectorCount) throw new Error('DOC 的分配表不完整。');

  const fat: number[] = [];
  for (const sectorId of fatSectorIds.slice(0, fatSectorCount)) {
    const sector = readSector(sectorId);
    for (let offset = 0; offset < sector.length; offset += 4) fat.push(readUint32(sector, offset));
  }

  const readChain = (startSector: number, allocation: number[], sectorReader: (sectorId: number) => Uint8Array) => {
    const chunks: Uint8Array[] = [];
    const seen = new Set<number>();
    let sectorId = startSector;
    while (sectorId < maxRegularSector) {
      if (seen.has(sectorId) || chunks.length > maximumSectorCount) throw new Error('DOC 的扇区链已损坏。');
      seen.add(sectorId);
      chunks.push(sectorReader(sectorId));
      sectorId = allocation[sectorId] ?? freeSector;
    }
    if (sectorId !== endOfChain && sectorId !== freeSector) throw new Error('DOC 的扇区链结束标记无效。');
    return joinByteChunks(chunks);
  };

  const directoryBytes = readChain(readUint32(bytes, 0x30), fat, readSector);
  const directoryEntries: CompoundDirectoryEntry[] = [];
  const nameDecoder = new TextDecoder('utf-16le');
  for (let offset = 0; offset + 128 <= directoryBytes.length; offset += 128) {
    const nameLength = readUint16(directoryBytes, offset + 0x40);
    const type = directoryBytes[offset + 0x42];
    if (!type || nameLength < 2 || nameLength > 64) continue;
    const name = nameDecoder.decode(directoryBytes.subarray(offset, offset + nameLength - 2));
    const sizeLow = readUint32(directoryBytes, offset + 0x78);
    const sizeHigh = majorVersion === 4 ? readUint32(directoryBytes, offset + 0x7c) : 0;
    const size = sizeLow + sizeHigh * 0x100000000;
    if (!Number.isSafeInteger(size) || size > maxImportBytes * 2) throw new Error('DOC 内部数据流过大。');
    directoryEntries.push({ name, type, startSector: readUint32(directoryBytes, offset + 0x74), size });
  }

  const rootEntry = directoryEntries.find((entry) => entry.type === 5);
  if (!rootEntry) throw new Error('DOC 缺少根存储。');
  const miniStreamCutoff = readUint32(bytes, 0x38);
  const miniFatSectorCount = readUint32(bytes, 0x40);
  const firstMiniFatSector = readUint32(bytes, 0x3c);
  const miniFatBytes = miniFatSectorCount
    ? readChain(firstMiniFatSector, fat, readSector).subarray(0, miniFatSectorCount * sectorSize)
    : new Uint8Array();
  const miniFat: number[] = [];
  for (let offset = 0; offset + 4 <= miniFatBytes.length; offset += 4) miniFat.push(readUint32(miniFatBytes, offset));
  const rootMiniStream = rootEntry.size
    ? readChain(rootEntry.startSector, fat, readSector).subarray(0, rootEntry.size)
    : new Uint8Array();
  const readMiniSector = (sectorId: number) => {
    const offset = sectorId * miniSectorSize;
    if (offset + miniSectorSize > rootMiniStream.length) throw new Error('DOC 的短扇区数据不完整。');
    return rootMiniStream.subarray(offset, offset + miniSectorSize);
  };

  const readEntry = (entry: CompoundDirectoryEntry) => {
    if (!entry.size) return new Uint8Array();
    const stream = entry.size < miniStreamCutoff
      ? readChain(entry.startSector, miniFat, readMiniSector)
      : readChain(entry.startSector, fat, readSector);
    return stream.subarray(0, entry.size);
  };
  const findEntry = (name: string) => directoryEntries.find((entry) => entry.type === 2 && entry.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  const wordEntry = findEntry('WordDocument');
  if (!wordEntry) throw new Error('DOC 中没有找到 Word 正文。');
  const wordDocument = readEntry(wordEntry);
  if (readUint16(wordDocument, 0) !== 0xa5ec) throw new Error('DOC 正文格式无效。');
  const flags = readUint16(wordDocument, 0x0a);
  if ((flags & 0x0100) !== 0) throw new Error('暂不支持导入加密 DOC 文件。');
  const tableEntry = findEntry((flags & 0x0200) !== 0 ? '1Table' : '0Table');
  if (!tableEntry) throw new Error('DOC 中没有找到正文索引。');
  return { wordDocument, table: readEntry(tableEntry) };
}

function readBinaryDocText(bytes: Uint8Array) {
  const { wordDocument, table } = readCompoundWordStreams(bytes);
  const bodyLength = readUint32(wordDocument, 0x4c);
  let position = readUint32(wordDocument, 0x1a2);
  const clxLength = readUint32(wordDocument, 0x1a6);
  const clxEnd = position + clxLength;
  if (clxEnd > table.length) throw new Error('DOC 的正文索引不完整。');

  while (position < clxEnd && table[position] === 1) {
    position += 3 + readUint16(table, position + 1);
  }
  if (position + 5 > clxEnd || table[position] !== 2) throw new Error('DOC 的正文片段表无效。');
  const pieceTableSize = readUint32(table, position + 1);
  position += 5;
  const pieceCount = (pieceTableSize - 4) / 12;
  if (!Number.isInteger(pieceCount) || pieceCount < 1 || position + pieceTableSize > table.length) {
    throw new Error('DOC 的正文片段表已损坏。');
  }

  const lastCharacterPosition = readUint32(table, position + pieceCount * 4);
  const resolvedBodyLength = Math.min(bodyLength || lastCharacterPosition, lastCharacterPosition);
  const output: string[] = [];
  for (let index = 0; index < pieceCount; index += 1) {
    const start = readUint32(table, position + index * 4);
    const end = readUint32(table, position + (index + 1) * 4);
    if (end <= start || start >= resolvedBodyLength) continue;
    const descriptorOffset = position + (pieceCount + 1) * 4 + index * 8;
    const encodedFileOffset = readUint32(table, descriptorOffset + 2);
    const compressed = (encodedFileOffset & 0x40000000) !== 0;
    const fileOffset = compressed ? (encodedFileOffset & 0x3fffffff) / 2 : encodedFileOffset;
    const charactersToRead = Math.min(end, resolvedBodyLength) - start;
    const byteLength = charactersToRead * (compressed ? 1 : 2);
    if (!Number.isInteger(fileOffset) || fileOffset + byteLength > wordDocument.length) throw new Error('DOC 的正文片段超出文件范围。');
    output.push(new TextDecoder(compressed ? 'windows-1252' : 'utf-16le').decode(wordDocument.subarray(fileOffset, fileOffset + byteLength)));
  }

  const text = normalizeExtractedText(output.join('')
    .replace(/\u0007/g, '\t')
    .replace(/[\u000b\u000c\u000d]/g, '\n')
    .replace(/[\u0000-\u0006\u0008\u000e-\u001f]/g, ''));
  if (!text) throw new Error('DOC 正文为空。');
  return text;
}

function looksLikeReadableText(value: string) {
  if (!value.trim()) return false;
  const sample = value.slice(0, 4096);
  const invalidCharacters = [...sample].filter((character) => {
    const code = character.charCodeAt(0);
    return character === '\ufffd' || (code < 32 && !['\n', '\r', '\t'].includes(character));
  }).length;
  return invalidCharacters / Math.max(1, sample.length) < 0.03;
}

export async function readTextDocumentFile(file: File) {
  if (!file.size) throw new Error('文件内容为空。');
  if (file.size > maxImportBytes) throw new Error('文件超过 25 MB，无法导入。');

  const bytes = new Uint8Array(await file.arrayBuffer());
  const lowerName = file.name.toLocaleLowerCase();
  if (zipSignatures.some((signature) => hasSignature(bytes, signature))) return readDocxText(bytes);
  if (hasSignature(bytes, compoundSignature)) return readBinaryDocText(bytes);
  if (/\.docx$/i.test(lowerName)) throw new Error('DOCX 文件损坏或格式不正确。');

  const decoded = decodePlainText(bytes);
  const trimmedStart = decoded.trimStart();
  const text = /^\{\\rtf/i.test(trimmedStart)
    ? readRtfText(bytes)
    : /^(?:<!doctype\s+html|<html\b|<body\b)/i.test(trimmedStart)
      ? readHtmlText(decoded)
      : normalizeExtractedText(decoded.replace(/\u0000/g, ''));
  if (!looksLikeReadableText(text)) throw new Error('文件中没有识别到可导入的文字。');
  return text;
}