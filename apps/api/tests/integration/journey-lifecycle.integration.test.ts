import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getMemberNoActiveToken, getTestApp } from './helpers';

describe('Journey Lifecycle Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should complete core journey lifecycle', async () => {
    const app = getTestApp();
    const token = getMemberNoActiveToken();
    const headers = authHeader(token);

    const createRes = await app
      .post('/journeys')
      .set(headers)
      .send({
        title: '购车旅程集成测试',
        requirements: {
          budgetMin: 20,
          budgetMax: 30,
          useCases: ['family'],
        },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeTruthy();
    expect(createRes.body.status).toBe('ACTIVE');
    const journeyId = createRes.body.id as string;

    const duplicateRes = await app
      .post('/journeys')
      .set(headers)
      .send({ title: '重复创建' });
    expect(duplicateRes.status).toBe(400);
    expect(duplicateRes.body.error).toBeTruthy();

    const detailRes = await app.get(`/journeys/${journeyId}/detail`).set(headers);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(journeyId);

    const chatRes = await app
      .post(`/journeys/${journeyId}/chat`)
      .set(headers)
      .send({ message: '我想买30万左右SUV' });
    expect(chatRes.status).toBe(200);
    expect(chatRes.body.message).toBeTruthy();

    const eventRes = await app
      .post(`/journeys/${journeyId}/events`)
      .set('x-session-id', 'integration-session')
      .send({
        type: 'CAR_VIEW',
        targetType: 'CAR',
        targetId: 'test-car-bev',
        metadata: { duration_sec: 120 },
      });
    expect(eventRes.status).toBe(201);
    expect(eventRes.body.id).toBeTruthy();

    const snapshotRes = await app
      .post(`/snapshots/${journeyId}/snapshot`)
      .set(headers)
      .send({});
    expect(snapshotRes.status).toBe(200);
    expect(snapshotRes.body.id).toBeTruthy();

    const getSnapshotRes = await app
      .get(`/snapshots/${journeyId}/snapshot`)
      .set(headers);
    expect(getSnapshotRes.status).toBe(200);
    expect(getSnapshotRes.body.id).toBeTruthy();

    const publishRes = await app
      .post(`/journeys/${journeyId}/publish`)
      .set(headers)
      .send({
        title: '集成测试发布',
        publishedFormats: ['story', 'template'],
        visibility: 'PUBLIC',
      });
    expect(publishRes.status).toBe(201);
    expect(['LIVE', 'PENDING_REVIEW']).toContain(publishRes.body.contentStatus);

    const getPublishedRes = await app.get(`/published-journeys/${publishRes.body.id}`);
    expect(getPublishedRes.status).toBe(200);
    expect(getPublishedRes.body.id).toBe(publishRes.body.id);
  });
});
