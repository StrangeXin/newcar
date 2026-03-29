import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/subscription.service', () => ({
  subscriptionService: {
    getUserSubscription: vi.fn(),
  },
}));

import { subscriptionService } from '../src/services/subscription.service';
import { conversationQuota, reportQuota } from '../src/middleware/quota';

const mockedService = subscriptionService as any;

function mockReqResNext(overrides: Record<string, unknown> = {}) {
  const req = { userId: 'user-1', ...overrides } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

const FREE_PLAN = {
  name: 'FREE', monthlyConversationLimit: 20, monthlyReportLimit: 0,
};

const PRO_PLAN = {
  name: 'PRO', monthlyConversationLimit: 200, monthlyReportLimit: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('conversationQuota middleware', () => {
  it('should return 401 when no userId', async () => {
    const { req, res, next } = mockReqResNext({ userId: undefined });

    await conversationQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 NO_SUBSCRIPTION when no subscription', async () => {
    const { req, res, next } = mockReqResNext();
    mockedService.getUserSubscription.mockResolvedValue(null);

    await conversationQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NO_SUBSCRIPTION' }));
  });

  it('should call next() when quota not exceeded', async () => {
    const { req, res, next } = mockReqResNext();
    mockedService.getUserSubscription.mockResolvedValue({
      monthlyConversationsUsed: 10, plan: FREE_PLAN,
    });

    await conversationQuota(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 CONVERSATION_QUOTA_EXCEEDED when used >= limit', async () => {
    const { req, res, next } = mockReqResNext();
    mockedService.getUserSubscription.mockResolvedValue({
      monthlyConversationsUsed: 20, plan: FREE_PLAN,
    });

    await conversationQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'CONVERSATION_QUOTA_EXCEEDED',
      quota: { used: 20, limit: 20 },
    }));
  });
});

describe('reportQuota middleware', () => {
  it('should return 403 REPORT_NOT_AVAILABLE when limit=0 (FREE plan)', async () => {
    const { req, res, next } = mockReqResNext();
    mockedService.getUserSubscription.mockResolvedValue({
      monthlyReportsUsed: 0, plan: FREE_PLAN,
    });

    await reportQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'REPORT_NOT_AVAILABLE' }));
  });

  it('should return 403 REPORT_QUOTA_EXCEEDED when used >= limit', async () => {
    const { req, res, next } = mockReqResNext();
    mockedService.getUserSubscription.mockResolvedValue({
      monthlyReportsUsed: 10, plan: PRO_PLAN,
    });

    await reportQuota(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'REPORT_QUOTA_EXCEEDED',
      quota: { used: 10, limit: 10 },
    }));
  });
});
