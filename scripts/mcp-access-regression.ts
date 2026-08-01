import assert from 'node:assert/strict';
import type { McpServerConfig, McpToolDefinition } from '../src/types/domain';
import { getMcpToolAccessState, resolveAllowedMcpTools } from '../src/utils/mcpAccess';

const readTool: McpToolDefinition = {
  name: 'search_notes',
  title: '搜索笔记',
  description: '读取笔记内容',
  inputSchema: { type: 'object', properties: {} },
  enabled: true,
  write: false
};

const writeTool: McpToolDefinition = {
  name: 'create_note',
  title: '创建笔记',
  description: '写入笔记内容',
  inputSchema: { type: 'object', properties: {} },
  enabled: true,
  write: true
};

function createServer(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: 'test-server',
    name: '测试服务',
    kind: 'custom',
    description: '',
    url: 'https://mcp.example.com/mcp',
    headers: {},
    apiKey: '',
    apiKeyHeader: 'Authorization',
    apiKeyPrefix: 'Bearer ',
    enabled: true,
    globalEnabled: true,
    toolPolicy: 'all',
    timeoutMs: 30_000,
    tools: [readTool, writeTool],
    protocolVersion: '',
    serverName: '',
    serverVersion: '',
    lastStatus: 'connected',
    lastCheckedAt: 0,
    lastError: '',
    ...overrides
  };
}

const allToolsServer = createServer();
assert.equal(getMcpToolAccessState(allToolsServer, writeTool), 'allowed');
assert.deepEqual(resolveAllowedMcpTools(allToolsServer).map((tool) => tool.name), ['search_notes', 'create_note']);

const readOnlyServer = createServer({ toolPolicy: 'read-only' });
assert.equal(getMcpToolAccessState(readOnlyServer, readTool), 'allowed');
assert.equal(getMcpToolAccessState(readOnlyServer, writeTool), 'read-only');
assert.deepEqual(resolveAllowedMcpTools(readOnlyServer).map((tool) => tool.name), ['search_notes']);

const disabledToolServer = createServer({ tools: [readTool, { ...writeTool, enabled: false }] });
assert.equal(getMcpToolAccessState(disabledToolServer, disabledToolServer.tools[1]!), 'tool-disabled');
assert.deepEqual(resolveAllowedMcpTools(disabledToolServer).map((tool) => tool.name), ['search_notes']);

assert.equal(getMcpToolAccessState(createServer({ toolPolicy: 'disabled' }), readTool), 'service-disabled');
assert.equal(getMcpToolAccessState(createServer({ enabled: false }), readTool), 'server-disabled');

console.log('MCP access regression checks passed.');