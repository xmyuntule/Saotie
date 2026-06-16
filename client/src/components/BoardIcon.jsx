import Icon from './Icon';

// Per-board SVG icon + accent color — replaces the seeded emoji glyphs (anti-slop).
// Keyed by board slug; unknown slugs fall back to a neutral forum icon.
export const BOARD_STYLE = {
  talk: { icon: 'comment', color: '#2b54f0' }, newbie: { icon: 'smile', color: '#0e9f6e' },
  complain: { icon: 'fire', color: '#e11d6b' }, tech: { icon: 'code', color: '#2b54f0' },
  frontend: { icon: 'palette', color: '#0e8fb8' }, backend: { icon: 'settings', color: '#7c3aed' },
  hobby: { icon: 'heart', color: '#e11d6b' }, market: { icon: 'shop', color: '#ef6c12' },
  life: { icon: 'smile', color: '#ef6c12' }, help: { icon: 'help', color: '#0e9f6e' },
};
export const boardStyle = (slug) => BOARD_STYLE[slug] || { icon: 'forum', color: 'var(--brand)' };

// A filled tile (board cards / board hero). `size` sets the tile box; the glyph scales with it.
export function BoardTile({ slug, size }) {
  const s = boardStyle(slug);
  const style = { '--bc': s.color };
  if (size) { style.width = size; style.height = size; }
  return (
    <span className="board-ico" style={style}>
      <Icon name={s.icon} size={size ? Math.round(size * 0.5) : 22} style={{ color: s.color }} />
    </span>
  );
}

// A bare colored glyph (compact sidebar rows / sub-board chips).
export function BoardMini({ slug, size = 16 }) {
  const s = boardStyle(slug);
  return <Icon name={s.icon} size={size} style={{ color: s.color, flex: 'none' }} />;
}
