import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { getDb } from '@/data/db';
import { checkReleaseCompatibility } from '@/services/releaseManifest';

export interface RuntimeDiagnostics {
  capturedAt: string;
  webBuild: string;
  database: {
    name: string;
    version: number;
    stores: string[];
  };
  release: {
    state: 'compatible' | 'unavailable' | 'incompatible';
    manifestBuild: string;
    reason: string;
    updateAvailable: boolean;
  };
  runtime: {
    platform: string;
    native: boolean;
    standalone: boolean;
    serviceWorker: 'unsupported' | 'uncontrolled' | 'controlled';
    serviceWorkerScript: string;
    nativeVersion: string;
    nativeBuild: string;
  };
  storage: {
    usageBytes: number | null;
    quotaBytes: number | null;
    persisted: boolean | null;
  };
}

function resolveWebBuild() {
  return __LINK_WEB_BUILD__;
}

async function readStorageDiagnostics() {
  try {
    const [estimate, persisted] = await Promise.all([
      navigator.storage?.estimate?.(),
      navigator.storage?.persisted?.()
    ]);
    return {
      usageBytes: Number.isFinite(estimate?.usage) ? estimate?.usage ?? null : null,
      quotaBytes: Number.isFinite(estimate?.quota) ? estimate?.quota ?? null : null,
      persisted: typeof persisted === 'boolean' ? persisted : null
    };
  } catch {
    return { usageBytes: null, quotaBytes: null, persisted: null };
  }
}

async function readNativeVersion() {
  if (!Capacitor.isNativePlatform()) return { version: '', build: '' };
  try {
    const info = await App.getInfo();
    return { version: String(info.version ?? ''), build: String(info.build ?? '') };
  } catch {
    return { version: '', build: '' };
  }
}

async function readServiceWorkerDiagnostics() {
  if (!('serviceWorker' in navigator)) return { state: 'unsupported' as const, script: '' };
  const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  return {
    state: navigator.serviceWorker.controller ? 'controlled' as const : 'uncontrolled' as const,
    script: registration?.active?.scriptURL ?? registration?.waiting?.scriptURL ?? registration?.installing?.scriptURL ?? ''
  };
}

export async function collectRuntimeDiagnostics(): Promise<RuntimeDiagnostics> {
  const [db, storage, nativeVersion, serviceWorker] = await Promise.all([
    getDb(),
    readStorageDiagnostics(),
    readNativeVersion(),
    readServiceWorkerDiagnostics()
  ]);
  const release = await checkReleaseCompatibility({ dbVersion: db.version });
  return {
    capturedAt: new Date().toISOString(),
    webBuild: resolveWebBuild(),
    database: {
      name: db.name,
      version: db.version,
      stores: Array.from(db.objectStoreNames).sort()
    },
    release: release.state === 'compatible'
      ? { state: release.state, manifestBuild: release.manifest.webBuildId, reason: '', updateAvailable: release.updateAvailable }
      : { state: release.state, manifestBuild: release.state === 'incompatible' ? release.manifest.webBuildId : '', reason: release.reason, updateAvailable: false },
    runtime: {
      platform: Capacitor.getPlatform(),
      native: Capacitor.isNativePlatform(),
      standalone: window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true,
      serviceWorker: serviceWorker.state,
      serviceWorkerScript: serviceWorker.script,
      nativeVersion: nativeVersion.version,
      nativeBuild: nativeVersion.build
    },
    storage
  };
}

export async function formatRuntimeDiagnostics() {
  return JSON.stringify(await collectRuntimeDiagnostics(), null, 2);
}