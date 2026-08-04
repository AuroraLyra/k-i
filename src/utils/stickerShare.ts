import { unzipSync, zipSync } from 'fflate';
import type { Sticker, StickerGroup } from '@/types/domain';
import { compressInlineImageDataUrl } from '@/utils/imageFile';
import { getStickerDisplayImageUrl, localizeStickerImageUrl } from '@/utils/stickers';

const stickerSharePngMagic = 'LINK_STICKER_SHARE_PNG_V1';
const stickerSharePngVersion = 1;
const pngChannelCount = 3;
const exportPosterWidth = 2048;
const exportPosterMinimumHeight = 1800;
const maxSharePayloadBytes = 6 * 1024 * 1024;
const maxImportImagePixels = 32 * 1024 * 1024;
const maxImportedArchiveBytes = 12 * 1024 * 1024;
const maxImportedImageCount = 500;
const maxStickerPreviewCount = 50;
const stickerPreviewColumns = 10;
const stickerPreviewRows = 5;
const shareImageCompressionOptions = { maxDimension: 360, quality: 0.72, mimeType: 'image/webp' as const, minBytes: 0, force: true };

interface StickerSharePngGroup {
  sourceId: string;
  name: string;
  sortOrder?: number;
}

interface StickerSharePngSticker {
  description: string;
  groupSourceIds: string[];
  imageFile: string;
  imageMimeType: string;
}

interface StickerSharePngPayload {
  magic: typeof stickerSharePngMagic;
  version: typeof stickerSharePngVersion;
  exportedAt: number;
  groups: StickerSharePngGroup[];
  stickers: StickerSharePngSticker[];
  archive: string;
}

export interface StickerSharePackage {
  exportedAt: number;
  groups: StickerSharePngGroup[];
  stickers: Array<{
    description: string;
    groupSourceIds: string[];
    imageUrl: string;
  }>;
}

export interface StickerShareExportResult {
  blob: Blob;
  fileName: string;
  groupCount: number;
  stickerCount: number;
}

function isDataImageUrl(value: string) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim());
}

function readDataUrl(value: string) {
  const match = value.trim().match(/^data:([^;,]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) throw new Error('贴纸图片数据格式无效。');
  const binary = window.atob(match[2].replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return { mimeType: match[1].toLocaleLowerCase(), bytes };
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + chunkSize))));
  }
  return window.btoa(chunks.join(''));
}

function base64ToBytes(value: string) {
  const binary = window.atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function readZipUint16(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 2 > bytes.length) return -1;
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readZipUint32(bytes: Uint8Array, offset: number) {
  if (offset < 0 || offset + 4 > bytes.length) return -1;
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function isZipSignature(bytes: Uint8Array, offset: number, signature: number) {
  return readZipUint32(bytes, offset) === signature;
}

function validateShareArchive(bytes: Uint8Array) {
  const endRecordSignature = 0x06054b50;
  const directorySignature = 0x02014b50;
  const endSearchStart = Math.max(0, bytes.length - 0x10016);
  let endRecordOffset = -1;
  for (let offset = bytes.length - 22; offset >= endSearchStart; offset -= 1) {
    if (isZipSignature(bytes, offset, endRecordSignature)) {
      endRecordOffset = offset;
      break;
    }
  }
  if (endRecordOffset < 0) throw new Error('这张 PNG 的贴纸压缩包格式无效。');
  const commentLength = readZipUint16(bytes, endRecordOffset + 20);
  const entryCount = readZipUint16(bytes, endRecordOffset + 10);
  const directorySize = readZipUint32(bytes, endRecordOffset + 12);
  const directoryOffset = readZipUint32(bytes, endRecordOffset + 16);
  if (commentLength < 0 || endRecordOffset + 22 + commentLength > bytes.length || entryCount < 0 || entryCount > maxImportedImageCount || directorySize < 0 || directoryOffset < 0 || directoryOffset + directorySize > bytes.length) {
    throw new Error('这张 PNG 的贴纸压缩包目录异常。');
  }

  let totalUncompressedBytes = 0;
  let offset = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (!isZipSignature(bytes, offset, directorySignature)) throw new Error('这张 PNG 的贴纸压缩包条目异常。');
    const compressedSize = readZipUint32(bytes, offset + 20);
    const uncompressedSize = readZipUint32(bytes, offset + 24);
    const nameLength = readZipUint16(bytes, offset + 28);
    const extraLength = readZipUint16(bytes, offset + 30);
    const entryCommentLength = readZipUint16(bytes, offset + 32);
    if (compressedSize < 0 || uncompressedSize < 0 || nameLength < 0 || extraLength < 0 || entryCommentLength < 0 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('这张 PNG 的贴纸压缩包不支持该文件格式。');
    }
    totalUncompressedBytes += uncompressedSize;
    if (totalUncompressedBytes > maxImportedArchiveBytes) throw new Error('这张 PNG 的贴纸图片总大小超过限制。');
    offset += 46 + nameLength + extraLength + entryCommentLength;
    if (offset > directoryOffset + directorySize) throw new Error('这张 PNG 的贴纸压缩包目录不完整。');
  }
}

function bytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

function imageExtension(mimeType: string) {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/svg+xml') return 'svg';
  if (mimeType === 'image/x-icon') return 'ico';
  const subtype = mimeType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'png';
  return subtype || 'png';
}

function createPayloadBytes(payload: StickerSharePngPayload) {
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const bytes = new Uint8Array(4 + encoded.length);
  new DataView(bytes.buffer).setUint32(0, encoded.length, false);
  bytes.set(encoded, 4);
  return bytes;
}

function getCanvasContext(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('当前浏览器无法创建 PNG 画布。');
  return { canvas, context };
}

function createRoundedRectPath(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const resolvedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.arcTo(x + width, y, x + width, y + height, resolvedRadius);
  context.arcTo(x + width, y + height, x, y + height, resolvedRadius);
  context.arcTo(x, y + height, x, y, resolvedRadius);
  context.arcTo(x, y, x + width, y, resolvedRadius);
  context.closePath();
}

function drawStickerPreview(context: CanvasRenderingContext2D, image: HTMLImageElement | null, x: number, y: number, size: number) {
  createRoundedRectPath(context, x, y, size, size, 16);
  context.fillStyle = 'rgba(248, 242, 246, 0.94)';
  context.fill();
  if (image) {
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;
    const thumbnailSize = 36;
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = thumbnailSize;
    thumbnailCanvas.height = thumbnailSize;
    const thumbnailContext = thumbnailCanvas.getContext('2d');
    if (thumbnailContext) {
      const scale = Math.min(thumbnailSize / sourceWidth, thumbnailSize / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      thumbnailContext.drawImage(image, (thumbnailSize - drawWidth) / 2, (thumbnailSize - drawHeight) / 2, drawWidth, drawHeight);
    }
    context.save();
    createRoundedRectPath(context, x, y, size, size, 16);
    context.clip();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'low';
    context.drawImage(thumbnailCanvas, x, y, size, size);
    context.restore();
  }
  createRoundedRectPath(context, x, y, size, size, 16);
  context.strokeStyle = 'rgba(74, 45, 62, 0.12)';
  context.lineWidth = 2;
  context.stroke();
}

async function drawPoster(context: CanvasRenderingContext2D, width: number, height: number, groups: StickerSharePngGroup[], stickerCount: number, previewDataUrls: string[]) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#fff7fb');
  background.addColorStop(0.5, '#faf8ff');
  background.addColorStop(1, '#edf8f3');
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const scale = width / exportPosterWidth;
  context.save();
  context.scale(scale, scale);
  const posterHeight = height / scale;
  context.fillStyle = 'rgba(255, 176, 202, 0.28)';
  context.beginPath();
  context.arc(1770, 140, 390, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = 'rgba(79, 194, 142, 0.16)';
  context.beginPath();
  context.arc(220, posterHeight - 180, 420, 0, Math.PI * 2);
  context.fill();

  const cardX = 124;
  const cardY = 128;
  const cardWidth = exportPosterWidth - cardX * 2;
  const cardHeight = 1450;
  createRoundedRectPath(context, cardX, cardY, cardWidth, cardHeight, 56);
  context.fillStyle = 'rgba(255, 255, 255, 0.84)';
  context.fill();
  context.strokeStyle = 'rgba(255, 255, 255, 0.98)';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = '#b95d7c';
  context.font = '800 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('LINK STICKER SHARE', cardX + 70, cardY + 98);
  context.fillStyle = '#25202a';
  context.font = '900 94px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('贴纸分享包', cardX + 70, cardY + 222);
  context.fillStyle = '#6f6573';
  context.font = '600 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(`${groups.length} 个分组 · ${stickerCount} 张贴纸`, cardX + 70, cardY + 292);
  context.font = '500 31px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('导入方式：在 LINK 的 Stickers 页面点击 + 并选择此 PNG。', cardX + 70, cardY + 362, cardWidth - 140);

  context.fillStyle = '#8d6677';
  context.font = '800 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText('包含分组', cardX + 70, cardY + 438);
  groups.slice(0, 2).forEach((group, index) => {
    const itemY = cardY + 466 + index * 84;
    createRoundedRectPath(context, cardX + 58, itemY, cardWidth - 116, 62, 22);
    context.fillStyle = 'rgba(250, 240, 246, 0.9)';
    context.fill();
    context.fillStyle = '#382d37';
    context.font = '800 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(group.name || '未命名分组', cardX + 88, itemY + 41, cardWidth - 170);
  });

  if (groups.length > 2) {
    context.fillStyle = '#7a6e7c';
    context.font = '700 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    context.fillText(`另含 ${groups.length - 2} 个分组`, cardX + 72, cardY + 626);
  }

  const previews = await Promise.all(previewDataUrls.slice(0, maxStickerPreviewCount).map(async (dataUrl) => await loadImageFromDataUrl(dataUrl).catch(() => null)));
  const previewGap = 14;
  const previewSize = (cardWidth - 116 - previewGap * (stickerPreviewColumns - 1)) / stickerPreviewColumns;
  const previewY = cardY + 676;
  context.fillStyle = '#8d6677';
  context.font = '800 25px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  context.fillText(`低清预览 · 前 ${previews.length} / ${Math.min(stickerCount, maxStickerPreviewCount)} 张`, cardX + 70, previewY - 28);
  previews.forEach((image, index) => {
    const column = index % stickerPreviewColumns;
    const row = Math.floor(index / stickerPreviewColumns);
    if (row >= stickerPreviewRows) return;
    drawStickerPreview(context, image, cardX + 58 + column * (previewSize + previewGap), previewY + row * (previewSize + previewGap), previewSize);
  });
  context.restore();
}

function embedPayloadIntoImageData(data: Uint8ClampedArray, payload: Uint8Array) {
  const capacityBits = (data.length / 4) * pngChannelCount;
  const requiredBits = payload.length * 8;
  if (requiredBits > capacityBits) throw new Error('选择的贴纸内容太大，无法写入单个 PNG。');

  let bitIndex = 0;
  for (let index = 0; index < data.length && bitIndex < requiredBits; index += 4) {
    for (let channel = 0; channel < pngChannelCount && bitIndex < requiredBits; channel += 1) {
      const byte = payload[bitIndex >> 3] ?? 0;
      const bit = (byte >> (7 - bitIndex % 8)) & 1;
      data[index + channel] = (data[index + channel] & 0xfe) | bit;
      bitIndex += 1;
    }
  }
}

function decodePayloadBytesFromLsb(data: Uint8ClampedArray) {
  const totalBytes = Math.floor(((data.length / 4) * pngChannelCount) / 8);
  if (totalBytes < 4) return null;
  const lengthBytes = new Uint8Array(4);
  let bitIndex = 0;
  for (let index = 0; index < data.length && bitIndex < 32; index += 4) {
    for (let channel = 0; channel < pngChannelCount && bitIndex < 32; channel += 1) {
      lengthBytes[bitIndex >> 3] = (lengthBytes[bitIndex >> 3] << 1) | (data[index + channel] & 1);
      bitIndex += 1;
    }
  }

  const length = new DataView(lengthBytes.buffer).getUint32(0, false);
  if (!length || length > maxSharePayloadBytes || length > totalBytes - 4) return null;
  const bytes = new Uint8Array(length);
  let byteIndex = 0;
  let byteBitOffset = 0;
  let currentByte = 0;
  let payloadBitIndex = 0;
  for (let index = 0; index < data.length && byteIndex < length; index += 4) {
    for (let channel = 0; channel < pngChannelCount && byteIndex < length; channel += 1) {
      if (payloadBitIndex < 32) {
        payloadBitIndex += 1;
        continue;
      }
      currentByte = (currentByte << 1) | (data[index + channel] & 1);
      byteBitOffset += 1;
      if (byteBitOffset === 8) {
        bytes[byteIndex] = currentByte;
        byteIndex += 1;
        byteBitOffset = 0;
        currentByte = 0;
      }
      payloadBitIndex += 1;
    }
  }
  return bytes;
}

function canvasToPngBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('贴纸分享 PNG 生成失败。'));
    }, 'image/png');
  });
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error('贴纸分享 PNG 图片读取失败。')), { once: true });
    image.src = dataUrl;
  });
}

function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('贴纸分享 PNG 读取失败。')));
    reader.readAsDataURL(blob);
  });
}

async function resolveShareImageDataUrl(sticker: Sticker) {
  const displayImageUrl = getStickerDisplayImageUrl(sticker);
  const localizedImageUrl = isDataImageUrl(displayImageUrl)
    ? displayImageUrl
    : await localizeStickerImageUrl(displayImageUrl);
  if (!isDataImageUrl(localizedImageUrl)) throw new Error(`“${sticker.description || '未命名 Sticker'}”没有可分享的本地图片数据。`);
  return await compressInlineImageDataUrl(localizedImageUrl, shareImageCompressionOptions);
}

function normalizePngPayload(value: unknown): StickerSharePngPayload | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Partial<StickerSharePngPayload>;
  if (source.magic !== stickerSharePngMagic || source.version !== stickerSharePngVersion || !Array.isArray(source.groups) || !Array.isArray(source.stickers) || typeof source.archive !== 'string') return null;
  const groups: StickerSharePngGroup[] = [];
  const groupIds = new Set<string>();
  for (const entry of source.groups) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<StickerSharePngGroup>;
    const sourceId = String(item.sourceId ?? '').trim();
    const name = String(item.name ?? '').trim().slice(0, 80);
    if (!sourceId || !name || groupIds.has(sourceId)) continue;
    groupIds.add(sourceId);
    groups.push({ sourceId, name, ...(Number(item.sortOrder) > 0 ? { sortOrder: Number(item.sortOrder) } : {}) });
  }
  if (!groups.length) throw new Error('这张 PNG 没有可导入的贴纸分组。');

  const stickers: StickerSharePngSticker[] = [];
  const imageFiles = new Set<string>();
  for (const entry of source.stickers) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<StickerSharePngSticker>;
    const description = String(item.description ?? '').trim().slice(0, 180);
    const imageFile = String(item.imageFile ?? '').trim();
    const imageMimeType = String(item.imageMimeType ?? '').trim().toLocaleLowerCase();
    const groupSourceIds = Array.isArray(item.groupSourceIds)
      ? [...new Set(item.groupSourceIds.map((id) => String(id).trim()).filter((id) => groupIds.has(id)))]
      : [];
    if (!description || !imageFile.startsWith('images/') || imageFile.includes('..') || !imageMimeType.startsWith('image/') || imageFiles.has(imageFile)) continue;
    imageFiles.add(imageFile);
    stickers.push({ description, groupSourceIds, imageFile, imageMimeType });
  }
  if (!stickers.length || stickers.length > maxImportedImageCount) throw new Error('这张 PNG 没有可导入的贴纸，或贴纸数量超过限制。');
  return {
    magic: stickerSharePngMagic,
    version: stickerSharePngVersion,
    exportedAt: Number(source.exportedAt) || Date.now(),
    groups,
    stickers,
    archive: source.archive
  };
}

function createImportPackage(payload: StickerSharePngPayload): StickerSharePackage {
  let archiveBytes: Uint8Array;
  try {
    archiveBytes = base64ToBytes(payload.archive);
  } catch {
    throw new Error('这张 PNG 的贴纸压缩包无法读取。');
  }
  if (!archiveBytes.length || archiveBytes.length > maxImportedArchiveBytes) throw new Error('这张 PNG 的贴纸压缩包大小异常。');
  validateShareArchive(archiveBytes);

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(archiveBytes);
  } catch {
    throw new Error('这张 PNG 的贴纸压缩包已损坏。');
  }

  let totalImageBytes = 0;
  const stickers = payload.stickers.map((sticker) => {
    const imageBytes = files[sticker.imageFile];
    if (!imageBytes?.length) throw new Error(`贴纸“${sticker.description}”的图片数据缺失。`);
    totalImageBytes += imageBytes.length;
    if (totalImageBytes > maxImportedArchiveBytes) throw new Error('这张 PNG 的贴纸图片总大小超过限制。');
    return {
      description: sticker.description,
      groupSourceIds: sticker.groupSourceIds,
      imageUrl: bytesToDataUrl(imageBytes, sticker.imageMimeType)
    };
  });
  return { exportedAt: payload.exportedAt, groups: payload.groups, stickers };
}

export function isLikelyStickerSharePngFile(file: File) {
  return /(?:^|[-_])stickers?(?:[-_]|$)/i.test(file.name) && /\.png$/i.test(file.name);
}

export async function decodeStickerSharePng(file: Blob): Promise<StickerSharePackage | null> {
  if (file.type && file.type !== 'image/png' && !(file instanceof File && /\.png$/i.test(file.name))) return null;
  const dataUrl = await readBlobAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height || width * height > maxImportImagePixels) throw new Error('贴纸分享 PNG 的图片尺寸异常。');
  const { context } = getCanvasContext(width, height);
  context.drawImage(image, 0, 0, width, height);
  const payloadBytes = decodePayloadBytesFromLsb(context.getImageData(0, 0, width, height).data);
  if (!payloadBytes) return null;

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  const payload = normalizePngPayload(rawPayload);
  if (!payload) return null;
  return createImportPackage(payload);
}

export async function createStickerSharePng(groups: StickerGroup[], stickers: Sticker[]): Promise<StickerShareExportResult> {
  const selectedGroups = groups
    .map((group) => ({
      sourceId: group.id.trim(),
      name: group.name.trim(),
      ...(Number(group.sortOrder) > 0 ? { sortOrder: Number(group.sortOrder) } : {})
    }))
    .filter((group) => Boolean(group.sourceId && group.name));
  if (!selectedGroups.length) throw new Error('请至少选择一个贴纸分组。');
  const selectedGroupIds = new Set(selectedGroups.map((group) => group.sourceId));
  const selectedStickers = stickers.filter((sticker) => sticker.groupIds.some((groupId) => selectedGroupIds.has(groupId)));
  if (!selectedStickers.length) throw new Error('所选分组中没有可分享的贴纸。');

  const archiveFiles: Record<string, Uint8Array> = {};
  const payloadStickers: StickerSharePngSticker[] = [];
  const previewDataUrls: string[] = [];
  for (const [index, sticker] of selectedStickers.entries()) {
    const dataUrl = await resolveShareImageDataUrl(sticker);
    const { mimeType, bytes } = readDataUrl(dataUrl);
    const imageFile = `images/${String(index + 1).padStart(4, '0')}.${imageExtension(mimeType)}`;
    archiveFiles[imageFile] = bytes;
    if (previewDataUrls.length < maxStickerPreviewCount) previewDataUrls.push(dataUrl);
    payloadStickers.push({
      description: sticker.description.trim() || `Sticker ${index + 1}`,
      groupSourceIds: sticker.groupIds.filter((groupId) => selectedGroupIds.has(groupId)),
      imageFile,
      imageMimeType: mimeType
    });
  }

  const archive = zipSync(archiveFiles, { level: 6 });
  const payload = createPayloadBytes({
    magic: stickerSharePngMagic,
    version: stickerSharePngVersion,
    exportedAt: Date.now(),
    groups: selectedGroups,
    stickers: payloadStickers,
    archive: bytesToBase64(archive)
  });
  if (payload.length > maxSharePayloadBytes) throw new Error('所选贴纸内容过大，请减少分组后再分享。');

  const requiredPixels = Math.ceil(payload.length * 8 / pngChannelCount);
  const height = Math.max(exportPosterMinimumHeight, Math.ceil(requiredPixels / exportPosterWidth));
  const { canvas, context } = getCanvasContext(exportPosterWidth, height);
  await drawPoster(context, canvas.width, canvas.height, selectedGroups, payloadStickers.length, previewDataUrls);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  embedPayloadIntoImageData(imageData.data, payload);
  context.putImageData(imageData, 0, 0);
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  return {
    blob: await canvasToPngBlob(canvas),
    fileName: `link-stickers-${suffix}.png`,
    groupCount: selectedGroups.length,
    stickerCount: payloadStickers.length
  };
}