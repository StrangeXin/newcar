import { carService } from '../services/car.service';

export const carDetailTool = {
  name: 'car_detail',
  description: '获取特定车型的详细参数、价格区间、主要配置。当用户询问某款具体车型详情时调用。',
  input_schema: {
    type: 'object',
    required: ['carId'],
    properties: {
      carId: { type: 'string', description: '车型 ID' },
    },
  },
};

export async function runCarDetail(input: Record<string, unknown>) {
  const carId = String(input.carId || '');
  const car = await carService.getCarById(carId);

  if (!car) {
    throw new Error('Car not found');
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
