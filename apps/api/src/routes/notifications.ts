import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, (req, res) => notificationController.getNotifications(req, res));
router.patch('/:notificationId/read', authMiddleware, (req, res) => notificationController.markAsRead(req, res));

export default router;
