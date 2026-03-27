import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import { adminUsageController } from '../controllers/admin-usage.controller';

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get('/summary', (req, res) => adminUsageController.getUsageSummary(req, res));
router.get('/details', (req, res) => adminUsageController.getUsageDetails(req, res));
router.get('/subscriptions', (req, res) => adminUsageController.getSubscriptionDistribution(req, res));

export default router;
