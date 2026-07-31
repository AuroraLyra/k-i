<template>
  <section class="mcp-view mcp-overview-view">
    <article class="mcp-hero-card mcp-overview-hero">
      <span class="mcp-floating-label">MCP STUDIO · 01</span>
      <div class="mcp-hero-orbit" aria-hidden="true">
        <i></i><i></i><i></i>
        <span><Sparkles :size="24" stroke-width="1.7" /></span>
      </div>
      <div class="mcp-hero-copy">
        <p>Connected life</p>
        <h1>把角色与现实<br>轻轻连接起来</h1>
        <span>联网搜索、系统 App 与外部服务都在这里编排。</span>
      </div>
      <label class="mcp-master-switch">
        <input :checked="enabled" type="checkbox" @change="emit('set-master', ($event.target as HTMLInputElement).checked)">
        <span aria-hidden="true"></span>
        <strong>{{ enabled ? 'Studio on' : 'Studio off' }}</strong>
      </label>
    </article>

    <section class="mcp-metric-strip" aria-label="MCP 状态摘要">
      <span><strong>{{ enabledServerCount }}</strong><small>启用连接</small></span>
      <i></i>
      <span><strong>{{ connectedServerCount }}</strong><small>状态正常</small></span>
      <i></i>
      <span><strong>{{ enabledToolCount }}</strong><small>可用能力</small></span>
    </section>

    <header class="mcp-section-title">
      <div><span>YOUR BOARD</span><h2>今天从哪里开始？</h2></div>
      <small>{{ enabled ? 'READY' : 'PAUSED' }}</small>
    </header>

    <section class="mcp-overview-board">
      <button class="mcp-board-card mcp-board-phone" type="button" @click="emit('navigate', 'phone')">
        <span class="mcp-board-icon"><Smartphone :size="22" /></span>
        <small>ON THIS PHONE</small>
        <strong>系统能力</strong>
        <p>提醒、日历、地图、天气与常用 App 能力均可独立开关。</p>
        <span class="mcp-board-link">查看能力 <ArrowUpRight :size="14" /></span>
      </button>
      <button class="mcp-board-card mcp-board-links" type="button" @click="emit('navigate', 'connections')">
        <span class="mcp-board-icon"><Cable :size="22" /></span>
        <small>CONNECTIONS</small>
        <strong>外部连接</strong>
        <p>{{ servers.length }} 个连接，统一管理电脑助手和远程 MCP。</p>
        <span class="mcp-board-link">管理连接 <ArrowUpRight :size="14" /></span>
      </button>
      <button class="mcp-board-card mcp-board-operations" type="button" @click="router.push({ name: 'service-role-operations' })">
        <span class="mcp-board-icon"><Send :size="22" /></span>
        <small>ROLE SOCIAL DESK</small>
        <strong>角色运营</strong>
        <p>绑定账号、保存草稿、审核发帖与私信，所有写操作可追溯。</p>
        <span class="mcp-board-link">打开运营中心 <ArrowUpRight :size="14" /></span>
      </button>
    </section>

    <article class="mcp-story-card">
      <div class="mcp-story-visual">
        <span><Globe2 :size="21" /></span>
        <i></i><i></i><i></i>
      </div>
      <div>
        <small>WEB SEARCH</small>
        <strong>角色现在可以联网核对信息</strong>
        <p>搜索结果会附带来源链接，并被作为不可信外部素材处理。</p>
      </div>
      <CheckCircle2 :size="20" class="mcp-story-check" />
    </article>

    <section class="mcp-connection-peek">
      <header class="mcp-section-title compact">
        <div><span>RECENT LINKS</span><h2>连接近况</h2></div>
        <button type="button" @click="emit('navigate', 'connections')">See all</button>
      </header>
      <div v-if="servers.length" class="mcp-peek-list">
        <button v-for="server in servers.slice(0, 3)" :key="server.id" type="button" @click="emit('navigate', 'server', server.id)">
          <span class="mcp-kind-avatar" :class="`kind-${server.kind}`"><component :is="server.kind === 'notification-inbox' ? BellRing : server.kind === 'reality' ? Smartphone : server.kind === 'qq' ? MessageCircle : Cable" :size="17" /></span>
          <span><strong>{{ server.name }}</strong><small>{{ server.tools.filter((tool) => tool.enabled).length }} 个能力</small></span>
          <i class="mcp-status-dot" :class="server.lastStatus"></i>
          <ChevronRight :size="16" />
        </button>
      </div>
      <p v-else class="mcp-empty-note">还没有连接，先添加一个远程 MCP。</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { ArrowUpRight, BellRing, Cable, CheckCircle2, ChevronRight, Globe2, MessageCircle, Send, Smartphone, Sparkles } from 'lucide-vue-next';
import { useRouter } from 'vue-router';
import type { McpServerConfig } from '@/types/domain';

const router = useRouter();

defineProps<{
  enabled: boolean;
  enabledServerCount: number;
  connectedServerCount: number;
  enabledToolCount: number;
  servers: McpServerConfig[];
}>();

const emit = defineEmits<{
  'set-master': [enabled: boolean];
  navigate: [view: 'phone' | 'connections' | 'preferences' | 'server', serverId?: string];
}>();
</script>
