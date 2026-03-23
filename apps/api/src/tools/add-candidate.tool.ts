import { AddedReason } from '@newcar/shared';
import { carCandidateService } from '../services/car-candidate.service';
import { carService } from '../services/car.service';

export const addCandidateTool = {
  name: 'add_candidate',
  description: '将指定车型加入候选列表。当用户明确表达要加入候选、收藏或保留这款车型时调用。',
  input_schema: {
    type: 'object',
    required: [],
    properties: {
      carId: { type: 'string', description: '车型 ID。若模型暂时只有车型名，也可能把车型名放在这里。' },
      query: { type: 'string', description: '车型名称或品牌+车型，例如“深蓝S7”或“理想 L6”。当没有 carId 时可传这个。' },
      userNotes: { type: 'string', description: '加入候选时附带备注' },
      priceAtAdd: { type: 'number', description: '加入时价格（元）' },
    },
  },
};

export async function runAddCandidate(journeyId: string, input: Record<string, unknown>) {
  const rawCarId = String(input.carId || '').trim();
  const query = String(input.query || '').trim();
  const fallbackQuery = query || rawCarId;

  let car = rawCarId ? await carService.getCarById(rawCarId) : null;

  if (!car && fallbackQuery) {
    const normalizedQuery = fallbackQuery.replace(/\s+/g, '');
    let candidates = await carService.searchCars({
      q: fallbackQuery,
      limit: 10,
    });

    if (candidates.length === 0) {
      const compactMatch = normalizedQuery.match(/^([\u4e00-\u9fa5]+)([A-Za-z0-9].*)$/);
      if (compactMatch) {
        candidates = await carService.searchCars({
          brand: compactMatch[1],
          q: compactMatch[2],
          limit: 10,
        });
      }
    }

    if (candidates.length === 0) {
      const spacedMatch = fallbackQuery.match(/^([\u4e00-\u9fa5]+)\s+(.+)$/);
      if (spacedMatch) {
        candidates = await carService.searchCars({
          brand: spacedMatch[1],
          q: spacedMatch[2],
          limit: 10,
        });
      }
    }

    car =
      candidates.find((candidate) => `${candidate.brand}${candidate.model}`.replace(/\s+/g, '') === normalizedQuery) ||
      candidates.find((candidate) => `${candidate.brand} ${candidate.model}`.includes(fallbackQuery)) ||
      candidates[0] ||
      null;
  }

  if (!car) {
    throw new Error('Car not found');
  }

  const candidate = await carCandidateService.addCandidate({
    journeyId,
    carId: car.id,
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
