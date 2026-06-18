import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import Modal from '../components/Modal';
import Composer from '../components/Composer';
import { useAuth } from './AuthContext';

export interface ComposeValue {
  openCompose: () => void;
}

const ComposeContext = createContext<ComposeValue | null>(null);

export function ComposeProvider({ children }: { children?: ReactNode }) {
  const { user, setAuthOpen } = useAuth();
  const [open, setOpen] = useState(false);

  const openCompose = useCallback(() => {
    if (!user) { setAuthOpen(true); return; }
    setOpen(true);
  }, [user, setAuthOpen]);

  // 防误触：有未发布内容时关闭发帖框先二次确认（草稿已自动保存，可恢复）
  const requestClose = useCallback(() => {
    let draft = '';
    try { draft = localStorage.getItem('haha_draft') || ''; } catch { /* ignore */ }
    if (draft.trim() && !window.confirm('还有未发布的内容，确定关闭吗？\n（草稿已自动保存，下次打开可恢复）')) return;
    setOpen(false);
  }, []);

  return (
    <ComposeContext.Provider value={{ openCompose }}>
      {children}
      <Modal open={open} onClose={requestClose} large>
        <div className="modal-head"><div className="modal-title">发布动态</div></div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <Composer embedded onPosted={() => setOpen(false)} />
        </div>
      </Modal>
    </ComposeContext.Provider>
  );
}

export const useCompose = (): ComposeValue => useContext(ComposeContext) || { openCompose: () => {} };
