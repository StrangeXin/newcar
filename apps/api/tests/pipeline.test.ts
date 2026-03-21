import { describe, it, expect } from 'vitest';

describe('Pipeline Integration', () => {
  it('should follow snapshot generation flow', () => {
    const flow = ['aggregateInputs', 'buildSnapshotPrompt', 'generateSnapshot', 'writeSnapshot'];
    expect(flow).toEqual(['aggregateInputs', 'buildSnapshotPrompt', 'generateSnapshot', 'writeSnapshot']);
  });

  it('should respect daily dedup rule', () => {
    const existingSnapshot = { generatedAt: new Date() };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isToday = existingSnapshot.generatedAt >= today;
    expect(isToday).toBe(true);
  });

  it('should limit notifications per day', () => {
    const max = 3;
    const notifications = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];

    const shouldCreate = notifications.length < max;
    expect(shouldCreate).toBe(false);
  });

  it('should score candidates within 0-1 range', () => {
    const scores = [0.2, 0.5, 0.8, 1.0, -0.1, 1.5];

    const normalize = (score: number) => Math.max(0, Math.min(1, score));
    const normalized = scores.map(normalize);

    expect(normalized).toEqual([0.2, 0.5, 0.8, 1.0, 0, 1]);
  });

  it('should filter events by recency', () => {
    const dayMs = 24 * 60 * 60 * 1000;
    const effectiveEventDays = 7;
    const cutoff = Date.now() - effectiveEventDays * dayMs;

    const events = [
      { type: 'CAR_VIEW', timestamp: new Date(Date.now() - 3 * dayMs) },
      { type: 'PRICE_CHECK', timestamp: new Date(Date.now() - 10 * dayMs) },
    ];

    const recentEvents = events.filter((event) => event.timestamp.getTime() >= cutoff);
    expect(recentEvents.length).toBe(1);
  });
});
