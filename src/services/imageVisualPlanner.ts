import { hasTextGenerationConfig, requestTextGeneration } from '@/services/ai';
import type { AppSettings } from '@/types/domain';
import { parseModelJsonResponse } from '@/utils/aiResponse';
import {
  buildImageVisualPlannerPrompt,
  createFallbackImageVisualPlan,
  normalizeImageVisualPlan,
  type ImageVisualPlan,
  type ImageVisualPlanInput
} from '@/utils/imagePromptPlanner';

export interface ImageVisualPlanningRequest extends ImageVisualPlanInput {
  settings?: AppSettings;
  modelOverride?: string;
}

export interface ImageVisualPlanningResult {
  plan: ImageVisualPlan;
  source: 'model' | 'fallback';
}

export async function planImageVisualState(input: ImageVisualPlanningRequest): Promise<ImageVisualPlanningResult> {
  const fallback = createFallbackImageVisualPlan(input);
  const modelOverride = String(input.modelOverride ?? '').trim();
  if (!hasTextGenerationConfig(input.settings, modelOverride)) {
    return { plan: fallback, source: 'fallback' };
  }

  try {
    const response = await requestTextGeneration(
      input.settings,
      buildImageVisualPlannerPrompt(input),
      modelOverride,
      { jsonMode: true, temperature: 0.25, maxTokens: 900 }
    );
    return {
      plan: normalizeImageVisualPlan(parseModelJsonResponse(response), fallback),
      source: 'model'
    };
  } catch (error) {
    console.warn('Image visual planner fell back to a neutral plan.', error);
    return { plan: fallback, source: 'fallback' };
  }
}
