import { Platform } from '@newcar/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { incrWithTTL, redis } from '../lib/redis';
import { wechatPushService } from './wechat-push.service';

const PUSHED_NOTIFICATION_TTL_SECONDS = 24 * 60 * 60;
const DAY_TTL_SECONDS = 24 * 60 * 60;

interface NotificationSettings {
  push_enabled?: boolean;
  max_per_day?: number;
}

type PrismaLike = typeof prisma;
type RedisLike = Pick<typeof redis, 'get' | 'set' | 'expire'>;

export class PushService {
  constructor(
    private prismaClient: PrismaLike = prisma,
    private redisClient: RedisLike = redis,
    private wechatService: Pick<typeof wechatPushService, 'sendNotification'> = wechatPushService,
    private incrWithTTLFn: (key: string, ttlSeconds: number) => Promise<number> = incrWithTTL
  ) {}

  async sendNotification(notificationId: string): Promise<void> {
    const notification = await this.prismaClient.notificationFeed.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          include: { devices: true },
        },
      },
    });

    if (!notification) {
      return;
    }

    const dedupeKey = `pushed_notification:${notificationId}`;
    const alreadyPushed = await this.redisClient.get(dedupeKey);
    if (alreadyPushed) {
      return;
    }

    const settings = this.resolveSettings(notification.user.notificationSettings);
    if (!settings.push_enabled) {
      return;
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    const limitKey = `push_count:${notification.userId}:${dateKey}`;
    const currentCount = Number((await this.redisClient.get(limitKey)) || 0);
    if (currentCount >= settings.max_per_day) {
      return;
    }

    const wechatDevices = notification.user.devices.filter(
      (device) => device.platform === Platform.WECHAT_MINIAPP && !!device.pushToken
    );

    if (wechatDevices.length === 0) {
      logger.warn({ userId: notification.userId }, 'Push skipped: no WECHAT_MINIAPP device');
      return;
    }

    for (const device of wechatDevices) {
      try {
        await this.wechatService.sendNotification(device.pushToken!, {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          metadata: notification.metadata,
        });
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({ notificationId: notification.id, deviceId: device.id, err: errMsg }, 'Push send failed');
      }
    }

    await this.redisClient.set(dedupeKey, '1');
    await this.redisClient.expire(dedupeKey, PUSHED_NOTIFICATION_TTL_SECONDS);
    await this.incrWithTTLFn(limitKey, DAY_TTL_SECONDS);
  }

  async sendBatchNotifications(notificationIds: string[]): Promise<void> {
    for (const notificationId of notificationIds) {
      await this.sendNotification(notificationId);
    }
  }

  private resolveSettings(input: unknown): Required<NotificationSettings> {
    const defaults: Required<NotificationSettings> = {
      push_enabled: true,
      max_per_day: 3,
    };

    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return defaults;
    }

    const obj = input as Record<string, unknown>;
    return {
      push_enabled: typeof obj.push_enabled === 'boolean' ? obj.push_enabled : defaults.push_enabled,
      max_per_day:
        typeof obj.max_per_day === 'number' && Number.isFinite(obj.max_per_day)
          ? Math.max(0, Math.floor(obj.max_per_day))
          : defaults.max_per_day,
    };
  }
}

export const pushService = new PushService();
