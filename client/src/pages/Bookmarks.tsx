import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import PostCard from '../components/PostCard';
import { Loading, Empty, PostSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useLayout } from '../context/SiteContext';
import api from '../api/client';

export default function Bookmarks() {
  const { user, loading: authLoading, setAuthOpen } = useAuth();
  const nav = useNavigate();
  const layout = useLayout('bookmarks', 'default');
  const [posts, setPosts] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setAuthOpen(true); setLoading(false); return; }
    api.get('/users/me/bookmarks', { params: { limit: 20 } }).then(({ data }) => { setPosts(data.posts); setHasMore(!!data.hasMore); }).finally(() => setLoading(false));
  }, [authLoading, user]);

  const loadMore = () => {
    setMoreBusy(true);
    api.get('/users/me/bookmarks', { params: { limit: 20, offset: posts.length } })
      .then(({ data }) => { setPosts((x) => [...x, ...data.posts]); setHasMore(!!data.hasMore); })
      .catch(() => undefined)
      .finally(() => setMoreBusy(false));
  };

  if (authLoading) return <Shell right={false}><Loading /></Shell>;
  if (!user) return <Shell right={false}><div className="ui-card"><Empty icon="🔒" text="登录后查看收藏" /></div></Shell>;

  return (
    <Shell layout={layout}>
      <div className="ui-card page-title"><Icon name="bookmark" size={19} style={{ color: 'var(--gold)' }} /> 我的收藏</div>
      {loading ? <><PostSkeleton /><PostSkeleton /><PostSkeleton /></> : posts.length === 0 ? <div className="ui-card"><Empty icon="🔖" text="还没有收藏任何动态">
        <button className="btn btn-primary btn-sm" onClick={() => nav('/')}>去首页逛逛</button>
      </Empty></div>
        : <>
          {posts.map((p: any) => <PostCard key={p.id} post={p} onDelete={(id: number) => setPosts((x) => x.filter((y) => y.id !== id))} />)}
          {hasMore && <div className="row" style={{ justifyContent: 'center', padding: '6px 0 2px' }}>
            <button className="btn btn-ghost btn-sm" disabled={moreBusy} onClick={loadMore}>{moreBusy ? '加载中…' : '加载更多'}</button>
          </div>}
        </>}
    </Shell>
  );
}
