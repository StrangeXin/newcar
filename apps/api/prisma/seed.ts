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
  // ─── 比亚迪（王朝 + 海洋） ───
  { brand: '比亚迪', model: '海鸥', variant: '基础版', year: 2025, type: 'HATCHBACK', fuelType: 'BEV', msrp: 69800, baseSpecs: { seats: 5, range_km: 405, notes: '入门纯电代步车，城市通勤首选' } },
  { brand: '比亚迪', model: '秦PLUS DM-i', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'PHEV', msrp: 79800, baseSpecs: { seats: 5, range_km: 1200, notes: '国民电混轿车' } },
  { brand: '比亚迪', model: '秦L DM-i', variant: '128KM进取型', year: 2026, type: 'SEDAN', fuelType: 'PHEV', msrp: 96800, baseSpecs: { seats: 5, range_km: 1300, notes: '中型电混轿车，百公里油耗2.9L' } },
  { brand: '比亚迪', model: '元PLUS', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 115800, baseSpecs: { seats: 5, range_km: 430, notes: '紧凑纯电SUV' } },
  { brand: '比亚迪', model: '宋PLUS DM-i', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 135800, baseSpecs: { seats: 5, range_km: 1100, notes: '家用插混SUV标杆' } },
  { brand: '比亚迪', model: '海豹 EV', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 166800, baseSpecs: { seats: 5, range_km: 550, notes: '纯电运动轿车' } },
  { brand: '比亚迪', model: '海豹06 DM-i', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 119800, baseSpecs: { seats: 5, range_km: 1100, notes: '紧凑插混SUV' } },
  { brand: '比亚迪', model: '汉L', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'PHEV', msrp: 209800, baseSpecs: { seats: 5, range_km: 1200, notes: '中大型旗舰轿车' } },
  { brand: '比亚迪', model: '唐L DM-i', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 229800, baseSpecs: { seats: 7, range_km: 1100, notes: '中大型七座SUV' } },

  // ─── 理想 ───
  { brand: '理想', model: 'L6', variant: 'Pro', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 249800, baseSpecs: { seats: 5, range_km: 1160, notes: '中大型增程SUV，家庭五座首选' } },
  { brand: '理想', model: 'L7', variant: 'Pro', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 319800, baseSpecs: { seats: 5, range_km: 1185, notes: '大型增程SUV，豪华五座' } },
  { brand: '理想', model: 'L8', variant: 'Pro', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 339800, baseSpecs: { seats: 6, range_km: 1175, notes: '大型六座增程SUV' } },
  { brand: '理想', model: 'L9', variant: 'Pro', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 429800, baseSpecs: { seats: 6, range_km: 1200, notes: '旗舰六座增程SUV' } },

  // ─── 问界（华为鸿蒙智行） ───
  { brand: '问界', model: 'M5', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 249800, baseSpecs: { seats: 5, range_km: 1100, drivetrain: 'AWD', notes: '华为智驾中型SUV' } },
  { brand: '问界', model: 'M7 Plus', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 249800, baseSpecs: { seats: 6, range_km: 1100, notes: '华为智驾六座SUV' } },
  { brand: '问界', model: 'M9', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 469800, baseSpecs: { seats: 6, range_km: 1200, notes: '旗舰六座SUV，百万内最好的SUV' } },

  // ─── 智界 / 享界（华为） ───
  { brand: '智界', model: 'R7', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 249800, baseSpecs: { seats: 5, range_km: 1100, notes: '华为智驾轿跑SUV' } },
  { brand: '享界', model: 'S9', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 399800, baseSpecs: { seats: 5, range_km: 630, notes: '华为豪华行政轿车' } },

  // ─── 小鹏 ───
  { brand: '小鹏', model: 'M03', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 119800, baseSpecs: { seats: 5, range_km: 515, notes: '紧凑纯电轿车，性价比之王' } },
  { brand: '小鹏', model: 'P7+', variant: '纯电版', year: 2026, type: 'SEDAN', fuelType: 'BEV', msrp: 186800, baseSpecs: { seats: 5, range_km: 602, notes: 'AI智能轿车，超大空间' } },
  { brand: '小鹏', model: 'P7+', variant: '增程版', year: 2026, type: 'SEDAN', fuelType: 'PHEV', msrp: 186800, baseSpecs: { seats: 5, range_km: 1200, notes: 'AI智能轿车增程版' } },
  { brand: '小鹏', model: 'G6', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 209800, baseSpecs: { seats: 5, range_km: 580, notes: '纯电轿跑SUV' } },
  { brand: '小鹏', model: 'G9', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 269800, baseSpecs: { seats: 5, range_km: 570, notes: '中大型纯电SUV' } },
  { brand: '小鹏', model: 'X9', variant: '增程版', year: 2025, type: 'MPV', fuelType: 'PHEV', msrp: 309800, baseSpecs: { seats: 7, range_km: 1602, notes: '大型智能MPV' } },

  // ─── 蔚来 ───
  { brand: '蔚来', model: 'ET5', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 298000, baseSpecs: { seats: 5, range_km: 560, notes: '中型纯电轿车，支持换电' } },
  { brand: '蔚来', model: 'ES6', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 338000, baseSpecs: { seats: 5, range_km: 625, notes: '中型纯电SUV，支持换电' } },
  { brand: '蔚来', model: 'ET7', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 378000, baseSpecs: { seats: 5, range_km: 675, notes: '中大型纯电旗舰轿车' } },
  { brand: '蔚来', model: 'ES8', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 468000, baseSpecs: { seats: 6, range_km: 605, notes: '大型六座纯电SUV' } },

  // ─── 零跑 ───
  { brand: '零跑', model: 'C10', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 129800, baseSpecs: { seats: 5, range_km: 530, notes: '中型纯电SUV，高性价比' } },
  { brand: '零跑', model: 'C11', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 149800, baseSpecs: { seats: 5, range_km: 1100, notes: '中型增程SUV' } },
  { brand: '零跑', model: 'C16', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 159800, baseSpecs: { seats: 6, range_km: 1100, notes: '中大型六座增程SUV' } },
  { brand: '零跑', model: 'B10', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 109800, baseSpecs: { seats: 5, range_km: 450, notes: '紧凑纯电SUV' } },

  // ─── 小米 ───
  { brand: '小米', model: 'SU7', variant: '标准版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 215900, baseSpecs: { seats: 5, range_km: 700, notes: '纯电轿跑，小米首款汽车' } },
  { brand: '小米', model: 'SU7 Ultra', variant: '性能版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 529900, baseSpecs: { seats: 5, range_km: 630, drivetrain: 'AWD', notes: '纽北最速四门车' } },
  { brand: '小米', model: 'YU7', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 269900, baseSpecs: { seats: 5, range_km: 620, notes: '中大型纯电SUV' } },

  // ─── 极氪 ───
  { brand: '极氪', model: '001', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 269000, baseSpecs: { seats: 5, range_km: 656, notes: '猎装纯电轿车' } },
  { brand: '极氪', model: '007', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 209000, baseSpecs: { seats: 5, range_km: 688, notes: '纯电运动轿车' } },
  { brand: '极氪', model: '7X', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 239000, baseSpecs: { seats: 5, range_km: 615, notes: '中大型纯电SUV' } },
  { brand: '极氪', model: '009', variant: '基础版', year: 2025, type: 'MPV', fuelType: 'BEV', msrp: 439000, baseSpecs: { seats: 6, range_km: 702, notes: '豪华纯电MPV' } },
  { brand: '极氪', model: 'MIX', variant: '基础版', year: 2025, type: 'MPV', fuelType: 'BEV', msrp: 199000, baseSpecs: { seats: 4, range_km: 550, notes: '创新无B柱纯电MPV' } },

  // ─── 吉利银河 ───
  { brand: '吉利银河', model: '星耀6', variant: '基础版', year: 2025, type: 'SEDAN', fuelType: 'PHEV', msrp: 68800, baseSpecs: { seats: 5, range_km: 1200, notes: '国民电混轿车' } },
  { brand: '吉利银河', model: 'E5', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 119800, baseSpecs: { seats: 5, range_km: 530, notes: '紧凑纯电SUV' } },
  { brand: '吉利银河', model: 'L7', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 139800, baseSpecs: { seats: 5, range_km: 1100, notes: '中型电混SUV' } },

  // ─── 长安深蓝 ───
  { brand: '深蓝', model: 'S7', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 139800, baseSpecs: { seats: 5, range_km: 1040, notes: '中型增程SUV' } },
  { brand: '深蓝', model: 'SL03', variant: '增程版', year: 2025, type: 'SEDAN', fuelType: 'PHEV', msrp: 119800, baseSpecs: { seats: 5, range_km: 1100, notes: '中型增程轿车' } },
  { brand: '深蓝', model: 'S05', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 99800, baseSpecs: { seats: 5, range_km: 415, notes: '紧凑纯电SUV' } },

  // ─── 腾势 ───
  { brand: '腾势', model: 'D9', variant: 'DM-i', year: 2025, type: 'MPV', fuelType: 'PHEV', msrp: 309800, baseSpecs: { seats: 7, range_km: 1040, notes: '豪华电混MPV销冠' } },
  { brand: '腾势', model: 'N7', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 238000, baseSpecs: { seats: 5, range_km: 630, notes: '中大型纯电SUV' } },

  // ─── 哪吒 ───
  { brand: '哪吒', model: 'L', variant: '纯电版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 139900, baseSpecs: { seats: 5, range_km: 510, notes: '中型纯电SUV' } },
  { brand: '哪吒', model: 'X', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 99800, baseSpecs: { seats: 5, range_km: 401, notes: '紧凑纯电SUV' } },

  // ─── 特斯拉 ───
  { brand: '特斯拉', model: 'Model 3', variant: '后驱版', year: 2025, type: 'SEDAN', fuelType: 'BEV', msrp: 231900, baseSpecs: { seats: 5, range_km: 606, notes: '纯电轿车标杆' } },
  { brand: '特斯拉', model: 'Model Y', variant: '后驱版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 249900, baseSpecs: { seats: 5, range_km: 554, notes: '纯电SUV全球销冠' } },

  // ─── 奇瑞 ───
  { brand: '奇瑞', model: '风云T11', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 189800, baseSpecs: { seats: 5, range_km: 1400, notes: '世界十佳增程SUV' } },
  { brand: '奇瑞', model: 'iCAR 03', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 109800, baseSpecs: { seats: 5, range_km: 401, notes: '方盒子纯电SUV' } },

  // ─── 丰田 / 大众（传统合资） ───
  { brand: '丰田', model: 'RAV4荣放', variant: '双擎版', year: 2025, type: 'SUV', fuelType: 'HEV', msrp: 190000, baseSpecs: { seats: 5, notes: '混动省油标杆' } },
  { brand: '丰田', model: '凯美瑞', variant: '双擎版', year: 2025, type: 'SEDAN', fuelType: 'HEV', msrp: 175800, baseSpecs: { seats: 5, notes: '中型混动轿车' } },
  { brand: '大众', model: '途观L Pro', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'ICE', msrp: 220000, baseSpecs: { seats: 5, notes: '合资中型燃油SUV' } },
  { brand: '大众', model: 'ID.4 X', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'BEV', msrp: 199800, baseSpecs: { seats: 5, range_km: 529, notes: '合资纯电SUV' } },

  // ─── 岚图 ───
  { brand: '岚图', model: '梦想家', variant: '增程版', year: 2025, type: 'MPV', fuelType: 'PHEV', msrp: 269800, baseSpecs: { seats: 7, range_km: 1100, notes: '豪华电动MPV' } },
  { brand: '岚图', model: 'FREE', variant: '增程版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 229800, baseSpecs: { seats: 5, range_km: 1100, notes: '中大型增程SUV' } },

  // ─── 方程豹 ───
  { brand: '方程豹', model: '豹5', variant: '基础版', year: 2025, type: 'SUV', fuelType: 'PHEV', msrp: 289800, baseSpecs: { seats: 5, range_km: 1100, drivetrain: 'AWD', notes: '硬派越野增程SUV' } },
  { brand: '方程豹', model: '钛3', variant: '闪充版', year: 2026, type: 'SUV', fuelType: 'BEV', msrp: 153800, baseSpecs: { seats: 5, range_km: 620, notes: '方盒子纯电SUV' } },
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

const SUBSCRIPTION_PLANS = [
  {
    name: 'FREE',
    displayName: '免费版',
    price: 0,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 20,
    monthlyReportLimit: 0,
    monthlyTokenLimit: 100000,
    features: { basicChat: true },
    modelAccess: ['basic'],
    sortOrder: 0,
  },
  {
    name: 'PRO',
    displayName: 'Pro',
    price: 2900,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 200,
    monthlyReportLimit: 10,
    monthlyTokenLimit: 1000000,
    features: { basicChat: true, advancedChat: true, reports: true },
    modelAccess: ['basic', 'advanced'],
    sortOrder: 1,
  },
  {
    name: 'PREMIUM',
    displayName: 'Premium',
    price: 7900,
    billingCycle: 'MONTHLY',
    monthlyConversationLimit: 1000,
    monthlyReportLimit: 30,
    monthlyTokenLimit: 5000000,
    features: { basicChat: true, advancedChat: true, reports: true, priorityResponse: true },
    modelAccess: ['basic', 'advanced', 'best'],
    sortOrder: 2,
  },
];

async function upsertSubscriptionPlans() {
  for (const plan of SUBSCRIPTION_PLANS) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: {
        displayName: plan.displayName,
        price: plan.price,
        billingCycle: plan.billingCycle,
        monthlyConversationLimit: plan.monthlyConversationLimit,
        monthlyReportLimit: plan.monthlyReportLimit,
        monthlyTokenLimit: plan.monthlyTokenLimit,
        features: plan.features,
        modelAccess: plan.modelAccess,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
  }
  console.log(`Upserted ${SUBSCRIPTION_PLANS.length} subscription plans`);
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
  await upsertSubscriptionPlans();
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
