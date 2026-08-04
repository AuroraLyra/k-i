export type TextApiErrorCategory =
  | 'content-blocked'
  | 'response-format-unsupported'
  | 'authentication'
  | 'rate-limited'
  | 'transient'
  | 'invalid-request'
  | 'unknown';

export interface TextApiErrorClassification {
  status: number;
  category: TextApiErrorCategory;
  code: string;
  type: string;
  param: string;
  providerMessage: string;
  retryable: boolean;
  responseFormatUnsupported: boolean;
}

function errorRecordFromPayload(payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const root = parsed as Record<string, unknown>;
    return root.error && typeof root.error === 'object' && !Array.isArray(root.error)
      ? root.error as Record<string, unknown>
      : root;
  } catch {
    return {};
  }
}

export function classifyTextApiHttpError(status: number, payload: string): TextApiErrorClassification {
  const errorRecord = errorRecordFromPayload(payload);
  const providerMessage = String(errorRecord.message ?? '').trim();
  const code = String(errorRecord.code ?? '').trim();
  const type = String(errorRecord.type ?? '').trim();
  const param = String(errorRecord.param ?? '').trim();
  const fingerprint = [providerMessage, code, type, param, payload].join(' ').toLocaleLowerCase();
  const contentBlocked = /prohibited[_ -]?content|prompt[_ -]?blocked|content[_ -]?(?:filter|blocked)|blocked by gemini|safety[_ -]?(?:policy|block|filter)|内容被禁止|提示词被拦截|安全策略(?:拒绝|拦截)/i.test(fingerprint);
  const mentionsResponseFormat = /response[_ -]?format|json[_ -]?(?:object|schema)|structured[_ -]?output|响应格式|结构化输出/i.test(fingerprint);
  const rejectsResponseFormat = /(?:not|isn't|is not|doesn't|does not)[^\n]{0,32}support|unsupported|unknown|unrecognized|not allowed|invalid (?:parameter|field)|extra inputs? (?:are|is) not permitted|不支持|未知参数|不允许|无效参数/i.test(fingerprint);
  const responseFormatUnsupported = [400, 415, 422].includes(status) && mentionsResponseFormat && rejectsResponseFormat;

  let category: TextApiErrorCategory = 'unknown';
  if (contentBlocked) category = 'content-blocked';
  else if (responseFormatUnsupported) category = 'response-format-unsupported';
  else if (status === 401 || status === 403) category = 'authentication';
  else if (status === 429) category = 'rate-limited';
  else if ([408, 409, 425].includes(status) || status >= 500) category = 'transient';
  else if (status >= 400 && status < 500) category = 'invalid-request';

  return {
    status,
    category,
    code,
    type,
    param,
    providerMessage,
    retryable: category === 'rate-limited' || category === 'transient',
    responseFormatUnsupported
  };
}

export class TextApiRequestError extends Error {
  readonly status: number;
  readonly category: TextApiErrorCategory;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, classification: TextApiErrorClassification) {
    super(message);
    this.name = 'TextApiRequestError';
    this.status = classification.status;
    this.category = classification.category;
    this.code = classification.code;
    this.retryable = classification.retryable;
  }
}

export function isNonRetryableTextApiError(error: unknown) {
  return error instanceof TextApiRequestError && !error.retryable;
}