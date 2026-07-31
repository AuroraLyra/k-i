import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { config } from './config.js';

export function createOpaqueToken(byteLength = 32) {
  return randomBytes(byteLength).toString('base64url');
}

export function hashSecret(value: string) {
  return createHash('sha256').update(`${config.challengeSecret}:${value}`).digest('hex');
}

export function hashForAudit(value: string) {
  if (!value) return '';
  return createHash('sha256').update(`${config.challengeSecret}:audit:${value}`).digest('hex').slice(0, 24);
}

export function createSignedTicket(payload: Record<string, unknown>) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', config.challengeSecret).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySignedTicket<T extends Record<string, unknown>>(ticket: string): T | null {
  const [encodedPayload, providedSignature] = ticket.split('.');
  if (!encodedPayload || !providedSignature) return null;
  const expectedSignature = createHmac('sha256', config.challengeSecret).update(encodedPayload).digest();
  let providedBytes: Buffer;
  try {
    providedBytes = Buffer.from(providedSignature, 'base64url');
  } catch {
    return null;
  }
  if (providedBytes.length !== expectedSignature.length || !timingSafeEqual(providedBytes, expectedSignature)) return null;
  try {
    return JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function isPrivateIpv4(address: string) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first = 0, second = 0] = parts;
  return first === 0
    || first === 10
    || first === 127
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split('%')[0] ?? '';
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:192.168.');
}

export function isPrivateAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

export async function validatePublicUrl(
  rawUrl: string,
  protocols: Array<'http:' | 'https:'> = ['https:'],
  allowInsecureHttp = config.allowInsecureUpstreams
) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error('目标地址无效。');
  }

  if (!protocols.includes(target.protocol as 'http:' | 'https:')) throw new Error('目标地址协议不受支持。');
  if (target.username || target.password) throw new Error('目标地址不能直接包含账号或密码。');
  if (target.hostname === 'localhost' || target.hostname.endsWith('.localhost')) throw new Error('不允许访问本机地址。');
  if (target.protocol === 'http:' && !allowInsecureHttp) throw new Error('生产环境仅允许 HTTPS 上游。');

  const addresses = await lookup(target.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('不允许访问内网、回环或保留地址。');
  }

  return target;
}

export function createTimeoutSignal(timeoutMs = config.upstreamTimeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}

export function safeFileName(value: string) {
  const normalized = value.trim();
  if (!normalized || normalized !== normalized.split(/[\\/]/).pop() || !/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error('文件名无效。');
  }
  return normalized;
}