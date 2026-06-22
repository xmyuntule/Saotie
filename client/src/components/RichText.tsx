import { Link } from 'react-router-dom';
import { parseRich } from '../lib/format';

// Only allow http(s):// external links or internal /paths; anything else (javascript:, etc.) renders as plain text.
export function safeHref(h?: string): string | null {
  if (!h) return null;
  if (/^https?:\/\//i.test(h)) return h;
  if (/^\/[^/]/.test(h)) return h;
  return null;
}

// Render a single line of text into inline rich nodes. Shared by RichText (inline) and RichBody (block).
export function renderInline(text?: string) {
  return parseRich(text || '').map((p, i) => {
    if (p.t === 'topic') return <Link key={i} className="tag" to={`/topic/${encodeURIComponent(p.v)}`}>#{p.v}#</Link>;
    if (p.t === 'mention') return <Link key={i} className="mention" to={`/u/${encodeURIComponent(p.v)}`}>@{p.v}</Link>;
    if (p.t === 'bold') return <strong key={i}>{p.v}</strong>;
    if (p.t === 'strike') return <del key={i}>{p.v}</del>;
    if (p.t === 'code') return <code key={i} className="rt-code">{p.v}</code>;
    if (p.t === 'link') {
      const href = safeHref(p.h);
      if (!href) return <span key={i}>{p.v}</span>;
      if (href[0] === '/') return <Link key={i} className="rt-link" to={href}>{p.v}</Link>;
      return <a key={i} className="rt-link" href={href} target="_blank" rel="noopener noreferrer nofollow">{p.v}</a>;
    }
    return <span key={i}>{p.v}</span>;
  });
}

export default function RichText({ text }: { text?: string }) {
  return <>{renderInline(text)}</>;
}
