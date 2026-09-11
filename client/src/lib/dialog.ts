interface DialogEntry {
  layer: HTMLElement;
  panel: HTMLElement;
  opener: HTMLElement | null;
  close: () => void;
}

const dialogs: DialogEntry[] = [];
const background = new Map<HTMLElement, boolean>();
let previousOverflow = '';
const focusableSelector = 'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]';

function focusable(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((el) => el.tabIndex >= 0 && !el.matches(':disabled') && !el.closest('[hidden], [inert], [aria-hidden="true"]') && el.getClientRects().length > 0);
}

function isolateTopDialog() {
  for (const [el, inert] of background) el.inert = inert;
  background.clear();
  const top = dialogs.at(-1);
  if (!top) return;
  for (const child of Array.from(document.body.children)) {
    if (!(child instanceof HTMLElement) || child === top.layer || child.contains(top.layer) || child.matches('.ht-toast-wrap')) continue;
    background.set(child, child.inert);
    child.inert = true;
  }
  dialogs.forEach(({ layer }, index) => { layer.style.zIndex = String(300 + index); });
}

/** Shared by the composer, nested confirmations and mobile navigation. */
export function activateDialog(layer: HTMLElement, panel: HTMLElement, close: () => void) {
  const entry: DialogEntry = { layer, panel, close, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null };
  const previousZIndex = layer.style.zIndex;
  if (!dialogs.length) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  dialogs.push(entry);
  isolateTopDialog();
  const first = focusable(panel).find((el) => el.hasAttribute('autofocus'));
  (first || panel).focus({ preventScroll: true });

  const onKey = (event: KeyboardEvent) => {
    if (dialogs.at(-1) !== entry || event.defaultPrevented || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      entry.close();
    } else if (event.key === 'Tab') {
      const items = focusable(panel);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length || index < 0 || (!event.shiftKey && index === items.length - 1) || (event.shiftKey && index === 0)) {
        event.preventDefault();
        (event.shiftKey ? items.at(-1) || panel : items[0] || panel).focus();
      }
    }
  };
  const onFocus = (event: FocusEvent) => {
    if (dialogs.at(-1) === entry && !panel.contains(event.target as Node)) panel.focus({ preventScroll: true });
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('focusin', onFocus);
  return () => {
    const wasTop = dialogs.at(-1) === entry;
    dialogs.splice(dialogs.indexOf(entry), 1);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('focusin', onFocus);
    isolateTopDialog();
    layer.style.zIndex = previousZIndex;
    if (!dialogs.length) document.body.style.overflow = previousOverflow;
    if (wasTop) {
      const target = entry.opener?.isConnected && !entry.opener.closest('[inert]') ? entry.opener : dialogs.at(-1)?.panel;
      target?.focus({ preventScroll: true });
    }
  };
}
