import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createTaobaoConnector } from './taobao.mjs';
import { createSharedLinkConnector } from './shared-links.mjs';

const execFileAsync = promisify(execFile);
const maxPublicResponseBytes = 4 * 1024 * 1024;

const objectSchema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const stringProperty = (description) => ({ type: 'string', description });
const numberProperty = (description) => ({ type: 'number', description });
const booleanProperty = (description) => ({ type: 'boolean', description });

const tools = [
  {
    name: 'search_web',
    title: '公开网页搜索',
    description: '搜索公开网页并返回真实来源链接。',
    inputSchema: objectSchema({ query: stringProperty('搜索词'), limit: numberProperty('结果数量，1-10') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'search_bilibili',
    title: '搜索 B 站',
    description: '搜索 B 站公开视频或 UP 主。',
    inputSchema: objectSchema({ query: stringProperty('搜索词'), kind: { type: 'string', enum: ['video', 'user'] }, page: numberProperty('页码'), limit: numberProperty('结果数量，1-20') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_bilibili_video',
    title: '读取 B 站视频详情',
    description: '读取视频标题、UP 主、分 P、统计和简介。',
    inputSchema: objectSchema({ bvid: stringProperty('BV 号') }, ['bvid']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_bilibili_comments',
    title: '读取 B 站热门评论',
    description: '读取公开视频的热门评论。',
    inputSchema: objectSchema({ bvid: stringProperty('BV 号'), limit: numberProperty('评论数量，1-20') }, ['bvid']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_bilibili_subtitles',
    title: '读取 B 站字幕',
    description: '读取公开视频已公开的字幕；无字幕或接口受限时会明确返回。',
    inputSchema: objectSchema({ bvid: stringProperty('BV 号'), page: numberProperty('分 P 序号，从 1 开始'), language: stringProperty('优先语言，例如 zh-CN') }, ['bvid']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'list_bilibili_favorites',
    title: '读取 B 站收藏夹',
    description: '使用仅保存在 Termux 的 BILIBILI_COOKIE 读取当前账号收藏夹。',
    inputSchema: objectSchema({ mediaId: numberProperty('可选收藏夹 ID'), page: numberProperty('页码'), limit: numberProperty('条目数量，1-20') }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'search_douban',
    title: '搜索豆瓣',
    description: '搜索豆瓣电影、书籍或条目的公开页面与摘要。',
    inputSchema: objectSchema({ query: stringProperty('搜索词'), kind: { type: 'string', enum: ['movie', 'book', 'all'] }, limit: numberProperty('结果数量，1-10') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'search_music',
    title: '搜索音乐',
    description: '通过 Apple iTunes Search API 搜索歌曲、专辑和试听链接。歌词、评论和私有歌单可由额外上游 MCP 提供。',
    inputSchema: objectSchema({ query: stringProperty('歌曲、歌手或专辑'), country: stringProperty('国家/地区代码，默认 CN'), limit: numberProperty('结果数量，1-20') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'search_places',
    title: '搜索真实地点',
    description: '通过高德开放平台搜索 POI、地址、距离和营业信息。需要 AMAP_WEB_KEY。',
    inputSchema: objectSchema({ query: stringProperty('地点或品类'), city: stringProperty('城市名或 adcode'), latitude: numberProperty('纬度'), longitude: numberProperty('经度'), radius: numberProperty('附近半径，米'), limit: numberProperty('结果数量，1-20') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_route',
    title: '规划真实路线',
    description: '通过高德开放平台规划步行、驾车或骑行路线。需要 AMAP_WEB_KEY。',
    inputSchema: objectSchema({ origin: stringProperty('起点经纬度，格式 经度,纬度'), destination: stringProperty('终点经纬度，格式 经度,纬度'), mode: { type: 'string', enum: ['walking', 'driving', 'bicycling'] } }, ['origin', 'destination']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'track_delivery',
    title: '查询快递',
    description: '通过快递100企业接口查询用户主动提供的运单号。需要 KUAIDI100_CUSTOMER 和 KUAIDI100_KEY。',
    inputSchema: objectSchema({ company: stringProperty('快递公司编码'), trackingNumber: stringProperty('运单号'), phone: stringProperty('部分快递需要的收/寄件人手机号后四位') }, ['company', 'trackingNumber']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'search_recipes',
    title: '搜索菜谱',
    description: '按菜名或食材搜索公开菜谱。',
    inputSchema: objectSchema({ query: stringProperty('菜名或主要食材'), byIngredient: booleanProperty('是否按食材搜索'), limit: numberProperty('结果数量，1-20') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_recipe',
    title: '读取菜谱与购物清单',
    description: '读取菜谱步骤、食材，并生成购物清单。',
    inputSchema: objectSchema({ recipeId: stringProperty('菜谱 ID') }, ['recipeId']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'add_price_track',
    title: '添加价格追踪',
    description: '在 Termux 本地保存商品页面和目标价；不会下单。',
    inputSchema: objectSchema({ url: stringProperty('商品公开 HTTPS 页面'), title: stringProperty('商品名称'), targetPrice: numberProperty('目标价格'), currentPrice: numberProperty('已知当前价格，可省略自动抓取'), currency: stringProperty('货币，默认 CNY') }, ['url', 'title']),
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'record_price',
    title: '记录商品价格',
    description: '向已有追踪手动记录一次真实价格。',
    inputSchema: objectSchema({ trackId: stringProperty('追踪 ID'), price: numberProperty('当前价格') }, ['trackId', 'price']),
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'check_price_tracks',
    title: '检查全部价格',
    description: '抓取已追踪商品公开页面中的结构化价格，并在达到目标价时发送 Termux 通知。',
    inputSchema: objectSchema({ notify: booleanProperty('达到目标价时是否发送本机通知') }),
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'list_price_tracks',
    title: '列出价格追踪',
    description: '列出保存在 Termux 本地的商品价格与历史。',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'remove_price_track',
    title: '删除价格追踪',
    description: '删除 Termux 本地的一条价格追踪。',
    inputSchema: objectSchema({ trackId: stringProperty('追踪 ID') }, ['trackId']),
    annotations: { readOnlyHint: false, destructiveHint: true }
  },
  {
    name: 'notify_phone',
    title: '发送 Termux 系统通知',
    description: '通过 Termux:API 在本机显示通知。',
    inputSchema: objectSchema({ title: stringProperty('通知标题'), body: stringProperty('通知正文') }, ['title', 'body']),
    annotations: { readOnlyHint: false, destructiveHint: false }
  }
];

function textArg(args, key, fallback = '') {
  return String(args?.[key] ?? fallback).trim();
}

function numberArg(args, key, fallback, min, max) {
  const value = Number(args?.[key]);
  const resolved = Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, resolved));
}

function stripHtml(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function privateAddress(address) {
  const normalized = String(address).toLowerCase();
  if (normalized === '::1' || normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  const match = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const [first, second] = match.slice(1).map(Number);
  return first === 0 || first === 10 || first === 127 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

async function validatePublicUrl(rawUrl) {
  const target = new URL(rawUrl);
  if (target.protocol !== 'https:' || target.username || target.password) throw new Error('价格追踪只允许公开 HTTPS 页面。');
  if (target.hostname.endsWith('.local') || target.hostname === 'localhost') throw new Error('价格追踪不允许访问本机或局域网地址。');
  const addresses = await lookup(target.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error('价格追踪目标解析到了私有网络地址。');
  return target;
}

async function readResponse(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxPublicResponseBytes) throw new Error('上游响应超过 4 MB。');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxPublicResponseBytes) throw new Error('上游响应超过 4 MB。');
  return new TextDecoder().decode(bytes);
}

async function fetchJson(url, init = {}) {
  const response = await fetch(url, { ...init, redirect: 'error', headers: { 'User-Agent': 'BabyLink-Termux-Gateway/0.1', ...(init.headers || {}) } });
  const text = await readResponse(response);
  if (!response.ok) throw new Error(`上游请求失败（${response.status}）：${text.slice(0, 300)}`);
  const payload = JSON.parse(text);
  if (typeof payload?.code === 'number' && payload.code !== 0) throw new Error(payload.message || payload.msg || `平台接口错误 ${payload.code}`);
  return payload;
}

async function fetchPublicProductPage(rawUrl) {
  let target = await validatePublicUrl(rawUrl);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const response = await fetch(target, {
      redirect: 'manual',
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 BabyLinkPriceTracker/0.1' }
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('商品页面重定向缺少目标地址。');
      target = await validatePublicUrl(new URL(location, target).href);
      continue;
    }
    const text = await readResponse(response);
    if (!response.ok) throw new Error(`商品页面返回 ${response.status}。`);
    return { text, finalUrl: target.href };
  }
  throw new Error('商品页面重定向次数过多。');
}

async function searchBing(query, limit) {
  const target = new URL('https://www.bing.com/search');
  target.searchParams.set('format', 'rss');
  target.searchParams.set('q', query);
  const response = await fetch(target, { headers: { Accept: 'application/rss+xml, application/xml' }, redirect: 'error' });
  const xml = await readResponse(response);
  if (!response.ok) throw new Error(`网页搜索失败（${response.status}）。`);
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].slice(0, limit).flatMap((match) => {
    const item = match[1];
    const title = decodeHtml(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const url = decodeHtml(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const description = stripHtml(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '');
    try {
      const parsed = new URL(url);
      return title && ['http:', 'https:'].includes(parsed.protocol) ? [{ title, url: parsed.href, description, source: parsed.hostname.replace(/^www\./, '') }] : [];
    } catch {
      return [];
    }
  });
}

function bilibiliHeaders(cookie = '') {
  return {
    Referer: 'https://www.bilibili.com/',
    ...(cookie ? { Cookie: cookie } : {})
  };
}

async function bilibiliView(bvid, cookie = '') {
  const url = new URL('https://api.bilibili.com/x/web-interface/view');
  url.searchParams.set('bvid', bvid);
  return (await fetchJson(url, { headers: bilibiliHeaders(cookie) })).data;
}

function normalizeBilibiliVideo(item) {
  const bvid = String(item.bvid || '');
  return {
    id: bvid || String(item.aid || item.id || ''),
    bvid,
    title: stripHtml(item.title),
    description: stripHtml(item.description || item.desc),
    url: bvid ? `https://www.bilibili.com/video/${bvid}` : String(item.arcurl || ''),
    cover: String(item.pic || item.cover || '').replace(/^\/\//, 'https://'),
    author: String(item.author || item.owner?.name || item.name || ''),
    duration: item.duration,
    publishedAt: item.pubdate || item.created,
    views: item.play || item.stat?.view,
    favorites: item.favorites || item.stat?.favorite
  };
}

function extractPrice(html) {
  const candidates = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const entries = Array.isArray(parsed) ? parsed : parsed?.['@graph'] || [parsed];
      for (const entry of entries) {
        const offers = Array.isArray(entry?.offers) ? entry.offers : [entry?.offers];
        for (const offer of offers) {
          const value = Number(offer?.price ?? offer?.lowPrice);
          if (Number.isFinite(value) && value >= 0) candidates.push({ price: value, currency: String(offer?.priceCurrency || '') });
        }
      }
    } catch {
      continue;
    }
  }
  const metaPatterns = [
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([0-9]+(?:\.[0-9]+)?)["']/i,
    /<meta[^>]+content=["']([0-9]+(?:\.[0-9]+)?)["'][^>]+property=["']product:price:amount["']/i,
    /"price"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/i
  ];
  for (const pattern of metaPatterns) {
    const value = Number(html.match(pattern)?.[1]);
    if (Number.isFinite(value) && value >= 0) candidates.push({ price: value, currency: '' });
  }
  if (!candidates.length) throw new Error('没有从公开页面中识别到结构化价格。');
  return candidates[0];
}

async function sendTermuxNotification(title, body) {
  await execFileAsync('termux-notification', ['--title', title.slice(0, 100), '--content', body.slice(0, 500), '--id', 'babylink-mcp-price']);
  return { delivered: true, channel: 'termux-api' };
}

export function createConnectors(config) {
  const dataDirectory = String(config.dataDirectory || join(process.env.HOME || '.', '.local/share/babylink-mcp'));
  const statePath = join(dataDirectory, 'state.json');
  const connectorConfig = config.connectors || {};
  let stateQueue = Promise.resolve();

  async function readState() {
    try {
      const parsed = JSON.parse(await readFile(statePath, 'utf8'));
      return {
        priceTracks: Array.isArray(parsed.priceTracks) ? parsed.priceTracks : [],
        shoppingList: Array.isArray(parsed.shoppingList) ? parsed.shoppingList : []
      };
    } catch (error) {
      if (error?.code === 'ENOENT') return { priceTracks: [], shoppingList: [] };
      throw error;
    }
  }

  async function updateState(mutator) {
    const operation = stateQueue.then(async () => {
      const state = await readState();
      const result = await mutator(state);
      await mkdir(dataDirectory, { recursive: true });
      const temporaryPath = `${statePath}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
      await rename(temporaryPath, statePath);
      return result;
    });
    stateQueue = operation.catch(() => undefined);
    return await operation;
  }

  async function recordTrackPrice(trackId, price, source = 'manual', finalUrl = '') {
    return await updateState((state) => {
      const track = state.priceTracks.find((entry) => entry.id === trackId);
      if (!track) throw new Error('没有找到这条价格追踪。');
      const previousPrice = Number(track.currentPrice);
      track.currentPrice = price;
      track.updatedAt = Date.now();
      track.lastError = '';
      if (finalUrl) track.finalUrl = finalUrl;
      track.history = [...(Array.isArray(track.history) ? track.history : []), { price, at: Date.now(), source }].slice(-180);
      return { ...track, previousPrice: Number.isFinite(previousPrice) ? previousPrice : null };
    });
  }

  async function checkPriceTracks(notify = true) {
    const state = await readState();
    const results = [];
    for (const track of state.priceTracks) {
      try {
        const page = await fetchPublicProductPage(track.url);
        const detected = extractPrice(page.text);
        const updated = await recordTrackPrice(track.id, detected.price, 'page', page.finalUrl);
        const reachedTarget = Number.isFinite(Number(track.targetPrice)) && detected.price <= Number(track.targetPrice);
        let notification = null;
        if (notify && reachedTarget && (!Number.isFinite(updated.previousPrice) || updated.previousPrice > Number(track.targetPrice))) {
          notification = await sendTermuxNotification('BabyLink 降价提醒', `${track.title} 现价 ${detected.price} ${track.currency || detected.currency || 'CNY'}`).catch((error) => ({ delivered: false, error: error.message }));
        }
        results.push({ trackId: track.id, title: track.title, price: detected.price, targetPrice: track.targetPrice, reachedTarget, notification });
      } catch (error) {
        await updateState((nextState) => {
          const nextTrack = nextState.priceTracks.find((entry) => entry.id === track.id);
          if (nextTrack) {
            nextTrack.lastCheckedAt = Date.now();
            nextTrack.lastError = error instanceof Error ? error.message : String(error);
          }
        });
        results.push({ trackId: track.id, title: track.title, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { checkedAt: Date.now(), results };
  }

  const taobao = createTaobaoConnector(connectorConfig.taobao, { read: readState, update: updateState });
  const sharedLinks = createSharedLinkConnector();

  async function call(name, args = {}) {
    if (taobao.tools.some((tool) => tool.name === name)) return await taobao.call(name, args);
    if (sharedLinks.tools.some((tool) => tool.name === name)) return await sharedLinks.call(name, args);
    if (name === 'search_web') {
      const query = textArg(args, 'query');
      if (!query) throw new Error('搜索词不能为空。');
      const results = await searchBing(query, Math.round(numberArg(args, 'limit', 8, 1, 10)));
      return { query, results };
    }

    if (name === 'search_bilibili') {
      const query = textArg(args, 'query');
      if (!query) throw new Error('B 站搜索词不能为空。');
      const kind = textArg(args, 'kind', 'video') === 'user' ? 'bili_user' : 'video';
      const limit = Math.round(numberArg(args, 'limit', 12, 1, 20));
      const url = new URL('https://api.bilibili.com/x/web-interface/search/type');
      url.searchParams.set('search_type', kind);
      url.searchParams.set('keyword', query);
      url.searchParams.set('page', String(Math.round(numberArg(args, 'page', 1, 1, 50))));
      const payload = await fetchJson(url, { headers: bilibiliHeaders(connectorConfig.bilibiliCookie) });
      const results = (payload.data?.result || []).slice(0, limit).map((item) => kind === 'video' ? normalizeBilibiliVideo(item) : {
        id: String(item.mid || ''),
        title: stripHtml(item.uname),
        description: stripHtml(item.usign),
        url: `https://space.bilibili.com/${item.mid}`,
        cover: String(item.upic || '').replace(/^\/\//, 'https://'),
        followers: item.fans,
        videos: item.videos
      });
      return { query, kind: kind === 'video' ? 'video' : 'user', results };
    }

    if (name === 'get_bilibili_video') {
      const bvid = textArg(args, 'bvid');
      if (!/^BV[0-9A-Za-z]+$/.test(bvid)) throw new Error('BV 号无效。');
      const video = await bilibiliView(bvid, connectorConfig.bilibiliCookie);
      return { ...normalizeBilibiliVideo(video), aid: video.aid, pages: video.pages, stat: video.stat, owner: video.owner };
    }

    if (name === 'get_bilibili_comments') {
      const bvid = textArg(args, 'bvid');
      const video = await bilibiliView(bvid, connectorConfig.bilibiliCookie);
      const url = new URL('https://api.bilibili.com/x/v2/reply/main');
      url.searchParams.set('type', '1');
      url.searchParams.set('oid', String(video.aid));
      url.searchParams.set('mode', '3');
      url.searchParams.set('ps', String(Math.round(numberArg(args, 'limit', 12, 1, 20))));
      const payload = await fetchJson(url, { headers: bilibiliHeaders(connectorConfig.bilibiliCookie) });
      const comments = (payload.data?.replies || []).map((reply) => ({
        id: String(reply.rpid || ''),
        author: String(reply.member?.uname || ''),
        avatar: String(reply.member?.avatar || '').replace(/^\/\//, 'https://'),
        message: String(reply.content?.message || ''),
        likes: reply.like,
        replies: reply.rcount,
        createdAt: reply.ctime
      }));
      return { bvid, title: video.title, comments };
    }

    if (name === 'get_bilibili_subtitles') {
      const bvid = textArg(args, 'bvid');
      const video = await bilibiliView(bvid, connectorConfig.bilibiliCookie);
      const pageIndex = Math.round(numberArg(args, 'page', 1, 1, Math.max(1, video.pages?.length || 1))) - 1;
      const page = video.pages?.[pageIndex];
      if (!page?.cid) throw new Error('没有找到这个分 P。');
      const url = new URL('https://api.bilibili.com/x/player/v2');
      url.searchParams.set('bvid', bvid);
      url.searchParams.set('cid', String(page.cid));
      const payload = await fetchJson(url, { headers: bilibiliHeaders(connectorConfig.bilibiliCookie) });
      const subtitles = payload.data?.subtitle?.subtitles || [];
      if (!subtitles.length) return { bvid, page: pageIndex + 1, available: [], lines: [], note: '该视频没有公开字幕，或字幕只对登录账号开放。' };
      const preferredLanguage = textArg(args, 'language');
      const selected = subtitles.find((entry) => entry.lan === preferredLanguage) || subtitles[0];
      const subtitleUrl = String(selected.subtitle_url || '').replace(/^\/\//, 'https://');
      const subtitle = await fetchJson(subtitleUrl, { headers: bilibiliHeaders(connectorConfig.bilibiliCookie) });
      return { bvid, page: pageIndex + 1, language: selected.lan, languageLabel: selected.lan_doc, available: subtitles.map((entry) => ({ language: entry.lan, label: entry.lan_doc })), lines: subtitle.body || [] };
    }

    if (name === 'list_bilibili_favorites') {
      const cookie = textArg(connectorConfig, 'bilibiliCookie');
      if (!cookie) throw new Error('请先在 Termux 配置 BILIBILI_COOKIE；Cookie 不会传给 BabyLink。');
      let mediaId = Math.round(numberArg(args, 'mediaId', 0, 0, Number.MAX_SAFE_INTEGER));
      if (!mediaId) {
        const nav = await fetchJson('https://api.bilibili.com/x/web-interface/nav', { headers: bilibiliHeaders(cookie) });
        const foldersUrl = new URL('https://api.bilibili.com/x/v3/fav/folder/created/list-all');
        foldersUrl.searchParams.set('up_mid', String(nav.data.mid));
        const folders = await fetchJson(foldersUrl, { headers: bilibiliHeaders(cookie) });
        return { folders: folders.data?.list || [], note: '再次传入 mediaId 可读取收藏夹条目。' };
      }
      const url = new URL('https://api.bilibili.com/x/v3/fav/resource/list');
      url.searchParams.set('media_id', String(mediaId));
      url.searchParams.set('pn', String(Math.round(numberArg(args, 'page', 1, 1, 100))));
      url.searchParams.set('ps', String(Math.round(numberArg(args, 'limit', 20, 1, 20))));
      const payload = await fetchJson(url, { headers: bilibiliHeaders(cookie) });
      return { mediaId, info: payload.data?.info, items: (payload.data?.medias || []).map(normalizeBilibiliVideo) };
    }

    if (name === 'search_douban') {
      const query = textArg(args, 'query');
      if (!query) throw new Error('豆瓣搜索词不能为空。');
      const kind = textArg(args, 'kind', 'all');
      const suffix = kind === 'movie' ? '电影' : kind === 'book' ? '读书' : '';
      const results = await searchBing(`site:douban.com ${suffix} ${query}`, Math.round(numberArg(args, 'limit', 8, 1, 10)));
      return { query, kind, results: results.filter((entry) => /(?:^|\.)douban\.com$/i.test(new URL(entry.url).hostname)) };
    }

    if (name === 'search_music') {
      const query = textArg(args, 'query');
      if (!query) throw new Error('音乐搜索词不能为空。');
      const url = new URL('https://itunes.apple.com/search');
      url.searchParams.set('term', query);
      url.searchParams.set('media', 'music');
      url.searchParams.set('entity', 'song');
      url.searchParams.set('country', textArg(args, 'country', 'CN').toUpperCase().slice(0, 2));
      url.searchParams.set('limit', String(Math.round(numberArg(args, 'limit', 12, 1, 20))));
      const payload = await fetchJson(url);
      return { query, items: (payload.results || []).map((item) => ({
        id: String(item.trackId || ''),
        title: item.trackName,
        artist: item.artistName,
        album: item.collectionName,
        url: item.trackViewUrl,
        previewUrl: item.previewUrl,
        cover: String(item.artworkUrl100 || '').replace('100x100', '600x600'),
        durationMs: item.trackTimeMillis,
        genre: item.primaryGenreName,
        releaseDate: item.releaseDate
      })) };
    }

    if (name === 'search_places') {
      const key = textArg(connectorConfig, 'amapWebKey');
      if (!key) throw new Error('请先在 Termux 配置 AMAP_WEB_KEY。');
      const query = textArg(args, 'query');
      if (!query) throw new Error('地点搜索词不能为空。');
      const longitude = Number(args.longitude);
      const latitude = Number(args.latitude);
      const nearby = Number.isFinite(longitude) && Number.isFinite(latitude);
      const url = new URL(nearby ? 'https://restapi.amap.com/v3/place/around' : 'https://restapi.amap.com/v3/place/text');
      url.searchParams.set('key', key);
      url.searchParams.set('keywords', query);
      url.searchParams.set('offset', String(Math.round(numberArg(args, 'limit', 15, 1, 20))));
      url.searchParams.set('extensions', 'all');
      if (nearby) {
        url.searchParams.set('location', `${longitude},${latitude}`);
        url.searchParams.set('radius', String(Math.round(numberArg(args, 'radius', 3000, 100, 50000))));
        url.searchParams.set('sortrule', 'distance');
      } else if (textArg(args, 'city')) {
        url.searchParams.set('city', textArg(args, 'city'));
        url.searchParams.set('citylimit', 'true');
      }
      const payload = await fetchJson(url);
      if (payload.status !== '1') throw new Error(payload.info || '高德地点搜索失败。');
      return { query, pois: (payload.pois || []).map((poi) => {
        const [poiLongitude, poiLatitude] = String(poi.location || ',').split(',').map(Number);
        return {
          id: poi.id,
          title: poi.name,
          address: [poi.pname, poi.cityname, poi.adname, poi.address].filter(Boolean).join(''),
          category: poi.type,
          phone: poi.tel,
          distanceMeters: Number(poi.distance) || null,
          longitude: poiLongitude,
          latitude: poiLatitude,
          businessArea: poi.business_area,
          rating: poi.biz_ext?.rating,
          cost: poi.biz_ext?.cost,
          openingHours: poi.biz_ext?.open_time,
          photos: (poi.photos || []).map((photo) => photo.url).filter(Boolean),
          url: Number.isFinite(poiLongitude) && Number.isFinite(poiLatitude) ? `https://uri.amap.com/marker?position=${poiLongitude},${poiLatitude}&name=${encodeURIComponent(poi.name)}` : ''
        };
      }) };
    }

    if (name === 'get_route') {
      const key = textArg(connectorConfig, 'amapWebKey');
      if (!key) throw new Error('请先在 Termux 配置 AMAP_WEB_KEY。');
      const mode = ['walking', 'driving', 'bicycling'].includes(textArg(args, 'mode')) ? textArg(args, 'mode') : 'walking';
      const version = mode === 'bicycling' ? 'v4' : 'v3';
      const url = new URL(`https://restapi.amap.com/${version}/direction/${mode}`);
      url.searchParams.set('key', key);
      url.searchParams.set('origin', textArg(args, 'origin'));
      url.searchParams.set('destination', textArg(args, 'destination'));
      const payload = await fetchJson(url);
      if (payload.status !== '1' && payload.errcode !== 0) throw new Error(payload.info || payload.errmsg || '路线规划失败。');
      const route = payload.route || payload.data;
      return { mode, origin: args.origin, destination: args.destination, route };
    }

    if (name === 'track_delivery') {
      const customer = textArg(connectorConfig, 'kuaidi100Customer');
      const key = textArg(connectorConfig, 'kuaidi100Key');
      if (!customer || !key) throw new Error('请先在 Termux 配置 KUAIDI100_CUSTOMER 和 KUAIDI100_KEY。');
      const trackingNumber = textArg(args, 'trackingNumber');
      const company = textArg(args, 'company');
      if (!trackingNumber || !company) throw new Error('快递公司编码和运单号不能为空。');
      const param = JSON.stringify({ com: company, num: trackingNumber, phone: textArg(args, 'phone'), resultv2: '4', show: '0', order: 'desc' });
      const sign = createHash('md5').update(`${param}${key}${customer}`).digest('hex').toUpperCase();
      const form = new URLSearchParams({ customer, sign, param });
      const payload = await fetchJson('https://poll.kuaidi100.com/poll/query.do', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      });
      if (payload.result === false) throw new Error(payload.message || '快递查询失败。');
      return { company, trackingNumber, state: payload.state, status: payload.status, traces: payload.data || [], route: payload.routeInfo };
    }

    if (name === 'search_recipes') {
      const query = textArg(args, 'query');
      if (!query) throw new Error('菜谱搜索词不能为空。');
      const byIngredient = Boolean(args.byIngredient);
      const url = new URL(byIngredient ? 'https://www.themealdb.com/api/json/v1/1/filter.php' : 'https://www.themealdb.com/api/json/v1/1/search.php');
      url.searchParams.set(byIngredient ? 'i' : 's', query);
      const payload = await fetchJson(url);
      return { query, byIngredient, items: (payload.meals || []).slice(0, Math.round(numberArg(args, 'limit', 12, 1, 20))).map((meal) => ({ id: meal.idMeal, title: meal.strMeal, cover: meal.strMealThumb, category: meal.strCategory, area: meal.strArea })) };
    }

    if (name === 'get_recipe') {
      const recipeId = textArg(args, 'recipeId');
      const url = new URL('https://www.themealdb.com/api/json/v1/1/lookup.php');
      url.searchParams.set('i', recipeId);
      const meal = (await fetchJson(url)).meals?.[0];
      if (!meal) throw new Error('没有找到这个菜谱。');
      const ingredients = [];
      for (let index = 1; index <= 20; index += 1) {
        const ingredient = textArg(meal, `strIngredient${index}`);
        if (ingredient) ingredients.push({ ingredient, measure: textArg(meal, `strMeasure${index}`) });
      }
      return { id: meal.idMeal, title: meal.strMeal, category: meal.strCategory, area: meal.strArea, cover: meal.strMealThumb, instructions: meal.strInstructions, videoUrl: meal.strYoutube, sourceUrl: meal.strSource, ingredients, shoppingList: ingredients.map((entry) => `${entry.ingredient}${entry.measure ? ` · ${entry.measure}` : ''}`) };
    }

    if (name === 'add_price_track') {
      const url = (await validatePublicUrl(textArg(args, 'url'))).href;
      const title = textArg(args, 'title');
      if (!title) throw new Error('商品名称不能为空。');
      const targetPriceValue = Number(args.targetPrice);
      let currentPrice = Number(args.currentPrice);
      let finalUrl = url;
      if (!Number.isFinite(currentPrice)) {
        const page = await fetchPublicProductPage(url);
        const detected = extractPrice(page.text);
        currentPrice = detected.price;
        finalUrl = page.finalUrl;
      }
      const now = Date.now();
      const track = {
        id: randomUUID(),
        title: title.slice(0, 160),
        url,
        finalUrl,
        currency: textArg(args, 'currency', 'CNY').slice(0, 12),
        targetPrice: Number.isFinite(targetPriceValue) ? Math.max(0, targetPriceValue) : null,
        currentPrice: Math.max(0, currentPrice),
        createdAt: now,
        updatedAt: now,
        lastError: '',
        history: [{ price: Math.max(0, currentPrice), at: now, source: Number.isFinite(Number(args.currentPrice)) ? 'manual' : 'page' }]
      };
      await updateState((state) => state.priceTracks.push(track));
      return track;
    }

    if (name === 'record_price') {
      const price = Number(args.price);
      if (!Number.isFinite(price) || price < 0) throw new Error('价格无效。');
      return await recordTrackPrice(textArg(args, 'trackId'), price);
    }

    if (name === 'check_price_tracks') return await checkPriceTracks(args.notify !== false);
    if (name === 'list_price_tracks') return await readState();

    if (name === 'remove_price_track') {
      const trackId = textArg(args, 'trackId');
      return await updateState((state) => {
        const before = state.priceTracks.length;
        state.priceTracks = state.priceTracks.filter((entry) => entry.id !== trackId);
        if (state.priceTracks.length === before) throw new Error('没有找到这条价格追踪。');
        return { removed: true, trackId };
      });
    }

    if (name === 'notify_phone') {
      const title = textArg(args, 'title');
      const body = textArg(args, 'body');
      if (!title || !body) throw new Error('通知标题和正文不能为空。');
      return await sendTermuxNotification(title, body);
    }

    throw new Error(`未知内置工具：${name}`);
  }

  return { tools: [...tools, ...taobao.tools, ...sharedLinks.tools], call, checkPriceTracks };
}