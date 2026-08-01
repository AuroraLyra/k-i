import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNativeFileShareAvailable, shareNativeFile } from '@/services/nativeFile';

interface NativeBackupPlugin {
  beginArchive(options: { fileName: string; totalBytes: number }): Promise<{ sessionId: string; fileName: string; location: string }>;
  appendArchiveChunk(options: { sessionId: string; data: string }): Promise<{ writtenBytes: number }>;
  finishArchive(options: { sessionId: string }): Promise<NativeBackupSaveResult>;
  abortArchive(options: { sessionId: string }): Promise<void>;
}

const LinkBackup = registerPlugin<NativeBackupPlugin>('LinkBackup');
const nativeBackupChunkBytes = 512 * 1024;

export interface NativeBackupSaveResult {
  saved: boolean;
  fileName: string;
  location: string;
  requiresUserSave?: boolean;
}

export type NativeBackupSaveProgress = (writtenBytes: number, totalBytes: number) => void | Promise<void>;

export function isNativeBackupSaveAvailable() {
  return isNativeBackupFileSaveAvailable()
    || isNativeFileShareAvailable();
}

function nativeBackupMethods() {
  const runtime = (globalThis as typeof globalThis & {
    Capacitor?: { PluginHeaders?: Array<{ name?: string; methods?: Array<{ name?: string }> }> };
  }).Capacitor;
  return runtime?.PluginHeaders?.find((entry) => entry.name === 'LinkBackup')?.methods;
}

function hasNativeBackupMethod(methodName: string) {
  return nativeBackupMethods()?.some((method) => method.name === methodName) === true;
}

function isChunkedNativeBackupAvailable() {
  return hasNativeBackupMethod('beginArchive');
}

function isNativeBackupFileSaveAvailable() {
  return Capacitor.isNativePlatform()
    && Capacitor.isPluginAvailable('LinkBackup')
    && isChunkedNativeBackupAvailable();
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const binaryChunkBytes = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += binaryChunkBytes) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + binaryChunkBytes));
  }
  return window.btoa(binary);
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
  if (isNativeBackupFileSaveAvailable()) {
    return await saveChunkedNativeBackupArchive(blob, fileName, onProgress);
  }
  const shared = await shareNativeFile(blob, fileName);
  return shared ? {
    saved: true,
    fileName,
    location: '系统保存或分享面板',
    requiresUserSave: true
  } : null;
}
