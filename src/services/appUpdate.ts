import { checkReleaseCompatibility } from '@/services/releaseManifest';

export type AppUpdatePhase = 'idle' | 'checking' | 'latest' | 'downloaded' | 'updated' | 'unsupported' | 'error';

export interface AppUpdateStatus {
  supported: boolean;
  controlled: boolean;
  registrationReady: boolean;
  hasWaitingWorker: boolean;
  hasInstallingWorker: boolean;
  phase: AppUpdatePhase;
  message: string;
  detail: string;
  lastCheckedAt: number;
}

const isServiceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
const appUpdateListeners = new Set<(status: AppUpdateStatus) => void>();

let appUpdateStatus: AppUpdateStatus = createInitialStatus();
let trackedRegistration: ServiceWorkerRegistration | null = null;

function createInitialStatus(): AppUpdateStatus {
  if (!import.meta.env.PROD) {
    return {
      supported: false,
      controlled: false,
      registrationReady: false,
      hasWaitingWorker: false,
      hasInstallingWorker: false,
      phase: 'unsupported',
      message: '开发模式不会启用网站更新',
      detail: '打包后的 PWA 版本会在这里检查、下载并安装最新资源。',
      lastCheckedAt: 0
    };
  }

  if (!isServiceWorkerSupported) {
    return {
      supported: false,
      controlled: false,
      registrationReady: false,
      hasWaitingWorker: false,
      hasInstallingWorker: false,
      phase: 'unsupported',
      message: '当前浏览器不支持网站更新',
      detail: '请使用支持 Service Worker 的浏览器或安装为 PWA 后重试。',
      lastCheckedAt: 0
    };
  }

  return {
    supported: true,
    controlled: Boolean(navigator.serviceWorker.controller),
    registrationReady: false,
    hasWaitingWorker: false,
    hasInstallingWorker: false,
    phase: 'idle',
    message: '准备检查最新版本',
    detail: '会从站点服务器拉取最新 PWA 资源并等待安装。',
    lastCheckedAt: 0
  };
}

function emitAppUpdateStatus(nextStatus: AppUpdateStatus) {
  appUpdateStatus = nextStatus;
  appUpdateListeners.forEach((listener) => listener(appUpdateStatus));
}

function patchAppUpdateStatus(patch: Partial<AppUpdateStatus>) {
  emitAppUpdateStatus({ ...appUpdateStatus, ...patch });
}

function createRegistrationStatus(registration: ServiceWorkerRegistration | null, patch: Partial<AppUpdateStatus> = {}) {
  return {
    supported: import.meta.env.PROD && isServiceWorkerSupported,
    controlled: isServiceWorkerSupported ? Boolean(navigator.serviceWorker.controller) : false,
    registrationReady: Boolean(registration),
    hasWaitingWorker: Boolean(registration?.waiting),
    hasInstallingWorker: Boolean(registration?.installing),
    ...patch
  } satisfies Partial<AppUpdateStatus>;
}

function wait<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('timeout')), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timer));
  });
}

async function resolveRegistration() {
  if (!import.meta.env.PROD || !isServiceWorkerSupported) return null;
  const existingRegistration = await navigator.serviceWorker.getRegistration();
  if (existingRegistration) return existingRegistration;
  try {
    return await wait(navigator.serviceWorker.ready, 2500);
  } catch {
    return null;
  }
}

function watchRegistration(registration: ServiceWorkerRegistration | null) {
  if (!registration || trackedRegistration === registration) return;
  trackedRegistration = registration;
  registration.addEventListener('updatefound', () => {
    const installingWorker = registration.installing;
    patchAppUpdateStatus(createRegistrationStatus(registration, {
      phase: 'checking',
      message: '正在下载最新版本',
      detail: '新的资源包已发现，正在交给浏览器缓存。'
    }));
    watchInstallingWorker(registration, installingWorker);
  });
}

function watchInstallingWorker(registration: ServiceWorkerRegistration, worker: ServiceWorker | null) {
  if (!worker) return;
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') {
      patchAppUpdateStatus(createRegistrationStatus(registration, navigator.serviceWorker.controller
        ? {
            phase: 'downloaded',
            message: '新版本已下载',
            detail: '请在完成输入、上传、备份或通话后手动安装最新资源。'
          }
        : {
            phase: 'latest',
            message: '网站资源已准备好',
            detail: '首次缓存已完成，后续版本可在这里手动更新。'
          }));
      return;
    }

    if (worker.state === 'activated') {
      patchAppUpdateStatus(createRegistrationStatus(registration, navigator.serviceWorker.controller
        ? {
            phase: 'updated',
            message: '新版本已安装',
            detail: '重新载入后会使用刚刚安装的资源。'
          }
        : {
            phase: 'latest',
            message: '网站资源已缓存',
            detail: '刷新或重新打开后，页面会由 PWA 缓存接管。'
          }));
    }
  });
}

export function getAppUpdateStatus() {
  return appUpdateStatus;
}

export function subscribeAppUpdateStatus(listener: (status: AppUpdateStatus) => void) {
  appUpdateListeners.add(listener);
  listener(appUpdateStatus);
  return () => appUpdateListeners.delete(listener);
}

export async function refreshAppUpdateStatus() {
  const registration = await resolveRegistration();
  watchRegistration(registration);
  if (!registration) {
    patchAppUpdateStatus({
      ...createRegistrationStatus(null),
      phase: appUpdateStatus.supported ? 'idle' : 'unsupported',
      message: appUpdateStatus.supported ? '等待网站更新服务启动' : appUpdateStatus.message,
      detail: appUpdateStatus.supported ? '如果刚刚打开页面，请稍等片刻后再次检查。' : appUpdateStatus.detail
    });
    return appUpdateStatus;
  }

  patchAppUpdateStatus(createRegistrationStatus(registration, !navigator.serviceWorker.controller && registration.active
    ? {
        phase: 'latest',
        message: '网站资源已缓存',
        detail: '刷新或重新打开后，页面会由 PWA 缓存接管。'
      }
    : {}));
  return appUpdateStatus;
}

export async function checkForAppUpdate() {
  if (!import.meta.env.PROD || !isServiceWorkerSupported) {
    patchAppUpdateStatus({ ...createInitialStatus(), lastCheckedAt: Date.now() });
    return appUpdateStatus;
  }

  const lastCheckedAt = Date.now();
  patchAppUpdateStatus({
    phase: 'checking',
    message: '正在检查最新版本',
    detail: '正在联系浏览器更新服务并请求最新资源清单。',
    lastCheckedAt
  });

  try {
    const releaseCompatibility = await checkReleaseCompatibility({ force: true });
    if (releaseCompatibility.state === 'incompatible') {
      patchAppUpdateStatus({
        phase: 'error',
        message: '当前运行环境需要升级',
        detail: releaseCompatibility.reason,
        lastCheckedAt
      });
      return appUpdateStatus;
    }
    const registration = await resolveRegistration();
    watchRegistration(registration);

    if (!registration) {
      patchAppUpdateStatus({
        ...createRegistrationStatus(null),
        phase: 'unsupported',
        message: '未找到网站更新服务',
        detail: '请使用打包后的 PWA 地址打开，或重新安装应用后再试。',
        lastCheckedAt
      });
      return appUpdateStatus;
    }

    if (registration.waiting) {
      patchAppUpdateStatus({
        ...createRegistrationStatus(registration),
        phase: 'downloaded',
        message: '新版本已下载',
        detail: '可以立即安装并重新载入页面。',
        lastCheckedAt
      });
      return appUpdateStatus;
    }

    await registration.update();
    const refreshedRegistration = await navigator.serviceWorker.getRegistration();
    const activeRegistration = refreshedRegistration ?? registration;
    watchRegistration(activeRegistration);
    watchInstallingWorker(activeRegistration, activeRegistration.installing);

    if (activeRegistration.waiting) {
      patchAppUpdateStatus({
        ...createRegistrationStatus(activeRegistration),
        phase: 'downloaded',
        message: '新版本已下载',
        detail: '可以立即安装并重新载入页面。',
        lastCheckedAt
      });
      return appUpdateStatus;
    }

    if (activeRegistration.installing) {
      patchAppUpdateStatus({
        ...createRegistrationStatus(activeRegistration),
        phase: 'checking',
        message: '正在下载最新版本',
        detail: '浏览器正在缓存新的资源包，请稍候。',
        lastCheckedAt
      });
      return appUpdateStatus;
    }

    patchAppUpdateStatus({
      ...createRegistrationStatus(activeRegistration),
      phase: 'latest',
      message: '已是最新版本',
      detail: '当前缓存资源与服务器版本一致。',
      lastCheckedAt
    });
  } catch (error) {
    patchAppUpdateStatus({
      phase: 'error',
      message: '检查更新失败',
      detail: error instanceof Error ? error.message : '浏览器未返回明确错误。',
      lastCheckedAt
    });
  }

  return appUpdateStatus;
}

export async function installDownloadedAppUpdate(options: { blockers?: readonly string[]; getBlockers?: () => readonly string[] } = {}) {
  if (!import.meta.env.PROD || !isServiceWorkerSupported) {
    patchAppUpdateStatus({ ...createInitialStatus(), lastCheckedAt: Date.now() });
    return appUpdateStatus;
  }

  const registration = await resolveRegistration();
  if (!registration?.waiting) {
    patchAppUpdateStatus({
      ...createRegistrationStatus(registration),
      phase: 'latest',
      message: '没有等待安装的新版本',
      detail: '先检查并下载最新版本，再执行安装。'
    });
    return appUpdateStatus;
  }

  const blockers = [...new Set((options.getBlockers?.() ?? options.blockers ?? []).map((blocker) => blocker.trim()).filter(Boolean))];
  if (blockers.length) {
    patchAppUpdateStatus({
      ...createRegistrationStatus(registration),
      phase: 'downloaded',
      message: '请先完成当前操作',
      detail: `${blockers.join('、')}。完成后再安装新版本，以免中断本地数据或未保存进度。`
    });
    return appUpdateStatus;
  }

  patchAppUpdateStatus({
    ...createRegistrationStatus(registration),
    phase: 'updated',
    message: '正在安装新版本',
    detail: '服务切换完成后会重新载入页面。'
  });

  let controllerChanged = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    controllerChanged = true;
    window.location.reload();
  }, { once: true });
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  window.setTimeout(() => {
    if (controllerChanged) return;
    patchAppUpdateStatus({
      ...createRegistrationStatus(registration),
      phase: 'error',
      message: '新版本尚未切换',
      detail: '浏览器仍在等待 Service Worker 激活，请稍后重新检查更新。'
    });
  }, 5_000);
  return appUpdateStatus;
}