export type RoleSocialPlatform = 'xiaohongshu' | 'douyin' | 'qq' | 'system-share';

export type RoleOperationCapability = 'like' | 'publish' | 'comment' | 'direct-message' | 'share-to-user' | 'schedule' | 'metrics';

export type UserSocialReadCapability = 'profile' | 'posts' | 'search' | 'detail' | 'comments';

export type UserSocialReadAction = UserSocialReadCapability;

export type UserSocialManualAction = 'like' | 'comment' | 'direct-message';

export type RoleSocialAccountStatus = 'unknown' | 'connected' | 'offline' | 'error';

export type RoleOutboundAction = 'like' | 'publish' | 'comment' | 'direct-message' | 'share-to-user';

export type RoleOperationTaskStatus = 'draft' | 'awaiting-approval' | 'scheduled' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'blocked';

export interface RoleOperationPolicy {
  characterId: string;
  paused: boolean;
  approvalMode: 'always' | 'trusted-auto';
  maxWritesPerHour: number;
  maxWritesPerDay: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  recipientAllowlist: string[];
  topicAllowlist: string[];
  blockedKeywords: string[];
  maxRetries: number;
  updatedAt: number;
}

export interface RoleSocialAccount {
  id: string;
  characterId: string;
  platform: RoleSocialPlatform;
  displayName: string;
  accountId: string;
  serverId: string;
  enabled: boolean;
  status: RoleSocialAccountStatus;
  capabilities: RoleOperationCapability[];
  toolOverrides?: Partial<Record<RoleOutboundAction, string>>;
  lastCheckedAt: number;
  lastError: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserSocialAccount {
  id: string;
  userId: string;
  characterIds: string[];
  platform: Extract<RoleSocialPlatform, 'xiaohongshu' | 'douyin'>;
  displayName: string;
  accountId: string;
  serverId: string;
  enabled: boolean;
  status: RoleSocialAccountStatus;
  capabilities: UserSocialReadCapability[];
  lastCheckedAt: number;
  lastError: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoleContentDraft {
  id: string;
  characterId: string;
  accountId: string;
  platform: RoleSocialPlatform;
  title: string;
  body: string;
  mediaUrls: string[];
  linkUrl: string;
  source: 'manual' | 'chat' | 'imported';
  status: 'draft' | 'queued' | 'published' | 'cancelled';
  scheduledAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoleOutboundTask {
  id: string;
  characterId: string;
  accountId: string;
  draftId?: string;
  platform: RoleSocialPlatform;
  action: RoleOutboundAction;
  title: string;
  body: string;
  mediaUrls: string[];
  linkUrl: string;
  recipient: string;
  recipientType: 'private' | 'group' | 'note' | 'user' | 'none';
  conversationId?: string;
  status: RoleOperationTaskStatus;
  requiresApproval: boolean;
  approvedAt: number | null;
  scheduledAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  retryCount: number;
  executionReference: string;
  errorSummary: string;
  createdAt: number;
  updatedAt: number;
}

export interface RoleOperationAuditEntry {
  id: string;
  characterId: string;
  accountId: string;
  taskId: string;
  platform: RoleSocialPlatform;
  action: RoleOutboundAction;
  status: 'queued' | 'approved' | 'rejected' | 'started' | 'succeeded' | 'failed' | 'blocked' | 'cancelled' | 'shared';
  summary: string;
  createdAt: number;
}

export interface RoleOperationsSnapshot {
  roleSocialAccounts: RoleSocialAccount[];
  userSocialAccounts: UserSocialAccount[];
  roleContentDrafts: RoleContentDraft[];
  roleOutboundTasks: RoleOutboundTask[];
  roleOperationPolicies: RoleOperationPolicy[];
  roleOperationAudits: RoleOperationAuditEntry[];
}