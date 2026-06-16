import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

const MODELS = {
  'claude-sonnet-4-6': 'Claude Sonnet 4.6',
  'claude-opus-4-8': 'Claude Opus 4.8',
  'claude-haiku-4-5': 'Claude Haiku 4.5',
};
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const SYSTEM = `你是「HahaSNS 智能助手」，一个轻社交社区里友好、克制、实用的中文 AI 助手。
你可以帮用户：润色 / 续写动态文案、想话题灵感、解答社区功能用法（圈子、投票、问答、积分、签到等）、给建议。
风格：简洁、真诚、有温度，不啰嗦，不卖弄。除非用户要求，否则不要用大量 emoji。`;

const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const convOwned = (id, uid) => db.prepare('SELECT * FROM ai_conversations WHERE id=? AND user_id=?').get(id, uid);

// Call Claude via the Anthropic Messages API; demo-mode fallback when unconfigured.
async function callClaude(history, model) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const last = history[history.length - 1]?.content || '';
    return {
      demo: true,
      text: `（演示模式）你好，我是 HahaSNS 智能助手。当前服务端未配置 ANTHROPIC_API_KEY，所以这是一条占位回复。\n\n` +
        `配置密钥后我就能真正回答「${last.slice(0, 40)}${last.length > 40 ? '…' : ''}」这类问题，并帮你润色动态、想话题、解答社区用法。`,
    };
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODELS[model] ? model : DEFAULT_MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!resp.ok) throw new Error(`AI 服务暂时不可用（${resp.status}）`);
  const data = await resp.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  return { text: text || '（没有返回内容）' };
}

// Is the assistant configured + which models are available
router.get('/status', (req, res) => {
  res.json({ configured: !!process.env.ANTHROPIC_API_KEY, defaultModel: DEFAULT_MODEL, models: MODELS });
});

// List my conversations (most-recent first)
router.get('/conversations', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, title, created_at, updated_at FROM ai_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50').all(req.user.id);
  res.json({ conversations: rows });
});

// Create a conversation (optionally seed nothing — first message comes via /messages)
router.post('/conversations', requireAuth, (req, res) => {
  const info = db.prepare('INSERT INTO ai_conversations (user_id, title) VALUES (?,?)').run(req.user.id, '新对话');
  const row = db.prepare('SELECT id, title, created_at, updated_at FROM ai_conversations WHERE id=?').get(info.lastInsertRowid);
  res.json({ conversation: row });
});

// Get a conversation with its messages
router.get('/conversations/:id', requireAuth, (req, res) => {
  const conv = convOwned(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: '对话不存在' });
  const messages = db.prepare('SELECT id, role, content, created_at FROM ai_messages WHERE conversation_id=? ORDER BY id ASC').all(conv.id);
  res.json({ conversation: { id: conv.id, title: conv.title, createdAt: conv.created_at }, messages });
});

router.delete('/conversations/:id', requireAuth, (req, res) => {
  const conv = convOwned(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: '对话不存在' });
  db.prepare('DELETE FROM ai_messages WHERE conversation_id=?').run(conv.id);
  db.prepare('DELETE FROM ai_conversations WHERE id=?').run(conv.id);
  res.json({ ok: true });
});

// Send a user message → get the assistant's reply (both persisted)
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
  const conv = convOwned(req.params.id, req.user.id);
  if (!conv) return res.status(404).json({ error: '对话不存在' });
  const content = (req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: '说点什么吧' });
  if (content.length > 4000) return res.status(400).json({ error: '消息太长了' });
  if (checkSensitive(content)) return res.status(400).json({ error: '内容包含敏感信息，请修改后重试' });
  const model = req.body?.model || DEFAULT_MODEL;

  // store the user's message + (if first) title the conversation from it
  const insMsg = db.prepare('INSERT INTO ai_messages (conversation_id, role, content) VALUES (?,?,?)');
  insMsg.run(conv.id, 'user', content);
  const count = db.prepare('SELECT COUNT(*) c FROM ai_messages WHERE conversation_id=?').get(conv.id).c;
  if (count === 1) db.prepare('UPDATE ai_conversations SET title=? WHERE id=?').run(content.slice(0, 24), conv.id);

  const history = db.prepare('SELECT role, content FROM ai_messages WHERE conversation_id=? ORDER BY id ASC').all(conv.id);
  let reply;
  try {
    reply = await callClaude(history, model);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
  const info = insMsg.run(conv.id, 'assistant', reply.text);
  db.prepare("UPDATE ai_conversations SET updated_at=datetime('now') WHERE id=?").run(conv.id);
  const saved = db.prepare('SELECT id, role, content, created_at FROM ai_messages WHERE id=?').get(info.lastInsertRowid);
  res.json({ message: saved, demo: !!reply.demo });
});

export default router;
