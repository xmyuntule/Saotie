import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, getUser } from '../helpers.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  const notifications = rows.map(n => ({
    id: n.id, type: n.type, targetType: n.target_type, targetId: n.target_id,
    preview: n.preview, read: !!n.read, createdAt: n.created_at,
    actor: n.actor_id ? publicUser(getUser(n.actor_id), req.user.id) : null,
  }));
  res.json({ notifications });
});

router.get('/unread', requireAuth, (req, res) => {
  const c = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(req.user.id).c;
  res.json({ unread: c });
});

router.post('/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default router;
