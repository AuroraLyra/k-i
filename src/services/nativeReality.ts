import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeRealityPlugin {
  setSystemAlarm(options: { hour: number; minute: number; label: string }): Promise<{ opened: boolean }>;
  openSystemWeather(): Promise<{ opened: boolean; packageName: string }>;
  openAppSettings(): Promise<{ opened: boolean }>;
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
