import Icon from './Icon';

export function Loading({ label = '加载中…' }) {
  return <div className="center" style={{ padding: 48 }}><div className="ui-spinner" /></div>;
}

// Map the emoji that call sites pass to a real stroke icon (less "AI" than emoji-as-icon)
const EMOJI_ICON = {
  '🍃': 'compass', '👥': 'user', '🔖': 'bookmark', '🔍': 'search', '✍️': 'edit',
  '❤️': 'heart', '🔔': 'bell', '💬': 'comment', '🔒': 'lock', '📋': 'forum',
  '🛍️': 'shop', '🛒': 'shop', '👀': 'eye', '🛋️': 'comment', '📦': 'shop', '🎁': 'gift',
};

export function Empty({ icon = '🍃', text = '这里空空如也', children }) {
  const mapped = EMOJI_ICON[icon];
  return (
    <div className="empty">
      <div className="e-ico">{mapped ? <Icon name={mapped} size={34} /> : icon}</div>
      <div className="e-text">{text}</div>
      {children && <div className="e-action">{children}</div>}
    </div>
  );
}

const sk = (w, h, extra = {}) => <div className="skeleton" style={{ width: w, height: h, ...extra }} />;

export function PostSkeleton() {
  return (
    <div className="ui-card post">
      <div className="row gap-12">
        {sk(46, 46, { borderRadius: '30%' })}
        <div className="grow">{sk(120, 14, { marginBottom: 8 })}{sk(80, 11)}</div>
      </div>
      {sk('100%', 14, { margin: '16px 0 8px' })}
      {sk('70%', 14)}
    </div>
  );
}

// Rows skeleton for thread / user lists
export function RowSkeleton({ rows = 5 }) {
  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="row gap-12" style={{ padding: '15px 18px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
          {sk(42, 42, { borderRadius: '30%' })}
          <div className="grow">{sk('60%', 14, { marginBottom: 8 })}{sk('35%', 11)}</div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="ui-card" style={{ overflow: 'hidden' }}>
      {sk('100%', 170, { borderRadius: 0 })}
      <div style={{ padding: '0 22px 20px' }}>
        <div style={{ marginTop: -40 }}>{sk(86, 86, { borderRadius: '30%', border: '4px solid var(--surface)' })}</div>
        {sk(160, 20, { marginTop: 12 })}
        {sk(110, 13, { marginTop: 10 })}
        <div className="row gap-16" style={{ marginTop: 18 }}>{sk(60, 30)}{sk(60, 30)}{sk(60, 30)}{sk(60, 30)}</div>
      </div>
    </div>
  );
}
