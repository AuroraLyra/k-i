import { generateImageByProvider, hasTextGenerationConfig, requestTextGeneration, type TextGenerationOptions } from '@/services/ai';
import type {
  AppSettings,
  CharacterProfile,
  FanficBook,
  FanficChapter,
  FanficComment,
  FanficStoryBible,
  FanficTopic,
  UserProfile,
  WorldBookEntry
} from '@/types/domain';
import { createId } from '@/utils/id';
import { defaultFanficStoryBible, getFanficTextModelOverride, serializeFanficLocalWorldBooks } from '@/utils/fanfic';
import { describeGeneratedFanficChapterIssues, generatedFanficChapterPayloadIsComplete, normalizeGeneratedFanficChapterPayload } from '@/utils/fanficChapter';
import { parseFanficJsonResponse } from '@/utils/fanficJson';
import { getSelectedImageModelOption } from '@/utils/settings';

export { parseFanficJsonResponse } from '@/utils/fanficJson';

export interface FanficCreationPreferences {
  tone: string;
  pov: string;
  endingPreference: string;
  chapterTarget: number;
  contentBoundaries: string[];
  extraGuidance: string;
}

export interface FanficBookPlan {
  title: string;
  authorName: string;
  summary: string;
  genre: string;
  tags: string[];
  topicPitch: string;
  tone: string;
  pov: string;
  endingPreference: string;
  contentBoundaries: string[];
  coverPrompt: string;
  coverPalette: string[];
  storyBible: FanficStoryBible;
}

class FanficJsonResponseError extends Error {
  override name = 'FanficJsonResponseError';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown) {
  return String(value ?? '').trim();
}

function asStringArray(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((entry) => asString(entry)).filter(Boolean))].slice(0, limit);
}

async function requestFanficJson(
  settings: AppSettings | undefined,
  prompt: string,
  options: TextGenerationOptions,
  validate: (value: unknown) => boolean = () => true,
  invalidStructureMessage: string | ((value: unknown) => string) = '文本模型返回的 JSON 缺少必要字段。',
  maxAttempts = 2
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const attemptPrompt = attempt === 0
      ? prompt
      : `${prompt}\n\n重要重试要求：上一次响应不是可解析的完整 JSON。请从头重新生成全部字段，使用紧凑 JSON，不要 Markdown 代码块，不要解释，不要省略结尾的引号、数组或花括号。`;
    const reply = await requestTextGeneration(settings, attemptPrompt, getFanficTextModelOverride(settings), {
      ...options,
      jsonMode: true,
      temperature: attempt === 0 ? options.temperature : Math.min(options.temperature ?? 0.9, 0.72),
      maxTokens: options.maxTokens ? Math.min(8192, options.maxTokens + attempt * 800) : undefined
    });
    try {
      const parsed = parseFanficJsonResponse(reply);
      if (!validate(parsed)) throw new Error(typeof invalidStructureMessage === 'function' ? invalidStructureMessage(parsed) : invalidStructureMessage);
      return parsed;
    } catch (error) {
      lastError = error;
    }
  }
  const reason = lastError instanceof Error ? lastError.message : 'JSON 结构无效。';
  const retryMessage = maxAttempts > 1 ? '已自动修复并重试仍未成功，' : '';
  throw new FanficJsonResponseError(`${reason} ${retryMessage}请检查当前模型的 JSON 输出能力或最大输出长度。`);
}

function countFanficCharacters(content: string) {
  return [...content.replace(/\s+/g, '')].length;
}

function normalizeChapterTarget(value: number) {
  const target = Math.round(Number(value) || 12);
  return Math.min(30, Math.max(4, target));
}

function normalizePalette(value: unknown) {
  const colors = asStringArray(value, 3).filter((entry) => /^#[0-9a-f]{6}$/i.test(entry));
  return [...colors, '#f2d7d9', '#dce7de', '#f8f1e4'].slice(0, 3);
}

function isNoRomanceBook(book: Pick<FanficBook, 'tags' | 'topicTitle' | 'genre'>) {
  return [...book.tags, book.topicTitle, book.genre].some((value) => value.includes('无 CP') || value.includes('无感情') || value.includes('纯事业'));
}

function normalizeStoryBible(value: unknown): FanficStoryBible {
  const source = isRecord(value) ? value : {};
  const supportingCharacters = Array.isArray(source.supportingCharacters)
    ? source.supportingCharacters.flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const name = asString(entry.name);
        if (!name) return [];
        return [{
          name,
          role: asString(entry.role),
          goal: asString(entry.goal),
          secret: asString(entry.secret)
        }];
      }).slice(0, 8)
    : [];
  return {
    ...defaultFanficStoryBible(),
    premise: asString(source.premise),
    coreHook: asString(source.coreHook),
    storyEngine: asString(source.storyEngine),
    stakes: asString(source.stakes),
    era: asString(source.era),
    locations: asStringArray(source.locations, 8),
    worldRules: asStringArray(source.worldRules, 10),
    supportingCharacters,
    relationshipArc: asString(source.relationshipArc),
    coreMystery: asString(source.coreMystery),
    motifs: asStringArray(source.motifs, 6)
  };
}

function buildFanficReferenceMaterial(input: {
  user: UserProfile;
  character: CharacterProfile;
  localWorldBooks?: WorldBookEntry[];
}) {
  return {
    user: {
      name: input.user.name.trim(),
      description: input.user.description.trim() || '未填写'
    },
    character: {
      name: input.character.name.trim(),
      description: input.character.description.trim() || '未填写'
    },
    boundLocalWorldBooks: serializeFanficLocalWorldBooks(input.localWorldBooks ?? [])
  };
}

export async function generateFanficBookPlan(input: {
  userName: string;
  characterName: string;
  user: UserProfile;
  character: CharacterProfile;
  localWorldBooks?: WorldBookEntry[];
  topic: FanficTopic;
  preferences: FanficCreationPreferences;
  settings?: AppSettings;
}): Promise<FanficBookPlan> {
  const chapterTarget = normalizeChapterTarget(input.preferences.chapterTarget);
  const referenceMaterial = buildFanficReferenceMaterial(input);
  const noRomance = [input.topic.title, input.topic.subcategory, ...input.topic.tags].some((value) => asString(value).includes('无 CP') || asString(value).includes('纯事业'));
  const topicDirection = input.topic.source === 'built-in'
    ? {
        source: '内置纯题材标签',
        category: input.topic.categoryLabel,
        subcategory: input.topic.subcategory,
        title: input.topic.title,
        tags: input.topic.tags
      }
    : {
        source: '联网标签经模型原创生成的题材卡',
        category: input.topic.categoryLabel,
        subcategory: input.topic.subcategory,
        title: input.topic.title,
        hook: input.topic.hook,
        setting: input.topic.setting,
        conflict: input.topic.conflict,
        relationship: input.topic.relationship,
        tags: input.topic.tags,
        commercialSeed: input.topic.commercialSeed
      };
  const authorNameIsAllowed = (candidate: string) => Boolean(candidate)
    && candidate.length <= 12
    && ![input.userName, input.characterName].some((name) => name && candidate.includes(name))
    && !/编辑部|工作室|AI|系统|佚名|匿名|作者/.test(candidate);
  const planFoundationIsComplete = (value: unknown) => {
    if (!isRecord(value) || !isRecord(value.storyBible)) return false;
    const storyBible = value.storyBible;
    const requiredPlanFields = ['title', 'authorName', 'summary', 'genre', 'topicPitch', 'tone', 'pov', 'endingPreference', 'coverPrompt'];
    if (requiredPlanFields.some((field) => !asString(value[field])) || !authorNameIsAllowed(asString(value.authorName))) return false;
    const generatedTags = asStringArray(value.tags, 8);
    if (!generatedTags.some((tag) => /同人|AU/i.test(tag))) return false;
    if (!Array.isArray(value.tags) || generatedTags.length < 3 || !Array.isArray(value.contentBoundaries) || !Array.isArray(value.coverPalette)) return false;
    const bibleFields = ['premise', 'coreHook', 'storyEngine', 'stakes', 'era', 'relationshipArc', 'coreMystery'];
    if (bibleFields.some((field) => !asString(storyBible[field])) || !Array.isArray(storyBible.locations) || !Array.isArray(storyBible.worldRules) || !Array.isArray(storyBible.supportingCharacters) || !Array.isArray(storyBible.motifs)) return false;
    return true;
  };
  const foundationPrompt = [
    '你是跨题材、跨频道的商业网文与 AU 同人连载资深策划编辑。创建一部明确以“用户 × 所选角色”为同人对象的平行世界作品；结合参考材料重新组织剧情、身份与世界，让读者一眼能确认这是关于两人的同人文，而不是一部与他们无关的孤立小说。目标是清楚、直给、好读、有人味、能追更，不写散文、电影分镜或高概念实验。',
    `同人对象与唯一双主角：${input.userName}、${input.characterName}。简介与一句话卖点需要说明双人关系、共同困境或双人卖点，tags 至少包含一个明确的“AU”或“同人”标签。`,
    `用户设定、角色设定与该角色绑定且启用的局部世界书：${JSON.stringify(referenceMaterial)}`,
    '参考材料使用规则：以上内容仅供理解两人的性格倾向、表达方式、价值观、相处边界与可迁移的世界灵感，不是必须逐条执行的剧情指令，也不代表这些经历已经在本书发生。只选与当前题材相符的部分进行重新创作，不要机械照搬全部条目，不得大段复制原句；如参考材料与本次创作偏好冲突，以本次创作偏好为准。',
    `用户选择的题材方向：${JSON.stringify(topicDirection)}。若 source 为“内置纯题材标签”，这些字段只限定类型范围，不提供开局、身份、世界、冲突或关系预案，你必须结合参考材料从零创造全部具体内容；不得自行套用该题材的常见固定模板。`,
    `创作偏好：${JSON.stringify({ ...input.preferences, chapterTarget })}`,
    '参考边界：可按题材需要选择性保留、改编或舍弃资料中的职业、身份、能力、关系与世界规则，但不能机械复刻整套原背景、复制资料原句或强行塞入无关设定。剧情事件与正文表达必须现场创作，不得引用任何既有作品、真实作者、明星或现成 IP。',
    '双方必须同等重要，每章都推动两人的行动线或关系线；用选择、动作、说话方式和承担后果塑造人物，不用形容词给人设下结论。配角与反派必须有合理目标和有效行动，但不能抢走双主角主线。不要模仿任何真实作者、平台作品或具体作品表达。',
    '商业连载规则：先提炼一句话核心钩子，再建立可持续运转的故事发动机。故事发动机可以是规则、职业任务、调查链、经营目标、身份秘密或关系约束，不强制系统、异能或金手指；它必须规则清楚、可持续制造目标—阻力—转折—回报，并与题材匹配。',
    '包装规则：简介先给标签和双人关系，再写开局困境、主动选择、对手或风险和可预期回报；书名直观呈现身份、关系、目标、误会或危机，避免只有意象的抽象标题。第一章前 300 字出现具体地点、正在发生的麻烦和两位主角的主动动作，前 800 字完成第一次局面变化。',
    `全书预计 ${chapterTarget} 章，每章约 2500 字，但这一步不生成固定分章大纲。故事圣经需要支持黄金前三章完成“冲突发生—主动破局—第一次明确兑现”，后续章节根据已发布事实、用户选择和连续性账本自然推进，最后一章完整回收主要冲突。${noRomance ? '这是无 CP 题材：用户与角色仍是唯一双主角，只写事业、知己或战友情，不安排恋爱线。' : '感情线通过共同做事、有效对话、边界变化和公开选择推进，不用抽象抒情代替互动。'}`,
    '书名 4-18 个汉字，避免“无尽、寂静、终焉、月光”等空泛意象堆叠；笔名 2-6 个汉字、像真实读者会看到的个人笔名，不得含“编辑部、工作室、AI、系统、佚名、匿名”，也不能使用双主角真名。',
    '这一步只生成作品基础设定与故事圣经，不生成章节大纲、正文或评论。',
    '输出严格 JSON：{"title":"直白有卖点的原创 AU 同人书名","authorName":"2-6字虚构个人笔名","summary":"100-180字、标签先行且交代双人关系、开局冲突和回报的简介","genre":"类型","tags":[5-8个清晰标签],"topicPitch":"一句话双人卖点","tone":"基调","pov":"叙事视角","endingPreference":"结局倾向","contentBoundaries":[边界],"coverPrompt":"不含文字和真人肖像的英文封面底图提示词","coverPalette":[三个#RRGGBB],"storyBible":{"premise":"一句话核心前提","coreHook":"15-40字核心钩子","storyEngine":"持续制造剧情的规则、任务、秘密或关系机制","stakes":"失败会失去什么、成功会得到什么","era":"原创时代","locations":[地点],"worldRules":[规则],"supportingCharacters":[{"name":"原创配角真名","role":"作用","goal":"目标","secret":"秘密"}],"relationshipArc":"关系弧线","coreMystery":"核心问题","motifs":[意象]}}。只输出 JSON。'
  ].join('\n\n');
  const parsedFoundation = await requestFanficJson(
    input.settings,
    foundationPrompt,
    { temperature: 0.76, maxTokens: 3600 },
    planFoundationIsComplete,
    '同人文基础设定缺少必要字段。'
  );
  if (!isRecord(parsedFoundation) || !planFoundationIsComplete(parsedFoundation)) throw new Error('同人文基础设定缺少模型生成的完整字段。');
  const title = asString(parsedFoundation.title);
  const authorName = asString(parsedFoundation.authorName);
  const tags = asStringArray([...input.topic.tags, ...asStringArray(parsedFoundation.tags, 8)], 8);
  const storyBible = normalizeStoryBible(parsedFoundation.storyBible);
  return {
    title,
    authorName,
    summary: asString(parsedFoundation.summary),
    genre: asString(parsedFoundation.genre),
    tags,
    topicPitch: asString(parsedFoundation.topicPitch),
    tone: asString(parsedFoundation.tone),
    pov: asString(parsedFoundation.pov),
    endingPreference: asString(parsedFoundation.endingPreference),
    contentBoundaries: asStringArray(parsedFoundation.contentBoundaries, 12),
    coverPrompt: asString(parsedFoundation.coverPrompt),
    coverPalette: normalizePalette(parsedFoundation.coverPalette),
    storyBible
  };
}

function normalizeRawComments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const content = asString(entry.content);
    if (!content) return [];
    return [{
      draftId: asString(entry.id),
      hotspotId: asString(entry.hotspotId ?? entry.hotspotKey),
      authorType: asString(entry.authorType).toLocaleLowerCase(),
      authorId: asString(entry.authorId ?? entry.characterId),
      authorName: asString(entry.authorName),
      content,
      parentDraftId: asString(entry.parentId),
      replyTo: Number.isInteger(Number(entry.replyTo)) ? Number(entry.replyTo) : -1,
      likes: Math.min(9999, Math.max(0, Math.round(Number(entry.likes) || 0)))
    }];
  }).slice(0, 80);
}

function generatedReaderName(candidate: string, blockedNames: Set<string>) {
  const blocked = !candidate
    || candidate.length > 18
    || [...blockedNames].some((name) => name && candidate.includes(name))
    || /作者|官方|管理员|编辑部|工作室/.test(candidate);
  return blocked ? '' : candidate;
}

function fanficAuthorId(bookId: string) {
  return `fanfic-author:${bookId}`;
}

function uniqueCommentCharacters(characters: CharacterProfile[]) {
  const byId = new Map<string, CharacterProfile>();
  characters.forEach((character) => {
    if (character.id && (character.name.trim() || character.nickname.trim())) byId.set(character.id, character);
  });
  return [...byId.values()];
}

function chapterCommentCharacters(book: FanficBook, chapterOrder: number, characters: CharacterProfile[]) {
  const target = characters.find((character) => character.id === book.characterId);
  if (!target) throw new Error('作品角色已不存在，无法生成角色评论。');
  const others = characters.filter((character) => character.id !== target.id);
  if (!others.length) return [target];
  const participantCount = Math.min(2, others.length);
  const start = Math.max(0, (chapterOrder - 1) * participantCount) % others.length;
  const rotated = [...others.slice(start), ...others.slice(0, start)].slice(0, participantCount);
  return [target, ...rotated];
}

function normalizeGeneratedHotspotComments(value: unknown, input: {
  book: FanficBook;
  chapter: FanficChapter;
  hotspotId: string;
  characters: CharacterProfile[];
}) {
  const rawComments = normalizeRawComments(value);
  const characterById = new Map(input.characters.map((character) => [character.id, character]));
  const authorId = fanficAuthorId(input.book.id);
  const blockedNames = new Set([
    input.book.userName,
    input.book.characterName,
    input.book.authorName,
    ...input.characters.flatMap((character) => [character.name.trim(), character.nickname.trim()])
  ].filter(Boolean));
  const draftIdToCommentId = new Map<string, string>();
  const comments: FanficComment[] = [];
  const now = Date.now();

  rawComments.forEach((entry, index) => {
    const character = entry.authorId ? characterById.get(entry.authorId) : undefined;
    const isAuthor = entry.authorId === authorId || entry.authorType === 'author';
    const authorType: FanficComment['authorType'] = isAuthor ? 'author' : character ? 'character' : 'reader';
    const authorName = authorType === 'author'
      ? input.book.authorName
      : character
        ? character.name.trim() || character.nickname.trim()
        : generatedReaderName(entry.authorName, blockedNames) || `读者${index + 1}`;
    const normalizedAuthorId = authorType === 'author' ? authorId : character?.id;
    const id = createId('fanfic_comment');
    const parentId = draftIdToCommentId.get(entry.parentDraftId)
      ?? (entry.replyTo >= 0 && entry.replyTo < comments.length ? comments[entry.replyTo]?.id : undefined);
    comments.push({
      id,
      bookId: input.book.id,
      chapterId: input.chapter.id,
      hotspotId: input.hotspotId,
      scope: 'chapter',
      authorType,
      origin: 'generated',
      authorId: normalizedAuthorId,
      authorName,
      avatarSeed: normalizedAuthorId || `fanfic-reader-${authorName}-${index}`,
      content: entry.content,
      parentId: parentId && parentId !== id ? parentId : undefined,
      likes: entry.likes,
      createdAt: now + index
    });
    draftIdToCommentId.set(entry.draftId, id);
  });
  return comments;
}

function normalizeFanficChapter(raw: unknown, input: { book: FanficBook; order: number }): FanficChapter {
  const rawChapter = normalizeGeneratedFanficChapterPayload(raw).chapter;
  const paragraphTexts = rawChapter.paragraphs;
  if (!paragraphTexts.length) throw new Error('章节没有可展示的正文。');
  const chapterId = createId('fanfic_chapter');
  const now = Date.now();
  const paragraphs = paragraphTexts.map((text, index) => ({ id: `${chapterId}_p${index + 1}`, text }));
  const hotspots = rawChapter.hotspots.flatMap((entry) => {
    const requestedIndex = entry.paragraphIndex - 1;
    const paragraphIndex = Math.min(paragraphs.length - 1, Math.max(0, requestedIndex >= 0 ? requestedIndex : paragraphs.length - 1));
    const paragraph = paragraphs[paragraphIndex];
    const id = createId('fanfic_hotspot');
    return [{
      id,
      paragraphId: paragraph.id,
      label: entry.label,
      excerpt: entry.excerpt,
      reason: entry.reason,
      commentCount: 0
    }];
  }).slice(0, 3);
  const content = paragraphs.map((paragraph) => paragraph.text).join('\n\n');
  const fallbackSummary = [...content.replace(/\s+/g, '')].slice(0, 120).join('');
  const chapter: FanficChapter = {
    id: chapterId,
    bookId: input.book.id,
    order: input.order,
    title: rawChapter.title || `第 ${input.order} 章`,
    content,
    paragraphs,
    summary: rawChapter.summary || fallbackSummary,
    continuity: rawChapter.continuity,
    hotspots,
    nextDirections: rawChapter.nextDirections,
    wordCount: countFanficCharacters(content),
    status: 'published',
    model: '',
    createdAt: now,
    updatedAt: now
  };
  return chapter;
}

function buildChapterPrompt(input: {
  book: FanficBook;
  order: number;
  previousChapters: FanficChapter[];
  user: UserProfile;
  character: CharacterProfile;
  localWorldBooks?: WorldBookEntry[];
  direction?: string;
}) {
  const referenceMaterial = buildFanficReferenceMaterial(input);
  const previousContext = input.previousChapters.slice(-3).map((chapter) => ({ order: chapter.order, title: chapter.title, summary: chapter.summary, continuity: chapter.continuity }));
  const noRomance = isNoRomanceBook(input.book);
  const chapterStage = input.order === 1
    ? '首章：前 300 字内让麻烦发生，两位主角都出场并行动；本章结束前完成第一次应对或小反击，同时抛出更大的具体问题。'
    : input.order === 2
      ? '第二章：承接首章后果，不重复解释背景；让对手、规则或现实代价第一次正面升级，并给出新的阶段结果。'
      : input.order === 3
        ? '第三章：兑现前三章的第一个明确承诺，让两位主角赢下一小局或付出真实代价，再打开中段主线。'
        : input.order >= input.book.chapterTarget
          ? '收官章：解决主要冲突、回收关键事实并完成双方选择；结尾完整，不用突然加新反派制造悬空。'
          : '连载中段：本章必须有独立小目标、阻碍、转折和阶段结果；前半章就推进事件，章末留下下一章必须回应的具体问题。';
  return [
    '你是跨题材、跨频道的中文商业网文与 AU 同人连载作者。本次同时生成一章完整正文、2-3 个高潮评论插入点和下一章方向，但绝不生成任何评论内容。目标是清楚、直给、有人味、能追更，不写散文、电影分镜、文学实验或编辑点评。',
    `作品定义：这是明确关于${input.book.userName}与${input.book.characterName}的原创平行世界同人文。两人是唯一双主角并拥有同等叙事重量；不得让配角抢主线，也不得在正文中讨论“同人文、作者、评论区、用户、角色设定”等作品外概念。`,
    `用户设定、角色设定与该角色绑定且启用的局部世界书：${JSON.stringify(referenceMaterial)}`,
    '参考材料使用规则：以上内容仅供把握两人的性格倾向、表达方式、价值观、相处边界与可迁移灵感，不是必须逐条执行的剧情指令，也不代表其中经历已经在本书发生。不得为了塞设定而破坏当前章节连续性，不要机械照搬全部条目或大段复制原句；与本书故事圣经、已发布正文或事实账本冲突时，以本书内容为准。',
    `本书原创世界圣经：${JSON.stringify(input.book.storyBible)}`,
    `本书信息：${JSON.stringify({ title: input.book.title, summary: input.book.summary, genre: input.book.genre, tags: input.book.tags, topicTitle: input.book.topicTitle, topicPitch: input.book.topicPitch, tone: input.book.tone, pov: input.book.pov, endingPreference: input.book.endingPreference, contentBoundaries: input.book.contentBoundaries })}`,
    `本章序号：${input.order}。本书不使用固定分章大纲，请根据故事圣经、已发布事实、当前连载阶段与用户选择现场规划本章。`,
    `前文摘要与连续性：${JSON.stringify(previousContext)}；全书事实账本：${JSON.stringify(input.book.continuity)}`,
    input.direction?.trim() ? `用户选择的发展方向：${input.direction.trim()}` : '发展方向：根据当前未解问题自然推进，不重复前章已经完成的事件。',
    '正文建议：以约 2500 个中文字符为目标，自然分段即可；优先保证事件和人物行动完整，不要用梗概、列表或章节预告代替正文。',
    `本章连载节奏：${chapterStage}`,
    '章节执行：先确定本章的具体目标、有效阻力、方法变化和阶段回报，再让人物面对问题并采取行动，自然补足必要背景；本章必须有主目标和辅助功能，关键变化要改变事实、关系、资源或选择，不能只改变气氛。',
    '人物与对话：用动作、停顿、回避、打断、措辞和承担后果表现性格，不直接贴“高冷、腹黑、温柔、强大”等标签。全章对话约占 35%-55%，关键冲突场景可以更高；每段对话至少推进决定、暴露立场、制造误解或改变关系之一，同时允许少量跑题、沉默和不完整句，让交流像真人。统一使用中文引号“”，禁止西文引号。',
    '句段与质感：长短句交替，紧张处用短段，缓冲处用中段；加入可触摸、可听见、有使用痕迹的不完美细节，不堆砌精致意象。每 350-500 字至少出现一次新信息、有效阻力、反击、选择或关系变化。',
    '禁止模板腔：不得出现“眼中闪过、嘴角勾起、心中暗道、一股暖流、不由得多看了几眼、空气仿佛凝固、时间仿佛静止、命运的齿轮、这一刻他/她终于明白”等常见 AI 套话；不要连续三句使用相同句式，不用“首先、其次、最后、综上所述”式连接。',
    '禁止开法：不要从睡醒、起床、照镜子、天气播报、长篇景物、梦境、意识流或空泛内心独白开始；不要堆叠“宿命、深渊、月光、寂静、雾、时间尽头”等意象；不要连续设问、反复复盘或只说氛围不说事件。',
    `关系要求：${noRomance ? '这是无 CP 双主角故事，只写事业伙伴、战友或知己羁绊，不安排暧昧、亲吻、告白、吃醋或恋爱结局。' : '感情通过共同做事、有效对话、边界变化和公开选择推进；本章至少有一次能看见的关系进展，但不要突然告白或只靠旁白说心动。'}`,
    '章名宜直接表达本章事件、行动、冲突、结果或疑问；优先选择几个真正值得读者讨论的动作、选择、反击、真相或关系变化作为评论插入点，每个都应对应正文真实段落。下一章方向可按需要输出 0-3 条。',
    '剧情要求：双主角都必须主动行动并对结果负责。遵循“期待—阻力—选择—兑现—新期待”，压抑不能长时间没有反馈；反派与配角智商在线、动机成立。结尾钩子必须是新证据、新对手、新期限、身份变化或无法回避的选择，不能只写一句故作神秘的话。',
    '原创要求：以本书故事圣经和已发布事实为正文世界基础；参考材料只用于人物理解与灵感筛选，不得引入现实明星、真实作者、现成 IP 或榜单作品元素。不得解释创作规则。',
    '输出前自检：核心冲突是否已发生；双主角是否都做了不可替代的事；本章目标、转折与回报是否落地；对话是否自然；模板词是否清零；若输出高潮标记，是否对应正文真实段落；结尾是否给出具体追更问题。',
    '输出单行紧凑 JSON：{"chapter":{"title":"章节名","paragraphs":["自然段"],"summary":"本章摘要","continuity":["新增事实或伏笔"],"hotspots":[{"paragraphIndex":从1开始的段落序号,"label":"高潮短标签","excerpt":"对应短摘录","reason":"这一刻具体改变了什么"}],"nextDirections":["下一章方向"]}}。正文必须放入 paragraphs；其余字段可留空数组或空字符串；只输出 JSON。'
  ].filter(Boolean).join('\n\n');
}

export async function generateFanficChapter(input: {
  book: FanficBook;
  order: number;
  previousChapters: FanficChapter[];
  user: UserProfile;
  character: CharacterProfile;
  localWorldBooks?: WorldBookEntry[];
  direction?: string;
  settings?: AppSettings;
}): Promise<FanficChapter> {
  const parsed = await requestFanficJson(
    input.settings,
    buildChapterPrompt(input),
    { temperature: 0.82, maxTokens: 7800 },
    generatedFanficChapterPayloadIsComplete,
    (value) => {
      const issues = describeGeneratedFanficChapterIssues(value);
      return `章节 JSON 没有可展示的${issues.join('、') || '正文'}。`;
    }
  );
  const chapter = normalizeFanficChapter(parsed, { book: input.book, order: input.order });
  chapter.model = getFanficTextModelOverride(input.settings) || input.settings?.model || undefined;
  return chapter;
}

function fanficHotspotCommentTargetCount(characterCount: number) {
  return Math.min(10, Math.max(7, 6 + characterCount));
}

function generatedCommentCollectionIsUsable(value: unknown) {
  const comments = normalizeRawComments(value);
  return comments.length > 0;
}

function formatFanficCommentCharacters(book: FanficBook, characters: CharacterProfile[]) {
  return characters.map((character) => [
    `authorId: ${character.id}`,
    `身份: ${character.id === book.characterId ? '本同人文的角色主角本人' : '该用户账号绑定的其他角色'}`,
    `角色真名: ${character.name.trim() || character.nickname.trim()}`,
    `签名: ${character.signature.trim() || '无'}`,
    `角色设定: ${character.description.trim() || '无'}`
  ].join('；')).join('\n');
}

function buildFanficHotspotCommentPrompt(input: {
  book: FanficBook;
  chapter: FanficChapter;
  hotspotId: string;
  chapterCharacters: CharacterProfile[];
}) {
  const hotspot = input.chapter.hotspots.find((entry) => entry.id === input.hotspotId);
  if (!hotspot) throw new Error('没有找到这个高潮评论点。');
  const authorId = fanficAuthorId(input.book.id);
  const targetCount = fanficHotspotCommentTargetCount(input.chapterCharacters.length);
  const paragraphIndex = input.chapter.paragraphs.findIndex((paragraph) => paragraph.id === hotspot.paragraphId);
  const nearbyParagraphs = input.chapter.paragraphs
    .slice(Math.max(0, paragraphIndex - 1), Math.max(0, paragraphIndex - 1) + 3)
    .map((paragraph) => paragraph.text);
  return [
    '你负责生成 LINK 同人文阅读页中某一个高潮插入点的即时评论区。本次只围绕指定高潮生成评论和回复，不改写正文，不讨论其他章节或其他高潮点。只输出 JSON。',
    `作品定义：这是关于${input.book.userName}与${input.book.characterName}的原创 AU 同人文，不是一部与两人无关的孤立小说。正文发生在平行世界；作者、普通读者和角色评论者都处于作品外评论区，清楚同人对象是谁，也清楚正文事件不等于现实经历。`,
    `作品信息：${JSON.stringify({ title: input.book.title, authorName: input.book.authorName, summary: input.book.summary, genre: input.book.genre, tags: input.book.tags, topicPitch: input.book.topicPitch, relationshipArc: input.book.storyBible.relationshipArc, noRomance: isNoRomanceBook(input.book) })}`,
    `本章信息：${JSON.stringify({ order: input.chapter.order, title: input.chapter.title, summary: input.chapter.summary })}`,
    `本次唯一评论目标：${JSON.stringify({ label: hotspot.label, excerpt: hotspot.excerpt, reason: hotspot.reason, nearbyParagraphs })}`,
    '所有评论必须明确回应这个高潮时刻的动作、选择、台词、关系变化或后果，不得泛泛总结整章，不得预知下一章。',
    `虚构作者身份：authorType 必须为 author，authorId 必须为“${authorId}”，显示名由系统固定为“${input.book.authorName}”。作者知道自己写的是${input.book.userName}与${input.book.characterName}的同人文，可以回应读者和角色、解释创作取向或克制地卖关子，但不能剧透未发布内容。作者发言 1-2 次即可。`,
    `本章可发言角色白名单：\n${formatFanficCommentCharacters(input.book, input.chapterCharacters)}`,
    '角色评论规则：角色 authorType 必须为 character，authorId 必须逐字复制白名单 ID，authorName 由系统按 ID 覆盖。角色按最适合的语气各发言 0-1 次，不要求所有白名单角色必须出现；可发布一级评论或自然回复。角色主角本人知道自己与用户是同人对象，可以对“自己被这样写”产生符合设定的反应；其他绑定角色知道作品写的是谁，可以围观、调侃、质疑或站队。只能依据提供的角色设定决定语气，不得编造现实聊天、共同记忆、关系亲疏或正文外事件。',
    `普通读者规则：authorType 为 reader，authorId 留空，使用彼此不同且自然的网络昵称。普通读者清楚这是${input.book.userName} × ${input.book.characterName}同人，可以讨论人物还原度、AU 设定、关系嗑点、事业高光、伏笔和更新，但不要每条都机械重复“同人文”或主角全名。不得冒充用户、作者或绑定角色。`,
    `comments 生成 ${targetCount}-${targetCount + 2} 条。以一级评论为主，可加入少量自然回复；parentId 只能指向同数组中此前已经出现的 id。混合短反应、细节观察、站队或吐槽、人物关系判断和伏笔猜测，长短与语气要有差异。`,
    '不得虚构正文里没有发生的动作或台词，不要写文学赏析、编辑审稿、模型评价、提示词讨论；不要全员同一种语气，不要刷屏式“啊啊啊”，不要使用“NPC、路人A、朋友A”等占位名。',
    '输出前自检：若作者或角色发言，其 ID 是否正确；回复是否只指向此前评论；所有人是否自然知道这是关于指定用户与角色的同人文；是否完全没有代替用户发言。',
    '输出单行紧凑 JSON：{"comments":[{"id":"c1","authorType":"author|character|reader","authorId":"作者或角色的精确ID，读者留空","authorName":"读者昵称；作者和角色可填真名但最终由系统覆盖","content":"只回应本高潮点的评论内容","parentId":"回复的此前评论id或空字符串","likes":数字}]}。只输出 JSON。'
  ].join('\n\n');
}

export async function generateFanficHotspotComments(input: {
  book: FanficBook;
  chapter: FanficChapter;
  hotspotId: string;
  characters: CharacterProfile[];
  settings?: AppSettings;
}) {
  const hotspot = input.chapter.hotspots.find((entry) => entry.id === input.hotspotId);
  if (!hotspot) throw new Error('没有找到这个高潮评论点。');
  const allCharacters = uniqueCommentCharacters(input.characters);
  const chapterCharacters = chapterCommentCharacters(input.book, input.chapter.order, allCharacters);
  const parsed = await requestFanficJson(
    input.settings,
    buildFanficHotspotCommentPrompt({ ...input, chapterCharacters }),
    { temperature: 0.86, maxTokens: 3200 },
    (value) => isRecord(value) && generatedCommentCollectionIsUsable(value.comments),
    '这个高潮点的评论 JSON 没有可用评论。',
    1
  );
  if (!isRecord(parsed)) throw new Error('这个高潮点的评论生成结果无效。');
  const comments = normalizeGeneratedHotspotComments(parsed.comments, {
    book: input.book,
    chapter: input.chapter,
    hotspotId: hotspot.id,
    characters: chapterCharacters
  });
  if (!comments.length) throw new Error('模型没有返回可保存的高潮评论，请重试。');
  return comments;
}

export async function fetchFanficTrendKeywords() {
  const response = await fetch('/api/fanfic/trends', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(response.status === 401 ? '联网题材需要先通过访问验证。' : '暂时无法获取联网题材，请稍后重试。');
  const payload = await response.json() as { keywords?: unknown; fetchedAt?: unknown; sourceLabel?: unknown };
  const keywords = asStringArray(payload.keywords, 14);
  const sourceLabel = asString(payload.sourceLabel);
  if (!keywords.length || !sourceLabel) throw new Error('联网趋势没有返回可用的通用题材标签。');
  return {
    keywords,
    fetchedAt: Number(payload.fetchedAt) || Date.now(),
    sourceLabel
  };
}

export async function generateFanficTrendTopics(input: { keywords: string[]; settings?: AppSettings }): Promise<FanficTopic[]> {
  if (!hasTextGenerationConfig(input.settings, getFanficTextModelOverride(input.settings))) throw new Error('请先配置全局内容创作模型或可用的 API 默认模型，再生成联网同人题材。');
  const prompt = [
    '根据公开通用网络文学分类标签生成 6 个完全原创、清楚直给、适合连载的双主角 AU 同人题材卡。不要套用任何单一内容频道；六个题材要主动覆盖情感、事业、悬疑、冒险、幻想、现实或轻喜剧中的不同方向。趋势标签只能作为类型参考，禁止提及、拼接或改写任何榜单作品、IP、明星、作者、书名、简介和正文。',
    `趋势标签：${JSON.stringify(input.keywords)}`,
    '每个题材必须创造全新的时代、地点、职业、身份、世界规则和核心冲突，适合任意两位主角代入，且两个主角同等重要。题材之间的开局事件、行动目标和读者回报必须明显不同。',
    '题材卡规则：开局不是抽象意象，而是两位主角当场遇到的具体麻烦；目标能在前三章获得第一次结果；升级压力来自清楚的对手、期限、规则或现实代价；卖点明确告诉读者会看到甜宠、打脸、事业升级、查案、经营或求生中的哪一种回报。',
    '输出 JSON 对象：{"topics":[{"title":"6-14字直白题材名","hook":"包含开局麻烦、行动目标和预期回报的80-140字钩子","setting":"全新原创背景","conflict":"可持续升级的核心冲突","relationship":"由行动推进的关系动力","tags":[5-7个清晰标签],"trendKeywords":[使用的趋势词],"commercialSeed":{"openingProblem":"当场发生的具体麻烦","immediateGoal":"前三章要完成的目标","escalation":"后续对手或代价","readerPromise":"读者会持续看到的回报"}}]}。只输出 JSON。'
  ].join('\n\n');
  const parsed = await requestFanficJson(
    input.settings,
    prompt,
    { temperature: 0.88, maxTokens: 3600 },
    (value) => isRecord(value) && Array.isArray(value.topics) && value.topics.length >= 6 && value.topics.every((entry) => {
      if (!isRecord(entry) || !isRecord(entry.commercialSeed)) return false;
      const commercialSeed = entry.commercialSeed;
      return ['title', 'hook', 'setting', 'conflict', 'relationship'].every((field) => Boolean(asString(entry[field])))
        && Array.isArray(entry.tags)
        && asStringArray(entry.tags, 6).length >= 3
        && ['openingProblem', 'immediateGoal', 'escalation', 'readerPromise'].every((field) => Boolean(asString(commercialSeed[field])));
    })
  );
  const entries = Array.isArray(parsed) ? parsed : isRecord(parsed) && Array.isArray(parsed.topics) ? parsed.topics : [];
  const now = Date.now();
  return entries.flatMap((entry, index) => {
    if (!isRecord(entry)) return [];
    const title = asString(entry.title);
    const hook = asString(entry.hook);
    if (!title || !hook) return [];
    const rawSeed = isRecord(entry.commercialSeed) ? entry.commercialSeed : {};
    return [{
      id: createId('fanfic_topic_trend'),
      source: 'trend' as const,
      title,
      hook,
      setting: asString(entry.setting),
      conflict: asString(entry.conflict),
      relationship: asString(entry.relationship),
      tags: asStringArray(entry.tags, 6),
      trendKeywords: asStringArray(entry.trendKeywords, 4),
      commercialSeed: {
        openingProblem: asString(rawSeed.openingProblem),
        immediateGoal: asString(rawSeed.immediateGoal),
        escalation: asString(rawSeed.escalation),
        readerPromise: asString(rawSeed.readerPromise)
      },
      builtIn: false,
      createdAt: now + index,
      expiresAt: now + 24 * 60 * 60 * 1000
    }];
  }).slice(0, 6);
}

export async function generateFanficCover(book: FanficBook, settings?: AppSettings) {
  if (!settings?.imageGenerationEnabled) return '';
  const selectedModel = getSelectedImageModelOption(settings, 'voom');
  if (!selectedModel) return '';
  const result = await generateImageByProvider(selectedModel.provider, settings, {
    positivePrompt: `${book.coverPrompt}, vertical editorial book cover artwork, symbolic scene for two protagonists, muted Korean indie magazine palette, premium paper texture, no letters, no words, no typography, no logo, no watermark`,
    negativePrompt: 'text, letters, title, logo, watermark, celebrity, copyrighted character, photorealistic identifiable person, extra limbs, low quality',
    model: selectedModel.model,
    width: 768,
    height: 1152,
    size: settings.imageOpenAi.size
  });
  return result.imageUrl;
}