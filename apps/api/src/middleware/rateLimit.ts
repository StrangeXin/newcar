import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redis.url);

export function createRateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
}) {
  const { windowMs, max, keyGenerator } = options;

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const keyBase = keyGenerator ? keyGenerator(req) : req.ip || 'unknown';
    const window = Math.floor(Date.now() / windowMs);
    const key = `ratelimit:${keyBase}:${window}`;

    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }

      if (count > max) {
        res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
        return res.status(429).json({ error: 'Too many requests' });
      }

      return next();
    } catch {
      return next();
    }
  };
}

// Default global limiter (backwards compatible)
export const rateLimitMiddleware = createRateLimit({ windowMs: 60000, max: 100 });
