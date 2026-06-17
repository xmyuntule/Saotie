import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, notify, award } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

export const CATEGORIES = ['聚会', '讲座', '运动', '桌游', '线上', '公益'];

// derive status from start/end vs now (no end → assume a 3h window)
function statusOf(e) {
  const now = Date.now();
  const start = new Date(e.start_at).getTime();
  const end = e.end_at ? new Date(e.end_at).getTime() : start + 3 * 3600 * 1000;
  if (Number.isNaN(start)) return 'upcoming';
  if (now < start) return 'upcoming';
  if (now <= end) return 'ongoing';
  return 'ended';
}

function serialize(e, viewerId, { full = false } = {}) {
  if (!e) return null;
  const status = statusOf(e);
  const isFull = e.capacity > 0 && e.signup_count >= e.capacity;
  const signed = viewerId
    ? !!db.prepare('SELECT 1 FROM event_signups WHERE event_id=? AND user_id=?').get(e.id, viewerId)
    : false;
  return {
    id: e.id,
    title: e.title,
    cover: e.cover,
    location: e.location,
    category: e.category,
    startAt: e.start_at,
    endAt: e.end_at,
    capacity: e.capacity,
    fee: e.fee,
    online: !!e.online,
    signupCount: e.signup_count,
    spotsLeft: e.capacity > 0 ? Math.max(0, e.capacity - e.signup_count) : null,
    status,
    full: isFull,
    signed,
    organizer: publicUser(getUser(e.user_id), viewerId),
    isOrganizer: viewerId === e.user_id,
    ...(full ? { description: e.description } : {}),
  };
}

// List with filter (upcoming | past | mine) + category
router.get('/', optionalAuth, (req, res) => {
  const viewerId = req.user?.id;
  const filter = ['upcoming', 'past', 'mine'].includes(req.query.filter) ? req.query.filter : 'upcoming';
  const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;

  let rows = db.prepare('SELECT * FROM events ORDER BY start_at ASC').all();
  if (category) rows = rows.filter((e) => e.category === category);

  if (filter === 'mine' && viewerId) {
    const mine = new Set(db.prepare('SELECT event_id FROM event_signups WHERE user_id=?').all(viewerId).map((r) => r.event_id));
    rows = rows.filter((e) => mine.has(e.id) || e.user_id === viewerId);
    rows.sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  } else if (filter === 'past') {
    rows = rows.filter((e) => statusOf(e) === 'ended').sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  } else {
    rows = rows.filter((e) => statusOf(e) !== 'ended'); // upcoming + ongoing, soonest first
  }

  const counts = {
    upcoming: db.prepare('SELECT * FROM events').all().filter((e) => statusOf(e) !== 'ended').length,
  };
  res.json({
    events: rows.slice(0, 40).map((e) => serialize(e, viewerId)),
    categories: CATEGORIES,
    counts,
  });
});

// Detail + attendees
router.get('/:id', optionalAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: '活动不存在或已取消' });
  const attendeeRows = db.prepare('SELECT user_id FROM event_signups WHERE event_id=? ORDER BY created_at DESC LIMIT 30').all(e.id);
  const attendees = attendeeRows.map((r) => publicUser(getUser(r.user_id), req.user?.id)).filter(Boolean);
  res.json({ event: serialize(e, req.user?.id, { full: true }), attendees });
});

// Create
router.post('/', requireAuth, (req, res) => {
  let { title = '', cover = '', description = '', location = '', category = '聚会',
    startAt = '', endAt = '', capacity = 0, fee = 0, online = false } = req.body || {};
  title = title.trim(); description = description.trim(); location = location.trim();
  if (title.length < 2) return res.status(400).json({ error: '活动标题至少 2 个字' });
  if (!startAt) return res.status(400).json({ error: '请选择开始时间' });
  if (!CATEGORIES.includes(category)) category = '聚会';
  if (checkSensitive(title) || checkSensitive(description) || checkSensitive(location))
    return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  capacity = Math.max(0, Math.min(100000, parseInt(capacity, 10) || 0));
  fee = Math.max(0, Math.min(100000, parseInt(fee, 10) || 0));

  const info = db.prepare(`INSERT INTO events (user_id, title, cover, description, location, category, start_at, end_at, capacity, fee, online)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, title, cover.trim(), description, location, category, startAt, endAt || '', capacity, fee, online ? 1 : 0);
  award(req.user.id, { exp: 10 });
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(info.lastInsertRowid);
  res.json({ event: serialize(e, req.user.id, { full: true }) });
});

// Sign up (capacity + fee gates)
router.post('/:id/signup', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: '活动不存在' });
  if (statusOf(e) === 'ended') return res.status(400).json({ error: '活动已结束，无法报名' });
  if (db.prepare('SELECT 1 FROM event_signups WHERE event_id=? AND user_id=?').get(e.id, req.user.id))
    return res.status(400).json({ error: '你已经报名啦' });
  if (e.capacity > 0 && e.signup_count >= e.capacity) return res.status(400).json({ error: '名额已满' });
  const u = getUser(req.user.id);
  if (e.fee > 0 && u.points < e.fee) return res.status(402).json({ error: `积分不足，报名需 ${e.fee} 积分` });

  db.transaction(() => {
    if (e.fee > 0) db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(e.fee, req.user.id);
    db.prepare('INSERT INTO event_signups (event_id, user_id) VALUES (?,?)').run(e.id, req.user.id);
    db.prepare('UPDATE events SET signup_count = signup_count + 1 WHERE id=?').run(e.id);
  })();
  if (e.user_id !== req.user.id) {
    notify({ userId: e.user_id, actorId: req.user.id, type: 'event', targetType: 'event', targetId: e.id, preview: e.title.slice(0, 40) });
  }
  const fresh = db.prepare('SELECT * FROM events WHERE id=?').get(e.id);
  res.json({ ok: true, event: serialize(fresh, req.user.id, { full: true }), user: publicUser(getUser(req.user.id), req.user.id) });
});

// Cancel signup (refunds the fee)
router.post('/:id/cancel', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: '活动不存在' });
  const signed = db.prepare('SELECT 1 FROM event_signups WHERE event_id=? AND user_id=?').get(e.id, req.user.id);
  if (!signed) return res.status(400).json({ error: '你还没有报名' });

  db.transaction(() => {
    db.prepare('DELETE FROM event_signups WHERE event_id=? AND user_id=?').run(e.id, req.user.id);
    db.prepare('UPDATE events SET signup_count = MAX(0, signup_count - 1) WHERE id=?').run(e.id);
    if (e.fee > 0) db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(e.fee, req.user.id);
  })();
  const fresh = db.prepare('SELECT * FROM events WHERE id=?').get(e.id);
  res.json({ ok: true, event: serialize(fresh, req.user.id, { full: true }), user: publicUser(getUser(req.user.id), req.user.id) });
});

// Delete (organizer or admin)
router.delete('/:id', requireAuth, (req, res) => {
  const e = db.prepare('SELECT * FROM events WHERE id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: '活动不存在' });
  if (e.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM events WHERE id=?').run(e.id);
  db.prepare('DELETE FROM event_signups WHERE event_id=?').run(e.id);
  res.json({ ok: true });
});

export default router;
