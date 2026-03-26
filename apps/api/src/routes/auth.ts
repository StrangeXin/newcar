import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { authController } from '../controllers/auth.controller';
import { prisma } from '../lib/prisma';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { validateBody } from '../lib/validate';

const sendOtpSchema = z.object({ phone: z.string().regex(/^1[3-9]\d{9}$/) });
const phoneLoginSchema = z.object({ phone: z.string(), otp: z.string().length(6) });

const router = Router();

router.get('/wechat/callback', (req, res) => authController.wechatCallback(req, res));
router.post('/phone/send-otp', validateBody(sendOtpSchema), (req, res) => authController.sendOtp(req, res));
router.post('/phone/login', validateBody(phoneLoginSchema), (req, res) => authController.phoneLogin(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));
router.get('/users/me', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        openid: true,
        email: true,
        phone: true,
        avatar: true,
        nickname: true,
        city: true,
        role: true,
        notificationSettings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.patch('/users/me/notification-settings', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const existing = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { notificationSettings: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextSettings = deepMerge(
      normalizeObject(existing.notificationSettings),
      normalizeObject(req.body || {})
    );

    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        notificationSettings: nextSettings as Prisma.InputJsonValue,
      },
      select: {
        id: true,
        notificationSettings: true,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

function normalizeObject(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }
  return input as Record<string, unknown>;
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>
      );
      continue;
    }
    result[key] = value;
  }

  return result;
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

export default router;
