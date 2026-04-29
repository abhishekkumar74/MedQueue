import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../auth/jwt.js';

// Extend Express Request to carry the decoded user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Require valid JWT ─────────────────────────────────────

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.slice(7);
  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ── Require specific role(s) ──────────────────────────────

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.type !== 'staff') return res.status(403).json({ error: 'Staff access only' });
    if (!roles.includes(req.user.role ?? '')) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}`,
      });
    }
    return next();
  };
}

// ── Require patient auth ──────────────────────────────────

export function requirePatient(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.type !== 'patient') {
    return res.status(403).json({ error: 'Patient access only' });
  }
  return next();
}
