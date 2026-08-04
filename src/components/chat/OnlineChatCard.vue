<template>
  <section
    class="online-chat-card"
    :class="[`online-chat-card--${kind}`, `online-chat-card--${cardTone}`]"
    :data-card-kind="kind"
  >
    <template v-if="kind === 'mcp-operation'">
      <header class="online-chat-card__header online-chat-card__header--operation">
        <span class="online-chat-card__emblem"><Sparkles :size="14" /></span>
        <span class="online-chat-card__heading">
          <small>正在为你整理</small>
          <strong>MCP 连接动态</strong>
        </span>
        <em v-if="operationCountLabel" class="online-chat-card__counter">{{ operationCountLabel }}</em>
      </header>
      <div class="online-chat-card__operation-list">
        <article v-for="operation in mcpOperations" :key="operation.id" class="online-chat-card__operation" :class="`is-${operation.state}`">
          <span class="online-chat-card__operation-state" aria-hidden="true"></span>
          <span class="online-chat-card__operation-copy">
            <small>{{ operation.serverName }}</small>
            <strong>{{ operation.toolName }}</strong>
            <span v-if="operationDetail(operation)">{{ operationDetail(operation) }}</span>
          </span>
          <em>{{ mcpOperationStateLabel(operation.state) }}</em>
        </article>
      </div>
    </template>

    <template v-else-if="kind === 'mcp-result' && mcpResult">
      <header class="online-chat-card__header">
        <span class="online-chat-card__emblem"><Search :size="14" /></span>
        <span class="online-chat-card__heading">
          <small>为你找到</small>
          <strong>{{ mcpResult.serverName }}</strong>
        </span>
        <em class="online-chat-card__tool">{{ mcpResult.toolName }}</em>
      </header>
      <div class="online-chat-card__result-list">
        <article v-for="(item, index) in mcpResult.items" :key="`${item.url || item.title}-${index}`" class="online-chat-card__result">
          <span class="online-chat-card__visual" :data-item-kind="item.kind">
            <img
              v-if="item.imageUrl && !isBrokenImage(item.imageUrl)"
              :src="item.imageUrl"
              :alt="item.title"
              loading="lazy"
              referrerpolicy="no-referrer"
              draggable="false"
              @error="markBrokenImage(item.imageUrl)"
            />
            <component :is="resultItemIcon(item.kind)" v-else :size="18" />
          </span>
          <span class="online-chat-card__result-copy">
            <small>{{ item.source || resultKindLabel(item.kind) }}</small>
            <strong>{{ item.title }}</strong>
            <span v-if="item.description || item.address" class="online-chat-card__result-description">{{ item.description || item.address }}</span>
            <span v-if="item.price || item.distance || item.eta" class="online-chat-card__tags">
              <em v-if="item.price" class="is-price">{{ item.price }}</em>
              <em v-if="item.distance">{{ item.distance }}</em>
              <em v-if="item.eta">{{ item.eta }}</em>
            </span>
            <a
              v-if="resultItemUrl(item)"
              :href="resultItemUrl(item)"
              target="_blank"
              rel="noopener noreferrer"
              referrerpolicy="no-referrer"
              @click.stop
              @pointerdown.stop
              @pointerup.stop
            >
              <span>{{ item.url ? '打开结果' : '查看地图' }}</span><ArrowUpRight :size="12" />
            </a>
          </span>
        </article>
      </div>
      <footer class="online-chat-card__footer">已整理 {{ mcpResult.items.length }} 条相关内容</footer>
    </template>

    <template v-else-if="kind === 'link-preview' && link">
      <p v-if="caption" class="online-chat-card__caption">{{ caption }}</p>
      <a
        class="online-chat-card__link"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        referrerpolicy="no-referrer"
        @click.stop
        @pointerdown.stop
        @pointerup.stop
      >
        <span class="online-chat-card__link-visual" :data-platform="link.platform || 'website'">
          <img
            v-if="link.imageUrl && !isBrokenImage(link.imageUrl)"
            :src="link.imageUrl"
            :alt="link.title"
            loading="lazy"
            referrerpolicy="no-referrer"
            draggable="false"
            @error="markBrokenImage(link.imageUrl)"
          />
          <component :is="linkIcon" v-else :size="21" />
        </span>
        <span class="online-chat-card__link-copy">
          <small>{{ linkLabel }}</small>
          <strong>{{ link.title }}</strong>
          <span>{{ link.description || linkHostname }}</span>
          <em>{{ linkHostname }} <ArrowUpRight :size="12" /></em>
        </span>
      </a>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ArrowUpRight, Compass, Globe2, MapPin, Package, Play, Search, Sparkles } from 'lucide-vue-next';
import type { ChatLinkPreviewPlatform, ChatMcpOperation, ChatMcpResultAttachment, ChatMcpResultItem } from '@/types/domain';
import { mcpOperationStateLabel } from '@/utils/mcpOperations';

type OnlineChatCardKind = 'mcp-operation' | 'mcp-result' | 'link-preview';

interface OnlineChatShareLink {
  platform?: ChatLinkPreviewPlatform;
  url: string;
  title: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
}

const props = withDefaults(defineProps<{
  kind: OnlineChatCardKind;
  mcpOperations?: ChatMcpOperation[];
  mcpResult?: ChatMcpResultAttachment;
  link?: OnlineChatShareLink;
  caption?: string;
}>(), {
  mcpOperations: () => [],
  mcpResult: undefined,
  link: undefined,
  caption: ''
});

const brokenImages = ref<string[]>([]);

const operationCountLabel = computed(() => props.mcpOperations.length > 1 ? `${props.mcpOperations.length} 条动态` : '实时');
const cardTone = computed(() => props.kind === 'link-preview' ? (props.link?.platform || 'website') : 'mcp');
const linkHostname = computed(() => {
  const url = props.link?.url;
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return props.link?.siteName || '网页链接';
  }
});
const linkLabel = computed(() => {
  const platform = props.link?.platform;
  const labels: Partial<Record<ChatLinkPreviewPlatform, string>> = {
    xiaohongshu: '小红书 · 分享笔记', douyin: '抖音 · 视频分享', taobao: '淘宝 · 好物分享', pinduoduo: '拼多多 · 好物分享', jd: '京东 · 好物分享',
    xianyu: '闲鱼 · 好物分享', bilibili: '哔哩哔哩 · 视频分享', weibo: '微博 · 内容分享', zhihu: '知乎 · 内容分享', kuaishou: '快手 · 视频分享',
    wechat: '微信 · 文章分享', meituan: '美团 · 服务分享', dianping: '大众点评 · 门店分享', ctrip: '携程 · 行程分享', eleme: '饿了么 · 商家分享', dewu: '得物 · 好物分享'
  };
  return platform ? labels[platform] || props.link?.siteName || '网页分享' : props.link?.siteName || '网页分享';
});
const linkIcon = computed(() => {
  const platform = props.link?.platform;
  if (['douyin', 'bilibili', 'kuaishou'].includes(platform || '')) return Play;
  if (['taobao', 'pinduoduo', 'jd', 'xianyu', 'dewu'].includes(platform || '')) return Package;
  if (['meituan', 'dianping', 'ctrip', 'eleme'].includes(platform || '')) return Compass;
  return Globe2;
});

function isBrokenImage(url: string) {
  return brokenImages.value.includes(url);
}

function markBrokenImage(url: string) {
  if (!url || isBrokenImage(url)) return;
  brokenImages.value = [...brokenImages.value, url];
}

function operationDetail(operation: ChatMcpOperation) {
  return [operation.receipt ? `回执 ${operation.receipt}` : '', operation.result]
    .filter(Boolean)
    .join(' · ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resultKindLabel(kind: ChatMcpResultItem['kind']) {
  return kind === 'product' ? '好物推荐' : kind === 'place' ? '附近地点' : kind === 'media' ? '内容推荐' : kind === 'link' ? '网页内容' : '相关内容';
}

function resultItemIcon(kind: ChatMcpResultItem['kind']) {
  return kind === 'product' ? Package : kind === 'place' ? MapPin : kind === 'media' ? Play : Globe2;
}

function resultItemUrl(item: ChatMcpResultItem) {
  if (item.url) return item.url;
  if (item.longitude === undefined || item.latitude === undefined) return '';
  const position = `${item.longitude},${item.latitude}`;
  return `https://uri.amap.com/marker?position=${encodeURIComponent(position)}&name=${encodeURIComponent(item.title)}&src=BabyLink`;
}
</script>

<style scoped>
.online-chat-card {
  --card-ink: #37343a;
  --card-muted: #9c959d;
  --card-accent: #c6849d;
  --card-tint: #f7eaf0;
  display: grid;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(118, 100, 109, 0.12);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(255, 255, 255, 0.94), transparent 34%),
    linear-gradient(145deg, #fffdfd, #faf8f8 58%, #f4f1f1);
  color: var(--card-ink);
  box-shadow: 0 11px 24px rgba(107, 82, 94, 0.11), inset 0 1px 0 rgba(255, 255, 255, 0.85);
}

.online-chat-card--douyin,
.online-chat-card--bilibili,
.online-chat-card--kuaishou {
  --card-accent: #8476bd;
  --card-tint: #eeeafb;
}

.online-chat-card--taobao,
.online-chat-card--pinduoduo,
.online-chat-card--jd,
.online-chat-card--xianyu,
.online-chat-card--dewu {
  --card-accent: #c88d5f;
  --card-tint: #f9eee3;
}

.online-chat-card--meituan,
.online-chat-card--dianping,
.online-chat-card--ctrip,
.online-chat-card--eleme {
  --card-accent: #6e9f8e;
  --card-tint: #e6f2ec;
}

.online-chat-card__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 9px 10px 8px;
  border-bottom: 1px solid rgba(118, 100, 109, 0.09);
}

.online-chat-card__emblem {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 10px;
  background: var(--card-tint);
  color: var(--card-accent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.78);
}

.online-chat-card__heading {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.online-chat-card__heading small,
.online-chat-card__result-copy > small,
.online-chat-card__operation-copy small,
.online-chat-card__link-copy small {
  overflow: hidden;
  color: var(--card-muted);
  font-size: 7px;
  font-weight: 850;
  letter-spacing: 0.045em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-chat-card__heading strong {
  overflow: hidden;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: -0.015em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-chat-card__tool,
.online-chat-card__counter {
  max-width: 76px;
  overflow: hidden;
  padding: 4px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.68);
  color: var(--card-accent);
  font-size: 7px;
  font-style: normal;
  font-weight: 850;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: inset 0 0 0 1px rgba(118, 100, 109, 0.08);
}

.online-chat-card__result-list,
.online-chat-card__operation-list {
  display: grid;
  max-height: 238px;
  overflow: auto;
  overscroll-behavior: contain;
}

.online-chat-card__result {
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr);
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(118, 100, 109, 0.075);
}

.online-chat-card__result:last-child,
.online-chat-card__operation:last-child {
  border-bottom: 0;
}

.online-chat-card__visual,
.online-chat-card__link-visual {
  display: grid;
  place-items: center;
  width: 46px;
  height: 50px;
  overflow: hidden;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--card-tint), #fffdfd);
  color: var(--card-accent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.85);
}

.online-chat-card__visual[data-item-kind='product'] { color: #c88d5f; background: linear-gradient(145deg, #f9eee3, #fffdf9); }
.online-chat-card__visual[data-item-kind='place'] { color: #6e9f8e; background: linear-gradient(145deg, #e6f2ec, #fbfffd); }
.online-chat-card__visual[data-item-kind='media'] { color: #8476bd; background: linear-gradient(145deg, #eeeafb, #fdfcff); }
.online-chat-card__visual img,
.online-chat-card__link-visual img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.online-chat-card__result-copy,
.online-chat-card__link-copy,
.online-chat-card__operation-copy {
  display: grid;
  align-content: start;
  gap: 3px;
  min-width: 0;
}

.online-chat-card__result-copy > strong,
.online-chat-card__link-copy > strong,
.online-chat-card__operation-copy > strong {
  display: -webkit-box;
  overflow: hidden;
  color: var(--card-ink);
  font-size: 10px;
  font-weight: 850;
  letter-spacing: -0.015em;
  line-height: 1.3;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.online-chat-card__result-description,
.online-chat-card__operation-copy > span,
.online-chat-card__link-copy > span {
  display: -webkit-box;
  overflow: hidden;
  color: #817a82;
  font-size: 8px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.online-chat-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.online-chat-card__tags em {
  padding: 2px 4px;
  border-radius: 5px;
  background: rgba(118, 100, 109, 0.07);
  color: #827981;
  font-size: 7px;
  font-style: normal;
  font-weight: 750;
  line-height: 1.15;
}

.online-chat-card__tags em.is-price {
  background: #faecdf;
  color: #af754f;
}

.online-chat-card__result-copy a {
  display: inline-flex;
  align-items: center;
  justify-self: start;
  gap: 1px;
  margin-top: 1px;
  color: var(--card-accent);
  font-size: 8px;
  font-weight: 850;
  line-height: 1.1;
  text-decoration: none;
}

.online-chat-card__footer {
  padding: 6px 10px 7px;
  border-top: 1px solid rgba(118, 100, 109, 0.07);
  color: #aaa2a8;
  font-size: 7px;
  font-weight: 650;
  line-height: 1.2;
  text-align: right;
}

.online-chat-card__operation {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(118, 100, 109, 0.075);
}

.online-chat-card__operation-state {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b5aaa9;
  box-shadow: 0 0 0 4px rgba(181, 170, 169, 0.12);
}

.online-chat-card__operation.is-running .online-chat-card__operation-state { background: #d5a65d; box-shadow: 0 0 0 4px rgba(213, 166, 93, 0.14); animation: operation-pulse 1.35s ease-in-out infinite; }
.online-chat-card__operation.is-completed .online-chat-card__operation-state { background: #73a994; box-shadow: 0 0 0 4px rgba(115, 169, 148, 0.12); }
.online-chat-card__operation.is-failed .online-chat-card__operation-state,
.online-chat-card__operation.is-cancelled .online-chat-card__operation-state { background: #d98391; box-shadow: 0 0 0 4px rgba(217, 131, 145, 0.12); }

.online-chat-card__operation > em {
  padding: 3px 5px;
  border-radius: 999px;
  background: var(--card-tint);
  color: var(--card-accent);
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.1;
  white-space: nowrap;
}

.online-chat-card__caption {
  margin: 0;
  padding: 9px 10px 1px;
  color: #58535a;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.online-chat-card__link {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr);
  gap: 9px;
  min-width: 0;
  padding: 9px 10px 10px;
  color: inherit;
  text-decoration: none;
}

.online-chat-card__link-visual {
  width: 58px;
  height: 62px;
  border-radius: 16px;
}

.online-chat-card__link-visual[data-platform='xiaohongshu'] { color: #cc7892; background: linear-gradient(145deg, #fae8ee, #fffdfd); }
.online-chat-card__link-visual[data-platform='douyin'],
.online-chat-card__link-visual[data-platform='bilibili'] { color: #8476bd; background: linear-gradient(145deg, #eeeafb, #fdfcff); }
.online-chat-card__link-visual[data-platform='taobao'],
.online-chat-card__link-visual[data-platform='jd'] { color: #c88d5f; background: linear-gradient(145deg, #f9eee3, #fffdf9); }

.online-chat-card__link-copy {
  grid-template-rows: auto auto minmax(0, 1fr) auto;
}

.online-chat-card__link-copy > strong { font-size: 11px; }

.online-chat-card__link-copy > em {
  display: inline-flex;
  align-items: center;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
  color: var(--card-accent);
  font-size: 7px;
  font-style: normal;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.online-chat-card__link-copy > em svg { flex: none; }

@keyframes operation-pulse {
  50% { opacity: 0.48; transform: scale(0.78); }
}

@media (prefers-reduced-motion: reduce) {
  .online-chat-card__operation.is-running .online-chat-card__operation-state { animation: none; }
}
</style>