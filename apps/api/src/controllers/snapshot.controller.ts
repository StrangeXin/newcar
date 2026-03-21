import { Response } from 'express';
import { SnapshotTrigger } from '@newcar/shared';
import { AuthenticatedRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { journeyService } from '../services/journey.service';
import { snapshotService } from '../services/snapshot.service';

export class SnapshotController {
  async generateSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { trigger } = req.query;

      const journey = await journeyService.getJourneyDetail(journeyId);
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const snapshot = await snapshotService.generateSnapshot(
        journeyId,
        (trigger as SnapshotTrigger) || SnapshotTrigger.MANUAL,
        req.headers['accept-language'] as string | undefined
      );

      return res.json(snapshot);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getLatestSnapshot(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;

      const journey = await journeyService.getJourneyDetail(journeyId);
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const snapshot = await prisma.journeySnapshot.findFirst({
        where: { journeyId },
        orderBy: { generatedAt: 'desc' },
      });

      if (!snapshot) {
        return res.status(404).json({ error: 'No snapshot found' });
      }

      return res.json(snapshot);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const snapshotController = new SnapshotController();
