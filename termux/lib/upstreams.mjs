import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const protocolVersion = '2025-06-18';

function cleanPrefix(value, fallback) {
  return String(value || fallback || 'upstream').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'upstream';
}

function parseMessages(text, contentType) {
  if (!text.trim()) return [];
  if (!String(contentType).toLowerCase().includes('text/event-stream')) {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  }
  return text.split(/\r?\n\r?\n/).flatMap((block) => {
    const data = block.split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();
    if (!data || data === '[DONE]') return [];
    try {
      return [JSON.parse(data)];
    } catch {
      return [];
    }
  });
}

function validateHttpUrl(rawUrl) {
  const target = new URL(String(rawUrl || '').trim());
  const hostname = target.hostname.toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  if (!(target.protocol === 'https:' || (target.protocol === 'http:' && loopback))) {
    throw new Error('上游 HTTP MCP 必须使用 HTTPS，本机回环服务除外。');
  }
  if (target.username || target.password) throw new Error('上游地址不能包含账号密码。');
  target.hash = '';
  return target.href;
}

function likelyReadOnlyTool(tool) {
  if (tool?.annotations?.readOnlyHint === true) return true;
  if (tool?.annotations?.destructiveHint === true) return false;
  const signature = `${tool?.name || ''} ${tool?.title || ''} ${tool?.description || ''}`.toLowerCase();
  if (/(?:^|[^a-z])(send|post|publish|comment|reply|like|favorite|follow|delete|remove|create|update|edit|upload|login|logout|message|write|set|add|accept|reject)(?=$|[^a-z])/.test(signature)) return false;
  return /^(get|list|search|read|fetch|find|query|check|status|inspect|lookup|browse|view|show|download|resolve)[_.:-]?/.test(String(tool?.name || '').toLowerCase());
}

class HttpUpstream {
  constructor(config) {
    this.id = String(config.id || config.name || 'http');
    this.name = String(config.name || this.id);
    this.prefix = cleanPrefix(config.prefix, this.id);
    this.url = validateHttpUrl(config.url);
    this.headers = Object.fromEntries(Object.entries(config.headers || {}).map(([name, value]) => [name, String(value)]));
    this.readOnly = config.readOnly !== false;
    this.allowedTools = new Set(Array.isArray(config.allowedTools) ? config.allowedTools.map(String).filter(Boolean) : []);
    this.timeoutMs = Math.max(3000, Math.min(120000, Number(config.timeoutMs) || 45000));
    this.requestId = 0;
    this.sessionId = '';
    this.initialized = false;
  }

  async post(message, responseId) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers = {
        ...this.headers,
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': protocolVersion,
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {})
      };
      const response = await fetch(this.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        redirect: 'manual',
        signal: controller.signal
      });
      const sessionId = response.headers.get('mcp-session-id');
      if (sessionId) this.sessionId = sessionId;
      const text = await response.text();
      if (!response.ok) throw new Error(`${this.name} 返回 ${response.status}：${text.slice(0, 500)}`);
      if (responseId === undefined) return undefined;
      const rpc = parseMessages(text, response.headers.get('content-type')).find((entry) => entry?.id === responseId);
      if (!rpc) throw new Error(`${this.name} 没有返回对应的 JSON-RPC 响应。`);
      if (rpc.error) throw new Error(`${this.name}：${rpc.error.message || '工具调用失败。'}`);
      return rpc.result;
    } finally {
      clearTimeout(timer);
    }
  }

  async request(method, params = {}) {
    const id = ++this.requestId;
    return await this.post({ jsonrpc: '2.0', id, method, params }, id);
  }

  async initialize() {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'BabyLink Termux Gateway', version: '0.1.0' }
    });
    this.initialized = true;
    await this.post({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  }

  async listTools() {
    await this.initialize();
    const tools = [];
    let cursor = '';
    for (let page = 0; page < 20; page += 1) {
      const result = await this.request('tools/list', cursor ? { cursor } : {});
      if (Array.isArray(result?.tools)) tools.push(...result.tools);
      cursor = String(result?.nextCursor || '');
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(name, args) {
    await this.initialize();
    return await this.request('tools/call', { name, arguments: args });
  }

  async close() {
    if (!this.sessionId) return;
    await fetch(this.url, {
      method: 'DELETE',
      headers: { ...this.headers, 'Mcp-Session-Id': this.sessionId },
      redirect: 'manual'
    }).catch(() => undefined);
    this.sessionId = '';
    this.initialized = false;
  }
}

class StdioUpstream {
  constructor(config) {
    this.id = String(config.id || config.name || 'stdio');
    this.name = String(config.name || this.id);
    this.prefix = cleanPrefix(config.prefix, this.id);
    this.command = String(config.command || '');
    this.args = Array.isArray(config.args) ? config.args.map(String) : [];
    this.cwd = config.cwd ? String(config.cwd) : undefined;
    this.env = Object.fromEntries(Object.entries(config.env || {}).map(([name, value]) => [name, String(value)]));
    this.readOnly = config.readOnly !== false;
    this.allowedTools = new Set(Array.isArray(config.allowedTools) ? config.allowedTools.map(String).filter(Boolean) : []);
    this.timeoutMs = Math.max(3000, Math.min(120000, Number(config.timeoutMs) || 45000));
    this.requestId = 0;
    this.child = null;
    this.pending = new Map();
    this.initialized = false;
  }

  start() {
    if (this.child && !this.child.killed) return;
    if (!this.command) throw new Error(`${this.name} 缺少启动命令。`);
    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false
    });
    const output = createInterface({ input: this.child.stdout });
    output.on('line', (line) => this.handleLine(line));
    this.child.stderr.on('data', (chunk) => process.stderr.write(`[${this.name}] ${String(chunk).slice(0, 4000)}`));
    this.child.once('exit', (code, signal) => {
      const error = new Error(`${this.name} 已退出（${code ?? signal ?? 'unknown'}）。`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
      this.child = null;
      this.initialized = false;
    });
  }

  handleLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    const pending = this.pending.get(message?.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) pending.reject(new Error(`${this.name}：${message.error.message || '工具调用失败。'}`));
    else pending.resolve(message.result);
  }

  notify(method, params = {}) {
    this.start();
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  request(method, params = {}) {
    this.start();
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${this.name} 请求超时。`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }

  async initialize() {
    if (this.initialized) return;
    await this.request('initialize', {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: 'BabyLink Termux Gateway', version: '0.1.0' }
    });
    this.initialized = true;
    this.notify('notifications/initialized');
  }

  async listTools() {
    await this.initialize();
    const tools = [];
    let cursor = '';
    for (let page = 0; page < 20; page += 1) {
      const result = await this.request('tools/list', cursor ? { cursor } : {});
      if (Array.isArray(result?.tools)) tools.push(...result.tools);
      cursor = String(result?.nextCursor || '');
      if (!cursor) break;
    }
    return tools;
  }

  async callTool(name, args) {
    await this.initialize();
    return await this.request('tools/call', { name, arguments: args });
  }

  async close() {
    if (this.child) this.child.kill('SIGTERM');
    this.child = null;
    this.initialized = false;
  }
}

export function createUpstreams(config) {
  const http = Array.isArray(config.httpServers) ? config.httpServers.filter((entry) => entry?.enabled).map((entry) => new HttpUpstream(entry)) : [];
  const stdio = Array.isArray(config.stdioServers) ? config.stdioServers.filter((entry) => entry?.enabled).map((entry) => new StdioUpstream(entry)) : [];
  return [...http, ...stdio];
}

export async function discoverUpstreamTools(upstreams) {
  const tools = [];
  for (const upstream of upstreams) {
    try {
      const discovered = await upstream.listTools();
      for (const tool of discovered) {
        const name = String(tool?.name || '').trim();
        if (!name) continue;
        const explicitlyAllowed = upstream.allowedTools.has(name);
        if (upstream.allowedTools.size && !explicitlyAllowed) continue;
        if (upstream.readOnly && !explicitlyAllowed && !likelyReadOnlyTool(tool)) continue;
        tools.push({
          ...tool,
          name: `${upstream.prefix}__${name}`,
          title: `${upstream.name} · ${tool.title || name}`,
          annotations: {
            ...tool.annotations,
            ...(upstream.readOnly ? { readOnlyHint: true, destructiveHint: false } : {})
          },
          _upstream: upstream,
          _upstreamToolName: name
        });
      }
    } catch (error) {
      process.stderr.write(`[${upstream.name}] 工具发现失败：${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  return tools;
}