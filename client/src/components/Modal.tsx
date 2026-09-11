import { useId, useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { useDialog } from '../hooks/useDialog';

export interface ModalProps {
  open: boolean;
  onClose?: () => void;
  children?: ReactNode;
  large?: boolean;
  bare?: boolean;
  label?: string;
}

export default function Modal({ open, onClose, children, large = false, bare = false, label = '对话框' }: ModalProps) {
  const titleId = useId();
  const { layerRef, panelRef } = useDialog(open, onClose);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const title = panel?.querySelector<HTMLElement>('.modal-title, h1, h2');
    if (panel && title) {
      title.id ||= titleId;
      panel.setAttribute('aria-labelledby', title.id);
    }
  }, [open, children, titleId]);

  if (!open) return null;
  // portal to body so position:fixed isn't trapped by an ancestor's transform/animation containing block
  return createPortal(
    <div ref={layerRef} className="modal-mask" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <section ref={panelRef} className={`modal${large ? ' modal-lg' : ''}`} style={{ position: 'relative' }}
        role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        {!bare && (
          <button className="modal-close" onClick={onClose} aria-label="关闭"><Icon name="close" size={18} /></button>
        )}
        {children}
      </section>
    </div>,
    document.body,
  );
}
