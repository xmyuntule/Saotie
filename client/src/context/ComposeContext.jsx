import { createContext, useContext, useState, useCallback } from 'react';
import Modal from '../components/Modal';
import Composer from '../components/Composer';
import { useAuth } from './AuthContext';

const ComposeContext = createContext(null);

export function ComposeProvider({ children }) {
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

export const useCompose = () => useContext(ComposeContext) || { openCompose: () => {} };
