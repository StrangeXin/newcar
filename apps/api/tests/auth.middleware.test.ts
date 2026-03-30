import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/auth.service', () => ({
  authService: {
    verifyToken: vi.fn(),
  },
}));

import { authService } from '../src/services/auth.service';
import { authMiddleware, optionalAuth } from '../src/middleware/auth';

const mockedAuthService = authService as any;

function mockReqResNext(headers: Record<string, string> = {}) {
  const req = { headers, userId: undefined, sessionId: undefined, userRole: undefined } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authMiddleware', () => {
  it('should return 401 when no Authorization header', () => {
    const { req, res, next } = mockReqResNext();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization does not start with Bearer', () => {
    const { req, res, next } = mockReqResNext({ authorization: 'Basic abc123' });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token type is not access', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', type: 'refresh',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token type' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when verifyToken throws', () => {
    mockedAuthService.verifyToken.mockImplementation(() => { throw new Error('jwt malformed'); });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer bad-token' });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should set userId/sessionId/userRole and call next() for valid access token', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', role: 'MEMBER', type: 'access',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });
    authMiddleware(req, res, next);
    expect(req.userId).toBe('u1');
    expect(req.sessionId).toBe('s1');
    expect(req.userRole).toBe('MEMBER');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('optionalAuth', () => {
  it('should call next() without setting userId when no header', () => {
    const { req, res, next } = mockReqResNext();
    optionalAuth(req, res, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });

  it('should set userId and call next() for valid token', () => {
    mockedAuthService.verifyToken.mockReturnValue({
      userId: 'u1', sessionId: 's1', role: 'ADMIN',
    });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer valid-token' });
    optionalAuth(req, res, next);
    expect(req.userId).toBe('u1');
    expect(req.userRole).toBe('ADMIN');
    expect(next).toHaveBeenCalled();
  });

  it('should silently call next() when verifyToken throws', () => {
    mockedAuthService.verifyToken.mockImplementation(() => { throw new Error('expired'); });
    const { req, res, next } = mockReqResNext({ authorization: 'Bearer expired-token' });
    optionalAuth(req, res, next);
    expect(req.userId).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});
