import { beforeEach, describe, expect, it } from 'vitest';
import { seedTestData } from '../../prisma/seed-test';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Admin Usage API Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  describe('GET /admin/usage/summary', () => {
    it('should return usage summary for admin', async () => {
      const res = await getTestApp()
        .get('/admin/usage/summary')
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalRequests');
      expect(res.body).toHaveProperty('totalInputTokens');
      expect(res.body).toHaveProperty('totalOutputTokens');
    });

    it('should return 403 for non-admin user', async () => {
      const res = await getTestApp()
        .get('/admin/usage/summary')
        .set(authHeader(getMemberToken()));

      expect(res.status).toBe(403);
    });
  });

  describe('GET /admin/usage/details', () => {
    it('should return usage details for admin', async () => {
      const res = await getTestApp()
        .get('/admin/usage/details')
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('logs');
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  describe('GET /admin/usage/subscriptions', () => {
    it('should return subscription distribution for admin', async () => {
      const res = await getTestApp()
        .get('/admin/usage/subscriptions')
        .set(authHeader(getAdminToken()));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('distribution');
      expect(Array.isArray(res.body.distribution)).toBe(true);
    });
  });
});
