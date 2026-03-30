import { beforeEach, describe, expect, it } from 'vitest';
import { TEST_IDS, seedTestData } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Journey CRUD Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('GET /journeys/active — returns active journey for member (200)', async () => {
    const app = getTestApp();
    const token = getMemberToken();

    const res = await app.get('/journeys/active').set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TEST_IDS.activeJourneyId);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('GET /journeys/active — returns 401 without auth', async () => {
    const app = getTestApp();

    const res = await app.get('/journeys/active');

    expect(res.status).toBe(401);
  });

  it('GET /journeys/:id/detail — returns detail for owner (200)', async () => {
    const app = getTestApp();
    const token = getMemberToken();

    const res = await app
      .get(`/journeys/${TEST_IDS.activeJourneyId}/detail`)
      .set(authHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(TEST_IDS.activeJourneyId);
  });

  it('GET /journeys/:id/detail — returns 403 for non-owner (admin accessing member journey)', async () => {
    const app = getTestApp();
    const token = getAdminToken();

    const res = await app
      .get(`/journeys/${TEST_IDS.activeJourneyId}/detail`)
      .set(authHeader(token));

    expect(res.status).toBe(403);
  });

  it('GET /journeys/:id/detail — returns 404 for non-existent journey', async () => {
    const app = getTestApp();
    const token = getMemberToken();

    const res = await app
      .get('/journeys/non-existent-journey-id/detail')
      .set(authHeader(token));

    expect(res.status).toBe(404);
  });

  it('PATCH /journeys/:id/stage — advance stage forward CONSIDERATION→COMPARISON (200)', async () => {
    const app = getTestApp();
    const token = getMemberToken();

    const res = await app
      .patch(`/journeys/${TEST_IDS.activeJourneyId}/stage`)
      .set(authHeader(token))
      .send({ targetStage: 'COMPARISON' });

    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('COMPARISON');
  });

  it('PATCH /journeys/:id/stage — reject backward stage CONSIDERATION→AWARENESS (400)', async () => {
    const app = getTestApp();
    const token = getMemberToken();

    const res = await app
      .patch(`/journeys/${TEST_IDS.activeJourneyId}/stage`)
      .set(authHeader(token))
      .send({ targetStage: 'AWARENESS' });

    expect(res.status).toBe(400);
  });

  it('POST /journeys/:id/events — record behavior event (201, uses x-session-id header)', async () => {
    const app = getTestApp();

    const res = await app
      .post(`/journeys/${TEST_IDS.activeJourneyId}/events`)
      .set('x-session-id', 'crud-test-session')
      .send({
        type: 'CAR_VIEW',
        targetType: 'CAR',
        targetId: TEST_IDS.carBevId,
        metadata: { duration_sec: 60 },
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
  });
});
