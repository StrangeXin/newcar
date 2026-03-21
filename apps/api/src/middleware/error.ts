import { NextFunction, Request, Response } from 'express';
import { config } from '../config';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Unhandled error:', err);

  if (config.nodeEnv === 'production') {
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    if (err.message.includes('already has')) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  return res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    stack: err.stack,
  });
}
