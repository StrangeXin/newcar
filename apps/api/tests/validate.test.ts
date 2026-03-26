import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody } from '../src/lib/validate';

function mockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('validateBody middleware', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  });

  it('calls next() for a valid body', () => {
    const { req, res, next } = mockReqRes({ name: 'Alice', age: 30 });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid body (missing required field)', () => {
    const { req, res, next } = mockReqRes({ name: 'Alice' });
    validateBody(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Validation failed' })
    );
  });

  it('returns 400 with fieldErrors details', () => {
    const { req, res, next } = mockReqRes({ name: '', age: -1 });
    validateBody(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    const callArg = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg.details).toBeDefined();
    expect(callArg.details.name).toBeDefined();
    expect(callArg.details.age).toBeDefined();
  });

  it('strips unknown fields from req.body', () => {
    const { req, res, next } = mockReqRes({ name: 'Bob', age: 25, extra: 'unwanted' });
    validateBody(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).toEqual({ name: 'Bob', age: 25 });
    expect(req.body.extra).toBeUndefined();
  });

  it('returns 400 when body is null/undefined', () => {
    const { req, res, next } = mockReqRes(undefined);
    validateBody(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
