import { AddedReason } from '@newcar/shared';
import { carCandidateService } from '../services/car-candidate.service';

export const addCandidateTool = {
  name: 'add_candidate',
  description: '将指定车型加入候选列表。当用户明确表达要加入候选、收藏或保留这款车型时调用。',
  input_schema: {
    type: 'object',
    required: ['carId'],
    properties: {
      carId: { type: 'string', description: '车型 ID' },
      userNotes: { type: 'string', description: '加入候选时附带备注' },
      priceAtAdd: { type: 'number', description: '加入时价格（元）' },
    },
  },
};

export async function runAddCandidate(journeyId: string, input: Record<string, unknown>) {
  const candidate = await carCandidateService.addCandidate({
    journeyId,
    carId: String(input.carId || ''),
    addedReason: AddedReason.AI_RECOMMENDED,
    userNotes: typeof input.userNotes === 'string' ? input.userNotes : undefined,
    priceAtAdd: typeof input.priceAtAdd === 'number' ? input.priceAtAdd : undefined,
  });

  return {
    output: candidate,
    sideEffects: [
      {
        event: 'candidate_added' as const,
        data: candidate,
      },
    ],
  };
}
