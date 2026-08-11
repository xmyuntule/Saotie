import { useState, useEffect } from 'react';
import { Card, CardBody, Chip } from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import api from '../api/client';
import { timeAgo } from '../lib/format';
import { useCompose } from '../context/ComposeContext';

const CAT_COLOR: Record<string, string> = { 公告: 'danger', 功能: 'primary', 活动: 'warning', 精选: 'secondary', 教程: 'success', 动态: 'default' };
const SITE_SOURCE = {
  key: 'site',
  name: '站内',
  kind: 'site',
  home: '',
  description: '管理员发布的站内快报',
  limit: 50,
  refreshMinutes: 0,
  display: 'list',
  enabled: true,
};

function compactTitle(title: string, max = 44) {
  const clean = String(title || '').replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  return `${chars.slice(0, max).join('')}...`;
}

function opinionPrefill(_source: any, item: any) {
  const title = compactTitle(item?.title || '这条内容');
  return `看到「${title}」，我的看法是：`;
}

function formatHeat(raw: any) {
  if (raw == null || raw === '') return '';
  const text = String(raw).replace(/,/g, '').replace(/\s+/g, '').trim();
  const matched = text.match(/([\d.]+)/);
  if (!matched) return text.includes('热度') ? text : `${text}热度`;
  const base = Number(matched[1]);
  if (!Number.isFinite(base) || base <= 0) return '';
  const value = text.includes('亿') ? base * 100000000 : text.includes('万') ? base * 10000 : base;
  if (value >= 100000000) return `${Number((value / 100000000).toFixed(1)).toString()}亿热度`;
  if (value >= 10000) return `${Math.round(value / 10000)}万热度`;
  return `${Math.round(value)}热度`;
}

function itemMeta(sourceKey: string, source: any, item: any) {
  if (sourceKey === 'site') {
    return [
      { text: '站内快报' },
      item.pinned ? { text: '置顶', tone: 'hot' } : null,
      item.createdAt ? { text: timeAgo(item.createdAt) } : null,
    ].filter(Boolean);
  }
  const heat = formatHeat(item.hot);
  return [
    { text: `${source?.name || '热榜'}` },
    { text: `第 ${item.rank} 位`, tone: 'rank' },
    heat ? { text: heat, tone: 'hot' } : null,
  ].filter(Boolean);
}

function formatHotUpdated(updatedAt?: number) {
  const ms = Number(updatedAt) || 0;
  if (!ms) return '';
  const diff = Math.max(0, Date.now() - ms);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return `${minutes}分钟前更新`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前更新`;
  const days = Math.floor(hours / 24);
  return `${days}天前更新`;
}

function siteUpdatedAt(rows: any[]) {
  const first = rows[0]?.createdAt;
  const ms = first ? new Date(first).getTime() : 0;
  return Number.isFinite(ms) ? ms : 0;
}

function asSiteItems(rows: any[]) {
  return rows.map((f, index) => ({
    id: `site-${f.id}`,
    rank: index + 1,
    title: f.title,
    summary: f.summary,
    category: f.category,
    url: f.url,
    pinned: f.pinned,
    createdAt: f.createdAt,
  }));
}

const sk = (w: string | number, h: number, m = '') => <div className="skeleton" style={{ width: w, height: h, margin: m }} />;
function FlashSkeleton() {
  return (
    <div className="flash-hot-loading">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flash-hot-skeleton-row">
          {sk(42, 24)}
          <div className="grow">{sk(i % 2 ? '76%' : '62%', 14, '0 0 8px')}{sk(i % 3 ? '44%' : '58%', 11, '0 0 8px')}{sk('32%', 10)}</div>
          {sk(32, 32)}
        </div>
      ))}
    </div>
  );
}

function HotTitle({ item }: { item: any }) {
  const content = (
    <>
      {!!item.pinned && <Icon name="pin" size={13} style={{ color: 'var(--brand)', verticalAlign: '-2px', marginRight: 5 }} />}
      {item.title}
    </>
  );
  if (!item.url) return <span className="flash-hot-title">{content}</span>;
  return <a className="flash-hot-title" href={item.url} target="_blank" rel="noreferrer">{content}</a>;
}

function HotLeft({ sourceKey, item }: { sourceKey: string; item: any }) {
  if (sourceKey === 'site') {
    return (
      <span className="flash-hot-label">
        <Chip size="sm" variant="flat" color={CAT_COLOR[item.category] || 'default'}>{item.category || '快报'}</Chip>
      </span>
    );
  }
  return <span className={`flash-hot-rank${item.rank <= 3 ? ' hot' : ''}`}>{item.rank}</span>;
}

function FlashHotBoard() {
  const { openCompose } = useCompose();
  const [sources, setSources] = useState<any[]>([SITE_SOURCE]);
  const [sourceKey, setSourceKey] = useState('site');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/flash/hot/sources')
      .then(({ data }) => {
        if (!alive) return;
        setSources([SITE_SOURCE, ...(data.sources || [])]);
      })
      .catch(() => alive && setSources([SITE_SOURCE]));
    return () => { alive = false; };
  }, []);

  const loadSource = async (key: string, refresh = false) => {
    if (!key) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      if (key === 'site') {
        const res = await api.get('/flash', { params: { limit: 50 } });
        const rows = res.data.flash || [];
        setData({
          status: 'success',
          source: SITE_SOURCE,
          updatedAt: siteUpdatedAt(rows),
          items: asSiteItems(rows),
          error: '',
          cooldown: false,
        });
      } else {
        const res = refresh
          ? await api.post(`/flash/hot/${encodeURIComponent(key)}/refresh`)
          : await api.get(`/flash/hot/${encodeURIComponent(key)}`);
        setData(res.data);
      }
    } catch (err: any) {
      setData({ status: 'error', source: sources.find((s) => s.key === key), items: [], error: err?.message || '加载失败' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setData(null);
    loadSource(sourceKey);
  }, [sourceKey]);

  const source = sources.find((s) => s.key === sourceKey) || SITE_SOURCE;
  const items = data?.items || [];
  const isSite = sourceKey === 'site';

  return (
    <section className="flash-hot-board">
      <div className="flash-hot-head">
        <div>
          <h2><Icon name="fire" size={17} /> 热榜讨论</h2>
          <p>切换来源查看站内快报与外部热榜，排名越靠前代表当前热度越高。</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => loadSource(sourceKey, true)} disabled={refreshing || !sourceKey}>
          <Icon name="refresh" size={14} /> {refreshing ? '刷新中' : '刷新'}
        </button>
      </div>

      <div className="flash-hot-tabs" role="tablist" aria-label="快报来源">
        {sources.map((s) => (
          <button key={s.key} className={`flash-hot-tab${sourceKey === s.key ? ' active' : ''}`} onClick={() => setSourceKey(s.key)} role="tab" aria-selected={sourceKey === s.key}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="ui-card flash-hot-list">
        <div className="flash-hot-meta">
          <span>{source?.name || '热榜'} · {items.length || source?.limit || 20}条</span>
          <span>{formatHotUpdated(data?.updatedAt)}</span>
          {isSite ? <span>左侧显示快报类型</span> : <span>按来源热度排序</span>}
          {data?.cooldown && <span>刚刚刷新过，已使用缓存</span>}
          {data?.status === 'cache' && data?.error && <span>来源暂不可用，显示缓存</span>}
        </div>
        {loading ? (
          <FlashSkeleton />
        ) : items.length === 0 ? (
          <div className="text-center text-default-400 py-8 text-small">{data?.error || '该来源暂时没有数据'}</div>
        ) : (
          items.map((item: any) => (
            <div className="flash-hot-item" key={item.id || `${sourceKey}-${item.rank}`}>
              <HotLeft sourceKey={sourceKey} item={item} />
              <div className="flash-hot-main">
                <HotTitle item={item} />
                {item.summary && <div className="flash-hot-desc">{item.summary}</div>}
                <div className="flash-hot-foot">
                  {itemMeta(sourceKey, source, item).map((meta: any) => <span key={meta.text} className={meta.tone ? `is-${meta.tone}` : ''}>{meta.text}</span>)}
                </div>
              </div>
              <button
                className="flash-hot-opinion"
                title="发表观点"
                aria-label={`发表关于「${item.title || '这条内容'}」的观点`}
                onClick={() => openCompose({ prefill: opinionPrefill(source, item), placeholder: '写下你对这条内容的观点...' })}
              >
                <Icon name="edit" size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function Flash() {
  return (
    <Shell>
      <Card shadow="sm" radius="lg" className="mb-4 border border-default-200">
        <CardBody>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Icon name="megaphone" size={21} style={{ color: 'var(--brand)' }} /> 资讯快报
          </h1>
          <p className="text-default-500 text-small mt-1">站内快报、实时热榜与热门讨论入口，一眼看全。</p>
        </CardBody>
      </Card>

      <FlashHotBoard />
    </Shell>
  );
}
