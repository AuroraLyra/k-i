import type { ChatMessage } from '@/types/domain';

export function getCurrentUserTurnMessages(messages: ChatMessage[]) {
  const activeMessages = messages.filter((message) => message.replyVariantState !== 'inactive');
  let lastCharacterMessageIndex = -1;
  for (let index = activeMessages.length - 1; index >= 0; index -= 1) {
    if (activeMessages[index].sender !== 'char') continue;
    lastCharacterMessageIndex = index;
    break;
  }
  return activeMessages
    .slice(lastCharacterMessageIndex + 1)
    .filter((message) => message.sender === 'user');
}
