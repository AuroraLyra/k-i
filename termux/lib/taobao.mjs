import { createHash, randomUUID } from 'node:crypto';

const objectSchema = (properties, required = []) => ({ type: 'object', properties, required, additionalProperties: false });
const stringProperty = (description) => ({ type: 'string', description });
const numberProperty = (description) => ({ type: 'number', description });
const arrayProperty = (description) => ({ type: 'array', description, items: { type: 'string' } });

export const taobaoTools = [
  {
    name: 'search_taobao_products',
    title: '淘宝真实商品搜索',
    description: '通过用户自己的淘宝开放平台/TBK 授权搜索商品，返回价格、券后价、销量、店铺、原始链接和联盟链接。凭据只保存在 Termux。',
    inputSchema: objectSchema({ query: stringProperty('商品关键词'), page: numberProperty('页码，默认 1'), limit: numberProperty('结果数量，1-20'), minPrice: numberProperty('最低价格'), maxPrice: numberProperty('最高价格'), sort: stringProperty('排序，例如 total_sales_des、price_asc、price_des') }, ['query']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'get_taobao_product',
    title: '读取淘宝商品详情',
    description: '通过淘宝开放平台读取指定商品 ID 的公开详情，并生成原始链接。',
    inputSchema: objectSchema({ itemId: stringProperty('淘宝商品 ID') }, ['itemId']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'read_taobao_share',
    title: '读取淘宝分享链接',
    description: '解析淘宝、天猫或 tb.cn 分享链接中的商品 ID，再读取官方商品数据。',
    inputSchema: objectSchema({ url: stringProperty('淘宝、天猫或 tb.cn 的 HTTPS 分享链接') }, ['url']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'create_taobao_affiliate_link',
    title: '生成淘宝联盟链接',
    description: '使用用户自己的淘宝联盟 PID/Session 为商品生成优惠券或联盟推广链接；不会下单。',
    inputSchema: objectSchema({ itemId: stringProperty('淘宝商品 ID') }, ['itemId']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'compare_taobao_products',
    title: '对比淘宝商品',
    description: '按商品 ID 或搜索词读取真实商品并对比券后价、优惠、销量和店铺。',
    inputSchema: objectSchema({ itemIds: arrayProperty('要对比的 2-8 个淘宝商品 ID'), query: stringProperty('未提供商品 ID 时使用的搜索词'), limit: numberProperty('搜索对比数量，2-8') }),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'recommend_taobao_products',
    title: '按预算推荐淘宝商品',
    description: '使用真实搜索结果，在预算内综合券后价、销量和优惠筛选候选商品。',
    inputSchema: objectSchema({ query: stringProperty('商品需求关键词'), budget: numberProperty('最高预算，人民币'), limit: numberProperty('推荐数量，1-8') }, ['query', 'budget']),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'add_shopping_list_item',
    title: '加入 BabyLink 购物清单',
    description: '把商品与预算备注保存在当前手机的 Termux 本地购物清单；不会收藏到淘宝或自动下单。',
    inputSchema: objectSchema({ itemId: stringProperty('淘宝商品 ID'), title: stringProperty('商品名称'), url: stringProperty('原始或联盟链接'), price: numberProperty('当前价格'), targetPrice: numberProperty('预算或目标价'), note: stringProperty('角色建议或备注') }, ['title']),
    annotations: { readOnlyHint: false, destructiveHint: false }
  },
  {
    name: 'list_shopping_list',
    title: '读取 BabyLink 购物清单',
    description: '读取保存在当前手机 Termux 中的购物清单。',
    inputSchema: objectSchema({}),
    annotations: { readOnlyHint: true, destructiveHint: false }
  },
  {
    name: 'remove_shopping_list_item',
    title: '移除购物清单条目',
    description: '从当前手机的 Termux 本地购物清单移除一项。',
    inputSchema: objectSchema({ listItemId: stringProperty('购物清单条目 ID') }, ['listItemId']),
    annotations: { readOnlyHint: false, destructiveHint: true }
  }
];

function text(value) {
  return String(value ?? '').trim();
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizedUrl(value) {
  const raw = text(value).replace(/^\/\//, 'https://');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

function shanghaiTimestamp() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function topSignature(parameters, secret) {
  const canonical = Object.keys(parameters).sort().map((key) => `${key}${parameters[key]}`).join('');
  return createHash('md5').update(`${secret}${canonical}${secret}`, 'utf8').digest('hex').toUpperCase();
}

async function readResponse(response) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 4 * 1024 * 1024) throw new Error('淘宝接口响应超过 4 MB。');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error('淘宝接口响应超过 4 MB。');
  return new TextDecoder().decode(bytes);
}

function findRecords(value, keys = new Set(['map_data', 'results', 'n_tbk_item', 'ntbk_item', 'items'])) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value;
  for (const [key, nested] of Object.entries(value)) {
    if (keys.has(key) && Array.isArray(nested)) return nested;
    const records = findRecords(nested, keys);
    if (records.length) return records;
  }
  return [];
}

function firstRecord(value) {
  const records = findRecords(value);
  if (records.length) return records[0];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).some((key) => ['item_id', 'num_iid', 'coupon_click_url', 'coupon_info', 'item_url'].includes(key))) return value;
  for (const nested of Object.values(value)) {
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const record = firstRecord(nested);
      if (record) return record;
    }
  }
  return null;
}

function allowedTaobaoHost(hostname) {
  const host = hostname.toLowerCase();
  return host === 'tb.cn' || host.endsWith('.tb.cn') || host === 'taobao.com' || host.endsWith('.taobao.com') || host === 'tmall.com' || host.endsWith('.tmall.com');
}

async function resolveTaobaoShare(rawUrl) {
  let target = new URL(rawUrl);
  if (target.protocol !== 'https:' || !allowedTaobaoHost(target.hostname) || target.username || target.password) throw new Error('只允许淘宝、天猫或 tb.cn 的 HTTPS 分享链接。');
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    const directId = target.searchParams.get('id') || target.pathname.match(/(?:item|i)(?:\/|=)(\d{5,30})/i)?.[1] || '';
    if (directId) return { url: target.href, itemId: directId };
    const response = await fetch(target, {
      redirect: 'manual',
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/124 Mobile Safari/537.36'
      }
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('淘宝短链接跳转缺少目标地址。');
      target = new URL(location, target);
      if (target.protocol !== 'https:' || !allowedTaobaoHost(target.hostname) || target.username || target.password) throw new Error('淘宝短链接跳转到了非淘宝域名。');
      continue;
    }
    const declaredLength = Number(response.headers.get('content-length') || 0);
    if (Number.isFinite(declaredLength) && declaredLength > 1024 * 1024) throw new Error('淘宝分享页内容过大。');
    const html = (await response.text()).slice(0, 1024 * 1024);
    const pageId = html.match(/[?&](?:id|itemId|item_id)=(\d{5,30})/i)?.[1]
      || html.match(/"(?:itemId|item_id|numIid|num_iid)"\s*:\s*"?(\d{5,30})/i)?.[1]
      || '';
    if (pageId) return { url: target.href, itemId: pageId };
    throw new Error(`淘宝分享页没有识别到商品 ID（HTTP ${response.status}）。`);
  }
  throw new Error('淘宝短链接跳转次数过多。');
}

function itemIdentifier(item) {
  return text(item.item_id ?? item.num_iid ?? item.itemId ?? item.id);
}

function normalizeTaobaoItem(item) {
  const itemId = itemIdentifier(item);
  const price = numberValue(item.zk_final_price ?? item.price ?? item.reserve_price ?? item.final_price);
  const couponAmount = numberValue(item.coupon_amount ?? item.couponAmount ?? item.coupon_discount);
  const promotionPrice = numberValue(item.final_promotion_price ?? item.finalPromotionPrice ?? item.quanhou_price);
  const finalPrice = promotionPrice ?? (price !== null && couponAmount !== null ? Math.max(0, price - couponAmount) : price);
  const originalUrl = normalizedUrl(item.item_url ?? item.itemUrl) || (itemId ? `https://item.taobao.com/item.htm?id=${encodeURIComponent(itemId)}` : '');
  const affiliateUrl = normalizedUrl(item.coupon_share_url ?? item.couponShareUrl ?? item.click_url ?? item.clickUrl);
  return {
    itemId,
    title: text(item.title ?? item.short_title ?? item.material_name ?? item.name),
    description: text(item.item_description ?? item.usable_shop_name ?? item.cat_name),
    price,
    finalPrice,
    couponAmount,
    couponInfo: text(item.coupon_info ?? item.coupon_start_fee),
    couponStartAt: text(item.coupon_start_time),
    couponEndAt: text(item.coupon_end_time),
    sales: numberValue(item.volume ?? item.month_sales ?? item.sales),
    shopName: text(item.shop_title ?? item.shop_name ?? item.nick ?? item.seller_name),
    sellerId: text(item.seller_id),
    imageUrl: normalizedUrl(item.pict_url ?? item.pic_url ?? item.white_image),
    originalUrl,
    affiliateUrl,
    url: affiliateUrl || originalUrl,
    commissionRate: numberValue(item.commission_rate),
    source: '淘宝开放平台'
  };
}

function requireConfiguration(config) {
  const appKey = text(config.appKey);
  const appSecret = text(config.appSecret);
  const adzoneId = text(config.adzoneId) || text(config.pid).split('_').filter(Boolean).at(-1) || '';
  if (!appKey || !appSecret || !adzoneId) {
    throw new Error('请先在 Termux 运行 babylink-mcp setup，配置淘宝开放平台 App Key、App Secret 和淘宝联盟 PID/adzone_id。');
  }
  return { appKey, appSecret, adzoneId };
}

export function createTaobaoConnector(config, state) {
  const connectorConfig = config || {};

  async function topCall(method, apiParameters = {}) {
    const { appKey, appSecret } = requireConfiguration(connectorConfig);
    const common = {
      method,
      app_key: appKey,
      timestamp: shanghaiTimestamp(),
      format: 'json',
      v: '2.0',
      sign_method: 'md5',
      simplify: 'true',
      ...(text(connectorConfig.session) ? { session: text(connectorConfig.session) } : {})
    };
    const parameters = Object.fromEntries(Object.entries({ ...common, ...apiParameters })
      .filter(([, value]) => value !== undefined && value !== null && text(value) !== '')
      .map(([key, value]) => [key, String(value)]));
    parameters.sign = topSignature(parameters, appSecret);
    const response = await fetch(text(connectorConfig.apiUrl) || 'https://eco.taobao.com/router/rest', {
      method: 'POST',
      redirect: 'error',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'BabyLink-Termux-Taobao/0.2'
      },
      body: new URLSearchParams(parameters).toString()
    });
    const body = await readResponse(response);
    if (!response.ok) throw new Error(`淘宝开放平台返回 HTTP ${response.status}。`);
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error('淘宝开放平台没有返回有效 JSON。');
    }
    const platformError = payload.error_response;
    if (platformError) throw new Error(`淘宝开放平台：${platformError.sub_msg || platformError.msg || platformError.code || '调用失败'}`);
    return payload;
  }

  async function search(args) {
    const { adzoneId } = requireConfiguration(connectorConfig);
    const query = text(args.query);
    if (!query) throw new Error('淘宝搜索词不能为空。');
    const limit = Math.max(1, Math.min(20, Math.round(Number(args.limit) || 12)));
    const parameters = {
      adzone_id: adzoneId,
      q: query,
      page_no: Math.max(1, Math.round(Number(args.page) || 1)),
      page_size: limit,
      platform: 2,
      ...(numberValue(args.minPrice) !== null ? { start_price: numberValue(args.minPrice) } : {}),
      ...(numberValue(args.maxPrice) !== null ? { end_price: numberValue(args.maxPrice) } : {}),
      ...(text(args.sort) ? { sort: text(args.sort) } : {})
    };
    const preferredMethod = text(connectorConfig.materialSearchMethod) || 'taobao.tbk.dg.material.optional.upgrade';
    let payload;
    try {
      payload = await topCall(preferredMethod, parameters);
    } catch (error) {
      if (preferredMethod !== 'taobao.tbk.dg.material.optional.upgrade') throw error;
      payload = await topCall('taobao.tbk.dg.material.optional', parameters);
    }
    return {
      query,
      page: parameters.page_no,
      products: findRecords(payload).slice(0, limit).map(normalizeTaobaoItem).filter((item) => item.itemId && item.title)
    };
  }

  async function getProduct(itemId) {
    const normalizedId = text(itemId);
    if (!/^\d{5,30}$/.test(normalizedId)) throw new Error('淘宝商品 ID 无效。');
    const payload = await topCall('taobao.tbk.item.info.get', {
      num_iids: normalizedId,
      platform: 2,
      ip: '127.0.0.1'
    });
    const record = firstRecord(payload);
    if (!record) throw new Error('淘宝开放平台没有返回这个商品。');
    return normalizeTaobaoItem(record);
  }

  async function affiliateLink(itemId) {
    const { adzoneId } = requireConfiguration(connectorConfig);
    const normalizedId = text(itemId);
    if (!/^\d{5,30}$/.test(normalizedId)) throw new Error('淘宝商品 ID 无效。');
    const payload = await topCall('taobao.tbk.privilege.get', {
      item_id: normalizedId,
      adzone_id: adzoneId,
      platform: 2,
      ...(text(connectorConfig.relationId) ? { relation_id: text(connectorConfig.relationId) } : {})
    });
    const record = firstRecord(payload) || {};
    const originalUrl = `https://item.taobao.com/item.htm?id=${encodeURIComponent(normalizedId)}`;
    const couponUrl = normalizedUrl(record.coupon_click_url ?? record.couponClickUrl);
    const affiliateUrl = couponUrl || normalizedUrl(record.item_url ?? record.click_url);
    return {
      itemId: normalizedId,
      originalUrl,
      affiliateUrl,
      url: affiliateUrl || originalUrl,
      couponInfo: text(record.coupon_info),
      source: '淘宝联盟'
    };
  }

  async function compare(args) {
    const ids = Array.isArray(args.itemIds) ? [...new Set(args.itemIds.map(text).filter((id) => /^\d{5,30}$/.test(id)))].slice(0, 8) : [];
    const products = ids.length
      ? (await Promise.all(ids.map((id) => getProduct(id).catch((error) => ({ itemId: id, title: `商品 ${id}`, error: error.message }))))
      ).filter(Boolean)
      : (await search({ query: args.query, limit: Math.max(2, Math.min(8, Math.round(Number(args.limit) || 5))) })).products;
    const ranked = products.map((product) => ({
      ...product,
      comparisonPrice: numberValue(product.finalPrice) ?? numberValue(product.price),
      valueScore: Math.round(((Math.log10(Math.max(0, Number(product.sales) || 0) + 10) * 25) + (Number(product.couponAmount) || 0)) * 10) / 10
    })).sort((left, right) => (left.comparisonPrice ?? Number.MAX_SAFE_INTEGER) - (right.comparisonPrice ?? Number.MAX_SAFE_INTEGER));
    return { products: ranked, cheapestItemId: ranked.find((item) => item.comparisonPrice !== null)?.itemId || '' };
  }

  async function recommend(args) {
    const budget = Number(args.budget);
    if (!Number.isFinite(budget) || budget <= 0) throw new Error('预算必须大于 0。');
    const result = await search({ query: args.query, maxPrice: budget, sort: 'total_sales_des', limit: 20 });
    const limit = Math.max(1, Math.min(8, Math.round(Number(args.limit) || 5)));
    const products = result.products
      .filter((item) => (numberValue(item.finalPrice) ?? numberValue(item.price) ?? Number.MAX_SAFE_INTEGER) <= budget)
      .map((item) => ({
        ...item,
        budget,
        budgetRemaining: Math.round((budget - (numberValue(item.finalPrice) ?? numberValue(item.price) ?? budget)) * 100) / 100,
        recommendationReason: `${item.couponAmount ? `优惠 ¥${item.couponAmount}；` : ''}${item.sales ? `月销量 ${item.sales}；` : ''}券后价在预算内`
      }))
      .sort((left, right) => (Number(right.sales) || 0) - (Number(left.sales) || 0))
      .slice(0, limit);
    return { query: result.query, budget, products, note: products.length ? '推荐依据为当前官方接口返回的价格、优惠和销量，购买前仍应在淘宝确认实时库存与到手价。' : '当前搜索结果中没有预算内商品。' };
  }

  async function call(name, args = {}) {
    if (name === 'search_taobao_products') return await search(args);
    if (name === 'get_taobao_product') return await getProduct(args.itemId);
    if (name === 'create_taobao_affiliate_link') return await affiliateLink(args.itemId);
    if (name === 'read_taobao_share') {
      const resolved = await resolveTaobaoShare(text(args.url));
      const product = await getProduct(resolved.itemId);
      const promotion = await affiliateLink(resolved.itemId).catch(() => null);
      return { ...product, resolvedUrl: resolved.url, ...(promotion ? { affiliateUrl: promotion.affiliateUrl, url: promotion.url } : {}) };
    }
    if (name === 'compare_taobao_products') return await compare(args);
    if (name === 'recommend_taobao_products') return await recommend(args);
    if (name === 'add_shopping_list_item') {
      const now = Date.now();
      const item = {
        id: randomUUID(),
        itemId: text(args.itemId),
        title: text(args.title).slice(0, 180),
        url: normalizedUrl(args.url),
        price: numberValue(args.price),
        targetPrice: numberValue(args.targetPrice),
        note: text(args.note).slice(0, 500),
        createdAt: now,
        updatedAt: now
      };
      if (!item.title) throw new Error('购物清单商品名称不能为空。');
      await state.update((data) => data.shoppingList.push(item));
      return item;
    }
    if (name === 'list_shopping_list') return { shoppingList: (await state.read()).shoppingList };
    if (name === 'remove_shopping_list_item') {
      const listItemId = text(args.listItemId);
      return await state.update((data) => {
        const before = data.shoppingList.length;
        data.shoppingList = data.shoppingList.filter((item) => item.id !== listItemId);
        if (data.shoppingList.length === before) throw new Error('没有找到这条购物清单。');
        return { removed: true, listItemId };
      });
    }
    throw new Error(`未知淘宝工具：${name}`);
  }

  return { tools: taobaoTools, call };
}