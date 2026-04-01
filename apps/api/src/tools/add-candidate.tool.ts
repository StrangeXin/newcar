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
      matchTags: { type: 'array', items: { type: 'string' }, description: '匹配标签，如预算命中、家用、续航达标等' },
      recommendReason: { type: 'string', description: '推荐这款车的简短理由' },
      relevantDimensions: { type: 'array', items: { type: 'string' }, description: '这款车最相关的用户关注维度' },
    },
  },
};

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : undefined;
}

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
      candidates.find((c) => `${c.brand}${c.model}`.replace(/\s+/g, '') === normalizedQuery) ||
      candidates.find((c) => `${c.brand} ${c.model}`.includes(fallbackQuery)) ||
      candidates[0] ||
      null;
  }

  if (!car) {
    return {
      output: { error: true, message: `未找到匹配的车型「${fallbackQuery || input.carId}」，请尝试更具体的名称（如"理想L6"而非"理想"）` },
      sideEffects: [],
    };
  }

  const candidate = await carCandidateService.addCandidate({
    journeyId,
    carId: car.id,
    addedReason: AddedReason.AI_RECOMMENDED,
    userNotes: typeof input.userNotes === 'string' ? input.userNotes : undefined,
    priceAtAdd: typeof input.priceAtAdd === 'number' ? input.priceAtAdd : undefined,
    matchTags: normalizeStringArray(input.matchTags),
    recommendReason: typeof input.recommendReason === 'string' ? input.recommendReason : undefined,
    relevantDimensions: normalizeStringArray(input.relevantDimensions),
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
