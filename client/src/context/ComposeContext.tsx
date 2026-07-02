import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import Modal from '../components/Modal';
import Composer from '../components/Composer';
import { hasDraft } from '../lib/draft';
import { confirmDialog } from '../components/confirm';
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

  // 防误触：有未发布内容（文本/图片/投票）时关闭发帖框先二次确认（草稿已自动保存，可恢复）
  const requestClose = useCallback(async () => {
    if (hasDraft() && !(await confirmDialog('草稿已自动保存，下次打开可恢复', { title: '关闭发布框？', confirmText: '关闭', danger: false }))) return;
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
