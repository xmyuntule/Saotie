import { useState, useEffect } from 'react';
import { Card, CardBody, Chip, Tabs, Tab } from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import api from '../api/client';
import { timeAgo } from '../lib/format';
import { useCompose } from '../context/ComposeContext';

const CATS = ['全部', '公告', '功能', '活动', '精选', '教程'];
const CAT_COLOR: Record<string, string> = { 公告: 'danger', 功能: 'primary', 活动: 'warning', 精选: 'secondary', 教程: 'success', 动态: 'default' };

function buildTopicTag(title: string) {
  const clean = String(title || '').replace(/[#[\]\n]/g, '').trim();
  if (!clean) return '';
  const shortened = Array.from(clean).slice(0, 24).join('').trim();
  return shortened.length ? shortened : '';
}

function opinionPrefill(source: any, item: any) {
  const topicTag = buildTopicTag(item?.title);
  const lines = [
    topicTag ? `#${topicTag}#` : '',
    item?.title ? `话题：${item.title}` : '',
    source?.name ? `来源：${source.name}${item.hot ? ` · ${item.hot}` : ''}` : '',
    item.url ? `链接：${item.url}` : '',
    '',
    '我的观点：',
  ];
  return lines.filter((line, index) => index >= 4 || Boolean(line)).join('\n').slice(0, 1000);
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

// The lead item gets a magazine-style head treatment; the rest stay a compact list.
function FlashFeature({ f }: { f: any }) {
  const Wrap: any = f.url ? 'a' : 'div';
  return (
    <Wrap className="flash-feature" {...(f.url ? { href: f.url, target: '_blank', rel: 'noreferrer' } : {})}>
      <div className="flash-feature-top">
        <Chip size="sm" variant="flat" color={CAT_COLOR[f.category] || 'default'}>{f.category}</Chip>
        <span className="flash-feature-tag"><Icon name="megaphone" size={13} /> 头条</span>
        <span className="spacer" />
        <span className="flash-time">{timeAgo(f.createdAt)}</span>
      </div>
      <h2 className="flash-feature-title">
        {!!f.pinned && <Icon name="pin" size={14} style={{ color: 'var(--brand)', verticalAlign: '-2px', marginRight: 5 }} />}
        {f.title}
      </h2>
      {f.summary && <p className="flash-feature-sum">{f.summary}</p>}
      {f.url && <span className="flash-feature-cta">查看详情 <Icon name="back" size={13} style={{ transform: 'rotate(180deg)' }} /></span>}
    </Wrap>
  );
}

function FlashRow({ f }: { f: any }) {
  const Row: any = f.url ? 'a' : 'div';
  return (
    <Row className="flash-row" {...(f.url ? { href: f.url, target: '_blank', rel: 'noreferrer' } : {})}>
      <Chip size="sm" variant="flat" color={CAT_COLOR[f.category] || 'default'} className="shrink-0">{f.category}</Chip>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="flash-title">
          {!!f.pinned && <Icon name="pin" size={12} style={{ color: 'var(--brand)', verticalAlign: '-1px', marginRight: 4 }} />}
          {f.title}
        </div>
        {f.summary && <div className="flash-sum">{f.summary}</div>}
      </div>
      <span className="flash-time">{timeAgo(f.createdAt)}</span>
    </Row>
  );
}

const sk = (w: string | number, h: number, m = '') => <div className="skeleton" style={{ width: w, height: h, margin: m }} />;
function FlashSkeleton() {
  return (
    <>
      <div className="ui-card flash-feature" style={{ pointerEvents: 'none' }}>
        {sk(120, 22, '0 0 14px')}{sk('70%', 20, '0 0 10px')}{sk('90%', 13, '0 0 6px')}{sk('50%', 13)}
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flash-row" style={{ pointerEvents: 'none', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            {sk(48, 22)}<div className="grow">{sk('64%', 14, '0 0 7px')}{sk('40%', 12)}</div>{sk(40, 12)}
          </div>
        ))}
      </div>
    </>
  );
}

function FlashHotBoard() {
  const { openCompose } = useCompose();
  const [sources, setSources] = useState<any[]>([]);
  const [sourceKey, setSourceKey] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    api.get('/flash/hot/sources')
      .then(({ data }) => {
        if (!alive) return;
        const rows = data.sources || [];
        setSources(rows);
        setSourceKey((current) => current || rows[0]?.key || '');
      })
      .catch(() => alive && setSources([]));
    return () => { alive = false; };
  }, []);

  const loadHot = async (key: string, refresh = false) => {
    if (!key) return;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = refresh
        ? await api.post(`/flash/hot/${encodeURIComponent(key)}/refresh`)
        : await api.get(`/flash/hot/${encodeURIComponent(key)}`);
      setData(res.data);
    } catch {
      setData({ status: 'error', items: [] });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!sourceKey) return;
    setData(null);
    loadHot(sourceKey);
  }, [sourceKey]);

  if (!sources.length) return null;
  const source = sources.find((s) => s.key === sourceKey) || sources[0];
  const items = data?.items || [];

  return (
    <section className="flash-hot-board">
      <div className="flash-hot-head">
        <div>
          <h2><Icon name="fire" size={17} /> 热榜讨论</h2>
          <p>按来源查看当下热门，点“发表观点”会自动带入讨论标题。</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => loadHot(sourceKey, true)} disabled={refreshing || !sourceKey}>
          <Icon name="refresh" size={14} /> {refreshing ? '刷新中' : '刷新'}
        </button>
      </div>

      <div className="flash-hot-tabs">
        {sources.map((s) => (
          <button key={s.key} className={`flash-hot-tab${sourceKey === s.key ? ' active' : ''}`} onClick={() => setSourceKey(s.key)}>
            {s.name}
          </button>
        ))}
      </div>

      <div className="ui-card flash-hot-list">
        <div className="flash-hot-meta">
          <span>{source?.name || '热榜'} · {items.length || source?.limit || 20}条</span>
          <span>{formatHotUpdated(data?.updatedAt)}</span>
          {data?.cooldown && <span>刚刚刷新过，已使用缓存</span>}
          {data?.status === 'cache' && data?.error && <span>来源暂不可用，显示缓存</span>}
        </div>
        {loading ? (
          <div className="flash-hot-loading">
            {Array.from({ length: 6 }).map((_, i) => <div key={i}>{sk('68%', 14, '0 0 8px')}{sk('42%', 11)}</div>)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center text-default-400 py-8 text-small">{data?.error || '该来源暂时没有热榜数据'}</div>
        ) : (
          items.map((item: any) => (
            <div className="flash-hot-item" key={item.id || `${sourceKey}-${item.rank}`}>
              <span className={`flash-hot-rank${item.rank <= 3 ? ' hot' : ''}`}>{item.rank}</span>
              <div className="flash-hot-main">
                <a className="flash-hot-title" href={item.url || '#'} target="_blank" rel="noreferrer">{item.title}</a>
                {(item.summary || item.hot) && (
                  <div className="flash-hot-sub">
                    {item.hot && <span>{item.hot}</span>}
                    {item.summary && <span>{item.summary}</span>}
                  </div>
                )}
              </div>
              <button
                className="btn btn-outline btn-sm flash-hot-opinion"
                onClick={() => openCompose({ prefill: opinionPrefill(source, item), placeholder: '写下你对这条热榜的观点...' })}
              >
                发表观点
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export default function Flash() {
  const [cat, setCat] = useState('全部');
  const [list, setList] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    setList(null);
    const params = cat === '全部' ? {} : { category: cat };
    api.get('/flash', { params }).then(({ data }) => { if (alive) setList(data.flash); }).catch(() => alive && setList([]));
    return () => { alive = false; };
  }, [cat]);

  return (
    <Shell>
      <Card shadow="sm" radius="lg" className="mb-4 border border-default-200">
        <CardBody>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Icon name="megaphone" size={21} style={{ color: 'var(--brand)' }} /> 资讯快报
          </h1>
          <p className="text-default-500 text-small mt-1">社区动态、功能上新、热门话题与精选内容，一眼看全。</p>
        </CardBody>
      </Card>

      <FlashHotBoard />

      <div className="flash-manual-head">
        <h2><Icon name="bell" size={16} /> 站内快报</h2>
        <span>管理员精选与公告</span>
      </div>

      <Tabs aria-label="快报分类" color="primary" variant="solid" radius="lg" fullWidth
        selectedKey={cat} onSelectionChange={(k: any) => setCat(k)} className="mb-3">
        {CATS.map((c) => <Tab key={c} title={c} />)}
      </Tabs>

      {list === null ? (
        <FlashSkeleton />
      ) : list.length === 0 ? (
        <Card shadow="sm" radius="lg"><CardBody className="text-center text-default-400 py-8 text-small">暂无快报</CardBody></Card>
      ) : (
        <>
          <FlashFeature f={list[0]} />
          {list.length > 1 && (
            <Card shadow="sm" radius="lg" className="border border-default-200 overflow-hidden">
              <CardBody className="p-0">
                {list.slice(1).map((f: any) => <FlashRow key={f.id} f={f} />)}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </Shell>
  );
}
