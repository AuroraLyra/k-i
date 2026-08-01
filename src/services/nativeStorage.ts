import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeStorageOverview, StorageRuntime } from '@/types/storage';

interface LinkStoragePlugin {
  getOverview(): Promise<NativeStorageOverview>;
  clearTemporaryFiles(): Promise<NativeStorageOverview>;
}

const LinkStorage = registerPlugin<LinkStoragePlugin>('LinkStorage');

export function getStorageRuntime(): StorageRuntime {
  const platform = Capacitor.getPlatform();
  if (Capacitor.isNativePlatform() && platform === 'android') {
    return { isNative: true, platform: 'android', label: 'Android App' };
  }
  if (Capacitor.isNativePlatform() && platform === 'ios') {
    return { isNative: true, platform: 'ios', label: 'iPhone App' };
  }
  return { isNative: false, platform: 'web', label: '网站 / PWA' };
}

export function isNativeStorageAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LinkStorage');
}

export async function getNativeStorageOverview() {
  if (!isNativeStorageAvailable()) return null;
  try {
    return await LinkStorage.getOverview();
  } catch {
    return null;
  }
}

export async function clearNativeTemporaryFiles() {
  if (!isNativeStorageAvailable()) return null;
  return await LinkStorage.clearTemporaryFiles();
}