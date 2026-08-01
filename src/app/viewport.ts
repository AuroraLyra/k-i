import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

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
  const isNativePlatform = Capacitor.isNativePlatform();
  const isStandaloneDisplayMode = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const isIOSPwa = isIOS && !isNativePlatform && isStandaloneDisplayMode;
  const initialViewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
  let stableViewportHeight = isIOSPwa ? Math.max(initialViewportHeight, Math.round(window.innerHeight)) : initialViewportHeight;
  let stableLayoutViewportHeight = Math.round(window.innerHeight);
  let stableViewportOcclusion = Math.max(0, Math.round(window.innerHeight - (window.visualViewport?.height ?? window.innerHeight) - (window.visualViewport?.offsetTop ?? 0)));
  let nativeKeyboardHeight = 0;
  let nativeKeyboardOpen = false;
  let estimatedNativeKeyboardOpen = false;
  let fallbackKeyboardTimer = 0;
  let keyboardWasOpen = false;
  let revealedKeyboardInput: Element | null = null;
  root.classList.toggle('is-ios', isIOS);
  root.classList.toggle('is-ios-pwa', isIOSPwa);
  if (isIOSPwa) root.style.removeProperty('--app-viewport-height');

  const isKeyboardInput = (element: Element | null) => {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(element.type);
  };

  const revealActiveKeyboardInput = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || !isKeyboardInput(activeElement)) return;
    window.requestAnimationFrame(() => {
      const appHeight = Number.parseFloat(root.style.getPropertyValue('--app-viewport-height')) || window.innerHeight;
      const bounds = activeElement.getBoundingClientRect();
      if (bounds.top >= 12 && bounds.bottom <= appHeight - 12) return;
      activeElement.scrollIntoView({ block: 'center', inline: 'nearest' });
    });
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
    const layoutViewportDelta = Math.max(0, stableLayoutViewportHeight - window.innerHeight);
    const viewportOcclusionDelta = Math.max(0, viewportOverlap - stableViewportOcclusion);
    const keyboardViewportOverlap = isIOS ? viewportOcclusionDelta : viewportOverlap;
    const keyboardOpen = (activeKeyboardInput || nativeKeyboardOpen)
      && Math.max(keyboardViewportOverlap, viewportDelta, layoutViewportDelta, nativeKeyboardHeight) > 80;
    const layoutViewportResized = layoutViewportDelta > 80;
    const nativeOverlayHeight = keyboardOpen && nativeKeyboardOpen && !layoutViewportResized
      ? Math.max(viewportOverlap, viewportDelta, nativeKeyboardHeight)
      : 0;
    const overlayKeyboardOpen = keyboardOpen && !isIOS && !layoutViewportResized && nativeOverlayHeight === 0;

    if (!keyboardOpen) {
      stableViewportHeight = isIOSPwa ? Math.max(viewportHeight, Math.round(window.innerHeight)) : viewportHeight;
      stableLayoutViewportHeight = Math.round(window.innerHeight);
      stableViewportOcclusion = viewportOverlap;
    }

    let nextKeyboardInset = 0;
    let nextHeight = viewportHeight;
    let nextViewportOffsetTop = 0;

    if (isIOS) {
      if (!keyboardOpen) {
        nextHeight = isIOSPwa ? Math.max(viewportHeight, Math.round(window.innerHeight)) : Math.round(window.innerHeight);
      } else if (viewportDelta > 80 || viewportOcclusionDelta > 80 || layoutViewportResized) {
        nextHeight = Math.max(1, Math.min(viewportHeight, Math.round(window.innerHeight)));
        nextViewportOffsetTop = isIOSPwa ? 0 : viewportOffsetTop;
      } else if (nativeKeyboardOpen && nativeKeyboardHeight > 80) {
        nextHeight = Math.max(1, stableLayoutViewportHeight - nativeKeyboardHeight);
      }
    } else {
      nextKeyboardInset = overlayKeyboardOpen ? Math.max(viewportOverlap, nativeKeyboardHeight) : 0;
      nextHeight = nativeOverlayHeight > 0
        ? Math.max(320, stableViewportHeight - nativeOverlayHeight)
        : nextKeyboardInset > 0
        ? stableViewportHeight
        : viewportHeight;
    }

    const shouldRevealKeyboardInput = isNativePlatform && !isIOS && keyboardOpen && activeKeyboardInput
      && (!keyboardWasOpen || revealedKeyboardInput !== document.activeElement);

    if (!keyboardOpen) revealedKeyboardInput = null;
    keyboardWasOpen = keyboardOpen;

    root.classList.toggle('keyboard-open', keyboardOpen);
    const useCssPwaLayoutViewport = isIOSPwa && !keyboardOpen;
    if (useCssPwaLayoutViewport) root.style.removeProperty('--app-viewport-height');
    else root.style.setProperty('--app-viewport-height', `${Math.round(nextHeight)}px`);
    root.style.setProperty('--visual-viewport-raw-height', `${viewportHeight}px`);
    root.style.setProperty('--visual-viewport-raw-offset-top', `${nextViewportOffsetTop}px`);
    root.style.setProperty('--keyboard-raw-inset', `${nextKeyboardInset}px`);
    if (isIOSPwa) {
      root.scrollLeft = 0;
      document.body.scrollLeft = 0;
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    }
    window.dispatchEvent(new CustomEvent<AppViewportChangeDetail>(APP_VIEWPORT_CHANGE_EVENT, {
      detail: {
        appHeight: useCssPwaLayoutViewport ? Math.round(root.getBoundingClientRect().height) : Math.round(nextHeight),
        keyboardInset: nextKeyboardInset,
        keyboardOpen,
        visualHeight: viewportHeight
      }
    }));
    if (shouldRevealKeyboardInput) {
      revealedKeyboardInput = document.activeElement;
      revealActiveKeyboardInput();
    }
  };

  const scheduleViewportHeightSync = () => {
    if (frameId !== 0) window.cancelAnimationFrame(frameId);
    frameId = window.requestAnimationFrame(applyViewportHeight);
  };

  const scheduleIOSPwaViewportRecovery = () => {
    scheduleViewportHeightSync();
    if (!isIOSPwa) return;
    window.setTimeout(scheduleViewportHeightSync, 120);
    window.setTimeout(scheduleViewportHeightSync, 360);
  };

  const clearFallbackKeyboardTimer = () => {
    if (!fallbackKeyboardTimer) return;
    window.clearTimeout(fallbackKeyboardTimer);
    fallbackKeyboardTimer = 0;
  };

  const hideEstimatedKeyboard = () => {
    if (!estimatedNativeKeyboardOpen) return;
    estimatedNativeKeyboardOpen = false;
    nativeKeyboardOpen = false;
    nativeKeyboardHeight = 0;
  };

  const scheduleNativeKeyboardFallback = () => {
    if (!isNativePlatform || isIOS || !isKeyboardInput(document.activeElement) || nativeKeyboardOpen) return;
    clearFallbackKeyboardTimer();
    fallbackKeyboardTimer = window.setTimeout(() => {
      fallbackKeyboardTimer = 0;
      if (!isKeyboardInput(document.activeElement) || nativeKeyboardOpen) return;

      const visualViewport = window.visualViewport;
      const viewportHeight = Math.round(visualViewport?.height ?? window.innerHeight);
      const viewportOffsetTop = Math.round(visualViewport?.offsetTop ?? 0);
      const viewportOverlap = visualViewport
        ? Math.max(0, Math.round(window.innerHeight - visualViewport.height - viewportOffsetTop))
        : 0;
      const viewportDelta = Math.max(0, stableViewportHeight - viewportHeight);
      const layoutViewportDelta = Math.max(0, stableLayoutViewportHeight - window.innerHeight);
      if (Math.max(viewportOverlap, viewportDelta, layoutViewportDelta) > 80) return;

      const baseHeight = Math.max(stableViewportHeight, stableLayoutViewportHeight);
      const preferredHeight = Math.max(220, Math.min(420, Math.round(baseHeight * 0.42)));
      const estimatedHeight = Math.min(preferredHeight, Math.max(0, baseHeight - 320));
      if (estimatedHeight <= 80) return;

      estimatedNativeKeyboardOpen = true;
      nativeKeyboardOpen = true;
      nativeKeyboardHeight = estimatedHeight;
      scheduleViewportHeightSync();
    }, 320);
  };

  if (isNativePlatform && Capacitor.isPluginAvailable('Keyboard')) {
    const showKeyboard = (keyboardHeight: number) => {
      clearFallbackKeyboardTimer();
      estimatedNativeKeyboardOpen = false;
      nativeKeyboardOpen = true;
      nativeKeyboardHeight = Math.max(0, Math.round(keyboardHeight));
      scheduleViewportHeightSync();
    };
    const hideKeyboard = () => {
      clearFallbackKeyboardTimer();
      estimatedNativeKeyboardOpen = false;
      nativeKeyboardOpen = false;
      nativeKeyboardHeight = 0;
      scheduleViewportHeightSync();
    };

    void Keyboard.addListener('keyboardWillShow', ({ keyboardHeight }) => showKeyboard(keyboardHeight)).catch(() => undefined);
    void Keyboard.addListener('keyboardDidShow', ({ keyboardHeight }) => showKeyboard(keyboardHeight)).catch(() => undefined);
    void Keyboard.addListener('keyboardWillHide', hideKeyboard).catch(() => undefined);
    void Keyboard.addListener('keyboardDidHide', hideKeyboard).catch(() => undefined);
  }

  scheduleViewportHeightSync();

  window.addEventListener('resize', scheduleViewportHeightSync, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportHeightSync, { passive: true });
  window.addEventListener('pageshow', scheduleIOSPwaViewportRecovery, { passive: true });
  document.addEventListener('fullscreenchange', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('webkitfullscreenchange', scheduleViewportHeightSync, { passive: true } as AddEventListenerOptions);
  window.addEventListener('link:fullscreen-change', scheduleViewportHeightSync, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleViewportHeightSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleViewportHeightSync, { passive: true });
  document.addEventListener('focusin', () => {
    scheduleViewportHeightSync();
    scheduleNativeKeyboardFallback();
  }, { passive: true });
  document.addEventListener('focusout', () => {
    clearFallbackKeyboardTimer();
    window.setTimeout(() => {
      if (isKeyboardInput(document.activeElement)) scheduleNativeKeyboardFallback();
      else hideEstimatedKeyboard();
      scheduleIOSPwaViewportRecovery();
    }, 120);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleIOSPwaViewportRecovery();
  });
}