interface BackupFileHandle {
  getFile(): Promise<File>;
  createWritable(): Promise<BackupWritableFile>;
}

interface BackupDirectoryHandle {
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<BackupDirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<BackupFileHandle>;
  removeEntry(name: string): Promise<void>;
}

interface BackupStorageManager {
  getDirectory?: () => Promise<BackupDirectoryHandle>;
}

interface BackupWritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
  abort?: () => Promise<void>;
}

export interface BackupTemporaryFile {
  file: File;
  cleanup(): Promise<void>;
}

export interface BackupTemporaryFileWriter {
  write(data: Blob): Promise<void>;
  close(): Promise<BackupTemporaryFile>;
  abort(): Promise<void>;
}

const backupTemporaryDirectoryName = 'link-backup-temporary-v1';

function getStorageManager() {
  return typeof navigator === 'undefined' ? undefined : navigator.storage as BackupStorageManager | undefined;
}

function createTemporaryFileName(fileName: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const safeName = fileName.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'backup';
  return `${safeName}.${suffix}.part`;
}

export function canUseBackupTemporaryFiles() {
  return Boolean(getStorageManager()?.getDirectory);
}

export async function createBackupTemporaryFileWriter(fileName: string): Promise<BackupTemporaryFileWriter> {
  const root = await getStorageManager()?.getDirectory?.();
  if (!root) throw new Error('当前浏览器不支持大文件流式备份，请使用最新 Chrome 或安装 BabyLink App。');

  const directory = await root.getDirectoryHandle(backupTemporaryDirectoryName, { create: true });
  const temporaryName = createTemporaryFileName(fileName);
  const fileHandle = await directory.getFileHandle(temporaryName, { create: true });
  const writable = await fileHandle.createWritable();
  let state: 'active' | 'closed' = 'active';

  const cleanup = async () => {
    await directory.removeEntry(temporaryName).catch(() => undefined);
  };

  return {
    async write(data) {
      if (state !== 'active') throw new Error('备份临时文件已关闭。');
      if (!data.size) return;
      await writable.write(data);
    },
    async close() {
      if (state !== 'active') throw new Error('备份临时文件已关闭。');
      await writable.close();
      state = 'closed';
      return { file: await fileHandle.getFile(), cleanup };
    },
    async abort() {
      if (state !== 'active') return;
      state = 'closed';
      if (writable.abort) await writable.abort().catch(() => undefined);
      else await writable.close().catch(() => undefined);
      await cleanup();
    }
  };
}