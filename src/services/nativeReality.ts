import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeRealityPlugin {
  setSystemAlarm(options: { hour: number; minute: number; label: string }): Promise<{ opened: boolean }>;
  openSystemWeather(): Promise<{ opened: boolean; packageName: string }>;
  openAppSettings(): Promise<{ opened: boolean }>;
  getAppUsageAccess(): Promise<{ granted: boolean; platform: 'android' }>;
  openAppUsageSettings(): Promise<{ opened: boolean; granted: boolean }>;
  getAppUsage(options: { from: number; to: number; limit: number }): Promise<AndroidAppUsageResult>;
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

const LinkReality = registerPlugin<NativeRealityPlugin>('LinkReality');

export function androidRealityAvailable() {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkReality');
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
