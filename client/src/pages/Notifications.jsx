import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Loading, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { timeAgo } from '../lib/format';

const ICONS = { like: 'heart', follow: 'user', comment: 'comment', reply: 'comment', mention: 'at', reward: 'gift', share: 'share', answer: 'help', accept: 'check', system: 'bell' };
const NCOLOR = { like: 'var(--like)', follow: 'var(--brand)', comment: 'var(--good)', reply: 'var(--good)', mention: 'var(--ink-2)', reward: 'var(--gold-deep)', share: 'var(--ink-2)', answer: 'var(--brand)', accept: 'var(--good)', system: 'var(--ink-2)' };
const VERB = {
  like: '赞了你', follow: '关注了你', comment: '评论了你的动态', reply: '回复了你',
  mention: '提到了你', reward: '打赏了你', share: '转发了你的动态',
  answer: '回答了你的提问', accept: '采纳了你的回答', system: '',
};

function linkFor(n) {
  if (n.targetType === 'post') return `/post/${n.targetId}`;
  if (n.targetType === 'thread') return `/thread/${n.targetId}`;
  if (n.targetType === 'question') return `/qa/${n.targetId}`;
  if (n.targetType === 'user' && n.actor) return `/u/${n.actor.username}`;
  return null;
}

const FILTERS = [
  { k: 'all', l: '全部' },
  { k: 'interact', l: '互动', types: ['like', 'comment', 'reply', 'mention', 'share', 'answer', 'accept'] },
  { k: 'follow', l: '关注', types: ['follow'] },
  { k: 'reward', l: '打赏', types: ['reward'] },
  { k: 'system', l: '系统', types: ['system'] },
];

export default function Notifications() {
  const { user, loading: authLoading, setAuthOpen } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAuthOpen(true); setLoading(false); return; }
    load();
  }, [authLoading, user]);
  const load = () => api.get('/notifications').then(({ data }) => setItems(data.notifications)).finally(() => setLoading(false));
  const markAll = async () => { await api.post('/notifications/read'); setItems((xs) => xs.map((x) => ({ ...x, read: true }))); };

  const open = (n) => {
    if (!n.read) { api.post(`/notifications/${n.id}/read`).catch(() => {}); setItems((xs) => xs.map((x) => x.id === n.id ? { ...x, read: true } : x)); }
    const to = linkFor(n);
    if (to) nav(to);
  };

  if (authLoading) return <Shell right={false}><Loading /></Shell>;
  if (!user) return <Shell right={false}><div className="ui-card"><Empty icon="🔒" text="登录后查看通知" /></div></Shell>;

  const active = FILTERS.find((f) => f.k === tab);
  const shown = tab === 'all' ? items : items.filter((n) => active.types.includes(n.type));

  return (
    <Shell right={false}>
      <div className="ui-card section-head">
        <h2 className="row gap-8"><Icon name="bell" size={19} style={{ color: 'var(--brand)' }} /> 通知</h2>
        <button className="btn btn-ghost btn-sm" onClick={markAll}>全部已读</button>
      </div>
      <div className="ui-card feed-tabs">
        {FILTERS.map((f) => {
          const n = f.k === 'all' ? items.filter((x) => !x.read).length : items.filter((x) => f.types.includes(x.type) && !x.read).length;
          return (
            <button key={f.k} className={`feed-tab${tab === f.k ? ' active' : ''}`} onClick={() => setTab(f.k)}>
              {f.l}{n > 0 && <span className="tab-badge">{n}</span>}
            </button>
          );
        })}
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {loading ? <Loading /> : shown.length === 0 ? <Empty icon="🔔" text="这里还没有通知" /> :
          shown.map((n, i) => {
            const to = linkFor(n);
            const body = (
              <div className={`notif-row${n.read ? '' : ' unread'}`} onClick={() => open(n)} style={{ cursor: to ? 'pointer' : 'default' }}>
                {n.actor ? <Avatar user={n.actor} size={42} showV /> : <span className={`notif-ico ${n.type}`}><Icon name={ICONS[n.type]} size={18} style={{ color: NCOLOR[n.type] }} /></span>}
                <div className="notif-main">
                  <div className="notif-text">
                    {n.actor && <b>{n.actor.nickname} </b>}
                    {n.type === 'system' ? n.preview : <span className="muted">{VERB[n.type]}</span>}
                  </div>
                  {n.type !== 'system' && n.preview && <div className="notif-preview nowrap">“{n.preview}”</div>}
                  <div className="notif-time">{timeAgo(n.createdAt)}</div>
                </div>
                <span className={`notif-ico ${n.type}`} style={{ width: 30, height: 30 }}><Icon name={ICONS[n.type]} size={15} style={{ color: NCOLOR[n.type] }} /></span>
              </div>
            );
            return <div key={n.id}>{i > 0 && <div className="divider" />}{body}</div>;
          })}
      </div>
    </Shell>
  );
}
