import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeFileShareAvailable, shareNativeFile } from '@/services/nativeFile';

interface NativeBackupPlugin {
  beginArchive(options: { fileName: string; totalBytes: number }): Promise<{ sessionId: string; fileName: string; location: string }>;
  appendArchiveChunk(options: { sessionId: string; data: string }): Promise<{ writtenBytes: number }>;
  finishArchive(options: { sessionId: string }): Promise<NativeBackupSaveResult>;
  abortArchive(options: { sessionId: string }): Promise<void>;
  saveArchive(options: { dataUrl: string; fileName: string }): Promise<{ saved: boolean; fileName: string }>;
}

const LinkBackup = registerPlugin<NativeBackupPlugin>('LinkBackup');
const nativeBackupChunkBytes = 512 * 1024;
const legacyBackupMaxBytes = 12 * 1024 * 1024;

export interface NativeBackupSaveResult {
  saved: boolean;
  fileName: string;
  location: string;
}

export type NativeBackupSaveProgress = (writtenBytes: number, totalBytes: number) => void | Promise<void>;

export function isNativeBackupSaveAvailable() {
  return Capacitor.isPluginAvailable('LinkBackup')
    || isNativeFileShareAvailable();
}

function isChunkedNativeBackupAvailable() {
  const runtime = (globalThis as typeof globalThis & {
    Capacitor?: { PluginHeaders?: Array<{ name?: string; methods?: Array<{ name?: string }> }> };
  }).Capacitor;
  const header = runtime?.PluginHeaders?.find((entry) => entry.name === 'LinkBackup');
  return Boolean(header?.methods?.some((method) => method.name === 'beginArchive'));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const binaryChunkBytes = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += binaryChunkBytes) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + binaryChunkBytes));
  }
  return window.btoa(binary);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('备份文件读取失败。')));
    reader.readAsDataURL(blob);
  });
}

async function saveChunkedNativeBackupArchive(blob: Blob, fileName: string, onProgress?: NativeBackupSaveProgress) {
  const session = await LinkBackup.beginArchive({ fileName, totalBytes: blob.size });
  try {
    for (let offset = 0; offset < blob.size; offset += nativeBackupChunkBytes) {
      const end = Math.min(offset + nativeBackupChunkBytes, blob.size);
      const bytes = new Uint8Array(await blob.slice(offset, end).arrayBuffer());
      await LinkBackup.appendArchiveChunk({ sessionId: session.sessionId, data: bytesToBase64(bytes) });
      await onProgress?.(end, blob.size);
    }
    return await LinkBackup.finishArchive({ sessionId: session.sessionId });
  } catch (error) {
    await LinkBackup.abortArchive({ sessionId: session.sessionId }).catch(() => undefined);
    throw error;
  }
}

export async function saveNativeBackupArchive(blob: Blob, fileName: string, onProgress?: NativeBackupSaveProgress): Promise<NativeBackupSaveResult | null> {
  if (!isNativeBackupSaveAvailable()) return null;
  if (Capacitor.isPluginAvailable('LinkBackup') && isChunkedNativeBackupAvailable()) {
    return await saveChunkedNativeBackupArchive(blob, fileName, onProgress);
  }
  if (Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LinkBackup') && blob.size <= legacyBackupMaxBytes) {
    const result = await LinkBackup.saveArchive({ dataUrl: await blobToDataUrl(blob), fileName });
    return {
      saved: result.saved,
      fileName: result.fileName,
      location: `Downloads/BabyLink/${result.fileName}`
    };
  }
  if (blob.size > legacyBackupMaxBytes) throw new Error('当前 App 版本不支持安全导出大型备份，请更新到最新版后重试。');
  const shared = await shareNativeFile(blob, fileName);
  return shared ? { saved: true, fileName, location: '系统文件或分享目标' } : null;
}
