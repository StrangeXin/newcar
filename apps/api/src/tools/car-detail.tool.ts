import { carService } from '../services/car.service';
import { normalizeCarQuery } from '../services/car-fuzzy';

export const carDetailTool = {
  name: 'car_detail',
  description: '获取特定车型的详细参数、价格区间、主要配置。当用户询问某款具体车型详情时调用。',
  input_schema: {
    type: 'object',
    required: [],
    properties: {
      carId: { type: 'string', description: '车型 ID。若已知数据库中的车型 ID，优先传这个。' },
      query: { type: 'string', description: '车型名称或品牌+车型，例如“深蓝S7”或“理想 L6”。当没有 carId 时可传这个。' },
    },
  },
};

export async function runCarDetail(input: Record<string, unknown>) {
  const carId = String(input.carId || '').trim();
  const query = String(input.query || '').trim();
  const fallbackQuery = query || carId;

  let car = carId ? await carService.getCarById(carId) : null;

  if (!car && fallbackQuery) {
    const normalizedQuery = fallbackQuery.replace(/\s+/g, '');
    const expandedQueries = normalizeCarQuery(fallbackQuery);

    let candidates: Awaited<ReturnType<typeof carService.searchCars>> = [];
    for (const q of expandedQueries) {
      candidates = await carService.searchCars({ q, limit: 10 });
      if (candidates.length > 0) break;
    }

    if (candidates.length === 0) {
      candidates = await carService.searchCars({ q: fallbackQuery, limit: 10 });
    }

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
    return {
      error: true,
      message: `未找到车型「${fallbackQuery}」的详细信息，请确认车型名称是否正确`,
    };
  }

  const price = await carService.getCarPrice(car.id);
  const reviews = await carService.getCarReviews(car.id, 3);

  return {
    id: car.id,
    brand: car.brand,
    model: car.model,
    variant: car.variant,
    type: car.type,
    fuelType: car.fuelType,
    msrp: car.msrp,
    baseSpecs: car.baseSpecs,
    latestPrice: price,
    recentReviewSummaries: reviews.map((review) => review.aiSummary || review.title || review.content),
  };
}
