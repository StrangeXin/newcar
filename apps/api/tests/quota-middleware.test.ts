import { describe, expect, it } from 'vitest';

type QuotaType = 'conversation' | 'report';

function isQuotaExceeded(
  quotaType: QuotaType,
  used: number,
  limit: number
): boolean {
  return used >= limit;
}

describe('Quota Middleware', () => {
  describe('isQuotaExceeded', () => {
    it('should return true when conversations used equals limit', () => {
      expect(isQuotaExceeded('conversation', 20, 20)).toBe(true);
    });

    it('should return true when conversations used exceeds limit', () => {
      expect(isQuotaExceeded('conversation', 25, 20)).toBe(true);
    });

    it('should return false when conversations used is below limit', () => {
      expect(isQuotaExceeded('conversation', 10, 20)).toBe(false);
    });

    it('should return true when reports used equals limit', () => {
      expect(isQuotaExceeded('report', 10, 10)).toBe(true);
    });

    it('should return false when reports used is below limit', () => {
      expect(isQuotaExceeded('report', 5, 10)).toBe(false);
    });
  });
});
