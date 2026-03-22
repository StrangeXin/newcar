import Redis from 'ioredis';
import { config } from '../config';

export const redis = new Redis(config.redis.url);

export async function incrWithTTL(key: string, ttlSeconds: number): Promise<number> {
  const result = await redis.eval(
    `
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[1])
    end
    return count
    `,
    1,
    key,
    ttlSeconds
  );

  return Number(result);
}
