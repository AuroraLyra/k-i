import type { ChatMessage } from '@/types/domain';

export const replyDeliveryMinimumGapMs = 320;
export const replyDeliveryMaximumGapMs = 1_350;

function stableMessageVariance(messageId: string) {
  let hash = 0;
  for (const character of messageId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 181;
}

function isRichReplyMessage(message: ChatMessage) {
  return Boolean(
    message.sticker
    || message.image
    || message.voice
    || message.location
    || message.transfer
    || message.commerce
    || message.musicListenInvite
    || message.call
    || message.gobang
  );
}

export function replyMessageDeliveryGap(message: ChatMessage) {
  const contentLength = message.content.replace(/^\[[^\]]+\]\s*/u, '').trim().length;
  const readingDelay = Math.min(760, Math.round(Math.sqrt(contentLength) * 82));
  const baseDelay = message.sender === 'system' || message.displayStyle === 'narration'
    ? 250
    : isRichReplyMessage(message) ? 420 : 330;
  return Math.min(
    replyDeliveryMaximumGapMs,
    Math.max(replyDeliveryMinimumGapMs, baseDelay + readingDelay + stableMessageVariance(message.id) - 90)
  );
}

export function shouldStageOnlineReplyDelivery(options: {
  conversationId: string;
  activeConversationId: string | null;
  visibilityState?: DocumentVisibilityState;
}) {
  return options.activeConversationId === options.conversationId
    && (options.visibilityState ?? 'visible') === 'visible';
}

export function waitForReplyDelivery(delayMs: number, signal?: AbortSignal) {
  if (signal?.aborted || typeof document === 'undefined' || document.visibilityState !== 'visible') return Promise.resolve();
  return new Promise<void>((resolve) => {
    let timer: ReturnType<typeof globalThis.setTimeout> | undefined;
    const finish = () => {
      if (timer !== undefined) globalThis.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      signal?.removeEventListener('abort', finish);
      resolve();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') finish();
    };

    timer = globalThis.setTimeout(finish, Math.max(0, Math.round(delayMs)));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    signal?.addEventListener('abort', finish, { once: true });
  });
}