import { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import { config } from '../config';

const redis = new Redis(config.redis.url);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 100;

export async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  const key = `ratelimit:${req.ip}:${Math.floor(Date.now() / WINDOW_MS)}`;

  try {
    const entry = await redis.get(key);
    const now = Date.now();

    if (!entry) {
      await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }));
      return next();
    }

    const { count, resetAt }: RateLimitEntry = JSON.parse(entry);

    if (now > resetAt) {
      await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: 1, resetAt: now + WINDOW_MS }));
      return next();
    }

    if (count >= MAX_REQUESTS) {
      res.setHeader('Retry-After', Math.ceil((resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests' });
    }

    await redis.setex(key, Math.ceil(WINDOW_MS / 1000), JSON.stringify({ count: count + 1, resetAt }));
    return next();
  } catch {
    return next();
  }
}
