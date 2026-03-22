import { Router } from 'express';
import { deviceController } from '../controllers/device.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/', authMiddleware, (req, res) => deviceController.register(req, res));
router.delete('/:deviceId', authMiddleware, (req, res) => deviceController.unregister(req, res));
router.get('/', authMiddleware, (req, res) => deviceController.list(req, res));

export default router;
