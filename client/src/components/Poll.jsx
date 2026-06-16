import { useState } from 'react';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

function deadlineLabel(deadline, closed) {
  if (closed) return '投票已结束';
  if (!deadline) return '长期有效';
  const ms = new Date(deadline.replace(' ', 'T')).getTime() - Date.now();
  if (ms <= 0) return '投票已结束';
  const d = Math.floor(ms / 86400000);
  if (d >= 1) return `${d} 天后结束`;
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h} 小时后结束`;
  return `${Math.max(1, Math.floor(ms / 60000))} 分钟后结束`;
}

export default function Poll({ poll: initial, postId }) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [poll, setPoll] = useState(initial);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  if (!poll) return null;

  const showResults = poll.voted || poll.closed;
  const total = poll.totalVotes || 0;

  const toggle = (id) => {
    if (showResults) return;
    setPicked((p) => poll.multi ? (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) : [id]);
  };

  const vote = async () => {
    if (!user) return setAuthOpen(true);
    if (!picked.length) return toast.err('请选择一个选项');
    setBusy(true);
    try {
      const { data } = await api.post(`/posts/${postId}/vote`, { optionIds: picked });
      setPoll(data.poll);
      toast.ok('投票成功');
    } catch (err) { toast.err(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="poll" onClick={(e) => e.stopPropagation()}>
      <div className="poll-head">
        <Icon name="poll" size={15} />
        <span>{poll.multi ? '多选投票' : '单选投票'}</span>
      </div>
      <div className="poll-opts">
        {poll.options.map((o) => {
          const pct = total > 0 ? Math.round((o.votes / total) * 100) : 0;
          const mine = poll.myVotes?.includes(o.id);
          const sel = picked.includes(o.id);
          return (
            <button key={o.id} type="button"
              className={`poll-opt${showResults ? ' result' : ''}${sel ? ' sel' : ''}${mine ? ' mine' : ''}`}
              onClick={() => toggle(o.id)} disabled={showResults}>
              {showResults && <span className="poll-bar" style={{ width: `${pct}%` }} />}
              <span className="poll-opt-body">
                {!showResults && <span className={`poll-tick${poll.multi ? ' sq' : ''}`}>{sel && <Icon name="check" size={12} />}</span>}
                <span className="poll-opt-text">{o.text}</span>
                {showResults && <span className="poll-pct">{mine && <Icon name="check" size={12} />}{pct}%</span>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="poll-foot">
        {!showResults && (
          <button className="btn btn-primary btn-sm" onClick={vote} disabled={busy || !picked.length}>
            {busy ? '提交中…' : '投票'}
          </button>
        )}
        <span className="poll-meta">{fmtNum(total)} 人参与 · {deadlineLabel(poll.deadline, poll.closed)}</span>
      </div>
    </div>
  );
}
