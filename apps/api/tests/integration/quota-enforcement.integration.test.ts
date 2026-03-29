import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getMemberToken, getMemberNoActiveToken, getTestApp } from './helpers';

describe('Quota Enforcement Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('conversation quota', () => {
    it('should block when conversation quota exhausted', async () => {
      // Set used = limit (20 for FREE)
      await prisma.userSubscription.update({
        where: { id: TEST_IDS.memberSubscriptionId },
        data: { monthlyConversationsUsed: 20 },
      });

      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({ message: 'test' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CONVERSATION_QUOTA_EXCEEDED');
    });

    it('should not block when quota has remaining', async () => {
      // used < limit, middleware should pass (downstream may fail but not 403 quota)
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({ message: 'test' });

      expect(res.status).not.toBe(403);
    });

    it('should block user with no subscription', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberNoActiveToken()))
        .send({ message: 'test' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('NO_SUBSCRIPTION');
    });
  });

  describe('report quota', () => {
    it('should block FREE user from generating reports', async () => {
      const res = await getTestApp()
        .post(`/snapshots/${TEST_IDS.activeJourneyId}/snapshot`)
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('REPORT_NOT_AVAILABLE');
    });
  });

  describe('lazy reset', () => {
    it('should reset quota when monthlyResetAt is past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      await prisma.userSubscription.update({
        where: { id: TEST_IDS.memberSubscriptionId },
        data: {
          monthlyConversationsUsed: 20,
          monthlyReportsUsed: 0,
          monthlyTokensUsed: 50000,
          monthlyResetAt: pastDate,
        },
      });

      // Make a request that triggers getUserSubscription -> maybeResetQuota
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({ message: 'test' });

      // After lazy reset, quota should be 0 so request passes quota check
      expect(res.status).not.toBe(403);

      // Verify DB was reset
      const sub = await prisma.userSubscription.findUnique({
        where: { id: TEST_IDS.memberSubscriptionId },
      });
      expect(sub!.monthlyConversationsUsed).toBe(0);
      expect(sub!.monthlyTokensUsed).toBe(0);
      expect(sub!.monthlyResetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
