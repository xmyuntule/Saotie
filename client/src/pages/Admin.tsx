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
  { k: 'flash', l: '快报', icon: 'fire' },
  { k: 'nav', l: '导航', icon: 'link' },
  { k: 'articles', l: '文章', icon: 'edit' },
  { k: 'events', l: '活动', icon: 'ticket' },
  { k: 'circles', l: '圈子', icon: 'users' },
  { k: 'qa', l: '问答', icon: 'help' },
  { k: 'mall', l: '商城', icon: 'shop' },
  { k: 'payment', l: '支付', icon: 'coin' },
  { k: 'lottery', l: '抽奖', icon: 'gift' },
  { k: 'checkin', l: '签到', icon: 'calendar' },
  { k: 'security', l: '安全', icon: 'shield' },
  { k: 'modules', l: '模块', icon: 'grid' },
  { k: 'layout', l: '布局', icon: 'compass' },
  { k: 'appearance', l: '外观', icon: 'image' },
  { k: 'audit', l: '日志', icon: 'book' },
];

// 模块市场 (C)：可开关的功能模块；key 与后端 MODULE_KEYS / 前端导航 module 一致
const MODULE_LIST: [string, string, string][] = [
  ['discover', '发现话题', 'compass'], ['circles', '圈子', 'users'], ['qa', '问答 · 悬赏', 'help'],
  ['flash', '资讯快报', 'bell'], ['articles', '专栏文章', 'book'], ['events', '社区活动', 'ticket'],
  ['nav', '网址导航', 'grid'], ['forum', '社区论坛', 'forum'], ['leaderboard', '排行榜', 'trend'],
  ['achievements', '任务中心', 'checkin'], ['checkin', '每日签到', 'calendar'], ['lottery', '幸运抽奖', 'gift'],
  ['mall', '积分商城', 'shop'],
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
          <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <span className="stat-ic" style={{ background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c as string }}>
                <Icon name={ic} size={15} />
              </span>
            </div>
            <div className="num" style={{ fontWeight: 700, marginTop: 8 }}>{fmtNum(v)}</div>
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

// 行内积分编辑：点「积分」展开输入框 → 确定写入（管理员手动加/扣积分）。
function PointsEdit({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value));
  if (!editing) return <button className="btn btn-sm btn-outline" onClick={() => { setV(String(value)); setEditing(true); }} title="调整积分">积分</button>;
  return (
    <span className="row gap-4" style={{ alignItems: 'center' }}>
      <input className="inp" type="number" min={0} value={v} autoFocus onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { onSave(Math.max(0, Math.round(Number(v) || 0))); setEditing(false); } if (e.key === 'Escape') setEditing(false); }}
        style={{ width: 96, height: 30, fontSize: 13 }} />
      <button className="btn btn-sm btn-primary" onClick={() => { onSave(Math.max(0, Math.round(Number(v) || 0))); setEditing(false); }}>确定</button>
      <button className="btn btn-sm btn-ghost" onClick={() => setEditing(false)}>取消</button>
    </span>
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
            <div className="row gap-4" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
              <button className={`btn btn-sm ${u.verified ? 'btn-ghost' : 'btn-outline'}`} onClick={() => patch(u, { verified: !u.verified }, u.verified ? '已取消认证' : '已认证')}>V认证</button>
              <select className="inp" value={u.vipLevel ?? (u.vip ? 1 : 0)} onChange={(e) => patch(u, { vipLevel: Number(e.target.value) }, 'VIP 等级已更新')} style={{ height: 30, width: 'auto', padding: '0 8px', fontSize: 13 }} title="VIP 等级">
                <option value={0}>非会员</option>
                <option value={1}>VIP1 青铜</option>
                <option value={2}>VIP2 黄金</option>
                <option value={3}>VIP3 黑钻</option>
              </select>
              <PointsEdit value={u.points} onSave={(n) => patch(u, { points: n }, '积分已更新')} />
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

      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>敏感词过滤</div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>开启后，动态 / 评论 / 帖子 / 私信 / 资料含敏感词将被拦截。除内置词库外，可在下方追加自定义词（换行或逗号分隔），保存即生效。</div>
          </div>
          <Toggle on={isOn('sensitive_enabled')} onChange={(v) => setK('sensitive_enabled', v ? '1' : '0')} />
        </div>
        {isOn('sensitive_enabled') && (
          <label className="field" style={{ marginTop: 14, display: 'block' }}>
            <span className="sec-label">自定义敏感词（追加在内置词库之外）</span>
            <textarea value={cfg.sensitive_words ?? ''} onChange={(e) => setK('sensitive_words', e.target.value)} rows={5}
              placeholder="每行一个，或用逗号 / 顿号分隔，例如：&#10;违禁词1，违禁词2&#10;违禁词3"
              style={{ width: '100%', marginTop: 8, fontSize: 13.5, lineHeight: 1.6, resize: 'vertical' }} maxLength={8000} />
            <span className="faint" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{(cfg.sensitive_words || '').length}/8000 字符 · 匹配会忽略大小写与词内空格/符号</span>
          </label>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存设置'}</button>
      </div>
    </div>
  );
}

// 模块市场 (C)：开关各可选功能模块，关闭后从全站导航隐藏（核心功能不在内）。
function Modules() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const isOn = (k: string) => cfg?.[`module_${k}`] !== '0'; // 默认开启
  const save = async () => {
    setSaving(true);
    try { await api.put('/admin/config', { config: cfg }); toast.ok('模块设置已保存'); }
    catch (e: any) { toast.err(e.message); }
    finally { setSaving(false); }
  };
  if (cfg === null) return <RowSkeleton rows={6} />;
  const onCount = MODULE_LIST.filter(([k]) => isOn(k)).length;
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>功能模块</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>关闭的模块会从左侧栏、移动端菜单与底部导航中隐藏（已开启 {onCount}/{MODULE_LIST.length}）。首页、私信、通知、会员中心等核心功能始终可用。</div>
        <div className="sec-toggles" style={{ marginTop: 14 }}>
          {MODULE_LIST.map(([k, label, icon]) => (
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }} key={k}>
              <span className="row gap-8" style={{ fontSize: 13.5 }}><Icon name={icon} size={16} style={{ color: 'var(--ink-3)' }} /> {label}</span>
              <Toggle on={isOn(k)} onChange={(v) => setK(`module_${k}`, v ? '1' : '0')} />
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存设置'}</button>
      </div>
    </div>
  );
}

// 布局市场：站长为各页面选择布局（默认三栏 / 宽屏 / 居中）。key=layout_<page>，缺省=该页内置默认。
const LAYOUT_PAGE_LIST: [string, string, string][] = [
  ['collections', '专题合集', 'wide'],
  ['nav', '网址导航', 'wide'],
  ['mall', '积分商城', 'wide'],
  ['circles', '圈子', 'wide'],
  ['achievements', '任务 / 成就', 'default'],
  ['member', '会员中心', 'default'],
  ['bookmarks', '我的收藏', 'default'],
  ['history', '浏览足迹', 'default'],
  ['settings', '编辑资料', 'narrow'],
  ['changelog', '更新日志', 'narrow'],
  ['thread', '帖子详情', 'narrow'],
];
const LAYOUT_OPTS: [string, string][] = [['default', '三栏（默认）'], ['wide', '宽屏铺满'], ['narrow', '居中阅读']];

function Layouts() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const save = async () => {
    setSaving(true);
    try { await api.put('/admin/config', { config: cfg }); toast.ok('页面布局已保存，刷新对应页面查看'); }
    catch (e: any) { toast.err(e.message); }
    finally { setSaving(false); }
  };
  if (cfg === null) return <RowSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>页面布局</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>为各页面选择布局：三栏（带右侧栏）、宽屏（内容铺满、适合网格）、居中（舒适阅读宽度、适合长文/表单）。Feed 类首页保持三栏。</div>
        <div className="sec-toggles" style={{ marginTop: 14 }}>
          {LAYOUT_PAGE_LIST.map(([k, label, def]) => (
            <div className="row" style={{ justifyContent: 'space-between', gap: 12 }} key={k}>
              <span style={{ fontSize: 13.5 }}>{label}</span>
              <select className="inp" style={{ width: 150, flex: 'none' }} value={cfg[`layout_${k}`] || def} onChange={(e) => setK(`layout_${k}`, e.target.value)}>
                {LAYOUT_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存布局'}</button>
      </div>
    </div>
  );
}

// 后台列表卡统一表头（Arco 表格风）：标题 + 数量胶囊 + 下边框分隔，行从表头下方开始。
function ListHead({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div className="admin-list-head">
      <span className="alh-title">{title}</span>
      {count != null && <span className="alh-count">{count}</span>}
      {action && <span className="alh-action">{action}</span>}
    </div>
  );
}

// 资讯快报后台：发布 / 置顶 / 删除快报（前台 /flash 展示）。
const FLASH_CATS = ['公告', '功能', '活动', '精选', '教程', '动态'];
function FlashAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState({ title: '', summary: '', category: '公告', url: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const load = () => api.get('/flash', { params: { limit: 50 } }).then(({ data }) => setList(data.flash)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const publish = async () => {
    if (form.title.trim().length < 2) return toast.err('标题至少 2 个字');
    setSaving(true);
    try { await api.post('/flash', form); toast.ok('快报已发布'); setForm({ title: '', summary: '', category: form.category, url: '', pinned: false }); load(); }
    catch (e: any) { toast.err(e.message); } finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!confirm('删除这条快报？')) return;
    try { await api.delete(`/flash/${id}`); setList((l) => (l || []).filter((x) => x.id !== id)); toast.ok('已删除'); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>发布快报</div>
        <div className="sec-grid">
          <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">标题</span><input className="inp" maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="一句话快报标题" /></label>
          <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">摘要（可选）</span><textarea className="inp" rows={2} maxLength={300} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="补充说明…" /></label>
          <label className="sec-field"><span className="sec-label">分类</span><select className="inp" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>{FLASH_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
          <label className="sec-field"><span className="sec-label">链接（可选）</span><input className="inp" maxLength={300} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" /></label>
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <label className="row gap-8" style={{ fontSize: 13.5 }}><Toggle on={form.pinned} onChange={(v) => setForm((f) => ({ ...f, pinned: v }))} /> 置顶</label>
          <button className="btn btn-primary" onClick={publish} disabled={saving}>{saving ? '发布中…' : '发布快报'}</button>
        </div>
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ListHead title="已发布" count={list?.length ?? 0} />
        {list === null ? <RowSkeleton rows={5} /> : list.length === 0 ? <Empty text="还没有快报，发布第一条吧" /> : list.map((f, i) => (
          <div key={f.id}>
            {i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-6" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                  {f.pinned ? <span className="ui-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}>置顶</span> : null}
                  <span className="ui-badge">{f.category}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{f.title}</span>
                </div>
                {f.summary && <div className="faint" style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.5 }}>{f.summary}</div>}
              </div>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(f.id)} title="删除"><Icon name="trash" size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 网址导航后台：分类 + 链接 的增删（前台 /nav 展示）。
function NavAdmin() {
  const toast = useToast();
  const [cats, setCats] = useState<any[] | null>(null);
  const [newCat, setNewCat] = useState({ name: '', icon: 'compass' });
  const [newLink, setNewLink] = useState<Record<number, { title: string; url: string }>>({});
  const load = () => api.get('/nav').then(({ data }) => setCats(data.categories)).catch(() => setCats([]));
  useEffect(() => { load(); }, []);
  const addCat = async () => {
    if (newCat.name.trim().length < 1) return toast.err('请输入分类名');
    try { await api.post('/nav/categories', { name: newCat.name, icon: newCat.icon || 'compass' }); setNewCat({ name: '', icon: 'compass' }); toast.ok('已添加分类'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const delCat = async (id: number) => { if (!confirm('删除该分类及其下所有链接？')) return; try { await api.delete(`/nav/categories/${id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const setLF = (cid: number, k: string, v: string) => setNewLink((s) => ({ ...s, [cid]: { title: '', url: '', ...(s[cid] || {}), [k]: v } }));
  const addLink = async (cid: number) => {
    const f = newLink[cid] || { title: '', url: '' };
    if (!f.title?.trim() || !f.url?.trim()) return toast.err('网站名和链接必填');
    try { await api.post('/nav/links', { categoryId: cid, title: f.title, url: f.url }); setNewLink((s) => ({ ...s, [cid]: { title: '', url: '' } })); toast.ok('已添加链接'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const delLink = async (id: number) => { try { await api.delete(`/nav/links/${id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  if (cats === null) return <RowSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>新建分类</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="inp" style={{ maxWidth: 220 }} maxLength={20} value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value }))} placeholder="分类名（如 开发工具）" />
          <input className="inp" style={{ maxWidth: 150 }} value={newCat.icon} onChange={(e) => setNewCat((c) => ({ ...c, icon: e.target.value }))} placeholder="图标 如 compass" />
          <button className="btn btn-primary" onClick={addCat}><Icon name="plus" size={15} /> 添加分类</button>
        </div>
      </div>
      {cats.length === 0 ? <div className="ui-card"><Empty text="还没有导航分类，先新建一个" /></div> : cats.map((c) => (
        <div className="ui-card" style={{ padding: 18 }} key={c.id}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="row gap-8" style={{ fontWeight: 700 }}><Icon name={c.icon || 'compass'} size={16} /> {c.name} <span className="faint" style={{ fontSize: 12 }}>（{c.links.length}）</span></span>
            <button className="btn btn-ghost btn-sm danger" onClick={() => delCat(c.id)}><Icon name="trash" size={14} /> 删分类</button>
          </div>
          {c.links.map((l: any) => (
            <div className="row gap-8" key={l.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
              <span className="grow nowrap" style={{ minWidth: 0, fontSize: 13.5 }}>{l.title} <span className="faint" style={{ fontSize: 12 }}>· {l.url}</span></span>
              <button className="btn btn-ghost btn-sm danger" onClick={() => delLink(l.id)} title="删除"><Icon name="trash" size={13} /></button>
            </div>
          ))}
          <div className="row gap-8" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <input className="inp" style={{ maxWidth: 160 }} value={newLink[c.id]?.title || ''} onChange={(e) => setLF(c.id, 'title', e.target.value)} placeholder="网站名" />
            <input className="inp grow" value={newLink[c.id]?.url || ''} onChange={(e) => setLF(c.id, 'url', e.target.value)} placeholder="https://…" />
            <button className="btn btn-primary btn-sm" onClick={() => addLink(c.id)}>添加链接</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 充值订单后台查看：汇总(已支付笔数/金额/积分) + 近 50 笔订单（用户/渠道/金额/积分/状态）。
function PayOrders() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/pay/admin/orders').then(({ data }) => setData(data)).catch(() => setData({ stats: {}, orders: [] })); }, []);
  if (data === null) return <RowSkeleton rows={4} />;
  const s = data.stats || {};
  const ST: Record<string, [string, string]> = {
    paid: ['已支付', 'var(--good)'], pending: ['待支付', 'var(--gold-deep)'], failed: ['失败', 'var(--like)'],
  };
  const CH: Record<string, string> = { alipay: '支付宝', wxpay: '微信', wechat: '微信' };
  const STAT_CARDS: [string, string][] = [
    ['已支付笔数', `${fmtNum(s.paidCount || 0)} / ${fmtNum(s.total || 0)}`],
    ['到账金额', `¥${s.paidAmount || '0.00'}`],
    ['发放积分', fmtNum(s.paidPoints || 0)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {STAT_CARDS.map(([k, v]) => (
          <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
            <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ListHead title="充值订单" count={data.orders.length} />
        {data.orders.length === 0 ? <Empty text="还没有充值订单" /> : data.orders.map((o: any, i: number) => {
          const st = ST[o.status] || [o.status, 'var(--ink-3)'];
          return (
            <div key={o.outTradeNo}>
              {i > 0 && <div className="divider" />}
              <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'center' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-6" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{o.user?.nickname || '已删除用户'}</span>
                    <span className="ui-badge">{CH[o.channel] || o.channel}</span>
                  </div>
                  <div className="faint num" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>{o.outTradeNo} · {timeAgo(o.createdAt)}</div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="num" style={{ fontWeight: 700, fontSize: 15 }}>¥{o.amount}</div>
                  <div className="faint num" style={{ fontSize: 12 }}>+{fmtNum(o.points)} 分</div>
                </div>
                <span className="ui-badge" style={{ background: `color-mix(in srgb, ${st[1]} 13%, transparent)`, color: st[1], flex: 'none' }}>{st[0]}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 支付配置：支付宝 / 微信 / 易支付 三家网关开关 + 凭据（凭据仅 admin 可读写，公开接口不暴露）。
function PaymentAdmin() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const save = async () => { setSaving(true); try { await api.put('/admin/config', { config: cfg }); toast.ok('支付配置已保存'); } catch (e: any) { toast.err(e.message); } finally { setSaving(false); } };
  if (cfg === null) return <RowSkeleton rows={6} />;
  const fld = (k: string, label: string, ph: string, area = false) => (
    <label className="sec-field" style={area ? { gridColumn: '1 / -1' } : undefined}>
      <span className="sec-label">{label}</span>
      {area
        ? <textarea className="inp" rows={2} value={cfg[k] ?? ''} onChange={(e) => setK(k, e.target.value)} placeholder={ph} />
        : <input className="inp" value={cfg[k] ?? ''} onChange={(e) => setK(k, e.target.value)} placeholder={ph} />}
    </label>
  );
  const gw = (enableKey: string, name: string, fields: React.ReactNode) => (
    <div className="ui-card" style={{ padding: 18 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 14.5 }}>{name}</span>
        <Toggle on={cfg[enableKey] === '1'} onChange={(v) => setK(enableKey, v ? '1' : '0')} />
      </div>
      <div className="sec-grid" style={{ marginTop: 14 }}>{fields}</div>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>配置三家支付网关用于会员充值 / 积分购买。密钥等凭据仅服务端保存、仅管理员可见，公开接口只暴露「是否启用」。开启后将在充值页展示对应支付方式。</div>
      {gw('pay_alipay_enabled', '支付宝', <>{fld('pay_alipay_appid', 'App ID', '支付宝应用 AppID')}{fld('pay_alipay_key', '应用私钥', '应用私钥 / 密钥', true)}</>)}
      {gw('pay_wechat_enabled', '微信支付', <>{fld('pay_wechat_mchid', '商户号 MchID', '微信支付商户号')}{fld('pay_wechat_key', 'API 密钥', 'APIv3 密钥')}</>)}
      {gw('pay_epay_enabled', '易支付', <>{fld('pay_epay_pid', '商户 PID', '易支付商户 ID')}{fld('pay_epay_key', '商户密钥', '易支付商户密钥')}{fld('pay_epay_url', '网关地址', 'https://pay.example.com/')}</>)}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存支付配置'}</button>
      </div>
      <div className="sec-head" style={{ marginTop: 6 }}>充值订单</div>
      <PayOrders />
    </div>
  );
}

// 抽奖奖品后台：配置转盘 8 格奖品（名称/类型/值/权重）。weight 为中奖权重，前台不暴露。
const LOT_TYPES: [string, string][] = [['points', '积分'], ['title', '头衔'], ['frame', '头像框'], ['thanks', '谢谢参与']];
function LotteryAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/lottery/prizes').then(({ data }) => setList(data.prizes)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const setField = (i: number, k: string, v: any) => setList((l) => (l || []).map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  const save = async (p: any) => {
    if (!p.name?.trim()) return toast.err('奖品名必填');
    try { await api.post('/lottery/prizes', p); toast.ok('已保存'); load(); } catch (e: any) { toast.err(e.message); }
  };
  const del = async (p: any, i: number) => {
    if (!p.id) { setList((l) => (l || []).filter((_, j) => j !== i)); return; }
    if (!confirm('删除该奖品？')) return;
    try { await api.delete(`/lottery/prizes/${p.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  const add = () => setList((l) => [...(l || []), { name: '', type: 'thanks', value: '', icon: 'gift', color: '', weight: 10, position: (l?.length || 0) }]);
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>配置转盘奖品。<b>权重</b>越大越容易抽中（前台不展示）；类型：积分=自动加分、头衔/头像框=发放对应物品、谢谢参与=不发奖。建议保留 8 个奖品。</div>
      {list.map((p, i) => (
        <div className="ui-card" style={{ padding: 14 }} key={p.id ?? 'new' + i}>
          <div className="sec-grid">
            <label className="sec-field"><span className="sec-label">奖品名</span><input className="inp" value={p.name} onChange={(e) => setField(i, 'name', e.target.value)} placeholder="如 100 积分" /></label>
            <label className="sec-field"><span className="sec-label">类型</span><select className="inp" value={p.type} onChange={(e) => setField(i, 'type', e.target.value)}>{LOT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="sec-field"><span className="sec-label">奖品值（积分数 / 物品标识）</span><input className="inp" value={p.value} onChange={(e) => setField(i, 'value', e.target.value)} placeholder="积分填数字，如 100" /></label>
            <label className="sec-field"><span className="sec-label">权重</span><input className="inp" type="number" min={0} value={p.weight} onChange={(e) => setField(i, 'weight', e.target.value)} /></label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(p, i)}><Icon name="trash" size={14} /> 删除</button>
            <button className="btn btn-primary btn-sm" onClick={() => save(p)}>保存</button>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost btn-block" onClick={add}><Icon name="plus" size={15} /> 新增奖品</button>
    </div>
  );
}

// 专栏文章后台：精选 / 取消精选 / 删除（前台 /articles 展示，精选进首页编辑精选位）。
function ArticlesAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/articles', { params: { limit: 40 } }).then(({ data }) => {
    const seen = new Set<number>(); const out: any[] = [];
    for (const a of [data.featured, ...(data.articles || [])]) { if (a && !seen.has(a.id)) { seen.add(a.id); out.push(a); } }
    setList(out);
  }).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const feature = async (a: any, on: boolean) => {
    try { await api.post(`/articles/${a.id}/feature`, { featured: on }); toast.ok(on ? '已设为精选' : '已取消精选'); load(); } catch (e: any) { toast.err(e.message); }
  };
  const del = async (a: any) => {
    if (!confirm('删除这篇文章？')) return;
    try { await api.delete(`/articles/${a.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="专栏文章" count={list.length} />
      {list.length === 0 ? <Empty text="还没有文章" /> : list.map((a, i) => (
        <div key={a.id}>
          {i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-6" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                {a.featured && <span className="ui-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}>精选</span>}
                <span className="ui-badge">{a.category}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{a.title}</span>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{a.author?.nickname} · {fmtNum(a.views)} 阅读 · {fmtNum(a.likeCount)} 赞</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => feature(a, !a.featured)}>{a.featured ? '取消精选' : '设精选'}</button>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(a)} title="删除"><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 社区活动后台：查看 + 删除（活动由用户发起，管理员可下架）。
function EventsAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/events').then(({ data }) => setList(data.events)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const del = async (e: any) => {
    if (!confirm('删除这个活动？')) return;
    try { await api.delete(`/events/${e.id}`); toast.ok('已删除'); load(); } catch (err: any) { toast.err(err.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="社区活动" count={list.length} />
      {list.length === 0 ? <Empty text="还没有活动" /> : list.map((e, i) => (
        <div key={e.id}>
          {i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-6" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="ui-badge">{e.category}</span>
                {e.online ? <span className="ui-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}>线上</span> : null}
                <span style={{ fontWeight: 600, fontSize: 14 }}>{e.title}</span>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{e.organizer?.nickname} · {(e.startAt || '').slice(0, 16)} · 报名 {e.signupCount}{e.capacity > 0 ? `/${e.capacity}` : ''}</div>
            </div>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(e)} title="删除"><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 圈子后台：查看 + 解散（圈子由用户创建，管理员可解散；解散删成员/聊天，圈内动态保留）。
function CirclesAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/circles').then(({ data }) => setList(data.circles)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const del = async (c: any) => {
    if (!confirm(`解散圈子「${c.name}」？成员与聊天记录会一并删除，圈内动态保留。`)) return;
    try { await api.delete(`/circles/${c.id}`); toast.ok('已解散'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="圈子" count={list.length} />
      {list.length === 0 ? <Empty text="还没有圈子" /> : list.map((c, i) => (
        <div key={c.id}>
          {i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-6" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="ui-badge">{c.category}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</span>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{c.owner?.nickname} · {fmtNum(c.memberCount)} 成员 · {fmtNum(c.postCount)} 动态</div>
            </div>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(c)} title="解散圈子"><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 问答后台：查看 + 删除（删问题连同回答与投票）。
function QAAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const load = () => api.get('/qa').then(({ data }) => setList(data.questions)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const del = async (q: any) => {
    if (!confirm('删除该问题及其全部回答？')) return;
    try { await api.delete(`/qa/${q.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="问答" count={list.length} />
      {list.length === 0 ? <Empty text="还没有问题" /> : list.map((q, i) => (
        <div key={q.id}>
          {i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-6" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
                {q.bounty > 0 ? <span className="ui-badge" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>悬赏 {q.bounty}</span> : null}
                {q.bestAnswerId ? <span className="ui-badge" style={{ background: 'var(--brand-soft)', color: 'var(--brand-strong)' }}>已采纳</span> : null}
                <span className="ui-badge">{q.category}</span>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{q.title}</span>
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{q.author?.nickname} · {fmtNum(q.answerCount)} 回答 · {fmtNum(q.viewCount)} 浏览</div>
            </div>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(q)} title="删除"><Icon name="trash" size={14} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}

// 签到后台配置 (③)：基础分 / 连签加成上限 / 补签成本，落库 site_config，签到中心与签到发放实时生效。
function CheckinAdmin() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const numOr = (k: string, def: number) => { const v = cfg?.[k]; return v === undefined || v === '' ? def : Number(v); };
  const save = async () => {
    setSaving(true);
    try { await api.put('/admin/config', { config: cfg }); toast.ok('签到配置已保存'); }
    catch (e: any) { toast.err(e.message); }
    finally { setSaving(false); }
  };
  if (cfg === null) return <RowSkeleton rows={4} />;
  const base = numOr('checkin_base_points', 5);
  const cap = numOr('checkin_streak_cap', 7);
  const FIELDS: [string, string, string, number][] = [
    ['checkin_base_points', '每日基础积分', '分', 5],
    ['checkin_streak_cap', '连签加成上限', '天', 7],
    ['checkin_makeup_cost', '补签成本', '积分', 20],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>签到奖励配置</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>每日签到积分 = 基础分 + min(连签天数, 加成上限)，再按会员等级加成（VIP1 ×1.2 / VIP2 ×1.5 / VIP3 ×2）。补签成本为找回某天签到所需积分（不计入连签）。</div>
        <div className="sec-grid">
          {FIELDS.map(([k, label, unit, def]) => (
            <label className="sec-field" key={k}>
              <span className="sec-label">{label}</span>
              <span className="sec-num">
                <input type="number" min={0} value={cfg[k] ?? ''} placeholder={String(def)} onChange={(e) => setK(k, e.target.value)} />
                <i>{unit}</i>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>7 日奖励预览</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, marginBottom: 12, lineHeight: 1.5 }}>按当前配置，连续签到第 1–7 天的基础积分（未含会员加成）。</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          {Array.from({ length: 7 }, (_, i) => {
            const day = i + 1;
            const pts = base + Math.min(day, cap);
            return (
              <div key={day} className="ui-card" style={{ padding: '10px 14px', textAlign: 'center', minWidth: 64, boxShadow: 'none' }}>
                <div className="faint" style={{ fontSize: 12 }}>第{day}天</div>
                <div className="num" style={{ fontWeight: 700, fontSize: 18, marginTop: 2 }}>+{pts}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存配置'}</button>
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
          {tab === 'flash' && <FlashAdmin />}
          {tab === 'nav' && <NavAdmin />}
          {tab === 'articles' && <ArticlesAdmin />}
          {tab === 'events' && <EventsAdmin />}
          {tab === 'circles' && <CirclesAdmin />}
          {tab === 'qa' && <QAAdmin />}
          {tab === 'payment' && <PaymentAdmin />}
          {tab === 'lottery' && <LotteryAdmin />}
          {tab === 'checkin' && <CheckinAdmin />}
          {tab === 'mall' && <Products />}
          {tab === 'security' && <Security />}
          {tab === 'modules' && <Modules />}
          {tab === 'layout' && <Layouts />}
          {tab === 'appearance' && <Appearance />}
          {tab === 'audit' && <AuditLog />}
        </div>
      </main>
    </div>
  );
}
