import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { linkLocalDbVersion } from '@/data/db';

export const linkApiSchemaVersion = 1;

export interface LinkReleaseManifest {
  schemaVersion: 1;
  webBuildId: string;
  apiSchemaVersion: number;
  minDbVersion: number;
  minNativeBuild: {
    android: number;
    ios: number;
  };
  generatedAt: string;
}

export type ReleaseCompatibility =
  | { state: 'compatible'; manifest: LinkReleaseManifest; updateAvailable: boolean }
  | { state: 'unavailable'; reason: string }
  | { state: 'incompatible'; manifest: LinkReleaseManifest; reason: string };

let cachedManifest: LinkReleaseManifest | null = null;

function manifestUrl() {
  const baseUrl = import.meta.env.BASE_URL || '/';
  return new URL(`${baseUrl.replace(/\/$/, '')}/release-manifest.json`, window.location.origin).toString();
}

function normalizeManifest(value: unknown): LinkReleaseManifest | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const schemaVersion = Number(record.schemaVersion);
  const apiSchemaVersion = Number(record.apiSchemaVersion);
  const minDbVersion = Number(record.minDbVersion);
  const rawMinNativeBuild = record.minNativeBuild;
  const minNativeBuild = rawMinNativeBuild && typeof rawMinNativeBuild === 'object'
    ? {
        android: Number((rawMinNativeBuild as Record<string, unknown>).android),
        ios: Number((rawMinNativeBuild as Record<string, unknown>).ios)
      }
    : null;
  const webBuildId = String(record.webBuildId ?? '').trim();
  const generatedAt = String(record.generatedAt ?? '').trim();
  if (schemaVersion !== 1 || !webBuildId || !Number.isFinite(apiSchemaVersion) || !Number.isFinite(minDbVersion) || !minNativeBuild || !Number.isFinite(minNativeBuild.android) || !Number.isFinite(minNativeBuild.ios)) return null;
  return {
    schemaVersion: 1,
    webBuildId,
    apiSchemaVersion,
    minDbVersion,
    minNativeBuild: {
      android: Math.max(0, Math.round(minNativeBuild.android)),
      ios: Math.max(0, Math.round(minNativeBuild.ios))
    },
    generatedAt
  };
}

async function currentNativeBuild() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const info = await App.getInfo();
    const build = Math.max(0, Math.round(Number(info.build) || 0));
    return build || null;
  } catch {
    return null;
  }
}

export async function fetchReleaseManifest(options: { force?: boolean } = {}) {
  if (cachedManifest && !options.force) return cachedManifest;
  try {
    const response = await fetch(manifestUrl(), { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) throw new Error(`release manifest returned ${response.status}`);
    const manifest = normalizeManifest(await response.json());
    if (!manifest) throw new Error('release manifest schema is invalid');
    cachedManifest = manifest;
    return manifest;
  } catch (error) {
    cachedManifest = null;
    throw error instanceof Error ? error : new Error('release manifest unavailable');
  }
}

export async function checkReleaseCompatibility(options: { dbVersion?: number; force?: boolean } = {}): Promise<ReleaseCompatibility> {
  let manifest: LinkReleaseManifest;
  try {
    manifest = await fetchReleaseManifest({ force: options.force });
  } catch (error) {
    return { state: 'unavailable', reason: error instanceof Error ? error.message : 'release manifest unavailable' };
  }

  const dbVersion = Number(options.dbVersion ?? linkLocalDbVersion);
  if (linkApiSchemaVersion < manifest.apiSchemaVersion) {
    return { state: 'incompatible', manifest, reason: `当前网页 API 契约 v${linkApiSchemaVersion} 低于发布要求 v${manifest.apiSchemaVersion}。请先更新网页资源。` };
  }
  if (dbVersion < manifest.minDbVersion) {
    return { state: 'incompatible', manifest, reason: `当前本地数据库 v${dbVersion} 低于发布要求 v${manifest.minDbVersion}。` };
  }
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform() === 'android' ? 'android' : 'ios';
    const requiredNativeBuild = manifest.minNativeBuild[platform];
    if (requiredNativeBuild > 0) {
      const installedNativeBuild = await currentNativeBuild();
      if (!installedNativeBuild) return { state: 'incompatible', manifest, reason: '无法读取当前原生壳版本，无法确认其是否兼容本次网站发布。请更新应用后重试。' };
      if (installedNativeBuild < requiredNativeBuild) {
        return { state: 'incompatible', manifest, reason: `当前 ${platform === 'android' ? 'Android' : 'iOS'} 原生壳 build ${installedNativeBuild} 低于发布要求 build ${requiredNativeBuild}。请先更新应用。` };
      }
    }
  }
  return {
    state: 'compatible',
    manifest,
    updateAvailable: manifest.webBuildId !== __LINK_WEB_BUILD__
  };
}