import { Router } from 'express';
import db from '../db.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { serializePost } from './posts.js';

const router = Router();

function topicMeta(t, viewerId) {
  const followers = db.prepare('SELECT COUNT(*) c FROM topic_follows WHERE topic_id=?').get(t.id).c;
  const isFollowing = viewerId ? !!db.prepare('SELECT 1 FROM topic_follows WHERE user_id=? AND topic_id=?').get(viewerId, t.id) : false;
  return { ...t, followers, isFollowing };
}

// Hot topics (right sidebar / search 空态) + optional ?q= search (for # autocomplete)
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  // 搜索空态等场景可传 ?limit= 控制数量；默认 12（右侧栏），上限 50
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  const rows = q
    ? db.prepare('SELECT * FROM topics WHERE name LIKE ? ORDER BY hot DESC LIMIT 8').all(`%${q}%`)
    : db.prepare('SELECT * FROM topics ORDER BY hot DESC, post_count DESC LIMIT ?').all(limit);
  res.json({ topics: rows });
});

// Topics the viewer follows (for the discover page "我关注的话题")
router.get('/following', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT t.* FROM topic_follows f JOIN topics t ON t.id=f.topic_id
    WHERE f.user_id=? ORDER BY f.created_at DESC`).all(req.user.id);
  res.json({ topics: rows.map(t => topicMeta(t, req.user.id)) });
});

// Single topic + its posts
router.get('/:name', optionalAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM topics WHERE name=?').get(req.params.name);
  if (!t) return res.status(404).json({ error: '话题不存在' });
  const rows = db.prepare("SELECT * FROM posts WHERE topic_id=? AND visibility!='private' ORDER BY created_at DESC LIMIT 50").all(t.id);
  res.json({ topic: topicMeta(t, req.user?.id), posts: rows.map(r => serializePost(r, req.user?.id)).filter(Boolean) });
});

// Follow / unfollow a topic
router.post('/:name/follow', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM topics WHERE name=?').get(req.params.name);
  if (!t) return res.status(404).json({ error: '话题不存在' });
  const has = db.prepare('SELECT 1 FROM topic_follows WHERE user_id=? AND topic_id=?').get(req.user.id, t.id);
  if (has) {
    db.prepare('DELETE FROM topic_follows WHERE user_id=? AND topic_id=?').run(req.user.id, t.id);
    return res.json({ following: false });
  }
  db.prepare('INSERT INTO topic_follows (user_id, topic_id) VALUES (?,?)').run(req.user.id, t.id);
  res.json({ following: true });
});

export default router;
