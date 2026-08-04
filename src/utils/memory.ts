import type { ChatMemorySettings, ChatMode, ConversationImageVisualMemory, ConversationOfflineSettings, ConversationRoleGuidanceSettings, ConversationSettings, ImagePeoplePolicy, ImageReferencePolicy, ImageVisualMoment, ImageVisualScope, OfflineInterruptionMode, OfflineParagraphMode, OfflinePerspective, OfflinePromptPreset, OfflineRetellMode, OfflineStructureKind, OfflineTonePreset, RingtoneAsset, VoomImageMode } from '@/types/domain';
import { createId } from './id';
import { chatMemorySettingLimits, normalizeChatMemorySetting } from './memorySettings';
import { normalizeChatModelOverrides } from './settings';
import { defaultTimeAwarenessSettings, normalizeTimeAwarenessSettings } from './timeAwareness';
import { normalizeVoomFrequency } from './voom';
export { getConversationActiveMessages, getConversationFloorCount, getConversationFloors, getMessageFloorMap, getMessagesInFloorRange, getRecentCompleteFloorMessages } from './memoryFloors';

export const defaultChatMemorySettings: ChatMemorySettings = {
  enabled: true,
  compressionEnabled: true,
  autoCapture: true,
  captureEvery: chatMemorySettingLimits.captureEvery.defaultValue,
  recentFloorLimit: chatMemorySettingLimits.recentFloorLimit.defaultValue,
  recallTokenBudget: chatMemorySettingLimits.recallTokenBudget.defaultValue,
  growthEnabled: true,
  naturalForgettingEnabled: true,
  reflectionEnabled: true,
  embeddingEnabled: true,
  embeddingModel: ''
};

const legacyOfflineWritingStylePresetContents: Record<string, string> = {
  baimiao: '采用白描式叙事。只照亮此刻正在发生的人、物、动作和对话；少写背景和解释。语言朴素透明，不用华丽辞藻、夸张比喻或情绪宣告。用具体物件、动作、停顿和空间距离承载情绪，让读者自己读出未说出口的东西。',
  'dialogue-driven': '让对白承担主要推进力。叙述只保留必要动作、停顿和空间变化，每句对白都要符合人物身份、情绪和关系距离。允许欲言又止、岔开话题、沉默和答非所问。',
  'sensory-slow': '放慢关键瞬间。用声音、温度、气味、触感和细小动作呈现场景，不急着解释情绪。每一段都围绕当下可感知的细节展开，避免跳场和总结式叙述。'
};

const legacyOfflineTonePresetContents: Record<string, string> = {
  daily: '基调是平实的日常。重点写生活正在继续：消息、饭点、天气、工作或学习的残留、房间里的物件、临时被打断的琐事。情绪轻轻落在动作里，不要突然拔高。',
  'push-pull': '基调是克制的拉扯。人物会靠近又收回，说出口的话比真实想法少半寸。用停顿、改口、避开视线、重复小动作和空间距离表现试探，不要让关系进展过快。',
  ambiguous: '基调是低温暧昧。亲近感来自细节和误差：一句普通话被听出别的意思，一次短暂停留，一件被顺手整理的小事。不要直白告白，保留不确定和余温。',
  romance: '基调是明亮而具体的热恋。互动可以更直接、更柔软，但仍要有真实生活的边界和琐碎感。用对话、触碰前后的停顿、分享日常和自然照顾呈现热度，不写油腻情话。',
  bittersweet: '基调是酸涩和留白。人物不是彻底崩溃，而是在正常行动里露出细小裂缝：收好的东西、没说完的话、过期的票据、冷掉的水。情绪要克制，结尾保留余味。'
};

export const defaultOfflineWritingStylePresets: OfflinePromptPreset[] = [
  {
    id: 'light-comedy',
    name: '轻喜剧',
    content: `采用生活化的日常轻喜剧文风。喜感来自人物认真生活时自然出现的小偏差、性格碰撞、话语错位和现实琐事，而不是角色主动表演段子。整体明快、松弛、有烟火气；人物可以尴尬、嘴硬、倒霉或互相调侃，但始终保有真实情绪、独立人格与基本尊严。

核心技法：
1. 先写真实处境，再让喜感从处境中长出来。迟到前找不到钥匙、两个人同时假装不在意、认真准备却漏掉最普通的一步，都可以产生笑意；不要先想笑点，再扭曲人物与剧情去配合。
2. 喜剧依赖“预期与结果的轻微错位”。人物以为事情会这样发展，现实却偏了半步；偏差应当合理、可收拾，不靠突然降智、离谱巧合或灾难性后果。
3. 对白简洁、自然、有来有回。允许一本正经地说出略显荒唐的话、嘴硬后被事实拆穿、两个人理解到不同重点，也允许一句平常回应恰好戳破精心维持的体面。
4. 反应比笑话更重要。笑点发生后，写人物停住的动作、想补救却越描越黑的半句话、旁人短暂的沉默或继续做事的若无其事；不要由旁白解释“这很好笑”。
5. 善用生活物件和现实流程。外卖备注、购物袋、门禁、充电线、洗衣机、共享雨伞、群聊消息、做饭步骤都能参与剧情，让喜剧扎在具体生活里。
6. 让性格制造差异。严谨的人可能把小事准备得过度，随性的人可能总能漏掉关键一步，嘴硬的人会绕很远表达关心；笑点必须符合各自稳定性格，不能让所有人共享同一种贫嘴腔。
7. 使用回扣而非复读。前面不起眼的小失误、随口说过的话或被放错位置的物件，可以在后文以新的方式产生影响；回扣一次即可，不反复提醒读者记得笑点。
8. 控制喜剧密度。普通叙事是底色，笑意间歇出现。关键情绪、认真冲突、脆弱倾诉和需要解决的现实问题到来时及时收住玩笑，不拿创伤、边界或真诚表达抖机灵。

人物与关系：
- 调侃必须建立在关系距离和双方接受度上。熟人可以互损，陌生人保持分寸；任何玩笑都不能变成羞辱、霸凌、性别刻板印象或单方面拿对方弱点取乐。
- 允许角色偶尔出糗、误会和嘴硬，但不能持续降智、工具人化或变成只负责搞笑的小丑。角色仍会处理正事、承担后果并从经验中调整。
- 感情线中的喜感来自默契、反差和生活磨合，不用油腻撩拨、强行脸红或工业糖精。温柔可以藏在吐槽后的补救、顺手留下的一份食物和嘴上嫌弃却已经做好的事里。
- 配角不是罐头笑声。配角可以没听懂、懒得接话、一本正经地继续事务，也可以因自身目标带来新的小偏差；不要求全员围观主角并同步发笑。

节奏结构：
1. 用“正常目标—细小偏差—人物应对—新的轻微后果”形成一轮喜剧节奏。
2. 铺垫要短，偏差要清楚，反应要符合人物，收尾要及时。笑点成立后继续推进事务，不追加解释、总结和第二遍笑点。
3. 一章可以有两三处轻巧回合，也必须保留安静、正常和真诚的段落，让节奏有松有紧。
4. 结尾适合停在一件仍要处理的小事、一句不动声色的回扣或人物恢复体面后的细微反差，不必强行用金句收尾。

禁止事项：
- 禁止网络段子拼贴、热梗轰炸、谐音梗堆砌、夸张吐槽役旁白和综艺式画外音。
- 禁止为了搞笑让人物无故摔倒、破坏物品、侵犯边界、遗忘常识或突然改变智力。
- 禁止每句话都贫嘴、所有严肃话题都被玩笑化、所有尴尬都靠夸张大叫和群体围观放大。
- 禁止旁白替读者标注笑点，也不要使用“空气突然安静”“大型社死现场”等模板化网络表达。

最终效果：正文像真实的人在过日子，事情本身不惊天动地，却因为性格、关系与琐事之间恰到好处的偏差而让人会心一笑；轻松但不轻浮，有趣但不吵闹，温暖但不刻意煽情。`
  },
  {
    id: 'baimiao',
    name: '白描',
    content: `采用中国传统文学中的白描式叙事。叙述者像藏在镜头后的一双眼睛，不抢着发声、评论或替读者总结，只冷静、细致、不动声色地记录生活正在发生的横截面。

核心技法：
1. 不铺陈宏大背景，只突出此刻主体。环境、时代和解释性背景退到后景，仅保留会影响人物动作、对话和选择的具体信息，让注意力集中在眼前的人、物与事件上。
2. 不求面面俱到，只求一笔传神。优先选择最准确的一两个名词、动词、动作或物件状态，不罗列五官、服装、房间陈设和情绪标签。
3. 不尚华丽，务求朴实。语言像擦净的玻璃，透明、准确、少粉饰；避免华丽辞藻、夸张比喻、排比抒情、作者议论和强行升华。
4. 情绪不直接宣告。不要写“他很难过”“她十分幸福”，让情绪附着在杯子、钥匙、衣角、账单、冷掉的饭、没有响起的手机、反复做的小动作与没有说完的话上。
5. 少用形容词和副词，多用可观察的名词与动词。与其写“他焦急地等待”，不如写他第三次点亮屏幕，又把手机扣回桌面。
6. 对白保持生活原貌。允许短句、停顿、重复、改口、答非所问和没有回应；重要对白之后，用动作、物件或空间距离承接潜台词，不用旁白解释“这句话意味着什么”。
7. 细节必须有叙事功能。一个细节至少应当呈现人物习惯、关系变化、现实处境或情绪余波之一；无功能的精致摆设和感官堆砌应删去。
8. 留白不是省略逻辑。读者可以自行体会情绪，但人物为何行动、物件从何而来、场景如何衔接仍要清楚，不能用含糊代替因果。

落笔校准：
- 写亲情时，让关心落在装好的食物、反复确认的行李、没舍得扔的旧包装上，不直接宣告“父母的爱很深”。
- 写爱情时，让关系变化落在多摆或收起的一副碗筷、留在玄关的钥匙、记住的忌口和停在发送框里的文字上，不用大段抒情证明深情。
- 写成长时，让变化落在第一次独自签字、自己提起的行李、被折好收回的旧衣服上，不做总结式人生感悟。

最终标准：有真意，少粉饰，少做作，不卖弄。正文看似平静朴素，但具体动作、物件、对白与停顿共同留下准确而持久的情绪余味。`
  },
  {
    id: 'dialogue-driven',
    name: '对话推进',
    content: `采用对白驱动的场景写法，让人物在说话、回避、追问、改口和沉默中主动推动剧情，而不是由旁白替人物解释一切。

执行规则：
1. 每句对白都要有当下目的：询问、试探、遮掩、拒绝、确认、转移话题、缓和气氛或争取某件事。删除只为凑篇幅、重复已知信息的空对白。
2. 让不同人物拥有稳定且可区分的语言习惯，包括句子长短、措辞、礼貌程度、是否直说、如何表达不满；不要让所有人共享同一种文艺腔或高情商模板。
3. 对白必须受关系距离和场景约束。同一句关心，对陌生人、朋友、家人和恋人的说法不同；公开场合、疲惫时、争执后与独处时的语气也不同。
4. 保留真人交流的不完整：停顿、重复、口误、临时改口、答非所问、被环境打断、听见却不马上回答都可以存在，但不能滥用省略号制造虚假拉扯。
5. 叙述只承担必要功能：交代谁在说话、可见动作、视线落点、空间变化、环境打断与话后的反应。不要每句台词后都机械追加神态或心理解释。
6. 信息通过冲突和需求自然露出，不让角色突然发表设定说明书，不让熟人互相复述双方早已知道的背景。
7. 重要台词要产生后果：改变下一步行动、暴露误解、拉近或拉远距离、留下待处理的问题。若一句话说完对场景毫无影响，就考虑删改。
8. 沉默也是回应，但必须写清沉默期间仍在发生的动作、声音或现实事务；不能把沉默自动解释成默认、同意或某种确定情绪。

整体效果应像真实的人正在同一空间里交流，而不是舞台对白稿：台词有来有回，动作有承接，潜台词可被感知，场景也持续向前。`
  },
  {
    id: 'sensory-slow',
    name: '慢镜头感官',
    content: `采用慢镜头感官叙事，只在真正关键的瞬间放慢时间，让身体感受、微小动作和环境变化承担情绪与关系推进。

执行规则：
1. 每个段落选择一至两种最有作用的感官作为锚点，例如门外逐渐靠近的脚步声、杯壁的余温、雨水带进室内的潮气；不要把视觉、听觉、嗅觉、味觉、触觉机械列满。
2. 感官必须属于当前视角人物能够真实感知的范围，并受距离、光线、遮挡、注意力和身体状态限制；不能为了画面感获得全知视野。
3. 放慢的是有变化的瞬间：伸手前的犹豫、话说出口后的空档、一次意外靠近、冲突后的收拾动作。普通走路、开门和喝水不必全部逐帧拆解。
4. 细节遵循因果顺序。先有外界刺激，再有注意、身体反应、判断和行动；不要让感官描写悬浮在剧情之外。
5. 身体反应保持真实克制。疲惫会让肩背发沉，紧张可能使手心潮湿，但不要逢心动就呼吸停滞、耳尖通红、浑身僵硬。
6. 不急着解释情绪。让读者从声音突然变轻、手指停在杯沿、衣料擦过椅背、空调风吹凉皮肤等变化中读出当下状态。
7. 慢镜头之后必须回到现实节奏，让人物继续说话、处理事务或做出选择；禁止整章停留在一个触碰或一次对视里反复渲染。
8. 语言准确、具体、节制，避免辞藻堆砌和抽象氛围。感官是现实证据，不是为了制造唯美滤镜。

整体效果应当让关键瞬间更清晰、更有身体实感，同时保持剧情连贯，不拖沓、不滥情、不把每个日常动作都写成电影高潮。`
  }
];

export const defaultOfflineTonePresets: OfflinePromptPreset[] = [
  {
    id: 'daily',
    name: '日常',
    content: `基调是平实、松弛而持续流动的日常。生活不会为了感情暂停：饭点、天气、通勤、工作或学习的残留、家务、账单、手机消息、身体疲惫和临时打断都自然参与场景。
情绪轻轻落在具体行动里，可以有无聊、走神、小烦躁、短暂开心和安静陪伴，不必每轮都制造心动、冲突或人生感悟。人物既会认真交流，也会顺手收拾桌面、回复同事、找不到充电线或惦记明天的安排。
日常不等于流水账。每一章选择一两个有意义的生活细节，让它们显出人物习惯、关系默契或尚未解决的问题；其余琐事简洁带过。结尾可以停在一件仍要继续的小事、一个自然约定或一段不尴尬的安静里，不强行升华。`
  },
  {
    id: 'push-pull',
    name: '拉扯',
    content: `基调是有原因、有边界的克制拉扯。人物同时存在靠近的愿望与后退的顾虑：关系尚未确认、现实条件不允许、害怕误解、旧问题未解决，或性格本就不擅长直说。拉扯必须来自具体矛盾，不能为了暧昧而反复推开又贴近。
  说出口的话比真实想法少半寸。用停顿、改口、话题绕行、未发送的信息、重复的小动作和空间距离呈现试探；一次靠近之后可能因现实顾虑稍微收回，但每轮互动仍留下新信息或细小变化。
  禁止用无端冷脸、故意误导、羞辱、失联和拒绝沟通制造张力。拉扯不是情绪操控，也不是永远原地踏步；当铺垫足够时，人物应当能够更诚实地确认、拒绝或协商下一步。`
  },
  {
    id: 'ambiguous',
    name: '暧昧',
    content: `基调是低温、含蓄、尚未被双方完全确认的暧昧。亲近感来自有现实依据的细节与理解误差：一句普通关心被多想了半秒，一次离开前的短暂停留，一件被顺手整理的小事，或对彼此习惯的逐渐熟悉。
  人物可以试探、观察、暗自期待，也会担心会错意，因此表达保留余地。用话语前后的停顿、选择性关心、靠近后自然移开的距离和事后仍记得的细节呈现，不直接宣布“气氛暧昧”。
  暧昧必须建立在双向信号和关系积累上。不要把普通礼貌过度解读成爱意，不让所有对视、递东西和偶然接触都变成心跳桥段；也不要无限拖延。随着证据增加，关系应自然走向更清楚的理解、边界或选择。`
  },
  {
    id: 'romance',
    name: '热恋',
    content: `基调是明亮、具体、彼此确认后的热恋。亲近可以更直接，分享欲、依赖、想念、拥抱和自然照顾都可以出现，但关系仍嵌在各自真实生活里，保留工作、朋友、独处、疲惫、分歧与个人边界。
  热度通过行动和选择呈现：愿意留时间、记住小事、主动商量计划、冲突后回来沟通、在对方需要时给出具体支持。甜蜜可以伴随玩笑、生活琐碎和偶尔的不耐烦，不要求每句话都温柔完美。
  不写流水线宠溺、夸张占有、永久脸红心跳或无理由牺牲。热恋不是失去独立人格，也不是忽略场合持续亲密；让爱意真实、双向、可持续，既有温度，也有现实分寸。`
  },
  {
    id: 'bittersweet',
    name: '酸涩',
    content: `基调是克制、具体、带有现实余味的酸涩。遗憾、错过、误解、距离或未能满足的期待必须有前因，人物不会为了制造虐感突然崩溃，也不会停止正常生活。
让情绪从正常行动的细小裂缝里露出来：收好的东西、没说完的话、改掉的行程、过期的票据、冷掉的水、仍按习惯多买的一份。人物可能照常上班、吃饭和回应别人，只在某个具体瞬间短暂失神或改变动作。
不堆砌哭泣、绝望、病痛和悲情独白，不把伤害浪漫化，也不依赖误会长期拒绝沟通。酸涩可以被谈开、被接受或暂时搁置；结尾保留余味与继续生活的空间，不强行圆满，也不强行走向灾难。`
  }
];

const defaultWritingStylePresetId = defaultOfflineWritingStylePresets[0].id;
const defaultTonePresetId = defaultOfflineTonePresets[0].id;
const currentOfflineWritingStylePresetVersion = 1;

export const defaultOfflineSettings: ConversationOfflineSettings = {
  enhanceAppearance: true,
  enhanceOutfit: true,
  expandLength: true,
  characterPsychology: true,
  emotionalGuidance: true,
  desireRestraint: true,
  antiToxicMasculinity: true,
  antiClicheRomance: true,
  dynamicWorldNarrative: true,
  paragraphMode: 'mixed',
  perspective: 'omniscient-third',
  interruptionMode: 'strict',
  retellMode: 'retell',
  customStructurePresets: {
    paragraph: [],
    perspective: [],
    interruption: [],
    retell: []
  },
  activeCustomStructurePresetIds: {
    paragraph: '',
    perspective: '',
    interruption: '',
    retell: ''
  },
  wordCount: '800-1200字',
  writingStylePresetVersion: currentOfflineWritingStylePresetVersion,
  writingStylePresetId: defaultWritingStylePresetId,
  writingStylePresets: defaultOfflineWritingStylePresets,
  writingStyle: defaultOfflineWritingStylePresets[0].content,
  tonePresetId: defaultTonePresetId,
  tonePresets: defaultOfflineTonePresets,
  tone: 'daily',
  customTone: defaultOfflineTonePresets[0].content
};

export const defaultRoleGuidanceSettings: ConversationRoleGuidanceSettings = {
  emotionalGuidance: true,
  desireRestraint: true,
  antiToxicMasculinity: true,
  antiClicheRomance: true,
  dynamicWorldNarrative: true
};

export function normalizeRoleGuidanceSettings(settings: Partial<ConversationRoleGuidanceSettings> | null | undefined): ConversationRoleGuidanceSettings {
  return {
    emotionalGuidance: settings?.emotionalGuidance ?? defaultRoleGuidanceSettings.emotionalGuidance,
    desireRestraint: settings?.desireRestraint ?? defaultRoleGuidanceSettings.desireRestraint,
    antiToxicMasculinity: settings?.antiToxicMasculinity ?? defaultRoleGuidanceSettings.antiToxicMasculinity,
    antiClicheRomance: settings?.antiClicheRomance ?? defaultRoleGuidanceSettings.antiClicheRomance,
    dynamicWorldNarrative: settings?.dynamicWorldNarrative ?? defaultRoleGuidanceSettings.dynamicWorldNarrative
  };
}

const offlineParagraphModes: OfflineParagraphMode[] = ['long', 'short', 'mixed'];
const offlinePerspectives: OfflinePerspective[] = ['omniscient-third', 'character-third', 'character-second', 'user-first', 'user-second'];
const offlineInterruptionModes: OfflineInterruptionMode[] = ['advance', 'strict'];
const offlineRetellModes: OfflineRetellMode[] = ['retell', 'direct'];
const offlineStructureKinds: OfflineStructureKind[] = ['paragraph', 'perspective', 'interruption', 'retell'];
const offlineTonePresets: OfflineTonePreset[] = ['daily', 'push-pull', 'ambiguous', 'romance', 'bittersweet', 'custom'];
const voomImageModes: VoomImageMode[] = ['character-choice', 'manual'];

function normalizeStringOption<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  const normalizedValue = String(value ?? '').trim() as T;
  return allowed.includes(normalizedValue) ? normalizedValue : fallback;
}

function normalizeOptionalRingtoneAsset(asset: Partial<RingtoneAsset> | null | undefined): RingtoneAsset | undefined {
  const url = String(asset?.url ?? '').trim();
  if (!url) return undefined;
  return {
    id: String(asset?.id ?? '').trim() || createId('call-audio'),
    name: String(asset?.name ?? '').trim() || '通话音频',
    url,
    mimeType: String(asset?.mimeType ?? '').trim() || 'audio/mpeg',
    size: Math.max(0, Math.round(Number(asset?.size ?? 0) || 0)),
    source: asset?.source === 'default' ? 'default' : 'imported',
    updatedAt: Math.max(0, Number(asset?.updatedAt ?? 0) || 0)
  };
}

function normalizePromptPreset(preset: Partial<OfflinePromptPreset> | null | undefined, fallback: OfflinePromptPreset, index: number): OfflinePromptPreset {
  const id = String(preset?.id ?? '').trim() || `${fallback.id}_${index}`;
  const name = String(preset?.name ?? '').trim() || fallback.name;
  const content = String(preset?.content ?? '').trim() || fallback.content;
  return { id, name, content };
}

function mergePromptPresets(defaults: OfflinePromptPreset[], presets: unknown, legacyContents: Record<string, string>): OfflinePromptPreset[] {
  const sourcePresets = Array.isArray(presets) && presets.length ? presets : defaults;
  const customPresets = sourcePresets
    .map((preset, index) => {
      const normalizedPreset = normalizePromptPreset(preset as Partial<OfflinePromptPreset>, defaults[index % defaults.length], index);
      const currentDefault = defaults.find((item) => item.id === normalizedPreset.id);
      return currentDefault && normalizedPreset.content === legacyContents[normalizedPreset.id]
        ? { ...normalizedPreset, content: currentDefault.content }
        : normalizedPreset;
    })
    .filter((preset) => preset.id && preset.name && preset.content);
  const byId = new Map<string, OfflinePromptPreset>();
  customPresets.forEach((preset) => {
    byId.set(preset.id, preset);
  });
  const normalized = [...byId.values()];
  return normalized.length ? normalized : defaults.map((preset) => ({ ...preset }));
}

function normalizeCustomStructurePresetList(presets: unknown): OfflinePromptPreset[] {
  if (!Array.isArray(presets)) return [];
  const byId = new Map<string, OfflinePromptPreset>();
  presets.forEach((preset) => {
    if (!preset || typeof preset !== 'object') return;
    const source = preset as Partial<OfflinePromptPreset>;
    const id = String(source.id ?? '').trim();
    const name = String(source.name ?? '').trim();
    const content = String(source.content ?? '').trim();
    if (id && name && content) byId.set(id, { id, name, content });
  });
  return [...byId.values()];
}

function normalizeCustomStructurePresets(presets: unknown): ConversationOfflineSettings['customStructurePresets'] {
  const source = presets && typeof presets === 'object'
    ? presets as Partial<ConversationOfflineSettings['customStructurePresets']>
    : {};
  return {
    paragraph: normalizeCustomStructurePresetList(source.paragraph),
    perspective: normalizeCustomStructurePresetList(source.perspective),
    interruption: normalizeCustomStructurePresetList(source.interruption),
    retell: normalizeCustomStructurePresetList(source.retell)
  };
}

function normalizeActiveCustomStructurePresetIds(
  presetIds: unknown,
  presets: ConversationOfflineSettings['customStructurePresets']
): ConversationOfflineSettings['activeCustomStructurePresetIds'] {
  const source = presetIds && typeof presetIds === 'object'
    ? presetIds as Partial<ConversationOfflineSettings['activeCustomStructurePresetIds']>
    : {};
  return offlineStructureKinds.reduce<ConversationOfflineSettings['activeCustomStructurePresetIds']>((result, kind) => {
    const id = String(source[kind] ?? '').trim();
    result[kind] = presets[kind].some((preset) => preset.id === id) ? id : '';
    return result;
  }, { paragraph: '', perspective: '', interruption: '', retell: '' });
}

function isKnownBuiltInPromptContent(content: string, defaults: OfflinePromptPreset[], legacyContents: Record<string, string>) {
  return defaults.some((preset) => preset.content === content) || Object.values(legacyContents).includes(content);
}

function knownBuiltInPromptPresetId(content: string, defaults: OfflinePromptPreset[], legacyContents: Record<string, string>) {
  return defaults.find((preset) => preset.content === content)?.id
    ?? Object.entries(legacyContents).find(([, legacyContent]) => legacyContent === content)?.[0]
    ?? '';
}

function normalizeActivePresetId(presetId: unknown, presets: OfflinePromptPreset[], fallbackId: string) {
  const normalizedId = String(presetId ?? '').trim();
  if (presets.some((preset) => preset.id === normalizedId)) return normalizedId;
  if (presets.some((preset) => preset.id === fallbackId)) return fallbackId;
  return presets[0]?.id ?? fallbackId;
}

function legacyTonePresetId(settings: Partial<ConversationOfflineSettings> | null | undefined) {
  const tone = normalizeStringOption(settings?.tone, offlineTonePresets, defaultOfflineSettings.tone);
  return tone === 'custom' ? '' : tone;
}

export function activeOfflineWritingStylePreset(settings: ConversationOfflineSettings) {
  return settings.writingStylePresets.find((preset) => preset.id === settings.writingStylePresetId) ?? settings.writingStylePresets[0] ?? defaultOfflineWritingStylePresets[0];
}

export function activeOfflineTonePreset(settings: ConversationOfflineSettings) {
  return settings.tonePresets.find((preset) => preset.id === settings.tonePresetId) ?? settings.tonePresets[0] ?? defaultOfflineTonePresets[0];
}

export function normalizeOfflineSettings(settings: Partial<ConversationOfflineSettings> | null | undefined): ConversationOfflineSettings {
  const isLegacyOfflineSettings = Boolean(settings && !('retellMode' in settings));
  const legacyWritingStyle = String(settings?.writingStyle ?? '').trim();
  const storedWritingStylePresetVersion = Math.max(0, Math.floor(Number(settings?.writingStylePresetVersion) || 0));
  const legacyWritingStylePresetId = ['白描', '小薯片'].includes(legacyWritingStyle)
    ? 'baimiao'
    : knownBuiltInPromptPresetId(legacyWritingStyle, defaultOfflineWritingStylePresets, legacyOfflineWritingStylePresetContents);
  const isBuiltInLegacyWritingStyle = Boolean(legacyWritingStylePresetId);
  const writingStylePresets = mergePromptPresets(defaultOfflineWritingStylePresets, settings?.writingStylePresets, legacyOfflineWritingStylePresetContents);
  if (storedWritingStylePresetVersion < currentOfflineWritingStylePresetVersion && !writingStylePresets.some((preset) => preset.id === 'light-comedy')) {
    const lightComedyPreset = defaultOfflineWritingStylePresets.find((preset) => preset.id === 'light-comedy');
    if (lightComedyPreset) writingStylePresets.unshift({ ...lightComedyPreset });
  }
  if (legacyWritingStyle && !isBuiltInLegacyWritingStyle && !writingStylePresets.some((preset) => preset.content === legacyWritingStyle)) {
    writingStylePresets.push({ id: 'legacy-writing-style', name: '旧文风', content: legacyWritingStyle });
  }
  const writingStylePresetId = normalizeActivePresetId(settings?.writingStylePresetId || legacyWritingStylePresetId || (legacyWritingStyle ? 'legacy-writing-style' : defaultWritingStylePresetId), writingStylePresets, defaultWritingStylePresetId);

  const legacyCustomTone = String(settings?.customTone ?? '').trim();
  const isBuiltInLegacyTone = isKnownBuiltInPromptContent(legacyCustomTone, defaultOfflineTonePresets, legacyOfflineTonePresetContents);
  const tonePresets = mergePromptPresets(defaultOfflineTonePresets, settings?.tonePresets, legacyOfflineTonePresetContents);
  if (legacyCustomTone && !isBuiltInLegacyTone && !tonePresets.some((preset) => preset.content === legacyCustomTone)) {
    tonePresets.push({ id: 'legacy-tone', name: '旧基调', content: legacyCustomTone });
  }
  const tonePresetId = normalizeActivePresetId(settings?.tonePresetId || legacyTonePresetId(settings) || (legacyCustomTone && !isBuiltInLegacyTone ? 'legacy-tone' : defaultTonePresetId), tonePresets, defaultTonePresetId);
  const activeWritingStyle = writingStylePresets.find((preset) => preset.id === writingStylePresetId) ?? defaultOfflineWritingStylePresets[0];
  const activeTone = tonePresets.find((preset) => preset.id === tonePresetId) ?? defaultOfflineTonePresets[0];
  const customStructurePresets = normalizeCustomStructurePresets(settings?.customStructurePresets);
  const activeCustomStructurePresetIds = normalizeActiveCustomStructurePresetIds(settings?.activeCustomStructurePresetIds, customStructurePresets);

  return {
    enhanceAppearance: settings?.enhanceAppearance ?? defaultOfflineSettings.enhanceAppearance,
    enhanceOutfit: settings?.enhanceOutfit ?? defaultOfflineSettings.enhanceOutfit,
    expandLength: isLegacyOfflineSettings ? defaultOfflineSettings.expandLength : settings?.expandLength ?? defaultOfflineSettings.expandLength,
    characterPsychology: settings?.characterPsychology ?? defaultOfflineSettings.characterPsychology,
    emotionalGuidance: settings?.emotionalGuidance ?? defaultOfflineSettings.emotionalGuidance,
    desireRestraint: settings?.desireRestraint ?? defaultOfflineSettings.desireRestraint,
    antiToxicMasculinity: settings?.antiToxicMasculinity ?? defaultOfflineSettings.antiToxicMasculinity,
    antiClicheRomance: settings?.antiClicheRomance ?? defaultOfflineSettings.antiClicheRomance,
    dynamicWorldNarrative: settings?.dynamicWorldNarrative ?? defaultOfflineSettings.dynamicWorldNarrative,
    paragraphMode: normalizeStringOption(settings?.paragraphMode, offlineParagraphModes, defaultOfflineSettings.paragraphMode),
    perspective: normalizeStringOption(settings?.perspective, offlinePerspectives, defaultOfflineSettings.perspective),
    interruptionMode: normalizeStringOption(settings?.interruptionMode, offlineInterruptionModes, defaultOfflineSettings.interruptionMode),
    retellMode: normalizeStringOption(settings?.retellMode, offlineRetellModes, defaultOfflineSettings.retellMode),
    customStructurePresets,
    activeCustomStructurePresetIds,
    wordCount: isLegacyOfflineSettings && String(settings?.wordCount ?? '').trim() === '1200-1800字'
      ? defaultOfflineSettings.wordCount
      : String(settings?.wordCount ?? defaultOfflineSettings.wordCount).trim() || defaultOfflineSettings.wordCount,
    writingStylePresetVersion: currentOfflineWritingStylePresetVersion,
    writingStylePresetId,
    writingStylePresets,
    writingStyle: activeWritingStyle.content,
    tonePresetId,
    tonePresets,
    tone: normalizeStringOption(settings?.tone, offlineTonePresets, defaultOfflineSettings.tone),
    customTone: activeTone.content
  };
}

export const defaultCharacterStickerGroupIds: string[] = [];
const legacyDefaultBackgroundColor = '#8fa2af';
const defaultBackgroundColor = '#ffffff';
const legacyDefaultUserBubbleColor = '#5ce46f';
const defaultUserBubbleColor = '#eeeeee';

export const defaultConversationSettings: Omit<ConversationSettings, 'conversationId'> = {
  memory: defaultChatMemorySettings,
  requestRecovery: {
    retryTransientFailures: true,
    retryMalformedRoleplayJson: true
  },
  modelOverrides: normalizeChatModelOverrides(null),
  appearance: {
    backgroundImage: '',
    backgroundImages: [],
    backgroundColor: defaultBackgroundColor,
    userBubbleColor: defaultUserBubbleColor,
    userTextColor: '#111111',
    characterBubbleColor: '#ffffff',
    characterTextColor: '#111111',
    narrationBubbleColor: '#f2f3f5',
    narrationTextColor: '#5f6872',
    showMessageTime: true,
    showReadStatus: true,
    showUserAvatar: false,
    showCharacterAvatar: true,
    showOnlyFirstAvatarInReply: true,
    hideVoomNarration: true
  },
  call: {
    ambientEnabled: false,
    ambientVolume: 0.16,
    voiceBackgroundImage: '',
    voiceBackgroundImages: [],
    videoBackgroundImage: '',
    videoBackgroundImages: [],
    videoGeneratedBackgroundImages: []
  },
  imageVisualMemory: {
    moments: []
  },
  narrationModeEnabled: true,
  autoGenerateVoom: true,
  voomFrequency: 'medium',
  voomImageMode: 'character-choice',
  voomImageEnabled: true,
  voomImageFrequency: 'always',
  autoGenerateTheater: true,
  theaterFrequency: 'medium',
  stickerVisionEnabled: true,
  stickerSuggestionsEnabled: true,
  offlineInvitationEnabled: true,
  onlineGuidance: defaultRoleGuidanceSettings,
  characterStickerGroupIds: defaultCharacterStickerGroupIds,
  timeAwareness: defaultTimeAwarenessSettings,
  proactiveReply: {
    enabled: false,
    frequency: 'medium',
    lastTriggeredAt: 0
  },
  offline: defaultOfflineSettings
};

function normalizeImageVisualScope(value: unknown): ImageVisualScope {
  return value === 'voom' || value === 'videoCall' ? value : 'onlineChat';
}

function normalizeImagePeoplePolicy(value: unknown): ImagePeoplePolicy {
  if (value === 'people-forbidden' || value === 'people-optional') return value;
  return 'character-required';
}

function normalizeImageReferencePolicy(value: unknown): ImageReferencePolicy {
  if (value === 'identity' || value === 'composition') return value;
  return 'none';
}

function normalizeImageVisualMoment(value: Partial<ImageVisualMoment> | null | undefined): ImageVisualMoment | null {
  const visualPrompt = String(value?.visualPrompt ?? '').trim();
  if (!visualPrompt) return null;
  return {
    id: String(value?.id ?? '').trim() || createId('visual'),
    scope: normalizeImageVisualScope(value?.scope),
    continuityKey: String(value?.continuityKey ?? '').trim(),
    peoplePolicy: normalizeImagePeoplePolicy(value?.peoplePolicy),
    referencePolicy: normalizeImageReferencePolicy(value?.referencePolicy),
    environment: String(value?.environment ?? '').trim(),
    activity: String(value?.activity ?? '').trim(),
    expression: String(value?.expression ?? '').trim(),
    wardrobe: String(value?.wardrobe ?? '').trim(),
    framing: String(value?.framing ?? '').trim(),
    visualPrompt,
    negativePrompt: String(value?.negativePrompt ?? '').trim(),
    createdAt: Math.max(0, Number(value?.createdAt) || Date.now())
  };
}

function normalizeConversationImageVisualMemory(value: Partial<ConversationImageVisualMemory> | null | undefined): ConversationImageVisualMemory {
  const moments = Array.isArray(value?.moments)
    ? value.moments.map((moment) => normalizeImageVisualMoment(moment)).filter((moment): moment is ImageVisualMoment => Boolean(moment))
    : [];
  return { moments: moments.sort((left, right) => right.createdAt - left.createdAt).slice(0, 18) };
}

export function normalizeConversationSettings(settings: Partial<ConversationSettings> | null | undefined, conversationId: string, _mode: ChatMode = 'online'): ConversationSettings {
  const memoryDefaults = defaultChatMemorySettings;
  const memory = settings?.memory ?? memoryDefaults;
  const requestRecovery = settings?.requestRecovery ?? defaultConversationSettings.requestRecovery;
  const appearance = settings?.appearance ?? defaultConversationSettings.appearance;
  const call = settings?.call ?? defaultConversationSettings.call;
  const modelOverrides = normalizeChatModelOverrides(settings?.modelOverrides ?? defaultConversationSettings.modelOverrides);
  const isLegacySettings = Boolean(settings && !Object.prototype.hasOwnProperty.call(settings, 'stickerSuggestionsEnabled'));
  const rawBackgroundColor = String(appearance.backgroundColor ?? defaultConversationSettings.appearance.backgroundColor).trim();
  const backgroundColor = !rawBackgroundColor || rawBackgroundColor.toLowerCase() === legacyDefaultBackgroundColor
    ? defaultBackgroundColor
    : rawBackgroundColor;
  const rawUserBubbleColor = String(appearance.userBubbleColor ?? defaultConversationSettings.appearance.userBubbleColor).trim();
  const userBubbleColor = !rawUserBubbleColor || rawUserBubbleColor.toLowerCase() === legacyDefaultUserBubbleColor
    ? defaultUserBubbleColor
    : rawUserBubbleColor;
  const activeBackgroundImage = String(appearance.backgroundImage ?? '').trim();
  const backgroundImages = [
    activeBackgroundImage,
    ...(Array.isArray(appearance.backgroundImages) ? appearance.backgroundImages : [])
  ].map((image) => String(image ?? '').trim()).filter(Boolean);
  const voomFrequency = normalizeVoomFrequency(settings?.voomFrequency, defaultConversationSettings.voomFrequency);
  const voomImageMode = normalizeStringOption(settings?.voomImageMode, voomImageModes, defaultConversationSettings.voomImageMode);
  const voomImageFrequency = normalizeVoomFrequency(settings?.voomImageFrequency, defaultConversationSettings.voomImageFrequency);
  const theaterFrequency = normalizeVoomFrequency(settings?.theaterFrequency, defaultConversationSettings.theaterFrequency);
  const proactiveReply = settings?.proactiveReply ?? defaultConversationSettings.proactiveReply;
  const callAmbientSound = normalizeOptionalRingtoneAsset(call.ambientSound);
  const ambientVolume = Math.min(0.6, Math.max(0.02, Number(call.ambientVolume) || defaultConversationSettings.call.ambientVolume));
  const imageVisualMemory = normalizeConversationImageVisualMemory(settings?.imageVisualMemory);
  const voiceBackgroundImage = String(call.voiceBackgroundImage ?? '').trim();
  const voiceBackgroundImages = [
    voiceBackgroundImage,
    ...(Array.isArray(call.voiceBackgroundImages) ? call.voiceBackgroundImages : [])
  ].map((image) => String(image ?? '').trim()).filter(Boolean);
  const videoBackgroundImage = String(call.videoBackgroundImage ?? '').trim();
  const videoBackgroundImages = [
    videoBackgroundImage,
    ...(Array.isArray(call.videoBackgroundImages) ? call.videoBackgroundImages : [])
  ].map((image) => String(image ?? '').trim()).filter(Boolean);
  const videoGeneratedBackgroundImages = (Array.isArray(call.videoGeneratedBackgroundImages) ? call.videoGeneratedBackgroundImages : [])
    .map((image) => String(image ?? '').trim())
    .filter((image) => Boolean(image) && videoBackgroundImages.includes(image));

  return {
    conversationId,
    memory: {
      enabled: memory.enabled ?? memoryDefaults.enabled,
      compressionEnabled: memory.compressionEnabled ?? memoryDefaults.compressionEnabled,
      autoCapture: memory.autoCapture ?? memoryDefaults.autoCapture,
      captureEvery: normalizeChatMemorySetting('captureEvery', memory.captureEvery, memoryDefaults.captureEvery),
      recentFloorLimit: normalizeChatMemorySetting('recentFloorLimit', memory.recentFloorLimit, memoryDefaults.recentFloorLimit),
      recallTokenBudget: normalizeChatMemorySetting('recallTokenBudget', memory.recallTokenBudget, memoryDefaults.recallTokenBudget),
      growthEnabled: memory.growthEnabled ?? memoryDefaults.growthEnabled,
      naturalForgettingEnabled: memory.naturalForgettingEnabled ?? memoryDefaults.naturalForgettingEnabled,
      reflectionEnabled: memory.reflectionEnabled ?? memoryDefaults.reflectionEnabled,
      embeddingEnabled: memory.embeddingEnabled ?? memoryDefaults.embeddingEnabled,
      embeddingModel: String(memory.embeddingModel ?? memoryDefaults.embeddingModel).trim()
    },
    requestRecovery: {
      retryTransientFailures: requestRecovery.retryTransientFailures ?? defaultConversationSettings.requestRecovery.retryTransientFailures,
      retryMalformedRoleplayJson: requestRecovery.retryMalformedRoleplayJson ?? defaultConversationSettings.requestRecovery.retryMalformedRoleplayJson
    },
    modelOverrides,
    appearance: {
      backgroundImage: activeBackgroundImage,
      backgroundImages: [...new Set(backgroundImages)],
      backgroundColor,
      userBubbleColor,
      userTextColor: String(appearance.userTextColor ?? defaultConversationSettings.appearance.userTextColor).trim() || defaultConversationSettings.appearance.userTextColor,
      characterBubbleColor: String(appearance.characterBubbleColor ?? defaultConversationSettings.appearance.characterBubbleColor).trim() || defaultConversationSettings.appearance.characterBubbleColor,
      characterTextColor: String(appearance.characterTextColor ?? defaultConversationSettings.appearance.characterTextColor).trim() || defaultConversationSettings.appearance.characterTextColor,
      narrationBubbleColor: String(appearance.narrationBubbleColor ?? defaultConversationSettings.appearance.narrationBubbleColor).trim() || defaultConversationSettings.appearance.narrationBubbleColor,
      narrationTextColor: String(appearance.narrationTextColor ?? defaultConversationSettings.appearance.narrationTextColor).trim() || defaultConversationSettings.appearance.narrationTextColor,
      showMessageTime: appearance.showMessageTime ?? defaultConversationSettings.appearance.showMessageTime,
      showReadStatus: appearance.showReadStatus ?? defaultConversationSettings.appearance.showReadStatus,
      showUserAvatar: appearance.showUserAvatar ?? defaultConversationSettings.appearance.showUserAvatar,
      showCharacterAvatar: appearance.showCharacterAvatar ?? defaultConversationSettings.appearance.showCharacterAvatar,
      showOnlyFirstAvatarInReply: appearance.showOnlyFirstAvatarInReply ?? defaultConversationSettings.appearance.showOnlyFirstAvatarInReply,
      hideVoomNarration: true
    },
    call: {
      ...(callAmbientSound ? { ambientSound: callAmbientSound } : {}),
      ambientEnabled: Boolean(call.ambientEnabled ?? defaultConversationSettings.call.ambientEnabled),
      ambientVolume,
      voiceBackgroundImage,
      voiceBackgroundImages: [...new Set(voiceBackgroundImages)],
      videoBackgroundImage,
      videoBackgroundImages: [...new Set(videoBackgroundImages)],
      videoGeneratedBackgroundImages: [...new Set(videoGeneratedBackgroundImages)]
    },
    imageVisualMemory,
    narrationModeEnabled: isLegacySettings ? defaultConversationSettings.narrationModeEnabled : settings?.narrationModeEnabled ?? defaultConversationSettings.narrationModeEnabled,
    autoGenerateVoom: settings?.autoGenerateVoom ?? defaultConversationSettings.autoGenerateVoom,
    voomFrequency,
    voomImageMode,
    voomImageEnabled: settings?.voomImageEnabled ?? defaultConversationSettings.voomImageEnabled,
    voomImageFrequency,
    autoGenerateTheater: settings?.autoGenerateTheater ?? defaultConversationSettings.autoGenerateTheater,
    theaterFrequency,
    stickerVisionEnabled: settings?.stickerVisionEnabled ?? defaultConversationSettings.stickerVisionEnabled,
    stickerSuggestionsEnabled: settings?.stickerSuggestionsEnabled ?? defaultConversationSettings.stickerSuggestionsEnabled,
    offlineInvitationEnabled: settings?.offlineInvitationEnabled ?? defaultConversationSettings.offlineInvitationEnabled,
    onlineGuidance: normalizeRoleGuidanceSettings(settings?.onlineGuidance),
    characterStickerGroupIds: Array.isArray(settings?.characterStickerGroupIds)
      ? [...new Set(settings.characterStickerGroupIds.map((item) => String(item).trim()).filter(Boolean))]
      : [...defaultConversationSettings.characterStickerGroupIds],
    timeAwareness: normalizeTimeAwarenessSettings(settings?.timeAwareness),
    proactiveReply: {
      enabled: proactiveReply.enabled ?? defaultConversationSettings.proactiveReply.enabled,
      frequency: normalizeVoomFrequency(proactiveReply.frequency, defaultConversationSettings.proactiveReply.frequency),
      lastTriggeredAt: Math.max(0, Math.floor(Number(proactiveReply.lastTriggeredAt) || 0))
    },
    offline: normalizeOfflineSettings(settings?.offline)
  };
}

export function estimateTokenCount(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  const cjkCount = (normalized.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWords = normalized.replace(/[\u3400-\u9fff]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjkCount * 1.1 + latinWords * 1.35));
}
