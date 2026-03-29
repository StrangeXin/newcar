import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getMemberNoActiveToken, getTestApp } from './helpers';

// Enable e2eMock so chat uses mock responses instead of real AI
process.env.AI_E2E_MOCK = '1';

describe('AI Chat API Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('POST /journeys/:journeyId/chat', () => {
    it('should return chat response with extractedSignals', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({ message: '30万左右的家用SUV' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
      expect(res.body).toHaveProperty('conversationId');
      expect(res.body).toHaveProperty('extractedSignals');
      expect(Array.isArray(res.body.extractedSignals)).toBe(true);
    });

    it('should return 400 when message is missing', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Message is required');
    });

    it('should return 404 for non-existent journey', async () => {
      const res = await getTestApp()
        .post('/journeys/nonexistent-journey-id/chat')
        .set(authHeader(getMemberToken()))
        .send({ message: 'hello' });

      expect(res.status).toBe(404);
    });

    it('should return 403 when user does not own journey', async () => {
      // activeJourney belongs to member, admin tries to access it
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getAdminToken()))
        .send({ message: 'hello' });

      expect(res.status).toBe(403);
    });

    it('should return 401 without auth token', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .send({ message: 'hello' });

      expect(res.status).toBe(401);
    });

    it('should return 403 when conversation quota exhausted', async () => {
      // Set used = limit (20 for FREE plan)
      await prisma.userSubscription.update({
        where: { id: TEST_IDS.memberSubscriptionId },
        data: { monthlyConversationsUsed: 20 },
      });

      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/chat`)
        .set(authHeader(getMemberToken()))
        .send({ message: 'hello' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CONVERSATION_QUOTA_EXCEEDED');
    });
  });
});
