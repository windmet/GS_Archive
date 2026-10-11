export function trapDialogKey(event, panel, close) {
  if (event.key === 'Escape') { event.preventDefault(); close(); return }
  if (event.key !== 'Tab' || !panel) return
  const items = Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')).filter(el => el.getClientRects().length)
  if (!items.length) { event.preventDefault(); return }
  const active = panel.ownerDocument.activeElement
  const index = items.indexOf(active)
  if (index < 0 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
    event.preventDefault(); items[event.shiftKey ? items.length - 1 : 0].focus()
  }
}
