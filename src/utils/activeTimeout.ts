export interface ActiveTimeoutController {
  signal: AbortSignal;
  dispose: () => void;
}

function isPageReadyForNetwork() {
  const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  const online = typeof navigator === 'undefined' || navigator.onLine;
  return visible && online;
}

function monotonicNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export function isFetchInterruptedError(error: unknown) {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && ['AbortError', 'TimeoutError'].includes(error.name)) return true;
  if (!(error instanceof TypeError)) return false;
  const signature = `${error.name} ${error.message}`.toLocaleLowerCase();
  return /\b(abort(?:ed)?|cancel(?:ed|led)|load failed|failed to fetch|network connection was lost)\b/.test(signature);
}

export function waitForActiveNetworkWindow(delayMs = 0) {
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) globalThis.clearTimeout(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', schedule);
        window.removeEventListener('pageshow', schedule);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', schedule);
        document.removeEventListener('resume', schedule);
      }
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const clearPendingTimer = () => {
      if (timer === undefined) return;
      globalThis.clearTimeout(timer);
      timer = undefined;
    };
    const schedule = () => {
      if (!isPageReadyForNetwork()) {
        clearPendingTimer();
        return;
      }
      if (timer !== undefined) return;
      timer = globalThis.setTimeout(finish, Math.max(0, Math.round(delayMs)));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', schedule);
      window.addEventListener('pageshow', schedule);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', schedule);
      document.addEventListener('resume', schedule);
    }
    schedule();
  });
}

export function createActiveTimeout(timeoutMs: number): ActiveTimeoutController {
  const controller = new AbortController();
  const duration = Math.max(0, Math.round(timeoutMs));
  let remainingMs = duration;
  let startedAt: number | null = null;
  let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let pageHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  let pageFrozen = false;

  const pause = () => {
    if (timer !== undefined) globalThis.clearTimeout(timer);
    timer = undefined;
    if (startedAt !== null) {
      remainingMs = Math.max(0, remainingMs - (monotonicNow() - startedAt));
      startedAt = null;
    }
  };

  const resume = () => {
    if (controller.signal.aborted || timer !== undefined || pageHidden || pageFrozen) return;
    if (remainingMs <= 0) {
      controller.abort();
      return;
    }
    startedAt = monotonicNow();
    timer = globalThis.setTimeout(() => {
      timer = undefined;
      startedAt = null;
      remainingMs = 0;
      controller.abort();
    }, remainingMs);
  };

  const handleVisibilityChange = () => {
    pageHidden = document.visibilityState === 'hidden';
    if (pageHidden) pause();
    else resume();
  };
  const handlePageHide = () => {
    pageHidden = true;
    pause();
  };
  const handlePageShow = () => {
    pageHidden = document.visibilityState === 'hidden';
    resume();
  };
  const handleFreeze = () => {
    pageFrozen = true;
    pause();
  };
  const handleResume = () => {
    pageFrozen = false;
    resume();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handleFreeze);
    document.addEventListener('resume', handleResume);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
  }
  resume();

  return {
    signal: controller.signal,
    dispose: () => {
      pause();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        document.removeEventListener('freeze', handleFreeze);
        document.removeEventListener('resume', handleResume);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('pagehide', handlePageHide);
        window.removeEventListener('pageshow', handlePageShow);
      }
    }
  };
}