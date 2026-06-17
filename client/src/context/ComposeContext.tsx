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

  return (
    <ComposeContext.Provider value={{ openCompose }}>
      {children}
      <Modal open={open} onClose={() => setOpen(false)} large>
        <div className="modal-head"><div className="modal-title">发布动态</div></div>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <Composer embedded onPosted={() => setOpen(false)} />
        </div>
      </Modal>
    </ComposeContext.Provider>
  );
}

export const useCompose = (): ComposeValue => useContext(ComposeContext) || { openCompose: () => {} };
