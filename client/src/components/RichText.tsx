import { Link } from 'react-router-dom';
import { parseRich } from '../lib/format';

// Only allow http(s):// external links or internal /paths; anything else (javascript:, etc.) renders as plain text.
export function safeHref(h?: string): string | null {
  if (!h) return null;
  if (/^https?:\/\//i.test(h)) return h;
  if (/^\/[^/]/.test(h)) return h;
  return null;
}

function routedHref(h?: string): string | null {
  const href = safeHref(h);
  if (!href) return null;
  if (href[0] === '/') return href;
  try {
    const url = new URL(href);
    if (typeof window !== 'undefined' && url.origin === window.location.origin) {
      return `${url.pathname}${url.search}${url.hash}` || '/';
    }
    return `/go?url=${encodeURIComponent(url.toString())}`;
  } catch {
    return null;
  }
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
      const href = routedHref(p.h);
      if (!href) return <span key={i}>{p.v}</span>;
      return <Link key={i} className="rt-link" to={href}>{p.v}</Link>;
    }
    return <span key={i}>{p.v}</span>;
  });
}

export default function RichText({ text }: { text?: string }) {
  return <>{renderInline(text)}</>;
}
