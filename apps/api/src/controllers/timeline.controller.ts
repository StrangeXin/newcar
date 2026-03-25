import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { timelineService } from '../services/timeline.service';

function normalizeLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, Math.min(Math.floor(parsed), 100));
}

async function assertJourneyOwner(journeyId: string, userId?: string) {
  const journey = await prisma.journey.findUnique({
    where: { id: journeyId },
    select: { userId: true },
  });

  if (!journey) {
    throw new Error('Journey not found');
  }
  if (!userId || journey.userId !== userId) {
    throw new Error('Forbidden');
  }
}

export class TimelineController {
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      await assertJourneyOwner(journeyId, req.userId);

      const events = await timelineService.listEvents(journeyId, {
        limit: normalizeLimit(req.query.limit),
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : undefined,
      });

      return res.json({ events });
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Journey not found' ? 404 : message === 'Forbidden' ? 403 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      await assertJourneyOwner(journeyId, req.userId);

      const { type, content, metadata } = req.body || {};
      if (!type || !content) {
        return res.status(400).json({ error: 'type and content are required' });
      }

      const event = await timelineService.createEvent({
        journeyId,
        type,
        content,
        metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
      });

      return res.status(201).json(event);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Journey not found' ? 404 : message === 'Forbidden' ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  }

  async get(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId, eventId } = req.params;
      await assertJourneyOwner(journeyId, req.userId);

      const event = await timelineService.getEvent(journeyId, eventId);
      if (!event) {
        return res.status(404).json({ error: 'Timeline event not found' });
      }

      return res.json(event);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Journey not found' ? 404 : message === 'Forbidden' ? 403 : 500;
      return res.status(status).json({ error: message });
    }
  }

  async update(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId, eventId } = req.params;
      await assertJourneyOwner(journeyId, req.userId);

      const { type, content, metadata } = req.body || {};
      const event = await timelineService.updateEvent(eventId, {
        ...(type ? { type } : {}),
        ...(content ? { content } : {}),
        ...(metadata && typeof metadata === 'object' ? { metadata } : {}),
      });

      return res.json(event);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Journey not found' ? 404 : message === 'Forbidden' ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  }

  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId, eventId } = req.params;
      await assertJourneyOwner(journeyId, req.userId);

      const event = await timelineService.deleteEvent(eventId);
      return res.json(event);
    } catch (error) {
      const message = (error as Error).message;
      const status = message === 'Journey not found' ? 404 : message === 'Forbidden' ? 403 : 400;
      return res.status(status).json({ error: message });
    }
  }
}

export const timelineController = new TimelineController();
