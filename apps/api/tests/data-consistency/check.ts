import { PrismaClient } from '@prisma/client';

async function checkSingleActiveJourney(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<Array<{ userId: string; journeyIds: string[] }>>`
    SELECT "userId", array_agg(id) as "journeyIds"
    FROM journeys
    WHERE status = 'ACTIVE'
    GROUP BY "userId"
    HAVING COUNT(*) > 1
  `;

  if (rows.length === 0) {
    console.log('[CHECK 1] 每用户最多一条 ACTIVE 旅程\n  ✓ 通过：无违规用户');
    return 0;
  }

  console.log(`[CHECK 1] 每用户最多一条 ACTIVE 旅程\n  ✗ 违规：${rows.length} 个用户存在多条 ACTIVE 旅程`);
  for (const row of rows) {
    console.log(`    - userId: ${row.userId} -> journeys: [${row.journeyIds.join(', ')}]`);
  }
  return rows.length;
}

async function checkForkTemplateSource(prisma: PrismaClient) {
  const forks = await prisma.journeyFork.findMany({
    include: {
      sourcePublishedJourney: {
        select: {
          id: true,
          publishedFormats: true,
        },
      },
    },
  });

  const invalid = forks.filter((fork) => !fork.sourcePublishedJourney.publishedFormats.includes('template'));

  if (invalid.length === 0) {
    console.log('[CHECK 2] fork 必须来自含 template 形式的已发布历程\n  ✓ 通过：所有 fork 记录来源合法');
    return 0;
  }

  console.log(`[CHECK 2] fork 必须来自含 template 形式的已发布历程\n  ✗ 违规：${invalid.length} 条 fork 记录来源不含 template`);
  for (const fork of invalid) {
    console.log(
      `    - forkId: ${fork.id} -> sourcePublishedJourneyId: ${fork.sourcePublishedJourneyId} (formats: ${JSON.stringify(
        fork.sourcePublishedJourney.publishedFormats
      )})`
    );
  }
  return invalid.length;
}

async function checkNotificationDailyLimit(prisma: PrismaClient) {
  const rows = await prisma.$queryRaw<
    Array<{ journeyId: string; day: Date; cnt: bigint }>
  >`SELECT "journeyId", date_trunc('day', "createdAt") as day, COUNT(*)::bigint as cnt
     FROM notification_feeds
     WHERE "journeyId" IS NOT NULL
     GROUP BY "journeyId", date_trunc('day', "createdAt")
     HAVING COUNT(*) > 3`;

  if (rows.length === 0) {
    console.log('[CHECK 3] 每旅程每天通知不超过 3 条\n  ✓ 通过：无违规记录');
    return 0;
  }

  console.log(`[CHECK 3] 每旅程每天通知不超过 3 条\n  ✗ 违规：${rows.length} 个 journey 在某天通知超限`);
  for (const row of rows) {
    console.log(`    - journeyId: ${row.journeyId}, 日期: ${row.day.toISOString().slice(0, 10)}, 实际: ${Number(row.cnt)} 条`);
  }
  return rows.length;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const prisma = new PrismaClient({
    datasources: {
      db: { url },
    },
  });

  try {
    let violations = 0;
    violations += await checkSingleActiveJourney(prisma);
    violations += await checkForkTemplateSource(prisma);
    violations += await checkNotificationDailyLimit(prisma);

    console.log('\n=== 数据一致性检查结果 ===');
    console.log(`检查项目：3`);
    console.log(`违规项总数：${violations}`);

    if (violations > 0) {
      process.exit(1);
    }
    process.exit(0);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
