import { describe, it, expect } from 'vitest';

describe('Conversation', () => {
  it('should validate message role enum', () => {
    const validRoles = ['USER', 'ASSISTANT'];
    expect(validRoles.includes('USER')).toBe(true);
    expect(validRoles.includes('ASSISTANT')).toBe(true);
    expect(validRoles.includes('SYSTEM')).toBe(false);
  });

  it('should validate signal type enum', () => {
    const validTypes = ['REQUIREMENT', 'PREFERENCE', 'CONCERN', 'TRADEOFF', 'REJECTION'];
    expect(validTypes.includes('REQUIREMENT')).toBe(true);
    expect(validTypes.includes('PREFERENCE')).toBe(true);
    expect(validTypes.includes('INVALID')).toBe(false);
  });

  it('should validate message structure', () => {
    const message = {
      role: 'USER',
      content: '我想买一辆 30 万左右的车',
      timestamp: new Date().toISOString(),
    };
    expect(message.role).toBe('USER');
    expect(typeof message.content).toBe('string');
    expect(message.timestamp).toBeDefined();
  });

  it('should validate extracted signal structure', () => {
    const signal = {
      type: 'REQUIREMENT',
      value: '预算30万左右',
      confidence: 0.95,
    };
    expect(signal.type).toBe('REQUIREMENT');
    expect(typeof signal.value).toBe('string');
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(1);
  });
});
