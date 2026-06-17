import { Fragment, type ReactNode } from 'react';

// Lightweight markdown → React renderer for AI assistant replies.
// Renders to React elements (never innerHTML) so untrusted model output is XSS-safe.
// Covers the cases LLM chat output actually uses: headings, code fences, inline code,
// bold, italic, links, blockquotes, ordered/unordered lists, horizontal rules, paragraphs.

// Inline span parsing — priority: code > bold > italic > link. Recurses into bold.
function inline(text: string, kp: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*\n]+\*|(?<![A-Za-z0-9])_[^_\n]+_(?![A-Za-z0-9]))|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (m[1]) {
      out.push(<code key={`${kp}c${i}`} className="aimd-code">{tok.slice(1, -1)}</code>);
    } else if (m[2]) {
      out.push(<strong key={`${kp}b${i}`}>{inline(tok.slice(2, -2), `${kp}b${i}-`)}</strong>);
    } else if (m[3]) {
      out.push(<em key={`${kp}i${i}`}>{tok.slice(1, -1)}</em>);
    } else if (m[4]) {
      const mm = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(tok)!;
      const href = mm[2];
      const safe = /^(https?:|\/|mailto:)/i.test(href) ? href : '#';
      out.push(
        <a key={`${kp}a${i}`} href={safe} target="_blank" rel="noopener noreferrer nofollow" className="aimd-link">{mm[1]}</a>,
      );
    }
    last = m.index + tok.length;
    i++;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const BLOCK_STARTER = /^(```|#{1,4}\s|>\s?|\s*[-*+]\s+|\s*\d+\.\s+|(-{3,}|\*{3,}|_{3,})\s*$)/;

export default function AiMarkdown({ text }: { text: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;
  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; // closing fence
      blocks.push(<pre key={k++} className="aimd-pre"><code>{buf.join('\n')}</code></pre>);
      continue;
    }
    // blank line
    if (line.trim() === '') { i++; continue; }
    // heading (# → h3, deeper clamps to h6)
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = `h${Math.min(h[1].length + 2, 6)}` as 'h3' | 'h4' | 'h5' | 'h6';
      blocks.push(<Tag key={k} className="aimd-h">{inline(h[2], `h${k}-`)}</Tag>);
      k++; i++; continue;
    }
    // horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) { blocks.push(<hr key={k++} className="aimd-hr" />); i++; continue; }
    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push(<blockquote key={k} className="aimd-quote">{inline(buf.join(' '), `q${k}-`)}</blockquote>);
      k++; continue;
    }
    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*[-*+]\s+/, ''), `ul${k}-${items.length}-`)}</li>);
        i++;
      }
      blocks.push(<ul key={k++} className="aimd-ul">{items}</ul>);
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(<li key={items.length}>{inline(lines[i].replace(/^\s*\d+\.\s+/, ''), `ol${k}-${items.length}-`)}</li>);
        i++;
      }
      blocks.push(<ol key={k++} className="aimd-ol">{items}</ol>);
      continue;
    }
    // paragraph — gather consecutive lines until blank or a block starter
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !BLOCK_STARTER.test(lines[i])) { buf.push(lines[i]); i++; }
    blocks.push(
      <p key={k} className="aimd-p">
        {buf.map((s, si) => <Fragment key={si}>{si > 0 && <br />}{inline(s, `p${k}-${si}-`)}</Fragment>)}
      </p>,
    );
    k++;
  }
  return <div className="aimd">{blocks}</div>;
}
