import { unzipSync } from 'fflate';
import type { ApiVendor, AppSettings, CharacterProfile, ChatMessage, ConversationTimeAwarenessSettings, CoupleSpaceSnapshot, GenerateReplyInput, GroupDiscoveryCandidate, GroupMember, ImageProviderType, MusicComment, MusicTrack, NovelAiModelOption, PollinationsModelOption, PromptContext, SmallTheater, SmallTheaterTopic, UserProfile, VoomComment, VoomFrequency, VoomPost, WorldBookEntry } from '@/types/domain';
import { createId } from '@/utils/id';
import { getCharacterAiName } from '@/utils/character';
import { getUserAiName } from '@/utils/profile';
import { defaultNovelAiModels, defaultPollinationsModels, getResolvedApiConfig, getResolvedOpenAiImageConfig, isNovelAiV4FamilyModel, normalizeNovelAiUcPreset, novelAiOfficialApiUrl, novelAiProxyApiUrl } from '@/utils/settings';
import { estimateTokenCount } from '@/utils/memory';
import { getStickerDisplayImageUrl } from '@/utils/stickers';
import { assertRenderableSmallTheaterHtml, getSmallTheaterVisibleText, withSmallTheaterRuntimeGuard } from '@/utils/smallTheaterHtml';
import { renderTimeAwarenessPrompt } from '@/utils/timeAwareness';
import { formatContentWithChineseTranslation, normalizeTranslationText } from '@/utils/translation';
import { getVoomFrequencyChance, stripVoomCommentReplyPrefix } from '@/utils/voom';
import { normalizeCoupleSpaceSnapshot } from '@/utils/coupleSpace';
import { buildMomentPrompt, buildPrompt } from './prompt';
import { prependTabooWorldBookPrompt } from './tabooWorldBook';

const modelSelectionSeparator = '::';
const textProxyPath = '/__text-proxy';
const imageDownloadProxyPath = '/__image-download';

export interface ImageGenerationResult {
  imageUrl: string;
  provider: ImageProviderType;
}

export interface RoleplayQuoteAction {
  messageId: string;
  replyIndex: number;
}

export interface RoleplayMessageActions {
  recallMessageIds: string[];
  quotes: RoleplayQuoteAction[];
  transferDecisions?: Array<{ messageId: string; status: 'accepted' | 'rejected' }>;
  musicListenInviteDecisions?: Array<{ messageId: string; status: 'accepted' | 'rejected' }>;
  musicListenInvite?: { note?: string; query?: string; source?: string; track?: Partial<MusicTrack> } | null;
  musicActions?: RoleplayMusicAction[];
  offlineInvitation?: { prompt: string } | null;
  callInvite?: RoleplayCallInvite | null;
  callResponse?: RoleplayCallResponse | null;
  gobangInvite?: RoleplayGobangInvite | null;
  gobangResponse?: RoleplayGobangResponse | null;
  relationshipAction?: RoleplayRelationshipAction | null;
}

export interface RoleplayRelationshipAction {
  type: 'block' | 'delete' | 'request_friend' | 'accept_request' | 'reject_request';
  reason?: string;
}

export interface RoleplayMusicAction {
  type: 'play' | 'favorite_current' | 'favorite_track';
  query?: string;
  source?: string;
  track?: Partial<MusicTrack>;
}

export type RoleplayCallMode = 'voice' | 'video';

export type RoleplayCallResponseStatus = 'accepted' | 'rejected' | 'busy' | 'missed';

export interface RoleplayCallInvite {
  mode: RoleplayCallMode;
}

export interface RoleplayCallResponse {
  status: RoleplayCallResponseStatus;
}

export interface RoleplayGobangInvite {
  starter: 'char';
}

export interface RoleplayGobangResponse {
  status: 'accepted' | 'rejected';
}

export type RoleplayStickerPosition = 'before' | 'after';

export interface RoleplayStickerPlacement {
  replyIndex: number;
  position: RoleplayStickerPosition;
  stickers: string[];
}

export type RoleplayReplySegment =
  | { type: 'reply'; content: string; translation?: string }
  | { type: 'narration'; content: string }
  | { type: 'sticker'; stickers: string[] }
  | { type: 'image'; description: string; generationPrompt?: string }
  | { type: 'voice'; content: string; translation?: string; duration?: number }
  | { type: 'location'; name: string; address?: string; distance: string }
  | { type: 'transfer'; amount: string; note?: string }
  | { type: 'commerce'; kind: 'shopping' | 'takeout' | 'gift'; storeName: string; items: Array<{ name: string; quantity: number; price?: string }>; totalAmount: string; eta?: string; note?: string; cardMessage?: string }
  | { type: 'music_action'; actionIndex?: number };

export interface RoleplayReplyResult {
  reply: string;
  replies?: string[];
  plotChoices?: string[];
  replyTranslations?: string[];
  narrations?: string[];
  images?: Array<{ description: string; generationPrompt?: string }>;
  stickers?: string[];
  stickerPlacements?: RoleplayStickerPlacement[];
  segments?: RoleplayReplySegment[];
  messageActions?: RoleplayMessageActions;
  profileUpdate: null | {
    nickname: string;
    signature: string;
    narration: string;
    innerMonologue?: string[];
    profileThemeId?: string;
    profileThemeContent?: string;
  };
}

export interface VoomCommentReplyResult {
  authorName: string;
  content: string;
  contentTranslation?: string;
  parentId?: string;
  draftId?: string;
}

export type UserVoomCommentResult = Pick<VoomComment, 'authorName' | 'authorId' | 'content' | 'contentTranslation' | 'parentId'> & { draftId?: string };

export interface SmallTheaterGenerationResult {
  title: string;
  summary: string;
  html: string;
  model?: string;
}

export interface ImageGenerationOverrides {
  positivePrompt?: string;
  negativePrompt?: string;
  referenceImage?: string;
  width?: number;
  height?: number;
  size?: string;
  model?: string;
  seed?: string;
}

interface PreparedReferenceImage {
  dataUrl: string;
  base64: string;
  mimeType: string;
  filename: string;
}

function sanitizePrompt(positivePrompt: string, negativePrompt = '') {
  const positive = positivePrompt.trim();
  const negative = negativePrompt.trim();
  if (!positive) return '';
  if (!negative) return positive;
  return `${positive}\n\nAvoid: ${negative}`;
}

function toDataUrlFromBase64(base64: string, mimeType = 'image/png') {
  return `data:${mimeType};base64,${base64}`;
}

function parseDataUrlImage(value: string): PreparedReferenceImage | null {
  const match = value.trim().match(/^data:(image\/[^;,]+)(?:;[^,]*)?;base64,([\s\S]+)$/i);
  if (!match) return null;
  const mimeType = normalizeImageMimeType(match[1], 'image/png');
  const base64 = match[2].replace(/\s+/g, '');
  return {
    dataUrl: toDataUrlFromBase64(base64, mimeType),
    base64,
    mimeType,
    filename: `reference.${imageExtensionFromMimeType(mimeType)}`
  };
}

function imageExtensionFromMimeType(mimeType: string) {
  if (/webp/i.test(mimeType)) return 'webp';
  if (/jpe?g/i.test(mimeType)) return 'jpg';
  if (/gif/i.test(mimeType)) return 'gif';
  if (/svg/i.test(mimeType)) return 'svg';
  return 'png';
}

async function prepareReferenceImage(source: string, fallbackMimeType = 'image/png', apiKey = ''): Promise<PreparedReferenceImage | null> {
  const trimmed = source.trim();
  if (!trimmed) return null;
  const dataUrl = parseDataUrlImage(trimmed)?.dataUrl
    ?? (/^https?:\/\//i.test(trimmed) ? await fetchGeneratedImageUrlAsDataUrl(trimmed, fallbackMimeType, apiKey) : normalizeImageSourceWithMime(trimmed, fallbackMimeType).imageUrl);
  const parsed = parseDataUrlImage(dataUrl);
  return parsed;
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('图片转码失败。'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(blob);
  });
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, Math.min(index + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function arrayBufferToDataUrl(buffer: ArrayBuffer, mimeType = 'image/png') {
  return toDataUrlFromBase64(uint8ArrayToBase64(new Uint8Array(buffer)), mimeType);
}

function extractImageFromArchive(buffer: ArrayBuffer) {
  const files = unzipSync(new Uint8Array(buffer));
  const fileEntry = Object.entries(files).find(([name]) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    ?? Object.entries(files)[0];

  if (!fileEntry) {
    throw new Error('NovelAI returned an empty image archive.');
  }

  const [name, bytes] = fileEntry;
  const mimeType = /\.jpe?g$/i.test(name)
    ? 'image/jpeg'
    : /\.webp$/i.test(name)
      ? 'image/webp'
      : 'image/png';

  return arrayBufferToDataUrl(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), mimeType);
}

function parseSeed(seed: string) {
  const trimmed = seed.trim();
  if (!trimmed) return Math.floor(Math.random() * 2_147_483_647);
  const numericSeed = Number(trimmed);
  return Number.isFinite(numericSeed) ? Math.floor(numericSeed) : Math.floor(Math.random() * 2_147_483_647);
}

function buildNovelAiImageRequestBody(
  config: AppSettings['imageNovelAi'],
  positivePrompt: string,
  negativePrompt: string,
  referenceImage: PreparedReferenceImage | null,
  overrides: ImageGenerationOverrides
) {
  const prompt = positivePrompt.trim();
  const uc = negativePrompt.trim();
  const model = String(overrides.model ?? config.model).trim();
  const parameters: Record<string, unknown> = {
    negative_prompt: uc,
    width: Math.max(320, Math.floor(overrides.width ?? config.width)),
    height: Math.max(320, Math.floor(overrides.height ?? config.height)),
    scale: config.guidance,
    sampler: config.sampler,
    steps: config.steps,
    seed: parseSeed(overrides.seed ?? config.seed),
    n_samples: 1,
    ucPreset: normalizeNovelAiUcPreset(model, config.ucPreset),
    qualityToggle: config.qualityToggle,
    sm: config.sm,
    sm_dyn: config.smDyn,
    dynamic_thresholding: config.dynamicThresholding,
    legacy: false,
    add_original_image: false,
    uncond_scale: 1,
    cfg_rescale: config.cfgRescale,
    noise_schedule: config.noiseSchedule,
    controlnet_strength: 1
  };

  if (isNovelAiV4FamilyModel(model)) {
    Object.assign(parameters, {
      params_version: 3,
      legacy_v3_extend: false,
      legacy_uc: false,
      deliberate_euler_ancestral_bug: false,
      prefer_brownian: true,
      reference_image_multiple: [],
      reference_information_extracted_multiple: [],
      reference_strength_multiple: [],
      normalize_reference_strength_multiple: true,
      characterPrompts: [],
      v4_prompt: {
        caption: { base_caption: prompt, char_captions: [] },
        use_coords: false,
        use_order: true
      },
      v4_negative_prompt: {
        caption: { base_caption: uc, char_captions: [] },
        legacy_uc: false
      }
    });
  }

  if (referenceImage) {
    Object.assign(parameters, {
      image: referenceImage.base64,
      strength: 0.45,
      noise: 0.15,
      add_original_image: true
    });
  }

  return {
    action: referenceImage ? 'img2img' : 'generate',
    input: prompt,
    model,
    parameters
  };
}

function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

function createImageDownloadUrl(url: string) {
  const trimmed = url.trim();
  if (canUseLocalTextProxy() && /^https?:\/\//i.test(trimmed)) {
    return `${imageDownloadProxyPath}?url=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

const imageDownloadAcceptHeader = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8';

function createImageDownloadHeaders(apiKey = '') {
  const headers: HeadersInit = { Accept: imageDownloadAcceptHeader };
  const normalizedApiKey = apiKey.trim();
  if (normalizedApiKey) headers.Authorization = `Bearer ${normalizedApiKey}`;
  return headers;
}

function inferImageMimeType(url: string, fallback = 'image/png') {
  const pathname = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  if (/\.jpe?g$/i.test(pathname)) return 'image/jpeg';
  if (/\.gif$/i.test(pathname)) return 'image/gif';
  if (/\.webp$/i.test(pathname)) return 'image/webp';
  if (/\.avif$/i.test(pathname)) return 'image/avif';
  if (/\.bmp$/i.test(pathname)) return 'image/bmp';
  if (/\.svg$/i.test(pathname)) return 'image/svg+xml';
  return fallback;
}

function normalizeImageMimeType(value: unknown, fallback = 'image/png') {
  const trimmed = String(value ?? '').trim().toLowerCase();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('image/')) return trimmed;
  if (trimmed === 'jpg') return 'image/jpeg';
  if (trimmed === 'svg') return 'image/svg+xml';
  if (['png', 'jpeg', 'webp', 'gif', 'avif', 'bmp', 'svg+xml'].includes(trimmed)) {
    return `image/${trimmed}`;
  }
  return fallback;
}

function getDownloadedImageMimeType(blob: Blob, contentType: string, imageUrl: string, fallbackMimeType: string) {
  const normalizedContentType = contentType.trim().toLowerCase();
  const normalizedBlobType = blob.type.trim().toLowerCase();
  if (/^(?:text\/|application\/(?:json|xml|xhtml\+xml))/i.test(normalizedContentType)) return '';
  if (/^(?:text\/|application\/(?:json|xml|xhtml\+xml))/i.test(normalizedBlobType)) return '';
  return normalizeImageMimeType(normalizedBlobType || normalizedContentType || inferImageMimeType(imageUrl, fallbackMimeType), fallbackMimeType);
}

async function readDownloadedImageResponse(response: Response, imageUrl: string, fallbackMimeType: string) {
  if (!response.ok) {
    throw new Error(`图片下载返回 ${formatHttpStatus(response) || '请求失败'}`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  const downloadedBlob = await response.blob();
  if (!downloadedBlob.size) throw new Error('图片下载结果为空。');

  const mimeType = getDownloadedImageMimeType(downloadedBlob, contentType, imageUrl, fallbackMimeType);
  if (!mimeType.startsWith('image/')) throw new Error(`图片下载返回了非图片内容：${contentType || downloadedBlob.type || 'unknown'}`);

  return readBlobAsDataUrl(downloadedBlob.type === mimeType ? downloadedBlob : new Blob([downloadedBlob], { type: mimeType }));
}

async function fetchGeneratedImageUrlAsDataUrl(imageUrl: string, fallbackMimeType: string, apiKey = '') {
  const proxyEndpoint = createImageDownloadUrl(imageUrl);
  const attempts = [
    { label: '同源下载代理（带鉴权）', endpoint: proxyEndpoint, headers: createImageDownloadHeaders(apiKey), enabled: Boolean(apiKey) },
    { label: '同源下载代理', endpoint: proxyEndpoint, headers: createImageDownloadHeaders(), enabled: true },
    { label: '浏览器直连（带鉴权）', endpoint: imageUrl, headers: createImageDownloadHeaders(apiKey), enabled: Boolean(apiKey) && proxyEndpoint !== imageUrl },
    { label: '浏览器直连', endpoint: imageUrl, headers: createImageDownloadHeaders(), enabled: proxyEndpoint !== imageUrl }
  ];

  let lastError: unknown = null;
  for (const attempt of attempts) {
    if (!attempt.enabled) continue;
    for (let retryIndex = 0; retryIndex <= openAiImageRetryDelays.length; retryIndex += 1) {
      try {
        const response = await fetch(attempt.endpoint, { headers: attempt.headers });
        if (!response.ok && transientOpenAiImageStatuses.has(response.status) && retryIndex < openAiImageRetryDelays.length) {
          const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
          await wait(retryAfter || openAiImageRetryDelays[retryIndex]);
          continue;
        }
        return await readDownloadedImageResponse(response, imageUrl, fallbackMimeType);
      } catch (error) {
        lastError = error instanceof Error ? new Error(`${attempt.label}失败：${error.message}`) : error;
        if (retryIndex < openAiImageRetryDelays.length) {
          await wait(openAiImageRetryDelays[retryIndex]);
          continue;
        }
        break;
      }
    }
  }

  throw lastError ?? new Error('图片 URL 下载失败。');
}

function unwrapOpenAiImageEndpoint(endpoint: string) {
  if (!endpoint.startsWith('/__image-proxy')) return endpoint;
  try {
    return new URL(endpoint, window.location.origin).searchParams.get('url')?.trim() || endpoint;
  } catch {
    return endpoint;
  }
}

function isOpenAiResponsesEndpoint(endpoint: string) {
  const unwrappedEndpoint = unwrapOpenAiImageEndpoint(endpoint);
  try {
    return /\/responses\/?$/i.test(new URL(unwrappedEndpoint, window.location.origin).pathname);
  } catch {
    return /\/responses(?:\?|$)/i.test(unwrappedEndpoint);
  }
}

function getOpenAiReferenceImageEndpoint(endpoint: string) {
  if (isOpenAiResponsesEndpoint(endpoint)) return endpoint;
  const convertPath = (value: string) => value.replace(/\/images\/generations(?=\/?(?:[?#]|$))/i, '/images/edits');
  if (!endpoint.startsWith('/__image-proxy')) return convertPath(endpoint);
  try {
    const proxyUrl = new URL(endpoint, window.location.origin);
    const targetUrl = proxyUrl.searchParams.get('url') ?? '';
    if (targetUrl) proxyUrl.searchParams.set('url', convertPath(targetUrl));
    return `${proxyUrl.pathname}${proxyUrl.search}`;
  } catch {
    return endpoint;
  }
}

function supportsB64JsonResponseFormat(model: string) {
  return /^dall-e-(?:2|3)$/i.test(model.trim());
}

function buildOpenAiImageRequestBody(endpoint: string, model: string, prompt: string, size: string, preferBase64ImageResponse = false, referenceImage?: PreparedReferenceImage | null) {
  if (isOpenAiResponsesEndpoint(endpoint)) {
    return {
      model,
      input: referenceImage
        ? [{
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', image_url: referenceImage.dataUrl }
            ]
          }]
        : prompt,
      tools: [{
        type: 'image_generation',
        action: 'generate',
        ...(size ? { size } : {})
      }],
      tool_choice: 'required'
    };
  }

  return {
    model,
    prompt,
    ...(size ? { size } : {}),
    ...(preferBase64ImageResponse && supportsB64JsonResponseFormat(model) ? { response_format: 'b64_json' } : {}),
    n: 1
  };
}

function buildOpenAiImageEditFormData(model: string, prompt: string, size: string, referenceImage: PreparedReferenceImage) {
  const formData = new FormData();
  const bytes = Uint8Array.from(atob(referenceImage.base64), (character) => character.charCodeAt(0));
  formData.set('model', model);
  formData.set('prompt', prompt);
  if (size) formData.set('size', size);
  formData.set('n', '1');
  formData.set('image', new Blob([bytes], { type: referenceImage.mimeType }), referenceImage.filename);
  return formData;
}

const httpStatusText: Record<number, string> = {
  408: 'Request Timeout',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  520: 'Unknown Error',
  522: 'Connection Timed Out',
  524: 'A Timeout Occurred'
};

const transientOpenAiImageStatuses = new Set([408, 429, 500, 502, 503, 504, 520, 522, 524]);
const openAiImageRetryDelays = [1200];

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function parseRetryAfter(value: string | null) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : 0;
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlTagText(payload: string, tagName: string) {
  const match = payload.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? stripHtml(match[1]) : '';
}

function extractCloudflareHost(payload: string) {
  const hostBlock = payload.match(/<div[^>]+id=["']cf-host-status["'][\s\S]*?<\/div>/i)?.[0] ?? '';
  const labels = [...hostBlock.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
  return labels.find((label) => label.includes('.')) ?? '';
}

function extractCloudflareErrorPayload(payload: string) {
  if (!/cloudflare|cf-error-details|cf-wrapper/i.test(payload)) return '';

  const title = extractHtmlTagText(payload, 'title') || extractHtmlTagText(payload, 'h1');
  const errorCode = payload.match(/Error code\s*(\d{3})/i)?.[1] ?? payload.match(/\b(5\d{2}|524)\b/)?.[1] ?? '';
  const rayId = payload.match(/Cloudflare Ray ID:\s*<strong[^>]*>([^<]+)<\/strong>/i)?.[1]?.trim() ?? '';
  const host = extractCloudflareHost(payload);
  const happenedBlock = payload.match(/What happened\?[\s\S]*?<\/h2>([\s\S]*?)(?:<\/div>|<h2)/i)?.[1] ?? '';
  const happened = stripHtml(happenedBlock);

  return [
    title || (errorCode ? `Cloudflare ${errorCode} 错误` : 'Cloudflare 网关错误'),
    host ? `异常主机：${host}` : '',
    rayId ? `Cloudflare Ray ID：${rayId}` : '',
    happened ? `说明：${happened}` : '',
    '这通常表示图片供应商网关或其上游模型服务暂时不可用，不是本地请求格式错误。'
  ].filter(Boolean).join('\n');
}

function formatHttpStatus(response: Response) {
  const statusText = response.statusText.trim() || httpStatusText[response.status] || '';
  return [response.status || '', statusText].filter(Boolean).join(' ');
}

function formatApiErrorPayload(payload: string) {
  const trimmed = payload.trim();
  if (!trimmed) return '';

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    const cloudflareError = extractCloudflareErrorPayload(trimmed);
    if (cloudflareError) return cloudflareError;

    if (/^\s*<!doctype html|^\s*<html[\s>]/i.test(trimmed)) {
      const title = extractHtmlTagText(trimmed, 'title') || extractHtmlTagText(trimmed, 'h1');
      const body = stripHtml(trimmed).slice(0, 800);
      return [title, body && body !== title ? body : ''].filter(Boolean).join('\n') || '上游返回了 HTML 错误页。';
    }

    return trimmed;
  }
}

async function createApiErrorMessage(response: Response, title: string) {
  let details = '';
  try {
    details = formatApiErrorPayload(await response.text());
  } catch (error) {
    details = `读取后台日志失败：${error instanceof Error ? error.message : String(error)}`;
  }

  const status = formatHttpStatus(response);
  return [
    `${title}：${status || '请求失败'}`,
    details ? `后台日志：\n${details}` : ''
  ].filter(Boolean).join('\n\n');
}

async function readJsonPayload(response: Response, title: string) {
  const responseClone = response.clone();
  try {
    return await response.json();
  } catch (error) {
    let details = '';
    try {
      details = formatApiErrorPayload(await responseClone.text());
    } catch {
      details = error instanceof Error ? error.message : String(error);
    }

    const status = formatHttpStatus(response);
    throw new Error([
      `${title}：${status || '返回内容不是 JSON'}`,
      details ? `后台日志：\n${details}` : '请确认当前服务端实际挂载了同源代理，而不是把代理路径回退到了前端页面。'
    ].filter(Boolean).join('\n\n'));
  }
}

function createNetworkErrorMessage(error: unknown, title: string, endpoint: string, hint = '浏览器直连 OpenAI 兼容图片网关可能会被 CORS 或网络策略拦截。本地开发会通过同源代理请求；如果仍失败，请确认网关可访问、支持图片生成路径，并且 API Key 与模型可用。') {
  const message = error instanceof Error ? error.message : String(error);
  return [
    `${title}：${message || '网络请求失败'}`,
    `请求地址：${endpoint}`,
    hint
  ].join('\n\n');
}

function isLocalProxyHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost'
    || normalized.endsWith('.localhost')
    || normalized.endsWith('.local')
    || normalized === '127.0.0.1'
    || normalized === '0.0.0.0'
    || normalized === '::1'
    || normalized === '[::1]'
    || /^10\./.test(normalized)
    || /^192\.168\./.test(normalized)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized)
    || /^169\.254\./.test(normalized);
}

function isLikelyViteProxyPort(port: string) {
  return port === '5173' || port === '4173';
}

function canUseLocalTextProxy() {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;
  if (!['http:', 'https:'].includes(window.location.protocol)) return false;
  return isLocalProxyHostname(window.location.hostname) || isLikelyViteProxyPort(window.location.port);
}

function createTextProxyEndpoint(endpoint: string) {
  const trimmed = endpoint.trim();
  return `${textProxyPath}?url=${encodeURIComponent(trimmed)}`;
}

function createTextRequestEndpoints(endpoint: string) {
  const trimmed = endpoint.trim();
  if (!/^https?:\/\//i.test(trimmed)) return [trimmed];

  const proxyEndpoint = createTextProxyEndpoint(trimmed);
  const endpoints = canUseLocalTextProxy()
    ? [proxyEndpoint, trimmed]
    : [trimmed, proxyEndpoint];

  return endpoints.filter((item, index) => item && endpoints.indexOf(item) === index);
}

function createTextNetworkErrorMessage(error: unknown, endpoint: string, requestEndpoint: string) {
  return createNetworkErrorMessage(
    error,
    '文本模型网络请求失败',
    endpoint,
    requestEndpoint.startsWith(textProxyPath)
      ? '本地同源文本代理没有响应。请确认正在通过 npm run dev 或 npm run preview 访问应用；如果仍失败，请检查本机网络、代理节点、网关地址、API Key 与模型是否可用。'
      : '当前运行环境没有可用的同源文本代理，浏览器直连 OpenAI 兼容聊天网关可能会被 CORS 或网络策略拦截。请使用 npm run dev / npm run preview，或换用支持浏览器跨域的网关。'
  );
}

function waitForTextApiRetry() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 800);
  });
}

function shouldRetryTextApiResponse(response: Response) {
  return response.status === 405 || response.status === 429 || response.status >= 500;
}

function createTextApiStatusHint(response: Response, endpoint: string) {
  if (response.status !== 405) return '';
  return [
    `请求地址：${endpoint}`,
    '405 通常表示上游网关不接受当前路径或请求方法。请确认 API Url 只填到 /v1 这一层，API 路径为 /chat/completions；如果配置无误，多半是供应商兼容网关短暂路由异常，可稍后重试或切换供应商。'
  ].join('\n');
}

function createNovelAiNetworkErrorMessage(error: unknown, endpoint: string, requestEndpoint: string) {
  return createNetworkErrorMessage(
    error,
    'NovelAI 接口网络请求失败',
    endpoint,
    requestEndpoint.startsWith(textProxyPath)
      ? 'NovelAI 请求无法通过本地同源代理到达后台。请确认正在通过 npm run dev 或 npm run preview 访问应用，并检查本机网络、代理节点和 Token 是否可用。'
      : 'NovelAI 请求无法到达后台。请确认连接方式、网络代理和 Token 可用。本地开发/预览会优先通过同源代理转发官方接口。'
  );
}

async function fetchTextEndpointWithFallback(
  endpoint: string,
  init: RequestInit,
  createErrorMessage: (error: unknown, endpoint: string, requestEndpoint: string) => string
) {
  const requestEndpoints = createTextRequestEndpoints(endpoint);
  let lastError: unknown;
  let lastRequestEndpoint = requestEndpoints[0] ?? endpoint;

  for (const requestEndpoint of requestEndpoints) {
    lastRequestEndpoint = requestEndpoint;
    try {
      const response = await fetch(requestEndpoint, init);
      return { response, requestEndpoint };
    } catch (error) {
      if (init.signal?.aborted) throw init.signal.reason instanceof Error ? init.signal.reason : error;
      lastError = error;
    }
  }

  throw new Error(createErrorMessage(lastError, endpoint, lastRequestEndpoint));
}

async function fetchTextEndpoint(endpoint: string, init: RequestInit) {
  return fetchTextEndpointWithFallback(endpoint, init, createTextNetworkErrorMessage);
}

async function fetchNovelAiEndpoint(endpoint: string, init: RequestInit) {
  return fetchTextEndpointWithFallback(endpoint, init, createNovelAiNetworkErrorMessage);
}

async function probeNovelAiAuth(settings: AppSettings) {
  const config = settings.imageNovelAi;
  const endpointBase = resolveNovelAiEndpointBase(settings);
  if (config.endpointMode === 'custom') return;

  const endpoints = [
    `${endpointBase}/user/subscription`,
    `${endpointBase}/ai/generate-image/models`,
    `${endpointBase}/ai/models`
  ];

  let lastFailure: Response | null = null;
  for (const endpoint of endpoints) {
    const { response } = await fetchNovelAiEndpoint(endpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey.trim()}`
      }
    });

    if (response.status === 401 || response.status === 403) {
      throw new Error('NovelAI Token 无法通过鉴权。');
    }

    if (response.ok) {
      return;
    }

    lastFailure = response;
  }

  if (lastFailure) {
    throw new Error(await createApiErrorMessage(lastFailure, 'NovelAI 鉴权/模型接口探测失败'));
  }
}

function getOpenAiImageErrorTitle(response: Response, endpoint: string) {
  if (endpoint.startsWith('/__image-proxy')) {
    return response.headers.get('x-link-proxy-error')
      ? '本地 OpenAI 兼容图片代理请求失败'
      : 'OpenAI 兼容图片网关请求失败';
  }

  return 'OpenAI 图片请求失败';
}

async function fetchOpenAiImageWithRetry(endpoint: string, init: RequestInit) {
  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt <= openAiImageRetryDelays.length; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(endpoint, init);
    } catch (error) {
      lastNetworkError = error;
      if (attempt >= openAiImageRetryDelays.length) break;
      await wait(openAiImageRetryDelays[attempt]);
      continue;
    }

    if (!response.ok && transientOpenAiImageStatuses.has(response.status) && attempt < openAiImageRetryDelays.length) {
      const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
      await wait(retryAfter || openAiImageRetryDelays[attempt]);
      continue;
    }

    return response;
  }

  throw lastNetworkError ?? new Error('图片请求失败。');
}

function normalizeImageSource(value: unknown) {
  return normalizeImageSourceWithMime(value).imageUrl;
}

function normalizeImageSourceWithMime(value: unknown, mimeType = 'image/png') {
  const source = String(value ?? '').trim();
  if (!source) {
    return {
      imageUrl: '',
      mimeType
    };
  }
  if (/^(?:data:image\/|blob:)/i.test(source)) {
    return {
      imageUrl: source,
      mimeType
    };
  }
  if (/^https?:/i.test(source)) {
    return {
      imageUrl: source,
      mimeType: inferImageMimeType(source, mimeType)
    };
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(source) && source.length > 80) {
    return {
      imageUrl: toDataUrlFromBase64(source, mimeType),
      mimeType
    };
  }
  return {
    imageUrl: '',
    mimeType
  };
}

async function localizeGeneratedImageUrl(imageUrl: string, fallbackMimeType = 'image/png', apiKey = '') {
  const trimmed = imageUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    return await fetchGeneratedImageUrlAsDataUrl(trimmed, fallbackMimeType, apiKey);
  } catch (error) {
    throw new Error(`OpenAI 图片接口返回了远程图片地址，但本地化下载失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function extractGeneratedImage(payload: unknown, fallbackMimeType = 'image/png'): { imageUrl: string; mimeType: string } {
  if (Array.isArray(payload)) {
    for (const item of payload) {
      const image = extractGeneratedImage(item, fallbackMimeType);
      if (image.imageUrl) return image;
    }
    return { imageUrl: '', mimeType: fallbackMimeType };
  }

  if (!payload || typeof payload !== 'object') {
    return normalizeImageSourceWithMime(payload, fallbackMimeType);
  }

  const record = payload as Record<string, unknown>;
  const candidateMimeType = normalizeImageMimeType(
    record.output_format
      ?? record.outputFormat
      ?? record.mime_type
      ?? record.mimeType
      ?? record.content_type
      ?? record.contentType
      ?? record.format,
    fallbackMimeType
  );
  const directCandidates = [
    record.url,
    record.imageUrl,
    record.image_url,
    record.outputUrl,
    record.output_url,
    record.resultUrl,
    record.result_url,
    record.b64_json,
    record.b64Json,
    record.base64,
    record.image_base64,
    record.imageBase64,
    record.result_base64,
    record.resultBase64
  ];

  for (const candidate of directCandidates) {
    const image = normalizeImageSourceWithMime(candidate, candidateMimeType);
    if (image.imageUrl) return image;
  }

  const nestedCandidates = [record.data, record.images, record.image, record.imageUrl, record.image_url, record.output, record.result, record.results, record.artifacts];
  for (const candidate of nestedCandidates) {
    const image = extractGeneratedImage(candidate, candidateMimeType);
    if (image.imageUrl) return image;
  }

  return { imageUrl: '', mimeType: fallbackMimeType };
}

function splitModelSelection(selection = '') {
  const trimmed = selection.trim();
  if (!trimmed.includes(modelSelectionSeparator)) {
    return {
      vendorId: '',
      model: trimmed
    };
  }
  const [vendorId, ...modelParts] = trimmed.split(modelSelectionSeparator);
  return {
    vendorId: vendorId.trim(),
    model: modelParts.join(modelSelectionSeparator).trim()
  };
}

function extractJsonContent(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

function normalizeTextFragments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeTextFragments(item));
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const content = String(value).trim();
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.content, record.text, record.message, record.reply];
    for (const candidate of candidates) {
      const fragments = normalizeTextFragments(candidate);
      if (fragments.length) return fragments;
    }
  }
  return [];
}

function normalizeReplyMessages(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return normalizeTextFragments(payload);
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.replies, record.reply, record.messages, record.content, record.message, record.text, record.response, record.output];
  for (const candidate of candidates) {
    const replies = normalizeTextFragments(candidate);
    if (replies.length) return replies;
  }
  return [];
}

const plotChoiceBlockPattern = /(?:\[\[PLOT_CHOICES\]\]|【剧情选择】|<plotChoices>)([\s\S]*?)(?:\[\[\/PLOT_CHOICES\]\]|【\/剧情选择】|<\/plotChoices>)/gi;

function parsePlotChoicesFromText(content: string) {
  const choices: string[] = [];
  const cleaned = content.replace(plotChoiceBlockPattern, (_match, body: string) => {
    choices.push(...normalizePlotChoices(body));
    return '';
  }).trim();
  return { content: cleaned, choices };
}

function normalizePlotChoices(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizePlotChoices(item)).slice(0, 6);
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
      .split(/\r?\n+/)
      .map((item) => item.replace(/^(?:[-*•]|\d+[.)、：:]|选项\s*\d+[:：]?|剧情\s*\d+[:：]?)\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 6);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.content, record.text, record.choice, record.option, record.direction, record.summary];
    for (const candidate of candidates) {
      const choices = normalizePlotChoices(candidate);
      if (choices.length) return choices;
    }
  }
  return [];
}

function normalizeNestedPlotChoices(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeNestedPlotChoices(item)).slice(0, 6);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [
    ...normalizePlotChoices(record.plotChoices),
    ...normalizePlotChoices(record.choices),
    ...normalizePlotChoices(record.storyChoices),
    ...normalizePlotChoices(record.directions)
  ].slice(0, 6);
}

function normalizeTranslationFragments(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeTranslationFragments(item));
  if (typeof value === 'string' || typeof value === 'number') {
    const content = normalizeTranslationText(value);
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.contentTranslation, record.translation, record.translationZh, record.chineseTranslation, record.chinese, record.zh, record.cn, record.translatedContent];
    for (const candidate of candidates) {
      const fragments = normalizeTranslationFragments(candidate);
      if (fragments.length) return fragments;
    }
  }
  return [];
}

function normalizeTranslationSlot(value: unknown) {
  return normalizeTranslationFragments(value).join('\n');
}

function normalizeTranslationList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => normalizeTranslationSlot(item));
  const translation = normalizeTranslationSlot(value);
  return translation ? [translation] : [];
}

function normalizeNestedTranslationFragments(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => normalizeTranslationSlot(item));
  if (value && typeof value === 'object') return normalizeTranslationList(value);
  return [];
}

function normalizeTranslationMessages(payload: unknown) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return normalizeTranslationFragments(payload);
  }

  const record = payload as Record<string, unknown>;
  const candidates = [record.replyTranslations, record.translations, record.translationTexts, record.chineseTranslations, record.translation, record.contentTranslation];
  for (const candidate of candidates) {
    const translations = normalizeTranslationList(candidate);
    if (translations.length) return translations;
  }

  const nestedCandidates = [record.replies, record.messages, record.reply, record.content, record.message, record.text];
  for (const candidate of nestedCandidates) {
    const translations = normalizeNestedTranslationFragments(candidate);
    if (translations.length) return translations;
  }
  return [];
}

function normalizeStickerSelections(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeStickerSelections(item));
  if (typeof value === 'string' || typeof value === 'number') {
    const content = String(value).trim();
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.stickerId, record.id, record.description, record.name, record.label, record.text];
    for (const candidate of candidates) {
      const selections = normalizeStickerSelections(candidate);
      if (selections.length) return selections;
    }
    return normalizeStickerSelections(record.stickers ?? record.stickerIds ?? record.sticker);
  }
  return [];
}

function normalizeStickerPosition(value: unknown, fallback: RoleplayStickerPosition = 'after'): RoleplayStickerPosition {
  const position = String(value ?? '').trim().toLocaleLowerCase();
  return position === 'before' || position === 'after' ? position : fallback;
}

function normalizeStickerPlacementRecord(value: unknown, fallbackReplyIndex = 0, fallbackPosition: RoleplayStickerPosition = 'after'): RoleplayStickerPlacement[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  const rawReplyIndex = Number(record.replyIndex ?? record.index ?? record.messageIndex ?? record.replyNumber);
  const replyIndex = Number.isFinite(rawReplyIndex)
    ? Math.max(0, Math.floor(rawReplyIndex))
    : fallbackReplyIndex;
  const position = normalizeStickerPosition(record.position ?? record.placement ?? record.where, fallbackPosition);
  const directSelections = [
    ...normalizeStickerSelections(record.stickers),
    ...normalizeStickerSelections(record.stickerIds),
    ...normalizeStickerSelections(record.sticker),
    ...normalizeStickerSelections(record.stickerId)
  ];
  const fallbackSelections = directSelections.length ? [] : normalizeStickerSelections(record.id ?? record.description ?? record.name ?? record.label ?? record.text);
  const stickers = [...new Set([...directSelections, ...fallbackSelections].map((item) => item.trim()).filter(Boolean))];
  return stickers.length ? [{ replyIndex, position, stickers }] : [];
}

function normalizeStickerPlacements(value: unknown): RoleplayStickerPlacement[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeStickerPlacements(item));
  return normalizeStickerPlacementRecord(value);
}

function normalizeReplyStickerPlacements(value: unknown): RoleplayStickerPlacement[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const inlinePosition = normalizeStickerPosition(record.stickerPosition ?? record.position, 'after');
      return [
        ...normalizeStickerPlacementRecord({ replyIndex: index, position: 'before', stickers: record.stickersBefore ?? record.beforeStickers ?? record.stickerBefore }, index, 'before'),
        ...normalizeStickerPlacementRecord({ replyIndex: index, position: inlinePosition, stickers: record.stickers ?? record.stickerIds ?? record.sticker }, index, inlinePosition),
        ...normalizeStickerPlacementRecord({ replyIndex: index, position: 'after', stickers: record.stickersAfter ?? record.afterStickers ?? record.stickerAfter }, index, 'after')
      ];
    });
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return normalizeReplyStickerPlacements(record.replies ?? record.messages ?? record.reply ?? record.message ?? record.content);
  }
  return [];
}

function normalizeInnerMonologueLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeInnerMonologueLines(item));
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.innerMonologue, record.innerThoughts, record.thoughts, record.statusLines, record.lines, record.content, record.text];
    for (const candidate of candidates) {
      const lines = normalizeInnerMonologueLines(candidate);
      if (lines.length) return lines;
    }
  }
  return [];
}

function normalizeNarrationLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeNarrationLines(item));
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.narration, record.content, record.text, record.message, record.description];
    for (const candidate of candidates) {
      const lines = normalizeNarrationLines(candidate);
      if (lines.length) return lines;
    }
  }
  return [];
}

function normalizeImageDescriptions(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeImageDescriptions(item));
  if (typeof value === 'string' || typeof value === 'number') {
    const content = String(value).trim();
    return content ? [content] : [];
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.description, record.imageDescription, record.prompt, record.content, record.text, record.message];
    for (const candidate of candidates) {
      const descriptions = normalizeImageDescriptions(candidate);
      if (descriptions.length) return descriptions;
    }
    return normalizeImageDescriptions(record.images ?? record.image);
  }
  return [];
}

function normalizeImageGenerationPrompt(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function normalizeRoleplayImages(value: unknown): Array<{ description: string; generationPrompt?: string }> {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeRoleplayImages(item));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const generationPrompt = normalizeImageGenerationPrompt(record.generationPrompt ?? record.imageGenerationPrompt ?? record.englishPrompt ?? record.promptEn ?? record.promptEnglish);
    const descriptions = normalizeImageDescriptions(record.description ?? record.imageDescription ?? record.content ?? record.text ?? record.message ?? record.prompt);
    if (descriptions.length) {
      return descriptions.map((description) => ({ description, ...(generationPrompt ? { generationPrompt } : {}) }));
    }
  }
  return normalizeImageDescriptions(value).map((description) => ({ description }));
}

function normalizeLocationText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  return '';
}

function normalizeLocationSegment(record: Record<string, unknown>): RoleplayReplySegment[] {
  const name = normalizeLocationText(record.name)
    || normalizeLocationText(record.placeName)
    || normalizeLocationText(record.locationName)
    || normalizeLocationText(record.title)
    || normalizeLocationText(record.place)
    || normalizeLocationText(record.poi);
  const address = normalizeLocationText(record.address)
    || normalizeLocationText(record.detail)
    || normalizeLocationText(record.description);
  const distance = normalizeLocationText(record.distance)
    || normalizeLocationText(record.distanceText)
    || normalizeLocationText(record.distanceFromUser)
    || normalizeLocationText(record.distanceToUser)
    || normalizeLocationText(record.distanceFromCharacter)
    || normalizeLocationText(record.distanceToCharacter);
  if (!name || !distance) return [];
  return [{
    type: 'location',
    name,
    ...(address && address !== name ? { address } : {}),
    distance
  }];
}

function normalizeTransferAmount(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value).replace(/[￥¥,\s]/g, '').trim();
  return '';
}

function normalizeTransferSegment(record: Record<string, unknown>): RoleplayReplySegment[] {
  const amount = normalizeTransferAmount(record.amount)
    || normalizeTransferAmount(record.money)
    || normalizeTransferAmount(record.value)
    || normalizeTransferAmount(record.total);
  if (!amount || !/^\d+(?:\.\d{1,2})?$/.test(amount)) return [];
  const note = normalizeLocationText(record.note)
    || normalizeLocationText(record.remark)
    || normalizeLocationText(record.message)
    || normalizeLocationText(record.description);
  return [{
    type: 'transfer',
    amount,
    ...(note ? { note } : {})
  }];
}

function normalizeCommerceKind(value: unknown): 'shopping' | 'takeout' | 'gift' {
  const kind = String(value ?? '').trim().toLocaleLowerCase();
  if (['takeout', 'food', 'delivery', 'meal', '外卖', '点餐', '餐饮'].includes(kind)) return 'takeout';
  if (['gift', 'present', 'surprise', '礼物', '送礼'].includes(kind)) return 'gift';
  return 'shopping';
}

function normalizeCommerceItems(value: unknown): Array<{ name: string; quantity: number; price?: string }> {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeCommerceItems(item)).slice(0, 8);
  if (typeof value === 'string') {
    return value.split(/[、,，]/).map((name) => name.trim()).filter(Boolean).map((name) => ({ name, quantity: 1 }));
  }
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const name = normalizeLocationText(record.name ?? record.title ?? record.productName ?? record.dishName ?? record.item);
  if (!name) return [];
  const rawQuantity = Number(record.quantity ?? record.count ?? record.qty ?? 1);
  const quantity = Number.isFinite(rawQuantity) ? Math.min(99, Math.max(1, Math.floor(rawQuantity))) : 1;
  const price = normalizeTransferAmount(record.price ?? record.unitPrice ?? record.amount);
  return [{ name, quantity, ...(price && /^\d+(?:\.\d{1,2})?$/.test(price) ? { price } : {}) }];
}

function normalizeCommerceSegment(record: Record<string, unknown>): RoleplayReplySegment[] {
  const kind = normalizeCommerceKind(record.kind ?? record.orderType ?? record.purchaseType ?? record.type);
  const storeName = normalizeLocationText(record.storeName ?? record.store ?? record.shopName ?? record.restaurantName ?? record.merchant);
  const items = normalizeCommerceItems(record.items ?? record.products ?? record.dishes ?? record.goods ?? record.orderItems);
  const totalAmount = normalizeTransferAmount(record.totalAmount ?? record.total ?? record.amount ?? record.price);
  if (!storeName || !items.length || !/^\d+(?:\.\d{1,2})?$/.test(totalAmount) || Number(totalAmount) <= 0) return [];
  const eta = normalizeLocationText(record.eta ?? record.deliveryTime ?? record.arrivalTime);
  const note = normalizeLocationText(record.note ?? record.remark ?? record.description);
  const cardMessage = normalizeLocationText(record.cardMessage ?? record.giftMessage ?? record.messageToUser ?? record.card);
  return [{ type: 'commerce', kind, storeName, items, totalAmount, ...(eta ? { eta } : {}), ...(note ? { note } : {}), ...(cardMessage ? { cardMessage } : {}) }];
}

function normalizeSegmentType(value: unknown): RoleplayReplySegment['type'] | '' {
  const type = String(value ?? '').trim().toLocaleLowerCase();
  if (['reply', 'message', 'bubble', 'text'].includes(type)) return 'reply';
  if (['narration', 'narrative', 'action', 'system'].includes(type)) return 'narration';
  if (['sticker', 'stickers', 'emoji', 'emote'].includes(type)) return 'sticker';
  if (['image', 'picture', 'photo', 'pic'].includes(type)) return 'image';
  if (['voice', 'audio', 'voice_message', 'voice-message', 'speech'].includes(type)) return 'voice';
  if (['location', 'map', 'position', 'geo', 'geolocation', '定位', '位置'].includes(type)) return 'location';
  if (['transfer', 'money', 'payment', 'redpacket', 'red_packet', '转账', '付款'].includes(type)) return 'transfer';
  if (['commerce', 'order', 'shopping', 'purchase', 'takeout', 'food_order', 'delivery_order', 'gift', 'gift_order', '购物', '订单', '外卖', '点餐', '礼物', '送礼'].includes(type)) return 'commerce';
  if (['music_action', 'music-action', 'music', 'music_notice', 'music-notice', 'song_action', 'song-action', '音乐动作', '切歌', '收藏音乐'].includes(type)) return 'music_action';
  return '';
}

function normalizeRoleplaySegment(value: unknown, narrationEnabled: boolean): RoleplayReplySegment[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeRoleplaySegment(item, narrationEnabled));
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const type = normalizeSegmentType(record.type ?? record.kind ?? record.role);
  if (type === 'sticker') {
    const stickers = [...new Set([
      ...normalizeStickerSelections(record.stickers),
      ...normalizeStickerSelections(record.stickerIds),
      ...normalizeStickerSelections(record.sticker),
      ...normalizeStickerSelections(record.stickerId),
      ...normalizeStickerSelections(record.id)
    ].map((item) => item.trim()).filter(Boolean))];
    return stickers.length ? [{ type: 'sticker', stickers }] : [];
  }

  if (type === 'narration') {
    if (!narrationEnabled) return [];
    return normalizeNarrationLines(record.content ?? record.narration ?? record.text ?? record.message ?? record.description)
      .map((content) => ({ type: 'narration' as const, content }));
  }

  if (type === 'reply') {
    const replies = normalizeTextFragments(record.content ?? record.reply ?? record.message ?? record.text);
    const translations = normalizeTranslationList(record.translation ?? record.contentTranslation ?? record.translationZh ?? record.chineseTranslation);
    return replies.map((content, index) => ({
      type: 'reply' as const,
      content,
      ...(translations[index] ? { translation: translations[index] } : {})
    }));
  }

  if (type === 'image') {
    const generationPrompt = normalizeImageGenerationPrompt(record.generationPrompt ?? record.imageGenerationPrompt ?? record.englishPrompt ?? record.promptEn ?? record.promptEnglish);
    return normalizeImageDescriptions(record.description ?? record.imageDescription ?? record.content ?? record.text ?? record.message ?? record.prompt)
      .map((description) => ({ type: 'image' as const, description, ...(generationPrompt ? { generationPrompt } : {}) }));
  }

  if (type === 'voice') {
    const duration = Number(record.duration ?? record.seconds ?? record.length);
    const translations = normalizeTranslationList(record.translation ?? record.contentTranslation ?? record.translationZh ?? record.chineseTranslation);
    return normalizeTextFragments(record.content ?? record.transcript ?? record.text ?? record.message ?? record.reply)
      .map((content, index) => ({
        type: 'voice' as const,
        content,
        ...(translations[index] ? { translation: translations[index] } : {}),
        ...(Number.isFinite(duration) && duration > 0 ? { duration: Math.round(duration) } : {})
      }));
  }

  if (type === 'location') return normalizeLocationSegment(record);

  if (type === 'transfer') return normalizeTransferSegment(record);

  if (type === 'commerce') return normalizeCommerceSegment(record);

  if (type === 'music_action') {
    const rawIndex = Number(record.actionIndex ?? record.musicActionIndex ?? record.index);
    return [{
      type: 'music_action',
      ...(Number.isFinite(rawIndex) && rawIndex >= 0 ? { actionIndex: Math.floor(rawIndex) } : {})
    }];
  }

  return [];
}

function normalizeRoleplaySegments(value: unknown, narrationEnabled: boolean): RoleplayReplySegment[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeRoleplaySegment(item, narrationEnabled));
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return normalizeRoleplaySegments(record.messages ?? record.items ?? record.sequence ?? record.timeline ?? record.segments, narrationEnabled);
  }
  return [];
}

function normalizeMessageIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeMessageIds(item));
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value)
      .split(/[\s,，、]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates = [record.messageId, record.targetMessageId, record.quoteMessageId, record.recalledMessageId, record.id];
    for (const candidate of candidates) {
      const ids = normalizeMessageIds(candidate);
      if (ids.length) return ids;
    }
  }
  return [];
}

function normalizeReplyIndex(value: unknown, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.floor(numeric));
}

function normalizeQuoteActions(value: unknown): RoleplayQuoteAction[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeQuoteActions(item));
  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeMessageIds(value).map((messageId) => ({ messageId, replyIndex: 0 }));
  }
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const messageId = normalizeMessageIds(record.messageId ?? record.targetMessageId ?? record.quoteMessageId ?? record.id)[0];
  if (!messageId) return [];
  const replyNumber = Number(record.replyNumber ?? record.replyNo ?? record.messageNumber);
  const replyIndex = Number.isFinite(replyNumber)
    ? Math.max(0, Math.floor(replyNumber) - 1)
    : normalizeReplyIndex(record.replyIndex ?? record.index ?? record.reply, 0);
  return [{ messageId, replyIndex }];
}

function normalizeTransferDecisionStatus(value: unknown): 'accepted' | 'rejected' | '' {
  const status = String(value ?? '').trim().toLocaleLowerCase();
  if (['accepted', 'accept', 'received', 'receive', 'take', 'yes', '收款', '接收', '接受', '领取', '同意'].includes(status)) return 'accepted';
  if (['rejected', 'reject', 'refused', 'refuse', 'declined', 'decline', 'no', '退回', '拒收', '拒绝', '婉拒'].includes(status)) return 'rejected';
  return '';
}

function normalizeTransferDecisionActions(value: unknown): Array<{ messageId: string; status: 'accepted' | 'rejected' }> {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeTransferDecisionActions(item));
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const status = normalizeTransferDecisionStatus(record.status ?? record.decision ?? record.action ?? record.result);
  if (!status) return [];
  const messageIds = normalizeMessageIds(record.messageId ?? record.targetMessageId ?? record.transferMessageId ?? record.id);
  return messageIds.map((messageId) => ({ messageId, status }));
}

function normalizeMusicListenInviteDecisionActions(value: unknown): Array<{ messageId: string; status: 'accepted' | 'rejected' }> {
  return normalizeTransferDecisionActions(value);
}

function normalizeMusicTrackDraft(value: unknown): Partial<MusicTrack> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const name = normalizeLocationText(record.name ?? record.title ?? record.songName);
  const platformId = normalizeLocationText(record.platformId ?? record.id ?? record.songId);
  const source = normalizeLocationText(record.source ?? record.platform) || 'netease';
  if (!name && !platformId) return undefined;
  const artists = Array.isArray(record.artists)
    ? record.artists.map((artist) => String(artist ?? '').trim()).filter(Boolean)
    : normalizeLocationText(record.artist ?? record.artists ?? record.singer)
      .split(/[、/,，]/)
      .map((artist) => artist.trim())
      .filter(Boolean);
  return {
    id: normalizeLocationText(record.trackId ?? record.musicId) || `${source}:${platformId || name}`,
    platformId: platformId || normalizeLocationText(record.trackId ?? record.musicId) || name,
    source,
    name: name || platformId,
    artists,
    album: normalizeLocationText(record.album),
    picId: normalizeLocationText(record.picId),
    lyricId: normalizeLocationText(record.lyricId),
    coverUrl: normalizeLocationText(record.coverUrl),
    audioUrl: normalizeLocationText(record.audioUrl)
  };
}

function normalizeMusicListenInviteAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayMessageActions['musicListenInvite'] {
  const candidates = [
    actionRecord.musicListenInvite,
    actionRecord.listenTogetherInvite,
    actionRecord.inviteListenTogether,
    record.musicListenInvite,
    record.listenTogetherInvite,
    record.inviteListenTogether
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') return { note: candidate.trim() || undefined };
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const inviteRecord = candidate as Record<string, unknown>;
      const explicitDisabled = inviteRecord.enabled === false || inviteRecord.enabled === 'false' || inviteRecord.status === 'none';
      if (explicitDisabled) continue;
      return {
        note: normalizeLocationText(inviteRecord.note ?? inviteRecord.content ?? inviteRecord.text) || undefined,
        query: normalizeLocationText(inviteRecord.query ?? inviteRecord.keyword ?? inviteRecord.song) || undefined,
        source: normalizeLocationText(inviteRecord.source ?? inviteRecord.platform) || undefined,
        track: normalizeMusicTrackDraft(inviteRecord.track)
      };
    }
  }
  return null;
}

function normalizeMusicActionType(value: unknown): RoleplayMusicAction['type'] | '' {
  const type = String(value ?? '').trim().toLocaleLowerCase();
  if (['play', 'switch', 'switch_track', 'play_track', 'search_play', '切歌', '播放', '换歌'].includes(type)) return 'play';
  if (['favorite_current', 'like_current', 'add_current_to_favorite', 'add_current_to_favorites', '收藏当前', '喜欢当前', '收藏这首', '喜欢这首'].includes(type)) return 'favorite_current';
  if (['favorite_track', 'like_track', 'add_to_favorite', 'add_to_favorites', '收藏歌曲', '加入喜欢'].includes(type)) return 'favorite_track';
  return '';
}

function normalizeMusicActions(value: unknown): RoleplayMusicAction[] {
  if (Array.isArray(value)) return value.flatMap((item) => normalizeMusicActions(item));
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (!record.type && !record.action && !record.intent) {
    const mappedActions = Object.entries(record).flatMap(([key, candidate]) => {
      const keyType = normalizeMusicActionType(key);
      const genericFavorite = ['favorite', 'like', 'add_favorite', '收藏', '喜欢', '加入我的喜欢'].includes(key.trim().toLocaleLowerCase());
      if (!keyType && !genericFavorite) return [];
      if (candidate === false || candidate === null || candidate === undefined || candidate === 'false') return [];
      if (candidate === true || candidate === 'true') {
        const type = keyType === 'favorite_track' ? 'favorite_current' : keyType || 'favorite_current';
        return [{ type } satisfies RoleplayMusicAction];
      }
      if (typeof candidate === 'string') {
        const query = candidate.trim();
        const type = keyType === 'favorite_track' && !query ? 'favorite_current' : keyType || (query ? 'favorite_track' : 'favorite_current');
        return [{ type, query: query || undefined } satisfies RoleplayMusicAction];
      }
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        return normalizeMusicActions({ ...(candidate as Record<string, unknown>), type: key });
      }
      return [];
    });
    if (mappedActions.length > 0) return mappedActions;
  }
  const rawType = String(record.type ?? record.action ?? record.intent ?? '').trim().toLocaleLowerCase();
  const explicitQuery = normalizeLocationText(record.query ?? record.keyword ?? record.song ?? record.title ?? record.name ?? record.songName ?? record.musicName);
  const artistQuery = normalizeLocationText(record.artist ?? record.artists ?? record.singer ?? record.singers);
  const query = [explicitQuery, artistQuery].filter(Boolean).join(' ').trim() || undefined;
  let type = normalizeMusicActionType(record.type ?? record.action ?? record.intent);
  if (!type && ['favorite', 'like', 'add_favorite', 'add_to_favorites', '收藏', '喜欢', '加入我的喜欢'].includes(rawType)) {
    type = query ? 'favorite_track' : 'favorite_current';
  }
  if (!type) type = normalizeMusicActionType(record.name);
  if (type === 'favorite_track' && !query && !record.track) type = 'favorite_current';
  if (!type) return [];
  return [{
    type,
    query,
    source: normalizeLocationText(record.source ?? record.platform) || undefined,
    track: normalizeMusicTrackDraft(record.track)
  }];
}

function normalizeRoleplayCallMode(value: unknown): RoleplayCallMode | '' {
  const mode = String(value ?? '').trim().toLocaleLowerCase();
  if (['voice', 'audio', 'phone', '语音', '语音通话', '电话'].includes(mode)) return 'voice';
  if (['video', 'camera', 'facetime', '视频', '视频通话'].includes(mode)) return 'video';
  return '';
}

function normalizeCallInviteAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayMessageActions['callInvite'] {
  const candidates = [
    actionRecord.callInvite,
    actionRecord.startCall,
    actionRecord.call,
    actionRecord.phoneCall,
    record.callInvite,
    record.startCall,
    record.call,
    record.phoneCall
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const mode = normalizeRoleplayCallMode(candidate);
      if (mode) return { mode };
      continue;
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const callRecord = candidate as Record<string, unknown>;
      const explicitDisabled = callRecord.enabled === false || callRecord.enabled === 'false' || callRecord.status === 'none';
      if (explicitDisabled) continue;
      const mode = normalizeRoleplayCallMode(callRecord.mode ?? callRecord.type ?? callRecord.kind ?? callRecord.callType);
      if (!mode) continue;
      return { mode };
    }
  }
  return null;
}

function normalizeCallResponseStatus(value: unknown): RoleplayCallResponseStatus | '' {
  const status = String(value ?? '').trim().toLocaleLowerCase();
  if (['accepted', 'accept', 'answer', 'answered', 'yes', '接听', '接受', '同意'].includes(status)) return 'accepted';
  if (['rejected', 'reject', 'refuse', 'refused', 'decline', 'declined', 'no', '拒绝', '挂断'].includes(status)) return 'rejected';
  if (['busy', 'occupied', 'unavailable', '忙线', '在忙'].includes(status)) return 'busy';
  if (['missed', 'no_answer', 'no-answer', 'timeout', '未接', '无人接听'].includes(status)) return 'missed';
  return '';
}

function normalizeCallResponseAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayMessageActions['callResponse'] {
  const candidates = [
    actionRecord.callResponse,
    actionRecord.callDecision,
    actionRecord.answerCall,
    record.callResponse,
    record.callDecision,
    record.answerCall
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const status = normalizeCallResponseStatus(candidate);
      if (status) return { status };
      continue;
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const responseRecord = candidate as Record<string, unknown>;
      const status = normalizeCallResponseStatus(responseRecord.status ?? responseRecord.decision ?? responseRecord.action ?? responseRecord.result);
      if (!status) continue;
      return { status };
    }
  }
  return null;
}

function normalizeGobangInviteAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayMessageActions['gobangInvite'] {
  const candidates = [
    actionRecord.gobangInvite,
    actionRecord.startGobang,
    actionRecord.fiveInARowInvite,
    record.gobangInvite,
    record.startGobang,
    record.fiveInARowInvite
  ];
  for (const candidate of candidates) {
    if (candidate === true || candidate === 'true' || candidate === 'gobang' || candidate === '五子棋') return { starter: 'char' };
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const inviteRecord = candidate as Record<string, unknown>;
    if (inviteRecord.enabled === false || inviteRecord.enabled === 'false' || inviteRecord.status === 'none') continue;
    return { starter: 'char' };
  }
  return null;
}

function normalizeGobangResponseAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayMessageActions['gobangResponse'] {
  const candidates = [
    actionRecord.gobangResponse,
    actionRecord.gobangDecision,
    actionRecord.answerGobang,
    record.gobangResponse,
    record.gobangDecision,
    record.answerGobang
  ];
  for (const candidate of candidates) {
    const rawStatus = typeof candidate === 'string'
      ? candidate
      : candidate && typeof candidate === 'object' && !Array.isArray(candidate)
        ? String((candidate as Record<string, unknown>).status ?? (candidate as Record<string, unknown>).decision ?? (candidate as Record<string, unknown>).action ?? '')
        : '';
    const status = rawStatus.trim().toLocaleLowerCase();
    if (['accepted', 'accept', 'yes', '同意', '接受', '应战'].includes(status)) return { status: 'accepted' };
    if (['rejected', 'reject', 'decline', 'no', '拒绝', '不玩'].includes(status)) return { status: 'rejected' };
  }
  return null;
}

function normalizeRoleplayMessageActions(record: Record<string, unknown>): RoleplayMessageActions {
  const actionRecord = record.messageActions && typeof record.messageActions === 'object'
    ? record.messageActions as Record<string, unknown>
    : record.actions && typeof record.actions === 'object'
      ? record.actions as Record<string, unknown>
      : {};
  const recallMessageIds = [...new Set([
    ...normalizeMessageIds(record.recallMessageIds),
    ...normalizeMessageIds(record.recalledMessageIds),
    ...normalizeMessageIds(record.withdrawMessageIds),
    ...normalizeMessageIds(record.withdrawnMessageIds),
    ...normalizeMessageIds(record.recalls),
    ...normalizeMessageIds(record.withdrawals),
    ...normalizeMessageIds(actionRecord.recallMessageIds),
    ...normalizeMessageIds(actionRecord.recalledMessageIds),
    ...normalizeMessageIds(actionRecord.withdrawMessageIds),
    ...normalizeMessageIds(actionRecord.withdrawnMessageIds),
    ...normalizeMessageIds(actionRecord.recalls),
    ...normalizeMessageIds(actionRecord.withdrawals)
  ])];
  const quotes = [
    ...normalizeQuoteActions(record.quotes),
    ...normalizeQuoteActions(record.quoteReplies),
    ...normalizeQuoteActions(record.references),
    ...normalizeQuoteActions(actionRecord.quotes),
    ...normalizeQuoteActions(actionRecord.quoteReplies),
    ...normalizeQuoteActions(actionRecord.references)
  ];
  const transferDecisionEntries = [
    ...normalizeTransferDecisionActions(record.transferDecisions),
    ...normalizeTransferDecisionActions(record.transferDecision),
    ...normalizeTransferDecisionActions(record.transferReplies),
    ...normalizeTransferDecisionActions(actionRecord.transferDecisions),
    ...normalizeTransferDecisionActions(actionRecord.transferDecision),
    ...normalizeTransferDecisionActions(actionRecord.transferReplies)
  ];
  const transferDecisions = Array.from(new Map(transferDecisionEntries.map((decision) => [decision.messageId, decision])).values());
  const musicListenInviteDecisionEntries = [
    ...normalizeMusicListenInviteDecisionActions(record.musicListenInviteDecisions),
    ...normalizeMusicListenInviteDecisionActions(record.listenTogetherDecisions),
    ...normalizeMusicListenInviteDecisionActions(actionRecord.musicListenInviteDecisions),
    ...normalizeMusicListenInviteDecisionActions(actionRecord.listenTogetherDecisions)
  ];
  const musicListenInviteDecisions = Array.from(new Map(musicListenInviteDecisionEntries.map((decision) => [decision.messageId, decision])).values());
  const musicActions = [
    ...normalizeMusicActions(record.musicActions),
    ...normalizeMusicActions(record.musicAction),
    ...normalizeMusicActions(record.listenTogetherActions),
    ...normalizeMusicActions(record.listenTogetherAction),
    ...normalizeMusicActions(actionRecord.musicActions),
    ...normalizeMusicActions(actionRecord.musicAction),
    ...normalizeMusicActions(actionRecord.listenTogetherActions),
    ...normalizeMusicActions(actionRecord.listenTogetherAction)
  ].slice(0, 4);
  return {
    recallMessageIds,
    quotes,
    transferDecisions,
    musicListenInviteDecisions,
    musicListenInvite: normalizeMusicListenInviteAction(record, actionRecord),
    musicActions,
    offlineInvitation: normalizeOfflineInvitationAction(record, actionRecord),
    callInvite: normalizeCallInviteAction(record, actionRecord),
    callResponse: normalizeCallResponseAction(record, actionRecord),
    gobangInvite: normalizeGobangInviteAction(record, actionRecord),
    gobangResponse: normalizeGobangResponseAction(record, actionRecord),
    relationshipAction: normalizeRelationshipAction(record, actionRecord)
  };
}

function normalizeRelationshipAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): RoleplayRelationshipAction | null {
  const candidates = [actionRecord.relationshipAction, actionRecord.friendshipAction, record.relationshipAction, record.friendshipAction];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
    const action = candidate as Record<string, unknown>;
    const rawType = String(action.type ?? action.action ?? action.decision ?? '').trim().toLowerCase();
    const type = rawType === 'block' || rawType === '拉黑'
      ? 'block'
      : rawType === 'delete' || rawType === 'remove' || rawType === '删除'
        ? 'delete'
        : rawType === 'request_friend' || rawType === 'reapply' || rawType === 'add_friend' || rawType === '申请好友'
          ? 'request_friend'
          : rawType === 'accept_request' || rawType === 'accept' || rawType === 'approve' || rawType === '同意'
            ? 'accept_request'
            : rawType === 'reject_request' || rawType === 'reject' || rawType === '拒绝'
              ? 'reject_request'
              : null;
    if (!type) continue;
    const reason = String(action.reason ?? action.note ?? '').trim();
    return { type, ...(reason ? { reason: reason.slice(0, 160) } : {}) };
  }
  return null;
}

function normalizeOfflineInvitationAction(record: Record<string, unknown>, actionRecord: Record<string, unknown>): { prompt: string } | null {
  const candidates = [
    actionRecord.offlineInvitation,
    actionRecord.offlineInvite,
    actionRecord.inviteOffline,
    record.offlineInvitation,
    record.offlineInvite,
    record.inviteOffline
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === 'string') {
      const prompt = candidate.trim();
      if (prompt) return { prompt };
      continue;
    }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      const inviteRecord = candidate as Record<string, unknown>;
      const explicitDisabled = inviteRecord.enabled === false || inviteRecord.enabled === 'false' || inviteRecord.status === 'none';
      if (explicitDisabled) continue;
      const prompt = normalizeLocationText(inviteRecord.prompt)
        || normalizeLocationText(inviteRecord.openingPrompt)
        || normalizeLocationText(inviteRecord.scene)
        || normalizeLocationText(inviteRecord.content)
        || normalizeLocationText(inviteRecord.text);
      if (prompt) return { prompt };
    }
  }
  return null;
}

function normalizeRawOnlineReply(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const lines = trimmed.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  const explicitFragments = lines
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)、]|(?:消息|气泡)\s*\d+[:：]?)\s*/, '').trim())
    .filter(Boolean);

  if (lines.length > 1 && explicitFragments.length === lines.length) {
    const allLinesLookSplit = lines.every((line) => /^(?:[-*•]|\d+[.)、]|(?:消息|气泡)\s*\d+[:：]?)/.test(line));
    const allLinesLookShort = lines.every((line) => line.length <= 80);
    if (allLinesLookSplit || allLinesLookShort) return explicitFragments;
  }

  return [trimmed];
}

interface TextApiContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

function isGifDataUrl(url: string) {
  return /^data:image\/gif(?:;[^,]*)?,/i.test(url.trim());
}

function isLikelyGifImageUrl(url: string) {
  const trimmed = url.trim();
  if (isGifDataUrl(trimmed)) return true;
  try {
    return /\.gif$/i.test(new URL(trimmed).pathname);
  } catch {
    return /\.gif(?:[?#].*)?$/i.test(trimmed);
  }
}

function isFetchableLocalImageUrl(url: string) {
  return /^blob:/i.test(url.trim());
}

function loadImageForVision(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('图片加载失败。')));
    image.src = url;
  });
}

async function snapshotImageDataUrlAsPng(dataUrl: string) {
  if (typeof document === 'undefined') return dataUrl;
  const image = await loadImageForVision(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return dataUrl;

  const maxDimension = 720;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const outputWidth = Math.max(1, Math.round(width * scale));
  const outputHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  context.drawImage(image, 0, 0, outputWidth, outputHeight);
  return canvas.toDataURL('image/png');
}

async function prepareVisionImageUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!isLikelyGifImageUrl(trimmed) && !isFetchableLocalImageUrl(trimmed)) return trimmed;

  const dataUrl = isGifDataUrl(trimmed)
    ? trimmed
    : await fetchGeneratedImageUrlAsDataUrl(trimmed, isLikelyGifImageUrl(trimmed) ? 'image/gif' : 'image/png');
  return isGifDataUrl(dataUrl) ? snapshotImageDataUrlAsPng(dataUrl) : dataUrl;
}

async function getPreparedVisualImageParts(input: Pick<GenerateReplyInput, 'messages' | 'stickerVisionEnabled'>): Promise<TextApiContentPart[]> {
  const parts = await Promise.all(getVisualImageParts(input).map(async (part) => {
    if (part.type !== 'image_url') return part;
    try {
      const url = await prepareVisionImageUrl(part.image_url?.url ?? '');
      return url ? { ...part, image_url: { url } } : null;
    } catch {
      return null;
    }
  }));
  return parts.filter((part): part is TextApiContentPart => Boolean(part));
}

function getVisualImageParts(input: Pick<GenerateReplyInput, 'messages' | 'stickerVisionEnabled'>): TextApiContentPart[] {
  const stickerParts = input.stickerVisionEnabled ? input.messages
    .slice(-12)
    .filter((message) => message.sender === 'user' && message.sticker?.imageUrl)
    .slice(-4)
    .flatMap((message) => [
      {
        type: 'text' as const,
        text: `Sticker image for "${message.sticker?.description ?? 'Sticker'}":`
      },
      {
        type: 'image_url' as const,
        image_url: { url: message.sticker ? getStickerDisplayImageUrl(message.sticker) : '' }
      }
    ]) : [];
  const imageParts = input.messages
    .slice(-12)
    .filter((message) => message.sender === 'user' && message.image?.url)
    .slice(-4)
    .flatMap((message) => [
      {
        type: 'text' as const,
        text: [
          `User sent image (${message.image?.kind ?? 'image'}).`,
          message.image?.aiHint ? `Visual context: ${message.image.aiHint}` : ''
        ].filter(Boolean).join(' ')
      },
      {
        type: 'image_url' as const,
        image_url: { url: message.image?.url ?? '' }
      }
    ]);
  return [...stickerParts, ...imageParts];
}

export function estimateRoleplayReplyInputTokens(input: GenerateReplyInput) {
  const prompt = buildPrompt(input);
  const imageParts = getVisualImageParts(input);
  const imageText = imageParts
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
  const imageCount = imageParts.filter((part) => part.type === 'image_url').length;
  return estimateTokenCount([prompt, imageText].filter(Boolean).join('\n')) + imageCount * 85;
}

interface VoomMomentPayload {
  content: string;
  contentTranslation?: string;
  imageDescription?: string;
  imageGenerationPrompt?: string;
  likes: string[];
  comments: Array<Pick<VoomComment, 'authorName' | 'content' | 'contentTranslation' | 'parentId'> & { draftId?: string }>;
}

const voomDateTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
});

function shouldIncludeVoomTimeContext(timeAwareness: ConversationTimeAwarenessSettings | null | undefined) {
  return Boolean(timeAwareness?.enabled);
}

function formatVoomContextTime(timestamp?: number) {
  const normalizedTimestamp = Number(timestamp);
  if (!Number.isFinite(normalizedTimestamp) || normalizedTimestamp <= 0) return '未知';
  return voomDateTimeFormatter.format(normalizedTimestamp);
}

function formatVoomPostPromptContent(post: VoomPost, includeTimeContext: boolean) {
  return [
    includeTimeContext ? `发布时间：${formatVoomContextTime(post.createdAt)}` : '',
    formatContentWithChineseTranslation(post.content, post.contentTranslation),
    post.imageDescription ? `配图描述：${post.imageDescription}` : ''
  ].filter(Boolean).join('\n');
}

function formatVoomCommentPromptLine(comment: VoomComment, includeTimeContext: boolean) {
  const timeText = includeTimeContext ? `（${formatVoomContextTime(comment.createdAt)}）` : '';
  return `${comment.id}｜${comment.authorName}${timeText}: ${formatContentWithChineseTranslation(comment.content, comment.contentTranslation)}`;
}

function extractVoomCommentReplyTarget(content: string) {
  const normalized = content.trim();
  const replyMatch = normalized.match(/^回复\s+([^：:，,、\s][^：:，,、]{0,30})\s*[：:，,、-]/u);
  if (replyMatch?.[1]) return replyMatch[1].trim();
  const mentionMatch = normalized.match(/^@([^：:，,、\s][^：:，,、\s]{0,30})\s*[：:，,、-]?/u);
  return mentionMatch?.[1]?.trim() ?? '';
}

function normalizeVoomMomentComments(input: unknown): VoomMomentPayload['comments'] {
  if (!Array.isArray(input)) return [];
  const comments: VoomMomentPayload['comments'] = [];
  for (const comment of input) {
    if (comments.length >= 15 || !comment || typeof comment !== 'object') continue;
    const entry = comment as Record<string, unknown>;
    const authorName = String(entry.authorName ?? '').trim();
    const rawContent = String(entry.content ?? '');
    const replyTargetName = String(entry.replyToAuthorName ?? entry.replyToName ?? entry.targetAuthorName ?? '').trim() || extractVoomCommentReplyTarget(rawContent);
    const content = stripVoomCommentReplyPrefix(rawContent, replyTargetName);
    const contentTranslation = normalizeTranslationText(entry.contentTranslation ?? entry.translation ?? entry.translationZh ?? entry.chineseTranslation);
    const draftId = String(entry.id ?? entry.draftId ?? entry.tempId ?? '').trim();
    const parentId = String(entry.parentId ?? entry.replyToId ?? entry.replyTo ?? entry.parent ?? '').trim() || replyTargetName;
    if (!authorName || !content) continue;
    comments.push({
      authorName,
      content,
      ...(contentTranslation ? { contentTranslation } : {}),
      ...(draftId ? { draftId } : {}),
      parentId
    });
  }
  return comments;
}

function resolveInitialVoomComments(comments: VoomMomentPayload['comments']) {
  const generatedComments: VoomComment[] = [];
  const idByDraftId = new Map<string, string>();

  for (const comment of comments) {
    const id = createId('comment');
    const rawParentId = comment.parentId?.trim() ?? '';
    const parentByDraftId = idByDraftId.get(rawParentId) ?? '';
    const parentByAuthor = rawParentId
      ? [...generatedComments].reverse().find((entry) => entry.authorName === rawParentId)?.id ?? ''
      : '';
    const parentId = parentByDraftId || parentByAuthor;
    generatedComments.push({
      id,
      authorName: comment.authorName,
      content: stripVoomCommentReplyPrefix(comment.content, rawParentId),
      contentTranslation: comment.contentTranslation ? stripVoomCommentReplyPrefix(comment.contentTranslation, rawParentId) : comment.contentTranslation,
      parentId: parentId || undefined
    });
    if (comment.draftId) idByDraftId.set(comment.draftId, id);
  }

  return generatedComments;
}

function parseVoomMomentPayload(rawContent: string): VoomMomentPayload {
  const trimmed = rawContent.trim();

  if (!trimmed) {
    throw new Error('VOOM 文案模型没有返回动态正文。');
  }

  const jsonContent = extractJsonContent(trimmed);
  try {
    const parsed = JSON.parse(jsonContent) as Partial<VoomMomentPayload> & Record<string, unknown>;
    const content = String(parsed.content ?? '').trim();
    if (!content) throw new Error('VOOM 文案模型返回的 JSON 缺少 content。');
    const contentTranslation = normalizeTranslationText(parsed.contentTranslation ?? parsed.translation ?? parsed.translationZh ?? parsed.chineseTranslation);
    const imageDescription = String(parsed.imageDescription ?? '').trim();
    const imageGenerationPrompt = String(parsed.imageGenerationPrompt ?? parsed.generationPrompt ?? parsed.englishImagePrompt ?? parsed.promptEn ?? '').trim();
    const likes = Array.isArray(parsed.likes)
      ? [...new Set(parsed.likes.map((item) => String(item ?? '').trim()).filter(Boolean))]
      : [];
    return {
      content,
      ...(contentTranslation ? { contentTranslation } : {}),
      ...(imageDescription ? { imageDescription } : {}),
      ...(imageGenerationPrompt ? { imageGenerationPrompt } : {}),
      likes,
      comments: normalizeVoomMomentComments(parsed.comments)
    };
  } catch (error) {
    if (jsonContent.startsWith('{')) {
      throw error;
    }
    return {
      content: trimmed,
      likes: [],
      comments: []
    };
  }
}

async function generateVoomPayload(context: PromptContext, settings?: AppSettings, modelOverride = '') {
  const apiReply = await callTextApi(settings, buildMomentPrompt(context), modelOverride);
  return parseVoomMomentPayload(apiReply);
}

function normalizeVoomCommentReplies(input: unknown, fallbackAuthorName: string, post: VoomPost, blockedAuthorNames: string[] = []): VoomCommentReplyResult[] {
  const replySource = Array.isArray(input)
    ? input
    : typeof input === 'object' && input && Array.isArray((input as { replies?: unknown }).replies)
      ? (input as { replies: unknown[] }).replies
      : [];
  const commentIds = new Set(post.comments.map((comment) => comment.id));
  const blockedAuthors = new Set(blockedAuthorNames.map((name) => name.trim().toLocaleLowerCase()).filter(Boolean));
  const candidates: Array<VoomCommentReplyResult & { rawParentId?: string }> = [];

  for (const entry of replySource) {
    if (candidates.length >= 15 || !entry || typeof entry !== 'object') continue;
    const reply = entry as Record<string, unknown>;
    const authorName = String(reply.authorName ?? '').trim() || fallbackAuthorName;
    if (blockedAuthors.has(authorName.toLocaleLowerCase())) continue;

    const content = stripVoomCommentReplyPrefix(String(reply.content ?? ''));
    if (!content) continue;

    const contentTranslation = normalizeTranslationText(reply.contentTranslation ?? reply.translation ?? reply.translationZh ?? reply.chineseTranslation);
    const draftId = String(reply.id ?? reply.draftId ?? reply.tempId ?? '').trim();
    candidates.push({
      authorName,
      content,
      ...(contentTranslation ? { contentTranslation } : {}),
      ...(draftId ? { draftId } : {}),
      rawParentId: String(reply.parentId ?? '').trim()
    });
  }

  const draftIds = new Set(candidates.map((reply) => reply.draftId).filter(Boolean));
  const replies: VoomCommentReplyResult[] = [];

  for (const reply of candidates) {
    const parentId = reply.rawParentId ?? '';
    replies.push({
      authorName: reply.authorName,
      content: reply.content,
      ...(reply.contentTranslation ? { contentTranslation: reply.contentTranslation } : {}),
      ...(reply.draftId ? { draftId: reply.draftId } : {}),
      ...(parentId && (commentIds.has(parentId) || draftIds.has(parentId)) ? { parentId } : {})
    });
  }

  return replies;
}

function getResolvedTextApiConfig(settings: AppSettings | undefined, modelOverride = '') {
  const selection = splitModelSelection(modelOverride);
  if (selection.vendorId) {
    const vendor = settings?.apiVendors.find((item) => item.id === selection.vendorId);
    if (vendor) {
      const apiUrl = normalizeBaseUrl(vendor.apiUrl);
      return {
        endpoint: apiUrl ? `${apiUrl}/${vendor.apiPath.trim().replace(/^\/+/, '')}` : '',
        apiKey: vendor.apiKey,
        model: selection.model || vendor.models.find((model) => model.selected)?.id || vendor.models[0]?.id || ''
      };
    }
  }

  const resolved = getResolvedApiConfig(settings);
  return {
    ...resolved,
    model: selection.model || resolved.model
  };
}

export function hasTextGenerationConfig(settings: AppSettings | undefined, modelOverride = '') {
  const resolved = getResolvedTextApiConfig(settings, modelOverride);
  return Boolean(resolved.endpoint.trim() && resolved.model.trim());
}

function requireTextGenerationConfig(settings: AppSettings | undefined, modelOverride = '', target = 'AI 回复') {
  if (hasTextGenerationConfig(settings, modelOverride)) return;
  throw new Error(`请先配置可用的 API 模型后再使用${target}。`);
}

export interface TextGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  jsonMode?: boolean;
}

export async function requestTextGeneration(settings: AppSettings | undefined, prompt: string, modelOverride = '', options: TextGenerationOptions = {}) {
  requireTextGenerationConfig(settings, modelOverride, '文本生成');
  return callTextApi(settings, prompt, modelOverride, [], options);
}

export async function requestTextEmbedding(
  settings: AppSettings | undefined,
  input: string,
  modelOverride = '',
  embeddingModel = '',
  signal?: AbortSignal
): Promise<number[]> {
  return (await requestTextEmbeddings(settings, [input], modelOverride, embeddingModel, signal))[0] ?? [];
}

export async function requestTextEmbeddings(
  settings: AppSettings | undefined,
  inputs: string[],
  modelOverride = '',
  embeddingModel = '',
  signal?: AbortSignal
): Promise<number[][]> {
  requireTextGenerationConfig(settings, modelOverride, '记忆向量化');
  const resolved = getResolvedTextApiConfig(settings, modelOverride);
  const endpoint = resolved.endpoint.replace(/\/chat\/completions\/?(?:\?.*)?$/i, '/embeddings');
  if (endpoint === resolved.endpoint) throw new Error('当前 API 路径无法推导 Embeddings 端点，请使用以 /chat/completions 结尾的 OpenAI 兼容地址。');
  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {})
    },
    signal,
    body: JSON.stringify({
      model: embeddingModel.trim() || resolved.model,
      input: inputs.map((input) => input.slice(0, 12_000))
    })
  };
  const { response } = await fetchTextEndpoint(endpoint, requestInit);
  if (!response.ok) throw new Error(await createApiErrorMessage(response, '记忆 Embeddings API 请求失败'));
  const data = await readJsonPayload(response, '记忆 Embeddings API 返回异常');
  const rows = Array.isArray(data.data) ? [...data.data].sort((left, right) => Number(left?.index ?? 0) - Number(right?.index ?? 0)) : [];
  const vectors = rows.map((row) => row?.embedding);
  if (vectors.length !== inputs.length || vectors.some((vector) => !Array.isArray(vector) || !vector.length || vector.some((value: unknown) => !Number.isFinite(Number(value))))) {
    throw new Error('记忆 Embeddings API 没有返回有效向量。');
  }
  return vectors.map((vector) => vector.map(Number));
}

async function callTextApi(settings: AppSettings | undefined, prompt: string, modelOverride = '', imageParts: TextApiContentPart[] = [], options: TextGenerationOptions = {}) {
  const resolved = getResolvedTextApiConfig(settings, modelOverride);
  if (!resolved.endpoint.trim()) return '';
  const prioritizedPrompt = prependTabooWorldBookPrompt(prompt);

  const content = imageParts.length
    ? [{ type: 'text' as const, text: prioritizedPrompt }, ...imageParts]
    : prioritizedPrompt;

  const createRequestInit = (jsonMode: boolean): RequestInit => ({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(resolved.apiKey ? { Authorization: `Bearer ${resolved.apiKey}` } : {})
    },
    signal: options.signal,
    body: JSON.stringify({
      model: resolved.model,
      messages: [{ role: 'user', content }],
      temperature: options.temperature ?? 0.9,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  });

  let requestInit = createRequestInit(Boolean(options.jsonMode));

  let { response, requestEndpoint } = await fetchTextEndpoint(resolved.endpoint, requestInit);
  if (!response.ok && options.jsonMode && [400, 415, 422].includes(response.status)) {
    requestInit = createRequestInit(false);
    const compatibilityResult = await fetchTextEndpoint(resolved.endpoint, requestInit);
    response = compatibilityResult.response;
    requestEndpoint = compatibilityResult.requestEndpoint;
  }
  if (!response.ok && shouldRetryTextApiResponse(response)) {
    await waitForTextApiRetry();
    const retryResult = await fetchTextEndpoint(resolved.endpoint, requestInit);
    response = retryResult.response;
    requestEndpoint = retryResult.requestEndpoint;
  }

  if (!response.ok) {
    const statusHint = createTextApiStatusHint(response, resolved.endpoint);
    if (requestEndpoint.startsWith(textProxyPath) && response.status === 502) {
      throw new Error([await createApiErrorMessage(response, '本地文本模型代理请求失败'), statusHint].filter(Boolean).join('\n\n'));
    }
    throw new Error([await createApiErrorMessage(response, '文本模型 API 请求失败'), statusHint].filter(Boolean).join('\n\n'));
  }

  const data = await readJsonPayload(response, '文本模型 API 返回异常');
  return String(data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? data.content ?? '').trim();
}

export async function fetchVendorModels(vendor: Pick<ApiVendor, 'apiUrl' | 'apiKey'>): Promise<string[]> {
  const modelsEndpoint = `${vendor.apiUrl.trim().replace(/\/+$/, '')}/models`;
  if (!vendor.apiUrl.trim()) return [];
  const { response, requestEndpoint } = await fetchTextEndpointWithFallback(
    modelsEndpoint,
    {
      headers: {
        Accept: 'application/json',
        ...(vendor.apiKey ? { Authorization: `Bearer ${vendor.apiKey}` } : {})
      }
    },
    (error, endpoint, activeRequestEndpoint) => createNetworkErrorMessage(
      error,
      '模型列表网络请求失败',
      endpoint,
      activeRequestEndpoint.startsWith(textProxyPath)
        ? '本地同源文本代理没有响应。请确认正在通过 npm run dev 或 npm run preview 访问应用，并检查网关 /models 路径是否可达。'
        : '当前运行环境没有可用的同源文本代理，浏览器直连模型列表接口可能会被 CORS 或网络策略拦截。'
    )
  );

  if (!response.ok) {
    if (requestEndpoint.startsWith(textProxyPath) && response.status === 502) {
      throw new Error(await createApiErrorMessage(response, '本地文本模型代理请求失败'));
    }
    throw new Error(await createApiErrorMessage(response, '模型列表 API 请求失败'));
  }

  const data = await readJsonPayload(response, '模型列表 API 返回异常');
  const list: Array<Record<string, unknown>> = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : [];

  return list
    .map((item) => String(item?.id ?? item?.name ?? '').trim())
    .filter(Boolean);
}

export async function generateOpenAiImage(settings: AppSettings, overrides: ImageGenerationOverrides = {}): Promise<ImageGenerationResult> {
  const resolved = getResolvedOpenAiImageConfig(settings);
  const positivePrompt = prependTabooWorldBookPrompt(overrides.positivePrompt ?? settings.imageOpenAi.positivePrompt, 'image');
  const negativePrompt = overrides.negativePrompt ?? settings.imageOpenAi.negativePrompt;
  const referenceImage = await prepareReferenceImage(overrides.referenceImage ?? '', 'image/png', resolved.apiKey);
  const prompt = sanitizePrompt(positivePrompt, negativePrompt);
  const model = String(overrides.model ?? resolved.model).trim();
  const size = String(overrides.size ?? resolved.size).trim();

  if (!resolved.endpoint.trim() || !resolved.apiKey.trim()) {
    throw new Error('请先在 OpenAI 图片模块里配置可用的兼容供应商和 API Key。');
  }

  if (!model) {
    throw new Error('请先为 OpenAI 兼容供应商选择或手动添加图片模型。');
  }

  if (!prompt) {
    throw new Error('请先填写正向提示词。');
  }

  let response: Response;
  try {
    const requestEndpoint = referenceImage ? getOpenAiReferenceImageEndpoint(resolved.endpoint) : resolved.endpoint;
    const useMultipartReference = Boolean(referenceImage && !isOpenAiResponsesEndpoint(requestEndpoint));
    response = await fetchOpenAiImageWithRetry(requestEndpoint, {
      method: 'POST',
      headers: useMultipartReference
        ? { Authorization: `Bearer ${resolved.apiKey}` }
        : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resolved.apiKey}`
          },
      body: useMultipartReference && referenceImage
        ? buildOpenAiImageEditFormData(model, prompt, size, referenceImage)
        : JSON.stringify(buildOpenAiImageRequestBody(resolved.endpoint, model, prompt, size, resolved.preferBase64ImageResponse, referenceImage))
    });
  } catch (error) {
    throw new Error(createNetworkErrorMessage(error, 'OpenAI 图片网络请求失败', resolved.endpoint));
  }

  if (!response.ok) {
    throw new Error(await createApiErrorMessage(response, getOpenAiImageErrorTitle(response, resolved.endpoint)));
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';

  if (contentType.startsWith('image/')) {
    return {
      imageUrl: arrayBufferToDataUrl(await response.arrayBuffer(), contentType),
      provider: 'openai'
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`OpenAI 图片接口返回了无法解析的响应：${error instanceof Error ? error.message : String(error)}`);
  }

  const extractedImage = extractGeneratedImage(data);
  const imageUrl = extractedImage.imageUrl
    ? await localizeGeneratedImageUrl(extractedImage.imageUrl, extractedImage.mimeType, resolved.apiKey)
    : '';

  if (!imageUrl) {
    throw new Error('OpenAI 图片接口返回里没有可用图片。');
  }

  return {
    imageUrl,
    provider: 'openai'
  };
}

export async function generateNovelAiImage(settings: AppSettings, overrides: ImageGenerationOverrides = {}): Promise<ImageGenerationResult> {
  const config = settings.imageNovelAi;
  const positivePrompt = prependTabooWorldBookPrompt(overrides.positivePrompt ?? config.positivePrompt, 'image');
  const negativePrompt = overrides.negativePrompt ?? config.negativePrompt;
  const referenceImage = await prepareReferenceImage(overrides.referenceImage ?? '', 'image/png');
  const endpointBase = resolveNovelAiEndpointBase(settings);
  const generationEndpoint = `${endpointBase}/ai/generate-image`;

  if (!config.apiKey.trim()) {
    throw new Error('请先填写 NovelAI Token。');
  }

  if (!positivePrompt.trim()) {
    throw new Error('请先填写正向提示词。');
  }

  const { response, requestEndpoint } = await fetchNovelAiEndpoint(generationEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/x-zip-compressed, application/zip, application/octet-stream, image/*, */*',
      Authorization: `Bearer ${config.apiKey.trim()}`
    },
    body: JSON.stringify(buildNovelAiImageRequestBody(config, positivePrompt, negativePrompt, referenceImage, overrides))
  });

  if (!response.ok) {
    if (requestEndpoint.startsWith(textProxyPath) && response.status === 502) {
      throw new Error(await createApiErrorMessage(response, '本地 NovelAI 代理请求失败'));
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error('NovelAI Token 无法通过鉴权。');
    }
    throw new Error(await createApiErrorMessage(response, 'NovelAI 请求失败'));
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = await response.arrayBuffer();

  return {
    imageUrl: /zip|octet-stream/i.test(contentType)
      ? extractImageFromArchive(buffer)
      : arrayBufferToDataUrl(buffer, contentType.startsWith('image/') ? contentType : 'image/png'),
    provider: 'novelai'
  };
}

export async function fetchNovelAiModels(settings: AppSettings): Promise<NovelAiModelOption[]> {
  const config = settings.imageNovelAi;
  const endpointBase = getNovelAiEndpointBase(settings);

  if (!config.apiKey.trim() || !endpointBase) {
    return defaultNovelAiModels;
  }
  if (config.endpointMode === 'custom') {
    return config.availableModels.length ? config.availableModels : defaultNovelAiModels;
  }

  const modelListEndpoints = [
    `${endpointBase}/ai/generate-image/models`,
    `${endpointBase}/ai/models`
  ];

  for (const endpoint of modelListEndpoints) {
    try {
      const { response } = await fetchNovelAiEndpoint(endpoint, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${config.apiKey.trim()}`
        }
      });

      if (!response.ok) continue;
      const payload = await response.json();
      const models = normalizeNovelAiModelPayload(payload);
      if (models.length) return models;
    } catch {
      continue;
    }
  }

  return defaultNovelAiModels;
}

export async function checkNovelAiImageAccess(settings: AppSettings): Promise<void> {
  const config = settings.imageNovelAi;

  if (!config.apiKey.trim()) {
    throw new Error('请先填写 NovelAI Token。');
  }

  await probeNovelAiAuth(settings);
}

export async function generatePollinationsImage(settings: AppSettings, overrides: ImageGenerationOverrides = {}): Promise<ImageGenerationResult> {
  const config = settings.imagePollinations;
  const positivePrompt = prependTabooWorldBookPrompt(overrides.positivePrompt ?? config.positivePrompt, 'image');
  const negativePrompt = overrides.negativePrompt ?? config.negativePrompt;
  const referenceImage = overrides.referenceImage ?? config.referenceImage;

  if (!config.apiKey.trim()) {
    throw new Error('请先填写 Pollinations API Key。文档要求生成请求使用 Bearer key。');
  }

  if (!positivePrompt.trim()) {
    throw new Error('请先填写正向提示词。');
  }

  const promptPath = encodeURIComponent(positivePrompt.trim());
  const url = new URL(`https://gen.pollinations.ai/image/${promptPath}`);
  url.searchParams.set('model', overrides.model ?? config.model);
  url.searchParams.set('width', String(Math.max(320, Math.floor(overrides.width ?? config.width))));
  url.searchParams.set('height', String(Math.max(320, Math.floor(overrides.height ?? config.height))));
  url.searchParams.set('seed', (overrides.seed ?? config.seed).trim() ? String(parseSeed(overrides.seed ?? config.seed)) : '-1');
  url.searchParams.set('safe', config.safe);
  url.searchParams.set('quality', config.quality);
  url.searchParams.set('transparent', String(config.transparent));
  if (referenceImage.trim()) url.searchParams.set('image', referenceImage.trim());
  if (negativePrompt.trim()) {
    url.searchParams.set('negative', negativePrompt.trim());
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${config.apiKey.trim()}` }
  });

  if (!response.ok) {
    throw new Error(await createApiErrorMessage(response, 'Pollinations 请求失败'));
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = await response.arrayBuffer();

  return {
    imageUrl: arrayBufferToDataUrl(buffer, contentType.startsWith('image/') ? contentType : 'image/jpeg'),
    provider: 'pollinations'
  };
}

export async function fetchPollinationsModels(): Promise<PollinationsModelOption[]> {
  try {
    const response = await fetch('https://gen.pollinations.ai/image/models', {
      headers: { Accept: 'application/json' }
    });
    if (!response.ok) return defaultPollinationsModels;
    const payload = await response.json();
    const models = normalizePollinationsModelPayload(payload);
    return models.length ? models : defaultPollinationsModels;
  } catch {
    return defaultPollinationsModels;
  }
}

export async function checkPollinationsImageAccess(settings: AppSettings): Promise<void> {
  const config = settings.imagePollinations;
  if (!config.apiKey.trim()) {
    throw new Error('请先填写 Pollinations API Key。');
  }

  const promptPath = encodeURIComponent('link health check');
  const url = new URL(`https://gen.pollinations.ai/image/${promptPath}`);
  url.searchParams.set('model', config.model || defaultPollinationsModels[0].id);
  url.searchParams.set('width', '64');
  url.searchParams.set('height', '64');
  url.searchParams.set('seed', '-1');
  url.searchParams.set('safe', config.safe);
  url.searchParams.set('quality', config.quality);
  url.searchParams.set('transparent', String(config.transparent));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${config.apiKey.trim()}` }
  });

  if (!response.ok) {
    throw new Error(await createApiErrorMessage(response, 'Pollinations 生图接口检测失败'));
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('Pollinations 检测返回的不是图片内容。');
  }
}

export async function generateImageByProvider(
  provider: ImageProviderType,
  settings: AppSettings,
  overrides: ImageGenerationOverrides = {}
): Promise<ImageGenerationResult> {
  if (provider === 'openai') return generateOpenAiImage(settings, overrides);
  if (provider === 'novelai') return generateNovelAiImage(settings, overrides);
  return generatePollinationsImage(settings, overrides);
}

export function normalizeRoleplayReplyPayload(apiReply: string, input: GenerateReplyInput): string {
  if (apiReply) {
    try {
      const parsed = JSON.parse(extractJsonContent(apiReply)) as unknown;
      const parsedRecord = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Partial<RoleplayReplyResult>
        : {};
      const parsedRecordAny = parsedRecord as Record<string, unknown>;
      const hiddenPlotChoices: string[] = [];
      const replies = normalizeReplyMessages(parsed)
        .map((reply) => {
          const parsedReply = parsePlotChoicesFromText(reply);
          hiddenPlotChoices.push(...parsedReply.choices);
          return parsedReply.content || reply;
        })
        .filter(Boolean);
      const plotChoices = input.mode === 'offline'
        ? [...new Set([
          ...normalizePlotChoices(parsedRecordAny.plotChoices),
          ...normalizePlotChoices(parsedRecordAny.choices),
          ...normalizePlotChoices(parsedRecordAny.storyChoices),
          ...normalizePlotChoices(parsedRecordAny.directions),
          ...normalizeNestedPlotChoices(parsedRecordAny.messages),
          ...normalizeNestedPlotChoices(parsedRecordAny.replies),
          ...hiddenPlotChoices
        ].map((item) => item.trim()).filter(Boolean))].slice(0, 6)
        : [];
      const replyTranslations = normalizeTranslationMessages(parsed);
      const narrations = input.mode === 'online' && input.narrationModeEnabled
        ? normalizeNarrationLines(parsedRecordAny.narrations ?? parsedRecordAny.narrationMessages ?? parsedRecordAny.actionNarrations ?? parsedRecordAny.actions)
        : [];
      const segments = normalizeRoleplaySegments(
        parsedRecordAny.messages ?? parsedRecordAny.items ?? parsedRecordAny.sequence ?? parsedRecordAny.timeline ?? parsedRecordAny.segments,
        input.mode === 'online' && Boolean(input.narrationModeEnabled)
      );
      const messageActions = normalizeRoleplayMessageActions(parsedRecordAny);
      const images = normalizeRoleplayImages(parsedRecordAny.images ?? parsedRecordAny.imageMessages ?? parsedRecordAny.pictures);
      const profileUpdateRecord = parsedRecord.profileUpdate && typeof parsedRecord.profileUpdate === 'object'
        ? parsedRecord.profileUpdate as Record<string, unknown>
        : null;
      const stickers = [...new Set([
        ...normalizeStickerSelections(parsedRecord.stickers),
        ...normalizeStickerSelections(parsedRecordAny.stickerIds),
        ...normalizeStickerSelections(parsedRecordAny.sticker)
      ].map((item) => item.trim()).filter(Boolean))];
      const stickerPlacements = [
        ...normalizeStickerPlacements(parsedRecordAny.stickerPlacements),
        ...normalizeStickerPlacements(parsedRecordAny.replyStickers),
        ...normalizeStickerPlacements(parsedRecordAny.stickerMessages),
        ...normalizeReplyStickerPlacements(parsedRecordAny.replies ?? parsedRecordAny.messages)
      ];
      return JSON.stringify({
        reply: replies[0] ?? '',
        replies,
        plotChoices,
        replyTranslations,
        narrations: narrations.slice(0, 5),
        images,
        stickers,
        stickerPlacements,
        segments,
        messageActions,
        profileUpdate: profileUpdateRecord
          ? {
              nickname: String(profileUpdateRecord.nickname ?? '').trim(),
              signature: String(profileUpdateRecord.signature ?? '').trim(),
              narration: String(profileUpdateRecord.narration ?? '').trim(),
              innerMonologue: normalizeInnerMonologueLines(
                profileUpdateRecord.innerMonologue
                ?? profileUpdateRecord.innerThoughts
                ?? profileUpdateRecord.thoughts
                ?? profileUpdateRecord.statusLines
              ).slice(0, 5),
              profileThemeId: String(profileUpdateRecord.profileThemeId ?? '').trim(),
              profileThemeContent: String(
                profileUpdateRecord.profileThemeContent
                ?? profileUpdateRecord.profileTheme
                ?? profileUpdateRecord.profileStatus
                ?? ''
              ).trim()
            }
          : null
      } satisfies RoleplayReplyResult);
    } catch {
      const hiddenPlotChoices: string[] = [];
      const replies = (input.mode === 'online' ? normalizeRawOnlineReply(apiReply) : [apiReply])
        .map((reply) => {
          const parsedReply = parsePlotChoicesFromText(reply);
          hiddenPlotChoices.push(...parsedReply.choices);
          return parsedReply.content || reply;
        });
      const plotChoices = input.mode === 'offline' ? [...new Set(hiddenPlotChoices)].slice(0, 6) : [];
      return JSON.stringify({ reply: replies[0] ?? '', replies, plotChoices, narrations: [], images: [], stickers: [], stickerPlacements: [], segments: [], messageActions: { recallMessageIds: [], quotes: [] }, profileUpdate: null } satisfies RoleplayReplyResult);
    }
  }
  throw new Error('角色回复模型没有返回内容。');
}

export async function generateRoleplayReply(input: GenerateReplyInput): Promise<string> {
  requireTextGenerationConfig(input.settings, input.modelOverride, '角色回复');
  const prompt = buildPrompt(input);
  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride, await getPreparedVisualImageParts(input));
  return normalizeRoleplayReplyPayload(apiReply, input);
}

export async function generateVoomPost(context: PromptContext, settings?: AppSettings, modelOverride = ''): Promise<Omit<VoomPost, 'id' | 'createdAt'>> {
  const { content, contentTranslation, imageDescription, imageGenerationPrompt, likes, comments } = await generateVoomPayload(context, settings, modelOverride);
  const characterName = getCharacterAiName(context.character);
  const characterAuthorAliases = new Set([context.character.id, context.character.name, context.character.nickname, characterName]
    .map((name) => name.trim().toLocaleLowerCase())
    .filter(Boolean));
  const resolvedComments = resolveInitialVoomComments(comments).map((comment) => characterAuthorAliases.has(comment.authorName.trim().toLocaleLowerCase())
    ? { ...comment, authorName: characterName, authorId: context.character.id }
    : comment);

  return {
    charId: context.character.id,
    conversationId: context.messages[0]?.conversationId,
    authorName: characterName,
    authorAvatar: context.character.avatar,
    content,
    contentTranslation,
    imageDescription,
    imageGenerationPrompt,
    likes,
    comments: resolvedComments
  };
}

function extractHtmlCodeBlock(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:html)?\s*([\s\S]*?)\s*```/i);
  const rawHtml = (fenced?.[1] ?? trimmed).trim();
  const htmlStart = rawHtml.search(/<!doctype\s+html|<html[\s>]/i);
  return (htmlStart >= 0 ? rawHtml.slice(htmlStart) : rawHtml).trim();
}

function ensureCompleteHtmlDocument(content: string, fallbackTitle: string) {
  const html = extractHtmlCodeBlock(content);
  if (!html) return '';
  if (/<html[\s>]/i.test(html)) return html;

  const title = escapeHtmlText(fallbackTitle || '小剧场');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${title}</title>
</head>
<body>
${html}
</body>
</html>`;
}

function escapeHtmlText(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeHtmlText(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function compactHtmlText(value: string, maxLength: number) {
  const normalized = decodeHtmlText(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function extractSmallTheaterTitle(html: string, fallback: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    ?? html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  return compactHtmlText(titleMatch?.[1] ?? '', 36) || fallback;
}

function extractSmallTheaterSummary(html: string, fallback: string) {
  const metaMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
    ?? html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return compactHtmlText(metaMatch?.[1] ?? '', 90) || fallback;
}

function buildCoupleSpacePrompt(input: { context: PromptContext; previousSnapshot?: CoupleSpaceSnapshot }) {
  const characterName = getCharacterAiName(input.context.character);
  const userName = getUserAiName(input.context.boundUser ?? input.context.user);
  const previousSnapshot = input.previousSnapshot
    ? `上一次状态（只用于保持生活路线连续，不必重复）：\n${JSON.stringify(input.previousSnapshot)}`
    : '';
  return [
    buildPrompt(input.context, { includeAvailableStickers: false }),
    `现在为 ${userName} 与 ${characterName} 的「情侣守护空间」生成一次角色生活状态快照。`,
    `这是双方授权查看的角色互动模拟，不是真实 GPS、系统监控或设备取证。请根据角色设定、世界书、记忆、近期聊天、当前时间与角色生活轨迹，创造可信且有连续性的状态；不要声称读取真实手机权限，不要替 ${userName} 行动。`,
    previousSnapshot,
    `内容要求：
  1. location 必须覆盖生成时刻往前完整 24 小时，按时间顺序给出 8–12 个 route 节点，包含睡眠、起床、吃饭、工作/学习、通勤、社交、办事、休闲等真实生活节奏。每段写开始/结束时间、地点、活动分类、发生了什么、同行者、留下的生活痕迹，以及可选的未说出口想法。不能只给三四个概览点。
  2. device 是 ${characterName} 自愿分享的“可翻看手机”：0–100 电量、充电、using/locked/idle、解锁/锁屏、总使用分钟、当前应用和网络；另外必须生成 6–10 条应用使用、6–12 条通知、4–8 个聊天之外的联系人会话、6–12 条搜索/浏览/地图/购物足迹、5–9 张相册生活切片、4–8 条备忘录，以及 6–12 条闹钟/日程/订单/音乐/未发送草稿记录。
  3. device.chats 是 ${characterName} 与家人、朋友、同事、同学、NPC 等人的聊天，必须是当前 BabyLink 对话里从未展示过的新内容。每个会话写关系、摘要和 3–8 条具体往来，内容要有日常琐事、社交关系、工作学习、吐槽、秘密准备或反差感，不能全都围绕 ${userName}，也不能复制近期聊天原句。
  4. notifications、footprints、gallery、notes、lifeRecords 要彼此呼应并能拼出 ${characterName} 的真实一天，例如搜索过的店与订单、闹钟与赶路、相册与行程、备忘录与下一步计划形成细节闭环；允许有无伤大雅的小秘密、尴尬搜索、没发出的草稿和生活反差，增强“查手机”的趣味，但不要制造恶意背叛或无依据极端冲突。
  5. bond 要强烈贴合 ${characterName} 与 ${userName} 当前关系，不要通用甜言蜜语；想念值与默契值为 0–100。daySummary 总结聊天之外的 24 小时，hiddenThought 写 ${characterName} 没发给 ${userName} 的真实想法，keywords 给 3–6 个当天关键词。
  6. moments 给出 6–10 个未在当前聊天出现的生活片段，覆盖不同时段和情绪，每条写分类、完整细节和可选的“没发给 ${userName}”内容。
  7. 所有时间、地点、路线、应用、联系人、通知、搜索、相册、订单和片段必须内部一致；不要每次都生成完美约会、全员只聊恋爱或极端戏剧。地名可以来自设定，设定不足时创造符合世界观的地点，不要把未知信息说成现实事实。`,
    `只输出以下结构的 JSON，不要输出 Markdown、代码块或解释：
  {"location":{"place":"当前地点","address":"地址或场景描述","status":"正在做什么","distance":"彼此的距离描述","transport":"交通方式","eta":"预计到达或下一站","stayMinutes":35,"route":[{"name":"地点","time":"07:10","endTime":"08:00","kind":"start|pass|stay|arrival","category":"sleep|home|travel|work|meal|social|errand|leisure","detail":"这一段完整发生了什么","companion":"具体姓名或独自一人","trace":"票据/物品/照片/气味等生活痕迹","privateThought":"可留空的私下想法"}]},"device":{"battery":76,"charging":false,"screenStatus":"using|locked|idle","lastUnlockedAt":"18:42","lastLockedAt":"18:39","usageMinutes":286,"activeApp":"应用或用途","network":"当前网络","networkHistory":[{"name":"网络名称","time":"17:10","kind":"wifi|cellular|offline"}],"appUsage":[{"app":"应用名","minutes":52,"lastUsedAt":"18:40","detail":"具体用来做什么"}],"notifications":[{"app":"应用名","time":"18:31","title":"通知标题","preview":"通知预览","unread":true}],"chats":[{"contact":"联系人姓名","relation":"与角色的关系","avatarEmoji":"emoji","updatedAt":"18:25","unread":2,"summary":"这段聊天的来龙去脉","messages":[{"sender":"character|contact","time":"18:20","text":"具体消息"}]}],"footprints":[{"kind":"search|browser|map|shopping","time":"16:20","title":"搜索词或页面标题","detail":"看到了什么","reason":"为什么点开"}],"gallery":[{"time":"15:30","title":"照片标题","detail":"画面和拍摄原因","emoji":"emoji","palette":["#fbd3e1","#d8cff8"]}],"notes":[{"folder":"文件夹","title":"标题","content":"完整内容","updatedAt":"14:10","pinned":false}],"lifeRecords":[{"kind":"alarm|calendar|order|music|draft","time":"13:00","title":"记录标题","detail":"具体内容","status":"状态"}]},"bond":{"mood":"心情短语","moodEmoji":"emoji","missLevel":82,"syncScore":91,"nextPlan":"下一件想一起做的事","whisper":"角色口吻悄悄话","daySummary":"聊天之外完整一天的总结","hiddenThought":"没发给对方的话","keywords":["关键词1","关键词2","关键词3"]},"moments":[{"time":"17:45","category":"生活分类","title":"片段标题","detail":"没有出现在聊天里的完整生活细节","emoji":"emoji","unspoken":"可留空的没发给对方的话"}]}`
  ].filter(Boolean).join('\n\n');
}

export async function generateCoupleSpaceSnapshot(input: {
  context: PromptContext;
  previousSnapshot?: CoupleSpaceSnapshot;
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<CoupleSpaceSnapshot> {
  requireTextGenerationConfig(input.settings, input.modelOverride, '情侣空间同步');
  const apiReply = await callTextApi(input.settings, buildCoupleSpacePrompt(input), input.modelOverride);
  if (!apiReply.trim()) throw new Error('情侣空间模型没有返回状态内容。');
  const parsed = JSON.parse(extractJsonContent(apiReply)) as unknown;
  return normalizeCoupleSpaceSnapshot(parsed, Date.now());
}

function buildSmallTheaterPrompt(input: { context: PromptContext; topic: SmallTheaterTopic; recentTheaters?: SmallTheater[] }) {
  const characterName = getCharacterAiName(input.context.character);
  const topicPrompt = input.topic.prompt.trim() || input.topic.title;
  return [
    buildPrompt(input.context, { includeAvailableStickers: false }),
    '现在生成一个「小剧场」独立番外页面。它可以读取上面的角色设定、世界书、记忆手册、最近对话和当前时间上下文，但它绝对不是聊天消息、不是 VOOM、不是记忆写入内容，也不会被 AI 后续读取。',
    '生成结果必须是正文之外的番外小页面：不要把内容写成角色已在当前会话里发送、发布或注入楼层；不要输出聊天事件、VOOM JSON、朋友圈、系统旁白或任何需要写回对话的内容。',
    `本次角色：${characterName}（角色ID：${input.context.character.id}）`,
    `本次小剧场题材：${input.topic.title}\n题材扩展：${topicPrompt}`,
    `题材扩展使用规则：
  1. 题材扩展里的“可用玩法”“例如”“至少设计”等内容全部只是参考灵感，不是固定模板、固定清单或必须照抄的菜单。
  2. 生成时必须先理解本次角色设定、关系阶段、近期对话和题材核心，再重新发明适合这一组角色的页面结构、线索、事件、互动和文案。
  3. 禁止机械套用题材扩展中的例子、模块名、事件顺序和结尾方式；如果使用某个例子，必须改造成贴合角色的新版本，并混入至少一半原创元素。
  4. 同一题材每次生成都要有新的入口、新的冲突、新的可玩机制和新的隐藏信息，不要让 HTML 页面布局、按钮、卡片和剧情节奏千篇一律。`,
    `输出格式：只输出一个完整 HTML 文件代码块，形如：\n\`\`\`html\n<!doctype html>...\n\`\`\`。不要输出解释、JSON、Markdown 标题或代码块之外的文字。`,
    `HTML 要求：
1. 必须包含 <!doctype html>、<html>、<head>、<meta charset="UTF-8">、<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">、<title>、完整 <style> 和 <script>。
2. 使用 html, body { margin: 0; min-height: 100%; overflow-x: hidden; }，主容器使用 min-height: 100dvh 并提供 100svh/100vh 兼容兜底。
3. 必须适配手机端 320px-480px 宽度，考虑安全区、竖屏滚动、触控目标、按钮状态、长文本换行、软键盘、深浅色视觉对比和浏览器地址栏高度变化。
4. 页面默认只允许纵向滚动，不要产生横向滚动；任何宽图、表格、卡片、代码、长词、按钮组都必须 max-width: 100%、min-width: 0、overflow-wrap: anywhere 或在局部容器内可控滚动。
5. 不要把正文塞进固定高度的内部滚动面板；除非是明确的短列表/弹层，内容应随页面自然向下延展，避免用户在手机上看不完整或出现双重滚动。
6. 触控目标不小于 44px，高频按钮用 <button type="button">；按钮、选项、折叠项、弹层关闭、翻页等控件必须可点击，不要被透明遮罩、pointer-events、过高 z-index 或全屏装饰层挡住。
7. 不要在 document/window/body 上拦截 touchstart、touchmove、pointermove、wheel 或调用 preventDefault；横向滑动/拖动只绑定在具体局部控件上，不能破坏手机浏览器边缘左右滑动返回。
8. 有互动性：至少包含 3 个可点击/可切换/可展开/可选择/可拖动/可输入的交互点，交互由原生 JavaScript 实现，并且不依赖网络。
9. 不允许加载外部 JS/CSS/字体/图片/接口；图片只能用 CSS、emoji、渐变、内嵌 SVG data URL 或纯 HTML/CSS 视觉替代。
10. 小剧场要像一个完整可玩的移动网页，而不是静态文章：可以使用论坛楼层、问答折叠、群聊切换、相册翻页、时间线、卡牌、投票、抽签、小游戏、档案抽屉等形式。
11. 内容必须遵守信息边界：NPC 可以来自当前角色设定、世界书、记忆或合理新生成的当前角色社交圈，如果没有可以对NPC进行合理的世界线拓展。
12. 标题、正文、按钮文案和交互反馈要自然、有代入感；如果题材扩展要求某个平台、节目、网络梗或特定说话口吻，必须让文案、节奏、交互反馈都强风格化地服务该题材，不要被通用规则稀释成正经 AI 味；不要在页面里解释“这是功能”“这是 HTML/CSS/JS”“如何使用本应用”。
13. 这是番外，不改变正文事实；如果写平行世界、传闻、论坛猜测或匿名爆料，必须在页面语气里自然体现它不是既定事实。
14. JavaScript 必须健壮：使用 DOMContentLoaded 或脚本放在 body 末尾，选择器存在性要检查，事件委托或逐项绑定都要防空值，交互不能因为缺少元素报错。
15. <body> 里必须先写出可见的静态 HTML 内容，JavaScript 只能增强交互，不能把全部正文放在脚本里动态生成；即使脚本失败，用户也要能看到标题、正文和主要控件。
16. 任何弹层、抽屉、菜单、toast、底部操作栏都必须能关闭或自动让出正文；固定定位元素必须考虑 safe-area，并且不能永久遮住主要内容、输入框或按钮。
17. 表单和输入框在 iOS 上字体至少 16px，避免聚焦缩放；输入反馈要即时显示，不能依赖 alert、confirm、prompt。
18. CSS 不能依赖尚未定义的变量；不要使用会导致空白页的实验特性作为唯一布局手段，复杂效果必须有普通 CSS 兜底。
19. <script> 中不要使用 import、export、TypeScript、顶层 await、fetch、localStorage、IndexedDB、跨域资源或框架语法；只使用可在沙盒 iframe 里直接运行的原生 JavaScript。
20. 视觉要完整：有明确层级、背景、卡片/列表/控件状态、空状态或完成状态，避免文字溢出、重叠、按钮过小、点击无响应、内容被裁切或页面横向滚动。
21. 所有可读文字禁止使用固定 height/max-height、overflow:hidden/clip、text-overflow:ellipsis、white-space:nowrap、line-clamp 或遮罩渐隐来截断；文字必须完整换行显示。只有用户主动关闭的弹层或切换后隐藏的面板才允许隐藏。
22. 所有按钮、选项、折叠、标签页、翻页和关闭控件都必须在页面自己的 JavaScript 中逐一完成 click 事件绑定；选择器必须与 HTML 元素一致，绑定前检查元素存在，不能只监听 touchstart、pointerdown、mouseenter 或 hover，也不能依赖宿主页面提供事件。
23. 每次点击都必须立刻改变可见文字、选中态、数值、进度或面板等等；弹层和隐藏面板打开后必须有明确关闭方式，禁止只有装饰动画却没有结果反馈。
24. 输出前自检：在 320px、390px、480px 宽的手机竖屏里，逐段确认没有文字被省略或裁切，首屏不空白，主要内容完整可滚动；逐一核对每个按钮的选择器和 click 回调，确保点击后有可见反馈，底部内容可到达，页面不会因为一段脚本错误整体不可用。`
  ].join('\n\n');
}

function buildSmallTheaterContinuationPrompt(input: { context: PromptContext; topic: SmallTheaterTopic; sourceTheater: SmallTheater; continuationGuidance?: string; recentTheaters?: SmallTheater[] }) {
  const characterName = getCharacterAiName(input.context.character);
  const topicPrompt = input.topic.prompt.trim() || input.topic.title;
  const continuationGuidance = input.continuationGuidance?.trim();
  const previousContent = getSmallTheaterVisibleText(input.sourceTheater.html).slice(0, 16000);
  return [
    buildPrompt(input.context, { includeAvailableStickers: false }),
    '现在基于一个已经生成过的「小剧场」独立 HTML 页面继续更新。你要输出一个新的完整 HTML 文件，它会作为新的小剧场卡片保存；原小剧场不会被覆盖。不要输出片段、差异或解释。',
    '更新目标：承接原小剧场已经发生/展示的核心内容和页面玩法，在新的 HTML 页面里自然追加新的楼层、章节、帖子更新、时间线事件、评论、分支结果或后续互动。不要把原内容推翻、删除成摘要，也不要只重写开头。',
    '生成结果仍然是正文之外的番外小页面：不要把内容写成角色已在当前会话里发送、发布或注入楼层；不要输出聊天事件、VOOM JSON、朋友圈、系统旁白或任何需要写回对话的内容。',
    `本次角色：${characterName}（角色ID：${input.context.character.id}）`,
    `本次小剧场题材：${input.topic.title}\n题材扩展：${topicPrompt}`,
    `题材扩展使用规则：
  1. 题材扩展里的“可用玩法”“例如”“至少设计”等内容全部只是参考灵感，不是固定模板、固定清单或必须照抄的菜单。
  2. 续写时必须先理解原小剧场已经使用过的结构、线索、互动和文案，再发明新的推进方式；不要重复原页面的模块排列、按钮命名和事件套路。
  3. 禁止机械套用题材扩展中的例子、模块名、事件顺序和结尾方式；如果使用某个例子，必须改造成贴合角色和前文的新版本，并混入至少一半原创元素。
  4. 同一题材每次更新都要有新的入口、新的冲突、新的可玩机制和新的隐藏信息，不要让 HTML 页面布局、按钮、卡片和剧情节奏千篇一律。`,
    `原小剧场标题：${input.sourceTheater.title}`,
    `原小剧场摘要：${input.sourceTheater.summary}`,
    `原小剧场可见正文：\n${previousContent || '原页面没有提取到可见正文，请根据标题和摘要继续生成。'}`,
    continuationGuidance ? `用户这次希望引导小剧场往这个方向更新：\n${continuationGuidance}` : '',
    `续写要求：
1. 输出一个完整 HTML 文件代码块，形如：\n\`\`\`html\n<!doctype html>...\n\`\`\`。不要输出解释、JSON、Markdown 标题或代码块之外的文字。
2. 新增内容必须明确承接原小剧场以及字数要求，体现“新的小剧场卡片继续往下发展”，例如增加新楼层、新章节、新消息、新帖子更新、新评论、新线索、新分支结果或下一天事件等等。
3. 保留移动端适配、可滚动正文、至少 3 个原生 JS 交互点、无外部资源、脚本失败也可见正文等所有 HTML 质量要求。
4. 页面里可以自然出现“更新”“新楼层”“续篇”等内容标签，但不要解释应用功能或 HTML 实现。
5. 更新后的结尾继续留下可再次更新的钩子，方便后续无限迭代。`,
    `HTML 质量要求：
1. 必须包含 <!doctype html>、<html>、<head>、<meta charset="UTF-8">、<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">、<title>、完整 <style> 和 <script>。
2. 使用 html, body { margin: 0; min-height: 100%; overflow-x: hidden; }，主容器使用 min-height: 100dvh 并提供 100svh/100vh 兼容兜底。
3. 必须适配手机端 320px-480px 宽度，考虑安全区、竖屏滚动、触控目标、按钮状态、长文本换行、软键盘、深浅色视觉对比和浏览器地址栏高度变化。
4. 页面默认只允许纵向滚动，不要产生横向滚动；任何宽图、表格、卡片、代码、长词、按钮组都必须 max-width: 100%、min-width: 0、overflow-wrap: anywhere 或在局部容器内可控滚动。
5. 不要把正文塞进固定高度的内部滚动面板；除非是明确的短列表/弹层，内容应随页面自然向下延展，避免用户在手机上看不完整或出现双重滚动。
6. 触控目标不小于 44px，高频按钮用 <button type="button">；按钮、选项、折叠项、弹层关闭、翻页等控件必须可点击，不要被透明遮罩、pointer-events、过高 z-index 或全屏装饰层挡住。
7. 不要在 document/window/body 上拦截 touchstart、touchmove、pointermove、wheel 或调用 preventDefault；横向滑动/拖动只绑定在具体局部控件上，不能破坏手机浏览器边缘左右滑动返回。
8. 有互动性：至少包含 3 个可点击/可切换/可展开/可选择/可拖动/可输入的交互点，交互由原生 JavaScript 实现，并且不依赖网络。
9. 不允许加载外部 JS/CSS/字体/图片/接口；图片只能用 CSS、emoji、渐变、内嵌 SVG data URL 或纯 HTML/CSS 视觉替代。
10. <body> 里必须先写出可见的静态 HTML 内容，JavaScript 只能增强交互，不能把全部正文放在脚本里动态生成；即使脚本失败，用户也要能看到标题、正文和主要控件。
11. 正文、对话、帖子、选项说明、档案描述等可读文字禁止使用固定 height/max-height、overflow:hidden/clip、text-overflow:ellipsis、white-space:nowrap、line-clamp 或遮罩渐隐来截断；文字必须完整换行显示。只有用户主动关闭的弹层或切换后隐藏的面板才允许隐藏。
12. 所有按钮、选项、折叠、标签页、翻页和关闭控件都必须在页面自己的原生 JavaScript 中完成 click 事件绑定，选择器与 HTML 一致且绑定前检查元素存在；不能只监听触摸、指针、悬停事件，也不能依赖宿主页面提供事件。
13. 每次点击必须立刻产生可见反馈；在 320px、390px、480px 竖屏逐段确认文字完整、页面可滚动，并逐一核对每个按钮的选择器与 click 回调，确保底部可到达。`
  ].join('\n\n');
}

export async function generateSmallTheater(input: {
  context: PromptContext;
  topic: SmallTheaterTopic;
  recentTheaters?: SmallTheater[];
  sourceTheater?: SmallTheater;
  continuationGuidance?: string;
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<SmallTheaterGenerationResult> {
  requireTextGenerationConfig(input.settings, input.modelOverride, '小剧场生成');
  const prompt = input.sourceTheater
    ? buildSmallTheaterContinuationPrompt({ context: input.context, topic: input.topic, sourceTheater: input.sourceTheater, continuationGuidance: input.continuationGuidance, recentTheaters: input.recentTheaters })
    : buildSmallTheaterPrompt({ context: input.context, topic: input.topic, recentTheaters: input.recentTheaters });
  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride);
  let html = ensureCompleteHtmlDocument(apiReply, input.sourceTheater?.title || input.topic.title);
  if (!html) throw new Error('小剧场模型没有返回 HTML 内容。');
  assertRenderableSmallTheaterHtml(html);
  html = withSmallTheaterRuntimeGuard(html, input.sourceTheater?.title || input.topic.title);

  const fallbackSummary = `由「${input.topic.title}」生成的互动番外小剧场。`;
  return {
    title: extractSmallTheaterTitle(html, input.sourceTheater?.title || input.topic.title),
    summary: extractSmallTheaterSummary(html, fallbackSummary),
    html,
    model: getResolvedTextApiConfig(input.settings, input.modelOverride).model
  };
}

function normalizeUserVoomComments(input: unknown, targetCharacters: CharacterProfile[]): UserVoomCommentResult[] {
  const source = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { comments?: unknown }).comments)
      ? (input as { comments: unknown[] }).comments
      : [];
  const characterAliases = new Map<string, CharacterProfile>();
  for (const character of targetCharacters) {
    [character.id, character.name, character.nickname, getCharacterAiName(character)]
      .map((name) => name.trim().toLocaleLowerCase())
      .filter(Boolean)
      .forEach((name) => characterAliases.set(name, character));
  }

  const candidates: Array<UserVoomCommentResult & { rawParentId?: string }> = [];
  for (const entry of source) {
    if (candidates.length >= 15 || !entry || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    const content = stripVoomCommentReplyPrefix(String(record.content ?? record.text ?? record.comment ?? ''));
    if (!content) continue;

    const requestedAuthorId = String(record.authorId ?? record.characterId ?? '').trim();
    const requestedAuthorName = String(record.authorName ?? record.name ?? record.nickname ?? '').trim();
    const character = characterAliases.get(requestedAuthorId.toLocaleLowerCase()) ?? characterAliases.get(requestedAuthorName.toLocaleLowerCase());
    const fallbackCharacter = !requestedAuthorName ? targetCharacters[candidates.length % targetCharacters.length] : undefined;
    const authorName = character
      ? getCharacterAiName(character)
      : fallbackCharacter
        ? getCharacterAiName(fallbackCharacter)
        : requestedAuthorName;
    if (!authorName) continue;

    const contentTranslation = normalizeTranslationText(record.contentTranslation ?? record.translation ?? record.translationZh ?? record.chineseTranslation);
    const draftId = String(record.id ?? record.draftId ?? record.tempId ?? '').trim();
    candidates.push({
      authorName,
      authorId: character?.id ?? fallbackCharacter?.id,
      content,
      ...(contentTranslation ? { contentTranslation } : {}),
      ...(draftId ? { draftId } : {}),
      rawParentId: String(record.parentId ?? record.replyToId ?? '').trim()
    });
  }

  const draftIds = new Set(candidates.map((comment) => comment.draftId).filter(Boolean));
  return candidates.map((comment) => {
    const parentId = comment.rawParentId && draftIds.has(comment.rawParentId) ? comment.rawParentId : undefined;
    return {
      authorName: comment.authorName,
      ...(comment.authorId ? { authorId: comment.authorId } : {}),
      content: comment.content,
      ...(comment.contentTranslation ? { contentTranslation: comment.contentTranslation } : {}),
      ...(comment.draftId ? { draftId: comment.draftId } : {}),
      ...(parentId ? { parentId } : {})
    };
  });
}

export async function generateUserVoomComments(input: {
  author: UserProfile;
  content: string;
  imageDescription?: string;
  createdAt?: number;
  targetCharacters: CharacterProfile[];
  timeAwareness?: ConversationTimeAwarenessSettings;
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<UserVoomCommentResult[]> {
  if (!input.targetCharacters.length) return [];
  requireTextGenerationConfig(input.settings, input.modelOverride, '用户 VOOM 评论生成');

  const timeAwarenessPrompt = renderTimeAwarenessPrompt(input.timeAwareness, {
    userName: getUserAiName(input.author)
  });
  const includeTimeContext = shouldIncludeVoomTimeContext(input.timeAwareness);

  const targetCharacterText = input.targetCharacters
    .map((character) => [
      `id: ${character.id}`,
      `角色姓名: ${getCharacterAiName(character)}`,
      `主页签名: ${character.signature || '无'}`,
      `角色设定: ${character.description || '无'}`
    ].join('；'))
    .join('\n');
  const prompt = [
    '你要模拟 LINK VOOM 里，用户可见角色以及这些角色社交圈 NPC 看到用户动态后的自然评论区。只输出 JSON，不要输出 JSON 以外的文字。',
    timeAwarenessPrompt,
    `用户姓名：${getUserAiName(input.author)}`,
    `用户设定：${input.author.description || '无'}`,
    includeTimeContext && input.createdAt ? `用户动态发布时间：${formatVoomContextTime(input.createdAt)}` : '',
    `用户动态正文：\n${input.content}`,
    input.imageDescription ? `配图描述：${input.imageDescription}` : '',
    `可见角色与可用 NPC 线索：\n${targetCharacterText}`,
    `输出格式：
{
  "comments": [
    { "id": "c1", "authorId": "可见角色 id；NPC 留空", "authorName": "发言者显示名", "content": "评论内容", "contentTranslation": "如 content 不是普通话，则给普通话译文；否则留空", "parentId": "被回复的本次评论 id；直接评论则留空" },
    { "id": "c2", "authorName": "真实感 NPC 名", "content": "回复内容", "contentTranslation": "如 content 不是普通话，则给普通话译文；否则留空", "parentId": "c1" }
  ]
}`,
    '要求：1. 输出 6-15 条；2. 可见角色本人发言时填写对应 authorId；NPC 不填 authorId，但必须填写具体 authorName；3. NPC 可以来自可见角色自己的设定、社交圈、朋友同事家人粉丝或参考上下文内容生成，如果没有提及则可以根据世界线合理拓展相应NPC；4. parentId 留空表示直接评论用户动态，填写本次前面输出的 id 表示回复那条评论；5. 可以让角色回复 NPC，也可以让 NPC 回复角色或其他 NPC，但不要代替用户本人评论；6. 评论要短、自然、有社交软件感，不要解释设定；7. 不要使用“NPC”“朋友A”“路人”这类占位名；8. contentTranslation 规则：外语、粤语都要翻译成自然现代简体普通话；不要加“翻译：”前缀。'
  ].filter(Boolean).join('\n\n');

  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride);
  if (!apiReply) return [];

  try {
    return normalizeUserVoomComments(JSON.parse(extractJsonContent(apiReply)), input.targetCharacters);
  } catch {
    const content = apiReply.trim();
    const character = input.targetCharacters[0];
    return content && character
      ? [{ authorName: getCharacterAiName(character), authorId: character.id, content }]
      : [];
  }
}

export async function generateVoomCommentReplies(input: {
  context: PromptContext;
  post: VoomPost;
  userComments: VoomComment[];
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<VoomCommentReplyResult[]> {
  requireTextGenerationConfig(input.settings, input.modelOverride, 'VOOM 评论回复');
  const fallbackAuthorName = getCharacterAiName(input.context.character);
  const postAuthorName = input.post.authorName || fallbackAuthorName;
  const postBelongsToUser = input.post.authorType === 'user';
  const targetComments = input.userComments.length ? input.userComments : input.post.comments.slice(-2);
  const includeTimeContext = shouldIncludeVoomTimeContext(input.context.timeAwareness);
  const blockedAuthorNames = [getUserAiName(input.context.boundUser), getUserAiName(input.context.user)]
    .map((name) => name.trim())
    .filter(Boolean);
  const prompt = [
    buildPrompt(input.context, { includeAvailableStickers: false }),
    '现在你要模拟这条 VOOM 的真实评论区继续发展。只输出 JSON，不要输出 JSON 以外的任何文字。',
    `当前执行角色：${fallbackAuthorName}（角色ID：${input.context.character.id}）`,
    `VOOM 作者：${postAuthorName}${postBelongsToUser ? '（当前用户）' : ''}`,
    postBelongsToUser
      ? '社交圈边界：这是用户发布的 VOOM。除当前执行角色本人外，不要新增任何NPC作者；不要替用户发言。'
      : '社交圈边界：新增NPC只能来自这条 VOOM 作者所属角色自己的社交圈。',
    `VOOM 正文：\n${formatVoomPostPromptContent(input.post, includeTimeContext)}`,
    `评论区：\n${input.post.comments.map((comment) => formatVoomCommentPromptLine(comment, includeTimeContext)).join('\n') || '暂无评论。'}`,
    `优先关注这些评论：\n${targetComments.map((comment) => formatVoomCommentPromptLine(comment, includeTimeContext)).join('\n') || '没有指定评论，可根据正文补一条自然评论。'}`,
    `不要使用这些作者名发言：${blockedAuthorNames.join('、') || '当前用户'}`,
    `输出格式：
{
  "replies": [
    { "id": "r1", "authorName": "${fallbackAuthorName}", "content": "回复内容", "contentTranslation": "如 content 不是普通话，则给普通话译文；否则留空", "parentId": "被回复评论ID，可留空" },
    { "id": "r2", "authorName": "真实感 NPC 名", "content": "自然评论或回复", "contentTranslation": "如 content 不是中文，则给普通话译文；否则留空", "parentId": "已有评论ID或本次前面输出的id，可留空" }
  ]
}`,
    '要求：1. 输出 6-15 条；2. authorName 可以是当前执行角色，也可以是符合社交圈边界的真实感 NPC 名；3. 角色可以回复用户或其他人的评论，NPC 也可以发新评论、回复角色或互相回复；4. parentId 留空表示新评论，填写已有评论 ID 或本次前面输出的 id 表示回复；5. 不要代替用户发言，不要使用“NPC”“路人”“朋友A”这类占位名；6. 内容像真实社交软件评论区，短、自然、有上下文，不要解释设定；7. contentTranslation 规则：外语、粤语都要翻译成简体普通话；不要加“翻译：”前缀。'
  ].join('\n\n');

  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride);
  if (apiReply) {
    try {
      const parsed = JSON.parse(extractJsonContent(apiReply));
      const replies = normalizeVoomCommentReplies(parsed, fallbackAuthorName, input.post, blockedAuthorNames);
      if (replies.length) return replies;
    } catch {
      const content = apiReply.trim();
      if (content) {
        return [{
          authorName: fallbackAuthorName,
          content,
          parentId: targetComments[0]?.id
        }];
      }
    }
  }
  throw new Error('评论区回复模型没有返回内容。');
}

function formatMusicTrackPrompt(track: MusicTrack) {
  return [
    `歌名：${track.name}`,
    `歌手：${track.artists.join('、') || '未知歌手'}`,
    `专辑：${track.album || '未知专辑'}`,
    `音乐源：${track.source}`
  ].join('\n');
}

function musicCommentPromptAuthorName(comment: MusicComment, input: { user: UserProfile; characters: CharacterProfile[] }) {
  if (comment.authorType === 'user' || comment.authorId === input.user.id) return getUserAiName(input.user);
  const character = comment.authorId ? input.characters.find((entry) => entry.id === comment.authorId) : undefined;
  return character ? getCharacterAiName(character) : comment.authorName;
}

function formatMusicCommentPromptLine(comment: MusicComment, input: { user: UserProfile; characters: CharacterProfile[] }) {
  const replyText = comment.parentId ? ` 回复 ${comment.parentId}` : '';
  return `${comment.id}｜${musicCommentPromptAuthorName(comment, input)}${replyText}：${comment.content}`;
}

function musicCommentAvatarUrl(seed: string) {
  let hash = 0;
  Array.from(seed).forEach((character) => {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  });
  const account = 100000 + (hash % 899999999);
  return `https://q1.qlogo.cn/g?b=qq&nk=${account}&s=100`;
}

function normalizeMusicComments(value: unknown, input: { user: UserProfile; characters: CharacterProfile[]; existingComments: MusicComment[] }) {
  const source = Array.isArray((value as { comments?: unknown[] })?.comments)
    ? (value as { comments: unknown[] }).comments
    : Array.isArray(value)
      ? value
      : [];
  const characterById = new Map(input.characters.map((character) => [character.id, character]));
  const existingCommentIds = new Set(input.existingComments.map((comment) => comment.id));
  const generatedIdByDraftId = new Map<string, string>();
  const comments: MusicComment[] = [];
  const createdAt = Date.now();

  source.forEach((entry, index) => {
    if (comments.length >= 55 || !entry || typeof entry !== 'object') return;
    const record = entry as Record<string, unknown>;
    const content = String(record.content ?? record.text ?? record.comment ?? '').trim();
    if (!content) return;

    const draftId = String(record.id ?? record.draftId ?? '').trim();
    const id = createId('music_comment');
    if (draftId) generatedIdByDraftId.set(draftId, id);

    const authorId = String(record.authorId ?? record.characterId ?? '').trim();
    const character = authorId ? characterById.get(authorId) : undefined;
    const authorType = character ? 'character' : 'passerby';
    const fallbackName = character ? getCharacterAiName(character) : `听友${Math.floor(1000 + Math.random() * 9000)}`;
    const authorName = character ? fallbackName : String(record.authorName ?? record.name ?? fallbackName).trim() || fallbackName;
    const rawParentId = String(record.parentId ?? record.replyTo ?? '').trim();
    const parentId = existingCommentIds.has(rawParentId)
      ? rawParentId
      : generatedIdByDraftId.get(rawParentId) ?? '';
    const contentTranslation = normalizeTranslationText(record.contentTranslation ?? record.translation ?? record.translationZh ?? record.chineseTranslation);

    comments.push({
      id,
      authorName,
      authorId: character?.id,
      authorType,
      avatar: character?.avatar || musicCommentAvatarUrl(authorId || authorName || draftId || content),
      content,
      ...(contentTranslation ? { contentTranslation } : {}),
      ...(parentId && parentId !== id ? { parentId } : {}),
      createdAt: createdAt + index
    });
  });

  return comments;
}

export async function generateMusicCommentThread(input: {
  track: MusicTrack;
  user: UserProfile;
  characters: CharacterProfile[];
  existingComments?: MusicComment[];
  mode?: 'replace' | 'expand';
  settings?: AppSettings;
  modelOverride?: string;
}) {
  requireTextGenerationConfig(input.settings, input.modelOverride, '音乐评论区生成');
  const existingComments = input.existingComments ?? [];
  const boundCharacters = input.characters.filter((character) => character.boundUserId === input.user.id);
  const characterText = boundCharacters.length
    ? boundCharacters.map((character) => [
      `id: ${character.id}`,
      `角色姓名: ${getCharacterAiName(character)}`,
      `签名: ${character.signature || '无'}`,
      `设定: ${character.description || '无'}`
    ].join('；')).join('\n')
    : '当前账号暂未绑定角色。';
  const prompt = [
    '你要为 LINK 音乐页生成一个独立的歌曲评论区。它不是线上聊天、线下 RP 或 VOOM 会话，不要写入任何聊天事件。只输出 JSON，不要输出 JSON 以外的文字。',
    `当前用户姓名：${getUserAiName(input.user)}（不要代替该用户发评论）`,
    `歌曲信息：\n${formatMusicTrackPrompt(input.track)}`,
    `该用户账号绑定的角色：\n${characterText}`,
    existingComments.length ? `已有评论区：\n${existingComments.map((comment) => formatMusicCommentPromptLine(comment, input)).join('\n')}` : '已有评论区：暂无。',
    input.mode === 'expand' ? '任务：在已有评论区基础上追加 45-55 条新的评论和回复，延续上下文；一级评论和回复合计必须落在 45-55 条。' : '任务：生成一版新的完整评论区，可包含一级评论和互相回复；一级评论和回复合计必须落在 45-55 条。',
    '网易云评论区核心定位：不以专业乐评为主，而是依附歌曲情绪的全民情感树洞、微型文学社区和线上轻社交场。区别于 QQ 音乐、酷狗偏短句吐槽、B 站偏二次元玩梗，要形成“云村”独有的复合风格，兼具致郁、治愈、搞笑、科普、纪实多重面貌。',
    '八大主流内容类型必须自然混合，但根据歌曲气质分配比例，不要像清单作业。1. 伤痛微型故事：1-3 行短故事，有时间、人物、遗憾结局和强留白，题材可含失恋、异地无果、暗恋、亲人离别、学业失败、底层孤独、自我独白；文风克制文艺，少控诉，多隐喻，但不要复制疼痛文学模板。2. 治愈励志纪实：学生党考研/高考/考公打卡、拟录取报喜，打工人加班漂泊和自我和解，对抗低谷、原生家庭和自我疗愈；语言温暖平实，可出现“一切都会好”“再坚持一下”“接纳普通的自己”。3. 沙雕段子/反套路搞笑：用数理化历史语文等学科脑洞解构悲伤，用作业、加班、美食、赶海桶、电瓶等生活梗魔改歌词，或者在伤感楼下搞笑补刀，制造前一秒落泪后一秒笑出的反差。4. 民间科普和野生乐评：少量讲创作背景、歌手经历、MV、词曲幕后、外语/粤语/方言翻译、曲风乐器和地域文化，像热心听友补充，不要写成论文。5. 时代纪实和集体记忆：年份打卡、毕业、高考、疫情、春运、跨年、上岸、青春回忆，让一首歌像数字备忘录，可有 80/90/00 后跨年龄对话。6. 许愿祈福：上岸、平安、脱单、家人健康、暴富、还愿打卡，形成线上许愿圣地感。7. 角色扮演和虚拟树洞：二战考生、深夜治愈博主、失恋过来人等固定人设倾诉，匿名写不敢发朋友圈的心事，多个评论可互相呼应成故事楼。8. 饭圈/歌手圈层：温柔安利新作、舞台、演唱会、偶像暖心瞬间，也允许路人客观评价唱功和舞台，粉丝与路人温和共存。',
    '语言规则：短句、口语、留白、真实生活细节优先；可以致郁、治愈、搞笑、科普、纪实并存。避免堆砌华丽辞藻，避免全员深夜 emo，避免硬编惨案骗赞，避免“NPC/路人A/朋友A”式占位。要体现从早期“网抑云”到现在“网愈云”的演变：允许遗憾和孤独，但更多真实、成长、上岸、普通生活也值得期待。',
    '互动规则：顶层评论像热评主楼，回复里要有“抱抱”“我也是”“会好的”、还愿、打卡、搞笑补刀、理性纠正、方言/翻译补充、同款故事接龙。适当让一些 parentId 指向已有评论或本次前面评论，形成陌生人共情闭环和神回复楼，不要只有孤立一级评论。',
    `输出格式：
{
  "comments": [
    { "id": "c1", "authorId": "绑定角色id，可留空", "authorName": "发言者显示名", "content": "评论内容", "contentTranslation": "如需翻译则填写，否则留空", "parentId": "回复的已有评论ID或本次前面输出的id，可留空" }
  ]
}`,
    '要求：1. 输出 45-55 条，一级评论和回复评论合计计数；2. 至少包含 2 条该用户绑定角色的评论或回复，角色 authorId 必须来自绑定角色；3. 其余可以是有真实感的路人听友；4. 可以回复任意已有评论或本次前面评论；5. 不要使用“NPC”“路人A”“朋友A”这类占位名；6. 语气像网易云音乐评论区，短、自然、有情绪和梗，但不要刷屏；7. contentTranslation 规则：外语、粤语都要翻译成自然现代简体普通话，不要加“翻译：”前缀。'
  ].join('\n\n');

  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride);
  if (!apiReply) return [];
  try {
    return normalizeMusicComments(JSON.parse(extractJsonContent(apiReply)), { user: input.user, characters: boundCharacters, existingComments });
  } catch {
    return [];
  }
}

export function shouldAutoGenerateMoment(frequency: VoomFrequency) {
  return Math.random() < getVoomFrequencyChance(frequency);
}

function getNovelAiEndpointBase(settings: AppSettings) {
  const config = settings.imageNovelAi;
  const endpoint = config.endpointMode === 'official'
    ? novelAiOfficialApiUrl
    : config.endpointMode === 'custom'
      ? config.customProxyUrl
      : novelAiProxyApiUrl;
  return normalizeBaseUrl(endpoint);
}

function resolveNovelAiEndpointBase(settings: AppSettings) {
  const config = settings.imageNovelAi;
  const endpointBase = getNovelAiEndpointBase(settings);
  if (!endpointBase) {
    throw new Error(config.endpointMode === 'custom' ? '请先填写第三方 NovelAI 代理链接。' : '请先选择 NovelAI 的连接方式。');
  }
  if (!/^https?:\/\//i.test(endpointBase)) {
    throw new Error(config.endpointMode === 'custom' ? '第三方 NovelAI 代理链接需要以 http:// 或 https:// 开头。' : 'NovelAI 接口地址需要以 http:// 或 https:// 开头。');
  }
  return endpointBase;
}

function normalizeNovelAiModelPayload(payload: unknown): NovelAiModelOption[] {
  const maybeObject = payload as { models?: unknown; data?: unknown; results?: unknown } | null;
  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray(maybeObject?.models)
      ? maybeObject.models
      : Array.isArray(maybeObject?.data)
        ? maybeObject.data
        : Array.isArray(maybeObject?.results)
          ? maybeObject.results
          : [];

  const models = rawModels.flatMap((item) => {
    if (typeof item === 'string') return [{ id: item, label: item }];
    if (!item || typeof item !== 'object') return [];
    const model = item as { id?: unknown; name?: unknown; model?: unknown; label?: unknown; title?: unknown; nickname?: unknown };
    const id = String(model.id ?? model.model ?? model.name ?? '').trim();
    if (!id) return [];
    const label = String(model.label ?? model.title ?? model.nickname ?? model.name ?? id).trim();
    return [{ id, label: label || id }];
  });

  const byId = new Map(defaultNovelAiModels.map((model) => [model.id, model]));
  models.forEach((model) => byId.set(model.id, model));
  return [...byId.values()];
}

function normalizePollinationsModelPayload(payload: unknown): PollinationsModelOption[] {
  const maybeObject = payload as { models?: unknown; data?: unknown } | null;
  const rawModels = Array.isArray(payload)
    ? payload
    : Array.isArray(maybeObject?.models)
      ? maybeObject.models
      : Array.isArray(maybeObject?.data)
        ? maybeObject.data
        : [];

  const models = rawModels.flatMap((item) => {
    if (typeof item === 'string') return [{ id: item, label: item }];
    if (!item || typeof item !== 'object') return [];
    const model = item as { id?: unknown; name?: unknown; model?: unknown; label?: unknown; title?: unknown; category?: unknown; output_modalities?: unknown; outputModalities?: unknown };
    const outputModalities = Array.isArray(model.output_modalities)
      ? model.output_modalities
      : Array.isArray(model.outputModalities)
        ? model.outputModalities
        : [];
    if (String(model.category ?? '').trim() && String(model.category).trim() !== 'image') return [];
    if (outputModalities.length && !outputModalities.includes('image')) return [];
    const id = String(model.id ?? model.model ?? model.name ?? '').trim();
    if (!id) return [];
    const label = String(model.label ?? model.title ?? model.name ?? id).trim();
    return [{ id, label: label || id }];
  });

  const byId = new Map(defaultPollinationsModels.map((model) => [model.id, model]));
  models.forEach((model) => byId.set(model.id, model));
  return [...byId.values()];
}

export interface GroupDiscoveryCharacterContext {
  character: CharacterProfile;
  conversationSummary: string;
  memorySummary: string;
  recentConversation: string;
  localWorldBooks: WorldBookEntry[];
}

export interface GroupGeneratedMessage {
  authorMemberId: string;
  content: string;
  type: 'text' | 'voice' | 'image' | 'sticker';
  stickerId?: string;
  quoteMessageId?: string;
}

export interface GroupPrivateInitiation {
  characterId: string;
  reason: string;
}

export interface GroupChatReplyResult {
  messages: GroupGeneratedMessage[];
  privateInitiations: GroupPrivateInitiation[];
  membershipDecision: 'approve' | 'reject' | null;
}

function replaceGroupPromptTokens(value: string, characterName: string, userName: string) {
  let result = value;
  if (characterName) {
    result = result
      .replace(/\{\{\s*char\s*\}\}/gi, characterName)
      .replace(/<\s*char\s*>/gi, characterName);
  }
  if (userName) {
    result = result
      .replace(/\{\{\s*user\s*\}\}/gi, userName)
      .replace(/<\s*user\s*>/gi, userName);
  }
  return result;
}

function renderGroupWorldBooks(books: WorldBookEntry[], character: CharacterProfile, user: UserProfile, activationText: string) {
  const characterName = getCharacterAiName(character);
  const userName = getUserAiName(user);
  const normalizedActivationText = activationText.toLocaleLowerCase();
  return books
    .filter((book) => book.enabled)
    .flatMap((book) => book.entries
      .filter((entry) => {
        if (!entry.enabled || entry.probability <= 0) return false;
        if (entry.activation === 'constant' || entry.activation === 'priority') return true;
        const sourceText = entry.caseSensitive ? activationText : normalizedActivationText;
        const normalizeKey = (key: string) => entry.caseSensitive ? key : key.toLocaleLowerCase();
        const primaryMatched = entry.keys.some((key) => key.trim() && sourceText.includes(normalizeKey(key)));
        if (!primaryMatched) return false;
        return !entry.secondaryKeys.length || entry.secondaryKeys.some((key) => key.trim() && sourceText.includes(normalizeKey(key)));
      })
      .sort((first, second) => {
        if (first.activation === 'priority' && second.activation !== 'priority') return -1;
        if (first.activation !== 'priority' && second.activation === 'priority') return 1;
        return first.order - second.order;
      })
      .map((entry) => [
        `【${replaceGroupPromptTokens(book.title || '未命名世界书', characterName, userName)} / ${replaceGroupPromptTokens(entry.title || '未命名条目', characterName, userName)}】`,
        replaceGroupPromptTokens(entry.content, characterName, userName)
      ].join('\n')))
    .join('\n\n');
}

function normalizeGeneratedGroupMembers(value: unknown, selectedCharacters: CharacterProfile[], createdAt: number): GroupMember[] {
  if (!Array.isArray(value)) return [];
  const selectedById = new Map(selectedCharacters.map((character) => [character.id, character]));
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const identityId = String(record.identityId ?? record.characterId ?? '').trim();
    const selectedCharacter = selectedById.get(identityId);
    const identityType = selectedCharacter ? 'character' : 'npc';
    const trueName = selectedCharacter
      ? getCharacterAiName(selectedCharacter)
      : String(record.trueName ?? record.name ?? '').trim();
    if (!trueName) return [];
    return [{
      id: String(record.id ?? '').trim() || `member_${identityId || index}_${createdAt}`,
      identityType,
      identityId: selectedCharacter?.id,
      trueName,
      nickname: String(record.nickname ?? '').trim() || trueName,
      avatar: selectedCharacter?.avatar,
      description: selectedCharacter?.description || String(record.description ?? '').trim(),
      role: record.role === 'owner' || record.role === 'admin' ? record.role : 'member',
      joinedAt: createdAt
    } satisfies GroupMember];
  });
}

export async function discoverGeneratedGroups(input: {
  user: UserProfile;
  characters: GroupDiscoveryCharacterContext[];
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<GroupDiscoveryCandidate[]> {
  requireTextGenerationConfig(input.settings, input.modelOverride, '查找群聊');
  const selectedCharacters = input.characters.map((entry) => entry.character);
  const canonicalUserName = getUserAiName(input.user);
  const characterContext = input.characters.map((entry) => {
    const characterName = getCharacterAiName(entry.character);
    const replaceTokens = (value: string) => replaceGroupPromptTokens(value, characterName, canonicalUserName);
    const lore = entry.localWorldBooks.flatMap((book) => book.entries.filter((item) => item.enabled).map((item) => `${replaceTokens(book.title)}/${replaceTokens(item.title)}: ${replaceTokens(item.content)}`)).join('\n');
    return [
      `角色ID：${entry.character.id}`,
      `角色姓名：${characterName}`,
      `角色当前网名：${replaceTokens(entry.character.nickname)}`,
      `角色设定：${replaceTokens(entry.character.description)}`,
      `当前用户设定：${replaceTokens(input.user.description) || '暂无'}`,
      `会话总结：${replaceTokens(entry.conversationSummary) || '暂无'}`,
      `记忆手册：${replaceTokens(entry.memorySummary) || '暂无'}`,
      `近期线上/线下共同楼层：${replaceTokens(entry.recentConversation) || '暂无'}`,
      `角色局部世界书：${lore || '暂无'}`
    ].join('\n');
  }).join('\n\n---\n\n');
  const prompt = `你是社交软件 LINK 的群聊搜索模拟器。用户点击“查找目前已有群聊”，请根据用户选择的已有角色及其连续生活经历，生成 3-6 个仿佛本来就存在、用户有合理渠道发现并可申请加入的群聊。

身份映射：已有角色成员必须使用下方角色 ID，NPC 不得伪造已有角色 ID，并应保持稳定姓名。

角色上下文：
${characterContext}

生成要求：
1. 每个群必须至少包含一位所选已有角色，也可包含 2-8 位合理 NPC；不同群的主题、规模和关系来源要明显不同。
2. 群主可以是已有角色或 NPC。成员发言符合各自设定，最近消息 6-12 条，像真实群聊，不要人人轮流发言。
3. discoveryReason 说明用户为何能搜索到该群，不能声称用户已经加入。
4. existing character 成员写 identityId=角色ID、trueName=角色真名、identityType=character；NPC 不写 identityId，identityType=npc。
5. 只输出 JSON，不要 Markdown：{"groups":[{"name":"","description":"","announcement":"","ownerMemberId":"成员临时id","discoveryReason":"","members":[{"id":"m1","identityType":"character|npc","identityId":"","trueName":"","nickname":"","description":"","role":"owner|admin|member"}],"recentMessages":[{"authorMemberId":"m1","content":"","createdAtOffsetMinutes":-20}]}]}`;
  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride);
  const parsed = JSON.parse(extractJsonContent(apiReply)) as Record<string, unknown>;
  const rawGroups = Array.isArray(parsed.groups) ? parsed.groups : [];
  const createdAt = Date.now();
  return rawGroups.slice(0, 6).flatMap((entry, groupIndex) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const members = normalizeGeneratedGroupMembers(record.members, selectedCharacters, createdAt);
    if (!members.some((member) => member.identityType === 'character')) return [];
    const rawMessages = Array.isArray(record.recentMessages) ? record.recentMessages : [];
    const memberIds = new Set(members.map((member) => member.id));
    const recentMessages = rawMessages.slice(0, 12).flatMap((message) => {
      if (!message || typeof message !== 'object') return [];
      const messageRecord = message as Record<string, unknown>;
      const authorMemberId = String(messageRecord.authorMemberId ?? '').trim();
      const content = String(messageRecord.content ?? '').trim();
      if (!memberIds.has(authorMemberId) || !content) return [];
      return [{ authorMemberId, content, createdAtOffsetMinutes: Number(messageRecord.createdAtOffsetMinutes) || 0 }];
    });
    const owner = members.find((member) => member.id === String(record.ownerMemberId ?? '').trim()) ?? members.find((member) => member.role === 'owner') ?? members[0];
    if (!owner) return [];
    members.forEach((member) => { member.role = member.id === owner.id ? 'owner' : member.role === 'owner' ? 'member' : member.role; });
    return [{
      id: `group_candidate_${createdAt}_${groupIndex}`,
      name: String(record.name ?? '').trim() || `群聊 ${groupIndex + 1}`,
      description: String(record.description ?? '').trim(),
      announcement: String(record.announcement ?? '').trim(),
      ownerMemberId: owner.id,
      members,
      recentMessages,
      discoveryReason: String(record.discoveryReason ?? '').trim()
    } satisfies GroupDiscoveryCandidate];
  });
}

export async function generateGroupChatReply(input: {
  user: UserProfile;
  groupName: string;
  announcement: string;
  members: GroupMember[];
  history: string;
  messages: ChatMessage[];
  stickerVisionEnabled: boolean;
  memorySummary: string;
  characterContexts: GroupDiscoveryCharacterContext[];
  worldBooks: WorldBookEntry[];
  availableStickers?: Array<{ id: string; description: string }>;
  proactive?: boolean;
  instruction?: string;
  membershipStatus?: 'active' | 'left' | 'pending';
  mode?: 'online' | 'offline';
  settings?: AppSettings;
  modelOverride?: string;
}): Promise<GroupChatReplyResult> {
  requireTextGenerationConfig(input.settings, input.modelOverride, '群聊回复');
  const canonicalUserName = getUserAiName(input.user);
  const mode = input.mode ?? 'online';
  const currentCharacterById = new Map(input.characterContexts.map((entry) => [entry.character.id, entry.character]));
  const memberTable = input.members.map((member) => {
    const currentCharacter = member.identityType === 'character' && member.identityId ? currentCharacterById.get(member.identityId) : undefined;
    const currentDescription = member.identityType === 'user'
      ? '见各角色专属上下文中的当前用户设定'
      : replaceGroupPromptTokens(currentCharacter?.description || member.description || '', currentCharacter ? getCharacterAiName(currentCharacter) : member.trueName, canonicalUserName);
    return `${member.id} | ${member.identityType} | 真名:${member.trueName} | 当前群昵称:${member.nickname} | 身份:${member.role} | 设定:${currentDescription || '无'}`;
  }).join('\n');
  const globalWorldBooks = input.worldBooks.filter((book) => book.scope === (mode === 'online' ? 'global-online' : 'global-offline'));
  const groupActivationText = [input.history, input.memorySummary, input.instruction].filter(Boolean).join('\n');
  const characterContext = input.characterContexts.map((entry) => {
    const character = entry.character;
    const characterName = getCharacterAiName(character);
    const replaceTokens = (value: string) => replaceGroupPromptTokens(value, characterName, canonicalUserName);
    const worldBookContext = renderGroupWorldBooks(
      [...globalWorldBooks, ...entry.localWorldBooks],
      character,
      input.user,
      [groupActivationText, entry.conversationSummary, entry.memorySummary, entry.recentConversation].filter(Boolean).join('\n')
    );
    return [
      `【${characterName}（${character.id}）的专属扮演上下文】`,
      `角色设定：${replaceTokens(character.description) || '暂无'}`,
      `角色 LINK 资料：网名「${replaceTokens(character.nickname) || characterName}」；签名「${replaceTokens(character.signature) || '暂无'}」`,
      `当前用户设定：${replaceTokens(input.user.description) || '暂无'}`,
      `当前用户 LINK 资料：网名「${replaceTokens(input.user.nickname) || canonicalUserName}」；签名「${replaceTokens(input.user.signature) || '暂无'}」`,
      `与${canonicalUserName}的一对一会话总结：${replaceTokens(entry.conversationSummary) || '暂无'}`,
      `与${canonicalUserName}的一对一记忆手册：${replaceTokens(entry.memorySummary) || '暂无'}`,
      `与${canonicalUserName}的近期一对一线上/线下对话：\n${replaceTokens(entry.recentConversation) || '暂无'}`,
      `该角色可用世界书：\n${worldBookContext || '无启用或命中的条目'}`,
      `知识边界：这一段只允许用于扮演${characterName}。其他群成员不能因为模型看到了这段内容就知道其中的私聊、记忆或局部世界书；除非相关事实已经在群聊中公开或被当事人转述。`
    ].join('\n');
  }).join('\n\n---\n\n');
  const stickerList = (input.availableStickers ?? []).slice(0, 80).map((sticker) => `${sticker.id}: ${sticker.description}`).join('\n');
  const prompt = `你是 LINK 群聊的消息导演，同时严格扮演群内角色和 NPC。当前模式是${mode === 'offline' ? '群聊线下 RP：所有群成员处于同一现实场景，以章节正文推进共同剧情' : '线上群聊：以真实社交软件消息推进对话'}。根据用户刚发出的内容与完整上下文，决定自然会回应或行动的成员并生成本轮内容。

群名：${input.groupName}
群公告：${input.announcement || '无'}
当前用户真名：${canonicalUserName}
当前用户群成员状态：${input.membershipStatus || 'active'}
成员表：
${memberTable}

已有角色的当前设定、私聊/线下连续记忆与世界书（严格按角色隔离知识）：
${characterContext || '暂无'}

当前群聊记忆：
${replaceGroupPromptTokens(input.memorySummary, '', canonicalUserName) || '暂无'}

最近群聊（每行均使用真实名）：
${input.history || '暂无'}

本轮任务：${input.instruction || (input.proactive ? '没有用户刚发来的新消息。请根据时间流逝和群内生活节奏，生成一轮自然的主动群消息。' : '回应最近发生的群聊。')}

可用 Sticker（只能使用列表中的 id）：
${stickerList || '无'}

规则：
1. 只允许成员表里的角色发言，绝不代替用户发言；authorMemberId 必须来自成员表。
2. ${mode === 'offline' ? '这是群聊线下 RP。每条 content 都是该成员视角下可直接展示的沉浸式章节正文，包含必要的场景、动作、神情、对白与多人互动；不得写成聊天气泡口吻，不得替用户决定、行动或发言。输出 1-4 个自然章节，不要机械轮流。' : '像真实群聊：允许无人回复、单人回复、多人插话、连续多条、引用、@、跑题与沉默；本轮输出 0-8 条，不要机械轮流。需要引用最近群聊中的历史消息时，在该条消息填写 quoteMessageId；可以引用用户、其他成员，也可以自然引用该发言成员自己此前发过的消息。只能填写最近群聊里方括号标出的真实消息 ID，不要在 content 中复述被引用内容。'}
3. 已有角色必须同时结合自己的角色设定、与用户的一对一会话总结、记忆手册、近期私聊/线下对话和世界书，不得把群聊当作孤立世界；每个角色只能使用自己专属上下文里的私密知识，不能读取、暗示或利用其他角色的专属上下文，也不能知道自己未参与且未被转述的秘密。
4. ${mode === 'offline' ? '线下模式的 type 必须为 text。' : 'type 可为 text、voice、image、sticker。voice 的 content 是语音转写；image 的 content 是图片画面描述；sticker 必须填写 stickerId，content 可填贴纸含义。'}
5. 如果群内情境让某个已有角色很自然地想单独联系用户，可在 privateInitiations 放入该角色ID和原因；最多 1 个，不能使用 NPC，不能每轮都触发。
6. 如果当前用户状态为 pending，群主或管理员可根据群设定和上下文决定是否通过申请，在 membershipDecision 输出 approve、reject 或 null；其他状态必须输出 null。
7. 群内出现匿名小号消息时，不得推断、暗示或泄露它与当前用户的真实身份关系。
8. 图片与语音是群内所有当前成员共同可见的真实消息：真实图片已随请求附带时可直接识图；文字描述卡片要理解为用户发送了描述所表达的图片；语音条要理解为发送者用语音说出了转写内容。引用消息必须结合被引用内容理解，不能当成孤立文本。
9. 只输出 JSON：{"messages":[{"authorMemberId":"成员id","type":"text|voice|image|sticker","content":"正文或描述","stickerId":"可选","quoteMessageId":"可选，仅线上引用的历史消息id"}],"privateInitiations":[{"characterId":"已有角色ID","reason":"为什么此刻要私聊用户"}],"membershipDecision":"approve|reject|null"}`;
  const apiReply = await callTextApi(input.settings, prompt, input.modelOverride, await getPreparedVisualImageParts(input));
  const parsed = JSON.parse(extractJsonContent(apiReply)) as Record<string, unknown>;
  const rawMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
  const allowedMembers = new Map(input.members.filter((member) => member.identityType !== 'user' && (member.membershipStatus ?? 'active') === 'active').map((member) => [member.id, member]));
  const availableStickerIds = new Set((input.availableStickers ?? []).map((sticker) => sticker.id));
  const messages = rawMessages.slice(0, 8).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const authorMemberId = String(record.authorMemberId ?? '').trim();
    const content = String(record.content ?? '').trim();
    const requestedType = String(record.type ?? 'text').trim();
    const stickerId = String(record.stickerId ?? '').trim();
    const quoteMessageId = mode === 'online' ? String(record.quoteMessageId ?? '').trim() : '';
    const type = mode === 'offline' ? 'text' : requestedType === 'voice' || requestedType === 'image' || requestedType === 'sticker' ? requestedType : 'text';
    if (!allowedMembers.has(authorMemberId) || (!content && type !== 'sticker')) return [];
    if (type === 'sticker' && !availableStickerIds.has(stickerId)) return [];
    return [{ authorMemberId, content, type, stickerId: type === 'sticker' ? stickerId : undefined, quoteMessageId: quoteMessageId || undefined } satisfies GroupGeneratedMessage];
  });
  const characterIds = new Set(input.characterContexts.map((entry) => entry.character.id));
  const rawPrivateInitiations = Array.isArray(parsed.privateInitiations) ? parsed.privateInitiations : [];
  const privateInitiations = rawPrivateInitiations.slice(0, 1).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const record = entry as Record<string, unknown>;
    const characterId = String(record.characterId ?? '').trim();
    const reason = String(record.reason ?? '').trim();
    return characterIds.has(characterId) && reason ? [{ characterId, reason }] : [];
  });
  const requestedDecision = String(parsed.membershipDecision ?? '').trim();
  const membershipDecision = input.membershipStatus === 'pending' && (requestedDecision === 'approve' || requestedDecision === 'reject') ? requestedDecision : null;
  return { messages, privateInitiations, membershipDecision };
}