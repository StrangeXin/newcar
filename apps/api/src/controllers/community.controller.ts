import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { communityService } from '../services/community.service';
import { forkService } from '../services/fork.service';

function asStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export class CommunityController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const viewerJourney = req.userId
        ? await prisma.journey.findFirst({
            where: { userId: req.userId, status: 'ACTIVE' },
            select: { id: true },
          })
        : null;

      const data = await communityService.listJourneys(
        {
          carIds: asStringArray(req.query.car_ids),
          budgetMin: req.query.budget_min ? Number(req.query.budget_min) : undefined,
          budgetMax: req.query.budget_max ? Number(req.query.budget_max) : undefined,
          fuelType: req.query.fuel_type ? String(req.query.fuel_type) : undefined,
          useCases: asStringArray(req.query.use_cases),
          result: req.query.result ? (String(req.query.result) as 'purchased' | 'in_progress') : undefined,
          hasTemplate:
            req.query.has_template !== undefined ? String(req.query.has_template) === 'true' : undefined,
          sort: req.query.sort ? (String(req.query.sort) as 'relevance' | 'latest' | 'popular') : undefined,
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          offset: req.query.offset ? Number(req.query.offset) : undefined,
        },
        viewerJourney?.id
      );

      return res.json(data);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async detail(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await communityService.getJourneyDetail(req.params.id);
      if (!item) {
        return res.status(404).json({ error: 'Published journey not found' });
      }
      return res.json(item);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async like(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const id = req.params.id;
      const published = await prisma.publishedJourney.findUnique({ where: { id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      const existing = await prisma.notificationFeed.findFirst({
        where: {
          userId,
          journeyId: published.journeyId,
          type: 'COMMUNITY_LIKE',
        },
      });
      if (existing) {
        return res.json({ liked: true, alreadyExisted: true });
      }

      await prisma.notificationFeed.create({
        data: {
          userId,
          journeyId: published.journeyId,
          type: 'COMMUNITY_LIKE',
          title: '社区点赞',
          body: id,
        },
      });

      await prisma.publishedJourney.update({
        where: { id },
        data: { likeCount: { increment: 1 } },
      });

      void communityService.invalidateCommunityListCache();

      return res.json({ liked: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async unlike(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const id = req.params.id;
      const published = await prisma.publishedJourney.findUnique({ where: { id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      const existing = await prisma.notificationFeed.findFirst({
        where: {
          userId,
          journeyId: published.journeyId,
          type: 'COMMUNITY_LIKE',
        },
      });
      if (!existing) {
        return res.json({ liked: false, removed: false });
      }

      await prisma.notificationFeed.deleteMany({
        where: {
          userId,
          journeyId: published.journeyId,
          type: 'COMMUNITY_LIKE',
        },
      });

      if (published.likeCount > 0) {
        await prisma.publishedJourney.update({
          where: { id },
          data: { likeCount: { decrement: 1 } },
        });
      }

      void communityService.invalidateCommunityListCache();

      return res.json({ liked: false, removed: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async fork(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await forkService.forkJourney(req.params.id, req.userId!);
      void communityService.invalidateCommunityListCache();
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  async listComments(req: AuthenticatedRequest, res: Response) {
    try {
      const published = await prisma.publishedJourney.findUnique({ where: { id: req.params.id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      const comments = await prisma.notificationFeed.findMany({
        where: {
          journeyId: published.journeyId,
          type: 'COMMUNITY_COMMENT',
        },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: { id: true, nickname: true, avatar: true } } },
      });

      return res.json(comments);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async createComment(req: AuthenticatedRequest, res: Response) {
    try {
      const content = String(req.body?.content || '').trim();
      if (!content) {
        return res.status(400).json({ error: 'content is required' });
      }

      const published = await prisma.publishedJourney.findUnique({ where: { id: req.params.id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      const comment = await prisma.notificationFeed.create({
        data: {
          userId: req.userId!,
          journeyId: published.journeyId,
          type: 'COMMUNITY_COMMENT',
          title: '社区评论',
          body: content,
          metadata: { publishedJourneyId: req.params.id },
        },
      });

      await prisma.publishedJourney.update({
        where: { id: req.params.id },
        data: { commentCount: { increment: 1 } },
      });

      void communityService.invalidateCommunityListCache();

      return res.status(201).json(comment);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async report(req: AuthenticatedRequest, res: Response) {
    try {
      const reason = String(req.body?.reason || '').trim();
      if (!reason) {
        return res.status(400).json({ error: 'reason is required' });
      }

      const published = await prisma.publishedJourney.findUnique({ where: { id: req.params.id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      await prisma.notificationFeed.create({
        data: {
          userId: req.userId!,
          journeyId: published.journeyId,
          type: 'USER_REPORT',
          title: '用户举报',
          body: reason,
          metadata: { publishedJourneyId: req.params.id },
        },
      });

      return res.status(201).json({ success: true });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const communityController = new CommunityController();
