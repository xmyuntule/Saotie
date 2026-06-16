import jwt from 'jsonwebtoken';
import { getUser } from '../helpers.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'hahasns-dev-secret-change-me';

export function sign(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
}

// Attaches req.user if a valid token is present; does not block.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = getUser(payload.id) || null;
    } catch { /* ignore invalid token */ }
  }
  next();
}

// Blocks the request if not authenticated.
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '请先登录' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: '需要管理员权限' });
  next();
}
