import { AttentionSignal, AttentionSignalType } from '@newcar/shared';
import { prisma } from '../lib/prisma';

const MAX_NOTIFICATIONS_PER_JOURNEY_PER_DAY = 3;

export class NotificationService {
  async createNotification(data: {
    userId: string;
    journeyId: string;
    type: AttentionSignalType;
    relatedCarId?: string;
    title: string;
    body?: string;
    metadata?: Record<string, unknown>;
  }) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await prisma.notificationFeed.count({
      where: {
        journeyId: data.journeyId,
        createdAt: { gte: today },
      },
    });

    if (todayCount >= MAX_NOTIFICATIONS_PER_JOURNEY_PER_DAY) {
      return null;
    }

    return prisma.notificationFeed.create({
      data: {
        userId: data.userId,
        journeyId: data.journeyId,
        type: data.type,
        relatedCarId: data.relatedCarId,
        title: data.title,
        body: data.body,
        metadata: data.metadata || {},
      },
    });
  }

  async createNotificationsFromSignals(userId: string, journeyId: string, signals: AttentionSignal[]) {
    const notifications = [];

    for (const signal of signals) {
      const notification = await this.createNotification({
        userId,
        journeyId,
        type: signal.signalType,
        relatedCarId: signal.carId !== 'all' ? signal.carId : undefined,
        title: this.buildNotificationTitle(signal),
        body: signal.description,
        metadata: {
          delta: signal.delta,
          oldValue: signal.oldValue,
          newValue: signal.newValue,
        },
      });

      if (notification) {
        notifications.push(notification);
      }
    }

    return notifications;
  }

  private buildNotificationTitle(signal: AttentionSignal): string {
    switch (signal.signalType) {
      case AttentionSignalType.PRICE_DROP:
        return '价格变动';
      case AttentionSignalType.NEW_VARIANT:
        return '新车型发布';
      case AttentionSignalType.NEW_REVIEW:
        return '新评测内容';
      case AttentionSignalType.POLICY_UPDATE:
        return '政策更新';
      case AttentionSignalType.OTA_RECALL:
        return '系统更新/召回';
      default:
        return '动态更新';
    }
  }

  async getUserNotifications(userId: string, limit = 20) {
    return prisma.notificationFeed.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return prisma.notificationFeed.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }
}

export const notificationService = new NotificationService();
