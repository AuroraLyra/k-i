import { nextTick, onBeforeUnmount, type Ref } from 'vue';
import { APP_VIEWPORT_CHANGE_EVENT, type AppViewportChangeDetail } from '@/app/viewport';

type ScrollSnapshot = {
  bottomOffset: number;
  keepBottom: boolean;
  scrollTop: number;
};

const NEAR_BOTTOM_OFFSET = 36;
const KEYBOARD_TRANSITION_MS = 900;
const VIEWPORT_SETTLE_MS = 240;

export function useKeyboardScrollGuard(scrollTarget: Ref<HTMLElement | null>) {
  let frameId = 0;
  let focused = false;
  let releaseTimerId = 0;
  let settleTimerId = 0;
  let snapshot: ScrollSnapshot | null = null;

  function clearRestoreTimeout() {
    if (!settleTimerId) return;
    window.clearTimeout(settleTimerId);
    settleTimerId = 0;
  }

  function clearReleaseTimer() {
    if (!releaseTimerId) return;
    window.clearTimeout(releaseTimerId);
    releaseTimerId = 0;
  }

  function clearRestoreTimers() {
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    clearRestoreTimeout();
    clearReleaseTimer();
  }

  function captureKeyboardScrollAnchor() {
    const element = scrollTarget.value;
    if (!element) return;

    const bottomOffset = Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop);
    snapshot = {
      bottomOffset,
      keepBottom: bottomOffset <= NEAR_BOTTOM_OFFSET,
      scrollTop: element.scrollTop
    };
  }

  function restoreKeyboardScrollAnchor() {
    const element = scrollTarget.value;
    if (!element || !snapshot) return;

    const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
    const nextScrollTop = snapshot.keepBottom
      ? Math.max(0, maxScrollTop - snapshot.bottomOffset)
      : Math.min(snapshot.scrollTop, maxScrollTop);

    if (Math.abs(element.scrollTop - nextScrollTop) > 1) element.scrollTop = nextScrollTop;
  }

  function queueKeyboardScrollRestore() {
    clearRestoreTimeout();

    const restoreAfterRender = () => {
      frameId = 0;
      void nextTick(() => {
        restoreKeyboardScrollAnchor();
      });
    };

    if (frameId === 0) frameId = window.requestAnimationFrame(restoreAfterRender);
    settleTimerId = window.setTimeout(() => {
      settleTimerId = 0;
      restoreKeyboardScrollAnchor();
    }, VIEWPORT_SETTLE_MS);
  }

  function startKeyboardScrollGuard() {
    clearReleaseTimer();
    focused = true;
    if (!snapshot) captureKeyboardScrollAnchor();
    queueKeyboardScrollRestore();
  }

  function stopKeyboardScrollGuard() {
    focused = false;
    clearReleaseTimer();
    releaseTimerId = window.setTimeout(() => {
      releaseTimerId = 0;
      if (!focused) snapshot = null;
    }, KEYBOARD_TRANSITION_MS);
  }

  function releaseKeyboardScrollGuard() {
    snapshot = null;
    clearRestoreTimers();
  }

  function handleViewportChange(event: Event) {
    const detail = (event as CustomEvent<AppViewportChangeDetail>).detail;
    if (!detail) return;

    if (focused && detail.keyboardOpen) {
      if (!snapshot) captureKeyboardScrollAnchor();
      queueKeyboardScrollRestore();
      return;
    }

    if (!focused && !detail.keyboardOpen) snapshot = null;
  }

  window.addEventListener(APP_VIEWPORT_CHANGE_EVENT, handleViewportChange);

  onBeforeUnmount(() => {
    window.removeEventListener(APP_VIEWPORT_CHANGE_EVENT, handleViewportChange);
    clearRestoreTimers();
  });

  return {
    captureKeyboardScrollAnchor,
    releaseKeyboardScrollGuard,
    startKeyboardScrollGuard,
    stopKeyboardScrollGuard
  };
}