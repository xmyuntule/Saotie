import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, today } from '../helpers.js';

const router = Router();

const MAKEUP_COST = 20;                              // points to 补签 a missed day
const dayReward = (streakDay) => 5 + Math.min(streakDay, 7); // escalating daily bonus (6→12)

// Top streakers for the 签到榜 sidebar
function topStreakers() {
  return db.prepare('SELECT * FROM users WHERE checkin_streak > 0 ORDER BY checkin_streak DESC, last_checkin DESC LIMIT 8')
    .all().map((u) => ({ user: publicUser(u, null), streak: u.checkin_streak || 0 }));
}

// 7-day reward ramp. The daily bonus is 5 + min(streak, 7), so the reward climbs
// for the first 7 days then stays at the max — the track is a ramp, NOT a repeating
// cycle (a 30-day streaker is pinned at day 7 / max, not back at day 1).
function rewardTrack(streak, checkedToday, continues) {
  const reached = checkedToday || continues ? streak : 0; // consecutive days completed
  const doneCount = Math.min(reached, 7);
  const todayDay = checkedToday ? Math.min(streak, 7) : Math.min(reached + 1, 7);
  return Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const state = day <= doneCount ? 'done' : day === todayDay ? 'today' : 'locked';
    return { day, points: dayReward(day), state, isToday: day === todayDay };
  });
}

// Check-in hub: streak, monthly calendar, reward track, leaderboard.
// The actual sign-in mutation stays in POST /auth/checkin (shared with the navbar button).
router.get('/', optionalAuth, (req, res) => {
  const t = today();
  const uid = req.user?.id;
  if (!uid) {
    return res.json({
      authed: false, todayDate: t, makeupCost: MAKEUP_COST,
      rewards: rewardTrack(0, false, false), topStreakers: topStreakers(),
    });
  }
  const u = getUser(uid);
  const checkedToday = u.last_checkin === t;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const continues = u.last_checkin === yesterday;
  const streak = u.checkin_streak || 0;
  const ym = t.slice(0, 7);

  const monthRows = db.prepare('SELECT date, makeup FROM checkin_log WHERE user_id=? AND date LIKE ? ORDER BY date')
    .all(uid, `${ym}-%`);
  const monthDays = monthRows.map((r) => ({ day: Number(r.date.slice(8, 10)), makeup: !!r.makeup }));
  const totalDays = db.prepare('SELECT COUNT(*) c FROM checkin_log WHERE user_id=?').get(uid).c;

  res.json({
    authed: true,
    todayDate: t,
    checkedToday,
    streak: checkedToday ? streak : continues ? streak : 0,   // displayed 连续 days
    bestStreak: u.best_checkin_streak || 0,
    points: u.points,
    todayReward: dayReward(checkedToday ? streak : continues ? streak + 1 : 1),
    monthDays,
    monthCount: monthRows.length,
    totalDays,
    makeupCost: MAKEUP_COST,
    rewards: rewardTrack(streak, checkedToday, continues),
    topStreakers: topStreakers(),
  });
});

// 补签：fill a missed past day in the current month for points. Does not change the streak.
router.post('/makeup', requireAuth, (req, res) => {
  const date = String(req.body?.date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期无效' });
  const t = today();
  if (date >= t) return res.status(400).json({ error: '只能补签今天之前的日期' });
  if (date.slice(0, 7) !== t.slice(0, 7)) return res.status(400).json({ error: '只能补签本月的日期' });
  if (db.prepare('SELECT 1 FROM checkin_log WHERE user_id=? AND date=?').get(req.user.id, date))
    return res.status(400).json({ error: '这一天已经签到过啦' });

  const u = getUser(req.user.id);
  if (u.points < MAKEUP_COST) return res.status(402).json({ error: `积分不足，补签需 ${MAKEUP_COST} 积分` });

  db.transaction(() => {
    db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(MAKEUP_COST, req.user.id);
    db.prepare('INSERT OR IGNORE INTO checkin_log (user_id, date, points, makeup) VALUES (?,?,0,1)').run(req.user.id, date);
  })();

  res.json({ ok: true, date, cost: MAKEUP_COST, user: publicUser(getUser(req.user.id), req.user.id) });
});

export default router;
