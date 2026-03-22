import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedCar = {
  brand: string;
  model: string;
  variant: string;
  year: number;
  type: string;
  fuelType: string;
  msrp: number;
  baseSpecs: {
    seats: number;
    range_km?: number;
    drivetrain?: string;
    notes?: string;
  };
};

const CARS: SeedCar[] = [
  { brand: '比亚迪', model: '海豹 EV', variant: '基础版', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 170000, baseSpecs: { seats: 5, range_km: 550, notes: '纯电轿车' } },
  { brand: '比亚迪', model: '宋Pro DM-i', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 150000, baseSpecs: { seats: 5, range_km: 1100, notes: '插混家用SUV' } },
  { brand: '比亚迪', model: '汉 EV', variant: '基础版', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 210000, baseSpecs: { seats: 5, range_km: 605 } },
  { brand: '理想', model: 'L6', variant: 'Pro', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 250000, baseSpecs: { seats: 5, range_km: 1160 } },
  { brand: '理想', model: 'L7', variant: 'Pro', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 320000, baseSpecs: { seats: 5, range_km: 1185 } },
  { brand: '问界', model: 'M7 Plus', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 250000, baseSpecs: { seats: 6, range_km: 1100 } },
  { brand: '问界', model: 'M9', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 470000, baseSpecs: { seats: 6, range_km: 1200 } },
  { brand: '小鹏', model: 'P7', variant: '基础版', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 210000, baseSpecs: { seats: 5, range_km: 586 } },
  { brand: '小鹏', model: 'G6', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'BEV', msrp: 210000, baseSpecs: { seats: 5, range_km: 580 } },
  { brand: '深蓝', model: 'S7', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 140000, baseSpecs: { seats: 5, range_km: 1040 } },
  { brand: '极氪', model: '001', variant: '基础版', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 270000, baseSpecs: { seats: 5, range_km: 656 } },
  { brand: '特斯拉', model: 'Model 3', variant: '后驱版', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 230000, baseSpecs: { seats: 5, range_km: 606 } },
  { brand: '特斯拉', model: 'Model Y', variant: '后驱版', year: 2024, type: 'SUV', fuelType: 'BEV', msrp: 250000, baseSpecs: { seats: 5, range_km: 554 } },
  { brand: '丰田', model: 'RAV4荣放', variant: '双擎版', year: 2024, type: 'SUV', fuelType: 'HEV', msrp: 190000, baseSpecs: { seats: 5, notes: '混动省油' } },
  { brand: '大众', model: '途观L Pro', variant: '基础版', year: 2024, type: 'SUV', fuelType: 'ICE', msrp: 220000, baseSpecs: { seats: 5, notes: '燃油SUV' } },
];

async function upsertCars() {
  for (const car of CARS) {
    // Schema currently has no composite unique key for brand+model+variant,
    // so we emulate idempotent upsert by query-then-update/create.
    const existing = await prisma.car.findFirst({
      where: { brand: car.brand, model: car.model, variant: car.variant },
      select: { id: true },
    });

    if (existing) {
      await prisma.car.update({
        where: { id: existing.id },
        data: {
          year: car.year,
          type: car.type,
          fuelType: car.fuelType,
          baseSpecs: car.baseSpecs,
          msrp: car.msrp,
        },
      });
    } else {
      await prisma.car.create({
        data: car,
      });
    }
  }
}

async function seedPolicyAndPriceSnapshots() {
  const beijingPolicy = await prisma.carPolicy.findFirst({
    where: {
      region: '北京',
      policyType: '新能源补贴',
    },
    select: { id: true },
  });

  if (!beijingPolicy) {
    await prisma.carPolicy.create({
      data: {
        region: '北京',
        policyType: '新能源补贴',
        subsidyAmount: 5000,
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        validUntil: new Date('2026-12-31T23:59:59.000Z'),
        sourceUrl: 'https://example.gov/policy/beijing-nev',
      },
    });
  }

  const targetCar = await prisma.car.findFirst({
    where: { brand: '比亚迪', model: '海豹 EV' },
    select: { id: true },
  });
  if (!targetCar) {
    return;
  }

  const existingSnapshots = await prisma.carPriceSnapshot.count({
    where: {
      carId: targetCar.id,
      region: '上海',
      source: 'seed',
    },
  });

  if (existingSnapshots === 0) {
    await prisma.carPriceSnapshot.createMany({
      data: [
        {
          carId: targetCar.id,
          region: '上海',
          msrp: 179800,
          dealerDiscount: 2000,
          effectivePrice: 177800,
          source: 'seed',
          policyIds: [],
          capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
        {
          carId: targetCar.id,
          region: '上海',
          msrp: 171800,
          dealerDiscount: 3000,
          effectivePrice: 168800,
          source: 'seed',
          policyIds: [],
          capturedAt: new Date(),
        },
      ],
    });
  }
}

async function main() {
  await upsertCars();
  await seedPolicyAndPriceSnapshots();
  const count = await prisma.car.count();
  console.log(`Seeded cars. Total records in cars table: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
