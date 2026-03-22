import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CommunitySeed = {
  key: string;
  user: { phone: string; nickname: string; city: string };
  journey: { title: string; requirements: Record<string, unknown>; status: string };
  published: {
    title: string;
    description: string;
    formats: string[];
    tags: Record<string, unknown>;
    storyContent?: string;
    reportData?: Record<string, unknown>;
    templateData?: Record<string, unknown>;
  };
  cars: Array<{ brand: string; model: string }>;
};

const SEEDS: CommunitySeed[] = [
  {
    key: 'family-suv',
    user: { phone: '13800000001', nickname: '二孩家庭爸爸', city: '上海' },
    journey: {
      title: '二孩家庭 25-30 万 SUV 选车',
      requirements: { budgetMin: 25, budgetMax: 30, useCases: ['family'], fuelTypePreference: ['PHEV'] },
      status: 'COMPLETED',
    },
    published: {
      title: '理想 L6：二孩家庭的稳妥选择',
      description: '关注空间、补能与全家舒适性，最终在 L6 与 M7 之间做出取舍。',
      formats: ['story', 'report', 'template'],
      tags: { budgetMin: 25, budgetMax: 30, useCases: ['family'], fuelType: ['PHEV'] },
      storyContent: '从最初担心后排和后备箱，到最终试驾后确认舒适性，L6 是兼顾全家的平衡方案。',
      reportData: { finalChoice: '理想 L6', confidence: 0.86 },
      templateData: { candidateCarIds: [], dimensions: ['空间', '舒适', '补能'], keyQuestions: ['后排舒适吗?'] },
    },
    cars: [
      { brand: '理想', model: 'L6' },
      { brand: '问界', model: 'M7 Plus' },
    ],
  },
  {
    key: 'city-first-bev',
    user: { phone: '13800000002', nickname: '首购通勤党', city: '杭州' },
    journey: {
      title: '15-20 万首购新能源',
      requirements: { budgetMin: 15, budgetMax: 20, useCases: ['commute'], fuelTypePreference: ['BEV'] },
      status: 'COMPLETED',
    },
    published: {
      title: '首购新能源：海豹 EV 的取舍',
      description: '城市通勤为主，重点比较能耗、车机和座舱体验。',
      formats: ['story', 'report'],
      tags: { budgetMin: 15, budgetMax: 20, useCases: ['commute'], fuelType: ['BEV'] },
      storyContent: '在海豹 EV 与宋 Pro DM-i 之间，最终选了驾驶感更好的海豹 EV。',
      reportData: { finalChoice: '比亚迪 海豹 EV', confidence: 0.79 },
    },
    cars: [{ brand: '比亚迪', model: '海豹 EV' }],
  },
  {
    key: 'switch-to-bev',
    user: { phone: '13800000003', nickname: '换购用户', city: '南京' },
    journey: {
      title: '从燃油换购到纯电',
      requirements: { budgetMin: 20, budgetMax: 25, useCases: ['commute', 'travel'], fuelTypePreference: ['BEV'] },
      status: 'COMPLETED',
    },
    published: {
      title: '从燃油到纯电：小鹏 G6 体验',
      description: '从补能焦虑到使用习惯迁移，重点关注续航与空间。',
      formats: ['story', 'template'],
      tags: { budgetMin: 20, budgetMax: 25, useCases: ['commute', 'travel'], fuelType: ['BEV'] },
      storyContent: '换购后最大的变化是通勤成本与加速体验，G6 在空间和智驾上都足够均衡。',
      templateData: { candidateCarIds: [], dimensions: ['续航', '补能', '空间'], keyQuestions: ['家充条件是否满足?'] },
    },
    cars: [{ brand: '小鹏', model: 'G6' }],
  },
  {
    key: 'business-mpv',
    user: { phone: '13800000004', nickname: '商务出行', city: '北京' },
    journey: {
      title: '30-40 万商务出行',
      requirements: { budgetMin: 30, budgetMax: 40, useCases: ['business'], fuelTypePreference: ['PHEV'] },
      status: 'ACTIVE',
    },
    published: {
      title: '商务出行视角：问界 M9 评估',
      description: '围绕二排舒适与品牌稳定性做结构化评估。',
      formats: ['report', 'template'],
      tags: { budgetMin: 30, budgetMax: 40, useCases: ['business'], fuelType: ['PHEV'] },
      reportData: { finalChoice: '问界 M9', confidence: 0.72 },
      templateData: { candidateCarIds: [], dimensions: ['舒适', '品牌', '服务'], keyQuestions: ['二排空间是否足够?'] },
    },
    cars: [{ brand: '问界', model: 'M9' }],
  },
  {
    key: 'rural-mixed',
    user: { phone: '13800000005', nickname: '乡镇用户', city: '成都' },
    journey: {
      title: '15 万以内兼顾越野',
      requirements: { budgetMin: 10, budgetMax: 15, useCases: ['travel', 'family'], fuelTypePreference: ['PHEV'] },
      status: 'ACTIVE',
    },
    published: {
      title: '乡镇路况下的宋 Pro DM-i 选择',
      description: '考虑路况、油耗和维保便利性。',
      formats: ['story'],
      tags: { budgetMin: 10, budgetMax: 15, useCases: ['travel', 'family'], fuelType: ['PHEV'] },
      storyContent: '预算有限且路况复杂，最终选择了兼顾经济性和通过性的 DM-i 方案。',
    },
    cars: [{ brand: '比亚迪', model: '宋Pro DM-i' }],
  },
];

async function main() {
  for (const seed of SEEDS) {
    const user = await prisma.user.upsert({
      where: { phone: seed.user.phone },
      update: { nickname: seed.user.nickname, city: seed.user.city },
      create: {
        phone: seed.user.phone,
        nickname: seed.user.nickname,
        city: seed.user.city,
      },
    });

    const journeyId = `seed-journey-${seed.key}`;
    const publishedId = `seed-published-${seed.key}`;

    await prisma.journey.upsert({
      where: { id: journeyId },
      update: {
        title: seed.journey.title,
        requirements: seed.journey.requirements,
        status: seed.journey.status,
      },
      create: {
        id: journeyId,
        userId: user.id,
        title: seed.journey.title,
        requirements: seed.journey.requirements,
        status: seed.journey.status,
      },
    });

    const candidateCarIds: string[] = [];
    for (const lookup of seed.cars) {
      const car = await prisma.car.findFirst({
        where: { brand: lookup.brand, model: lookup.model },
        select: { id: true },
      });
      if (car) {
        candidateCarIds.push(car.id);
        await prisma.carCandidate.upsert({
          where: { id: `seed-candidate-${seed.key}-${car.id}` },
          update: {},
          create: {
            id: `seed-candidate-${seed.key}-${car.id}`,
            journeyId,
            carId: car.id,
            status: 'ACTIVE',
            addedReason: 'FROM_TEMPLATE',
          },
        });
      }
    }

    const tags = {
      ...(seed.published.tags || {}),
      carIds: candidateCarIds,
    };

    const templateData = seed.published.templateData
      ? {
          ...seed.published.templateData,
          candidateCarIds,
        }
      : null;

    await prisma.publishedJourney.upsert({
      where: { id: publishedId },
      update: {
        userId: user.id,
        journeyId,
        title: seed.published.title,
        description: seed.published.description,
        publishedFormats: seed.published.formats,
        tags,
        storyContent: seed.published.storyContent || null,
        reportData: seed.published.reportData || null,
        templateData,
        visibility: 'PUBLIC',
        contentStatus: 'LIVE',
      },
      create: {
        id: publishedId,
        userId: user.id,
        journeyId,
        title: seed.published.title,
        description: seed.published.description,
        publishedFormats: seed.published.formats,
        tags,
        storyContent: seed.published.storyContent || null,
        reportData: seed.published.reportData || null,
        templateData,
        visibility: 'PUBLIC',
        contentStatus: 'LIVE',
      },
    });
  }

  console.log(`Seeded community content: ${SEEDS.length} published journeys`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
