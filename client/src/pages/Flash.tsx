import { useState, useEffect } from 'react';
import { Card, CardBody, Chip, Tabs, Tab } from '../components/heroui';
import Shell from '../components/Shell';
import Icon from '../components/Icon';
import api from '../api/client';
import { timeAgo } from '../lib/format';

const CATS = ['全部', '公告', '功能', '活动', '精选', '教程'];
const CAT_COLOR: Record<string, string> = { 公告: 'danger', 功能: 'primary', 活动: 'warning', 精选: 'secondary', 教程: 'success', 动态: 'default' };

// The lead item gets a magazine-style 头条 treatment; the rest stay a compact list.
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
          <p className="text-default-500 text-small mt-1">社区动态、功能上新、活动与精选，一眼看全。</p>
        </CardBody>
      </Card>

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
