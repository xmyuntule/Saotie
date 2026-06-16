import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, notify, parseMentions } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

function serializeComment(c, viewerId) {
  const liked = viewerId
    ? !!db.prepare('SELECT 1 FROM likes WHERE user_id=? AND target_type=? AND target_id=?').get(viewerId, 'comment', c.id)
    : false;
  return {
    id: c.id,
    content: c.content,
    createdAt: c.created_at,
    likeCount: c.like_count,
    liked,
    parentId: c.parent_id,
    replyTo: c.reply_to ? publicUser(getUser(c.reply_to), viewerId) : null,
    author: publicUser(getUser(c.user_id), viewerId),
  };
}

// List comments for a post or thread (nested: top-level with replies)
router.get('/', optionalAuth, (req, res) => {
  const { postId, threadId } = req.query;
  const field = postId ? 'post_id' : 'thread_id';
  const id = postId || threadId;
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
  const { postId, threadId, parentId, replyTo, content } = req.body || {};
  const text = (content || '').trim();
  if (!text) return res.status(400).json({ error: '评论内容不能为空' });
  if (!postId && !threadId) return res.status(400).json({ error: '缺少目标' });
  if (checkSensitive(text)) return res.status(400).json({ error: '评论包含敏感信息，请修改后重试' });

  const info = db.prepare(`INSERT INTO comments (post_id, thread_id, user_id, parent_id, reply_to, content)
    VALUES (?,?,?,?,?,?)`).run(postId || null, threadId || null, req.user.id, parentId || null, replyTo || null, text);

  let authorId = null;
  if (postId) {
    db.prepare('UPDATE posts SET comment_count = comment_count + 1 WHERE id=?').run(postId);
    authorId = db.prepare('SELECT user_id FROM posts WHERE id=?').get(postId)?.user_id;
    notify({ userId: authorId, actorId: req.user.id, type: 'comment', targetType: 'post', targetId: postId, preview: text.slice(0, 50) });
  }
  if (threadId) {
    db.prepare("UPDATE threads SET reply_count = reply_count + 1, last_reply_at = datetime('now') WHERE id=?").run(threadId);
    authorId = db.prepare('SELECT user_id FROM threads WHERE id=?').get(threadId)?.user_id;
    notify({ userId: authorId, actorId: req.user.id, type: 'reply', targetType: 'thread', targetId: threadId, preview: text.slice(0, 50) });
  }
  if (replyTo && replyTo !== authorId) {
    notify({ userId: replyTo, actorId: req.user.id, type: 'reply', targetType: postId ? 'post' : 'thread', targetId: postId || threadId, preview: text.slice(0, 50) });
  }
  for (const name of parseMentions(text)) {
    const t = db.prepare('SELECT id FROM users WHERE username=? OR nickname=?').get(name, name);
    if (t) notify({ userId: t.id, actorId: req.user.id, type: 'mention', targetType: postId ? 'post' : 'thread', targetId: postId || threadId, preview: text.slice(0, 50) });
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
  // point the notification at the parent post/thread so it's clickable
  notify({ userId: c.user_id, actorId: req.user.id, type: 'like', targetType: c.post_id ? 'post' : 'thread', targetId: c.post_id || c.thread_id, preview: c.content.slice(0, 40) });
  res.json({ liked: true, likeCount: c.like_count + 1 });
});

// Delete own comment
router.delete('/:id', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: '评论不存在' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: '无权删除' });
  db.prepare('DELETE FROM comments WHERE id=?').run(c.id);
  if (c.post_id) db.prepare('UPDATE posts SET comment_count = MAX(0, comment_count - 1) WHERE id=?').run(c.post_id);
  if (c.thread_id) db.prepare('UPDATE threads SET reply_count = MAX(0, reply_count - 1) WHERE id=?').run(c.thread_id);
  res.json({ ok: true });
});

export default router;
