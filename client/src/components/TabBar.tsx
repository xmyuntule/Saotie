import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useSite, moduleOn } from '../context/SiteContext';
import { useCompose } from '../context/ComposeContext';
import { useUnread } from '../context/UnreadContext';

interface TabItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
  auth?: boolean;
  module?: string;
}

const TABS: TabItem[] = [
  { to: '/', icon: 'home', label: '首页', end: true },
  { to: '/discover', icon: 'compass', label: '发现', module: 'discover' },
  { to: '/messages', icon: 'mail', label: '私信', auth: true },
  { to: '/member', icon: 'user', label: '我的', auth: true },
];

export default function TabBar() {
  const { user, setAuthOpen } = useAuth();
  const { modules } = useSite();
  const { openCompose } = useCompose();
  const { msg } = useUnread();
  const tabs = TABS.filter((t) => moduleOn(modules, t.module));
  const renderTab = (t: TabItem) => (
    <NavLink key={t.to} to={t.to} end={t.end}
      aria-label={t.to === '/messages' && msg > 0 ? `私信，${msg} 条未读` : t.label}
      onClick={(e) => { if (t.auth && !user) { e.preventDefault(); setAuthOpen(true); } }}
      className={({ isActive }) => (isActive ? 'active' : '')}>
      <span className="ico"><Icon name={t.icon} size={21} />{t.to === '/messages' && msg > 0 && <span className="nav-dot" aria-hidden="true">{msg > 99 ? '99+' : msg}</span>}</span>
      {t.label}
    </NavLink>
  );
  return (
    <nav className="tabbar" aria-label="底部导航">
      {tabs.filter((t) => !t.auth).map(renderTab)}
      <button type="button" className="tabbar-compose" onClick={() => openCompose()} aria-label="发布动态"><span className="ico"><Icon name="plus" size={23} /></span>发布</button>
      {tabs.filter((t) => t.auth).map(renderTab)}
    </nav>
  );
}
