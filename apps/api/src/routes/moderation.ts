import { Router } from 'express';
import { moderationController } from '../controllers/moderation.controller';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

router.get('/queue', authMiddleware, requireRole(['ADMIN', 'EDITOR']), (req, res) =>
  moderationController.queue(req, res)
);
router.post('/:id/approve', authMiddleware, requireRole(['ADMIN', 'EDITOR']), (req, res) =>
  moderationController.approve(req, res)
);
router.post('/:id/reject', authMiddleware, requireRole(['ADMIN', 'EDITOR']), (req, res) =>
  moderationController.reject(req, res)
);
router.post('/:id/feature', authMiddleware, requireRole(['ADMIN']), (req, res) =>
  moderationController.feature(req, res)
);

export default router;
