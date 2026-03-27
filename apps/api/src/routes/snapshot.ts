import { Router } from 'express';
import { snapshotController } from '../controllers/snapshot.controller';
import { authMiddleware } from '../middleware/auth';
import { reportQuota } from '../middleware/quota';

const router = Router();

router.post('/:journeyId/snapshot', authMiddleware, reportQuota, (req, res) =>
  snapshotController.generateSnapshot(req, res)
);

router.get('/:journeyId/snapshot', authMiddleware, (req, res) =>
  snapshotController.getLatestSnapshot(req, res)
);

export default router;
