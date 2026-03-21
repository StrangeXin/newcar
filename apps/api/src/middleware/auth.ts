import { NextFunction, Request, Response } from 'express';
import { authService } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionId?: string;
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);

  try {
    const payload = authService.verifyToken(token);

    if (payload.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.userId = payload.userId;
    req.sessionId = payload.sessionId;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const payload = authService.verifyToken(token);
      req.userId = payload.userId;
      req.sessionId = payload.sessionId;
    } catch {
      // Ignore invalid token for optional auth
    }
  }

  next();
}
