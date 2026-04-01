import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

describe('Promptfoo L1 Mock Tests', () => {
  it('should pass all L1 scenario tests', async () => {
    const { evaluate } = await import('promptfoo');

    const configPath = resolve(__dirname, '../../promptfoo/promptfooconfig.yaml');

    const results = await evaluate({
      config: configPath,
      maxConcurrency: 1,
    });

    const failedTests = results.results.filter((r) => !r.success);

    if (failedTests.length > 0) {
      const failures = failedTests.map(
        (t) =>
          `  - ${t.vars?.message || 'unknown'}: ${t.failureReason || 'assertion failed'}`,
      );
      console.error(`Failed tests:\n${failures.join('\n')}`);
    }

    expect(failedTests).toHaveLength(0);
  }, 120000);
});
