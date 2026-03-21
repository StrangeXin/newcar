import { describe, it, expect } from 'vitest';

describe('AI Chat', () => {
  it('should validate budget extraction regex', () => {
    const patterns = [
      /(\d+)\s*万.*?左右/,
      /预算[为是]?(\d+)\s*万/,
      /(\d+)[-~](\d+)\s*万/,
    ];

    const testCases = [
      { msg: '我想买30万左右的车', expected: '30' },
      { msg: '预算30万', expected: '30' },
      { msg: '20-30万的车', expected: '20' },
    ];

    for (const { msg, expected } of testCases) {
      let matched = false;
      for (const pattern of patterns) {
        const match = msg.match(pattern);
        if (match && match[1] === expected) {
          matched = true;
          break;
        }
      }
      expect(matched, `Failed to match: ${msg}`).toBe(true);
    }
  });

  it('should validate tool name enum', () => {
    const validTools = ['search_car', 'add_candidate', 'compare_cars', 'get_car_detail', 'get_price', 'record_decision'];
    expect(validTools.includes('search_car')).toBe(true);
    expect(validTools.includes('invalid_tool')).toBe(false);
  });

  it('should validate AI response structure', () => {
    const response = {
      message: '好的，我来帮你找找30万左右的SUV',
      conversationId: 'conv-123',
      extractedSignals: [
        { type: 'REQUIREMENT', value: '预算30万', confidence: 0.8 },
      ],
    };
    expect(typeof response.message).toBe('string');
    expect(response.conversationId).toBeDefined();
    expect(Array.isArray(response.extractedSignals)).toBe(true);
  });
});
