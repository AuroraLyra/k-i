import type { ThemeFontEntry } from '@/types/domain';
import { hydrateStoredMediaRefs, isStoredLinkMediaUrl, resolveLocalMediaBlob, storeLocalMediaBlob } from '@/utils/mediaStorage';

const fontAssetPlaceholderPrefix = '__LINK_THEME_FONT_ASSET_';
const maxStylesheetImportDepth = 4;
const fontDownloadConcurrency = 4;
const fontMimeByExtension: Record<string, string> = {
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf'
};

function getUrlExtension(url: string) {
  try {
    return new URL(url, window.location.href).pathname.split('.').pop()?.toLowerCase() ?? '';
  } catch {
    return url.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  }
}

function normalizeFontBlob(blob: Blob, sourceUrl: string) {
  const normalizedType = blob.type.trim().toLowerCase();
  if (normalizedType.startsWith('font/') || /application\/(?:font|x-font)/i.test(normalizedType)) return blob;
  const inferredType = fontMimeByExtension[getUrlExtension(sourceUrl)];
  return inferredType ? new Blob([blob], { type: inferredType }) : blob;
}

async function fetchResource(url: string, accept: string) {
  const endpoints = /^https?:\/\//i.test(url)
    ? [url, `/__asset-download?url=${encodeURIComponent(url)}`]
    : [url];
  let lastError: unknown = null;
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { Accept: accept } });
      if (response.ok) return response;
      lastError = new Error(`下载失败（HTTP ${response.status}）。`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`字体资源下载失败：${url}`);
}

async function storeFontBlob(blob: Blob, sourceUrl: string) {
  const normalizedBlob = normalizeFontBlob(blob, sourceUrl);
  const storedUrl = await storeLocalMediaBlob(normalizedBlob);
  if (!storedUrl) throw new Error('浏览器无法将字体写入本地持久存储。');
  const usableUrl = navigator.serviceWorker?.controller
    ? storedUrl
    : await hydrateStoredMediaRefs(storedUrl, true);
  return { url: usableUrl, mimeType: normalizedBlob.type, size: normalizedBlob.size };
}

async function replaceAsync(value: string, expression: RegExp, replacer: (match: RegExpExecArray) => Promise<string>) {
  const matches = [...value.matchAll(expression)];
  if (!matches.length) return value;
  const replacements = await Promise.all(matches.map(replacer));
  let result = '';
  let cursor = 0;
  matches.forEach((match, index) => {
    const matchIndex = match.index ?? 0;
    result += value.slice(cursor, matchIndex) + replacements[index];
    cursor = matchIndex + match[0].length;
  });
  return result + value.slice(cursor);
}

async function mapWithConcurrency<T, R>(entries: T[], concurrency: number, mapper: (entry: T, index: number) => Promise<R>) {
  const results = new Array<R>(entries.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (cursor < entries.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(entries[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function getCssUrl(match: RegExpExecArray) {
  return String(match[2] ?? match[3] ?? '').trim();
}

function shouldCacheCssUrl(url: string) {
  return Boolean(url) && !/^(?:data:|blob:|#)/i.test(url) && !isStoredLinkMediaUrl(url);
}

async function inlineStylesheetImports(css: string, baseUrl: string, visited: Set<string>, depth: number): Promise<string> {
  if (depth >= maxStylesheetImportDepth) return css;
  const importExpression = /@import\s+(?:url\(\s*)?(["'])([^"']+)\1\s*\)?\s*([^;]*);/gi;
  return await replaceAsync(css, importExpression, async (match) => {
    const importUrl = new URL(match[2], baseUrl).href;
    if (visited.has(importUrl)) return '';
    visited.add(importUrl);
    const importedCss = await (await fetchResource(importUrl, 'text/css,*/*;q=0.1')).text();
    const inlinedCss = await inlineStylesheetImports(importedCss, importUrl, visited, depth + 1);
    const mediaQuery = String(match[3] ?? '').trim();
    return mediaQuery ? `@media ${mediaQuery} {\n${inlinedCss}\n}` : inlinedCss;
  });
}

async function cacheStylesheetAssets(css: string, baseUrl: string) {
  const urlExpression = /url\(\s*(?:(["'])(.*?)\1|([^)'"\s][^)]*?))\s*\)/gi;
  const absoluteUrls = [...new Set(
    [...css.matchAll(urlExpression)]
      .map((match) => getCssUrl(match))
      .filter(shouldCacheCssUrl)
      .map((url) => new URL(url, baseUrl).href)
  )];
  const assets = await mapWithConcurrency(absoluteUrls, fontDownloadConcurrency, async (url) => {
    const response = await fetchResource(url, 'font/woff2,font/woff,font/ttf,font/otf,*/*;q=0.1');
    return await storeFontBlob(await response.blob(), url);
  });
  const assetIndexByUrl = new Map(absoluteUrls.map((url, index) => [url, index]));
  const cachedCss = css.replace(urlExpression, (fullMatch, _quote, quotedUrl, unquotedUrl) => {
    const cssUrl = String(quotedUrl ?? unquotedUrl ?? '').trim();
    if (!shouldCacheCssUrl(cssUrl)) return fullMatch;
    const assetIndex = assetIndexByUrl.get(new URL(cssUrl, baseUrl).href);
    return assetIndex === undefined ? fullMatch : `url("${fontAssetPlaceholderPrefix}${assetIndex}__")`;
  });
  return {
    css: cachedCss,
    assets: assets.map((asset) => asset.url),
    size: new TextEncoder().encode(cachedCss).byteLength + assets.reduce((total, asset) => total + asset.size, 0)
  };
}

export function isThemeFontStylesheetUrl(url: string) {
  const normalizedUrl = url.trim().toLowerCase();
  return normalizedUrl.endsWith('.css') || normalizedUrl.includes('fonts.googleapis.com/css') || normalizedUrl.includes('fontsapi.zeoseven.com');
}

export function isThemeFontStylesheetEntry(entry: ThemeFontEntry) {
  return entry.mimeType.trim().toLowerCase() === 'text/css' || isThemeFontStylesheetUrl(entry.url);
}

export function hasPersistedThemeFontCache(entry: ThemeFontEntry) {
  if (entry.source === 'family') return true;
  if (entry.source === 'file') return isStoredLinkMediaUrl(entry.url) || /^blob:/i.test(entry.url);
  if (isThemeFontStylesheetEntry(entry)) return Boolean(entry.cachedCss?.trim());
  return Boolean(entry.cachedUrl?.trim());
}

export function getThemeFontFileUrl(entry: ThemeFontEntry) {
  return entry.cachedUrl?.trim() || entry.url.trim();
}

export function getThemeFontCss(entry: ThemeFontEntry) {
  let css = entry.cachedCss?.trim() ?? '';
  (entry.cachedAssets ?? []).forEach((url, index) => {
    css = css.split(`${fontAssetPlaceholderPrefix}${index}__`).join(url.replace(/\\/g, '\\\\').replace(/"/g, '\\"'));
  });
  return css;
}

export async function cacheThemeFontFile(entry: ThemeFontEntry, file: Blob) {
  const stored = await storeFontBlob(file, file instanceof File ? file.name : entry.name);
  return {
    ...entry,
    url: stored.url,
    cachedUrl: '',
    cachedCss: '',
    cachedAssets: [],
    mimeType: stored.mimeType,
    size: stored.size
  } satisfies ThemeFontEntry;
}

export async function cacheThemeFontEntry(entry: ThemeFontEntry) {
  if (hasPersistedThemeFontCache(entry)) return entry;

  if (entry.source === 'file') {
    const blob = await resolveLocalMediaBlob(entry.url);
    if (!blob) throw new Error('本地字体文件已丢失，请重新导入。');
    return await cacheThemeFontFile(entry, blob);
  }

  if (entry.source === 'family') return entry;
  if (isThemeFontStylesheetEntry(entry)) {
    const response = await fetchResource(entry.url, 'text/css,*/*;q=0.1');
    const importedCss = await inlineStylesheetImports(await response.text(), entry.url, new Set([entry.url]), 0);
    const cached = await cacheStylesheetAssets(importedCss, entry.url);
    return {
      ...entry,
      cachedUrl: '',
      cachedCss: cached.css,
      cachedAssets: cached.assets,
      mimeType: 'text/css',
      size: cached.size
    } satisfies ThemeFontEntry;
  }

  const response = await fetchResource(entry.url, 'font/woff2,font/woff,font/ttf,font/otf,*/*;q=0.1');
  const stored = await storeFontBlob(await response.blob(), entry.url);
  return {
    ...entry,
    cachedUrl: stored.url,
    cachedCss: '',
    cachedAssets: [],
    mimeType: stored.mimeType,
    size: stored.size
  } satisfies ThemeFontEntry;
}