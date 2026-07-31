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

export function extractFirstChatLink(content: string) {
  const match = content.match(webUrlPattern)?.[0] ?? '';
  return safeWebUrl(match.replace(trailingUrlPunctuationPattern, ''));
}

function platformFallback(platform: ChatLinkPreviewPlatform, hostname: string) {
  const definitions: Partial<Record<ChatLinkPreviewPlatform, { title: string; description: string; siteName: string }>> = {
    xiaohongshu: { title: '小红书分享', description: '正在读取笔记、图片与评论', siteName: '小红书' },
    douyin: { title: '抖音分享', description: '正在解析短链、视频详情与评论', siteName: '抖音' },
    taobao: { title: '淘宝商品分享', description: '正在读取商品、价格与优惠', siteName: '淘宝' },
    pinduoduo: { title: '拼多多商品分享', description: '正在读取商品分享页', siteName: '拼多多' },
    jd: { title: '京东商品分享', description: '正在读取商品分享页', siteName: '京东' },
    xianyu: { title: '闲鱼分享', description: '正在读取商品分享页', siteName: '闲鱼' },
    bilibili: { title: '哔哩哔哩分享', description: '正在读取视频与公开信息', siteName: '哔哩哔哩' },
    weibo: { title: '微博分享', description: '正在读取公开内容', siteName: '微博' },
    zhihu: { title: '知乎分享', description: '正在读取回答或文章', siteName: '知乎' },
    kuaishou: { title: '快手分享', description: '正在读取视频分享页', siteName: '快手' },
    wechat: { title: '微信分享', description: '正在读取公众号文章', siteName: '微信' },
    meituan: { title: '美团分享', description: '正在读取门店或服务信息', siteName: '美团' },
    dianping: { title: '大众点评分享', description: '正在读取门店与公开评价', siteName: '大众点评' },
    ctrip: { title: '携程分享', description: '正在读取旅行产品信息', siteName: '携程' },
    eleme: { title: '饿了么分享', description: '正在读取商家或商品信息', siteName: '饿了么' },
    dewu: { title: '得物分享', description: '正在读取商品分享页', siteName: '得物' }
  };
  if (definitions[platform]) return definitions[platform];
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
    const imageUrls = Array.isArray(payload.imageUrls)
      ? [...new Set(payload.imageUrls.map(safeWebUrl).filter(Boolean))].slice(0, 8)
      : imageUrl ? [imageUrl] : [];
    const comments = Array.isArray(payload.comments) ? payload.comments.slice(0, 20).flatMap((comment) => {
      if (!comment || typeof comment !== 'object') return [];
      const message = cleanText(comment.message, 1_000);
      if (!message) return [];
      const author = cleanText(comment.author, 120);
      const createdAt = cleanText(comment.createdAt, 80);
      const rating = Number(comment.rating);
      return [{ ...(author ? { author } : {}), message, ...(createdAt ? { createdAt } : {}), ...(Number.isFinite(rating) ? { rating } : {}) }];
    }) : [];
    const platform = linkPreviewPlatform(url) === 'website' ? fallback.platform : linkPreviewPlatform(url);
    return {
      platform,
      url,
      title: cleanText(payload.title, 240) || fallback.title,
      description: cleanText(payload.description, 500) || fallback.description,
      ...(imageUrl ? { imageUrl } : {}),
      ...(imageUrls.length ? { imageUrls } : {}),
      ...(cleanText(payload.content, 8_000) ? { content: cleanText(payload.content, 8_000) } : {}),
      ...(comments.length ? { comments } : {}),
      ...(['complete', 'platform-limited', 'metadata-only'].includes(String(payload.readStatus)) ? { readStatus: payload.readStatus } : {}),
      ...(Number.isFinite(Number(payload.httpStatus)) ? { httpStatus: Number(payload.httpStatus) } : {}),
      siteName: cleanText(payload.siteName, 120) || fallback.siteName,
      fetchedAt: Math.max(0, Number(payload.fetchedAt) || Date.now())
    } satisfies ChatLinkPreviewAttachment;
  } catch {
    return fallback;
  }
}