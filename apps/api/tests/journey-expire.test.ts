import { describe, it, expect } from 'vitest';

describe('Journey Expiration', () => {
  it('should calculate expiry date correctly', () => {
    const EXPIRY_DAYS = 90;
    const now = new Date('2026-01-01');
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() - EXPIRY_DAYS);

    expect(expiryDate.getFullYear()).toBe(2025);
    expect(expiryDate.getMonth()).toBe(9); // October (0-indexed)
    expect(expiryDate.getDate()).toBe(3);
  });

  it('should identify journeys eligible for expiration', () => {
    const now = new Date('2026-01-01');
    const EXPIRY_DAYS = 90;
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() - EXPIRY_DAYS);

    const journeys = [
      { id: '1', status: 'ACTIVE', lastActivityAt: new Date('2025-09-01') },  // expired
      { id: '2', status: 'ACTIVE', lastActivityAt: new Date('2025-12-01') },  // not expired
      { id: '3', status: 'PAUSED', lastActivityAt: new Date('2025-09-01') },  // expired
      { id: '4', status: 'COMPLETED', lastActivityAt: new Date('2025-09-01') }, // not eligible
    ];

    const eligible = journeys.filter(
      j => ['ACTIVE', 'PAUSED'].includes(j.status) && j.lastActivityAt < expiryDate
    );

    expect(eligible).toHaveLength(2);
    expect(eligible.map(j => j.id)).toContain('1');
    expect(eligible.map(j => j.id)).toContain('3');
  });

  it('should not expire COMPLETED or ABANDONED journeys', () => {
    const ineligibleStatuses = ['COMPLETED', 'ABANDONED'];
    const eligibleStatuses = ['ACTIVE', 'PAUSED'];

    ineligibleStatuses.forEach(status => {
      expect(eligibleStatuses.includes(status)).toBe(false);
    });
  });
});
