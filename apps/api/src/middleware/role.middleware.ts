import { NextFunction, Response } from 'express';
import { AuthenticatedRequest } from './auth';

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.userRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    return next();
  };
}
