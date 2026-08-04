import type { CharacterImageProfile, ImagePeoplePolicy, ImageReferencePolicy, ImageVisualMoment, ImageVisualScope } from '@/types/domain';

export interface ImageVisualPlanInput {
  scope: ImageVisualScope;
  description: string;
  characterName?: string;
  characterPriority?: boolean;
  characterProfile?: Partial<CharacterImageProfile> | null;
  context?: string;
  continuityKey?: string;
  previousMoments?: ImageVisualMoment[];
  createdAt?: number;
}

export interface ImageVisualPlan {
  scope: ImageVisualScope;
  continuityKey: string;
  peoplePolicy: ImagePeoplePolicy;
  referencePolicy: ImageReferencePolicy;
  environment: string;
  activity: string;
  expression: string;
  wardrobe: string;
  framing: string;
  visualPrompt: string;
  negativePrompt: string;
  createdAt: number;
}

export interface ImageVisualPromptParts {
  positivePrompt: string;
  negativePrompt: string;
  referenceImage: string;
  seed: string;
}

const peoplePolicies: readonly ImagePeoplePolicy[] = ['character-required', 'people-forbidden', 'people-optional'];
const referencePolicies: readonly ImageReferencePolicy[] = ['none', 'identity', 'composition'];

function normalizeText(value: unknown, maxLength = 1800) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = normalizeText(value, 80);
  return allowed.includes(normalized as T) ? normalized as T : fallback;
}

function uniqueParts(parts: Array<string | null | undefined>) {
  return [...new Set(parts.map((part) => normalizeText(part)).filter(Boolean))];
}

function fallbackPeoplePolicy(input: ImageVisualPlanInput): ImagePeoplePolicy {
  return input.scope === 'videoCall' ? 'character-required' : 'people-optional';
}

export function createFallbackImageVisualPlan(input: ImageVisualPlanInput): ImageVisualPlan {
  const createdAt = input.createdAt ?? Date.now();
  const peoplePolicy = fallbackPeoplePolicy(input);
  const description = normalizeText(input.description) || 'Follow the requested visual content faithfully.';
  return {
    scope: input.scope,
    continuityKey: normalizeText(input.continuityKey, 240),
    peoplePolicy,
    referencePolicy: peoplePolicy === 'character-required' ? 'identity' : 'none',
    environment: '',
    activity: '',
    expression: '',
    wardrobe: '',
    framing: '',
    visualPrompt: description,
    negativePrompt: peoplePolicy === 'people-forbidden' ? 'people, human figures, faces, hands, reflections, silhouettes' : '',
    createdAt
  };
}

function serializeMoment(moment: ImageVisualMoment) {
  return {
    scope: moment.scope,
    continuityKey: moment.continuityKey,
    peoplePolicy: moment.peoplePolicy,
    environment: moment.environment,
    activity: moment.activity,
    expression: moment.expression,
    wardrobe: moment.wardrobe,
    framing: moment.framing,
    createdAt: moment.createdAt
  };
}

export function buildImageVisualPlannerPrompt(input: ImageVisualPlanInput) {
  const profile = input.characterProfile;
  const payload = {
    scope: input.scope,
    requestedDescription: normalizeText(input.description),
    contextualText: normalizeText(input.context, 2200),
    continuityKey: normalizeText(input.continuityKey, 240),
    character: {
      name: normalizeText(input.characterName, 180),
      appearance: normalizeText(profile?.appearancePrompt, 1600),
      face: normalizeText(profile?.facePrompt, 1000),
      wardrobeGuidance: normalizeText(profile?.wardrobe?.guidance, 1200),
      wardrobeInventory: normalizeText(profile?.wardrobe?.inventory, 1600),
      wardrobeAvoid: normalizeText(profile?.wardrobe?.avoid, 800),
      priority: Boolean(input.characterPriority)
    },
    previousVisualMoments: (input.previousMoments ?? []).slice(0, 8).map(serializeMoment)
  };

  return [
    'You are a visual-intent director for an image-generation system.',
    'Interpret the complete Chinese request semantically. Never use keyword heuristics or a fixed scenario table.',
    'Decide whether a person is required, forbidden, or optional from the actual request. A character priority is only a soft preference and never overrides a scene-only request.',
    'Use written character traits only when the character is required. Preserve identity through written traits, not through copying a reference image composition.',
    'Treat prior moments with the same continuity key as continuity constraints for location and wardrobe. For a live video call, preserve the current place and outfit while letting pose, gaze, expression, and interaction respond to the latest dialogue.',
    'Create an original, concrete image prompt that follows the requested content. Respect wardrobe guidance and avoid lists without forcing a repetitive outfit.',
    'Return JSON only, with this exact schema:',
    '{"peoplePolicy":"character-required|people-forbidden|people-optional","referencePolicy":"none|identity|composition","environment":"string","activity":"string","expression":"string","wardrobe":"string","framing":"string","visualPrompt":"English image prompt","negativePrompt":"English negative prompt"}',
    'Do not add an explanation, markdown, or fields outside the schema.',
    JSON.stringify(payload)
  ].join('\n');
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeImageVisualPlan(value: unknown, fallback: ImageVisualPlan): ImageVisualPlan {
  const raw = recordValue(value);
  const peoplePolicy = normalizeEnum(raw.peoplePolicy, peoplePolicies, fallback.peoplePolicy);
  const referencePolicy = peoplePolicy === 'character-required'
    ? normalizeEnum(raw.referencePolicy, referencePolicies, fallback.referencePolicy)
    : 'none';
  const visualPrompt = normalizeText(raw.visualPrompt, 3000) || fallback.visualPrompt;
  const negativePrompt = normalizeText(raw.negativePrompt, 1600)
    || (peoplePolicy === 'people-forbidden' ? 'people, human figures, faces, hands, reflections, silhouettes' : fallback.negativePrompt);

  return {
    scope: fallback.scope,
    continuityKey: normalizeText(fallback.continuityKey, 240),
    peoplePolicy,
    referencePolicy,
    environment: normalizeText(raw.environment, 600),
    activity: normalizeText(raw.activity, 600),
    expression: normalizeText(raw.expression, 600),
    wardrobe: normalizeText(raw.wardrobe, 1000),
    framing: normalizeText(raw.framing, 600),
    visualPrompt,
    negativePrompt,
    createdAt: fallback.createdAt
  };
}

export function compileImageVisualPrompt(input: {
  plan: ImageVisualPlan;
  basePrompt?: string;
  profile?: Partial<CharacterImageProfile> | null;
  extraPrompt?: string;
  baseNegativePrompt?: string;
}): ImageVisualPromptParts {
  const includeCharacter = input.plan.peoplePolicy === 'character-required';
  const profile = input.profile;
  const identityDetails = includeCharacter
    ? uniqueParts([profile?.appearancePrompt, profile?.facePrompt]).join(', ')
    : '';
  const positivePrompt = uniqueParts([
    input.basePrompt,
    input.plan.visualPrompt,
    identityDetails ? `Character identity details: ${identityDetails}.` : '',
    input.extraPrompt
  ]).join(', ');
  const negativePrompt = uniqueParts([
    input.baseNegativePrompt,
    input.plan.negativePrompt,
    input.plan.peoplePolicy === 'people-forbidden' ? 'no people, no human body parts, no faces, no reflections of people' : ''
  ]).join(', ');
  const referenceImage = includeCharacter
    && input.plan.referencePolicy === 'composition'
    && profile?.referenceImageEnabled !== false
    && profile?.referenceImageMode === 'composition'
    ? normalizeText(profile?.referenceImage, 100000)
    : '';
  const seed = includeCharacter && profile?.seedLockEnabled ? normalizeText(profile?.seed, 120) : '';

  return { positivePrompt, negativePrompt, referenceImage, seed };
}

export function createImageVisualMoment(plan: ImageVisualPlan, id: string): ImageVisualMoment {
  return {
    id,
    scope: plan.scope,
    continuityKey: plan.continuityKey,
    peoplePolicy: plan.peoplePolicy,
    referencePolicy: plan.referencePolicy,
    environment: plan.environment,
    activity: plan.activity,
    expression: plan.expression,
    wardrobe: plan.wardrobe,
    framing: plan.framing,
    visualPrompt: plan.visualPrompt,
    negativePrompt: plan.negativePrompt,
    createdAt: plan.createdAt
  };
}
