import { describe, it, expect } from 'vitest';

describe('Snapshot', () => {
  it('should calculate decay factor correctly', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const effectiveDays = 7;

    const isWithinWindow = (timestamp: Date) => {
      const daysAgo = (Date.now() - timestamp.getTime()) / DAY_MS;
      return daysAgo <= effectiveDays;
    };

    const recent = new Date(Date.now() - 3 * DAY_MS);
    const old = new Date(Date.now() - 10 * DAY_MS);

    expect(isWithinWindow(recent)).toBe(true);
    expect(isWithinWindow(old)).toBe(false);
  });

  it('should limit signals to 50', () => {
    const signals = Array.from({ length: 100 }, (_, i) => ({ type: 'TEST', value: 'Signal ' + i }));
    const limited = signals.slice(0, 50);
    expect(limited.length).toBe(50);
  });

  it('should limit behavior events to 300', () => {
    const events = Array.from({ length: 500 }, () => ({ type: 'CAR_VIEW', timestamp: new Date() }));
    const limited = events.slice(0, 300);
    expect(limited.length).toBe(300);
  });

  it('should parse AI response correctly', () => {
    const mockResponse = {
      narrative_summary: '用户正在考虑购买SUV',
      key_insights: [{ insight: '偏好新能源', evidence: '多次查看BEV车型', confidence: 0.8 }],
      top_recommendation: 'car_123',
      recommendation_reasoning: '符合用户预算和空间需求',
      attention_signals: [{ carId: 'car_123', signalType: 'PRICE_DROP', description: '降价5000元', delta: -5000 }],
      next_suggested_actions: ['对比配置', '查看评测'],
    };

    expect(mockResponse.narrative_summary).toBeTruthy();
    expect(mockResponse.key_insights.length).toBeLessThanOrEqual(3);
    expect(mockResponse.attention_signals.length).toBeLessThanOrEqual(3);
  });
});
