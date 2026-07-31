export type DesktopBridgePlatform = 'desktop-macos' | 'desktop-windows';

export interface DesktopBridgeRelease {
  id: string;
  platform: DesktopBridgePlatform;
  versionCode: number;
  versionName: string;
  sha256: string;
  fileSize: number;
  notes: string;
  publishedAt: number;
  downloadUrl: string;
  downloadExpiresAt: number;
}

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  return body?.message || body?.error || `安装包请求失败 (${response.status})`;
}

export async function fetchDesktopBridgeRelease(platform: DesktopBridgePlatform) {
  const params = new URLSearchParams({ platform, versionCode: '0' });
  const response = await fetch(`/api/releases/latest?${params.toString()}`, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await responseError(response));
  const payload = await response.json() as DesktopBridgeRelease | { release: null };
  return 'release' in payload ? null : payload;
}

async function refreshDownloadTicket(release: DesktopBridgeRelease) {
  if (release.downloadExpiresAt > Date.now() + 15_000) return release;
  const latestRelease = await fetchDesktopBridgeRelease(release.platform);
  if (!latestRelease) throw new Error('管理员尚未发布该平台安装包。');
  return latestRelease;
}

export async function downloadDesktopBridgeRelease(inputRelease: DesktopBridgeRelease) {
  const release = await refreshDownloadTicket(inputRelease);
  const extension = release.platform === 'desktop-macos' ? 'dmg' : 'exe';
  const platformName = release.platform === 'desktop-macos' ? 'mac' : 'windows';
  const downloadLink = document.createElement('a');
  downloadLink.href = new URL(release.downloadUrl, window.location.origin).toString();
  downloadLink.download = `BabyLink-Bridge-${release.versionName}-${platformName}.${extension}`;
  downloadLink.rel = 'noopener';
  downloadLink.style.display = 'none';
  document.body.append(downloadLink);
  downloadLink.click();
  downloadLink.remove();
}