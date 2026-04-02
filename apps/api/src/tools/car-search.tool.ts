import { carService, toYuanFromWan } from '../services/car.service';
import type { UserPreferences } from '../services/car-ranking.service';

export const carSearchTool = {
  name: 'car_search',
  description:
    '根据用户需求搜索匹配的车型列表。当用户表达购车意向、询问推荐或提供预算/用途信息时调用。所有参数均可选，无参数时返回宽泛结果。',
  input_schema: {
    type: 'object',
    required: [],
    properties: {
      query: { type: 'string', description: "自然语言搜索词，如'家用SUV'" },
      budgetMax: { type: 'number', description: '最高预算（万元）' },
      budgetMin: { type: 'number', description: '最低预算（万元）' },
      fuelType: { type: 'string', enum: ['BEV', 'PHEV', 'ICE', 'HEV'] },
      carType: { type: 'string', enum: ['SUV', 'SEDAN', 'MPV', 'COUPE', 'HATCHBACK'] },
      limit: { type: 'number', description: '返回数量，默认 5' },
    },
  },
};

export async function runCarSearch(
  input: Record<string, unknown>,
  context?: { requirements?: Record<string, unknown> },
) {
  const query = typeof input.query === 'string' ? input.query : undefined;
  const limit = typeof input.limit === 'number' ? Math.min(Math.max(input.limit, 1), 10) : 5;

  // 从 journey requirements 提取偏好
  const preferences: UserPreferences = {};
  if (context?.requirements) {
    const req = context.requirements;
    if (typeof req.budgetMin === 'number') preferences.budgetMin = req.budgetMin;
    if (typeof req.budgetMax === 'number') preferences.budgetMax = req.budgetMax;
    if (Array.isArray(req.useCases)) preferences.useCases = req.useCases as string[];
    if (Array.isArray(req.fuelTypePreference)) preferences.fuelTypePreference = req.fuelTypePreference as string[];
    if (typeof req.stylePreference === 'string') preferences.stylePreference = req.stylePreference;
  }

  const cars = await carService.searchCars({
    q: query,
    budgetMin: toYuanFromWan(typeof input.budgetMin === 'number' ? input.budgetMin : undefined),
    budgetMax: toYuanFromWan(typeof input.budgetMax === 'number' ? input.budgetMax : undefined),
    fuelType: typeof input.fuelType === 'string' ? input.fuelType : undefined,
    carType: typeof input.carType === 'string' ? input.carType : undefined,
    limit,
  }, preferences);

  return {
    cars: cars.map((car) => ({
      id: car.id,
      brand: car.brand,
      model: car.model,
      variant: car.variant,
      type: car.type,
      fuelType: car.fuelType,
      msrp: car.msrp,
    })),
    count: cars.length,
  };
}
