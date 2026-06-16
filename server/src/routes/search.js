import { Router } from 'express';
import db from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { publicUser } from '../helpers.js';
import { serializePost } from './posts.js';

const router = Router();

// Trending search keywords (right sidebar widget)
router.get('/trending', (req, res) => {
  const topics = db.prepare('SELECT name FROM topics ORDER BY hot DESC LIMIT 8').all().map(t => t.name);
  res.json({ keywords: topics });
});

// Global search across users, posts, threads, topics
router.get('/', optionalAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ users: [], posts: [], threads: [], topics: [] });
  const like = `%${q}%`;
  const users = db.prepare('SELECT * FROM users WHERE nickname LIKE ? OR username LIKE ? LIMIT 10').all(like, like);
  const posts = db.prepare("SELECT * FROM posts WHERE content LIKE ? AND visibility IN ('public','paid','password') ORDER BY created_at DESC LIMIT 20").all(like);
  const threads = db.prepare('SELECT * FROM threads WHERE title LIKE ? OR content LIKE ? ORDER BY created_at DESC LIMIT 20').all(like, like);
  const topics = db.prepare('SELECT * FROM topics WHERE name LIKE ? ORDER BY hot DESC LIMIT 10').all(like);
  res.json({
    users: users.map(u => publicUser(u, req.user?.id)),
    posts: posts.map(p => serializePost(p, req.user?.id)).filter(Boolean),
    threads: threads.map(t => ({ id: t.id, title: t.title, replyCount: t.reply_count })),
    topics,
  });
});

export default router;
