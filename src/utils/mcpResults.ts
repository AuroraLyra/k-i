import type { ChatMcpResultAttachment, ChatMcpResultItem, ChatMcpResultItemKind } from '@/types/domain';

type UnknownRecord = Record<string, unknown>;

interface McpStructuredResultSource {
  content?: unknown[];
  structuredContent?: unknown;
}

interface McpResultMeta {
  serverId: string;
  serverName: string;
  toolName: string;
}

const maxResultItems = 8;
const maxTraversalDepth = 6;
const maxJsonTextLength = 250_000;
const sensitiveKeyPattern = /(?:authorization|cookie|password|passwd|secret|token|api.?key|credential)/i;

const collectionKeys = [
  'results', 'result', 'items', 'item', 'list', 'records', 'data', 'products', 'product',
  'feeds', 'feed', 'pois', 'poi', 'places', 'shops', 'posts', 'notes', 'videos', 'documents', 'matches',
  'suggestions', 'routes'
];
const titleKeys = ['title', 'name', 'displayName', 'displayTitle', 'productName', 'itemName', 'poiName', 'videoTitle', 'noteTitle', 'dtitle', 'shortTitle', 'materialName', '名称', '标题'];
const descriptionKeys = ['description', 'summary', 'subtitle', 'desc', 'content', 'text', 'snippet', '介绍', '摘要', '描述', '正文'];
const urlKeys = ['url', 'link', 'href', 'detailUrl', 'shareUrl', 'webUrl', 'jumpUrl', 'productUrl', 'itemUrl', 'videoUrl', 'noteUrl', 'clickUrl', 'couponShareUrl', 'couponClickUrl', '详情链接', '链接'];
const imageKeys = ['imageUrl', 'image', 'coverUrl', 'cover', 'thumbnailUrl', 'thumbnail', 'picUrl', 'pictUrl', 'pictureUrl', 'picture', 'pic', 'logoUrl', 'logo', '图片', '封面'];
const priceKeys = ['price', 'currentPrice', 'salePrice', 'finalPrice', 'amount', 'priceText', 'viewPrice', 'zkFinalPrice', 'reservePrice', 'quanhouPrice', '价格', '售价'];
const sourceKeys = ['source', 'platform', 'site', 'provider', 'author', 'user', 'shopName', 'storeName', 'sellerName', 'nick', '来源', '平台', '作者', '店铺'];
const addressKeys = ['address', 'formattedAddress', 'locationName', 'formatted_address', '地址', '详细地址'];
const latitudeKeys = ['latitude', 'lat', '纬度'];
const longitudeKeys = ['longitude', 'lng', 'lon', '经度'];
const locationKeys = ['location', 'coordinate', 'coordinates', '经纬度', '坐标'];
const distanceKeys = ['distance', 'distanceText', '距离'];
const etaKeys = ['eta', 'duration', 'durationText', 'travelTime', 'arrivalTime', '耗时', '预计时间'];

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : null;
}

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

function getField(record: UnknownRecord, keys: string[]) {
  const wanted = new Set(keys.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizedKey(key))) return value;
  }
  return undefined;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).slice(0, maxLength);
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function readDisplayText(value: unknown, maxLength: number): string {
  const direct = cleanText(value, maxLength);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = readDisplayText(item, maxLength);
      if (text) return text;
    }
    return '';
  }
  const record = asRecord(value);
  if (!record) return '';
  for (const key of ['text', 'value', 'label', 'name', 'title', 'formatted', 'displayName', 'displayTitle', 'nickname', 'userName', 'amount']) {
    const text = readDisplayText(getField(record, [key]), maxLength);
    if (text) return text;
  }
  return '';
}

function readRemoteUrl(value: unknown): string {
  const candidates: unknown[] = [value];
  const record = asRecord(value);
  if (record) candidates.push(getField(record, ['url', 'src', 'href', 'original', 'large', 'default', 'urlDefault', 'urlPre', 'urlList', 'url_list']));
  if (Array.isArray(value)) candidates.push(...value.slice(0, 4));
  for (const candidate of candidates) {
    const rawCandidate = readDisplayText(candidate, 2_048);
    const rawUrl = rawCandidate.startsWith('//') ? `https:${rawCandidate}` : rawCandidate;
    if (!rawUrl) continue;
    try {
      const url = new URL(rawUrl);
      if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) continue;
      return url.href.slice(0, 2_048);
    } catch {
      continue;
    }
  }
  return '';
}

function readCoordinate(value: unknown, minimum: number, maximum: number) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(cleanText(value, 64));
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : undefined;
}

function readCoordinates(record: UnknownRecord) {
  let latitude = readCoordinate(getField(record, latitudeKeys), -90, 90);
  let longitude = readCoordinate(getField(record, longitudeKeys), -180, 180);
  const location = getField(record, locationKeys);
  const locationRecord = asRecord(location);
  if (locationRecord) {
    latitude ??= readCoordinate(getField(locationRecord, latitudeKeys), -90, 90);
    longitude ??= readCoordinate(getField(locationRecord, longitudeKeys), -180, 180);
  } else if (typeof location === 'string') {
    const match = location.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[,，]\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
      longitude ??= readCoordinate(match[1], -180, 180);
      latitude ??= readCoordinate(match[2], -90, 90);
    }
  } else if (Array.isArray(location) && location.length >= 2) {
    longitude ??= readCoordinate(location[0], -180, 180);
    latitude ??= readCoordinate(location[1], -90, 90);
  }
  return { latitude, longitude };
}

function formatPrice(record: UnknownRecord) {
  const rawPrice = getField(record, priceKeys);
  const priceRecord = asRecord(rawPrice);
  const value = readDisplayText(priceRecord ? getField(priceRecord, ['value', 'amount', 'price', 'text']) : rawPrice, 80);
  if (!value) return '';
  const currency = readDisplayText(priceRecord ? getField(priceRecord, ['currency', 'currencyCode', 'unit']) : getField(record, ['currency', 'currencyCode', 'priceUnit']), 16).toUpperCase();
  if (/^[¥￥$€£]/.test(value)) return value;
  if (currency === 'CNY' || currency === 'RMB') return `¥${value}`;
  if (currency === 'USD') return `$${value}`;
  if (currency === 'EUR') return `€${value}`;
  if (currency === 'GBP') return `£${value}`;
  return currency ? `${value} ${currency}` : value;
}

function resultKind(item: Omit<ChatMcpResultItem, 'kind' | 'title'>): ChatMcpResultItemKind {
  if (item.address || item.latitude !== undefined || item.longitude !== undefined) return 'place';
  if (item.price) return 'product';
  if (item.imageUrl) return 'media';
  if (item.url) return 'link';
  return 'generic';
}

function looksLikeResultRecord(record: UnknownRecord) {
  const keys = [...titleKeys, ...descriptionKeys, ...urlKeys, ...imageKeys, ...priceKeys, ...addressKeys, ...latitudeKeys, ...longitudeKeys, ...locationKeys, 'awemeInfo', 'awemeId', 'noteCard', 'xsecToken', 'itemId', 'numIid'];
  return getField(record, keys) !== undefined;
}

function collectResultRecords(value: unknown, depth = 0, seen = new Set<object>()): UnknownRecord[] {
  if (depth > maxTraversalDepth) return [];
  if (typeof value === 'string') return readRemoteUrl(value) ? [{ url: value }] : [];
  if (Array.isArray(value)) return value.slice(0, 50).flatMap((item) => collectResultRecords(item, depth + 1, seen)).slice(0, maxResultItems * 3);
  const record = asRecord(value);
  if (!record || seen.has(record)) return [];
  seen.add(record);
  for (const key of collectionKeys) {
    const nested = getField(record, [key]);
    if (nested === undefined || nested === value) continue;
    const collected = collectResultRecords(nested, depth + 1, seen);
    if (collected.length) return collected;
  }
  if (looksLikeResultRecord(record)) return [record];
  const collected: UnknownRecord[] = [];
  for (const [key, nested] of Object.entries(record)) {
    if (sensitiveKeyPattern.test(key)) continue;
    collected.push(...collectResultRecords(nested, depth + 1, seen));
    if (collected.length >= maxResultItems * 3) break;
  }
  return collected;
}

function flattenPlatformRecord(record: UnknownRecord) {
  let flattened = { ...record };
  for (const key of ['awemeInfo', 'aweme_info', 'noteCard', 'note_card', 'itemBasicInfo', 'item_basic_info', 'material']) {
    const nested = asRecord(getField(record, [key]));
    if (nested) flattened = { ...nested, ...flattened };
  }
  return flattened;
}

function nestedImageUrl(record: UnknownRecord) {
  const direct = readRemoteUrl(getField(record, imageKeys));
  if (direct) return direct;
  for (const containerKey of ['video', 'images', 'imageList', 'image_list', 'smallImages', 'small_images']) {
    const container = getField(record, [containerKey]);
    const containerRecord = asRecord(container);
    const candidate = containerRecord
      ? getField(containerRecord, ['cover', 'dynamicCover', 'dynamic_cover', 'originCover', 'origin_cover', 'urlList', 'url_list', 'string']) ?? container
      : container;
    const url = readRemoteUrl(candidate);
    if (url) return url;
  }
  return '';
}

function validPlatformId(value: unknown) {
  const id = readDisplayText(value, 160);
  return /^[A-Za-z0-9_-]{5,160}$/.test(id) ? id : '';
}

function platformResultUrl(record: UnknownRecord, platformHint: string) {
  const direct = readRemoteUrl(getField(record, urlKeys));
  if (direct) return direct;
  const hint = platformHint.toLowerCase();
  const douyinId = validPlatformId(getField(record, ['awemeId', 'aweme_id']));
  if (douyinId || /douyin|抖音|search_videos/.test(hint)) {
    const resolvedId = douyinId || validPlatformId(getField(record, ['id', 'itemId', 'item_id']));
    if (resolvedId) return `https://www.douyin.com/video/${encodeURIComponent(resolvedId)}`;
  }
  const xhsToken = readDisplayText(getField(record, ['xsecToken', 'xsec_token']), 1_024);
  if (xhsToken || /xiaohongshu|rednote|小红书|search_feeds/.test(hint)) {
    const noteId = validPlatformId(getField(record, ['noteId', 'note_id', 'feedId', 'feed_id', 'id']));
    if (noteId) {
      const query = new URLSearchParams({ xsec_source: 'pc_search' });
      if (xhsToken) query.set('xsec_token', xhsToken);
      return `https://www.xiaohongshu.com/explore/${encodeURIComponent(noteId)}?${query.toString()}`;
    }
  }
  if (/taobao|tmall|淘宝|天猫|taoke/.test(hint)) {
    const itemId = validPlatformId(getField(record, ['itemId', 'item_id', 'numIid', 'num_iid', 'productId', 'product_id', 'id']));
    if (itemId) return `https://item.taobao.com/item.htm?id=${encodeURIComponent(itemId)}`;
  }
  return '';
}

function nestedSource(record: UnknownRecord) {
  const direct = readDisplayText(getField(record, sourceKeys), 120);
  if (direct) return direct;
  for (const key of ['author', 'user', 'seller', 'shop']) {
    const source = readDisplayText(getField(record, [key]), 120);
    if (source) return source;
  }
  return '';
}

function normalizeResultItem(rawRecord: UnknownRecord, platformHint = ''): ChatMcpResultItem | null {
  const record = flattenPlatformRecord(rawRecord);
  const url = platformResultUrl(record, platformHint);
  const imageUrl = nestedImageUrl(record);
  const description = readDisplayText(getField(record, descriptionKeys), 500);
  const source = nestedSource(record);
  const address = readDisplayText(getField(record, addressKeys), 240);
  const price = formatPrice(record);
  const distance = readDisplayText(getField(record, distanceKeys), 80);
  const eta = readDisplayText(getField(record, etaKeys), 80);
  const { latitude, longitude } = readCoordinates(record);
  let title = readDisplayText(getField(record, titleKeys), 180);
  if (!title && description) title = description.slice(0, 180);
  if (!title && address) title = address;
  if (!title && url) {
    try {
      title = new URL(url).hostname;
    } catch {
      title = '外部结果';
    }
  }
  if (!title && (imageUrl || latitude !== undefined || longitude !== undefined)) title = source || '外部结果';
  if (!title) return null;
  const details = {
    ...(description && description !== title ? { description } : {}),
    ...(url ? { url } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(price ? { price } : {}),
    ...(source ? { source } : {}),
    ...(address && address !== title ? { address } : {}),
    ...(latitude !== undefined ? { latitude } : {}),
    ...(longitude !== undefined ? { longitude } : {}),
    ...(distance ? { distance } : {}),
    ...(eta ? { eta } : {})
  };
  return { kind: resultKind(details), title, ...details };
}

function parseStructuredText(value: unknown) {
  if (typeof value !== 'string' || value.length > maxJsonTextLength) return undefined;
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function structuredSources(result: McpStructuredResultSource) {
  const sources: unknown[] = [];
  if (result.structuredContent !== undefined) sources.push(result.structuredContent);
  for (const rawContent of result.content ?? []) {
    const content = asRecord(rawContent);
    if (!content) continue;
    if (content.type === 'resource_link') {
      sources.push({ title: content.name, description: content.description, url: content.uri });
      continue;
    }
    if (content.type === 'resource') {
      sources.push(content.resource);
      continue;
    }
    if (content.type === 'text') {
      const parsed = parseStructuredText(content.text);
      if (parsed !== undefined) sources.push(parsed);
    }
  }
  return sources;
}

function resultItemKey(item: ChatMcpResultItem) {
  return item.url || `${item.title}\n${item.source ?? ''}\n${item.price ?? ''}\n${item.longitude ?? ''},${item.latitude ?? ''}`;
}

export function createMcpResultAttachment(meta: McpResultMeta, result: McpStructuredResultSource): ChatMcpResultAttachment | null {
  const items: ChatMcpResultItem[] = [];
  const seen = new Set<string>();
  for (const source of structuredSources(result)) {
    for (const record of collectResultRecords(source)) {
      const item = normalizeResultItem(record, `${meta.serverName} ${meta.toolName}`);
      if (!item) continue;
      const key = resultItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
      if (items.length >= maxResultItems) break;
    }
    if (items.length >= maxResultItems) break;
  }
  if (!items.length) return null;
  return {
    serverId: cleanText(meta.serverId, 160),
    serverName: cleanText(meta.serverName, 160) || 'MCP',
    toolName: cleanText(meta.toolName, 180) || 'tool',
    items
  };
}

export function normalizeMcpResultAttachments(value: unknown): ChatMcpResultAttachment[] {
  if (!Array.isArray(value)) return [];
  const attachments: ChatMcpResultAttachment[] = [];
  for (const rawAttachment of value.slice(0, 6)) {
    const attachment = asRecord(rawAttachment);
    if (!attachment) continue;
    const rawItems = Array.isArray(attachment.items) ? attachment.items : [];
    const platformHint = `${cleanText(attachment.serverName, 160)} ${cleanText(attachment.toolName, 180)}`;
    const items: ChatMcpResultItem[] = [];
    const seen = new Set<string>();
    for (const rawItem of rawItems.slice(0, maxResultItems)) {
      const itemRecord = asRecord(rawItem);
      if (!itemRecord) continue;
      const item = normalizeResultItem(itemRecord, platformHint);
      if (!item) continue;
      const key = resultItemKey(item);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    if (!items.length) continue;
    attachments.push({
      serverId: cleanText(attachment.serverId, 160),
      serverName: cleanText(attachment.serverName, 160) || 'MCP',
      toolName: cleanText(attachment.toolName, 180) || 'tool',
      items
    });
  }
  return attachments;
}