<template>
  <section class="screen no-tabs online-card-gallery-page">
    <header class="online-card-gallery-topbar">
      <button type="button" aria-label="返回" @click="goBack"><ChevronLeft :size="22" /></button>
      <span>
        <small>LINK DESIGN LAB</small>
        <strong>聊天卡片图鉴</strong>
      </span>
      <i aria-hidden="true"><Sparkles :size="18" /></i>
    </header>

    <main class="online-card-gallery-content">
      <section class="online-card-gallery-hero">
        <span>SOFT NOTE COLLECTION</span>
        <h1>在线聊天卡片<br />全部示例</h1>
        <p>统一为轻盈、紧凑的韩系 INS 纸感卡片；实际聊天中会按内容自动选择对应样式。</p>
      </section>

      <section class="online-card-gallery-section" aria-label="MCP 动态卡片示例">
        <header><span>01 · MCP 动态</span><small>连接进度与行动回执</small></header>
        <article class="online-card-gallery-message">
          <span class="online-card-gallery-avatar">M</span>
          <OnlineChatCard kind="mcp-operation" :mcp-operations="mcpOperationSample" />
        </article>
      </section>

      <section class="online-card-gallery-section" aria-label="MCP 结构化结果卡片示例">
        <header><span>02 · MCP 结果</span><small>网页、地点、内容与好物</small></header>
        <article class="online-card-gallery-message">
          <span class="online-card-gallery-avatar">M</span>
          <OnlineChatCard kind="mcp-result" :mcp-result="mcpResultSample" />
        </article>
      </section>

      <section class="online-card-gallery-section" aria-label="链接分享卡片示例">
        <header><span>03 · 链接分享</span><small>内容、视频、好物与网页</small></header>
        <article v-for="share in shareSamples" :key="share.platform" class="online-card-gallery-message">
          <span class="online-card-gallery-avatar">M</span>
          <OnlineChatCard kind="link-preview" :link="share" :caption="share.caption" />
        </article>
      </section>
    </main>
  </section>
</template>

<script setup lang="ts">
import { ChevronLeft, Sparkles } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import OnlineChatCard from '@/components/chat/OnlineChatCard.vue';
import type { ChatLinkPreviewAttachment, ChatMcpOperation, ChatMcpResultAttachment } from '@/types/domain';

type ShareSample = Pick<ChatLinkPreviewAttachment, 'platform' | 'url' | 'title' | 'description' | 'siteName'> & { caption?: string };

const router = useRouter();

const mcpOperationSample: ChatMcpOperation[] = [
  {
    id: 'gallery-mcp-status',
    serverId: 'reality',
    serverName: '养崽助手',
    toolName: 'get_status',
    toolRef: 'get_status',
    arguments: {},
    result: '已找到毛毛的最新状态',
    state: 'completed',
    requestedAt: Date.now() - 1_400,
    completedAt: Date.now()
  },
  {
    id: 'gallery-mcp-search',
    serverId: 'search',
    serverName: '心愿清单',
    toolName: 'find_nearby',
    toolRef: 'find_nearby',
    arguments: {},
    result: '正在挑选适合一起去的地方',
    state: 'running',
    requestedAt: Date.now()
  }
];

const mcpResultSample: ChatMcpResultAttachment = {
  serverId: 'lifestyle-search',
  serverName: '周末灵感',
  toolName: 'little_plan',
  items: [
    { kind: 'place', title: '月亮湾植物咖啡', description: '午后的光线很温柔，适合慢慢聊天。', distance: '1.2 km', eta: '步行 16 分钟' },
    { kind: 'media', title: '奶油云朵蛋糕的做法', description: '收藏量很高的周末甜品视频。', source: '视频推荐', url: 'https://example.com/video' },
    { kind: 'product', title: '奶白色郁金香花束', description: '今天下单，傍晚可以送到。', price: '¥79 起', source: '好物推荐', url: 'https://example.com/product' },
    { kind: 'link', title: '城市公园夏日市集', description: '本周六日限定开放，手作摊位很多。', source: '网页内容', url: 'https://example.com/market' }
  ]
};

const shareSamples: ShareSample[] = [
  {
    platform: 'xiaohongshu',
    url: 'https://www.xiaohongshu.com/',
    title: '夏日约会穿搭｜奶油色很显温柔',
    description: '看到这套的时候，第一反应就是想分享给你。',
    siteName: '小红书',
    caption: '这个配色好像很适合你。'
  },
  {
    platform: 'douyin',
    url: 'https://www.douyin.com/',
    title: '下雨天也要去吃热乎乎的拉面',
    description: '收藏下来，下次一起去试试吧。',
    siteName: '抖音'
  },
  {
    platform: 'taobao',
    url: 'https://www.taobao.com/',
    title: '复古小熊马克杯 · 米白色',
    description: '早上喝咖啡的时候会不会很可爱？',
    siteName: '淘宝'
  },
  {
    platform: 'website',
    url: 'https://example.com/',
    title: '今晚的月亮和你的晚安',
    description: '一篇想留给我们慢慢读完的小文章。',
    siteName: 'LINK 小剧场'
  }
];

function goBack() {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  void router.push({ name: 'home' });
}
</script>

<style scoped>
.online-card-gallery-page {
  overflow: auto;
  background:
    radial-gradient(circle at 0 0, rgba(255, 222, 232, 0.68), transparent 32%),
    radial-gradient(circle at 100% 16%, rgba(224, 240, 229, 0.7), transparent 26%),
    linear-gradient(180deg, #fffdfd, #f8f6f5 48%, #f4f5f1);
}

.online-card-gallery-topbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 10px;
  min-height: calc(56px + var(--safe-top));
  padding: calc(var(--safe-top) + 8px) 16px 8px;
  background: rgba(255, 253, 253, 0.72);
  backdrop-filter: blur(16px);
}

.online-card-gallery-topbar button,
.online-card-gallery-topbar > i {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  color: #6d646a;
  box-shadow: 0 7px 16px rgba(103, 79, 89, 0.08);
}

.online-card-gallery-topbar > i {
  color: #c5819b;
  font-style: normal;
}

.online-card-gallery-topbar span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.online-card-gallery-topbar small {
  color: #ae8f9a;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.online-card-gallery-topbar strong {
  color: #39343a;
  font-size: 14px;
  font-weight: 900;
  letter-spacing: -0.025em;
}

.online-card-gallery-content {
  display: grid;
  gap: 22px;
  min-height: calc(var(--app-height) - 56px - var(--safe-top));
  padding: 16px 16px calc(32px + var(--safe-bottom));
}

.online-card-gallery-hero {
  display: grid;
  gap: 7px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.84);
  border-radius: 28px;
  background:
    radial-gradient(circle at 90% 12%, rgba(221, 240, 227, 0.88), transparent 31%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(253, 241, 246, 0.8));
  box-shadow: 0 19px 38px rgba(85, 66, 74, 0.08);
}

.online-card-gallery-hero > span,
.online-card-gallery-section > header > span {
  color: #b17d92;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
}

.online-card-gallery-hero h1,
.online-card-gallery-hero p {
  margin: 0;
}

.online-card-gallery-hero h1 {
  color: #3b3439;
  font-size: 24px;
  font-weight: 900;
  letter-spacing: -0.055em;
  line-height: 1.22;
}

.online-card-gallery-hero p {
  max-width: 290px;
  color: #81787e;
  font-size: 10px;
  font-weight: 650;
  line-height: 1.6;
}

.online-card-gallery-section {
  display: grid;
  gap: 9px;
}

.online-card-gallery-section > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 8px;
  padding: 0 4px;
}

.online-card-gallery-section > header > small {
  color: #9c9499;
  font-size: 8px;
  font-weight: 700;
  text-align: right;
}

.online-card-gallery-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.online-card-gallery-avatar {
  display: grid;
  flex: 0 0 28px;
  place-items: center;
  width: 28px;
  height: 28px;
  margin-top: 4px;
  border: 2px solid rgba(255, 255, 255, 0.82);
  border-radius: 50%;
  background: linear-gradient(145deg, #f2d8e3, #e7efe7);
  color: #8d7480;
  font-family: Georgia, serif;
  font-size: 12px;
  font-weight: 800;
  box-shadow: 0 6px 12px rgba(89, 72, 80, 0.08);
}

.online-card-gallery-message :deep(.online-chat-card) {
  flex: 0 1 264px;
  max-width: calc(100% - 36px);
}
</style>