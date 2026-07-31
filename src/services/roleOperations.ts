import { executeMcpTool } from '@/services/mcp';
import { shareText } from '@/services/nativeFile';
import { findServerTool, roleOperationToolCandidates, userSocialManualToolCandidates, userSocialReadToolCandidates } from '@/services/roleOperationCapabilities';
import type { AppSettings, McpServerConfig } from '@/types/domain';
import type { RoleContentDraft, RoleOperationAuditEntry, RoleOperationPolicy, RoleOperationTaskStatus, RoleOutboundAction, RoleOutboundTask, RoleSocialAccount, RoleSocialPlatform, UserSocialAccount, UserSocialManualAction, UserSocialReadAction } from '@/types/roleOperations';
import { createId } from '@/utils/id';

export { suggestedAccountCapabilities, suggestedUserAccountCapabilities } from '@/services/roleOperationCapabilities';

export function createDefaultRoleOperationPolicy(characterId: string): RoleOperationPolicy {
  return {
    characterId,
    paused: false,
    approvalMode: 'always',
    maxWritesPerHour: 6,
    maxWritesPerDay: 24,
    quietHoursStart: '23:00',
    quietHoursEnd: '08:00',
    recipientAllowlist: [],
    topicAllowlist: [],
    blockedKeywords: [],
    maxRetries: 1,
    updatedAt: Date.now()
  };
}

export function createRoleContentDraft(input: Omit<RoleContentDraft, 'id' | 'status' | 'createdAt' | 'updatedAt'>): RoleContentDraft {
  const now = Date.now();
  return { ...input, id: createId('role-draft'), status: 'draft', createdAt: now, updatedAt: now };
}

export function createRoleOutboundTask(input: Omit<RoleOutboundTask, 'id' | 'status' | 'requiresApproval' | 'approvedAt' | 'startedAt' | 'completedAt' | 'retryCount' | 'executionReference' | 'errorSummary' | 'createdAt' | 'updatedAt'>, policy: RoleOperationPolicy): RoleOutboundTask {
  const now = Date.now();
  const scheduled = Boolean(input.scheduledAt && input.scheduledAt > now);
  const requiresApproval = policy.approvalMode === 'always';
  return {
    ...input,
    id: createId('role-task'),
    status: requiresApproval ? 'awaiting-approval' : scheduled ? 'scheduled' : 'draft',
    requiresApproval,
    approvedAt: null,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    executionReference: '',
    errorSummary: '',
    createdAt: now,
    updatedAt: now
  };
}

export function operationAudit(task: RoleOutboundTask, status: RoleOperationAuditEntry['status'], summary: string): RoleOperationAuditEntry {
  return {
    id: createId('role-audit'),
    characterId: task.characterId,
    accountId: task.accountId,
    taskId: task.id,
    platform: task.platform,
    action: task.action,
    status,
    summary: summarize(summary),
    createdAt: Date.now()
  };
}

function summarize(value: string) {
  return value.replace(/((?:cookie|token|authorization|password|secret|api[_ -]?key))\s*[:=]\s*[^\s,;}]+/gi, '$1: [已脱敏]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280);
}

function contentForTask(task: RoleOutboundTask) {
  return [task.title.trim(), task.body.trim(), task.linkUrl.trim()].filter(Boolean).join('\n');
}

function toMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return -1;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60 ? hours * 60 + minutes : -1;
}

function isQuietHour(policy: RoleOperationPolicy, now: number) {
  const start = toMinutes(policy.quietHoursStart);
  const end = toMinutes(policy.quietHoursEnd);
  if (start < 0 || end < 0 || start === end) return false;
  const date = new Date(now);
  const current = date.getHours() * 60 + date.getMinutes();
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function taskContainsBlockedKeyword(task: RoleOutboundTask, keywords: string[]) {
  const content = `${task.title}\n${task.body}\n${task.linkUrl}`.toLowerCase();
  return keywords.map((keyword) => keyword.trim()).find((keyword) => keyword && content.includes(keyword.toLowerCase())) ?? '';
}

function resolvesToAutoTrustedTask(task: RoleOutboundTask, policy: RoleOperationPolicy) {
  if (policy.approvalMode !== 'trusted-auto') return false;
  if (!task.recipient.trim()) return task.action === 'publish';
  return policy.recipientAllowlist.includes(task.recipient.trim());
}

function selectedTool(server: McpServerConfig, account: RoleSocialAccount, task: RoleOutboundTask) {
  const override = account.toolOverrides?.[task.action]?.trim();
  const candidates = override ? [override] : roleOperationToolCandidates[task.platform][task.action] ?? [];
  const qqCandidates = task.platform === 'qq' && ['direct-message', 'share-to-user'].includes(task.action)
    ? task.recipientType === 'group' ? ['qq_send_group_msg'] : ['qq_send_private_msg']
    : candidates;
  return findServerTool(server, qqCandidates, true);
}

function toolArguments(task: RoleOutboundTask) {
  const content = contentForTask(task);
  if (task.platform === 'xiaohongshu') {
    if (task.action === 'like') return { note_id: task.recipient.trim() };
    if (task.action === 'publish') return { title: task.title.trim(), content: task.body.trim(), images: task.mediaUrls };
    if (task.action === 'comment') return { note_id: task.recipient.trim(), content };
    return { user_id: task.recipient.trim(), content };
  }
  if (task.platform === 'qq') {
    return task.recipientType === 'group'
      ? { group_id: task.recipient.trim(), message: content }
      : { user_id: task.recipient.trim(), message: content };
  }
  if (task.platform === 'douyin') {
    if (task.action === 'like') return { aweme_id: task.recipient.trim() };
    if (task.action === 'publish') return { title: task.title.trim(), content: task.body.trim(), images: task.mediaUrls };
    if (task.action === 'comment') return { aweme_id: task.recipient.trim(), content };
    return { user_id: task.recipient.trim(), content };
  }
  return {};
}

export interface RoleOperationPreflightInput {
  settings: AppSettings;
  account: RoleSocialAccount | null;
  task: RoleOutboundTask;
  policy: RoleOperationPolicy;
  audits: RoleOperationAuditEntry[];
  appendConversationEvent?: (conversationId: string, content: string) => Promise<unknown>;
  now?: number;
}

export interface UserSocialLookupInput {
  settings: AppSettings;
  account: UserSocialAccount | null;
  characterId: string;
  action: UserSocialReadAction;
  query: string;
}

export interface UserSocialLookupResult {
  ok: boolean;
  summary: string;
  toolName: string;
  text: string;
}

export interface UserSocialManualActionInput {
  settings: AppSettings;
  account: UserSocialAccount | null;
  action: UserSocialManualAction;
  recipient: string;
  content: string;
}

export interface UserSocialManualActionResult {
  ok: boolean;
  summary: string;
  toolName: string;
  text: string;
}

function lookupArguments(account: UserSocialAccount, action: UserSocialReadAction, query: string) {
  const value = query.trim() || account.accountId.trim();
  if (account.platform === 'xiaohongshu') {
    if (action === 'profile' || action === 'posts') return { user_id: value };
    if (action === 'search') return { keyword: query.trim() };
    return { note_id: value };
  }
  if (action === 'profile' || action === 'posts') return { user_id: value };
  if (action === 'search') return { keyword: query.trim() };
  return { aweme_id: value };
}

export async function executeUserSocialLookup(input: UserSocialLookupInput): Promise<UserSocialLookupResult> {
  const { account, action } = input;
  if (!account) return { ok: false, summary: '未找到该用户的平台账号。', toolName: '', text: '' };
  if (!account.characterIds.includes(input.characterId)) return { ok: false, summary: '该用户账号尚未授权给当前角色查询。', toolName: '', text: '' };
  if (!account.enabled) return { ok: false, summary: '该用户平台账号已暂停查询。', toolName: '', text: '' };
  if (action === 'search' && !input.query.trim()) return { ok: false, summary: '请输入要搜索的关键词。', toolName: '', text: '' };
  if (['profile', 'posts', 'detail', 'comments'].includes(action) && !input.query.trim() && !account.accountId.trim()) {
    return { ok: false, summary: '请填写用户账号或内容 ID。', toolName: '', text: '' };
  }
  const server = input.settings.mcpSettings.servers.find((entry) => entry.id === account.serverId) ?? null;
  if (!server || !server.enabled || server.toolPolicy === 'disabled') {
    return { ok: false, summary: '用户账号对应的 MCP 查询连接不可用。', toolName: '', text: '' };
  }
  const tool = findServerTool(server, userSocialReadToolCandidates[account.platform][action], false);
  if (!tool) return { ok: false, summary: '该连接没有提供已启用的只读查询工具。', toolName: '', text: '' };
  try {
    const result = await executeMcpTool(server, tool.name, lookupArguments(account, action, input.query));
    if (result.isError) return { ok: false, summary: summarize(result.text) || '平台拒绝了查询请求。', toolName: tool.name, text: result.text };
    return { ok: true, summary: '已读取用户平台账号信息。', toolName: tool.name, text: result.text };
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? summarize(error.message) : '用户账号查询失败。', toolName: tool.name, text: '' };
  }
}

function manualActionArguments(account: UserSocialAccount, action: UserSocialManualAction, recipient: string, content: string) {
  if (account.platform === 'xiaohongshu') {
    if (action === 'like') return { note_id: recipient };
    if (action === 'comment') return { note_id: recipient, content };
    return { user_id: recipient, content };
  }
  if (action === 'like') return { aweme_id: recipient };
  if (action === 'comment') return { aweme_id: recipient, content };
  return { user_id: recipient, content };
}

export async function executeUserSocialManualAction(input: UserSocialManualActionInput): Promise<UserSocialManualActionResult> {
  const { account, action } = input;
  if (!account) return { ok: false, summary: '请先选择用户自己的平台账号。', toolName: '', text: '' };
  if (!account.enabled) return { ok: false, summary: '该用户平台账号已暂停。', toolName: '', text: '' };
  if (!input.recipient.trim()) return { ok: false, summary: action === 'direct-message' ? '请填写收件人 ID。' : '请填写目标内容 ID。', toolName: '', text: '' };
  if (action !== 'like' && !input.content.trim()) return { ok: false, summary: '请填写要发送的内容。', toolName: '', text: '' };
  const server = input.settings.mcpSettings.servers.find((entry) => entry.id === account.serverId) ?? null;
  if (!server || !server.enabled || server.toolPolicy !== 'all') {
    return { ok: false, summary: '此操作需要已明确允许写入的 MCP 连接。', toolName: '', text: '' };
  }
  const tool = findServerTool(server, userSocialManualToolCandidates[account.platform][action], true);
  if (!tool) return { ok: false, summary: '该连接没有提供已启用的手动写入工具。', toolName: '', text: '' };
  try {
    const result = await executeMcpTool(server, tool.name, manualActionArguments(account, action, input.recipient.trim(), input.content.trim()));
    if (result.isError) return { ok: false, summary: summarize(result.text) || '平台拒绝了手动操作。', toolName: tool.name, text: result.text };
    return { ok: true, summary: '平台已确认本次手动操作。', toolName: tool.name, text: result.text };
  } catch (error) {
    return { ok: false, summary: error instanceof Error ? summarize(error.message) : '手动操作失败。', toolName: tool.name, text: '' };
  }
}

export interface RoleOperationPreflightResult {
  ok: boolean;
  error: string;
  server: McpServerConfig | null;
  toolName: string;
}

export function preflightRoleOperation(input: RoleOperationPreflightInput): RoleOperationPreflightResult {
  const now = input.now ?? Date.now();
  const { account, task, policy } = input;
  if (!account || account.characterId !== task.characterId) return { ok: false, error: '未找到该角色的运营账号。', server: null, toolName: '' };
  if (!account.enabled) return { ok: false, error: '该角色账号已暂停。', server: null, toolName: '' };
  if (policy.paused) return { ok: false, error: '角色运营总开关已暂停。', server: null, toolName: '' };
  if (task.status === 'cancelled' || task.status === 'succeeded') return { ok: false, error: '该任务已结束，不能再次执行。', server: null, toolName: '' };
  if (task.scheduledAt && task.scheduledAt > now) return { ok: false, error: '尚未到计划执行时间。', server: null, toolName: '' };
  if (task.requiresApproval && !task.approvedAt) return { ok: false, error: '任务仍在等待你的确认。', server: null, toolName: '' };
  if (!task.approvedAt && !resolvesToAutoTrustedTask(task, policy)) return { ok: false, error: '此任务不满足可信自动执行条件。', server: null, toolName: '' };
  if (isQuietHour(policy, now)) return { ok: false, error: '当前处于角色设置的静默时段。', server: null, toolName: '' };
  const blockedKeyword = taskContainsBlockedKeyword(task, policy.blockedKeywords);
  if (blockedKeyword) return { ok: false, error: `内容命中拦截词「${blockedKeyword}」。`, server: null, toolName: '' };
  if (task.action === 'publish' && policy.topicAllowlist.length) {
    const content = `${task.title}\n${task.body}`.toLowerCase();
    const matchesTopic = policy.topicAllowlist.some((topic) => topic.trim() && content.includes(topic.trim().toLowerCase()));
    if (!matchesTopic) return { ok: false, error: '发布内容未命中允许的话题范围。', server: null, toolName: '' };
  }
  if (task.retryCount > policy.maxRetries) return { ok: false, error: '已达到该角色任务的最大重试次数。', server: null, toolName: '' };
  if (task.recipient.trim() && policy.recipientAllowlist.length && !policy.recipientAllowlist.includes(task.recipient.trim())) {
    return { ok: false, error: '收件人不在角色允许名单内。', server: null, toolName: '' };
  }
  const successfulWrites = input.audits.filter((audit) => audit.status === 'succeeded' || audit.status === 'shared');
  if (successfulWrites.filter((audit) => audit.createdAt > now - 60 * 60 * 1000).length >= policy.maxWritesPerHour) {
    return { ok: false, error: '已达到角色每小时写入上限。', server: null, toolName: '' };
  }
  if (successfulWrites.filter((audit) => audit.createdAt > now - 24 * 60 * 60 * 1000).length >= policy.maxWritesPerDay) {
    return { ok: false, error: '已达到角色每日写入上限。', server: null, toolName: '' };
  }
  if (task.platform === 'system-share') return { ok: true, error: '', server: null, toolName: 'system-share' };
  const server = input.settings.mcpSettings.servers.find((entry) => entry.id === account.serverId) ?? null;
  if (!server || !server.enabled || server.toolPolicy !== 'all') {
    return { ok: false, error: '账号对应的 MCP 写入连接不可用或只读。', server, toolName: '' };
  }
  const tool = selectedTool(server, account, task);
  if (!tool) return { ok: false, error: '连接没有提供此操作需要的已启用写工具。', server, toolName: '' };
  return { ok: true, error: '', server, toolName: tool.name };
}

export async function executeRoleOperation(input: RoleOperationPreflightInput) {
  const check = preflightRoleOperation(input);
  if (!check.ok) return { ok: false, check, reference: '', summary: check.error };
  if (input.task.platform === 'system-share') {
    if (input.task.conversationId && input.appendConversationEvent) {
      await input.appendConversationEvent(input.task.conversationId, contentForTask(input.task));
      return { ok: true, check, reference: `conversation:${input.task.conversationId}`, summary: '已发送到 BabyLink 角色私聊。' };
    }
    await shareText(input.task.title || '来自角色的分享', input.task.body, input.task.linkUrl);
    return { ok: true, check, reference: 'system-share', summary: '已打开系统分享面板。' };
  }
  const result = await executeMcpTool(check.server!, check.toolName, toolArguments(input.task));
  if (result.isError) return { ok: false, check, reference: '', summary: summarize(result.text) || '外部平台拒绝了该操作。' };
  return { ok: true, check, reference: `${check.server!.id}:${check.toolName}`, summary: summarize(result.text) || '外部平台已确认操作。' };
}

export function nextTaskStatusAfterApproval(task: RoleOutboundTask, now = Date.now()): RoleOperationTaskStatus {
  return task.scheduledAt && task.scheduledAt > now ? 'scheduled' : 'draft';
}