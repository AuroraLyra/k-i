import type { AppSettings, CharacterProfile, McpServerConfig, McpServerKind, McpToolDefinition } from '@/types/domain';
import { createBuiltinRealityMcpServer, realityMcpTools } from '@/data/realityMcp';
import { executeRealityMcpTool } from '@/services/realityMcp';
import { createId } from '@/utils/id';

const defaultProtocolVersion = '2025-06-18';
const maxToolResultLength = 12_000;
const maxToolListPages = 20;

interface JsonRpcError {
  code?: number;
  message?: string;
  data?: unknown;
}

interface JsonRpcResponse<T = unknown> {
  jsonrpc?: string;
  id?: string | number | null;
  result?: T;
  error?: JsonRpcError;
}

interface McpInitializeResult {
  protocolVersion?: string;
  serverInfo?: {
    name?: string;
    version?: string;
  };
}

interface McpRawTool {
  name?: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

interface McpToolsListResult {
  tools?: McpRawTool[];
  nextCursor?: string;
}

interface McpToolCallResultPayload {
  content?: unknown[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpServerInspection {
  tools: McpToolDefinition[];
  protocolVersion: string;
  serverName: string;
  serverVersion: string;
}

export interface ResolvedMcpTool {
  server: McpServerConfig;
  tool: McpToolDefinition;
}

export interface McpToolExecutionResult {
  serverId: string;
  serverName: string;
  toolName: string;
  text: string;
  isError: boolean;
}

export interface McpToolExecutionRequest {
  server: McpServerConfig;
  toolName: string;
  args: Record<string, unknown>;
  settings?: AppSettings;
  persistSettings?: (settings: AppSettings) => Promise<void>;
}

export type McpToolExecutionOutcome =
  | { ok: true; result: McpToolExecutionResult }
  | { ok: false; serverName: string; toolName: string; error: string };

function isPrivateIpv4Hostname(hostname: string) {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [first = 0, second = 0] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168);
}

export function normalizeMcpRemoteUrl(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw new Error('请输入完整的 MCP 远程地址。');
  }
  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  if (target.protocol !== 'https:') throw new Error('网页、APK 与 IPA 直连 MCP 必须使用 HTTPS。');
  if (target.username || target.password) throw new Error('请通过请求头配置鉴权，不要把账号密码写在地址中。');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local') || isPrivateIpv4Hostname(hostname) || hostname === '::1' || hostname === '[::1]') {
    throw new Error('请填写用户电脑对外暴露的远程 HTTPS 地址，不能使用 localhost 或局域网地址。');
  }
  target.hash = '';
  return target.href;
}

function createRequestHeaders(server: McpServerConfig, protocolVersion: string, sessionId = '') {
  const headers = new Headers(server.headers);
  if (server.apiKey.trim()) headers.set(server.apiKeyHeader.trim() || 'Authorization', `${server.apiKeyPrefix}${server.apiKey.trim()}`);
  headers.set('Accept', 'application/json, text/event-stream');
  headers.set('Content-Type', 'application/json');
  if (protocolVersion) headers.set('MCP-Protocol-Version', protocolVersion);
  if (sessionId) headers.set('Mcp-Session-Id', sessionId);
  return headers;
}

function parseSseMessages(payload: string) {
  const messages: unknown[] = [];
  for (const block of payload.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (!data || data === '[DONE]') continue;
    try {
      messages.push(JSON.parse(data));
    } catch {
      continue;
    }
  }
  return messages;
}

function parseResponseMessages(payload: string, contentType: string) {
  if (!payload.trim()) return [];
  if (contentType.toLowerCase().includes('text/event-stream')) return parseSseMessages(payload);
  try {
    const parsed = JSON.parse(payload) as unknown;
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    throw new Error('MCP 服务返回了无法解析的响应。');
  }
}

function findJsonRpcResponse(messages: unknown[], responseId: number) {
  return messages.find((item) => item && typeof item === 'object' && !Array.isArray(item) && (item as JsonRpcResponse).id === responseId) as JsonRpcResponse | undefined;
}

async function readSseJsonRpcResponse(response: Response, responseId: number) {
  const reader = response.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const rpcResponse = findJsonRpcResponse(parseSseMessages(block), responseId);
        if (rpcResponse) return rpcResponse;
      }
      if (done) break;
    }
    return findJsonRpcResponse(parseSseMessages(buffer), responseId);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

async function readJsonRpcResponse(response: Response, responseId: number) {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.toLowerCase().includes('text/event-stream')) return readSseJsonRpcResponse(response, responseId);
  return findJsonRpcResponse(parseResponseMessages(await response.text(), contentType), responseId);
}

function formatMcpHttpError(status: number, payload: string) {
  try {
    const parsed = JSON.parse(payload) as { error?: JsonRpcError | string; message?: string };
    const message = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message || parsed.message;
    if (message) return `MCP 请求失败 (${status})：${message}`;
  } catch {
    return `MCP 请求失败 (${status})：${payload.trim().slice(0, 500) || '远程服务没有返回错误详情。'}`;
  }
  return `MCP 请求失败 (${status})。`;
}

class McpHttpSession {
  private requestId = 0;
  private sessionId = '';
  private protocolVersion = defaultProtocolVersion;
  private initialized = false;

  constructor(private readonly server: McpServerConfig) {}

  private async post(message: Record<string, unknown>, responseId?: number) {
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), this.server.timeoutMs);
    try {
      const response = await fetch(this.server.url, {
        method: 'POST',
        headers: createRequestHeaders(this.server, this.initialized ? this.protocolVersion : '', this.sessionId),
        body: JSON.stringify(message),
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store'
      });
      const responseSessionId = response.headers.get('mcp-session-id')?.trim();
      if (responseSessionId) this.sessionId = responseSessionId;
      if (!response.ok) throw new Error(formatMcpHttpError(response.status, await response.text()));
      if (responseId === undefined) {
        await response.body?.cancel().catch(() => undefined);
        return undefined;
      }
      const rpcResponse = await readJsonRpcResponse(response, responseId);
      if (!rpcResponse) throw new Error('MCP 服务没有返回对应的 JSON-RPC 响应。');
      if (rpcResponse.error) throw new Error(`MCP ${rpcResponse.error.code ?? 'error'}：${rpcResponse.error.message || '工具调用失败。'}`);
      return rpcResponse.result;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`MCP 连接超时（${Math.round(this.server.timeoutMs / 1000)} 秒）。`);
      if (error instanceof TypeError) {
        throw new Error('无法直连 MCP。请确认地址可公网访问、证书有效，并允许当前网站来源的 CORS 请求与 MCP 请求头。');
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  private async request<T>(method: string, params: Record<string, unknown> = {}) {
    const id = ++this.requestId;
    return await this.post({ jsonrpc: '2.0', id, method, params }, id) as T;
  }

  private async notify(method: string, params: Record<string, unknown> = {}) {
    await this.post({ jsonrpc: '2.0', method, params });
  }

  async open() {
    const result = await this.request<McpInitializeResult>('initialize', {
      protocolVersion: defaultProtocolVersion,
      capabilities: {},
      clientInfo: {
        name: 'BabyLink',
        version: '0.1.0'
      }
    });
    this.protocolVersion = String(result?.protocolVersion ?? defaultProtocolVersion).trim() || defaultProtocolVersion;
    this.initialized = true;
    await this.notify('notifications/initialized');
    return {
      protocolVersion: this.protocolVersion,
      serverName: String(result?.serverInfo?.name ?? '').trim(),
      serverVersion: String(result?.serverInfo?.version ?? '').trim()
    };
  }

  async listTools() {
    const tools: McpRawTool[] = [];
    let cursor = '';
    for (let page = 0; page < maxToolListPages; page += 1) {
      const result = await this.request<McpToolsListResult>('tools/list', cursor ? { cursor } : {});
      if (Array.isArray(result?.tools)) tools.push(...result.tools);
      cursor = String(result?.nextCursor ?? '').trim();
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>) {
    return await this.request<McpToolCallResultPayload>('tools/call', { name, arguments: args });
  }

  async close() {
    if (!this.sessionId) return;
    try {
      await fetch(this.server.url, {
        method: 'DELETE',
        headers: createRequestHeaders(this.server, this.protocolVersion, this.sessionId),
        credentials: 'omit',
        cache: 'no-store'
      });
    } catch {
      return;
    }
  }
}

function isLikelyReadOnlyTool(tool: McpRawTool) {
  if (tool.annotations?.readOnlyHint === true) return true;
  if (tool.annotations?.destructiveHint === true) return false;
  const signature = `${tool.name ?? ''} ${tool.title ?? ''} ${tool.description ?? ''}`.toLowerCase();
  if (/(?:^|[^a-z])(send|post|publish|comment|reply|like|favorite|follow|delete|remove|create|update|edit|upload|login|logout|message|write|set|add|accept|reject)(?=$|[^a-z])/.test(signature)) return false;
  return /^(get|list|search|read|fetch|find|query|check|status|inspect|lookup|browse|view|show|download|resolve)[_.:-]?/.test(String(tool.name ?? '').toLowerCase());
}

function normalizeDiscoveredTool(tool: McpRawTool, current?: McpToolDefinition): McpToolDefinition | null {
  const name = String(tool.name ?? '').trim();
  if (!name) return null;
  return {
    name,
    title: String(tool.title ?? '').trim(),
    description: String(tool.description ?? '').trim(),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema)
      ? tool.inputSchema
      : { type: 'object', properties: {} },
    enabled: current?.enabled !== false,
    write: !isLikelyReadOnlyTool(tool)
  };
}

export async function inspectMcpServer(server: McpServerConfig): Promise<McpServerInspection> {
  if (server.kind === 'reality') {
    return {
      tools: realityMcpTools.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } })),
      protocolVersion: 'builtin',
      serverName: 'BabyLink Reality MCP',
      serverVersion: '1.0.0'
    };
  }
  const normalizedUrl = normalizeMcpRemoteUrl(server.url);
  const normalizedServer = { ...server, url: normalizedUrl };
  const session = new McpHttpSession(normalizedServer);
  try {
    const serverInfo = await session.open();
    const rawTools = await session.listTools();
    const currentTools = new Map(server.tools.map((tool) => [tool.name, tool]));
    const tools = rawTools
      .map((tool) => normalizeDiscoveredTool(tool, currentTools.get(String(tool.name ?? '').trim())))
      .filter((tool): tool is McpToolDefinition => Boolean(tool));
    return { ...serverInfo, tools: [...new Map(tools.map((tool) => [tool.name, tool])).values()] };
  } finally {
    await session.close();
  }
}

function formatToolContent(content: unknown) {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return String(content ?? '');
  const item = content as Record<string, unknown>;
  if (item.type === 'text') return String(item.text ?? '');
  if (item.type === 'image') return `[图片结果：${String(item.mimeType ?? 'image')}]`;
  if (item.type === 'audio') return `[音频结果：${String(item.mimeType ?? 'audio')}]`;
  if (item.type === 'resource_link') return `[资源链接] ${String(item.name ?? item.uri ?? '')}`;
  if (item.type === 'resource') return `[资源] ${JSON.stringify(item.resource ?? {})}`;
  return JSON.stringify(item);
}

function formatToolCallResult(result: McpToolCallResultPayload | undefined) {
  const parts = Array.isArray(result?.content) ? result.content.map(formatToolContent).filter(Boolean) : [];
  if (result?.structuredContent !== undefined) parts.push(JSON.stringify(result.structuredContent));
  return (parts.join('\n') || '工具执行完成，但没有返回文本内容。').slice(0, maxToolResultLength);
}

function validateMcpToolExecution(server: McpServerConfig, toolName: string) {
  if (server.kind !== 'reality') normalizeMcpRemoteUrl(server.url);
  const configuredTool = server.tools.find((tool) => tool.name === toolName);
  if (!configuredTool?.enabled) throw new Error('该 MCP 工具未启用。');
  if (server.toolPolicy === 'disabled') throw new Error('该 MCP 连接已禁止角色自动调用。');
  if (configuredTool.write && server.toolPolicy !== 'all') throw new Error('该工具会修改外部平台，当前连接仅允许查询工具。');
}

function toMcpToolExecutionResult(server: McpServerConfig, toolName: string, result: McpToolCallResultPayload | undefined): McpToolExecutionResult {
  return {
    serverId: server.id,
    serverName: server.name,
    toolName,
    text: formatToolCallResult(result),
    isError: Boolean(result?.isError)
  };
}

export async function executeMcpTools(requests: McpToolExecutionRequest[]): Promise<McpToolExecutionOutcome[]> {
  const sessions = new Map<string, McpHttpSession>();
  const openedServerIds = new Set<string>();
  const outcomes: McpToolExecutionOutcome[] = [];
  try {
    for (const request of requests) {
      const { server, toolName, args } = request;
      let session: McpHttpSession | undefined;
      try {
        validateMcpToolExecution(server, toolName);
        if (server.kind === 'reality') {
          const result = await executeRealityMcpTool(request);
          outcomes.push({ ok: true, result });
          continue;
        }
        session = sessions.get(server.id);
        if (!session) {
          session = new McpHttpSession(server);
          sessions.set(server.id, session);
        }
        if (!openedServerIds.has(server.id)) {
          await session.open();
          openedServerIds.add(server.id);
        }
        const result = await session.callTool(toolName, args);
        outcomes.push({ ok: true, result: toMcpToolExecutionResult(server, toolName, result) });
      } catch (error) {
        if (session && !openedServerIds.has(server.id)) {
          await session.close();
          sessions.delete(server.id);
        }
        outcomes.push({
          ok: false,
          serverName: server.name,
          toolName,
          error: error instanceof Error ? error.message : 'MCP 工具调用失败。'
        });
      }
    }
  } finally {
    await Promise.all([...sessions.values()].map((session) => session.close()));
  }
  return outcomes;
}

export async function executeMcpTool(server: McpServerConfig, toolName: string, args: Record<string, unknown>): Promise<McpToolExecutionResult> {
  const [outcome] = await executeMcpTools([{ server, toolName, args }]);
  if (!outcome) throw new Error('MCP 工具调用没有返回结果。');
  if (!outcome.ok) throw new Error(outcome.error);
  return outcome.result;
}

export function resolveMcpServers(settings: AppSettings | undefined, character: CharacterProfile) {
  const mcp = settings?.mcpSettings;
  if (!mcp?.enabled) return [];
  const enabledServers = mcp.servers.filter((server) => server.enabled && server.toolPolicy !== 'disabled');
  const binding = character.mcpBinding;
  const selectedIds = new Set(binding?.overrideGlobal
    ? binding.serverIds
    : enabledServers.filter((server) => server.globalEnabled).map((server) => server.id));
  return enabledServers.filter((server) => selectedIds.has(server.id));
}

export function resolveMcpTools(settings: AppSettings | undefined, character: CharacterProfile): ResolvedMcpTool[] {
  return resolveMcpServers(settings, character).flatMap((server) => server.tools
    .filter((tool) => tool.enabled && (!tool.write || server.toolPolicy === 'all'))
    .map((tool) => ({ server, tool })));
}

function inferServerKind(name: string, url: string): McpServerKind {
  const source = `${name} ${url}`.toLowerCase();
  if (/xiaohongshu|小红书|rednote|xhs/.test(source)) return 'xiaohongshu';
  if (/napcat|onebot|\bqq\b/.test(source)) return 'qq';
  return 'custom';
}

export function createMcpServerTemplate(kind: McpServerKind = 'custom'): McpServerConfig {
  if (kind === 'reality') return createBuiltinRealityMcpServer();
  const metadata = kind === 'xiaohongshu'
    ? {
        name: '小红书 MCP',
        description: '在用户电脑运行非官方小红书 MCP，通过反向代理或隧道提供远程 HTTPS Streamable HTTP 地址。'
      }
    : kind === 'qq'
      ? {
          name: 'QQ / NapCat MCP',
          description: '在用户电脑运行 NapCat 与 OneBot MCP 适配器，通过反向代理或隧道提供远程 HTTPS Streamable HTTP 地址。'
        }
      : {
          name: '自定义 MCP',
          description: '兼容 MCP Streamable HTTP 的远程工具服务。'
        };
  return {
    id: createId('mcp'),
    name: metadata.name,
    kind,
    description: metadata.description,
    url: '',
    headers: {},
    apiKey: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    enabled: true,
    globalEnabled: true,
    toolPolicy: 'read-only',
    timeoutMs: 45_000,
    tools: [],
    protocolVersion: '',
    serverName: '',
    serverVersion: '',
    lastStatus: 'idle',
    lastCheckedAt: 0,
    lastError: ''
  };
}

function importEntriesFromRecord(value: Record<string, unknown>) {
  if (value.mcpServers && typeof value.mcpServers === 'object' && !Array.isArray(value.mcpServers)) {
    return Object.entries(value.mcpServers as Record<string, unknown>);
  }
  if (Array.isArray(value.servers)) return value.servers.map((entry, index) => [`MCP ${index + 1}`, entry] as const);
  if (typeof value.url === 'string' || typeof value.endpoint === 'string' || typeof value.serverUrl === 'string') return [[String(value.name ?? 'MCP Server'), value] as const];
  return Object.entries(value);
}

export function importMcpServers(payload: string) {
  const trimmedPayload = payload.trim();
  if (/^https:\/\//i.test(trimmedPayload)) {
    const server = createMcpServerTemplate();
    server.url = normalizeMcpRemoteUrl(trimmedPayload);
    return [server];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmedPayload);
  } catch {
    throw new Error('MCP 配置不是有效 JSON。');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('MCP 配置必须是 JSON 对象。');
  const servers: McpServerConfig[] = [];
  let stdioCount = 0;
  for (const [fallbackName, rawEntry] of importEntriesFromRecord(parsed as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) continue;
    const entry = rawEntry as Record<string, unknown>;
    if (entry.command || entry.args) {
      stdioCount += 1;
      continue;
    }
    const url = String(entry.url ?? entry.endpoint ?? entry.serverUrl ?? '').trim();
    if (!url) continue;
    const normalizedUrl = normalizeMcpRemoteUrl(url);
    const name = String(entry.name ?? fallbackName).trim() || 'MCP Server';
    const importedKind = entry.kind === 'qq' || entry.kind === 'xiaohongshu' || entry.kind === 'custom'
      ? entry.kind
      : inferServerKind(name, normalizedUrl);
    const server = createMcpServerTemplate(importedKind);
    server.name = name;
    server.url = normalizedUrl;
    server.description = String(entry.description ?? server.description).trim();
    server.apiKey = String(entry.apiKey ?? entry.token ?? '').trim();
    const importedHeaders: Record<string, string> = entry.headers && typeof entry.headers === 'object' && !Array.isArray(entry.headers)
      ? Object.fromEntries(Object.entries(entry.headers).map(([key, value]) => [key.trim(), String(value ?? '').trim()]).filter(([key, value]) => key && value))
      : {};
    const placeholderHeader = Object.entries(importedHeaders).find(([, value]) => /(?:\$\{?API_KEY\}?|\{\{\s*API_KEY\s*\}\}|<API_KEY>)/i.test(value));
    if (placeholderHeader) {
      const [headerName, headerTemplate] = placeholderHeader;
      server.apiKeyHeader = headerName;
      server.apiKeyPrefix = headerTemplate.replace(/(?:\$\{?API_KEY\}?|\{\{\s*API_KEY\s*\}\}|<API_KEY>)/i, '');
      delete importedHeaders[headerName];
    } else {
      server.apiKeyHeader = String(entry.apiKeyHeader ?? entry.authHeader ?? server.apiKeyHeader).trim() || server.apiKeyHeader;
      server.apiKeyPrefix = String(entry.apiKeyPrefix ?? entry.authPrefix ?? server.apiKeyPrefix).replace(/[\r\n]/g, '');
    }
    server.headers = importedHeaders;
    servers.push(server);
  }
  if (!servers.length && stdioCount) throw new Error('检测到本地 stdio MCP。网页、APK 和 IPA 只能导入远程 HTTPS Streamable HTTP MCP。');
  if (!servers.length) throw new Error('配置中没有找到可用的远程 MCP 地址。');
  return servers;
}
