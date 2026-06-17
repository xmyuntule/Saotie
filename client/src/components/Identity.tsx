import { Link } from 'react-router-dom';
import { GENDER } from '../lib/format';
import type { PublicUser } from '../types';

type IdentityUser = Partial<PublicUser> & {
  username?: string;
  nickname?: string;
  level?: number;
  verified?: boolean;
  verifiedNote?: string;
  vip?: boolean;
  title?: string;
  gender?: string;
  anonymous?: boolean;
};

export function LevelBadge({ level }: { level?: number }) {
  if (!level) return null;
  return <span className="ui-badge badge-lv">Lv.{level}</span>;
}

export function Badges({ user, showLevel = true, showTitle = true }: { user?: IdentityUser | null; showLevel?: boolean; showTitle?: boolean }) {
  if (!user) return null;
  return (
    <>
      {user.verified && <span className="ui-badge badge-v" title={user.verifiedNote || '认证'}>V</span>}
      {user.vip && <span className="ui-badge badge-vip" title="VIP 会员">VIP</span>}
      {showLevel && <LevelBadge level={user.level} />}
      {showTitle && user.title && <span className="ui-badge badge-title" title="头衔">{user.title}</span>}
    </>
  );
}

// Name + inline badges
export function UserName({ user, className = 'uname', showBadges = true }: { user?: IdentityUser | null; className?: string; showBadges?: boolean }) {
  if (!user) return null;
  if (user.anonymous) return <span className={className} style={{ color: 'var(--ink-2)' }}>匿名用户</span>;
  return (
    <Link to={`/u/${user.username}`} className={className}>
      {user.nickname}
      {user.gender && GENDER[user.gender] && (
        <span className="faint" style={{ fontWeight: 400, color: user.gender === 'female' ? '#f06595' : '#4c6ef5' }}>
          {GENDER[user.gender]}
        </span>
      )}
      {showBadges && <Badges user={user} />}
    </Link>
  );
}
