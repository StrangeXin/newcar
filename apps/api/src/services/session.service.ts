import Redis from 'ioredis';
import { config } from '../config';
import { generateSessionId } from '../lib/utils';

export class SessionService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis(config.redis.url);
  }

  async createGuestSession(): Promise<{ sessionId: string }> {
    const sessionId = generateSessionId();

    await this.redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60,
      JSON.stringify({
        isGuest: true,
        createdAt: new Date().toISOString(),
      })
    );

    return { sessionId };
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async bindUser(sessionId: string, userId: string) {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    await this.redis.setex(
      `session:${sessionId}`,
      30 * 24 * 60 * 60,
      JSON.stringify({
        ...session,
        userId,
        boundAt: new Date().toISOString(),
      })
    );
  }

  async touchSession(sessionId: string) {
    await this.redis.expire(`session:${sessionId}`, 30 * 24 * 60 * 60);
  }
}

export const sessionService = new SessionService();
