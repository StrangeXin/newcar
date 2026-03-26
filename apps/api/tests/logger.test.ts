import { describe, it, expect } from 'vitest';
import { logger } from '../src/lib/logger';

describe('logger', () => {
  it('should export a pino logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should support child loggers with context', () => {
    const child = logger.child({ service: 'test' });
    expect(typeof child.info).toBe('function');
  });
});
