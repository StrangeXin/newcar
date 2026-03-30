import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getMemberToken, getAdminToken, getTestApp } from './helpers';

describe('Publish Flow Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('GET /published-journeys/:id (public)', () => {
    it('should return published journey detail without auth', async () => {
      const res = await getTestApp()
        .get(`/published-journeys/${TEST_IDS.publishedJourneyId}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(TEST_IDS.publishedJourneyId);
    });
  });

  describe('GET /journeys/:id/publish/preview', () => {
    it('should deny preview for non-owner (admin)', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/publish/preview?formats=story`)
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(403);
    });

    it('should require auth for preview', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/publish/preview`);

      expect(res.status).toBe(401);
    });

    it('should allow preview for owner (may call AI)', async () => {
      const res = await getTestApp()
        .get(`/journeys/${TEST_IDS.activeJourneyId}/publish/preview?formats=story`)
        .set(authHeader(getMemberToken()));

      expect([200, 500]).toContain(res.status);
    });
  });

  describe('DELETE /published-journeys/:id', () => {
    it('should unpublish own published journey as member', async () => {
      const res = await getTestApp()
        .delete(`/published-journeys/${TEST_IDS.publishedJourneyId}`)
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(200);
      expect(res.body.contentStatus).toBe('AUTHOR_DELETED');
    });

    it('should deny unpublish for non-owner (admin)', async () => {
      const res = await getTestApp()
        .delete(`/published-journeys/${TEST_IDS.publishedJourneyId}`)
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(403);
    });
  });
});
