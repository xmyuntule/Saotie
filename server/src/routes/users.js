import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, getUser, notify, recordView } from '../helpers.js';
import { serializePost } from './posts.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

// Mention autocomplete — quick user lookup for @ in composer/comments
router.get('/mention', (req, res) => {
  const q = (req.query.q || '').trim();
  const like = `${q}%`, mid = `%${q}%`;
  const rows = q
    ? db.prepare(`SELECT * FROM users WHERE nickname LIKE ? OR username LIKE ? OR nickname LIKE ?
        ORDER BY (CASE WHEN nickname LIKE ? OR username LIKE ? THEN 0 ELSE 1 END), experience DESC LIMIT 6`)
        .all(like, like, mid, like, like)
    : db.prepare('SELECT * FROM users ORDER BY experience DESC LIMIT 6').all();
  res.json({ users: rows.map(u => publicUser(u, req.user?.id)) });
});

// My bookmarked posts / 我的收藏
router.get('/me/bookmarks', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT p.* FROM bookmarks b JOIN posts p ON p.id=b.post_id
    WHERE b.user_id=? ORDER BY b.created_at DESC LIMIT 100`).all(req.user.id);
  res.json({ posts: rows.map(r => serializePost(r, req.user.id)).filter(Boolean) });
});

// Block / unblock a user (also removes mutual follows)
router.post('/:id/block', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: '不能拉黑自己' });
  if (!getUser(targetId)) return res.status(404).json({ error: '用户不存在' });
  const has = db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?').get(req.user.id, targetId);
  if (has) { db.prepare('DELETE FROM blocks WHERE blocker_id=? AND blocked_id=?').run(req.user.id, targetId); return res.json({ blocked: false }); }
  db.prepare('INSERT INTO blocks (blocker_id, blocked_id) VALUES (?,?)').run(req.user.id, targetId);
  db.prepare('DELETE FROM follows WHERE (follower_id=? AND following_id=?) OR (follower_id=? AND following_id=?)')
    .run(req.user.id, targetId, targetId, req.user.id);
  res.json({ blocked: true });
});

// My block list / 黑名单
router.get('/me/blocks', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT u.* FROM blocks b JOIN users u ON u.id=b.blocked_id
    WHERE b.blocker_id=? ORDER BY b.created_at DESC`).all(req.user.id);
  res.json({ users: rows.map(u => publicUser(u, req.user.id)) });
});

// 创作数据 / creator stats for the member center
router.get('/me/stats', requireAuth, (req, res) => {
  const uid = req.user.id;
  const sum = (sql) => db.prepare(sql).get(uid).s || 0;
  const cnt = (sql, ...a) => db.prepare(sql).get(...a).c || 0;
  const likes = sum('SELECT COALESCE(SUM(like_count),0) s FROM posts WHERE user_id=?')
              + sum('SELECT COALESCE(SUM(like_count),0) s FROM threads WHERE user_id=?');
  const views = sum('SELECT COALESCE(SUM(views),0) s FROM posts WHERE user_id=?')
              + sum('SELECT COALESCE(SUM(views),0) s FROM threads WHERE user_id=?');
  const visitors = cnt("SELECT COUNT(*) c FROM view_history WHERE target_type='profile' AND target_id=?", uid);
  const comments = cnt(`SELECT COUNT(*) c FROM comments WHERE post_id IN (SELECT id FROM posts WHERE user_id=?)
                        OR thread_id IN (SELECT id FROM threads WHERE user_id=?)`, uid, uid);
  res.json({ likes, views, visitors, comments });
});

// Is the viewer blocking this user?
router.get('/:id/blocked', requireAuth, (req, res) => {
  const blocked = !!db.prepare('SELECT 1 FROM blocks WHERE blocker_id=? AND blocked_id=?').get(req.user.id, Number(req.params.id));
  res.json({ blocked });
});

// Check-in leaderboard (left sidebar widget)
router.get('/ranking/checkin', (req, res) => {
  const rows = db.prepare(`SELECT * FROM users ORDER BY checkin_streak DESC, experience DESC LIMIT 10`).all();
  res.json({ users: rows.map(u => publicUser(u, req.user?.id)) });
});

// Leaderboards — 财富榜 / 等级榜 / 人气榜 / 签到榜
router.get('/ranking/:type', (req, res) => {
  const sql = {
    wealth: 'SELECT * FROM users ORDER BY points DESC, experience DESC LIMIT 50',
    level: 'SELECT * FROM users ORDER BY experience DESC, points DESC LIMIT 50',
    fans: 'SELECT u.* FROM users u ORDER BY (SELECT COUNT(*) FROM follows WHERE following_id=u.id) DESC, u.experience DESC LIMIT 50',
    checkin: 'SELECT * FROM users ORDER BY checkin_streak DESC, experience DESC LIMIT 50',
  }[req.params.type];
  if (!sql) return res.status(400).json({ error: '未知榜单' });
  res.json({ users: db.prepare(sql).all().map(u => publicUser(u, req.user?.id)) });
});

// Active / suggested users to follow
router.get('/suggestions', (req, res) => {
  const me = req.user?.id || 0;
  const rows = db.prepare(`
    SELECT * FROM users
    WHERE id != ? AND id NOT IN (SELECT following_id FROM follows WHERE follower_id = ?)
    ORDER BY experience DESC LIMIT 6`).all(me, me);
  res.json({ users: rows.map(u => publicUser(u, req.user?.id)) });
});

// Get a profile by username
// Resolve a profile by username, falling back to nickname (so @nickname links work)
function findByHandle(name) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(name)
    || db.prepare('SELECT * FROM users WHERE nickname = ? LIMIT 1').get(name);
}

router.get('/:username', (req, res) => {
  const u = findByHandle(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  // record the visit (足迹/访客) — never count self-views
  if (req.user && req.user.id !== u.id) recordView(req.user.id, 'profile', u.id);
  res.json({ user: publicUser(u, req.user?.id) });
});

// Recent profile visitors (最近访客) — owner-only; one row per visitor, newest first
router.get('/:username/visitors', requireAuth, (req, res) => {
  const u = findByHandle(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  if (u.id !== req.user.id) return res.status(403).json({ error: '只能查看自己的访客记录' });
  const rows = db.prepare("SELECT user_id, viewed_at FROM view_history WHERE target_type='profile' AND target_id=? ORDER BY viewed_at DESC LIMIT 30").all(u.id);
  const visitors = rows.map((r) => { const v = getUser(r.user_id); return v ? { ...publicUser(v, u.id), visitedAt: r.viewed_at } : null; }).filter(Boolean);
  const total = db.prepare("SELECT COUNT(*) c FROM view_history WHERE target_type='profile' AND target_id=?").get(u.id).c;
  res.json({ visitors, total });
});

// Followers / following lists
router.get('/:username/:rel(followers|following)', (req, res) => {
  const u = findByHandle(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const rel = req.params.rel;
  const rows = rel === 'followers'
    ? db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.following_id=? ORDER BY f.created_at DESC`).all(u.id)
    : db.prepare(`SELECT u.* FROM follows f JOIN users u ON u.id=f.following_id WHERE f.follower_id=? ORDER BY f.created_at DESC`).all(u.id);
  res.json({ users: rows.map(x => publicUser(x, req.user?.id)) });
});

// Follow / unfollow toggle
router.post('/:id/follow', requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: '不能关注自己' });
  const target = getUser(targetId);
  if (!target) return res.status(404).json({ error: '用户不存在' });
  const existing = db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?').get(req.user.id, targetId);
  if (existing) {
    db.prepare('DELETE FROM follows WHERE follower_id=? AND following_id=?').run(req.user.id, targetId);
    return res.json({ following: false, user: publicUser(getUser(targetId), req.user.id) });
  }
  db.prepare('INSERT INTO follows (follower_id, following_id) VALUES (?,?)').run(req.user.id, targetId);
  notify({ userId: targetId, actorId: req.user.id, type: 'follow', targetType: 'user', targetId: req.user.id });
  res.json({ following: true, user: publicUser(getUser(targetId), req.user.id) });
});

// Update own profile
router.put('/me/profile', requireAuth, (req, res) => {
  const { nickname, bio, gender, location, avatar, cover, verifiedNote } = req.body || {};
  if (checkSensitive(nickname) || checkSensitive(bio)) return res.status(400).json({ error: '昵称或签名包含敏感信息，请修改后重试' });
  const u = req.user;
  db.prepare(`UPDATE users SET
      nickname = COALESCE(?, nickname),
      bio = COALESCE(?, bio),
      gender = COALESCE(?, gender),
      location = COALESCE(?, location),
      avatar = COALESCE(?, avatar),
      cover = COALESCE(?, cover),
      verified_note = COALESCE(?, verified_note),
      updated_at = datetime('now')
    WHERE id = ?`).run(
      nickname ?? null, bio ?? null, gender ?? null, location ?? null,
      avatar ?? null, cover ?? null, verifiedNote ?? null, u.id);
  res.json({ user: publicUser(getUser(u.id), u.id) });
});

// Recharge wallet (demo: instantly credits balance + grants VIP option)
router.post('/me/recharge', requireAuth, (req, res) => {
  const amount = Math.max(0, Math.min(100000, Number(req.body?.amount) || 0));
  const u = req.user;
  // 多等级：新前端传 vipLevel(1青铜/2黄金/3黑钻)；兼容旧前端 vip:true(=青铜1)
  let reqLevel = Math.max(0, Math.min(3, parseInt(req.body?.vipLevel, 10) || 0));
  if (!reqLevel && req.body?.vip) reqLevel = 1;
  let vipExpires = u.vip_expires;
  let vipLevel = u.vip_level || (u.vip ? 1 : 0);
  let vipFlag = u.vip ? 1 : 0;
  if (reqLevel > 0) {
    const base = u.vip && u.vip_expires ? new Date(u.vip_expires) : new Date();
    base.setMonth(base.getMonth() + 1);
    vipExpires = base.toISOString().slice(0, 10);
    vipLevel = reqLevel;
    vipFlag = 1;
  }
  db.prepare('UPDATE users SET balance = balance + ?, vip = ?, vip_level = ?, vip_expires = ? WHERE id = ?')
    .run(amount, vipFlag, vipLevel, vipExpires, u.id);
  if (reqLevel > 0) {
    const NAMES = { 1: '青铜会员', 2: '黄金会员', 3: '黑钻会员' };
    notify({ userId: u.id, actorId: null, type: 'system', preview: `你已开通${NAMES[reqLevel]}，尊享专属特权 🎉` });
  }
  res.json({ user: publicUser(getUser(u.id), u.id) });
});

export default router;
