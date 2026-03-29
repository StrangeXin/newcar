import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getMemberNoActiveToken, getTestApp } from './helpers';

describe('Subscription API Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('GET /subscription/plans', () => {
    it('should return 3 active plans in sortOrder', async () => {
      const res = await getTestApp()
        .get('/subscription/plans')
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.plans).toHaveLength(3);
      expect(res.body.plans[0].name).toBe('FREE');
      expect(res.body.plans[1].name).toBe('PRO');
      expect(res.body.plans[2].name).toBe('PREMIUM');
    });
  });

  describe('GET /subscription/current', () => {
    it('should return FREE subscription for member', async () => {
      const res = await getTestApp()
        .get('/subscription/current')
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan.name).toBe('FREE');
      expect(res.body.quota).toBeDefined();
      expect(res.body.quota.conversations).toBeDefined();
    });

    it('should return 404 for user without subscription', async () => {
      const res = await getTestApp()
        .get('/subscription/current')
        .set(authHeader(getMemberNoActiveToken()));

      expect(res.status).toBe(404);
    });

    it('should return 401 without auth token', async () => {
      const res = await getTestApp()
        .get('/subscription/current');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /subscription/upgrade', () => {
    it('should upgrade member from FREE to PRO', async () => {
      const res = await getTestApp()
        .post('/subscription/upgrade')
        .set(authHeader(getMemberToken()))
        .send({ planName: 'PRO' });

      expect(res.status).toBe(200);
      expect(res.body.subscription.plan.name).toBe('PRO');

      // Verify old subscription is EXPIRED
      const oldSub = await prisma.userSubscription.findUnique({
        where: { id: TEST_IDS.memberSubscriptionId },
      });
      expect(oldSub!.status).toBe('EXPIRED');
    });

    it('should reject downgrade from PRO to FREE', async () => {
      const res = await getTestApp()
        .post('/subscription/upgrade')
        .set(authHeader(getAdminToken()))
        .send({ planName: 'FREE' });

      // Zod validation only allows 'PRO' or 'PREMIUM', so invalid planName returns 400
      expect(res.status).toBe(400);
    });

    it('should reject invalid planName', async () => {
      const res = await getTestApp()
        .post('/subscription/upgrade')
        .set(authHeader(getMemberToken()))
        .send({ planName: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('should preserve used quota after upgrade', async () => {
      // Set some usage first
      await prisma.userSubscription.update({
        where: { id: TEST_IDS.memberSubscriptionId },
        data: { monthlyConversationsUsed: 10, monthlyTokensUsed: 5000 },
      });

      const res = await getTestApp()
        .post('/subscription/upgrade')
        .set(authHeader(getMemberToken()))
        .send({ planName: 'PRO' });

      expect(res.status).toBe(200);
      const newSub = await prisma.userSubscription.findFirst({
        where: { userId: TEST_IDS.memberUserId, status: 'ACTIVE' },
      });
      expect(newSub!.monthlyConversationsUsed).toBe(10);
      expect(newSub!.monthlyTokensUsed).toBe(5000);
    });
  });
});
