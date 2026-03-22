import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { publishService } from '../services/publish.service';
import { communityService } from '../services/community.service';
import { prisma } from '../lib/prisma';

const VALID_FORMATS = ['story', 'report', 'template'];

export class PublishedJourneyController {
  async publish(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const journeyId = req.params.id;
      const { title, description, publishedFormats, visibility = 'PUBLIC' } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      if (!publishedFormats || !Array.isArray(publishedFormats) || publishedFormats.length === 0) {
        return res.status(400).json({ error: 'publishedFormats must be a non-empty array' });
      }

      const invalidFormats = publishedFormats.filter(
        (f: string) => !VALID_FORMATS.includes(String(f).toLowerCase())
      );
      if (invalidFormats.length > 0) {
        return res.status(400).json({
          error: `Invalid publishedFormats: ${invalidFormats.join(', ')}. Valid values: ${VALID_FORMATS.join(', ')}`,
        });
      }

      // Verify journey belongs to user
      const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await publishService.publishJourney(journeyId, {
        title,
        description,
        publishedFormats,
        visibility,
      });

      void communityService.invalidateCommunityListCache();

      return res.status(201).json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async preview(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const journeyId = req.params.id;
      const formatsParam = req.query.formats as string;
      const publishedFormats = formatsParam ? formatsParam.split(',') : ['story'];

      const invalidFormats = publishedFormats.filter(
        (f: string) => !VALID_FORMATS.includes(f.toLowerCase())
      );
      if (invalidFormats.length > 0) {
        return res.status(400).json({
          error: `Invalid formats: ${invalidFormats.join(', ')}`,
        });
      }

      // Verify journey belongs to user
      const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await publishService.previewPublish(journeyId, publishedFormats);
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const { visibility, publishedFormats } = req.body;

      const published = await prisma.publishedJourney.findUnique({ where: { id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }
      if (published.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updateData: Record<string, any> = {};

      if (visibility !== undefined) {
        updateData.visibility = visibility;
      }

      if (publishedFormats !== undefined) {
        if (!Array.isArray(publishedFormats) || publishedFormats.length === 0) {
          return res.status(400).json({ error: 'publishedFormats must be a non-empty array' });
        }
        const invalidFormats = publishedFormats.filter(
          (f: string) => !VALID_FORMATS.includes(String(f).toLowerCase())
        );
        if (invalidFormats.length > 0) {
          return res.status(400).json({
            error: `Invalid publishedFormats: ${invalidFormats.join(', ')}`,
          });
        }
        updateData.publishedFormats = publishedFormats.map((f: string) => f.toLowerCase());
      }

      const result = await prisma.publishedJourney.update({
        where: { id },
        data: updateData,
      });

      void communityService.invalidateCommunityListCache();

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async unpublish(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      const published = await prisma.publishedJourney.findUnique({ where: { id } });
      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }
      if (published.userId !== userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await prisma.publishedJourney.update({
        where: { id },
        data: { contentStatus: 'AUTHOR_DELETED' },
      });

      void communityService.invalidateCommunityListCache();

      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async getOne(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;

      const published = await prisma.publishedJourney.findUnique({
        where: { id },
        include: {
          user: {
            select: { id: true, nickname: true, avatar: true },
          },
          journey: {
            select: { stage: true, status: true },
          },
        },
      });

      if (!published) {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      // Hide deleted/rejected content from public
      if (published.contentStatus === 'AUTHOR_DELETED' || published.contentStatus === 'REJECTED') {
        return res.status(404).json({ error: 'Published journey not found' });
      }

      // Increment view count (fire and forget)
      prisma.publishedJourney.update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {});

      return res.json(published);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }
}

export const publishedJourneyController = new PublishedJourneyController();
