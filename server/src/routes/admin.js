import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { publicUser, getUser, notify, logAdmin } from '../helpers.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// ---- audit log (管理操作日志) ----
const ACTION_LABEL = {
  'user.update': '编辑用户', 'content.delete': '删除内容', 'report.resolve': '处理举报',
  'board.create': '新建板块', 'board.update': '编辑板块', 'board.delete': '删除板块', 'board.moderator': '版主变更',
  'topic.create': '新建话题', 'topic.delete': '删除话题', 'product.create': '上架商品', 'product.delete': '下架商品',
  'notice.create': '发布公告', 'notice.update': '编辑公告', 'notice.delete': '删除公告',
};
router.get('/audit', (req, res) => {
  const rows = db.prepare('SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT 120').all();
  res.json({ logs: rows.map((r) => ({
    id: r.id, action: r.action, actionLabel: ACTION_LABEL[r.action] || r.action,
    targetType: r.target_type, targetId: r.target_id, detail: r.detail, createdAt: r.created_at,
    admin: publicUser(getUser(r.admin_id)),
  })) });
});

// ---- site overview ----
router.get('/overview', (req, res) => {
  const one = (sql) => db.prepare(sql).get().c;
  // last-7-days activity (fill gaps with 0)
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    days.push({
      date: d,
      posts: db.prepare("SELECT COUNT(*) c FROM posts WHERE date(created_at)=?").get(d).c,
      comments: db.prepare("SELECT COUNT(*) c FROM comments WHERE date(created_at)=?").get(d).c,
      users: db.prepare("SELECT COUNT(*) c FROM users WHERE date(created_at)=?").get(d).c,
    });
  }
  res.json({
    stats: {
      users: one('SELECT COUNT(*) c FROM users'),
      posts: one('SELECT COUNT(*) c FROM posts'),
      threads: one('SELECT COUNT(*) c FROM threads'),
      comments: one('SELECT COUNT(*) c FROM comments'),
      topics: one('SELECT COUNT(*) c FROM topics'),
      boards: one('SELECT COUNT(*) c FROM boards'),
      reports: one("SELECT COUNT(*) c FROM reports WHERE status='open'"),
      vip: one('SELECT COUNT(*) c FROM users WHERE vip=1'),
    },
    activity: days,
    recentUsers: db.prepare('SELECT * FROM users ORDER BY id DESC LIMIT 5').all().map(u => publicUser(u)),
  });
});

// ---- users ----
router.get('/users', (req, res) => {
  const q = `%${(req.query.q || '').trim()}%`;
  const rows = db.prepare('SELECT * FROM users WHERE nickname LIKE ? OR username LIKE ? ORDER BY id DESC LIMIT 100').all(q, q);
  res.json({ users: rows.map(u => ({ ...publicUser(u), email: u.email })) });
});

router.put('/users/:id', (req, res) => {
  const u = getUser(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const { verified, vip, role, banned, verifiedNote, title, points } = req.body || {};
  db.prepare(`UPDATE users SET
      verified = COALESCE(?, verified), vip = COALESCE(?, vip), role = COALESCE(?, role),
      banned = COALESCE(?, banned), verified_note = COALESCE(?, verified_note),
      title = COALESCE(?, title), points = COALESCE(?, points)
    WHERE id=?`).run(
      verified === undefined ? null : (verified ? 1 : 0),
      vip === undefined ? null : (vip ? 1 : 0),
      role ?? null,
      banned === undefined ? null : (banned ? 1 : 0),
      verifiedNote ?? null, title ?? null,
      points ?? null, u.id);
  if (verified) notify({ userId: u.id, actorId: null, type: 'system', preview: '恭喜！你已获得官方 V 认证 ✅' });
  const changes = [];
  if (banned !== undefined) changes.push(banned ? '封禁' : '解封');
  if (vip !== undefined) changes.push(vip ? '开通会员' : '取消会员');
  if (verified !== undefined) changes.push(verified ? '加 V 认证' : '取消认证');
  if (role) changes.push(`角色→${role}`);
  if (points !== undefined) changes.push(`积分→${points}`);
  if (title !== undefined && title) changes.push(`头衔→${title}`);
  logAdmin(req.user.id, 'user.update', { targetType: 'user', targetId: u.id, detail: `${u.nickname}（@${u.username}）${changes.join('、') || '资料更新'}` });
  res.json({ user: publicUser(getUser(u.id)) });
});

// ---- boards ----
router.post('/boards', (req, res) => {
  const { name, slug, description = '', icon = '📁', parentId = null, announcement = '', isPaid = 0, price = 0 } = req.body || {};
  if (!name || !slug) return res.status(400).json({ error: '板块名称和 slug 必填' });
  if (db.prepare('SELECT 1 FROM boards WHERE slug=?').get(slug)) return res.status(409).json({ error: 'slug 已存在' });
  const info = db.prepare(`INSERT INTO boards (parent_id,name,slug,description,icon,announcement,is_paid,price) VALUES (?,?,?,?,?,?,?,?)`)
    .run(parentId || null, name, slug, description, icon, announcement, isPaid ? 1 : 0, price);
  logAdmin(req.user.id, 'board.create', { targetType: 'board', targetId: info.lastInsertRowid, detail: name });
  res.json({ board: db.prepare('SELECT * FROM boards WHERE id=?').get(info.lastInsertRowid) });
});

router.put('/boards/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM boards WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: '板块不存在' });
  const { name, description, icon, announcement, isPaid, price, sort } = req.body || {};
  db.prepare(`UPDATE boards SET name=COALESCE(?,name), description=COALESCE(?,description),
      icon=COALESCE(?,icon), announcement=COALESCE(?,announcement),
      is_paid=COALESCE(?,is_paid), price=COALESCE(?,price), sort=COALESCE(?,sort) WHERE id=?`)
    .run(name ?? null, description ?? null, icon ?? null, announcement ?? null,
      isPaid === undefined ? null : (isPaid ? 1 : 0), price ?? null, sort ?? null, b.id);
  logAdmin(req.user.id, 'board.update', { targetType: 'board', targetId: b.id, detail: name || b.name });
  res.json({ ok: true });
});

router.delete('/boards/:id', (req, res) => {
  const b = db.prepare('SELECT name FROM boards WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM boards WHERE id=?').run(req.params.id);
  logAdmin(req.user.id, 'board.delete', { targetType: 'board', targetId: req.params.id, detail: b?.name || `#${req.params.id}` });
  res.json({ ok: true });
});

// add / remove moderator
router.post('/boards/:id/moderators', (req, res) => {
  const boardId = Number(req.params.id);
  const { username } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username=? OR nickname=?').get(username, username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const exists = db.prepare('SELECT 1 FROM moderators WHERE board_id=? AND user_id=?').get(boardId, u.id);
  if (exists) {
    db.prepare('DELETE FROM moderators WHERE board_id=? AND user_id=?').run(boardId, u.id);
    logAdmin(req.user.id, 'board.moderator', { targetType: 'board', targetId: boardId, detail: `取消 @${u.username} 的版主` });
    return res.json({ added: false });
  }
  db.prepare('INSERT INTO moderators (board_id, user_id) VALUES (?,?)').run(boardId, u.id);
  notify({ userId: u.id, actorId: req.user.id, type: 'system', preview: '你已被任命为板块版主 🛡️' });
  logAdmin(req.user.id, 'board.moderator', { targetType: 'board', targetId: boardId, detail: `任命 @${u.username} 为版主` });
  res.json({ added: true, user: publicUser(u) });
});

// ---- topics ----
router.post('/topics', (req, res) => {
  const { name, description = '' } = req.body || {};
  if (!name) return res.status(400).json({ error: '话题名必填' });
  if (db.prepare('SELECT 1 FROM topics WHERE name=?').get(name)) return res.status(409).json({ error: '话题已存在' });
  const info = db.prepare('INSERT INTO topics (name, description, hot) VALUES (?,?,?)').run(name, description, 50);
  logAdmin(req.user.id, 'topic.create', { targetType: 'topic', targetId: info.lastInsertRowid, detail: `#${name}#` });
  res.json({ topic: db.prepare('SELECT * FROM topics WHERE id=?').get(info.lastInsertRowid) });
});
router.delete('/topics/:id', (req, res) => {
  const t = db.prepare('SELECT name FROM topics WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM topics WHERE id=?').run(req.params.id);
  logAdmin(req.user.id, 'topic.delete', { targetType: 'topic', targetId: req.params.id, detail: t ? `#${t.name}#` : `#${req.params.id}` });
  res.json({ ok: true });
});

// preview of a reported target (post / thread / comment / user)
function reportTarget(type, id) {
  if (type === 'post') {
    const p = db.prepare('SELECT * FROM posts WHERE id=?').get(id);
    return p ? { exists: true, text: (p.content || '(无文字)').slice(0, 80), author: publicUser(getUser(p.user_id)) } : { exists: false };
  }
  if (type === 'thread') {
    const t = db.prepare('SELECT * FROM threads WHERE id=?').get(id);
    return t ? { exists: true, text: t.title, author: publicUser(getUser(t.user_id)) } : { exists: false };
  }
  if (type === 'comment') {
    const c = db.prepare('SELECT * FROM comments WHERE id=?').get(id);
    return c ? { exists: true, text: (c.content || '').slice(0, 80), author: publicUser(getUser(c.user_id)) } : { exists: false };
  }
  if (type === 'user') {
    const u = getUser(id);
    return u ? { exists: true, text: `@${u.username}`, author: publicUser(u) } : { exists: false };
  }
  return { exists: false };
}

// ---- reports ----
router.get('/reports', (req, res) => {
  const rows = db.prepare("SELECT * FROM reports WHERE status='open' ORDER BY created_at DESC LIMIT 100").all();
  res.json({ reports: rows.map(r => ({
    id: r.id, targetType: r.target_type, targetId: r.target_id, reason: r.reason,
    createdAt: r.created_at, reporter: publicUser(getUser(r.reporter_id)),
    target: reportTarget(r.target_type, r.target_id),
  })) });
});
router.post('/reports/:id/resolve', (req, res) => {
  const r = db.prepare('SELECT target_type FROM reports WHERE id=?').get(req.params.id);
  db.prepare("UPDATE reports SET status='resolved' WHERE id=?").run(req.params.id);
  logAdmin(req.user.id, 'report.resolve', { targetType: 'report', targetId: req.params.id, detail: `处理${r ? ` ${r.target_type}` : ''}举报 #${req.params.id}` });
  res.json({ ok: true });
});

// ---- mall products ----
router.post('/products', (req, res) => {
  const { name, description = '', icon = '🎁', category = 'item', payload = '', price, stock = -1 } = req.body || {};
  if (!name || !price) return res.status(400).json({ error: '名称和价格必填' });
  const info = db.prepare('INSERT INTO products (name,description,icon,category,payload,price,stock) VALUES (?,?,?,?,?,?,?)')
    .run(name, description, icon, category, payload, price, stock);
  logAdmin(req.user.id, 'product.create', { targetType: 'product', targetId: info.lastInsertRowid, detail: `${name} · ${price}积分` });
  res.json({ product: db.prepare('SELECT * FROM products WHERE id=?').get(info.lastInsertRowid) });
});
router.delete('/products/:id', (req, res) => {
  const p = db.prepare('SELECT name FROM products WHERE id=?').get(req.params.id);
  db.prepare('DELETE FROM products WHERE id=?').run(req.params.id);
  logAdmin(req.user.id, 'product.delete', { targetType: 'product', targetId: req.params.id, detail: p?.name || `#${req.params.id}` });
  res.json({ ok: true });
});

// admin content delete (post / thread / comment)
router.delete('/content/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const table = { post: 'posts', thread: 'threads', comment: 'comments' }[type];
  if (!table) return res.status(400).json({ error: '未知类型' });
  const TYPE_LABEL = { post: '动态', thread: '帖子', comment: '评论' };
  db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  logAdmin(req.user.id, 'content.delete', { targetType: type, targetId: id, detail: `删除${TYPE_LABEL[type] || type} #${id}` });
  res.json({ ok: true });
});

export default router;
