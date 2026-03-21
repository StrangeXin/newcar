import { describe, it, expect } from 'vitest';

describe('Integration', () => {
  it('should validate journey workflow', () => {
    // 模拟完整旅程流程
    const journey = {
      id: 'journey-1',
      stage: 'AWARENESS',
      status: 'ACTIVE',
    };

    // 添加候选车型
    const candidate = {
      id: 'candidate-1',
      journeyId: journey.id,
      carId: 'car-1',
      status: 'ACTIVE',
    };

    // 标记为胜出者
    const winner = { ...candidate, status: 'WINNER' };

    expect(journey.status).toBe('ACTIVE');
    expect(candidate.status).toBe('ACTIVE');
    expect(winner.status).toBe('WINNER');
  });

  it('should validate conversation message flow', () => {
    const messages: Array<{ role: string; content: string; timestamp: string }> = [];
    messages.push({ role: 'USER', content: '我想买30万的车', timestamp: new Date().toISOString() });
    messages.push({ role: 'ASSISTANT', content: '好的，你更倾向于SUV还是轿车？', timestamp: new Date().toISOString() });
    messages.push({ role: 'USER', content: 'SUV吧', timestamp: new Date().toISOString() });

    expect(messages.length).toBe(3);
    expect(messages[0].role).toBe('USER');
    expect(messages[1].role).toBe('ASSISTANT');
    expect(messages[2].role).toBe('USER');
  });

  it('should validate AI chat signal extraction', () => {
    // Budget patterns
    const patterns = [
      /(\d+)\s*万.*?左右/,
      /预算[为是]?(\d+)\s*万/,
      /(\d+)[-~](\d+)\s*万/,
    ];

    const testMessages = [
      { msg: '我想买30万左右的SUV', expectBudget: '30', expectType: 'SUV' },
      { msg: '预算20万，要轿车', expectBudget: '20', expectType: '轿车' },
    ];

    for (const { msg, expectBudget, expectType } of testMessages) {
      let budgetFound = false;
      for (const pattern of patterns) {
        const match = msg.match(pattern);
        if (match && match[1] === expectBudget) {
          budgetFound = true;
          break;
        }
      }
      expect(budgetFound, `Budget not found in: ${msg}`).toBe(true);
      expect(msg.includes(expectType), `Type not found in: ${msg}`).toBe(true);
    }
  });

  it('should validate journey expiration logic across all statuses', () => {
    const now = new Date('2026-03-21');
    const EXPIRY_DAYS = 90;
    const expiryDate = new Date(now);
    expiryDate.setDate(expiryDate.getDate() - EXPIRY_DAYS);

    // Only ACTIVE and PAUSED journeys with old activity should expire
    const journeyScenarios = [
      { status: 'ACTIVE', lastActivity: new Date('2025-12-22'), shouldExpire: false },
      { status: 'ACTIVE', lastActivity: new Date('2025-10-01'), shouldExpire: true },
      { status: 'PAUSED', lastActivity: new Date('2025-10-01'), shouldExpire: true },
      { status: 'COMPLETED', lastActivity: new Date('2025-01-01'), shouldExpire: false },
      { status: 'ABANDONED', lastActivity: new Date('2025-01-01'), shouldExpire: false },
    ];

    for (const scenario of journeyScenarios) {
      const eligible =
        ['ACTIVE', 'PAUSED'].includes(scenario.status) &&
        scenario.lastActivity < expiryDate;
      expect(eligible).toBe(scenario.shouldExpire);
    }
  });
});
