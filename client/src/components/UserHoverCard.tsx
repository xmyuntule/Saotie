import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import FollowButton from './FollowButton';
import { Badges } from './Identity';
import api from '../api/client';
import { fmtNum } from '../lib/format';

interface UserHoverCardProps {
  user: any;
  children?: ReactNode;
  placement?: string;
}

// Wrap a username/avatar; shows a mini-profile popover on hover (desktop).
export default function UserHoverCard({ user, children, placement = 'bottom' }: UserHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<any>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const enterT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const leaveT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!user?.username || user.anonymous) return children;

  const onEnter = () => {
    clearTimeout(leaveT.current);
    enterT.current = setTimeout(async () => {
      setOpen(true);
      if (!data) {
        try { const r = await api.get(`/users/${user.username}`); setData(r.data.user); } catch {}
      }
    }, 420);
  };
  const onLeave = () => {
    clearTimeout(enterT.current);
    leaveT.current = setTimeout(() => setOpen(false), 180);
  };
  const updatePosition = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cardW = 300;
    const cardH = 220;
    const gap = 8;
    const left = Math.min(Math.max(rect.left, gap), Math.max(gap, window.innerWidth - cardW - gap));
    const shouldTop = placement === 'top' || rect.bottom + cardH + gap > window.innerHeight;
    const top = shouldTop ? Math.max(gap, rect.top - cardH - gap) : Math.min(rect.bottom + gap, window.innerHeight - gap);
    setPos({ top, left });
  };

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, placement]);

  const u = data || user;
  return (
    <span ref={wrapRef} className="hovercard-wrap" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      {children}
      {open && createPortal(
        <div className={`hovercard hovercard-${placement}`} style={{ top: pos.top, left: pos.left }} onMouseEnter={() => clearTimeout(leaveT.current)} onMouseLeave={onLeave}>
          <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
            <Avatar user={u} size={52} showV />
            <div className="grow" style={{ minWidth: 0 }}>
              <Link to={`/u/${u.username}`} className="uname hovercard-name">{u.nickname} <Badges user={u} /></Link>
              <div className="faint" style={{ fontSize: 12.5 }}>@{u.username}</div>
            </div>
          </div>
          {u.bio && !u.bio.startsWith('emoji:') && <div className="hovercard-bio">{u.bio}</div>}
          <div className="hovercard-foot">
            <div className="row gap-16" style={{ fontSize: 13 }}>
              <Link to={`/u/${u.username}`}><b className="num">{fmtNum(u.postCount || 0)}</b> <span className="muted">动态</span></Link>
              <Link to={`/u/${u.username}`}><b className="num">{fmtNum(u.following || 0)}</b> <span className="muted">关注</span></Link>
              <Link to={`/u/${u.username}`}><b className="num">{fmtNum(u.followers || 0)}</b> <span className="muted">粉丝</span></Link>
            </div>
            <FollowButton user={u} />
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}
