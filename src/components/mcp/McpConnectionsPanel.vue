<template>
  <section class="mcp-view mcp-connections-view">
    <article class="mcp-hero-card mcp-connections-hero">
      <div class="mcp-connections-art" aria-hidden="true">
        <span><Cable :size="28" /></span>
        <i></i><i></i><i></i>
      </div>
      <div class="mcp-hero-copy">
        <p>Connections</p>
        <h1>你的能力网络</h1>
        <span>电脑助手、本机 Reality 与远程 MCP 都有自己的详情页。</span>
      </div>
      <div class="mcp-connection-health"><strong>{{ connectedCount }}</strong><small>healthy</small></div>
    </article>

    <section class="mcp-pairing-card">
      <header class="mcp-section-title compact">
        <div><span>COMPUTER ASSISTANT</span><h2>连接电脑上的账号</h2></div>
        <small>LOCAL FIRST</small>
      </header>
      <div class="mcp-desktop-downloads">
        <header>
          <span><Download :size="15" /></span>
          <div><strong>先安装电脑助手</strong><small>在电脑安装后，再回到这里配对</small></div>
          <button type="button" :disabled="releaseLoading" aria-label="刷新安装包" @click="loadDesktopReleases">
            <RefreshCw :size="15" :class="{ spin: releaseLoading }" />
          </button>
        </header>
        <div class="mcp-desktop-download-grid">
          <button
            v-for="item in desktopReleaseItems"
            :key="item.platform"
            type="button"
            :disabled="item.phase === 'loading' || item.phase === 'downloading' || !item.release"
            @click="downloadDesktopRelease(item.platform)"
          >
            <span class="mcp-desktop-platform" :class="item.tone"><component :is="item.icon" :size="19" /></span>
            <span>
              <strong>{{ item.label }}</strong>
              <small>{{ releaseDescription(item) }}</small>
            </span>
            <LoaderCircle v-if="item.phase === 'loading' || item.phase === 'downloading'" :size="15" class="spin" />
            <Download v-else :size="15" />
          </button>
        </div>
        <p v-if="desktopReleaseError" class="mcp-desktop-download-error"><AlertTriangle :size="14" /> {{ desktopReleaseError }}</p>
      </div>
      <div class="mcp-pairing-actions">
        <button type="button" @click="emit('pair', 'qq')">
          <span class="mcp-pair-icon qq"><MessageCircle :size="19" /></span>
          <span><strong>配对 QQ</strong><small>NapCat / OneBot</small></span>
          <ChevronRight :size="16" />
        </button>
        <button type="button" @click="emit('pair', 'xiaohongshu')">
          <span class="mcp-pair-icon xhs"><Heart :size="19" /></span>
          <span><strong>配对小红书</strong><small>非官方适配器</small></span>
          <ChevronRight :size="16" />
        </button>
      </div>
      <p class="mcp-inline-privacy"><ShieldCheck :size="15" /> 账号只登录在电脑，平台流量不会经过 BabyLink 云端。</p>
    </section>

    <section class="mcp-platform-search-card">
      <header class="mcp-section-title compact">
        <div><span>AI PLATFORM SEARCH</span><h2>真实平台联网搜索</h2></div>
        <small>SELF HOSTED</small>
      </header>
      <p class="mcp-platform-search-intro">AI 直接调用搜索型 MCP，原始链接、图片、价格与作者会显示成可点击卡片；这不是电脑 Bridge，也不会用打开 App 冒充搜索。</p>
      <div class="mcp-platform-search-actions">
        <button type="button" @click="emit('add', 'taobao-search')">
          <span class="taobao"><ShoppingBag :size="19" /></span>
          <strong>淘宝商品</strong><small>淘宝联盟物料搜索</small><ChevronRight :size="16" />
        </button>
        <button type="button" @click="emit('add', 'douyin-search')">
          <span class="douyin"><Clapperboard :size="19" /></span>
          <strong>抖音视频</strong><small>真实视频搜索</small><ChevronRight :size="16" />
        </button>
        <button type="button" @click="emit('add', 'xiaohongshu-search')">
          <span class="xhs-search"><Search :size="19" /></span>
          <strong>小红书笔记</strong><small>search_feeds</small><ChevronRight :size="16" />
        </button>
      </div>
      <p class="mcp-inline-privacy"><ShieldCheck :size="15" /> Cookie、Session 与平台凭据只保存在你的 MCP 服务端；BabyLink 仅保存远程地址和访问 Key。</p>
    </section>

    <header class="mcp-section-title">
      <div><span>LIBRARY</span><h2>连接列表</h2></div>
      <small>{{ servers.length }} connections</small>
    </header>

    <div v-if="servers.length" class="mcp-server-library">
      <article v-for="server in servers" :key="server.id" class="mcp-server-tile" :class="{ disabled: !server.enabled }">
        <button class="mcp-server-main" type="button" @click="emit('open-server', server.id)">
          <span class="mcp-kind-avatar large" :class="`kind-${server.kind}`"><component :is="serverIcon(server.kind)" :size="20" /></span>
          <span class="mcp-server-copy">
            <small>{{ kindLabel(server.kind) }}</small>
            <strong>{{ server.name }}</strong>
            <em>{{ statusLabel(server) }} · {{ server.tools.filter((tool) => tool.enabled).length }} tools</em>
          </span>
          <span class="mcp-status-dot large" :class="testingIds.has(server.id) ? 'checking' : server.lastStatus"></span>
          <ChevronRight :size="17" />
        </button>
        <footer>
          <span>{{ server.globalEnabled ? '全局应用' : '角色选择' }}</span>
          <span>{{ policyLabel(server.toolPolicy) }}</span>
          <label class="mcp-mini-toggle" :aria-label="`${server.enabled ? '停用' : '启用'} ${server.name}`">
            <input :checked="server.enabled" type="checkbox" @change="emit('set-enabled', server, ($event.target as HTMLInputElement).checked)">
            <i></i>
          </label>
        </footer>
      </article>
    </div>
    <article v-else class="mcp-empty-card">
      <span><Cable :size="24" /></span><strong>从第一个连接开始</strong><p>拿到服务商配置后，可直接导入或手动填写。</p>
    </article>

    <section class="mcp-add-grid">
      <button type="button" @click="emit('import')"><span><Upload :size="18" /></span><strong>导入配置</strong><small>JSON / TXT / URL</small></button>
      <button type="button" @click="emit('add', 'custom')"><span><Plus :size="18" /></span><strong>手动添加</strong><small>自建 HTTPS 服务</small></button>
    </section>
  </section>
</template>

<script setup lang="ts">
import { AlertTriangle, Apple, Cable, ChevronRight, Clapperboard, Download, Heart, LoaderCircle, MessageCircle, Monitor, Network, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, Smartphone, Upload } from 'lucide-vue-next';
import { computed, onMounted, reactive, type Component } from 'vue';
import { downloadDesktopBridgeRelease, fetchDesktopBridgeRelease, type DesktopBridgePlatform, type DesktopBridgeRelease } from '@/services/desktopBridgeRelease';
import type { McpServerConfig, McpServerKind, McpToolPolicy } from '@/types/domain';

defineProps<{ servers: McpServerConfig[]; connectedCount: number; testingIds: Set<string> }>();
const emit = defineEmits<{
  pair: [kind: 'qq' | 'xiaohongshu'];
  import: [];
  add: [kind: McpServerKind];
  'open-server': [serverId: string];
  'set-enabled': [server: McpServerConfig, enabled: boolean];
}>();

type DesktopReleasePhase = 'loading' | 'ready' | 'unavailable' | 'downloading' | 'error';
interface DesktopReleaseState {
  phase: DesktopReleasePhase;
  release: DesktopBridgeRelease | null;
  error: string;
}

const desktopReleaseStates = reactive<Record<DesktopBridgePlatform, DesktopReleaseState>>({
  'desktop-macos': { phase: 'loading', release: null, error: '' },
  'desktop-windows': { phase: 'loading', release: null, error: '' }
});
const desktopReleaseItems = computed(() => [
  { platform: 'desktop-macos' as const, label: 'macOS', icon: Apple, tone: 'mac', ...desktopReleaseStates['desktop-macos'] },
  { platform: 'desktop-windows' as const, label: 'Windows', icon: Monitor, tone: 'windows', ...desktopReleaseStates['desktop-windows'] }
]);
const releaseLoading = computed(() => desktopReleaseItems.value.some((item) => item.phase === 'loading'));
const desktopReleaseError = computed(() => desktopReleaseItems.value.find((item) => item.error)?.error ?? '');

onMounted(loadDesktopReleases);

async function loadDesktopRelease(platform: DesktopBridgePlatform) {
  const state = desktopReleaseStates[platform];
  state.phase = 'loading';
  state.error = '';
  try {
    state.release = await fetchDesktopBridgeRelease(platform);
    state.phase = state.release ? 'ready' : 'unavailable';
  } catch (error) {
    state.release = null;
    state.phase = 'error';
    state.error = error instanceof Error ? error.message : '安装包加载失败。';
  }
}

async function loadDesktopReleases() {
  await Promise.all([
    loadDesktopRelease('desktop-macos'),
    loadDesktopRelease('desktop-windows')
  ]);
}

async function downloadDesktopRelease(platform: DesktopBridgePlatform) {
  const state = desktopReleaseStates[platform];
  if (!state.release || state.phase === 'downloading') return;
  state.phase = 'downloading';
  state.error = '';
  try {
    await downloadDesktopBridgeRelease(state.release);
    state.phase = 'ready';
  } catch (error) {
    state.phase = 'error';
    state.error = error instanceof Error ? error.message : '安装包下载失败。';
  }
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function releaseDescription(item: typeof desktopReleaseItems.value[number]) {
  if (item.phase === 'loading') return '正在检查安装包…';
  if (item.phase === 'downloading') return '正在开始下载…';
  if (!item.release) return item.phase === 'error' ? '暂时无法获取' : '管理员尚未发布';
  return `v${item.release.versionName} · ${formatFileSize(item.release.fileSize)}`;
}

function serverIcon(kind: McpServerKind): Component {
  if (kind === 'reality') return Smartphone;
  if (kind === 'qq') return MessageCircle;
  if (kind === 'xiaohongshu' || kind === 'xiaohongshu-search') return Heart;
  if (kind === 'taobao-search') return ShoppingBag;
  if (kind === 'douyin-search') return Clapperboard;
  return Network;
}

function kindLabel(kind: McpServerKind) {
  if (kind === 'reality') return 'ON THIS PHONE';
  if (kind === 'qq') return 'QQ BRIDGE';
  if (kind === 'xiaohongshu') return 'XIAOHONGSHU BRIDGE';
  if (kind === 'taobao-search') return 'TAOBAO SEARCH';
  if (kind === 'douyin-search') return 'DOUYIN SEARCH';
  if (kind === 'xiaohongshu-search') return 'RED SEARCH';
  return 'REMOTE MCP';
}

function statusLabel(server: McpServerConfig) {
  return server.lastStatus === 'connected' ? '连接正常' : server.lastStatus === 'error' ? '需要检查' : '等待检测';
}

function policyLabel(policy: McpToolPolicy) {
  return policy === 'all' ? '允许操作' : policy === 'disabled' ? '角色禁用' : '只读';
}
</script>
