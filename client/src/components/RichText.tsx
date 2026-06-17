import { Link } from 'react-router-dom';
import { parseRich } from '../lib/format';

export default function RichText({ text }: { text?: string }) {
  const parts = parseRich(text || '');
  return (
    <>
      {parts.map((p, i) => {
        if (p.t === 'topic') return <Link key={i} className="tag" to={`/topic/${encodeURIComponent(p.v)}`}>#{p.v}#</Link>;
        if (p.t === 'mention') return <Link key={i} className="mention" to={`/u/${encodeURIComponent(p.v)}`}>@{p.v}</Link>;
        return <span key={i}>{p.v}</span>;
      })}
    </>
  );
}
