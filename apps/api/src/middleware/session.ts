import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth';
import { authService } from '../services/auth.service';
import { sessionService } from '../services/session.service';

export interface SessionRequest extends AuthenticatedRequest {
  isGuest?: boolean;
}

export async function sessionMiddleware(req: SessionRequest, res: Response, next: NextFunction) {
  if (process.env.AI_E2E_MOCK === '1' && req.headers['x-test-auth'] === 'e2e-test-token') {
    req.sessionId = 'test-session-id';
    req.isGuest = false;
    return next();
  }

  let sessionId = req.headers['x-session-id'] as string | undefined;

  if (!sessionId && req.headers.authorization?.startsWith('Bearer ')) {
    try {
      const payload = authService.verifyToken(req.headers.authorization.substring(7));
      sessionId = payload.sessionId;
      req.userId = payload.userId;
    } catch {
      // Ignore and create guest session
    }
  }

  if (!sessionId) {
    const { sessionId: newSessionId } = await sessionService.createGuestSession();
    req.sessionId = newSessionId;
    req.isGuest = true;
    res.setHeader('X-Session-Id', newSessionId);
    return next();
  }

  const session = await sessionService.getSession(sessionId);
  if (!session) {
    const { sessionId: newSessionId } = await sessionService.createGuestSession();
    req.sessionId = newSessionId;
    req.isGuest = true;
    res.setHeader('X-Session-Id', newSessionId);
    return next();
  }

  req.sessionId = sessionId;
  req.isGuest = !session.userId;

  if (session.userId) {
    req.userId = session.userId;
  }

  await sessionService.touchSession(sessionId);
  return next();
}
