import { Router, Response } from 'express';
import { journeyController } from '../controllers/journey.controller';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { sessionMiddleware } from '../middleware/session';
import { journeyService } from '../services/journey.service';
import { prisma } from '../lib/prisma';
import conversationRoutes from './conversation';
import carCandidateRoutes from './car-candidate';

const router = Router();

router.post('/', authMiddleware, (req, res) => journeyController.createJourney(req, res));
router.get('/active', authMiddleware, (req, res) => journeyController.getActiveJourney(req, res));
router.patch('/:journeyId/stage', authMiddleware, (req, res) => journeyController.advanceStage(req, res));
router.patch('/:journeyId/pause', authMiddleware, (req, res) => journeyController.pauseJourney(req, res));
router.patch('/:journeyId/complete', authMiddleware, (req, res) => journeyController.completeJourney(req, res));
router.post('/:journeyId/events', sessionMiddleware, (req, res) => journeyController.recordBehaviorEvent(req, res));

// 手动触发过期检查（仅 Admin）
router.post(
  '/admin/check-expired',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
      });
      if (user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin only' });
      }

      const expiredJourneys = await journeyService.checkExpiredJourneys();
      res.json({ count: expiredJourneys.length, journeys: expiredJourneys });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 获取旅程详情
router.get(
  '/:journeyId/detail',
  authMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { journeyId } = req.params;
      const journey = await journeyService.getJourneyDetail(journeyId);
      if (!journey) {
        return res.status(404).json({ error: 'Journey not found' });
      }
      if (journey.userId !== req.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      res.json(journey);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.use('/', conversationRoutes);
router.use('/', carCandidateRoutes);

export default router;
