import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { sign, requireAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, today, notify } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

router.post('/register', (req, res) => {
  const { username, password, nickname } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: '用户名和密码必填' });
  if (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(username))
    return res.status(400).json({ error: '用户名需为 2-20 位字母、数字、下划线或中文' });
  if (password.length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (checkSensitive(username) || checkSensitive(nickname)) return res.status(400).json({ error: '用户名或昵称包含敏感信息' });
  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: '该用户名已被注册' });

  const hash = bcrypt.hashSync(password, 10);
  // give new accounts a real default portrait (deterministic by username); the client
  // falls back to an initial-on-gradient avatar if the image can't load.
  const avatar = `https://i.pravatar.cc/240?u=${encodeURIComponent(username)}`;
  const info = db.prepare(`INSERT INTO users (username, nickname, password_hash, bio, avatar, experience, points, balance)
    VALUES (?,?,?,?,?,?,?,?)`).run(
      username, nickname?.trim() || username, hash,
      '', avatar, 20, 100, 0);
  const user = getUser(info.lastInsertRowid);
  // welcome notification
  notify({ userId: user.id, actorId: null, type: 'system', preview: '欢迎加入 HahaSNS！完善资料、发布第一条动态吧～' });
  res.json({ token: sign(user), user: publicUser(user, user.id) });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash))
    return res.status(401).json({ error: '用户名或密码错误' });
  if (user.banned) return res.status(403).json({ error: '账号已被封禁，如有疑问请联系管理员' });
  res.json({ token: sign(user), user: publicUser(user, user.id) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user, req.user.id) });
});

// Change password
router.post('/password', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!bcrypt.compareSync(oldPassword || '', req.user.password_hash))
    return res.status(403).json({ error: '原密码不正确' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少 6 位' });
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPassword, 10), req.user.id);
  res.json({ ok: true });
});

// Daily sign-in / 签到
router.post('/checkin', requireAuth, (req, res) => {
  const u = req.user;
  const t = today();
  if (u.last_checkin === t) return res.status(400).json({ error: '今天已经签到啦' });
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = u.last_checkin === yesterday ? (u.checkin_streak || 0) + 1 : 1;
  const bonus = Math.min(streak, 7); // streak bonus capped
  const points = 5 + bonus;
  const exp = 5;
  const best = Math.max(streak, u.best_checkin_streak || 0);
  db.prepare('UPDATE users SET checkin_streak=?, last_checkin=?, best_checkin_streak=?, points=points+?, experience=experience+? WHERE id=?')
    .run(streak, t, best, points, exp, u.id);
  db.prepare('INSERT OR IGNORE INTO checkin_log (user_id, date, points) VALUES (?,?,?)').run(u.id, t, points);
  res.json({ ok: true, streak, pointsEarned: points, expEarned: exp, user: publicUser(getUser(u.id), u.id) });
});

// Change username — consumes one unused 改名卡 (mall item, payload 'rename')
router.post('/change-username', requireAuth, (req, res) => {
  const newName = (req.body?.username || '').trim();
  if (!/^[A-Za-z0-9_一-龥]{2,20}$/.test(newName))
    return res.status(400).json({ error: '用户名需为 2-20 位字母、数字、下划线或中文' });
  if (checkSensitive(newName)) return res.status(400).json({ error: '用户名包含敏感信息' });
  if (newName === req.user.username) return res.status(400).json({ error: '新用户名与当前一致' });
  if (db.prepare('SELECT 1 FROM users WHERE username=? AND id!=?').get(newName, req.user.id))
    return res.status(409).json({ error: '该用户名已被占用' });
  const card = db.prepare(`SELECT o.id FROM orders o JOIN products p ON p.id=o.product_id
    WHERE o.user_id=? AND p.payload='rename' AND o.used=0 ORDER BY o.created_at LIMIT 1`).get(req.user.id);
  if (!card) return res.status(403).json({ error: '需要一张「改名卡」，请先到积分商城兑换' });
  db.prepare('UPDATE orders SET used=1 WHERE id=?').run(card.id);
  db.prepare('UPDATE users SET username=? WHERE id=?').run(newName, req.user.id);
  res.json({ ok: true, user: publicUser(getUser(req.user.id), req.user.id) });
});

export default router;
