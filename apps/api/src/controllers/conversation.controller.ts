import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { conversationService } from '../services/conversation.service';
import { journeyService } from '../services/journey.service';
import { MessageRole } from '@newcar/shared';

export class ConversationController {
  async getOrCreate(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      if (req.userId) {
        const journey = await journeyService.getJourneyDetail(journeyId);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        if (journey.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
      }
      const conversation = req.userId
        ? await conversationService.getOrCreateByJourney(journeyId, req.userId)
        : await conversationService.getOrCreateConversation({
            journeyId,
            userId: req.userId,
            sessionId: req.sessionId!,
          });
      return res.json(conversation);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async addMessage(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { role, content } = req.body;
      if (req.userId) {
        const journey = await journeyService.getJourneyDetail(journeyId);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        if (journey.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
      }

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      if (!Object.values(MessageRole).includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const conversation = await conversationService.addMessage({
        journeyId,
        sessionId: req.sessionId!,
        userId: req.userId,
        role,
        content,
      });

      return res.json(conversation);
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getHistory(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      if (req.userId) {
        const journey = await journeyService.getJourneyDetail(journeyId);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        if (journey.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
      }
      const limit = parseInt(req.query.limit as string) || 10;

      const messages = await conversationService.getConversationHistory({
        journeyId,
        sessionId: req.sessionId!,
        userId: req.userId,
        limit,
      });

      return res.json({ messages });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }

  async getSignals(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      if (req.userId) {
        const journey = await journeyService.getJourneyDetail(journeyId);
        if (!journey) return res.status(404).json({ error: 'Journey not found' });
        if (journey.userId !== req.userId) return res.status(403).json({ error: 'Forbidden' });
      }
      const signals = await conversationService.getExtractedSignals({
        journeyId,
        sessionId: req.sessionId!,
        userId: req.userId,
      });
      return res.json({ signals });
    } catch (error: any) {
      return res.status(500).json({ error: error.message });
    }
  }
}

export const conversationController = new ConversationController();
