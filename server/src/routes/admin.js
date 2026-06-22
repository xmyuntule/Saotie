import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { publicUser, getUser, notify, logAdmin, setConfig, MODULE_KEYS } from '../helpers.js';

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

// ===== 安全设置 (A5)：site_config 中的安全相关键，后台可读写 =====
const TOGGLE_KEYS = ['rate_limit_enabled', 'anti_bulk_reg_enabled', 'require_email_verify', 'email_verify_enabled',
  'perm_enabled', 'perm_comment_require_vip', 'perm_dm_require_vip', 'perm_upload_require_vip', 'perm_post_require_vip', 'perm_thread_require_vip',
  'sensitive_enabled',
  ...MODULE_KEYS.map((k) => `module_${k}`)]; // 模块市场 (C)：各可选模块开关
const NUM_KEYS = {
  rate_post_per_min: [0, 1000], rate_post_per_hour: [0, 100000], rate_thread_per_min: [0, 1000], rate_dm_per_min: [0, 10000],
  reg_ip_max_per_day: [0, 10000], reg_min_interval_sec: [0, 86400],
  perm_comment_min_level: [0, 60], perm_dm_min_level: [0, 60], perm_upload_min_level: [0, 60], perm_post_min_level: [0, 60], perm_thread_min_level: [0, 60],
};
// 字符串型配置（站点外观自定义 W）：键 → 最大长度，超长截断；便于二开但防滥用
const STR_KEYS = { site_name: 40, site_slogan: 60, site_logo: 500, site_custom_css: 20000, sensitive_words: 8000 };
const CONFIG_KEYS = [...TOGGLE_KEYS, ...Object.keys(NUM_KEYS), ...Object.keys(STR_KEYS)];

router.get('/config', (req, res) => {
  const rows = db.prepare(`SELECT key, value FROM site_config WHERE key IN (${CONFIG_KEYS.map(() => '?').join(',')})`).all(...CONFIG_KEYS);
  const config = {};
  rows.forEach((r) => { config[r.key] = r.value; });
  res.json({ config });
});

router.put('/config', (req, res) => {
  const updates = req.body?.config || {};
  const changed = [];
  for (const k of TOGGLE_KEYS) {
    // 注意：前端传的是字符串 '1'/'0'，而 '0' 在 JS 里是 truthy，不能直接 `updates[k] ? ...`
    // 否则任何开关都关不掉。显式判定 true / 1 / '1' 才算开。
    if (k in updates) { const v = updates[k]; setConfig(k, (v === true || v === 1 || v === '1') ? '1' : '0'); changed.push(k); }
  }
  for (const [k, [lo, hi]] of Object.entries(NUM_KEYS)) {
    if (k in updates) {
      let n = Math.round(Number(updates[k]));
      if (!Number.isFinite(n)) return res.status(400).json({ error: `「${k}」必须是数字` });
      n = Math.max(lo, Math.min(hi, n));
      setConfig(k, String(n)); changed.push(k);
    }
  }
  for (const [k, max] of Object.entries(STR_KEYS)) {
    if (k in updates) {
      const v = String(updates[k] ?? '').slice(0, max);
      setConfig(k, v); changed.push(k);
    }
  }
  logAdmin(req.user.id, 'config.update', { targetType: 'config', detail: `站点设置更新：${changed.join('、') || '无改动'}` });
  res.json({ ok: true, changed });
});

export default router;
