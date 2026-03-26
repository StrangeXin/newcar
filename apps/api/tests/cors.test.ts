import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

describe('CORS', () => {
  const originalEnv = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = originalEnv;
    }
  });

  it('should allow requests from a configured origin', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('should reject requests from an unauthorized origin', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://evil.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.com');
  });

  it('should allow multiple configured origins', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000,https://app.example.com';
    const app = createApp();

    const res1 = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(res1.headers['access-control-allow-origin']).toBe('http://localhost:3000');

    const res2 = await request(app)
      .options('/health')
      .set('Origin', 'https://app.example.com')
      .set('Access-Control-Request-Method', 'GET');

    expect(res2.headers['access-control-allow-origin']).toBe('https://app.example.com');
  });

  it('should default to http://localhost:3000 when CORS_ORIGIN is not set', async () => {
    delete process.env.CORS_ORIGIN;
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('should include credentials support', async () => {
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const app = createApp();

    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });
});
