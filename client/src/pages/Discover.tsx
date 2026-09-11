import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import { CardGridSkeleton, ErrorState, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { fmtNum } from '../lib/format';

export default function Discover() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<any[]>([]);
  const [hot, setHot] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const config = { signal: controller.signal };
    setLoading(true); setFailed(false); setMine([]);
    Promise.allSettled([
      api.get('/topics', config),
      api.get('/posts', { ...config, params: { filter: 'recommend', limit: 6 } }),
      user ? api.get('/topics/following', config) : Promise.resolve({ data: { topics: [] } }),
    ]).then(([topicResult, hotResult, mineResult]) => {
      if (!alive) return;
      setTopics(topicResult.status === 'fulfilled' ? topicResult.value.data.topics : []);
      setHot(hotResult.status === 'fulfilled' ? hotResult.value.data.posts : []);
      setMine(mineResult.status === 'fulfilled' ? mineResult.value.data.topics : []);
      setFailed([topicResult, hotResult, mineResult].some((r) => r.status === 'rejected'));
      setLoading(false);
    });
    return () => { alive = false; controller.abort(); };
  }, [user?.id, attempt]);

  return (
    <Shell>
      {mine.length > 0 && (
        <div className="ui-card" style={{ padding: '14px 18px' }}>
          <div className="widget-title" style={{ marginBottom: 10 }}><Icon name="bookmark" size={15} className="tk" /> 我关注的话题</div>
          <div className="kw-list">
            {mine.map((t: any) => <Link className="kw" key={t.id} to={`/topic/${encodeURIComponent(t.name)}`}>#{t.name}#</Link>)}
          </div>
        </div>
      )}
      <div className="ui-card section-head">
        <h2 className="row gap-8"><Icon name="fire" size={20} style={{ color: 'var(--coral)' }} /> 发现话题</h2>
        <span className="muted" style={{ fontSize: 13 }}>参与热门讨论，遇见同好</span>
      </div>
      {failed && <ErrorState text="部分发现内容加载失败，点击重试" onRetry={() => setAttempt((v) => v + 1)} />}
      {loading ? <CardGridSkeleton count={6} minWidth={220} /> : !topics.length && !failed ? <div className="ui-card"><Empty text="暂时还没有话题" /></div> : (
        <div className="discover-grid">
          {topics.map((t: any, i: number) => (
            <Link to={`/topic/${encodeURIComponent(t.name)}`} key={t.id} className="ui-card" style={{ padding: 18, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: -10, top: -16, fontSize: 64, opacity: .06, fontWeight: 900, fontStyle: 'italic' }}>{i + 1}</div>
              <div className="row gap-8">
                <span className="ui-badge" style={{ background: i < 3 ? 'var(--like-soft)' : 'var(--brand-soft)', color: i < 3 ? 'var(--like)' : 'var(--brand)' }}>
                  {i < 3 ? '热门' : 'TOP ' + (i + 1)}
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
          <div className="ui-card section-head">
            <h2 className="row gap-8"><Icon name="trend" size={19} style={{ color: 'var(--brand)' }} /> 热门动态</h2>
            <span className="muted" style={{ fontSize: 13 }}>此刻大家都在看</span>
          </div>
          {hot.map((p: any) => <PostCard key={p.id} post={p} />)}
        </>
      )}
    </Shell>
  );
}
