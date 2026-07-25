import type { ChatMessage } from '@/types/domain';
import type {
  MemoryAssertion,
  MemoryAssertionKind,
  MemoryEdge,
  MemoryEntity,
  MemoryEntityType,
  MemoryEmbeddingCache,
  MemoryEpisode,
  MemoryExtractionResult,
  MemoryRecallItem,
  MemoryRecallResult,
  MemoryStateFacet,
  MemoryStateKind,
  MemoryStateSnapshot,
  MemoryTheme,
} from '@/types/memory';

const DAY_MS = 86_400_000;
const SELF_KEYS = new Set(['self', 'character', 'ai', 'assistant', '角色', '我']);
const USER_KEYS = new Set(['user', 'human', '用户', '对方', '你']);

export interface MemoryGraphCollections {
  episodes: MemoryEpisode[];
  entities: MemoryEntity[];
  assertions: MemoryAssertion[];
  edges: MemoryEdge[];
  themes: MemoryTheme[];
  stateSnapshots: MemoryStateSnapshot[];
}

export interface IntegrateMemoryExtractionInput extends MemoryGraphCollections {
  brainId: string;
  characterId: string;
  characterName: string;
  userId: string;
  userName: string;
  conversationId: string;
  startFloor: number;
  endFloor: number;
  channel: MemoryEpisode['channel'];
  sourceMessages: ChatMessage[];
  extraction: MemoryExtractionResult;
  existingEpisode?: MemoryEpisode;
  now?: number;
}

export interface MemoryGraphUpserts {
  episode: MemoryEpisode;
  entities: MemoryEntity[];
  assertions: MemoryAssertion[];
  edges: MemoryEdge[];
  themes: MemoryTheme[];
  stateSnapshots: MemoryStateSnapshot[];
}

export interface RecallCharacterMemoryInput extends MemoryGraphCollections {
  brainId: string;
  query: string;
  limit?: number;
  maxTokens?: number;
  now?: number;
  embeddings?: MemoryEmbeddingCache[];
  queryVector?: number[];
}

export function createMemoryBrainId(characterId: string, userId: string): string {
  return `brain:${characterId}:${userId}`;
}

export function memoryId(prefix: string): string {
  const randomPart = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${randomPart}`;
}

export function normalizeMemoryName(value: string): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();
}

export function hashMemoryText(value: string): string {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function estimateMemoryTokens(value: string): number {
  const text = String(value ?? '');
  const cjkCount = (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []).length;
  const otherCount = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\s]/gu, '').length;
  return cjkCount + Math.ceil(otherCount / 4);
}

export function integrateMemoryExtraction(input: IntegrateMemoryExtractionInput): MemoryGraphUpserts {
  const now = input.now ?? Date.now();
  const existingEpisode = input.existingEpisode?.brainId === input.brainId ? input.existingEpisode : undefined;
  const sourceMessages = input.sourceMessages;
  const sourceMessageIds = sourceMessages.map((message) => message.id);
  const sourceHash = hashMemoryText(sourceMessages.map((message) => `${message.id}:${message.content}`).join('\n'));
  const occurredAt = sourceMessages.length
    ? Math.min(...sourceMessages.map((message) => Number(message.createdAt) || now))
    : now;
  const entityUpserts: MemoryEntity[] = [];
  const assertionUpserts: MemoryAssertion[] = [];
  const edgeUpserts: MemoryEdge[] = [];
  const themeUpserts: MemoryTheme[] = [];
  const stateUpserts: MemoryStateSnapshot[] = [];
  const scopedEntities = input.entities.filter((entity) => entity.brainId === input.brainId);
  const entityById = new Map(scopedEntities.map((entity) => [entity.id, entity]));
  const entityByName = new Map<string, MemoryEntity>();
  for (const entity of scopedEntities) {
    entityByName.set(entity.normalizedName, entity);
    entity.aliases.forEach((alias) => entityByName.set(normalizeMemoryName(alias), entity));
  }

  const entityByDraftKey = new Map<string, MemoryEntity>();
  const selfEntity = ensureEntity('character', input.characterName, 'character', now, ['我', '角色']);
  const userEntity = ensureEntity('user', input.userName, 'user', now, ['用户', '对方']);
  entityByDraftKey.set('self', selfEntity);
  entityByDraftKey.set('character', selfEntity);
  entityByDraftKey.set('ai', selfEntity);
  entityByDraftKey.set('user', userEntity);
  entityByDraftKey.set('human', userEntity);

  for (const draft of input.extraction.entities ?? []) {
    const entity = ensureEntity(draft.key, draft.name, draft.type, now, draft.aliases, draft.description);
    entityByDraftKey.set(normalizeMemoryName(draft.key), entity);
  }

  const episode: MemoryEpisode = {
    id: existingEpisode?.id ?? memoryId('episode'),
    brainId: input.brainId,
    characterId: input.characterId,
    userId: input.userId,
    conversationId: input.conversationId,
    channel: input.channel,
    status: 'active',
    sourceMessageIds,
    sourceHash,
    startFloor: Math.max(1, Math.round(input.startFloor) || 1),
    endFloor: Math.max(Math.max(1, Math.round(input.startFloor) || 1), Math.round(input.endFloor) || 1),
    sourceTokenEstimate: estimateMemoryTokens(sourceMessages.map((message) => String(message.content ?? '')).join('\n')),
    title: cleanText(input.extraction.title, 80) || '一段共同经历',
    narrative: cleanText(input.extraction.narrative, 1_800) || '我记得我们有过一段交流。',
    location: cleanText(input.extraction.location, 80),
    emotion: cleanText(input.extraction.emotion, 80),
    valence: clamp(input.extraction.valence, -1, 1),
    arousal: clamp(input.extraction.arousal, 0, 1),
    salience: clamp(input.extraction.salience, 0, 1),
    participantEntityIds: [],
    themeIds: [],
    occurredAt,
    occurredEndAt: sourceMessages.length
      ? Math.max(...sourceMessages.map((message) => Number(message.createdAt) || occurredAt))
      : occurredAt,
    learnedAt: existingEpisode?.learnedAt ?? now,
    createdAt: existingEpisode?.createdAt ?? now,
    updatedAt: now,
  };

  const validEvidenceIds = new Set(sourceMessageIds);
  const currentAssertions = input.assertions.filter((assertion) => assertion.brainId === input.brainId && (assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed'));
  const assertionById = new Map(input.assertions.filter((item) => item.brainId === input.brainId).map((item) => [item.id, item]));
  const themeByName = new Map(
    input.themes
      .filter((theme) => theme.brainId === input.brainId)
      .map((theme) => [normalizeMemoryName(theme.name), theme]),
  );
  const touchedThemes = new Map<string, MemoryTheme>();

  for (const draft of input.extraction.assertions ?? []) {
    const subject = resolveDraftEntity(draft.subjectKey) ?? selfEntity;
    const objectEntity = draft.objectKey ? resolveDraftEntity(draft.objectKey) : undefined;
    const objectText = cleanText(draft.objectText || objectEntity?.name || '', 240);
    const predicate = cleanText(draft.predicate, 80);
    const perspectiveText = cleanText(draft.perspectiveText, 520);
    if (!predicate || !objectText || !perspectiveText) continue;
    const evidenceMessageIds = (draft.evidenceMessageIds ?? []).filter((id) => validEvidenceIds.has(id));
    if (!evidenceMessageIds.length && sourceMessageIds.length) continue;
    const assertionThemeIds = (draft.themes ?? [])
      .map((name) => ensureTheme(name))
      .filter((theme): theme is MemoryTheme => Boolean(theme))
      .map((theme) => theme.id);
    const objectValue = objectEntity?.id || objectText;
    const dedupeKey = assertionDedupeKey(subject.id, predicate, objectValue, draft.kind);
    const existing = currentAssertions.find((item) => assertionDedupeKey(item.subjectEntityId, item.predicate, item.objectEntityId || item.objectText, item.kind) === dedupeKey);
    let assertion: MemoryAssertion;
    if (existing) {
      assertion = {
        ...existing,
        perspectiveText,
        confidence: Math.max(existing.confidence, clamp(draft.confidence, 0, 1)),
        importance: Math.max(existing.importance, clamp(draft.importance, 0, 1)),
        emotionalWeight: Math.max(existing.emotionalWeight, clamp(draft.emotionalWeight, 0, 1)),
        relationshipImpact: clamp((existing.relationshipImpact + clamp(draft.relationshipImpact, -1, 1)) / 2, -1, 1),
        evidenceMessageIds: unique([...existing.evidenceMessageIds, ...evidenceMessageIds]),
        sourceEpisodeIds: unique([...existing.sourceEpisodeIds, episode.id]),
        themeIds: unique([...existing.themeIds, ...assertionThemeIds]),
        searchText: buildAssertionSearchText(subject.name, predicate, objectText, perspectiveText),
        dueAt: finiteTime(draft.dueAt) ?? existing.dueAt,
        updatedAt: now,
      };
    } else {
      assertion = {
        id: memoryId('assertion'),
        brainId: input.brainId,
        subjectEntityId: subject.id,
        predicate,
        objectEntityId: objectEntity?.id,
        objectText,
        kind: draft.kind,
        status: draft.kind === 'promise' || draft.kind === 'open-loop' ? 'open' : 'current',
        epistemicKind: draft.epistemicKind,
        perspectiveText,
        confidence: clamp(draft.confidence, 0, 1),
        importance: clamp(draft.importance, 0, 1),
        emotionalWeight: clamp(draft.emotionalWeight, 0, 1),
        relationshipImpact: clamp(draft.relationshipImpact, -1, 1),
        evidenceMessageIds,
        sourceEpisodeIds: [episode.id],
        themeIds: assertionThemeIds,
        searchText: buildAssertionSearchText(subject.name, predicate, objectText, perspectiveText),
        validFrom: finiteTime(draft.validFrom) ?? occurredAt,
        validTo: finiteTime(draft.validTo),
        dueAt: finiteTime(draft.dueAt),
        learnedAt: now,
        createdAt: now,
        updatedAt: now,
        recallCount: 0,
        pinned: false,
        accessibility: Math.max(0.25, clamp(draft.importance, 0, 1)),
      };
    }
    assertionUpserts.push(assertion);
    edgeUpserts.push(createEdge(input.brainId, episode.id, assertion.id, 'supports', now, assertion.confidence));
    edgeUpserts.push(createEdge(input.brainId, subject.id, assertion.id, 'related-to', now, assertion.confidence));
    if (objectEntity) edgeUpserts.push(createEdge(input.brainId, assertion.id, objectEntity.id, 'related-to', now, assertion.confidence));
    for (const themeId of assertionThemeIds) {
      const theme = touchedThemes.get(themeId) ?? themeUpserts.find((item) => item.id === themeId) ?? input.themes.find((item) => item.id === themeId);
      if (theme) touchedThemes.set(themeId, {
        ...theme,
        entityIds: unique([...theme.entityIds, subject.id, ...(objectEntity ? [objectEntity.id] : [])]),
        assertionIds: unique([...theme.assertionIds, assertion.id]),
        episodeIds: unique([...theme.episodeIds, episode.id]),
        updatedAt: now,
      });
      edgeUpserts.push(createEdge(input.brainId, themeId, assertion.id, 'contains', now, assertion.confidence));
    }
    for (const supersededId of draft.supersedesAssertionIds ?? []) {
      const previous = assertionById.get(supersededId);
      if (!previous || previous.status !== 'current') continue;
      assertionUpserts.push({ ...previous, status: 'superseded', supersededById: assertion.id, validTo: finiteTime(draft.validFrom) ?? occurredAt, updatedAt: now });
      edgeUpserts.push(createEdge(input.brainId, assertion.id, previous.id, 'supersedes', now, assertion.confidence));
    }
    for (const contradictedId of draft.contradictsAssertionIds ?? []) {
      const previous = assertionById.get(contradictedId);
      if (!previous) continue;
      const alreadyUpdated = assertionUpserts.find((item) => item.id === previous.id);
      assertionUpserts.push({ ...(alreadyUpdated ?? previous), status: 'disputed', updatedAt: now });
      edgeUpserts.push(createEdge(input.brainId, assertion.id, previous.id, 'contradicts', now, assertion.confidence));
    }
  }

  for (const name of input.extraction.themes ?? []) ensureTheme(name);
  for (const entity of entityUpserts) {
    if (entity.id === selfEntity.id || entity.id === userEntity.id || (input.extraction.entities ?? []).some((draft) => normalizeMemoryName(draft.name) === entity.normalizedName)) {
      episode.participantEntityIds.push(entity.id);
      edgeUpserts.push(createEdge(input.brainId, episode.id, entity.id, 'mentions', now, 0.8));
    }
  }
  episode.participantEntityIds = unique(episode.participantEntityIds);
  episode.themeIds = unique([...touchedThemes.keys(), ...themeUpserts.map((theme) => theme.id)]);
  const touchedThemeList = [...touchedThemes.values()].map((theme) => ({
    ...theme,
    episodeIds: unique([...theme.episodeIds, episode.id]),
  }));
  themeUpserts.push(...refreshMemoryThemeReports(
    touchedThemeList,
    [...input.assertions, ...assertionUpserts],
    touchedThemeList.map((theme) => theme.id),
    now,
    episode.narrative,
  ));
  stateUpserts.push(...reduceMemoryStates(input, episode, assertionUpserts, now));

  return {
    episode,
    entities: dedupeById(entityUpserts),
    assertions: dedupeById(assertionUpserts),
    edges: dedupeEdges(edgeUpserts, input.edges),
    themes: dedupeById(themeUpserts),
    stateSnapshots: stateUpserts,
  };

  function ensureEntity(
    key: string,
    name: string,
    type: MemoryEntityType,
    timestamp: number,
    aliases: string[] = [],
    description = '',
  ): MemoryEntity {
    const normalizedName = normalizeMemoryName(name || key);
    const specialId = type === 'character'
      ? `${input.brainId}:self`
      : type === 'user'
        ? `${input.brainId}:user`
        : '';
    const existing = (specialId ? entityById.get(specialId) : undefined) ?? entityByName.get(normalizedName);
    const mergedAliases = unique([...(existing?.aliases ?? []), ...aliases.map((alias) => cleanText(alias, 80)).filter(Boolean)]);
    const entity: MemoryEntity = existing
      ? {
          ...existing,
          type,
          name: cleanText(name || key, 80),
          normalizedName,
          aliases: mergedAliases,
          description: cleanText(description, 400) || existing.description,
          updatedAt: timestamp,
        }
      : {
          id: specialId || memoryId('entity'),
          brainId: input.brainId,
          type,
          name: cleanText(name || key, 80),
          normalizedName,
          aliases: mergedAliases,
          description: cleanText(description, 400),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
    entityById.set(entity.id, entity);
    entityByName.set(entity.normalizedName, entity);
    entity.aliases.forEach((alias) => entityByName.set(normalizeMemoryName(alias), entity));
    entityByDraftKey.set?.(normalizeMemoryName(key), entity);
    entityUpserts.push(entity);
    return entity;
  }

  function resolveDraftEntity(key: string): MemoryEntity | undefined {
    const normalized = normalizeMemoryName(key);
    if (SELF_KEYS.has(normalized)) return selfEntity;
    if (USER_KEYS.has(normalized)) return userEntity;
    return entityByDraftKey.get(normalized) ?? entityByName.get(normalized);
  }

  function ensureTheme(rawName: string): MemoryTheme | undefined {
    const name = cleanText(rawName, 60);
    const normalized = normalizeMemoryName(name);
    if (!normalized) return undefined;
    const existing = touchedThemes.get(themeByName.get(normalized)?.id ?? '') ?? themeByName.get(normalized);
    const theme: MemoryTheme = existing
      ? { ...existing, updatedAt: now }
      : {
          id: memoryId('theme'),
          brainId: input.brainId,
          name,
          description: '',
          entityIds: [],
          assertionIds: [],
          episodeIds: [episode.id],
          report: '',
          reportAssertionCount: 0,
          reportUpdatedAt: 0,
          createdAt: now,
          updatedAt: now,
        };
    themeByName.set(normalized, theme);
    touchedThemes.set(theme.id, theme);
    return theme;
  }
}

function reduceMemoryStates(
  input: IntegrateMemoryExtractionInput,
  episode: MemoryEpisode,
  assertionUpserts: MemoryAssertion[],
  now: number,
): MemoryStateSnapshot[] {
  const upserts: MemoryStateSnapshot[] = [];
  const evidenceAssertionIds = unique(assertionUpserts
    .filter((assertion) => assertion.sourceEpisodeIds.includes(episode.id) && (assertion.status === 'current' || assertion.status === 'open'))
    .map((assertion) => assertion.id));
  const deltasByKind = new Map<MemoryStateKind, MemoryExtractionResult['stateDeltas']>();
  for (const delta of input.extraction.stateDeltas ?? []) {
    const collection = deltasByKind.get(delta.kind) ?? [];
    collection.push(delta);
    deltasByKind.set(delta.kind, collection);
  }
  for (const [kind, deltas] of deltasByKind.entries()) {
    const previous = input.stateSnapshots
      .filter((snapshot) => snapshot.brainId === input.brainId && snapshot.kind === kind)
      .sort((left, right) => right.createdAt - left.createdAt)[0];
    const alpha = stateLearningRate(kind);
    const facets = new Map((previous?.facets ?? []).map((facet) => [normalizeMemoryName(facet.key), facet]));
    for (const delta of deltas) {
      for (const facetDelta of delta.facets ?? []) {
        const key = normalizeMemoryName(facetDelta.key);
        if (!key) continue;
        const previousFacet = facets.get(key);
        const baseline = previousFacet?.value ?? (kind === 'mood' ? 0 : 0.5);
        const change = clamp(facetDelta.delta, -1, 1) * alpha * clamp(delta.confidence, 0, 1);
        const nextValue = clamp(baseline + change, kind === 'mood' ? -1 : 0, 1);
        const trend: MemoryStateFacet['trend'] = nextValue > baseline + 0.02 ? 'up' : nextValue < baseline - 0.02 ? 'down' : 'stable';
        facets.set(key, {
          key: cleanText(facetDelta.key, 60),
          label: cleanText(facetDelta.label, 60) || cleanText(facetDelta.key, 60),
          value: nextValue,
          trend,
          evidenceAssertionIds: unique([...(previousFacet?.evidenceAssertionIds ?? []), ...evidenceAssertionIds]),
        });
      }
    }
    const summary = deltas.map((delta) => cleanText(delta.summary, 240)).filter(Boolean).join('；');
    upserts.push({
      id: memoryId('state'),
      brainId: input.brainId,
      kind,
      summary: summary || previous?.summary || '',
      facets: [...facets.values()],
      sourceAssertionIds: evidenceAssertionIds,
      sourceEpisodeIds: [episode.id],
      previousSnapshotId: previous?.id,
      createdAt: now,
    });
  }
  return upserts;
}

function stateLearningRate(kind: MemoryStateKind): number {
  if (kind === 'mood') return 0.62;
  if (kind === 'current-context') return 0.5;
  if (kind === 'relationship' || kind === 'user-impression') return 0.2;
  return 0.1;
}

export function recallCharacterMemory(input: RecallCharacterMemoryInput): MemoryRecallResult {
  const now = input.now ?? Date.now();
  const limit = Math.min(24, Math.max(4, input.limit ?? 12));
  const budgetTokens = Math.min(2_400, Math.max(300, Math.round(input.maxTokens ?? 900)));
  const query = cleanText(input.query, 1_000);
  const scopedAssertions = input.assertions.filter(
    (item) => item.brainId === input.brainId && (item.status === 'current' || item.status === 'open' || item.status === 'disputed'),
  );
  const scopedEntities = input.entities.filter((item) => item.brainId === input.brainId);
  const scopedEdges = input.edges.filter((item) => item.brainId === input.brainId);
  const entityById = new Map(scopedEntities.map((item) => [item.id, item]));
  const matchingEntityIds = new Set(
    scopedEntities
      .filter((entity) => {
        const terms = [entity.name, ...entity.aliases].map(normalizeMemoryName).filter(Boolean);
        const normalizedQuery = normalizeMemoryName(query);
        return terms.some((term) => normalizedQuery.includes(term));
      })
      .map((entity) => entity.id),
  );
  const graphDistance = calculateGraphDistances(matchingEntityIds, scopedEdges, 3);
  const queryVector = lexicalVector(query);
  const embeddingByOwnerId = new Map(
    (input.embeddings ?? [])
      .filter((embedding) => embedding.brainId === input.brainId && embedding.ownerType === 'assertion')
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((embedding) => [embedding.ownerId, embedding]),
  );
  const items = scopedAssertions.map((assertion) => {
    const lexicalScore = cosine(queryVector, lexicalVector(assertion.searchText || assertion.perspectiveText));
    const cachedEmbedding = embeddingByOwnerId.get(assertion.id);
    const remoteScore = input.queryVector?.length && cachedEmbedding?.vector.length === input.queryVector.length
      ? vectorCosine(input.queryVector, cachedEmbedding.vector)
      : 0;
    const semanticScore = remoteScore ? remoteScore * 0.72 + lexicalScore * 0.28 : lexicalScore;
    const keywordScore = tokenOverlap(query, assertion.searchText || assertion.perspectiveText);
    const subjectDistance = graphDistance.get(assertion.subjectEntityId);
    const objectDistance = assertion.objectEntityId ? graphDistance.get(assertion.objectEntityId) : undefined;
    const nearestDistance = Math.min(subjectDistance ?? 99, objectDistance ?? 99);
    const graphScore = nearestDistance < 99 ? 1 / (nearestDistance + 1) : 0;
    const daysSinceLearned = Math.max(0, now - assertion.learnedAt) / DAY_MS;
    const halfLife = 10 + assertion.importance * 220 + Math.log2(assertion.recallCount + 1) * 18;
    const retention = assertion.pinned ? 1 : Math.exp((-Math.LN2 * daysSinceLearned) / halfLife);
    const accessibility = assertion.pinned ? 1 : clamp(assertion.accessibility, 0, 1);
    const statusWeight = assertion.status === 'current' ? 1 : assertion.status === 'disputed' ? 0.62 : 0.34;
    const openWeight = assertion.status === 'open' || assertion.kind === 'promise' || assertion.kind === 'open-loop' ? 1 : 0;
    const score = statusWeight * (
      semanticScore * 0.3
      + keywordScore * 0.18
      + graphScore * 0.14
      + retention * 0.12
      + accessibility * 0.08
      + assertion.importance * 0.12
      + assertion.emotionalWeight * 0.07
      + Math.max(0, assertion.relationshipImpact) * 0.04
      + openWeight * 0.03
      + (assertion.pinned ? 0.2 : 0)
    );
    return {
      assertion,
      score,
      reasons: recallReasons({ semanticScore, keywordScore, graphScore, retention, openWeight, pinned: assertion.pinned }),
    } satisfies MemoryRecallItem;
  });

  const sorted = items
    .filter((item) => item.score > (query ? 0.08 : 0.16) || item.assertion.pinned)
    .sort((left, right) => right.score - left.score);
  const selected: MemoryRecallItem[] = [];
  const themeCounts = new Map<string, number>();
  for (const item of sorted) {
    const primaryTheme = item.assertion.themeIds[0] ?? 'unthemed';
    const count = themeCounts.get(primaryTheme) ?? 0;
    if (count >= 4 && selected.length >= Math.ceil(limit / 2)) continue;
    selected.push(item);
    themeCounts.set(primaryTheme, count + 1);
    if (selected.length >= limit) break;
  }

  const selectedEpisodeIds = unique(selected.flatMap((item) => item.assertion.sourceEpisodeIds));
  const selectedEpisodes = input.episodes
    .filter((episode) => episode.brainId === input.brainId && selectedEpisodeIds.includes(episode.id) && episode.status === 'active')
    .sort((left, right) => right.occurredAt - left.occurredAt)
    .slice(0, 5);
  const latestStates = latestMemoryStates(input.stateSnapshots.filter((item) => item.brainId === input.brainId));
  const activeThemeIds = unique(selected.flatMap((item) => item.assertion.themeIds));
  const selectedThemes = input.themes
    .filter((theme) => theme.brainId === input.brainId && activeThemeIds.includes(theme.id))
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, 6);
  const formatted = formatMemoryContext(selected, selectedEpisodes, selectedThemes, latestStates, entityById, now, budgetTokens);
  const includedItemIds = new Set(formatted.itemIds);
  const includedEpisodeIds = new Set(formatted.episodeIds);
  const includedThemeIds = new Set(formatted.themeIds);
  const includedStateIds = new Set(formatted.stateIds);
  return {
    items: selected.filter((item) => includedItemIds.has(item.assertion.id)),
    episodes: selectedEpisodes.filter((episode) => includedEpisodeIds.has(episode.id)),
    themes: selectedThemes.filter((theme) => includedThemeIds.has(theme.id)),
    states: latestStates.filter((state) => includedStateIds.has(state.id)),
    contextText: formatted.contextText,
    estimatedTokens: estimateMemoryTokens(formatted.contextText),
    budgetTokens,
  };
}

export function createRecallUpserts(items: MemoryRecallItem[], now = Date.now()): MemoryAssertion[] {
  return items.map(({ assertion }) => ({
    ...assertion,
    recallCount: assertion.recallCount + 1,
    lastRecalledAt: now,
    accessibility: clamp(assertion.accessibility + 0.04, 0, 1),
    updatedAt: now,
  }));
}

export function latestMemoryStates(snapshots: MemoryStateSnapshot[]): MemoryStateSnapshot[] {
  const latest = new Map<MemoryStateKind, MemoryStateSnapshot>();
  for (const snapshot of snapshots) {
    const current = latest.get(snapshot.kind);
    if (!current || current.createdAt < snapshot.createdAt) latest.set(snapshot.kind, snapshot);
  }
  return [...latest.values()].sort((left, right) => left.kind.localeCompare(right.kind));
}

export function refreshMemoryThemeReports(
  themes: MemoryTheme[],
  assertions: MemoryAssertion[],
  themeIds: string[],
  now = Date.now(),
  fallbackReport = '',
): MemoryTheme[] {
  const targetIds = new Set(themeIds);
  const assertionById = new Map(assertions.map((assertion) => [assertion.id, assertion]));
  return themes
    .filter((theme) => targetIds.has(theme.id))
    .map((theme) => {
      const activeAssertions = theme.assertionIds
        .map((assertionId) => assertionById.get(assertionId))
        .filter((assertion): assertion is MemoryAssertion => assertion !== undefined && (assertion.status === 'current' || assertion.status === 'open' || assertion.status === 'disputed'))
        .sort((left, right) => right.updatedAt - left.updatedAt);
      const report = cleanText(activeAssertions
        .slice(0, 6)
        .map((assertion) => assertion.perspectiveText)
        .join('；') || fallbackReport, 900);
      return { ...theme, report, reportAssertionCount: Math.max(0, Number(theme.reportAssertionCount) || 0), reportUpdatedAt: now, updatedAt: now };
    });
}

export function fadeMemoryAccessibility(assertion: MemoryAssertion, now = Date.now()): MemoryAssertion {
  if (assertion.pinned || assertion.status === 'forgotten') return assertion;
  const elapsedDays = Math.max(0, now - assertion.updatedAt) / DAY_MS;
  if (elapsedDays < 1) return assertion;
  const floor = 0.04 + assertion.importance * 0.32;
  const rate = 0.006 + (1 - assertion.importance) * 0.018;
  const accessibility = Math.max(floor, assertion.accessibility * Math.exp(-rate * elapsedDays));
  return Math.abs(accessibility - assertion.accessibility) < 0.002
    ? assertion
    : { ...assertion, accessibility, updatedAt: now };
}

function formatMemoryContext(
  items: MemoryRecallItem[],
  episodes: MemoryEpisode[],
  themes: MemoryTheme[],
  states: MemoryStateSnapshot[],
  entityById: Map<string, MemoryEntity>,
  now: number,
  maxTokens: number,
): {
  contextText: string;
  itemIds: string[];
  episodeIds: string[];
  themeIds: string[];
  stateIds: string[];
} {
  if (!items.length && !states.length) {
    return { contextText: '', itemIds: [], episodeIds: [], themeIds: [], stateIds: [] };
  }
  const intro = '这是我从已归档旧楼层中召回的角色主观记忆。它可能过时或有争议；推测不能当成事实。';
  const closing = '使用规则：只让记忆自然影响当前回应，不逐条复述；新证据优先，冲突时修正认知；不要补写没有证据的内容。';
  let contextText = intro;
  const itemIds: string[] = [];
  const episodeIds: string[] = [];
  const themeIds: string[] = [];
  const stateIds: string[] = [];
  const reservedTokens = estimateMemoryTokens(`\n\n${closing}`);

  const appendSection = (
    title: string,
    entries: Array<{ id: string; text: string }>,
    includedIds: string[],
  ) => {
    let section = '';
    for (const entry of entries) {
      const prefix = section ? '\n' : `\n\n【${title}】\n`;
      const availableTokens = maxTokens - reservedTokens - estimateMemoryTokens(contextText + section + prefix);
      if (availableTokens < 18) break;
      const line = truncateToMemoryTokenBudget(`- ${entry.text}`, availableTokens);
      if (!line || estimateMemoryTokens(line) > availableTokens) continue;
      section += `${prefix}${line}`;
      includedIds.push(entry.id);
    }
    contextText += section;
  };

  const statePriority: Record<MemoryStateKind, number> = {
    relationship: 0,
    'user-impression': 1,
    'adaptive-personality': 2,
    'current-context': 3,
    mood: 4,
  };
  appendSection(
    '此刻的关系与状态',
    states
      .filter((state) => state.summary)
      .sort((left, right) => statePriority[left.kind] - statePriority[right.kind])
      .map((state) => ({ id: state.id, text: `${stateKindLabel(state.kind)}：${cleanText(state.summary, 180)}` })),
    stateIds,
  );

  appendSection(
    '长期记忆家族',
    themes
      .filter((theme) => theme.report && (Number(theme.reportAssertionCount) || 0) >= 5)
      .slice(0, 3)
      .map((theme) => ({ id: theme.id, text: `${cleanText(theme.name, 80)}：${cleanText(theme.report, 320)}` })),
    themeIds,
  );

  const includedConsolidatedThemeIds = new Set(themeIds);
  const assertionsCoveredByThemes = items.filter(({ assertion }) =>
    !assertion.pinned
    && assertion.status !== 'open'
    && assertion.status !== 'disputed'
    && assertion.themeIds.some((themeId) => includedConsolidatedThemeIds.has(themeId))
  );
  itemIds.push(...assertionsCoveredByThemes.map(({ assertion }) => assertion.id));
  const directItems = items.filter(({ assertion }) => !assertionsCoveredByThemes.some((item) => item.assertion.id === assertion.id));
  appendSection(
    '与当前话题有关的认知',
    directItems.map(({ assertion }) => {
      const subject = entityById.get(assertion.subjectEntityId)?.name || '这件事';
      const certainty = assertion.epistemicKind === 'inferred'
        ? '推测'
        : assertion.epistemicKind === 'hearsay'
          ? '转述'
          : assertion.epistemicKind === 'canon'
            ? '设定'
            : assertion.epistemicKind === 'observed'
              ? '观察'
              : '亲口得知';
      const disputed = assertion.status === 'disputed' ? '；有矛盾' : '';
      return {
        id: assertion.id,
        text: `${cleanText(assertion.perspectiveText, 220)}（${subject}；${certainty}；${relativeTime(assertion.validFrom, now)}${disputed}；确信${Math.round(assertion.confidence * 100)}%）`,
      };
    }),
    itemIds,
  );

  const includedRecallText = [
    ...themes.filter((theme) => themeIds.includes(theme.id)).map((theme) => theme.report),
    ...directItems.filter((item) => itemIds.includes(item.assertion.id)).map((item) => item.assertion.perspectiveText),
  ].join('；');
  appendSection(
    '相关日记片段',
    episodes
      .filter((episode) => !includedRecallText || episode.salience >= 0.85 || tokenOverlap(episode.narrative, includedRecallText) < 0.68)
      .slice(0, 2)
      .map((episode) => ({
        id: episode.id,
        text: `${relativeTime(episode.occurredAt, now)}，${cleanText(episode.title, 80)}：${cleanText(episode.narrative, 320)}`,
      })),
    episodeIds,
  );

  const closingPrefix = '\n\n';
  const closingBudget = maxTokens - estimateMemoryTokens(contextText + closingPrefix);
  if (closingBudget > 0) contextText += `${closingPrefix}${truncateToMemoryTokenBudget(closing, closingBudget)}`;
  contextText = truncateToMemoryTokenBudget(contextText, maxTokens);
  return { contextText, itemIds, episodeIds, themeIds, stateIds };
}

function truncateToMemoryTokenBudget(value: string, maxTokens: number): string {
  const text = String(value ?? '').trim();
  if (!text || maxTokens <= 0) return '';
  if (estimateMemoryTokens(text) <= maxTokens) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${text.slice(0, middle).trimEnd()}…`;
    if (estimateMemoryTokens(candidate) <= maxTokens) low = middle;
    else high = middle - 1;
  }
  return low > 0 ? `${text.slice(0, low).trimEnd()}…` : '';
}

function calculateGraphDistances(seedIds: Set<string>, edges: MemoryEdge[], maxDepth: number): Map<string, number> {
  const distances = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromId, [...(adjacency.get(edge.fromId) ?? []), edge.toId]);
    adjacency.set(edge.toId, [...(adjacency.get(edge.toId) ?? []), edge.fromId]);
  }
  let frontier = [...seedIds];
  frontier.forEach((id) => distances.set(id, 0));
  for (let depth = 1; depth <= maxDepth && frontier.length; depth += 1) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbor of adjacency.get(id) ?? []) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, depth);
        next.push(neighbor);
      }
    }
    frontier = next;
  }
  return distances;
}

function lexicalVector(text: string, dimensions = 192): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  for (const token of memoryTokens(text)) {
    const first = parseInt(hashMemoryText(token), 36) || 0;
    const second = parseInt(hashMemoryText(`salt:${token}`), 36) || 0;
    vector[first % dimensions] += second % 2 ? 1 : -1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return magnitude ? vector.map((value) => value / magnitude) : vector;
}

function memoryTokens(text: string): string[] {
  const normalized = String(text ?? '').normalize('NFKC').toLocaleLowerCase();
  const words = normalized.match(/[a-z0-9_]{2,}|[\p{Script=Han}]/gu) ?? [];
  const han = words.filter((token) => /\p{Script=Han}/u.test(token));
  const bigrams = han.slice(0, -1).map((token, index) => `${token}${han[index + 1]}`);
  return [...words, ...bigrams].slice(0, 600);
}

function cosine(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) score += left[index] * right[index];
  return clamp(score, 0, 1);
}

function vectorCosine(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (!leftMagnitude || !rightMagnitude) return 0;
  return clamp(dot / Math.sqrt(leftMagnitude * rightMagnitude), 0, 1);
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(memoryTokens(left));
  const rightTokens = new Set(memoryTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  return intersection / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
}

function recallReasons(input: { semanticScore: number; keywordScore: number; graphScore: number; retention: number; openWeight: number; pinned: boolean }): string[] {
  const reasons: string[] = [];
  if (input.pinned) reasons.push('已珍藏');
  if (input.semanticScore > 0.68) reasons.push('含义相近');
  if (input.keywordScore > 0.25) reasons.push('提到相同线索');
  if (input.graphScore > 0.3) reasons.push('图谱关系接近');
  if (input.openWeight) reasons.push('仍待兑现');
  if (input.retention > 0.75) reasons.push('印象清晰');
  return reasons.slice(0, 3);
}

function stateKindLabel(kind: MemoryStateKind): string {
  const labels: Record<MemoryStateKind, string> = {
    relationship: '我们的关系',
    'user-impression': '我对用户的印象',
    'adaptive-personality': '我的成长与适应',
    mood: '我此刻的情绪',
    'current-context': '当前情境',
  };
  return labels[kind];
}

function relativeTime(timestamp: number | undefined, now: number): string {
  if (!timestamp) return '时间不明确';
  const days = Math.max(0, Math.floor((now - timestamp) / DAY_MS));
  if (days === 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (days < 31) return `${Math.floor(days / 7)}周前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

function createEdge(brainId: string, fromId: string, toId: string, type: MemoryEdge['type'], now: number, weight: number): MemoryEdge {
  return {
    id: `${brainId}:edge:${hashMemoryText(`${fromId}|${type}|${toId}`)}`,
    brainId,
    fromId,
    toId,
    type,
    weight: clamp(weight, 0, 1),
    createdAt: now,
    updatedAt: now,
  };
}

function assertionDedupeKey(subjectId: string, predicate: string, objectValue: string, kind: MemoryAssertionKind): string {
  return [subjectId, normalizeMemoryName(predicate), normalizeMemoryName(objectValue), kind].join('|');
}

function buildAssertionSearchText(subject: string, predicate: string, objectText: string, perspectiveText: string): string {
  return `${subject} ${predicate} ${objectText} ${perspectiveText}`.trim();
}

function dedupeEdges(upserts: MemoryEdge[], existing: MemoryEdge[]): MemoryEdge[] {
  const existingIds = new Set(existing.map((edge) => edge.id));
  return dedupeById(upserts).filter((edge) => !existingIds.has(edge.id));
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  items.forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '').replace(/\u0000/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function finiteTime(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function clamp(value: unknown, minimum: number, maximum: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
