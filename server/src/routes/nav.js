import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

// Full directory: categories (ordered) each with their links (ordered)
router.get('/', (req, res) => {
  const cats = db.prepare('SELECT * FROM nav_categories ORDER BY position ASC, id ASC').all();
  const linkStmt = db.prepare('SELECT id, title, url, description, color, clicks FROM nav_links WHERE category_id=? ORDER BY position ASC, clicks DESC, id ASC');
  res.json({
    categories: cats.map((c) => ({
      id: c.id, name: c.name, icon: c.icon,
      links: linkStmt.all(c.id),
    })),
  });
});

// Most-clicked links (sidebar "热门导航")
router.get('/popular', (req, res) => {
  const rows = db.prepare('SELECT id, title, url, color, clicks FROM nav_links ORDER BY clicks DESC, id ASC LIMIT 8').all();
  res.json({ links: rows });
});

// Track a click (fire-and-forget; no auth needed)
router.post('/:id/click', (req, res) => {
  db.prepare('UPDATE nav_links SET clicks = clicks + 1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Admin — create a category
router.post('/categories', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权操作' });
  const { name, icon = 'compass', position = 0 } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: '分类名必填' });
  const info = db.prepare('INSERT INTO nav_categories (name, icon, position) VALUES (?,?,?)').run(name.trim().slice(0, 20), icon, position);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// Admin — create a link
router.post('/links', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '无权操作' });
  const { categoryId, title, url, description = '', color = '', position = 0 } = req.body || {};
  if (!categoryId || !title || !url) return res.status(400).json({ error: '分类 / 标题 / 链接必填' });
  if (checkSensitive(title) || checkSensitive(description)) return res.status(400).json({ error: '内容包含敏感信息' });
  const info = db.prepare('INSERT INTO nav_links (category_id, title, url, description, color, position) VALUES (?,?,?,?,?,?)')
    .run(categoryId, title.trim().slice(0, 40), url.trim().slice(0, 300), description.slice(0, 120), color, position);
  res.json({ ok: true, id: info.lastInsertRowid });
});

export default router;
