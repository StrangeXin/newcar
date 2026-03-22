import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Moderation Flow Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should enforce moderation role permissions and actions', async () => {
    const app = getTestApp();

    const forbiddenQueueRes = await app
      .get('/admin/moderation/queue')
      .set(authHeader(getMemberToken()));
    expect(forbiddenQueueRes.status).toBe(403);

    const queueRes = await app
      .get('/admin/moderation/queue')
      .set(authHeader(getAdminToken()));
    expect(queueRes.status).toBe(200);
    expect(Array.isArray(queueRes.body.items)).toBe(true);

    const approveRes = await app
      .post(`/admin/moderation/${TEST_IDS.pendingPublishedJourneyId}/approve`)
      .set(authHeader(getAdminToken()));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.contentStatus).toBe('LIVE');

    const pending2 = await prisma.publishedJourney.create({
      data: {
        id: 'test-pending-published-journey-2',
        journeyId: TEST_IDS.extraJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'Pending 2',
        publishedFormats: ['story'],
        visibility: 'PUBLIC',
        contentStatus: 'PENDING_REVIEW',
        storyContent: 'pending 2',
      },
    });

    const rejectRes = await app
      .post(`/admin/moderation/${pending2.id}/reject`)
      .set(authHeader(getAdminToken()))
      .send({ reason: '内容违规' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.contentStatus).toBe('REJECTED');

    const featureRes = await app
      .post(`/admin/moderation/${TEST_IDS.publishedJourneyId}/feature`)
      .set(authHeader(getAdminToken()));
    expect(featureRes.status).toBe(200);
    expect(featureRes.body.featured).toBe(true);

    const reportRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/report`)
      .set(authHeader(getMemberToken()))
      .send({ reason: '广告内容' });
    expect([200, 201]).toContain(reportRes.status);

    const reportUnauthorizedRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/report`)
      .send({ reason: 'spam' });
    expect(reportUnauthorizedRes.status).toBe(401);
  });
});
