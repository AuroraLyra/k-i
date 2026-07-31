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

console.log('Link preview regression checks passed.');