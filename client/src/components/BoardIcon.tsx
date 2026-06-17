import type { CSSProperties } from 'react';
import Icon from './Icon';

interface BoardStyleEntry { icon: string; color: string; }

// Per-board SVG icon + accent color — replaces the seeded emoji glyphs (anti-slop).
// Keyed by board slug; unknown slugs fall back to a neutral forum icon.
export const BOARD_STYLE: Record<string, BoardStyleEntry> = {
  talk: { icon: 'comment', color: '#2b54f0' }, newbie: { icon: 'smile', color: '#0e9f6e' },
  complain: { icon: 'fire', color: '#e11d6b' }, tech: { icon: 'code', color: '#2b54f0' },
  frontend: { icon: 'palette', color: '#0e8fb8' }, backend: { icon: 'settings', color: '#7c3aed' },
  hobby: { icon: 'heart', color: '#e11d6b' }, market: { icon: 'shop', color: '#ef6c12' },
  life: { icon: 'smile', color: '#ef6c12' }, help: { icon: 'help', color: '#0e9f6e' },
};
export const boardStyle = (slug: string): BoardStyleEntry => BOARD_STYLE[slug] || { icon: 'forum', color: 'var(--brand)' };

// A filled tile (board cards / board hero). `size` sets the tile box; the glyph scales with it.
export function BoardTile({ slug, size }: { slug: string; size?: number }) {
  const s = boardStyle(slug);
  const style: CSSProperties = { '--bc': s.color } as CSSProperties;
  if (size) { style.width = size; style.height = size; }
  return (
    <span className="board-ico" style={style}>
      <Icon name={s.icon} size={size ? Math.round(size * 0.5) : 22} style={{ color: s.color }} />
    </span>
  );
}

// A bare colored glyph (compact sidebar rows / sub-board chips).
export function BoardMini({ slug, size = 16 }: { slug: string; size?: number }) {
  const s = boardStyle(slug);
  return <Icon name={s.icon} size={size} style={{ color: s.color, flex: 'none' }} />;
}
