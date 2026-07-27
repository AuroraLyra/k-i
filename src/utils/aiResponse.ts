import { jsonrepair } from 'jsonrepair';

function isValidJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function findJsonRootCandidates(value: string) {
  const candidates: string[] = [];
  let startIndex = -1;
  const delimiters: string[] = [];
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"' && startIndex >= 0) {
      inString = true;
      continue;
    }

    if (character === '{' || character === '[') {
      if (startIndex < 0) startIndex = index;
      delimiters.push(character);
      continue;
    }

    if ((character !== '}' && character !== ']') || startIndex < 0) continue;
    const expectedOpening = character === '}' ? '{' : '[';
    if (delimiters[delimiters.length - 1] !== expectedOpening) {
      startIndex = -1;
      delimiters.length = 0;
      continue;
    }
    delimiters.pop();
    if (!delimiters.length) {
      candidates.push(value.slice(startIndex, index + 1).trim());
      startIndex = -1;
    }
  }

  return candidates;
}

function collectJsonCandidates(content: string) {
  const trimmed = content.trim();
  const fencedSources = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const sources = [...fencedSources, trimmed].filter((source, index, items) => source && items.indexOf(source) === index);
  const candidates: string[] = [];

  const addCandidate = (candidate: string) => {
    const normalized = candidate.trim();
    if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
  };

  for (const source of sources) {
    findJsonRootCandidates(source)
      .sort((left, right) => right.length - left.length)
      .forEach(addCandidate);

    const rootIndexes = [source.indexOf('{'), source.indexOf('[')]
      .filter((index) => index >= 0)
      .sort((left, right) => left - right);
    for (const rootIndex of rootIndexes) addCandidate(source.slice(rootIndex));
    addCandidate(source);
  }

  return candidates;
}

export function extractJsonContent(content: string) {
  const candidates = collectJsonCandidates(content);
  return candidates.find(isValidJson) ?? candidates[0] ?? content.trim();
}

function parseJsonCandidate(content: string) {
  const candidates = collectJsonCandidates(content);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(jsonrepair(candidate)) as unknown;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new SyntaxError('模型没有返回可解析的 JSON。');
}

export function parseModelJsonResponse(content: string) {
  let parsed = parseJsonCandidate(content);

  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    const nestedContent = parsed.trim();
    if (!nestedContent || nestedContent === content.trim()) break;
    try {
      const nested = parseJsonCandidate(nestedContent);
      if (nested === parsed) break;
      parsed = nested;
    } catch {
      break;
    }
  }

  return parsed;
}

export function normalizeLooseModelReply(content: string) {
  return content
    .replace(/<Logic_Trace\b[^>]*>[\s\S]*?<\/Logic_Trace>/gi, '')
    .replace(/^\s*```(?:json)?\s*$/gim, '')
    .replace(/^\s*(?:\{\s*message\s*\}|<message>|\[message\])\s*[:：]?\s*/i, '')
    .replace(/\s*(?:\{\s*\/message\s*\}|<\/message>|\[\/message\])\s*$/i, '')
    .trim();
}