import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { isNativeDisplayAvailable, setNativeDisplayFullscreen } from './nativeDisplay';

const fullscreenStorageKey = 'link:fullscreen-enabled';
let listenersInstalled = false;
let fullscreenEnabled = readFullscreenPreference();
let nativeSyncQueue: Promise<boolean> = Promise.resolve(true);

type WebkitFullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type WebkitFullscreenElement = Omit<HTMLElement, 'requestFullscreen'> & {
  requestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function readFullscreenPreference() {
  try {
    const stored = localStorage.getItem(fullscreenStorageKey);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
}

function saveFullscreenPreference(enabled: boolean) {
  try {
    localStorage.setItem(fullscreenStorageKey, String(enabled));
  } catch {
    return;
  }
}

function setFullscreenClass(enabled: boolean) {
  const root = document.documentElement;
  const changed = root.classList.contains('is-link-fullscreen') !== enabled;
  root.classList.toggle('is-link-fullscreen', enabled);
  if (changed) window.dispatchEvent(new Event('link:fullscreen-change'));
}

async function waitForFullscreenOperation(operation: Promise<void> | void) {
  await Promise.race([
    Promise.resolve(operation),
    new Promise<void>((resolve) => window.setTimeout(resolve, 1_500))
  ]);
}

function isPwaFullscreenDisplay() {
  try {
    return window.matchMedia('(display-mode: fullscreen)').matches;
  } catch {
    return false;
  }
}

function hasBrowserFullscreenApi() {
  const root = document.documentElement as WebkitFullscreenElement;
  const fullscreenDocument = document as WebkitFullscreenDocument;
  return Boolean(
    (root.requestFullscreen && fullscreenDocument.fullscreenEnabled !== false)
      || root.webkitRequestFullscreen && fullscreenDocument.webkitFullscreenEnabled !== false
  );
}

export function isBrowserFullscreenActive() {
  const fullscreenDocument = document as WebkitFullscreenDocument;
  return Boolean(
    document.fullscreenElement
      || fullscreenDocument.webkitFullscreenElement
      || isPwaFullscreenDisplay()
  );
}

export type FullscreenEnvironment = 'native' | 'pwa' | 'browser' | 'unsupported';

export function getFullscreenEnvironment(): FullscreenEnvironment {
  if (Capacitor.isNativePlatform()) return 'native';
  if (isPwaFullscreenDisplay()) return 'pwa';
  if (hasBrowserFullscreenApi()) return 'browser';
  return 'unsupported';
}

async function performNativeStatusBarSync(enabled: boolean) {
  try {
    if (Capacitor.getPlatform() === 'android' && isNativeDisplayAvailable()) {
      return Boolean(await setNativeDisplayFullscreen(enabled));
    }
    await SystemBars.setAnimation({ animation: 'NONE' });
    await SystemBars.setStyle({ style: SystemBarsStyle.Light });
    if (enabled) await SystemBars.hide({ animation: 'NONE' });
    else await SystemBars.show({ animation: 'NONE' });
    return true;
  } catch {
    return false;
  }
}

function syncNativeStatusBar() {
  nativeSyncQueue = nativeSyncQueue
    .catch(() => false)
    .then(() => performNativeStatusBarSync(fullscreenEnabled));
  return nativeSyncQueue;
}

async function enterBrowserFullscreen() {
  const fullscreenDocument = document as WebkitFullscreenDocument;
  if (isBrowserFullscreenActive()) return true;
  const root = document.documentElement as WebkitFullscreenElement;
  try {
    if (root.requestFullscreen && fullscreenDocument.fullscreenEnabled !== false) await waitForFullscreenOperation(root.requestFullscreen({ navigationUI: 'hide' }));
    else if (root.webkitRequestFullscreen && fullscreenDocument.webkitFullscreenEnabled !== false) await waitForFullscreenOperation(root.webkitRequestFullscreen());
    else return false;
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return isBrowserFullscreenActive();
  } catch {
    return false;
  }
}

async function exitBrowserFullscreen() {
  const fullscreenDocument = document as WebkitFullscreenDocument;
  try {
    if (document.fullscreenElement && document.exitFullscreen) await waitForFullscreenOperation(document.exitFullscreen());
    else if (fullscreenDocument.webkitFullscreenElement && fullscreenDocument.webkitExitFullscreen) await waitForFullscreenOperation(fullscreenDocument.webkitExitFullscreen());
    return !document.fullscreenElement && !fullscreenDocument.webkitFullscreenElement;
  } catch {
    return false;
  }
}

export async function setFullscreenEnabled(enabled: boolean, options: { requestBrowserFullscreen?: boolean } = {}) {
  if (Capacitor.isNativePlatform()) {
    fullscreenEnabled = enabled;
    saveFullscreenPreference(enabled);
    setFullscreenClass(enabled);
    return await syncNativeStatusBar();
  }

  if (!enabled) {
    fullscreenEnabled = false;
    saveFullscreenPreference(false);
    setFullscreenClass(isPwaFullscreenDisplay());
    return await exitBrowserFullscreen();
  }

  if (options.requestBrowserFullscreen) {
    const entered = await enterBrowserFullscreen();
    if (!entered && !isPwaFullscreenDisplay()) return false;
  }

  fullscreenEnabled = true;
  saveFullscreenPreference(true);
  setFullscreenClass(isBrowserFullscreenActive());
  return isBrowserFullscreenActive();
}

export function installNativeSystemBars() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  const isNative = Capacitor.isNativePlatform();
  document.documentElement.classList.toggle('is-native-app', isNative);
  if (isNative) setFullscreenClass(fullscreenEnabled);
  else setFullscreenClass(isBrowserFullscreenActive() && fullscreenEnabled);

  const restore = () => {
    if (Capacitor.isNativePlatform()) {
      void syncNativeStatusBar();
      return;
    }
    setFullscreenClass(isBrowserFullscreenActive() && fullscreenEnabled);
  };

  const retryBrowserFullscreen = () => {
    if (Capacitor.isNativePlatform() || !fullscreenEnabled || isBrowserFullscreenActive() || !hasBrowserFullscreenApi()) return;
    void enterBrowserFullscreen().then((active) => {
      if (active) restore();
    });
  };

  if (isNative) {
    void syncNativeStatusBar();
    void CapacitorApp.addListener('resume', restore)
      .then(() => undefined)
      .catch(() => undefined);
  } else {
    document.addEventListener('fullscreenchange', restore, { passive: true });
    document.addEventListener('webkitfullscreenchange', restore, { passive: true } as AddEventListenerOptions);
    document.addEventListener('pointerdown', retryBrowserFullscreen, { capture: true, passive: true });
  }

  window.addEventListener('pageshow', restore, { passive: true });
  window.addEventListener('focus', restore, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') restore();
  });
}