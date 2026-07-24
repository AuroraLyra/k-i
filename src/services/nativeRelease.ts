import { Capacitor, registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';

export type NativeReleasePlatform = 'android' | 'ios';
export type NativeReleasePhase = 'idle' | 'checking' | 'latest' | 'available' | 'opening' | 'unsupported' | 'error';

export interface NativeRelease {
  id: string;
  platform: NativeReleasePlatform;
  versionCode: number;
  versionName: string;
  minimumVersionCode: number;
  mandatory: boolean;
  updateAvailable: boolean;
  sha256: string;
  fileSize: number;
  notes: string;
  publishedAt: number;
  downloadUrl: string;
  downloadExpiresAt: number;
}

export interface NativeReleaseStatus {
  supported: boolean;
  native: boolean;
  platform: NativeReleasePlatform | '';
  currentVersionCode: number;
  currentVersionName: string;
  phase: NativeReleasePhase;
  message: string;
  release: NativeRelease | null;
  lastCheckedAt: number;
}

interface LinkUpdaterPlugin {
  getVersion(): Promise<{ versionCode: number; versionName: string }>;
  openDownload(options: { url: string }): Promise<void>;
  installUpdate(options: { url: string; sha256: string; versionCode: number }): Promise<{ status: 'permission-required' | 'install-requested' }>;
}

export interface IosUpdateSourceLink {
  url: string;
  altstoreUrl: string;
  sidestoreUrl: string;
  expiresAt: number;
}

export type NativeReleaseActionResult = 'install-requested' | 'permission-required' | 'browser-download';

const LinkUpdater = registerPlugin<LinkUpdaterPlugin>('LinkUpdater');
const LAST_ANDROID_VERSION_WITH_OPEN_INSTALL_STREAM = 15;

function detectedPlatform(): NativeReleasePlatform | '' {
  const capacitorPlatform = Capacitor.getPlatform();
  if (capacitorPlatform === 'android' || capacitorPlatform === 'ios') return capacitorPlatform;
  if (/Android/i.test(navigator.userAgent)) return 'android';
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) return 'ios';
  return '';
}

function configuredVersion(platform: NativeReleasePlatform) {
  const code = platform === 'android' ? import.meta.env.VITE_ANDROID_VERSION_CODE : import.meta.env.VITE_IOS_VERSION_CODE;
  const name = platform === 'android' ? import.meta.env.VITE_ANDROID_VERSION_NAME : import.meta.env.VITE_IOS_VERSION_NAME;
  return { versionCode: Math.max(0, Number(code ?? 0) || 0), versionName: String(name ?? '').trim() };
}

export function createInitialNativeReleaseStatus(): NativeReleaseStatus {
  const platform = detectedPlatform();
  return {
    supported: Boolean(platform),
    native: Capacitor.isNativePlatform(),
    platform,
    currentVersionCode: 0,
    currentVersionName: '',
    phase: platform ? 'idle' : 'unsupported',
    message: platform ? '可以检查受保护的安装包版本。' : '当前设备不需要原生安装包。',
    release: null,
    lastCheckedAt: 0
  };
}

async function resolveInstalledVersion(platform: NativeReleasePlatform) {
  if (platform === 'android' && Capacitor.isNativePlatform()) {
    try {
      const version = await LinkUpdater.getVersion();
      return { versionCode: Math.max(0, Number(version.versionCode) || 0), versionName: String(version.versionName ?? '') };
    } catch {
      return configuredVersion(platform);
    }
  }
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('App')) {
    try {
      const info = await App.getInfo();
      return { versionCode: Math.max(0, Number(info.build) || 0), versionName: String(info.version ?? '') };
    } catch {
      return configuredVersion(platform);
    }
  }
  return configuredVersion(platform);
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  return body?.message || body?.error || `版本请求失败 (${response.status})`;
}

export async function checkNativeRelease(): Promise<NativeReleaseStatus> {
  const initial = createInitialNativeReleaseStatus();
  if (!initial.platform) return initial;
  const current = await resolveInstalledVersion(initial.platform);
  try {
    const params = new URLSearchParams({ platform: initial.platform, versionCode: String(current.versionCode) });
    const response = await fetch(`/api/releases/latest?${params.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(await responseError(response));
    const release = await response.json() as NativeRelease | { release: null; updateAvailable: false };
    if ('release' in release && release.release === null) {
      return { ...initial, ...current, phase: 'latest', message: '管理员尚未发布该平台安装包。', lastCheckedAt: Date.now() };
    }
    const nativeRelease = release as NativeRelease;
    return {
      ...initial,
      ...current,
      release: nativeRelease,
      phase: nativeRelease.updateAvailable ? 'available' : 'latest',
      message: nativeRelease.updateAvailable ? `发现 ${nativeRelease.versionName} 版本。` : '当前原生壳已经是最新版本。',
      lastCheckedAt: Date.now()
    };
  } catch (error) {
    return { ...initial, ...current, phase: 'error', message: error instanceof Error ? error.message : '检查安装包失败。', lastCheckedAt: Date.now() };
  }
}

async function refreshDownloadTicket(release: NativeRelease) {
  if (release.downloadExpiresAt > Date.now() + 15_000) return release;
  const params = new URLSearchParams({ platform: release.platform, versionCode: '0' });
  const response = await fetch(`/api/releases/latest?${params.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await responseError(response));
  const latestRelease = await response.json() as NativeRelease | { release: null };
  if ('release' in latestRelease) throw new Error('管理员尚未发布该平台安装包。');
  return latestRelease;
}

function triggerBrowserDownload(release: NativeRelease, absoluteUrl: string) {
  const downloadLink = document.createElement('a');
  downloadLink.href = absoluteUrl;
  downloadLink.download = `BabyLink-${release.versionName}.${release.platform === 'android' ? 'apk' : 'ipa'}`;
  downloadLink.rel = 'noopener';
  downloadLink.style.display = 'none';
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}

function normalizedAndroidVerificationMetadata(release: NativeRelease) {
  const sha256 = String(release.sha256 ?? '').trim().toLowerCase();
  const versionCode = Number(release.versionCode);
  if (!/^[0-9a-f]{64}$/.test(sha256) || !Number.isSafeInteger(versionCode) || versionCode < 1) {
    throw new Error('安装包校验信息无效，请重新检查更新。');
  }
  return { sha256, versionCode };
}

export async function installNativeRelease(inputRelease: NativeRelease): Promise<NativeReleaseActionResult> {
  const release = await refreshDownloadTicket(inputRelease);
  const absoluteUrl = new URL(release.downloadUrl, window.location.origin).toString();
  if (release.platform === 'android' && Capacitor.isNativePlatform()) {
    const installedVersion = await resolveInstalledVersion('android');
    if (installedVersion.versionCode <= LAST_ANDROID_VERSION_WITH_OPEN_INSTALL_STREAM) {
      try {
        await LinkUpdater.openDownload({ url: absoluteUrl });
      } catch {
        triggerBrowserDownload(release, absoluteUrl);
      }
      return 'browser-download';
    }
    const metadata = normalizedAndroidVerificationMetadata(release);
    try {
      const result = await LinkUpdater.installUpdate({ url: absoluteUrl, ...metadata });
      return result.status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? '');
      if (!/(not implemented|not available|does not exist|unimplemented|invalid update verification metadata)/i.test(message)) throw error;
      await LinkUpdater.openDownload({ url: absoluteUrl });
      return 'browser-download';
    }
  }
  triggerBrowserDownload(release, absoluteUrl);
  return 'browser-download';
}

export async function fetchIosUpdateSourceLink() {
  const response = await fetch('/api/releases/altstore/source-link', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await responseError(response));
  return await response.json() as IosUpdateSourceLink;
}

export async function openNativeReleaseDownload(release: NativeRelease) {
  const refreshedRelease = await refreshDownloadTicket(release);
  const absoluteUrl = new URL(refreshedRelease.downloadUrl, window.location.origin).toString();
  if (release.platform === 'android' && Capacitor.isNativePlatform()) {
    try {
      await LinkUpdater.openDownload({ url: absoluteUrl });
      return;
    } catch {}
  }
  triggerBrowserDownload(refreshedRelease, absoluteUrl);
}