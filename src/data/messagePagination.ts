import type { ChatMessage } from '@/types/domain';

export interface ConversationMessageCursor {
  createdAt: number;
  id: string;
}

export interface ConversationMessagePage {
  messages: ChatMessage[];
  nextCursor: ConversationMessageCursor | null;
  hasMore: boolean;
}

export interface ConversationMessagePageOptions {
  before?: ConversationMessageCursor | null;
  limit?: number;
}

export const defaultConversationMessagePageSize = 80;
export const maximumConversationMessagePageSize = 200;

export function normalizeConversationMessagePageSize(value: number | undefined) {
  if (!Number.isFinite(value)) return defaultConversationMessagePageSize;
  return Math.min(maximumConversationMessagePageSize, Math.max(1, Math.floor(value ?? defaultConversationMessagePageSize)));
}

export function normalizeConversationMessageCursor(value: ConversationMessageCursor | null | undefined): ConversationMessageCursor | null {
  if (!value || !Number.isFinite(value.createdAt)) return null;
  const id = String(value.id ?? '').trim();
  return id ? { createdAt: value.createdAt, id } : null;
}

export function compareConversationMessageOrder(left: ChatMessage, right: ChatMessage) {
  const createdAtDifference = left.createdAt - right.createdAt;
  if (createdAtDifference) return createdAtDifference;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

export function createConversationMessageCursor(message: ChatMessage): ConversationMessageCursor {
  return { createdAt: message.createdAt, id: message.id };
}

export function isMessageBeforeConversationCursor(message: ChatMessage, cursor: ConversationMessageCursor) {
  return message.createdAt < cursor.createdAt
    || (message.createdAt === cursor.createdAt && message.id < cursor.id);
}

export function pageMessagesForConversation(messages: readonly ChatMessage[], conversationId: string, options: ConversationMessagePageOptions = {}): ConversationMessagePage {
  const before = normalizeConversationMessageCursor(options.before);
  const limit = normalizeConversationMessagePageSize(options.limit);
  const eligibleMessages = messages
    .filter((message) => message.conversationId === conversationId)
    .filter((message) => !before || isMessageBeforeConversationCursor(message, before))
    .sort(compareConversationMessageOrder);
  const hasMore = eligibleMessages.length > limit;
  const pageMessages = hasMore ? eligibleMessages.slice(-limit) : eligibleMessages;

  return {
    messages: pageMessages,
    hasMore,
    nextCursor: hasMore && pageMessages.length ? createConversationMessageCursor(pageMessages[0]) : null
  };
}