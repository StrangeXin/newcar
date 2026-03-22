import { beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { seedTestData } from '../../prisma/seed-test';
import { config } from '../../src/config';
import { prisma } from '../../src/lib/prisma';
import { authHeader, getAdminToken, getMemberToken, getTestApp } from './helpers';

describe('Auth Integration', () => {
  beforeEach(async () => {
    await seedTestData(prisma);
  });

  it('should reject protected endpoint without token', async () => {
    const app = getTestApp();
    const res = await app.get('/auth/users/me');
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTruthy();
  });

  it('should return user profile with valid member token', async () => {
    const app = getTestApp();
    const res = await app.get('/auth/users/me').set(authHeader(getMemberToken()));
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.role).toBe('MEMBER');
  });

  it('should return user profile with valid admin token', async () => {
    const app = getTestApp();
    const res = await app.get('/auth/users/me').set(authHeader(getAdminToken()));
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('ADMIN');
  });

  it('should refresh token with valid refresh token', async () => {
    const app = getTestApp();
    const refreshToken = jwt.sign(
      { userId: 'test-member-user', sessionId: 'refresh-session', type: 'refresh' },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    const refreshRes = await app.post('/auth/refresh').send({
      refreshToken,
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
  });
});
