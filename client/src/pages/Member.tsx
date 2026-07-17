import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Shell from '../components/Shell';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import Modal from '../components/Modal';
import { Badges } from '../components/Identity';
import { Empty, Loading } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLayout } from '../context/SiteContext';
import api from '../api/client';
import { confirmDialog } from '../components/confirm';
import { fmtNum, timeAgo } from '../lib/format';
import { VIP_TIERS, vipTier, type VipTier } from '../lib/vip';

type AssetLog = {
  id: number;
  type: 'points' | 'balance';
  amount: number;
  balanceAfter: number | null;
  reason: string;
  createdAt: string;
};

type AssetMonth = {
  month: string;
  count: number;
};

function localMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string) {
  const [y, m] = String(month || '').split('-');
  if (!y || !m) return month || '未知月份';
  return `${y}年${Number(m)}月`;
}

function assetAmount(log: AssetLog) {
  const sign = log.amount > 0 ? '+' : '';
  if (log.type === 'balance') return `${sign}¥${(log.amount / 100).toFixed(2)}`;
  return `${sign}${fmtNum(log.amount)} 积分`;
}

function vipCountdown(vipLevel: number, vipExpires?: string | null) {
  if (!vipLevel) return '未开通会员';
  if (!vipExpires) return '有效期未设置';
  const end = new Date(`${vipExpires.slice(0, 10)}T23:59:59`).getTime();
  const left = end - Date.now();
  if (!Number.isFinite(end) || left <= 0) return '已到期';
  const days = Math.floor(left / 86400000);
  const hours = Math.ceil((left % 86400000) / 3600000);
  if (days <= 0) return `剩余 ${hours} 小时`;
  return `剩余 ${days} 天 ${hours} 小时`;
}

export default function Member() {
  const { user, loading: authLoading, setAuthOpen, patchUser } = useAuth();
  const toast = useToast();
  const layout = useLayout('member', 'wide');
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState(3000);
  const [stats, setStats] = useState<any>(null);
  const [invites, setInvites] = useState<any>(null);
  const [assetLogs, setAssetLogs] = useState<AssetLog[]>([]);
  const [assetMonths, setAssetMonths] = useState<AssetMonth[]>([]);
  const [assetMonth, setAssetMonth] = useState(localMonth());
  const [assetHasMore, setAssetHasMore] = useState(false);
  const [assetBusy, setAssetBusy] = useState(false);

  const loadAssets = (month = assetMonth, append = false) => {
    if (!user) return Promise.resolve();
    const offset = append ? assetLogs.length : 0;
    setAssetBusy(true);
    return api.get('/users/me/assets', { params: { month, offset, limit: 50 } }).then(({ data }) => {
      const logs = data.logs || [];
      setAssetMonth(data.month || month);
      setAssetMonths(data.months || []);
      setAssetLogs((prev) => append ? [...prev, ...logs] : logs);
      setAssetHasMore(!!data.hasMore);
      if (data.user) patchUser(data.user);
    }).catch(() => {}).finally(() => setAssetBusy(false));
  };

  useEffect(() => {
    if (!user) return;
    api.get('/users/me/stats').then(({ data }) => setStats(data)).catch(() => {});
    api.get('/users/me/invites').then(({ data }) => setInvites(data)).catch(() => {});
    loadAssets(localMonth());
  }, [user?.id]);

  useEffect(() => {
    if (!user || window.location.hash !== '#assets') return;
    window.setTimeout(() => {
      document.getElementById('assets')?.scrollIntoView({ block: 'start' });
    }, 80);
  }, [user?.id]);

  const inviteLink = user ? `${window.location.origin}/?invite=${encodeURIComponent(user.username)}` : '';
  const copyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteLink); toast.ok('邀请链接已复制 🔗'); }
    catch { toast.err('复制失败，请手动复制'); }
  };

  if (authLoading) return <Shell wide><Loading /></Shell>;
  if (!user) return <Shell wide><div className="ui-card"><Empty icon="🔒" text="登录后查看会员中心" /></div></Shell>;

  const checkedToday = user.lastCheckin === new Date().toISOString().slice(0, 10);
  const checkin = async () => {
    try { const { data } = await api.post('/auth/checkin'); patchUser(data.user); loadAssets(localMonth()); toast.ok(`签到成功 · 连签 ${data.streak} 天 · +${data.pointsEarned} 积分${data.vipMult > 1 ? `（VIP ×${data.vipMult} 加成）` : ''}`); }
    catch (e: any) { toast.err(e.message); }
  };
  const recharge = async () => {
    try { const { data } = await api.post('/users/me/recharge', { amount: Number(amount) }); patchUser(data.user); loadAssets(localMonth()); setRechargeOpen(false); toast.ok('充值成功 🎉'); }
    catch (e: any) { toast.err(e.message); }
  };
  const myLevel = (user.vipLevel ?? (user.vip ? 1 : 0)) as number;
  const myTier = vipTier(myLevel);
  const vipLeft = vipCountdown(myLevel, user.vipExpires as string | null | undefined);
  const scrollToAssets = () => {
    window.history.replaceState(null, '', '#assets');
    document.getElementById('assets')?.scrollIntoView({ block: 'start' });
  };
  const buyVip = async (t: VipTier) => {
    const action = myLevel === 0 ? '开通' : t.level > myLevel ? '升级到' : '切换到';
    if (!(await confirmDialog('演示环境为模拟开通，不会产生真实扣费', { title: `确认${action} ${t.name}（¥${(t.price / 100).toFixed(0)}/月）？`, confirmText: `确认${action}`, danger: false }))) return;
    try { const { data } = await api.post('/users/me/recharge', { amount: 0, vipLevel: t.level }); patchUser(data.user); toast.ok(`已开通${t.name} 🎉`); }
    catch (e: any) { toast.err(e.message); }
  };

  const lp = (user.levelProgress as any) || { percent: 0, nextLevelExp: 0, exp: 0 };
  // 连签数需与签到逻辑一致：上次签到非今/昨日即视为断签归零，避免会员页与签到页数据矛盾
  const streak = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    return (user.lastCheckin === today || user.lastCheckin === yest) ? (user.checkinStreak || 0) : 0;
  })();

  return (
    <Shell layout={layout}>
      {/* identity card */}
      <div className="ui-card" style={{ padding: 20, background: 'linear-gradient(135deg, #1f2640, #2f6bff)' , color: '#fff', overflow: 'hidden' }}>
        <div className="row gap-12">
          <Avatar user={user} size={64} showV ring />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap-6" style={{ fontSize: 19, fontWeight: 800, flexWrap: 'wrap' }}>{user.nickname} <Badges user={user} /></div>
            <div className="nowrap" style={{ opacity: .85, fontSize: 13, marginTop: 2 }}>@{user.username} · {myTier ? myTier.name : '普通会员'} · {vipLeft}</div>
          </div>
          <button className="btn" style={{ background: 'rgba(255,255,255,.16)', color: '#fff', flex: 'none' }} onClick={() => setRechargeOpen(true)}>
            <Icon name="coin" size={16} /> 充值
          </button>
        </div>
        <div className="level-bar" style={{ background: 'rgba(255,255,255,.12)', marginTop: 16 }}>
          <div className="lh" style={{ color: 'rgba(255,255,255,.85)' }}><span>Lv.{user.level}</span><span className="num">{lp.exp} / {lp.nextLevelExp} EXP</span></div>
          <div className="level-track" style={{ background: 'rgba(255,255,255,.2)' }}><div className="level-fill" style={{ width: `${lp.percent}%` }} /></div>
        </div>
      </div>

      {/* VIP 多等级 */}
      <div className="ui-card vip-tiers-card">
        <div className="vip-tiers-head">
          <span className="vip-emblem"><Icon name="shield" size={20} fill /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="vip-title">{myTier ? `你当前是${myTier.name}` : '开通 VIP 会员'}</div>
            <div className="vip-sub">{myTier ? '专属权益生效中，可随时升级更高等级' : '选择适合你的等级，解锁专属权益'}</div>
          </div>
          <span className="pill" style={{ flex: 'none', color: myLevel ? 'var(--brand)' : 'var(--muted)' }}>{vipLeft}</span>
        </div>
        <div className="vip-tiers">
          {VIP_TIERS.map((t) => {
            const owned = myLevel === t.level;
            const upgrade = myLevel > 0 && myLevel < t.level;
            return (
              <div className={`vip-tier${owned ? ' owned' : ''}`} key={t.level} style={{ ['--tc' as any]: t.color }}>
                <div className="vip-tier-top">
                  <span className="vip-tier-badge" style={{ background: t.color, color: t.ink }}>{t.short}</span>
                  {owned && <span className="vip-tier-cur"><Icon name="check" size={12} /> 当前</span>}
                </div>
                <div className="vip-tier-name">{t.name}</div>
                <div className="vip-tier-tag">{t.tagline}</div>
                <div className="vip-tier-price"><b>¥{(t.price / 100).toFixed(0)}</b><span> / 月</span></div>
                <ul className="vip-tier-perks">
                  {t.perks.map((p) => <li key={p}><Icon name="check" size={13} /> <span>{p}</span></li>)}
                </ul>
                <button className={`btn ${owned ? 'btn-ghost' : 'btn-primary'} btn-block`} disabled={owned} onClick={() => buyVip(t)}>
                  {owned ? '已开通' : upgrade ? '升级' : '开通'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* stat grid */}
      <div className="mc-grid">
        <button type="button" className="mc-stat points" onClick={scrollToAssets} style={{ textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' }}><div className="v">{fmtNum(user.points)}</div><div className="k"><Icon name="coin" size={13} /> 我的积分</div></button>
        <div className="mc-stat bal"><div className="v">¥{((user.balance as number) / 100).toFixed(2)}</div><div className="k"><Icon name="wallet" size={13} /> 账户余额</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.followers)}</div><div className="k">粉丝</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.postCount)}</div><div className="k">动态</div></div>
      </div>

      <div id="assets" className="ui-card" style={{ scrollMarginTop: 86 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>资产明细</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>按月份查看积分和余额的增加、扣减与变动后余额</div>
          </div>
          <button className="btn btn-ghost btn-sm" disabled={assetBusy} onClick={() => loadAssets(assetMonth)}>{assetBusy ? '刷新中' : '刷新'}</button>
        </div>
        <div className="col gap-8">
          {(assetMonths.length ? assetMonths : [{ month: assetMonth, count: assetLogs.length }]).map((m) => {
            const open = m.month === assetMonth;
            return (
              <div key={m.month} style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--surface-1)' }}>
                <button
                  type="button"
                  className="row"
                  onClick={() => !open && loadAssets(m.month)}
                  style={{ width: '100%', justifyContent: 'space-between', padding: '11px 14px', border: 0, background: open ? 'var(--surface-2)' : 'transparent', color: 'inherit', font: 'inherit', cursor: open ? 'default' : 'pointer' }}
                >
                  <span style={{ fontWeight: 800 }}>{monthLabel(m.month)}{m.month === localMonth() ? '（本月）' : ''}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{m.count} 条 · {open ? '已展开' : '点击查看'}</span>
                </button>
                {open && (
                  <div>
                    {assetLogs.length === 0 ? (
                      <Empty icon="💳" text="本月暂无资产流水" />
                    ) : assetLogs.map((log) => (
                      <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '12px 14px', borderTop: '1px solid var(--line)' }}>
                        <span className="pill" style={{ justifyContent: 'center' }}>{log.type === 'balance' ? '余额' : '积分'}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 750, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason || '账户变动'}</div>
                          <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{timeAgo(log.createdAt)} · 变动后：{log.type === 'balance' ? `¥${((log.balanceAfter || 0) / 100).toFixed(2)}` : `${fmtNum(log.balanceAfter || 0)} 积分`}</div>
                        </div>
                        <div className="num" style={{ color: log.amount >= 0 ? 'var(--good)' : 'var(--like)', fontWeight: 800, whiteSpace: 'nowrap' }}>{assetAmount(log)}</div>
                      </div>
                    ))}
                    {assetHasMore && (
                      <div className="row" style={{ justifyContent: 'center', padding: 12, borderTop: '1px solid var(--line)' }}>
                        <button className="btn btn-ghost btn-sm" disabled={assetBusy} onClick={() => loadAssets(assetMonth, true)}>{assetBusy ? '加载中' : '加载更多'}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 创作数据 / creator stats */}
      {stats && (
        <div className="ui-card mc-data">
          <div className="mc-data-head"><Icon name="trend" size={16} /> 创作数据</div>
          <div className="mc-data-grid">
            <div className="mc-data-item"><span className="mc-data-ico di-like"><Icon name="heart" size={16} /></span><b>{fmtNum(stats.likes)}</b><span>累计获赞</span></div>
            <div className="mc-data-item"><span className="mc-data-ico di-view"><Icon name="eye" size={16} /></span><b>{fmtNum(stats.views)}</b><span>内容浏览</span></div>
            <div className="mc-data-item"><span className="mc-data-ico di-visit"><Icon name="user" size={16} /></span><b>{fmtNum(stats.visitors)}</b><span>主页访客</span></div>
            <div className="mc-data-item"><span className="mc-data-ico di-comment"><Icon name="comment" size={16} /></span><b>{fmtNum(stats.comments)}</b><span>收到评论</span></div>
          </div>
        </div>
      )}

      {/* 邀请好友 / invite & referral */}
      <div className="ui-card mc-invite">
        <div className="mc-invite-head">
          <div><Icon name="user" size={16} /> 邀请好友</div>
          <span className="mc-invite-count">已邀请 <b>{invites?.count ?? 0}</b> 人</span>
        </div>
        <p className="mc-invite-sub">好友用你的邀请链接注册，<b>你 +{invites?.rewardPerInvite ?? 50} 积分</b>、好友得 +30 积分见面礼。</p>
        <div className="mc-invite-row">
          <input className="inp" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="邀请链接" />
          <button type="button" className="btn btn-primary" onClick={copyInvite} style={{ flex: 'none' }}><Icon name="copy" size={15} /> 复制</button>
        </div>
        {invites?.invitees?.length > 0 && (
          <div className="mc-invite-avatars">
            {invites.invitees.slice(0, 10).map((u: any) => <Avatar key={u.id} user={u} size={30} />)}
          </div>
        )}
      </div>

      {/* check-in */}
      <div className="ui-card checkin-card">
        <div className="muted" style={{ fontSize: 13 }}>已连续签到</div>
        <div className="checkin-streak">{streak}<span style={{ fontSize: 16, fontWeight: 600 }}> 天</span></div>
        <div className="checkin-week">
          {['一','二','三','四','五','六','日'].map((d, i) => (
            <div key={d} className={`checkin-day${i < (streak % 7 || (streak ? 7 : 0)) ? ' done' : ''}`}>{i < (streak % 7 || (streak ? 7 : 0)) ? <Icon name="check" size={15} /> : d}</div>
          ))}
        </div>
        <button className={`btn ${checkedToday ? 'btn-ghost' : 'btn-primary'} btn-lg`} onClick={checkin} disabled={checkedToday} style={{ minWidth: 160 }}>
          {checkedToday ? '今日已签到' : '立即签到 +积分'}
        </button>
        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>连续签到积分更多，断签重新计算哦</div>
      </div>

      {/* quick links */}
      <div className="ui-card" style={{ padding: 8 }}>
        <Link to="/achievements" className="rail-item" style={{ color: 'var(--brand)' }}><span className="ico"><Icon name="trend" size={20} /></span> 任务中心 · 成就勋章</Link>
        <Link to={`/u/${user.username}`} className="rail-item"><span className="ico"><Icon name="user" size={20} /></span> 我的主页</Link>
        <Link to="/mall" className="rail-item"><span className="ico"><Icon name="shop" size={20} /></span> 积分商城</Link>
        <Link to="/bookmarks" className="rail-item"><span className="ico"><Icon name="bookmark" size={20} /></span> 我的收藏</Link>
        <Link to="/certification" className="rail-item"><span className="ico"><Icon name="shield" size={20} /></span> 身份认证</Link>
        <Link to="/settings" className="rail-item"><span className="ico"><Icon name="edit" size={20} /></span> 编辑资料</Link>
        <Link to="/notifications" className="rail-item"><span className="ico"><Icon name="bell" size={20} /></span> 消息通知</Link>
        {user.role === 'admin' && <Link to="/admin" className="rail-item" style={{ color: 'var(--brand)' }}><span className="ico"><Icon name="shield" size={20} /></span> 管理后台</Link>}
      </div>

      <Modal open={rechargeOpen} onClose={() => setRechargeOpen(false)}>
        <div className="modal-head"><div className="modal-title">充值中心</div><div className="modal-sub">充值账户余额，余额可用于开通会员、商城兑换等</div></div>
        <div className="modal-body">
          <div className="field">
            <label>选择充值金额</label>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {[1000, 3000, 6800, 19800].map((a) => (
                <button key={a} className={`btn ${amount === a ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setAmount(a)}>¥{(a/100).toFixed(0)}</button>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={recharge}>确认充值 ¥{(amount/100).toFixed(2)}</button>
          <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>演示环境，充值为模拟操作，不会产生真实扣费</div>
        </div>
      </Modal>
    </Shell>
  );
}
