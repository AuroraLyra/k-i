import type { AppKeepAliveSettings } from '@/types/domain';
import { normalizeKeepAliveSettings } from '@/utils/settings';
import { dismissNativeCallNotification, getNativeKeepAliveStatus, isNativeKeepAliveAvailable, openNativeBatterySettings, requestNativeNotificationPermission, showNativeLinkNotification, startNativeKeepAlive, stopNativeKeepAlive, type NativeKeepAliveStatus } from '@/services/nativeKeepAlive';
import { dismissIosNativeCallNotification, getIosNativeNotificationPermission, isIosNativeNotificationAvailable, requestIosNativeNotificationPermission, showIosNativeNotification } from '@/services/nativeNotifications';
import { compressInlineImageDataUrl } from '@/utils/imageFile';

type NotificationPermissionState = NotificationPermission | 'unsupported';
export type KeepAlivePlatform = 'ios' | 'android' | 'desktop';

export type LinkNotificationKind = 'message' | 'voom' | 'call';
export type LinkNotificationAction = 'open' | 'accepted' | 'rejected';

export const LINK_NOTIFICATION_CLICK_EVENT = 'LINK_NOTIFICATION_CLICK';

export interface LinkNotificationPayload {
  kind: LinkNotificationKind;
  title: string;
  body: string;
  messages?: string[];
  tag: string;
  icon?: string;
  url?: string;
  conversationId?: string;
  callId?: string;
  callMode?: 'voice' | 'video';
  action?: LinkNotificationAction;
}

export interface LinkNotificationEventPayload extends LinkNotificationPayload {
  url: string;
  action: LinkNotificationAction;
}

function normalizeLinkNotificationEventPayload(value: unknown): LinkNotificationEventPayload | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<LinkNotificationEventPayload>;
  const url = String(data.url ?? '').trim();
  if (!url) return null;
  return {
    kind: data.kind === 'call' ? 'call' : data.kind === 'voom' ? 'voom' : 'message',
    title: String(data.title ?? '').trim(),
    body: String(data.body ?? '').trim(),
    messages: Array.isArray(data.messages) ? data.messages.map((message) => String(message).trim()).filter(Boolean) : undefined,
    tag: String(data.tag ?? '').trim(),
    icon: String(data.icon ?? '').trim() || undefined,
    url,
    conversationId: String(data.conversationId ?? '').trim() || undefined,
    callId: String(data.callId ?? '').trim() || undefined,
    callMode: data.callMode === 'video' ? 'video' : data.callMode === 'voice' ? 'voice' : undefined,
    action: data.action === 'accepted' ? 'accepted' : data.action === 'rejected' ? 'rejected' : 'open'
  };
}

function dispatchLinkNotificationEvent(type: string, payload: LinkNotificationPayload) {
  if (typeof window === 'undefined') return;
  const normalizedPayload = normalizeLinkNotificationEventPayload({ ...payload, url: getNotificationUrl(payload.url || '') });
  if (!normalizedPayload) return;
  window.dispatchEvent(new CustomEvent(type, { detail: normalizedPayload }));
}

export function dispatchLinkNotificationClick(payload: LinkNotificationPayload) {
  dispatchLinkNotificationEvent(LINK_NOTIFICATION_CLICK_EVENT, payload);
}

export function subscribeLinkNotificationClicks(listener: (payload: LinkNotificationEventPayload) => void) {
  if (typeof window === 'undefined') return () => undefined;
  const notificationWindow = window as typeof window & { __LINK_NOTIFICATION_BRIDGE_READY__?: boolean };
  notificationWindow.__LINK_NOTIFICATION_BRIDGE_READY__ = true;
  const handleWindowEvent = (event: Event) => {
    const payload = normalizeLinkNotificationEventPayload((event as CustomEvent).detail);
    if (payload) listener(payload);
  };
  const handleServiceWorkerMessage = (event: MessageEvent) => {
    if (event.data?.type !== LINK_NOTIFICATION_CLICK_EVENT) return;
    const payload = normalizeLinkNotificationEventPayload(event.data);
    if (payload) listener(payload);
  };
  window.addEventListener(LINK_NOTIFICATION_CLICK_EVENT, handleWindowEvent);
  navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);
  return () => {
    window.removeEventListener(LINK_NOTIFICATION_CLICK_EVENT, handleWindowEvent);
    navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    notificationWindow.__LINK_NOTIFICATION_BRIDGE_READY__ = false;
  };
}

export interface KeepAliveRuntimeStatus {
  enabled: boolean;
  supported: boolean;
  silentAudioActive: boolean;
  webAudioActive: boolean;
  wakeLockActive: boolean;
  heartbeatActive: boolean;
  notificationPermission: NotificationPermissionState;
  notificationSupported: boolean;
  wakeLockSupported: boolean;
  standalone: boolean;
  platform: KeepAlivePlatform;
  native: boolean;
  nativeServiceActive: boolean;
  nativeWakeLockActive: boolean;
  batteryOptimizationsIgnored: boolean;
  lastBeatAt: number;
  lastError: string;
}

interface WakeLockSentinel extends EventTarget {
  released: boolean;
  release(): Promise<void>;
}

interface WakeLockRequester {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>;
  };
}

const heartbeatMs = 60_000;

const status: KeepAliveRuntimeStatus = {
  enabled: false,
  supported: typeof window !== 'undefined',
  silentAudioActive: false,
  webAudioActive: false,
  wakeLockActive: false,
  heartbeatActive: false,
  notificationPermission: getNotificationPermission(),
  notificationSupported: isIosNativeNotificationAvailable() || typeof Notification !== 'undefined',
  wakeLockSupported: hasWakeLockSupport(),
  standalone: isStandaloneDisplayMode(),
  platform: detectPlatform(),
  native: isNativeKeepAliveAvailable(),
  nativeServiceActive: false,
  nativeWakeLockActive: false,
  batteryOptimizationsIgnored: false,
  lastBeatAt: 0,
  lastError: ''
};

let currentSettings = normalizeKeepAliveSettings(null);
let silentAudio: HTMLAudioElement | null = null;
let silentAudioObjectUrl = '';
let audioContext: AudioContext | null = null;
let audioSource: AudioBufferSourceNode | null = null;
let audioGain: GainNode | null = null;
let wakeLock: WakeLockSentinel | null = null;
let heartbeatTimer: number | undefined;
let silentAudioResumeTimer: number | undefined;
let listenersInstalled = false;
const statusListeners = new Set<(nextStatus: KeepAliveRuntimeStatus) => void>();

function emitStatus() {
  status.native = isNativeKeepAliveAvailable();
  if (!status.native && !isIosNativeNotificationAvailable()) status.notificationPermission = getNotificationPermission();
  status.notificationSupported = status.native || isIosNativeNotificationAvailable() || typeof Notification !== 'undefined';
  status.wakeLockSupported = status.native || hasWakeLockSupport();
  status.standalone = status.native || isStandaloneDisplayMode();
  status.platform = detectPlatform();
  const snapshot = getKeepAliveStatus();
  statusListeners.forEach((listener) => listener(snapshot));
}

function setLastError(error: unknown, fallback = '保活恢复被浏览器限制，请点一下页面后重试。') {
  const rawMessage = error instanceof Error ? error.message : String(error || '');
  const normalizedMessage = rawMessage.toLocaleLowerCase();
  if (normalizedMessage.includes('wake lock')) {
    status.lastError = '系统拒绝亮屏守护，静音音频与通知仍会继续运行。';
  } else if (normalizedMessage.includes('play') || normalizedMessage.includes('audio') || normalizedMessage.includes('gesture')) {
    status.lastError = '浏览器拦截了静音音频，请点一下页面恢复音频通道。';
  } else {
    status.lastError = fallback;
  }
  emitStatus();
}

function getNotificationPermission(): NotificationPermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

function detectPlatform(): KeepAlivePlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const userAgent = navigator.userAgent || '';
  const isTouchMac = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || isTouchMac) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'desktop';
}

function applyNativeStatus(nextStatus: NativeKeepAliveStatus | null) {
  if (!nextStatus) return;
  status.native = true;
  status.nativeServiceActive = nextStatus.serviceActive;
  status.nativeWakeLockActive = nextStatus.wakeLockActive;
  status.batteryOptimizationsIgnored = nextStatus.batteryOptimizationsIgnored;
  status.notificationPermission = nextStatus.notificationPermission === 'prompt' ? 'default' : nextStatus.notificationPermission;
}

async function refreshNativeStatus() {
  if (!isNativeKeepAliveAvailable()) return null;
  const nextStatus = await getNativeKeepAliveStatus();
  applyNativeStatus(nextStatus);
  emitStatus();
  return nextStatus;
}

function isStandaloneDisplayMode() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return Boolean(navigatorWithStandalone.standalone || window.matchMedia?.('(display-mode: standalone)').matches);
}

function hasWakeLockSupport() {
  if (typeof navigator === 'undefined') return false;
  const wakeNavigator = navigator as Navigator & WakeLockRequester;
  return Boolean(wakeNavigator.wakeLock);
}

function getSilentAudio() {
  if (silentAudio) return silentAudio;
  if (typeof Audio === 'undefined') return null;
  silentAudioObjectUrl = createSilentAudioObjectUrl();
  silentAudio = new Audio(silentAudioObjectUrl);
  silentAudio.loop = true;
  silentAudio.muted = false;
  silentAudio.volume = 0.001;
  silentAudio.preload = 'auto';
  silentAudio.autoplay = true;
  silentAudio.setAttribute('playsinline', 'true');
  silentAudio.setAttribute('aria-hidden', 'true');
  silentAudio.addEventListener('pause', () => {
    status.silentAudioActive = false;
    emitStatus();
    scheduleSilentAudioResume(180);
  });
  silentAudio.addEventListener('playing', () => {
    status.silentAudioActive = true;
    emitStatus();
  });
  return silentAudio;
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createSilentAudioObjectUrl() {
  const sampleRate = 8_000;
  const seconds = 2;
  const samples = sampleRate * seconds;
  const headerBytes = 44;
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(headerBytes + dataBytes);
  const view = new DataView(buffer);
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

function getAudioContextConstructor() {
  if (typeof window === 'undefined') return null;
  const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
  return window.AudioContext || audioWindow.webkitAudioContext || null;
}

async function startSilentAudio() {
  const audio = getSilentAudio();
  if (!audio) return;
  try {
    if (!audio.src) audio.src = silentAudioObjectUrl || createSilentAudioObjectUrl();
    await audio.play();
    status.silentAudioActive = !audio.paused;
    status.lastError = '';
  } catch (error) {
    status.silentAudioActive = false;
    setLastError(error, '浏览器拦截了静音音频，请点一下页面恢复音频通道。');
  }
}

async function startWebAudio() {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) return;
  try {
    if (!audioContext || audioContext.state === 'closed') audioContext = new AudioContextConstructor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    if (!audioSource) {
      const buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      audioGain = audioContext.createGain();
      audioGain.gain.value = 0;
      audioSource = audioContext.createBufferSource();
      audioSource.buffer = buffer;
      audioSource.loop = true;
      audioSource.connect(audioGain).connect(audioContext.destination);
      audioSource.start(0);
    }
    status.webAudioActive = audioContext.state === 'running';
    status.lastError = '';
  } catch (error) {
    status.webAudioActive = false;
    audioSource = null;
    audioGain = null;
    setLastError(error, 'Web Audio 保活被浏览器暂停，请点一下页面恢复。');
  }
}

function clearSilentAudioResumeTimer() {
  if (!silentAudioResumeTimer) return;
  window.clearTimeout(silentAudioResumeTimer);
  silentAudioResumeTimer = undefined;
}

function scheduleSilentAudioResume(delay = 0) {
  if (!status.enabled || !currentSettings.silentAudio || typeof window === 'undefined') return;
  if (silentAudioResumeTimer) return;
  silentAudioResumeTimer = window.setTimeout(() => {
    silentAudioResumeTimer = undefined;
    void resumeKeepAlive();
  }, delay);
}

async function requestWakeLock() {
  if (!currentSettings.wakeLock || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const wakeNavigator = navigator as Navigator & WakeLockRequester;
  if (!wakeNavigator.wakeLock || wakeLock && !wakeLock.released) return;
  try {
    wakeLock = await wakeNavigator.wakeLock.request('screen');
    status.wakeLockActive = true;
    status.lastError = '';
    wakeLock.addEventListener('release', () => {
      status.wakeLockActive = false;
      emitStatus();
    });
  } catch (error) {
    status.wakeLockActive = false;
    emitStatus();
  }
}

function releaseWakeLock() {
  const activeWakeLock = wakeLock;
  wakeLock = null;
  status.wakeLockActive = false;
  void activeWakeLock?.release().catch(() => undefined);
}

async function resumeKeepAlive() {
  if (!status.enabled) return;
  status.lastBeatAt = Date.now();
  if (currentSettings.silentAudio) {
    await startSilentAudio();
    await startWebAudio();
  }
  if (isNativeKeepAliveAvailable()) {
    try {
      const nativeStatus = await getNativeKeepAliveStatus();
      applyNativeStatus(nativeStatus?.serviceActive && nativeStatus.wakeLockActive === currentSettings.wakeLock
        ? nativeStatus
        : await startNativeKeepAlive(currentSettings.wakeLock));
      status.lastError = '';
    } catch (error) {
      setLastError(error, 'Android 原生保活启动失败，请重新打开应用后重试。');
    }
  }
  if (!isNativeKeepAliveAvailable()) await requestWakeLock();
  navigator.serviceWorker?.controller?.postMessage({ type: 'LINK_KEEP_ALIVE_PING', at: status.lastBeatAt });
  emitStatus();
}

function startHeartbeat() {
  if (heartbeatTimer || typeof window === 'undefined') return;
  heartbeatTimer = window.setInterval(() => {
    void resumeKeepAlive();
  }, heartbeatMs);
  status.heartbeatActive = true;
}

function stopHeartbeat() {
  if (heartbeatTimer) window.clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
  status.heartbeatActive = false;
}

export function requestSilentKeepAliveResume() {
  scheduleSilentAudioResume();
}

function installListeners() {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  const resume = () => void resumeKeepAlive();
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pageshow', resume);
  window.addEventListener('focus', resume);
  window.addEventListener('online', resume);
  window.addEventListener('pointerdown', resume, { passive: true, capture: true });
  window.addEventListener('touchstart', resume, { passive: true, capture: true });
  window.addEventListener('keydown', resume, { passive: true, capture: true });
}

function stopSilentAudio() {
  clearSilentAudioResumeTimer();
  if (silentAudio) {
    silentAudio.pause();
    silentAudio.currentTime = 0;
  }
  if (silentAudioObjectUrl) URL.revokeObjectURL(silentAudioObjectUrl);
  silentAudioObjectUrl = '';
  silentAudio = null;
  status.silentAudioActive = false;
}

function stopWebAudio() {
  try {
    audioSource?.stop();
  } catch {
    // Ignore already-stopped sources.
  }
  audioSource = null;
  audioGain = null;
  void audioContext?.close().catch(() => undefined);
  audioContext = null;
  status.webAudioActive = false;
}

export function getKeepAliveStatus(): KeepAliveRuntimeStatus {
  const iosNativeNotifications = isIosNativeNotificationAvailable();
  return {
    ...status,
    notificationPermission: status.native || iosNativeNotifications ? status.notificationPermission : getNotificationPermission(),
    notificationSupported: status.native || iosNativeNotifications || typeof Notification !== 'undefined',
    wakeLockSupported: status.native || hasWakeLockSupport(),
    standalone: status.native || isStandaloneDisplayMode(),
    platform: detectPlatform()
  };
}

export function subscribeKeepAliveStatus(listener: (nextStatus: KeepAliveRuntimeStatus) => void) {
  statusListeners.add(listener);
  listener(getKeepAliveStatus());
  return () => {
    statusListeners.delete(listener);
  };
}

export async function requestKeepAliveNotificationPermission() {
  if (isNativeKeepAliveAvailable()) {
    try {
      applyNativeStatus(await requestNativeNotificationPermission());
      if (status.notificationPermission === 'granted' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
        await Notification.requestPermission().catch(() => Notification.permission);
      }
      status.lastError = status.notificationPermission === 'granted' ? '' : '系统通知权限未允许，请在应用设置中重新开启。';
    } catch (error) {
      setLastError(error, 'Android 通知授权失败，请在系统应用设置中允许通知。');
    }
    emitStatus();
    return status.notificationPermission;
  }
  if (isIosNativeNotificationAvailable()) {
    status.notificationPermission = await requestIosNativeNotificationPermission() ?? 'unsupported';
    status.lastError = status.notificationPermission === 'granted' ? '' : '系统通知权限未允许，请在 iPhone 设置中重新开启。';
    emitStatus();
    return status.notificationPermission;
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    status.notificationPermission = getNotificationPermission();
    status.lastError = '通知授权需要 HTTPS 或 localhost 环境。';
    emitStatus();
    return status.notificationPermission;
  }
  if (typeof Notification === 'undefined') {
    status.notificationPermission = 'unsupported';
    status.lastError = '当前浏览器不支持网页通知。';
    emitStatus();
    return status.notificationPermission;
  }

  try {
    if (Notification.permission === 'default') {
      status.notificationPermission = await Notification.requestPermission();
    } else {
      status.notificationPermission = Notification.permission;
    }
  } catch {
    status.notificationPermission = Notification.permission;
  }

  if (status.notificationPermission === 'granted') status.lastError = '';
  else if (status.notificationPermission === 'denied') status.lastError = '系统通知权限已拒绝，请在浏览器或系统设置里重新允许。';
  else status.lastError = '浏览器没有弹出授权窗口，请检查地址栏权限、系统通知设置，或在手机上安装为 PWA 后再试。';

  emitStatus();
  return status.notificationPermission;
}

export async function startKeepAlive(settings: Partial<AppKeepAliveSettings> | null | undefined, options: { requestNotifications?: boolean } = {}) {
  currentSettings = normalizeKeepAliveSettings(settings);
  if (!currentSettings.enabled) {
    stopKeepAlive();
    return getKeepAliveStatus();
  }

  status.enabled = true;
  status.supported = typeof window !== 'undefined';
  installListeners();
  startHeartbeat();
  await resumeKeepAlive();
  if (options.requestNotifications && currentSettings.notifications) await requestKeepAliveNotificationPermission();
  if (isNativeKeepAliveAvailable()) await refreshNativeStatus().catch(() => undefined);
  return getKeepAliveStatus();
}

export function stopKeepAlive() {
  currentSettings = normalizeKeepAliveSettings({ ...currentSettings, enabled: false });
  status.enabled = false;
  clearSilentAudioResumeTimer();
  stopHeartbeat();
  stopSilentAudio();
  stopWebAudio();
  releaseWakeLock();
  if (isNativeKeepAliveAvailable()) {
    void stopNativeKeepAlive()
      .then((nextStatus) => {
        applyNativeStatus(nextStatus);
        emitStatus();
      })
      .catch((error) => setLastError(error, 'Android 原生保活停止失败，请重启应用。'));
  }
  emitStatus();
}

export async function requestNativeKeepAliveBatteryAccess() {
  if (!isNativeKeepAliveAvailable()) return false;
  const opened = await openNativeBatterySettings();
  window.setTimeout(() => void refreshNativeStatus().catch(() => undefined), 1_000);
  return opened;
}

export function syncKeepAlive(settings: Partial<AppKeepAliveSettings> | null | undefined) {
  const nextSettings = normalizeKeepAliveSettings(settings);
  if (nextSettings.enabled) void startKeepAlive(nextSettings);
  else stopKeepAlive();
}

function getNotificationUrl(url = '') {
  if (typeof window === 'undefined') return url;
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = import.meta.env.BASE_URL || '/';
  const appBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const routePath = url.replace(/^\/+/, '');
  return `${window.location.origin}${appBase}${routePath}`;
}

async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  return await navigator.serviceWorker.getRegistration().catch(() => undefined) ?? null;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')));
    reader.addEventListener('error', () => reject(reader.error ?? new Error('角色头像读取失败。')));
    reader.readAsDataURL(blob);
  });
}

async function getNativeNotificationIcon(source = '') {
  const imageUrl = source.trim();
  if (!imageUrl) return '';
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return '';
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) return '';
    const dataUrl = await blobToDataUrl(blob);
    return await compressInlineImageDataUrl(dataUrl, {
      maxDimension: 192,
      quality: 0.82,
      mimeType: 'image/jpeg',
      minBytes: 0,
      force: true
    });
  } catch {
    return /^data:image\/(?:png|jpe?g|webp)/i.test(imageUrl) ? imageUrl : '';
  }
}

async function showWebLinkNotification(payload: LinkNotificationPayload) {
  if (getNotificationPermission() !== 'granted') return false;
  const notificationUrl = getNotificationUrl(payload.url || '');
  const notificationBody = payload.messages?.map((message) => message.trim()).filter(Boolean).join('\n') || payload.body;
  const isIncomingCall = payload.kind === 'call';
  const options: NotificationOptions & { renotify: boolean; actions?: Array<{ action: string; title: string }>; requireInteraction?: boolean; vibrate?: number[] } = {
    body: notificationBody,
    tag: payload.tag,
    icon: payload.icon || getNotificationUrl('link-icon.png'),
    badge: getNotificationUrl('link-icon.png'),
    silent: false,
    renotify: true,
    requireInteraction: isIncomingCall,
    vibrate: isIncomingCall ? [0, 360, 180, 360, 180, 620] : [0, 220, 120, 220],
    actions: isIncomingCall ? [
      { action: 'rejected', title: '拒绝' },
      { action: 'accepted', title: '接听' }
    ] : undefined,
    data: {
      type: LINK_NOTIFICATION_CLICK_EVENT,
      url: notificationUrl,
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      messages: payload.messages,
      tag: payload.tag,
      icon: payload.icon,
      conversationId: payload.conversationId,
      callId: payload.callId,
      callMode: payload.callMode
    }
  };

  const registration = await getServiceWorkerRegistration();
  if (registration?.showNotification) {
    try {
      await registration.showNotification(payload.title, options);
      return true;
    } catch (error) {
      setLastError(error, '系统通知发送失败，请检查浏览器通知权限。');
    }
  }

  if (typeof Notification === 'undefined') return false;
  try {
    const notification = new Notification(payload.title, options);
    notification.onclick = () => {
      window.focus();
      dispatchLinkNotificationClick({ ...payload, url: notificationUrl });
      notification.close();
    };
    return true;
  } catch (error) {
    setLastError(error, '系统通知发送失败，请检查浏览器通知权限。');
    return false;
  }
}

export async function showLinkNotification(settings: Partial<AppKeepAliveSettings> | null | undefined, payload: LinkNotificationPayload) {
  const keepAliveSettings = normalizeKeepAliveSettings(settings);
  if (!keepAliveSettings.enabled || !keepAliveSettings.notifications) return false;
  if (isIosNativeNotificationAvailable()) {
    status.notificationPermission = await getIosNativeNotificationPermission() ?? 'unsupported';
    if (status.notificationPermission !== 'granted') return false;
    return await showIosNativeNotification({
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      tag: payload.tag,
      icon: await getNativeNotificationIcon(payload.icon),
      url: getNotificationUrl(payload.url || ''),
      conversationId: payload.conversationId,
      callId: payload.callId,
      callMode: payload.callMode
    });
  }
  if (isNativeKeepAliveAvailable()) {
    if (status.notificationPermission !== 'granted') await refreshNativeStatus().catch(() => undefined);
    if (status.notificationPermission !== 'granted') return false;
    return await showNativeLinkNotification({
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      messages: payload.messages,
      tag: payload.tag,
      icon: await getNativeNotificationIcon(payload.icon),
      url: getNotificationUrl(payload.url || ''),
      conversationId: payload.conversationId,
      callId: payload.callId,
      callMode: payload.callMode
    });
  }
  return await showWebLinkNotification(payload);
}

export async function dismissLinkCallNotification(callId: string) {
  const normalizedCallId = callId.trim();
  if (!normalizedCallId) return;
  if (isIosNativeNotificationAvailable()) {
    await dismissIosNativeCallNotification(normalizedCallId);
    return;
  }
  if (isNativeKeepAliveAvailable()) {
    await dismissNativeCallNotification(normalizedCallId);
    return;
  }
  const registration = await getServiceWorkerRegistration();
  const notifications = await registration?.getNotifications?.({ tag: `link-call-${normalizedCallId}` }).catch(() => []);
  notifications?.forEach((notification) => notification.close());
}