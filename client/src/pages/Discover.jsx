import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import { Loading } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

export default function Discover() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [hot, setHot] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      api.get('/topics').then(({ data }) => setTopics(data.topics)).catch(() => {}),
      api.get('/posts', { params: { filter: 'recommend', limit: 6 } }).then(({ data }) => setHot(data.posts)).catch(() => {}),
      user ? api.get('/topics/following').then(({ data }) => setMine(data.topics)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <Shell>
      {mine.length > 0 && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 'var(--gap)' }}>
          <div className="widget-title" style={{ marginBottom: 10 }}><Icon name="bookmark" size={15} className="tk" /> 我关注的话题</div>
          <div className="kw-list">
            {mine.map((t) => <Link className="kw" key={t.id} to={`/topic/${encodeURIComponent(t.name)}`}>#{t.name}#</Link>)}
          </div>
        </div>
      )}
      <div className="card section-head">
        <h2 className="row gap-8"><Icon name="fire" size={20} style={{ color: 'var(--coral)' }} /> 发现话题</h2>
        <span className="muted" style={{ fontSize: 13 }}>参与热门讨论，遇见同好</span>
      </div>
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gap)' }}>
          {topics.map((t, i) => (
            <Link to={`/topic/${encodeURIComponent(t.name)}`} key={t.id} className="card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -10, top: -16, fontSize: 64, opacity: .06, fontWeight: 900, fontStyle: 'italic' }}>{i + 1}</div>
              <div className="row gap-8">
                <span className="badge" style={{ background: i < 3 ? 'var(--like-soft)' : 'var(--brand-soft)', color: i < 3 ? 'var(--like)' : 'var(--brand)' }}>
                  {i < 3 ? '🔥 HOT' : 'TOP ' + (i + 1)}
                </span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 10 }}>#{t.name}#</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{t.description}</div>
              <div className="row gap-12" style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-4)' }}>
                <span><Icon name="comment" size={13} style={{ verticalAlign: -2 }} /> {fmtNum(t.postCount || t.post_count || 0)} 动态</span>
                <span><Icon name="fire" size={13} style={{ verticalAlign: -2 }} /> {fmtNum(t.hot)} 热度</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hot.length > 0 && (
        <>
          <div className="card section-head" style={{ marginTop: 'var(--gap)' }}>
            <h2 className="row gap-8"><Icon name="trend" size={19} style={{ color: 'var(--brand)' }} /> 热门动态</h2>
            <span className="muted" style={{ fontSize: 13 }}>此刻大家都在看</span>
          </div>
          {hot.map((p) => <PostCard key={p.id} post={p} />)}
        </>
      )}
    </Shell>
  );
}
