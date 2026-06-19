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
import api from '../api/client';
import { fmtNum } from '../lib/format';

// VIP 特权 — each benefit gets its own icon + descriptor (structural variety, not 5 identical check rows)
const PERKS = [
  { icon: 'shield', name: '专属 VIP 标识', desc: '昵称旁亮出尊贵身份' },
  { icon: 'pin', name: '动态置顶展示', desc: '重要动态固定主页顶部' },
  { icon: 'mail', name: '私信无限制', desc: '畅聊不受每日条数限制' },
  { icon: 'palette', name: '主页个性装扮', desc: '专属封面与主页样式' },
  { icon: 'coin', name: '更高每日积分', desc: '签到互动多得积分' },
];

export default function Member() {
  const { user, loading: authLoading, setAuthOpen, patchUser } = useAuth();
  const toast = useToast();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState(3000);
  const [vipPlan, setVipPlan] = useState(false);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    api.get('/users/me/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, [user?.id]);

  if (authLoading) return <Shell right={false}><Loading /></Shell>;
  if (!user) return <Shell right={false}><div className="ui-card"><Empty icon="🔒" text="登录后查看会员中心" /></div></Shell>;

  const checkedToday = user.lastCheckin === new Date().toISOString().slice(0, 10);
  const checkin = async () => {
    try { const { data } = await api.post('/auth/checkin'); patchUser(data.user); toast.ok(`签到成功 · 连签 ${data.streak} 天 · +${data.pointsEarned} 积分`); }
    catch (e: any) { toast.err(e.message); }
  };
  const recharge = async () => {
    try { const { data } = await api.post('/users/me/recharge', { amount: Number(amount), vip: vipPlan }); patchUser(data.user); setRechargeOpen(false); toast.ok('充值成功 🎉'); }
    catch (e: any) { toast.err(e.message); }
  };

  const lp = (user.levelProgress as any) || { percent: 0, nextLevelExp: 0, exp: 0 };
  // 连签数需与签到逻辑一致：上次签到非今/昨日即视为断签归零，避免会员页与签到页数据矛盾
  const streak = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    return (user.lastCheckin === today || user.lastCheckin === yest) ? (user.checkinStreak || 0) : 0;
  })();
  const openVip = () => { setVipPlan(true); setRechargeOpen(true); };

  return (
    <Shell>
      {/* identity card */}
      <div className="ui-card" style={{ padding: 20, background: 'linear-gradient(135deg, #1f2640, #2f6bff)' , color: '#fff', overflow: 'hidden' }}>
        <div className="row gap-12">
          <Avatar user={user} size={64} showV ring />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row gap-6" style={{ fontSize: 19, fontWeight: 800, flexWrap: 'wrap' }}>{user.nickname} <Badges user={user} /></div>
            <div className="nowrap" style={{ opacity: .85, fontSize: 13, marginTop: 2 }}>@{user.username} · {user.vip ? 'VIP 会员' : '普通会员'}</div>
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

      {/* VIP 特权 */}
      <div className="ui-card vip-card">
        <div className="vip-card-head">
          <span className="vip-emblem"><Icon name="shield" size={21} fill /></span>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="vip-title">{user.vip ? 'VIP 会员' : '升级 VIP 会员'}</div>
            <div className="vip-sub">{user.vip ? '正在尊享以下全部专属特权' : '解锁 5 项专属特权，社区体验更进一步'}</div>
          </div>
          {user.vip
            ? <span className="vip-active"><Icon name="check" size={13} /> 已开通</span>
            : <button className="btn btn-primary" style={{ flex: 'none' }} onClick={openVip}>开通会员</button>}
        </div>
        <div className="vip-perks">
          {PERKS.map((p) => (
            <div className="vip-perk" key={p.name}>
              <span className="vip-perk-ico"><Icon name={p.icon} size={16} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="vip-perk-name">{p.name}</div>
                <div className="vip-perk-desc">{p.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* stat grid */}
      <div className="mc-grid">
        <div className="mc-stat points"><div className="v">{fmtNum(user.points)}</div><div className="k"><Icon name="coin" size={13} /> 我的积分</div></div>
        <div className="mc-stat bal"><div className="v">¥{((user.balance as number) / 100).toFixed(2)}</div><div className="k"><Icon name="wallet" size={13} /> 账户余额</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.followers)}</div><div className="k">粉丝</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.postCount)}</div><div className="k">动态</div></div>
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
        <Link to="/settings" className="rail-item"><span className="ico"><Icon name="edit" size={20} /></span> 编辑资料</Link>
        <Link to="/notifications" className="rail-item"><span className="ico"><Icon name="bell" size={20} /></span> 消息通知</Link>
        {user.role === 'admin' && <Link to="/admin" className="rail-item" style={{ color: 'var(--brand)' }}><span className="ico"><Icon name="shield" size={20} /></span> 管理后台</Link>}
      </div>

      <Modal open={rechargeOpen} onClose={() => setRechargeOpen(false)}>
        <div className="modal-head"><div className="modal-title">充值中心</div><div className="modal-sub">充值余额，开通 VIP 享专属特权</div></div>
        <div className="modal-body">
          <div className="field">
            <label>充值金额（分）</label>
            <div className="row gap-8" style={{ flexWrap: 'wrap' }}>
              {[1000, 3000, 6800, 19800].map((a) => (
                <button key={a} className={`btn ${amount === a ? 'btn-primary' : 'btn-outline'} btn-sm`} onClick={() => setAmount(a)}>¥{(a/100).toFixed(0)}</button>
              ))}
            </div>
          </div>
          <label className="row gap-8" style={{ padding: '10px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={vipPlan} onChange={(e) => setVipPlan(e.target.checked)} />
            <span>同时开通 / 续费 VIP 会员（1 个月）</span>
          </label>
          <button className="btn btn-primary btn-lg btn-block" onClick={recharge}>确认充值 ¥{(amount/100).toFixed(2)}</button>
          <div className="muted" style={{ fontSize: 12, textAlign: 'center', marginTop: 10 }}>演示环境，充值为模拟操作，不会产生真实扣费</div>
        </div>
      </Modal>
    </Shell>
  );
}
