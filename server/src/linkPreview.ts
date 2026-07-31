import type { FastifyInstance } from 'fastify';
import { createTimeoutSignal, validatePublicUrl } from './security.js';

type PreviewPayload = {
  platform: 'website' | 'xiaohongshu' | 'douyin' | 'taobao' | 'pinduoduo' | 'jd' | 'xianyu' | 'bilibili' | 'weibo' | 'zhihu' | 'kuaishou' | 'wechat' | 'meituan' | 'dianping' | 'ctrip' | 'eleme' | 'dewu';
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  content?: string;
  comments?: Array<{ author?: string; message: string; createdAt?: string; rating?: number }>;
  readStatus?: 'complete' | 'platform-limited' | 'metadata-only';
  httpStatus?: number;
  siteName: string;
  fetchedAt: number;
};

const maxPreviewHtmlBytes = 1024 * 1024;
const previewCacheTtlMs = 60 * 60 * 1000;
const previewCache = new Map<string, PreviewPayload>();

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Math.min(0x10ffff, Number(code))))
    .replace(/&#x([\da-f]+);/gi, (_match, code) => String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(code, 16))))
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&nbsp;/gi, ' ');
}

function cleanMetadataText(value: string, maxLength: number) {
  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function tagAttributes(tag: string) {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    const name = String(match[1] ?? '').toLowerCase();
    const value = String(match[2] ?? match[3] ?? match[4] ?? '');
    if (name) attributes.set(name, decodeHtmlEntities(value));
  }
  return attributes;
}

function metadataValue(html: string, keys: string[]) {
  return metadataValues(html, keys)[0] ?? '';
}

function metadataValues(html: string, keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const values: string[] = [];
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = tagAttributes(tag);
    const key = (attributes.get('property') || attributes.get('name') || '').toLowerCase();
    if (!wanted.has(key)) continue;
    const content = attributes.get('content') ?? '';
    if (content.trim()) values.push(content.trim());
  }
  return values;
}

function canonicalValue(html: string) {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const attributes = tagAttributes(tag);
    const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
    if (rel.includes('canonical')) return attributes.get('href') ?? '';
  }
  return '';
}

function absoluteWebUrl(rawUrl: string, baseUrl: URL) {
  if (!rawUrl.trim()) return '';
  try {
    const url = new URL(rawUrl.trim(), baseUrl);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return '';
    return url.href.slice(0, 2_048);
  } catch {
    return '';
  }
}

function platformForUrl(url: URL): PreviewPayload['platform'] {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'xhslink.com' || hostname.endsWith('.xhslink.com') || hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com')) return 'xiaohongshu';
  if (hostname === 'douyin.com' || hostname.endsWith('.douyin.com') || hostname.endsWith('.iesdouyin.com')) return 'douyin';
  if (hostname === 'tb.cn' || hostname.endsWith('.tb.cn') || hostname === 'taobao.com' || hostname.endsWith('.taobao.com') || hostname === 'tmall.com' || hostname.endsWith('.tmall.com')) return 'taobao';
  if (hostname === 'pinduoduo.com' || hostname.endsWith('.pinduoduo.com') || hostname === 'yangkeduo.com' || hostname.endsWith('.yangkeduo.com')) return 'pinduoduo';
  if (hostname === 'jd.com' || hostname.endsWith('.jd.com') || hostname === '3.cn' || hostname.endsWith('.3.cn') || hostname === 'jd.hk' || hostname.endsWith('.jd.hk')) return 'jd';
  if (hostname === 'goofish.com' || hostname.endsWith('.goofish.com') || hostname === '2.taobao.com') return 'xianyu';
  if (hostname === 'b23.tv' || hostname.endsWith('.b23.tv') || hostname === 'bilibili.com' || hostname.endsWith('.bilibili.com')) return 'bilibili';
  if (hostname === 'weibo.com' || hostname.endsWith('.weibo.com') || hostname === 'weibo.cn' || hostname.endsWith('.weibo.cn') || hostname === 't.cn') return 'weibo';
  if (hostname === 'zhihu.com' || hostname.endsWith('.zhihu.com')) return 'zhihu';
  if (hostname === 'kuaishou.com' || hostname.endsWith('.kuaishou.com') || hostname === 'gifshow.com' || hostname.endsWith('.gifshow.com')) return 'kuaishou';
  if (hostname === 'mp.weixin.qq.com' || hostname === 'weixin.qq.com' || hostname.endsWith('.weixin.qq.com')) return 'wechat';
  if (hostname === 'meituan.com' || hostname.endsWith('.meituan.com')) return 'meituan';
  if (hostname === 'dianping.com' || hostname.endsWith('.dianping.com')) return 'dianping';
  if (hostname === 'ctrip.com' || hostname.endsWith('.ctrip.com') || hostname === 'trip.com' || hostname.endsWith('.trip.com')) return 'ctrip';
  if (hostname === 'ele.me' || hostname.endsWith('.ele.me')) return 'eleme';
  if (hostname === 'dewu.com' || hostname.endsWith('.dewu.com') || hostname === 'poizon.com' || hostname.endsWith('.poizon.com')) return 'dewu';
  return 'website';
}

function platformTitle(platform: PreviewPayload['platform'], hostname: string) {
  const titles: Partial<Record<PreviewPayload['platform'], string>> = {
    xiaohongshu: '小红书分享', douyin: '抖音分享', taobao: '淘宝商品分享', pinduoduo: '拼多多商品分享', jd: '京东商品分享',
    xianyu: '闲鱼分享', bilibili: '哔哩哔哩分享', weibo: '微博分享', zhihu: '知乎分享', kuaishou: '快手分享', wechat: '微信分享',
    meituan: '美团分享', dianping: '大众点评分享', ctrip: '携程分享', eleme: '饿了么分享', dewu: '得物分享'
  };
  if (titles[platform]) return titles[platform];
  return hostname.replace(/^www\./, '') || '网站链接';
}

function platformSiteName(platform: PreviewPayload['platform'], hostname: string) {
  const names: Partial<Record<PreviewPayload['platform'], string>> = {
    xiaohongshu: '小红书', douyin: '抖音', taobao: '淘宝', pinduoduo: '拼多多', jd: '京东', xianyu: '闲鱼', bilibili: '哔哩哔哩',
    weibo: '微博', zhihu: '知乎', kuaishou: '快手', wechat: '微信', meituan: '美团', dianping: '大众点评', ctrip: '携程', eleme: '饿了么', dewu: '得物'
  };
  return names[platform] || hostname.replace(/^www\./, '');
}

function parseJsonLd(html: string) {
  const values: unknown[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1] || match[1].length > 500_000) continue;
    try {
      values.push(JSON.parse(decodeHtmlEntities(match[1])) as unknown);
    } catch {
      continue;
    }
  }
  return values;
}

function walkJson(value: unknown, visitor: (record: Record<string, unknown>) => void, depth = 0) {
  if (depth > 8 || value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) walkJson(item, visitor, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  visitor(record);
  for (const nested of Object.values(record)) walkJson(nested, visitor, depth + 1);
}

function readJsonLdDetails(html: string, pageUrl: URL) {
  const images: string[] = [];
  const comments: Array<{ author?: string; message: string; createdAt?: string; rating?: number }> = [];
  for (const value of parseJsonLd(html)) {
    walkJson(value, (record) => {
      const type = Array.isArray(record['@type']) ? record['@type'].join(' ') : String(record['@type'] ?? '');
      const rawImages = Array.isArray(record.image) ? record.image : [record.image];
      for (const rawImage of rawImages) {
        const imageRecord = rawImage && typeof rawImage === 'object' && !Array.isArray(rawImage) ? rawImage as Record<string, unknown> : null;
        const url = absoluteWebUrl(String(imageRecord?.url ?? imageRecord?.contentUrl ?? rawImage ?? ''), pageUrl);
        if (url) images.push(url);
      }
      if (/Comment|Review/i.test(type) && comments.length < 20) {
        const authorRecord = record.author && typeof record.author === 'object' && !Array.isArray(record.author) ? record.author as Record<string, unknown> : null;
        const ratingRecord = record.reviewRating && typeof record.reviewRating === 'object' && !Array.isArray(record.reviewRating) ? record.reviewRating as Record<string, unknown> : null;
        const message = cleanMetadataText(String(record.text ?? record.reviewBody ?? record.description ?? ''), 1_000);
        const author = cleanMetadataText(String(authorRecord?.name ?? record.author ?? ''), 120);
        const createdAt = cleanMetadataText(String(record.dateCreated ?? record.datePublished ?? ''), 80);
        const rating = Number(ratingRecord?.ratingValue);
        if (message) comments.push({ ...(author ? { author } : {}), message, ...(createdAt ? { createdAt } : {}), ...(Number.isFinite(rating) ? { rating } : {}) });
      }
    });
  }
  return { images: [...new Set(images)], comments };
}

function bodyContent(html: string) {
  const cleaned = html
    .replace(/<(script|style|noscript|svg|template|nav|footer|header|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ');
  const preferred = cleaned.match(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)\s*>/i)?.[1]
    || cleaned.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1]
    || '';
  return cleanMetadataText(preferred, 8_000);
}

function htmlImageUrls(html: string, pageUrl: URL) {
  const images = metadataValues(html, ['og:image:secure_url', 'og:image', 'twitter:image']).map((value) => absoluteWebUrl(value, pageUrl));
  for (const tag of (html.match(/<img\b[^>]*>/gi) ?? []).slice(0, 80)) {
    const attributes = tagAttributes(tag);
    images.push(absoluteWebUrl(attributes.get('data-src') || attributes.get('data-original') || attributes.get('src') || '', pageUrl));
  }
  return [...new Set(images.filter(Boolean))].slice(0, 12);
}

export function parseLinkPreviewHtml(html: string, pageUrl: URL) {
  const platform = platformForUrl(pageUrl);
  const htmlTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '';
  const title = cleanMetadataText(metadataValue(html, ['og:title', 'twitter:title']) || htmlTitle, 240)
    || platformTitle(platform, pageUrl.hostname);
  const description = cleanMetadataText(metadataValue(html, ['og:description', 'twitter:description', 'description']), 500);
  const siteName = cleanMetadataText(metadataValue(html, ['og:site_name', 'application-name']), 120)
    || platformSiteName(platform, pageUrl.hostname);
  const jsonLd = readJsonLdDetails(html, pageUrl);
  const imageUrls = [...new Set([...htmlImageUrls(html, pageUrl), ...jsonLd.images])].slice(0, 8);
  const content = bodyContent(html);
  return {
    platform,
    title,
    description,
    siteName,
    canonicalUrl: absoluteWebUrl(canonicalValue(html), pageUrl),
    imageUrl: imageUrls[0] ?? '',
    imageUrls,
    content,
    comments: jsonLd.comments
  };
}

async function readHtmlPrefix(response: Response) {
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxPreviewHtmlBytes) throw new Error('网页内容过大，无法生成预览。');
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxPreviewHtmlBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const remaining = maxPreviewHtmlBytes - total;
    chunks.push(value.byteLength > remaining ? value.subarray(0, remaining) : value);
    total += Math.min(value.byteLength, remaining);
    if (value.byteLength > remaining) break;
  }
  await reader.cancel().catch(() => undefined);
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))));
}

async function fetchPublicHtml(rawUrl: string) {
  let target = await validatePublicUrl(rawUrl, ['https:']);
  for (let redirectCount = 0; redirectCount <= 4; redirectCount += 1) {
    const response = await fetch(target, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6',
        'User-Agent': 'Mozilla/5.0 (compatible; BabyLink-LinkPreview/1.0; +https://babylink.top)'
      },
      signal: createTimeoutSignal(12_000)
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('网页跳转缺少目标地址。');
      target = await validatePublicUrl(new URL(location, target).href, ['https:']);
      continue;
    }
    if (!response.ok) {
      const platform = platformForUrl(target);
      if (platform !== 'website') return { html: '', target, status: response.status, limited: true };
      throw new Error(`网页返回 HTTP ${response.status}。`);
    }
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('目标不是可预览的网页。');
    return { html: await readHtmlPrefix(response), target, status: response.status, limited: false };
  }
  throw new Error('网页跳转次数过多。');
}

async function validateOptionalPublicUrl(rawUrl: string) {
  if (!rawUrl) return '';
  try {
    return (await validatePublicUrl(rawUrl, ['https:'])).href;
  } catch {
    return '';
  }
}

function cachePreview(key: string, payload: PreviewPayload) {
  previewCache.set(key, payload);
  while (previewCache.size > 256) {
    const firstKey = previewCache.keys().next().value as string | undefined;
    if (!firstKey) break;
    previewCache.delete(firstKey);
  }
}

export async function registerLinkPreviewRoutes(app: FastifyInstance) {
  app.post('/api/link-preview', {
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } }
  }, async (request, reply) => {
    const rawUrl = String((request.body as { url?: unknown } | null)?.url ?? '').trim();
    if (!rawUrl || rawUrl.length > 2_048) return await reply.code(400).send({ error: 'invalid_link', message: '链接地址无效。' });
    const cached = previewCache.get(rawUrl);
    if (cached && Date.now() - cached.fetchedAt < previewCacheTtlMs) {
      reply.header('Cache-Control', 'private, max-age=300');
      return cached;
    }
    try {
      const { html, target, status, limited } = await fetchPublicHtml(rawUrl);
      const metadata = parseLinkPreviewHtml(html, target);
      const [canonicalUrl, imageUrl, imageUrls] = await Promise.all([
        validateOptionalPublicUrl(metadata.canonicalUrl),
        validateOptionalPublicUrl(metadata.imageUrl),
        Promise.all(metadata.imageUrls.map(validateOptionalPublicUrl))
      ]);
      const resolvedUrl = canonicalUrl || target.href;
      const platform = platformForUrl(new URL(resolvedUrl));
      const payload: PreviewPayload = {
        platform,
        url: resolvedUrl,
        title: metadata.title || platformTitle(platform, target.hostname),
        description: metadata.description || (limited ? '已解析真实分享地址；平台限制了普通网页读取，可继续调用对应平台 MCP。' : metadata.content.slice(0, 500)),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imageUrls.filter(Boolean).length ? { imageUrls: [...new Set(imageUrls.filter(Boolean))].slice(0, 8) } : {}),
        ...(metadata.content ? { content: metadata.content } : {}),
        ...(metadata.comments.length ? { comments: metadata.comments } : {}),
        readStatus: limited ? 'platform-limited' : metadata.content ? 'complete' : 'metadata-only',
        httpStatus: status,
        siteName: metadata.siteName || platformSiteName(platform, target.hostname),
        fetchedAt: Date.now()
      };
      cachePreview(rawUrl, payload);
      reply.header('Cache-Control', 'private, max-age=300');
      return payload;
    } catch (error) {
      request.log.info({ error }, 'Link preview fetch failed');
      return await reply.code(422).send({ error: 'link_preview_unavailable', message: '暂时无法读取这个链接的网页预览。' });
    }
  });
}