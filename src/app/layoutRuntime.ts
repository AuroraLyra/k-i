export type LayoutEnvironment = 'web' | 'pwa-ios' | 'pwa-android' | 'native-ios' | 'native-android';
export type ViewportOwner = 'css-dynamic' | 'native-webview-resize' | 'visual-overlay-fallback';
export type FullscreenState = 'windowed' | 'pwa-fullscreen' | 'browser-fullscreen' | 'native-fullscreen';
export type KeyboardState = 'hidden' | 'resizing' | 'overlay' | 'unknown';

export interface LayoutRuntimeInput {
  environment: LayoutEnvironment;
  fullscreenState: FullscreenState;
  themeScale: number;
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  visualOffsetTop: number;
  baselineLayoutHeight: number;
  baselineVisualHeight: number;
  baselineVisualOcclusion: number;
  nativeKeyboardHeight: number;
  nativeKeyboardVisible: boolean;
  activeTextInput: boolean;
}

export interface LayoutRuntimeSnapshot {
  environment: LayoutEnvironment;
  viewportOwner: ViewportOwner;
  fullscreenState: FullscreenState;
  themeScale: number;
  layoutWidth: number;
  layoutHeight: number;
  visualWidth: number;
  visualHeight: number;
  visualOffsetTop: number;
  appHeight: number;
  keyboardOcclusion: number;
  keyboardState: KeyboardState;
  keyboardOpen: boolean;
}

const keyboardThreshold = 80;

export function normalizeThemeScale(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export function resolveViewportOwner(environment: LayoutEnvironment): ViewportOwner {
  if (environment === 'native-ios' || environment === 'native-android') return 'native-webview-resize';
  if (environment === 'pwa-ios') return 'visual-overlay-fallback';
  return 'css-dynamic';
}

export function resolveLayoutEnvironment(options: {
  native: boolean;
  ios: boolean;
  standalone: boolean;
}): LayoutEnvironment {
  if (options.native) return options.ios ? 'native-ios' : 'native-android';
  if (options.standalone) return options.ios ? 'pwa-ios' : 'pwa-android';
  return 'web';
}

export function resolveFullscreenState(options: {
  native: boolean;
  fullscreenEnabled: boolean;
  pwaFullscreen: boolean;
  browserFullscreen: boolean;
}): FullscreenState {
  if (options.native && options.fullscreenEnabled) return 'native-fullscreen';
  if (options.pwaFullscreen) return 'pwa-fullscreen';
  if (options.browserFullscreen) return 'browser-fullscreen';
  return 'windowed';
}

export function computeLayoutRuntimeSnapshot(input: LayoutRuntimeInput): LayoutRuntimeSnapshot {
  const viewportOwner = resolveViewportOwner(input.environment);
  const layoutHeight = Math.max(1, Math.round(input.layoutHeight));
  const visualHeight = Math.max(1, Math.round(input.visualHeight));
  const visualOffsetTop = Math.max(0, Math.round(input.visualOffsetTop));
  const baselineLayoutHeight = Math.max(layoutHeight, Math.round(input.baselineLayoutHeight));
  const baselineVisualHeight = Math.max(visualHeight, Math.round(input.baselineVisualHeight));
  const visualOcclusion = Math.max(0, layoutHeight - visualHeight - visualOffsetTop);
  const layoutDelta = Math.max(0, baselineLayoutHeight - layoutHeight);
  const visualDelta = Math.max(0, baselineVisualHeight - visualHeight);
  const visualOcclusionDelta = Math.max(0, visualOcclusion - Math.max(0, input.baselineVisualOcclusion));
  const keyboardSignal = Math.max(layoutDelta, visualDelta, visualOcclusionDelta, Math.max(0, input.nativeKeyboardHeight));
  const keyboardOpen = (input.activeTextInput || input.nativeKeyboardVisible) && keyboardSignal > keyboardThreshold;

  let appHeight = layoutHeight;
  let keyboardOcclusion = 0;
  let keyboardState: KeyboardState = 'hidden';

  if (keyboardOpen) {
    if (viewportOwner === 'native-webview-resize') {
      appHeight = layoutDelta > keyboardThreshold
        ? layoutHeight
        : Math.max(1, baselineLayoutHeight - Math.max(0, input.nativeKeyboardHeight));
      keyboardState = 'resizing';
    } else if (viewportOwner === 'visual-overlay-fallback') {
      appHeight = Math.min(layoutHeight, visualHeight);
      keyboardState = 'overlay';
    } else {
      if (layoutDelta > keyboardThreshold) {
        appHeight = layoutHeight;
        keyboardState = 'resizing';
      } else {
        appHeight = layoutHeight;
        keyboardState = 'overlay';
      }
    }
  } else if (viewportOwner === 'visual-overlay-fallback') {
    appHeight = Math.max(layoutHeight, visualHeight);
  } else if (viewportOwner === 'css-dynamic') {
    appHeight = visualHeight;
  }

  if (keyboardOpen && keyboardState === 'overlay' && input.environment !== 'pwa-ios') {
    keyboardOcclusion = Math.max(0, layoutHeight - visualHeight - visualOffsetTop, input.nativeKeyboardHeight);
  }

  return {
    environment: input.environment,
    viewportOwner,
    fullscreenState: input.fullscreenState,
    themeScale: normalizeThemeScale(input.themeScale),
    layoutWidth: Math.max(1, Math.round(input.layoutWidth)),
    layoutHeight,
    visualWidth: Math.max(1, Math.round(input.visualWidth)),
    visualHeight,
    visualOffsetTop,
    appHeight: Math.max(1, Math.round(appHeight)),
    keyboardOcclusion: Math.round(keyboardOcclusion),
    keyboardState,
    keyboardOpen
  };
}