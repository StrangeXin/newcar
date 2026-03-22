import { PrismaClient } from '@prisma/client';
import { weaviateClient } from '../apps/api/src/lib/weaviate';
import { weaviateService } from '../apps/api/src/services/weaviate.service';

const prisma = new PrismaClient();

function buildSpecsSummary(car: {
  brand: string;
  model: string;
  variant: string;
  fuelType: string;
  type: string;
  msrp: number | null;
  baseSpecs: unknown;
}) {
  const specsText = car.baseSpecs ? JSON.stringify(car.baseSpecs) : '暂无规格信息';
  const msrpWan = car.msrp ? `${(car.msrp / 10000).toFixed(1)}万元` : '价格待定';
  return `${car.brand}${car.model} ${car.variant}，${car.fuelType} ${car.type}，MSRP ${msrpWan}，规格信息：${specsText}`;
}

async function syncCars() {
  const cars = await prisma.car.findMany();

  for (const car of cars) {
    await weaviateClient.data
      .creator()
      .withClassName('Car')
      .withId(car.id)
      .withProperties({
        carId: car.id,
        brand: car.brand,
        model: car.model,
        variant: car.variant,
        fuelType: car.fuelType,
        carType: car.type,
        msrp: car.msrp || 0,
        specsSummary: buildSpecsSummary(car),
      })
      .do();
  }

  console.log(`Synced cars to Weaviate: ${cars.length}`);
}

async function syncReviews() {
  const reviews = await prisma.carReview.findMany({
    include: { car: true },
  });

  for (const review of reviews) {
    await weaviateClient.data
      .creator()
      .withClassName('CarReview')
      .withId(review.id)
      .withProperties({
        reviewId: review.id,
        carId: review.carId,
        brand: review.car.brand,
        model: review.car.model,
        reviewText: review.aiSummary || review.content || '',
        sentiment: 'neutral',
      })
      .do();
  }

  console.log(`Synced reviews to Weaviate: ${reviews.length}`);
}

async function main() {
  await weaviateService.ensureSchema();
  await syncCars();
  await syncReviews();
  console.log('Weaviate sync completed');
}

main()
  .catch((err) => {
    console.error('Weaviate sync failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
