import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publicUser, getUser, notify } from '../helpers.js';
import { checkSensitive } from '../sensitive.js';

const router = Router();

// Conversation list (latest message per peer + unread count)
router.get('/', requireAuth, (req, res) => {
  const me = req.user.id;
  const peers = db.prepare(`
    SELECT peer, MAX(created_at) AS last_at FROM (
      SELECT receiver_id AS peer, created_at FROM messages WHERE sender_id=?
      UNION ALL
      SELECT sender_id AS peer, created_at FROM messages WHERE receiver_id=?
    ) GROUP BY peer ORDER BY last_at DESC`).all(me, me);
  const conversations = peers.map(p => {
    const last = db.prepare(`SELECT * FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
      ORDER BY created_at DESC LIMIT 1`).get(me, p.peer, p.peer, me);
    const unread = db.prepare('SELECT COUNT(*) c FROM messages WHERE sender_id=? AND receiver_id=? AND read=0').get(p.peer, me).c;
    const s = db.prepare('SELECT pinned, muted FROM conversation_settings WHERE user_id=? AND peer_id=?').get(me, p.peer);
    return { peer: publicUser(getUser(p.peer), me), last, unread, pinned: !!s?.pinned, muted: !!s?.muted };
  });
  // pinned conversations float to the top; stable sort keeps recency order within each group
  conversations.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  res.json({ conversations });
});

// Total unread count for the navbar badge — muted conversations don't count
router.get('/unread', requireAuth, (req, res) => {
  const c = db.prepare(`SELECT COUNT(*) c FROM messages WHERE receiver_id=? AND read=0
    AND sender_id NOT IN (SELECT peer_id FROM conversation_settings WHERE user_id=? AND muted=1)`).get(req.user.id, req.user.id).c;
  res.json({ unread: c });
});

// Update per-conversation preferences (pin / mute)
router.post('/:peerId/settings', requireAuth, (req, res) => {
  const me = req.user.id;
  const peer = Number(req.params.peerId);
  const cur = db.prepare('SELECT pinned, muted FROM conversation_settings WHERE user_id=? AND peer_id=?').get(me, peer) || { pinned: 0, muted: 0 };
  const pinned = req.body?.pinned === undefined ? cur.pinned : (req.body.pinned ? 1 : 0);
  const muted = req.body?.muted === undefined ? cur.muted : (req.body.muted ? 1 : 0);
  db.prepare(`INSERT INTO conversation_settings (user_id, peer_id, pinned, muted, updated_at)
    VALUES (?,?,?,?,datetime('now'))
    ON CONFLICT(user_id, peer_id) DO UPDATE SET pinned=excluded.pinned, muted=excluded.muted, updated_at=excluded.updated_at`)
    .run(me, peer, pinned, muted);
  res.json({ pinned: !!pinned, muted: !!muted });
});

// Thread with a specific peer (marks them read)
router.get('/:peerId', requireAuth, (req, res) => {
  const me = req.user.id;
  const peer = Number(req.params.peerId);
  const msgs = db.prepare(`SELECT * FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)
    ORDER BY created_at ASC LIMIT 200`).all(me, peer, peer, me);
  db.prepare('UPDATE messages SET read=1 WHERE sender_id=? AND receiver_id=?').run(peer, me);
  res.json({ peer: publicUser(getUser(peer), me), messages: msgs });
});

// Delete a whole conversation with a peer
router.delete('/:peerId', requireAuth, (req, res) => {
  const me = req.user.id;
  const peer = Number(req.params.peerId);
  db.prepare('DELETE FROM messages WHERE (sender_id=? AND receiver_id=?) OR (sender_id=? AND receiver_id=?)').run(me, peer, peer, me);
  db.prepare('DELETE FROM conversation_settings WHERE user_id=? AND peer_id=?').run(me, peer);
  res.json({ ok: true });
});

// Send a message (text or image)
router.post('/:peerId', requireAuth, (req, res) => {
  const me = req.user.id;
  const peer = Number(req.params.peerId);
  const content = (req.body?.content || '').trim();
  const type = req.body?.type === 'image' ? 'image' : 'text';
  if (!content) return res.status(400).json({ error: '消息不能为空' });
  if (type === 'text' && checkSensitive(content)) return res.status(400).json({ error: '消息包含敏感信息，请修改后重试' });
  if (!getUser(peer)) return res.status(404).json({ error: '对方不存在' });
  const info = db.prepare('INSERT INTO messages (sender_id, receiver_id, content, type) VALUES (?,?,?,?)').run(me, peer, content, type);
  const msg = db.prepare('SELECT * FROM messages WHERE id=?').get(info.lastInsertRowid);
  res.json({ message: msg });
});

export default router;
