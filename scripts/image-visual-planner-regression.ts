import assert from 'node:assert/strict';
import { compileImageVisualPrompt, createFallbackImageVisualPlan, normalizeImageVisualPlan } from '../src/utils/imagePromptPlanner';

const profile = {
  appearancePrompt: 'short black hair, warm brown eyes',
  facePrompt: 'oval face, soft jawline',
  referenceImage: 'data:image/png;base64,reference',
  referenceImageEnabled: true,
  referenceImageMode: 'identity' as const,
  voomPortraitModeEnabled: true,
  seed: 'locked-seed',
  seedLockEnabled: false,
  wardrobe: {
    guidance: 'natural contemporary daily styling',
    inventory: 'soft jacket, simple accessories',
    avoid: 'costume styling'
  }
};

const fallback = createFallbackImageVisualPlan({
  scope: 'onlineChat',
  description: 'A quiet window scene'
});

const identityPlan = normalizeImageVisualPlan({
  peoplePolicy: 'character-required',
  referencePolicy: 'identity',
  visualPrompt: 'A candid character moment by a rain-streaked window.',
  negativePrompt: 'studio pose'
}, fallback);
const identityPrompt = compileImageVisualPrompt({ plan: identityPlan, profile });
assert.equal(identityPrompt.referenceImage, '');
assert.equal(identityPrompt.seed, '');
assert.match(identityPrompt.positivePrompt, /short black hair/);

const compositionPlan = normalizeImageVisualPlan({
  peoplePolicy: 'character-required',
  referencePolicy: 'composition',
  visualPrompt: 'A candid character moment by a rain-streaked window.',
  negativePrompt: ''
}, fallback);
const compositionPrompt = compileImageVisualPrompt({
  plan: compositionPlan,
  profile: { ...profile, referenceImageMode: 'composition', seedLockEnabled: true }
});
assert.equal(compositionPrompt.referenceImage, profile.referenceImage);
assert.equal(compositionPrompt.seed, profile.seed);

const noPeoplePlan = normalizeImageVisualPlan({
  peoplePolicy: 'people-forbidden',
  referencePolicy: 'composition',
  visualPrompt: 'A rain-streaked window and an empty street beyond it.',
  negativePrompt: ''
}, fallback);
const noPeoplePrompt = compileImageVisualPrompt({ plan: noPeoplePlan, profile });
assert.equal(noPeoplePrompt.referenceImage, '');
assert.doesNotMatch(noPeoplePrompt.positivePrompt, /Character identity details/);
assert.match(noPeoplePrompt.negativePrompt, /no people/);

assert.equal(createFallbackImageVisualPlan({ scope: 'videoCall', description: 'current call frame' }).peoplePolicy, 'character-required');
assert.equal(createFallbackImageVisualPlan({ scope: 'voom', description: 'empty street' }).peoplePolicy, 'people-optional');

console.log('Image visual planner regression checks passed.');