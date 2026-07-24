import type { FastifyInstance } from 'fastify';

const trendCacheTtlMs = 6 * 60 * 60 * 1000;
const trendLexicon = [
  '古风世情', '历史争霸', '朝堂权谋', '宫斗宅斗', '种田经营', '年代重生', '民国故事', '都市脑洞',
  '职场成长', '创业商战', '青春校园', '体育竞技', '娱乐圈', '先婚后爱', '双向暗恋', '破镜重圆',
  '双强', '事业升级', '悬疑推理', '刑侦探案', '悬疑求生', '规则怪谈', '无限流', '末世基建',
  '仙侠修真', '玄幻升级', '都市异能', '科幻末世', '星际机甲', '西方奇幻', '轻喜剧', '治愈日常'
];

let cachedPayload: { keywords: string[]; fetchedAt: number; sourceLabel: string } | null = null;

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchSearchTrendText(query: string) {
  const url = new URL('https://www.bing.com/search');
  url.searchParams.set('format', 'rss');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',
      'User-Agent': 'BabyLink-Fanfic-Trend/1.0'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) return '';
  return decodeXmlEntities((await response.text()).replace(/<[^>]+>/g, ' '));
}

async function collectTrendKeywords() {
  const year = new Date().getFullYear();
  const queries = [
    `${year} 网络小说 热门分类 趋势`,
    `${year} 网络文学 热门标签 新书`,
    `${year} 都市 历史 玄幻 科幻 悬疑 言情 热门题材`
  ];
  const texts = await Promise.all(queries.map((query) => fetchSearchTrendText(query).catch(() => '')));
  const corpus = texts.join('\n');
  const scored = trendLexicon
    .map((keyword, order) => ({
      keyword,
      count: corpus.split(keyword).length - 1,
      order
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.order - right.order)
    .map((entry) => entry.keyword);
  if (!scored.length) throw new Error('公开搜索没有提取到可用题材标签。');
  return scored.slice(0, 14);
}

export async function registerFanficTrendRoutes(app: FastifyInstance) {
  app.get('/api/fanfic/trends', {
    config: { rateLimit: { max: 12, timeWindow: '1 minute' } }
  }, async (_request, reply) => {
    const now = Date.now();
    if (!cachedPayload || now - cachedPayload.fetchedAt >= trendCacheTtlMs) {
      const keywords = await collectTrendKeywords();
      cachedPayload = {
        keywords,
        fetchedAt: now,
        sourceLabel: '公开搜索趋势 · 仅提取通用题材标签'
      };
    }
    reply.header('Cache-Control', 'private, max-age=1800');
    return cachedPayload;
  });
}