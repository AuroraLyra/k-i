<template>
  <section class="screen no-tabs mcp-service-page">
    <header class="top-bar mcp-service-topbar">
      <button class="mcp-back" type="button" :aria-label="isServerView ? '返回连接列表' : '返回 Services'" @click="goBack">
        <ChevronLeft :size="20" stroke-width="2.2" />
        <span>
          <small>{{ isServerView ? 'CONNECTION' : 'SERVICES' }}</small>
          <strong>{{ pageTitle }}</strong>
        </span>
      </button>
      <span class="mcp-top-chip"><Sparkles :size="13" /> MCP</span>
    </header>

    <main class="mcp-service-main">
      <div v-if="notice.text" class="mcp-page-notice" :class="notice.kind" role="status">
        <CheckCircle2 v-if="notice.kind === 'success'" :size="17" />
        <AlertTriangle v-else :size="17" />
        <span>{{ notice.text }}</span>
        <button type="button" aria-label="关闭提示" @click="clearNotice"><X :size="15" /></button>
      </div>

      <McpOverviewPanel
        v-if="view === 'overview'"
        :enabled="settings.enabled"
        :enabled-server-count="enabledServers"
        :connected-server-count="connectedServers"
        :enabled-tool-count="enabledTools"
        :servers="settings.servers"
        @set-master="setMasterEnabled"
        @navigate="navigate"
      />
      <McpPhonePanel v-else-if="view === 'phone'" :tools="realityTools" @set-tool="setRealityToolEnabled" />
      <McpConnectionsPanel
        v-else-if="view === 'connections'"
        :servers="settings.servers"
        :connected-count="connectedServers"
        :testing-ids="checkingIds"
        @pair="openPairing"
        @import="openImport"
        @add="addCustomServer"
        @open-server="openServer"
        @set-enabled="setServerEnabled"
      />
      <McpServerDetailPanel
        v-else-if="view === 'server'"
        :server="activeServer ?? undefined"
        :testing="Boolean(activeServer && checkingIds.has(activeServer.id))"
        @set-enabled="setServerEnabled"
        @set-global="setGlobalEnabled"
        @set-policy="setToolPolicy"
        @set-tool="setToolEnabled"
        @inspect="inspectServer"
        @edit="editServer"
        @delete="confirmDelete"
        @navigate-connections="navigate('connections')"
      />
      <McpPreferencesPanel
        v-else
        :settings="settings"
        @set-master="setMasterEnabled"
        @set-max-calls="setMaxToolCalls"
      />
    </main>

    <nav v-if="!isServerView" class="mcp-service-tabs" aria-label="MCP Studio 分栏">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="mcp-service-tab"
        :class="{ active: view === tab.id }"
        type="button"
        @click="navigate(tab.id)"
      >
        <span><component :is="tab.icon" :size="19" stroke-width="2" /></span>
        <small>{{ tab.label }}</small>
      </button>
    </nav>

    <McpStudioModals />
  </section>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue';
import { useRouter } from 'vue-router';
import { AlertTriangle, CheckCircle2, ChevronLeft, LayoutDashboard, ListTree, Settings2, Smartphone, Sparkles, X } from 'lucide-vue-next';
import McpConnectionsPanel from '@/components/mcp/McpConnectionsPanel.vue';
import McpOverviewPanel from '@/components/mcp/McpOverviewPanel.vue';
import McpPhonePanel from '@/components/mcp/McpPhonePanel.vue';
import McpPreferencesPanel from '@/components/mcp/McpPreferencesPanel.vue';
import McpServerDetailPanel from '@/components/mcp/McpServerDetailPanel.vue';
import McpStudioModals from '@/components/mcp/McpStudioModals.vue';
import { mcpStudioKey, useMcpStudioController, type McpStudioView } from '@/components/mcp/mcpStudio';
import type { McpServerKind } from '@/types/domain';
import '@/styles/mcp-studio.css';

const props = defineProps<{
  view: McpStudioView;
  serverId?: string;
}>();

const router = useRouter();
const isServerView = computed(() => props.view === 'server');

const tabs = [
  { id: 'overview' as const, label: '概览', icon: LayoutDashboard, route: 'service-mcp-overview' },
  { id: 'phone' as const, label: '手机', icon: Smartphone, route: 'service-mcp-phone' },
  { id: 'connections' as const, label: '连接', icon: ListTree, route: 'service-mcp-connections' },
  { id: 'preferences' as const, label: '偏好', icon: Settings2, route: 'service-mcp-preferences' }
];

const studio = useMcpStudioController(navigate);
provide(mcpStudioKey, studio);

const {
  settings,
  realityTools,
  enabledServers,
  connectedServers,
  enabledTools,
  checkingIds,
  notice,
  clearNotice,
  setMasterEnabled,
  setMaxToolCalls,
  setServerEnabled,
  setGlobalEnabled,
  setToolPolicy,
  setToolEnabled,
  inspectServer,
  openPairing,
  openComposer,
  editServer,
  openImport,
  confirmDelete
} = studio;

const activeServer = computed(() => settings.value.servers.find((server) => server.id === props.serverId) ?? null);
const pageTitle = computed(() => isServerView.value ? activeServer.value?.name ?? '连接详情' : 'MCP Studio');

function goBack() {
  if (isServerView.value) {
    void router.push({ name: 'service-mcp-connections' });
    return;
  }
  void router.push({ name: 'services' });
}

function navigate(target: McpStudioView, id?: string) {
  if (target === 'server' && id) {
    void router.push({ name: 'service-mcp-server', params: { serverId: id } });
    return;
  }
  const tab = tabs.find((entry) => entry.id === target);
  if (tab) void router.push({ name: tab.route });
}

function addCustomServer(kind: McpServerKind) {
  openComposer(kind);
}

function openServer(serverId: string) {
  navigate('server', serverId);
}

function setRealityToolEnabled(toolName: string, enabled: boolean) {
  const realityServer = settings.value.servers.find((server) => server.kind === 'reality');
  if (realityServer) void setToolEnabled(realityServer, toolName, enabled);
}
</script>

<style scoped>
.mcp-service-page {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-bottom: 0;
  overflow: hidden;
  color: #252224;
  background:
    radial-gradient(circle at -8% 4%, rgba(248, 205, 221, 0.7), transparent 27%),
    radial-gradient(circle at 108% 20%, rgba(192, 237, 217, 0.62), transparent 28%),
    linear-gradient(180deg, #fffafb 0%, #f8f7fb 52%, #eff7f2 100%);
}

.mcp-service-page::before {
  position: fixed;
  inset: 0;
  pointer-events: none;
  content: '';
  opacity: 0.28;
  background-image: radial-gradient(rgba(70, 58, 65, 0.15) 0.55px, transparent 0.55px);
  background-size: 7px 7px;
}

.mcp-service-topbar {
  z-index: 12;
  flex: 0 0 auto;
  background: rgba(255, 250, 252, 0.78);
  border-bottom: 1px solid rgba(92, 70, 81, 0.05);
  backdrop-filter: blur(22px) saturate(1.1);
}

.mcp-back {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
  margin-right: auto;
  padding: 0;
  color: #292426;
  text-align: left;
}

.mcp-back > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.mcp-back small {
  color: #a28793;
  font-size: 8px;
  font-weight: 900;
  letter-spacing: 0.16em;
}

.mcp-back strong {
  font-size: 17px;
  font-weight: 950;
  line-height: 1.05;
}

.mcp-top-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: 999px;
  color: #557765;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 20px rgba(52, 45, 49, 0.06), inset 0 0 0 1px rgba(255, 255, 255, 0.88);
  font-size: 9px;
  font-weight: 950;
  letter-spacing: 0.08em;
}

.mcp-service-main {
  position: relative;
  z-index: 1;
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: 12px 14px 22px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.mcp-service-tabs {
  position: relative;
  z-index: 12;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
  flex: 0 0 auto;
  padding: 7px calc(10px + var(--safe-right)) calc(8px + var(--safe-bottom)) calc(10px + var(--safe-left));
  border-top: 1px solid rgba(92, 70, 81, 0.06);
  background: rgba(255, 252, 253, 0.86);
  backdrop-filter: blur(24px) saturate(1.08);
}

.mcp-service-tab {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 49px;
  padding: 5px 2px 4px;
  border-radius: 17px;
  color: #9b9296;
}

.mcp-service-tab > span {
  display: grid;
  place-items: center;
  width: 29px;
  height: 27px;
  border-radius: 11px;
}

.mcp-service-tab small {
  font-size: 9px;
  font-weight: 900;
}

.mcp-service-tab.active {
  color: #2f6249;
  background: linear-gradient(145deg, rgba(239, 250, 244, 0.96), rgba(255, 245, 249, 0.84));
  box-shadow: inset 0 0 0 1px rgba(91, 145, 112, 0.08);
}

.mcp-service-tab.active > span {
  background: rgba(255, 255, 255, 0.75);
  box-shadow: 0 6px 14px rgba(42, 66, 53, 0.07);
}

@media (max-width: 350px) {
  .mcp-service-main {
    padding-inline: 10px;
  }

  .mcp-service-tabs {
    gap: 2px;
    padding-inline: calc(7px + var(--safe-left));
  }
}
</style>
