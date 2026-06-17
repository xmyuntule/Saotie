import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, getUser } from '../helpers.js';

const router = Router();

// Resolve a history row to a display card by content type. Returns null if the
// underlying content was deleted, so deleted items quietly drop out of 足迹.
function resolve(row, viewerId) {
  const base = { type: row.target_type, id: row.target_id, viewedAt: row.viewed_at };
  if (row.target_type === 'post') {
    const p = db.prepare('SELECT id, content, user_id FROM posts WHERE id=?').get(row.target_id);
    if (!p) return null;
    const text = (p.content || '').replace(/[#@]/g, '').trim();
    return { ...base, typeLabel: '动态', icon: 'comment', link: `/post/${p.id}`,
      title: text ? text.slice(0, 60) : '[图片 / 视频]', author: publicUser(getUser(p.user_id), viewerId) };
  }
  if (row.target_type === 'thread') {
    const t = db.prepare('SELECT id, title, user_id FROM threads WHERE id=?').get(row.target_id);
    if (!t) return null;
    return { ...base, typeLabel: '帖子', icon: 'forum', link: `/thread/${t.id}`,
      title: t.title, author: publicUser(getUser(t.user_id), viewerId) };
  }
  if (row.target_type === 'article') {
    const a = db.prepare('SELECT id, title, user_id, cover FROM articles WHERE id=?').get(row.target_id);
    if (!a) return null;
    return { ...base, typeLabel: '专栏', icon: 'book', link: `/article/${a.id}`, cover: a.cover || '',
      title: a.title, author: publicUser(getUser(a.user_id), viewerId) };
  }
  if (row.target_type === 'question') {
    const q = db.prepare('SELECT id, title, user_id, status FROM questions WHERE id=?').get(row.target_id);
    if (!q) return null;
    return { ...base, typeLabel: '问答', icon: 'help', link: `/qa/${q.id}`, solved: q.status === 'solved',
      title: q.title, author: publicUser(getUser(q.user_id), viewerId) };
  }
  return null;
}

// The viewer's recent browse history (newest first), resolved to display cards.
router.get('/', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM view_history WHERE user_id=? ORDER BY viewed_at DESC LIMIT 80').all(req.user.id);
  const items = rows.map((r) => resolve(r, req.user.id)).filter(Boolean);
  res.json({ items });
});

// Remove one entry
router.delete('/:type/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM view_history WHERE user_id=? AND target_type=? AND target_id=?')
    .run(req.user.id, req.params.type, req.params.id);
  res.json({ ok: true });
});

// Clear all history
router.delete('/', requireAuth, (req, res) => {
  db.prepare('DELETE FROM view_history WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
});

export default router;
