export type StorageInventoryEntryId = 'content' | 'local-storage' | 'opfs-media' | 'media-indexed-db' | 'media-cache' | 'pwa-cache' | 'native-cache';

export interface StorageInventoryEntry {
  id: StorageInventoryEntryId;
  label: string;
  description: string;
  bytes: number;
  count: number;
  available: boolean;
  approximate?: boolean;
}

export interface StoredMediaHealth {
  expected: number;
  available: number;
  missing: number;
}

export interface StorageInventorySnapshot {
  refreshedAt: number;
  contentBytes: number;
  browserUsageBytes: number;
  browserQuotaBytes: number;
  localStorageBytes: number;
  entries: StorageInventoryEntry[];
  mediaHealth: StoredMediaHealth;
}

export interface NativeStorageOverview {
  platform: 'android' | 'ios';
  availableBytes: number;
  totalBytes: number;
  cacheBytes: number;
  cacheFileCount: number;
}

export interface StorageRuntime {
  isNative: boolean;
  platform: 'web' | 'android' | 'ios';
  label: string;
}