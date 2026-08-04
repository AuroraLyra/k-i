import assert from 'node:assert/strict';
import type { FanficChapter } from '../src/types/domain.ts';
import { collectFanficChapterContinuity, resequenceFanficChapters } from '../src/utils/fanficChapter.ts';

function chapter(id: string, order: number, continuity: string[]): FanficChapter {
  return {
    id,
    bookId: 'book-1',
    order,
    title: `第 ${order} 章`,
    content: `正文 ${order}`,
    paragraphs: [{ id: `${id}-p1`, text: `正文 ${order}` }],
    summary: `摘要 ${order}`,
    continuity,
    hotspots: [],
    nextDirections: [],
    wordCount: 3,
    status: 'published',
    createdAt: order,
    updatedAt: order
  };
}

const first = chapter('chapter-1', 1, ['初次相遇', '共同目标']);
const second = chapter('chapter-2', 2, ['共同目标', '拿到钥匙']);
const third = chapter('chapter-3', 3, ['进入仓库']);

const remaining = resequenceFanficChapters([third, first], 9_999);
assert.deepEqual(remaining.map((entry) => ({ id: entry.id, order: entry.order })), [
  { id: 'chapter-1', order: 1 },
  { id: 'chapter-3', order: 2 }
]);
assert.equal(remaining[0], first);
assert.equal(remaining[1]?.updatedAt, 9_999);
assert.equal(third.order, 3);

assert.deepEqual(collectFanficChapterContinuity([third, second, first]), [
  '初次相遇',
  '共同目标',
  '拿到钥匙',
  '进入仓库'
]);
assert.deepEqual(collectFanficChapterContinuity([first, second, third], 2), ['拿到钥匙', '进入仓库']);

console.log('fanfic chapter regression: passed');