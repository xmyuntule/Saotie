import { useState } from 'react';
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

export default function Member() {
  const { user, loading: authLoading, setAuthOpen, patchUser } = useAuth();
  const toast = useToast();
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [amount, setAmount] = useState(3000);
  const [vipPlan, setVipPlan] = useState(false);

  if (authLoading) return <Shell right={false}><Loading /></Shell>;
  if (!user) return <Shell right={false}><div className="card"><Empty icon="🔒" text="登录后查看会员中心" /></div></Shell>;

  const checkedToday = user.lastCheckin === new Date().toISOString().slice(0, 10);
  const checkin = async () => {
    try { const { data } = await api.post('/auth/checkin'); patchUser(data.user); toast.ok(`签到成功，连签 ${data.streak} 天，+${data.pointsEarned} 积分`); }
    catch (e) { toast.err(e.message); }
  };
  const recharge = async () => {
    try { const { data } = await api.post('/users/me/recharge', { amount: Number(amount), vip: vipPlan }); patchUser(data.user); setRechargeOpen(false); toast.ok('充值成功 🎉'); }
    catch (e) { toast.err(e.message); }
  };

  const lp = user.levelProgress || { percent: 0, nextLevelExp: 0, exp: 0 };
  const streak = user.checkinStreak || 0;

  const right = (
    <div className="card widget">
      <div className="widget-title" style={{ marginBottom: 10 }}>会员特权</div>
      {['专属 VIP 标识', '动态置顶展示', '私信无限制', '主页装扮', '更高每日积分'].map((p) => (
        <div className="row gap-8" key={p} style={{ padding: '7px 0', fontSize: 13.5 }}>
          <Icon name="check" size={15} style={{ color: 'var(--good)' }} /> {p}
        </div>
      ))}
    </div>
  );

  return (
    <Shell right={right}>
      {/* identity card */}
      <div className="card" style={{ padding: 20, background: 'linear-gradient(135deg, #1f2640, #2f6bff)' , color: '#fff', overflow: 'hidden' }}>
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

      {/* stat grid */}
      <div className="mc-grid">
        <div className="mc-stat points"><div className="v">{fmtNum(user.points)}</div><div className="k"><Icon name="coin" size={13} /> 我的积分</div></div>
        <div className="mc-stat bal"><div className="v">¥{(user.balance / 100).toFixed(2)}</div><div className="k"><Icon name="wallet" size={13} /> 账户余额</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.followers)}</div><div className="k">粉丝</div></div>
        <div className="mc-stat"><div className="v">{fmtNum(user.postCount)}</div><div className="k">动态</div></div>
      </div>

      {/* check-in */}
      <div className="card checkin-card">
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
      <div className="card" style={{ padding: 8 }}>
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
