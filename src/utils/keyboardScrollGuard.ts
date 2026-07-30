import { nextTick, onBeforeUnmount, type Ref } from 'vue';
import { APP_VIEWPORT_CHANGE_EVENT, type AppViewportChangeDetail } from '@/app/viewport';

type ScrollSnapshot = {
  bottomOffset: number;
  keepBottom: boolean;
  scrollTop: number;
};

const NEAR_BOTTOM_OFFSET = 36;
const KEYBOARD_TRANSITION_MS = 900;
const VIEWPORT_RESTORE_MS = 320;
const RESTORE_DELAYS = [40, 120, 260, 520, 820];

export function useKeyboardScrollGuard(scrollTarget: Ref<HTMLElement | null>) {
  let frameId = 0;
  let focused = false;
  let snapshot: ScrollSnapshot | null = null;
  const timerIds = new Set<number>();

  function clearRestoreTimeouts() {
    for (const timerId of timerIds) window.clearTimeout(timerId);
    timerIds.clear();
  }

  function clearRestoreTimers() {
    if (frameId !== 0) {
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    }
    clearRestoreTimeouts();
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

  function queueKeyboardScrollRestore(duration = KEYBOARD_TRANSITION_MS) {
    clearRestoreTimeouts();

    const restoreAfterRender = () => {
      frameId = 0;
      void nextTick(() => {
        restoreKeyboardScrollAnchor();
      });
    };

    if (frameId === 0) frameId = window.requestAnimationFrame(restoreAfterRender);

    for (const delay of RESTORE_DELAYS) {
      if (delay > duration) continue;
      const timerId = window.setTimeout(() => {
        timerIds.delete(timerId);
        restoreKeyboardScrollAnchor();
      }, delay);
      timerIds.add(timerId);
    }
  }

  function startKeyboardScrollGuard() {
    focused = true;
    if (!snapshot) captureKeyboardScrollAnchor();
    queueKeyboardScrollRestore();
  }

  function stopKeyboardScrollGuard() {
    focused = false;
    const timerId = window.setTimeout(() => {
      timerIds.delete(timerId);
      if (!focused) snapshot = null;
    }, VIEWPORT_RESTORE_MS);
    timerIds.add(timerId);
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
      queueKeyboardScrollRestore(VIEWPORT_RESTORE_MS);
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