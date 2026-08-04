import assert from 'node:assert/strict';
import { maximumConversationMessagePageSize, normalizeConversationMessagePageSize, pageMessagesForConversation } from '../src/data/messagePagination.ts';
import { isPendingIncomingCallMessage, isTransferLedgerSourceMessage, mergeStartupMessageSets } from '../src/data/messageStartup.ts';
import type { ChatMessage } from '../src/types/domain.ts';

function message(id: string, conversationId: string, createdAt: number): ChatMessage {
  return {
    id,
    conversationId,
    sender: 'char',
    mode: 'online',
    content: id,
    createdAt,
    status: 'sent'
  };
}

const messages = [
  message('alpha-a', 'alpha', 1_000),
  message('alpha-b', 'alpha', 2_000),
  message('alpha-c', 'alpha', 2_000),
  message('alpha-d', 'alpha', 3_000),
  message('beta-a', 'beta', 9_000)
];

const latest = pageMessagesForConversation(messages, 'alpha', { limit: 2 });
assert.deepEqual(latest.messages.map((entry) => entry.id), ['alpha-c', 'alpha-d']);
assert.deepEqual(latest.nextCursor, { createdAt: 2_000, id: 'alpha-c' });
assert.equal(latest.hasMore, true);

const older = pageMessagesForConversation(messages, 'alpha', { limit: 2, before: latest.nextCursor });
assert.deepEqual(older.messages.map((entry) => entry.id), ['alpha-a', 'alpha-b']);
assert.equal(older.nextCursor, null);
assert.equal(older.hasMore, false);
assert.deepEqual([...older.messages, ...latest.messages].map((entry) => entry.id), ['alpha-a', 'alpha-b', 'alpha-c', 'alpha-d']);

const nonExistentCursor = pageMessagesForConversation(messages, 'alpha', { limit: 10, before: { createdAt: 2_000, id: 'alpha-bb' } });
assert.deepEqual(nonExistentCursor.messages.map((entry) => entry.id), ['alpha-a', 'alpha-b']);
assert.deepEqual(pageMessagesForConversation(messages, 'beta', { limit: 10 }).messages.map((entry) => entry.id), ['beta-a']);
assert.deepEqual(pageMessagesForConversation(messages, 'missing', { limit: 10 }).messages, []);
assert.equal(normalizeConversationMessagePageSize(0), 1);
assert.equal(normalizeConversationMessagePageSize(Number.POSITIVE_INFINITY), 80);
assert.equal(normalizeConversationMessagePageSize(maximumConversationMessagePageSize + 1), maximumConversationMessagePageSize);

const preview = message('preview', 'alpha', 4_000);
const ringingCall: ChatMessage = {
  ...message('ringing-call', 'beta', 3_000),
  call: {
    callId: 'call-1',
    direction: 'incoming',
    mode: 'voice',
    status: 'ringing',
    startedAt: 3_000
  }
};
const pendingTransfer: ChatMessage = {
  ...message('pending-transfer', 'gamma', 2_000),
  sender: 'user',
  transfer: { amount: '8.88', currency: 'CNY', status: 'pending' }
};
const transferResponse: ChatMessage = {
  ...message('transfer-response', 'gamma', 2_100),
  transfer: { amount: '8.88', currency: 'CNY', status: 'accepted', responseToMessageId: 'pending-transfer' }
};
const systemTransfer: ChatMessage = {
  ...message('system-transfer', 'gamma', 2_200),
  sender: 'system',
  transfer: { amount: '8.88', currency: 'CNY', status: 'accepted' }
};

assert.equal(isPendingIncomingCallMessage(ringingCall), true);
assert.equal(isPendingIncomingCallMessage(preview), false);
assert.equal(isTransferLedgerSourceMessage(pendingTransfer), true);
assert.equal(isTransferLedgerSourceMessage(transferResponse), false);
assert.equal(isTransferLedgerSourceMessage(systemTransfer), false);
assert.deepEqual(
  mergeStartupMessageSets([[preview, ringingCall], [pendingTransfer, preview]]).map((entry) => entry.id),
  ['pending-transfer', 'ringing-call', 'preview']
);

console.log('message pagination regression: passed');