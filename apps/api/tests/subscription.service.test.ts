import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    subscriptionPlan: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    userSubscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('../src/lib/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { prisma } from '../src/lib/prisma';
import { SubscriptionService } from '../src/services/subscription.service';

const mockedPrisma = prisma as any;
let service: SubscriptionService;

const FREE_PLAN = {
  id: 'plan-free', name: 'FREE', displayName: '免费版', price: 0,
  monthlyConversationLimit: 20, monthlyReportLimit: 0, monthlyTokenLimit: 100000,
  sortOrder: 0, isActive: true,
};

const PRO_PLAN = {
  id: 'plan-pro', name: 'PRO', displayName: 'Pro', price: 2900,
  monthlyConversationLimit: 200, monthlyReportLimit: 10, monthlyTokenLimit: 1000000,
  sortOrder: 1, isActive: true,
};

const PREMIUM_PLAN = {
  id: 'plan-premium', name: 'PREMIUM', displayName: 'Premium', price: 7900,
  monthlyConversationLimit: 1000, monthlyReportLimit: 30, monthlyTokenLimit: 5000000,
  sortOrder: 2, isActive: true,
};

function makeSub(overrides: Record<string, unknown> = {}) {
  const futureReset = new Date();
  futureReset.setDate(futureReset.getDate() + 30);
  return {
    id: 'sub-1', userId: 'user-1', planId: FREE_PLAN.id, status: 'ACTIVE',
    monthlyConversationsUsed: 5, monthlyReportsUsed: 0, monthlyTokensUsed: 1000,
    monthlyResetAt: futureReset, plan: FREE_PLAN,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  service = new SubscriptionService();
});

describe('SubscriptionService', () => {
  describe('getActivePlans', () => {
    it('should return active plans sorted by sortOrder', async () => {
      mockedPrisma.subscriptionPlan.findMany.mockResolvedValue([FREE_PLAN, PRO_PLAN, PREMIUM_PLAN]);

      const result = await service.getActivePlans();

      expect(mockedPrisma.subscriptionPlan.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('FREE');
    });
  });

  describe('getUserSubscription', () => {
    it('should return subscription with plan when ACTIVE exists', async () => {
      const sub = makeSub();
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(sub);

      const result = await service.getUserSubscription('user-1');

      expect(mockedPrisma.userSubscription.findFirst).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
        include: { plan: true },
      });
      expect(result).toEqual(sub);
    });

    it('should return null when no subscription exists', async () => {
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(null);

      const result = await service.getUserSubscription('user-1');

      expect(result).toBeNull();
    });

    it('should trigger lazy reset when monthlyResetAt is past', async () => {
      const pastReset = new Date();
      pastReset.setDate(pastReset.getDate() - 5);
      const sub = makeSub({ monthlyResetAt: pastReset, monthlyConversationsUsed: 15 });
      const resetSub = { ...sub, monthlyConversationsUsed: 0, monthlyReportsUsed: 0, monthlyTokensUsed: 0 };

      mockedPrisma.userSubscription.findFirst.mockResolvedValue(sub);
      mockedPrisma.userSubscription.update.mockResolvedValue(resetSub);

      const result = await service.getUserSubscription('user-1');

      expect(mockedPrisma.userSubscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sub.id },
          data: expect.objectContaining({
            monthlyConversationsUsed: 0,
            monthlyReportsUsed: 0,
            monthlyTokensUsed: 0,
          }),
        })
      );
      expect(result!.monthlyConversationsUsed).toBe(0);
    });
  });

  describe('createFreeSubscription', () => {
    it('should create subscription when FREE plan exists', async () => {
      const createdSub = makeSub();
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(FREE_PLAN);
      mockedPrisma.userSubscription.create.mockResolvedValue(createdSub);

      const result = await service.createFreeSubscription('user-1');

      expect(mockedPrisma.subscriptionPlan.findUnique).toHaveBeenCalledWith({
        where: { name: 'FREE' },
      });
      expect(mockedPrisma.userSubscription.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            planId: FREE_PLAN.id,
            status: 'ACTIVE',
            source: 'SYSTEM',
          }),
        })
      );
      expect(result).toEqual(createdSub);
    });

    it('should return null when FREE plan does not exist', async () => {
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      const result = await service.createFreeSubscription('user-1');

      expect(result).toBeNull();
      expect(mockedPrisma.userSubscription.create).not.toHaveBeenCalled();
    });
  });

  describe('upgradePlan', () => {
    it('should deactivate old subscription and create new one in transaction', async () => {
      const currentSub = makeSub();
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(PRO_PLAN);
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(currentSub);

      const newSub = makeSub({ id: 'sub-2', planId: PRO_PLAN.id, plan: PRO_PLAN });
      mockedPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          userSubscription: {
            update: vi.fn().mockResolvedValue({ ...currentSub, status: 'EXPIRED' }),
            create: vi.fn().mockResolvedValue(newSub),
          },
        };
        return fn(tx);
      });

      const result = await service.upgradePlan('user-1', 'PRO');

      expect(result).toEqual(newSub);
    });

    it('should throw on downgrade request', async () => {
      const currentSub = makeSub({ plan: PRO_PLAN, planId: PRO_PLAN.id });
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(FREE_PLAN);
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(currentSub);

      await expect(service.upgradePlan('user-1', 'FREE')).rejects.toThrow(
        'Cannot downgrade or switch to same plan via upgrade endpoint'
      );
    });

    it('should throw when target plan does not exist', async () => {
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(null);

      await expect(service.upgradePlan('user-1', 'INVALID')).rejects.toThrow(
        'Target plan not found or inactive'
      );
    });

    it('should create directly when no current subscription', async () => {
      mockedPrisma.subscriptionPlan.findUnique.mockResolvedValue(PRO_PLAN);
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(null);

      const newSub = makeSub({ plan: PRO_PLAN });
      mockedPrisma.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          userSubscription: {
            update: vi.fn(),
            create: vi.fn().mockResolvedValue(newSub),
          },
        };
        return fn(tx);
      });

      const result = await service.upgradePlan('user-1', 'PRO');

      expect(result).toEqual(newSub);
    });
  });

  describe('getQuotaStatus', () => {
    it('should calculate remaining = max(0, limit - used)', async () => {
      const sub = makeSub({ monthlyConversationsUsed: 15 });
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(sub);

      const result = await service.getQuotaStatus('user-1');

      expect(result).toEqual({
        conversations: { used: 15, limit: 20, remaining: 5 },
        reports: { used: 0, limit: 0, remaining: 0 },
        tokens: { used: 1000, limit: 100000, remaining: 99000 },
      });
    });

    it('should return null when no subscription', async () => {
      mockedPrisma.userSubscription.findFirst.mockResolvedValue(null);

      const result = await service.getQuotaStatus('user-1');

      expect(result).toBeNull();
    });
  });

  describe('incrementConversationUsage', () => {
    it('should call updateMany with increment: 1', async () => {
      mockedPrisma.userSubscription.updateMany.mockResolvedValue({ count: 1 });

      await service.incrementConversationUsage('user-1');

      expect(mockedPrisma.userSubscription.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
        data: { monthlyConversationsUsed: { increment: 1 } },
      });
    });
  });

  describe('incrementTokenUsage', () => {
    it('should call updateMany with increment: tokens', async () => {
      mockedPrisma.userSubscription.updateMany.mockResolvedValue({ count: 1 });

      await service.incrementTokenUsage('user-1', 500);

      expect(mockedPrisma.userSubscription.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', status: 'ACTIVE' },
        data: { monthlyTokensUsed: { increment: 500 } },
      });
    });
  });
});
