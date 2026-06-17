import { Router } from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { publicUser, getUser, award, notify, recordView } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

function serializeQuestion(row, viewerId, { withBody = false } = {}) {
  return {
    id: row.id,
    title: row.title,
    body: withBody ? row.body : undefined,
    excerpt: withBody ? undefined : (row.body || '').replace(/\s+/g, ' ').slice(0, 80),
    category: row.category,
    bounty: row.bounty,
    status: row.status,
    bestAnswerId: row.best_answer_id || null,
    answerCount: row.answer_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
    isAsker: viewerId === row.user_id,
    author: publicUser(getUser(row.user_id), viewerId),
  };
}

function serializeAnswer(row, viewerId) {
  return {
    id: row.id,
    content: row.content,
    voteCount: row.vote_count,
    accepted: !!row.accepted,
    createdAt: row.created_at,
    voted: viewerId ? !!db.prepare('SELECT 1 FROM answer_votes WHERE answer_id=? AND user_id=?').get(row.id, viewerId) : false,
    author: publicUser(getUser(row.user_id), viewerId),
  };
}

// List questions — ?status=open|solved, ?category=, ?sort=new|hot|bounty
router.get('/', optionalAuth, (req, res) => {
  const { status, category, sort = 'new' } = req.query;
  const where = [];
  const params = [];
  if (status === 'open' || status === 'solved') { where.push('status=?'); params.push(status); }
  if (category && category !== '全部') { where.push('category=?'); params.push(category); }
  const order = sort === 'bounty' ? 'bounty DESC, created_at DESC'
    : sort === 'hot' ? 'answer_count DESC, view_count DESC, created_at DESC'
    : 'created_at DESC';
  const sql = `SELECT * FROM questions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT 50`;
  const rows = db.prepare(sql).all(...params);
  res.json({ questions: rows.map((r) => serializeQuestion(r, req.user?.id)) });
});

// A few open high-bounty questions for the sidebar
router.get('/spotlight', optionalAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM questions WHERE status='open' ORDER BY bounty DESC, created_at DESC LIMIT 5").all();
  res.json({ questions: rows.map((r) => serializeQuestion(r, req.user?.id)) });
});

// Question detail + answers (accepted first, then by votes)
router.get('/:id', optionalAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id);
  if (!row) return res.status(404).json({ error: '问题不存在' });
  db.prepare('UPDATE questions SET view_count = view_count + 1 WHERE id=?').run(row.id);
  recordView(req.user?.id, 'question', row.id);
  const answers = db.prepare('SELECT * FROM answers WHERE question_id=? ORDER BY accepted DESC, vote_count DESC, created_at ASC').all(row.id);
  res.json({
    question: serializeQuestion(row, req.user?.id, { withBody: true }),
    answers: answers.map((a) => serializeAnswer(a, req.user?.id)),
  });
});

// Ask a question (escrow bounty from points)
router.post('/', requireAuth, (req, res) => {
  let { title, body = '', category = '综合', bounty = 0 } = req.body || {};
  title = (title || '').trim();
  if (!title) return res.status(400).json({ error: '请填写问题标题' });
  if (title.length > 60) return res.status(400).json({ error: '标题最多 60 字' });
  bounty = Math.max(0, Math.min(9999, Math.floor(Number(bounty) || 0)));
  if (checkSensitive(title) || checkSensitive(body)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });

  const u = db.prepare('SELECT points FROM users WHERE id=?').get(req.user.id);
  if (bounty > 0 && u.points < bounty) return res.status(402).json({ error: '积分不足，无法设置该悬赏' });

  const info = db.prepare('INSERT INTO questions (user_id, title, body, category, bounty) VALUES (?,?,?,?,?)')
    .run(req.user.id, title.slice(0, 60), body.slice(0, 2000), category, bounty);
  if (bounty > 0) db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(bounty, req.user.id);
  award(req.user.id, { exp: 5 });
  const row = db.prepare('SELECT * FROM questions WHERE id=?').get(info.lastInsertRowid);
  res.json({ question: serializeQuestion(row, req.user.id, { withBody: true }) });
});

// Answer a question
router.post('/:id/answers', requireAuth, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '问题不存在' });
  const content = (req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: '回答内容不能为空' });
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });

  const info = db.prepare('INSERT INTO answers (question_id, user_id, content) VALUES (?,?,?)')
    .run(q.id, req.user.id, content.slice(0, 2000));
  db.prepare('UPDATE questions SET answer_count = answer_count + 1 WHERE id=?').run(q.id);
  award(req.user.id, { exp: 4, points: 1 });
  if (q.user_id !== req.user.id)
    notify({ userId: q.user_id, actorId: req.user.id, type: 'answer', targetType: 'question', targetId: q.id, preview: content.slice(0, 60) });
  const row = db.prepare('SELECT * FROM answers WHERE id=?').get(info.lastInsertRowid);
  res.json({ answer: serializeAnswer(row, req.user.id) });
});

// Upvote an answer (toggle off if already voted)
router.post('/answers/:id/vote', requireAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM answers WHERE id=?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '回答不存在' });
  const has = db.prepare('SELECT 1 FROM answer_votes WHERE answer_id=? AND user_id=?').get(a.id, req.user.id);
  if (has) {
    db.prepare('DELETE FROM answer_votes WHERE answer_id=? AND user_id=?').run(a.id, req.user.id);
    db.prepare('UPDATE answers SET vote_count = MAX(0, vote_count - 1) WHERE id=?').run(a.id);
    return res.json({ voted: false, voteCount: Math.max(0, a.vote_count - 1) });
  }
  db.prepare('INSERT INTO answer_votes (answer_id, user_id) VALUES (?,?)').run(a.id, req.user.id);
  db.prepare('UPDATE answers SET vote_count = vote_count + 1 WHERE id=?').run(a.id);
  if (a.user_id !== req.user.id) award(a.user_id, { exp: 1 });
  res.json({ voted: true, voteCount: a.vote_count + 1 });
});

// Accept an answer (asker only) — transfers bounty, marks solved
router.post('/:id/accept/:answerId', requireAuth, (req, res) => {
  const q = db.prepare('SELECT * FROM questions WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: '问题不存在' });
  if (q.user_id !== req.user.id) return res.status(403).json({ error: '只有提问者可以采纳回答' });
  if (q.status === 'solved') return res.status(400).json({ error: '已经采纳过回答了' });
  const a = db.prepare('SELECT * FROM answers WHERE id=? AND question_id=?').get(req.params.answerId, q.id);
  if (!a) return res.status(404).json({ error: '回答不存在' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE answers SET accepted = 1 WHERE id=?').run(a.id);
    db.prepare("UPDATE questions SET status='solved', best_answer_id=? WHERE id=?").run(a.id, q.id);
    if (q.bounty > 0 && a.user_id !== q.user_id)
      db.prepare('UPDATE users SET points = points + ? WHERE id=?').run(q.bounty, a.user_id);
  });
  tx();
  award(a.user_id, { exp: 10 });
  if (a.user_id !== req.user.id)
    notify({ userId: a.user_id, actorId: req.user.id, type: 'accept', targetType: 'question', targetId: q.id, preview: q.bounty > 0 ? `采纳了你的回答，悬赏 ${q.bounty} 积分到账` : '采纳了你的回答' });
  res.json({ ok: true });
});

export default router;
