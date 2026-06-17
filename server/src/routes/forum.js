import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, notify, recordView } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

function isModerator(boardId, userId) {
  if (!userId) return false;
  const u = getUser(userId);
  if (u?.role === 'admin') return true;
  return !!db.prepare('SELECT 1 FROM moderators WHERE board_id=? AND user_id=?').get(boardId, userId);
}

// A paid board is locked for everyone except buyers, mods, and admins.
function boardLockedFor(boardId, viewerId) {
  const b = db.prepare('SELECT is_paid, price FROM boards WHERE id=?').get(boardId);
  if (!b || !b.is_paid || b.price <= 0) return false;
  if (isModerator(boardId, viewerId)) return false; // admins + mods pass
  if (!viewerId) return true;
  return !db.prepare('SELECT 1 FROM board_purchases WHERE user_id=? AND board_id=?').get(viewerId, boardId);
}

function serializeBoard(b, viewerId = null) {
  const mods = db.prepare(`SELECT u.* FROM moderators m JOIN users u ON u.id=m.user_id WHERE m.board_id=?`).all(b.id);
  const children = db.prepare('SELECT * FROM boards WHERE parent_id=? ORDER BY sort, id').all(b.id);
  const followers = db.prepare('SELECT COUNT(*) c FROM board_follows WHERE board_id=?').get(b.id).c;
  const isFollowing = viewerId ? !!db.prepare('SELECT 1 FROM board_follows WHERE user_id=? AND board_id=?').get(viewerId, b.id) : false;
  const kids = children.map(c => serializeBoard(c, viewerId));
  // a parent board's thread list aggregates its children, so its count should too
  const threadCount = b.thread_count + kids.reduce((s, c) => s + (c.threadCount || 0), 0);
  // paid-board gating: locked for everyone except buyers / mods / admins
  const purchased = viewerId ? !!db.prepare('SELECT 1 FROM board_purchases WHERE user_id=? AND board_id=?').get(viewerId, b.id) : false;
  const locked = boardLockedFor(b.id, viewerId);
  return {
    id: b.id, name: b.name, slug: b.slug, description: b.description,
    cover: b.cover, icon: b.icon, announcement: b.announcement,
    isPaid: !!b.is_paid, price: b.price, purchased, locked, threadCount,
    parentId: b.parent_id, followers, isFollowing,
    moderators: mods.map(m => publicUser(m)),
    children: kids,
  };
}

function serializeThread(t, viewerId, { full = false } = {}) {
  const board = db.prepare('SELECT id,name,slug,icon FROM boards WHERE id=?').get(t.board_id);
  const liked = viewerId ? !!db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(viewerId, 'thread', t.id) : false;
  return {
    id: t.id, title: t.title,
    content: full ? t.content : (t.content || '').slice(0, 120),
    media: full ? JSON.parse(t.media || '[]') : [],
    pinned: !!t.pinned, elite: !!t.elite, locked: !!t.locked, edited: !!t.edited,
    views: t.views, likeCount: t.like_count, replyCount: t.reply_count,
    liked, createdAt: t.created_at, lastReplyAt: t.last_reply_at,
    board, author: publicUser(getUser(t.user_id), viewerId),
    canModerate: isModerator(t.board_id, viewerId),
    boardLocked: boardLockedFor(t.board_id, viewerId),
  };
}

// List boards (top-level with children)
router.get('/boards', optionalAuth, (req, res) => {
  const tops = db.prepare('SELECT * FROM boards WHERE parent_id IS NULL ORDER BY sort, id').all();
  res.json({ boards: tops.map(b => serializeBoard(b, req.user?.id)) });
});

// Boards the viewer follows (forum landing)
router.get('/my-boards', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT b.* FROM board_follows f JOIN boards b ON b.id=f.board_id
    WHERE f.user_id=? ORDER BY f.created_at DESC`).all(req.user.id);
  res.json({ boards: rows.map(b => serializeBoard(b, req.user.id)) });
});

// Follow / unfollow a board
router.post('/boards/:id/follow', requireAuth, (req, res) => {
  const b = db.prepare('SELECT id FROM boards WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: '板块不存在' });
  const has = db.prepare('SELECT 1 FROM board_follows WHERE user_id=? AND board_id=?').get(req.user.id, b.id);
  if (has) { db.prepare('DELETE FROM board_follows WHERE user_id=? AND board_id=?').run(req.user.id, b.id); return res.json({ following: false }); }
  db.prepare('INSERT INTO board_follows (user_id, board_id) VALUES (?,?)').run(req.user.id, b.id);
  res.json({ following: true });
});

// Single board + its threads
router.get('/boards/:slug', optionalAuth, (req, res) => {
  const b = db.prepare('SELECT * FROM boards WHERE slug=?').get(req.params.slug);
  if (!b) return res.status(404).json({ error: '板块不存在' });
  const sort = req.query.sort || 'latest';
  const order = sort === 'hot'
    ? 'pinned DESC, (like_count*2 + reply_count*3 + views*0.1) DESC, last_reply_at DESC'
    : sort === 'elite'
    ? 'pinned DESC, elite DESC, last_reply_at DESC'
    : 'pinned DESC, last_reply_at DESC';
  const sBoard = serializeBoard(b, req.user?.id);
  // paid board the viewer hasn't unlocked → withhold the thread list
  if (sBoard.locked) return res.json({ board: sBoard, threads: [] });
  const boardIds = [b.id, ...db.prepare('SELECT id FROM boards WHERE parent_id=?').all(b.id).map(r => r.id)];
  const placeholders = boardIds.map(() => '?').join(',');
  const threads = db.prepare(`SELECT * FROM threads WHERE board_id IN (${placeholders}) ORDER BY ${order} LIMIT 50`).all(...boardIds);
  res.json({ board: sBoard, threads: threads.map(t => serializeThread(t, req.user?.id)) });
});

// Unlock a paid board with points (一次解锁，永久可看)
router.post('/boards/:id/purchase', requireAuth, (req, res) => {
  const b = db.prepare('SELECT * FROM boards WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: '板块不存在' });
  if (!b.is_paid || b.price <= 0) return res.status(400).json({ error: '该板块无需购买' });
  if (db.prepare('SELECT 1 FROM board_purchases WHERE user_id=? AND board_id=?').get(req.user.id, b.id))
    return res.json({ ok: true, alreadyOwned: true });
  const u = getUser(req.user.id);
  if ((u.points || 0) < b.price) return res.status(400).json({ error: `积分不足，解锁需要 ${b.price} 积分，你当前有 ${u.points || 0}` });
  db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(b.price, u.id);
  db.prepare('INSERT INTO board_purchases (user_id, board_id) VALUES (?,?)').run(u.id, b.id);
  res.json({ ok: true, points: (u.points || 0) - b.price });
});

// All recent threads (forum landing)
router.get('/threads', optionalAuth, (req, res) => {
  const sort = req.query.sort || 'latest';
  const order = sort === 'hot'
    ? '(like_count*2 + reply_count*3 + views*0.1) DESC, last_reply_at DESC'
    : sort === 'elite' ? 'elite DESC, last_reply_at DESC'
    : 'last_reply_at DESC';
  const rows = db.prepare(`SELECT * FROM threads ORDER BY pinned DESC, ${order} LIMIT 50`).all();
  // don't surface threads from paid boards the viewer hasn't unlocked
  res.json({ threads: rows.map(t => serializeThread(t, req.user?.id)).filter(t => !t.boardLocked) });
});

// Threads authored by a user (profile 帖子 tab)
router.get('/threads/user/:username', optionalAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.params.username)
    || db.prepare('SELECT * FROM users WHERE nickname=? LIMIT 1').get(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const rows = db.prepare('SELECT * FROM threads WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(u.id);
  res.json({ threads: rows.map(t => serializeThread(t, req.user?.id)) });
});

// Single thread (increments views)
router.get('/threads/:id', optionalAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '帖子不存在' });
  // paid board, viewer hasn't unlocked → return a locked stub (no content)
  if (boardLockedFor(t.board_id, req.user?.id)) {
    const board = db.prepare('SELECT id,name,slug,icon,is_paid,price FROM boards WHERE id=?').get(t.board_id);
    return res.json({ thread: { id: t.id, title: t.title, paywalled: true, content: '',
      board: { id: board.id, name: board.name, slug: board.slug, icon: board.icon, isPaid: !!board.is_paid, price: board.price } } });
  }
  db.prepare('UPDATE threads SET views = views + 1 WHERE id=?').run(t.id);
  t.views += 1;
  recordView(req.user?.id, 'thread', t.id);
  res.json({ thread: serializeThread(t, req.user?.id, { full: true }) });
});

// Create thread
router.post('/threads', requireAuth, (req, res) => {
  const { boardId, title, content, media = [] } = req.body || {};
  if (!boardId || !title?.trim() || !content?.trim())
    return res.status(400).json({ error: '板块、标题、内容均必填' });
  if (checkSensitive(title) || checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  const board = db.prepare('SELECT * FROM boards WHERE id=?').get(boardId);
  if (!board) return res.status(404).json({ error: '板块不存在' });
  const info = db.prepare(`INSERT INTO threads (board_id, user_id, title, content, media) VALUES (?,?,?,?,?)`)
    .run(boardId, req.user.id, title.trim(), content.trim(), JSON.stringify(media));
  db.prepare('UPDATE boards SET thread_count = thread_count + 1 WHERE id=?').run(boardId);
  award(req.user.id, { exp: 8, points: 5 });
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(info.lastInsertRowid);
  res.json({ thread: serializeThread(t, req.user.id, { full: true }) });
});

// Like a thread
router.post('/threads/:id/like', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '帖子不存在' });
  const liked = db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(req.user.id, 'thread', t.id);
  if (liked) {
    db.prepare('DELETE FROM likes WHERE user_id=? AND target_type=? AND target_id=?').run(req.user.id, 'thread', t.id);
    db.prepare('UPDATE threads SET like_count = MAX(0, like_count - 1) WHERE id=?').run(t.id);
    return res.json({ liked: false, likeCount: t.like_count - 1 });
  }
  db.prepare('INSERT INTO likes (user_id, target_type, target_id) VALUES (?,?,?)').run(req.user.id, 'thread', t.id);
  db.prepare('UPDATE threads SET like_count = like_count + 1 WHERE id=?').run(t.id);
  notify({ userId: t.user_id, actorId: req.user.id, type: 'like', targetType: 'thread', targetId: t.id, preview: t.title.slice(0, 40) });
  res.json({ liked: true, likeCount: t.like_count + 1 });
});

// Edit own thread
router.put('/threads/:id', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '帖子不存在' });
  if (t.user_id !== req.user.id) return res.status(403).json({ error: '无权编辑' });
  const { title, content } = req.body || {};
  if (checkSensitive(title) || checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  db.prepare('UPDATE threads SET title=COALESCE(?,title), content=COALESCE(?,content), edited=1 WHERE id=?')
    .run(title ?? null, content ?? null, t.id);
  res.json({ thread: serializeThread(db.prepare('SELECT * FROM threads WHERE id=?').get(t.id), req.user.id, { full: true }) });
});

// Moderation: pin / elite / lock / delete
router.post('/threads/:id/moderate', requireAuth, (req, res) => {
  const t = db.prepare('SELECT * FROM threads WHERE id=?').get(req.params.id);
  if (!t) return res.status(404).json({ error: '帖子不存在' });
  const { action } = req.body || {};
  const mod = isModerator(t.board_id, req.user.id);
  const owner = t.user_id === req.user.id;
  // owners may delete their own thread; pin/elite/lock require moderator
  if (action === 'delete') {
    if (!mod && !owner) return res.status(403).json({ error: '无权删除' });
    db.prepare('DELETE FROM threads WHERE id=?').run(t.id);
    db.prepare('UPDATE boards SET thread_count = MAX(0, thread_count - 1) WHERE id=?').run(t.board_id);
    return res.json({ ok: true, deleted: true });
  }
  if (!mod) return res.status(403).json({ error: '需要版主权限' });
  const map = { pin: 'pinned', elite: 'elite', lock: 'locked' };
  const col = map[action];
  if (!col) return res.status(400).json({ error: '未知操作' });
  const next = t[col] ? 0 : 1;
  db.prepare(`UPDATE threads SET ${col}=? WHERE id=?`).run(next, t.id);
  res.json({ ok: true, [col]: !!next });
});

export default router;
