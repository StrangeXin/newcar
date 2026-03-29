import { PrismaClient } from '@prisma/client';

export const TEST_IDS = {
  adminUserId: 'test-admin-user',
  memberUserId: 'test-member-user',
  memberNoActiveUserId: 'test-member-no-active-user',
  activeJourneyId: 'test-active-journey',
  pendingJourneyId: 'test-pending-journey',
  extraJourneyId: 'test-extra-journey',
  publishedJourneyId: 'test-live-published-journey',
  pendingPublishedJourneyId: 'test-pending-published-journey',
  carBevId: 'test-car-bev',
  carPhevId: 'test-car-phev',
  carIceId: 'test-car-ice',
  freePlanId: 'test-plan-free',
  proPlanId: 'test-plan-pro',
  premiumPlanId: 'test-plan-premium',
  memberSubscriptionId: 'test-sub-member',
  adminSubscriptionId: 'test-sub-admin',
} as const;

export async function seedTestData(prisma: PrismaClient) {
  // Truncate all test tables with CASCADE to handle all FK constraints
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE notification_feeds, journey_forks, published_journeys,
    car_candidates, behavior_events, conversations, journey_snapshots,
    journeys, user_devices, ai_usage_logs, ai_conversation_usages,
    user_subscriptions, subscription_plans, users, cars
    RESTART IDENTITY CASCADE
  `);

  // Use individual upserts to avoid createMany concurrency issues
  await prisma.$transaction([
    prisma.user.upsert({
      where: { id: TEST_IDS.adminUserId },
      create: { id: TEST_IDS.adminUserId, phone: '13900000001', nickname: 'Test Admin', role: 'ADMIN' },
      update: { phone: '13900000001' },
    }),
    prisma.user.upsert({
      where: { id: TEST_IDS.memberUserId },
      create: { id: TEST_IDS.memberUserId, phone: '13900000002', nickname: 'Test Member', role: 'MEMBER' },
      update: { phone: '13900000002' },
    }),
    prisma.user.upsert({
      where: { id: TEST_IDS.memberNoActiveUserId },
      create: { id: TEST_IDS.memberNoActiveUserId, phone: '13900000003', nickname: 'Test Member 2', role: 'MEMBER' },
      update: { phone: '13900000003' },
    }),
    prisma.car.upsert({
      where: { id: TEST_IDS.carBevId },
      create: { id: TEST_IDS.carBevId, brand: 'Test', model: 'BEV One', variant: 'Base', year: 2024, type: 'SEDAN', fuelType: 'BEV', msrp: 200000 },
      update: { msrp: 200000 },
    }),
    prisma.car.upsert({
      where: { id: TEST_IDS.carPhevId },
      create: { id: TEST_IDS.carPhevId, brand: 'Test', model: 'PHEV One', variant: 'Base', year: 2024, type: 'SUV', fuelType: 'PHEV', msrp: 260000 },
      update: { msrp: 260000 },
    }),
    prisma.car.upsert({
      where: { id: TEST_IDS.carIceId },
      create: { id: TEST_IDS.carIceId, brand: 'Test', model: 'ICE One', variant: 'Base', year: 2024, type: 'SUV', fuelType: 'ICE', msrp: 180000 },
      update: { msrp: 180000 },
    }),
    prisma.journey.upsert({
      where: { id: TEST_IDS.activeJourneyId },
      create: {
        id: TEST_IDS.activeJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Test Active Journey',
        status: 'ACTIVE',
        stage: 'CONSIDERATION',
        requirements: { budgetMin: 18, budgetMax: 30, useCases: ['family', 'commute'], fuelTypePreference: ['BEV', 'PHEV'] },
      },
      update: { title: 'Test Active Journey' },
    }),
    prisma.journey.upsert({
      where: { id: TEST_IDS.pendingJourneyId },
      create: {
        id: TEST_IDS.pendingJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Test Pending Journey',
        status: 'COMPLETED',
        stage: 'AWARENESS',
        requirements: { budgetMin: 15, budgetMax: 20, useCases: ['commute'], fuelTypePreference: ['ICE'] },
      },
      update: { title: 'Test Pending Journey' },
    }),
    prisma.journey.upsert({
      where: { id: TEST_IDS.extraJourneyId },
      create: {
        id: TEST_IDS.extraJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Test Extra Journey',
        status: 'COMPLETED',
        stage: 'COMPARISON',
        requirements: { budgetMin: 20, budgetMax: 35, useCases: ['family'], fuelTypePreference: ['PHEV'] },
      },
      update: { title: 'Test Extra Journey' },
    }),
    prisma.carCandidate.upsert({
      where: { id: 'test-candidate-bev' },
      create: { id: 'test-candidate-bev', journeyId: TEST_IDS.activeJourneyId, carId: TEST_IDS.carBevId, status: 'ACTIVE', addedReason: 'AI_RECOMMENDED' },
      update: {},
    }),
    prisma.carCandidate.upsert({
      where: { id: 'test-candidate-phev' },
      create: { id: 'test-candidate-phev', journeyId: TEST_IDS.activeJourneyId, carId: TEST_IDS.carPhevId, status: 'ACTIVE', addedReason: 'AI_RECOMMENDED' },
      update: {},
    }),
    prisma.carCandidate.upsert({
      where: { id: 'test-candidate-extra' },
      create: { id: 'test-candidate-extra', journeyId: TEST_IDS.extraJourneyId, carId: TEST_IDS.carPhevId, status: 'ACTIVE', addedReason: 'AI_RECOMMENDED' },
      update: {},
    }),
    prisma.publishedJourney.upsert({
      where: { id: TEST_IDS.publishedJourneyId },
      create: {
        id: TEST_IDS.publishedJourneyId,
        journeyId: TEST_IDS.activeJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Test Live Published',
        description: 'for integration tests',
        publishedFormats: ['story', 'template'],
        tags: { carIds: [TEST_IDS.carBevId, TEST_IDS.carPhevId], fuelType: ['BEV', 'PHEV'], budgetMin: 18, budgetMax: 30, useCases: ['family'] },
        storyContent: 'test story',
        templateData: { candidateCarIds: [TEST_IDS.carBevId], dimensions: ['price', 'space'] },
        visibility: 'PUBLIC',
        contentStatus: 'LIVE',
      },
      update: { contentStatus: 'LIVE' },
    }),
    prisma.publishedJourney.upsert({
      where: { id: TEST_IDS.pendingPublishedJourneyId },
      create: {
        id: TEST_IDS.pendingPublishedJourneyId,
        journeyId: TEST_IDS.pendingJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Test Pending Published',
        description: 'pending moderation',
        publishedFormats: ['story'],
        tags: { carIds: [TEST_IDS.carIceId], fuelType: ['ICE'] },
        storyContent: 'pending story',
        visibility: 'PUBLIC',
        contentStatus: 'PENDING_REVIEW',
      },
      update: { contentStatus: 'PENDING_REVIEW' },
    }),
    prisma.userDevice.upsert({
      where: { id: 'test-device-member' },
      create: { id: 'test-device-member', userId: TEST_IDS.memberUserId, platform: 'WECHAT_MINIAPP', pushToken: 'openid-member-test' },
      update: { pushToken: 'openid-member-test' },
    }),
  ]);

  // Seed subscription plans and user subscriptions
  const futureReset = new Date();
  futureReset.setDate(futureReset.getDate() + 30);

  await prisma.$transaction([
    prisma.subscriptionPlan.upsert({
      where: { name: 'FREE' },
      create: {
        id: TEST_IDS.freePlanId, name: 'FREE', displayName: '免费版', price: 0, billingCycle: 'MONTHLY',
        monthlyConversationLimit: 20, monthlyReportLimit: 0, monthlyTokenLimit: 100000,
        features: { basicChat: true }, modelAccess: ['basic'], sortOrder: 0, isActive: true,
      },
      update: { id: TEST_IDS.freePlanId },
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'PRO' },
      create: {
        id: TEST_IDS.proPlanId, name: 'PRO', displayName: 'Pro', price: 2900, billingCycle: 'MONTHLY',
        monthlyConversationLimit: 200, monthlyReportLimit: 10, monthlyTokenLimit: 1000000,
        features: { basicChat: true, advancedChat: true, reports: true }, modelAccess: ['basic', 'advanced'], sortOrder: 1, isActive: true,
      },
      update: { id: TEST_IDS.proPlanId },
    }),
    prisma.subscriptionPlan.upsert({
      where: { name: 'PREMIUM' },
      create: {
        id: TEST_IDS.premiumPlanId, name: 'PREMIUM', displayName: 'Premium', price: 7900, billingCycle: 'MONTHLY',
        monthlyConversationLimit: 1000, monthlyReportLimit: 30, monthlyTokenLimit: 5000000,
        features: { basicChat: true, advancedChat: true, reports: true, priorityResponse: true }, modelAccess: ['basic', 'advanced', 'best'], sortOrder: 2, isActive: true,
      },
      update: { id: TEST_IDS.premiumPlanId },
    }),
    // member gets FREE subscription
    prisma.userSubscription.upsert({
      where: { id: TEST_IDS.memberSubscriptionId },
      create: {
        id: TEST_IDS.memberSubscriptionId, userId: TEST_IDS.memberUserId, planId: TEST_IDS.freePlanId,
        status: 'ACTIVE', monthlyResetAt: futureReset, source: 'SYSTEM',
      },
      update: { status: 'ACTIVE', monthlyResetAt: futureReset },
    }),
    // admin gets PRO subscription
    prisma.userSubscription.upsert({
      where: { id: TEST_IDS.adminSubscriptionId },
      create: {
        id: TEST_IDS.adminSubscriptionId, userId: TEST_IDS.adminUserId, planId: TEST_IDS.proPlanId,
        status: 'ACTIVE', monthlyResetAt: futureReset, source: 'SYSTEM',
      },
      update: { status: 'ACTIVE', monthlyResetAt: futureReset },
    }),
    // memberNoActive gets NO subscription
  ]);
}

async function main() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('Missing TEST_DATABASE_URL or DATABASE_URL');
  }

  const prisma = new PrismaClient({
    datasources: { db: { url } },
  });

  await seedTestData(prisma);
  await prisma.$disconnect();
  console.log('Seeded test database');
}

if (require.main === module) {
  void main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
