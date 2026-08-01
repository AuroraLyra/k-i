import { compactStoredInlineImages, loadSnapshot } from '@/data/db';
import { inspectStoredMediaHealth, linkMediaCacheName } from '@/utils/mediaStorage';
import type { StorageInventoryEntry, StorageInventorySnapshot } from '@/types/storage';

export interface ContentStorageSection {
  id: string;
  label?: string;
  description?: string;
  bytes: number;
  count: number;
  protected?: boolean;
  clearable?: boolean;
}

type StorageManagerWithOpfs = {
  getDirectory?: () => Promise<OpfsDirectoryHandle>;
};

interface OpfsDirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<{ getFile(): Promise<File> }>;
  keys?: () => AsyncIterable<string>;
}

interface ByteStats {
  bytes: number;
  count: number;
  available: boolean;
}

const mediaDirectoryName = 'link-large-media-v1';
const mediaIndexedDbName = 'link-large-media-v1';
const mediaIndexedDbStoreName = 'media';

function unavailableStats(): ByteStats {
  return { bytes: 0, count: 0, available: false };
}

function byteStats(bytes = 0, count = 0): ByteStats {
  return { bytes, count, available: true };
}

function localStorageStats(): ByteStats {
  if (typeof window === 'undefined') return unavailableStats();
  try {
    let bytes = 0;
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index) ?? '';
      const value = window.localStorage.getItem(key) ?? '';
      bytes += new Blob([key, value]).size;
    }
    return byteStats(bytes, window.localStorage.length);
  } catch {
    return unavailableStats();
  }
}

async function opfsStats(): Promise<ByteStats> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage as unknown as StorageManagerWithOpfs;
  if (!storage?.getDirectory) return unavailableStats();

  try {
    const root = await storage.getDirectory();
    const directory = await root.getDirectoryHandle(mediaDirectoryName);
    if (!directory.keys) return unavailableStats();
    let bytes = 0;
    let count = 0;
    for await (const id of directory.keys()) {
      const file = await (await directory.getFileHandle(id)).getFile();
      bytes += file.size;
      count += 1;
    }
    return byteStats(bytes, count);
  } catch {
    return byteStats();
  }
}

async function mediaIndexedDbStats(): Promise<ByteStats> {
  if (typeof indexedDB === 'undefined') return unavailableStats();
  const factory = indexedDB as IDBFactory & { databases?: () => Promise<Array<{ name?: string }>> };
  if (!factory.databases) return unavailableStats();

  try {
    const databases = await factory.databases();
    if (!databases.some((database) => database.name === mediaIndexedDbName)) return byteStats();
  } catch {
    return unavailableStats();
  }

  return await new Promise<ByteStats>((resolve) => {
    const request = indexedDB.open(mediaIndexedDbName);
    request.addEventListener('error', () => resolve(unavailableStats()));
    request.addEventListener('blocked', () => resolve(unavailableStats()));
    request.addEventListener('success', () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(mediaIndexedDbStoreName)) {
        database.close();
        resolve(byteStats());
        return;
      }
      const transaction = database.transaction(mediaIndexedDbStoreName, 'readonly');
      const cursorRequest = transaction.objectStore(mediaIndexedDbStoreName).openCursor();
      let bytes = 0;
      let count = 0;
      cursorRequest.addEventListener('success', () => {
        const cursor = cursorRequest.result;
        if (!cursor) return;
        if (cursor.value instanceof Blob) bytes += cursor.value.size;
        count += 1;
        cursor.continue();
      });
      transaction.addEventListener('complete', () => {
        database.close();
        resolve(byteStats(bytes, count));
      });
      transaction.addEventListener('error', () => {
        database.close();
        resolve(unavailableStats());
      });
      transaction.addEventListener('abort', () => {
        database.close();
        resolve(unavailableStats());
      });
    });
  });
}

async function cacheStats(cacheName: string): Promise<ByteStats> {
  if (typeof caches === 'undefined') return unavailableStats();
  try {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();
    let bytes = 0;
    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      try {
        bytes += (await response.clone().blob()).size;
      } catch {
        continue;
      }
    }
    return byteStats(bytes, requests.length);
  } catch {
    return unavailableStats();
  }
}

async function pwaCacheStats(): Promise<ByteStats> {
  if (typeof caches === 'undefined') return unavailableStats();
  try {
    const names = await caches.keys();
    const appCacheNames = names.filter((name) => name !== linkMediaCacheName);
    const stats = await Promise.all(appCacheNames.map((name) => cacheStats(name)));
    return {
      bytes: stats.reduce((total, entry) => total + entry.bytes, 0),
      count: stats.reduce((total, entry) => total + entry.count, 0),
      available: true
    };
  } catch {
    return unavailableStats();
  }
}

async function browserStorageEstimate() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return {
      usage: Number(estimate?.usage ?? 0),
      quota: Number(estimate?.quota ?? 0)
    };
  } catch {
    return { usage: 0, quota: 0 };
  }
}

function inventoryEntry(id: StorageInventoryEntry['id'], label: string, description: string, stats: ByteStats, approximate = false): StorageInventoryEntry {
  return { id, label, description, ...stats, ...(approximate ? { approximate: true } : {}) };
}

export function estimateGroupedDataBytes(groups: unknown[]) {
  try {
    return new Blob([JSON.stringify(groups)]).size;
  } catch {
    return 0;
  }
}

export async function inspectSupplementalContentSections(): Promise<ContentStorageSection[]> {
  const snapshot = await loadSnapshot();
  return [
    {
      id: 'fanfic',
      label: '同人小说',
      description: '书籍、章节、评论、题材与生成任务',
      count: (snapshot.fanficBooks ?? []).length + (snapshot.fanficChapters ?? []).length + (snapshot.fanficComments ?? []).length + (snapshot.fanficTopics ?? []).length + (snapshot.fanficGenerationJobs ?? []).length,
      bytes: estimateGroupedDataBytes([snapshot.fanficBooks ?? [], snapshot.fanficChapters ?? [], snapshot.fanficComments ?? [], snapshot.fanficTopics ?? [], snapshot.fanficGenerationJobs ?? []]),
      clearable: true
    },
    {
      id: 'commerce',
      label: '钱包与商店',
      description: '钱包账目、店铺、商品、订单与收藏；重置后会按需生成示例资料',
      count: (snapshot.walletAccounts ?? []).length + (snapshot.walletTransactions ?? []).length + (snapshot.shopStorefronts ?? []).length + (snapshot.shopProducts ?? []).length + (snapshot.shopCartItems ?? []).length + (snapshot.shopWishlistItems ?? []).length + (snapshot.shopOrders ?? []).length + (snapshot.shopMoments ?? []).length,
      bytes: estimateGroupedDataBytes([snapshot.walletAccounts ?? [], snapshot.walletTransactions ?? [], snapshot.shopStorefronts ?? [], snapshot.shopProducts ?? [], snapshot.shopCartItems ?? [], snapshot.shopWishlistItems ?? [], snapshot.shopOrders ?? [], snapshot.shopMoments ?? []]),
      clearable: true
    },
    {
      id: 'roleOperations',
      label: '角色运营',
      description: '社交账号、草稿、外发任务、运营策略与审计记录',
      count: (snapshot.roleSocialAccounts ?? []).length + (snapshot.userSocialAccounts ?? []).length + (snapshot.roleContentDrafts ?? []).length + (snapshot.roleOutboundTasks ?? []).length + (snapshot.roleOperationPolicies ?? []).length + (snapshot.roleOperationAudits ?? []).length,
      bytes: estimateGroupedDataBytes([snapshot.roleSocialAccounts ?? [], snapshot.userSocialAccounts ?? [], snapshot.roleContentDrafts ?? [], snapshot.roleOutboundTasks ?? [], snapshot.roleOperationPolicies ?? [], snapshot.roleOperationAudits ?? []]),
      clearable: true
    }
  ];
}

export async function inspectStorageInventory(sections: ContentStorageSection[]): Promise<StorageInventorySnapshot> {
  const contentBytes = sections.reduce((total, section) => total + section.bytes, 0);
  const [browser, opfs, mediaIndexedDb, mediaCache, pwaCache] = await Promise.all([
    browserStorageEstimate(),
    opfsStats(),
    mediaIndexedDbStats(),
    cacheStats(linkMediaCacheName),
    pwaCacheStats()
  ]);
  const localStorage = localStorageStats();
  let mediaHealth = { expected: 0, available: 0, missing: 0 };
  try {
    mediaHealth = await inspectStoredMediaHealth(await loadSnapshot());
  } catch {
    mediaHealth = { expected: 0, available: 0, missing: 0 };
  }

  return {
    refreshedAt: Date.now(),
    contentBytes,
    browserUsageBytes: browser.usage,
    browserQuotaBytes: browser.quota,
    localStorageBytes: localStorage.bytes,
    mediaHealth,
    entries: [
      inventoryEntry('content', '业务数据', '聊天、角色、记忆、世界书等内容估算', byteStats(contentBytes, sections.reduce((total, section) => total + section.count, 0)), true),
      inventoryEntry('local-storage', '启动与偏好', '轻量启动快照与页面偏好', localStorage),
      inventoryEntry('opfs-media', '媒体文件库', 'OPFS 中的大图片与音频原件', opfs),
      inventoryEntry('media-indexed-db', '媒体容灾副本', '本地媒体的 IndexedDB 备用副本', mediaIndexedDb),
      inventoryEntry('media-cache', '媒体响应缓存', '无法使用文件库时的媒体回退缓存', mediaCache),
      inventoryEntry('pwa-cache', '离线应用资源', 'PWA 页面、脚本、字体和图标资源', pwaCache)
    ]
  };
}

export async function optimizeLocalStorage() {
  return await compactStoredInlineImages();
}

export async function clearPwaResourceCache() {
  if (typeof caches === 'undefined') return 0;
  const names = await caches.keys();
  const removable = names.filter((name) => name !== linkMediaCacheName);
  await Promise.all(removable.map((name) => caches.delete(name)));
  return removable.length;
}