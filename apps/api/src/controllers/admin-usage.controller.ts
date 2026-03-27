import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiUsageService } from '../services/ai-usage.service';
import { prisma } from '../lib/prisma';

export class AdminUsageController {
  async getUsageSummary(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const { userId, startDate, endDate } = req.query;
      const summary = await aiUsageService.getUsageSummary({
        userId: userId as string | undefined,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });

      return res.json(summary);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getUsageDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const { userId, conversationId, cursor, limit } = req.query;
      const logs = await aiUsageService.getUsageDetails({
        userId: userId as string | undefined,
        conversationId: conversationId as string | undefined,
        cursor: cursor as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      return res.json({ logs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getSubscriptionDistribution(req: AuthenticatedRequest, res: Response) {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId } });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const distribution = await prisma.userSubscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: { id: true },
      });

      const plans = await prisma.subscriptionPlan.findMany();
      const planMap = new Map(plans.map((p) => [p.id, p]));

      const result = distribution.map((d) => ({
        plan: planMap.get(d.planId),
        count: d._count.id,
      }));

      return res.json({ distribution: result });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
}

export const adminUsageController = new AdminUsageController();
