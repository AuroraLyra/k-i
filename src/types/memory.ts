export type MemoryChannel = 'online' | 'offline' | 'group' | 'voom' | 'couple-space' | 'call' | 'system';

export type MemoryEntityType = 'character' | 'user' | 'person' | 'place' | 'object' | 'organization' | 'event' | 'concept';

export type MemoryAssertionKind = 'fact' | 'preference' | 'promise' | 'conflict' | 'relationship' | 'impression' | 'growth' | 'emotion' | 'open-loop' | 'interpretation' | 'boundary';

export type MemoryAssertionStatus = 'current' | 'open' | 'resolved' | 'superseded' | 'disputed' | 'cancelled' | 'forgotten';

export type MemoryEpistemicKind = 'told' | 'observed' | 'inferred' | 'hearsay' | 'canon';

export type MemoryEdgeType = 'supports' | 'contradicts' | 'supersedes' | 'causes' | 'resolves' | 'related-to' | 'reminds-of' | 'before' | 'after' | 'member-of' | 'contains' | 'mentions';

export type MemoryStateKind = 'relationship' | 'user-impression' | 'adaptive-personality' | 'mood' | 'current-context';

export type MemoryStateTrend = 'up' | 'down' | 'stable';

export type MemoryEpisodeStatus = 'active' | 'forgotten';

export type MemoryTemporalBasis = 'message-time' | 'sequence-only' | 'story-time';

export type MemoryLocationActor = 'character' | 'user' | 'shared-scene' | 'unknown';

export type MemoryLocationSource = 'attachment' | 'explicit-text' | 'offline-scene' | 'inferred' | 'manual';

export interface MemoryEpisodeLocation {
  actor: MemoryLocationActor;
  source: MemoryLocationSource;
  label: string;
  address?: string;
  distance?: string;
  evidenceMessageIds: string[];
  confidence: number;
}

export interface MemoryGenerationMetadata {
  diaryComplete: boolean;
  graphComplete: boolean;
  diaryFinishReason?: string;
  graphFinishReason?: string;
  diaryOutputTokens?: number;
  graphOutputTokens?: number;
  repairedJson: boolean;
}

export interface MemoryEpisode {
  id: string;
  brainId: string;
  characterId: string;
  userId: string;
  conversationId: string;
  channel: MemoryChannel;
  status: MemoryEpisodeStatus;
  forgottenAt?: number;
  sourceMessageIds: string[];
  sourceHash: string;
  startFloor: number;
  endFloor: number;
  sourceTokenEstimate: number;
  title: string;
  narrative: string;
  location: string;
  locations?: MemoryEpisodeLocation[];
  emotion: string;
  valence: number;
  arousal: number;
  salience: number;
  participantEntityIds: string[];
  themeIds: string[];
  occurredAt: number;
  occurredEndAt?: number;
  temporalBasis?: MemoryTemporalBasis;
  timeAwarenessEnabled?: boolean;
  timeZone?: string;
  generation?: MemoryGenerationMetadata;
  manuallyEditedAt?: number;
  learnedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryEntity {
  id: string;
  brainId: string;
  type: MemoryEntityType;
  name: string;
  normalizedName: string;
  aliases: string[];
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryAssertion {
  id: string;
  brainId: string;
  subjectEntityId: string;
  predicate: string;
  objectEntityId?: string;
  objectText: string;
  kind: MemoryAssertionKind;
  status: MemoryAssertionStatus;
  epistemicKind: MemoryEpistemicKind;
  perspectiveText: string;
  confidence: number;
  importance: number;
  emotionalWeight: number;
  relationshipImpact: number;
  evidenceMessageIds: string[];
  sourceEpisodeIds: string[];
  themeIds: string[];
  searchText: string;
  validFrom: number;
  validTo?: number;
  learnedAt: number;
  forgottenDedupeKey?: string;
  supersededById?: string;
  dueAt?: number;
  lastRecalledAt?: number;
  recallCount: number;
  pinned: boolean;
  accessibility: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryEdge {
  id: string;
  brainId: string;
  fromId: string;
  toId: string;
  type: MemoryEdgeType;
  weight: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryTheme {
  id: string;
  brainId: string;
  name: string;
  description: string;
  entityIds: string[];
  assertionIds: string[];
  episodeIds: string[];
  report: string;
  reportAssertionCount: number;
  reportUpdatedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryStateFacet {
  key: string;
  label: string;
  value: number;
  trend: MemoryStateTrend;
  evidenceAssertionIds: string[];
}

export interface MemoryStateSnapshot {
  id: string;
  brainId: string;
  kind: MemoryStateKind;
  summary: string;
  facets: MemoryStateFacet[];
  sourceAssertionIds: string[];
  sourceEpisodeIds: string[];
  previousSnapshotId?: string;
  createdAt: number;
}

export interface MemoryEmbeddingCache {
  id: string;
  brainId: string;
  ownerType: 'assertion' | 'episode' | 'theme';
  ownerId: string;
  model: string;
  dimensions: number;
  textHash: string;
  vector: number[];
  createdAt: number;
  updatedAt: number;
}

export interface MemoryExtractionEntityDraft {
  key: string;
  type: MemoryEntityType;
  name: string;
  aliases: string[];
  description?: string;
}

export interface MemoryExtractionAssertionDraft {
  subjectKey: string;
  predicate: string;
  objectKey?: string;
  objectText: string;
  kind: MemoryAssertionKind;
  epistemicKind: MemoryEpistemicKind;
  perspectiveText: string;
  confidence: number;
  importance: number;
  emotionalWeight: number;
  relationshipImpact: number;
  evidenceMessageIds: string[];
  themes: string[];
  supersedesAssertionIds?: string[];
  contradictsAssertionIds?: string[];
  validFrom?: number;
  validTo?: number;
  dueAt?: number;
}

export interface MemoryExtractionStateDelta {
  kind: MemoryStateKind;
  summary: string;
  confidence: number;
  facets: Array<{
    key: string;
    label: string;
    delta: number;
  }>;
}

export interface MemoryExtractionLocationDraft {
  actor: MemoryLocationActor;
  source: MemoryLocationSource;
  label: string;
  address?: string;
  distance?: string;
  evidenceMessageIds: string[];
  confidence: number;
}

export interface MemoryExtractionResult {
  title: string;
  narrative: string;
  location: string;
  locations: MemoryExtractionLocationDraft[];
  emotion: string;
  valence: number;
  arousal: number;
  salience: number;
  entities: MemoryExtractionEntityDraft[];
  assertions: MemoryExtractionAssertionDraft[];
  themes: string[];
  stateDeltas: MemoryExtractionStateDelta[];
  generation?: MemoryGenerationMetadata;
}

export interface MemoryRecallItem {
  assertion: MemoryAssertion;
  score: number;
  reasons: string[];
}

export interface MemoryRecallResult {
  items: MemoryRecallItem[];
  episodes: MemoryEpisode[];
  themes: MemoryTheme[];
  states: MemoryStateSnapshot[];
  contextText: string;
  estimatedTokens: number;
  budgetTokens: number;
}

export interface MemoryCompressionStats {
  compressionActive: boolean;
  totalMessages: number;
  totalFloors: number;
  archivedMessages: number;
  archivedFloors: number;
  promptMessages: number;
  promptFloors: number;
  uncapturedMessages: number;
  memoryTokens: number;
  memoryBudgetTokens: number;
  sourceTokenEstimate: number;
  recallTokenEstimate: number;
  recallTokenBudget: number;
}
