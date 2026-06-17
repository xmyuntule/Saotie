import { NavLink, Link } from 'react-router-dom';
import Avatar from './Avatar';
import Icon from './Icon';
import { Badges } from './Identity';
import { useAuth } from '../context/AuthContext';
import { useCompose } from '../context/ComposeContext';

interface RailItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  auth?: boolean;
}

const ITEMS: RailItem[] = [
  { to: '/', icon: 'home', label: '首页', end: true },
  { to: '/discover', icon: 'compass', label: '发现' },
  { to: '/circles', icon: 'users', label: '圈子' },
  { to: '/qa', icon: 'help', label: '问答' },
  { to: '/flash', icon: 'bell', label: '快报' },
  { to: '/articles', icon: 'book', label: '专栏' },
  { to: '/events', icon: 'ticket', label: '活动' },
  { to: '/nav', icon: 'grid', label: '导航' },
  { to: '/forum', icon: 'forum', label: '论坛' },
  { to: '/leaderboard', icon: 'trend', label: '排行榜' },
  { to: '/achievements', icon: 'checkin', label: '任务', auth: true },
  { to: '/checkin', icon: 'calendar', label: '签到', auth: true },
  { to: '/lottery', icon: 'gift', label: '抽奖' },
  { to: '/mall', icon: 'shop', label: '积分商城' },
  { to: '/assistant', icon: 'spark', label: 'AI 助手', auth: true },
  { to: '/messages', icon: 'mail', label: '私信', auth: true },
  { to: '/notifications', icon: 'bell', label: '通知', auth: true },
  { to: '/member', icon: 'coin', label: '会员中心', auth: true },
];

interface LeftRailProps {
  onCompose?: () => void;
}

export default function LeftRail({ onCompose }: LeftRailProps) {
  const { user, setAuthOpen } = useAuth();
  const { openCompose } = useCompose();

  return (
    <div className="col-left">
      {user && (
        <Link to={`/u/${user.username}`} className="ui-card" style={{ padding: 14, marginBottom: 14, display: 'block' }}>
          <div className="row gap-12">
            <Avatar user={user} size={48} showV />
            <div className="nowrap">
              <div className="uname" style={{ fontSize: 15 }}>{user.nickname} <Badges user={user} showLevel={false} /></div>
              <div className="faint" style={{ fontSize: 12.5 }}>@{user.username}</div>
            </div>
          </div>
          <div className="row" style={{ marginTop: 12, gap: 16, fontSize: 13 }}>
            <span><b className="num" style={{ fontWeight: 800 }}>{user.postCount}</b> <span className="muted">动态</span></span>
            <span><b className="num" style={{ fontWeight: 800 }}>{user.following}</b> <span className="muted">关注</span></span>
            <span><b className="num" style={{ fontWeight: 800 }}>{user.followers}</b> <span className="muted">粉丝</span></span>
          </div>
        </Link>
      )}

      <nav className="rail">
        {ITEMS.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={(e: React.MouseEvent) => { if (it.auth && !user) { e.preventDefault(); setAuthOpen(true); } }}
            className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}
          >
            <span className="ico"><Icon name={it.icon} size={21} /></span> {it.label}
          </NavLink>
        ))}
        {user?.role === 'admin' && (
          <NavLink to="/admin" className={({ isActive }) => `rail-item${isActive ? ' active' : ''}`}>
            <span className="ico"><Icon name="shield" size={21} /></span> 管理后台
          </NavLink>
        )}
      </nav>

      <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 14 }} onClick={openCompose}>
        <Icon name="edit" size={17} /> 发布动态
      </button>
    </div>
  );
}
