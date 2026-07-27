import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeDisplayPlugin {
  setFullscreen(options: { enabled: boolean }): Promise<NativeDisplayState>;
}

export interface NativeDisplayState {
  enabled: boolean;
  applied?: boolean;
  statusBarVisible?: boolean;
  navigationBarVisible?: boolean;
}

const LinkDisplay = registerPlugin<NativeDisplayPlugin>('LinkDisplay');
let lastNativeDisplayState: NativeDisplayState | null = null;

export function isNativeDisplayAvailable() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LinkDisplay');
}

export async function setNativeDisplayFullscreen(enabled: boolean): Promise<NativeDisplayState | null> {
  if (!isNativeDisplayAvailable()) return null;
  try {
    const result = await LinkDisplay.setFullscreen({ enabled });
    lastNativeDisplayState = result;
    return result;
  } catch {
    return null;
  }
}

export function getLastNativeDisplayState() {
  return lastNativeDisplayState;
}