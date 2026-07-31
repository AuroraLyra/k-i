<template>
  <section v-if="server" class="mcp-view mcp-server-detail-view">
    <article class="mcp-hero-card mcp-server-detail-hero" :class="`kind-${server.kind}`">
      <span class="mcp-kind-avatar hero" :class="`kind-${server.kind}`"><component :is="serverIcon" :size="27" /></span>
      <div class="mcp-hero-copy">
        <p>{{ kindLabel }}</p>
        <h1>{{ server.name }}</h1>
        <span>{{ server.description || '这个连接还没有添加说明。' }}</span>
      </div>
      <span class="mcp-health-pill" :class="statusClass"><i></i>{{ statusLabel }}</span>
    </article>

    <section class="mcp-detail-facts">
      <span><strong>{{ enabledTools }}</strong><small>启用工具</small></span>
      <span><strong>{{ server.globalEnabled ? 'ON' : 'LOCAL' }}</strong><small>应用范围</small></span>
      <span><strong>{{ policyShort }}</strong><small>角色权限</small></span>
    </section>

    <section class="mcp-detail-card">
      <header class="mcp-section-title compact"><div><span>CONNECTION</span><h2>连接设置</h2></div></header>
      <label class="mcp-setting-row">
        <span><strong>启用连接</strong><small>关闭后保留配置，但不会被角色调用。</small></span>
        <span class="mcp-switch"><input :checked="server.enabled" type="checkbox" @change="emit('set-enabled', server, checked($event))"><i></i></span>
      </label>
      <label class="mcp-setting-row">
        <span><strong>全局应用</strong><small>未开启角色局部优先时自动继承。</small></span>
        <span class="mcp-switch"><input :checked="server.globalEnabled" :disabled="!server.enabled" type="checkbox" @change="emit('set-global', server, checked($event))"><i></i></span>
      </label>
      <label class="mcp-setting-row policy">
        <span><strong>角色权限</strong><small>{{ policyDescription }}</small></span>
        <select :value="server.toolPolicy" :disabled="!server.enabled || server.kind === 'reality'" @change="emit('set-policy', server, ($event.target as HTMLSelectElement).value as McpToolPolicy)">
          <option value="disabled">不允许调用</option><option value="read-only">只浏览与查询</option><option value="all">浏览并执行操作</option>
        </select>
      </label>
      <div class="mcp-endpoint-card">
        <span><component :is="server.kind === 'reality' ? Smartphone : Globe2" :size="16" /></span>
        <div><small>ENDPOINT</small><strong>{{ server.kind === 'reality' ? '当前设备本地执行' : server.url }}</strong></div>
      </div>
    </section>

    <section class="mcp-detail-card">
      <header class="mcp-section-title compact">
        <div><span>TOOLS</span><h2>能力权限</h2></div><small>{{ server.tools.length }} discovered</small>
      </header>
      <div v-if="server.tools.length" class="mcp-tool-list">
        <label v-for="tool in server.tools" :key="tool.name" class="mcp-tool-row">
          <span><strong>{{ tool.title || tool.name }}</strong><small>{{ tool.description || tool.name }}</small><em :class="tool.write ? 'write' : 'read'">{{ tool.write ? '会执行操作' : '只读查询' }}</em></span>
          <span class="mcp-switch small"><input :checked="tool.enabled" type="checkbox" @change="emit('set-tool', server, tool.name, checked($event))"><i></i></span>
        </label>
      </div>
      <p v-else class="mcp-empty-note">重新检测连接后，会在这里显示服务端公开的工具。</p>
    </section>

    <p v-if="server.lastError" class="mcp-detail-error"><AlertTriangle :size="16" /> {{ server.lastError }}</p>

    <section class="mcp-detail-actions">
      <button type="button" :disabled="testing" @click="emit('inspect', server)"><RefreshCw :class="{ spin: testing }" :size="16" />{{ testing ? '检测中' : '重新检测' }}</button>
      <button v-if="server.kind !== 'reality'" type="button" @click="emit('edit', server)"><Pencil :size="16" />编辑连接</button>
      <button v-if="server.kind !== 'reality'" class="danger" type="button" @click="emit('delete', server)"><Trash2 :size="16" />删除连接</button>
    </section>
  </section>

  <section v-else class="mcp-view mcp-missing-server">
    <span><Cable :size="26" /></span><h2>没有找到这个连接</h2><p>它可能已经被删除，返回连接列表重新选择。</p>
    <button type="button" @click="emit('navigate-connections')">返回连接列表</button>
  </section>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue';
import { AlertTriangle, Cable, Clapperboard, Globe2, Heart, MessageCircle, Network, Pencil, RefreshCw, ShoppingBag, Smartphone, TerminalSquare, Trash2 } from 'lucide-vue-next';
import type { McpServerConfig, McpToolPolicy } from '@/types/domain';

const props = defineProps<{ server?: McpServerConfig; testing: boolean }>();
const emit = defineEmits<{
  'set-enabled': [server: McpServerConfig, enabled: boolean];
  'set-global': [server: McpServerConfig, enabled: boolean];
  'set-policy': [server: McpServerConfig, policy: McpToolPolicy];
  'set-tool': [server: McpServerConfig, toolName: string, enabled: boolean];
  inspect: [server: McpServerConfig]; edit: [server: McpServerConfig]; delete: [server: McpServerConfig];
  'navigate-connections': [];
}>();

const serverIcon = computed<Component>(() => {
  if (props.server?.kind === 'reality') return Smartphone;
  if (props.server?.kind === 'termux') return TerminalSquare;
  if (props.server?.kind === 'qq') return MessageCircle;
  if (props.server?.kind === 'xiaohongshu' || props.server?.kind === 'xiaohongshu-search') return Heart;
  if (props.server?.kind === 'taobao-search') return ShoppingBag;
  if (props.server?.kind === 'douyin-search') return Clapperboard;
  return Network;
});
const kindLabel = computed(() => {
  if (props.server?.kind === 'reality') return 'ON THIS PHONE';
  if (props.server?.kind === 'termux') return 'ANDROID LOCAL HUB';
  if (props.server?.kind === 'qq') return 'QQ BRIDGE';
  if (props.server?.kind === 'xiaohongshu') return 'XIAOHONGSHU BRIDGE';
  if (props.server?.kind === 'taobao-search') return 'TAOBAO SEARCH';
  if (props.server?.kind === 'douyin-search') return 'DOUYIN SEARCH';
  if (props.server?.kind === 'xiaohongshu-search') return 'RED SEARCH';
  return 'REMOTE MCP';
});
const enabledTools = computed(() => props.server?.tools.filter((tool) => tool.enabled).length ?? 0);
const statusClass = computed(() => props.testing ? 'checking' : props.server?.lastStatus ?? 'idle');
const statusLabel = computed(() => props.testing ? '正在检测' : props.server?.lastStatus === 'connected' ? '连接正常' : props.server?.lastStatus === 'error' ? '需要检查' : '等待检测');
const policyShort = computed(() => props.server?.toolPolicy === 'all' ? 'ALL' : props.server?.toolPolicy === 'disabled' ? 'OFF' : 'READ');
const policyDescription = computed(() => props.server?.toolPolicy === 'all' ? '角色可执行外部操作' : props.server?.toolPolicy === 'disabled' ? '不向角色提供工具' : '角色只能浏览与查询');

function checked(event: Event) { return (event.target as HTMLInputElement).checked; }
</script>
