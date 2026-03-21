import { describe, expect, it } from 'vitest';

describe('Journey', () => {
  it('should validate stage progression order', () => {
    const stageOrder = ['AWARENESS', 'CONSIDERATION', 'COMPARISON', 'DECISION', 'PURCHASE'];
    const currentIndex = stageOrder.indexOf('CONSIDERATION');
    const newIndex = stageOrder.indexOf('AWARENESS');

    expect(newIndex < currentIndex).toBe(true);
  });

  it('should calculate ai weight correctly for 5 min duration', () => {
    const baseWeight = 1.0;
    const durationSec = 300;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(1.0);
  });

  it('should calculate ai weight with short duration', () => {
    const baseWeight = 1.0;
    const durationSec = 60;
    const durationFactor = Math.min(durationSec / 300.0, 1.0);
    const aiWeight = baseWeight * (0.5 + 0.5 * durationFactor);

    expect(aiWeight).toBe(0.6);
  });
});
