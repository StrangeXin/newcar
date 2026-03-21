import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { config } from '../config';
import { authService } from '../services/auth.service';

export class AuthController {
  async wechatCallback(req: Request, res: Response) {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Missing code parameter' });
    }

    try {
      const result = await authService.wechatLogin(code);
      return res.json(result);
    } catch (error) {
      console.error('Wechat login error:', error);
      return res.status(500).json({ error: 'Wechat login failed' });
    }
  }

  async phoneLogin(req: Request, res: Response) {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ error: 'Missing phone or otp' });
    }

    try {
      const result = await authService.phoneLogin(phone, otp);
      return res.json(result);
    } catch (error) {
      return res.status(401).json({ error: (error as Error).message });
    }
  }

  async sendOtp(req: Request, res: Response) {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Missing phone' });
    }

    try {
      const { otp } = await authService.sendOtp(phone);
      return res.json({ message: 'OTP sent', otp });
    } catch {
      return res.status(500).json({ error: 'Failed to send OTP' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Missing refresh token' });
    }

    try {
      const payload = authService.verifyToken(refreshToken);

      if (payload.type !== 'refresh') {
        throw new Error('Not a refresh token');
      }

      const accessToken = jwt.sign(
        { userId: payload.userId, sessionId: payload.sessionId, type: 'access' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn as jwt.SignOptions['expiresIn'] }
      );

      return res.json({ accessToken });
    } catch {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
}

export const authController = new AuthController();
