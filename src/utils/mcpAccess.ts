import type { McpServerConfig, McpToolDefinition } from '@/types/domain';

export type McpToolAccessState = 'allowed' | 'server-disabled' | 'service-disabled' | 'tool-disabled' | 'read-only';

export function getMcpToolAccessState(server: McpServerConfig, tool: McpToolDefinition): McpToolAccessState {
  if (!server.enabled) return 'server-disabled';
  if (server.toolPolicy === 'disabled') return 'service-disabled';
  if (!tool.enabled) return 'tool-disabled';
  if (server.toolPolicy === 'read-only' && tool.write) return 'read-only';
  return 'allowed';
}

export function resolveAllowedMcpTools(server: McpServerConfig) {
  return server.tools.filter((tool) => getMcpToolAccessState(server, tool) === 'allowed');
}

export function mcpToolAccessError(state: Exclude<McpToolAccessState, 'allowed'>) {
  if (state === 'server-disabled') return '这个 MCP 服务已停用。';
  if (state === 'service-disabled') return '这个 MCP 服务已禁止角色调用。';
  if (state === 'tool-disabled') return '这个 MCP 工具已被停用。';
  return '当前 MCP 服务只允许读取和查询，不能执行此操作。';
}