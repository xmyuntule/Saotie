import { useState, useEffect, useRef, useCallback } from 'react';

interface Page<T> { items: T[]; hasMore: boolean }

/**
 * 通用无限滚动：给定一个按 offset 取页的函数，自动管理列表 / hasMore / loading，
 * 并用底部哨兵 + IntersectionObserver 在接近底部时续拉下一页。
 * 当 deps 变化（如切换分类 / 排序）时自动重置并重新拉第一页。
 *
 * 用法：
 *   const { items, loading, hasMore, sentinelRef, setItems, reload } =
 *     useInfiniteScroll<Article>((offset, limit) =>
 *       api.get('/articles', { params: { category, sort, offset, limit } })
 *         .then(({ data }) => ({ items: data.articles, hasMore: data.hasMore })),
 *       [category, sort], 12);
 */
export default function useInfiniteScroll<T>(
  fetchPage: (offset: number, limit: number) => Promise<Page<T>>,
  deps: any[],
  limit = 12,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const busyRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // 重置 + 拉第一页（deps 变化时）
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setItems([]);
    offsetRef.current = 0;
    busyRef.current = false;
    fetchPage(0, limit)
      .then(({ items, hasMore }) => {
        if (!alive) return;
        setItems(items);
        setHasMore(hasMore);
        // advance by the page window, NOT items.length — server may post-filter
        // (e.g. drop featured / locked rows), so item count can be < limit while
        // the next offset must still skip the full window to avoid overlap.
        offsetRef.current = limit;
      })
      .catch(() => { if (alive) { setItems([]); setHasMore(false); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !hasMore) return;
    busyRef.current = true;
    try {
      const { items: more, hasMore: hm } = await fetchPage(offsetRef.current, limit);
      setItems((prev) => [...prev, ...more]);
      offsetRef.current += limit;
      setHasMore(hm);
    } catch {
      /* 续拉失败：保留已加载内容，下次进入视口再试 */
    } finally {
      busyRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, limit, ...deps]);

  // 底部哨兵进入视口（提前 600px）→ 续拉
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  return { items, loading, hasMore, sentinelRef, setItems };
}
