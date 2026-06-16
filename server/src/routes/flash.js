import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const mapRow = (r) => ({
  id: r.id, title: r.title, summary: r.summary, category: r.category,
  url: r.url, pinned: r.pinned, createdAt: r.created_at,
});

// 资讯快报列表（置顶优先，最新在前）；?limit= 控制条数，?category= 过滤
router.get('/', (req, res) => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  const cat = req.query.category;
  const rows = cat
    ? db.prepare('SELECT * FROM flash WHERE category=? ORDER BY pinned DESC, created_at DESC LIMIT ?').all(cat, limit)
    : db.prepare('SELECT * FROM flash ORDER BY pinned DESC, created_at DESC LIMIT ?').all(limit);
  res.json({ flash: rows.map(mapRow) });
});

// 管理员发布快报
router.post('/', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权操作' });
  const { title, summary = '', category = '动态', url = '', pinned = 0 } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: '标题必填' });
  const info = db.prepare('INSERT INTO flash (title, summary, category, url, pinned) VALUES (?,?,?,?,?)')
    .run(title.trim().slice(0, 120), summary.slice(0, 300), category, url.slice(0, 300), pinned ? 1 : 0);
  res.json({ ok: true, id: info.lastInsertRowid });
});

export default router;
