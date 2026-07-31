import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import QRCode from 'qrcode';
import { auditToolCall, guardToolCall, readAuditEntries, securitySummary } from './lib/security.mjs';

const port = Number(process.env.BABYLINK_BRIDGE_PORT || 8787);
const host = process.env.BABYLINK_BRIDGE_HOST || '127.0.0.1';
const token = String(process.env.BABYLINK_BRIDGE_TOKEN || '').trim();
let publicUrl = String(process.env.BABYLINK_BRIDGE_PUBLIC_URL || '').trim().replace(/\/$/, '');
const platform = String(process.env.BABYLINK_BRIDGE_PLATFORM || 'qq').trim().toLowerCase();
const oneBotUrl = String(process.env.QQ_ONEBOT_URL || 'http://127.0.0.1:3000').trim().replace(/\/$/, '');
const oneBotToken = String(process.env.QQ_ONEBOT_TOKEN || '').trim();
const xhsAdapterUrl = String(process.env.XHS_ADAPTER_URL || '').trim().replace(/\/$/, '');
const xhsAdapterToken = String(process.env.XHS_ADAPTER_TOKEN || '').trim();
const douyinAdapterUrl = String(process.env.DOUYIN_ADAPTER_URL || '').trim().replace(/\/$/, '');
const douyinAdapterToken = String(process.env.DOUYIN_ADAPTER_TOKEN || '').trim();
const tlsKeyPath = String(process.env.BABYLINK_BRIDGE_TLS_KEY || '').trim();
const tlsCertPath = String(process.env.BABYLINK_BRIDGE_TLS_CERT || '').trim();
const sessions = new Set();

if (!token) {
  console.error('BABYLINK_BRIDGE_TOKEN is required.');
  process.exit(1);
}

const stringProperty = (description) => ({ type: 'string', description });
const objectSchema = (properties, required = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {})
});

const qqTools = [
  {
    name: 'qq_get_login_status',
    title: 'QQ 登录状态',
    description: '读取用户电脑上 NapCat/OneBot 的 QQ 登录状态。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'qq_get_friend_list',
    title: 'QQ 好友列表',
    description: '读取用户自己的 QQ 好友列表。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'qq_get_group_list',
    title: 'QQ群列表',
    description: '读取用户自己的 QQ 群列表。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'qq_get_group_member_list',
    title: 'QQ群成员',
    description: '读取指定 QQ 群的成员列表。',
    inputSchema: objectSchema({ group_id: { type: ['string', 'number'], description: 'QQ群号' } }, ['group_id']),
    readOnlyHint: true
  },
  {
    name: 'qq_send_private_msg',
    title: '发送 QQ 私聊',
    description: '通过用户电脑上登录的 QQ 向指定 QQ 号发送私聊消息。',
    inputSchema: objectSchema({ user_id: { type: ['string', 'number'], description: '收件人 QQ 号' }, message: stringProperty('消息内容') }, ['user_id', 'message']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'qq_send_group_msg',
    title: '发送 QQ 群消息',
    description: '通过用户电脑上登录的 QQ 向指定群发送消息。',
    inputSchema: objectSchema({ group_id: { type: ['string', 'number'], description: 'QQ群号' }, message: stringProperty('消息内容') }, ['group_id', 'message']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'qq_get_status',
    title: 'QQ 运行状态',
    description: '读取用户电脑上 OneBot/NapCat 的连接状态。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'qq_get_recent_contacts',
    title: 'QQ 最近会话',
    description: '读取用户自己的 QQ 最近联系人和群会话。',
    inputSchema: objectSchema({ count: { type: 'number', minimum: 1, maximum: 100, description: '最多返回数量' } }),
    readOnlyHint: true
  },
  {
    name: 'qq_get_private_history',
    title: 'QQ 私聊记录',
    description: '读取指定好友的最近私聊消息，需要 NapCat 支持历史消息接口。',
    inputSchema: objectSchema({ user_id: { type: ['string', 'number'], description: '好友 QQ 号' }, message_seq: { type: ['string', 'number'], description: '起始消息序号，可省略' }, count: { type: 'number', minimum: 1, maximum: 100, description: '消息数量' } }, ['user_id']),
    readOnlyHint: true
  },
  {
    name: 'qq_get_group_history',
    title: 'QQ群聊记录',
    description: '读取指定群的最近消息，需要 NapCat 支持历史消息接口。',
    inputSchema: objectSchema({ group_id: { type: ['string', 'number'], description: 'QQ群号' }, message_seq: { type: ['string', 'number'], description: '起始消息序号，可省略' }, count: { type: 'number', minimum: 1, maximum: 100, description: '消息数量' } }, ['group_id']),
    readOnlyHint: true
  },
  {
    name: 'qq_send_private_media',
    title: '发送 QQ 私聊媒体',
    description: '向指定 QQ 好友发送图片、语音、视频或文件。',
    inputSchema: objectSchema({ user_id: { type: ['string', 'number'], description: '收件人 QQ 号' }, media_type: { type: 'string', enum: ['image', 'audio', 'video', 'file'] }, source: stringProperty('电脑本地路径或适配器支持的 URL'), name: stringProperty('文件名，可省略') }, ['user_id', 'media_type', 'source']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'qq_send_group_media',
    title: '发送 QQ 群媒体',
    description: '向指定 QQ 群发送图片、语音、视频或文件。',
    inputSchema: objectSchema({ group_id: { type: ['string', 'number'], description: 'QQ群号' }, media_type: { type: 'string', enum: ['image', 'audio', 'video', 'file'] }, source: stringProperty('电脑本地路径或适配器支持的 URL'), name: stringProperty('文件名，可省略') }, ['group_id', 'media_type', 'source']),
    readOnlyHint: false,
    destructiveHint: false
  }
];

const xhsTools = [
  {
    name: 'xhs_status',
    title: '小红书登录状态',
    description: '读取用户电脑上非官方小红书适配器的登录与连接状态。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'xhs_search_notes',
    title: '搜索小红书',
    description: '通过用户电脑上的非官方小红书适配器搜索笔记。',
    inputSchema: objectSchema({ keyword: stringProperty('搜索关键词'), page: { type: 'number', minimum: 1, description: '页码' } }, ['keyword']),
    readOnlyHint: true
  },
  {
    name: 'xhs_get_note',
    title: '读取小红书笔记',
    description: '通过用户电脑上的适配器读取指定笔记。',
    inputSchema: objectSchema({ note_id: stringProperty('笔记 ID') }, ['note_id']),
    readOnlyHint: true
  },
  {
    name: 'xhs_get_note_comments',
    title: '读取小红书评论',
    description: '通过用户电脑上的适配器读取指定笔记的评论。',
    inputSchema: objectSchema({ note_id: stringProperty('笔记 ID'), page: { type: 'number', minimum: 1, description: '页码，可省略' } }, ['note_id']),
    readOnlyHint: true
  },
  {
    name: 'xhs_get_user_profile',
    title: '读取小红书用户资料',
    description: '通过用户电脑上的适配器读取公开或当前账号可见的小红书用户资料。',
    inputSchema: objectSchema({ user_id: stringProperty('小红书用户 ID') }, ['user_id']),
    readOnlyHint: true
  },
  {
    name: 'xhs_get_user_notes',
    title: '读取小红书用户笔记',
    description: '通过用户电脑上的适配器读取指定用户的公开或当前账号可见笔记。',
    inputSchema: objectSchema({ user_id: stringProperty('小红书用户 ID'), page: { type: 'number', minimum: 1, description: '页码，可省略' } }, ['user_id']),
    readOnlyHint: true
  },
  {
    name: 'xhs_like_note',
    title: '点赞小红书笔记',
    description: '使用用户自己的小红书账号点赞指定笔记。',
    inputSchema: objectSchema({ note_id: stringProperty('笔记 ID') }, ['note_id']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_comment_note',
    title: '评论小红书笔记',
    description: '使用用户自己的小红书账号评论指定笔记。',
    inputSchema: objectSchema({ note_id: stringProperty('笔记 ID'), content: stringProperty('评论内容') }, ['note_id', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_publish_note',
    title: '发布小红书笔记',
    description: '使用用户自己的小红书账号发布笔记；需要适配器支持。',
    inputSchema: objectSchema({ title: stringProperty('标题'), content: stringProperty('正文'), images: { type: 'array', items: { type: 'string' }, description: '图片路径或 URL' } }, ['title', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_send_direct_message',
    title: '发送小红书私信',
    description: '向指定小红书用户发送私信；仅在当前电脑上的适配器明确支持时可用。',
    inputSchema: objectSchema({ user_id: stringProperty('小红书收件人 ID'), content: stringProperty('私信内容') }, ['user_id', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_save_draft',
    title: '保存小红书草稿',
    description: '把笔记保存到用户电脑上的非官方适配器草稿箱。',
    inputSchema: objectSchema({ title: stringProperty('标题'), content: stringProperty('正文'), images: { type: 'array', items: { type: 'string' }, description: '图片路径或 URL' } }, ['title', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_list_drafts',
    title: '查看小红书草稿',
    description: '读取用户电脑适配器中的小红书草稿列表。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'xhs_delete_draft',
    title: '删除小红书草稿',
    description: '删除用户电脑适配器中的指定草稿。',
    inputSchema: objectSchema({ draft_id: stringProperty('草稿 ID') }, ['draft_id']),
    readOnlyHint: false,
    destructiveHint: true
  },
  {
    name: 'xhs_publish_draft',
    title: '发布小红书草稿',
    description: '发布指定草稿，需要用户选择的非官方适配器支持。',
    inputSchema: objectSchema({ draft_id: stringProperty('草稿 ID') }, ['draft_id']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_schedule_note',
    title: '定时发布小红书笔记',
    description: '创建定时发布任务，需要用户电脑保持在线且适配器支持。',
    inputSchema: objectSchema({ title: stringProperty('标题'), content: stringProperty('正文'), images: { type: 'array', items: { type: 'string' }, description: '图片路径或 URL' }, publish_at: stringProperty('ISO 8601 发布时间') }, ['title', 'content', 'publish_at']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'xhs_get_creator_metrics',
    title: '小红书创作数据',
    description: '读取用户自己账号的创作数据，需要非官方适配器支持。',
    inputSchema: objectSchema({ period: { type: 'string', enum: ['7d', '30d', '90d'] } }),
    readOnlyHint: true
  }
];

const douyinTools = [
  {
    name: 'douyin_status',
    title: '抖音适配器状态',
    description: '读取用户电脑上抖音适配器的登录与连接状态。',
    inputSchema: objectSchema({}),
    readOnlyHint: true
  },
  {
    name: 'douyin_search_videos',
    title: '搜索抖音视频',
    description: '通过当前电脑上的抖音适配器搜索视频。',
    inputSchema: objectSchema({ keyword: stringProperty('搜索关键词'), page: { type: 'number', minimum: 1, description: '页码，可省略' } }, ['keyword']),
    readOnlyHint: true
  },
  {
    name: 'douyin_get_video_detail',
    title: '读取抖音视频',
    description: '通过当前电脑上的抖音适配器读取指定视频详情。',
    inputSchema: objectSchema({ aweme_id: stringProperty('抖音视频 ID') }, ['aweme_id']),
    readOnlyHint: true
  },
  {
    name: 'douyin_get_video_comments',
    title: '读取抖音评论',
    description: '通过当前电脑上的抖音适配器读取指定视频的评论。',
    inputSchema: objectSchema({ aweme_id: stringProperty('抖音视频 ID'), page: { type: 'number', minimum: 1, description: '页码，可省略' } }, ['aweme_id']),
    readOnlyHint: true
  },
  {
    name: 'douyin_get_user_info',
    title: '读取抖音用户资料',
    description: '通过当前电脑上的抖音适配器读取公开或当前账号可见的用户资料。',
    inputSchema: objectSchema({ user_id: stringProperty('抖音用户 ID') }, ['user_id']),
    readOnlyHint: true
  },
  {
    name: 'douyin_get_user_posts',
    title: '读取抖音用户作品',
    description: '通过当前电脑上的抖音适配器读取指定用户的公开或当前账号可见作品。',
    inputSchema: objectSchema({ user_id: stringProperty('抖音用户 ID'), page: { type: 'number', minimum: 1, description: '页码，可省略' } }, ['user_id']),
    readOnlyHint: true
  },
  {
    name: 'douyin_like_video',
    title: '点赞抖音视频',
    description: '通过当前电脑上的抖音适配器点赞视频；需要适配器明确支持。',
    inputSchema: objectSchema({ aweme_id: stringProperty('抖音视频 ID') }, ['aweme_id']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'douyin_publish_note',
    title: '发布抖音内容',
    description: '通过当前电脑上的抖音适配器发布内容；需要适配器明确支持。',
    inputSchema: objectSchema({ title: stringProperty('标题'), content: stringProperty('正文'), images: { type: 'array', items: { type: 'string' }, description: '图片路径或 URL' } }, ['content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'douyin_comment_video',
    title: '评论抖音视频',
    description: '通过当前电脑上的抖音适配器评论视频；需要适配器明确支持。',
    inputSchema: objectSchema({ aweme_id: stringProperty('视频 ID'), content: stringProperty('评论内容') }, ['aweme_id', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  },
  {
    name: 'douyin_send_direct_message',
    title: '发送抖音私信',
    description: '通过当前电脑上的抖音适配器发送私信；需要适配器明确支持。',
    inputSchema: objectSchema({ user_id: stringProperty('抖音收件人 ID'), content: stringProperty('私信内容') }, ['user_id', 'content']),
    readOnlyHint: false,
    destructiveHint: false
  }
];

function enabledTools() {
  if (platform === 'qq') return qqTools;
  if (platform === 'xiaohongshu' || platform === 'xhs') return xhsTools;
  if (platform === 'douyin') return douyinTools;
  if (platform === 'both') return [...qqTools, ...xhsTools];
  return [...qqTools, ...xhsTools, ...douyinTools];
}

function authorizationMatches(request) {
  const authorization = String(request.headers.authorization || '');
  const headerToken = String(request.headers['x-babylink-bridge-token'] || '');
  return constantTimeEqual(authorization === `Bearer ${token}` ? token : authorization, token)
    || constantTimeEqual(headerToken, token);
}

function constantTimeEqual(left, right) {
  const leftBytes = Buffer.from(String(left));
  const rightBytes = Buffer.from(String(right));
  if (leftBytes.length !== rightBytes.length) return false;
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

function json(response, statusCode, body, extraHeaders = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function html(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  });
  response.end(body);
}

function cors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, X-BabyLink-Bridge-Token');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let payload = '';
    request.on('data', (chunk) => {
      payload += chunk;
      if (payload.length > 2_000_000) reject(new Error('request_too_large'));
    });
    request.on('end', () => {
      if (!payload.trim()) return resolve({});
      try {
        resolve(JSON.parse(payload));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    request.on('error', reject);
  });
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    const payload = await response.text();
    let parsed = {};
    try {
      parsed = payload ? JSON.parse(payload) : {};
    } catch {
      parsed = { text: payload };
    }
    if (!response.ok) throw new Error(`adapter_http_${response.status}:${JSON.stringify(parsed).slice(0, 500)}`);
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

function oneBotHeaders() {
  return oneBotToken ? { Authorization: `Bearer ${oneBotToken}` } : {};
}

async function oneBotAction(action, params = {}) {
  return await requestJson(`${oneBotUrl}/${action}`, {
    method: 'POST',
    headers: oneBotHeaders(),
    body: JSON.stringify(params)
  });
}

async function xhsAction(toolName, args) {
  if (!xhsAdapterUrl) throw new Error('XHS_ADAPTER_URL is not configured on this computer.');
  const action = toolName.replace(/^xhs_/, '');
  return await requestJson(`${xhsAdapterUrl}/call`, {
    method: 'POST',
    headers: xhsAdapterToken ? { Authorization: `Bearer ${xhsAdapterToken}` } : {},
    body: JSON.stringify({ tool: action, arguments: args })
  });
}

async function douyinAction(toolName, args) {
  if (!douyinAdapterUrl) throw new Error('DOUYIN_ADAPTER_URL is not configured on this computer.');
  const action = toolName.replace(/^douyin_/, '');
  return await requestJson(`${douyinAdapterUrl}/call`, {
    method: 'POST',
    headers: douyinAdapterToken ? { Authorization: `Bearer ${douyinAdapterToken}` } : {},
    body: JSON.stringify({ tool: action, arguments: args })
  });
}

async function qqMediaAction(scope, args) {
  const targetKey = scope === 'private' ? 'user_id' : 'group_id';
  const target = args[targetKey];
  const mediaType = String(args.media_type || 'image');
  const source = String(args.source || '').trim();
  if (!target || !source) throw new Error('media_target_and_source_required');
  if (mediaType === 'file') {
    return await oneBotAction(scope === 'private' ? 'upload_private_file' : 'upload_group_file', {
      [targetKey]: target,
      file: source,
      name: String(args.name || source.split(/[\\/]/).pop() || 'file')
    });
  }
  const segmentType = mediaType === 'audio' ? 'record' : mediaType;
  return await oneBotAction(scope === 'private' ? 'send_private_msg' : 'send_group_msg', {
    [targetKey]: target,
    message: [{ type: segmentType, data: { file: source } }]
  });
}

async function callToolUnsafe(name, args) {
  if (name === 'qq_get_login_status') return await oneBotAction('get_login_info');
  if (name === 'qq_get_friend_list') return await oneBotAction('get_friend_list');
  if (name === 'qq_get_group_list') return await oneBotAction('get_group_list');
  if (name === 'qq_get_group_member_list') return await oneBotAction('get_group_member_list', { group_id: args.group_id });
  if (name === 'qq_send_private_msg') return await oneBotAction('send_private_msg', { user_id: args.user_id, message: args.message });
  if (name === 'qq_send_group_msg') return await oneBotAction('send_group_msg', { group_id: args.group_id, message: args.message });
  if (name === 'qq_get_status') return await oneBotAction('get_status');
  if (name === 'qq_get_recent_contacts') return await oneBotAction('get_recent_contact', { count: Math.min(100, Math.max(1, Number(args.count || 20))) });
  if (name === 'qq_get_private_history') return await oneBotAction('get_friend_msg_history', { user_id: args.user_id, message_seq: args.message_seq, count: Math.min(100, Math.max(1, Number(args.count || 20))), reverseOrder: true });
  if (name === 'qq_get_group_history') return await oneBotAction('get_group_msg_history', { group_id: args.group_id, message_seq: args.message_seq, count: Math.min(100, Math.max(1, Number(args.count || 20))), reverseOrder: true });
  if (name === 'qq_send_private_media') return await qqMediaAction('private', args);
  if (name === 'qq_send_group_media') return await qqMediaAction('group', args);
  if (name.startsWith('xhs_')) return await xhsAction(name, args);
  if (name.startsWith('douyin_')) return await douyinAction(name, args);
  throw new Error(`unknown_tool:${name}`);
}

async function callTool(name, args) {
  const tool = enabledTools().find((entry) => entry.name === name);
  if (!tool) throw new Error('unknown_tool');
  const startedAt = Date.now();
  let guard;
  try {
    guard = guardToolCall(tool, args);
  } catch (error) {
    auditToolCall(tool, args, { write: !tool.readOnlyHint, startedAt }, { ok: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
  try {
    const result = await callToolUnsafe(name, args);
    auditToolCall(tool, args, guard, { ok: true });
    return result;
  } catch (error) {
    auditToolCall(tool, args, guard, { ok: false, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

function pairingPayload() {
  if (!publicUrl) return null;
  const url = `${publicUrl}/mcp`;
  const kind = platform === 'xiaohongshu' || platform === 'xhs' ? 'xiaohongshu' : platform === 'douyin' ? 'douyin-search' : platform === 'qq' ? 'qq' : 'custom';
  return {
    version: 1,
    platform,
    name: platform === 'qq' ? '我的 QQ 电脑助手' : platform === 'xiaohongshu' || platform === 'xhs' ? '我的小红书电脑助手' : platform === 'douyin' ? '我的抖音电脑助手' : '我的 BabyLink 电脑助手',
    mcpServers: {
      [platform]: {
        name: platform === 'qq' ? 'QQ / NapCat 电脑助手' : platform === 'xiaohongshu' || platform === 'xhs' ? '小红书电脑助手' : platform === 'douyin' ? '抖音电脑助手' : 'BabyLink 电脑助手',
        kind,
        url,
        apiKey: token,
        apiKeyHeader: 'Authorization',
        apiKeyPrefix: 'Bearer ',
        description: '用户电脑本地运行的 BabyLink Bridge；BabyLink 云端不代理平台流量。'
      }
    }
  };
}

function isLocalRequest(request) {
  const address = String(request.socket.remoteAddress || '');
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

async function runSelfCheck() {
  const checks = [{ key: 'bridge', label: 'Bridge 本机服务', ok: true, detail: `${host}:${port}` }];
  checks.push({ key: 'https', label: '手机 HTTPS 地址', ok: /^https:\/\//i.test(publicUrl), detail: publicUrl || '等待自动隧道或固定地址' });
  if (platform === 'qq' || platform === 'both' || platform === 'all') {
    try {
      const login = await oneBotAction('get_login_info');
      checks.push({ key: 'qq', label: 'QQ / NapCat', ok: true, detail: String(login?.data?.nickname || login?.nickname || 'QQ 在线') });
    } catch (error) {
      checks.push({ key: 'qq', label: 'QQ / NapCat', ok: false, detail: error instanceof Error ? error.message : 'OneBot 无响应' });
    }
  }
  if (platform === 'xiaohongshu' || platform === 'xhs' || platform === 'both' || platform === 'all') {
    try {
      const status = await xhsAction('xhs_status', {});
      checks.push({ key: 'xiaohongshu', label: '小红书适配器', ok: true, detail: String(status?.message || status?.status || '适配器在线') });
    } catch (error) {
      checks.push({ key: 'xiaohongshu', label: '小红书适配器', ok: false, detail: error instanceof Error ? error.message : '适配器无响应' });
    }
  }
  if (platform === 'douyin' || platform === 'all') {
    try {
      const status = await douyinAction('douyin_status', {});
      checks.push({ key: 'douyin', label: '抖音适配器', ok: true, detail: String(status?.message || status?.status || '适配器在线') });
    } catch (error) {
      checks.push({ key: 'douyin', label: '抖音适配器', ok: false, detail: error instanceof Error ? error.message : '适配器无响应' });
    }
  }
  if (publicUrl) {
    try {
      const response = await fetch(`${publicUrl}/health`, { signal: AbortSignal.timeout(8_000), cache: 'no-store' });
      checks.push({ key: 'public', label: '手机公网可达', ok: response.ok, detail: response.ok ? '公网入口响应正常' : `HTTP ${response.status}` });
    } catch (error) {
      checks.push({ key: 'public', label: '手机公网可达', ok: false, detail: error instanceof Error ? error.message : '公网入口不可达' });
    }
  }
  return { ok: checks.every((check) => check.ok), checkedAt: new Date().toISOString(), checks, security: securitySummary() };
}

async function dashboardPage() {
  const platformName = platform === 'qq' ? 'QQ' : platform === 'xiaohongshu' || platform === 'xhs' ? '小红书' : platform === 'douyin' ? '抖音' : platform === 'both' ? 'QQ + 小红书' : 'QQ + 小红书 + 抖音';
  const pairing = pairingPayload();
  const pairingText = pairing ? JSON.stringify(pairing, null, 2) : '';
  const qrCode = pairing ? await QRCode.toDataURL(pairingText, { errorCorrectionLevel: 'M', margin: 1, width: 280 }) : '';
  const statusText = publicUrl ? '可以配对' : '还差一个 HTTPS 地址';
  const nextStep = publicUrl
    ? '点击下方按钮复制配对信息，然后回到手机 BabyLink 粘贴。'
    : '请先在启动电脑助手时配置你自己的 HTTPS 隧道或反向代理地址。';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BabyLink 电脑助手</title><style>
  :root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202522;background:#f3f6f4}*{box-sizing:border-box}body{margin:0;padding:24px}.shell{width:min(720px,100%);margin:auto;display:grid;gap:14px}.hero,.card{border:1px solid rgba(28,34,31,.07);border-radius:24px;background:#fff;box-shadow:0 18px 45px rgba(25,34,29,.07)}.hero{padding:24px;background:radial-gradient(circle at 100% 0,#dcedf3,transparent 42%),linear-gradient(145deg,#fff,#f4f7f5)}.eyebrow{margin:0 0 5px;color:#718078;font-size:11px;font-weight:900;letter-spacing:.14em}.hero h1{margin:0;font-size:25px}.hero p{margin:8px 0 0;color:#77817b;font-size:13px;line-height:1.6}.state{display:inline-flex;align-items:center;gap:7px;margin-top:15px;padding:7px 11px;border-radius:999px;color:${publicUrl ? '#287049' : '#9a6037'};background:${publicUrl ? '#eaf7ef' : '#fff3e8'};font-size:12px;font-weight:800}.state:before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor}.card{padding:18px}.card h2{margin:0 0 12px;font-size:16px}.steps{display:grid;gap:8px}.step{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:center;padding:11px;border-radius:16px;background:#f7f9f8}.step b{display:grid;place-items:center;width:27px;height:27px;border-radius:10px;color:#fff;background:#29302c;font-size:11px}.step span{display:grid;gap:2px}.step strong{font-size:13px}.step small,.hint{color:#7e8982;font-size:11px;line-height:1.5}.pairing{width:100%;min-height:190px;padding:13px;border:1px solid #dce3df;border-radius:15px;background:#f7f9f8;resize:vertical;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}.copy{width:100%;min-height:46px;margin-top:9px;border:0;border-radius:15px;color:#fff;background:#272d2a;font-weight:850;cursor:pointer}.copy:disabled{color:#8a938e;background:#e7ebe9;cursor:not-allowed}.hint{margin:10px 0 0}.privacy{padding:13px 15px;border-radius:17px;color:#675f50;background:#faf4e8;font-size:11px;line-height:1.6}@media(max-width:520px){body{padding:12px}.hero{padding:18px}.hero h1{font-size:21px}}
  </style></head><body><main class="shell"><section class="hero"><p class="eyebrow">BABYLINK BRIDGE</p><h1>${platformName} 电脑助手</h1><p>账号与适配器只在这台电脑运行，手机通过加密 MCP 地址连接，BabyLink 云端不代理平台流量。</p><span class="state">${statusText}</span></section><section class="card"><h2>只需三步</h2><div class="steps"><div class="step"><b>1</b><span><strong>确认 ${platformName} 已登录</strong><small>${platform === 'qq' ? 'NapCat / OneBot 应显示在线。' : '非官方小红书适配器应显示在线。'}</small></span></div><div class="step"><b>2</b><span><strong>保持电脑助手运行</strong><small>电脑关机或关闭本窗口对应进程后，手机会暂时离线。</small></span></div><div class="step"><b>3</b><span><strong>复制配对信息到手机</strong><small>${nextStep}</small></span></div></div></section><section class="card"><h2>手机配对信息</h2><textarea id="pairing" class="pairing" readonly placeholder="配置 HTTPS 地址后会在这里生成配对信息">${pairingText.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</textarea><button id="copy" class="copy" ${pairing ? '' : 'disabled'}>复制配对信息</button><p id="result" class="hint">不要把这段信息发给其他人；其中包含访问这台电脑助手的令牌。</p></section><p class="privacy">安全边界：QQ 密码、小红书 Cookie、扫码登录信息不会写入配对内容。手机只获得 Bridge 地址和随机访问令牌。</p></main><script>
  const button=document.querySelector('#copy');const field=document.querySelector('#pairing');const result=document.querySelector('#result');button?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);result.textContent='已复制。现在回到手机 BabyLink → 设置 → MCP → 对应电脑助手，粘贴并配对。';}catch{field.select();document.execCommand('copy');result.textContent='已复制，请回到手机 BabyLink 粘贴。';}});const pairingCard=field?.closest('.card');if(pairingCard&&${JSON.stringify(qrCode)}){const qr=document.createElement('img');qr.src=${JSON.stringify(qrCode)};qr.alt='手机配对二维码';qr.style.cssText='display:block;width:min(230px,80%);margin:0 auto 14px;border-radius:18px';pairingCard.insertBefore(qr,field)}const privacy=document.querySelector('.privacy');const diagnostics=document.createElement('section');diagnostics.className='card';diagnostics.innerHTML='<h2>一键体检</h2><p id="diagnostic-copy" class="hint">正在检查平台、HTTPS 和安全策略…</p><div id="diagnostic-list" class="steps"></div><button id="rerun" class="copy">重新体检</button>';privacy?.before(diagnostics);async function inspect(){const copy=document.querySelector('#diagnostic-copy');const list=document.querySelector('#diagnostic-list');copy.textContent='正在检查…';try{const data=await fetch('/diagnostics').then(response=>response.json());copy.textContent=data.ok?'全部通过，可以配对。':'还有项目需要处理。';list.innerHTML=data.checks.map(item=>'<div class="step"><b style="background:'+(item.ok?'#287049':'#ad5b45')+'">'+(item.ok?'✓':'!')+'</b><span><strong>'+item.label+'</strong><small>'+String(item.detail).replace(/[&<>]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[character]))+'</small></span></div>').join('')}catch(error){copy.textContent='体检失败：'+error.message}}document.querySelector('#rerun')?.addEventListener('click',inspect);void inspect();
  </script></body></html>`;
}

function openDashboard() {
  if (String(process.env.BABYLINK_BRIDGE_OPEN_DASHBOARD || '1') === '0') return;
  const url = `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.unref();
  } catch {
    return;
  }
}

function handleMcp(request, response, body) {
  const message = body && typeof body === 'object' ? body : {};
  const id = message.id ?? null;
  const method = String(message.method || '');
  if (method === 'initialize') {
    const sessionId = crypto.randomUUID();
    sessions.add(sessionId);
    return json(response, 200, {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: `BabyLink Bridge · ${platform}`, version: '1.0.0' }
      }
    }, { 'Mcp-Session-Id': sessionId });
  }
  if (!method.startsWith('notifications/')) {
    const sessionId = String(request.headers['mcp-session-id'] || '');
    if (!sessionId || !sessions.has(sessionId)) return json(response, 400, { error: 'invalid_session' });
  }
  if (method === 'tools/list') {
    return json(response, 200, { jsonrpc: '2.0', id, result: { tools: enabledTools().map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnlyHint, destructiveHint: tool.destructiveHint }
    })) } });
  }
  if (method === 'tools/call') {
    const name = String(message.params?.name || '');
    const args = message.params?.arguments && typeof message.params.arguments === 'object' ? message.params.arguments : {};
    if (!enabledTools().some((tool) => tool.name === name)) return json(response, 200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'unknown_tool' } });
    return callTool(name, args).then((result) => json(response, 200, {
      jsonrpc: '2.0',
      id,
      result: { content: [{ type: 'text', text: JSON.stringify(result) }] }
    })).catch((error) => json(response, 200, {
      jsonrpc: '2.0',
      id,
      result: { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : 'bridge_tool_failed' }] }
    }));
  }
  if (method.startsWith('notifications/')) return json(response, 202, {});
  return json(response, 200, { jsonrpc: '2.0', id, error: { code: -32601, message: 'method_not_found' } });
}

async function handler(request, response) {
  cors(response);
  if (request.method === 'OPTIONS') return json(response, 204, {});
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (url.pathname === '/' && request.method === 'GET') {
    if (!isLocalRequest(request)) return json(response, 404, { error: 'not_found' });
    return html(response, 200, await dashboardPage());
  }
  if (url.pathname === '/desktop/public-url' && request.method === 'POST') {
    if (!isLocalRequest(request)) return json(response, 404, { error: 'not_found' });
    try {
      const body = await readBody(request);
      const nextUrl = new URL(String(body.publicUrl || ''));
      if (nextUrl.protocol !== 'https:' || nextUrl.username || nextUrl.password) throw new Error('https_public_url_required');
      publicUrl = nextUrl.href.replace(/\/$/, '');
      return json(response, 200, { ok: true, publicUrl, pairing: pairingPayload() });
    } catch (error) {
      return json(response, 400, { error: error instanceof Error ? error.message : 'invalid_public_url' });
    }
  }
  if (url.pathname === '/diagnostics' && request.method === 'GET') {
    if (!isLocalRequest(request)) return json(response, 404, { error: 'not_found' });
    return json(response, 200, await runSelfCheck());
  }
  if (url.pathname === '/audit' && request.method === 'GET') {
    if (!isLocalRequest(request)) return json(response, 404, { error: 'not_found' });
    return json(response, 200, { entries: readAuditEntries(Number(url.searchParams.get('limit') || 100)) });
  }
  if (url.pathname === '/health' && request.method === 'GET') {
    return json(response, 200, { ok: true, platform, bridge: 'BabyLink Bridge', publicUrl: publicUrl || null, configured: { qq: Boolean(oneBotUrl), xiaohongshu: Boolean(xhsAdapterUrl), douyin: Boolean(douyinAdapterUrl) }, tools: enabledTools().length });
  }
  if (url.pathname === '/pairing' && request.method === 'GET') {
    if (!authorizationMatches(request)) return json(response, 401, { error: 'unauthorized' });
    const pairing = pairingPayload();
    return pairing ? json(response, 200, pairing) : json(response, 409, { error: 'public_https_url_required' });
  }
  if (url.pathname !== '/mcp' || !['POST', 'DELETE'].includes(request.method || '')) return json(response, 404, { error: 'not_found' });
  if (!authorizationMatches(request)) return json(response, 401, { error: 'unauthorized' });
  if (request.method === 'DELETE') {
    const sessionId = String(request.headers['mcp-session-id'] || '');
    sessions.delete(sessionId);
    return json(response, 200, {});
  }
  try {
    return handleMcp(request, response, await readBody(request));
  } catch (error) {
    return json(response, 400, { error: error instanceof Error ? error.message : 'invalid_request' });
  }
}

const serverOptions = tlsKeyPath && tlsCertPath
  ? { key: fs.readFileSync(tlsKeyPath), cert: fs.readFileSync(tlsCertPath) }
  : null;
const server = serverOptions ? https.createServer(serverOptions, handler) : http.createServer(handler);
server.listen(port, host, () => {
  console.log(`BabyLink Bridge listening on ${serverOptions ? 'https' : 'http'}://${host}:${port}`);
  console.log(`Platform: ${platform}`);
  console.log(`Dashboard: http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}/`);
  console.log(`Pairing config: ${publicUrl ? `${publicUrl}/pairing` : 'waiting for BABYLINK_BRIDGE_PUBLIC_URL'}`);
  console.log('Expose this port through your own HTTPS reverse proxy or tunnel before connecting a phone.');
  openDashboard();
});
