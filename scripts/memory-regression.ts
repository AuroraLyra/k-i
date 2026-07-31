import assert from 'node:assert/strict';
import type { ChatMessage } from '../src/types/domain.ts';
import type { MemoryAssertion, MemoryEpisode, MemoryExtractionResult, MemoryTheme } from '../src/types/memory.ts';
import { getConversationFloors, getRecentCompleteFloorMessages, resolveMemoryEpisodeFloorRange } from '../src/utils/memoryFloors.ts';
import { selectMemoryCaptureFloors } from '../src/utils/memoryCapture.ts';
import { createMemoryAssertionDedupeKey, createMemorySourceHash, integrateMemoryExtraction, isMemorySourceSnapshotCurrent, recallCharacterMemory, resolveMemoryEpisodeForgottenReason } from '../src/utils/memoryGraph.ts';
import { normalizeChatMemorySetting } from '../src/utils/memorySettings.ts';
import { extractCompleteJsonObject, normalizeNarrativeText } from '../src/utils/structuredText.ts';

function message(id: string, sender: ChatMessage['sender'], mode: ChatMessage['mode'], createdAt: number, extra: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    conversationId: 'conversation',
    sender,
    mode,
    content: id,
    createdAt,
    status: 'sent',
    ...extra
  };
}

const complete = extractCompleteJsonObject('```json\n{"text":"括号 } 与转义 \\\" 不应提前闭合","nested":{"ok":true}}\n```');
assert.ok(complete);
assert.deepEqual(JSON.parse(complete.json), { text: '括号 } 与转义 " 不应提前闭合', nested: { ok: true } });
assert.equal(extractCompleteJsonObject('{"narrative":"仍未结束"'), null);
assert.equal(extractCompleteJsonObject('{"nested":{"ok":true}'), null);

const longNarrative = `${'很长的正文。'.repeat(1_000)}\n\n最后一句必须保留。`;
const normalizedNarrative = normalizeNarrativeText(longNarrative);
assert.ok(normalizedNarrative.length > 5_000);
assert.ok(normalizedNarrative.endsWith('最后一句必须保留。'));

const mixedMessages = [
  message('u1', 'user', 'online', 1),
  message('u2', 'user', 'online', 2),
  message('c1', 'char', 'online', 3, { replyBatchId: 'batch-1' }),
  message('c2', 'char', 'online', 4, { replyBatchId: 'batch-1' }),
  message('u3', 'user', 'offline', 5),
  message('c3', 'char', 'offline', 6)
];
const mixedFloors = getConversationFloors(mixedMessages);
assert.deepEqual(mixedFloors.map((floor) => floor.map((item) => item.id)), [['u1', 'u2'], ['c1', 'c2'], ['u3'], ['c3']]);
assert.deepEqual(getRecentCompleteFloorMessages(mixedMessages, 3).map((item) => item.id), ['c1', 'c2', 'u3', 'c3']);
assert.deepEqual(getRecentCompleteFloorMessages(mixedMessages, 2).map((item) => item.id), ['u3', 'c3']);

const pendingTurn = getConversationFloors([
  message('u1', 'user', 'online', 1),
  message('c1', 'char', 'online', 2),
  message('u2', 'user', 'online', 3)
]).map((messages, index) => ({ floor: index + 1, messages }));
assert.equal(selectMemoryCaptureFloors(pendingTurn, 3).length, 0);
assert.equal(selectMemoryCaptureFloors(pendingTurn, 3, { force: true }).length, 3);
assert.equal(selectMemoryCaptureFloors(pendingTurn, 3, { segmentClosed: true }).length, 3);

const completedTurn = [...pendingTurn, { floor: 4, messages: [message('c2', 'char', 'online', 4)] }];
assert.equal(selectMemoryCaptureFloors(completedTurn, 3).length, 4);
assert.equal(selectMemoryCaptureFloors(completedTurn, 2).length, 2);
assert.deepEqual(resolveMemoryEpisodeFloorRange([32], 0, 32), { startFloor: 32, endFloor: 32 });
assert.deepEqual(resolveMemoryEpisodeFloorRange([], 0, 32), { startFloor: 1, endFloor: 32 });
assert.deepEqual(resolveMemoryEpisodeFloorRange([8, 9], 1, 2), { startFloor: 8, endFloor: 9 });
assert.equal(normalizeChatMemorySetting('captureEvery', undefined), 25);
assert.equal(normalizeChatMemorySetting('captureEvery', 200), 120);
assert.equal(normalizeChatMemorySetting('recentFloorLimit', undefined), 20);
assert.equal(normalizeChatMemorySetting('recentFloorLimit', 80), 80);
assert.equal(normalizeChatMemorySetting('recallTokenBudget', undefined), 5_000);
assert.equal(normalizeChatMemorySetting('recallTokenBudget', 7_500), 7_500);

const originalSource = [message('u1', 'user', 'online', 1, { location: { name: '公园', address: '湖边' } })];
const editedSource = [{ ...originalSource[0], editedAt: 2, content: '修改后的内容' }];
const offlineSource = [{ ...originalSource[0], mode: 'offline' as const }];
assert.notEqual(createMemorySourceHash(originalSource), createMemorySourceHash(editedSource));
assert.notEqual(createMemorySourceHash(originalSource), createMemorySourceHash(offlineSource));
assert.equal(isMemorySourceSnapshotCurrent(originalSource, originalSource), true);
assert.equal(isMemorySourceSnapshotCurrent(originalSource, editedSource), false);
assert.equal(isMemorySourceSnapshotCurrent(originalSource, []), false);
assert.equal(
  createMemorySourceHash([{ ...originalSource[0], image: { kind: 'photo', description: '湖边照片', url: 'https://one.invalid/a.jpg' } }]),
  createMemorySourceHash([{ ...originalSource[0], image: { kind: 'photo', description: '湖边照片', url: 'https://two.invalid/b.jpg' } }]),
);

const emptyExtraction = (narrative: string): MemoryExtractionResult => ({
  title: '公园散步',
  narrative,
  location: '',
  locations: [],
  emotion: '放松',
  valence: 0.5,
  arousal: 0.3,
  salience: 0.8,
  entities: [],
  assertions: [],
  themes: [],
  stateDeltas: []
});
const graphInput = {
  brainId: 'brain:character:user',
  characterId: 'character',
  characterName: '角色',
  userId: 'user',
  userName: '用户',
  conversationId: 'conversation',
  startFloor: 1,
  endFloor: 1,
  channel: 'online' as const,
  sourceMessages: [message('source-1', 'user', 'online', Date.now(), { content: '我们聊了公园散步。' })],
  episodes: [],
  entities: [],
  assertions: [],
  edges: [],
  themes: [],
  stateSnapshots: [],
  now: Date.now(),
  timeAwarenessEnabled: false
};
const firstGraph = integrateMemoryExtraction({ ...graphInput, extraction: emptyExtraction(`${'长日记内容。'.repeat(1_000)}\n\n最后一句保留。`) });
assert.ok(firstGraph.episode.narrative.length > 5_000);
assert.ok(firstGraph.episode.narrative.endsWith('最后一句保留。'));
const repeatedGraph = integrateMemoryExtraction({
  ...graphInput,
  episodes: [firstGraph.episode],
  entities: firstGraph.entities,
  assertions: firstGraph.assertions,
  edges: firstGraph.edges,
  themes: firstGraph.themes,
  stateSnapshots: firstGraph.stateSnapshots,
  existingEpisode: firstGraph.episode,
  extraction: emptyExtraction(firstGraph.episode.narrative)
});
assert.equal(repeatedGraph.assertions.length, 0);

const forgottenFallback = {
  ...firstGraph.assertions[0],
  status: 'forgotten' as const,
  forgottenDedupeKey: createMemoryAssertionDedupeKey(firstGraph.assertions[0])
};
const invalidatedEpisode = { ...firstGraph.episode, status: 'forgotten' as const, forgottenReason: 'source-invalidated' as const };
assert.equal(resolveMemoryEpisodeForgottenReason(invalidatedEpisode, new Set(['source-1'])), 'source-invalidated');
assert.equal(resolveMemoryEpisodeForgottenReason({ ...firstGraph.episode, status: 'forgotten' as const }, new Set(firstGraph.episode.sourceMessageIds)), 'user-request');
const forgottenReplay = integrateMemoryExtraction({
  ...graphInput,
  episodes: [firstGraph.episode],
  entities: firstGraph.entities,
  assertions: [forgottenFallback],
  edges: firstGraph.edges,
  themes: firstGraph.themes,
  stateSnapshots: firstGraph.stateSnapshots,
  existingEpisode: firstGraph.episode,
  extraction: {
    ...emptyExtraction(firstGraph.episode.narrative),
    assertions: [{
      subjectKey: 'self',
      predicate: '共同经历',
      objectText: firstGraph.episode.title,
      kind: 'interpretation',
      epistemicKind: 'observed',
      perspectiveText: firstGraph.episode.narrative,
      confidence: 0.8,
      importance: 0.8,
      emotionalWeight: 0.2,
      relationshipImpact: 0,
      evidenceMessageIds: ['source-1'],
      themes: []
    }]
  }
});
assert.equal(forgottenReplay.assertions.filter((assertion) => assertion.status !== 'forgotten').length, 0);
const sourceInvalidatedReplay = integrateMemoryExtraction({
  ...graphInput,
  episodes: [invalidatedEpisode],
  entities: firstGraph.entities,
  assertions: [{
    ...forgottenFallback,
    sourceEpisodeIds: [invalidatedEpisode.id]
  }],
  edges: firstGraph.edges,
  themes: firstGraph.themes,
  stateSnapshots: firstGraph.stateSnapshots,
  extraction: emptyExtraction(firstGraph.episode.narrative)
});
assert.ok(sourceInvalidatedReplay.assertions.some((assertion) => assertion.status !== 'forgotten'));
const forgottenEmptyReplay = integrateMemoryExtraction({
  ...graphInput,
  episodes: [firstGraph.episode],
  entities: firstGraph.entities,
  assertions: [forgottenFallback],
  edges: firstGraph.edges,
  themes: firstGraph.themes,
  stateSnapshots: firstGraph.stateSnapshots,
  existingEpisode: firstGraph.episode,
  extraction: emptyExtraction(firstGraph.episode.narrative)
});
assert.equal(forgottenEmptyReplay.assertions.length, 0);

const onlineLocationGraph = integrateMemoryExtraction({
  ...graphInput,
  sourceMessages: [message('location-online', 'user', 'online', Date.now(), { content: '我们今天聊天。', location: { name: '公园', address: '湖边', distance: '' } })],
  extraction: {
    ...emptyExtraction('线上聊到了一些事情。'),
    locations: [{ actor: 'shared-scene', source: 'offline-scene', label: '公园', evidenceMessageIds: ['location-online'], confidence: 0.9 }]
  }
});
assert.equal(onlineLocationGraph.episode.locations?.some((location) => location.actor === 'shared-scene'), false);
assert.equal(onlineLocationGraph.episode.locations?.some((location) => location.label === '公园'), true);

const offlineLocationGraph = integrateMemoryExtraction({
  ...graphInput,
  channel: 'offline',
  sourceMessages: [message('location-offline', 'user', 'offline', Date.now(), { content: '我们在公园散步。' })],
  extraction: {
    ...emptyExtraction('我们在公园散步。'),
    locations: [{ actor: 'shared-scene', source: 'offline-scene', label: '公园', evidenceMessageIds: ['location-offline'], confidence: 0.9 }]
  }
});
assert.equal(offlineLocationGraph.episode.locations?.some((location) => location.actor === 'shared-scene'), true);

const forgottenEpisode = { ...firstGraph.episode, status: 'forgotten' as const };
const recalledWithForgottenEpisode = recallCharacterMemory({
  brainId: graphInput.brainId,
  episodes: [forgottenEpisode],
  entities: firstGraph.entities,
  assertions: [{ ...firstGraph.assertions[0], status: 'current' as const, sourceEpisodeIds: [forgottenEpisode.id] }],
  edges: firstGraph.edges,
  themes: firstGraph.themes,
  stateSnapshots: [],
  query: '公园',
  now: Date.now(),
  timeAwarenessEnabled: true
});
assert.equal(recalledWithForgottenEpisode.items.length, 0);

const timedEpisode = { ...firstGraph.episode, status: 'active' as const, occurredAt: Date.now() - 2 * 86_400_000 };
const timedAssertion = { ...firstGraph.assertions[0], status: 'current' as const, sourceEpisodeIds: [timedEpisode.id], validFrom: timedEpisode.occurredAt };
const timedGraph = { brainId: graphInput.brainId, episodes: [timedEpisode], entities: firstGraph.entities, assertions: [timedAssertion], edges: firstGraph.edges, themes: firstGraph.themes, stateSnapshots: [] };
const awareContext = recallCharacterMemory({ ...timedGraph, query: '公园', now: Date.now(), timeAwarenessEnabled: true }).contextText;
const unawareContext = recallCharacterMemory({ ...timedGraph, query: '公园', now: Date.now(), timeAwarenessEnabled: false }).contextText;
assert.match(awareContext, /天前|今天|昨天/);
assert.doesNotMatch(unawareContext, /天前|今天|昨天/);

const unlimitedEpisodes: MemoryEpisode[] = Array.from({ length: 30 }, (_, index) => ({
  ...timedEpisode,
  id: `unlimited-episode-${index}`,
  sourceMessageIds: [`unlimited-message-${index}`],
  sourceHash: `unlimited-source-${index}`,
  title: `相关日记 ${index}`,
  narrative: `这是第 ${index} 段需要召回的相关日记。`,
  occurredAt: timedEpisode.occurredAt + index,
}));
const unlimitedAssertions: MemoryAssertion[] = unlimitedEpisodes.map((episode, index) => ({
  ...timedAssertion,
  id: `unlimited-assertion-${index}`,
  perspectiveText: `我记得共同暗号 ${index}。`,
  searchText: `共同暗号 ${index}`,
  sourceEpisodeIds: [episode.id],
  evidenceMessageIds: episode.sourceMessageIds,
  themeIds: [],
  pinned: true,
}));
const unlimitedRecall = recallCharacterMemory({
  brainId: graphInput.brainId,
  episodes: unlimitedEpisodes,
  entities: firstGraph.entities,
  assertions: unlimitedAssertions,
  edges: firstGraph.edges,
  themes: [],
  stateSnapshots: [],
  query: '共同暗号',
  maxTokens: 8_000,
  now: Date.now(),
  timeAwarenessEnabled: false,
});
assert.ok(unlimitedRecall.items.length > 24);
assert.ok(unlimitedRecall.episodes.length > 5);
assert.ok(unlimitedRecall.estimatedTokens <= 8_000);

const unlimitedThemeAssertions: MemoryAssertion[] = Array.from({ length: 40 }, (_, index) => ({
  ...timedAssertion,
  id: `unlimited-theme-assertion-${index}`,
  perspectiveText: `我记得主题线索 ${index}。`,
  searchText: `主题线索 ${index}`,
  sourceEpisodeIds: [],
  evidenceMessageIds: [`unlimited-theme-message-${index}`],
  themeIds: [`unlimited-theme-${Math.floor(index / 5)}`],
  pinned: true,
}));
const unlimitedThemes: MemoryTheme[] = Array.from({ length: 8 }, (_, index) => ({
  id: `unlimited-theme-${index}`,
  brainId: graphInput.brainId,
  name: `主题 ${index}`,
  description: '',
  entityIds: [],
  assertionIds: unlimitedThemeAssertions.slice(index * 5, index * 5 + 5).map((assertion) => assertion.id),
  episodeIds: [],
  report: `主题报告 ${index}`,
  reportAssertionCount: 5,
  reportUpdatedAt: Date.now() + index,
  createdAt: Date.now() + index,
  updatedAt: Date.now() + index,
}));
const unlimitedThemeRecall = recallCharacterMemory({
  brainId: graphInput.brainId,
  episodes: [],
  entities: firstGraph.entities,
  assertions: unlimitedThemeAssertions,
  edges: firstGraph.edges,
  themes: unlimitedThemes,
  stateSnapshots: [],
  query: '主题线索',
  maxTokens: 8_000,
  now: Date.now(),
  timeAwarenessEnabled: false,
});
assert.ok(unlimitedThemeRecall.themes.length > 6, JSON.stringify({
  itemCount: unlimitedThemeRecall.items.length,
  themeCount: unlimitedThemeRecall.themes.length,
  estimatedTokens: unlimitedThemeRecall.estimatedTokens,
  contextText: unlimitedThemeRecall.contextText,
}));

const balancedAssertions = unlimitedThemeAssertions.map((assertion, index) => ({
  ...assertion,
  sourceEpisodeIds: [unlimitedEpisodes[index % unlimitedEpisodes.length].id],
}));
const balancedRecall = recallCharacterMemory({
  brainId: graphInput.brainId,
  episodes: unlimitedEpisodes,
  entities: firstGraph.entities,
  assertions: balancedAssertions,
  edges: firstGraph.edges,
  themes: unlimitedThemes,
  stateSnapshots: [],
  query: '主题线索',
  maxTokens: 1_000,
  now: Date.now(),
  timeAwarenessEnabled: false,
});
assert.match(balancedRecall.contextText, /【长期记忆家族】/);
assert.match(balancedRecall.contextText, /【与当前话题有关的认知】/);
assert.match(balancedRecall.contextText, /【相关日记片段】/);
assert.ok(balancedRecall.estimatedTokens <= 1_000);

const tightThemeRecall = recallCharacterMemory({
  brainId: graphInput.brainId,
  episodes: [],
  entities: firstGraph.entities,
  assertions: unlimitedThemeAssertions,
  edges: firstGraph.edges,
  themes: unlimitedThemes,
  stateSnapshots: [],
  query: '主题线索',
  maxTokens: 300,
  now: Date.now(),
  timeAwarenessEnabled: false,
});
assert.ok(tightThemeRecall.themes.length > 0);
assert.ok(tightThemeRecall.items.length > 0);
assert.ok(tightThemeRecall.items.length < unlimitedThemeAssertions.length);

console.log('Memory regression checks passed.');