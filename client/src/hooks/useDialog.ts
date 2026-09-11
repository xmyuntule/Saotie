import { useLayoutEffect, useRef } from 'react';
import { activateDialog } from '../lib/dialog';

export function useDialog(open: boolean, onClose?: () => void) {
  const layerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useLayoutEffect(() => { closeRef.current = onClose; });
  useLayoutEffect(() => {
    if (!open || !layerRef.current || !panelRef.current) return;
    return activateDialog(layerRef.current, panelRef.current, () => closeRef.current?.());
  }, [open]);
  return { layerRef, panelRef };
}
