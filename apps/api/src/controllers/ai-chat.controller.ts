import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { aiChatService } from '../services/ai-chat.service';

export class AiChatController {
  async chat(req: AuthenticatedRequest, res: Response) {
    try {
      const { journeyId } = req.params;
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await aiChatService.chat({
        journeyId,
        userId: req.userId,
        sessionId: req.sessionId!,
        message,
      });

      res.json(response);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const aiChatController = new AiChatController();
