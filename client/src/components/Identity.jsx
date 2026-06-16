import { Link } from 'react-router-dom';
import { GENDER } from '../lib/format';

export function LevelBadge({ level }) {
  if (!level) return null;
  return <span className="badge badge-lv">Lv.{level}</span>;
}

export function Badges({ user, showLevel = true, showTitle = true }) {
  if (!user) return null;
  return (
    <>
      {user.verified && <span className="badge badge-v" title={user.verifiedNote || '认证'}>V</span>}
      {user.vip && <span className="badge badge-vip" title="VIP 会员">VIP</span>}
      {showLevel && <LevelBadge level={user.level} />}
      {showTitle && user.title && <span className="badge badge-title" title="头衔">{user.title}</span>}
    </>
  );
}

// Name + inline badges
export function UserName({ user, className = 'uname', showBadges = true }) {
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
