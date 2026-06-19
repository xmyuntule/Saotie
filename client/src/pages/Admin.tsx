import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Badges } from '../components/Identity';
import { Loading, Empty, RowSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';
import { fmtNum, timeAgo } from '../lib/format';

const TABS = [
  { k: 'overview', l: '概览', icon: 'trend' },
  { k: 'users', l: '用户', icon: 'user' },
  { k: 'boards', l: '板块', icon: 'forum' },
  { k: 'topics', l: '话题', icon: 'fire' },
  { k: 'reports', l: '举报', icon: 'flag' },
  { k: 'notices', l: '公告', icon: 'bell' },
  { k: 'mall', l: '商城', icon: 'shop' },
  { k: 'security', l: '安全', icon: 'shield' },
  { k: 'appearance', l: '外观', icon: 'image' },
  { k: 'audit', l: '日志', icon: 'book' },
];

const NOTICE_LEVELS = [
  { k: 'info', l: '信息' }, { k: 'success', l: '成功' }, { k: 'warning', l: '提醒' }, { k: 'event', l: '活动' },
];

const AUDIT_ICON: Record<string, string> = {
  'user.update': 'user', 'content.delete': 'trash', 'report.resolve': 'flag',
  'board.create': 'forum', 'board.update': 'forum', 'board.delete': 'trash', 'board.moderator': 'shield',
  'topic.create': 'fire', 'topic.delete': 'trash', 'product.create': 'shop', 'product.delete': 'trash',
  'notice.create': 'bell', 'notice.update': 'bell', 'notice.delete': 'trash',
  'config.update': 'shield',
};

function AuditLog() {
  const [logs, setLogs] = useState<any[] | null>(null);
  useEffect(() => { api.get('/admin/audit').then(({ data }) => setLogs(data.logs)).catch(() => setLogs([])); }, []);
  if (logs === null) return <RowSkeleton rows={8} />;
  if (!logs.length) return <div className="ui-card"><Empty icon="📋" text="还没有管理操作记录" /></div>;
  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      {logs.map((l, i) => (
        <div key={l.id}>{i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
            <span className={`audit-ico${l.action.endsWith('.delete') ? ' danger' : ''}`}><Icon name={AUDIT_ICON[l.action] || 'shield'} size={16} /></span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5 }}><b>{l.admin?.nickname || '管理员'}</b><span style={{ color: 'var(--ink-3)' }}> {l.actionLabel}</span></div>
              {l.detail && <div className="faint" style={{ fontSize: 12.5, marginTop: 2, wordBreak: 'break-word' }}>{l.detail}</div>}
            </div>
            <span className="faint nowrap" style={{ fontSize: 11.5, flex: 'none' }}>{timeAgo(l.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/admin/overview').then(({ data }) => setData(data)); }, []);
  if (!data) return <Loading />;
  const S = data.stats;
  const cards = [
    ['用户', S.users, 'user', 'var(--brand)'], ['动态', S.posts, 'home', 'var(--good)'],
    ['帖子', S.threads, 'forum', 'var(--coral)'], ['评论', S.comments, 'comment', 'var(--verify)'],
    ['话题', S.topics, 'fire', 'var(--gold)'], ['板块', S.boards, 'forum', 'var(--ink-3)'],
    ['VIP 会员', S.vip, 'coin', 'var(--gold-deep)'], ['待处理举报', S.reports, 'flag', 'var(--like)'],
  ];
  return (
    <>
      <div className="stat-grid">
        {cards.map(([k, v, ic, c]) => (
          <div className="ui-card" key={k} style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 13 }}>{k}</span>
              <Icon name={ic} size={16} style={{ color: c }} />
            </div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{fmtNum(v)}</div>
          </div>
        ))}
      </div>
      {data.activity?.length > 0 && (() => {
        const max = Math.max(1, ...data.activity.map((d: any) => Math.max(d.posts, d.comments)));
        return (
          <div className="ui-card" style={{ marginTop: 'var(--gap)', padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15 }}>近 7 天活跃度</h2>
              <div className="row gap-12" style={{ fontSize: 12 }}>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--brand)' }} /> 动态</span>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--good)' }} /> 评论</span>
              </div>
            </div>
            <div className="chart">
              {data.activity.map((d: any) => (
                <div className="chart-col" key={d.date} title={`${d.date} · 动态${d.posts} · 评论${d.comments}`}>
                  <div className="chart-bars">
                    <div className="chart-bar" style={{ height: `${(d.posts / max) * 100}%`, background: 'var(--brand)' }} />
                    <div className="chart-bar" style={{ height: `${(d.comments / max) * 100}%`, background: 'var(--good)' }} />
                  </div>
                  <div className="chart-label">{d.date.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="ui-card" style={{ marginTop: 'var(--gap)', overflow: 'hidden' }}>
        <div className="section-head" style={{ paddingBottom: 12 }}><h2 style={{ fontSize: 15 }}>最新注册</h2></div>
        {data.recentUsers.map((u: any, i: number) => (
          <div key={u.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 18px' }}>
              <Avatar user={u} size={38} showV />
              <div className="grow"><Link to={`/u/${u.username}`} className="uname">{u.nickname}</Link> <Badges user={u} /></div>
              <span className="faint" style={{ fontSize: 12 }}>{timeAgo(u.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Users() {
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const load = (query = '') => api.get('/admin/users', { params: { q: query } }).then(({ data }) => setUsers(data.users));
  useEffect(() => { load(); }, []);

  const patch = async (u: any, body: any, label: any) => {
    try { const { data } = await api.put(`/admin/users/${u.id}`, body); setUsers((xs) => xs.map((x) => x.id === u.id ? { ...x, ...data.user } : x)); toast.ok(label); }
    catch (e: any) { toast.err(e.message); }
  };

  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      <div className="row gap-8" style={{ padding: 14 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load(q)}
          placeholder="搜索用户名/昵称…" style={{ flex: 1, height: 38, border: '1.5px solid var(--line-2)', borderRadius: 999, padding: '0 14px', outline: 'none', background: 'var(--surface)' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => load(q)}>搜索</button>
      </div>
      {users.map((u, i) => (
        <div key={u.id}>{i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 16px', flexWrap: 'wrap' }}>
            <Avatar user={u} size={40} showV />
            <div className="grow" style={{ minWidth: 140 }}>
              <Link to={`/u/${u.username}`} className="uname">{u.nickname}</Link> <Badges user={u} />
              <div className="faint" style={{ fontSize: 12 }}>@{u.username} · Lv.{u.level} · {fmtNum(u.points)}积分 {u.banned && <span style={{ color: 'var(--like)' }}>· 已封禁</span>}</div>
            </div>
            <div className="row gap-4" style={{ flexWrap: 'wrap' }}>
              <button className={`btn btn-sm ${u.verified ? 'btn-ghost' : 'btn-outline'}`} onClick={() => patch(u, { verified: !u.verified }, u.verified ? '已取消认证' : '已认证')}>V认证</button>
              <button className={`btn btn-sm ${u.vip ? 'btn-ghost' : 'btn-outline'}`} onClick={() => patch(u, { vip: !u.vip }, 'VIP 已更新')}>VIP</button>
              <button className={`btn btn-sm ${u.role === 'admin' ? 'btn-ghost' : 'btn-outline'}`} onClick={() => patch(u, { role: u.role === 'admin' ? 'user' : 'admin' }, '角色已更新')}>管理员</button>
              <button className="btn btn-sm btn-outline" style={{ color: u.banned ? 'var(--good)' : 'var(--like)', borderColor: 'currentColor' }} onClick={() => patch(u, { banned: !u.banned }, u.banned ? '已解封' : '已封禁')}>{u.banned ? '解封' : '封禁'}</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Boards() {
  const toast = useToast();
  const [boards, setBoards] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', icon: '📁', description: '' });
  const load = () => api.get('/forum/boards').then(({ data }) => setBoards(data.boards));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.slug) return toast.err('名称和 slug 必填');
    try { await api.post('/admin/boards', form); toast.ok('板块已创建'); setForm({ name: '', slug: '', icon: '📁', description: '' }); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const del = async (b: any) => { if (!confirm(`删除板块「${b.name}」及其所有帖子？`)) return; try { await api.delete(`/admin/boards/${b.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const addMod = async (b: any) => { const username = prompt('设为版主的用户名:'); if (!username) return; try { const { data } = await api.post(`/admin/boards/${b.id}/moderators`, { username }); toast.ok(data.added ? '已任命版主' : '已移除版主'); load(); } catch (e: any) { toast.err(e.message); } };

  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>新建板块</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} placeholder="图标" style={{ width: 60, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 10px', textAlign: 'center', background: 'var(--surface)' }} />
          <input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="板块名称" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <input value={form.slug} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} placeholder="slug (英文)" style={{ width: 130, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>创建</button>
        </div>
        <input value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="板块说明 (可选)" style={{ width: '100%', height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', marginTop: 8, background: 'var(--surface)' }} />
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {boards.map((b, i) => (
          <div key={b.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 22 }}>{b.icon}</span>
              <div className="grow"><b>{b.name}</b> <span className="faint" style={{ fontSize: 12 }}>/{b.slug} · {fmtNum(b.threadCount)}帖 · {b.moderators.length}版主</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => addMod(b)}>版主</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => del(b)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Topics() {
  const toast = useToast();
  const [topics, setTopics] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const load = () => api.get('/topics').then(({ data }) => setTopics(data.topics));
  useEffect(() => { load(); }, []);
  const create = async () => { if (!form.name) return toast.err('话题名必填'); try { await api.post('/admin/topics', form); toast.ok('话题已创建'); setForm({ name: '', description: '' }); load(); } catch (e: any) { toast.err(e.message); } };
  const del = async (t: any) => { if (!confirm(`删除话题 #${t.name}#?`)) return; try { await api.delete(`/admin/topics/${t.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="话题名" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <input value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="描述" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>创建话题</button>
        </div>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {topics.map((t, i) => (
          <div key={t.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px' }}>
              <div className="grow"><b>#{t.name}#</b> <span className="faint" style={{ fontSize: 12 }}>{fmtNum(t.post_count)}动态 · 热度{fmtNum(t.hot)}</span></div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => del(t)}>删除</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Reports() {
  const toast = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const load = () => api.get('/admin/reports').then(({ data }) => setReports(data.reports));
  useEffect(() => { load(); }, []);
  const resolve = async (r: any) => { try { await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('已处理'); load(); } catch (e: any) { toast.err(e.message); } };
  const delContent = async (r: any) => {
    if (!confirm('确定删除被举报的内容？此操作不可撤销')) return;
    try { await api.delete(`/admin/content/${r.targetType}/${r.targetId}`); await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('内容已删除并处理'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const TYPE: any = { post: '动态', thread: '帖子', comment: '评论', user: '用户' };
  const link = (r: any) => r.targetType === 'post' ? `/post/${r.targetId}` : r.targetType === 'thread' ? `/thread/${r.targetId}` : r.targetType === 'user' && r.target?.author ? `/u/${r.target.author.username}` : null;
  if (!reports.length) return <div className="ui-card"><Empty icon="✅" text="没有待处理的举报" /></div>;
  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      {reports.map((r, i) => (
        <div key={r.id}>{i > 0 && <div className="divider" />}
          <div style={{ padding: '14px 16px' }}>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <span className="ui-badge badge-elite">{TYPE[r.targetType] || r.targetType}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.reason || '(未填写原因)'}</span>
              <span className="spacer" />
              <span className="faint" style={{ fontSize: 12 }}>{timeAgo(r.createdAt)}</span>
            </div>
            {/* the reported content preview */}
            <div style={{ background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: '10px 12px', fontSize: 13 }}>
              {r.target?.exists ? (
                <>
                  {r.target.author && <span className="muted">{r.target.author.nickname}：</span>}
                  <span>{r.target.text}</span>
                </>
              ) : <span className="faint">内容已不存在</span>}
            </div>
            <div className="row gap-8" style={{ marginTop: 10 }}>
              <span className="faint" style={{ fontSize: 12 }}>举报人 {r.reporter?.nickname}</span>
              <span className="spacer" />
              {link(r) && <Link to={link(r)!} className="btn btn-ghost btn-sm">查看</Link>}
              {r.target?.exists && r.targetType !== 'user' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => delContent(r)}>删除内容</button>}
              <button className="btn btn-outline btn-sm" onClick={() => resolve(r)}>忽略</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Notices() {
  const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ title: '', body: '', level: 'info', link: '', linkLabel: '', pinned: false });
  const load = () => api.get('/notices/all').then(({ data }) => setList(data.notices)).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.title.trim()) return toast.err('公告标题必填');
    try { await api.post('/notices', form); toast.ok('公告已发布'); setForm({ title: '', body: '', level: 'info', link: '', linkLabel: '', pinned: false }); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const patch = async (n: any, p: any) => { try { await api.put(`/notices/${n.id}`, p); load(); } catch (e: any) { toast.err(e.message); } };
  const del = async (n: any) => { if (!confirm(`删除公告「${n.title}」？`)) return; try { await api.delete(`/notices/${n.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const inp: CSSProperties = { height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)', fontSize: 14, color: 'var(--ink)' };
  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div className="col gap-8">
          <input value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="公告标题（必填）" style={{ ...inp, width: '100%' }} />
          <input value={form.body} onChange={(e) => setForm((f: any) => ({ ...f, body: e.target.value }))} placeholder="补充说明（选填）" style={{ ...inp, width: '100%' }} />
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <select value={form.level} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))} style={{ ...inp, minWidth: 110 }}>
              {NOTICE_LEVELS.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
            </select>
            <input value={form.link} onChange={(e) => setForm((f: any) => ({ ...f, link: e.target.value }))} placeholder="跳转链接（选填，如 /events）" style={{ ...inp, flex: 1, minWidth: 150 }} />
            <input value={form.linkLabel} onChange={(e) => setForm((f: any) => ({ ...f, linkLabel: e.target.value }))} placeholder="按钮文字" style={{ ...inp, width: 110 }} />
          </div>
          <div className="row gap-12" style={{ justifyContent: 'space-between' }}>
            <label className="row gap-6" style={{ fontSize: 13, cursor: 'pointer', color: 'var(--ink-2)' }}>
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm((f: any) => ({ ...f, pinned: e.target.checked }))} /> 置顶展示
            </label>
            <button className="btn btn-primary" onClick={create}>发布公告</button>
          </div>
        </div>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {list.length === 0 ? <Empty icon="📋" text="还没有公告，发布第一条吧" /> : list.map((n, i) => (
          <div key={n.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px', alignItems: 'flex-start' }}>
              <span className={`ui-badge sn-badge sn-badge-${n.level}`}>{(NOTICE_LEVELS.find((l) => l.k === n.level) || { l: n.level }).l}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{n.title} {n.pinned ? <Icon name="pin" size={12} style={{ color: 'var(--brand)', verticalAlign: '-1px' }} /> : null}</div>
                {n.body && <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>{n.body}</div>}
                <div className="faint" style={{ fontSize: 11.5, marginTop: 4 }}>{timeAgo(n.createdAt)} · {n.active ? '展示中' : '已下线'}</div>
              </div>
              <div className="row gap-6" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => patch(n, { active: !n.active })}>{n.active ? '下线' : '上线'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => patch(n, { pinned: !n.pinned })}>{n.pinned ? '取消置顶' : '置顶'}</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => del(n)}>删除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Products() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', icon: '🎁', category: 'item', price: 100, description: '', payload: '' });
  const load = () => api.get('/mall/products').then(({ data }) => setProducts(data.products));
  useEffect(() => { load(); }, []);
  const create = async () => { if (!form.name || !form.price) return toast.err('名称和价格必填'); try { await api.post('/admin/products', form); toast.ok('商品已上架'); setForm({ name: '', icon: '🎁', category: 'item', price: 100, description: '', payload: '' }); load(); } catch (e: any) { toast.err(e.message); } };
  const del = async (p: any) => { if (!confirm(`下架「${p.name}」?`)) return; try { await api.delete(`/admin/products/${p.id}`); toast.ok('已下架'); load(); } catch (e: any) { toast.err(e.message); } };
  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>上架商品</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} style={{ width: 56, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, textAlign: 'center', background: 'var(--surface)' }} />
          <input value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="商品名" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <select value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))} style={{ height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 10px', background: 'var(--surface)' }}>
            <option value="title">头衔</option><option value="frame">头像框</option><option value="item">道具</option><option value="physical">实物</option>
          </select>
          <input type="number" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))} placeholder="积分" style={{ width: 100, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>上架</button>
        </div>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {products.map((p, i) => (
          <div key={p.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <div className="grow"><b>{p.name}</b> <span className="faint" style={{ fontSize: 12 }}>{p.price}积分 · 已售{p.sold}</span></div>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => del(p)}>下架</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`ui-toggle${on ? ' on' : ''}`} onClick={() => onChange(!on)}>
      <span className="ui-toggle-dot" />
    </button>
  );
}

const PERM_ACTIONS: [string, string][] = [
  ['comment', '评论'], ['dm', '私信'], ['upload', '上传图片 / 视频'], ['post', '发布动态'], ['thread', '发帖'],
];
const SEC_GROUPS: any[] = [
  { title: '发帖 / 私信频率限制', desc: '防止刷屏与骚扰；管理员不受限制。', toggle: 'rate_limit_enabled', nums: [
    ['rate_post_per_min', '每分钟发帖上限', '条'], ['rate_post_per_hour', '每小时发帖上限', '条'],
    ['rate_thread_per_min', '每分钟发帖子上限', '个'], ['rate_dm_per_min', '每分钟私信上限', '条'],
  ] },
  { title: '防批量注册', desc: '限制同一 IP 的注册行为，拦截批量刷号。', toggle: 'anti_bulk_reg_enabled', nums: [
    ['reg_ip_max_per_day', '每个 IP 每日注册上限', '个'], ['reg_min_interval_sec', '两次注册最小间隔', '秒'],
  ] },
  { title: '邮箱验证注册', desc: '需先配置邮件服务（SMTP）后再开启，否则验证码无法送达。', toggles: [
    ['email_verify_enabled', '启用邮箱验证码功能'], ['require_email_verify', '注册时强制邮箱验证'],
  ] },
];

function Security() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const isOn = (k: string) => cfg?.[k] === '1';
  const save = async () => {
    setSaving(true);
    try { await api.put('/admin/config', { config: cfg }); toast.ok('安全设置已保存'); }
    catch (e: any) { toast.err(e.message); }
    finally { setSaving(false); }
  };
  if (cfg === null) return <RowSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      {SEC_GROUPS.map((g) => (
        <div className="ui-card" style={{ padding: 18 }} key={g.title}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{g.title}</div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>{g.desc}</div>
            </div>
            {g.toggle && <Toggle on={isOn(g.toggle)} onChange={(v) => setK(g.toggle, v ? '1' : '0')} />}
          </div>
          {g.nums && (!g.toggle || isOn(g.toggle)) && (
            <div className="sec-grid">
              {g.nums.map(([k, label, unit]: any) => (
                <label className="sec-field" key={k}>
                  <span className="sec-label">{label}</span>
                  <span className="sec-num">
                    <input type="number" value={cfg[k] ?? ''} min={0} onChange={(e) => setK(k, e.target.value)} />
                    <i>{unit}</i>
                  </span>
                </label>
              ))}
            </div>
          )}
          {g.toggles && (
            <div className="sec-toggles">
              {g.toggles.map(([k, label]: any) => (
                <div className="row" style={{ justifyContent: 'space-between', gap: 12 }} key={k}>
                  <span style={{ fontSize: 13.5 }}>{label}</span>
                  <Toggle on={isOn(k)} onChange={(v) => setK(k, v ? '1' : '0')} />
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>接口权限门控</div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>按用户「等级 / VIP」限制各操作（如评论需 VIP、私信需 Lv.2…）。最低等级填 0 表示不限制；管理员不受限。</div>
          </div>
          <Toggle on={isOn('perm_enabled')} onChange={(v) => setK('perm_enabled', v ? '1' : '0')} />
        </div>
        {isOn('perm_enabled') && (
          <div className="perm-table">
            <div className="perm-row perm-head"><span>操作</span><span>最低等级</span><span>需要 VIP</span></div>
            {PERM_ACTIONS.map(([k, label]) => (
              <div className="perm-row" key={k}>
                <span className="perm-label">{label}</span>
                <span className="sec-num"><input type="number" min={0} max={60} value={cfg[`perm_${k}_min_level`] ?? '0'} onChange={(e) => setK(`perm_${k}_min_level`, e.target.value)} /><i>级</i></span>
                <Toggle on={isOn(`perm_${k}_require_vip`)} onChange={(v) => setK(`perm_${k}_require_vip`, v ? '1' : '0')} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存设置'}</button>
      </div>
    </div>
  );
}

// 站点外观自定义 (W)：站名 / 副标题 / Logo / 全站自定义 CSS。类 WP 的二开能力，升级不覆盖。
function Appearance() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      await api.put('/admin/config', { config: cfg });
      toast.ok('站点外观已保存，刷新页面查看效果');
    } catch (e: any) { toast.err(e.message); }
    finally { setSaving(false); }
  };
  if (cfg === null) return <RowSkeleton rows={5} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>站点品牌</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>显示在导航栏、浏览器标题与登录页。Logo 留空则用内置「H」标记。</div>
        <div className="sec-grid" style={{ marginTop: 14 }}>
          <label className="sec-field">
            <span className="sec-label">站点名称</span>
            <input className="inp" maxLength={40} value={cfg.site_name ?? ''} onChange={(e) => setK('site_name', e.target.value)} placeholder="HahaSNS" />
          </label>
          <label className="sec-field">
            <span className="sec-label">副标题 / Slogan</span>
            <input className="inp" maxLength={60} value={cfg.site_slogan ?? ''} onChange={(e) => setK('site_slogan', e.target.value)} placeholder="轻社交社区" />
          </label>
        </div>
        <label className="sec-field" style={{ marginTop: 12 }}>
          <span className="sec-label">Logo 图片 URL</span>
          <div className="row gap-8" style={{ alignItems: 'center' }}>
            {cfg.site_logo
              ? <img src={cfg.site_logo} alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              : <span className="admin-logo" style={{ width: 36, height: 36, flexShrink: 0 }}><Icon name="image" size={18} /></span>}
            <input className="inp" maxLength={500} value={cfg.site_logo ?? ''} onChange={(e) => setK('site_logo', e.target.value)} placeholder="https://… （留空用内置标记）" style={{ flex: 1 }} />
          </div>
        </label>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>自定义 CSS</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>全站注入到页面 <code>&lt;head&gt;</code>，可覆盖任意样式做二次开发装饰；系统升级不会重置此处内容。请谨慎使用，错误的 CSS 可能影响页面显示。</div>
        <textarea className="inp" value={cfg.site_custom_css ?? ''} maxLength={20000} spellCheck={false}
          onChange={(e) => setK('site_custom_css', e.target.value)}
          placeholder={'/* 例如：把主按钮换成圆角胶囊 */\n.btn-primary { border-radius: 999px; }'}
          style={{ marginTop: 12, minHeight: 220, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存外观'}</button>
      </div>
    </div>
  );
}

function AdminLogin() {
  const { login } = useAuth();
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: any) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const usr = await login(u.trim(), p);
      if (usr.role !== 'admin') setErr('该账号不是管理员，无法进入后台');
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="admin-center">
      <form className="admin-login-card" onSubmit={submit}>
        <span className="admin-logo lg"><Icon name="shield" size={26} /></span>
        <div style={{ fontWeight: 800, fontSize: 19, marginTop: 12 }}>HahaSNS 管理后台</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>请使用管理员账号登录</div>
        {err && <div className="form-err">{err}</div>}
        <input className="inp" placeholder="管理员用户名" value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        <input className="inp" type="password" placeholder="密码" value={p} onChange={(e) => setP(e.target.value)} style={{ marginTop: 10 }} />
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} style={{ marginTop: 14, fontWeight: 700 }}>
          {busy ? '登录中…' : '登 录'}
        </button>
        <Link to="/" className="faint" style={{ fontSize: 12.5, marginTop: 16, display: 'inline-block' }}>← 返回前台</Link>
      </form>
    </div>
  );
}

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState('overview');

  if (loading) return <div className="admin-center"><Loading /></div>;
  if (!user) return <AdminLogin />;
  if (user.role !== 'admin')
    return (
      <div className="admin-center">
        <div className="ui-card" style={{ padding: 40, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 42 }}>🛡️</div>
          <div style={{ fontWeight: 800, fontSize: 18, marginTop: 10 }}>需要管理员权限</div>
          <div className="muted" style={{ fontSize: 13.5, marginTop: 4 }}>该后台仅对管理员开放</div>
          <Link to="/" className="btn btn-primary btn-lg" style={{ marginTop: 18 }}>返回前台首页</Link>
        </div>
      </div>
    );

  const current = TABS.find((t) => t.k === tab) || TABS[0];
  return (
    <div className="admin-shell">
      <aside className="admin-side">
        <div className="admin-brand">
          <span className="admin-logo"><Icon name="shield" size={18} /></span>
          <div className="admin-brand-txt"><b>HahaSNS</b><span>管理后台</span></div>
        </div>
        <nav className="admin-nav">
          {TABS.map((t) => (
            <button key={t.k} className={`admin-nav-item${tab === t.k ? ' active' : ''}`} onClick={() => setTab(t.k)}>
              <Icon name={t.icon} size={18} /> {t.l}
            </button>
          ))}
        </nav>
        <div className="admin-side-foot">
          <Link to="/" className="admin-nav-item"><Icon name="back" size={18} /> 返回前台</Link>
          <button className="admin-nav-item danger" onClick={logout}><Icon name="logout" size={18} /> 退出登录</button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <h1>{current.l}</h1>
          <div className="row gap-8"><Avatar user={user} size={34} showV /><span style={{ fontWeight: 600 }}>{user.nickname}</span></div>
        </header>
        <div className="admin-content">
          {tab === 'overview' && <Overview />}
          {tab === 'users' && <Users />}
          {tab === 'boards' && <Boards />}
          {tab === 'topics' && <Topics />}
          {tab === 'reports' && <Reports />}
          {tab === 'notices' && <Notices />}
          {tab === 'mall' && <Products />}
          {tab === 'security' && <Security />}
          {tab === 'appearance' && <Appearance />}
          {tab === 'audit' && <AuditLog />}
        </div>
      </main>
    </div>
  );
}
