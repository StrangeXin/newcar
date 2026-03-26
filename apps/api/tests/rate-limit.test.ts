import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('ioredis', () => {
  const Redis = vi.fn().mockImplementation(() => ({
    incr: vi.fn().mockResolvedValue(1),
    pexpire: vi.fn().mockResolvedValue(1),
  }));
  return { default: Redis };
});

vi.mock('../src/config', () => ({
  config: { redis: { url: 'redis://localhost:6379' } },
}));

import { createRateLimit, rateLimitMiddleware } from '../src/middleware/rateLimit';
import type { Request, Response, NextFunction } from 'express';

function makeMocks() {
  const req = { ip: '127.0.0.1' } as unknown as Request;
  const res = {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('createRateLimit', () => {
  it('returns a middleware function', () => {
    const middleware = createRateLimit({ windowMs: 60000, max: 10 });
    expect(typeof middleware).toBe('function');
  });

  it('calls next() when under the limit', async () => {
    const middleware = createRateLimit({ windowMs: 60000, max: 10 });
    const { req, res, next } = makeMocks();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('uses custom keyGenerator when provided', async () => {
    const keyGenerator = vi.fn().mockReturnValue('custom-key');
    const middleware = createRateLimit({ windowMs: 60000, max: 10, keyGenerator });
    const { req, res, next } = makeMocks();
    await middleware(req, res, next);
    expect(keyGenerator).toHaveBeenCalledWith(req);
    expect(next).toHaveBeenCalled();
  });

  it('returns 429 when count exceeds max', async () => {
    const ioredis = await import('ioredis');
    const RedisMock = ioredis.default as ReturnType<typeof vi.fn>;
    const instance = RedisMock.mock.results[0]?.value;
    if (instance) {
      instance.incr.mockResolvedValue(11);
    }

    const middleware = createRateLimit({ windowMs: 60000, max: 10 });
    const { req, res, next } = makeMocks();
    await middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('rateLimitMiddleware (default export)', () => {
  it('is a function (backwards compatible export)', () => {
    expect(typeof rateLimitMiddleware).toBe('function');
  });
});
