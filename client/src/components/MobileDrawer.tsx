import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import Avatar from './Avatar';
import Icon from './Icon';
import { Badges } from './Identity';
import { useAuth } from '../context/AuthContext';
import { useCompose } from '../context/ComposeContext';
import { useTheme } from '../context/ThemeContext';
import { RailNavigation } from './LeftRail';
import { useSite } from '../context/SiteContext';
import { useDialog } from '../hooks/useDialog';

// Mobile-only slide-in drawer that surfaces the full LeftRail navigation
// (圈子/问答/快报/专栏/活动/导航/排行榜/任务/签到/抽奖/商城/会员…), which is
// otherwise unreachable on phones because the left rail is hidden ≤880px.
export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, setAuthOpen } = useAuth();
  const { openCompose } = useCompose();
  const { theme, toggle, skin, setSkin, skins, style, setStyle, styles } = useTheme();
  const site = useSite();
  const loc = useLocation();
  const { layerRef, panelRef } = useDialog(open, onClose);

  // close when the route changes (e.g. back button / programmatic nav)
  useEffect(() => { onClose(); }, [loc.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  return createPortal(
    <div ref={layerRef} className="mdrawer-root open">
      <div className="mdrawer-backdrop" onClick={onClose} />
      <aside ref={panelRef} className="mdrawer" role="dialog" aria-modal="true" aria-label="导航菜单" tabIndex={-1}>
        <div className="mdrawer-head">
          <span className="brand-name" style={{ fontSize: 18 }}><b>{site.name?.trim() || 'SaotieSNS'}</b></span>
          <button className="mdrawer-close" onClick={onClose} aria-label="关闭菜单"><Icon name="close" size={20} /></button>
        </div>

        {user ? (
          <Link to={`/u/${user.username}`} className="mdrawer-me" onClick={onClose}>
            <Avatar user={user} size={46} showV ring noLink />
            <div className="nowrap" style={{ minWidth: 0 }}>
              <div className="uname" style={{ fontSize: 15 }}>{user.nickname} <Badges user={user} showLevel={false} /></div>
              <div className="faint" style={{ fontSize: 12.5 }}>@{user.username} · Lv.{user.level} · {user.points} 积分</div>
            </div>
          </Link>
        ) : (
          <button className="btn btn-primary btn-block" style={{ margin: '2px 0 6px' }} onClick={() => { setAuthOpen(true); onClose(); }}>登录 / 注册</button>
        )}

        <RailNavigation mobile onNavigate={onClose} />

        <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 10 }} onClick={() => { openCompose(); onClose(); }}>
          <Icon name="edit" size={17} /> 发布动态
        </button>

        <details className="mdrawer-appearance">
          <summary>外观与配色</summary>
          <div className="ts-modes">
            <button aria-pressed={theme === 'light'} className={`ts-mode${theme === 'light' ? ' on' : ''}`} onClick={() => theme !== 'light' && toggle()}><Icon name="sun" size={15} /> 浅色</button>
            <button aria-pressed={theme === 'dark'} className={`ts-mode${theme === 'dark' ? ' on' : ''}`} onClick={() => theme !== 'dark' && toggle()}><Icon name="moon" size={15} /> 深色</button>
          </div>
          <div className="ts-skins">
            {skins.map((s: any) => (
              <button key={s.key} aria-pressed={skin === s.key} className={`ts-skin${skin === s.key ? ' on' : ''}`} onClick={() => setSkin(s.key)} title={s.label}>
                <span className="ts-dot" style={{ background: s.color }}>{skin === s.key && <Icon name="check" size={12} />}</span>
                <span className="ts-label">{s.label}</span>
              </button>
            ))}
          </div>
          <div className="ts-title" style={{ marginTop: 14 }}>视觉风格</div>
          <div className="ts-styles">
            {styles.map((st: any) => (
              <button key={st.key} aria-pressed={style === st.key} className={`ts-style${style === st.key ? ' on' : ''}`} onClick={() => setStyle(st.key)}>
                <span className="ts-style-name">{st.label}{style === st.key && <Icon name="check" size={12} />}</span>
                <span className="ts-style-desc">{st.desc}</span>
              </button>
            ))}
          </div>
        </details>
      </aside>
    </div>, document.body
  );
}
