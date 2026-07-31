import type { McpServerConfig } from '@/types/domain';
import type { RoleOperationCapability, RoleOutboundAction, RoleSocialPlatform, UserSocialAccount, UserSocialManualAction, UserSocialReadAction, UserSocialReadCapability } from '@/types/roleOperations';

export const roleOperationToolCandidates: Record<RoleSocialPlatform, Partial<Record<RoleOutboundAction, string[]>>> = {
  xiaohongshu: {
    like: ['xhs_like_note'],
    publish: ['xhs_publish_note'],
    comment: ['xhs_comment_note'],
    'direct-message': ['xhs_send_direct_message']
  },
  douyin: {
    like: ['douyin_like_video', 'douyin_like_note'],
    publish: ['douyin_publish_note', 'douyin_publish_video'],
    comment: ['douyin_comment_video', 'douyin_comment_note'],
    'direct-message': ['douyin_send_direct_message']
  },
  qq: {
    'direct-message': ['qq_send_private_msg', 'qq_send_group_msg'],
    'share-to-user': ['qq_send_private_msg', 'qq_send_group_msg']
  },
  'system-share': {}
};

export const userSocialReadToolCandidates: Record<UserSocialAccount['platform'], Record<UserSocialReadAction, string[]>> = {
  xiaohongshu: {
    profile: ['xhs_get_user_profile', 'xhs_user_profile', 'get_user_profile', 'user_profile'],
    posts: ['xhs_get_user_notes', 'xhs_get_user_posts', 'get_user_notes', 'get_user_posts'],
    search: ['xhs_search_notes', 'search_notes', 'search_feeds'],
    detail: ['xhs_get_note', 'get_note', 'get_feed_detail'],
    comments: ['xhs_get_note_comments', 'get_note_comments', 'get_feed_comments']
  },
  douyin: {
    profile: ['douyin_get_user_info', 'get_user_info'],
    posts: ['douyin_get_user_posts', 'get_user_posts'],
    search: ['douyin_search_videos', 'search_videos'],
    detail: ['douyin_get_video_detail', 'get_video_detail'],
    comments: ['douyin_get_video_comments', 'get_video_comments']
  }
};

export const userSocialManualToolCandidates: Record<UserSocialAccount['platform'], Record<UserSocialManualAction, string[]>> = {
  xiaohongshu: {
    like: ['xhs_like_note', 'like_note', 'like_feed'],
    comment: ['xhs_comment_note', 'comment_note', 'comment_feed'],
    'direct-message': ['xhs_send_direct_message', 'send_direct_message', 'send_message']
  },
  douyin: {
    like: ['douyin_like_video', 'douyin_like_note', 'like_video', 'like_aweme'],
    comment: ['douyin_comment_video', 'douyin_comment_note', 'comment_video', 'comment_aweme'],
    'direct-message': ['douyin_send_direct_message', 'send_direct_message', 'send_message']
  }
};

function toolMatchesCandidate(toolName: string, candidate: string) {
  const normalizedToolName = toolName.toLowerCase();
  const normalizedCandidate = candidate.toLowerCase();
  return normalizedToolName === normalizedCandidate
    || normalizedToolName.endsWith(`__${normalizedCandidate}`)
    || normalizedToolName.endsWith(`_${normalizedCandidate}`);
}

export function findServerTool(server: McpServerConfig, candidates: string[], write: boolean) {
  return candidates
    .map((candidate) => server.tools.find((tool) => toolMatchesCandidate(tool.name, candidate) && tool.enabled && tool.write === write))
    .find((tool) => tool) ?? null;
}

export function suggestedAccountCapabilities(platform: RoleSocialPlatform, server?: McpServerConfig | null): RoleOperationCapability[] {
  if (platform === 'system-share') return ['share-to-user'];
  const tools = server?.tools ?? [];
  const supports = (action: RoleOutboundAction) => {
    const candidates = roleOperationToolCandidates[platform][action] ?? [];
    return Boolean(server && findServerTool(server, candidates, true));
  };
  return [
    ...(supports('like') ? ['like'] as RoleOperationCapability[] : []),
    ...(supports('publish') ? ['publish'] as RoleOperationCapability[] : []),
    ...(supports('comment') ? ['comment'] as RoleOperationCapability[] : []),
    ...(supports('direct-message') ? ['direct-message'] as RoleOperationCapability[] : []),
    ...(supports('share-to-user') ? ['share-to-user'] as RoleOperationCapability[] : []),
    ...(tools.some((tool) => /schedule|publish_draft/i.test(tool.name) && tool.enabled && tool.write) ? ['schedule'] as RoleOperationCapability[] : []),
    ...(tools.some((tool) => /metrics|creator/i.test(tool.name) && tool.enabled && !tool.write) ? ['metrics'] as RoleOperationCapability[] : [])
  ];
}

export function suggestedUserAccountCapabilities(platform: UserSocialAccount['platform'], server?: McpServerConfig | null): UserSocialReadCapability[] {
  if (!server || !server.enabled || server.toolPolicy === 'disabled') return [];
  return (Object.keys(userSocialReadToolCandidates[platform]) as UserSocialReadAction[])
    .filter((action) => Boolean(findServerTool(server, userSocialReadToolCandidates[platform][action], false)));
}
