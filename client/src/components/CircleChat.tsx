import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import Avatar from './Avatar';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { timeAgo } from '../lib/format';

// 圈子聊天室：成员实时（5s 轮询）群聊。非成员看到加入引导。
export default function CircleChat({ slug, joined, onJoin }: { slug: string; joined: boolean; onJoin: () => void }) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [msgs, setMsgs] = useState<any[] | null>(null);
  const [locked, setLocked] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastIdRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/circles/${encodeURIComponent(slug)}/chat`);
      if (data.locked) { setLocked(true); setMsgs([]); return; }
      setLocked(false); setMsgs(data.messages);
    } catch { /* 轮询失败保持现状，下次再拉 */ }
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, joined]);

  // 新消息到达时滚到底部
  useEffect(() => {
    if (!msgs) return;
    const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;
    if (lastId !== lastIdRef.current) {
      lastIdRef.current = lastId;
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [msgs]);

  const send = async () => {
    const c = text.trim();
    if (!c || sending) return;
    setSending(true);
    try {
      const { data } = await api.post(`/circles/${encodeURIComponent(slug)}/chat`, { content: c });
      setText('');
      setMsgs((m) => [...(m || []), data.message]);
    } catch (e: any) { toast.err(e.message); }
    finally { setSending(false); }
  };

  if (locked) {
    return (
      <div className="ui-card">
        <div className="cchat-locked">
          <Icon name="lock" size={26} />
          <div>加入圈子后即可参与群聊</div>
          <button className="btn btn-primary btn-sm" onClick={() => (user ? onJoin() : setAuthOpen(true))}>加入圈子</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ui-card cchat">
      <div className="cchat-list" ref={listRef}>
        {msgs === null ? (
          <div className="cchat-empty"><span className="ui-spinner" /></div>
        ) : msgs.length === 0 ? (
          <div className="cchat-empty">还没有人说话，来开个头吧 👋</div>
        ) : (
          msgs.map((m) => {
            const mine = user && m.author && m.author.id === user.id;
            return (
              <div key={m.id} className={`cchat-msg${mine ? ' mine' : ''}`}>
                <Link to={`/u/${m.author?.username}`} aria-label={m.author?.nickname}><Avatar user={m.author} size={34} noLink /></Link>
                <div className="cchat-bubble-wrap">
                  <div className="cchat-meta">
                    <span className="cchat-name nowrap">{m.author?.nickname}</span>
                    <span className="cchat-time">{timeAgo(m.createdAt)}</span>
                  </div>
                  <div className="cchat-bubble">{m.content}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="cchat-input">
        <input className="inp" value={text} maxLength={1000}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="说点什么…（回车发送）" />
        <button className="btn btn-primary" onClick={send} disabled={sending || !text.trim()} aria-label="发送"><Icon name="send" size={16} /></button>
      </div>
    </div>
  );
}
