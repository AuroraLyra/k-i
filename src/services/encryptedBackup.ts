const encryptedBackupIterations = 600_000;
const encryptedBackupChunkBytes = 4 * 1024 * 1024;
const encryptedBackupMagic = new TextEncoder().encode('LINKENC2');

export interface EncryptedLinkBackupEnvelope {
  app: 'LINK';
  encryptedBackupVersion: 2;
  exportedAt: number;
  kdf: {
    name: 'PBKDF2-SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-256-GCM';
    chunked: true;
  };
  plaintextBytes: number;
  chunks: Array<{
    iv: string;
    plaintextBytes: number;
    encryptedBytes: number;
  }>;
}

export type BackupCryptoProgress = (percent: number) => void | Promise<void>;

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function deriveEncryptionKey(recoveryKey: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(recoveryKey),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: toArrayBuffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function createBackupRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `BLK1-${bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`;
}

function encodeHeaderLength(length: number) {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, length, true);
  return buffer;
}

function validateRecoveryKey(recoveryKey: string) {
  if (recoveryKey.trim().length < 24) throw new Error('恢复密钥无效，请重新生成。');
}

export async function encryptLinkBackupBlob(plainText: string, recoveryKey: string, exportedAt = Date.now(), onProgress?: BackupCryptoProgress) {
  validateRecoveryKey(recoveryKey);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveEncryptionKey(recoveryKey.trim(), salt, encryptedBackupIterations);
  const source = new Blob([plainText], { type: 'application/json;charset=utf-8' });
  const encryptedParts: ArrayBuffer[] = [];
  const chunks: EncryptedLinkBackupEnvelope['chunks'] = [];
  const totalChunks = Math.max(1, Math.ceil(source.size / encryptedBackupChunkBytes));

  for (let index = 0; index < totalChunks; index += 1) {
    const offset = index * encryptedBackupChunkBytes;
    const plaintext = await source.slice(offset, Math.min(offset + encryptedBackupChunkBytes, source.size)).arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv), tagLength: 128 },
      key,
      plaintext
    );
    encryptedParts.push(encrypted);
    chunks.push({ iv: bytesToBase64(iv), plaintextBytes: plaintext.byteLength, encryptedBytes: encrypted.byteLength });
    await onProgress?.(Math.round(((index + 1) / totalChunks) * 100));
  }

  const envelope: EncryptedLinkBackupEnvelope = {
    app: 'LINK',
    encryptedBackupVersion: 2,
    exportedAt,
    kdf: { name: 'PBKDF2-SHA-256', iterations: encryptedBackupIterations, salt: bytesToBase64(salt) },
    cipher: { name: 'AES-256-GCM', chunked: true },
    plaintextBytes: source.size,
    chunks
  };
  const header = new TextEncoder().encode(JSON.stringify(envelope));
  return new Blob(
    [toArrayBuffer(encryptedBackupMagic), encodeHeaderLength(header.byteLength), toArrayBuffer(header), ...encryptedParts],
    { type: 'application/vnd.babylink.encrypted-backup' }
  );
}

export async function decryptLinkBackupBlob(blob: Blob, recoveryKey: string, onProgress?: BackupCryptoProgress) {
  validateRecoveryKey(recoveryKey);
  const prefixLength = encryptedBackupMagic.byteLength + 4;
  if (blob.size < prefixLength) throw new Error('云端文件不是有效的 BabyLink 加密备份。');
  const prefix = new Uint8Array(await blob.slice(0, prefixLength).arrayBuffer());
  for (let index = 0; index < encryptedBackupMagic.byteLength; index += 1) {
    if (prefix[index] !== encryptedBackupMagic[index]) throw new Error('云端文件不是有效的 BabyLink 加密备份。');
  }

  const headerLength = new DataView(prefix.buffer, prefix.byteOffset + encryptedBackupMagic.byteLength, 4).getUint32(0, true);
  if (!headerLength || headerLength > 4 * 1024 * 1024 || prefixLength + headerLength > blob.size) {
    throw new Error('云端备份头部损坏。');
  }

  let envelope: EncryptedLinkBackupEnvelope;
  try {
    envelope = JSON.parse(await blob.slice(prefixLength, prefixLength + headerLength).text()) as EncryptedLinkBackupEnvelope;
  } catch {
    throw new Error('云端文件不是有效的 BabyLink 加密备份。');
  }
  if (envelope?.app !== 'LINK'
    || envelope.encryptedBackupVersion !== 2
    || envelope.kdf?.name !== 'PBKDF2-SHA-256'
    || envelope.cipher?.name !== 'AES-256-GCM'
    || envelope.cipher.chunked !== true
    || !Array.isArray(envelope.chunks)
    || !envelope.chunks.length) {
    throw new Error('暂不支持该加密备份格式。');
  }
  if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100_000 || envelope.kdf.iterations > 2_000_000) {
    throw new Error('加密备份的密钥参数无效。');
  }

  try {
    const salt = base64ToBytes(envelope.kdf.salt);
    const key = await deriveEncryptionKey(recoveryKey.trim(), salt, envelope.kdf.iterations);
    const plaintextParts: ArrayBuffer[] = [];
    let offset = prefixLength + headerLength;
    let plaintextBytes = 0;

    for (let index = 0; index < envelope.chunks.length; index += 1) {
      const chunk = envelope.chunks[index];
      if (!Number.isInteger(chunk.encryptedBytes) || chunk.encryptedBytes < 17 || offset + chunk.encryptedBytes > blob.size) {
        throw new Error('云端备份分块损坏。');
      }
      const encrypted = await blob.slice(offset, offset + chunk.encryptedBytes).arrayBuffer();
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(chunk.iv)), tagLength: 128 },
        key,
        encrypted
      );
      if (decrypted.byteLength !== chunk.plaintextBytes) throw new Error('云端备份分块大小校验失败。');
      plaintextParts.push(decrypted);
      plaintextBytes += decrypted.byteLength;
      offset += chunk.encryptedBytes;
      await onProgress?.(Math.round(((index + 1) / envelope.chunks.length) * 100));
    }

    if (plaintextBytes !== envelope.plaintextBytes || offset !== blob.size) throw new Error('云端备份内容不完整。');
    return await new Blob(plaintextParts, { type: 'application/json;charset=utf-8' }).text();
  } catch {
    throw new Error('恢复密钥不正确，或云端备份已经损坏。');
  }
}