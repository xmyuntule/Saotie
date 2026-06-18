import { Link } from 'react-router-dom';
import { parseRich } from '../lib/format';

export default function RichText({ text }: { text?: string }) {
  const parts = parseRich(text || '');
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === 'topic') return <Link key={i} className="tag" to={`/topic/${encodeURIComponent(p.v)}`}>#{p.v}#</Link>;
        if (p.t === 'mention') return <Link key={i} className="mention" to={`/u/${encodeURIComponent(p.v)}`}>@{p.v}</Link>;
        if (p.t === 'bold') return <strong key={i}>{p.v}</strong>;
        if (p.t === 'strike') return <del key={i}>{p.v}</del>;
        if (p.t === 'code') return <code key={i} className="rt-code">{p.v}</code>;
        return <span key={i}>{p.v}</span>;
      })}
    </>
  );
}
