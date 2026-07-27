import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeKeepAliveStatus {
  serviceActive: boolean;
  wakeLockActive: boolean;
  notificationPermission: 'granted' | 'denied' | 'prompt';
  batteryOptimizationsIgnored: boolean;
}

interface NativeKeepAlivePlugin {
  getStatus(): Promise<NativeKeepAliveStatus>;
  start(options: { wakeLock: boolean }): Promise<NativeKeepAliveStatus>;
  stop(): Promise<NativeKeepAliveStatus>;
  requestNotifications(): Promise<NativeKeepAliveStatus>;
  openBatterySettings(): Promise<void>;
  notify(options: { kind: 'message' | 'voom' | 'call'; title: string; body: string; messages?: string[]; tag: string; icon?: string; url?: string; conversationId?: string; callId?: string; callMode?: 'voice' | 'video' }): Promise<{ sent: boolean }>;
  dismissCall(options: { callId: string; tag: string }): Promise<void>;
}

const LinkKeepAlive = registerPlugin<NativeKeepAlivePlugin>('LinkKeepAlive');

export function isNativeKeepAliveAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkKeepAlive');
}

export async function getNativeKeepAliveStatus() {
  if (!isNativeKeepAliveAvailable()) return null;
  return await LinkKeepAlive.getStatus();
}

export async function startNativeKeepAlive(wakeLock: boolean) {
  if (!isNativeKeepAliveAvailable()) return null;
  return await LinkKeepAlive.start({ wakeLock });
}

export async function stopNativeKeepAlive() {
  if (!isNativeKeepAliveAvailable()) return null;
  return await LinkKeepAlive.stop();
}

export async function requestNativeNotificationPermission() {
  if (!isNativeKeepAliveAvailable()) return null;
  return await LinkKeepAlive.requestNotifications();
}

export async function openNativeBatterySettings() {
  if (!isNativeKeepAliveAvailable()) return false;
  await LinkKeepAlive.openBatterySettings();
  return true;
}

export async function showNativeLinkNotification(payload: { kind: 'message' | 'voom' | 'call'; title: string; body: string; messages?: string[]; tag: string; icon?: string; url?: string; conversationId?: string; callId?: string; callMode?: 'voice' | 'video' }) {
  if (!isNativeKeepAliveAvailable()) return false;
  const result = await LinkKeepAlive.notify(payload);
  return result.sent;
}

export async function dismissNativeCallNotification(callId: string) {
  if (!isNativeKeepAliveAvailable()) return;
  await LinkKeepAlive.dismissCall({ callId, tag: `link-call-${callId}` });
}