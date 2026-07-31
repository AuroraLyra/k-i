import assert from 'node:assert/strict';
import { parseLinkPreviewHtml } from '../server/src/linkPreview';
import { createChatLinkPreview, extractFirstChatLink } from '../src/services/linkPreview';

const sourceText = '看看这个：https://www.xiaohongshu.com/explore/demo-note?xsec_token=abc。';
assert.equal(extractFirstChatLink(sourceText), 'https://www.xiaohongshu.com/explore/demo-note?xsec_token=abc');

const fallback = createChatLinkPreview(sourceText);
assert.ok(fallback);
assert.equal(fallback.platform, 'xiaohongshu');
assert.equal(fallback.siteName, '小红书');

const metadata = parseLinkPreviewHtml(`
  <!doctype html>
  <html>
    <head>
      <meta content="城市散步路线 &amp; 咖啡店" property="og:title">
      <meta name="description" content="周末可以直接照着走的路线。">
      <meta property="og:site_name" content="小红书">
      <meta property="og:image" content="/images/cover.webp">
      <link href="https://www.xiaohongshu.com/explore/real-note" rel="canonical">
      <title>备用标题</title>
    </head>
  </html>
`, new URL('https://www.xiaohongshu.com/explore/demo-note'));

assert.equal(metadata.platform, 'xiaohongshu');
assert.equal(metadata.title, '城市散步路线 & 咖啡店');
assert.equal(metadata.description, '周末可以直接照着走的路线。');
assert.equal(metadata.imageUrl, 'https://www.xiaohongshu.com/images/cover.webp');
assert.equal(metadata.canonicalUrl, 'https://www.xiaohongshu.com/explore/real-note');

const unsafeMetadata = parseLinkPreviewHtml('<meta property="og:image" content="javascript:alert(1)"><title>普通网页</title>', new URL('https://example.com/page'));
assert.equal(unsafeMetadata.imageUrl, '');
assert.equal(unsafeMetadata.title, '普通网页');

const pinduoduoText = '拼多多分享：https://mobile.yangkeduo.com/goods.html?goods_id=123456';
const pinduoduoFallback = createChatLinkPreview(pinduoduoText);
assert.ok(pinduoduoFallback);
assert.equal(pinduoduoFallback.platform, 'pinduoduo');
assert.equal(pinduoduoFallback.siteName, '拼多多');

const deepMetadata = parseLinkPreviewHtml(`
  <html>
    <head>
      <meta property="og:title" content="可折叠旅行水杯">
      <meta property="og:image" content="https://img.example.com/cover.jpg">
    </head>
    <body>
      <article><p>轻便耐用，适合通勤和旅行。</p><img src="/gallery-1.jpg"><img data-src="https://img.example.com/gallery-2.jpg"></article>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Product","image":["https://img.example.com/product.jpg"],"review":{"@type":"Review","author":{"name":"小明"},"reviewBody":"杯盖密封很好","datePublished":"2026-04-01","reviewRating":{"ratingValue":5}}}
      </script>
    </body>
  </html>
`, new URL('https://mobile.yangkeduo.com/goods.html?goods_id=123456'));

assert.equal(deepMetadata.platform, 'pinduoduo');
assert.equal(deepMetadata.content, '轻便耐用，适合通勤和旅行。');
assert.deepEqual(deepMetadata.imageUrls, [
  'https://img.example.com/cover.jpg',
  'https://mobile.yangkeduo.com/gallery-1.jpg',
  'https://img.example.com/gallery-2.jpg',
  'https://img.example.com/product.jpg'
]);
assert.deepEqual(deepMetadata.comments, [{ author: '小明', message: '杯盖密封很好', createdAt: '2026-04-01', rating: 5 }]);

console.log('Link preview regression checks passed.');