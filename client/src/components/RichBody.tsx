import { Fragment } from 'react';
import { parseBlocks } from '../lib/format';
import { renderInline } from './RichText';

// Block-aware rich renderer for long-form bodies (post body, Q&A). Supports headings, lists,
// blockquotes (plus all inline markers). Plain text with no block structure renders exactly like
// RichText so the container's own white-space:pre-wrap keeps newlines — zero regression.
export default function RichBody({ text }: { text?: string }) {
  const t = text || '';
  const blocks = parseBlocks(t);
  if (blocks.length <= 1 && (!blocks[0] || blocks[0].t === 'p')) {
    return <>{renderInline(t)}</>;
  }
  const lines = (arr: string[]) => arr.map((ln, j) => <Fragment key={j}>{j > 0 && <br />}{renderInline(ln)}</Fragment>);
  return (
    <div className="rich">
      {blocks.map((b, i) => {
        if (b.t === 'h1') return <h3 key={i} className="rich-h rich-h1">{renderInline(b.items[0])}</h3>;
        if (b.t === 'h2') return <h4 key={i} className="rich-h rich-h2">{renderInline(b.items[0])}</h4>;
        if (b.t === 'h3') return <h5 key={i} className="rich-h rich-h3">{renderInline(b.items[0])}</h5>;
        if (b.t === 'quote') return <blockquote key={i} className="rich-quote">{lines(b.items)}</blockquote>;
        if (b.t === 'ul') return <ul key={i} className="rich-ul">{b.items.map((ln, j) => <li key={j}>{renderInline(ln)}</li>)}</ul>;
        if (b.t === 'ol') return <ol key={i} className="rich-ol">{b.items.map((ln, j) => <li key={j}>{renderInline(ln)}</li>)}</ol>;
        return <p key={i} className="rich-p">{lines(b.items)}</p>;
      })}
    </div>
  );
}
