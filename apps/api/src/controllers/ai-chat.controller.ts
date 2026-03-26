import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiChatService } from '../services/ai-chat.service';
import { journeyService } from '../services/journey.service';

export class AiChatController {
  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const journey = await journeyService.getJourneyDetail(journeyId);
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const response = await aiChatService.chat({
        journeyId,
        userId: req.userId,
        sessionId: req.sessionId!,
        message,
      });

      res.json(response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  }
}

export const aiChatController = new AiChatController();
