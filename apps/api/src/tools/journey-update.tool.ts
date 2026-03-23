import { JourneyStage } from '@newcar/shared';
import { journeyService } from '../services/journey.service';

export const journeyUpdateTool = {
  name: 'journey_update',
  description:
    '更新旅程的结构化需求或阶段。当用户明确说出预算、用途、能源类型偏好，或用户决策进入新阶段时调用。',
  input_schema: {
    type: 'object',
    properties: {
      requirements: {
        type: 'object',
        properties: {
          budgetMin: { type: 'number' },
          budgetMax: { type: 'number' },
          fuelTypePreference: { type: 'array', items: { type: 'string' } },
          useCases: { type: 'array', items: { type: 'string' } },
          stylePreference: { type: 'string' },
        },
      },
      stage: {
        type: 'string',
        enum: ['AWARENESS', 'CONSIDERATION', 'COMPARISON', 'DECISION', 'PURCHASE'],
      },
    },
  },
};

export async function runJourneyUpdate(journeyId: string, input: Record<string, unknown>) {
  const sideEffects: Array<{ event: 'journey_updated' | 'stage_changed'; data: unknown }> = [];
  const requirements =
    input.requirements && typeof input.requirements === 'object'
      ? (input.requirements as Record<string, unknown>)
      : undefined;

  let updatedRequirements;
  if (requirements) {
    updatedRequirements = await journeyService.updateRequirements(journeyId, {
      budgetMin: typeof requirements.budgetMin === 'number' ? requirements.budgetMin : undefined,
      budgetMax: typeof requirements.budgetMax === 'number' ? requirements.budgetMax : undefined,
      fuelTypePreference: Array.isArray(requirements.fuelTypePreference)
        ? requirements.fuelTypePreference.map(String)
        : undefined,
      useCases: Array.isArray(requirements.useCases) ? requirements.useCases.map(String) : undefined,
      stylePreference:
        typeof requirements.stylePreference === 'string' ? requirements.stylePreference : undefined,
    });
    sideEffects.push({
      event: 'journey_updated',
      data: updatedRequirements.requirements,
    });
  }

  let updatedStage;
  if (typeof input.stage === 'string' && Object.values(JourneyStage).includes(input.stage as JourneyStage)) {
    updatedStage = await journeyService.advanceStage(journeyId, input.stage as JourneyStage);
    sideEffects.push({
      event: 'stage_changed',
      data: { stage: updatedStage.stage },
    });
  }

  return {
    output: {
      requirements: updatedRequirements?.requirements || null,
      stage: updatedStage?.stage || null,
    },
    sideEffects,
  };
}
