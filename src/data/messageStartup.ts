import type { ChatMessage } from '@/types/domain';
import { compareConversationMessageOrder } from './messagePagination';

export function mergeStartupMessageSets(messageSets: Iterable<readonly ChatMessage[]>) {
  const messagesById = new Map<string, ChatMessage>();
  for (const messages of messageSets) {
    for (const message of messages) messagesById.set(message.id, message);
  }
  return [...messagesById.values()].sort(compareConversationMessageOrder);
}

export function isPendingIncomingCallMessage(message: ChatMessage) {
  return message.call?.direction === 'incoming' && message.call.status === 'ringing';
}

export function isTransferLedgerSourceMessage(message: ChatMessage) {
  return Boolean(message.transfer && !message.transfer.responseToMessageId && message.sender !== 'system');
}