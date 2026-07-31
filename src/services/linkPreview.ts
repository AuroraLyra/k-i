import type { ChatLinkPreviewAttachment, ChatLinkPreviewPlatform } from '@/types/domain';

type LinkPreviewResponse = Partial<ChatLinkPreviewAttachment>;

const webUrlPattern = /https?:\/\/[^\s<>"']+/i;
const trailingUrlPunctuationPattern = /[\])}\u3009\u300b\u3011，。！？；：、…"']+$/;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function safeWebUrl(value: unknown) {
  const rawUrl = cleanText(value, 2_048);
  if (!rawUrl) return '';
  try {
    const url = new URL(rawUrl);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return '';
    return url.href.slice(0, 2_048);
  } catch {
    return '';
  }
}

export function linkPreviewPlatform(url: string): ChatLinkPreviewPlatform {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return 'website';
  }
  if (hostname === 'xhslink.com' || hostname.endsWith('.xhslink.com') || hostname === 'xiaohongshu.com' || hostname.endsWith('.xiaohongshu.com')) return 'xiaohongshu';
  if (hostname === 'douyin.com' || hostname.endsWith('.douyin.com') || hostname.endsWith('.iesdouyin.com')) return 'douyin';
  if (hostname === 'tb.cn' || hostname.endsWith('.tb.cn') || hostname === 'taobao.com' || hostname.endsWith('.taobao.com') || hostname === 'tmall.com' || hostname.endsWith('.tmall.com')) return 'taobao';
  return 'website';
}

export function extractFirstChatLink(content: string) {
  const match = content.match(webUrlPattern)?.[0] ?? '';
  return safeWebUrl(match.replace(trailingUrlPunctuationPattern, ''));
}

function platformFallback(platform: ChatLinkPreviewPlatform, hostname: string) {
  if (platform === 'xiaohongshu') return { title: '小红书分享', description: '打开小红书查看原始内容', siteName: '小红书' };
  if (platform === 'douyin') return { title: '抖音分享', description: '打开抖音查看原始内容', siteName: '抖音' };
  if (platform === 'taobao') return { title: '淘宝商品分享', description: '打开淘宝查看原始商品', siteName: '淘宝' };
  return { title: hostname || '网站链接', description: '打开网页查看原始内容', siteName: hostname || 'Website' };
}

export function createChatLinkPreview(content: string): ChatLinkPreviewAttachment | null {
  const url = extractFirstChatLink(content);
  if (!url) return null;
  const platform = linkPreviewPlatform(url);
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  return {
    platform,
    url,
    ...platformFallback(platform, hostname),
    fetchedAt: 0
  };
}

export async function fetchChatLinkPreview(fallback: ChatLinkPreviewAttachment) {
  try {
    const response = await fetch('/api/link-preview', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ url: fallback.url }),
      signal: AbortSignal.timeout(12_000)
    });
    if (!response.ok) return fallback;
    const payload = await response.json() as LinkPreviewResponse;
    const url = safeWebUrl(payload.url) || fallback.url;
    const imageUrl = safeWebUrl(payload.imageUrl);
    const platform = linkPreviewPlatform(url) === 'website' ? fallback.platform : linkPreviewPlatform(url);
    return {
      platform,
      url,
      title: cleanText(payload.title, 240) || fallback.title,
      description: cleanText(payload.description, 500) || fallback.description,
      ...(imageUrl ? { imageUrl } : {}),
      siteName: cleanText(payload.siteName, 120) || fallback.siteName,
      fetchedAt: Math.max(0, Number(payload.fetchedAt) || Date.now())
    } satisfies ChatLinkPreviewAttachment;
  } catch {
    return fallback;
  }
}