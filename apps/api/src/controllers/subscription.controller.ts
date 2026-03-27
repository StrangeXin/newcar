import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { subscriptionService } from '../services/subscription.service';

export class SubscriptionController {
  async getCurrentSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const sub = await subscriptionService.getUserSubscription(userId);

      if (!sub) {
        return res.status(404).json({ error: 'No active subscription' });
      }

      const quota = await subscriptionService.getQuotaStatus(userId);

      return res.json({ subscription: sub, quota });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async getPlans(_req: AuthenticatedRequest, res: Response) {
    try {
      const plans = await subscriptionService.getActivePlans();
      return res.json({ plans });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async upgradePlan(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { planName } = req.body;

      const sub = await subscriptionService.upgradePlan(userId, planName);
      const quota = await subscriptionService.getQuotaStatus(userId);

      return res.json({ subscription: sub, quota });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(400).json({ error: message });
    }
  }
}

export const subscriptionController = new SubscriptionController();
