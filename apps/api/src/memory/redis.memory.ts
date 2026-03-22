import { redis } from '../lib/redis';
import { Signal } from './types';

const CONVERSATION_PREFIX = 'conversation:';
const SIGNALS_PREFIX = 'signals:';
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SerializedMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class RedisMemory {
  async saveMessages(sessionId: string, messages: SerializedMessage[]): Promise<void> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    await redis.setex(key, TTL_SECONDS, JSON.stringify(messages));
  }

  async loadMessages(sessionId: string): Promise<SerializedMessage[]> {
    const key = `${CONVERSATION_PREFIX}${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : [];
  }

  async saveSignals(sessionId: string, signals: Signal[]): Promise<void> {
    const key = `${SIGNALS_PREFIX}${sessionId}`;
    await redis.setex(key, TTL_SECONDS, JSON.stringify(signals));
  }

  async loadSignals(sessionId: string): Promise<Signal[]> {
    const key = `${SIGNALS_PREFIX}${sessionId}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : [];
  }

  async clear(sessionId: string): Promise<void> {
    await redis.del(`${CONVERSATION_PREFIX}${sessionId}`, `${SIGNALS_PREFIX}${sessionId}`);
  }
}

export const redisMemory = new RedisMemory();
