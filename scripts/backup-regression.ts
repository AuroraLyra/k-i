import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { strToU8, zipSync } from 'fflate';
import type { AppSnapshot } from '@/types/domain';
import type { LinkBackupArchive } from '@/utils/backup';

class MemoryFileHandle {
  private content = new Blob();

  constructor(private readonly name: string) {}

  async getFile() {
    return new File([this.content], this.name);
  }

  async createWritable() {
    const chunks: Blob[] = [];
    return {
      write: async (data: Blob) => {
        chunks.push(data);
      },
      close: async () => {
        this.content = new Blob(chunks);
      },
      abort: async () => undefined
    };
  }
}

class MemoryDirectoryHandle {
  private readonly directories = new Map<string, MemoryDirectoryHandle>();
  private readonly files = new Map<string, MemoryFileHandle>();

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const existing = this.directories.get(name);
    if (existing) return existing;
    if (!options?.create) throw new Error(`Directory not found: ${name}`);
    const directory = new MemoryDirectoryHandle();
    this.directories.set(name, directory);
    return directory;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    const existing = this.files.get(name);
    if (existing) return existing;
    if (!options?.create) throw new Error(`File not found: ${name}`);
    const file = new MemoryFileHandle(name);
    this.files.set(name, file);
    return file;
  }

  async removeEntry(name: string) {
    if (!this.files.delete(name) && !this.directories.delete(name)) throw new Error(`Entry not found: ${name}`);
  }
}

const root = new MemoryDirectoryHandle();
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    storage: {
      getDirectory: async () => root
    }
  }
});
Object.defineProperty(globalThis, 'File', { configurable: true, value: File });

const { createLinkBackupArchiveBlob, parseLinkBackupBlob } = await import('@/utils/backup');
const snapshot = { settings: {} } as AppSnapshot;
const collisionBytes = new Uint8Array(800_000);
collisionBytes.fill(37);
collisionBytes.set([0x50, 0x4b, 0x07, 0x08], 120_000);
const exportedAt = Date.now();
const archive: LinkBackupArchive = {
  backup: {
    app: 'LINK',
    backupVersion: 1,
    exportedAt,
    snapshot
  },
  media: [{
    id: 'm000001',
    path: 'media/m000001.png',
    source: 'regression',
    blob: new Blob([collisionBytes], { type: 'image/png' })
  }]
};

const collisionArchive = await createLinkBackupArchiveBlob(archive);
const restored = await parseLinkBackupBlob(collisionArchive);
assert.equal(restored.exportedAt, exportedAt, 'media containing the ZIP data-descriptor signature must restore');

const missingManifest = {
  app: 'LINK',
  backupVersion: 2,
  archive: 'zip-media-v1',
  exportedAt,
  snapshot,
  media: [{
    id: 'm000001',
    path: 'media/m000001.png',
    mimeType: 'image/png',
    byteLength: 64
  }]
};
const missingArchive = new Blob([zipSync({
  'link-backup.json': strToU8(JSON.stringify(missingManifest))
})], { type: 'application/zip' });
await assert.rejects(parseLinkBackupBlob(missingArchive), /备份媒体文件不完整：media\/m000001\.png/);

const truncatedArchive = new Blob([zipSync({
  'link-backup.json': strToU8(JSON.stringify(missingManifest)),
  'media/m000001.png': new Uint8Array(63)
})], { type: 'application/zip' });
await assert.rejects(parseLinkBackupBlob(truncatedArchive), /备份媒体文件不完整：media\/m000001\.png/);

console.log('backup regression checks passed');