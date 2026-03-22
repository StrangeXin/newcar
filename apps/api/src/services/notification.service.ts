import { AttentionSignal, AttentionSignalType } from '@newcar/shared';
import { Prisma } from '@prisma/client';
import { DEFAULT_LOCALE, t } from '../lib/i18n';
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
        metadata: (data.metadata || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async createNotificationsFromSignals(
    userId: string,
    journeyId: string,
    signals: AttentionSignal[],
    locale = DEFAULT_LOCALE
  ) {
    const notifications = [];

    for (const signal of signals) {
      const notification = await this.createNotification({
        userId,
        journeyId,
        type: signal.signalType,
        relatedCarId: signal.carId !== 'all' ? signal.carId : undefined,
        title: this.buildNotificationTitle(signal, locale),
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

  private buildNotificationTitle(signal: AttentionSignal, locale = DEFAULT_LOCALE): string {
    switch (signal.signalType) {
      case AttentionSignalType.PRICE_DROP:
        return t(locale, 'notification.title.PRICE_DROP');
      case AttentionSignalType.NEW_VARIANT:
        return t(locale, 'notification.title.NEW_VARIANT');
      case AttentionSignalType.NEW_REVIEW:
        return t(locale, 'notification.title.NEW_REVIEW');
      case AttentionSignalType.POLICY_UPDATE:
        return t(locale, 'notification.title.POLICY_UPDATE');
      case AttentionSignalType.OTA_RECALL:
        return t(locale, 'notification.title.OTA_RECALL');
      default:
        return t(locale, 'notification.title.dynamic');
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
