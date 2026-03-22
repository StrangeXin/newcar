import { describe, expect, it, vi } from 'vitest';
import { PushService } from '../src/services/push.service';

function createNotification(settings: Record<string, unknown>, devices: Array<{ id: string; platform: string; pushToken: string | null }>) {
  return {
    id: 'notif_1',
    userId: 'user_1',
    type: 'PRICE_DROP',
    title: '价格变动',
    body: '降价5000',
    metadata: {},
    user: {
      id: 'user_1',
      notificationSettings: settings,
      devices,
    },
  };
}

describe('PushService', () => {
  it('should skip push when daily limit is reached', async () => {
    const prismaMock = {
      notificationFeed: {
        findUnique: vi.fn().mockResolvedValue(
          createNotification(
            { push_enabled: true, max_per_day: 1 },
            [{ id: 'd1', platform: 'WECHAT_MINIAPP', pushToken: 'openid_1' }]
          )
        ),
      },
    } as any;

    const redisMock = {
      get: vi
        .fn()
        .mockResolvedValueOnce(null) // dedupe key
        .mockResolvedValueOnce('1'), // rate-limit key
      set: vi.fn(),
      expire: vi.fn(),
    };

    const wechatMock = { sendNotification: vi.fn() };
    const incrWithTTLMock = vi.fn().mockResolvedValue(2);

    const service = new PushService(prismaMock, redisMock as any, wechatMock as any, incrWithTTLMock);
    await service.sendNotification('notif_1');

    expect(wechatMock.sendNotification).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('should enforce idempotency by skipping second send', async () => {
    const state: Record<string, string> = {};
    const redisMock = {
      get: vi.fn(async (key: string) => state[key] || null),
      set: vi.fn(async (key: string, value: string) => {
        state[key] = value;
        return 'OK';
      }),
      expire: vi.fn(async () => 1),
    };

    const prismaMock = {
      notificationFeed: {
        findUnique: vi.fn().mockResolvedValue(
          createNotification(
            { push_enabled: true, max_per_day: 3 },
            [{ id: 'd1', platform: 'WECHAT_MINIAPP', pushToken: 'openid_1' }]
          )
        ),
      },
    } as any;

    const wechatMock = { sendNotification: vi.fn().mockResolvedValue(undefined) };
    const incrWithTTLMock = vi.fn().mockResolvedValue(1);
    const service = new PushService(prismaMock, redisMock as any, wechatMock as any, incrWithTTLMock);

    await service.sendNotification('notif_1');
    await service.sendNotification('notif_1');

    expect(wechatMock.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('should skip push when push_enabled is false', async () => {
    const prismaMock = {
      notificationFeed: {
        findUnique: vi.fn().mockResolvedValue(
          createNotification(
            { push_enabled: false, max_per_day: 3 },
            [{ id: 'd1', platform: 'WECHAT_MINIAPP', pushToken: 'openid_1' }]
          )
        ),
      },
    } as any;

    const redisMock = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn(),
      expire: vi.fn(),
    };
    const wechatMock = { sendNotification: vi.fn() };
    const incrWithTTLMock = vi.fn().mockResolvedValue(1);
    const service = new PushService(prismaMock, redisMock as any, wechatMock as any, incrWithTTLMock);

    await service.sendNotification('notif_1');

    expect(wechatMock.sendNotification).not.toHaveBeenCalled();
  });

  it('should skip gracefully when no device exists', async () => {
    const prismaMock = {
      notificationFeed: {
        findUnique: vi.fn().mockResolvedValue(createNotification({ push_enabled: true, max_per_day: 3 }, [])),
      },
    } as any;

    const redisMock = {
      get: vi
        .fn()
        .mockResolvedValueOnce(null) // dedupe
        .mockResolvedValueOnce('0'), // rate-limit
      set: vi.fn(),
      expire: vi.fn(),
    };
    const wechatMock = { sendNotification: vi.fn() };
    const incrWithTTLMock = vi.fn().mockResolvedValue(1);
    const service = new PushService(prismaMock, redisMock as any, wechatMock as any, incrWithTTLMock);

    await service.sendNotification('notif_1');

    expect(wechatMock.sendNotification).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });
});
