import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getMemberToken, getTestApp } from './helpers';

describe('Candidate Lifecycle Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should list journey candidates', async () => {
    const res = await getTestApp()
      .get(`/journeys/${TEST_IDS.activeJourneyId}/candidates`)
      .set(authHeader(getMemberToken()));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('should add a candidate car', async () => {
    const res = await getTestApp()
      .post(`/journeys/${TEST_IDS.activeJourneyId}/candidates`)
      .set(authHeader(getMemberToken()))
      .send({ carId: TEST_IDS.carIceId });

    expect([200, 201]).toContain(res.status);
  });

  it('should update candidate status to ELIMINATED', async () => {
    const res = await getTestApp()
      .patch(`/journeys/${TEST_IDS.activeJourneyId}/candidates/test-candidate-bev`)
      .set(authHeader(getMemberToken()))
      .send({ status: 'ELIMINATED' });

    expect(res.status).toBe(200);
  });

  it('should mark candidate as winner and eliminate others', async () => {
    const res = await getTestApp()
      .post(`/journeys/${TEST_IDS.activeJourneyId}/candidates/test-candidate-bev/winner`)
      .set(authHeader(getMemberToken()));

    expect(res.status).toBe(200);

    // Verify other candidates are ELIMINATED in the DB
    const others = await prisma.carCandidate.findMany({
      where: {
        journeyId: TEST_IDS.activeJourneyId,
        id: { not: 'test-candidate-bev' },
      },
    });
    for (const candidate of others) {
      expect(candidate.status).toBe('ELIMINATED');
    }
  });
});
