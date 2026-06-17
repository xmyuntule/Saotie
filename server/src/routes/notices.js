import { Router } from 'express';
import db from '../db.js';
import { optionalAuth, requireAdmin } from '../middleware/auth.js';
import { checkSensitive } from '../sensitive.js';
import { logAdmin } from '../helpers.js';

const router = Router();

const LEVELS = ['info', 'success', 'warning', 'event'];

function serialize(n) {
  return {
    id: n.id,
    title: n.title,
    body: n.body || '',
    level: LEVELS.includes(n.level) ? n.level : 'info',
    link: n.link || '',
    linkLabel: n.link_label || '',
    active: !!n.active,
    pinned: !!n.pinned,
    createdAt: n.created_at,
    updatedAt: n.updated_at,
  };
}

// Public: active notices for the site banner (pinned first, newest next)
router.get('/', optionalAuth, (_req, res) => {
  const rows = db.prepare('SELECT * FROM site_notices WHERE active=1 ORDER BY pinned DESC, created_at DESC LIMIT 5').all();
  res.json({ notices: rows.map(serialize) });
});

// Admin: every notice for management
router.get('/all', requireAdmin, (_req, res) => {
  const rows = db.prepare('SELECT * FROM site_notices ORDER BY pinned DESC, created_at DESC LIMIT 200').all();
  res.json({ notices: rows.map(serialize) });
});

router.post('/', requireAdmin, (req, res) => {
  const title = (req.body?.title || '').trim();
  if (title.length < 2) return res.status(400).json({ error: '公告标题太短，再写几个字吧' });
  const body = (req.body?.body || '').trim();
  if (checkSensitive(title) || checkSensitive(body)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  const level = LEVELS.includes(req.body?.level) ? req.body.level : 'info';
  const info = db.prepare(
    'INSERT INTO site_notices (title, body, level, link, link_label, active, pinned, created_by) VALUES (?,?,?,?,?,?,?,?)',
  ).run(
    title.slice(0, 120),
    body.slice(0, 500),
    level,
    (req.body?.link || '').trim().slice(0, 300),
    (req.body?.linkLabel || '').trim().slice(0, 30),
    req.body?.active === false ? 0 : 1,
    req.body?.pinned ? 1 : 0,
    req.user.id,
  );
  logAdmin(req.user.id, 'notice.create', { targetType: 'notice', targetId: info.lastInsertRowid, detail: title.slice(0, 60) });
  res.json({ ok: true, id: info.lastInsertRowid });
});

router.put('/:id', requireAdmin, (req, res) => {
  const n = db.prepare('SELECT * FROM site_notices WHERE id=?').get(req.params.id);
  if (!n) return res.status(404).json({ error: '公告不存在' });
  const title = (req.body?.title ?? n.title).trim() || n.title;
  const body = (req.body?.body ?? n.body) || '';
  if (checkSensitive(title) || checkSensitive(body)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  const level = LEVELS.includes(req.body?.level) ? req.body.level : n.level;
  const active = req.body?.active === undefined ? n.active : (req.body.active ? 1 : 0);
  const pinned = req.body?.pinned === undefined ? n.pinned : (req.body.pinned ? 1 : 0);
  db.prepare(
    "UPDATE site_notices SET title=?, body=?, level=?, link=?, link_label=?, active=?, pinned=?, updated_at=datetime('now') WHERE id=?",
  ).run(
    title.slice(0, 120),
    body.slice(0, 500),
    level,
    (req.body?.link ?? (n.link || '')).slice(0, 300),
    (req.body?.linkLabel ?? (n.link_label || '')).slice(0, 30),
    active,
    pinned,
    n.id,
  );
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const n = db.prepare('SELECT title FROM site_notices WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM site_notices WHERE id=?').run(req.params.id);
  logAdmin(req.user.id, 'notice.delete', { targetType: 'notice', targetId: req.params.id, detail: n?.title || `#${req.params.id}` });
  res.json({ ok: true });
});

export default router;
