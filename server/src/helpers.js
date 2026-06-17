import db from './db.js';

// Level curve: experience needed for level L is 30 * L^1.6 (cumulative-ish, simple & smooth)
export function levelFromExp(exp) {
  let lvl = 1;
  while (lvl < 60 && exp >= expForLevel(lvl + 1)) lvl++;
  return lvl;
}
export function expForLevel(level) {
  return Math.round(30 * Math.pow(level - 1, 1.7));
}
export function levelProgress(exp) {
  const lvl = levelFromExp(exp);
  const cur = expForLevel(lvl);
  const next = expForLevel(lvl + 1);
  const pct = next > cur ? Math.min(100, Math.round(((exp - cur) / (next - cur)) * 100)) : 100;
  return { level: lvl, exp, curLevelExp: cur, nextLevelExp: next, percent: pct };
}

// Award experience + points and keep level fresh
export function award(userId, { exp = 0, points = 0 } = {}) {
  if (!exp && !points) return;
  db.prepare('UPDATE users SET experience = experience + ?, points = points + ? WHERE id = ?')
    .run(exp, points, userId);
}

// Public shape of a user (never leak password_hash)
export function publicUser(u, viewerId = null) {
  if (!u) return null;
  const lp = levelProgress(u.experience ?? 0);
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM follows WHERE following_id = @id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id  = @id) AS following,
      (SELECT COUNT(*) FROM posts WHERE user_id = @id) AS posts
  `).get({ id: u.id });
  let isFollowing = false;
  if (viewerId && viewerId !== u.id) {
    isFollowing = !!db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND following_id=?')
      .get(viewerId, u.id);
  }
  return {
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    avatar: u.avatar,
    cover: u.cover,
    bio: u.bio,
    gender: u.gender,
    location: u.location,
    verified: !!u.verified,
    verifiedNote: u.verified_note,
    vip: !!u.vip,
    role: u.role,
    banned: !!u.banned,
    title: u.title || '',
    avatarFrame: u.avatar_frame || '',
    points: u.points,
    experience: u.experience,
    balance: u.balance,
    level: lp.level,
    levelProgress: lp,
    checkinStreak: u.checkin_streak,
    lastCheckin: u.last_checkin,
    createdAt: u.created_at,
    followers: counts.followers,
    following: counts.following,
    postCount: counts.posts,
    isFollowing,
  };
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// Create a notification (skips self-notifications)
export function notify({ userId, actorId, type, targetType = null, targetId = null, preview = '' }) {
  if (!userId || userId === actorId) return;
  db.prepare(`INSERT INTO notifications (user_id, actor_id, type, target_type, target_id, preview)
              VALUES (?,?,?,?,?,?)`).run(userId, actorId, type, targetType, targetId, preview);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

// Best-effort admin audit-log record (管理操作日志). Never throws.
let _auditStmt;
export function logAdmin(adminId, action, { targetType = '', targetId = null, detail = '' } = {}) {
  if (!adminId) return;
  try {
    if (!_auditStmt) _auditStmt = db.prepare('INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, detail) VALUES (?,?,?,?,?)');
    _auditStmt.run(adminId, action, targetType, targetId == null ? null : Number(targetId), String(detail).slice(0, 300));
  } catch { /* audit is non-critical */ }
}

// Best-effort browse-history record (足迹). Upserts the latest view time; never throws.
let _viewStmt;
export function recordView(userId, type, id) {
  if (!userId || !id) return;
  try {
    if (!_viewStmt) _viewStmt = db.prepare(`INSERT INTO view_history (user_id, target_type, target_id) VALUES (?,?,?)
      ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET viewed_at=datetime('now')`);
    _viewStmt.run(userId, type, Number(id));
  } catch { /* history is non-critical */ }
}

// Extract @mentions and #topics# from text
export function parseMentions(text) {
  const names = [...text.matchAll(/@([一-龥A-Za-z0-9_]{1,20})/g)].map(m => m[1]);
  return [...new Set(names)];
}
export function parseTopics(text) {
  const topics = [...text.matchAll(/#([^#\n]{1,30})#/g)].map(m => m[1].trim());
  return [...new Set(topics)];
}
