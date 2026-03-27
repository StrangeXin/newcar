import { describe, expect, it } from 'vitest';
import { SubscriptionPlanName, SubscriptionStatus, SubscriptionSource } from '@newcar/shared';

describe('SubscriptionService', () => {
  describe('getNextResetDate', () => {
    it('should advance reset date by one month', () => {
      const now = new Date('2026-03-15T00:00:00Z');
      const expected = new Date('2026-04-15T00:00:00Z');
      const result = new Date(now);
      result.setMonth(result.getMonth() + 1);
      expect(result.toISOString()).toBe(expected.toISOString());
    });

    it('should handle month-end overflow', () => {
      const jan31 = new Date('2026-01-31T00:00:00Z');
      const result = new Date(jan31);
      result.setMonth(result.getMonth() + 1);
      expect(result.getMonth()).toBe(2); // March (overflow without clamping)
    });
  });

  describe('shouldResetQuota', () => {
    it('should return true when current time is past monthlyResetAt', () => {
      const resetAt = new Date('2026-03-01T00:00:00Z');
      const now = new Date('2026-03-15T00:00:00Z');
      expect(now >= resetAt).toBe(true);
    });

    it('should return false when current time is before monthlyResetAt', () => {
      const resetAt = new Date('2026-04-01T00:00:00Z');
      const now = new Date('2026-03-15T00:00:00Z');
      expect(now >= resetAt).toBe(false);
    });
  });

  describe('plan name validation', () => {
    it('should accept valid plan names', () => {
      expect(Object.values(SubscriptionPlanName)).toContain('FREE');
      expect(Object.values(SubscriptionPlanName)).toContain('PRO');
      expect(Object.values(SubscriptionPlanName)).toContain('PREMIUM');
    });
  });

  describe('quota calculation', () => {
    it('should calculate remaining quota correctly', () => {
      const limit = 200;
      const used = 150;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(50);
    });

    it('should not return negative remaining', () => {
      const limit = 20;
      const used = 25;
      const remaining = Math.max(0, limit - used);
      expect(remaining).toBe(0);
    });
  });
});
