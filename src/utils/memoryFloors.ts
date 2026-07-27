import type { ChatMessage } from '@/types/domain';

export function getMessageFloorMap(messages: ChatMessage[]) {
  const floorMap = new Map<string, number>();
  getConversationFloors(messages).forEach((floorMessages, index) => {
    floorMessages.forEach((message) => floorMap.set(message.id, index + 1));
  });
  return floorMap;
}

export function getConversationActiveMessages(messages: ChatMessage[]) {
  return messages.filter((message) => message.replyVariantState !== 'inactive');
}

function getMessageFloorGroupKey(message: ChatMessage) {
  if (message.sender === 'user') return `${message.mode}:user`;
  if (message.replyBatchId) return `${message.mode}:reply:${message.replyBatchId}`;
  return `${message.mode}:assistant`;
}

export function getConversationFloors(messages: ChatMessage[]) {
  const floors: ChatMessage[][] = [];
  let currentKey = '';
  let currentMessages: ChatMessage[] = [];

  for (const message of messages) {
    if (message.replyVariantState === 'inactive') continue;
    const nextKey = getMessageFloorGroupKey(message);
    if (currentMessages.length && nextKey !== currentKey) {
      floors.push(currentMessages);
      currentMessages = [];
    }
    currentKey = nextKey;
    currentMessages.push(message);
  }

  if (currentMessages.length) floors.push(currentMessages);
  return floors;
}

export function getConversationFloorCount(messages: ChatMessage[]) {
  return getConversationFloors(messages).length;
}

export function getMessagesInFloorRange(messages: ChatMessage[], startFloor: number, endFloor: number) {
  return getConversationFloors(messages)
    .slice(Math.max(0, startFloor - 1), Math.max(0, endFloor))
    .flat();
}