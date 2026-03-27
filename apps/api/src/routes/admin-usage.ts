import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminUsageController } from '../controllers/admin-usage.controller';

const router = Router();

router.get('/summary', authMiddleware, (req, res) => adminUsageController.getUsageSummary(req, res));
router.get('/details', authMiddleware, (req, res) => adminUsageController.getUsageDetails(req, res));
router.get('/subscriptions', authMiddleware, (req, res) => adminUsageController.getSubscriptionDistribution(req, res));

export default router;
