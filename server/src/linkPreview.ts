import type { FastifyInstance } from 'fastify';
import { createTimeoutSignal, validatePublicUrl } from './security.js';

type PreviewPayload = {
  platform: 'website' | 'xiaohongshu' | 'douyin' | 'taobao';
  url: string;
  title: string;
  description: string;
  imageUrl?: string;
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
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = tagAttributes(tag);
    const key = (attributes.get('property') || attributes.get('name') || '').toLowerCase();
    if (!wanted.has(key)) continue;
    const content = attributes.get('content') ?? '';
    if (content.trim()) return content;
  }
  return '';
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
  return 'website';
}

function platformTitle(platform: PreviewPayload['platform'], hostname: string) {
  if (platform === 'xiaohongshu') return '小红书分享';
  if (platform === 'douyin') return '抖音分享';
  if (platform === 'taobao') return '淘宝商品分享';
  return hostname.replace(/^www\./, '') || '网站链接';
}

export function parseLinkPreviewHtml(html: string, pageUrl: URL) {
  const platform = platformForUrl(pageUrl);
  const htmlTitle = html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '';
  const title = cleanMetadataText(metadataValue(html, ['og:title', 'twitter:title']) || htmlTitle, 240)
    || platformTitle(platform, pageUrl.hostname);
  const description = cleanMetadataText(metadataValue(html, ['og:description', 'twitter:description', 'description']), 500);
  const siteName = cleanMetadataText(metadataValue(html, ['og:site_name', 'application-name']), 120)
    || (platform === 'xiaohongshu' ? '小红书' : platform === 'douyin' ? '抖音' : platform === 'taobao' ? '淘宝' : pageUrl.hostname.replace(/^www\./, ''));
  return {
    platform,
    title,
    description,
    siteName,
    canonicalUrl: absoluteWebUrl(canonicalValue(html), pageUrl),
    imageUrl: absoluteWebUrl(metadataValue(html, ['og:image:secure_url', 'og:image', 'twitter:image']), pageUrl)
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
    if (!response.ok) throw new Error(`网页返回 HTTP ${response.status}。`);
    const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('目标不是可预览的网页。');
    return { html: await readHtmlPrefix(response), target };
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
      const { html, target } = await fetchPublicHtml(rawUrl);
      const metadata = parseLinkPreviewHtml(html, target);
      const [canonicalUrl, imageUrl] = await Promise.all([
        validateOptionalPublicUrl(metadata.canonicalUrl),
        validateOptionalPublicUrl(metadata.imageUrl)
      ]);
      const resolvedUrl = canonicalUrl || target.href;
      const platform = platformForUrl(new URL(resolvedUrl));
      const payload: PreviewPayload = {
        platform,
        url: resolvedUrl,
        title: metadata.title,
        description: metadata.description,
        ...(imageUrl ? { imageUrl } : {}),
        siteName: metadata.siteName,
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