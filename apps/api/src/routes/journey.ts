import { Router } from 'express';
import { journeyController } from '../controllers/journey.controller';
import { authMiddleware } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';
import conversationRoutes from './conversation';
import carCandidateRoutes from './car-candidate';

const router = Router();

router.post('/', authMiddleware, (req, res) => journeyController.createJourney(req, res));
router.get('/active', authMiddleware, (req, res) => journeyController.getActiveJourney(req, res));
router.patch('/:journeyId/stage', authMiddleware, (req, res) => journeyController.advanceStage(req, res));
router.patch('/:journeyId/pause', authMiddleware, (req, res) => journeyController.pauseJourney(req, res));
router.patch('/:journeyId/complete', authMiddleware, (req, res) => journeyController.completeJourney(req, res));
router.post('/:journeyId/events', sessionMiddleware, (req, res) => journeyController.recordBehaviorEvent(req, res));
router.use('/', conversationRoutes);
router.use('/', carCandidateRoutes);

export default router;
