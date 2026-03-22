import { describe, expect, it } from 'vitest';
import { DeviceController } from '../src/controllers/device.controller';

function createRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: unknown) => {
    res.body = body;
    return res;
  };
  return res;
}

describe('DeviceController', () => {
  it('should upsert and update pushToken for same device', async () => {
    const store: any[] = [];

    const prismaMock = {
      userDevice: {
        findFirst: async ({ where }: any) => {
          if (where.deviceFingerprint) {
            return store.find((item) => item.userId === where.userId && item.deviceFingerprint === where.deviceFingerprint) || null;
          }
          return (
            store.find(
              (item) =>
                item.userId === where.userId &&
                item.platform === where.platform &&
                item.pushToken === where.pushToken
            ) || null
          );
        },
        create: async ({ data }: any) => {
          const created = { id: 'dev_1', ...data };
          store.push(created);
          return created;
        },
        update: async ({ where, data }: any) => {
          const idx = store.findIndex((item) => item.id === where.id);
          store[idx] = { ...store[idx], ...data };
          return store[idx];
        },
        deleteMany: async ({ where }: any) => {
          const before = store.length;
          for (let i = store.length - 1; i >= 0; i--) {
            if (store[i].id === where.id && store[i].userId === where.userId) {
              store.splice(i, 1);
            }
          }
          return { count: before - store.length };
        },
        findMany: async ({ where }: any) => {
          return store.filter((item) => item.userId === where.userId);
        },
      },
    } as any;

    const controller = new DeviceController(prismaMock);

    const req1: any = {
      userId: 'user_1',
      body: {
        platform: 'WECHAT_MINIAPP',
        pushToken: 'openid_old',
        deviceFingerprint: 'fp_1',
      },
    };
    const res1 = createRes();
    await controller.register(req1, res1 as any);

    const req2: any = {
      userId: 'user_1',
      body: {
        platform: 'WECHAT_MINIAPP',
        pushToken: 'openid_new',
        deviceFingerprint: 'fp_1',
      },
    };
    const res2 = createRes();
    await controller.register(req2, res2 as any);

    expect(store.length).toBe(1);
    expect(store[0].pushToken).toBe('openid_new');
  });

  it('should delete device on unregister', async () => {
    const store = [{ id: 'dev_x', userId: 'user_1', platform: 'WECHAT_MINIAPP', pushToken: 'openid_x' }];

    const prismaMock = {
      userDevice: {
        findFirst: async () => null,
        create: async () => null,
        update: async () => null,
        findMany: async ({ where }: any) => store.filter((item) => item.userId === where.userId),
        deleteMany: async ({ where }: any) => {
          const before = store.length;
          for (let i = store.length - 1; i >= 0; i--) {
            if (store[i].id === where.id && store[i].userId === where.userId) {
              store.splice(i, 1);
            }
          }
          return { count: before - store.length };
        },
      },
    } as any;

    const controller = new DeviceController(prismaMock);
    const req: any = {
      userId: 'user_1',
      params: { deviceId: 'dev_x' },
    };
    const res = createRes();

    await controller.unregister(req, res as any);

    expect(store.length).toBe(0);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, deleted: 1 });
  });
});
