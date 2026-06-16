import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { award, getUser, publicUser } from '../helpers.js';

const router = Router();
const ymd = () => new Date().toISOString().slice(0, 10);
const count = (sql, ...p) => db.prepare(sql).get(...p).c;

// ---- Daily / growth tasks (progress derived live from existing data) ----
const TASKS = [
  { key: 'checkin', title: '每日签到', desc: '完成今天的签到', icon: 'checkin', points: 5, target: 1, daily: true,
    progress: (uid) => (getUser(uid).last_checkin === ymd() ? 1 : 0) },
  { key: 'post', title: '发布动态', desc: '发布 1 条动态', icon: 'edit', points: 10, target: 1, daily: true,
    progress: (uid) => count("SELECT COUNT(*) c FROM posts WHERE user_id=? AND created_at >= date('now')", uid) },
  { key: 'comment', title: '评论互动', desc: '评论 3 次', icon: 'comment', points: 6, target: 3, daily: true,
    progress: (uid) => count("SELECT COUNT(*) c FROM comments WHERE user_id=? AND created_at >= date('now')", uid) },
  { key: 'like', title: '点赞他人', desc: '点赞 5 次', icon: 'heart', points: 4, target: 5, daily: true,
    progress: (uid) => count("SELECT COUNT(*) c FROM likes WHERE user_id=? AND created_at >= date('now')", uid) },
  { key: 'vote', title: '参与投票', desc: '参与 1 次投票', icon: 'poll', points: 3, target: 1, daily: true,
    progress: (uid) => count("SELECT COUNT(*) c FROM poll_votes WHERE user_id=? AND created_at >= date('now')", uid) },
  { key: 'profile', title: '完善资料', desc: '设置头像和个人简介', icon: 'user', points: 20, target: 1, daily: false,
    progress: (uid) => { const u = getUser(uid); return (u.bio && u.bio.trim() && !u.bio.startsWith('emoji:') && u.avatar) ? 1 : 0; } },
];

// ---- Achievement badges (unlock derived from cumulative stats) ----
const BADGES = [
  { key: 'newcomer', name: '初来乍到', desc: '发布第一条动态', icon: 'edit', tier: 'bronze', check: (s) => s.posts >= 1 },
  { key: 'writer', name: '笔耕不辍', desc: '累计发布 20 条动态', icon: 'edit', tier: 'silver', check: (s) => s.posts >= 20 },
  { key: 'voter', name: '热心参与', desc: '累计参与 10 次投票', icon: 'poll', tier: 'bronze', check: (s) => s.votes >= 10 },
  { key: 'checkin7', name: '签到坚持', desc: '连续签到满 7 天', icon: 'checkin', tier: 'silver', check: (s) => s.streak >= 7 },
  { key: 'social', name: '社交达人', desc: '粉丝数达到 50', icon: 'users', tier: 'silver', check: (s) => s.followers >= 50 },
  { key: 'popular', name: '人气作者', desc: '累计获得 200 个赞', icon: 'heart', tier: 'gold', check: (s) => s.likesRecv >= 200 },
  { key: 'helper', name: '乐于助人', desc: '有回答被采纳', icon: 'check', tier: 'gold', check: (s) => s.accepted >= 1 },
  { key: 'founder', name: '圈子主理人', desc: '创建过一个圈子', icon: 'users', tier: 'gold', check: (s) => s.circlesOwned >= 1 },
  { key: 'vip', name: '尊享会员', desc: '开通 VIP 会员', icon: 'shield', tier: 'gold', check: (s) => s.vip },
];

function userStats(uid) {
  const u = getUser(uid);
  return {
    posts: count('SELECT COUNT(*) c FROM posts WHERE user_id=? AND share_of IS NULL', uid),
    likesRecv: count('SELECT COALESCE(SUM(like_count),0) c FROM posts WHERE user_id=?', uid),
    followers: count('SELECT COUNT(*) c FROM follows WHERE following_id=?', uid),
    streak: u.checkin_streak || 0,
    accepted: count('SELECT COUNT(*) c FROM answers WHERE user_id=? AND accepted=1', uid),
    circlesOwned: count('SELECT COUNT(*) c FROM circles WHERE owner_id=?', uid),
    votes: count('SELECT COUNT(*) c FROM poll_votes WHERE user_id=?', uid),
    vip: !!u.vip,
  };
}

function evalTasks(uid) {
  const day = ymd();
  return TASKS.map((t) => {
    const prog = Math.min(t.progress(uid), t.target);
    const slot = t.daily ? day : 'once';
    const claimed = !!db.prepare('SELECT 1 FROM task_claims WHERE user_id=? AND task_key=? AND ymd=?').get(uid, t.key, slot);
    const done = prog >= t.target;
    return { key: t.key, title: t.title, desc: t.desc, icon: t.icon, points: t.points, target: t.target, daily: !!t.daily, progress: prog, done, claimed, claimable: done && !claimed };
  });
}

// Evaluate badges, persist newly-unlocked, notify once
function evalBadges(uid, { persist = false } = {}) {
  const stats = userStats(uid);
  const owned = new Map(db.prepare('SELECT badge_key, unlocked_at FROM user_badges WHERE user_id=?').all(uid).map((r) => [r.badge_key, r.unlocked_at]));
  const out = BADGES.map((b) => {
    const unlocked = b.check(stats);
    if (unlocked && persist && !owned.has(b.key)) {
      db.prepare('INSERT OR IGNORE INTO user_badges (user_id, badge_key) VALUES (?,?)').run(uid, b.key);
      owned.set(b.key, 'new');
    }
    return { key: b.key, name: b.name, desc: b.desc, icon: b.icon, tier: b.tier, unlocked: unlocked || owned.has(b.key), unlockedAt: owned.get(b.key) || null };
  });
  return { badges: out, stats };
}

// Combined achievements for the logged-in user
router.get('/', requireAuth, (req, res) => {
  const tasks = evalTasks(req.user.id);
  const { badges, stats } = evalBadges(req.user.id, { persist: true });
  res.json({
    tasks,
    badges,
    stats,
    claimablePoints: tasks.filter((t) => t.claimable).reduce((a, t) => a + t.points, 0),
    unlockedCount: badges.filter((b) => b.unlocked).length,
  });
});

// Public badge wall for a profile
router.get('/user/:id/badges', optionalAuth, (req, res) => {
  const u = getUser(Number(req.params.id));
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const { badges } = evalBadges(u.id, { persist: false });
  res.json({ badges, user: publicUser(u, req.user?.id) });
});

// Claim a completed task's reward
router.post('/claim/:key', requireAuth, (req, res) => {
  const t = TASKS.find((x) => x.key === req.params.key);
  if (!t) return res.status(404).json({ error: '任务不存在' });
  const slot = t.daily ? ymd() : 'once';
  const claimed = db.prepare('SELECT 1 FROM task_claims WHERE user_id=? AND task_key=? AND ymd=?').get(req.user.id, t.key, slot);
  if (claimed) return res.status(400).json({ error: '该奖励已领取' });
  if (t.progress(req.user.id) < t.target) return res.status(400).json({ error: '任务尚未完成' });
  db.prepare('INSERT INTO task_claims (user_id, task_key, ymd) VALUES (?,?,?)').run(req.user.id, t.key, slot);
  award(req.user.id, { points: t.points });
  res.json({ ok: true, points: t.points, user: publicUser(getUser(req.user.id), req.user.id) });
});

export default router;
