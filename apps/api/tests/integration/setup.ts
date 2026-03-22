import jwt from 'jsonwebtoken';
import { beforeAll, vi } from 'vitest';
import { seedTestData, TEST_IDS } from '../../prisma/seed-test';

declare global {
  // eslint-disable-next-line no-var
  var __integration_app: import('express').Express | undefined;
  // eslint-disable-next-line no-var
  var __integration_tokens:
    | {
        admin: string;
        member: string;
        memberNoActive: string;
      }
    | undefined;
}

const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"narrative_summary":"mock snapshot","key_insights":[]}' }],
      }),
    },
  })),
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

if (!hasTestDb) {
  // eslint-disable-next-line no-console
  console.warn('[integration] TEST_DATABASE_URL not set, integration tests may fail if they touch DB.');
}

beforeAll(async () => {
  if (!hasTestDb) {
    return;
  }

  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ createApp }, { config }, { prisma }] = await Promise.all([
    import('../../src/app'),
    import('../../src/config'),
    import('../../src/lib/prisma'),
  ]);

  await seedTestData(prisma);

  globalThis.__integration_app = createApp();
  globalThis.__integration_tokens = {
    admin: jwt.sign(
      { userId: TEST_IDS.adminUserId, sessionId: 'integration-admin-session', type: 'access' },
      config.jwt.secret,
      { expiresIn: '1h' }
    ),
    member: jwt.sign(
      { userId: TEST_IDS.memberUserId, sessionId: 'integration-member-session', type: 'access' },
      config.jwt.secret,
      { expiresIn: '1h' }
    ),
    memberNoActive: jwt.sign(
      { userId: TEST_IDS.memberNoActiveUserId, sessionId: 'integration-member2-session', type: 'access' },
      config.jwt.secret,
      { expiresIn: '1h' }
    ),
  };
});
