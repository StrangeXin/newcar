import { Router } from 'express';
import { aiChatController } from '../controllers/ai-chat.controller';
import { authMiddleware } from '../middleware/auth';
import { conversationQuota } from '../middleware/quota';
import { sessionMiddleware } from '../middleware/session';

const router = Router();

// AI 对话
router.post(
  '/:journeyId/chat',
  authMiddleware,
  conversationQuota,
  sessionMiddleware,
  (req, res) => aiChatController.chat(req, res)
);

export default router;
