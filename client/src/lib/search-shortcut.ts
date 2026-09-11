export function isSearchShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="alertdialog"]')) return false;
  return (event.key === '/' && !event.ctrlKey && !event.metaKey)
    || (event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey));
}
