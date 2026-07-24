<template>
  <section class="archive-shelf" aria-label="世界书书架">
    <article v-if="tabooBook" class="taboo-feature">
      <button type="button" class="taboo-feature-button" @click="openEditPage(tabooBook)">
        <span class="taboo-cover-frame">
          <img :src="resolveWorldBookCover(tabooBook)" :alt="`${tabooBook.title} 封面`" />
          <i aria-hidden="true"></i>
        </span>
        <span class="taboo-feature-copy">
          <span class="feature-label"><LockKeyhole :size="12" stroke-width="2.2" /> permanent issue</span>
          <strong>{{ tabooBook.title }}</strong>
          <span class="feature-rule"></span>
          <small>{{ tabooSummary }}</small>
          <span class="feature-foot">
            <span>{{ tabooBook.entries.length }} entries</span>
            <span>sitewide first</span>
            <ArrowUpRight :size="15" stroke-width="1.8" />
          </span>
        </span>
      </button>
    </article>

    <header v-if="regularBooks.length" class="collection-heading">
      <div>
        <p>Selected stories</p>
        <h2>收藏书目</h2>
      </div>
      <span>{{ regularBooks.length.toString().padStart(2, '0') }}</span>
    </header>

    <div v-if="regularBooks.length" class="book-gallery">
      <article
        v-for="(entry, index) in regularBooks"
        :key="entry.id"
        class="gallery-item"
        :class="{ muted: !entry.enabled, tilted: index % 3 === 1 }"
      >
        <button type="button" class="gallery-book" @click="openEditPage(entry)">
          <span class="gallery-cover">
            <img :src="resolveWorldBookCover(entry)" :alt="`${entry.title || '未命名世界书'} 封面`" />
            <span class="paper-tape" aria-hidden="true"></span>
            <span class="state-dot" :class="{ on: entry.enabled }"></span>
          </span>
          <span class="gallery-copy">
            <span>{{ scopeLabel(entry.scope) }}</span>
            <strong>{{ entry.title || '未命名世界书' }}</strong>
            <small>{{ entry.entries.length }} entries · {{ entry.enabled ? 'active' : 'paused' }}</small>
          </span>
        </button>
      </article>
    </div>

    <section v-if="!tabooBook && !regularBooks.length" class="archive-empty">
      <span><Feather :size="25" stroke-width="1.5" /></span>
      <p>Blank archive</p>
      <h2>从一条细小设定开始</h2>
      <small>人物习惯、地点气味、关系边界，都可以成为一本世界书。</small>
      <button type="button" @click="openCreatePage">写下第一条</button>
    </section>

    <section v-else-if="!regularBooks.length && !tabooBookVisible" class="archive-empty compact">
      <span><Feather :size="22" stroke-width="1.5" /></span>
      <p>Nothing here</p>
      <h2>这个分类还没有收藏</h2>
      <button type="button" @click="openCreatePage">新建世界书</button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowUpRight, Feather, LockKeyhole } from 'lucide-vue-next';
import type { WorldBookEntry } from '@/types/domain';
import { getWorldBookContentSummary, isTabooWorldBook, resolveWorldBookCover } from '@/utils/worldBook';

const props = defineProps<{
  books: WorldBookEntry[];
  createScope?: WorldBookEntry['scope'];
}>();

const router = useRouter();
const tabooBook = computed(() => props.books.find((entry) => isTabooWorldBook(entry)) ?? null);
const regularBooks = computed(() => props.books.filter((entry) => !isTabooWorldBook(entry)));
const tabooBookVisible = computed(() => Boolean(tabooBook.value));
const tabooSummary = computed(() => {
  const content = tabooBook.value ? getWorldBookContentSummary(tabooBook.value).replace(/\s+/g, ' ').trim() : '';
  return content ? content.slice(0, 72) : '内容保持空白时不会进入请求；写入后将成为所有生成任务最先读取的规则。';
});

function openCreatePage() {
  void router.push({ name: 'world-book-new', query: { scope: props.createScope ?? 'local' } });
}

function openEditPage(entry: WorldBookEntry) {
  void router.push({ name: 'world-book-edit', params: { id: entry.id } });
}

function scopeLabel(scope: WorldBookEntry['scope']) {
  return {
    'global-online': 'online collection',
    'global-offline': 'offline collection',
    local: 'private collection'
  }[scope];
}

defineExpose({ openCreateModal: openCreatePage });
</script>

<style scoped>
.archive-shelf {
  display: grid;
  gap: 26px;
  min-width: 0;
}

button {
  font: inherit;
}

.taboo-feature {
  position: relative;
  min-width: 0;
}

.taboo-feature::before {
  content: 'SPECIAL\AISSUE';
  position: absolute;
  top: -11px;
  right: 18px;
  z-index: 3;
  padding: 7px 11px;
  border: 1px solid rgba(255, 255, 255, 0.34);
  background: #d6b4aa;
  color: #fffaf6;
  font-size: 7px;
  font-weight: 850;
  line-height: 1.05;
  letter-spacing: 0.16em;
  text-align: center;
  white-space: pre;
  transform: rotate(4deg);
  box-shadow: 0 8px 18px rgba(70, 49, 50, 0.15);
}

.taboo-feature-button {
  position: relative;
  display: grid;
  grid-template-columns: 108px minmax(0, 1fr);
  gap: 18px;
  align-items: center;
  width: 100%;
  min-height: 190px;
  padding: 18px;
  overflow: hidden;
  border: 0;
  border-radius: 9px 34px 9px 34px;
  background:
    radial-gradient(circle at 92% 8%, rgba(241, 214, 205, 0.23), transparent 34%),
    linear-gradient(132deg, #3e3035 0%, #644950 55%, #8d6c72 100%);
  color: #fff9f5;
  text-align: left;
  box-shadow: 0 24px 46px rgba(71, 49, 55, 0.2);
}

.taboo-feature-button::after {
  content: '';
  position: absolute;
  right: -32px;
  bottom: -54px;
  width: 160px;
  height: 160px;
  border: 1px solid rgba(255, 255, 255, 0.13);
  border-radius: 50%;
  box-shadow: 0 0 0 24px rgba(255, 255, 255, 0.035), 0 0 0 52px rgba(255, 255, 255, 0.025);
}

.taboo-feature-button:active {
  transform: scale(0.99);
}

.taboo-cover-frame {
  position: relative;
  z-index: 1;
  display: block;
  width: 108px;
  height: 154px;
  transform: rotate(-2deg);
}

.taboo-cover-frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 3px 14px 14px 3px;
  box-shadow: 9px 14px 24px rgba(30, 20, 23, 0.3);
}

.taboo-cover-frame i {
  position: absolute;
  inset: 0 auto 0 0;
  width: 10px;
  background: linear-gradient(90deg, rgba(13, 8, 10, 0.28), transparent);
}

.taboo-feature-copy {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 8px;
  min-width: 0;
}

.feature-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #e4c8c2;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.taboo-feature-copy strong {
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(23px, 6vw, 31px);
  font-weight: 500;
  letter-spacing: 0.08em;
}

.feature-rule {
  width: 34px;
  height: 1px;
  background: rgba(255, 255, 255, 0.55);
}

.taboo-feature-copy > small {
  display: -webkit-box;
  overflow: hidden;
  color: rgba(255, 248, 244, 0.72);
  font-size: 10px;
  line-height: 1.7;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.feature-foot {
  display: flex;
  align-items: center;
  gap: 7px;
  padding-top: 2px;
  color: rgba(255, 248, 244, 0.58);
  font-size: 7px;
  font-weight: 750;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}

.feature-foot span + span::before {
  content: '·';
  margin-right: 7px;
}

.feature-foot svg {
  margin-left: auto;
}

.collection-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 0 3px;
}

.collection-heading > div {
  display: grid;
  gap: 3px;
}

.collection-heading p,
.collection-heading h2 {
  margin: 0;
}

.collection-heading p {
  color: #b1978c;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.collection-heading h2 {
  color: #302925;
  font-family: Georgia, "Songti SC", serif;
  font-size: 25px;
  font-weight: 500;
  letter-spacing: -0.03em;
}

.collection-heading > span {
  color: #c3aea4;
  font-family: Georgia, serif;
  font-size: 29px;
  font-style: italic;
  line-height: 1;
}

.book-gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px 16px;
  align-items: start;
}

.gallery-item {
  min-width: 0;
}

.gallery-item.muted {
  opacity: 0.55;
  filter: grayscale(0.28);
}

.gallery-book {
  display: grid;
  gap: 12px;
  width: 100%;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #302925;
  text-align: left;
}

.gallery-book:active .gallery-cover {
  transform: translateY(2px) rotate(-0.5deg);
}

.gallery-cover {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 0.73;
  padding: 7px;
  background: #fffdf9;
  box-shadow: 0 16px 30px rgba(77, 61, 53, 0.12);
  transition: transform 0.18s ease;
}

.gallery-item.tilted .gallery-cover {
  transform: rotate(1.2deg);
}

.gallery-cover img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.paper-tape {
  position: absolute;
  top: -8px;
  left: 50%;
  width: 44px;
  height: 17px;
  background: rgba(218, 202, 186, 0.72);
  transform: translateX(-50%) rotate(-2deg);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
}

.state-dot {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 8px;
  height: 8px;
  border: 2px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
  background: #a79c96;
  box-shadow: 0 2px 8px rgba(53, 42, 37, 0.2);
}

.state-dot.on {
  background: #8da184;
}

.gallery-copy {
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 0 3px;
}

.gallery-copy > span {
  color: #b0988e;
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.gallery-copy strong {
  overflow-wrap: anywhere;
  font-family: Georgia, "Songti SC", serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.gallery-copy small {
  color: #9d9089;
  font-size: 8px;
  letter-spacing: 0.04em;
}

.archive-empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 310px;
  padding: 44px 26px;
  border: 1px solid rgba(115, 93, 83, 0.09);
  border-radius: 70px 18px 70px 18px;
  background:
    radial-gradient(circle at 50% 18%, rgba(221, 202, 193, 0.25), transparent 31%),
    rgba(255, 253, 249, 0.62);
  color: #948780;
  text-align: center;
}

.archive-empty.compact {
  min-height: 230px;
  padding-block: 34px;
}

.archive-empty > span {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: #ede2dc;
  color: #826b62;
}

.archive-empty p,
.archive-empty h2,
.archive-empty small {
  margin: 0;
}

.archive-empty p {
  color: #b1978c;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.archive-empty h2 {
  color: #3d342f;
  font-family: Georgia, "Songti SC", serif;
  font-size: 21px;
  font-weight: 500;
}

.archive-empty small {
  max-width: 270px;
  font-size: 10px;
  line-height: 1.7;
}

.archive-empty button {
  min-height: 42px;
  margin-top: 10px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  background: #554640;
  color: #fffaf6;
  font-size: 10px;
  font-weight: 800;
  box-shadow: 0 12px 24px rgba(85, 70, 64, 0.16);
}

@media (max-width: 350px) {
  .taboo-feature-button {
    grid-template-columns: 90px minmax(0, 1fr);
    gap: 14px;
    padding: 15px;
  }

  .taboo-cover-frame {
    width: 90px;
    height: 132px;
  }

  .feature-foot span:nth-child(2) {
    display: none;
  }

  .book-gallery {
    gap-inline: 12px;
  }
}

@media (min-width: 680px) {
  .book-gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>