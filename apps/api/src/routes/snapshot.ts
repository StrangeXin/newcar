import { Router } from 'express';
import { snapshotController } from '../controllers/snapshot.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/:journeyId/snapshot', authMiddleware, (req, res) =>
  snapshotController.generateSnapshot(req, res)
);

router.get('/:journeyId/snapshot', authMiddleware, (req, res) =>
  snapshotController.getLatestSnapshot(req, res)
);

export default router;
