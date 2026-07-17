import { useState, useEffect, Fragment, useRef } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../components/Modal';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import { Badges } from '../components/Identity';
import { Loading, Empty, RowSkeleton } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSite } from '../context/SiteContext';
import { BrandMark } from '../components/Navbar';
import api from '../api/client';
import { fmtNum, timeAgo } from '../lib/format';
import { confirmDialog } from '../components/confirm';
import { promptDialog } from '../components/prompt';
// 品牌化二次确认已抽到 ../components/confirm（全站共用，<ConfirmHost/> 挂在 App 根）。

// 通用 CSV 导出（前缀 BOM 以便 Excel 正确识别 UTF-8 中文）。cols: {label, get}[]。
function downloadCSV(filename: string, cols: { label: string; get: (r: any) => any }[], rows: any[]) {
  const esc = (v: any) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(c.get(r))).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const TABS = [
  { k: 'overview', l: '概览', icon: 'trend', d: '站点数据总览与今日动态' },
  { k: 'users', l: '用户', icon: 'user', d: '管理用户身份、VIP 等级、积分与封禁' },
  { k: 'boards', l: '板块', icon: 'forum', d: '论坛板块的新建、编辑与版主设置' },
  { k: 'topics', l: '话题', icon: 'fire', d: '话题增删改与发现页热度权重' },
  { k: 'reports', l: '举报', icon: 'flag', d: '处理用户举报、删除违规内容' },
  { k: 'feedback', l: '反馈', icon: 'comment', d: '回复用户反馈并标记处理状态' },
  { k: 'notices', l: '公告', icon: 'bell', d: '全站公告横幅的发布与管理' },
  { k: 'flash', l: '快报', icon: 'fire', d: '资讯快报的发布、置顶与编辑' },
  { k: 'nav', l: '导航', icon: 'link', d: '站点推荐目录的分类与链接' },
  { k: 'articles', l: '文章', icon: 'edit', d: '专栏文章的精选与管理' },
  { k: 'events', l: '活动', icon: 'ticket', d: '社区活动的查看与下架' },
  { k: 'circles', l: '圈子', icon: 'users', d: '圈子的查看与解散' },
  { k: 'qa', l: '问答', icon: 'help', d: '问答与悬赏内容管理' },
  { k: 'mall', l: '商城', icon: 'shop', d: '积分商品的上架、编辑与下架' },
  { k: 'payment', l: '支付', icon: 'coin', d: '支付网关配置与充值订单对账' },
  { k: 'lottery', l: '抽奖', icon: 'gift', d: '奖品配置与中奖记录' },
  { k: 'checkin', l: '签到', icon: 'calendar', d: '签到奖励配置与活跃统计' },
  { k: 'achievements', l: '任务', icon: 'checkin', d: '任务中心奖励、启用状态与成长玩法配置' },
  { k: 'externalSync', l: '站外同步', icon: 'link', d: 'RSS 订阅同步、权限限制与导入记录' },
  { k: 'security', l: '安全', icon: 'shield', d: '注册验证、频率限制与权限门控' },
  { k: 'modules', l: '模块', icon: 'grid', d: '前台功能模块的开关' },
  { k: 'layout', l: '布局', icon: 'compass', d: '各页面布局（三栏 / 宽屏 / 居中）' },
  { k: 'appearance', l: '外观', icon: 'image', d: '站点品牌、Logo 与自定义 CSS' },
  { k: 'audit', l: '日志', icon: 'book', d: '管理操作审计记录' },
];
// 后台侧边导航按职能折叠为 4 组，避免矮屏下系统配置项被挤出可视区。
const NAV_GROUPS: { l: string; keys: string[] }[] = [
  { l: '内容', keys: ['overview', 'boards', 'topics', 'articles', 'flash', 'events', 'circles', 'qa', 'nav'] },
  { l: '运营', keys: ['notices', 'mall', 'payment', 'lottery', 'checkin', 'achievements'] },
  { l: '站外同步', keys: ['externalSync'] },
  { l: '用户', keys: ['users', 'reports', 'feedback'] },
  { l: '系统', keys: ['security', 'modules', 'layout', 'appearance', 'audit'] },
];
const TAB_BY_K = Object.fromEntries(TABS.map((t) => [t.k, t]));
// tab key → 所属分组名（顶栏面包屑用）
const GROUP_OF: Record<string, string> = {};
NAV_GROUPS.forEach((g) => g.keys.forEach((k) => { GROUP_OF[k] = g.l; }));

// 模块市场 (C)：可开关的功能模块；key 与后端 MODULE_KEYS / 前端导航 module 一致
// [key, label, icon, group] —— 第4项用于在「模块」tab 内按主题分组展示。
const MODULE_LIST: [string, string, string, string][] = [
  ['discover', '发现话题', 'compass', '内容与发现'], ['flash', '资讯快报', 'bell', '内容与发现'], ['articles', '专栏文章', 'book', '内容与发现'],
  ['events', '社区活动', 'ticket', '内容与发现'], ['nav', '网址导航', 'grid', '内容与发现'], ['forum', '社区论坛', 'forum', '内容与发现'], ['qa', '问答 · 悬赏', 'help', '内容与发现'],
  ['circles', '圈子', 'users', '互动与成长'], ['leaderboard', '排行榜', 'trend', '互动与成长'], ['achievements', '任务中心', 'checkin', '互动与成长'], ['checkin', '每日签到', 'calendar', '互动与成长'],
  ['lottery', '幸运抽奖', 'gift', '积分与运营'], ['mall', '积分商城', 'shop', '积分与运营'],
];

const NOTICE_LEVELS = [
  { k: 'info', l: '信息' }, { k: 'success', l: '成功' }, { k: 'warning', l: '提醒' }, { k: 'event', l: '活动' },
];

const FEEDBACK_STATUS_OPTIONS = [
  { k: '', l: '全部' },
  { k: 'open', l: '待处理' },
  { k: 'planned', l: '已采纳' },
  { k: 'doing', l: '处理中' },
  { k: 'resolved', l: '已解决' },
  { k: 'closed', l: '已关闭' },
];
const FEEDBACK_STATUS_LABEL: Record<string, string> = Object.fromEntries(FEEDBACK_STATUS_OPTIONS.filter((s) => s.k).map((s) => [s.k, s.l]));

const AUDIT_ICON: Record<string, string> = {
  'user.update': 'user', 'content.delete': 'trash', 'report.resolve': 'flag',
  'board.create': 'forum', 'board.update': 'forum', 'board.delete': 'trash', 'board.moderator': 'shield',
  'topic.create': 'fire', 'topic.delete': 'trash', 'product.create': 'shop', 'product.delete': 'trash',
  'notice.create': 'bell', 'notice.update': 'bell', 'notice.delete': 'trash',
  'config.update': 'shield',
  'external_sync.create': 'link', 'external_sync.update': 'link', 'external_sync.delete': 'trash', 'external_sync.clear': 'trash',
  'forum.thread.update': 'forum', 'forum.thread.delete': 'trash',
};

const AUDIT_PREFIX_LABEL: Record<string, string> = {
  user: '用户', content: '内容', report: '举报', board: '板块', topic: '话题', product: '商品', notice: '公告', config: '配置',
  external_sync: '站外同步',
  forum: '论坛',
};

function AuditLog() {
  const [logs, setLogs] = useState<any[] | null>(null);
  const [filter, setFilter] = useState('all');
  useEffect(() => { api.get('/admin/audit').then(({ data }) => setLogs(data.logs)).catch(() => setLogs([])); }, []);
  if (logs === null) return <RowSkeleton rows={8} />;
  if (!logs.length) return <div className="ui-card"><Empty icon="📋" text="还没有管理操作记录" /></div>;
  const present = [...new Set(logs.map((l) => l.action.split('.')[0]))].filter((p) => AUDIT_PREFIX_LABEL[p]);
  const chips: [string, string][] = [['all', '全部'], ...present.map((p) => [p, AUDIT_PREFIX_LABEL[p]] as [string, string])];
  const shown = filter === 'all' ? logs : logs.filter((l) => l.action.split('.')[0] === filter);
  return (
    <div className="flex flex-col gap-4">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        {chips.length > 2 ? (
          <div className="audit-filters">
            {chips.map(([k, label]) => (
              <button key={k} className={`audit-chip${filter === k ? ' active' : ''}`} onClick={() => setFilter(k)}>
                {label}{k !== 'all' ? <span className="audit-chip-n"> {logs.filter((l) => l.action.split('.')[0] === k).length}</span> : <span className="audit-chip-n"> {logs.length}</span>}
              </button>
            ))}
          </div>
        ) : <span />}
        <button className="btn btn-ghost btn-sm" disabled={!shown.length} title="导出当前筛选的操作日志为 CSV" onClick={() => downloadCSV(`管理日志_${filter}.csv`, [
          { label: '时间', get: (l: any) => l.createdAt },
          { label: '管理员', get: (l: any) => l.admin?.nickname || '管理员' },
          { label: '操作', get: (l: any) => l.actionLabel },
          { label: '动作类型', get: (l: any) => l.action },
          { label: '详情', get: (l: any) => l.detail || '' },
        ], shown)}>导出 CSV</button>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {shown.length === 0 ? <Empty text="该类型暂无记录" /> : shown.map((l, i) => (
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
    </div>
  );
}

function Overview({ onNav }: { onNav?: (tab: string) => void }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/admin/overview').then(({ data }) => setData(data)); }, []);
  if (!data) return (
    <>
      <div className="stat-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div className="ui-card" key={i} style={{ padding: 16 }}>
            <div className="skeleton" style={{ width: '45%', height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: '60%', height: 22, borderRadius: 6, marginTop: 14 }} />
          </div>
        ))}
      </div>
      <div className="ui-card" style={{ marginTop: 'var(--gap)', padding: 18 }}>
        <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 6, marginBottom: 16 }} />
        <div className="skeleton" style={{ width: '100%', height: 140, borderRadius: 8 }} />
      </div>
      <div className="ui-card" style={{ marginTop: 'var(--gap)', overflow: 'hidden' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="row gap-12" style={{ padding: '12px 18px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
            <div className="skeleton" style={{ width: 38, height: 38, borderRadius: '30%', flex: 'none' }} />
            <div className="grow"><div className="skeleton" style={{ width: '40%', height: 13, borderRadius: 6 }} /><div className="skeleton" style={{ width: '24%', height: 10, borderRadius: 6, marginTop: 7 }} /></div>
          </div>
        ))}
      </div>
    </>
  );
  const S = data.stats;
  // 第5项=可跳转的管理 tab（null=纯指标卡，不可点）。让概览成为可操作仪表盘。
  const cards: [string, number, string, string, string | null][] = [
    ['用户', S.users, 'user', 'var(--brand)', 'users'], ['动态', S.posts, 'home', 'var(--good)', null],
    ['帖子', S.threads, 'forum', 'var(--coral)', null], ['评论', S.comments, 'comment', 'var(--verify)', null],
    ['话题', S.topics, 'fire', 'var(--gold)', 'topics'], ['板块', S.boards, 'forum', 'var(--ink-3)', 'boards'],
    ['VIP 会员', S.vip, 'coin', 'var(--gold-deep)', 'users'], ['待处理举报', S.reports, 'flag', 'var(--like)', 'reports'],
  ];
  const today = data.today;
  return (
    <>
      {today && (
        <div className="ui-card" style={{ padding: '12px 16px', marginBottom: 'var(--gap)' }}>
          <div className="row gap-16" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12.5, fontWeight: 600 }}>今日新增</span>
            {([['用户', today.users], ['动态', today.posts], ['评论', today.comments], ['举报', today.reports]] as [string, number][]).map(([l, n]) => (
              <span key={l} className="row gap-4" style={{ fontSize: 13, alignItems: 'baseline' }}>
                <span className="muted">{l}</span>
                <b className="num" style={{ fontSize: 15, color: l === '举报' && n > 0 ? 'var(--like)' : 'var(--ink)' }}>+{fmtNum(n)}</b>
              </span>
            ))}
            {data.recharge && (
              <span className="row gap-4" style={{ fontSize: 13, alignItems: 'baseline', marginLeft: 'auto' }}>
                <span className="muted">今日充值</span>
                <b className="num" style={{ fontSize: 15, color: 'var(--good)' }}>¥{data.recharge.todayAmount}</b>
                <span className="faint" style={{ fontSize: 12 }}>· 累计 ¥{data.recharge.paidAmount}</span>
              </span>
            )}
          </div>
        </div>
      )}
      <div className="stat-grid">
        {cards.map(([k, v, ic, c, target]) => {
          const clickable = !!target && !!onNav;
          const go = () => clickable && onNav!(target!);
          return (
          <div className={`ui-card stat-card${clickable ? ' stat-card-link' : ''}`} key={k} style={{ padding: 16 }}
            {...(clickable ? { role: 'button', tabIndex: 0, title: `查看${k}`, onClick: go, onKeyDown: (e: any) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } } } : {})}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}{clickable ? <span className="stat-go"> ›</span> : ''}</span>
              <span className="stat-ic" style={{ background: `color-mix(in srgb, ${c} 13%, transparent)`, color: c }}>
                <Icon name={ic} size={15} />
              </span>
            </div>
            {/* 后台仪表盘显示精确计数（带千分位），不做 1k/1w 缩写——运营要准数 */}
            <div className="num" style={{ fontWeight: 700, marginTop: 8 }}>{(v ?? 0).toLocaleString()}</div>
          </div>
        ); })}
      </div>
      {data.activity?.length > 0 && (() => {
        const max = Math.max(1, ...data.activity.map((d: any) => Math.max(d.posts, d.comments, d.users || 0)));
        return (
          <div className="ui-card" style={{ marginTop: 'var(--gap)', padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15 }}>近 7 天活跃度</h2>
              <div className="row gap-12" style={{ fontSize: 12 }}>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--brand)' }} /> 动态</span>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--good)' }} /> 评论</span>
                <span className="row gap-4"><i style={{ width: 9, height: 9, borderRadius: 3, background: 'var(--coral)' }} /> 新增用户</span>
              </div>
            </div>
            <div className="chart">
              {data.activity.map((d: any) => (
                <div className="chart-col" key={d.date} title={`${d.date} · 动态${d.posts} · 评论${d.comments} · 新增用户${d.users || 0}`}>
                  <div className="chart-bars">
                    <div className="chart-bar" style={{ height: `${(d.posts / max) * 100}%`, background: 'var(--brand)' }} />
                    <div className="chart-bar" style={{ height: `${(d.comments / max) * 100}%`, background: 'var(--good)' }} />
                    <div className="chart-bar" style={{ height: `${((d.users || 0) / max) * 100}%`, background: 'var(--coral)' }} />
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

      {data.invites && (
        <div className="ui-card" style={{ marginTop: 'var(--gap)', overflow: 'hidden' }}>
          <div className="section-head" style={{ paddingBottom: 12 }}>
            <h2 style={{ fontSize: 15 }}>邀请概况</h2>
            <span className="faint" style={{ fontSize: 12.5 }}>累计被邀请 <b className="num" style={{ color: 'var(--ink)' }}>{fmtNum(data.invites.total)}</b> 人</span>
          </div>
          {(!data.invites.top || data.invites.top.length === 0) ? <Empty text="还没有邀请记录" /> : data.invites.top.map((t: any, i: number) => (
            <div key={t.user?.id ?? i}>{i > 0 && <div className="divider" />}
              <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'center' }}>
                <span className="num" style={{ width: 22, textAlign: 'center', fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--ink-3)' }}>{i + 1}</span>
                <Avatar user={t.user} size={32} showV />
                <div className="grow" style={{ minWidth: 0 }}><Link to={`/u/${t.user?.username}`} className="uname">{t.user?.nickname}</Link></div>
                <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>邀请 {fmtNum(t.count)} 人</span>
              </div>
            </div>
          ))}
        </div>
      )}
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

const USER_FILTERS: [string, string][] = [['all', '全部'], ['admin', '管理员'], ['vip', 'VIP'], ['banned', '已封禁']];

function Users() {
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [hasMore, setHasMore] = useState(false);
  const load = (query = q, f = filter, off = 0) => api.get('/admin/users', { params: { q: query, filter: f === 'all' ? undefined : f, offset: off || undefined } }).then(({ data }) => {
    setUsers((prev) => (off > 0 ? [...prev, ...data.users] : data.users));
    setHasMore(!!data.hasMore);
  });
  useEffect(() => { load(); }, []);
  const pickFilter = (f: string) => { setFilter(f); load(q, f); };
  const fmtDate = (v?: string | null) => v ? `${v}（${timeAgo(v)}）` : '未记录';

  const patch = async (u: any, body: any, label: any) => {
    try { const { data } = await api.put(`/admin/users/${u.id}`, body); setUsers((xs) => xs.map((x) => x.id === u.id ? { ...x, ...data.user } : x)); toast.ok(label); }
    catch (e: any) { toast.err(e.message); }
  };
  // 重置密码（帮助找回）：弹窗输入新密码 → 后端 bcrypt 存储 + 通知该用户
  const resetPw = async (u: any) => {
    const pw = await promptDialog({ title: `为「${u.nickname}」设置新登录密码`, placeholder: '至少 6 位', type: 'password', minLength: 6, confirmText: '重置密码' });
    if (pw == null) return;
    try { await api.post(`/admin/users/${u.id}/reset-password`, { password: pw }); toast.ok('密码已重置，并已通知用户'); }
    catch (e: any) { toast.err(e.message); }
  };

  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      <div className="col gap-8" style={{ padding: 14 }}>
        <div className="row gap-8">
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(q, filter)} placeholder="搜索用户名/昵称…" />
          <button className="btn btn-ghost" disabled={!users.length} title="导出当前列表为 CSV" onClick={() => downloadCSV(`用户_${filter}.csv`, [
            { label: '昵称', get: (u) => u.nickname }, { label: '用户名', get: (u) => u.username }, { label: '等级', get: (u) => u.level },
            { label: '积分', get: (u) => u.points }, { label: 'VIP等级', get: (u) => u.vipLevel ?? (u.vip ? 1 : 0) }, { label: '角色', get: (u) => u.role || 'user' },
            { label: '注册时间', get: (u) => u.createdAt || '' }, { label: '最近登录', get: (u) => u.lastLoginAt || '' }, { label: '封禁', get: (u) => (u.banned ? '是' : '否') },
          ], users)}>导出 CSV</button>
        </div>
        <div className="audit-filters">
          {USER_FILTERS.map(([k, l]) => <button key={k} className={`audit-chip${filter === k ? ' active' : ''}`} onClick={() => pickFilter(k)}>{l}</button>)}
        </div>
      </div>
      {users.length === 0 ? <Empty text="没有符合条件的用户" /> : users.map((u, i) => (
        <div key={u.id}>{i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 16px', flexWrap: 'wrap' }}>
            <Avatar user={u} size={40} showV />
            <div className="grow" style={{ minWidth: 140 }}>
              <Link to={`/u/${u.username}`} className="uname">{u.nickname}</Link> <Badges user={u} />
              <div className="faint" style={{ fontSize: 12 }}>@{u.username} · Lv.{u.level} · {fmtNum(u.points)}积分 {u.banned && <span style={{ color: 'var(--like)' }}>· 已封禁</span>}</div>
              <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>注册：{fmtDate(u.createdAt)} · 最近登录：{fmtDate(u.lastLoginAt)}</div>
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
              <button className="btn btn-sm btn-ghost" onClick={() => resetPw(u)} title="重置该用户登录密码">重置密码</button>
              <button className="btn btn-sm btn-outline" style={{ color: u.banned ? 'var(--good)' : 'var(--like)', borderColor: 'currentColor' }} onClick={() => patch(u, { banned: !u.banned }, u.banned ? '已解封' : '已封禁')}>{u.banned ? '解封' : '封禁'}</button>
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="row" style={{ justifyContent: 'center', padding: 12, borderTop: '1px solid var(--line)' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => load(q, filter, users.length)}>加载更多</button>
        </div>
      )}
    </div>
  );
}

function flattenBoards(boards: any[]): any[] {
  const out: any[] = [];
  const walk = (list: any[], depth = 0) => {
    (list || []).forEach((b) => {
      out.push({ ...b, depth });
      if (b.children?.length) walk(b.children, depth + 1);
    });
  };
  walk(boards);
  return out;
}

// 板块编辑（行内展开）：改 图标/名称/说明/公告 + 付费板块开关与价格。后端 PUT /admin/boards/:id。
function BoardEditForm({ board, boards, onSaved, onCancel }: { board: any; boards: any[]; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const boardOptions = flattenBoards(boards).filter((b) => b.id !== board.id);
  const [f, setF] = useState({
    icon: board.icon || '',
    name: board.name || '',
    description: board.description || '',
    cover: board.cover || '',
    parentId: board.parentId ? String(board.parentId) : '',
    sort: String(board.sort ?? 0),
    announcement: board.announcement || '',
    isPaid: !!board.isPaid,
    price: String(board.price || 0),
  });
  const save = async () => {
    if (!f.name.trim()) return toast.err('名称必填');
    try {
      await api.put(`/admin/boards/${board.id}`, {
        name: f.name,
        icon: f.icon,
        description: f.description,
        cover: f.cover,
        parentId: f.parentId ? Number(f.parentId) : null,
        sort: Math.round(Number(f.sort) || 0),
        announcement: f.announcement,
        isPaid: f.isPaid,
        price: Math.max(0, Math.round(Number(f.price) || 0)),
      });
      toast.ok('板块已更新'); onSaved();
    } catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
      <div className="row gap-8" style={{ flexWrap: 'wrap', paddingTop: 14 }}>
        <input className="inp" value={f.icon} onChange={(e) => setF((s) => ({ ...s, icon: e.target.value }))} placeholder="图标" style={{ width: 60, textAlign: 'center' }} />
        <input className="inp" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="板块名称（必填）" style={{ flex: 1, minWidth: 120 }} />
        <input className="inp" type="number" value={f.sort} onChange={(e) => setF((s) => ({ ...s, sort: e.target.value }))} placeholder="排序" style={{ width: 90 }} />
      </div>
      <input className="inp" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} placeholder="板块说明（可选）" style={{ width: '100%', marginTop: 8 }} />
      <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        <input className="inp" value={f.cover} onChange={(e) => setF((s) => ({ ...s, cover: e.target.value }))} placeholder="板块封面 URL（可选）" style={{ flex: 1, minWidth: 180 }} />
        <select className="inp" value={f.parentId} onChange={(e) => setF((s) => ({ ...s, parentId: e.target.value }))} style={{ width: 180 }}>
          <option value="">顶级板块</option>
          {boardOptions.map((b) => <option key={b.id} value={b.id}>{'　'.repeat(b.depth || 0)}{b.name}</option>)}
        </select>
      </div>
      <textarea className="inp" value={f.announcement} onChange={(e) => setF((s) => ({ ...s, announcement: e.target.value }))} placeholder="板块公告（可选）" rows={2} style={{ width: '100%', marginTop: 8 }} />
      <div className="row gap-12" style={{ marginTop: 10, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
        <label className="row gap-8" style={{ fontSize: 13, color: 'var(--ink-2)', alignItems: 'center' }}>
          <Toggle on={f.isPaid} onChange={(v) => setF((s) => ({ ...s, isPaid: v }))} /> 付费板块
          {f.isPaid && <input className="inp" type="number" min={0} value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} placeholder="积分" style={{ width: 110 }} />}
        </label>
        <div className="row gap-4">
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
          <SaveBtn onSave={save} />
        </div>
      </div>
    </div>
  );
}

function Boards() {
  const toast = useToast();
  const [boards, setBoards] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', icon: '📁', description: '', cover: '', parentId: '', sort: '0' });
  const [editId, setEditId] = useState<number | null>(null);
  const load = () => api.get('/forum/boards').then(({ data }) => setBoards(data.boards));
  useEffect(() => { load(); }, []);
  const boardOptions = flattenBoards(boards);

  const create = async () => {
    if (!form.name || !form.slug) return toast.err('名称和 slug 必填');
    try {
      await api.post('/admin/boards', { ...form, parentId: form.parentId ? Number(form.parentId) : null, sort: Math.round(Number(form.sort) || 0) });
      toast.ok('板块已创建');
      setForm({ name: '', slug: '', icon: '📁', description: '', cover: '', parentId: '', sort: '0' });
      load();
    }
    catch (e: any) { toast.err(e.message); }
  };
  const del = async (b: any) => { if (!(await confirmDialog(`删除板块「${b.name}」及其所有帖子？`))) return; try { await api.delete(`/admin/boards/${b.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const addMod = async (b: any) => { const username = await promptDialog({ title: `「${b.name}」版主`, label: '输入用户名；已是版主则取消其版主身份', placeholder: '用户名', confirmText: '确定' }); if (!username) return; try { const { data } = await api.post(`/admin/boards/${b.id}/moderators`, { username }); toast.ok(data.added ? '已任命版主' : '已移除版主'); load(); } catch (e: any) { toast.err(e.message); } };
  // 板块运营总览（客户端按已载列表聚合：板块数 / 帖子总数 / 付费板块数）
  const boardStats: [string, number][] = [
    ['板块总数', boards.length],
    ['帖子总数', boards.reduce((s, b: any) => s + (Number(b.threadCount) || 0), 0)],
    ['付费板块', boards.filter((b: any) => b.isPaid).length],
  ];

  return (
    <>
      {boards.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 'var(--gap)' }}>
          {boardStats.map(([k, v]) => (
            <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>新建板块</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="inp" value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} placeholder="图标" style={{ width: 60, textAlign: 'center' }} />
          <input className="inp" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="板块名称（必填）" style={{ flex: 1, minWidth: 120 }} />
          <input className="inp" value={form.slug} onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))} placeholder="slug（必填，英文）" style={{ width: 130 }} />
          <input className="inp" type="number" value={form.sort} onChange={(e) => setForm((f: any) => ({ ...f, sort: e.target.value }))} placeholder="排序" style={{ width: 90 }} />
          <button className="btn btn-primary" onClick={create}>创建</button>
        </div>
        <input className="inp" value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="板块说明 (可选)" style={{ width: '100%', marginTop: 8 }} />
        <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
          <input className="inp" value={form.cover} onChange={(e) => setForm((f: any) => ({ ...f, cover: e.target.value }))} placeholder="板块封面 URL（可选）" style={{ flex: 1, minWidth: 180 }} />
          <select className="inp" value={form.parentId} onChange={(e) => setForm((f: any) => ({ ...f, parentId: e.target.value }))} style={{ width: 180 }}>
            <option value="">顶级板块</option>
            {boardOptions.map((b) => <option key={b.id} value={b.id}>{'　'.repeat(b.depth || 0)}{b.name}</option>)}
          </select>
        </div>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {boards.map((b, i) => (
          <div key={b.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 22 }}>{b.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}><b>{b.name}</b> <span className="faint" style={{ fontSize: 12 }}>/{b.slug} · {fmtNum(b.threadCount)}帖 · {b.moderators.length}版主{b.isPaid ? ` · 付费${b.price}` : ''}</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === b.id ? null : b.id)}>{editId === b.id ? '收起' : '编辑'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => addMod(b)}>版主</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => del(b)}><Icon name="trash" size={14} /> 删除</button>
            </div>
            {editId === b.id && <BoardEditForm board={b} boards={boards} onSaved={() => { setEditId(null); load(); }} onCancel={() => setEditId(null)} />}
          </div>
        ))}
      </div>
      <ForumThreadsAdmin boards={boards} />
    </>
  );
}

function ForumThreadEditForm({ thread, boards, onSaved, onCancel }: { thread: any; boards: any[]; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const boardOptions = flattenBoards(boards);
  const [f, setF] = useState({
    boardId: String(thread.boardId || thread.board?.id || ''),
    title: thread.title || '',
    content: thread.content || '',
    pinned: !!thread.pinned,
    elite: !!thread.elite,
    locked: !!thread.locked,
  });
  const save = async () => {
    if (!f.title.trim() || !f.content.trim()) return toast.err('标题和正文必填');
    try {
      await api.put(`/admin/forum/threads/${thread.id}`, {
        boardId: Number(f.boardId),
        title: f.title,
        content: f.content,
        pinned: f.pinned,
        elite: f.elite,
        locked: f.locked,
      });
      toast.ok('帖子已更新');
      onSaved();
    } catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 18px 16px', background: 'var(--surface-2)' }}>
      <div className="sec-grid" style={{ paddingTop: 14 }}>
        <label className="sec-field"><span className="sec-label">所属板块</span><select className="inp" value={f.boardId} onChange={(e) => setF((s) => ({ ...s, boardId: e.target.value }))}>{boardOptions.map((b) => <option key={b.id} value={b.id}>{'　'.repeat(b.depth || 0)}{b.name}</option>)}</select></label>
        <label className="sec-field"><span className="sec-label">标题</span><input className="inp" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></label>
      </div>
      <textarea className="inp" value={f.content} onChange={(e) => setF((s) => ({ ...s, content: e.target.value }))} rows={5} style={{ width: '100%', marginTop: 8, lineHeight: 1.6 }} />
      <div className="row gap-16" style={{ marginTop: 10, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div className="row gap-16" style={{ flexWrap: 'wrap' }}>
          <span className="row gap-8" style={{ fontSize: 13 }}><Toggle on={f.pinned} onChange={(v) => setF((s) => ({ ...s, pinned: v }))} /> 置顶</span>
          <span className="row gap-8" style={{ fontSize: 13 }}><Toggle on={f.elite} onChange={(v) => setF((s) => ({ ...s, elite: v }))} /> 精华</span>
          <span className="row gap-8" style={{ fontSize: 13 }}><Toggle on={f.locked} onChange={(v) => setF((s) => ({ ...s, locked: v }))} /> 锁定</span>
        </div>
        <div className="row gap-4">
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
          <SaveBtn onSave={save} />
        </div>
      </div>
    </div>
  );
}

function ForumThreadsAdmin({ boards }: { boards: any[] }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [boardId, setBoardId] = useState('');
  const [threads, setThreads] = useState<any[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const boardOptions = flattenBoards(boards);
  const load = async (offset = 0) => {
    const { data } = await api.get('/admin/forum/threads', { params: { q, boardId, offset } });
    setThreads((prev) => offset ? [...(prev || []), ...data.threads] : data.threads);
    setHasMore(!!data.hasMore);
  };
  useEffect(() => { load(0).catch(() => setThreads([])); /* eslint-disable-next-line */ }, [boardId]);
  const del = async (t: any) => {
    if (!(await confirmDialog(`删除帖子「${t.title}」？相关回复也会删除。`, { title: '删除帖子？', confirmText: '删除' }))) return;
    try { await api.delete(`/admin/forum/threads/${t.id}`); toast.ok('帖子已删除'); load(0); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div className="ui-card" style={{ overflow: 'hidden', marginTop: 'var(--gap)' }}>
      <ListHead title="论坛帖子管理" count={threads?.length ?? 0} action={
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <select className="inp" value={boardId} onChange={(e) => setBoardId(e.target.value)} style={{ width: 150 }}>
            <option value="">全部板块</option>
            {boardOptions.map((b) => <option key={b.id} value={b.id}>{'　'.repeat(b.depth || 0)}{b.name}</option>)}
          </select>
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(0)} placeholder="搜索标题或正文" />
        </div>
      } />
      {threads === null ? <RowSkeleton rows={5} /> : threads.length === 0 ? <Empty text="暂无帖子" /> : threads.map((t, i) => (
        <div key={t.id}>{i > 0 && <div className="divider" />}
          <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: 20 }}>{t.board?.icon || '📁'}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{t.title} {t.pinned && <span className="ui-badge badge-pin">置顶</span>} {t.elite && <span className="ui-badge badge-elite">精华</span>} {t.locked && <span className="ui-badge">锁定</span>}</div>
              <div className="faint" style={{ fontSize: 12.5, marginTop: 3 }}>板块：{t.board?.name || '-'} · 作者：{t.author?.nickname || '-'} · {fmtNum(t.replyCount)} 回复 · {fmtNum(t.views)} 浏览 · {timeAgo(t.createdAt)}</div>
              {t.content && <div className="faint" style={{ fontSize: 12.5, marginTop: 5, lineHeight: 1.45 }}>{t.content.slice(0, 120)}{t.content.length > 120 ? '…' : ''}</div>}
            </div>
            <div className="row gap-4" style={{ flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Link to={`/thread/${t.id}`} className="btn btn-ghost btn-sm">查看</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === t.id ? null : t.id)}>{editId === t.id ? '收起' : '编辑'}</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => del(t)}><Icon name="trash" size={14} /> 删除</button>
            </div>
          </div>
          {editId === t.id && <ForumThreadEditForm thread={t} boards={boards} onSaved={() => { setEditId(null); load(0); }} onCancel={() => setEditId(null)} />}
        </div>
      ))}
      {hasMore && <div className="row" style={{ justifyContent: 'center', padding: 12, borderTop: '1px solid var(--line)' }}><button className="btn btn-ghost btn-sm" onClick={() => load(threads?.length || 0)}>加载更多</button></div>}
    </div>
  );
}

// 话题编辑（行内展开）：改 描述/封面/热度。热度(hot)决定发现页话题排序，是运营权重。后端 PUT /admin/topics/:id。
function TopicEditForm({ topic, onSaved, onCancel }: { topic: any; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ description: topic.description || '', cover: topic.cover || '', hot: String(topic.hot ?? 0) });
  const save = async () => {
    try { await api.put(`/admin/topics/${topic.id}`, { description: f.description, cover: f.cover, hot: Math.max(0, Math.round(Number(f.hot) || 0)) }); toast.ok('话题已更新'); onSaved(); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
      <input className="inp" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} placeholder="话题描述" style={{ width: '100%', marginTop: 14 }} />
      <input className="inp" value={f.cover} onChange={(e) => setF((s) => ({ ...s, cover: e.target.value }))} placeholder="封面图 URL（可选，发现页展示）" style={{ width: '100%', marginTop: 8 }} />
      <div className="row gap-12" style={{ marginTop: 8, justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="sec-field" style={{ width: 160 }}><span className="sec-label">热度（发现页排序）</span><input className="inp" type="number" min={0} value={f.hot} onChange={(e) => setF((s) => ({ ...s, hot: e.target.value }))} /></label>
        <div className="row gap-4">
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
          <SaveBtn onSave={save} />
        </div>
      </div>
    </div>
  );
}

function Topics() {
  const toast = useToast();
  const [topics, setTopics] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [stats, setStats] = useState<any>(null);
  const load = (query = q) => api.get('/topics', { params: { q: query || undefined, limit: 100 } }).then(({ data }) => setTopics(data.topics));
  useEffect(() => { load(); api.get('/topics/admin/stats').then(({ data }) => setStats(data)).catch(() => {}); }, []);
  const create = async () => { if (!form.name) return toast.err('话题名必填'); try { await api.post('/admin/topics', form); toast.ok('话题已创建'); setForm({ name: '', description: '' }); load(); } catch (e: any) { toast.err(e.message); } };
  const del = async (t: any) => { if (!(await confirmDialog(`删除话题 #${t.name}#?`))) return; try { await api.delete(`/admin/topics/${t.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const STAT_CARDS: [string, any][] = stats ? [
    ['话题总数', (stats.total ?? 0).toLocaleString()], ['话题动态', (stats.totalPosts ?? 0).toLocaleString()], ['关注总数', (stats.totalFollows ?? 0).toLocaleString()],
  ] : [];
  return (
    <>
      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', marginBottom: 'var(--gap)' }}>
          {STAT_CARDS.map(([k, v]) => (
            <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="inp" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="话题名（必填）" style={{ flex: 1, minWidth: 120 }} />
          <input className="inp" value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="描述" style={{ flex: 1, minWidth: 120 }} />
          <button className="btn btn-primary" onClick={create}>创建话题</button>
        </div>
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-8"><AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索话题名…" /></div>
        </div>
        {topics.length === 0 ? <Empty text={q.trim() ? '没有匹配的话题' : '还没有话题'} /> : topics.map((t, i) => (
          <div key={t.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px' }}>
              <div className="grow" style={{ minWidth: 0 }}><b>#{t.name}#</b> <span className="faint" style={{ fontSize: 12 }}>{fmtNum(t.post_count)}动态 · 热度{fmtNum(t.hot)}{t.cover ? ' · 有封面' : ''}</span></div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === t.id ? null : t.id)}>{editId === t.id ? '收起' : '编辑'}</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => del(t)}><Icon name="trash" size={14} /> 删除</button>
            </div>
            {editId === t.id && <TopicEditForm topic={t} onSaved={() => { setEditId(null); load(); }} onCancel={() => setEditId(null)} />}
          </div>
        ))}
      </div>
    </>
  );
}

function Reports() {
  const toast = useToast();
  const [reports, setReports] = useState<any[]>([]);
  const [status, setStatus] = useState('open');
  const load = (s = status) => api.get('/admin/reports', { params: { status: s } }).then(({ data }) => setReports(data.reports));
  useEffect(() => { load(); }, []);
  const pick = (s: string) => { setStatus(s); load(s); };
  const resolve = async (r: any) => { try { await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('已处理'); load(); } catch (e: any) { toast.err(e.message); } };
  const delContent = async (r: any) => {
    if (!(await confirmDialog('确定删除被举报的内容？此操作不可撤销'))) return;
    try { await api.delete(`/admin/content/${r.targetType}/${r.targetId}`); await api.post(`/admin/reports/${r.id}/resolve`); toast.ok('内容已删除并处理'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const TYPE: any = { post: '动态', thread: '帖子', comment: '评论', user: '用户' };
  const link = (r: any) => r.targetType === 'post' ? `/post/${r.targetId}` : r.targetType === 'thread' ? `/thread/${r.targetId}` : r.targetType === 'user' && r.target?.author ? `/u/${r.target.author.username}` : null;
  const resolved = status === 'resolved';
  return (
    <div className="flex flex-col gap-4">
      <div className="audit-filters">
        {[['open', '待处理'], ['resolved', '已处理']].map(([k, l]) => (
          <button key={k} className={`audit-chip${status === k ? ' active' : ''}`} onClick={() => pick(k)}>{l}</button>
        ))}
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        {!reports.length ? <Empty icon={resolved ? '📋' : '✅'} text={resolved ? '还没有已处理的举报' : '没有待处理的举报'} /> : reports.map((r, i) => (
          <div key={r.id}>{i > 0 && <div className="divider" />}
            <div style={{ padding: '14px 16px' }}>
              <div className="row gap-8" style={{ marginBottom: 8 }}>
                <span className="ui-badge badge-elite">{TYPE[r.targetType] || r.targetType}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.reason || '(未填写原因)'}</span>
                <span className="spacer" />
                <span className="faint" style={{ fontSize: 12 }}>{timeAgo(r.createdAt)}</span>
              </div>
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
                {!resolved && r.target?.exists && r.targetType !== 'user' && <button className="btn btn-ghost btn-sm danger" onClick={() => delContent(r)}><Icon name="trash" size={14} /> 删除内容</button>}
                {!resolved
                  ? <button className="btn btn-outline btn-sm" onClick={() => resolve(r)}>忽略</button>
                  : <span className="faint" style={{ fontSize: 12, color: 'var(--good)' }}>已处理</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 公告编辑（行内展开）：改 标题/补充说明/级别/跳转链接/按钮文字。后端 PUT /notices/:id（上线/置顶仍走行内快捷按钮）。
function NoticeEditForm({ item, onSaved, onCancel }: { item: any; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: item.title || '', body: item.body || '', level: item.level || 'info', link: item.link || '', linkLabel: item.linkLabel || '' });
  const save = async () => {
    if (!f.title.trim()) return toast.err('公告标题必填');
    try { await api.put(`/notices/${item.id}`, { title: f.title, body: f.body, level: f.level, link: f.link, linkLabel: f.linkLabel }); toast.ok('公告已更新'); onSaved(); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
      <div className="sec-grid" style={{ paddingTop: 14 }}>
        <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">标题 <i className="sec-req">*</i></span><input className="inp" maxLength={120} value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></label>
        <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">补充说明</span><textarea className="inp" rows={2} maxLength={500} value={f.body} onChange={(e) => setF((s) => ({ ...s, body: e.target.value }))} /></label>
        <label className="sec-field"><span className="sec-label">级别</span><select className="inp" value={f.level} onChange={(e) => setF((s) => ({ ...s, level: e.target.value }))}>{NOTICE_LEVELS.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}</select></label>
        <label className="sec-field"><span className="sec-label">跳转链接</span><input className="inp" maxLength={300} value={f.link} onChange={(e) => setF((s) => ({ ...s, link: e.target.value }))} placeholder="如 /events" /></label>
        <label className="sec-field"><span className="sec-label">按钮文字</span><input className="inp" maxLength={30} value={f.linkLabel} onChange={(e) => setF((s) => ({ ...s, linkLabel: e.target.value }))} placeholder="如 查看详情" /></label>
      </div>
      <div className="row gap-4" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
        <SaveBtn onSave={save} />
      </div>
    </div>
  );
}

function Notices() {
  const toast = useToast();
  const [list, setList] = useState<any[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({ title: '', body: '', level: 'info', link: '', linkLabel: '', pinned: false });
  const load = () => api.get('/notices/all').then(({ data }) => setList(data.notices)).catch(() => {});
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.title.trim()) return toast.err('公告标题必填');
    try { await api.post('/notices', form); toast.ok('公告已发布'); setForm({ title: '', body: '', level: 'info', link: '', linkLabel: '', pinned: false }); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const patch = async (n: any, p: any) => { try { await api.put(`/notices/${n.id}`, p); load(); } catch (e: any) { toast.err(e.message); } };
  const del = async (n: any) => { if (!(await confirmDialog(`删除公告「${n.title}」？`))) return; try { await api.delete(`/notices/${n.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div className="col gap-8">
          <input className="inp" value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="公告标题（必填）" style={{ width: '100%' }} />
          <input className="inp" value={form.body} onChange={(e) => setForm((f: any) => ({ ...f, body: e.target.value }))} placeholder="补充说明（选填）" style={{ width: '100%' }} />
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <select className="inp" value={form.level} onChange={(e) => setForm((f: any) => ({ ...f, level: e.target.value }))} style={{ minWidth: 110, width: 'auto' }}>
              {NOTICE_LEVELS.map((l) => <option key={l.k} value={l.k}>{l.l}</option>)}
            </select>
            <input className="inp" value={form.link} onChange={(e) => setForm((f: any) => ({ ...f, link: e.target.value }))} placeholder="跳转链接（选填，如 /events）" style={{ flex: 1, minWidth: 150 }} />
            <input className="inp" value={form.linkLabel} onChange={(e) => setForm((f: any) => ({ ...f, linkLabel: e.target.value }))} placeholder="按钮文字" style={{ width: 110 }} />
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
                <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === n.id ? null : n.id)}>{editId === n.id ? '收起' : '编辑'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => patch(n, { active: !n.active })}>{n.active ? '下线' : '上线'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => patch(n, { pinned: !n.pinned })}>{n.pinned ? '取消置顶' : '置顶'}</button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => del(n)}><Icon name="trash" size={14} /> 删除</button>
              </div>
            </div>
            {editId === n.id && <NoticeEditForm item={n} onSaved={() => { setEditId(null); load(); }} onCancel={() => setEditId(null)} />}
          </div>
        ))}
      </div>
    </>
  );
}

const PRODUCT_CATS = [
  { value: 'title', label: '头衔' },
  { value: 'frame', label: '头像框' },
  { value: 'item', label: '道具' },
  { value: 'physical', label: '其他' },
];
const PRODUCT_PRESETS: Record<string, { label: string; patch: any }[]> = {
  title: [
    { label: '社区元老', patch: { icon: '🏅', name: '社区元老', payload: '社区元老', price: 300, description: '兑换后自动佩戴该头衔' } },
    { label: '创作达人', patch: { icon: '✍️', name: '创作达人', payload: '创作达人', price: 500, description: '兑换后自动佩戴该头衔' } },
  ],
  frame: [
    { label: '#7C3AED 紫色框', patch: { icon: '🖼️', name: '头像框 · #7C3AED', payload: '#7C3AED', price: 260, description: '兑换后头像外框显示为 #7C3AED' } },
    { label: '#F97316 暖橙框', patch: { icon: '🖼️', name: '头像框 · #F97316', payload: '#F97316', price: 260, description: '兑换后头像外框显示为 #F97316' } },
  ],
  item: [
    { label: '动态置顶 60 分钟', patch: { icon: '📌', name: '动态置顶卡 · 60 分钟', payload: 'pin:60', price: 80, description: '兑换后可将自己的一条动态全站置顶 60 分钟' } },
    { label: '动态置顶 24 小时', patch: { icon: '📌', name: '动态置顶卡 · 24 小时', payload: 'pin:1440', price: 300, description: '兑换后可将自己的一条动态全站置顶 24 小时' } },
    { label: '改名卡', patch: { icon: '✏️', name: '改名卡', payload: 'rename', price: 200, description: '兑换后可修改一次用户名或昵称' } },
  ],
  physical: [
    { label: '兑换码', patch: { icon: '🎫', name: '兑换码 · 会员月卡', payload: 'CODE-XXXX-XXXX', price: 600, stock: 1, description: '购买后在我的兑换里显示兑换码或发放内容' } },
    { label: '自定义发放', patch: { icon: '🎁', name: '其他 · 自定义奖励', payload: '请填写发放内容', price: 100, stock: -1, description: '购买后在我的兑换里显示发放内容' } },
  ],
};
const PRODUCT_FRAME_COLORS = ['#7C3AED', '#F97316', '#22C55E', '#0EA5E9', '#E11D48'];
const PRODUCT_PAYLOAD_LABEL: Record<string, string> = { title: '头衔名称', frame: '头像框颜色', item: '道具标识', physical: '兑换码 / 发放内容' };
const PRODUCT_PAYLOAD_PLACEHOLDER: Record<string, string> = {
  title: '例如：社区元老',
  frame: '例如：#7C3AED',
  item: '例如：pin:60 或 rename',
  physical: '例如：CODE-XXXX-XXXX',
};
const PRODUCT_HELP: Record<string, string> = {
  title: '头衔商品：商品名和发放内容通常都填写同一个头衔名称，用户兑换后自动佩戴。',
  frame: '头像框商品：商品名可写“头像框 · #7C3AED”，发放内容填写颜色代码，用户兑换后头像外框会应用该颜色。',
  item: '道具商品：置顶卡填写 pin:分钟数，例如 pin:60；改名卡填写 rename，可修改一次用户名或昵称。',
  physical: '其他商品：适合兑换码、会员码、人工发放内容；用户购买后在“我的兑换”中查看发放内容。',
};
const MALL_CAT: Record<string, string> = { title: '头衔', frame: '头像框', item: '道具', physical: '其他' };
const productCatLabel = (category?: string) => MALL_CAT[category || ''] || category || '—';

function ProductPresets({ category, onPick }: { category: string; onPick: (patch: any) => void }) {
  const presets = PRODUCT_PRESETS[category] || [];
  if (!presets.length) return null;
  return (
    <div className="row gap-6" style={{ flexWrap: 'wrap', marginTop: 8 }}>
      <span className="faint" style={{ fontSize: 12 }}>示例</span>
      {presets.map((p) => (
        <button key={p.label} className="btn btn-ghost btn-sm" onClick={() => onPick(p.patch)}>{p.label}</button>
      ))}
    </div>
  );
}

function ProductFrameSwatches({ setF }: { setF: any }) {
  return (
    <div className="row gap-6" style={{ flexWrap: 'wrap', marginTop: 8 }}>
      <span className="faint" style={{ fontSize: 12 }}>颜色</span>
      {PRODUCT_FRAME_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={`选择头像框颜色 ${c}`}
          onClick={() => setF((s: any) => ({ ...s, name: s.name?.trim() ? s.name : `头像框 · ${c}`, payload: c, description: s.description?.trim() ? s.description : `兑换后头像外框显示为 ${c}` }))}
          style={{ width: 24, height: 24, borderRadius: 8, border: '2px solid var(--surface)', boxShadow: '0 0 0 1px var(--line)', background: c }}
        />
      ))}
    </div>
  );
}

function ProductExtraFields({ f, setF }: { f: any; setF: any }) {
  return (
    <>
      <ProductPresets category={f.category} onPick={(patch) => setF((s: any) => ({ ...s, ...patch }))} />
      {f.category === 'frame' && <ProductFrameSwatches setF={setF} />}
      <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        <label className="sec-field" style={{ flex: '1 1 220px' }}>
          <span className="sec-label">{PRODUCT_PAYLOAD_LABEL[f.category] || '发放内容'}</span>
          <input className="inp" value={f.payload || ''} onChange={(e) => setF((s: any) => ({ ...s, payload: e.target.value }))} placeholder={PRODUCT_PAYLOAD_PLACEHOLDER[f.category] || '兑换后发放给用户的内容'} />
        </label>
        <label className="sec-field" style={{ flex: '2 1 260px' }}>
          <span className="sec-label">商品说明</span>
          <input className="inp" value={f.description || ''} onChange={(e) => setF((s: any) => ({ ...s, description: e.target.value }))} placeholder="展示给用户看的说明" />
        </label>
      </div>
      <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>{PRODUCT_HELP[f.category] || PRODUCT_HELP.item}</div>
    </>
  );
}

// 商品编辑（行内展开）：改 图标/名称/分类/价格/库存/说明/发放内容。后端 PUT /admin/products/:id（库存 -1=不限）。
function ProductEditForm({ product, onSaved, onCancel }: { product: any; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ icon: product.icon || '', name: product.name || '', category: product.category || 'item', price: String(product.price ?? 0), stock: String(product.stock ?? -1), description: product.description || '', payload: product.payload || '' });
  const save = async () => {
    if (!f.name.trim()) return toast.err('名称必填');
    try {
      await api.put(`/admin/products/${product.id}`, {
        name: f.name.trim(),
        icon: f.icon,
        category: f.category,
        payload: f.payload,
        price: Math.max(0, Math.round(Number(f.price) || 0)),
        stock: Math.max(-1, Math.round(Number(f.stock))),
        description: f.description,
      });
      toast.ok('商品已更新'); onSaved();
    } catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 16px 16px', background: 'var(--surface-2)' }}>
      <div className="row gap-8" style={{ flexWrap: 'wrap', paddingTop: 14 }}>
        <input className="inp" value={f.icon} onChange={(e) => setF((s) => ({ ...s, icon: e.target.value }))} style={{ width: 56, textAlign: 'center' }} />
        <input className="inp" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} placeholder="商品名（必填）" style={{ flex: 1, minWidth: 160 }} />
        <select className="inp" value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))} style={{ width: 'auto' }}>
          {PRODUCT_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="row gap-8" style={{ flexWrap: 'wrap', marginTop: 8 }}>
        <label className="sec-field" style={{ width: 130 }}><span className="sec-label">价格（积分）</span><input className="inp" type="number" min={0} value={f.price} onChange={(e) => setF((s) => ({ ...s, price: e.target.value }))} /></label>
        <label className="sec-field" style={{ width: 150 }}><span className="sec-label">库存（-1 不限）</span><input className="inp" type="number" min={-1} value={f.stock} onChange={(e) => setF((s) => ({ ...s, stock: e.target.value }))} /></label>
      </div>
      <ProductExtraFields f={f} setF={setF} />
      <div className="row gap-4" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
        <SaveBtn onSave={save} />
      </div>
    </div>
  );
}

// 商城兑换记录：累计兑换 / 消耗积分 + 近 50 笔（其他类商品标记「待发放」，便于履约）。
function MallOrders() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/mall/admin/orders').then(({ data }) => setData(data)).catch(() => setData({ stats: {}, orders: [] })); }, []);
  if (data === null) return <RowSkeleton rows={3} />;
  const s = data.stats || {};
  const STAT: [string, string][] = [['累计兑换', (s.total || 0).toLocaleString()], ['消耗积分', (s.pointsSpent || 0).toLocaleString()]];
  return (
    <div className="flex flex-col gap-4">
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {STAT.map(([k, v]) => (
          <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
            <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ListHead title="兑换记录" count={data.orders.length} action={
          <button className="btn btn-ghost btn-sm" disabled={!data.orders.length} onClick={() => downloadCSV('兑换记录.csv', [
            { label: '用户', get: (o) => o.user?.nickname || '' }, { label: '商品', get: (o) => o.product?.name || '' }, { label: '分类', get: (o) => productCatLabel(o.product?.category) }, { label: '发放内容', get: (o) => o.product?.payload || '' }, { label: '积分', get: (o) => o.price }, { label: '时间', get: (o) => o.createdAt },
          ], data.orders)}>导出 CSV</button>
        } />
        {data.orders.length === 0 ? <Empty text="还没有兑换记录" /> : data.orders.map((o: any, i: number) => {
          const deliverable = o.product?.category === 'physical';
          return (
            <div key={o.id}>
              {i > 0 && <div className="divider" />}
              <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'center' }}>
                <span style={{ fontSize: 20 }}>{o.product?.icon || '🎁'}</span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-6" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{o.product?.name || '已下架商品'}</span>
                    <span className="ui-badge" style={deliverable ? { background: 'color-mix(in srgb, var(--like) 13%, transparent)', color: 'var(--like)' } : undefined}>{productCatLabel(o.product?.category)}</span>
                    {deliverable && <span className="faint" style={{ fontSize: 11.5, color: 'var(--like)' }}>待发放</span>}
                  </div>
                  <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{o.user?.nickname || '已删除用户'} · {timeAgo(o.createdAt)}</div>
                  {deliverable && o.product?.payload && <div className="faint num" style={{ fontSize: 12, marginTop: 3, wordBreak: 'break-all' }}>发放内容：{o.product.payload}</div>}
                </div>
                <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>-{fmtNum(o.price)} 分</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Products() {
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState<any>({ name: '', icon: '🎁', category: 'item', price: 100, stock: -1, description: '', payload: '' });
  const [editId, setEditId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/mall/products', { params: { q: query || undefined } }).then(({ data }) => setProducts(data.products));
  useEffect(() => { load(); }, []);
  const create = async () => {
    if (!form.name.trim()) return toast.err('名称必填');
    try {
      await api.post('/admin/products', {
        ...form,
        name: form.name.trim(),
        payload: form.payload || (form.category === 'title' ? form.name.trim() : ''),
        price: Math.max(0, Math.round(Number(form.price) || 0)),
        stock: Math.max(-1, Math.round(Number(form.stock))),
      });
      toast.ok('商品已上架');
      setForm({ name: '', icon: '🎁', category: 'item', price: 100, stock: -1, description: '', payload: '' });
      load();
    } catch (e: any) { toast.err(e.message); }
  };
  const del = async (p: any) => { if (!(await confirmDialog(`下架「${p.name}」?`))) return; try { await api.delete(`/admin/products/${p.id}`); toast.ok('已下架'); load(); } catch (e: any) { toast.err(e.message); } };
  return (
    <>
      <div className="ui-card" style={{ padding: 16, marginBottom: 'var(--gap)' }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>上架商品</div>
        <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="inp" value={form.icon} onChange={(e) => setForm((f: any) => ({ ...f, icon: e.target.value }))} style={{ width: 56, textAlign: 'center' }} />
          <input className="inp" value={form.name} onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="商品名（必填）" style={{ flex: 1, minWidth: 160 }} />
          <select className="inp" value={form.category} onChange={(e) => setForm((f: any) => ({ ...f, category: e.target.value }))} style={{ width: 'auto' }}>
            {PRODUCT_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="inp" type="number" value={form.price} onChange={(e) => setForm((f: any) => ({ ...f, price: e.target.value }))} placeholder="积分" style={{ width: 100 }} />
          <input className="inp" type="number" value={form.stock} onChange={(e) => setForm((f: any) => ({ ...f, stock: e.target.value }))} placeholder="库存" style={{ width: 100 }} />
          <button className="btn btn-primary" onClick={create}>上架</button>
        </div>
        <ProductExtraFields f={form} setF={setForm} />
      </div>
      <div className="ui-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-8"><AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索商品名…" /></div>
        </div>
        {products.length === 0 ? <Empty text={q.trim() ? '没有匹配的商品' : '还没有商品'} /> : products.map((p, i) => (
          <div key={p.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 16px', alignItems: 'center' }}>
              <span style={{ fontSize: 22 }}>{p.icon}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-6" style={{ flexWrap: 'wrap' }}>
                  <b>{p.name}</b>
                  <span className="ui-badge">{productCatLabel(p.category)}</span>
                </div>
                <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{p.price}积分 · 已售{p.sold}{p.stock >= 0 ? ` · 余${Math.max(0, p.stock - p.sold)}` : ''}</div>
                {p.payload && <div className="faint num" style={{ fontSize: 12, marginTop: 2, wordBreak: 'break-all' }}>发放：{p.payload}</div>}
                {p.description && <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>{p.description}</div>}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === p.id ? null : p.id)}>{editId === p.id ? '收起' : '编辑'}</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => del(p)}><Icon name="trash" size={14} /> 下架</button>
            </div>
            {editId === p.id && <ProductEditForm product={p} onSaved={() => { setEditId(null); load(); }} onCancel={() => setEditId(null)} />}
          </div>
        ))}
      </div>
      <div className="sec-head" style={{ marginTop: 6 }}>兑换记录</div>
      <MallOrders />
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

const EXTERNAL_SYNC_GROUPS = [
  { k: 'vip3', l: 'VIP3 或管理员' },
  { k: 'admin', l: '仅管理员' },
  { k: 'vip', l: 'VIP 或管理员' },
  { k: 'all', l: '全部用户' },
];

function ExternalSyncAdmin() {
  const toast = useToast();
  const [data, setData] = useState<any | null>(null);
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingSource, setSavingSource] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [form, setForm] = useState<any>({
    id: null,
    name: '',
    rssUrl: '',
    targetType: 'post',
    userId: '',
    boardId: '',
    template: '',
    enabled: true,
    maxImages: '3',
    fetchIntervalMin: '60',
  });

  const load = async () => {
    const [syncRes, cfgRes] = await Promise.all([
      api.get('/external-sync/admin'),
      api.get('/admin/config'),
    ]);
    setData(syncRes.data);
    setCfg(cfgRes.data.config || {});
    setForm((f: any) => f.template ? f : { ...f, template: syncRes.data.defaultTemplate || '' });
  };
  useEffect(() => { load().catch(() => { setData({ sources: [], imports: [], boards: [], defaultTemplate: '' }); setCfg({}); }); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const setF = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const resetForm = () => setForm({
    id: null,
    name: '',
    rssUrl: '',
    targetType: 'post',
    userId: '',
    boardId: '',
    template: data?.defaultTemplate || '',
    enabled: true,
    maxImages: '3',
    fetchIntervalMin: '60',
  });
  const editSource = (s: any) => setForm({
    id: s.id,
    name: s.name || '',
    rssUrl: s.rssUrl || '',
    targetType: s.targetType || 'post',
    userId: String(s.userId || ''),
    boardId: String(s.boardId || ''),
    template: s.template || data?.defaultTemplate || '',
    enabled: !!s.enabled,
    maxImages: String(s.maxImages ?? 3),
    fetchIntervalMin: String(s.fetchIntervalMin ?? 60),
  });

  const saveCfg = async () => {
    if (!cfg) return;
    setSavingCfg(true);
    try {
      await api.put('/admin/config', { config: {
        external_sync_enabled: cfg.external_sync_enabled === '1' ? '1' : '0',
        external_sync_allowed_group: cfg.external_sync_allowed_group || 'vip3',
        external_sync_min_level: cfg.external_sync_min_level || '0',
        external_sync_cost_per_post: cfg.external_sync_cost_per_post || '0',
        external_sync_max_items_per_fetch: cfg.external_sync_max_items_per_fetch || '5',
        external_sync_content_excerpt_len: cfg.external_sync_content_excerpt_len || '120',
      } });
      toast.ok('站外同步配置已保存');
    } catch (e: any) { toast.err(e.message); }
    finally { setSavingCfg(false); }
  };

  const saveSource = async () => {
    if (!form.name.trim()) return toast.err('请填写订阅源名称');
    if (!form.rssUrl.trim()) return toast.err('请填写 RSS 地址');
    if (!Number(form.userId)) return toast.err('请填写绑定用户 ID');
    if (form.targetType === 'thread' && !Number(form.boardId)) return toast.err('请选择导入板块');
    setSavingSource(true);
    const payload = {
      name: form.name.trim(),
      rssUrl: form.rssUrl.trim(),
      userId: Number(form.userId),
      targetType: form.targetType || 'post',
      boardId: form.targetType === 'thread' ? Number(form.boardId) : 0,
      template: form.template || data?.defaultTemplate || '',
      enabled: !!form.enabled,
      maxImages: Math.max(0, Math.min(9, Math.round(Number(form.maxImages) || 0))),
      fetchIntervalMin: Math.max(10, Math.min(1440, Math.round(Number(form.fetchIntervalMin) || 60))),
    };
    try {
      if (form.id) await api.put(`/external-sync/sources/${form.id}`, payload);
      else await api.post('/external-sync/sources', payload);
      toast.ok(form.id ? '订阅源已更新' : '订阅源已创建');
      resetForm();
      await load();
    } catch (e: any) { toast.err(e.message); }
    finally { setSavingSource(false); }
  };

  const removeSource = async (s: any) => {
    if (!(await confirmDialog(`删除订阅源「${s.name}」？已同步记录也会清理。`))) return;
    try {
      await api.delete(`/external-sync/sources/${s.id}`);
      toast.ok('订阅源已删除');
      await load();
    } catch (e: any) { toast.err(e.message); }
  };
  const fetchSource = async (s: any) => {
    setBusyId(s.id);
    try {
      const { data: res } = await api.post(`/external-sync/sources/${s.id}/fetch`);
      toast.ok(`同步完成：新增 ${res.imported || 0}，跳过 ${res.skipped || 0}，失败 ${res.failed || 0}`);
      if (res.errors?.length) toast.err(res.errors.slice(0, 2).join('；'));
      await load();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusyId(null); }
  };
  const clearImports = async () => {
    if (!(await confirmDialog('清空后后台列表不再显示这些记录，但仍会保留去重信息，避免旧 RSS 内容重复导入。', { title: '清空同步记录？', confirmText: '清空' }))) return;
    try {
      const { data: res } = await api.delete('/external-sync/imports');
      toast.ok(`已清空 ${res.cleared || 0} 条记录`);
      await load();
    } catch (e: any) { toast.err(e.message); }
  };

  if (!data || !cfg) return <RowSkeleton rows={8} />;
  const enabled = cfg.external_sync_enabled === '1';
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>RSS 订阅同步</div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>开启后系统会按订阅源定时抓取文章，默认发布为用户动态。可用用户组、最低等级和每篇积分消耗限制同步账号。</div>
          </div>
          <Toggle on={enabled} onChange={(v) => setK('external_sync_enabled', v ? '1' : '0')} />
        </div>
        <div className="sec-grid">
          <label className="sec-field">
            <span className="sec-label">开放用户组</span>
            <select className="inp" value={cfg.external_sync_allowed_group || 'vip3'} onChange={(e) => setK('external_sync_allowed_group', e.target.value)}>
              {EXTERNAL_SYNC_GROUPS.map((g) => <option key={g.k} value={g.k}>{g.l}</option>)}
            </select>
          </label>
          <label className="sec-field">
            <span className="sec-label">最低等级</span>
            <input className="inp" type="number" min={0} max={60} value={cfg.external_sync_min_level || '0'} onChange={(e) => setK('external_sync_min_level', e.target.value)} />
          </label>
          <label className="sec-field">
            <span className="sec-label">每篇消耗积分</span>
            <input className="inp" type="number" min={0} value={cfg.external_sync_cost_per_post || '0'} onChange={(e) => setK('external_sync_cost_per_post', e.target.value)} />
          </label>
          <label className="sec-field">
            <span className="sec-label">单次最多导入</span>
            <input className="inp" type="number" min={1} max={20} value={cfg.external_sync_max_items_per_fetch || '5'} onChange={(e) => setK('external_sync_max_items_per_fetch', e.target.value)} />
          </label>
          <label className="sec-field">
            <span className="sec-label">内容截取长度</span>
            <input className="inp" type="number" min={20} max={2000} value={cfg.external_sync_content_excerpt_len || '120'} onChange={(e) => setK('external_sync_content_excerpt_len', e.target.value)} />
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn btn-primary" onClick={saveCfg} disabled={savingCfg}>{savingCfg ? '保存中...' : '保存配置'}</button>
        </div>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{form.id ? '编辑订阅源' : '新增订阅源'}</div>
          {form.id && <button className="btn btn-ghost btn-sm" onClick={resetForm}>取消编辑</button>}
        </div>
        <div className="sec-grid">
          <label className="sec-field"><span className="sec-label">名称</span><input className="inp" value={form.name} onChange={(e) => setF('name', e.target.value)} placeholder="例如：个人博客" /></label>
          <label className="sec-field"><span className="sec-label">RSS 地址</span><input className="inp" value={form.rssUrl} onChange={(e) => setF('rssUrl', e.target.value)} placeholder="https://example.com/feed.xml" /></label>
          <label className="sec-field"><span className="sec-label">绑定用户 ID</span><input className="inp" type="number" min={1} value={form.userId} onChange={(e) => setF('userId', e.target.value)} placeholder="同步内容发布者" /></label>
          <label className="sec-field"><span className="sec-label">发布目标</span><select className="inp" value={form.targetType || 'post'} onChange={(e) => setF('targetType', e.target.value)}><option value="post">用户动态</option><option value="thread">论坛帖子</option></select></label>
          {form.targetType === 'thread' && <label className="sec-field"><span className="sec-label">导入板块</span><select className="inp" value={form.boardId} onChange={(e) => setF('boardId', e.target.value)}><option value="">选择论坛板块</option>{data.boards.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>}
          <label className="sec-field"><span className="sec-label">本地化图片数</span><input className="inp" type="number" min={0} max={9} value={form.maxImages} onChange={(e) => setF('maxImages', e.target.value)} /></label>
          <label className="sec-field"><span className="sec-label">抓取间隔（分钟）</span><input className="inp" type="number" min={10} max={1440} value={form.fetchIntervalMin} onChange={(e) => setF('fetchIntervalMin', e.target.value)} /></label>
        </div>
        <label className="field" style={{ display: 'block', marginTop: 12 }}>
          <span className="sec-label">{form.targetType === 'thread' ? '发帖模板' : '动态模板'}</span>
          <textarea className="inp" rows={4} value={form.template} onChange={(e) => setF('template', e.target.value)} style={{ width: '100%', marginTop: 8, lineHeight: 1.6 }} placeholder="{title}&#10;&#10;{summary}&#10;&#10;原文：{sourceUrl}" />
          <span className="faint" style={{ fontSize: 12 }}>可用变量：{'{title}'}、{'{summary}'}、{'{content}'}、{'{sourceUrl}'}；{'{content}'} 会按后台“内容截取长度”自动截断。</span>
        </label>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          <span className="row gap-8" style={{ fontSize: 13 }}><Toggle on={!!form.enabled} onChange={(v) => setF('enabled', v)} /> 启用该订阅源</span>
          <button className="btn btn-primary" onClick={saveSource} disabled={savingSource}>{savingSource ? '保存中...' : (form.id ? '保存订阅源' : '创建订阅源')}</button>
        </div>
      </div>

      <div className="ui-card" style={{ overflow: 'hidden' }}>
        <ListHead title="订阅源" count={data.sources.length} />
        {data.sources.length === 0 ? <Empty text="还没有 RSS 订阅源" /> : data.sources.map((s: any, i: number) => (
          <div key={s.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'flex-start' }}>
              <span className="stat-ic" style={{ color: s.enabled ? 'var(--good)' : 'var(--ink-3)', background: 'var(--surface-2)' }}><Icon name="link" size={15} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{s.name} <span className="faint" style={{ fontSize: 12 }}>{s.enabled ? '启用' : '停用'}</span></div>
                <div className="faint" style={{ fontSize: 12.5, marginTop: 3, wordBreak: 'break-all' }}>{s.rssUrl}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>发布者：{s.userNickname} · 目标：{s.targetType === 'thread' ? `论坛 / ${s.boardName}` : '用户动态'} · 间隔 {s.fetchIntervalMin} 分钟 · 上次同步：{s.lastFetchedAt ? timeAgo(s.lastFetchedAt) : '未同步'}</div>
              </div>
              <div className="row gap-4" style={{ flex: 'none', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => fetchSource(s)} disabled={busyId === s.id}>{busyId === s.id ? '同步中...' : '手动同步'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => editSource(s)}>编辑</button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => removeSource(s)}><Icon name="trash" size={14} /> 删除</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="ui-card" style={{ overflow: 'hidden' }}>
        <ListHead title="最近导入" count={data.imports.length} action={
          <button className="btn btn-ghost btn-sm danger" disabled={!data.imports.length} onClick={clearImports}><Icon name="trash" size={14} /> 清空记录</button>
        } />
        {data.imports.length === 0 ? <Empty text="暂无导入记录" /> : data.imports.map((r: any, i: number) => (
          <div key={r.id}>{i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 18px' }}>
              <span className="badge">{r.status}</span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{r.sourceName} · {timeAgo(r.createdAt)}</div>
              </div>
              {r.postId && <Link className="btn btn-ghost btn-sm" to={`/post/${r.postId}`}>查看动态</Link>}
              {!r.postId && r.threadId && <Link className="btn btn-ghost btn-sm" to={`/thread/${r.threadId}`}>查看帖子</Link>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERM_ACTIONS: [string, string][] = [
  ['comment', '评论'], ['dm', '私信'], ['upload', '上传图片 / 视频'], ['post', '发布动态'], ['thread', '发帖'],
];
// section 用于在「安全」tab 内按主题分组（注册验证此前被埋在中间，用户反馈找不到 → 提到最前并加分组标题）。
const SEC_GROUPS: any[] = [
  { section: '注册与登录安全', title: '邮箱验证注册', desc: '需先配置邮件服务（SMTP）后再开启，否则验证码无法送达。', toggles: [
    ['email_verify_enabled', '启用邮箱验证码功能'], ['require_email_verify', '注册时强制邮箱验证'],
  ] },
  { section: '注册与登录安全', title: '防批量注册', desc: '限制同一 IP 的注册行为，拦截批量刷号。', toggle: 'anti_bulk_reg_enabled', nums: [
    ['reg_ip_max_per_day', '每个 IP 每日注册上限', '个'], ['reg_min_interval_sec', '两次注册最小间隔', '秒'],
  ] },
  { section: '内容与频率', title: '发帖 / 私信频率限制', desc: '防止刷屏与骚扰；管理员不受限制。', toggle: 'rate_limit_enabled', nums: [
    ['rate_post_per_min', '每分钟发帖上限', '条'], ['rate_post_per_hour', '每小时发帖上限', '条'],
    ['rate_thread_per_min', '每分钟发帖子上限', '个'], ['rate_dm_per_min', '每分钟私信上限', '条'],
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
  let lastSection = '';
  return (
    <div className="flex flex-col gap-4">
      {SEC_GROUPS.map((g) => {
        const head = g.section && g.section !== lastSection ? g.section : null;
        lastSection = g.section || lastSection;
        return (
        <Fragment key={g.title}>
          {head && <div className="sec-head" style={{ marginTop: 2 }}>{head}</div>}
          <div className="ui-card" style={{ padding: 18 }}>
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
        </Fragment>
      ); })}

      <div className="sec-head" style={{ marginTop: 2 }}>权限与内容过滤</div>
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
            <textarea className="inp" value={cfg.sensitive_words ?? ''} onChange={(e) => setK('sensitive_words', e.target.value)} rows={5}
              placeholder="每行一个，或用逗号 / 顿号分隔，例如：&#10;违禁词1，违禁词2&#10;违禁词3"
              style={{ width: '100%', marginTop: 8, lineHeight: 1.6 }} maxLength={8000} />
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
          {(() => { let lastG = ''; return MODULE_LIST.map(([k, label, icon, g]) => {
            const head = g !== lastG ? g : null; lastG = g;
            return (
              <Fragment key={k}>
                {head && <div className="mod-group-head">{head}</div>}
                <div className="row" style={{ justifyContent: 'space-between', gap: 12 }}>
                  <span className="row gap-8" style={{ fontSize: 13.5 }}><Icon name={icon} size={16} style={{ color: 'var(--ink-3)' }} /> {label}</span>
                  <Toggle on={isOn(k)} onChange={(v) => setK(`module_${k}`, v ? '1' : '0')} />
                </div>
              </Fragment>
            );
          }); })()}
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

// B 端搜索框（design.md Arco 搜索）：放大镜图标前缀 + 控件等高 36px。各 tab 列表搜索统一用它。
function AdminSearch({ value, onChange, onSearch, placeholder }: { value: string; onChange: (v: string) => void; onSearch: () => void; placeholder: string }) {
  return (
    <>
      <div className="admin-search">
        <Icon name="search" size={15} />
        <input className="inp" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onSearch()} placeholder={placeholder} />
      </div>
      <button className="btn btn-ghost" onClick={onSearch}>搜索</button>
    </>
  );
}

// 带忙碌态的保存按钮：点击后禁用 + 显示「保存中…」，避免重复提交；卸载安全（行内编辑保存成功会收起表单）。
function SaveBtn({ onSave, label = '保存', className = 'btn btn-sm btn-primary' }: { onSave: () => Promise<any> | void; label?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  return (
    <button className={className} disabled={busy} onClick={async () => {
      if (busy) return;
      setBusy(true);
      try { await onSave(); } finally { if (mounted.current) setBusy(false); }
    }}>{busy ? '保存中…' : label}</button>
  );
}

// 资讯快报后台：发布 / 置顶 / 删除快报（前台 /flash 展示）。
const FLASH_CATS = ['公告', '功能', '活动', '精选', '教程', '动态'];
function FlashEditForm({ item, onSaved, onCancel }: { item: any; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ title: item.title || '', summary: item.summary || '', category: item.category || '公告', url: item.url || '', pinned: !!item.pinned });
  const save = async () => {
    if (f.title.trim().length < 2) return toast.err('标题至少 2 个字');
    try { await api.put(`/flash/${item.id}`, { title: f.title, summary: f.summary, category: f.category, url: f.url, pinned: f.pinned }); toast.ok('快报已更新'); onSaved(); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div style={{ padding: '0 18px 16px', background: 'var(--surface-2)' }}>
      <div className="sec-grid" style={{ paddingTop: 14 }}>
        <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">标题 <i className="sec-req">*</i></span><input className="inp" maxLength={120} value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} /></label>
        <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">摘要</span><textarea className="inp" rows={2} maxLength={300} value={f.summary} onChange={(e) => setF((s) => ({ ...s, summary: e.target.value }))} /></label>
        <label className="sec-field"><span className="sec-label">分类</span><select className="inp" value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}>{FLASH_CATS.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="sec-field"><span className="sec-label">链接</span><input className="inp" maxLength={300} value={f.url} onChange={(e) => setF((s) => ({ ...s, url: e.target.value }))} placeholder="https://…" /></label>
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
        <label className="row gap-8" style={{ fontSize: 13.5 }}><Toggle on={f.pinned} onChange={(v) => setF((s) => ({ ...s, pinned: v }))} /> 置顶</label>
        <div className="row gap-4">
          <button className="btn btn-sm btn-ghost" onClick={onCancel}>取消</button>
          <SaveBtn onSave={save} />
        </div>
      </div>
    </div>
  );
}

function FlashAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [form, setForm] = useState({ title: '', summary: '', category: '公告', url: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/flash', { params: { limit: 50, q: query || undefined } }).then(({ data }) => setList(data.flash)).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const publish = async () => {
    if (form.title.trim().length < 2) return toast.err('标题至少 2 个字');
    setSaving(true);
    try { await api.post('/flash', form); toast.ok('快报已发布'); setForm({ title: '', summary: '', category: form.category, url: '', pinned: false }); load(); }
    catch (e: any) { toast.err(e.message); } finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (!(await confirmDialog('删除这条快报？'))) return;
    try { await api.delete(`/flash/${id}`); setList((l) => (l || []).filter((x) => x.id !== id)); toast.ok('已删除'); }
    catch (e: any) { toast.err(e.message); }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>发布快报</div>
        <div className="sec-grid">
          <label className="sec-field" style={{ gridColumn: '1 / -1' }}><span className="sec-label">标题 <i className="sec-req">*</i></span><input className="inp" maxLength={120} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="一句话快报标题" /></label>
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
        <div style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-8"><AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索快报标题…" /></div>
        </div>
        <ListHead title="已发布" count={list?.length ?? 0} />
        {list === null ? <RowSkeleton rows={5} /> : list.length === 0 ? <Empty text={q.trim() ? '没有匹配的快报' : '还没有快报，发布第一条吧'} /> : list.map((f, i) => (
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
              <button className="btn btn-ghost btn-sm" onClick={() => setEditId(editId === f.id ? null : f.id)}>{editId === f.id ? '收起' : '编辑'}</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(f.id)}><Icon name="trash" size={14} /> 删除</button>
            </div>
            {editId === f.id && <FlashEditForm item={f} onSaved={() => { setEditId(null); load(); }} onCancel={() => setEditId(null)} />}
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
  const delCat = async (id: number) => { if (!(await confirmDialog('删除该分类及其下所有链接？'))) return; try { await api.delete(`/nav/categories/${id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const setLF = (cid: number, k: string, v: string) => setNewLink((s) => {
    const prev = s[cid] || { title: '', url: '' }; // 缺省保证 title/url 存在，再合并已填值与本次编辑
    return { ...s, [cid]: { ...prev, [k]: v } };
  });
  const addLink = async (cid: number) => {
    const f = newLink[cid] || { title: '', url: '' };
    if (!f.title?.trim() || !f.url?.trim()) return toast.err('网站名和链接必填');
    try { await api.post('/nav/links', { categoryId: cid, title: f.title, url: f.url }); setNewLink((s) => ({ ...s, [cid]: { title: '', url: '' } })); toast.ok('已添加链接'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const delLink = async (id: number) => { try { await api.delete(`/nav/links/${id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); } };
  const [editLink, setEditLink] = useState<number | null>(null);
  const [editLinkVals, setEditLinkVals] = useState({ title: '', url: '' });
  const saveLink = async (id: number) => {
    if (!editLinkVals.title.trim() || !editLinkVals.url.trim()) return toast.err('网站名和链接必填');
    try { await api.put(`/nav/links/${id}`, { title: editLinkVals.title, url: editLinkVals.url }); setEditLink(null); toast.ok('链接已更新'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
  const [editCat, setEditCat] = useState<number | null>(null);
  const [editCatVals, setEditCatVals] = useState({ name: '', icon: '' });
  const saveCat = async (id: number) => {
    if (!editCatVals.name.trim()) return toast.err('分类名必填');
    try { await api.put(`/nav/categories/${id}`, { name: editCatVals.name, icon: editCatVals.icon || 'compass' }); setEditCat(null); toast.ok('分类已更新'); load(); }
    catch (e: any) { toast.err(e.message); }
  };
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
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            {editCat === c.id ? (
              <span className="row gap-8" style={{ flexWrap: 'wrap' }}>
                <input className="inp" style={{ maxWidth: 180 }} maxLength={20} value={editCatVals.name} onChange={(e) => setEditCatVals((v) => ({ ...v, name: e.target.value }))} placeholder="分类名" />
                <input className="inp" style={{ maxWidth: 140 }} value={editCatVals.icon} onChange={(e) => setEditCatVals((v) => ({ ...v, icon: e.target.value }))} placeholder="图标" />
                <SaveBtn onSave={() => saveCat(c.id)} />
                <button className="btn btn-ghost btn-sm" onClick={() => setEditCat(null)}>取消</button>
              </span>
            ) : (
              <span className="row gap-8" style={{ fontWeight: 700 }}><Icon name={c.icon || 'compass'} size={16} /> {c.name} <span className="faint" style={{ fontSize: 12 }}>（{c.links.length}）</span></span>
            )}
            {editCat !== c.id && (
              <span className="row gap-4">
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditCat(c.id); setEditCatVals({ name: c.name, icon: c.icon || 'compass' }); }}>编辑</button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => delCat(c.id)}><Icon name="trash" size={14} /> 删分类</button>
              </span>
            )}
          </div>
          {c.links.map((l: any) => (
            editLink === l.id ? (
              <div className="row gap-8" key={l.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
                <input className="inp" style={{ maxWidth: 160 }} maxLength={40} value={editLinkVals.title} onChange={(e) => setEditLinkVals((v) => ({ ...v, title: e.target.value }))} placeholder="网站名" />
                <input className="inp grow" maxLength={300} value={editLinkVals.url} onChange={(e) => setEditLinkVals((v) => ({ ...v, url: e.target.value }))} placeholder="https://…" />
                <SaveBtn onSave={() => saveLink(l.id)} />
                <button className="btn btn-ghost btn-sm" onClick={() => setEditLink(null)}>取消</button>
              </div>
            ) : (
              <div className="row gap-8" key={l.id} style={{ padding: '7px 0', borderTop: '1px solid var(--line)' }}>
                <span className="grow nowrap" style={{ minWidth: 0, fontSize: 13.5 }}>{l.title} <span className="faint" style={{ fontSize: 12 }}>· {l.url}</span></span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditLink(l.id); setEditLinkVals({ title: l.title, url: l.url }); }}>编辑</button>
                <button className="btn btn-ghost btn-sm danger" onClick={() => delLink(l.id)}><Icon name="trash" size={14} /> 删除</button>
              </div>
            )
          ))}
          <div className="row gap-8" style={{ marginTop: 10, flexWrap: 'wrap' }}>
            <input className="inp" style={{ maxWidth: 160 }} value={newLink[c.id]?.title || ''} onChange={(e) => setLF(c.id, 'title', e.target.value)} placeholder="网站名" />
            <input className="inp grow" value={newLink[c.id]?.url || ''} onChange={(e) => setLF(c.id, 'url', e.target.value)} placeholder="https://…" />
            <SaveBtn onSave={() => addLink(c.id)} label="添加链接" />
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
    ['已支付笔数', `${(s.paidCount || 0).toLocaleString()} / ${(s.total || 0).toLocaleString()}`],
    ['到账金额', `¥${s.paidAmount || '0.00'}`],
    ['发放积分', (s.paidPoints || 0).toLocaleString()],
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
        <ListHead title="充值订单" count={data.orders.length} action={
          <button className="btn btn-ghost btn-sm" disabled={!data.orders.length} onClick={() => downloadCSV('充值订单.csv', [
            { label: '订单号', get: (o) => o.outTradeNo }, { label: '用户', get: (o) => o.user?.nickname || '' }, { label: '渠道', get: (o) => o.channel },
            { label: '金额', get: (o) => o.amount }, { label: '积分', get: (o) => o.points }, { label: '状态', get: (o) => o.status }, { label: '时间', get: (o) => o.createdAt },
          ], data.orders)}>导出 CSV</button>
        } />
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
  const [secretsSet, setSecretsSet] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get('/admin/config').then(({ data }) => { setCfg(data.config); setSecretsSet(data.secretsSet || {}); }).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const save = async () => { setSaving(true); try { await api.put('/admin/config', { config: cfg }); toast.ok('支付配置已保存'); } catch (e: any) { toast.err(e.message); } finally { setSaving(false); } };
  if (cfg === null) return <RowSkeleton rows={6} />;
  // secret=true 的字段为敏感凭据：后端不回显原值；已配置时占位提示「留空保持不变」
  const fld = (k: string, label: string, ph: string, area = false, secret = false) => {
    const isSet = secret && secretsSet[k];
    const placeholder = isSet ? '已配置 ••••••（留空保持不变，重填则更新）' : ph;
    return (
      <label className="sec-field" style={area ? { gridColumn: '1 / -1' } : undefined}>
        <span className="sec-label">{label}{secret ? <Icon name="shield" size={12} style={{ color: 'var(--ink-4)', verticalAlign: '-1px', marginLeft: 4 }} /> : null}</span>
        {area
          ? <textarea className="inp" rows={2} value={cfg[k] ?? ''} onChange={(e) => setK(k, e.target.value)} placeholder={placeholder} />
          : <input className="inp" value={cfg[k] ?? ''} onChange={(e) => setK(k, e.target.value)} placeholder={placeholder} />}
      </label>
    );
  };
  const gw = (enableKey: string, name: string, fields: React.ReactNode) => {
    const on = cfg[enableKey] === '1';
    return (
      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="row gap-8" style={{ fontWeight: 700, fontSize: 14.5, alignItems: 'center' }}>
            {name}
            <span className="ui-badge" style={on
              ? { background: 'var(--good-soft)', color: 'var(--good)' }
              : { background: 'var(--surface-2)', color: 'var(--ink-3)' }}>{on ? '已启用' : '未启用'}</span>
          </span>
          <Toggle on={on} onChange={(v) => setK(enableKey, v ? '1' : '0')} />
        </div>
        {/* 未启用时淡化配置区，给出清晰的启停视觉状态（仍可编辑，方便启用前预填凭据） */}
        <div className="sec-grid" style={{ marginTop: 14, opacity: on ? 1 : 0.6, transition: 'opacity var(--dur-fast) var(--ease-out)' }}>{fields}</div>
      </div>
    );
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>配置三家支付网关用于会员充值 / 积分购买。密钥等凭据仅服务端保存、仅管理员可见，公开接口只暴露「是否启用」。开启后将在充值页展示对应支付方式。</div>
      {gw('pay_alipay_enabled', '支付宝', <>{fld('pay_alipay_appid', 'App ID', '支付宝应用 AppID')}{fld('pay_alipay_key', '应用私钥', '商户应用私钥（PKCS8，可粘裸 base64）', true, true)}{fld('pay_alipay_public_key', '支付宝公钥', '支付宝公钥（验回调签名，可粘裸 base64）', true)}{fld('pay_alipay_gateway', '网关地址', 'https://openapi.alipay.com/gateway.do')}</>)}
      {gw('pay_wechat_enabled', '微信支付', <>{fld('pay_wechat_appid', 'AppID', '公众号/小程序/APP AppID')}{fld('pay_wechat_mchid', '商户号 MchID', '微信支付商户号')}{fld('pay_wechat_key', 'APIv3 密钥', 'APIv3 密钥（32 位）', false, true)}{fld('pay_wechat_private_key', '商户 API 私钥', '商户 API 私钥（PKCS8，可粘裸 base64）', true, true)}{fld('pay_wechat_serial', '证书序列号', '商户 API 证书序列号')}</>)}
      {gw('pay_epay_enabled', '易支付', <>{fld('pay_epay_pid', '商户 PID', '易支付商户 ID')}{fld('pay_epay_key', '商户密钥', '易支付商户密钥', false, true)}{fld('pay_epay_url', '网关地址', 'https://pay.example.com/')}</>)}
      {/* 演示充值开关：默认关（未配置视为关）。开=会员页可「模拟充值/开通会员」免真实支付（适合体验/演示）；关=必须走上方真实支付渠道，杜绝免费刷余额/会员。 */}
      {(() => {
        const demoOn = (cfg['demo_recharge_enabled'] ?? '0') === '1';
        return (
          <div className="ui-card" style={{ padding: 18 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="row gap-8" style={{ fontWeight: 700, fontSize: 14.5, alignItems: 'center' }}>
                演示充值
                <span className="ui-badge" style={demoOn
                  ? { background: 'var(--warn-soft, var(--surface-2))', color: 'var(--warn, var(--ink-3))' }
                  : { background: 'var(--good-soft)', color: 'var(--good)' }}>{demoOn ? '开启（可免费充值）' : '已关闭（仅真实支付）'}</span>
              </span>
              <Toggle on={demoOn} onChange={(v) => setK('demo_recharge_enabled', v ? '1' : '0')} />
            </div>
            <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 10 }}>
              开启时「会员中心」可模拟充值余额、开通会员，不产生真实扣费——适合体验与演示。<b>正式收款上线后请关闭</b>，否则用户可绕过支付渠道免费获取余额 / 会员。关闭后模拟充值将被拒绝，需通过上方已启用的支付网关充值。
            </div>
          </div>
        );
      })()}
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
// 抽奖记录后台：汇总(总抽奖/实际中奖/谢谢参与) + 近 50 次抽奖（用户/奖品/类型）。便于核对发放与排查异常。
const LOT_TYPE_LABEL: Record<string, string> = { points: '积分', title: '头衔', frame: '头像框', thanks: '谢谢参与' };
function LotteryDraws() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/lottery/admin/draws').then(({ data }) => setData(data)).catch(() => setData({ stats: {}, draws: [] })); }, []);
  if (data === null) return <RowSkeleton rows={3} />;
  const s = data.stats || {};
  const bt = s.byType || {};
  const STAT_CARDS: [string, string][] = [
    ['总抽奖次数', (s.total || 0).toLocaleString()],
    ['实际中奖', (s.realWins || 0).toLocaleString()],
    ['谢谢参与', (bt.thanks || 0).toLocaleString()],
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
        <ListHead title="中奖记录" count={data.draws.length} action={
          <button className="btn btn-ghost btn-sm" disabled={!data.draws.length} onClick={() => downloadCSV('抽奖记录.csv', [
            { label: '用户', get: (d) => d.user?.nickname || '' }, { label: '奖品', get: (d) => d.prizeName }, { label: '类型', get: (d) => d.prizeType }, { label: '时间', get: (d) => d.createdAt },
          ], data.draws)}>导出 CSV</button>
        } />
        {data.draws.length === 0 ? <Empty text="还没有抽奖记录" /> : data.draws.map((d: any, i: number) => {
          const real = d.prizeType !== 'thanks';
          return (
            <div key={d.id}>
              {i > 0 && <div className="divider" />}
              <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'center' }}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-6" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{d.user?.nickname || '已删除用户'}</span>
                    <span className="ui-badge" style={real ? { background: 'var(--brand-soft)', color: 'var(--brand-strong)' } : undefined}>{LOT_TYPE_LABEL[d.prizeType] || d.prizeType}</span>
                  </div>
                  <div className="faint" style={{ fontSize: 12, marginTop: 3 }}>{d.prizeName} · {timeAgo(d.createdAt)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
    if (!(await confirmDialog('删除该奖品？'))) return;
    try { await api.delete(`/lottery/prizes/${p.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  const add = () => setList((l) => [...(l || []), { name: '', type: 'thanks', value: '', icon: 'gift', color: '', weight: 10, position: (l?.length || 0) }]);
  if (list === null) return <RowSkeleton rows={6} />;
  // 实时按权重算各奖品中奖概率（随权重输入即时更新，方便调转盘）
  const totalW = list.reduce((s, p) => s + Math.max(0, Number(p.weight) || 0), 0);
  return (
    <div className="flex flex-col gap-4">
      <div className="faint" style={{ fontSize: 12.5, lineHeight: 1.6 }}>配置转盘奖品。<b>权重</b>越大越容易抽中（前台不展示）；类型：积分=自动加分、头衔/头像框=发放对应物品、谢谢参与=不发奖。建议保留 8 个奖品。</div>
      {list.map((p, i) => (
        <div className="ui-card" style={{ padding: 14 }} key={p.id ?? 'new' + i}>
          <div className="sec-grid">
            <label className="sec-field"><span className="sec-label">奖品名 <i className="sec-req">*</i></span><input className="inp" value={p.name} onChange={(e) => setField(i, 'name', e.target.value)} placeholder="如 100 积分" /></label>
            <label className="sec-field"><span className="sec-label">类型</span><select className="inp" value={p.type} onChange={(e) => setField(i, 'type', e.target.value)}>{LOT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="sec-field"><span className="sec-label">奖品值（积分数 / 物品标识）</span><input className="inp" value={p.value} onChange={(e) => setField(i, 'value', e.target.value)} placeholder="积分填数字，如 100" /></label>
            <label className="sec-field"><span className="sec-label">权重</span><input className="inp" type="number" min={0} value={p.weight} onChange={(e) => setField(i, 'weight', e.target.value)} /></label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 10, alignItems: 'center' }}>
            <span className="faint" style={{ marginRight: 'auto', fontSize: 12.5 }}>中奖概率 <b className="num" style={{ color: 'var(--brand)' }}>{totalW > 0 ? ((Math.max(0, Number(p.weight) || 0) / totalW) * 100).toFixed(1) : '0.0'}%</b></span>
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(p, i)}><Icon name="trash" size={14} /> 删除</button>
            <SaveBtn onSave={() => save(p)} />
          </div>
        </div>
      ))}
      <button className="btn btn-ghost btn-block" onClick={add}><Icon name="plus" size={15} /> 新增奖品</button>
      <div className="sec-head" style={{ marginTop: 6 }}>抽奖记录</div>
      <LotteryDraws />
    </div>
  );
}

// 专栏文章后台：精选 / 取消精选 / 删除（前台 /articles 展示，精选进首页编辑精选位）。
function ArticlesAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/articles', { params: { limit: 40, q: query || undefined } }).then(({ data }) => {
    const seen = new Set<number>(); const out: any[] = [];
    for (const a of [data.featured, ...(data.articles || [])]) { if (a && !seen.has(a.id)) { seen.add(a.id); out.push(a); } }
    setList(out);
  }).catch(() => setList([]));
  useEffect(() => { load(); }, []);
  const feature = async (a: any, on: boolean) => {
    try { await api.post(`/articles/${a.id}/feature`, { featured: on }); toast.ok(on ? '已设为精选' : '已取消精选'); load(); } catch (e: any) { toast.err(e.message); }
  };
  const del = async (a: any) => {
    if (!(await confirmDialog('删除这篇文章？'))) return;
    try { await api.delete(`/articles/${a.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 14 }}>
        <div className="row gap-8">
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索文章标题…" />
        </div>
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="专栏文章" count={list.length} />
      {list.length === 0 ? <Empty text={q.trim() ? '没有匹配的文章' : '还没有文章'} /> : list.map((a, i) => (
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
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(a)}><Icon name="trash" size={14} /> 删除</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// 社区活动后台：查看 + 删除（活动由用户发起，管理员可下架）。
function EventsAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/events', { params: { q: query || undefined } }).then(({ data }) => setList(data.events)).catch(() => setList([]));
  useEffect(() => { load(); api.get('/events/admin/stats').then(({ data }) => setStats(data)).catch(() => {}); }, []);
  const del = async (e: any) => {
    if (!(await confirmDialog('删除这个活动？'))) return;
    try { await api.delete(`/events/${e.id}`); toast.ok('已删除'); load(); } catch (err: any) { toast.err(err.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  const STAT_CARDS: [string, any][] = stats ? [
    ['活动总数', (stats.total ?? 0).toLocaleString()], ['未结束', (stats.active ?? 0).toLocaleString()],
    ['已结束', (stats.ended ?? 0).toLocaleString()], ['总报名', (stats.totalSignups ?? 0).toLocaleString()],
  ] : [];
  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {STAT_CARDS.map(([k, v]) => (
            <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="ui-card" style={{ padding: 14 }}>
        <div className="row gap-8">
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索活动标题（含已结束）…" />
        </div>
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="社区活动" count={list.length} />
      {list.length === 0 ? <Empty text={q.trim() ? '没有匹配的活动' : '还没有活动'} /> : list.map((e, i) => (
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
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(e)}><Icon name="trash" size={14} /> 删除</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// 圈子后台：查看 + 解散（圈子由用户创建，管理员可解散；解散删成员/聊天，圈内动态保留）。
function CirclesAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/circles', { params: { q: query || undefined } }).then(({ data }) => setList(data.circles)).catch(() => setList([]));
  useEffect(() => { load(); api.get('/circles/admin/stats').then(({ data }) => setStats(data)).catch(() => {}); }, []);
  const del = async (c: any) => {
    if (!(await confirmDialog(`解散圈子「${c.name}」？成员与聊天记录会一并删除，圈内动态保留。`))) return;
    try { await api.delete(`/circles/${c.id}`); toast.ok('已解散'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  const STAT_CARDS: [string, any][] = stats ? [
    ['圈子总数', (stats.totalCircles ?? 0).toLocaleString()], ['成员总数', (stats.totalMembers ?? 0).toLocaleString()], ['圈内动态', (stats.totalPosts ?? 0).toLocaleString()],
  ] : [];
  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {STAT_CARDS.map(([k, v]) => (
            <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="ui-card" style={{ padding: 14 }}>
        <div className="row gap-8">
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索圈子名称…" />
        </div>
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="圈子" count={list.length} />
      {list.length === 0 ? <Empty text={q.trim() ? '没有匹配的圈子' : '还没有圈子'} /> : list.map((c, i) => (
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
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(c)}><Icon name="trash" size={14} /> 解散</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// 问答后台：查看 + 删除（删问题连同回答与投票）。
function QAAdmin() {
  const toast = useToast();
  const [list, setList] = useState<any[] | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [q, setQ] = useState('');
  const load = (query = q) => api.get('/qa', { params: { q: query || undefined } }).then(({ data }) => setList(data.questions)).catch(() => setList([]));
  useEffect(() => { load(); api.get('/qa/admin/stats').then(({ data }) => setStats(data)).catch(() => {}); }, []);
  const del = async (item: any) => {
    if (!(await confirmDialog('删除该问题及其全部回答？'))) return;
    try { await api.delete(`/qa/${item.id}`); toast.ok('已删除'); load(); } catch (e: any) { toast.err(e.message); }
  };
  if (list === null) return <RowSkeleton rows={6} />;
  const STAT_CARDS: [string, any][] = stats ? [
    ['总问题', (stats.total || 0).toLocaleString()], ['待解决', (stats.open || 0).toLocaleString()], ['已解决', (stats.solved || 0).toLocaleString()],
    ['总回答', (stats.totalAnswers || 0).toLocaleString()], ['悬赏中积分', (stats.openBounty || 0).toLocaleString()],
  ] : [];
  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          {STAT_CARDS.map(([k, v]) => (
            <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
              <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
              <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="ui-card" style={{ padding: 14 }}>
        <div className="row gap-8">
          <AdminSearch value={q} onChange={setQ} onSearch={() => load(q)} placeholder="搜索问题标题…" />
        </div>
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
      <ListHead title="问答" count={list.length} />
      {list.length === 0 ? <Empty text={q.trim() ? '没有匹配的问题' : '还没有问题'} /> : list.map((q, i) => (
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
            <button className="btn btn-ghost btn-sm danger" onClick={() => del(q)}><Icon name="trash" size={14} /> 删除</button>
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}

// 签到后台配置 (③)：基础分 / 连签加成上限 / 补签成本，落库 site_config，签到中心与签到发放实时生效。
// 签到统计：今日签到 / 累计签到 / 参与人数 + 连签榜（运营观察签到活跃度）。
function CheckinStats() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/checkin/admin/stats').then(({ data }) => setData(data)).catch(() => setData({ stats: {}, topStreakers: [] })); }, []);
  if (data === null) return <RowSkeleton rows={3} />;
  const s = data.stats || {};
  const top = data.topStreakers || [];
  const CARDS: [string, string][] = [
    ['今日签到', (s.todayCount || 0).toLocaleString()], ['累计签到', (s.totalCheckins || 0).toLocaleString()], ['参与人数', (s.participants || 0).toLocaleString()],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {CARDS.map(([k, v]) => (
          <div className="ui-card stat-card" key={k} style={{ padding: 16 }}>
            <span className="muted" style={{ fontSize: 12.5 }}>{k}</span>
            <div className="num" style={{ fontWeight: 700, marginTop: 8, fontSize: 22 }}>{v}</div>
          </div>
        ))}
      </div>
      <div className="ui-card" style={{ padding: 0, overflow: 'hidden' }}>
        <ListHead title="连签榜" count={top.length} />
        {top.length === 0 ? <Empty text="还没有人签到" /> : top.map((t: any, i: number) => (
          <div key={t.user?.id ?? i}>
            {i > 0 && <div className="divider" />}
            <div className="row gap-12" style={{ padding: '12px 18px', alignItems: 'center' }}>
              <span className="num" style={{ width: 22, textAlign: 'center', fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--ink-3)' }}>{i + 1}</span>
              <Avatar user={t.user} size={32} showV />
              <div className="grow" style={{ minWidth: 0 }}><b style={{ fontSize: 14 }}>{t.user?.nickname || '—'}</b></div>
              <span className="num" style={{ fontSize: 13, color: 'var(--ink-2)' }}>连签 {t.streak} 天</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
      <div className="sec-head" style={{ marginTop: 6 }}>签到统计</div>
      <CheckinStats />
    </div>
  );
}

const ACH_TASK_ICON_LABELS: Record<string, string> = {
  checkin: '签到',
  edit: '发布',
  comment: '评论',
  heart: '点赞',
  poll: '投票',
  user: '用户',
  users: '社交',
  help: '问答',
  forum: '论坛',
  calendar: '日历',
  gift: '奖励',
  fire: '热度',
  spark: '灵感',
  rocket: '成长',
  coin: '积分',
};

const ACH_TASK_FALLBACK_ICONS = Object.keys(ACH_TASK_ICON_LABELS);

function AchievementsAdmin() {
  const toast = useToast();
  const [tasks, setTasks] = useState<any[] | null>(null);
  const [icons, setIcons] = useState<string[]>(ACH_TASK_FALLBACK_ICONS);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/achievements/admin/tasks')
      .then(({ data }) => {
        setTasks(data.tasks || []);
        setIcons(data.icons?.length ? data.icons : ACH_TASK_FALLBACK_ICONS);
      })
      .catch(() => {
        setTasks([]);
        setIcons(ACH_TASK_FALLBACK_ICONS);
      });
  };

  useEffect(() => { load(); }, []);

  const patchTask = (key: string, patch: Record<string, any>) => {
    setTasks((rows) => (rows || []).map((t) => (t.key === key ? { ...t, ...patch } : t)));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = (tasks || []).map((t) => ({
        key: t.key,
        enabled: !!t.enabled,
        title: t.title,
        desc: t.desc,
        icon: t.icon,
        points: t.points,
        target: t.target,
        daily: !!t.daily,
      }));
      const { data } = await api.put('/achievements/admin/tasks', { tasks: payload });
      setTasks(data.tasks || []);
      setIcons(data.icons?.length ? data.icons : ACH_TASK_FALLBACK_ICONS);
      toast.ok('任务配置已保存');
    } catch (e: any) {
      toast.err(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    const ok = await confirmDialog('恢复后会使用系统默认任务标题、奖励和启用状态。', {
      title: '恢复默认任务配置？',
      confirmText: '恢复默认',
      danger: false,
    });
    if (!ok) return;
    setSaving(true);
    try {
      const { data } = await api.post('/achievements/admin/tasks/reset');
      setTasks(data.tasks || []);
      setIcons(data.icons?.length ? data.icons : ACH_TASK_FALLBACK_ICONS);
      toast.ok('已恢复默认任务配置');
    } catch (e: any) {
      toast.err(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (tasks === null) return <RowSkeleton rows={6} />;
  const enabledCount = tasks.filter((t) => t.enabled).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 18 }}>
        <div className="row gap-12" style={{ justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>任务中心配置</div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>已启用 {enabledCount}/{tasks.length} 个任务。任务完成条件由系统模板统计，后台负责运营参数。</div>
          </div>
          <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" disabled={saving} onClick={reset}>恢复默认</button>
            <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存配置'}</button>
          </div>
        </div>
      </div>

      <div className="ui-card admin-task-list">
        {tasks.length === 0 ? <Empty text="暂无任务模板" /> : tasks.map((t, i) => (
          <div className={`admin-task-item${t.enabled ? '' : ' off'}`} key={t.key}>
            {i > 0 && <div className="divider" />}
            <div className="admin-task-row">
              <button type="button" aria-pressed={!!t.enabled} className={`ui-toggle${t.enabled ? ' on' : ''}`} onClick={() => patchTask(t.key, { enabled: !t.enabled })}>
                <span className="ui-toggle-dot" />
              </button>
              <span className={`task-ico${t.enabled ? '' : ' muted'}`}><Icon name={t.icon} size={20} /></span>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                  <b className="admin-task-title">{t.title || t.key}</b>
                  <span className="ui-badge">{t.type}</span>
                  <span className="ui-badge">{t.daily ? '每日任务' : '成长任务'}</span>
                  {!t.enabled && <span className="ui-badge">已停用</span>}
                </div>
                <div className="faint" style={{ fontSize: 12.5, marginTop: 3 }}>{t.desc}</div>
              </div>
              <span className="task-points"><Icon name="coin" size={13} /> +{t.points}</span>
            </div>

            <div className="sec-grid admin-task-edit-grid">
              <label className="sec-field">
                <span className="sec-label">任务标题</span>
                <input className="inp" maxLength={32} value={t.title || ''} onChange={(e) => patchTask(t.key, { title: e.target.value })} />
              </label>
              <label className="sec-field">
                <span className="sec-label">任务描述</span>
                <input className="inp" maxLength={80} value={t.desc || ''} onChange={(e) => patchTask(t.key, { desc: e.target.value })} />
              </label>
              <label className="sec-field">
                <span className="sec-label">图标</span>
                <select className="inp" value={t.icon || 'checkin'} onChange={(e) => patchTask(t.key, { icon: e.target.value })}>
                  {icons.map((ic) => <option key={ic} value={ic}>{ACH_TASK_ICON_LABELS[ic] || ic}</option>)}
                </select>
              </label>
              <label className="sec-field">
                <span className="sec-label">奖励积分</span>
                <input className="inp" type="number" min={0} max={9999} value={t.points ?? 0} onChange={(e) => patchTask(t.key, { points: Number(e.target.value) || 0 })} />
              </label>
              <label className="sec-field">
                <span className="sec-label">目标次数</span>
                <input className="inp" type="number" min={1} max={999} value={t.target ?? 1} onChange={(e) => patchTask(t.key, { target: Math.max(1, Number(e.target.value) || 1) })} />
              </label>
              <label className="sec-field">
                <span className="sec-label">任务周期</span>
                <select className="inp" value={t.daily ? '1' : '0'} onChange={(e) => patchTask(t.key, { daily: e.target.value === '1' })}>
                  <option value="1">每日可领取</option>
                  <option value="0">仅领取一次</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 站点外观自定义 (W)：站名 / 副标题 / Logo / 全站自定义 CSS。类 WP 的二开能力，升级不覆盖。
function Appearance() {
  const toast = useToast();
  const [cfg, setCfg] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingAuthBg, setUploadingAuthBg] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const authBgInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => { api.get('/admin/config').then(({ data }) => setCfg(data.config)).catch(() => setCfg({})); }, []);
  const setK = (k: string, v: string) => setCfg((c) => ({ ...(c || {}), [k]: v }));
  const uploadLogo = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      toast.err('请选择图片文件');
      e.target.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('files', file);
    setUploadingLogo(true);
    try {
      const { data } = await api.post('/upload', fd);
      const url = data.files?.[0]?.url;
      if (!url) throw new Error('上传失败，请重试');
      setK('site_logo', url);
      toast.ok('Logo 已上传，保存外观后生效');
    } catch (err: any) {
      toast.err(err.message || 'Logo 上传失败');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };
  const uploadAuthBg = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = String(file.type || '');
    if (!type.startsWith('image/') && !type.startsWith('video/')) {
      toast.err('请选择图片或视频文件');
      e.target.value = '';
      return;
    }
    const fd = new FormData();
    fd.append('files', file);
    setUploadingAuthBg(true);
    try {
      const { data } = await api.post('/upload', fd);
      const url = data.files?.[0]?.url;
      if (!url) throw new Error('上传失败，请重试');
      setK('auth_bg_url', url);
      setK('auth_bg_type', type.startsWith('video/') ? 'video' : 'image');
      toast.ok('注册页背景已上传，保存外观后生效');
    } catch (err: any) {
      toast.err(err.message || '背景上传失败');
    } finally {
      setUploadingAuthBg(false);
      e.target.value = '';
    }
  };
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
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>显示在导航栏、浏览器标题、登录页与管理后台。Logo 留空则使用站点名称首字符作为默认标记。</div>
        <div className="sec-grid" style={{ marginTop: 14 }}>
          <label className="sec-field">
            <span className="sec-label">站点名称</span>
            <input className="inp" maxLength={40} value={cfg.site_name ?? ''} onChange={(e) => setK('site_name', e.target.value)} placeholder="SaotieSNS" />
          </label>
          <label className="sec-field">
            <span className="sec-label">副标题 / Slogan</span>
            <input className="inp" maxLength={60} value={cfg.site_slogan ?? ''} onChange={(e) => setK('site_slogan', e.target.value)} placeholder="轻社交社区" />
          </label>
        </div>
        <div className="sec-field" style={{ marginTop: 12 }}>
          <span className="sec-label">Logo 图片</span>
          <div className="row gap-8" style={{ alignItems: 'center' }}>
            {cfg.site_logo
              ? <img src={cfg.site_logo} alt="" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
              : <BrandMark size={36} name={cfg.site_name || 'SaotieSNS'} />}
            <input ref={logoInputRef} type="file" accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
            <button type="button" className="btn btn-outline" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
              <Icon name="image" size={16} /> {uploadingLogo ? '上传中…' : '上传 Logo'}
            </button>
            {cfg.site_logo && <button type="button" className="btn btn-ghost" onClick={() => setK('site_logo', '')}>清除</button>}
          </div>
          <input className="inp" maxLength={500} value={cfg.site_logo ?? ''} onChange={(e) => setK('site_logo', e.target.value)} placeholder="可选：粘贴外部 Logo URL，留空则使用默认标记" style={{ marginTop: 10 }} />
        </div>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>自定义 CSS</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>全站注入到页面 <code>&lt;head&gt;</code>，可覆盖任意样式做二次开发装饰；系统升级不会重置此处内容。请谨慎使用，错误的 CSS 可能影响页面显示。</div>
        <textarea className="inp" value={cfg.site_custom_css ?? ''} maxLength={20000} spellCheck={false}
          onChange={(e) => setK('site_custom_css', e.target.value)}
          placeholder={'/* 例如：把主按钮换成圆角胶囊 */\n.btn-primary { border-radius: 999px; }'}
          style={{ marginTop: 12, minHeight: 220, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>注册 / 登录页</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>控制独立登录注册页左侧文案、亮点列表和背景素材；弹窗登录继续保持轻量默认样式。</div>
        <div className="sec-grid" style={{ marginTop: 14 }}>
          <label className="sec-field">
            <span className="sec-label">左侧标题</span>
            <textarea className="inp" value={cfg.auth_hero_title ?? ''} maxLength={120} rows={3}
              onChange={(e) => setK('auth_hero_title', e.target.value)}
              placeholder={'连接有趣的人\n与值得分享的内容'} />
          </label>
          <label className="sec-field">
            <span className="sec-label">副标题说明</span>
            <textarea className="inp" value={cfg.auth_hero_subtitle ?? ''} maxLength={240} rows={3}
              onChange={(e) => setK('auth_hero_subtitle', e.target.value)}
              placeholder="轻社交社区" />
          </label>
        </div>
        <label className="sec-field" style={{ marginTop: 12 }}>
          <span className="sec-label">亮点列表</span>
          <textarea className="inp" value={cfg.auth_hero_points ?? ''} maxLength={1200} rows={5}
            onChange={(e) => setK('auth_hero_points', e.target.value)}
            placeholder={'每行一条，格式：标题｜描述\n轻社交动态｜文字 / 图片 / 视频，随手记录\n社区论坛｜版块讨论、内联看帖、版主管理'} />
        </label>
        <div className="sec-grid" style={{ marginTop: 12 }}>
          <label className="sec-field">
            <span className="sec-label">背景类型</span>
            <select className="inp" value={cfg.auth_bg_type || 'image'} onChange={(e) => setK('auth_bg_type', e.target.value)}>
              <option value="image">图片</option>
              <option value="video">视频</option>
            </select>
          </label>
          <label className="sec-field">
            <span className="sec-label">背景 URL</span>
            <input className="inp" maxLength={500} value={cfg.auth_bg_url ?? ''} onChange={(e) => setK('auth_bg_url', e.target.value)} placeholder="/uploads/auth-bg.jpg 或 https://..." />
          </label>
        </div>
        <div className="row gap-8" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <input ref={authBgInputRef} type="file" accept="image/*,video/*" onChange={uploadAuthBg} style={{ display: 'none' }} />
          <button type="button" className="btn btn-outline" onClick={() => authBgInputRef.current?.click()} disabled={uploadingAuthBg}>
            <Icon name="image" size={16} /> {uploadingAuthBg ? '上传中…' : '上传背景'}
          </button>
          {cfg.auth_bg_url && <button type="button" className="btn btn-ghost" onClick={() => setK('auth_bg_url', '')}>清除背景</button>}
        </div>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>页脚 / 备案</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>统一用于右侧栏页脚、关于页和登录注册页底部。版权留空时自动使用当前站点名称和副标题。</div>
        <label className="sec-field" style={{ marginTop: 12 }}>
          <span className="sec-label">版权文字</span>
          <input className="inp" maxLength={200} value={cfg.site_copyright ?? ''} onChange={(e) => setK('site_copyright', e.target.value)} placeholder="© 2026 SaotieSNS · 轻社交社区" />
        </label>
        <div className="sec-grid" style={{ marginTop: 12 }}>
          <label className="sec-field">
            <span className="sec-label">ICP备案号</span>
            <input className="inp" maxLength={120} value={cfg.site_icp ?? ''} onChange={(e) => setK('site_icp', e.target.value)} placeholder="例如：粤ICP备xxxxxxxx号" />
          </label>
          <label className="sec-field">
            <span className="sec-label">公安备案 / 其他备案</span>
            <input className="inp" maxLength={160} value={cfg.site_public_security ?? ''} onChange={(e) => setK('site_public_security', e.target.value)} placeholder="例如：粤公网安备 xxxxxxxxxxxx号" />
          </label>
        </div>
        <label className="sec-field" style={{ marginTop: 12 }}>
          <span className="sec-label">页脚自定义 HTML</span>
          <textarea className="inp" value={cfg.site_footer_html ?? ''} maxLength={5000} spellCheck={false}
            onChange={(e) => setK('site_footer_html', e.target.value)}
            placeholder={'例如：<a href=\"/privacy\">隐私政策</a>'}
            style={{ minHeight: 90, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.6 }} />
        </label>
      </div>

      <div className="ui-card" style={{ padding: 18 }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>统计代码</div>
        <div className="faint" style={{ fontSize: 12.5, marginTop: 3, lineHeight: 1.5 }}>用于百度统计、Google Analytics、Umami 等。代码会注入到页面 head，仅建议粘贴可信统计平台代码。</div>
        <textarea className="inp" value={cfg.site_analytics_code ?? ''} maxLength={12000} spellCheck={false}
          onChange={(e) => setK('site_analytics_code', e.target.value)}
          placeholder={'<!-- 统计代码，例如 <script src=\"...\"></script> -->'}
          style={{ marginTop: 12, minHeight: 150, fontFamily: 'var(--font-mono, ui-monospace, monospace)', fontSize: 12.5, lineHeight: 1.6, resize: 'vertical' }} />
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存外观'}</button>
      </div>
    </div>
  );
}

function FeedbackAdmin() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const [list, setList] = useState<any[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [states, setStates] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = () => {
    setList(null);
    api.get('/feedback', { params: status ? { status } : {} })
      .then(({ data }) => {
        const rows = data.feedback || [];
        setList(rows);
        setDrafts(Object.fromEntries(rows.map((f: any) => [f.id, f.reply || ''])));
        setStates(Object.fromEntries(rows.map((f: any) => [f.id, f.status || 'open'])));
      })
      .catch(() => setList([]));
  };
  useEffect(() => { load(); }, [status]);

  const save = async (f: any, nextStatus?: string) => {
    const s = nextStatus || states[f.id] || f.status || 'resolved';
    setBusyId(f.id);
    try {
      await api.post(`/feedback/${f.id}/reply`, { reply: drafts[f.id] || '', status: s });
      toast.ok('反馈状态已更新');
      load();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusyId(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="ui-card" style={{ padding: 16 }}>
        <div className="row gap-10" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 800 }}>问题反馈</div>
            <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>来自更新日志页的用户反馈，可直接回复并同步前台展示。</div>
          </div>
          <select className="inp" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 150 }}>
            {FEEDBACK_STATUS_OPTIONS.map((s) => <option key={s.k || 'all'} value={s.k}>{s.l}</option>)}
          </select>
        </div>
      </div>
      {list === null ? <RowSkeleton rows={5} /> : list.length === 0 ? <Empty icon="💬" text="暂无反馈" /> : list.map((f) => (
        <div className="ui-card" key={f.id} style={{ padding: 16 }}>
          <div className="row gap-10" style={{ alignItems: 'flex-start' }}>
            <Avatar user={f.user} size={38} showV />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
                <b>{f.user?.nickname || '匿名用户'}</b>
                <span className="ui-badge">{FEEDBACK_STATUS_LABEL[f.status] || f.status || '待处理'}</span>
                <span className="faint" style={{ fontSize: 12 }}>{timeAgo(f.createdAt)}</span>
              </div>
              <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>{f.content}</div>
              <div className="sec-grid" style={{ marginTop: 12 }}>
                <label className="sec-field">
                  <span className="sec-label">处理状态</span>
                  <select className="inp" value={states[f.id] || f.status || 'open'} onChange={(e) => setStates((m) => ({ ...m, [f.id]: e.target.value }))}>
                    {FEEDBACK_STATUS_OPTIONS.filter((s) => s.k).map((s) => <option key={s.k} value={s.k}>{s.l}</option>)}
                  </select>
                </label>
                <label className="sec-field">
                  <span className="sec-label">官方回复</span>
                  <textarea className="inp" rows={3} maxLength={500} value={drafts[f.id] || ''} onChange={(e) => setDrafts((m) => ({ ...m, [f.id]: e.target.value }))} placeholder="填写后会展示在前台反馈列表中" />
                </label>
              </div>
              <div className="row gap-8" style={{ justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => save(f, 'doing')}>标记处理中</button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === f.id} onClick={() => save(f, 'resolved')}>标记已解决</button>
                <button className="btn btn-primary btn-sm" disabled={busyId === f.id} onClick={() => save(f)}>{busyId === f.id ? '保存中…' : '保存回复'}</button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminLogin() {
  const { login } = useAuth();
  const site = useSite();
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
        <div className="row" style={{ justifyContent: 'center' }}><BrandMark size={56} logo={site.logo} name={site.name} /></div>
        <div style={{ fontWeight: 800, fontSize: 19, marginTop: 12 }}>{site.name || 'SaotieSNS'} 管理后台</div>
        <div className="muted" style={{ fontSize: 13, marginTop: 4, marginBottom: 18 }}>请使用管理员账号登录</div>
        {err && <div className="form-err">{err}</div>}
        <input className="inp" placeholder="管理员用户名" value={u} onChange={(e) => setU(e.target.value)} autoFocus />
        <input className="inp" type="password" placeholder="密码" value={p} onChange={(e) => setP(e.target.value)} style={{ marginTop: 10 }} />
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy} style={{ marginTop: 14, fontWeight: 700 }}>
          {busy ? '登录中…' : '登录'}
        </button>
        <Link to="/" className="faint" style={{ fontSize: 12.5, marginTop: 16, display: 'inline-block' }}>← 返回前台</Link>
      </form>
    </div>
  );
}

export default function Admin() {
  const { user, loading, logout } = useAuth();
  const site = useSite();
  const [tab, setTab] = useState('overview');
  // 后台独立的浅/深主题（与前台主题互不影响），持久化到 localStorage。design.md 深色变体。
  const [adminTheme, setAdminTheme] = useState<string>(() => {
    try { return localStorage.getItem('haha_admin_theme') || 'light'; } catch { return 'light'; }
  });
  const activeNavGroup = GROUP_OF[tab] || NAV_GROUPS[0].l;
  const [openNavGroup, setOpenNavGroup] = useState(activeNavGroup);
  useEffect(() => { setOpenNavGroup(activeNavGroup); }, [activeNavGroup]);
  const toggleTheme = () => setAdminTheme((t) => {
    const n = t === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('haha_admin_theme', n); } catch { /* ignore */ }
    return n;
  });

  // 移动端横向 nav：切 tab 后把选中项滚动到可见（block:nearest 避免带动整页竖滚）。桌面竖向侧栏同样受益。
  useEffect(() => {
    document.querySelector('.admin-nav-item.active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [tab]);

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
    <>
    <div className="admin-shell" data-admin-theme={adminTheme}>
      <aside className="admin-side">
        <div className="admin-brand">
          <BrandMark size={36} logo={site.logo} name={site.name} />
          <div className="admin-brand-txt"><b>{site.name || 'SaotieSNS'}</b><span>管理后台</span></div>
        </div>
        <nav className="admin-nav">
          {NAV_GROUPS.map((grp, i) => {
            const open = openNavGroup === grp.l;
            const currentGroup = grp.keys.includes(tab);
            return (
              <div key={grp.l} className={`admin-nav-group${open ? ' open' : ''}${currentGroup ? ' current' : ''}`}>
                <button type="button" className="admin-nav-group-head" aria-expanded={open} onClick={() => setOpenNavGroup(grp.l)}>
                  <span className="admin-nav-group-index">{i + 1}</span>
                  <span className="admin-nav-group-label">{grp.l}</span>
                  <Icon name="chevron" size={14} className="admin-nav-group-chev" />
                </button>
                {open && (
                  <div className="admin-nav-group-panel">
                    {grp.keys.map((k) => {
                      const t = TAB_BY_K[k];
                      return t ? (
                        <button key={k} className={`admin-nav-item${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}>
                          <Icon name={t.icon} size={18} /> {t.l}
                        </button>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div className="admin-top-head">
            <span className="admin-crumb">管理后台 <span className="admin-crumb-sep">/</span> {GROUP_OF[tab] || '概览'}</span>
            <h1><Icon name={current.icon} size={17} /> {current.l}</h1>
            {current.d && <span className="admin-top-sub">{current.d}</span>}
          </div>
          <div className="admin-top-actions">
            <Link to="/" className="admin-top-action" title="返回前台" aria-label="返回前台"><Icon name="back" size={16} /><span>前台</span></Link>
            <button type="button" className="admin-top-action danger" onClick={logout} title="退出登录" aria-label="退出登录"><Icon name="logout" size={16} /><span>退出</span></button>
            <button className="admin-theme-btn" onClick={toggleTheme} title={adminTheme === 'dark' ? '切换浅色后台' : '切换深色后台'} aria-label="切换后台主题"><Icon name={adminTheme === 'dark' ? 'sun' : 'moon'} size={17} /></button>
            <div className="admin-top-user"><Avatar user={user} size={34} showV /><span>{user.nickname}</span></div>
          </div>
        </header>
        <div className="admin-content">
          {tab === 'overview' && <Overview onNav={setTab} />}
          {tab === 'users' && <Users />}
          {tab === 'boards' && <Boards />}
          {tab === 'topics' && <Topics />}
          {tab === 'reports' && <Reports />}
          {tab === 'feedback' && <FeedbackAdmin />}
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
          {tab === 'achievements' && <AchievementsAdmin />}
          {tab === 'externalSync' && <ExternalSyncAdmin />}
          {tab === 'mall' && <Products />}
          {tab === 'security' && <Security />}
          {tab === 'modules' && <Modules />}
          {tab === 'layout' && <Layouts />}
          {tab === 'appearance' && <Appearance />}
          {tab === 'audit' && <AuditLog />}
        </div>
      </main>
    </div>
    </>
  );
}
