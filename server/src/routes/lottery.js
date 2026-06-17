import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser } from '../helpers.js';

const router = Router();

const COST = 88;          // points per paid draw
const FREE_PER_DAY = 1;   // free draws each day
const today = () => new Date().toISOString().slice(0, 10);

const drawsTodayCount = (uid) =>
  db.prepare("SELECT COUNT(*) c FROM lottery_draws WHERE user_id=? AND created_at >= date('now')").get(uid).c;

function serializePrize(p) {
  return { id: p.id, name: p.name, type: p.type, value: p.value, icon: p.icon, color: p.color, position: p.position };
}

// Board state: 8 prizes (positions 0-7), cost, free-draw status, my recent wins
router.get('/', optionalAuth, (req, res) => {
  const prizes = db.prepare('SELECT * FROM lottery_prizes ORDER BY position ASC, id ASC').all().map(serializePrize);
  const uid = req.user?.id;
  const drawsToday = uid ? drawsTodayCount(uid) : 0;
  const myRecent = uid
    ? db.prepare('SELECT id, prize_name, prize_type, created_at FROM lottery_draws WHERE user_id=? ORDER BY id DESC LIMIT 10').all(uid)
    : [];
  res.json({
    prizes, cost: COST, freePerDay: FREE_PER_DAY,
    drawsToday, freeLeft: Math.max(0, FREE_PER_DAY - drawsToday),
    points: uid ? getUser(uid).points : 0,
    myRecent,
  });
});

// Recent winners across the community (excludes 谢谢参与), for a live ticker
router.get('/winners', (req, res) => {
  const rows = db.prepare(`SELECT d.id, d.prize_name, d.created_at, d.user_id
    FROM lottery_draws d WHERE d.prize_type != 'thanks' ORDER BY d.id DESC LIMIT 12`).all();
  res.json({ winners: rows.map((r) => ({ id: r.id, prizeName: r.prize_name, createdAt: r.created_at, user: publicUser(getUser(r.user_id), null) })) });
});

// Draw once (weighted). First draw of the day is free; the rest cost COST points.
router.post('/draw', requireAuth, (req, res) => {
  const prizes = db.prepare('SELECT * FROM lottery_prizes').all();
  if (!prizes.length) return res.status(400).json({ error: '奖池未配置' });

  const u = getUser(req.user.id);
  const isFree = drawsTodayCount(req.user.id) < FREE_PER_DAY;
  if (!isFree && u.points < COST) return res.status(402).json({ error: `积分不足，每次抽奖需 ${COST} 积分` });

  // weighted random pick
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  let r = Math.random() * total;
  let picked = prizes[prizes.length - 1];
  for (const p of prizes) { r -= Math.max(0, p.weight); if (r <= 0) { picked = p; break; } }

  const tx = db.transaction(() => {
    if (!isFree) db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(COST, req.user.id);
    // award the prize
    if (picked.type === 'points') db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(Number(picked.value) || 0, req.user.id);
    else if (picked.type === 'title') db.prepare('UPDATE users SET title=? WHERE id=?').run(picked.value, req.user.id);
    else if (picked.type === 'frame') db.prepare('UPDATE users SET avatar_frame=? WHERE id=?').run(picked.value, req.user.id);
    db.prepare('INSERT INTO lottery_draws (user_id, prize_id, prize_name, prize_type) VALUES (?,?,?,?)')
      .run(req.user.id, picked.id, picked.name, picked.type);
  });
  tx();

  res.json({
    prize: serializePrize(picked),
    wasFree: isFree,
    user: publicUser(getUser(req.user.id), req.user.id),
    freeLeft: Math.max(0, FREE_PER_DAY - drawsTodayCount(req.user.id)),
  });
});

export default router;
