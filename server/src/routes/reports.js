import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, (req, res) => {
  const { targetType, targetId, reason = '' } = req.body || {};
  if (!['post', 'thread', 'comment', 'user'].includes(targetType) || !targetId)
    return res.status(400).json({ error: '参数不合法' });
  db.prepare('INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?,?,?,?)')
    .run(req.user.id, targetType, targetId, reason);
  res.json({ ok: true });
});

export default router;
