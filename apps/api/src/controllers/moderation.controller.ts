import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { moderationService } from '../services/moderation.service';
import { communityService } from '../services/community.service';

export class ModerationController {
  async queue(req: AuthenticatedRequest, res: Response) {
    try {
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const result = await moderationService.getReviewQueue(page, limit);
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async approve(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await moderationService.approveContent(req.params.id);
      void communityService.invalidateCommunityListCache();
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async reject(req: AuthenticatedRequest, res: Response) {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }
      const result = await moderationService.rejectContent(req.params.id, reason);
      void communityService.invalidateCommunityListCache();
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async feature(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await prisma.publishedJourney.update({
        where: { id: req.params.id },
        data: { featured: true },
      });
      void communityService.invalidateCommunityListCache();
      return res.json(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
}

export const moderationController = new ModerationController();
