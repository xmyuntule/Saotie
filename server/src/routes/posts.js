import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, notify, parseMentions, parseTopics } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

function viewerLiked(userId, type, id) {
  if (!userId) return false;
  return !!db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(userId, type, id);
}

// Build the poll attached to a post (or null). Reveals per-option counts always,
// but marks which options the viewer chose + whether voting has closed.
function buildPoll(postId, viewerId) {
  const poll = db.prepare('SELECT * FROM polls WHERE post_id=?').get(postId);
  if (!poll) return null;
  const options = db.prepare('SELECT id, text, votes FROM poll_options WHERE poll_id=? ORDER BY idx ASC, id ASC').all(poll.id);
  const myVotes = viewerId
    ? db.prepare('SELECT option_id FROM poll_votes WHERE poll_id=? AND user_id=?').all(poll.id, viewerId).map((r) => r.option_id)
    : [];
  const closed = !!(poll.deadline && poll.deadline <= new Date().toISOString().slice(0, 19).replace('T', ' '));
  return {
    id: poll.id,
    multi: !!poll.multi,
    deadline: poll.deadline || null,
    closed,
    totalVotes: poll.total_votes,
    voted: myVotes.length > 0,
    myVotes,
    options: options.map((o) => ({ id: o.id, text: o.text, votes: o.votes })),
  };
}

// Serialize a post with visibility/unlock handling
function serializePost(row, viewerId, { deep = true } = {}) {
  const author = getUser(row.user_id);
  const anon = row.visibility === 'anonymous';
  const isOwner = viewerId === row.user_id;
  let unlocked = true;
  let locked = null;

  if (row.visibility === 'paid' && !isOwner) {
    unlocked = viewerId
      ? !!db.prepare('SELECT 1 FROM purchases WHERE user_id=? AND post_id=?').get(viewerId, row.id)
      : false;
    if (!unlocked) locked = { type: 'paid', price: row.price };
  }
  if (row.visibility === 'password' && !isOwner) {
    // password posts surface a teaser only until verified per-request (handled in unlock endpoint)
    locked = { type: 'password' };
    unlocked = false;
  }
  if (row.visibility === 'private' && !isOwner) {
    return null; // private: hidden from others entirely
  }

  let shared = null;
  if (row.share_of && deep) {
    const src = db.prepare('SELECT * FROM posts WHERE id=?').get(row.share_of);
    if (src) shared = serializePost(src, viewerId, { deep: false });
  }

  return {
    id: row.id,
    content: unlocked ? row.content : (row.content || '').slice(0, 40),
    media: unlocked ? JSON.parse(row.media || '[]') : [],
    mediaType: row.media_type,
    visibility: row.visibility,
    price: row.price,
    location: row.location,
    device: row.device,
    views: row.views,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    createdAt: row.created_at,
    edited: !!row.edited,
    pinned: !!row.pinned,
    globalPinned: !!(row.global_pin_until && row.global_pin_until > new Date().toISOString().slice(0, 19).replace('T', ' ')),
    liked: viewerLiked(viewerId, 'post', row.id),
    bookmarked: viewerId ? !!db.prepare('SELECT 1 FROM bookmarks WHERE user_id=? AND post_id=?').get(viewerId, row.id) : false,
    locked,
    unlocked,
    topic: row.topic_id ? db.prepare('SELECT id,name FROM topics WHERE id=?').get(row.topic_id) : null,
    poll: unlocked ? buildPoll(row.id, viewerId) : null,
    shared,
    author: anon && !isOwner
      ? { id: 0, nickname: '匿名用户', username: '', avatar: 'emoji:🕶️', anonymous: true, level: 0 }
      : publicUser(author, viewerId),
  };
}

function feedQuery(filter, viewerId, city, limit, offset) {
  const base = `SELECT * FROM posts WHERE visibility != 'private'`;
  const page = ` LIMIT ? OFFSET ?`;
  const gp = `(global_pin_until > datetime('now')) DESC, `; // 全站置顶卡 floats to top
  switch (filter) {
    case 'following':
      if (!viewerId) return { sql: '', args: [] };
      return {
        sql: `SELECT * FROM posts WHERE visibility != 'private' AND user_id IN
              (SELECT following_id FROM follows WHERE follower_id = ?) ORDER BY ${gp}created_at DESC${page}`,
        args: [viewerId, limit, offset],
      };
    case 'video':
      return { sql: base + ` AND media_type='video' ORDER BY created_at DESC${page}`, args: [limit, offset] };
    case 'samecity':
      return { sql: base + ` AND location = ? AND location != '' ORDER BY created_at DESC${page}`, args: [city || '', limit, offset] };
    case 'recommend':
      return { sql: base + ` ORDER BY ${gp}(like_count*3 + comment_count*2 + views*0.1) DESC, created_at DESC${page}`, args: [limit, offset] };
    default:
      return { sql: base + ` ORDER BY ${gp}created_at DESC${page}`, args: [limit, offset] };
  }
}

// Set of user ids the viewer blocked or who blocked the viewer
function blockedSet(viewerId) {
  if (!viewerId) return new Set();
  const rows = db.prepare('SELECT blocked_id AS id FROM blocks WHERE blocker_id=? UNION SELECT blocker_id AS id FROM blocks WHERE blocked_id=?').all(viewerId, viewerId);
  return new Set(rows.map(r => r.id));
}

// Feed — paginated (limit/offset). Over-fetches by 1 to compute hasMore.
router.get('/', optionalAuth, (req, res) => {
  const filter = req.query.filter || 'all';
  const viewerId = req.user?.id || null;
  const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 12));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const { sql, args } = feedQuery(filter, viewerId, req.user?.location, limit + 1, offset);
  if (!sql) return res.json({ posts: [], hasMore: false });
  const rows = db.prepare(sql).all(...args);
  const hasMore = rows.length > limit;
  const blocked = blockedSet(viewerId);
  const posts = rows.slice(0, limit).filter(r => !blocked.has(r.user_id)).map(r => serializePost(r, viewerId)).filter(Boolean);
  res.json({ posts, hasMore });
});

// Single post (increments views)
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  db.prepare('UPDATE posts SET views = views + 1 WHERE id=?').run(row.id);
  row.views += 1;
  const post = serializePost(row, req.user?.id);
  if (!post) return res.status(403).json({ error: '这是一条私密动态' });
  res.json({ post });
});

// Related posts (same topic, else same author, else recent) — for post detail
router.get('/:id/related', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.json({ posts: [] });
  let rows = [];
  if (row.topic_id) {
    rows = db.prepare("SELECT * FROM posts WHERE topic_id=? AND id!=? AND visibility IN ('public','paid','password') ORDER BY (like_count*3+comment_count*2) DESC LIMIT 6").all(row.topic_id, row.id);
  }
  if (rows.length < 4) {
    const more = db.prepare("SELECT * FROM posts WHERE user_id=? AND id!=? AND visibility IN ('public','paid','password') ORDER BY created_at DESC LIMIT 6").all(row.user_id, row.id);
    const seen = new Set(rows.map(r => r.id));
    for (const m of more) { if (rows.length >= 6) break; if (!seen.has(m.id)) { rows.push(m); seen.add(m.id); } }
  }
  res.json({ posts: rows.slice(0, 5).map(r => serializePost(r, req.user?.id)).filter(Boolean) });
});

// Prev/next post by the same author (timeline reading nav)
router.get('/:id/siblings', optionalAuth, (req, res) => {
  const cur = db.prepare('SELECT user_id, created_at FROM posts WHERE id=?').get(req.params.id);
  if (!cur) return res.json({ prev: null, next: null });
  const vis = "visibility IN ('public','paid','password')";
  const brief = (r) => r ? { id: r.id, content: (r.content || '[图片/视频]').replace(/[#@]/g, '').slice(0, 28) } : null;
  // 上一条 = more recent post by the author; 下一条 = older one
  const prev = db.prepare(`SELECT id, content FROM posts WHERE user_id=? AND created_at > ? AND ${vis} ORDER BY created_at ASC LIMIT 1`).get(cur.user_id, cur.created_at);
  const next = db.prepare(`SELECT id, content FROM posts WHERE user_id=? AND created_at < ? AND ${vis} ORDER BY created_at DESC LIMIT 1`).get(cur.user_id, cur.created_at);
  res.json({ prev: brief(prev), next: brief(next) });
});

// Create post
router.post('/', requireAuth, (req, res) => {
  let { content = '', media = [], mediaType = 'text', visibility = 'public',
        password = '', price = 0, location = '', device = '电脑端', topic, circleId, poll } = req.body || {};
  content = (content || '').trim();

  // validate poll up front (2-6 non-empty options)
  let pollOpts = null;
  if (poll && Array.isArray(poll.options)) {
    pollOpts = poll.options.map((o) => (o || '').toString().trim()).filter(Boolean).slice(0, 6);
    if (pollOpts.length < 2) return res.status(400).json({ error: '投票至少需要 2 个选项' });
    if (pollOpts.some((o) => checkSensitive(o))) return res.status(400).json({ error: '选项包含敏感信息，请修改后重试' });
  }

  if (!content && (!media || media.length === 0) && !pollOpts)
    return res.status(400).json({ error: '说点什么或添加图片/视频吧' });
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });

  // resolve topic from #...# in content or explicit topic name
  let topicId = null;
  const topicNames = parseTopics(content);
  const topicName = topic || topicNames[0];
  if (topicName) {
    let t = db.prepare('SELECT * FROM topics WHERE name=?').get(topicName);
    if (!t) {
      const info = db.prepare('INSERT INTO topics (name) VALUES (?)').run(topicName);
      t = { id: info.lastInsertRowid };
    }
    topicId = t.id;
    db.prepare('UPDATE topics SET post_count = post_count + 1, hot = hot + 1 WHERE id=?').run(topicId);
  }

  // circle membership gate — must belong to a circle they're posting into
  let circleId2 = null;
  if (circleId) {
    const joined = db.prepare('SELECT 1 FROM circle_members WHERE circle_id=? AND user_id=?').get(circleId, req.user.id);
    if (joined) circleId2 = Number(circleId);
  }

  const info = db.prepare(`INSERT INTO posts
    (user_id, content, media, media_type, visibility, password, price, location, device, topic_id, circle_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
      req.user.id, content, JSON.stringify(media || []), mediaType, visibility,
      visibility === 'password' ? password : null, Number(price) || 0, location, device, topicId, circleId2);

  if (circleId2) db.prepare('UPDATE circles SET post_count = post_count + 1 WHERE id=?').run(circleId2);

  // attach poll
  if (pollOpts) {
    const days = Math.max(0, Math.min(30, Number(poll.days) || 0));
    const deadline = days > 0
      ? new Date(Date.now() + days * 86400000).toISOString().slice(0, 19).replace('T', ' ')
      : null;
    const pInfo = db.prepare('INSERT INTO polls (post_id, multi, deadline) VALUES (?,?,?)')
      .run(info.lastInsertRowid, poll.multi ? 1 : 0, deadline);
    const insOpt = db.prepare('INSERT INTO poll_options (poll_id, text, idx) VALUES (?,?,?)');
    pollOpts.forEach((t, i) => insOpt.run(pInfo.lastInsertRowid, t.slice(0, 60), i));
  }

  award(req.user.id, { exp: 5, points: 2 });

  // @mentions
  for (const name of parseMentions(content)) {
    const target = db.prepare('SELECT id FROM users WHERE username=? OR nickname=?').get(name, name);
    if (target) notify({ userId: target.id, actorId: req.user.id, type: 'mention', targetType: 'post', targetId: info.lastInsertRowid, preview: content.slice(0, 60) });
  }

  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(info.lastInsertRowid);
  res.json({ post: serializePost(row, req.user.id) });
});

// Vote on a post's poll — { optionIds: [] } (single-choice uses the first)
router.post('/:id/vote', requireAuth, (req, res) => {
  const poll = db.prepare('SELECT * FROM polls WHERE post_id=?').get(req.params.id);
  if (!poll) return res.status(404).json({ error: '该动态没有投票' });
  if (poll.deadline && poll.deadline <= new Date().toISOString().slice(0, 19).replace('T', ' '))
    return res.status(400).json({ error: '投票已结束' });
  const already = db.prepare('SELECT 1 FROM poll_votes WHERE poll_id=? AND user_id=?').get(poll.id, req.user.id);
  if (already) return res.status(400).json({ error: '你已经投过票了' });

  const valid = new Set(db.prepare('SELECT id FROM poll_options WHERE poll_id=?').all(poll.id).map((o) => o.id));
  let ids = Array.isArray(req.body?.optionIds) ? req.body.optionIds : [req.body?.optionId];
  ids = [...new Set(ids.map(Number).filter((id) => valid.has(id)))];
  if (!poll.multi) ids = ids.slice(0, 1);
  if (!ids.length) return res.status(400).json({ error: '请选择一个选项' });

  const tx = db.transaction(() => {
    const insVote = db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id, option_id, user_id) VALUES (?,?,?)');
    for (const oid of ids) {
      insVote.run(poll.id, oid, req.user.id);
      db.prepare('UPDATE poll_options SET votes = votes + 1 WHERE id=?').run(oid);
    }
    db.prepare('UPDATE polls SET total_votes = total_votes + 1 WHERE id=?').run(poll.id);
  });
  tx();
  award(req.user.id, { exp: 1, points: 1 });
  res.json({ poll: buildPoll(Number(req.params.id), req.user.id) });
});

// Share / repost
router.post('/:id/share', requireAuth, (req, res) => {
  const src = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!src) return res.status(404).json({ error: '动态不存在' });
  const content = (req.body?.content || '').trim();
  const info = db.prepare(`INSERT INTO posts (user_id, content, share_of, media_type) VALUES (?,?,?,?)`)
    .run(req.user.id, content, src.id, 'text');
  db.prepare('UPDATE posts SET share_count = share_count + 1 WHERE id=?').run(src.id);
  notify({ userId: src.user_id, actorId: req.user.id, type: 'share', targetType: 'post', targetId: src.id });
  award(req.user.id, { exp: 2, points: 1 });
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(info.lastInsertRowid);
  res.json({ post: serializePost(row, req.user.id) });
});

// Like / unlike
router.post('/:id/like', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  const liked = db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?')
    .get(req.user.id, 'post', row.id);
  if (liked) {
    db.prepare('DELETE FROM likes WHERE user_id=? AND target_type=? AND target_id=?').run(req.user.id, 'post', row.id);
    db.prepare('UPDATE posts SET like_count = MAX(0, like_count - 1) WHERE id=?').run(row.id);
    return res.json({ liked: false, likeCount: row.like_count - 1 });
  }
  db.prepare('INSERT INTO likes (user_id, target_type, target_id) VALUES (?,?,?)').run(req.user.id, 'post', row.id);
  db.prepare('UPDATE posts SET like_count = like_count + 1 WHERE id=?').run(row.id);
  notify({ userId: row.user_id, actorId: req.user.id, type: 'like', targetType: 'post', targetId: row.id, preview: (row.content || '').slice(0, 40) });
  award(row.user_id, { exp: 1, points: 1 });
  res.json({ liked: true, likeCount: row.like_count + 1 });
});

// Unlock a paid post (spends points)
router.post('/:id/unlock', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  if (row.visibility === 'password') {
    if ((req.body?.password || '') !== row.password) return res.status(403).json({ error: '密码错误' });
    return res.json({ post: serializePost({ ...row }, req.user.id, { }), bypass: true, content: row.content, media: JSON.parse(row.media || '[]') });
  }
  if (row.visibility !== 'paid') return res.status(400).json({ error: '无需解锁' });
  const already = db.prepare('SELECT 1 FROM purchases WHERE user_id=? AND post_id=?').get(req.user.id, row.id);
  if (already) return res.json({ post: serializePost(row, req.user.id) });
  if (req.user.points < row.price) return res.status(402).json({ error: '积分不足，先去签到赚积分吧' });
  db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(row.price, req.user.id);
  db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(row.price, row.user_id);
  db.prepare('INSERT INTO purchases (user_id, post_id) VALUES (?,?)').run(req.user.id, row.id);
  notify({ userId: row.user_id, actorId: req.user.id, type: 'reward', targetType: 'post', targetId: row.id, preview: `购买了你的付费内容 +${row.price}积分` });
  res.json({ post: serializePost(row, req.user.id) });
});

// Reward / 打赏 a post's author
router.post('/:id/reward', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  const amount = Math.max(1, Math.min(9999, Number(req.body?.amount) || 0));
  if (req.user.points < amount) return res.status(402).json({ error: '积分不足' });
  if (row.user_id === req.user.id) return res.status(400).json({ error: '不能打赏自己' });
  db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(amount, req.user.id);
  db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(amount, row.user_id);
  db.prepare('INSERT INTO rewards (from_id, to_id, post_id, amount) VALUES (?,?,?,?)').run(req.user.id, row.user_id, row.id, amount);
  notify({ userId: row.user_id, actorId: req.user.id, type: 'reward', targetType: 'post', targetId: row.id, preview: `打赏了你 ${amount} 积分 🎁` });
  res.json({ ok: true });
});

// Edit own post (content / media / visibility)
router.put('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: '无权编辑' });
  const { content, media, visibility, price } = req.body || {};
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  db.prepare(`UPDATE posts SET content=COALESCE(?,content), media=COALESCE(?,media),
      visibility=COALESCE(?,visibility), price=COALESCE(?,price), edited=1 WHERE id=?`)
    .run(content ?? null, media ? JSON.stringify(media) : null, visibility ?? null,
      price === undefined ? null : Number(price) || 0, row.id);
  res.json({ post: serializePost(db.prepare('SELECT * FROM posts WHERE id=?').get(row.id), req.user.id) });
});

// Pin / unpin own post (only one pinned per user — pinning clears the others)
router.post('/:id/pin', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: '无权操作' });
  if (row.pinned) {
    db.prepare('UPDATE posts SET pinned=0 WHERE id=?').run(row.id);
    return res.json({ pinned: false });
  }
  db.prepare('UPDATE posts SET pinned=0 WHERE user_id=?').run(req.user.id);
  db.prepare('UPDATE posts SET pinned=1 WHERE id=?').run(row.id);
  res.json({ pinned: true });
});

// Global pin / 全站置顶 — consumes one unused 全站置顶卡 (payload 'pin'); floats the post to the feed top for 24h
router.post('/:id/global-pin', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: '只能置顶自己的动态' });
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (row.global_pin_until && row.global_pin_until > now) {
    db.prepare("UPDATE posts SET global_pin_until='' WHERE id=?").run(row.id);
    return res.json({ globalPinned: false });
  }
  const card = db.prepare(`SELECT o.id FROM orders o JOIN products p ON p.id=o.product_id
    WHERE o.user_id=? AND p.payload='pin' AND o.used=0 ORDER BY o.created_at LIMIT 1`).get(req.user.id);
  if (!card) return res.status(403).json({ error: '需要一张「全站置顶卡」，请先到积分商城兑换' });
  const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('UPDATE orders SET used=1 WHERE id=?').run(card.id);
  db.prepare('UPDATE posts SET global_pin_until=? WHERE id=?').run(until, row.id);
  res.json({ globalPinned: true, until });
});

// Bookmark / 收藏 toggle
router.post('/:id/bookmark', requireAuth, (req, res) => {
  const row = db.prepare('SELECT id FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  const has = db.prepare('SELECT 1 FROM bookmarks WHERE user_id=? AND post_id=?').get(req.user.id, row.id);
  if (has) { db.prepare('DELETE FROM bookmarks WHERE user_id=? AND post_id=?').run(req.user.id, row.id); return res.json({ bookmarked: false }); }
  db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?,?)').run(req.user.id, row.id);
  res.json({ bookmarked: true });
});

// Delete own post
router.delete('/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '动态不存在' });
  if (row.user_id !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM posts WHERE id=?').run(row.id);
  res.json({ ok: true });
});

// Posts by a user (for profile)
router.get('/user/:username', optionalAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.params.username)
    || db.prepare('SELECT * FROM users WHERE nickname=? LIMIT 1').get(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const rows = db.prepare('SELECT * FROM posts WHERE user_id=? ORDER BY pinned DESC, created_at DESC LIMIT 50').all(u.id);
  res.json({ posts: rows.map(r => serializePost(r, req.user?.id)).filter(Boolean) });
});

// Posts a user has liked (for profile 赞过 tab)
router.get('/liked/:username', optionalAuth, (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(req.params.username)
    || db.prepare('SELECT * FROM users WHERE nickname=? LIMIT 1').get(req.params.username);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const rows = db.prepare(`SELECT p.* FROM likes l JOIN posts p ON p.id=l.target_id
    WHERE l.user_id=? AND l.target_type='post' AND p.visibility NOT IN ('private','anonymous')
    ORDER BY l.created_at DESC LIMIT 50`).all(u.id);
  res.json({ posts: rows.map(r => serializePost(r, req.user?.id)).filter(Boolean) });
});

export { serializePost };
export default router;
