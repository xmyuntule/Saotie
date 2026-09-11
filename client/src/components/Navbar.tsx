import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Avatar from './Avatar';
import Icon from './Icon';
import ThemeSwitcher from './ThemeSwitcher';
import MobileDrawer from './MobileDrawer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useUnread } from '../context/UnreadContext';
import { isSearchShortcut } from '../lib/search-shortcut';
import { useSite } from '../context/SiteContext';
import api from '../api/client';

export function brandInitial(name?: string) {
  const first = Array.from((name || 'SaotieSNS').trim())[0] || 'S';
  return /^[a-z]$/i.test(first) ? first.toUpperCase() : first;
}

export function BrandMark({ size = 33, logo, name }: { size?: number; logo?: string; name?: string }) {
  if (logo) {
    return <img className="brand-mark brand-mark-img" src={logo} alt="" width={size} height={size}
      style={{ width: size, height: size }} aria-hidden />;
  }
  return (
    <span
      className="brand-mark brand-mark-text"
      style={{ width: size, height: size, fontSize: Math.max(15, Math.round(size * 0.52)) }}
      aria-hidden
    >
      {brandInitial(name)}
    </span>
  );
}

// 站名渲染：跟随后台「系统 - 外观 - 站点名称」配置。
export function BrandName({ name }: { name: string }) {
  return <span className="brand-name"><b>{name?.trim() || 'SaotieSNS'}</b></span>;
}

export default function Navbar() {
  const { user, logout, setAuthOpen, patchUser } = useAuth();
  const site = useSite();
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const [q, setQ] = useState('');
  const unread = useUnread();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const [checkinBusy, setCheckinBusy] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isSearchShortcut(event) || document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      if (window.matchMedia('(min-width: 881px)').matches) searchRef.current?.focus();
      else nav('/search');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [nav]);

  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) nav(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  const checkin = async () => {
    if (checkinBusy) return;
    setCheckinBusy(true);
    try {
      const { data } = await api.post('/auth/checkin');
      patchUser(data.user);
      toast.ok(`签到成功 · 连签 ${data.streak} 天 · +${data.pointsEarned} 积分`);
    } catch (e: any) { toast.err(e.message); }
    finally { setCheckinBusy(false); }
  };

  const checkedToday = user?.lastCheckin === new Date().toISOString().slice(0, 10);

  return (
    <>
    <header className="nav">
      <div className="nav-inner">
        <button type="button" className="nav-burger" onClick={() => setDrawerOpen(true)} aria-label="打开菜单"><Icon name="menu" size={22} /></button>
        <Link to="/" className="brand">
          <BrandMark logo={site.logo} name={site.name} />
          <BrandName name={site.name} />
        </Link>

        <div className="spacer" />

        <form className="nav-search" onSubmit={search}>
          <Icon name="search" size={17} style={{ color: 'var(--ink-4)' }} />
          <input ref={searchRef} value={q} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)} placeholder="搜索社区内容…" aria-label="搜索用户、动态、帖子和话题" aria-keyshortcuts="/ Control+k Meta+k" />
          <kbd aria-hidden="true">/</kbd>
        </form>

        <Link to="/search" className="nav-icon-btn nav-search-btn" aria-label="搜索"><Icon name="search" size={20} /></Link>

        <ThemeSwitcher />

        {user ? (
          <>
            <button type="button" className={`btn btn-sm nav-checkin ${checkedToday ? 'btn-ghost' : 'btn-outline'}`} onClick={checkin} disabled={checkedToday || checkinBusy} style={{ gap: 5 }}>
              <Icon name="checkin" size={15} /> {checkinBusy ? '签到中…' : checkedToday ? '已签到' : '签到'}
            </button>
            <Link to="/notifications" className="nav-icon-btn" title="通知" aria-label={`通知${unread.notif ? `，${unread.notif} 条未读` : ''}`}>
              <Icon name="bell" size={21} />
              {unread.notif > 0 && <span className="nav-dot">{unread.notif > 99 ? '99+' : unread.notif}</span>}
            </Link>
            <Link to="/messages" className="nav-icon-btn nav-msg-btn" title="私信" aria-label={`私信${unread.msg ? `，${unread.msg} 条未读` : ''}`}>
              <Icon name="mail" size={21} />
              {unread.msg > 0 && <span className="nav-dot">{unread.msg > 99 ? '99+' : unread.msg}</span>}
            </Link>
            <div ref={menuRef} style={{ position: 'relative' }} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setMenuOpen(false); }}
              onKeyDown={(e) => { if (e.key === 'Escape' && menuOpen) { e.preventDefault(); setMenuOpen(false); menuTriggerRef.current?.focus(); } }}>
              <button ref={menuTriggerRef} type="button" className="account-trigger" onClick={() => setMenuOpen((m) => !m)} style={{ display: 'flex' }} aria-label="账号菜单" aria-expanded={menuOpen} aria-controls="account-panel">
                <Avatar user={user} size={38} showV ring noLink />
              </button>
              {menuOpen && (
                <div id="account-panel" className="ui-card" style={{ position: 'absolute', right: 0, top: 48, zIndex: 60, width: 200, padding: 8, boxShadow: 'var(--shadow-pop)' }}>
                  <Link to={`/u/${user.username}`} className="row gap-8" style={{ padding: '8px 10px' }} onClick={() => setMenuOpen(false)}>
                    <Avatar user={user} size={40} showV noLink />
                    <div className="nowrap">
                      <div className="uname">{user.nickname}</div>
                      <div className="faint" style={{ fontSize: 12 }}>Lv.{user.level} · {user.points} 积分</div>
                    </div>
                  </Link>
                  <div className="divider" style={{ margin: '6px 0' }} />
                  <Link to={`/u/${user.username}`} className="rail-item" style={{ height: 40, fontSize: 14 }} onClick={() => setMenuOpen(false)}><Icon name="user" size={18} className="ico" /> 个人主页</Link>
                  <Link to="/member" className="rail-item" style={{ height: 40, fontSize: 14 }} onClick={() => setMenuOpen(false)}><Icon name="coin" size={18} className="ico" /> 会员中心</Link>
                  <Link to="/bookmarks" className="rail-item" style={{ height: 40, fontSize: 14 }} onClick={() => setMenuOpen(false)}><Icon name="bookmark" size={18} className="ico" /> 我的收藏</Link>
                  <Link to="/history" className="rail-item" style={{ height: 40, fontSize: 14 }} onClick={() => setMenuOpen(false)}><Icon name="clock" size={18} className="ico" /> 浏览足迹</Link>
                  <Link to="/settings" className="rail-item" style={{ height: 40, fontSize: 14 }} onClick={() => setMenuOpen(false)}><Icon name="settings" size={18} className="ico" /> 编辑资料</Link>
                  {user.role === 'admin' && <Link to="/admin" className="rail-item" style={{ height: 40, fontSize: 14, color: 'var(--brand)' }} onClick={() => setMenuOpen(false)}><Icon name="shield" size={18} className="ico" /> 管理后台</Link>}
                  <div className="divider" style={{ margin: '6px 0' }} />
                  <button type="button" className="rail-item" style={{ height: 40, fontSize: 14, color: 'var(--like)' }} onClick={() => { logout(); setMenuOpen(false); toast.show('已退出登录'); nav('/'); }}>
                    <Icon name="logout" size={18} className="ico" /> 退出登录
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="row gap-8">
            <button className="btn btn-ghost" onClick={() => setAuthOpen(true)}>登录</button>
            <button className="btn btn-primary" onClick={() => setAuthOpen(true)}>注册</button>
          </div>
        )}
      </div>
    </header>
    <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
