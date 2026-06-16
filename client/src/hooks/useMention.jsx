import { useState, useEffect, useRef } from 'react';
import Avatar from '../components/Avatar';
import Icon from '../components/Icon';
import api from '../api/client';

// Autocomplete for @mentions and #topics in a textarea/input.
// Usage: const m = useMention(value, setValue, inputRef);
//   onChange → m.scan(el.value, el.selectionStart)
//   onKeyDown → if (m.onKeyDown(e)) return;
//   render {m.dropdown} inside a position:relative wrapper.
export default function useMention(value, setValue, inputRef) {
  const [trigger, setTrigger] = useState(null); // '@' | '#' | null
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const tokenStart = useRef(0);

  const scan = (val, caret) => {
    const before = (val || '').slice(0, caret);
    const m = before.match(/([@#])([^\s@#]{0,20})$/);
    if (m) { tokenStart.current = caret - m[0].length; setTrigger(m[1]); setQ(m[2]); setIdx(0); }
    else { setTrigger(null); }
  };

  useEffect(() => {
    if (!trigger) { setItems([]); return; }
    let alive = true;
    const t = setTimeout(() => {
      const url = trigger === '@' ? '/users/mention' : '/topics';
      api.get(url, { params: { q } })
        .then(({ data }) => { if (alive) setItems(trigger === '@' ? data.users : data.topics); })
        .catch(() => {});
    }, 140);
    return () => { alive = false; clearTimeout(t); };
  }, [trigger, q]);

  const pick = (item) => {
    const el = inputRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const insert = trigger === '@' ? `@${item.nickname} ` : `#${item.name}# `;
    const next = value.slice(0, tokenStart.current) + insert + value.slice(caret);
    setValue(next);
    setTrigger(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = tokenStart.current + insert.length;
      try { el.setSelectionRange(pos, pos); } catch {}
    });
  };

  const onKeyDown = (e) => {
    if (!trigger || !items.length) return false;
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (i + 1) % items.length); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (i - 1 + items.length) % items.length); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(items[idx]); return true; }
    if (e.key === 'Escape') { e.preventDefault(); setTrigger(null); return true; }
    return false;
  };

  const dropdown = trigger && items.length > 0 ? (
    <div className="mention-pop" role="listbox">
      {items.map((it, i) => (
        <button key={it.id} type="button" className={`mention-item${i === idx ? ' active' : ''}`}
          onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); pick(it); }}>
          {trigger === '@' ? (
            <>
              <Avatar user={it} size={28} />
              <span className="mention-name">{it.nickname}</span>
              <span className="mention-handle">@{it.username}</span>
            </>
          ) : (
            <>
              <span className="mention-topic-ico"><Icon name="fire" size={15} /></span>
              <span className="mention-name">#{it.name}#</span>
              <span className="mention-handle">{(it.post_count ?? it.postCount ?? 0)} 条</span>
            </>
          )}
        </button>
      ))}
    </div>
  ) : null;

  return { scan, onKeyDown, dropdown, close: () => setTrigger(null) };
}
