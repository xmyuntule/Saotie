import { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../api/client';

interface BoardOption { id: number; name: string; depth: number; }

// Flatten boards (parents + children) into selectable options
function flatten(boards: any[]): BoardOption[] {
  const out: BoardOption[] = [];
  for (const b of boards) {
    out.push({ id: b.id, name: b.name, depth: 0 });
    for (const c of b.children || []) out.push({ id: c.id, name: c.name, depth: 1 });
  }
  return out;
}

interface NewThreadModalProps {
  open: boolean;
  onClose?: () => void;
  boards?: any[];
  defaultBoardId?: string | number;
  onCreated?: (thread: any) => void;
}

export default function NewThreadModal({ open, onClose, boards, defaultBoardId, onCreated }: NewThreadModalProps) {
  const { user, setAuthOpen } = useAuth();
  const toast = useToast();
  const [boardId, setBoardId] = useState<string | number>(defaultBoardId || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (defaultBoardId) setBoardId(defaultBoardId); }, [defaultBoardId]);
  const options = flatten(boards || []);
  useEffect(() => { if (!boardId && options.length) setBoardId(options[0].id); /* eslint-disable-next-line */ }, [boards]);

  if (!user && open) { setAuthOpen(true); onClose?.(); return null; }

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files as FileList)];
    if (!files.length) return;
    const fd = new FormData();
    files.slice(0, 9 - media.length).forEach((f) => fd.append('files', f));
    try { const { data } = await api.post('/upload', fd); setMedia((m) => [...m, ...data.files].slice(0, 9)); }
    catch (err: any) { toast.err(err.message); }
    e.target.value = '';
  };

  const submit = async () => {
    if (!title.trim() || !content.trim()) return toast.err('标题和内容不能为空');
    setBusy(true);
    try {
      const { data } = await api.post('/forum/threads', { boardId: Number(boardId), title, content, media });
      toast.ok('发帖成功');
      setTitle(''); setContent(''); setMedia([]);
      onCreated?.(data.thread);
      onClose?.();
    } catch (e: any) { toast.err(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} large>
      <div className="modal-head"><div className="modal-title">发布新帖</div><div className="modal-sub">分享你的想法，开启一场讨论</div></div>
      <div className="modal-body">
        <div className="field">
          <label>选择板块</label>
          <select value={boardId} onChange={(e) => setBoardId(e.target.value)}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.depth ? '　└ ' : ''}{o.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>标题</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一个好标题是成功的一半" maxLength={60} />
        </div>
        <div className="field">
          <label>正文</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="详细说说吧…支持 @提及 和 #话题#" style={{ minHeight: 130 }} />
        </div>
        {media.length > 0 && (
          <div className="composer-preview" style={{ marginBottom: 12 }}>
            {media.map((m, i) => (
              <div className="pv" key={i}>
                <img src={m.url} alt="" />
                <button className="rm" onClick={() => setMedia((a) => a.filter((_, j) => j !== i))} aria-label="移除"><Icon name="close" size={13} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row gap-8" style={{ marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Icon name="image" size={16} /> 添加图片</button>
          <span className="faint" style={{ fontSize: 12 }}>最多 9 张</span>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={submit}>{busy ? '发布中…' : '发布'}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={upload} />
    </Modal>
  );
}
