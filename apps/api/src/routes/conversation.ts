import { Router } from 'express';
import { conversationController } from '../controllers/conversation.controller';
import { authMiddleware } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';

const router = Router();

// 获取或创建对话
router.get(
  '/:journeyId/conversation',
  authMiddleware,
  sessionMiddleware,
  (req, res) => conversationController.getOrCreate(req, res)
);

// 添加消息
router.post(
  '/:journeyId/conversation/messages',
  authMiddleware,
  sessionMiddleware,
  (req, res) => conversationController.addMessage(req, res)
);

// 获取对话历史
router.get(
  '/:journeyId/conversation/messages',
  authMiddleware,
  sessionMiddleware,
  (req, res) => conversationController.getHistory(req, res)
);

// 获取提取的信号
router.get(
  '/:journeyId/conversation/signals',
  authMiddleware,
  sessionMiddleware,
  (req, res) => conversationController.getSignals(req, res)
);

export default router;
