import { SubscriptionPlanName, SubscriptionStatus, SubscriptionSource } from '@newcar/shared';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

type UserSubscriptionWithPlan = Prisma.UserSubscriptionGetPayload<{ include: { plan: true } }>;

function getNextResetDate(from: Date): Date {
  const result = new Date(from);
  const targetMonth = result.getMonth() + 1;
  result.setMonth(targetMonth);
  // Clamp overflow (e.g. Jan 31 -> Feb 28, not Mar 3)
  if (result.getMonth() !== targetMonth % 12) {
    result.setDate(0); // last day of previous month
  }
  return result;
}

export class SubscriptionService {
  async getActivePlans() {
    return prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getUserSubscription(userId: string) {
    const sub = await prisma.userSubscription.findFirst({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });

    if (sub) {
      return this.maybeResetQuota(sub);
    }

    return sub;
  }

  async createFreeSubscription(userId: string) {
    const freePlan = await prisma.subscriptionPlan.findUnique({
      where: { name: SubscriptionPlanName.FREE },
    });

    if (!freePlan) {
      logger.warn('FREE plan not found in database, skipping subscription creation');
      return null;
    }

    return prisma.userSubscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: SubscriptionStatus.ACTIVE,
        monthlyResetAt: getNextResetDate(new Date()),
        source: SubscriptionSource.SYSTEM,
      },
      include: { plan: true },
    });
  }

  async upgradePlan(userId: string, targetPlanName: string) {
    const targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { name: targetPlanName },
    });

    if (!targetPlan || !targetPlan.isActive) {
      throw new Error('Target plan not found or inactive');
    }

    const currentSub = await this.getUserSubscription(userId);

    if (currentSub && currentSub.plan.sortOrder >= targetPlan.sortOrder) {
      throw new Error('Cannot downgrade or switch to same plan via upgrade endpoint');
    }

    return prisma.$transaction(async (tx) => {
      if (currentSub) {
        await tx.userSubscription.update({
          where: { id: currentSub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        });
      }

      return tx.userSubscription.create({
        data: {
          userId,
          planId: targetPlan.id,
          status: SubscriptionStatus.ACTIVE,
          monthlyConversationsUsed: currentSub?.monthlyConversationsUsed ?? 0,
          monthlyReportsUsed: currentSub?.monthlyReportsUsed ?? 0,
          monthlyTokensUsed: currentSub?.monthlyTokensUsed ?? 0,
          monthlyResetAt: currentSub?.monthlyResetAt ?? getNextResetDate(new Date()),
          source: SubscriptionSource.SYSTEM,
        },
        include: { plan: true },
      });
    });
  }

  async getQuotaStatus(userId: string) {
    const sub = await this.getUserSubscription(userId);
    if (!sub) {
      return null;
    }

    return {
      conversations: {
        used: sub.monthlyConversationsUsed,
        limit: sub.plan.monthlyConversationLimit,
        remaining: Math.max(0, sub.plan.monthlyConversationLimit - sub.monthlyConversationsUsed),
      },
      reports: {
        used: sub.monthlyReportsUsed,
        limit: sub.plan.monthlyReportLimit,
        remaining: Math.max(0, sub.plan.monthlyReportLimit - sub.monthlyReportsUsed),
      },
      tokens: {
        used: sub.monthlyTokensUsed,
        limit: sub.plan.monthlyTokenLimit,
        remaining: Math.max(0, sub.plan.monthlyTokenLimit - sub.monthlyTokensUsed),
      },
    };
  }

  async incrementConversationUsage(userId: string) {
    await prisma.userSubscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { monthlyConversationsUsed: { increment: 1 } },
    });
  }

  async incrementReportUsage(userId: string) {
    await prisma.userSubscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { monthlyReportsUsed: { increment: 1 } },
    });
  }

  async incrementTokenUsage(userId: string, tokens: number) {
    await prisma.userSubscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { monthlyTokensUsed: { increment: tokens } },
    });
  }

  private async maybeResetQuota(sub: UserSubscriptionWithPlan) {
    const now = new Date();
    if (now >= sub.monthlyResetAt) {
      const updated = await prisma.userSubscription.update({
        where: { id: sub.id },
        data: {
          monthlyConversationsUsed: 0,
          monthlyReportsUsed: 0,
          monthlyTokensUsed: 0,
          monthlyResetAt: getNextResetDate(now),
        },
        include: { plan: true },
      });
      return updated;
    }
    return sub;
  }
}

export const subscriptionService = new SubscriptionService();
