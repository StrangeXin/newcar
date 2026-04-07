import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { subscriptionService } from '../services/subscription.service';

type QuotaType = 'conversation' | 'report';

function createQuotaMiddleware(quotaType: QuotaType) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (process.env.AI_E2E_MOCK === '1' && req.headers['x-test-auth'] === 'e2e-test-token') {
      return next();
    }

    const sub = await subscriptionService.getUserSubscription(userId);
    if (!sub) {
      return res.status(403).json({
        error: 'No active subscription',
        code: 'NO_SUBSCRIPTION',
      });
    }

    if (quotaType === 'conversation') {
      if (sub.monthlyConversationsUsed >= sub.plan.monthlyConversationLimit) {
        return res.status(403).json({
          error: '本月对话次数已用完，下月自动重置，或升级套餐获得更多次数',
          code: 'CONVERSATION_QUOTA_EXCEEDED',
          quota: {
            used: sub.monthlyConversationsUsed,
            limit: sub.plan.monthlyConversationLimit,
          },
          currentPlan: sub.plan.name,
        });
      }
    }

    if (quotaType === 'report') {
      if (sub.plan.monthlyReportLimit === 0) {
        return res.status(403).json({
          error: '升级到 Pro 解锁分析报告',
          code: 'REPORT_NOT_AVAILABLE',
          currentPlan: sub.plan.name,
        });
      }
      if (sub.monthlyReportsUsed >= sub.plan.monthlyReportLimit) {
        return res.status(403).json({
          error: '本月报告份数已用完',
          code: 'REPORT_QUOTA_EXCEEDED',
          quota: {
            used: sub.monthlyReportsUsed,
            limit: sub.plan.monthlyReportLimit,
          },
          currentPlan: sub.plan.name,
        });
      }
    }

    return next();
  };
}

export const conversationQuota = createQuotaMiddleware('conversation');
export const reportQuota = createQuotaMiddleware('report');
