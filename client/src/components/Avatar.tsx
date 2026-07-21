import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import type { PublicUser } from '../types';

const GRADS: [string, string][] = [
  ['#7c5cff', '#5b8def'], ['#22b8cf', '#0ca678'], ['#ff922b', '#f76707'],
  ['#f06595', '#e64980'], ['#4c6ef5', '#3b5bdb'], ['#20c997', '#12b886'],
  ['#fab005', '#f59f00'], ['#e8590c', '#d9480f'], ['#15aabf', '#1098ad'],
  ['#cc5de8', '#ae3ec9'], ['#fa5252', '#e03131'], ['#5c7cfa', '#4263eb'],
];

function hashSeed(str = ''): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initialOf(name = ''): string {
  const c = name.trim()[0] || '?';
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

function isBlockedAvatarUrl(value = ''): boolean {
  try {
    const u = new URL(value);
    return u.hostname === 'i.pravatar.cc' || u.hostname.endsWith('.pravatar.cc');
  } catch {
    return false;
  }
}

function avatarFrameClass(value = ''): string {
  const key = value.trim().toLowerCase();
  return /^[a-z0-9_-]+$/.test(key) ? ` frame-${key}` : '';
}

function avatarFrameStyle(value = '', size: number): CSSProperties {
  const frame = value.trim();
  const style: CSSProperties = { width: size, height: size };
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(frame)) {
    (style as CSSProperties & Record<string, string>)['--avatar-frame'] = frame;
  }
  return style;
}

interface ParsedAvatar {
  url?: string;
  emoji?: string;
  color?: string;
  initial?: string;
  grad?: string;
}

// avatar value forms:
//   "/uploads/x.jpg" | "https://…"  → image
//   "emoji:🦊:#7c5cff"               → emoji on color (legacy / user choice)
//   null                              → initial on deterministic gradient
function parse(value: string | null | undefined, seed: string): ParsedAvatar {
  if (value && (value.startsWith('http') || value.startsWith('/uploads'))) {
    if (value.startsWith('http') && isBlockedAvatarUrl(value)) {
      const [a, b] = GRADS[hashSeed(seed) % GRADS.length];
      return { initial: initialOf(seed), grad: `linear-gradient(140deg, ${a}, ${b})` };
    }
    return { url: value };
  }
  if (value && value.startsWith('emoji:')) {
    const [, emoji, color] = value.split(':');
    return { emoji, color: color || '#cdd3dd' };
  }
  const [a, b] = GRADS[hashSeed(seed) % GRADS.length];
  return { initial: initialOf(seed), grad: `linear-gradient(140deg, ${a}, ${b})` };
}

type AvatarUser = Partial<PublicUser> & {
  nickname?: string;
  username?: string;
  avatar?: string;
  avatarFrame?: string;
  verified?: boolean;
  verifiedNote?: string;
  certType?: string;
  certLabel?: string;
  anonymous?: boolean;
};

export interface AvatarProps {
  user?: AvatarUser | null;
  size?: number;
  to?: string | null;
  ring?: boolean;
  showV?: boolean;
  emoji?: string;
  noLink?: boolean;
}

export default function Avatar({ user, size = 44, to, ring = false, showV = false, emoji: rawEmoji, noLink = false }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const seed = user?.nickname || user?.username || '?';
  const value = rawEmoji ?? user?.avatar;
  const a = parse(value, seed);
  // Background / identity layer: for image avatars fall back to the deterministic
  // gradient+initial so the tile shows the user's colour+initial *while the image
  // loads or if it fails* — instead of a blank/grey box (matters for slow/blocked
  // external avatars). The <img> overlays this layer and covers it once loaded.
  const bg = a.url ? parse(null, seed) : a;

  const style: CSSProperties = { width: size, height: size, fontSize: Math.round(size * (bg.initial ? 0.42 : 0.5)) };
  if (bg.color) style.background = bg.color;
  if (bg.grad) { style.background = bg.grad; style.fontWeight = 700; style.letterSpacing = '.5px'; }

  // V badge lives OUTSIDE the clipping (.avatar has overflow:hidden) so it isn't cut off
  const frame = user?.avatarFrame;
  const certType = String(user?.certType || '');
  const certName = certType === 'enterprise' ? '企业认证' : '个人认证';
  const certTitle = user?.certLabel ? `${certName} · ${user.certLabel}` : certName;
  const inner = (
    <span className={`avatar-wrap${frame ? ` has-frame${avatarFrameClass(frame)}` : ''}`} style={frame ? avatarFrameStyle(frame, size) : { width: size, height: size }}>
      <span className={`ui-avatar${ring ? ' ring' : ''}`} style={style} aria-hidden>
        {bg.emoji ? bg.emoji : bg.initial}
        {a.url && !broken && <img src={a.url} alt="" loading="lazy" onError={() => setBroken(true)} />}
      </span>
      {showV && certType && (
        <span
          className={`avatar-v avatar-v-${certType === 'enterprise' ? 'enterprise' : 'personal'}`}
          title={certTitle}
          aria-label={certTitle}
        >
          V
        </span>
      )}
    </span>
  );

  const href = noLink ? null : (to || (user?.username ? `/u/${user.username}` : null));
  if (href && !user?.anonymous) return <Link to={href} aria-label={user?.nickname}>{inner}</Link>;
  return inner;
}
