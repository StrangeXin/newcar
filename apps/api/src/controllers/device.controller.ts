import { Platform } from '@newcar/shared';
import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';

type PrismaLike = typeof prisma;

export class DeviceController {
  constructor(private prismaClient: PrismaLike = prisma) {}

  async register(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { platform, pushToken, deviceFingerprint } = req.body || {};

      if (!platform || typeof platform !== 'string' || !Object.values(Platform).includes(platform as Platform)) {
        return res.status(400).json({ error: 'Invalid platform' });
      }
      if (!pushToken || typeof pushToken !== 'string') {
        return res.status(400).json({ error: 'Missing pushToken' });
      }

      let existing = null;
      if (deviceFingerprint && typeof deviceFingerprint === 'string') {
        existing = await this.prismaClient.userDevice.findFirst({
          where: {
            userId,
            deviceFingerprint,
          },
        });
      } else {
        existing = await this.prismaClient.userDevice.findFirst({
          where: {
            userId,
            platform,
            pushToken,
          },
        });
      }

      if (existing) {
        const updated = await this.prismaClient.userDevice.update({
          where: { id: existing.id },
          data: {
            platform,
            pushToken,
            deviceFingerprint: deviceFingerprint || existing.deviceFingerprint,
            lastSeenAt: new Date(),
          },
        });
        return res.json(updated);
      }

      const created = await this.prismaClient.userDevice.create({
        data: {
          userId,
          platform,
          pushToken,
          deviceFingerprint: deviceFingerprint || null,
          lastSeenAt: new Date(),
        },
      });

      return res.status(201).json(created);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async unregister(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const { deviceId } = req.params;

      const result = await this.prismaClient.userDevice.deleteMany({
        where: { id: deviceId, userId },
      });

      return res.json({ success: true, deleted: result.count });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }

  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.userId!;
      const devices = await this.prismaClient.userDevice.findMany({
        where: { userId },
        orderBy: { lastSeenAt: 'desc' },
      });
      return res.json(devices);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: message });
    }
  }
}

export const deviceController = new DeviceController();
