import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

const STATUSES = ['open', 'planned', 'doing', 'resolved', 'closed'];

function serialize(f, viewerId) {
  return {
    id: f.id, content: f.content, status: f.status || 'open',
    reply: f.reply || '', repliedAt: f.replied_at || null, createdAt: f.created_at,
    user: f.user_id ? publicUser(getUser(f.user_id), viewerId) : null,
  };
}

// Submit a bug/feature feedback (问题反馈板块)
router.post('/', requireAuth, (req, res) => {
  const content = (req.body?.content || '').trim();
  if (content.length < 5) return res.status(400).json({ error: '反馈内容太短，再多写几个字吧' });
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  const info = db.prepare('INSERT INTO feedback (user_id, content) VALUES (?,?)').run(req.user.id, content.slice(0, 500));
  res.json({ ok: true, id: info.lastInsertRowid });
});

// List feedback (newest first), with optional ?status= filter
router.get('/', optionalAuth, (req, res) => {
  const status = req.query.status;
  const rows = STATUSES.includes(status)
    ? db.prepare('SELECT * FROM feedback WHERE status=? ORDER BY (reply!=\'\') DESC, created_at DESC LIMIT 100').all(status)
    : db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100').all();
  res.json({ feedback: rows.map((f) => serialize(f, req.user?.id)) });
});

// Admin: reply to / set status of a feedback item
router.post('/:id/reply', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权操作' });
  const reply = (req.body?.reply || '').trim().slice(0, 500);
  const status = STATUSES.includes(req.body?.status) ? req.body.status : 'resolved';
  const f = db.prepare('SELECT id FROM feedback WHERE id=?').get(req.params.id);
  if (!f) return res.status(404).json({ error: '反馈不存在' });
  db.prepare("UPDATE feedback SET reply=?, status=?, replied_at=datetime('now') WHERE id=?").run(reply, status, f.id);
  res.json({ ok: true });
});

export default router;
