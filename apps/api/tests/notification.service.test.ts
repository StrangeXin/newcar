import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttentionSignalType } from '@newcar/shared';

vi.mock('../src/lib/prisma', () => ({
  prisma: {
    notificationFeed: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../src/lib/i18n', () => ({
  DEFAULT_LOCALE: 'zh-CN',
  t: vi.fn((_locale: string, key: string) => `[${key}]`),
}));

import { prisma } from '../src/lib/prisma';
import { notificationService } from '../src/services/notification.service';

const mockedPrisma = prisma as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationService', () => {
  describe('createNotification', () => {
    it('should create notification when under daily limit', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(2);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const result = await notificationService.createNotification({
        userId: 'u1',
        journeyId: 'j1',
        type: AttentionSignalType.PRICE_DROP,
        title: '价格变动',
      });

      expect(result).toEqual({ id: 'n1' });
      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'u1',
          journeyId: 'j1',
          type: AttentionSignalType.PRICE_DROP,
          title: '价格变动',
        }),
      });
    });

    it('should return null when daily limit (3) is reached', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(3);

      const result = await notificationService.createNotification({
        userId: 'u1',
        journeyId: 'j1',
        type: AttentionSignalType.PRICE_DROP,
        title: '价格变动',
      });

      expect(result).toBeNull();
      expect(mockedPrisma.notificationFeed.create).not.toHaveBeenCalled();
    });
  });

  describe('createNotificationsFromSignals', () => {
    it('should create notification for each signal', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create
        .mockResolvedValueOnce({ id: 'n1' })
        .mockResolvedValueOnce({ id: 'n2' });

      const signals = [
        { signalType: AttentionSignalType.PRICE_DROP, carId: 'car-1', description: '降价 5000', delta: -5000 },
        { signalType: AttentionSignalType.NEW_VARIANT, carId: 'car-2', description: '新版本' },
      ] as any[];

      const result = await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(result).toHaveLength(2);
      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledTimes(2);
    });

    it('should set relatedCarId to undefined when carId is "all"', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const signals = [
        { signalType: AttentionSignalType.POLICY_UPDATE, carId: 'all', description: '政策更新' },
      ] as any[];

      await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          relatedCarId: undefined,
        }),
      });
    });

    it('should use i18n t() for notification title based on signal type', async () => {
      mockedPrisma.notificationFeed.count.mockResolvedValue(0);
      mockedPrisma.notificationFeed.create.mockResolvedValue({ id: 'n1' });

      const signals = [
        { signalType: AttentionSignalType.PRICE_DROP, carId: 'car-1', description: 'desc' },
      ] as any[];

      await notificationService.createNotificationsFromSignals('u1', 'j1', signals);

      expect(mockedPrisma.notificationFeed.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '[notification.title.PRICE_DROP]',
        }),
      });
    });
  });

  describe('getUserNotifications', () => {
    it('should query notifications with limit', async () => {
      mockedPrisma.notificationFeed.findMany.mockResolvedValue([]);

      await notificationService.getUserNotifications('u1', 10);

      expect(mockedPrisma.notificationFeed.findMany).toHaveBeenCalledWith({
        where: { userId: 'u1' },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });
  });

  describe('markAsRead', () => {
    it('should update notification isRead to true', async () => {
      mockedPrisma.notificationFeed.updateMany.mockResolvedValue({ count: 1 });

      await notificationService.markAsRead('n1', 'u1');

      expect(mockedPrisma.notificationFeed.updateMany).toHaveBeenCalledWith({
        where: { id: 'n1', userId: 'u1' },
        data: { isRead: true },
      });
    });
  });
});
