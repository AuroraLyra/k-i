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
assert.equal(taobao.items[0]?.price, '19.90');
assert.equal(taobao.items[0]?.source, '户外生活店');
assert.equal(taobao.items[0]?.imageUrl, 'https://img.alicdn.com/demo-item.jpg');
assert.equal(taobao.items[0]?.url, 'https://s.click.taobao.com/demo-share');

const normalized = normalizeMcpResultAttachments([xiaohongshu, douyin, taobao]);
assert.equal(normalized.length, 3);
assert.equal(normalized[0]?.items.length, 1);
assert.equal(normalized[1]?.items.length, 1);
assert.equal(normalized[2]?.items.length, 1);

console.log('MCP result regression checks passed.');