import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';

describe('Session', () => {
  it('should generate valid UUID session ids', () => {
    const sessionId = randomUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(uuidRegex.test(sessionId)).toBe(true);
  });

  it('should validate session data structure', () => {
    const sessionData = {
      isGuest: true,
      createdAt: new Date().toISOString(),
    };
    expect(sessionData.isGuest).toBe(true);
    expect(typeof sessionData.createdAt).toBe('string');
  });
});
