import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../lib/validate';
import { subscriptionController } from '../controllers/subscription.controller';

const upgradeSchema = z.object({
  planName: z.enum(['PRO', 'PREMIUM']),
});

const router = Router();

router.get('/current', authMiddleware, (req, res) => subscriptionController.getCurrentSubscription(req, res));
router.get('/plans', authMiddleware, (req, res) => subscriptionController.getPlans(req, res));
router.post('/upgrade', authMiddleware, validateBody(upgradeSchema), (req, res) => subscriptionController.upgradePlan(req, res));

export default router;
