import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { LocalNotifications, type ActionPerformed, type PermissionStatus } from '@capacitor/local-notifications';
import type { ChatCallMode } from '@/types/domain';

export type NativeNotificationAction = 'open' | 'accepted' | 'rejected';

export interface NativeSystemNotificationPayload {
  kind: 'message' | 'voom' | 'call';
  title: string;
  body: string;
  tag: string;
  icon?: string;
  url: string;
  conversationId?: string;
  callId?: string;
  callMode?: ChatCallMode;
}

export interface NativeNotificationActionPayload extends NativeSystemNotificationPayload {
  action: NativeNotificationAction;
}

const incomingCallActionTypeId = 'LINK_INCOMING_CALL';
const acceptCallActionId = 'LINK_ACCEPT_CALL';
const rejectCallActionId = 'LINK_REJECT_CALL';
const notificationAttachmentDirectory = 'notification-avatars';
let actionTypesRegistered = false;

export function isIosNativeNotificationAvailable() {
  return Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('LocalNotifications');
}

function normalizePermission(status: PermissionStatus) {
  if (status.display === 'granted') return 'granted' as const;
  if (status.display === 'denied') return 'denied' as const;
  return 'default' as const;
}

export async function getIosNativeNotificationPermission() {
  if (!isIosNativeNotificationAvailable()) return null;
  return normalizePermission(await LocalNotifications.checkPermissions());
}

export async function requestIosNativeNotificationPermission() {
  if (!isIosNativeNotificationAvailable()) return null;
  return normalizePermission(await LocalNotifications.requestPermissions());
}

async function ensureIosNotificationActionTypes() {
  if (!isIosNativeNotificationAvailable() || actionTypesRegistered) return;
  await LocalNotifications.registerActionTypes({
    types: [{
      id: incomingCallActionTypeId,
      iosHiddenPreviewsBodyPlaceholder: '收到新的通话邀请',
      iosHiddenPreviewsShowTitle: true,
      iosHiddenPreviewsShowSubtitle: true,
      actions: [
        {
          id: rejectCallActionId,
          title: '拒绝',
          destructive: true,
          foreground: true
        },
        {
          id: acceptCallActionId,
          title: '接听',
          foreground: true
        }
      ]
    }]
  });
  actionTypesRegistered = true;
}

function notificationId(tag: string) {
  let hash = 2166136261;
  for (let index = 0; index < tag.length; index += 1) {
    hash ^= tag.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.max(1, hash & 0x7fffffff);
}

async function writeNotificationAttachment(icon: string, id: number) {
  const match = icon.match(/^data:image\/(jpe?g|png|webp);base64,([\s\S]+)$/i);
  if (!match) return undefined;
  try {
    const extension = /^jpe?g$/i.test(match[1]) ? 'jpg' : match[1].toLocaleLowerCase();
    const written = await Filesystem.writeFile({
      path: `${notificationAttachmentDirectory}/${id}.${extension}`,
      data: match[2].replace(/\s+/g, ''),
      directory: Directory.Cache,
      recursive: true
    });
    return [{ id: `avatar-${id}`, url: written.uri }];
  } catch {
    return undefined;
  }
}

export async function showIosNativeNotification(payload: NativeSystemNotificationPayload) {
  if (!isIosNativeNotificationAvailable()) return false;
  if (await getIosNativeNotificationPermission() !== 'granted') return false;
  await ensureIosNotificationActionTypes();
  const id = notificationId(payload.tag);
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: payload.title,
      body: payload.body,
      largeBody: payload.body,
      sound: 'default',
      attachments: payload.icon ? await writeNotificationAttachment(payload.icon, id) : undefined,
      actionTypeId: payload.kind === 'call' ? incomingCallActionTypeId : undefined,
      threadIdentifier: payload.kind === 'call' ? `call-${payload.conversationId || payload.callId || id}` : payload.kind,
      relevanceScore: payload.kind === 'call' ? 1 : 0.5,
      interruptionLevel: payload.kind === 'call' ? 'timeSensitive' : 'active',
      extra: payload
    }]
  });
  return true;
}

export async function dismissIosNativeCallNotification(callId: string) {
  if (!isIosNativeNotificationAvailable()) return;
  const id = notificationId(`link-call-${callId}`);
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
  const delivered = await LocalNotifications.getDeliveredNotifications().catch(() => null);
  const matchingNotifications = delivered?.notifications.filter((notification) => notification.id === id) ?? [];
  if (matchingNotifications.length) {
    await LocalNotifications.removeDeliveredNotifications({ notifications: matchingNotifications }).catch(() => undefined);
  }
}

function actionPayload(action: ActionPerformed): NativeNotificationActionPayload | null {
  const extra = action.notification.extra as Partial<NativeSystemNotificationPayload> | undefined;
  const url = String(extra?.url ?? '').trim();
  if (!url) return null;
  return {
    kind: extra?.kind === 'call' ? 'call' : extra?.kind === 'voom' ? 'voom' : 'message',
    title: String(extra?.title ?? action.notification.title ?? '').trim(),
    body: String(extra?.body ?? action.notification.body ?? '').trim(),
    tag: String(extra?.tag ?? action.notification.id ?? '').trim(),
    icon: String(extra?.icon ?? '').trim() || undefined,
    url,
    conversationId: String(extra?.conversationId ?? '').trim() || undefined,
    callId: String(extra?.callId ?? '').trim() || undefined,
    callMode: extra?.callMode === 'video' ? 'video' : extra?.callMode === 'voice' ? 'voice' : undefined,
    action: action.actionId === acceptCallActionId ? 'accepted' : action.actionId === rejectCallActionId ? 'rejected' : 'open'
  };
}

export async function installIosNativeNotificationActions(listener: (payload: NativeNotificationActionPayload) => void) {
  if (!isIosNativeNotificationAvailable()) return () => undefined;
  await ensureIosNotificationActionTypes();
  const handle: PluginListenerHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const payload = actionPayload(action);
    if (payload) listener(payload);
  });
  return () => void handle.remove();
}
