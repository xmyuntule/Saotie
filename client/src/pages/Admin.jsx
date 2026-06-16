import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Badges } from '../components/Identity';
import { Loading, Empty } from '../components/States';
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
  { k: 'mall', l: '商城', icon: 'shop' },
];

function Overview() {
  const [data, setData] = useState(null);
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
          <div className="card" key={k} style={{ padding: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: 13 }}>{k}</span>
              <Icon name={ic} size={16} style={{ color: c }} />
            </div>
            <div className="num" style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{fmtNum(v)}</div>
          </div>
        ))}
      </div>
      {data.activity?.length > 0 && (() => {
        const max = Math.max(1, ...data.activity.map((d) => Math.max(d.posts, d.comments)));
        return (
          <div className="card" style={{ marginTop: 'var(--gap)', padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15 }}>近 7 天活跃度</h2>
              <div className="row gap-12" style={{ fontSize: 12 }}>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--brand)' }} /> 动态</span>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--good)' }} /> 评论</span>
              </div>
            </div>
            <div className="chart">
              {data.activity.map((d) => (
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

      <div className="card" style={{ marginTop: 'var(--gap)', overflow: 'hidden' }}>
        <div className="section-head" style={{ paddingBottom: 12 }}><h2 style={{ fontSize: 15 }}>最新注册</h2></div>
        {data.recentUsers.map((u, i) => (
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
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const load = (query = '') => api.get('/admin/users', { params: { q: query } }).then(({ data }) => setUsers(data.users));
  useEffect(() => { load(); }, []);

  const patch = async (u, body, label) => {
    try { const { data } = await api.put(`/admin/users/${u.id}`, body); setUsers((xs) => xs.map((x) => x.id === u.id ? { ...x, ...data.user } : x)); toast.ok(label); }
    catch (e) { toast.err(e.message); }
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
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
  const [boards, setBoards] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '', icon: '📁', description: '' });
  const load = () => api.get('/forum/boards').then(({ data }) => setBoards(data.boards));
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name || !form.slug) return toast.err('名称和 slug 必填');
    try { await api.post('/admin/boards', form); toast.ok('板块已创建'); setForm({ name: '', slug: '', icon: '📁', description: '' }); load(); }
    catch (e) { toast.err(e.message); }
  };
  const del = async (b) => { if (!confirm(`删除板块「${b.name}」及其所有帖子?`)) return; try { await api.delete(`/admin/boards/${b.id}`); toast.ok('已删除'); load(); } catch (e) { toast.err(e.message); } };
  const addMod = async (b) => { const username = prompt('设为版主的用户名:'); if (!username) return; try { const { data } = await api.post(`/admin/boards/${b.id}/moderators`, { username }); toast.ok(data.added ? '已任命版主' : '已移除版主'); load(); } catch (e) { toast.err(e.message); } };

  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>新建板块</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="图标" style={{ width: 60, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 10px', textAlign: 'center', background: 'var(--surface)' }} />
          <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="板块名称" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <input value={form.slug} onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="slug (英文)" style={{ width: 130, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>创建</button>
        </div>
        <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="板块说明 (可选)" style={{ width: '100%', height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', marginTop: 8, background: 'var(--surface)' }} />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
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
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const load = () => api.get('/topics').then(({ data }) => setTopics(data.topics));
  useEffect(() => { load(); }, []);
  const create = async () => { if (!form.name) return toast.err('话题名必填'); try { await api.post('/admin/topics', form); toast.ok('话题已创建'); setForm({ name: '', description: '' }); load(); } catch (e) { toast.err(e.message); } };
  const del = async (t) => { if (!confirm(`删除话题 #${t.name}#?`)) return; try { await api.delete(`/admin/topics/${t.id}`); toast.ok('已删除'); load(); } catch (e) { toast.err(e.message); } };
  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="话题名" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="描述" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>创建话题</button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
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
  const [reports, setReports] = useState([]);
  const load = () => api.get('/admin/reports').then(({ data }) => setReports(data.reports));
  useEffect(() => { load(); }, []);
  const resolve = async (r) => { try { await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('已处理'); load(); } catch (e) { toast.err(e.message); } };
  const delContent = async (r) => {
    if (!confirm('确定删除被举报的内容？此操作不可撤销')) return;
    try { await api.delete(`/admin/content/${r.targetType}/${r.targetId}`); await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('内容已删除并处理'); load(); }
    catch (e) { toast.err(e.message); }
  };
  const TYPE = { post: '动态', thread: '帖子', comment: '评论', user: '用户' };
  const link = (r) => r.targetType === 'post' ? `/post/${r.targetId}` : r.targetType === 'thread' ? `/thread/${r.targetId}` : r.targetType === 'user' && r.target?.author ? `/u/${r.target.author.username}` : null;
  if (!reports.length) return <div className="card"><Empty icon="✅" text="没有待处理的举报" /></div>;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {reports.map((r, i) => (
        <div key={r.id}>{i > 0 && <div className="divider" />}
          <div style={{ padding: '14px 16px' }}>
            <div className="row gap-8" style={{ marginBottom: 8 }}>
              <span className="badge badge-elite">{TYPE[r.targetType] || r.targetType}</span>
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
              {link(r) && <Link to={link(r)} className="btn btn-ghost btn-sm">查看</Link>}
              {r.target?.exists && r.targetType !== 'user' && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--like)' }} onClick={() => delContent(r)}>删除内容</button>}
              <button className="btn btn-outline btn-sm" onClick={() => resolve(r)}>忽略</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Products() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name: '', icon: '🎁', category: 'item', price: 100, description: '', payload: '' });
  const load = () => api.get('/mall/products').then(({ data }) => setProducts(data.products));
  useEffect(() => { load(); }, []);
  const create = async () => { if (!form.name || !form.price) return toast.err('名称和价格必填'); try { await api.post('/admin/products', form); toast.ok('商品已上架'); setForm({ name: '', icon: '🎁', category: 'item', price: 100, description: '', payload: '' }); load(); } catch (e) { toast.err(e.message); } };
  const del = async (p) => { if (!confirm(`下架「${p.name}」?`)) return; try { await api.delete(`/admin/products/${p.id}`); toast.ok('已下架'); load(); } catch (e) { toast.err(e.message); } };
  return (
    <>
      <div className="card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>上架商品</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input value={form.icon} onChange={(e) => setForm(f => ({ ...f, icon: e.target.value }))} style={{ width: 56, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, textAlign: 'center', background: 'var(--surface)' }} />
          <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="商品名" style={{ flex: 1, minWidth: 120, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <select value={form.category} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} style={{ height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 10px', background: 'var(--surface)' }}>
            <option value="title">头衔</option><option value="frame">头像框</option><option value="item">道具</option><option value="physical">实物</option>
          </select>
          <input type="number" value={form.price} onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))} placeholder="积分" style={{ width: 100, height: 40, border: '1.5px solid var(--line-2)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)' }} />
          <button className="btn btn-primary" onClick={create}>上架</button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
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

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const [tab, setTab] = useState('overview');

  if (loading) return <div className="admin-center"><Loading /></div>;
  if (!user || user.role !== 'admin')
    return (
      <div className="admin-center">
        <div className="card" style={{ padding: 40, textAlign: 'center', maxWidth: 360 }}>
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
          {tab === 'mall' && <Products />}
        </div>
      </main>
    </div>
  );
}
