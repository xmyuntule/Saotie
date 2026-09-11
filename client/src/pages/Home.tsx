import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Shell from '../components/Shell';
import Composer from '../components/Composer';
import SiteNotice from '../components/SiteNotice';
import PostCard from '../components/PostCard';
import { PostSkeleton, Empty, ErrorState, ListEnd } from '../components/States';
import { WhoToFollow } from '../components/Widgets';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';

const FILTERS = [
  { key: 'recommend', label: '推荐' },
  { key: 'all', label: '最新' },
  { key: 'following', label: '关注', auth: true },
  { key: 'video', label: '视频' },
  { key: 'samecity', label: '同城', auth: true },
];
const PAGE = 12;

export default function Home() {
  const { user, setAuthOpen } = useAuth();
  const loc = useLocation();
  const [filter, setFilter] = useState('recommend');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const composerRef = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const requestVersion = useRef(0);
  const recommendSeedRef = useRef(Math.floor(Math.random() * 2147483647));

  const feedParams = (offset: number) => ({
    filter,
    limit: PAGE,
    offset,
    ...(filter === 'recommend' ? { seed: recommendSeedRef.current } : {}),
  });

  // (re)load from the top when the filter or viewer changes
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    requestVersion.current++;
    busyRef.current = false;
    setLoadingMore(false); setHasMore(false); setError(false); setMoreError(false);
    setLoading(true); setPosts([]); offsetRef.current = 0;
    if (filter === 'recommend') recommendSeedRef.current = Math.floor(Math.random() * 2147483647);
    api.get('/posts', { params: feedParams(0), signal: controller.signal })
      .then(({ data }) => { if (!alive) return; setPosts(data.posts); setHasMore(data.hasMore); offsetRef.current = data.posts.length; })
      .catch(() => { if (alive) setError(true); })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; requestVersion.current++; controller.abort(); };
  }, [filter, user?.id, attempt]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    const version = requestVersion.current;
    busyRef.current = true; setLoadingMore(true);
    setMoreError(false);
    try {
      const { data } = await api.get('/posts', { params: feedParams(offsetRef.current) });
      if (version !== requestVersion.current) return;
      offsetRef.current += data.posts.length;
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        const fresh = data.posts.filter((p: any) => !seen.has(p.id));
        return [...prev, ...fresh];
      });
      setHasMore(data.hasMore);
    } catch {
      if (version === requestVersion.current) setMoreError(true);
    } finally {
      if (version === requestVersion.current) { busyRef.current = false; setLoadingMore(false); }
    }
  }, [filter, hasMore]);

  // infinite scroll via IntersectionObserver on the bottom sentinel
  useEffect(() => {
    const el = sentinel.current;
    if (!el || loading || moreError) return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, loading, moreError]);

  useEffect(() => {
    if (loc.state?.compose) composerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [loc.state]);

  const onFilter = (f: any) => {
    if (f.auth && !user) return setAuthOpen(true);
    setFilter(f.key);
  };
  const onPosted = (post: any) => setPosts((p) => [post, ...p]);
  const onDelete = (id: number) => setPosts((p) => p.filter((x) => x.id !== id));

  return (
    <Shell>
      <div ref={composerRef}><Composer onPosted={onPosted} /></div>

      <div className="ui-card feed-tabs" role="group" aria-label="动态筛选">
        {FILTERS.map((f) => (
          <button key={f.key} aria-pressed={filter === f.key} className={`feed-tab${filter === f.key ? ' active' : ''}`} onClick={() => onFilter(f)}>
            {f.label}
          </button>
        ))}
      </div>

      <SiteNotice />

      {loading ? (
        <div className="card-stack" role="status" aria-label="动态加载中"><span className="sr-only">动态加载中</span>{[1, 2, 3].map((i) => <PostSkeleton key={i} />)}</div>
      ) : error ? <ErrorState text="动态加载失败，请稍后重试" onRetry={() => setAttempt((v) => v + 1)} /> : posts.length === 0 ? (
        <>
          <div className="ui-card"><Empty icon={filter === 'following' ? 'eye' : 'compass'} text={
            filter === 'following' ? '关注更多有趣的人，这里会出现他们的动态' :
            filter === 'samecity' ? '完善你的城市，发现同城新鲜事' :
            filter === 'video' ? '还没有视频动态' : '还没有动态，来发布第一条吧'
          } /></div>
          {filter === 'following' && <WhoToFollow />}
        </>
      ) : (
        <>
          {posts.map((p) => <PostCard key={p.id} post={p} onDelete={onDelete} />)}
          {hasMore && !moreError && <div ref={sentinel} className="scroll-sentinel" aria-hidden="true" />}
          {loadingMore && <div role="status" aria-label="正在加载更多动态"><span className="sr-only">正在加载更多动态</span><PostSkeleton /></div>}
          {moreError && <ErrorState text="后续动态加载失败，已加载的内容仍可浏览" onRetry={() => void loadMore()} />}
          {!hasMore && <ListEnd />}
        </>
      )}
    </Shell>
  );
}
