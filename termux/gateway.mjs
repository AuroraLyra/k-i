import { timingSafeEqual, randomUUID } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnectors } from './lib/connectors.mjs';
import { createUpstreams, discoverUpstreamTools } from './lib/upstreams.mjs';

const protocolVersion = '2025-06-18';
const maximumRequestBytes = 1024 * 1024;
const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const configPath = resolve(process.env.BABYLINK_MCP_CONFIG || `${process.env.HOME || moduleDirectory}/.config/babylink-mcp/config.json`);

function expandEnvironment(value) {
  if (Array.isArray(value)) return value.map(expandEnvironment);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, expandEnvironment(entry)]));
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (_, name) => process.env[name] || '');
}

async function loadConfig() {
  const raw = JSON.parse(await readFile(configPath, 'utf8'));
  const config = expandEnvironment(raw);
  config.host = String(config.host || '127.0.0.1');
  config.port = Math.max(1, Math.min(65535, Number(config.port) || 8765));
  config.token = String(config.token || '').trim();
  config.dataDirectory = String(config.dataDirectory || `${process.env.HOME || moduleDirectory}/.local/share/babylink-mcp`);
  config.allowedOrigins = Array.isArray(config.allowedOrigins) ? config.allowedOrigins.map(String) : [];
  if (config.host !== '127.0.0.1' && config.host !== '::1' && config.host !== 'localhost') {
    throw new Error('Termux 网关只允许监听回环地址；远程访问请使用 HTTPS 隧道。');
  }
  if (config.token.length < 32) throw new Error('BABYLINK MCP Token 至少需要 32 个字符。');
  return config;
}

function tokenMatches(expected, provided) {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  return expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes);
}

function bearerToken(request) {
  const match = String(request.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function jsonResponse(response, status, payload, extraHeaders = {}) {
  const body = payload === undefined ? '' : JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(body);
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

async function readJsonBody(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumRequestBytes) throw Object.assign(new Error('请求体超过 1 MB。'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('请求体不是有效 JSON。'), { statusCode: 400 });
  }
}

function publicTool(tool) {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema || { type: 'object', properties: {} },
    annotations: tool.annotations || {}
  };
}

function businessFailure(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  if (payload.isError === true || payload.ok === false || payload.success === false || payload.status === 'failed' || payload.status === 'error') {
    return String(payload.message || payload.error || payload.reason || 'upstream_business_failed');
  }
  if (typeof payload.retcode === 'number' && payload.retcode !== 0) return `${String(payload.msg || payload.message || 'upstream_failed')}: retcode ${payload.retcode}`;
  return '';
}

function businessReceipt(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const nested = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data) ? payload.data : {};
  for (const key of ['message_id', 'messageId', 'operation_id', 'operationId', 'receipt', 'eventId', 'event_id', 'id']) {
    const value = payload[key] ?? nested[key];
    if (typeof value === 'string' || typeof value === 'number') {
      const receipt = String(value).trim();
      if (receipt) return receipt;
    }
  }
  return '';
}

function toolPayload(payload, tool) {
  const structuredContent = payload?.structuredContent ?? payload ?? {};
  const failure = businessFailure(structuredContent) || (payload?.isError ? 'upstream_mcp_error' : '');
  if (failure) {
    const result = { completed: false, error: failure, upstream: structuredContent };
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      structuredContent: result,
      isError: true
    };
  }
  const receipt = businessReceipt(structuredContent);
  const write = tool?.annotations?.readOnlyHint !== true;
  const result = write && !receipt
    ? { completed: false, unknown: true, upstream: structuredContent }
    : { completed: true, ...(receipt ? { receipt } : {}), upstream: structuredContent };
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
    structuredContent: result,
    isError: false
  };
}

const config = await loadConfig();
await mkdir(config.dataDirectory, { recursive: true });
const auditPath = resolve(config.dataDirectory, 'audit.jsonl');
const connectors = createConnectors(config);
const upstreams = createUpstreams(config);
const sessions = new Map();
let upstreamToolCache = [];
let upstreamToolCacheAt = 0;

async function audit(event) {
  const entry = { at: new Date().toISOString(), ...event };
  await appendFile(auditPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 }).catch(() => undefined);
}

async function currentUpstreamTools(force = false) {
  if (!force && Date.now() - upstreamToolCacheAt < 60_000) return upstreamToolCache;
  upstreamToolCache = await discoverUpstreamTools(upstreams);
  upstreamToolCacheAt = Date.now();
  return upstreamToolCache;
}

async function allTools() {
  return [...connectors.tools, ...(await currentUpstreamTools())];
}

async function callTool(name, args) {
  const builtIn = connectors.tools.find((tool) => tool.name === name);
  if (builtIn) return toolPayload(await connectors.call(name, args), builtIn);
  let upstreamTool = (await currentUpstreamTools()).find((tool) => tool.name === name);
  if (!upstreamTool) upstreamTool = (await currentUpstreamTools(true)).find((tool) => tool.name === name);
  if (!upstreamTool) throw new Error(`没有找到工具 ${name}。`);
  return toolPayload(await upstreamTool._upstream.callTool(upstreamTool._upstreamToolName, args), upstreamTool);
}

function applyCors(request, response) {
  const origin = String(request.headers.origin || '');
  if (origin && config.allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id');
    response.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  }
}

function authenticate(request, response) {
  if (tokenMatches(config.token, bearerToken(request))) return true;
  jsonResponse(response, 401, { error: { message: 'Bearer Token 无效。' } }, { 'WWW-Authenticate': 'Bearer' });
  return false;
}

async function handleRpc(request, response, message) {
  if (!message || typeof message !== 'object' || Array.isArray(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    jsonResponse(response, 400, rpcError(message?.id, -32600, '无效 JSON-RPC 请求。'));
    return;
  }

  const isInitialize = message.method === 'initialize';
  let sessionId = String(request.headers['mcp-session-id'] || '').trim();
  if (!isInitialize && (!sessionId || !sessions.has(sessionId))) {
    jsonResponse(response, 404, rpcError(message.id, -32001, 'MCP 会话不存在或已过期。'));
    return;
  }

  if (isInitialize) {
    sessionId = randomUUID();
    sessions.set(sessionId, { createdAt: Date.now(), lastSeenAt: Date.now(), initialized: false });
    jsonResponse(response, 200, rpcResult(message.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: true } },
      serverInfo: { name: 'BabyLink Termux Gateway', version: '0.1.0' }
    }), { 'Mcp-Session-Id': sessionId });
    return;
  }

  const session = sessions.get(sessionId);
  session.lastSeenAt = Date.now();
  if (message.method === 'notifications/initialized') {
    session.initialized = true;
    response.writeHead(202, { 'Content-Length': '0', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  if (!session.initialized) {
    jsonResponse(response, 400, rpcError(message.id, -32002, '请先完成 MCP 初始化。'));
    return;
  }

  if (message.method === 'tools/list') {
    jsonResponse(response, 200, rpcResult(message.id, { tools: (await allTools()).map(publicTool) }));
    return;
  }

  if (message.method === 'tools/call') {
    const name = String(message.params?.name || '').trim();
    const args = message.params?.arguments && typeof message.params.arguments === 'object' && !Array.isArray(message.params.arguments)
      ? message.params.arguments
      : {};
    const startedAt = Date.now();
    try {
      const result = await callTool(name, args);
      await audit({ type: 'tool', tool: name, ok: true, durationMs: Date.now() - startedAt });
      jsonResponse(response, 200, rpcResult(message.id, result));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await audit({ type: 'tool', tool: name, ok: false, durationMs: Date.now() - startedAt, error: errorMessage.slice(0, 500) });
      jsonResponse(response, 200, rpcResult(message.id, {
        content: [{ type: 'text', text: errorMessage }],
        isError: true
      }));
    }
    return;
  }

  jsonResponse(response, 200, rpcError(message.id, -32601, `不支持的方法 ${message.method}。`));
}

const server = createServer(async (request, response) => {
  applyCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Content-Length': '0' });
    response.end();
    return;
  }
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    jsonResponse(response, 200, { ok: true, service: 'babylink-termux-gateway', version: '0.1.0', upstreams: upstreams.length, uptimeSeconds: Math.round(process.uptime()) });
    return;
  }
  if (requestUrl.pathname !== '/mcp') {
    jsonResponse(response, 404, { error: { message: 'Not Found' } });
    return;
  }
  if (!authenticate(request, response)) return;
  if (request.method === 'DELETE') {
    const sessionId = String(request.headers['mcp-session-id'] || '').trim();
    sessions.delete(sessionId);
    response.writeHead(204, { 'Content-Length': '0', 'Cache-Control': 'no-store' });
    response.end();
    return;
  }
  if (request.method !== 'POST') {
    jsonResponse(response, 405, { error: { message: 'Method Not Allowed' } }, { Allow: 'POST, DELETE, OPTIONS' });
    return;
  }
  try {
    await handleRpc(request, response, await readJsonBody(request));
  } catch (error) {
    const status = Number(error?.statusCode) || 500;
    jsonResponse(response, status, { error: { message: status >= 500 ? 'Termux 网关内部错误。' : error.message } });
    await audit({ type: 'request', ok: false, error: String(error?.message || error).slice(0, 500) });
  }
});

const sessionCleanupTimer = setInterval(() => {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [sessionId, session] of sessions) if (session.lastSeenAt < cutoff) sessions.delete(sessionId);
}, 5 * 60_000);
sessionCleanupTimer.unref();

const configuredPriceInterval = Number(config.priceCheckIntervalMinutes);
const priceIntervalMinutes = Number.isFinite(configuredPriceInterval) ? configuredPriceInterval : 180;
const priceTimer = priceIntervalMinutes > 0
  ? setInterval(() => connectors.checkPriceTracks(true).catch((error) => audit({ type: 'price-check', ok: false, error: error.message })), Math.max(15, priceIntervalMinutes) * 60_000)
  : null;
priceTimer?.unref();

server.listen(config.port, config.host, () => {
  process.stdout.write(`BabyLink Termux MCP 已监听 http://${config.host}:${config.port}/mcp\n`);
  process.stdout.write(`健康检查：http://${config.host}:${config.port}/health\n`);
  process.stdout.write(`配对信息：node ${resolve(moduleDirectory, 'pairing.mjs')}\n`);
});

async function shutdown() {
  clearInterval(sessionCleanupTimer);
  if (priceTimer) clearInterval(priceTimer);
  server.close();
  await Promise.all(upstreams.map((upstream) => upstream.close()));
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);