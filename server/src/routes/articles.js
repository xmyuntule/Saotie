import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, notify, award, recordView } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

export const CATEGORIES = ['综合', '技术', '设计', '产品', '生活', '观点'];
const readMins = (content) => Math.max(1, Math.round((content || '').length / 400)); // ~400 cn-chars/min

function serializeArticle(a, viewerId, { full = false } = {}) {
  if (!a) return null;
  const liked = viewerId
    ? !!db.prepare("SELECT 1 FROM likes WHERE user_id=? AND target_type='article' AND target_id=?").get(viewerId, a.id)
    : false;
  return {
    id: a.id,
    title: a.title,
    summary: a.summary,
    cover: a.cover,
    category: a.category,
    featured: !!a.featured,
    views: a.views,
    likeCount: a.like_count,
    commentCount: a.comment_count,
    readMins: readMins(a.content),
    createdAt: a.created_at,
    author: publicUser(getUser(a.user_id), viewerId),
    liked,
    ...(full ? { content: a.content } : {}),
  };
}

// List: category filter + sort, plus a featured pick and per-category counts
router.get('/', optionalAuth, (req, res) => {
  const viewerId = req.user?.id;
  const category = CATEGORIES.includes(req.query.category) ? req.query.category : null;
  const order = req.query.sort === 'hot'
    ? '(like_count * 3 + comment_count * 2 + views) DESC, created_at DESC'
    : 'created_at DESC';
  const where = category ? 'WHERE category = ?' : '';
  const rows = db.prepare(`SELECT * FROM articles ${where} ORDER BY ${order} LIMIT 40`).all(...(category ? [category] : []));

  // featured = newest flagged article (only on the unfiltered "全部" + new view)
  let featured = null;
  if (!category && req.query.sort !== 'hot') {
    const f = db.prepare('SELECT * FROM articles WHERE featured = 1 ORDER BY created_at DESC LIMIT 1').get()
      || db.prepare('SELECT * FROM articles ORDER BY (like_count*3+views) DESC LIMIT 1').get();
    featured = f ? serializeArticle(f, viewerId) : null;
  }

  const counts = Object.fromEntries(
    db.prepare('SELECT category, COUNT(*) c FROM articles GROUP BY category').all().map((r) => [r.category, r.c]),
  );
  const list = rows
    .filter((r) => !featured || r.id !== featured.id)
    .map((r) => serializeArticle(r, viewerId));

  res.json({
    featured,
    articles: list,
    categories: CATEGORIES.map((name) => ({ name, count: counts[name] || 0 })),
    total: db.prepare('SELECT COUNT(*) c FROM articles').get().c,
  });
});

// Trending sidebar — top articles by engagement
router.get('/trending', (req, res) => {
  const rows = db.prepare('SELECT * FROM articles ORDER BY (like_count*3+comment_count*2+views) DESC, created_at DESC LIMIT 6').all();
  res.json({ articles: rows.map((r) => ({ id: r.id, title: r.title, category: r.category, views: r.views, likeCount: r.like_count })) });
});

// Detail (+ view count) with a few related reads
router.get('/:id', optionalAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在或已删除' });
  db.prepare('UPDATE articles SET views = views + 1 WHERE id=?').run(a.id);
  a.views += 1;
  recordView(req.user?.id, 'article', a.id);
  const related = db.prepare('SELECT * FROM articles WHERE category=? AND id!=? ORDER BY created_at DESC LIMIT 4')
    .all(a.category, a.id).map((r) => serializeArticle(r, req.user?.id));
  res.json({ article: serializeArticle(a, req.user?.id, { full: true }), related });
});

// Publish an article
router.post('/', requireAuth, (req, res) => {
  let { title = '', summary = '', cover = '', content = '', category = '综合' } = req.body || {};
  title = title.trim(); summary = summary.trim(); content = content.trim();
  if (title.length < 2) return res.status(400).json({ error: '标题至少 2 个字' });
  if (content.length < 10) return res.status(400).json({ error: '正文太短了，再写几句吧' });
  if (!CATEGORIES.includes(category)) category = '综合';
  if (checkSensitive(title) || checkSensitive(content) || checkSensitive(summary))
    return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  // auto-summary from the body if none supplied
  if (!summary) summary = content.replace(/\s+/g, ' ').slice(0, 80);

  const info = db.prepare(`INSERT INTO articles (user_id, title, summary, cover, content, category)
    VALUES (?,?,?,?,?,?)`).run(req.user.id, title, summary, cover, content, category);
  award(req.user.id, { exp: 12 }); // writing long-form earns more than a quick post
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(info.lastInsertRowid);
  res.json({ article: serializeArticle(a, req.user.id, { full: true }) });
});

// Like / unlike
router.post('/:id/like', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  const liked = db.prepare("SELECT 1 FROM likes WHERE user_id=? AND target_type='article' AND target_id=?").get(req.user.id, a.id);
  if (liked) {
    db.prepare("DELETE FROM likes WHERE user_id=? AND target_type='article' AND target_id=?").run(req.user.id, a.id);
    db.prepare('UPDATE articles SET like_count = MAX(0, like_count - 1) WHERE id=?').run(a.id);
    return res.json({ liked: false, likeCount: Math.max(0, a.like_count - 1) });
  }
  db.prepare("INSERT INTO likes (user_id, target_type, target_id) VALUES (?,'article',?)").run(req.user.id, a.id);
  db.prepare('UPDATE articles SET like_count = like_count + 1 WHERE id=?').run(a.id);
  notify({ userId: a.user_id, actorId: req.user.id, type: 'like', targetType: 'article', targetId: a.id, preview: a.title.slice(0, 40) });
  res.json({ liked: true, likeCount: a.like_count + 1 });
});

// Delete (author or admin)
router.delete('/:id', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  if (a.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM articles WHERE id=?').run(a.id);
  db.prepare("DELETE FROM likes WHERE target_type='article' AND target_id=?").run(a.id);
  db.prepare('DELETE FROM comments WHERE article_id=?').run(a.id);
  res.json({ ok: true });
});

export default router;
