import assert from 'node:assert/strict';
import {
  computeLayoutRuntimeSnapshot,
  resolveFullscreenState,
  resolveLayoutEnvironment,
  resolveViewportOwner
} from '../src/app/layoutRuntime.ts';
import type { ChatMessage } from '../src/types/domain.ts';
import { resolveMessageGroupPositions } from '../src/utils/messageGrouping.ts';
import { replyDeliveryMaximumGapMs, replyDeliveryMinimumGapMs, replyMessageDeliveryGap, shouldStageOnlineReplyDelivery } from '../src/utils/replyDelivery.ts';

function message(id: string, sender: ChatMessage['sender'], createdAt: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    conversationId: 'conversation',
    sender,
    mode: 'online',
    content: id,
    createdAt,
    status: 'sent',
    ...extra
  };
}

assert.equal(resolveLayoutEnvironment({ native: true, ios: true, standalone: false }), 'native-ios');
assert.equal(resolveLayoutEnvironment({ native: false, ios: true, standalone: true }), 'pwa-ios');
assert.equal(resolveLayoutEnvironment({ native: false, ios: false, standalone: true }), 'pwa-android');
assert.equal(resolveViewportOwner('native-android'), 'native-webview-resize');
assert.equal(resolveViewportOwner('pwa-ios'), 'visual-overlay-fallback');
assert.equal(resolveFullscreenState({ native: true, fullscreenEnabled: true, pwaFullscreen: false, browserFullscreen: false }), 'native-fullscreen');

const nativeKeyboard = computeLayoutRuntimeSnapshot({
  environment: 'native-android',
  fullscreenState: 'native-fullscreen',
  themeScale: 1.1,
  layoutWidth: 360,
  layoutHeight: 500,
  visualWidth: 360,
  visualHeight: 500,
  visualOffsetTop: 0,
  baselineLayoutHeight: 800,
  baselineVisualHeight: 800,
  baselineVisualOcclusion: 0,
  nativeKeyboardHeight: 300,
  nativeKeyboardVisible: true,
  activeTextInput: true
});
assert.equal(nativeKeyboard.appHeight, 500);
assert.equal(nativeKeyboard.keyboardState, 'resizing');
assert.equal(nativeKeyboard.keyboardOcclusion, 0);

const iosPwaKeyboard = computeLayoutRuntimeSnapshot({
  environment: 'pwa-ios',
  fullscreenState: 'pwa-fullscreen',
  themeScale: 0.9,
  layoutWidth: 390,
  layoutHeight: 800,
  visualWidth: 390,
  visualHeight: 510,
  visualOffsetTop: 0,
  baselineLayoutHeight: 800,
  baselineVisualHeight: 800,
  baselineVisualOcclusion: 0,
  nativeKeyboardHeight: 0,
  nativeKeyboardVisible: false,
  activeTextInput: true
});
assert.equal(iosPwaKeyboard.appHeight, 510);
assert.equal(iosPwaKeyboard.keyboardState, 'overlay');
assert.equal(iosPwaKeyboard.keyboardOcclusion, 0);

const webOverlayKeyboard = computeLayoutRuntimeSnapshot({
  environment: 'web',
  fullscreenState: 'windowed',
  themeScale: 1,
  layoutWidth: 390,
  layoutHeight: 800,
  visualWidth: 390,
  visualHeight: 520,
  visualOffsetTop: 0,
  baselineLayoutHeight: 800,
  baselineVisualHeight: 800,
  baselineVisualOcclusion: 0,
  nativeKeyboardHeight: 0,
  nativeKeyboardVisible: false,
  activeTextInput: true
});
assert.equal(webOverlayKeyboard.appHeight, 800);
assert.equal(webOverlayKeyboard.keyboardState, 'overlay');
assert.equal(webOverlayKeyboard.keyboardOcclusion, 280);

const browserChrome = computeLayoutRuntimeSnapshot({
  environment: 'web',
  fullscreenState: 'windowed',
  themeScale: 1,
  layoutWidth: 390,
  layoutHeight: 800,
  visualWidth: 390,
  visualHeight: 740,
  visualOffsetTop: 0,
  baselineLayoutHeight: 800,
  baselineVisualHeight: 800,
  baselineVisualOcclusion: 0,
  nativeKeyboardHeight: 0,
  nativeKeyboardVisible: false,
  activeTextInput: false
});
assert.equal(browserChrome.appHeight, 740);
assert.equal(browserChrome.keyboardOpen, false);

const groupedMessages = [
  message('c1', 'char', 1_000, { authorId: '20001', authorType: 'character' }),
  message('c2', 'char', 2_000, { authorId: '20001', authorType: 'character' }),
  message('c3', 'char', 3_000, { authorId: '20001', authorType: 'character' }),
  message('u1', 'user', 4_000, { authorId: '10001', authorType: 'user' })
];
assert.deepEqual(resolveMessageGroupPositions(groupedMessages), ['first', 'middle', 'last', 'single']);
assert.deepEqual(resolveMessageGroupPositions(groupedMessages, [false, false, true, false]), ['first', 'last', 'single', 'single']);
assert.deepEqual(resolveMessageGroupPositions([
  message('c1', 'char', 1_000, { authorId: '20001', authorType: 'character' }),
  message('image', 'char', 2_000, { authorId: '20001', authorType: 'character', image: { kind: 'description', description: '图片', url: '' } }),
  message('c2', 'char', 3_000, { authorId: '20001', authorType: 'character' })
]), ['single', 'single', 'single']);

const shortReplyGap = replyMessageDeliveryGap(message('short-reply', 'char', 1_000, { content: '好' }));
const longReplyGap = replyMessageDeliveryGap(message('short-reply', 'char', 1_000, { content: '我想了一下，这件事我们可以慢慢说。'.repeat(20) }));
assert.ok(shortReplyGap >= replyDeliveryMinimumGapMs && shortReplyGap <= replyDeliveryMaximumGapMs);
assert.ok(longReplyGap >= shortReplyGap && longReplyGap <= replyDeliveryMaximumGapMs);
assert.equal(replyMessageDeliveryGap(message('short-reply', 'char', 1_000, { content: '好' })), shortReplyGap);
assert.equal(shouldStageOnlineReplyDelivery({ conversationId: 'conversation', activeConversationId: 'conversation', visibilityState: 'visible' }), true);
assert.equal(shouldStageOnlineReplyDelivery({ conversationId: 'conversation', activeConversationId: 'other', visibilityState: 'visible' }), false);
assert.equal(shouldStageOnlineReplyDelivery({ conversationId: 'conversation', activeConversationId: 'conversation', visibilityState: 'hidden' }), false);

console.log('mobile runtime regression: passed');