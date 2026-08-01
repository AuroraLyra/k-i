import Ajv, { type ValidateFunction } from 'ajv';
import type { AppSettings, CharacterProfile, ChatMcpResultAttachment, McpServerConfig, McpServerKind, McpToolDefinition } from '@/types/domain';
import { createBuiltinNotificationInboxMcpServer, createBuiltinRealityMcpServer, notificationInboxMcpTools, realityMcpTools } from '@/data/realityMcp';
import { fetchNativeMcpLocal, nativeMcpLocalAvailable } from '@/services/nativeMcpLocal';
import { executeRealityMcpTool } from '@/services/realityMcp';
import { createActiveTimeout, isFetchInterruptedError, waitForActiveNetworkWindow } from '@/utils/activeTimeout';
import { createId } from '@/utils/id';
import { getMcpToolAccessState, mcpToolAccessError, resolveAllowedMcpTools } from '@/utils/mcpAccess';
import { createMcpResultAttachment } from '@/utils/mcpResults';

const defaultProtocolVersion = '2025-06-18';
const mcpProxyPath = '/__mcp-proxy';
const maxToolResultLength = 12_000;
const maxToolListPages = 20;
const schemaValidator = new Ajv({ allErrors: true, allowUnionTypes: true, strict: false, validateFormats: false });
const toolSchemaValidators = new Map<string, ValidateFunction>();

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

interface McpTransport {
  url: string;
  proxied: boolean;
  nativeLocal: boolean;
  jobUrl: string;
  jobStatusBaseUrl: string;
}

interface McpProxyJobStartPayload {
  jobId?: string;
}

interface McpProxyJobDonePayload {
  status?: string;
  response?: {
    status?: number;
    statusText?: string;
    headers?: {
      contentType?: string;
      contentLength?: string;
      mcpSessionId?: string;
    };
    bodyBase64?: string;
  };
}

class McpSessionExpiredError extends Error {}

class McpTransportError extends Error {}

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
  structuredResults?: ChatMcpResultAttachment[];
}

export interface McpToolExecutionRequest {
  server: McpServerConfig;
  toolName: string;
  args: Record<string, unknown>;
  settings?: AppSettings;
  persistSettings?: (settings: AppSettings) => Promise<void>;
}

function isBuiltinDeviceMcpServer(server: McpServerConfig) {
  return server.kind === 'reality' || server.kind === 'notification-inbox';
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

function isLoopbackHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || /^127\.(?:\d{1,3}\.){2}\d{1,3}$/.test(hostname)
    || hostname === '::1'
    || hostname === '[::1]';
}

function canUseSameOriginMcpProxy() {
  return typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol);
}

function createMcpTransportUrl(rawUrl: string): McpTransport {
  const normalizedUrl = normalizeMcpRemoteUrl(rawUrl);
  const target = new URL(normalizedUrl);
  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  if (canUseSameOriginMcpProxy() && target.protocol === 'https:' && !isLoopbackHostname(hostname)) {
    const encodedUrl = encodeURIComponent(normalizedUrl);
    return {
      url: `${mcpProxyPath}?url=${encodedUrl}`,
      proxied: true,
      nativeLocal: false,
      jobUrl: `${mcpProxyPath}/jobs?url=${encodedUrl}`,
      jobStatusBaseUrl: `${mcpProxyPath}/jobs/`
    };
  }
  return {
    url: normalizedUrl,
    proxied: false,
    nativeLocal: isLoopbackHostname(hostname) && nativeMcpLocalAvailable(),
    jobUrl: '',
    jobStatusBaseUrl: ''
  };
}

function decodeBase64Bytes(value: string) {
  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function createMcpProxyJobResponse(payload: McpProxyJobDonePayload) {
  const responsePayload = payload.response;
  if (!responsePayload) throw new McpTransportError('MCP 后台作业没有返回响应。');
  const headers = new Headers();
  if (responsePayload.headers?.contentType) headers.set('Content-Type', responsePayload.headers.contentType);
  if (responsePayload.headers?.contentLength) headers.set('Content-Length', responsePayload.headers.contentLength);
  if (responsePayload.headers?.mcpSessionId) headers.set('Mcp-Session-Id', responsePayload.headers.mcpSessionId);
  const status = Math.max(100, Math.min(599, Math.round(Number(responsePayload.status) || 502)));
  const body = decodeBase64Bytes(String(responsePayload.bodyBase64 ?? ''));
  return new Response([204, 205, 304].includes(status) ? null : body, {
    status,
    statusText: String(responsePayload.statusText ?? ''),
    headers
  });
}

async function parseMcpProxyJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new McpTransportError(fallbackMessage);
  }
}

async function fetchMcpProxyJob(transport: McpTransport, init: RequestInit, signal: AbortSignal) {
  const startResponse = await fetch(transport.jobUrl, {
    method: 'POST',
    headers: init.headers,
    body: init.body,
    credentials: 'same-origin',
    cache: 'no-store',
    signal
  });
  if (!startResponse.ok) return startResponse;
  const startPayload = await parseMcpProxyJson<McpProxyJobStartPayload>(startResponse, 'MCP 后台作业创建失败。');
  const jobId = String(startPayload.jobId ?? '').trim();
  if (!jobId) throw new McpTransportError('MCP 后台作业没有返回 ID。');

  while (true) {
    const resultResponse = await fetch(`${transport.jobStatusBaseUrl}${encodeURIComponent(jobId)}`, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      signal
    });
    if (resultResponse.status === 202) {
      await waitForActiveNetworkWindow(600);
      continue;
    }
    if (!resultResponse.ok) return resultResponse;
    return createMcpProxyJobResponse(await parseMcpProxyJson<McpProxyJobDonePayload>(resultResponse, 'MCP 后台作业返回异常。'));
  }
}

export function normalizeMcpRemoteUrl(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl.trim());
  } catch {
    throw new Error('请输入完整的 MCP 远程地址。');
  }
  const hostname = target.hostname.toLowerCase().replace(/\.$/, '');
  const loopback = isLoopbackHostname(hostname);
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && loopback)) {
    throw new Error('MCP 必须使用 HTTPS；仅同一台设备上的 localhost、127.0.0.1 或 [::1] 可使用 HTTP。');
  }
  if (target.username || target.password) throw new Error('请通过请求头配置鉴权，不要把账号密码写在地址中。');
  if (!hostname || hostname.endsWith('.local') || (isPrivateIpv4Hostname(hostname) && !loopback)) {
    throw new Error('请填写公开 HTTPS 地址；局域网地址不可用，本机回环地址除外。');
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

async function waitForMcpRetryOpportunity(delayMs = 800) {
  await waitForActiveNetworkWindow(delayMs);
}

class McpHttpSession {
  private requestId = 0;
  private sessionId = '';
  private protocolVersion = defaultProtocolVersion;
  private initialized = false;
  private readonly transport: McpTransport;

  constructor(private readonly server: McpServerConfig) {
    this.transport = createMcpTransportUrl(server.url);
  }

  private async post(message: Record<string, unknown>, responseId?: number) {
    const timeout = createActiveTimeout(this.server.timeoutMs);
    const requestSessionId = this.sessionId;
    try {
      const requestInit: RequestInit = {
        method: 'POST',
        headers: createRequestHeaders(this.server, this.initialized ? this.protocolVersion : '', this.sessionId),
        body: JSON.stringify(message),
        signal: timeout.signal,
        credentials: this.transport.proxied ? 'same-origin' : 'omit',
        cache: 'no-store'
      };
      const response = this.transport.proxied
        ? await fetchMcpProxyJob(this.transport, requestInit, timeout.signal)
        : this.transport.nativeLocal
          ? await fetchNativeMcpLocal(this.transport.url, requestInit, this.server.timeoutMs)
          : await fetch(this.transport.url, requestInit);
      const responseSessionId = response.headers.get('mcp-session-id')?.trim();
      if (responseSessionId) this.sessionId = responseSessionId;
      if (!response.ok) {
        const payload = await response.text();
        const message = formatMcpHttpError(response.status, payload);
        if (requestSessionId && (response.status === 404 || response.status === 410)) throw new McpSessionExpiredError(message);
        throw new Error(message);
      }
      if (responseId === undefined) {
        await response.body?.cancel().catch(() => undefined);
        return undefined;
      }
      const rpcResponse = await readJsonRpcResponse(response, responseId);
      if (!rpcResponse) throw new Error('MCP 服务没有返回对应的 JSON-RPC 响应。');
      if (rpcResponse.error) throw new Error(`MCP ${rpcResponse.error.code ?? 'error'}：${rpcResponse.error.message || '工具调用失败。'}`);
      return rpcResponse.result;
    } catch (error) {
      if (timeout.signal.aborted) throw new Error(`MCP 连接超时（${Math.round(this.server.timeoutMs / 1000)} 秒有效运行时间，后台挂起不计时）。`);
      if (error instanceof McpSessionExpiredError || error instanceof McpTransportError) throw error;
      if (isFetchInterruptedError(error)) {
        throw new McpTransportError('MCP 请求在页面后台或切换期间被浏览器中断，已等待页面恢复后重试。');
      }
      if (error instanceof TypeError) {
        throw new McpTransportError('无法直连 MCP。请确认当前设备能访问该地址；公开地址证书有效；服务允许当前网站来源的 CORS 请求与 MCP 请求头。');
      }
      throw error;
    } finally {
      timeout.dispose();
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

  reset() {
    this.sessionId = '';
    this.protocolVersion = defaultProtocolVersion;
    this.initialized = false;
  }

  async close() {
    if (!this.sessionId) return;
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), Math.min(5_000, this.server.timeoutMs));
    try {
      const requestInit: RequestInit = {
        method: 'DELETE',
        headers: createRequestHeaders(this.server, this.protocolVersion, this.sessionId),
        signal: controller.signal,
        credentials: this.transport.proxied ? 'same-origin' : 'omit',
        cache: 'no-store',
        keepalive: true
      };
      if (this.transport.nativeLocal) await fetchNativeMcpLocal(this.transport.url, requestInit, Math.min(5_000, this.server.timeoutMs));
      else await fetch(this.transport.url, requestInit);
    } catch {
      return;
    } finally {
      globalThis.clearTimeout(timer);
    }
  }
}

async function openMcpSessionWithRecovery(session: McpHttpSession) {
  try {
    return await session.open();
  } catch (error) {
    if (!(error instanceof McpTransportError) && !(error instanceof McpSessionExpiredError)) throw error;
    if (error instanceof McpTransportError) await waitForMcpRetryOpportunity();
    session.reset();
    return await session.open();
  }
}

async function recoverMcpSession(session: McpHttpSession, error: unknown) {
  if (error instanceof McpTransportError) await waitForMcpRetryOpportunity();
  session.reset();
  return await openMcpSessionWithRecovery(session);
}

function isLikelyReadOnlyTool(tool: McpRawTool) {
  if (tool.annotations?.readOnlyHint === true) return true;
  if (tool.annotations?.destructiveHint === true) return false;
  const signature = `${tool.name ?? ''} ${tool.title ?? ''} ${tool.description ?? ''}`.toLowerCase();
  if (/(?:^|[^a-z])(send|post|publish|comment|reply|like|favorite|follow|delete|remove|create|update|edit|upload|login|logout|message|write|set|add|accept|reject)(?=$|[^a-z])/.test(signature)) return false;
  return /^(get|list|search|read|fetch|find|query|check|status|inspect|lookup|browse|view|show|download|resolve)[_.:-]?/.test(String(tool.name ?? '').toLowerCase());
}

function normalizeDiscoveredTool(tool: McpRawTool): McpToolDefinition | null {
  const name = String(tool.name ?? '').trim();
  if (!name) return null;
  return {
    name,
    title: String(tool.title ?? '').trim(),
    description: String(tool.description ?? '').trim(),
    inputSchema: tool.inputSchema && typeof tool.inputSchema === 'object' && !Array.isArray(tool.inputSchema)
      ? tool.inputSchema
      : { type: 'object', properties: {} },
    enabled: true,
    write: !isLikelyReadOnlyTool(tool)
  };
}

export async function inspectMcpServer(server: McpServerConfig): Promise<McpServerInspection> {
  if (isBuiltinDeviceMcpServer(server)) {
    const builtinTools = server.kind === 'notification-inbox' ? notificationInboxMcpTools : realityMcpTools;
    return {
      tools: builtinTools.map((tool) => ({
        ...tool,
        inputSchema: { ...tool.inputSchema },
        enabled: true
      })),
      protocolVersion: 'builtin',
      serverName: server.kind === 'notification-inbox' ? 'BabyLink Notification Inbox MCP' : 'BabyLink Reality MCP',
      serverVersion: '1.0.0'
    };
  }
  const normalizedUrl = normalizeMcpRemoteUrl(server.url);
  const normalizedServer = { ...server, url: normalizedUrl };
  const session = new McpHttpSession(normalizedServer);
  try {
    let serverInfo = await openMcpSessionWithRecovery(session);
    let rawTools: McpRawTool[];
    try {
      rawTools = await session.listTools();
    } catch (error) {
      if (!(error instanceof McpSessionExpiredError) && !(error instanceof McpTransportError)) throw error;
      serverInfo = await recoverMcpSession(session, error);
      rawTools = await session.listTools();
    }
    const tools = rawTools
      .map(normalizeDiscoveredTool)
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

function schemaValidatorKey(server: McpServerConfig, tool: McpToolDefinition) {
  return `${server.id}:${tool.name}:${JSON.stringify(tool.inputSchema)}`;
}

function validateMcpToolArguments(server: McpServerConfig, tool: McpToolDefinition, args: Record<string, unknown>) {
  const key = schemaValidatorKey(server, tool);
  let validate = toolSchemaValidators.get(key);
  if (!validate) {
    try {
      validate = schemaValidator.compile(tool.inputSchema);
      toolSchemaValidators.set(key, validate);
    } catch (error) {
      throw new Error(`工具参数规则无效，已阻止调用：${error instanceof Error ? error.message : '无法编译 JSON Schema。'}`);
    }
  }
  if (validate(args)) return;
  const detail = (validate.errors ?? [])
    .slice(0, 3)
    .map((error) => `${error.instancePath || '参数'} ${error.message ?? '无效'}`)
    .join('；');
  throw new Error(`工具参数不符合 ${tool.name} 的输入规则：${detail || '参数无效。'}`);
}

function validateMcpToolExecution(server: McpServerConfig, toolName: string, args: Record<string, unknown>) {
  if (!isBuiltinDeviceMcpServer(server)) normalizeMcpRemoteUrl(server.url);
  const configuredTool = server.tools.find((tool) => tool.name === toolName);
  if (!configuredTool) throw new Error('该 MCP 服务没有这个工具，重新检测连接后再试。');
  const accessState = getMcpToolAccessState(server, configuredTool);
  if (accessState !== 'allowed') throw new Error(mcpToolAccessError(accessState));
  validateMcpToolArguments(server, configuredTool, args);
  return configuredTool;
}

function toMcpToolExecutionResult(server: McpServerConfig, toolName: string, result: McpToolCallResultPayload | undefined): McpToolExecutionResult {
  const structuredResult = result?.isError ? null : createMcpResultAttachment({
    serverId: server.id,
    serverName: server.name,
    toolName
  }, result ?? {});
  return {
    serverId: server.id,
    serverName: server.name,
    toolName,
    text: formatToolCallResult(result),
    isError: Boolean(result?.isError),
    ...(structuredResult ? { structuredResults: [structuredResult] } : {})
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
        const configuredTool = validateMcpToolExecution(server, toolName, args);
        if (isBuiltinDeviceMcpServer(server)) {
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
          await openMcpSessionWithRecovery(session);
          openedServerIds.add(server.id);
        }
        let result: McpToolCallResultPayload | undefined;
        try {
          result = await session.callTool(toolName, args);
        } catch (error) {
          const sessionRejected = error instanceof McpSessionExpiredError;
          const safeTransportRetry = error instanceof McpTransportError && configuredTool?.write === false;
          if (!sessionRejected && !safeTransportRetry) {
            if (error instanceof McpTransportError && configuredTool?.write) {
              throw new Error('MCP 写入工具执行期间连接中断；为避免重复操作未自动重试，请先确认外部平台是否已经完成。');
            }
            throw error;
          }
          await recoverMcpSession(session, error);
          result = await session.callTool(toolName, args);
        }
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
  const enabledServers = mcp.servers.filter((server) => server.enabled);
  const binding = character.mcpBinding;
  const selectedIds = new Set(binding?.overrideGlobal
    ? binding.serverIds
    : enabledServers.filter((server) => server.globalEnabled).map((server) => server.id));
  return enabledServers.filter((server) => selectedIds.has(server.id));
}

export function resolveMcpTools(settings: AppSettings | undefined, character: CharacterProfile): ResolvedMcpTool[] {
  return resolveMcpServers(settings, character).flatMap((server) => resolveAllowedMcpTools(server)
    .map((tool) => ({ server, tool })));
}

function inferServerKind(name: string, url: string): McpServerKind {
  const source = `${name} ${url}`.toLowerCase();
  if (/termux|babylink android|安卓本机/.test(source)) return 'termux';
  if (/napcat|onebot|\bqq\b/.test(source)) return 'qq';
  if (/taobao|taoke|淘宝|天猫|tmall/.test(source)) return 'taobao-search';
  if (/douyin|抖音/.test(source)) return 'douyin-search';
  if (/xiaohongshu|小红书|rednote|xhs/.test(source)) return 'xiaohongshu-search';
  return 'custom';
}

export function createMcpServerTemplate(kind: McpServerKind = 'custom'): McpServerConfig {
  if (kind === 'reality') return createBuiltinRealityMcpServer();
  if (kind === 'notification-inbox') return createBuiltinNotificationInboxMcpServer();
  const metadata = kind === 'termux'
    ? {
        name: 'BabyLink Termux 本机网关',
        description: '在当前 Android 手机的 Termux 中运行，聚合 B 站、豆瓣、音乐、地图、快递、菜谱、价格追踪、通知和可配置 MCP 上游。'
      }
    : kind === 'xiaohongshu'
    ? {
        name: '小红书 MCP',
        description: '在用户电脑运行非官方小红书 MCP，通过反向代理或隧道提供远程 HTTPS Streamable HTTP 地址。'
      }
    : kind === 'qq'
      ? {
          name: 'QQ / NapCat MCP',
          description: '在用户电脑运行 NapCat 与 OneBot MCP 适配器，通过反向代理或隧道提供远程 HTTPS Streamable HTTP 地址。'
        }
      : kind === 'taobao-search'
        ? {
            name: '淘宝商品搜索 MCP',
            description: '真实淘宝联盟物料搜索。可参考 liuliang520530/taoke-mcp 自托管；服务端需保管淘宝联盟 PID、Session 与配置服务凭据，跨设备时仅向 BabyLink 暴露带鉴权的 HTTPS /mcp。'
          }
        : kind === 'douyin-search'
          ? {
              name: '抖音视频搜索 MCP',
              description: '真实抖音视频搜索。参考 pazwusimple-netizen/douyin-mcp 自托管，并将默认 stdio 改造或包装为 Streamable HTTP；跨设备时使用带鉴权的 HTTPS，Cookie 只保存在服务端。'
            }
          : kind === 'xiaohongshu-search'
            ? {
                name: '小红书内容搜索 MCP',
                description: '真实小红书笔记搜索。参考 xpzouying/xiaohongshu-mcp 自托管；同机可连接回环 HTTP /mcp，跨设备时必须通过 HTTPS 反向代理增加鉴权，登录态只保存在服务端。'
              }
            : {
                name: '自定义 MCP',
                description: '兼容 MCP Streamable HTTP 的远程工具服务。'
              };
  const platformSearch = kind === 'taobao-search' || kind === 'douyin-search' || kind === 'xiaohongshu-search';
  return {
    id: createId('mcp'),
    name: metadata.name,
    kind,
    description: metadata.description,
    url: kind === 'termux' ? 'http://127.0.0.1:8765/mcp' : '',
    headers: {},
    apiKey: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    enabled: true,
    globalEnabled: true,
    toolPolicy: 'all',
    timeoutMs: platformSearch || kind === 'termux' ? 120_000 : 45_000,
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
  if (/^https?:\/\//i.test(trimmedPayload)) {
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
    const importedKind = entry.kind === 'qq'
      || entry.kind === 'xiaohongshu'
      || entry.kind === 'termux'
      || entry.kind === 'taobao-search'
      || entry.kind === 'douyin-search'
      || entry.kind === 'xiaohongshu-search'
      || entry.kind === 'custom'
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
