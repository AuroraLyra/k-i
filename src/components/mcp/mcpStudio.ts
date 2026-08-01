import { computed, inject, reactive, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { realityMcpTools } from '@/data/realityMcp';
import { createMcpServerTemplate, importMcpServers, inspectMcpServer, normalizeMcpRemoteUrl } from '@/services/mcp';
import { useAppStore } from '@/stores/appStore';
import type { McpServerConfig, McpServerKind, McpSettings, McpToolDefinition, McpToolPolicy } from '@/types/domain';
import { normalizeAppSettings, normalizeMcpSettings } from '@/utils/settings';

export type McpStudioView = 'overview' | 'phone' | 'connections' | 'preferences' | 'server';
export type McpNotice = { kind: 'success' | 'error'; text: string };
export type McpComposerTab = 'quick' | 'advanced';
export type McpBridgeKind = 'xiaohongshu' | 'qq';

export interface McpStudioContext {
  settings: ComputedRef<McpSettings>;
  realityTools: ComputedRef<McpToolDefinition[]>;
  enabledServers: ComputedRef<number>;
  connectedServers: ComputedRef<number>;
  enabledTools: ComputedRef<number>;
  checkingIds: ComputedRef<Set<string>>;
  notice: McpNotice;
  clearNotice: () => void;
  setMasterEnabled: (enabled: boolean) => Promise<void>;
  setMaxToolCalls: (value: number) => Promise<void>;
  setServerEnabled: (server: McpServerConfig, enabled: boolean) => Promise<void>;
  setGlobalEnabled: (server: McpServerConfig, enabled: boolean) => Promise<void>;
  setToolPolicy: (server: McpServerConfig, policy: McpToolPolicy) => Promise<void>;
  setToolEnabled: (server: McpServerConfig, toolName: string, enabled: boolean) => Promise<void>;
  inspectServer: (server: McpServerConfig) => Promise<void>;
  openPairing: (kind: 'qq' | 'xiaohongshu') => void;
  openComposer: (kind?: McpServerKind) => void;
  editServer: (server: McpServerConfig) => void;
  openImport: () => void;
  confirmDelete: (server: McpServerConfig) => void;
  navigate: (view: McpStudioView, serverId?: string) => void;
  showPairing: Ref<boolean>;
  bridgeKind: Ref<McpBridgeKind>;
  bridgePairingText: Ref<string>;
  bridgeError: Ref<string>;
  bridgeGuideTitle: ComputedRef<string>;
  bridgePairingPlaceholder: ComputedRef<string>;
  bridgeGuideSteps: ComputedRef<{ title: string; detail: string }[]>;
  pairing: Ref<boolean>;
  runBridgePairing: () => Promise<void>;
  showComposer: Ref<boolean>;
  composerTab: Ref<McpComposerTab>;
  editingServerId: Ref<string>;
  composer: McpServerConfig;
  headersText: Ref<string>;
  composerError: Ref<string>;
  composerKindHelper: ComputedRef<string>;
  savingComposer: Ref<boolean>;
  saveComposer: () => Promise<void>;
  showImporter: Ref<boolean>;
  importText: Ref<string>;
  importApiKey: Ref<string>;
  importError: Ref<string>;
  importing: Ref<boolean>;
  readImportFile: (event: Event) => Promise<void>;
  runImport: () => Promise<void>;
  deleteTarget: Ref<McpServerConfig | null>;
  deleting: Ref<boolean>;
  closeDeleteModal: (open: boolean) => void;
  deleteServer: () => Promise<void>;
}

export const mcpStudioKey: InjectionKey<McpStudioContext> = Symbol('mcpStudio');

export function useMcpStudio() {
  const context = inject(mcpStudioKey);
  if (!context) throw new Error('MCP Studio context is unavailable.');
  return context;
}

export function useMcpStudioController(navigate: McpStudioContext['navigate']): McpStudioContext {
  const store = useAppStore();
  const showPairing = ref(false);
  const bridgeKind = ref<McpBridgeKind>('qq');
  const bridgePairingText = ref('');
  const bridgeError = ref('');
  const pairing = ref(false);
  const showComposer = ref(false);
  const composerTab = ref<McpComposerTab>('quick');
  const editingServerId = ref('');
  const composer = reactive<McpServerConfig>(createMcpServerTemplate());
  const headersText = ref('{}');
  const composerError = ref('');
  const savingComposer = ref(false);
  const showImporter = ref(false);
  const importText = ref('');
  const importApiKey = ref('');
  const importError = ref('');
  const importing = ref(false);
  const deleteTarget = ref<McpServerConfig | null>(null);
  const deleting = ref(false);
  const checkingIdsState = ref(new Set<string>());
  const notice = reactive<McpNotice>({ kind: 'success', text: '' });

  const currentSettings = computed(() => normalizeAppSettings(store.settings));
  const settings = computed(() => currentSettings.value.mcpSettings);
  const realityTools = computed(() => {
    const server = settings.value.servers.find((entry) => entry.kind === 'reality');
    return server?.tools.length
      ? server.tools
      : realityMcpTools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
  });
  const enabledServers = computed(() => settings.value.servers.filter((server) => server.enabled).length);
  const connectedServers = computed(() => settings.value.servers.filter((server) => server.enabled && server.lastStatus === 'connected').length);
  const enabledTools = computed(() => settings.value.servers.reduce((count, server) => count + (server.enabled ? server.tools.filter((tool) => tool.enabled).length : 0), 0));
  const checkingIds = computed(() => checkingIdsState.value);
  const bridgeGuideTitle = computed(() => bridgeKind.value === 'qq' ? '连接 QQ 电脑助手' : '连接小红书电脑助手');
  const bridgePairingPlaceholder = computed(() => bridgeKind.value === 'qq'
    ? '粘贴电脑助手复制的 QQ 配对信息…'
    : '粘贴电脑助手复制的小红书配对信息…');
  const bridgeGuideSteps = computed(() => bridgeKind.value === 'qq'
    ? [
        { title: '电脑打开 BabyLink 助手', detail: '选择 QQ，助手会连接本机 NapCat / OneBot。' },
        { title: '按提示扫码登录 QQ', detail: 'QQ 只登录在你的电脑；看到“QQ 在线”再继续。' },
        { title: '复制配对信息', detail: '电脑助手会生成一段配对信息，复制后粘贴到下方。' }
      ]
    : [
        { title: '电脑打开 BabyLink 助手', detail: '选择小红书，并连接你安装的非官方适配器。' },
        { title: '按适配器提示登录', detail: '账号和 Cookie 只留在电脑；看到“适配器在线”再继续。' },
        { title: '复制配对信息', detail: '电脑助手会生成一段配对信息，复制后粘贴到下方。' }
      ]);
  const composerKindHelper = computed(() => {
    if (composer.kind === 'termux') return 'Android App 会通过受限原生中继连接同机 127.0.0.1；API Key 填 Termux 配置中的随机 Token。';
    if (composer.kind === 'taobao-search') return '接入真实淘宝联盟物料搜索；PID、Session 与第三方配置凭据必须保存在自托管服务端。';
    if (composer.kind === 'douyin-search') return '接入真实抖音视频搜索；参考实现默认是 stdio，需先包装为 Streamable HTTP。';
    if (composer.kind === 'xiaohongshu-search') return '接入真实小红书 search_feeds；同机可用回环 HTTP，跨设备须用带鉴权的 HTTPS。';
    if (composer.kind === 'custom') return '填写服务商提供的地址与 Key，保存后自动读取工具。';
    return '服务在你的电脑运行，只填写助手生成的远程 HTTPS 地址。';
  });

  function setNotice(kind: McpNotice['kind'], text: string) {
    notice.kind = kind;
    notice.text = text;
  }

  function clearNotice() {
    notice.text = '';
  }

  async function saveMcpSettings(nextSettings: McpSettings) {
    await store.saveSettings(normalizeAppSettings({
      ...currentSettings.value,
      mcpSettings: normalizeMcpSettings(nextSettings)
    }));
  }

  async function patchServer(serverId: string, patch: Partial<McpServerConfig>) {
    await saveMcpSettings({
      ...settings.value,
      servers: settings.value.servers.map((server) => server.id === serverId ? { ...server, ...patch } : server)
    });
  }

  async function setMasterEnabled(enabled: boolean) {
    await saveMcpSettings({ ...settings.value, enabled });
  }

  async function setMaxToolCalls(value: number) {
    await saveMcpSettings({ ...settings.value, maxToolCallsPerReply: value });
  }

  async function setServerEnabled(server: McpServerConfig, enabled: boolean) {
    await patchServer(server.id, { enabled });
  }

  async function setGlobalEnabled(server: McpServerConfig, enabled: boolean) {
    await patchServer(server.id, { globalEnabled: enabled });
  }

  async function setToolPolicy(server: McpServerConfig, policy: McpToolPolicy) {
    await patchServer(server.id, { toolPolicy: policy });
  }

  async function setToolEnabled(server: McpServerConfig, toolName: string, enabled: boolean) {
    await patchServer(server.id, {
      tools: server.tools.map((tool) => tool.name === toolName ? { ...tool, enabled } : tool)
    });
  }

  function openPairing(kind: McpBridgeKind) {
    bridgeKind.value = kind;
    bridgePairingText.value = '';
    bridgeError.value = '';
    showPairing.value = true;
  }

  function openComposer(kind: McpServerKind = 'custom') {
    editingServerId.value = '';
    composerTab.value = 'quick';
    Object.assign(composer, createMcpServerTemplate(kind));
    headersText.value = '{}';
    composerError.value = '';
    showComposer.value = true;
  }

  function editServer(server: McpServerConfig) {
    editingServerId.value = server.id;
    composerTab.value = 'quick';
    Object.assign(composer, {
      ...server,
      headers: { ...server.headers },
      tools: server.tools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }))
    });
    headersText.value = JSON.stringify(server.headers, null, 2);
    composerError.value = '';
    showComposer.value = true;
  }

  function openImport() {
    importError.value = '';
    showImporter.value = true;
  }

  function confirmDelete(server: McpServerConfig) {
    deleteTarget.value = server;
  }

  async function inspectServer(server: McpServerConfig) {
    checkingIdsState.value = new Set([...checkingIdsState.value, server.id]);
    clearNotice();
    try {
      const inspection = await inspectMcpServer(server);
      await patchServer(server.id, {
        ...inspection,
        tools: inspection.tools.map((tool) => ({
          ...tool,
          enabled: server.tools.find((configured) => configured.name === tool.name)?.enabled ?? tool.enabled
        })),
        lastStatus: 'connected',
        lastCheckedAt: Date.now(),
        lastError: ''
      });
      setNotice('success', `${server.name} 已连接，发现 ${inspection.tools.length} 个工具。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MCP 连接失败。';
      await patchServer(server.id, { lastStatus: 'error', lastCheckedAt: Date.now(), lastError: message });
      setNotice('error', message);
    } finally {
      const nextIds = new Set(checkingIdsState.value);
      nextIds.delete(server.id);
      checkingIdsState.value = nextIds;
    }
  }

  async function discoverServer(server: McpServerConfig) {
    const inspection = await inspectMcpServer(server);
    return {
      ...server,
      ...inspection,
      tools: inspection.tools.map((tool) => ({
        ...tool,
        enabled: server.tools.find((configured) => configured.name === tool.name)?.enabled ?? tool.enabled
      })),
      lastStatus: 'connected' as const,
      lastCheckedAt: Date.now(),
      lastError: ''
    } satisfies McpServerConfig;
  }

  async function runBridgePairing() {
    if (pairing.value) return;
    bridgeError.value = '';
    pairing.value = true;
    try {
      const pairedServer = importMcpServers(bridgePairingText.value).find((server) => server.kind === bridgeKind.value);
      if (!pairedServer) throw new Error(`这不是${bridgeKind.value === 'qq' ? ' QQ' : '小红书'}电脑助手的配对信息。`);
      const existing = settings.value.servers.find((server) => server.kind === bridgeKind.value && server.url === pairedServer.url);
      const nextServer: McpServerConfig = {
        ...pairedServer,
        id: existing?.id ?? pairedServer.id,
        enabled: true,
        globalEnabled: true,
        toolPolicy: 'all',
        tools: existing?.tools ?? pairedServer.tools
      };
      const discoveredServer = await discoverServer(nextServer);
      await saveMcpSettings({
        ...settings.value,
        servers: existing
          ? settings.value.servers.map((server) => server.id === existing.id ? discoveredServer : server)
          : [...settings.value.servers, discoveredServer]
      });
      showPairing.value = false;
      bridgePairingText.value = '';
      setNotice('success', `${discoveredServer.name} 已配对，发现 ${discoveredServer.tools.length} 个工具。`);
    } catch (error) {
      bridgeError.value = error instanceof Error ? error.message : '电脑助手配对失败。';
    } finally {
      pairing.value = false;
    }
  }

  function parseHeaders() {
    if (!headersText.value.trim()) return {};
    const parsed = JSON.parse(headersText.value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('其他请求头必须是 JSON 对象。');
    return Object.fromEntries(Object.entries(parsed)
      .map(([key, value]) => [key.trim(), String(value ?? '').trim()])
      .filter(([key, value]) => key && value));
  }

  async function saveComposer() {
    if (savingComposer.value) return;
    composerError.value = '';
    savingComposer.value = true;
    try {
      const nextServer: McpServerConfig = {
        ...composer,
        name: composer.name.trim() || serverKindLabel(composer),
        description: composer.description.trim(),
        url: normalizeMcpRemoteUrl(composer.url),
        headers: parseHeaders()
      };
      const discoveredServer = await discoverServer(nextServer);
      const exists = settings.value.servers.some((server) => server.id === editingServerId.value);
      await saveMcpSettings({
        ...settings.value,
        servers: exists
          ? settings.value.servers.map((server) => server.id === editingServerId.value ? discoveredServer : server)
          : [...settings.value.servers, discoveredServer]
      });
      showComposer.value = false;
      setNotice('success', `${discoveredServer.name} 已保存，发现 ${discoveredServer.tools.length} 个工具。`);
    } catch (error) {
      composerError.value = error instanceof Error ? error.message : 'MCP 配置无法保存。';
    } finally {
      savingComposer.value = false;
    }
  }

  async function readImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
      importError.value = '导入配置不能超过 1 MB。';
      return;
    }
    try {
      importText.value = await file.text();
      importError.value = '';
    } catch {
      importError.value = '无法读取这个配置文件。';
    }
  }

  async function runImport() {
    if (importing.value) return;
    importError.value = '';
    importing.value = true;
    try {
      const imported = importMcpServers(importText.value).map((server) => ({
        ...server,
        apiKey: importApiKey.value.trim() || server.apiKey
      }));
      const existingUrls = new Set(settings.value.servers.map((server) => server.url));
      const additions = imported.filter((server) => !existingUrls.has(server.url));
      if (!additions.length) throw new Error('这些远程地址已经存在。');
      const discoveredAdditions: McpServerConfig[] = [];
      for (const server of additions) discoveredAdditions.push(await discoverServer(server));
      await saveMcpSettings({ ...settings.value, servers: [...settings.value.servers, ...discoveredAdditions] });
      showImporter.value = false;
      importText.value = '';
      importApiKey.value = '';
      const toolCount = discoveredAdditions.reduce((total, server) => total + server.tools.length, 0);
      setNotice('success', `已导入 ${discoveredAdditions.length} 个远程 MCP，发现 ${toolCount} 个工具。`);
    } catch (error) {
      importError.value = error instanceof Error ? error.message : 'MCP 配置导入失败。';
    } finally {
      importing.value = false;
    }
  }

  function closeDeleteModal(open: boolean) {
    if (!open && !deleting.value) deleteTarget.value = null;
  }

  async function deleteServer() {
    const server = deleteTarget.value;
    if (!server || deleting.value) return;
    deleting.value = true;
    try {
      await saveMcpSettings({
        ...settings.value,
        servers: settings.value.servers.filter((entry) => entry.id !== server.id)
      });
      const affectedCharacters = store.characters.filter((character) => character.mcpBinding?.serverIds.includes(server.id));
      await Promise.all(affectedCharacters.map((character) => store.saveCharacter({
        ...character,
        mcpBinding: {
          overrideGlobal: Boolean(character.mcpBinding?.overrideGlobal),
          serverIds: (character.mcpBinding?.serverIds ?? []).filter((serverId) => serverId !== server.id)
        }
      })));
      deleteTarget.value = null;
      setNotice('success', `${server.name} 已删除。`);
      navigate('connections');
    } finally {
      deleting.value = false;
    }
  }

  return {
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
    confirmDelete,
    navigate,
    showPairing,
    bridgeKind,
    bridgePairingText,
    bridgeError,
    bridgeGuideTitle,
    bridgePairingPlaceholder,
    bridgeGuideSteps,
    pairing,
    runBridgePairing,
    showComposer,
    composerTab,
    editingServerId,
    composer,
    headersText,
    composerError,
    composerKindHelper,
    savingComposer,
    saveComposer,
    showImporter,
    importText,
    importApiKey,
    importError,
    importing,
    readImportFile,
    runImport,
    deleteTarget,
    deleting,
    closeDeleteModal,
    deleteServer
  };
}

export function serverKindLabel(server: McpServerConfig) {
  if (server.kind === 'reality') return 'Reality MCP · 手机能力';
  if (server.kind === 'notification-inbox') return '系统通知 MCP · 角色专用';
  if (server.kind === 'termux') return 'Termux · Android 本机网关';
  if (server.kind === 'qq') return 'QQ / NapCat MCP';
  if (server.kind === 'xiaohongshu') return '小红书电脑 Bridge';
  if (server.kind === 'taobao-search') return '淘宝商品搜索 MCP';
  if (server.kind === 'douyin-search') return '抖音视频搜索 MCP';
  if (server.kind === 'xiaohongshu-search') return '小红书内容搜索 MCP';
  return '自定义 MCP';
}

export function serverKindShortLabel(server: McpServerConfig) {
  if (server.kind === 'reality') return 'PHONE';
  if (server.kind === 'notification-inbox') return 'NOTIFICATIONS';
  if (server.kind === 'termux') return 'TERMUX';
  if (server.kind === 'qq') return 'QQ';
  if (server.kind === 'xiaohongshu') return 'RED';
  if (server.kind === 'taobao-search') return 'TAOBAO';
  if (server.kind === 'douyin-search') return 'DOUYIN';
  if (server.kind === 'xiaohongshu-search') return 'RED SEARCH';
  return 'MCP';
}

export function policyLabel(policy: McpToolPolicy) {
  if (policy === 'all') return '浏览并操作';
  if (policy === 'disabled') return '角色禁用';
  return '只读浏览';
}

export function statusLabel(server: McpServerConfig, checking: boolean) {
  if (checking) return '正在检测';
  if (server.lastStatus === 'connected') return '连接正常';
  if (server.lastStatus === 'error') return '需要检查';
  return '等待检测';
}

export function formatCheckedAt(value: number) {
  if (!value) return '尚未检测';
  const minutes = Math.max(0, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 1) return '刚刚检查';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} 小时前` : `${Math.floor(hours / 24)} 天前`;
}

export function useServerById(serverId: () => string | undefined) {
  const studio = useMcpStudio();
  const server = computed(() => studio.settings.value.servers.find((entry) => entry.id === serverId()) ?? null);
  return { studio, server };
}
