import type { ChatMcpOperation, ChatMcpOperationState } from '@/types/domain';

const stateLabels: Record<ChatMcpOperationState, string> = {
  running: '正在调用',
  completed: '已完成',
  initiated: '已发起',
  'awaiting-user': '等待你在系统中确认',
  'requires-permission': '需要系统授权',
  cancelled: '已取消',
  unsupported: '当前设备不支持',
  unknown: '结果未知',
  failed: '调用失败'
};

export function mcpOperationStateLabel(state: ChatMcpOperationState) {
  return stateLabels[state];
}

export function formatChatMcpOperation(operation: ChatMcpOperation, options: { includeArguments?: boolean; includeResult?: boolean } = {}) {
  const lines = [
    `【MCP 行动 · ${mcpOperationStateLabel(operation.state)}】`,
    `服务：${operation.serverName}`,
    `工具：${operation.toolName}`
  ];
  if (options.includeArguments !== false && Object.keys(operation.arguments).length) {
    lines.push(`参数：${JSON.stringify(operation.arguments)}`);
  }
  if (operation.receipt) lines.push(`回执：${operation.receipt}`);
  if (options.includeResult !== false && operation.result.trim()) lines.push(`结果：${operation.result.trim()}`);
  return lines.join('\n');
}

export function formatChatMcpOperations(operations: ChatMcpOperation[], options: { includeArguments?: boolean; includeResult?: boolean } = {}) {
  return operations.map((operation) => formatChatMcpOperation(operation, options)).join('\n\n');
}
