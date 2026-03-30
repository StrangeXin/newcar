import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Timeline Events API Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('GET /journeys/:journeyId/timeline', () => {
    it('should list timeline events for journey owner', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.events).toBeInstanceOf(Array);
    });
  });

  describe('POST /journeys/:journeyId/timeline', () => {
    it('should create a custom timeline event', async () => {
      const res = await getTestApp()
        .post(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
        .set(authHeader(getMemberToken()))
        .send({ type: 'USER_NOTE', content: '试驾体验非常好，加速很快' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.content).toBe('试驾体验非常好，加速很快');
    });
  });

  describe('GET /journeys/:journeyId/timeline (ownership)', () => {
    it('should deny access to non-owner', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/timeline`)
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(403);
    });
  });
});
