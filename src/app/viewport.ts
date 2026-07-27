export const APP_VIEWPORT_CHANGE_EVENT = 'app:viewport-change';

export type AppViewportChangeDetail = {
  appHeight: number;
  keyboardInset: number;
  keyboardOpen: boolean;
  visualHeight: number;
};

export function syncAppViewportHeight() {
  const root = document.documentElement;
  let frameId = 0;

  root.style.removeProperty('--app-height');
  root.style.removeProperty('--visual-viewport-height');
  root.style.removeProperty('--visual-viewport-offset-top');
  root.style.removeProperty('--keyboard-inset');

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent) && window.navigator.maxTouchPoints > 1);
  let stableViewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
  root.classList.toggle('is-ios', isIOS);

  const isKeyboardInput = (element: Element | null) => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  };

  const applyViewportHeight = () => {
    frameId = 0;
    const visualViewport = window.visualViewport;
    const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
    const viewportOffsetTop = Math.round(visualViewport?.offsetTop ?? 0);
    const viewportOverlap = visualViewport
      ? Math.max(0, Math.round(window.innerHeight - visualViewport.height - viewportOffsetTop))
      : 0;
    const activeKeyboardInput = isKeyboardInput(document.activeElement);
    const viewportDelta = Math.max(0, stableViewportHeight - viewportHeight);
    const keyboardOpen = activeKeyboardInput && Math.max(viewportOverlap, viewportDelta) > 80;
    const overlayKeyboardOpen = keyboardOpen && !isIOS && viewportOverlap > 0;

    if (!keyboardOpen) stableViewportHeight = viewportHeight;

    const nextKeyboardInset = overlayKeyboardOpen ? viewportOverlap : 0;
    const nextHeight = nextKeyboardInset > 0 ? stableViewportHeight : viewportHeight;

    root.classList.toggle('keyboard-open', keyboardOpen);
    root.style.setProperty('--app-viewport-height', `${Math.round(nextHeight)}px`);
    root.style.setProperty('--visual-viewport-raw-height', `${viewportHeight}px`);
    root.style.setProperty('--visual-viewport-raw-offset-top', `${viewportOffsetTop}px`);
    root.style.setProperty('--keyboard-raw-inset', `${nextKeyboardInset}px`);
    window.dispatchEvent(new CustomEvent<AppViewportChangeDetail>(APP_VIEWPORT_CHANGE_EVENT, {
      detail: {
        appHeight: Math.round(nextHeight),
        keyboardInset: nextKeyboardInset,
        keyboardOpen,
        visualHeight: viewportHeight
      }
    }));
  };

  const scheduleViewportHeightSync = () => {
    if (frameId !== 0) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(applyViewportHeight);
  };

  scheduleViewportHeightSync();

  window.addEventListener('resize', scheduleViewportHeightSync, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportHeightSync, { passive: true });
  window.addEventListener('pageshow', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('fullscreenchange', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('webkitfullscreenchange', scheduleViewportHeightSync, { passive: true } as AddEventListenerOptions);
  window.addEventListener('link:fullscreen-change', scheduleViewportHeightSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleViewportHeightSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('focusin', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('focusout', () => window.setTimeout(scheduleViewportHeightSync, 120), { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleViewportHeightSync();
  });
}