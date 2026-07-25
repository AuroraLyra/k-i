import { hasTextGenerationConfig, requestTextGeneration } from '@/services/ai';
import type { AppSettings, ChatMessage } from '@/types/domain';
import { jsonrepair } from 'jsonrepair';
import type {
  MemoryAssertion,
  MemoryAssertionKind,
  MemoryEntityType,
  MemoryEpistemicKind,
  MemoryExtractionAssertionDraft,
  MemoryExtractionEntityDraft,
  MemoryExtractionResult,
  MemoryExtractionStateDelta,
  MemoryStateKind,
  MemoryTheme,
} from '@/types/memory';

export interface ExtractTemporalMemoryInput {
  settings: AppSettings | undefined;
  modelOverride?: string;
  characterName: string;
  characterContext?: string;
  userName: string;
  worldBookContext?: string;
  messages: ChatMessage[];
  currentAssertions?: MemoryAssertion[];
  signal?: AbortSignal;
}

const entityTypes = new Set<MemoryEntityType>(['character', 'user', 'person', 'place', 'object', 'organization', 'event', 'concept']);
const assertionKinds = new Set<MemoryAssertionKind>(['fact', 'preference', 'promise', 'conflict', 'relationship', 'impression', 'growth', 'emotion', 'open-loop', 'interpretation', 'boundary']);
const epistemicKinds = new Set<MemoryEpistemicKind>(['told', 'observed', 'inferred', 'hearsay', 'canon']);
const stateKinds = new Set<MemoryStateKind>(['relationship', 'user-impression', 'adaptive-personality', 'mood', 'current-context']);

export type TemporalMemoryDiaryResult = Pick<MemoryExtractionResult, 'title' | 'narrative' | 'location' | 'emotion' | 'valence' | 'arousal' | 'salience'>;
export type TemporalMemoryGraphResult = Pick<MemoryExtractionResult, 'entities' | 'assertions' | 'themes' | 'stateDeltas'>;
export interface TemporalMemoryExtractionResult extends MemoryExtractionResult {
  graphErrorMessage?: string;
}

export async function extractTemporalMemory(input: ExtractTemporalMemoryInput): Promise<TemporalMemoryExtractionResult> {
  if (!hasTextGenerationConfig(input.settings, input.modelOverride)) {
    throw new Error('没有可用的总结模型。请先配置角色局部总结模型、全局总结模型或 API 默认模型。');
  }
  const diary = await generateTemporalMemoryDiary(input);
  let graph: TemporalMemoryGraphResult = { entities: [], assertions: [], themes: [], stateDeltas: [] };
  try {
    graph = await extractTemporalMemoryGraph(input);
  } catch (error) {
    console.warn('Memory graph extraction failed; the completed diary was preserved.', error);
    return {
      ...diary,
      ...graph,
      graphErrorMessage: error instanceof Error ? error.message : '知识图谱生成失败。'
    };
  }
  return { ...diary, ...graph };
}

export async function generateTemporalMemoryDiary(input: ExtractTemporalMemoryInput): Promise<TemporalMemoryDiaryResult> {
  if (!hasTextGenerationConfig(input.settings, input.modelOverride)) {
    throw new Error('没有可用的总结模型。请先配置角色局部总结模型、全局总结模型或 API 默认模型。');
  }
  const prompt = buildMemoryDiaryPrompt(input);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n重要重试要求：上一次日记 JSON 不完整。请从头输出且只输出这 7 个字段；narrative 压缩到 160-380 字并以完整句末标点收束，随后立即闭合 JSON。`;
    const response = await requestTextGeneration(input.settings, attemptPrompt, input.modelOverride, {
      temperature: attempt === 0 ? 0.1 : 0.05,
      maxTokens: attempt === 0 ? 1_000 : 1_400,
      jsonMode: true,
      signal: input.signal,
    });
    try {
      const parsed = parseTemporalMemoryExtractionResponse(response);
      return pickTemporalMemoryDiary(parsed);
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : 'JSON 结构无效。';
  throw new Error(`${reason} 日记模型已自动重试仍未成功，请更换总结模型后再试。`);
}

export async function extractTemporalMemoryGraph(input: ExtractTemporalMemoryInput): Promise<TemporalMemoryGraphResult> {
  const prompt = buildMemoryGraphPrompt(input);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n上一次图谱 JSON 不完整。请压缩输出，只保留最重要且有消息证据的条目，从头输出完整 JSON。`;
    try {
      const response = await requestTextGeneration(input.settings, attemptPrompt, input.modelOverride, {
        temperature: attempt === 0 ? 0.05 : 0,
        maxTokens: attempt === 0 ? 2_600 : 3_400,
        jsonMode: true,
        signal: input.signal,
      });
      return parseTemporalMemoryGraphResponse(response);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('知识图谱提取失败。');
}

export function parseTemporalMemoryGraphResponse(raw: string): TemporalMemoryGraphResult {
  const parsed = parseJsonObject(raw);
  const graphFieldNames = ['entities', 'entityList', 'entity', 'assertions', 'memories', 'memoryItems', 'themes', 'theme', 'stateDeltas', 'stateDelta', 'states'];
  if (!graphFieldNames.some((field) => field in parsed)) throw new Error('知识图谱模型没有返回图谱字段。');
  return normalizeMemoryGraphResult(parsed);
}

export interface ConsolidateMemoryThemeInput {
  settings: AppSettings | undefined;
  modelOverride?: string;
  characterName: string;
  userName: string;
  theme: MemoryTheme;
  assertions: MemoryAssertion[];
}

export async function consolidateMemoryThemeReport(input: ConsolidateMemoryThemeInput): Promise<string> {
  const activeAssertions = input.assertions
    .filter((assertion) => input.theme.assertionIds.includes(assertion.id))
    .filter((assertion) => assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 18);
  if (!activeAssertions.length) throw new Error('当前主题没有可用于整理的有效认知。');
  if (!hasTextGenerationConfig(input.settings, input.modelOverride)) {
    throw new Error('没有可用的总结模型。请先配置角色局部总结模型、全局总结模型或 API 默认模型。');
  }
  const evidence = activeAssertions
    .map((assertion, index) => `${index + 1}. ${assertion.perspectiveText}（${assertion.kind}；确信度${Math.round(assertion.confidence * 100)}%）`)
    .join('\n');
  const prompt = `你是${input.characterName}的长期记忆整理者。请把“${input.theme.name}”主题下的原子记忆整合成一段可供${input.characterName}自然回忆的主题报告，只输出 JSON：{"report":"..."}。
要求：
1. 全文使用${input.characterName}第一人称，像我对这件事的当前理解，不要写成数据库摘要。
2. 必须只依据证据，概括稳定模式、最近变化、矛盾或仍未完成的事；不要把推测写成事实。
3. 120-320 字，避免逐条复述；这段报告会替代多条重复断言进入 prompt。

主题：${input.theme.name}
证据：
${evidence}`;
  const response = await requestTextGeneration(input.settings, prompt, input.modelOverride, {
    temperature: 0.15,
    maxTokens: 500,
    jsonMode: true,
  });
  const parsed = parseJsonObject(response);
  const report = cleanText(parsed.report, 700);
  if (!report) throw new Error('主题记忆整理结果缺少 report 字段。');
  return report;
}

function buildMemoryDiaryPrompt(input: ExtractTemporalMemoryInput): string {
  const messageRows = input.messages
    .map((message) => JSON.stringify({
      sender: message.sender === 'user' ? input.userName : message.sender === 'char' ? input.characterName : '系统',
      sentAt: new Date(message.createdAt).toISOString(),
      content: renderMessageContent(message),
    }))
    .join('\n');
  return `请以${input.characterName}的第一人称写一篇私人日记，只输出一个小型 JSON 对象，不要提取知识图谱。

写作要求：
1. 只写下方对话里实际发生、${input.characterName}亲历或得知的内容，不补写未发生的事件。
2. 保留事件顺序、${input.characterName}真正会注意的细节、感受、关系变化和未完成的牵挂；事件简单时宁短勿水，正文约 180-500 字。
3. 口吻严格服从角色设定，使用${input.characterName}会使用的词汇、句子节奏和情绪强度；禁止套用通用抒情模板或机械使用“今天，我……”开头。
4. narrative 必须以完整自然句收束。只输出以下 7 个字段，输出 narrative 后不要扩展分析，立即完成其余短字段并闭合 JSON。

JSON 结构：
{
  "title":"简短经历标题",
  "narrative":"完整的第一人称日记正文",
  "location":"地点或空字符串",
  "emotion":"主要情绪或空字符串",
  "valence":-1到1,
  "arousal":0到1,
  "salience":0到1
}

角色设定与写作基准：
${input.characterContext?.trim() || '未提供额外角色设定；保持克制，只依据本轮实际措辞确定口吻。'}

本轮可用世界书背景：
${input.worldBookContext?.trim() || '无启用且匹配的世界书条目。'}

本轮对话：
${messageRows || '无'}

现在只输出日记 JSON。`;
}

function buildMemoryGraphPrompt(input: ExtractTemporalMemoryInput): string {
  const messageRows = input.messages
    .map((message) => JSON.stringify({
      id: message.id,
      sender: message.sender === 'user' ? input.userName : message.sender === 'char' ? input.characterName : '系统',
      sentAt: new Date(message.createdAt).toISOString(),
      content: renderMessageContent(message),
    }))
    .join('\n');
  const assertionRows = (input.currentAssertions ?? [])
    .filter((assertion) => assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed')
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 60)
    .map((assertion) => JSON.stringify({
      id: assertion.id,
      kind: assertion.kind,
      status: assertion.status,
      text: assertion.perspectiveText,
      confidence: assertion.confidence,
      validFrom: assertion.validFrom,
    }))
    .join('\n');

  return `你是${input.characterName}的“主观记忆编码器”，不是故事续写者，也不是全知数据库。请将本轮对话编码成时序知识图谱，只输出一个 JSON 对象。

图谱规则：
1. perspectiveText 与状态 summary 必须使用${input.characterName}的第一人称视角（我）。
2. 只记录本轮消息有直接证据的信息。角色不知道的事不能记录；推断必须标为 inferred 并降低 confidence。
3. 区分 told（用户告知）、observed（角色亲历/观察）、inferred（角色推断）、hearsay（转述）、canon（明确设定）。
4. 不记录寒暄、措辞细节和无长期价值内容。优先记录偏好、边界、承诺、冲突、重要事件、关系变化、未完成事项。
5. 单条 assertion 只表达一个原子含义，同一条可属于多个 themes。
6. evidenceMessageIds 只能使用下方给出的消息 id。没有证据就不要输出断言。
7. 新信息明确替代旧认知时，把旧 id 放入 supersedesAssertionIds；信息互相冲突但无法判断时放入 contradictsAssertionIds。不要因为对象不同就擅自覆盖可并存的喜好。
8. adaptive-personality 只描述${input.characterName}在反复经历后形成的缓慢适应，不能修改核心人设。relationship/user-impression 也只输出小幅 delta；一次普通对话不得人格突变。
9. 角色设定与世界书只用于身份关系和角色已知背景，不能替代消息证据。
10. 只输出图谱字段，不要输出 title、narrative、location、emotion、valence、arousal 或 salience。
11. entities 最多 8 条、assertions 最多 10 条、themes 最多 5 条、stateDeltas 最多 3 条；没有内容时输出空数组，不得省略字段。

JSON 结构：
{
  "entities": [{"key":"本次唯一键","name":"名称","type":"character|user|person|place|object|organization|event|concept","aliases":[],"description":""}],
  "assertions": [{
    "subjectKey":"self|user|实体key",
    "predicate":"短谓词",
    "objectKey":"可选实体key",
    "objectText":"对象文本",
    "kind":"fact|preference|promise|conflict|relationship|impression|growth|emotion|open-loop|interpretation|boundary",
    "epistemicKind":"told|observed|inferred|hearsay|canon",
    "perspectiveText":"我的第一人称记忆句",
    "confidence":0到1,
    "importance":0到1,
    "emotionalWeight":0到1,
    "relationshipImpact":-1到1,
    "evidenceMessageIds":["消息id"],
    "themes":["主题名"],
    "supersedesAssertionIds":["旧断言id"],
    "contradictsAssertionIds":["旧断言id"],
    "validFrom":毫秒时间戳或省略,
    "validTo":毫秒时间戳或省略,
    "dueAt":毫秒时间戳或省略
  }],
  "themes":["主题名"],
  "stateDeltas":[{
    "kind":"relationship|user-impression|adaptive-personality|mood|current-context",
    "summary":"我的第一人称状态概括",
    "confidence":0到1,
    "facets":[{"key":"稳定英文或中文键","label":"显示名","delta":-1到1}]
  }]
}

角色设定与写作基准：
${input.characterContext?.trim() || '未提供额外角色设定；保持克制，只依据本轮实际措辞推断口吻。'}

本轮可用世界书背景：
${input.worldBookContext?.trim() || '无启用且匹配的世界书条目。'}

当前已有认知（可能为空；只能引用这里出现的旧断言 id）：
${assertionRows || '无'}

本轮带证据消息（每行一个 JSON）：
${messageRows || '无'}

现在仅输出 JSON。`;
}

function renderMessageContent(message: ChatMessage): string {
  const parts = [String(message.content ?? '').trim()];
  if (message.sticker) parts.push(`[表情：${message.sticker.description}]`);
  if (message.image) parts.push(`[图片：${message.image.description}]`);
  if (message.voice) parts.push(`[语音：${message.voice.transcript}]`);
  if (message.location) parts.push(`[位置：${message.location.name || message.location.address || ''}]`);
  if (message.transfer) parts.push(`[转账：${message.transfer.amount} ${message.transfer.note || ''}]`);
  if (message.commerce) parts.push(`[共同事件：${message.commerce.storeName} ${message.commerce.items.map((item) => item.name).join('、')}]`);
  if (message.musicListenInvite) parts.push(`[一起听：${message.musicListenInvite.track?.name || message.musicListenInvite.note || ''}]`);
  if (message.theaterLink) parts.push(`[分享内容：${message.theaterLink.title} ${message.theaterLink.summary}]`);
  if (message.offlineInvitation) parts.push(`[线下情景：${message.offlineInvitation.prompt || message.offlineInvitation.status || ''}]`);
  if (message.call) parts.push(`[通话：${message.call.status || ''}]`);
  if (message.gobang) parts.push(`[五子棋：${message.gobang.status || ''}]`);
  return parts.filter(Boolean).join(' ').slice(0, 2_000);
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  const candidate = start >= 0 ? text.slice(start, end > start ? end + 1 : undefined) : text;
  for (const source of [candidate, text]) {
    if (!source) continue;
    try {
      const value = JSON.parse(source) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {}
    try {
      const value = JSON.parse(jsonrepair(source)) as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {}
  }
  throw new Error('记忆抽取结果不是有效 JSON 对象。');
}

export function parseTemporalMemoryExtractionResponse(raw: string): MemoryExtractionResult {
  const completeJson = extractCompleteJsonObject(raw);
  const parsed = parseJsonObject(completeJson || raw);
  const originalNarrative = cleanText(parsed.narrative ?? parsed.memory ?? parsed.summary ?? parsed.content, 900);
  if (!originalNarrative) throw new Error('记忆模型没有返回日记正文。');
  const result = normalizeExtractionResult(parsed);
  if (isIncompleteDiaryNarrative(result.narrative)) {
    throw new Error('记忆模型返回的日记正文不完整。');
  }
  return result;
}

function pickTemporalMemoryDiary(result: MemoryExtractionResult): TemporalMemoryDiaryResult {
  return {
    title: result.title,
    narrative: result.narrative,
    location: result.location,
    emotion: result.emotion,
    valence: result.valence,
    arousal: result.arousal,
    salience: result.salience,
  };
}

function extractCompleteJsonObject(raw: string): string {
  const text = String(raw ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  if (start < 0) return '';
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return '';
}

function isIncompleteDiaryNarrative(value: string): boolean {
  const narrative = String(value ?? '').trim();
  if (narrative.length < 32) return true;
  return !/[。！？!?…」』”’）】》]$/u.test(narrative);
}

function normalizeExtractionResult(raw: Record<string, unknown>): MemoryExtractionResult {
  const graph = normalizeMemoryGraphResult(raw);
  const narrative = cleanText(raw.narrative ?? raw.memory ?? raw.summary ?? raw.content, 900)
    || '我记得我们最近有过一段值得留下的交流。';
  const title = cleanText(raw.title ?? raw.memoryTitle, 80)
    || cleanText(narrative, 28)
    || '最近的一段相处';
  return {
    title,
    narrative,
    location: cleanText(raw.location, 80),
    emotion: cleanText(raw.emotion, 80),
    valence: boundedNumber(raw.valence, -1, 1, 0),
    arousal: boundedNumber(raw.arousal, 0, 1, 0.25),
    salience: boundedNumber(raw.salience, 0, 1, 0.45),
    ...graph,
  };
}

function normalizeMemoryGraphResult(raw: Record<string, unknown>): TemporalMemoryGraphResult {
  const rawEntities = flexibleRecordArray(raw.entities ?? raw.entityList ?? raw.entity, ['key', 'name', 'type'], 'key').slice(0, 30);
  const rawAssertions = flexibleRecordArray(raw.assertions ?? raw.memories ?? raw.memoryItems, ['subjectKey', 'predicate', 'perspectiveText']).slice(0, 40);
  const rawStateDeltas = flexibleRecordArray(raw.stateDeltas ?? raw.stateDelta ?? raw.states, ['kind', 'summary']).slice(0, 10);
  const entities = rawEntities.flatMap(normalizeEntityDraft);
  const assertions = rawAssertions.flatMap(normalizeAssertionDraft);
  const stateDeltas = rawStateDeltas.flatMap(normalizeStateDelta);
  return {
    entities,
    assertions,
    themes: unique(flexibleStringArray(raw.themes ?? raw.theme).map((item) => cleanText(item, 60)).filter(Boolean)).slice(0, 12),
    stateDeltas,
  };
}


function normalizeEntityDraft(raw: Record<string, unknown>): MemoryExtractionEntityDraft[] {
  const key = cleanText(raw.key, 60);
  const name = cleanText(raw.name, 80);
  const type = cleanText(raw.type, 30) as MemoryEntityType;
  if (!key || !name || !entityTypes.has(type)) return [];
  return [{
    key,
    name,
    type,
    aliases: unique(stringArray(raw.aliases).map((item) => cleanText(item, 80)).filter(Boolean)).slice(0, 12),
    description: cleanText(raw.description, 400),
  }];
}

function normalizeAssertionDraft(raw: Record<string, unknown>): MemoryExtractionAssertionDraft[] {
  const subjectKey = cleanText(raw.subjectKey, 60);
  const predicate = cleanText(raw.predicate, 80);
  const objectText = cleanText(raw.objectText, 240);
  const perspectiveText = cleanText(raw.perspectiveText, 520);
  const kind = cleanText(raw.kind, 30) as MemoryAssertionKind;
  const epistemicKind = cleanText(raw.epistemicKind, 30) as MemoryEpistemicKind;
  const evidenceMessageIds = unique(stringArray(raw.evidenceMessageIds).map((item) => cleanText(item, 120)).filter(Boolean)).slice(0, 20);
  if (!subjectKey || !predicate || !objectText || !perspectiveText || !evidenceMessageIds.length || !assertionKinds.has(kind) || !epistemicKinds.has(epistemicKind)) return [];
  return [{
    subjectKey,
    predicate,
    objectKey: cleanText(raw.objectKey, 60) || undefined,
    objectText,
    kind,
    epistemicKind,
    perspectiveText,
    confidence: clamp(raw.confidence, 0, 1),
    importance: clamp(raw.importance, 0, 1),
    emotionalWeight: clamp(raw.emotionalWeight, 0, 1),
    relationshipImpact: clamp(raw.relationshipImpact, -1, 1),
    evidenceMessageIds,
    themes: unique(stringArray(raw.themes).map((item) => cleanText(item, 60)).filter(Boolean)).slice(0, 10),
    supersedesAssertionIds: unique(stringArray(raw.supersedesAssertionIds).map((item) => cleanText(item, 140)).filter(Boolean)).slice(0, 20),
    contradictsAssertionIds: unique(stringArray(raw.contradictsAssertionIds).map((item) => cleanText(item, 140)).filter(Boolean)).slice(0, 20),
    validFrom: positiveTime(raw.validFrom),
    validTo: positiveTime(raw.validTo),
    dueAt: positiveTime(raw.dueAt),
  }];
}

function normalizeStateDelta(raw: Record<string, unknown>): MemoryExtractionStateDelta[] {
  const kind = cleanText(raw.kind, 40) as MemoryStateKind;
  const summary = cleanText(raw.summary, 240);
  if (!stateKinds.has(kind) || !summary) return [];
  const facets = arrayOfRecords(raw.facets).slice(0, 16).flatMap((facet) => {
    const key = cleanText(facet.key, 60);
    const label = cleanText(facet.label, 60) || key;
    if (!key) return [];
    return [{ key, label, delta: clamp(facet.delta, -1, 1) }];
  });
  return [{ kind, summary, confidence: clamp(raw.confidence, 0, 1), facets }];
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function decodeNestedJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text.startsWith('[') && !text.startsWith('{')) return value;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    try {
      return JSON.parse(jsonrepair(text)) as unknown;
    } catch {
      return value;
    }
  }
}

function flexibleRecordArray(value: unknown, entryKeys: string[], mapKeyField = ''): Record<string, unknown>[] {
  const decoded = decodeNestedJson(value);
  if (Array.isArray(decoded)) return arrayOfRecords(decoded);
  if (!decoded || typeof decoded !== 'object') return [];
  const record = decoded as Record<string, unknown>;
  if (entryKeys.some((key) => key in record)) return [record];
  return Object.entries(record).flatMap(([key, item]) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const entry = item as Record<string, unknown>;
    return [{ ...entry, ...(mapKeyField && !(mapKeyField in entry) ? { [mapKeyField]: key } : {}) }];
  });
}

function flexibleStringArray(value: unknown): string[] {
  const decoded = decodeNestedJson(value);
  if (Array.isArray(decoded)) {
    return decoded.flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const record = item as Record<string, unknown>;
        const label = String(record.name ?? record.label ?? record.title ?? '').trim();
        return label ? [label] : [];
      }
      return [];
    });
  }
  if (typeof decoded === 'string') return decoded.split(/[,，、;；|\n]+/).map((item) => item.trim()).filter(Boolean);
  if (decoded && typeof decoded === 'object') return Object.keys(decoded as Record<string, unknown>);
  return [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function positiveTime(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function clamp(value: unknown, minimum: number, maximum: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
