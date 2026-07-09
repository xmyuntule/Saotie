import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import Shell from '../components/Shell';
import PostCard from '../components/PostCard';
import Composer from '../components/Composer';
import Icon from '../components/Icon';
import { Loading, Empty } from '../components/States';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { buildKeywords, useSeo } from '../hooks/usePageTitle';
import { fmtNum } from '../lib/format';

export default function Topic() {
  const { name } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('latest');
  const [following, setFollowing] = useState(false);
  const topicMeta = data?.topic;
  const topicName = topicMeta?.name || (name ? decodeURIComponent(name) : '');

  useSeo({
    title: topicName ? `#${topicName}# 话题` : '话题',
    description: topicMeta?.description || (topicName ? `参与 #${topicName}# 话题讨论，浏览相关动态。` : 'Saotie 话题动态'),
    keywords: buildKeywords([topicName, '话题', '动态'], ['Saotie', '话题']),
    path: name ? `/topic/${encodeURIComponent(name)}` : null,
    type: 'website',
  });

  useEffect(() => {
    setLoading(true); setSort('latest');
    api.get(`/topics/${encodeURIComponent(name!)}`)
      .then(({ data }) => { setData(data); setPosts(data.posts); setFollowing(!!data.topic.isFollowing); })
      .catch(() => setData(null)).finally(() => setLoading(false));
  }, [name]);

  // 乐观更新：即时切换关注状态（粉丝数显示也随之更新），后台请求失败则回滚
  const toggleFollow = async () => {
    const next = !following;
    setFollowing(next);
    try { const { data: r } = await api.post(`/topics/${encodeURIComponent(name!)}/follow`); if (r.following !== next) setFollowing(r.following); }
    catch (e: any) { setFollowing(!next); }
  };

  const sorted = useMemo(() => {
    const arr = [...posts];
    if (sort === 'hot') arr.sort((a, b) => (b.likeCount * 3 + b.commentCount * 2 + b.views * 0.1) - (a.likeCount * 3 + a.commentCount * 2 + a.views * 0.1));
    else arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return arr;
  }, [posts, sort]);

  if (loading) return <Shell><Loading /></Shell>;
  if (!data) return <Shell><div className="ui-card"><Empty icon="🔍" text="话题不存在" /></div></Shell>;

  const { topic } = data;
  const onPosted = (p: any) => { if (p.topic?.name === topic.name || (p.content || '').includes(`#${topic.name}#`)) setPosts((x) => [p, ...x]); };

  return (
    <Shell>
      <div className="ui-card" style={{ padding: 22, background: 'linear-gradient(135deg, var(--brand-tint), var(--surface) 70%)' }}>
        <div className="row gap-12">
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--brand)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 26 }}>#</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>#{topic.name}#</div>
            <div className="muted" style={{ fontSize: 13.5 }}>{topic.description || '一起来聊聊吧'}</div>
          </div>
          {user && (
            <button className={`btn follow-btn ${following ? 'btn-ghost following' : 'btn-primary'}`} onClick={toggleFollow} style={{ alignSelf: 'flex-start' }}>
              {following ? <><span className="fb-on">已关注</span><span className="fb-off">取消关注</span></> : <><Icon name="plus" size={15} /> 关注</>}
            </button>
          )}
        </div>
        <div className="row gap-16" style={{ marginTop: 14, fontSize: 13, color: 'var(--ink-3)' }}>
          <span><Icon name="comment" size={14} style={{ verticalAlign: -2 }} /> {fmtNum(posts.length)} 条动态</span>
          <span><Icon name="user" size={14} style={{ verticalAlign: -2 }} /> {fmtNum((topic.followers || 0) + (following && !topic.isFollowing ? 1 : 0) - (!following && topic.isFollowing ? 1 : 0))} 关注</span>
          <span><Icon name="fire" size={14} style={{ verticalAlign: -2 }} /> {fmtNum(topic.hot)} 热度</span>
        </div>
      </div>

      {user && <Composer prefill={`#${topic.name}# `} onPosted={onPosted} />}

      <div className="ui-card feed-tabs">
        <button className={`feed-tab${sort === 'latest' ? ' active' : ''}`} onClick={() => setSort('latest')}>最新</button>
        <button className={`feed-tab${sort === 'hot' ? ' active' : ''}`} onClick={() => setSort('hot')}>最热</button>
      </div>

      {sorted.length === 0 ? <div className="ui-card"><Empty text="还没有人参与这个话题，来发第一条吧" /></div>
        : sorted.map((p: any) => <PostCard key={p.id} post={p} onDelete={(id: number) => setPosts((x) => x.filter((y) => y.id !== id))} />)}
    </Shell>
  );
}
