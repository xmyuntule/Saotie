import { NavLink } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';

const TABS = [
  { to: '/', icon: 'home', label: '首页', end: true },
  { to: '/discover', icon: 'compass', label: '发现' },
  { to: '/forum', icon: 'forum', label: '论坛' },
  { to: '/messages', icon: 'mail', label: '私信', auth: true },
  { to: '/member', icon: 'user', label: '我的', auth: true },
];

export default function TabBar() {
  const { user, setAuthOpen } = useAuth();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}
          onClick={(e) => { if (t.auth && !user) { e.preventDefault(); setAuthOpen(true); } }}
          className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="ico"><Icon name={t.icon} size={21} /></span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
