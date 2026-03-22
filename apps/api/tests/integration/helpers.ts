import request from 'supertest';
import { TEST_IDS } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';

export function getTestApp() {
  if (!globalThis.__integration_app) {
    throw new Error('Integration app not initialized');
  }
  return request(globalThis.__integration_app);
}

export function getMemberToken() {
  return globalThis.__integration_tokens?.member || '';
}

export function getAdminToken() {
  return globalThis.__integration_tokens?.admin || '';
}

export function getMemberNoActiveToken() {
  return globalThis.__integration_tokens?.memberNoActive || '';
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function seedJourney(userId: string) {
  return prisma.journey.create({
    data: {
      userId,
      title: 'Integration Seed Journey',
      status: 'ACTIVE',
      stage: 'AWARENESS',
      requirements: {
        budgetMin: 20,
        budgetMax: 30,
      },
    },
  });
}

export async function seedPublishedJourney(journeyId: string, formats: string[]) {
  return prisma.publishedJourney.create({
    data: {
      journeyId,
      userId: TEST_IDS.memberUserId,
      title: 'Integration Published Journey',
      publishedFormats: formats,
      visibility: 'PUBLIC',
      contentStatus: 'LIVE',
      storyContent: 'integration story',
    },
  });
}
