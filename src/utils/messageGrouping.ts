import type { ChatMessage } from '@/types/domain';

export const messageGroupMaxGapMs = 5 * 60 * 1000;

export type MessageGroupPosition = 'single' | 'first' | 'middle' | 'last';

function visualSender(message: ChatMessage): ChatMessage['sender'] {
  if (!message.call) return message.sender;
  return message.call.direction === 'incoming' ? 'char' : 'user';
}

function isGroupableMessage(message: ChatMessage) {
  return message.sender !== 'system'
    && message.displayStyle !== 'narration'
    && !message.sticker
    && !message.image
    && !message.voice
    && !message.location
    && !message.mcpResult
    && !message.mcpOperations?.length
    && !message.transfer
    && !message.commerce
    && !message.shopShare
    && !message.musicListenInvite
    && !message.linkPreview
    && !message.theaterLink
    && !message.offlineInvitation
    && !message.call
    && !message.gobang;
}

function messageAuthorKey(message: ChatMessage) {
  const sender = visualSender(message);
  return `${sender}:${message.authorType ?? ''}:${message.authorId ?? ''}`;
}

function canGroupTogether(previous: ChatMessage | undefined, next: ChatMessage | undefined) {
  if (!previous || !next || !isGroupableMessage(previous) || !isGroupableMessage(next)) return false;
  if (visualSender(previous) !== visualSender(next)) return false;
  if (messageAuthorKey(previous) !== messageAuthorKey(next)) return false;
  const gap = next.createdAt - previous.createdAt;
  return gap >= 0 && gap <= messageGroupMaxGapMs;
}

export function resolveMessageGroupPositions(messages: readonly ChatMessage[], timeDividerBefore: readonly boolean[] = []) {
  return messages.map<MessageGroupPosition>((message, index) => {
    const joinsPrevious = !timeDividerBefore[index] && canGroupTogether(messages[index - 1], message);
    const joinsNext = !timeDividerBefore[index + 1] && canGroupTogether(message, messages[index + 1]);
    if (joinsPrevious && joinsNext) return 'middle';
    if (joinsPrevious) return 'last';
    if (joinsNext) return 'first';
    return 'single';
  });
}