import assert from 'node:assert/strict';
import { createMcpResultAttachment, normalizeMcpResultAttachments } from '../src/utils/mcpResults';

const xiaohongshu = createMcpResultAttachment({
  serverId: 'xhs-search',
  serverName: '小红书内容搜索 MCP',
  toolName: 'search_feeds'
}, {
  content: [{
    type: 'text',
    text: JSON.stringify({
      feeds: [{
        id: '65f1a2b3c4d5e6f7a8b9c0d1',
        xsecToken: 'signed/token+value',
        noteCard: {
          displayTitle: '上海周末散步路线',
          user: { nickname: '小林同学' },
          cover: { urlDefault: 'https://ci.xiaohongshu.com/demo-cover.webp' }
        }
      }]
    })
  }]
});

assert.ok(xiaohongshu);
assert.equal(xiaohongshu.items[0]?.title, '上海周末散步路线');
assert.equal(xiaohongshu.items[0]?.source, '小林同学');
assert.equal(xiaohongshu.items[0]?.imageUrl, 'https://ci.xiaohongshu.com/demo-cover.webp');
assert.equal(xiaohongshu.items[0]?.url, 'https://www.xiaohongshu.com/explore/65f1a2b3c4d5e6f7a8b9c0d1?xsec_source=pc_search&xsec_token=signed%2Ftoken%2Bvalue');

const douyin = createMcpResultAttachment({
  serverId: 'douyin-search',
  serverName: '抖音视频搜索 MCP',
  toolName: 'search_videos'
}, {
  structuredContent: {
    data: [{
      aweme_info: {
        aweme_id: '7421234567890123456',
        desc: '海边日落延时摄影',
        author: { nickname: '风景记录员' },
        video: { cover: { url_list: ['https://p3-sign.douyinpic.com/demo-cover.jpeg'] } }
      }
    }]
  }
});

assert.ok(douyin);
assert.equal(douyin.items[0]?.title, '海边日落延时摄影');
assert.equal(douyin.items[0]?.source, '风景记录员');
assert.equal(douyin.items[0]?.imageUrl, 'https://p3-sign.douyinpic.com/demo-cover.jpeg');
assert.equal(douyin.items[0]?.url, 'https://www.douyin.com/video/7421234567890123456');

const taobao = createMcpResultAttachment({
  serverId: 'taobao-search',
  serverName: '淘宝商品搜索 MCP',
  toolName: 'taobao_material_search'
}, {
  structuredContent: {
    data: {
      result_list: {
        map_data: [{
          num_iid: '812345678901',
          dtitle: '旅行便携折叠水杯',
          zk_final_price: '19.90',
          pict_url: '//img.alicdn.com/demo-item.jpg',
          click_url: '//s.click.taobao.com/demo-share',
          nick: '户外生活店'
        }]
      }
    }
  }
});

assert.ok(taobao);
assert.equal(taobao.items[0]?.title, '旅行便携折叠水杯');
assert.equal(taobao.items[0]?.price, '¥19.90');
assert.equal(taobao.items[0]?.source, '户外生活店');
assert.equal(taobao.items[0]?.imageUrl, 'https://img.alicdn.com/demo-item.jpg');
assert.equal(taobao.items[0]?.url, 'https://s.click.taobao.com/demo-share');

const normalized = normalizeMcpResultAttachments([xiaohongshu, douyin, taobao]);
assert.equal(normalized.length, 3);
assert.equal(normalized[0]?.items.length, 1);
assert.equal(normalized[1]?.items.length, 1);
assert.equal(normalized[2]?.items.length, 1);

const music = createMcpResultAttachment({
  serverId: 'termux',
  serverName: 'BabyLink Termux 本机网关',
  toolName: 'search_music'
}, {
  structuredContent: {
    items: [{
      id: '123456',
      title: '晚风测试曲',
      artist: '测试歌手',
      album: '夜色',
      url: 'https://music.apple.com/cn/album/example/123456',
      previewUrl: 'https://audio-ssl.itunes.apple.com/example.m4a',
      cover: 'https://is1-ssl.mzstatic.com/example.jpg'
    }]
  }
});

assert.ok(music);
assert.equal(music.items[0]?.title, '晚风测试曲');
assert.equal(music.items[0]?.source, '测试歌手');
assert.equal(music.items[0]?.imageUrl, 'https://is1-ssl.mzstatic.com/example.jpg');
assert.equal(music.items[0]?.url, 'https://music.apple.com/cn/album/example/123456');

const delivery = createMcpResultAttachment({
  serverId: 'termux',
  serverName: 'BabyLink Termux 本机网关',
  toolName: 'track_delivery'
}, {
  structuredContent: {
    traces: [{ time: '2026-04-01 12:30:00', context: '快件已到达配送站' }]
  }
});

assert.ok(delivery);
assert.equal(delivery.items[0]?.title, '快件已到达配送站');

const priceTracks = createMcpResultAttachment({
  serverId: 'termux',
  serverName: 'BabyLink Termux 本机网关',
  toolName: 'list_price_tracks'
}, {
  structuredContent: {
    priceTracks: [{ title: '旅行背包', url: 'https://shop.example.com/bag', currentPrice: 199, currency: 'CNY' }]
  }
});

assert.ok(priceTracks);
assert.equal(priceTracks.items[0]?.kind, 'product');
assert.equal(priceTracks.items[0]?.price, '¥199');

const taobaoNative = createMcpResultAttachment({
  serverId: 'termux',
  serverName: 'BabyLink Termux 本机网关',
  toolName: 'search_taobao_products'
}, {
  structuredContent: {
    products: [{
      itemId: '812345678901',
      title: '旅行便携折叠水杯',
      price: 29.9,
      finalPrice: 19.9,
      couponAmount: 10,
      sales: 12345,
      shopName: '户外生活店',
      originalUrl: 'https://item.taobao.com/item.htm?id=812345678901',
      affiliateUrl: 'https://s.click.taobao.com/demo-share',
      imageUrls: ['https://img.alicdn.com/demo-item.jpg', 'https://img.alicdn.com/demo-item-2.jpg']
    }]
  }
});

assert.ok(taobaoNative);
assert.equal(taobaoNative.items[0]?.title, '旅行便携折叠水杯');
assert.equal(taobaoNative.items[0]?.price, '¥19.9');
assert.equal(taobaoNative.items[0]?.source, '户外生活店');
assert.equal(taobaoNative.items[0]?.url, 'https://s.click.taobao.com/demo-share');
assert.deepEqual(taobaoNative.items[0]?.imageUrls, ['https://img.alicdn.com/demo-item.jpg', 'https://img.alicdn.com/demo-item-2.jpg']);

const shoppingList = createMcpResultAttachment({
  serverId: 'termux',
  serverName: 'BabyLink Termux 本机网关',
  toolName: 'list_shopping_list'
}, {
  structuredContent: {
    shoppingList: [{ title: '旅行水杯', quantity: 2, budget: 50, note: '出发前购买' }]
  }
});

assert.ok(shoppingList);
assert.equal(shoppingList.items[0]?.title, '旅行水杯');

console.log('MCP result regression checks passed.');