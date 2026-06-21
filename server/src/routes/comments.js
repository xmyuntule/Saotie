import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, notify, parseMentions, permError } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

const REACTIONS = new Set(['like', 'love', 'haha', 'wow', 'support']);
function viewerReaction(userId, id) {
  if (!userId) return null;
  const r = db.prepare("SELECT reaction FROM likes WHERE user_id=? AND target_type='comment' AND target_id=?").get(userId, id);
  return r ? (r.reaction || 'like') : null;
}

function serializeComment(c, viewerId) {
  const liked = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(viewerId, 'comment', c.id)
    : false;
  return {
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    edited: !!c.edited,
    likeCount: c.like_count,
    liked,
    myReaction: viewerReaction(viewerId, c.id),
    parentId: c.parent_id,
    replyTo: c.reply_to ? publicUser(getUser(c.reply_to), viewerId) : null,
    author: publicUser(getUser(c.user_id), viewerId),
  };
}

// List comments for a post or thread (nested: top-level with replies)
router.get('/', optionalAuth, (req, res) => {
  const { postId, threadId, articleId } = req.query;
  const field = postId ? 'post_id' : threadId ? 'thread_id' : 'article_id';
  const id = postId || threadId || articleId;
  if (!id) return res.status(400).json({ error: '缺少目标' });
  // build the tree from chronological order so replies stay in posting order
  const all = db.prepare(`SELECT * FROM comments WHERE ${field}=? ORDER BY created_at ASC`).all(id);
  const byId = new Map(all.map(c => [c.id, { ...serializeComment(c, req.user?.id), replies: [] }]));
  const roots = [];
  for (const c of all) {
    const node = byId.get(c.id);
    if (c.parent_id && byId.has(c.parent_id)) byId.get(c.parent_id).replies.push(node);
    else roots.push(node);
  }
  // top-level ordering is selectable; replies remain chronological
  const sort = req.query.sort === 'hot' ? 'hot' : 'latest';
  if (sort === 'hot') roots.sort((a, b) => (b.likeCount - a.likeCount) || b.createdAt.localeCompare(a.createdAt));
  else roots.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ comments: roots });
});

// Add comment
router.post('/', requireAuth, (req, res) => {
  const { postId, threadId, articleId, parentId, replyTo, content } = req.body || {};
  const text = (content || '').trim();
  if (!text) return res.status(400).json({ error: '评论内容不能为空' });
  if (!postId && !threadId && !articleId) return res.status(400).json({ error: '缺少目标' });
  if (checkSensitive(text)) return res.status(400).json({ error: '评论包含敏感信息，请修改后重试' });
  { const pe = permError(req.user, 'comment'); if (pe) return res.status(403).json({ error: pe }); }

  const info = db.prepare(`INSERT INTO comments (post_id, thread_id, article_id, user_id, parent_id, reply_to, content)
    VALUES (?,?,?,?,?,?,?)`).run(postId || null, threadId || null, articleId || null, req.user.id, parentId || null, replyTo || null, text);

  // where to point reply/mention notifications (post / thread / article)
  const tType = postId ? 'post' : threadId ? 'thread' : 'article';
  const tId = postId || threadId || articleId;
  let authorId = null;
  const notified = new Set([req.user.id]); // 已通知/无需重复通知的用户（含自己）
  if (postId) {
    db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?').run(postId);
    authorId = db.prepare('SELECT user_id FROM posts WHERE id=?').get(postId)?.user_id;
    notify({ userId: authorId, actorId: req.user.id, type: 'comment', targetType: 'post', targetId: postId, preview: text.slice(0, 50) });
  }
  if (threadId) {
    db.prepare("UPDATE threads SET reply_count = reply_count + 1, last_reply_at = datetime('now') WHERE id=?").run(threadId);
    authorId = db.prepare('SELECT user_id FROM threads WHERE id=?').get(threadId)?.user_id;
    notify({ userId: authorId, actorId: req.user.id, type: 'reply', targetType: 'thread', targetId: threadId, preview: text.slice(0, 50) });
    db.prepare('INSERT OR IGNORE INTO thread_subs (user_id, thread_id) VALUES (?,?)').run(req.user.id, threadId); // 回复即订阅
  }
  if (articleId) {
    db.prepare('UPDATE articles SET comment_count = comment_count + 1 WHERE id=?').run(articleId);
    authorId = db.prepare('SELECT user_id FROM articles WHERE id=?').get(articleId)?.user_id;
    notify({ userId: authorId, actorId: req.user.id, type: 'comment', targetType: 'article', targetId: articleId, preview: text.slice(0, 50) });
  }
  if (authorId) notified.add(authorId);
  if (replyTo && replyTo !== authorId) {
    notify({ userId: replyTo, actorId: req.user.id, type: 'reply', targetType: tType, targetId: tId, preview: text.slice(0, 50) });
    notified.add(replyTo);
  }
  for (const name of parseMentions(text)) {
    const t = db.prepare('SELECT id FROM users WHERE username=? OR nickname=?').get(name, name);
    if (t && !notified.has(t.id)) { notify({ userId: t.id, actorId: req.user.id, type: 'mention', targetType: tType, targetId: tId, preview: text.slice(0, 50) }); notified.add(t.id); }
  }
  // 帖子订阅者：有新回复时提醒（楼主/被回复者/@到的人已在上面通知，去重；限量避免大扇出）
  if (threadId) {
    const subs = db.prepare('SELECT user_id FROM thread_subs WHERE thread_id=? LIMIT 500').all(threadId);
    for (const s of subs) {
      if (notified.has(s.user_id)) continue;
      notify({ userId: s.user_id, actorId: req.user.id, type: 'thread', targetType: 'thread', targetId: threadId, preview: text.slice(0, 50) });
    }
  }
  award(req.user.id, { exp: 2, points: 1 });
  const row = db.prepare('SELECT * FROM comments WHERE id=?').get(info.lastInsertRowid);
  res.json({ comment: { ...serializeComment(row, req.user.id), replies: [] } });
});

// Like / unlike a comment
router.post('/:id/like', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '评论不存在' });
  const liked = db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(req.user.id, 'comment', c.id);
  if (liked) {
    db.prepare('DELETE FROM likes WHERE user_id=? AND target_type=? AND target_id=?').run(req.user.id, 'comment', c.id);
    db.prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id=?').run(c.id);
    return res.json({ liked: false, likeCount: c.like_count - 1 });
  }
  db.prepare('INSERT INTO likes (user_id, target_type, target_id) VALUES (?,?,?)').run(req.user.id, 'comment', c.id);
  db.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id=?').run(c.id);
  // point the notification at the parent post/thread/article so it's clickable
  const likeTType = c.post_id ? 'post' : c.thread_id ? 'thread' : 'article';
  notify({ userId: c.user_id, actorId: req.user.id, type: 'like', targetType: likeTType, targetId: c.post_id || c.thread_id || c.article_id, preview: c.content.slice(0, 40) });
  res.json({ liked: true, likeCount: c.like_count + 1 });
});

// React to a comment (表情回应) — set / switch / toggle-off
router.post('/:id/react', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '评论不存在' });
  const reaction = REACTIONS.has(req.body?.reaction) ? req.body.reaction : 'like';
  const existing = db.prepare("SELECT reaction FROM likes WHERE user_id=? AND target_type='comment' AND target_id=?").get(req.user.id, c.id);
  if (existing) {
    if ((existing.reaction || 'like') === reaction) {
      db.prepare("DELETE FROM likes WHERE user_id=? AND target_type='comment' AND target_id=?").run(req.user.id, c.id);
      db.prepare('UPDATE comments SET like_count = MAX(0, like_count - 1) WHERE id=?').run(c.id);
      return res.json({ myReaction: null, likeCount: Math.max(0, c.like_count - 1) });
    }
    db.prepare("UPDATE likes SET reaction=? WHERE user_id=? AND target_type='comment' AND target_id=?").run(reaction, req.user.id, c.id);
    return res.json({ myReaction: reaction, likeCount: c.like_count });
  }
  db.prepare("INSERT INTO likes (user_id, target_type, target_id, reaction) VALUES (?,?,?,?)").run(req.user.id, 'comment', c.id, reaction);
  db.prepare('UPDATE comments SET like_count = like_count + 1 WHERE id=?').run(c.id);
  const likeTType = c.post_id ? 'post' : c.thread_id ? 'thread' : 'article';
  notify({ userId: c.user_id, actorId: req.user.id, type: 'like', targetType: likeTType, targetId: c.post_id || c.thread_id || c.article_id, preview: c.content.slice(0, 40) });
  res.json({ myReaction: reaction, likeCount: c.like_count + 1 });
});

// Delete own comment
// Edit own comment
router.put('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '评论不存在' });
  if (c.user_id !== req.user.id) return res.status(403).json({ error: '只能编辑自己的评论' });
  const content = (req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  db.prepare('UPDATE comments SET content=?, edited=1 WHERE id=?').run(content.slice(0, 1000), c.id);
  const row = db.prepare('SELECT * FROM comments WHERE id=?').get(c.id);
  res.json({ comment: serializeComment(row, req.user.id) });
});

router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '评论不存在' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM comments WHERE id=?').run(c.id);
  if (c.post_id) db.prepare('UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id=?').run(c.post_id);
  if (c.thread_id) db.prepare('UPDATE threads SET reply_count = MAX(0, reply_count - 1) WHERE id=?').run(c.thread_id);
  if (c.article_id) db.prepare('UPDATE articles SET comment_count = MAX(0, comment_count - 1) WHERE id=?').run(c.article_id);
  res.json({ ok: true });
});

export default router;
