import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeRealityPlugin {
  setSystemAlarm(options: { hour: number; minute: number; label: string }): Promise<{ opened: boolean }>;
  openSystemWeather(): Promise<{ opened: boolean; packageName: string }>;
  openAppSettings(): Promise<{ opened: boolean }>;
  getAppUsageAccess(): Promise<{ granted: boolean; platform: 'android' }>;
  openAppUsageSettings(): Promise<{ opened: boolean; granted: boolean }>;
  getAppUsage(options: { from: number; to: number; limit: number }): Promise<AndroidAppUsageResult>;
}

interface NativeNotificationInboxPlugin {
  getAccess(): Promise<{ granted: boolean; platform: 'android' }>;
  openAccessSettings(): Promise<{ opened: boolean; granted: boolean; platform: 'android' }>;
  getInbox(options: { from: number; limit: number; category: string }): Promise<AndroidNotificationInboxResult>;
  clearInbox(): Promise<{ cleared: boolean }>;
}

export interface AndroidAppUsageEntry {
  appName: string;
  packageName: string;
  foregroundMs: number;
  lastUsedAt: number;
  systemApp: boolean;
}

export interface AndroidAppUsageResult {
  permissionGranted: boolean;
  platform: 'android';
  from: number;
  to: number;
  totalForegroundMs: number;
  apps: AndroidAppUsageEntry[];
}

export interface AndroidNotificationInboxEntry {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  postedAt: number;
  category: 'delivery' | 'food' | 'meeting' | 'travel' | 'shopping' | 'message' | 'other';
  redacted: boolean;
}

export interface AndroidNotificationInboxResult {
  granted: boolean;
  platform: 'android';
  from: number;
  category: string;
  entries: AndroidNotificationInboxEntry[];
}

const LinkReality = registerPlugin<NativeRealityPlugin>('LinkReality');
const LinkNotificationInbox = registerPlugin<NativeNotificationInboxPlugin>('LinkNotificationInbox');

export function androidRealityAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkReality');
}

export function androidNotificationInboxAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkNotificationInbox');
}

export async function setAndroidSystemAlarm(options: { hour: number; minute: number; label: string }) {
  if (!androidRealityAvailable()) throw new Error('系统时钟闹钟仅支持 Android App；iOS 没有开放第三方创建系统闹钟接口。');
  return await LinkReality.setSystemAlarm(options);
}

export async function openAndroidSystemWeather() {
  if (!androidRealityAvailable()) throw new Error('当前设备没有可用的 Android 系统天气入口。');
  return await LinkReality.openSystemWeather();
}

export async function openAndroidAppSettings() {
  if (!androidRealityAvailable()) throw new Error('当前设备没有可用的 Android 系统设置入口。');
  return await LinkReality.openAppSettings();
}

export async function getAndroidAppUsageAccess() {
  if (!androidRealityAvailable()) return { granted: false, platform: 'unsupported' as const };
  return await LinkReality.getAppUsageAccess();
}

export async function openAndroidAppUsageSettings() {
  if (!androidRealityAvailable()) throw new Error('真实 App 使用时长当前仅支持 Android App。');
  return await LinkReality.openAppUsageSettings();
}

export async function getAndroidAppUsage(options: { from: number; to: number; limit: number }) {
  if (!androidRealityAvailable()) throw new Error('真实 App 使用时长当前仅支持 Android App。');
  return await LinkReality.getAppUsage(options);
}

export async function getAndroidNotificationInboxAccess() {
  if (!androidNotificationInboxAvailable()) return { granted: false, platform: 'unsupported' as const };
  return await LinkNotificationInbox.getAccess();
}

export async function openAndroidNotificationInboxSettings() {
  if (!androidNotificationInboxAvailable()) throw new Error('通知收件箱仅支持 Android App。');
  return await LinkNotificationInbox.openAccessSettings();
}

export async function getAndroidNotificationInbox(options: { from: number; limit: number; category: string }) {
  if (!androidNotificationInboxAvailable()) throw new Error('通知收件箱仅支持 Android App。');
  return await LinkNotificationInbox.getInbox(options);
}

export async function clearAndroidNotificationInbox() {
  if (!androidNotificationInboxAvailable()) throw new Error('通知收件箱仅支持 Android App。');
  return await LinkNotificationInbox.clearInbox();
}
