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

// 站点配置读写（site_config 表）
export function getConfig(key, fallback = null) {
  try { const r = db.prepare('SELECT value FROM site_config WHERE key=?').get(key); return r ? r.value : fallback; }
  catch { return fallback; }
}
export function setConfig(key, value) {
  db.prepare('INSERT INTO site_config (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
// 频率限制：统计某用户在最近 windowSec 秒内 table 表里的记录数，>= max 则视为超限
export function rateExceeded(table, userCol, userId, windowSec, max) {
  if (!userId || max <= 0) return false;
  try {
    const n = db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${userCol}=? AND created_at > datetime('now', ?)`)
      .get(userId, `-${Math.floor(windowSec)} seconds`).c;
    return n >= max;
  } catch { return false; }
}
// 发帖/发私信频率护栏：返回超限提示文案（可发就返回 null）。管理员豁免，可在后台总开关关闭。
export function rateLimitError(user, kind) {
  if (!user || user.role === 'admin') return null;
  if (getConfig('rate_limit_enabled', '1') !== '1') return null;
  if (kind === 'post') {
    const pm = Number(getConfig('rate_post_per_min', 5));
    const ph = Number(getConfig('rate_post_per_hour', 80));
    if (rateExceeded('posts', 'user_id', user.id, 60, pm)) return `发帖太频繁了，请稍后再试（每分钟最多 ${pm} 条）`;
    if (rateExceeded('posts', 'user_id', user.id, 3600, ph)) return `今天发得有点多啦，歇一会儿再来（每小时最多 ${ph} 条）`;
  } else if (kind === 'thread') {
    const tm = Number(getConfig('rate_thread_per_min', 3));
    if (rateExceeded('threads', 'user_id', user.id, 60, tm)) return `发帖太频繁了，请稍后再试（每分钟最多 ${tm} 个帖子）`;
  } else if (kind === 'dm') {
    const dm = Number(getConfig('rate_dm_per_min', 20));
    if (rateExceeded('messages', 'sender_id', user.id, 60, dm)) return `私信发送太频繁了，请稍后再试（每分钟最多 ${dm} 条）`;
  }
  return null;
}

// 取真实客户端 IP（站点在反代后，优先取 X-Forwarded-For 首个）
export function clientIp(req) {
  const xff = (req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return xff || req.socket?.remoteAddress || req.ip || '';
}
// 防批量注册护栏：返回拒绝文案（可注册就返回 null）。同 IP 最小间隔 + 每日上限，可在后台开关/调阈值。
export function antiBulkRegError(ip) {
  if (getConfig('anti_bulk_reg_enabled', '1') !== '1' || !ip) return null;
  try {
    const minInt = Number(getConfig('reg_min_interval_sec', 30));
    if (minInt > 0) {
      const recent = db.prepare(`SELECT COUNT(*) c FROM reg_log WHERE ip=? AND created_at > datetime('now', ?)`)
        .get(ip, `-${minInt} seconds`).c;
      if (recent > 0) return '注册过于频繁，请稍后再试';
    }
    const maxDay = Number(getConfig('reg_ip_max_per_day', 5));
    if (maxDay > 0) {
      const day = db.prepare(`SELECT COUNT(*) c FROM reg_log WHERE ip=? AND created_at > datetime('now','-1 day')`).get(ip).c;
      if (day >= maxDay) return '当前网络的注册数量已达上限，请稍后再试或联系管理员';
    }
  } catch { return null; }
  return null;
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
