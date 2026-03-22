import { Router } from 'express';
import { communityController } from '../controllers/community.controller';
import { authMiddleware, optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, (req, res) => communityController.list(req, res));
router.get('/:id', optionalAuth, (req, res) => communityController.detail(req, res));

router.post('/:id/like', authMiddleware, (req, res) => communityController.like(req, res));
router.delete('/:id/like', authMiddleware, (req, res) => communityController.unlike(req, res));
router.post('/:id/fork', authMiddleware, (req, res) => communityController.fork(req, res));

router.get('/:id/comments', optionalAuth, (req, res) => communityController.listComments(req, res));
router.post('/:id/comments', authMiddleware, (req, res) => communityController.createComment(req, res));
router.post('/:id/report', authMiddleware, (req, res) => communityController.report(req, res));

export default router;
