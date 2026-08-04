import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import {
  computeLayoutRuntimeSnapshot,
  resolveFullscreenState,
  resolveLayoutEnvironment,
  type FullscreenState,
  type KeyboardState,
  type LayoutEnvironment,
  type ViewportOwner
} from './layoutRuntime';

export const APP_VIEWPORT_CHANGE_EVENT = 'app:viewport-change';

export type AppViewportChangeDetail = {
  appHeight: number;
  keyboardInset: number;
  keyboardOpen: boolean;
  visualHeight: number;
  environment: LayoutEnvironment;
  fullscreenState: FullscreenState;
  keyboardState: KeyboardState;
  themeScale: number;
  viewportOwner: ViewportOwner;
};

export function syncAppViewportHeight() {
  const root = document.documentElement;
  let frameId = 0;

  const userAgent = window.navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && /Mobile/.test(userAgent) && window.navigator.maxTouchPoints > 1);
  const isNativePlatform = Capacitor.isNativePlatform();
  const isStandaloneDisplayMode = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const environment = resolveLayoutEnvironment({ native: isNativePlatform, ios: isIOS, standalone: isStandaloneDisplayMode });
  const isIOSPwa = environment === 'pwa-ios';
  const initialViewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
  let stableViewportHeight = isIOSPwa ? Math.max(initialViewportHeight, Math.round(window.innerHeight)) : initialViewportHeight;
  let stableLayoutViewportHeight = Math.round(window.innerHeight);
  let stableViewportOcclusion = Math.max(0, Math.round(window.innerHeight - (window.visualViewport?.height ?? window.innerHeight) - (window.visualViewport?.offsetTop ?? 0)));
  let nativeKeyboardHeight = 0;
  let nativeKeyboardOpen = false;
  let keyboardWasOpen = false;
  let revealedKeyboardInput: Element | null = null;
  root.classList.toggle('is-ios', isIOS);
  root.classList.toggle('is-ios-pwa', isIOSPwa);

  const isKeyboardInput = (element: Element | null) => {
    if (element instanceof HTMLTextAreaElement) return true;
    if (!(element instanceof HTMLInputElement)) return false;
    return ['email', 'number', 'password', 'search', 'tel', 'text', 'url'].includes(element.type);
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
    const activeKeyboardInput = isKeyboardInput(document.activeElement);
    const rawScale = Number.parseFloat(getComputedStyle(root).getPropertyValue('--app-display-scale'));
    const fullscreenState = resolveFullscreenState({
      native: isNativePlatform,
      fullscreenEnabled: root.classList.contains('is-link-fullscreen'),
      pwaFullscreen: window.matchMedia('(display-mode: fullscreen)').matches,
      browserFullscreen: Boolean(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement)
    });
    const snapshot = computeLayoutRuntimeSnapshot({
      environment,
      fullscreenState,
      themeScale: rawScale,
      layoutWidth: window.innerWidth,
      layoutHeight: window.innerHeight,
      visualWidth: visualViewport?.width ?? window.innerWidth,
      visualHeight: viewportHeight,
      visualOffsetTop: viewportOffsetTop,
      baselineLayoutHeight: stableLayoutViewportHeight,
      baselineVisualHeight: stableViewportHeight,
      baselineVisualOcclusion: stableViewportOcclusion,
      nativeKeyboardHeight,
      nativeKeyboardVisible: nativeKeyboardOpen,
      activeTextInput: activeKeyboardInput
    });

    if (!snapshot.keyboardOpen) {
      stableViewportHeight = isIOSPwa ? Math.max(viewportHeight, Math.round(window.innerHeight)) : viewportHeight;
      stableLayoutViewportHeight = Math.round(window.innerHeight);
      stableViewportOcclusion = Math.max(0, Math.round(window.innerHeight - viewportHeight - viewportOffsetTop));
    }

    const shouldRevealKeyboardInput = isNativePlatform && !isIOS && snapshot.keyboardOpen && activeKeyboardInput
      && (!keyboardWasOpen || revealedKeyboardInput !== document.activeElement);

    if (!snapshot.keyboardOpen) revealedKeyboardInput = null;
    keyboardWasOpen = snapshot.keyboardOpen;

    root.classList.toggle('keyboard-open', snapshot.keyboardOpen);
    root.dataset.layoutEnvironment = snapshot.environment;
    root.dataset.viewportOwner = snapshot.viewportOwner;
    root.dataset.fullscreenState = snapshot.fullscreenState;
    root.style.setProperty('--app-viewport-height', `${snapshot.appHeight}px`);
    root.style.setProperty('--visual-viewport-raw-height', `${snapshot.visualHeight}px`);
    root.style.setProperty('--visual-viewport-raw-offset-top', `${snapshot.visualOffsetTop}px`);
    root.style.setProperty('--keyboard-raw-inset', `${snapshot.keyboardOcclusion}px`);
    if (isIOSPwa) {
      root.scrollLeft = 0;
      document.body.scrollLeft = 0;
      if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);
    }
    window.dispatchEvent(new CustomEvent<AppViewportChangeDetail>(APP_VIEWPORT_CHANGE_EVENT, {
      detail: {
        appHeight: snapshot.appHeight,
        keyboardInset: snapshot.keyboardOcclusion,
        keyboardOpen: snapshot.keyboardOpen,
        visualHeight: snapshot.visualHeight,
        environment: snapshot.environment,
        fullscreenState: snapshot.fullscreenState,
        keyboardState: snapshot.keyboardState,
        themeScale: snapshot.themeScale,
        viewportOwner: snapshot.viewportOwner
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

  if (isNativePlatform && Capacitor.isPluginAvailable('Keyboard')) {
    const showKeyboard = (keyboardHeight: number) => {
      nativeKeyboardOpen = true;
      nativeKeyboardHeight = Math.max(0, Math.round(keyboardHeight));
      scheduleViewportHeightSync();
    };
    const hideKeyboard = () => {
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
  }, { passive: true });
  document.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!isKeyboardInput(document.activeElement)) {
        nativeKeyboardOpen = false;
        nativeKeyboardHeight = 0;
      }
      scheduleIOSPwaViewportRecovery();
    }, 120);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleIOSPwaViewportRecovery();
  });
  window.addEventListener('link:theme-scale-change', scheduleViewportHeightSync, { passive: true });
}