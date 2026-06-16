import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import RichText from './RichText';
import useMention from '../hooks/useMention';
import UserHoverCard from './UserHoverCard';
import { UserName } from './Identity';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { timeAgo } from '../lib/format';

function CommentItem({ c, me, onReply, onLike, onDelete, onReport }) {
  const mine = me && c.author?.id === me.id;
  const [showAllReplies, setShowAllReplies] = useState(false);
  const replies = c.replies || [];
  const visibleReplies = showAllReplies ? replies : replies.slice(0, 3);
  return (
    <div className="comment">
      <UserHoverCard user={c.author}><Avatar user={c.author} size={36} /></UserHoverCard>
      <div className="comment-body">
        <div className="cname"><UserHoverCard user={c.author}><UserName user={c.author} /></UserHoverCard></div>
        <div className="ctext">
          {c.replyTo && <span className="reply-to">@{c.replyTo.nickname} </span>}
          <RichText text={c.content} />
        </div>
        <div className="comment-meta">
          <span>{timeAgo(c.createdAt)}</span>
          <button className={`clike${c.liked ? ' on' : ''}`} onClick={() => onLike(c)}>
            <Icon name="heart" size={13} fill={c.liked} style={{ verticalAlign: '-2px', marginRight: 3 }} />
            {c.likeCount > 0 ? c.likeCount : '赞'}
          </button>
          <button onClick={() => onReply(c)}>回复</button>
          {mine
            ? <button onClick={() => onDelete(c)}>删除</button>
            : <button onClick={() => onReport(c)}>举报</button>}
        </div>
        {replies.length > 0 && (
          <div className="comment-replies">
            {visibleReplies.map((r) => <CommentItem key={r.id} c={r} me={me} onReply={onReply} onLike={onLike} onDelete={onDelete} onReport={onReport} />)}
            {!showAllReplies && replies.length > 3 && (
              <button className="replies-more" onClick={() => setShowAllReplies(true)}>展开 {replies.length - 3} 条回复 ↓</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Comments({ postId, threadId, onCountChange }) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState('latest');
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef();
  const mention = useMention(text, setText, inputRef);

  const params = postId ? { postId } : { threadId };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/comments', { params: { ...params, sort } });
      setComments(data.comments);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [postId, threadId, sort]);

  const submit = async () => {
    if (!user) return setAuthOpen(true);
    if (!text.trim()) return;
    setBusy(true);
    try {
      const payload = { ...params, content: text };
      if (replyTarget) { payload.parentId = replyTarget.parentId || replyTarget.id; payload.replyTo = replyTarget.author.id; }
      await api.post('/comments', payload);
      setText(''); setReplyTarget(null);
      await load();
      onCountChange?.(1);
      toast.ok('评论成功');
    } catch (e) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  const like = async (c) => {
    if (!user) return setAuthOpen(true);
    try {
      const { data } = await api.post(`/comments/${c.id}/like`);
      const apply = (list) => list.map((x) => x.id === c.id ? { ...x, liked: data.liked, likeCount: data.likeCount } : { ...x, replies: x.replies ? apply(x.replies) : x.replies });
      setComments((cs) => apply(cs));
    } catch (e) { toast.err(e.message); }
  };

  const remove = async (c) => {
    if (!confirm('确定删除这条评论？')) return;
    try { await api.delete(`/comments/${c.id}`); await load(); onCountChange?.(-1); toast.ok('已删除'); }
    catch (e) { toast.err(e.message); }
  };
  const report = async (c) => {
    if (!user) return setAuthOpen(true);
    const reason = prompt('举报原因（选填）：');
    if (reason === null) return;
    try { await api.post('/reports', { targetType: 'comment', targetId: c.id, reason }); toast.ok('举报已提交，感谢反馈'); }
    catch (e) { toast.err(e.message); }
  };

  const total = comments.reduce((n, c) => n + 1 + (c.replies?.length || 0), 0);

  return (
    <div className="comments">
      <div className="row gap-8" style={{ padding: '12px 0' }}>
        <Avatar user={user} size={34} emoji={user ? undefined : 'emoji:🙂:#cdd3dd'} />
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => { setText(e.target.value); mention.scan(e.target.value, e.target.selectionStart); }}
            onKeyDown={(e) => { if (mention.onKeyDown(e)) return; if (e.key === 'Enter') submit(); }}
            onBlur={() => setTimeout(mention.close, 120)}
            onFocus={() => !user && setAuthOpen(true)}
            placeholder={replyTarget ? `回复 @${replyTarget.author.nickname}：` : '友善评论，@ 提及好友…'}
            className="inp inp-pill"
          />
          {mention.dropdown}
        </div>
        {replyTarget && <button className="btn btn-ghost btn-sm" onClick={() => setReplyTarget(null)}>取消</button>}
        <button className="btn btn-primary btn-sm" disabled={busy || !text.trim()} onClick={submit}>发送</button>
      </div>

      {loading ? (
        <div className="center" style={{ padding: 24 }}><div className="spinner" /></div>
      ) : total === 0 ? (
        <div className="empty" style={{ padding: '28px 0' }}>
          <div className="e-text">还没有评论，来抢沙发 🛋️</div>
        </div>
      ) : (
        <>
          {comments.length >= 2 && (
            <div className="comments-head">
              <span className="ch-count">{total} 条评论</span>
              <div className="ch-sort">
                <button className={sort === 'latest' ? 'on' : ''} onClick={() => setSort('latest')}>最新</button>
                <button className={sort === 'hot' ? 'on' : ''} onClick={() => setSort('hot')}>最热</button>
              </div>
            </div>
          )}
          {(showAll ? comments : comments.slice(0, 5)).map((c) => (
            <CommentItem key={c.id} c={c} me={user} onReply={setReplyTarget} onLike={like} onDelete={remove} onReport={report} />
          ))}
          {!showAll && comments.length > 5 && (
            <button className="comments-more" onClick={() => setShowAll(true)}>查看全部 {comments.length} 条评论 ↓</button>
          )}
        </>
      )}
    </div>
  );
}
