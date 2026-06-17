import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
  large?: boolean;
  bare?: boolean;
}

export default function Modal({ open, onClose, children, large = false, bare = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  // portal to body so position:fixed isn't trapped by an ancestor's transform/animation containing block
  return createPortal(
    <div className="modal-mask" onMouseDown={onClose}>
      <div className={`modal${large ? ' modal-lg' : ''}`} style={{ position: 'relative' }}
        onMouseDown={(e) => e.stopPropagation()}>
        {!bare && (
          <button className="modal-close" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
