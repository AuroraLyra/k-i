import { clearStartupCache } from './startupCache';

export interface AccessSession {
  authenticated: true;
  qq: string;
  deviceId: string;
  deviceLabel: string;
  leaseUntil: number;
}

export interface AccessDevice {
  id: string;
  label: string;
  current: boolean;
  createdAt: number;
  lastSeenAt: number;
}

interface CachedAccessLease {
  qq: string;
  leaseUntil: number;
}

const accessLeaseStorageKey = 'link:auth-lease';

export function isAccessControlEnabled() {
  const configured = String(import.meta.env.VITE_ACCESS_CONTROL_ENABLED ?? '').trim().toLowerCase();
  if (configured) return !['0', 'false', 'off', 'no'].includes(configured);
  return import.meta.env.PROD;
}

function readCachedAccessLease(): CachedAccessLease | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(accessLeaseStorageKey) ?? 'null') as Partial<CachedAccessLease> | null;
    const qq = String(parsed?.qq ?? '').trim();
    const leaseUntil = Number(parsed?.leaseUntil ?? 0);
    if (!qq || !Number.isFinite(leaseUntil)) return null;
    return { qq, leaseUntil };
  } catch {
    return null;
  }
}

function saveAccessLease(session: Pick<AccessSession, 'qq' | 'leaseUntil'>) {
  localStorage.setItem(accessLeaseStorageKey, JSON.stringify({ qq: session.qq, leaseUntil: session.leaseUntil }));
}

function clearAccessLease() {
  localStorage.removeItem(accessLeaseStorageKey);
}

async function readResponseMessage(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
  return body?.message || body?.error || `访问验证失败 (${response.status})`;
}

export async function fetchAccessSession() {
  const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    const error = new Error(await readResponseMessage(response));
    error.name = response.status === 401 ? 'AccessRevokedError' : 'AccessRequestError';
    throw error;
  }
  const session = await response.json() as AccessSession;
  saveAccessLease(session);
  return session;
}

export async function ensureAccessOnStartup() {
  if (!isAccessControlEnabled()) return true;
  const cachedLease = readCachedAccessLease();
  if (cachedLease && cachedLease.leaseUntil > Date.now()) {
    void fetchAccessSession().catch((error) => {
      if (error instanceof Error && error.name === 'AccessRevokedError') {
        clearAccessLease();
        clearStartupCache();
        window.location.replace('/access');
      }
    });
    return true;
  }
  try {
    await fetchAccessSession();
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === 'AccessRevokedError') {
      clearAccessLease();
      clearStartupCache();
      window.location.replace('/access');
      return false;
    }
    window.location.replace('/access');
    return false;
  }
}

export function startAccessHeartbeat() {
  if (!isAccessControlEnabled()) return () => undefined;
  let timer: number | undefined;
  let running = false;

  const verify = async () => {
    if (running) return;
    running = true;
    try {
      await fetchAccessSession();
    } catch (error) {
      if (error instanceof Error && error.name === 'AccessRevokedError') {
        clearAccessLease();
        clearStartupCache();
        window.location.replace('/access');
      }
    } finally {
      running = false;
    }
  };
  const visibilityListener = () => {
    if (document.visibilityState === 'visible') void verify();
  };
  document.addEventListener('visibilitychange', visibilityListener);
  timer = window.setInterval(() => void verify(), 10 * 60 * 1000);
  return () => {
    document.removeEventListener('visibilitychange', visibilityListener);
    if (timer !== undefined) window.clearInterval(timer);
  };
}

export async function fetchAccessDevices() {
  const response = await fetch('/api/auth/devices', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await readResponseMessage(response));
  return await response.json() as AccessDevice[];
}

export async function revokeAccessDevice(deviceId: string) {
  const response = await fetch(`/api/auth/devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await readResponseMessage(response));
}

export async function logoutAccessSession() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
  clearAccessLease();
  clearStartupCache();
  window.location.replace('/access');
}