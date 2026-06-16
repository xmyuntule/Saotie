import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';
import { serializePost } from './posts.js';

const router = Router();

const slugify = (s) =>
  (s || '').toString().trim().toLowerCase()
    .replace(/[^\w一-龥]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `c-${Date.now()}`;

function serializeCircle(row, viewerId) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    category: row.category,
    color: row.color,
    icon: row.icon,
    cover: row.cover,
    memberCount: row.member_count,
    postCount: row.post_count,
    createdAt: row.created_at,
    owner: row.owner_id ? publicUser(getUser(row.owner_id), viewerId) : null,
    joined: viewerId ? !!db.prepare('SELECT 1 FROM circle_members WHERE circle_id=? AND user_id=?').get(row.id, viewerId) : false,
  };
}

// List circles — ?sort=hot|new, ?category=, ?mine=1
router.get('/', optionalAuth, (req, res) => {
  const { category, sort = 'hot', mine } = req.query;
  const viewerId = req.user?.id;
  if (mine && viewerId) {
    const rows = db.prepare(`SELECT c.* FROM circles c
      JOIN circle_members m ON m.circle_id = c.id
      WHERE m.user_id = ? ORDER BY m.joined_at DESC`).all(viewerId);
    return res.json({ circles: rows.map((r) => serializeCircle(r, viewerId)) });
  }
  const order = sort === 'new' ? 'c.created_at DESC' : 'c.member_count DESC, c.post_count DESC';
  const rows = category
    ? db.prepare(`SELECT * FROM circles c WHERE category=? ORDER BY ${order}`).all(category)
    : db.prepare(`SELECT * FROM circles c ORDER BY ${order}`).all();
  res.json({ circles: rows.map((r) => serializeCircle(r, viewerId)) });
});

// Suggested circles for sidebar — most active the viewer hasn't joined yet
router.get('/suggestions', optionalAuth, (req, res) => {
  const viewerId = req.user?.id;
  const rows = db.prepare('SELECT * FROM circles ORDER BY member_count DESC, post_count DESC LIMIT 12').all();
  const out = rows
    .map((r) => serializeCircle(r, viewerId))
    .filter((c) => !c.joined)
    .slice(0, 5);
  res.json({ circles: out });
});

// Circle detail by slug (or numeric id)
router.get('/:slug', optionalAuth, (req, res) => {
  const { slug } = req.params;
  const row = /^\d+$/.test(slug)
    ? db.prepare('SELECT * FROM circles WHERE id=?').get(Number(slug))
    : db.prepare('SELECT * FROM circles WHERE slug=?').get(slug);
  if (!row) return res.status(404).json({ error: '圈子不存在' });
  const members = db.prepare(`SELECT u.id FROM circle_members m JOIN users u ON u.id=m.user_id
    WHERE m.circle_id=? ORDER BY (m.role='owner') DESC, m.joined_at ASC LIMIT 12`).all(row.id)
    .map((m) => publicUser(getUser(m.id), req.user?.id));
  res.json({ circle: serializeCircle(row, req.user?.id), members });
});

// Circle feed
router.get('/:slug/posts', optionalAuth, (req, res) => {
  const { slug } = req.params;
  const row = /^\d+$/.test(slug)
    ? db.prepare('SELECT * FROM circles WHERE id=?').get(Number(slug))
    : db.prepare('SELECT * FROM circles WHERE slug=?').get(slug);
  if (!row) return res.status(404).json({ error: '圈子不存在' });
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const rows = db.prepare(`SELECT * FROM posts WHERE circle_id=? AND visibility != 'private'
    ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`).all(row.id, limit, offset);
  res.json({ posts: rows.map((r) => serializePost(r, req.user?.id)).filter(Boolean) });
});

// Create a circle
router.post('/', requireAuth, (req, res) => {
  let { name, description = '', category = '兴趣', color = '', icon = 'circle' } = req.body || {};
  name = (name || '').trim();
  if (!name) return res.status(400).json({ error: '圈子名称必填' });
  if (name.length > 24) return res.status(400).json({ error: '圈子名称最多 24 字' });
  if (checkSensitive(name) || checkSensitive(description))
    return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  let slug = slugify(name);
  if (db.prepare('SELECT 1 FROM circles WHERE slug=?').get(slug)) slug = `${slug}-${Date.now().toString(36)}`;
  const info = db.prepare(`INSERT INTO circles (name, slug, description, category, color, icon, owner_id, member_count)
    VALUES (?,?,?,?,?,?,?,1)`).run(name, slug, description.slice(0, 200), category, color, icon, req.user.id);
  db.prepare("INSERT INTO circle_members (circle_id, user_id, role) VALUES (?,?,'owner')").run(info.lastInsertRowid, req.user.id);
  const row = db.prepare('SELECT * FROM circles WHERE id=?').get(info.lastInsertRowid);
  res.json({ circle: serializeCircle(row, req.user.id) });
});

// Join / leave
router.post('/:id/join', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT * FROM circles WHERE id=?').get(id);
  if (!c) return res.status(404).json({ error: '圈子不存在' });
  const already = db.prepare('SELECT 1 FROM circle_members WHERE circle_id=? AND user_id=?').get(id, req.user.id);
  if (already) return res.json({ joined: true, memberCount: c.member_count });
  db.prepare('INSERT INTO circle_members (circle_id, user_id) VALUES (?,?)').run(id, req.user.id);
  db.prepare('UPDATE circles SET member_count = member_count + 1 WHERE id=?').run(id);
  res.json({ joined: true, memberCount: c.member_count + 1 });
});

router.post('/:id/leave', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT * FROM circles WHERE id=?').get(id);
  if (!c) return res.status(404).json({ error: '圈子不存在' });
  if (c.owner_id === req.user.id) return res.status(400).json({ error: '圈主不能退出自己的圈子' });
  const info = db.prepare('DELETE FROM circle_members WHERE circle_id=? AND user_id=?').run(id, req.user.id);
  if (info.changes) db.prepare('UPDATE circles SET member_count = MAX(0, member_count - 1) WHERE id=?').run(id);
  res.json({ joined: false, memberCount: Math.max(0, c.member_count - (info.changes ? 1 : 0)) });
});

export default router;
