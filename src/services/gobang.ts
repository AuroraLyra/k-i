import type { ChatGobangApiErrorCode, ChatGobangAttachment, GenerateReplyInput } from '@/types/domain';
import { extractJsonContent } from '@/utils/aiResponse';
import { gobangStoneForPlayer, GOBANG_BOARD_SIZE } from '@/utils/gobang';
import { normalizeRoleplayReplyPayload, requestTextGeneration, type RoleplayReplyResult } from './ai';
import { buildPrompt } from './prompt';

export interface GeneratedGobangMove {
  row: number;
  column: number;
}

export interface GeneratedGobangTurn extends GeneratedGobangMove {
  replyPayload: string;
  dialogue: string;
  dialogueTranslation: string;
}

export class GobangApiError extends Error {
  readonly code: ChatGobangApiErrorCode;

  constructor(code: ChatGobangApiErrorCode, message: string) {
    super(message);
    this.name = 'GobangApiError';
    this.code = code;
  }
}

function renderGobangBoard(game: ChatGobangAttachment) {
  const occupied = new Map(game.moves.map((move) => [`${move.row}:${move.column}`, move.player]));
  const header = `    ${Array.from({ length: GOBANG_BOARD_SIZE }, (_, column) => String(column).padStart(2, ' ')).join(' ')}`;
  const rows = Array.from({ length: GOBANG_BOARD_SIZE }, (_, row) => {
    const points = Array.from({ length: GOBANG_BOARD_SIZE }, (_, column) => {
      const player = occupied.get(`${row}:${column}`);
      return player === 'user' ? ' U' : player === 'char' ? ' C' : ' .';
    }).join(' ');
    return `${String(row).padStart(2, ' ')}  ${points}`;
  });
  return [header, ...rows].join('\n');
}

function renderMoveHistory(game: ChatGobangAttachment) {
  if (!game.moves.length) return '暂无落子。';
  return game.moves
    .map((move, index) => `${index + 1}. ${move.player === 'user' ? '用户 U' : '角色 C'} -> (${move.row}, ${move.column})`)
    .join('\n');
}

function buildGobangTurnPrompt(input: GenerateReplyInput, game: ChatGobangAttachment) {
  const contextPrompt = buildPrompt(input);
  const characterStone = gobangStoneForPlayer(game, 'char') === 'black' ? '黑棋' : '白棋';
  const userStone = game.userStone === 'black' ? '黑棋' : '白棋';
  const revision = game.revision ?? game.moves.length;

  return [
    contextPrompt,
    `══════════════════════════════════════\n当前特殊任务：五子棋完整角色回合\n══════════════════════════════════════

  以上角色设定、世界书、记忆手册、现实时间感知、关系状态、最近对话、线上消息输出规则、旁白模式和角色主页主题规则全部继续有效。你正在以同一个角色身份与用户下五子棋，需要亲自观察棋盘并决定这一手，同时自然生成落子后真正会发出的线上消息。

  这是一次且仅一次模型请求。落点、对白、旁白和本轮心声必须来自同一次内部判断，棋风、语气与情绪要彼此一致；绝对不要把落子和发言当成两个互不相关的任务，也不会再有第二次 API 请求替你补写发言。你可以在内部完整思考攻防、连线、阻挡和后续变化，但绝对不要输出分析过程、思维链、候选点或评分。

棋局协议：
- gameId: ${game.gameId}
- revision: ${revision}
- 棋盘：15 × 15，自由五子棋，任一方向连续五子或以上获胜
- 角色：C，执${characterStone}，当前必须落子
- 用户：U，执${userStone}
- 空位：.
- 坐标：row 和 column 均从 0 到 14

当前棋盘：
${renderGobangBoard(game)}

完整落子历史：
${renderMoveHistory(game)}

最终仍只输出一个 JSON 对象，不要 Markdown、代码围栏或 JSON 之外的文字。完整保留上文线上回复协议要求的 messages、messageActions、profileUpdate 等字段，并在同一个 JSON 顶层额外加入：
- "gameId": "${game.gameId}"
- "revision": ${revision}
- "row": 你观察棋盘后自行决定的 0 到 14 整数
- "column": 你观察棋盘后自行决定的 0 到 14 整数

硬性要求：
1. gameId 和 revision 必须原样返回。
2. row、column 必须是 0 到 14 的整数，并且目标位置必须是当前棋盘中的空位 .。
3. 只能返回角色 C 的一手，不得代替用户落子，不得一次返回多个坐标。
4. messages 中至少包含一条角色真正发出的 text 或 voice；这条发言必须与本次选择的落点、当前棋桌氛围和最近桌边对话自然连贯。
5. 不要在 messageActions 中再次发起或回应五子棋邀请，gobangInvite 与 gobangResponse 固定为 null；不要在可见消息中声称落在另一个位置。
6. 不得输出 reasoning、analysis、score、candidates 等思考字段。`
  ].join('\n\n');
}

function parseInteger(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d{1,2}$/.test(value.trim())) return Number(value.trim());
  return null;
}

function nestedResponseTexts(record: Record<string, unknown>) {
  const directTexts = [record.content, record.reply, record.text, record.output]
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
  const messageTexts = Array.isArray(record.messages)
    ? record.messages.flatMap((message) => {
      if (!message || typeof message !== 'object' || Array.isArray(message)) return [];
      const messageRecord = message as Record<string, unknown>;
      return [messageRecord.content, messageRecord.text]
        .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    })
    : [];
  return [...directTexts, ...messageTexts];
}

function normalizeMoveRecord(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const record = payload as Record<string, unknown>;
  const move = record.move;
  if (!move || typeof move !== 'object' || Array.isArray(move)) return record;
  return { ...record, ...(move as Record<string, unknown>) };
}

function validateGeneratedMove(record: Record<string, unknown>, game: ChatGobangAttachment): GeneratedGobangMove {
  const revision = game.revision ?? game.moves.length;
  if (record.gameId !== undefined && String(record.gameId) !== game.gameId) {
    throw new GobangApiError('invalid-response', '角色模型返回了其他棋局的落子。');
  }
  if (record.revision !== undefined && parseInteger(record.revision) !== revision) {
    throw new GobangApiError('invalid-response', '角色模型返回了不属于当前棋局版本的落子。');
  }

  const row = parseInteger(record.row);
  const column = parseInteger(record.column);
  if (row === null || column === null || row < 0 || row >= GOBANG_BOARD_SIZE || column < 0 || column >= GOBANG_BOARD_SIZE) {
    throw new GobangApiError('invalid-response', '角色模型返回的落子坐标超出棋盘范围。');
  }
  if (game.moves.some((move) => move.row === row && move.column === column)) {
    throw new GobangApiError('illegal-move', '角色模型选择了已有棋子的位置，本手没有生效。');
  }

  return { row, column };
}

function buildGeneratedTurn(record: Record<string, unknown>, game: ChatGobangAttachment, input: GenerateReplyInput): GeneratedGobangTurn {
  const move = validateGeneratedMove(record, game);
  const replyPayload = normalizeRoleplayReplyPayload(JSON.stringify(record), input);
  const reply = JSON.parse(replyPayload) as RoleplayReplyResult;
  const dialogueSegment = reply.segments?.find((segment) => segment.type === 'reply' || segment.type === 'voice');
  const dialogue = dialogueSegment && 'content' in dialogueSegment
    ? dialogueSegment.content.trim()
    : String(reply.replies?.[0] ?? reply.reply ?? '').trim();
  const dialogueTranslation = dialogueSegment && 'translation' in dialogueSegment
    ? String(dialogueSegment.translation ?? '').trim()
    : String(reply.replyTranslations?.[0] ?? '').trim();
  if (!dialogue) throw new GobangApiError('invalid-response', '角色模型没有在同一次思考中返回落子后的发言。');
  return { ...move, replyPayload, dialogue, dialogueTranslation };
}

function parseGobangTurnResponse(rawResponse: string, game: ChatGobangAttachment, input: GenerateReplyInput): GeneratedGobangTurn {
  let record: Record<string, unknown> | null = null;
  try {
    record = normalizeMoveRecord(JSON.parse(extractJsonContent(rawResponse)));
  } catch {
    record = null;
  }

  if (record && parseInteger(record.row) !== null && parseInteger(record.column) !== null) {
    return buildGeneratedTurn(record, game, input);
  }

  if (record) {
    for (const nestedText of nestedResponseTexts(record)) {
      try {
        return parseGobangTurnResponse(nestedText, game, input);
      } catch (error) {
        if (error instanceof GobangApiError && error.code !== 'invalid-response') throw error;
      }
    }
  }

  const preview = rawResponse.replace(/\s+/g, ' ').trim().slice(0, 180);
  throw new GobangApiError('invalid-response', `角色模型没有同时返回可解析的五子棋落点与发言。${preview ? ` 返回摘要：${preview}` : ''}`);
}

export function classifyGobangApiError(error: unknown): { code: ChatGobangApiErrorCode; message: string } {
  if (error instanceof GobangApiError) return { code: error.code, message: error.message };
  if (error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) {
    return { code: 'interrupted', message: error.name === 'TimeoutError' ? '角色落子请求超时，请重试这一手。' : '角色落子请求已中断，请重试这一手。' };
  }
  const message = error instanceof Error ? error.message.trim() : String(error ?? '').trim();
  const networkError = /network|fetch|cors|网络|代理|超时|timeout|502|503|504/i.test(message);
  return {
    code: networkError ? 'network' : 'unknown',
    message: message || '角色落子 API 请求失败。'
  };
}

export async function generateGobangMove(input: GenerateReplyInput, game: ChatGobangAttachment, signal?: AbortSignal) {
  const rawResponse = await requestTextGeneration(input.settings, buildGobangTurnPrompt(input, game), input.modelOverride, {
    temperature: 0.55,
    jsonMode: true,
    signal,
    retryTransientFailures: input.requestRecovery?.retryTransientFailures
  });
  if (!rawResponse.trim()) throw new GobangApiError('invalid-response', '角色模型没有返回五子棋落子与发言。');
  return parseGobangTurnResponse(rawResponse, game, input);
}
