import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import {
  authHeader,
  getMemberNoActiveToken,
  getMemberToken,
  getTestApp,
} from './helpers';

describe('Community Flow Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should support list, filter, like, comment and fork flow', async () => {
    const app = getTestApp();

    const listRes = await app.get('/community');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body.items)).toBe(true);
    expect(listRes.body.total).toBeGreaterThanOrEqual(1);

    const filterRes = await app.get('/community?fuel_type=BEV');
    expect(filterRes.status).toBe(200);

    const latestRes = await app.get('/community?sort=latest');
    expect(latestRes.status).toBe(200);
    expect(Array.isArray(latestRes.body.items)).toBe(true);

    const detail1 = await app.get(`/community/${TEST_IDS.publishedJourneyId}`);
    expect(detail1.status).toBe(200);
    const prevView = detail1.body.viewCount as number;
    const detail2 = await app.get(`/community/${TEST_IDS.publishedJourneyId}`);
    expect(detail2.status).toBe(200);
    expect(detail2.body.viewCount).toBeGreaterThanOrEqual(prevView + 1);

    const likeRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/like`)
      .set(authHeader(getMemberToken()));
    expect(likeRes.status).toBe(200);

    const likeAgainRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/like`)
      .set(authHeader(getMemberToken()));
    expect([200, 409]).toContain(likeAgainRes.status);

    const unlikeRes = await app
      .delete(`/community/${TEST_IDS.publishedJourneyId}/like`)
      .set(authHeader(getMemberToken()));
    expect(unlikeRes.status).toBe(200);

    const commentRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/comments`)
      .set(authHeader(getMemberToken()))
      .send({ content: '很有参考价值' });
    expect(commentRes.status).toBe(201);

    const commentsRes = await app.get(`/community/${TEST_IDS.publishedJourneyId}/comments`);
    expect(commentsRes.status).toBe(200);
    expect(Array.isArray(commentsRes.body)).toBe(true);

    const forkRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/fork`)
      .set(authHeader(getMemberNoActiveToken()));
    expect(forkRes.status).toBe(201);
    expect(forkRes.body.journeyId).toBeTruthy();

    const forkAgainRes = await app
      .post(`/community/${TEST_IDS.publishedJourneyId}/fork`)
      .set(authHeader(getMemberNoActiveToken()));
    expect([400, 409]).toContain(forkAgainRes.status);
  });

  it('should reject fork for non-template published content', async () => {
    const app = getTestApp();

    const noTemplate = await prisma.publishedJourney.create({
      data: {
        id: 'test-published-no-template',
        journeyId: TEST_IDS.extraJourneyId,
        userId: TEST_IDS.memberUserId,
        title: 'No Template',
        publishedFormats: ['story'],
        visibility: 'PUBLIC',
        contentStatus: 'LIVE',
        storyContent: 'story',
      },
    });

    const res = await app
      .post(`/community/${noTemplate.id}/fork`)
      .set(authHeader(getMemberNoActiveToken()));
    expect([400, 409]).toContain(res.status);
    expect(String(res.body.error || '')).toMatch(/template/i);
  });
});
