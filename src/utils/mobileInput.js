export function releaseMobileInputFocus() {
  if (typeof document === 'undefined') return false;
  const activeElement = document.activeElement;
  if (!activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')) return false;
  if (typeof activeElement.blur !== 'function') return false;
  activeElement.blur();
  return true;
}
