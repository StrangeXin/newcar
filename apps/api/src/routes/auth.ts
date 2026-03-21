import { Router } from 'express';
import { authController } from '../controllers/auth.controller';

const router = Router();

router.get('/wechat/callback', (req, res) => authController.wechatCallback(req, res));
router.post('/phone/send-otp', (req, res) => authController.sendOtp(req, res));
router.post('/phone/login', (req, res) => authController.phoneLogin(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

export default router;
