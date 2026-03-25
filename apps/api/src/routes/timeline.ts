import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { timelineController } from '../controllers/timeline.controller';

const router = Router();

router.get('/:journeyId/timeline', authMiddleware, (req, res) => timelineController.list(req, res));
router.post('/:journeyId/timeline', authMiddleware, (req, res) => timelineController.create(req, res));
router.get('/:journeyId/timeline/:eventId', authMiddleware, (req, res) => timelineController.get(req, res));
router.patch('/:journeyId/timeline/:eventId', authMiddleware, (req, res) => timelineController.update(req, res));
router.delete('/:journeyId/timeline/:eventId', authMiddleware, (req, res) => timelineController.remove(req, res));

export default router;
