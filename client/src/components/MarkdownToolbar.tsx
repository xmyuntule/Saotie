import type { RefObject } from 'react';
import Icon from './Icon';

// 可复用 Markdown 格式化工具条：作用于外部传入的 <textarea>（taRef）+ 受控 value/onChange。
// 与动态发布器 Composer 的格式逻辑一致：加粗/删除线/行内代码/标题/列表/引用/链接（+可选插图）。
// 渲染端由 RichBody(parseBlocks) 负责，故这里插入的是标准 Markdown 标记。
interface Props {
  taRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (v: string) => void;
  onImage?: () => void;
}

export default function MarkdownToolbar({ taRef, value, onChange, onImage }: Props) {
  const wrap = (mark: string, end: string = mark) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || '文字';
    onChange(value.slice(0, s) + mark + sel + end + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + mark.length;
      ta.selectionEnd = s + mark.length + sel.length;
    });
  };

  const prefixLine = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const lineStart = value.lastIndexOf('\n', s - 1) + 1;
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = s + prefix.length;
    });
  };

  const insertLink = () => {
    const ta = taRef.current;
    if (!ta) return;
    const s = ta.selectionStart ?? value.length;
    const e = ta.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || '链接文字';
    const snippet = `[${sel}](https://)`;
    onChange(value.slice(0, s) + snippet + value.slice(e));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = s + sel.length + 3; // 落在 "](" 之后
      ta.selectionEnd = s + snippet.length - 1; // 落在 ")" 之前
    });
  };

  return (
    <div className="composer-format" role="toolbar" aria-label="Markdown 格式">
      <button type="button" title="加粗" aria-label="加粗" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('**')}><b>B</b></button>
      <button type="button" title="删除线" aria-label="删除线" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('~~')}><s>S</s></button>
      <button type="button" title="行内代码" aria-label="行内代码" onMouseDown={(e) => e.preventDefault()} onClick={() => wrap('`')}><span style={{ fontFamily: 'var(--font-num,monospace)', fontSize: 12.5 }}>&lt;/&gt;</span></button>
      <span className="composer-format-sep" />
      <button type="button" title="标题" aria-label="标题" onMouseDown={(e) => e.preventDefault()} onClick={() => prefixLine('## ')}><b style={{ fontSize: 13 }}>H</b></button>
      <button type="button" title="列表" aria-label="列表" onMouseDown={(e) => e.preventDefault()} onClick={() => prefixLine('- ')}><Icon name="list" size={16} /></button>
      <button type="button" title="引用" aria-label="引用" onMouseDown={(e) => e.preventDefault()} onClick={() => prefixLine('> ')}><Icon name="quote" size={16} /></button>
      <button type="button" title="链接" aria-label="链接" onMouseDown={(e) => e.preventDefault()} onClick={insertLink}><Icon name="link" size={16} /></button>
      {onImage && <button type="button" title="插入图片" aria-label="插入图片" onMouseDown={(e) => e.preventDefault()} onClick={onImage}><Icon name="image" size={16} /></button>}
    </div>
  );
}
