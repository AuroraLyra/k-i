# LINK 提示词索引与修订说明

本文档用于快速查看线上聊天、线下模式、VOOM、VOOM 评论区和小剧场生成时会读取哪些提示词与上下文，方便后续定位和修订。

## 入口文件

| 功能 | 主要入口 | 说明 |
| --- | --- | --- |
| 线上聊天 / 线下模式 | `src/services/prompt.ts` 的 `buildPrompt` | 所有角色聊天回复的总拼装函数。 |
| 群聊回复 | `src/services/ai.ts` 的 `generateGroupChatReply` | 按群成员分别注入当前角色设定、一对一记忆和世界书，并保持私密知识隔离。 |
| 角色发布 VOOM | `src/services/prompt.ts` 的 `buildMomentPrompt`，由 `src/services/ai.ts` 的 `generateVoomPost` 调用 | 在基础角色提示词上追加 VOOM 发帖 JSON 任务。 |
| VOOM 评论区自动回复 | `src/services/ai.ts` 的 `generateVoomCommentReplies` | 在基础角色提示词上追加评论区继续发展任务。 |
| 用户 VOOM 初始评论 | `src/services/ai.ts` 的 `generateUserVoomComments` | 用户发布动态后，模拟可见角色和 NPC 评论；不走 `buildPrompt`。 |
| 小剧场 | `src/services/ai.ts` 的 `generateSmallTheater` / `buildSmallTheaterPrompt` | 在基础角色提示词上追加独立 HTML 小剧场任务。 |
| 小剧场默认题材 | `src/utils/smallTheater.ts` 的 `defaultSmallTheaterTopicDrafts` | 内置题材标题和题材扩展提示。 |

## 共同基础提示词

`buildPrompt(context)` 是线上聊天、线下模式、角色 VOOM、VOOM 评论回复、小剧场都会复用的核心拼装函数。它按顺序注入以下内容：

1. `baseRoleplayPrompt`：角色扮演总设定，包括角色资料、用户资料、信息边界、人格规则、语言规则、禁用表达、关系演进、朋友圈能力。
2. `strictRoleplayRules`：补充严格规则，包括认知边界、关系演进、朋友圈/NPC 社交圈边界。
3. 输出规则：线上模式使用 `profileMutationPrompt`，线下模式使用 `offlineReplyOutputPrompt`。
4. `modeInstructions[context.mode]`：声明当前是线上聊天或线下 RP。
5. 线下设置：仅 `context.mode === 'offline'` 时追加 `renderOfflineSettingsPrompt`。
6. 线上补充规则：仅 `context.mode === 'online'` 时按开关追加标点、日常关心、Sticker、旁白、线下邀约限制等规则。
7. 时间感知：`renderTimeAwarenessPrompt(context.timeAwareness)`。
8. 当前对话总结：`context.conversationSummary`。
9. 记忆手册：`context.memorySummary`。
10. 世界书：由 `selectWorldBooks(context)` 选择后经 `renderWorldBooks` 注入。
11. 最近对话：最近 24 条消息，包含消息 id、发送者、时间、引用、Sticker、图片、语音、定位、转账、线下邀约状态等。
12. 线上聊天可用 Sticker：仅线上聊天回复保留 `renderAvailableStickers(context)`；角色 VOOM、VOOM 评论区回复和小剧场会显式关闭该段。
13. 本次生成任务：线上且 `context.replyInstruction` 存在时注入。

角色设定、用户设定以及双方 LINK 昵称/签名中的显式占位符 `{{char}}`、`<char>` 会在进入单聊提示词前展开为当前角色姓名，`{{user}}`、`<user>` 会展开为当前绑定用户姓名。只处理这些显式占位符；普通文本中的昵称、代词、称谓和历史原文不会被改写。

## 世界书读取规则

世界书由 `selectWorldBooks(context)` 选择：

- `local`：只读取绑定到当前角色 `character.localWorldBookIds` 的本地世界书。
- `global-online`：仅在线上模式读取。
- `global-offline`：仅在线下模式读取。

世界书条目由 `renderWorldBooks` 根据最近用户输入、对话总结、记忆手册和最近 24 条消息触发。支持关键词、常驻、优先注入、概率、大小写敏感、主关键词和辅助关键词。`{{char}}`、`{{user}}`、`<char>`、`<user>` 等 token 会被替换成当前角色/用户名。

## 线上聊天

线上聊天通过 `generateRoleplayReply(input)` 调用 `buildPrompt(input)`。实际会读取：

| 提示词 / 上下文 | 来源 | 作用 |
| --- | --- | --- |
| `baseRoleplayPrompt` | `src/services/prompt.ts` | 角色总人设、信息边界、语言和行为底层规则。 |
| `strictRoleplayRules` | `src/services/prompt.ts` | 加强认知边界、朋友圈和 NPC 社交圈独立性。 |
| `profileMutationPrompt` | `src/services/prompt.ts` | 要求输出 JSON；规定 text、voice、image、location、transfer、sticker、narration、撤回、引用、转账处理、线下邀约、资料修改、Mood 内心独白等格式。 |
| `modeInstructions.online` | `src/services/prompt.ts` | 声明当前为社交软件线上聊天，并要求体现独立日程和消息节奏。 |
| `onlineChatPunctuationPrompt` | `src/services/prompt.ts` | 线上标点符号、空格、换行和聊天语气规则。默认开启，可通过 `buildPrompt` options 关闭。 |
| `onlineChatRoutineCarePrompt` | `src/services/prompt.ts` | 禁止把关心偷懒写成催睡觉、催休息、催下线、催吃饭。默认开启。 |
| `onlineStickerSemanticsPrompt` | `src/services/prompt.ts` | 要求不要过度解读用户 Sticker，优先理解文字内容。默认开启。 |
| `narrationModePrompt` | `src/services/prompt.ts` | 仅 `context.narrationModeEnabled` 开启时注入，要求 messages 中每轮交错输出 1-5 条旁白项，位置由数组顺序决定。 |
| 线下邀约关闭提示 | `buildPrompt` 内联字符串 | 当 `context.offlineInvitationEnabled === false` 时，强制 `offlineInvitation` 为 `null`。 |
| 媒体 / 转账规则 | `buildPrompt` 内联字符串 | 说明 Sticker、图片、语音、定位、转账在对话历史中的含义和可用输出。 |
| 可用 Sticker 列表 | `renderAvailableStickers(context)` | 限制角色只能主动发送列表内 Sticker。 |

修订建议：

- 要改线上输出 JSON 结构，优先改 `profileMutationPrompt`。
- 要改线上语气/标点，改 `onlineChatPunctuationPrompt`。
- 要改“不要催睡觉吃饭”等日常关心规则，改 `onlineChatRoutineCarePrompt`。
- 要改 Sticker 理解策略，改 `onlineStickerSemanticsPrompt`。
- 要改旁白模式的内容边界和文风，改 `narrationModePrompt`。

## 线下模式

线下模式同样通过 `generateRoleplayReply(input)` 调用 `buildPrompt(input)`，但 `context.mode` 为 `offline`。实际会读取：

| 提示词 / 上下文 | 来源 | 作用 |
| --- | --- | --- |
| `baseRoleplayPrompt` | `src/services/prompt.ts` | 角色总设定和通用行为/语言/边界规则。 |
| `strictRoleplayRules` | `src/services/prompt.ts` | 进一步限制全知视角、关系推进和社交圈串用。 |
| `offlineReplyOutputPrompt` | `src/services/prompt.ts` | 要求输出 JSON；正文只用一条 text；必须输出 6 条 `plotChoices`；不输出语音、图片、定位、转账、Sticker、旁白；不修改资料。 |
| `modeInstructions.offline` | `src/services/prompt.ts` | 声明当前为线下长文本 RP，可以描写同场互动，但仍遵守信息边界。 |
| `renderOfflineSettingsPrompt` | `src/services/prompt.ts` | 汇总线下章节写作设置。 |
| 时间感知 / 总结 / 记忆 / 世界书 / 最近对话 | `buildPrompt` | 提供剧情、关系、记忆和时间上下文。 |

`renderOfflineSettingsPrompt` 内部会根据会话线下设置继续拼接：

- `renderOfflineWritingStyleInstruction`：写作文风预设。特殊处理“白描 / 小薯片”，避免声称模仿具体作者。
- `renderOfflineToneInstruction`：基调预设。
- `renderOfflinePerspectiveInstruction`：叙事视角，包括上帝第三人称、角色第三人称、角色第二人称、用户第一人称、用户第二人称。
- `renderOfflinePsychologyInstruction`：是否输出 2-4 段角色心理描写。
- `renderOfflineInterruptionInstruction`：抢话模式或防抢话规则。
- `renderOfflineRetellInstruction`：是否在章节开头转述用户最新输入。
- `renderOfflineProhibitedInstruction`：线下禁用霸总、全知、围着用户转等写法。
- `renderOfflineRhythmInstruction`：正文字数、篇幅增强、对白比例、时间跳跃限制。
- 外貌、服饰、增加对话篇幅、段落模式等开关说明。
- `offlineSelfReviewPrompt`：输出前内部自检 12 项，只要求模型内部检查，不输出检查过程。

修订建议：

- 要改线下 JSON 输出格式，改 `offlineReplyOutputPrompt`。
- 要改线下文风、视角、心理、抢话、转述、篇幅等，改 `renderOfflineSettingsPrompt` 及其 helper。
- 要改默认线下设置或预设内容，查看 `src/utils/memory.ts` 中的 `defaultOfflineSettings` 和相关 preset helper。

## 群聊回复

群聊通过 `generateGroupChatReply(input)` 生成，不直接复用单角色的 `buildPrompt`，而是为每位已有角色建立独立的专属扮演上下文。每次回复会读取：

- 当前用户的真名、用户设定、LINK 网名和签名。
- 每位角色的当前角色设定、LINK 网名和签名，不使用建群时的旧设定快照代替当前设定。
- 该角色与当前用户的一对一会话总结、记忆手册和近期可见线上/线下对话。
- 当前模式对应的全局世界书，以及绑定到该角色的局部世界书；关键词条会结合群聊、私聊、总结和记忆触发。
- 当前群聊记忆、最近 36 条群消息、群公告、成员状态和可用 Sticker。

角色设定、用户设定、一对一会话总结、记忆手册、近期私聊/线下对话和世界书中的显式占位符 `{{char}}`、`<char>` 会在每位角色的专属上下文中展开为该角色姓名，`{{user}}`、`<user>` 会展开为当前用户姓名。同一群中的不同角色会分别解析，不会共用某一个角色名；普通昵称、代词、称谓和历史原文保持不变。

每个角色的一对一记忆和局部世界书只允许用于扮演该角色。其他群成员不能因同一次模型请求包含了这些上下文，就获知未在群内公开或转述的私聊秘密。

## 角色 VOOM 发帖

角色 VOOM 由 `generateVoomPost(context)` 触发，内部先调用 `generateDistinctVoomPayload`，再调用 `buildMomentPrompt(context)`。

`buildMomentPrompt(context)` 的结构：

1. 先调用 `buildPrompt(context, { includeOnlineChatPunctuation: false, includeOnlineStickerSemantics: false, includeOnlineRoutineCare: false, includeAvailableStickers: false })`。
2. 追加 `renderRecentVoomDiversityPrompt(context)`，读取 `context.recentVoomPosts`，把最近最多 12 条 VOOM 当作避雷表。
3. 追加“现在生成角色要发布的一条 LINK VOOM / 朋友圈动态，以及点赞和评论区”的任务提示。
4. 要求只输出 JSON：`content`、`contentTranslation`、`imageDescription`、`likes`、`comments`。

VOOM 发帖提示的重点约束：

- 作者固定为当前角色，点赞和评论 NPC 只能来自当前角色自己的社交圈。
- `content` 是角色真实发出的朋友圈正文，不解释设定。
- `imageDescription` 是配图画面描述，不是生图提示词，不写英文标签、相机参数、画质词或模型术语。
- `likes` 和 `comments` 不包含用户，不使用“NPC”占位名。
- 评论控制在 2-6 条，支持角色本人回复 NPC，回复必须用 `parentId` 表示。
- 每条 VOOM 必须和近期 VOOM 在话题、画面、情绪模板上明显不同。

`generateDistinctVoomPayload` 还会做相似度检查：如果候选 VOOM 和近期 VOOM 太相似，会最多重试 3 次，并追加“上一版候选因为和近期 VOOM 太相似被拒绝，请完全重写”的重写提示。

修订建议：

- 要改角色发 VOOM 的 JSON 格式或内容规则，改 `buildMomentPrompt`。
- 要改近期 VOOM 避雷策略，改 `renderRecentVoomDiversityPrompt` 或 `generateDistinctVoomPayload`。
- 注意 `buildMomentPrompt` 会关闭线上标点、Sticker 语义、日常关心和“角色可用 Stickers”列表，避免朋友圈生成被聊天规则干扰。

## 用户 VOOM 初始评论区

用户发布 VOOM 后，`generateUserVoomComments(input)` 会模拟可见角色及其各自社交圈 NPC 看到用户动态后的初始评论。这个功能不调用 `buildPrompt`，而是单独拼接提示词。

实际会读取：

| 提示词 / 上下文 | 来源 | 作用 |
| --- | --- | --- |
| 固定任务提示 | `generateUserVoomComments` 内联字符串 | “模拟 LINK VOOM 里，可见角色及其社交圈 NPC 看到用户动态后的自然评论区”。 |
| 时间感知 | `renderTimeAwarenessPrompt(input.timeAwareness)` | 可选注入当前时间和动态发布时间。 |
| 用户资料 | `input.author` | 用户真名、主页网名、用户设定。 |
| 用户动态 | `input.content` / `input.imageDescription` | 用户 VOOM 正文和配图描述。 |
| 可见角色线索 | `input.targetCharacters` | 每个角色的 id、真名、主页网名、签名、角色设定。 |
| JSON 输出格式 | `generateUserVoomComments` 内联字符串 | 要求输出 `comments`，每条含 `id`、`authorId`、`authorName`、`content`、`contentTranslation`、`parentId`。 |

重点约束：

- 提示词要求 2-15 条；归一化最多保留 15 条，模型无有效输出或调用失败时可为 0 条。
- 角色必须填写对应 `authorId`；没有 `authorId` 的具体姓名按 NPC 保留，NPC 不填 `authorId`。
- NPC 只能来自可见角色自己的设定、社交圈、朋友同事家人粉丝或已有评论线索，不得跨到无关角色。
- 每条评论都围绕用户动态；可以让角色和 NPC 围绕用户动态互相回复，但不模拟角色自己的 VOOM。
- 不代替用户本人评论。
- 评论要短、自然、有社交软件感。
- 外语、粤语都要翻译成自然现代简体普通话。

修订建议：

- 用户动态下面“可见角色及其 NPC 怎么评论”的规则都在 `generateUserVoomComments` 内联 prompt 中。
- 这个入口没有读取角色聊天的 `baseRoleplayPrompt`，如果想加强边界，需要在这里单独补规则。

## VOOM 评论区回复

VOOM 评论区继续回复由 `generateVoomCommentReplies(input)` 生成。实际会读取：

1. `buildPrompt(input.context, { includeAvailableStickers: false })`：完整读取当前执行角色的基础角色提示词、模式提示、总结、记忆、世界书、最近对话等，但不读取“角色可用 Stickers”列表。
2. 评论区任务提示：要求“模拟这条 VOOM 的真实评论区继续发展”。
3. 当前执行角色：当前角色真名和角色 ID。
4. VOOM 作者：帖子作者名；如果是用户发的，会标注“当前用户”。
5. 社交圈边界：
   - 用户发布的 VOOM：除当前执行角色本人外，不新增任何 NPC 作者，不替用户发言。
   - 角色发布的 VOOM：新增 NPC 只能来自这条 VOOM 作者所属角色自己的社交圈，禁止借用其他角色 NPC。
6. VOOM 正文：发布时间、正文、译文、配图描述。
7. 评论区全文：所有已有评论。
8. 优先关注评论：用户评论存在时优先关注用户评论，否则取帖子最近 2 条评论。
9. 禁用作者名：当前用户的 VOOM 网名和 AI 名，防止模型冒充用户发言。
10. JSON 输出格式：`replies` 数组，每条包含 `id`、`authorName`、`content`、`contentTranslation`、`parentId`。

重点约束：

- 输出 0-6 条。
- `authorName` 可以是当前执行角色真名，也可以是符合社交圈边界的 NPC 网名。
- 角色和 NPC 都可以发新评论或回复已有评论。
- 不代替用户发言，不使用“NPC”“路人”“朋友A”这类占位名。
- 评论短、自然、有上下文，不解释设定。
- 外语、粤语都要翻译成简体普通话。

修订建议：

- 要改角色在评论区怎么接话，改 `generateVoomCommentReplies` 的内联 prompt。
- 要改评论区可新增 NPC 的边界，改同一函数里的“社交圈边界”两段字符串。

## 小剧场

小剧场由 `generateSmallTheater(input)` 调用 `buildSmallTheaterPrompt(input)` 生成。实际会读取：

1. `buildPrompt(input.context, { includeAvailableStickers: false })`：完整基础角色提示词、模式提示、总结、记忆、世界书、最近对话、时间上下文等，但不读取“角色可用 Stickers”列表。
2. 小剧场任务提示：说明这是“独立番外页面”，不是聊天消息、不是 VOOM、不是记忆写入内容，也不会被 AI 后续读取。
3. 当前角色：角色名和角色 ID。
4. 当前题材：`input.topic.title` 和 `input.topic.prompt`。
5. 输出格式：只输出完整 HTML 文件代码块，不输出解释、JSON、Markdown 标题或代码块外文字。
6. HTML 要求：移动端适配、完整 `style` 和 `script`、至少 3 个交互点、不依赖网络、不加载外部资源、信息边界、番外不改变正文事实、JS 健壮、视觉完整。

注意：`buildSmallTheaterPrompt` 当前接收 `recentTheaters` 参数，但没有把近期小剧场内容拼入提示词。如果后续想让小剧场避重，可以在这里追加近期标题/摘要作为避雷表。

### 内置小剧场题材

内置题材来自 `src/utils/smallTheater.ts` 的 `defaultSmallTheaterTopicDrafts`：

| 标题 | 题材扩展提示 |
| --- | --- |
| 根据剧情随机发挥 | 从当前剧情、关系张力、近期对话和角色生活状态中随机发挥脑洞做成独立番外小剧场。 |
| 论坛 | 做成匿名论坛或贴吧式讨论串，围绕角色近期事件、传闻或生活片段展开，有楼层、回复、投票或折叠互动。 |
| 知乎 | 做成知乎问答页面，问题与角色近期经历相关，回答者可以是角色社交圈 NPC 或匿名用户，带赞同、评论、展开回答等互动。 |
| 角色所在群聊 | 做成角色所在群聊的番外页面，群成员只能来自该角色自己的社交圈，围绕一个小事件聊天、起哄、转移话题。 |
| 番外篇角色身边发生的几个小故事 | 做成几个短篇卡片或时间线，展示角色身边正在发生但不会进入正文会话的生活小故事。 |
| 番外篇角色社交圈 NPC 和角色发生的几个小故事 | 做成多段 NPC 视角的小故事，NPC 只能来自当前角色设定、世界书、记忆或当前上下文，不要借用其他角色社交圈。 |
| 深夜电台来信 | 做成深夜电台、匿名投稿或语音来信页面，用几封来信和主持回应折射角色近期情绪与人际关系。 |
| 角色手机相册翻页 | 做成手机相册或截图集，用户可以点击照片、便签、聊天截图或地点标签，拼出角色当天发生的小事。 |
| 平行世界一日 | 做成轻微 if 线番外，在不改变正文事实的前提下展示一个平行世界小切片，并明确它只是番外想象。 |
| 校园或职场传闻板 | 做成校园墙、公司茶水间、社团公告板或小道消息页面，围绕角色出现的细节、误会和旁观者反应展开。 |
| 失物招领与小道消息 | 做成失物招领、便利贴墙或公告栏互动页面，通过物品线索、留言和小传闻串起角色的生活片段。 |
| 互动小游戏番外 | 做成轻量互动小游戏或可点选分支页面，例如抽签、翻牌、解谜、消息回复选择，但内容仍围绕角色番外。 |

修订建议：

- 要改小剧场生成规则，改 `buildSmallTheaterPrompt`。
- 要改内置题材，改 `defaultSmallTheaterTopicDrafts`。
- 要让小剧场参考或避开近期小剧场，补充 `recentTheaters` 的拼接逻辑。

## 快速修订地图

| 想修改的内容 | 推荐位置 |
| --- | --- |
| 角色通用人设、信息边界、禁用表达 | `src/services/prompt.ts` 的 `baseRoleplayPrompt` |
| 严格认知边界、朋友圈和 NPC 社交圈边界 | `src/services/prompt.ts` 的 `strictRoleplayRules` |
| 线上聊天 JSON 输出结构和消息类型 | `src/services/prompt.ts` 的 `profileMutationPrompt` |
| 线下 RP JSON 输出结构和剧情选项 | `src/services/prompt.ts` 的 `offlineReplyOutputPrompt` |
| 线下文风、视角、心理、抢话、转述、篇幅 | `src/services/prompt.ts` 的 `renderOfflineSettingsPrompt` 及 helper |
| 线上标点规则 | `src/services/prompt.ts` 的 `onlineChatPunctuationPrompt` |
| 线上日常关心限制 | `src/services/prompt.ts` 的 `onlineChatRoutineCarePrompt` |
| Sticker 理解规则 | `src/services/prompt.ts` 的 `onlineStickerSemanticsPrompt` |
| 旁白模式 | `src/services/prompt.ts` 的 `narrationModePrompt` |
| 角色 VOOM 发帖 | `src/services/prompt.ts` 的 `buildMomentPrompt` |
| 近期 VOOM 避重 | `src/services/prompt.ts` 的 `renderRecentVoomDiversityPrompt`，`src/services/ai.ts` 的 `generateDistinctVoomPayload` |
| 用户 VOOM 初始评论 | `src/services/ai.ts` 的 `generateUserVoomComments` |
| VOOM 评论区回复 | `src/services/ai.ts` 的 `generateVoomCommentReplies` |
| 小剧场生成规则 | `src/services/ai.ts` 的 `buildSmallTheaterPrompt` |
| 小剧场内置题材 | `src/utils/smallTheater.ts` 的 `defaultSmallTheaterTopicDrafts` |
