import { Response } from 'express';
import { JourneyStage } from '@newcar/shared';
import { AuthenticatedRequest } from '../middleware/auth';
import { journeyService } from '../services/journey.service';

export class JourneyController {
  async createJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;
      const { title, requirements } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const journey = await journeyService.createJourney(userId, { title, requirements });
      return res.status(201).json(journey);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }

  async getActiveJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const journey = await journeyService.getActiveJourney(userId);

      if (!journey) {
        return res.status(404).json({ error: 'No active journey found' });
      }

      return res.json(journey);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async advanceStage(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { stage } = req.body;

      if (!Object.values(JourneyStage).includes(stage)) {
        return res.status(400).json({ error: 'Invalid stage' });
      }

      const journey = await journeyService.advanceStage(journeyId, stage);
      return res.json(journey);
    } catch (error) {
      return res.status(400).json({ error: (error as Error).message });
    }
  }

  async pauseJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.pauseJourney(journeyId);
      return res.json(journey);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async completeJourney(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.completeJourney(journeyId);
      return res.json(journey);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }

  async recordBehaviorEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { type, targetType, targetId, metadata } = req.body;

      if (!req.sessionId) {
        return res.status(400).json({ error: 'Missing session' });
      }

      const event = await journeyService.recordBehaviorEvent({
        journeyId,
        userId: req.userId,
        sessionId: req.sessionId,
        type,
        targetType,
        targetId,
        metadata,
      });

      return res.status(201).json(event);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  }
}

export const journeyController = new JourneyController();
