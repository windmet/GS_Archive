import { onScopeDispose, unref, watch } from 'vue'
import { gestureIntent, isBottomSheet, releaseVelocity, shouldCloseSheet, sheetOffset, takesOver, SHEET_VELOCITY_WINDOW } from '../presentation/sheetDrag.mjs'

// Swipe a phone bottom sheet down to close it. One implementation for every bottom sheet (filter, arrangement, quality,
// reader, seasonal drawer, line directory); a component passes its element, the header it can be grabbed by, and its own close
// function, so focus return, URL state and keep-content-while-leaving all stay on the component's existing path.
//
//  - While dragging the sheet sits exactly under the finger (inline transform, no transition). Upward it meets resistance.
//  - Letting go closes it when it is moving down fast enough or was pulled far enough, continuing from where it is; otherwise it
//    springs back with the enter timing. A new touch during either animation catches the sheet where it is.
//  - Reduced motion: the drag still follows the finger; the spring-back and the close do not travel.
//  - Only a sheet in its bottom form takes part (see isBottomSheet); a centred dialog or a side drawer is left alone.
//  - touchmove is non-passive: once a downward drag from content at its top is taken over, the browser must not scroll or cancel it.
const REDUCED = '(prefers-reduced-motion: reduce)'
const ENTER_MOTION = 'transform var(--gs-motion-enter) var(--gs-ease-out)'
const SHEET_MOTION = 'transform var(--gs-motion-sheet) var(--gs-ease-out)'

function scrollTopWithin(node, sheet) {
  let top = 0
  for (let cursor = node; cursor && cursor !== sheet && cursor.nodeType === 1; cursor = cursor.parentElement) {
    if (cursor.scrollHeight > cursor.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(cursor).overflowY)) top = Math.max(top, cursor.scrollTop)
  }
  if (sheet.scrollHeight > sheet.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(sheet).overflowY)) top = Math.max(top, sheet.scrollTop)
  return top
}
function currentOffset(node) {
  const transform = getComputedStyle(node).transform
  return transform && transform !== 'none' ? new DOMMatrixReadOnly(transform).m42 : 0
}

// target: ref or element. options.handle: selector inside the sheet that always grabs it. options.onClose: the component's close.
// options.enabled(): extra switch (default on). options.isShowing(el): false once the sheet is closed (default: a dialog's open flag).
export function useSheetDrag(target, { handle = '', onClose, enabled = () => true, isShowing = node => node.isConnected && node.open !== false } = {}) {
  let el = null, gesture = null, settle = null
  const reduced = () => globalThis.matchMedia?.(REDUCED).matches === true

  function cancelSettle() {
    if (!settle) return
    clearTimeout(settle.timer); settle.node.removeEventListener('transitionend', settle.end); settle = null
  }
  function clear() {
    cancelSettle()
    if (el) { el.style.transform = ''; el.style.transition = ''; el.style.willChange = '' }
  }
  // Runs the sheet from wherever it is now to `to`; `then` fires when the transform transition ends (or a fallback timer, in case
  // the browser skips the event). Reduced motion: no travel, `then` right away.
  function animate(to, transition, then) {
    if (!el) return
    if (reduced()) { clear(); then?.(); return }
    const node = el
    cancelSettle()
    node.style.willChange = 'transform'
    node.style.transition = transition
    node.style.transform = to
    const done = () => { if (settle?.node === node) { cancelSettle(); then?.() } }
    const end = event => { if (event.target === node && event.propertyName === 'transform') done() }
    settle = { node, end, timer: setTimeout(done, 320) }
    node.addEventListener('transitionend', end)
  }
  function springBack() { animate('translateY(0px)', ENTER_MOTION, clear) }
  function finishClose() {
    const node = el
    onClose?.()
    // The component decides whether it really closes. Once it has, the inline styles go so the next opening starts from a clean
    // sheet; if it has not after a moment, the sheet comes back instead of staying parked below the screen.
    const started = performance.now()
    const watchClosing = () => {
      if (el !== node) return
      if (!isShowing(node)) { clear(); return }
      if (performance.now() - started > 600) { springBack(); return }
      requestAnimationFrame(watchClosing)
    }
    requestAnimationFrame(watchClosing)
  }
  function close() {
    if (reduced()) { clear(); finishClose(); return }
    animate('translateY(100%)', SHEET_MOTION, finishClose)
  }

  function touchstart(event) {
    if (!el || event.touches.length !== 1 || !enabled()) return
    const touch = event.touches[0]
    const caught = settle !== null
    const rect = el.getBoundingClientRect()
    // Outside the sheet is the backdrop; a sheet that is not in its bottom form is not ours (a caught sheet is mid-travel, so its box moved).
    if (!caught && (!isBottomSheet(rect, { width: innerWidth, height: innerHeight }) || touch.clientY < rect.top || touch.clientY > rect.bottom)) return
    let start = 0
    if (caught) { start = currentOffset(el); clear(); el.style.transition = 'none'; el.style.transform = `translateY(${start}px)` }
    gesture = { x: touch.clientX, y: touch.clientY, start, caught, fromHandle: Boolean(handle && event.target.closest?.(handle)) || caught, scrollTop: scrollTopWithin(event.target, el), took: false, samples: [{ t: performance.now(), y: touch.clientY }], height: rect.height }
  }
  function touchmove(event) {
    if (!gesture) return
    const touch = event.touches[0]
    const dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y
    if (!gesture.took) {
      const intent = gestureIntent(dx, dy)
      if (intent === 'pending') return
      if (intent === 'horizontal' || !takesOver({ fromHandle: gesture.fromHandle, scrollTop: gesture.scrollTop, dy })) { release(false); return }
      gesture.took = true
      el.style.willChange = 'transform'
      el.style.transition = 'none'
    }
    if (event.cancelable) event.preventDefault()
    const now = performance.now()
    gesture.samples = [...gesture.samples.filter(sample => now - sample.t <= SHEET_VELOCITY_WINDOW * 2), { t: now, y: touch.clientY }]
    gesture.offset = sheetOffset(gesture.start + dy)
    el.style.transform = `translateY(${gesture.offset}px)`
  }
  // landed: true when the finger lifted normally, false when the gesture is abandoned (turned into a scroll, or cancelled).
  function release(landed, event) {
    const current = gesture
    gesture = null
    if (!current) return
    if (!current.took) { if (current.caught) springBack(); return }
    if (event?.cancelable) event.preventDefault()
    const velocity = landed ? releaseVelocity(current.samples, performance.now()) : 0
    if (landed && shouldCloseSheet({ offset: current.offset, velocity, height: current.height })) close()
    else springBack()
  }
  const touchend = event => release(true, event)
  const touchcancel = () => release(false)

  function attach(node) {
    el = node
    node.addEventListener('touchstart', touchstart, { passive: true })
    node.addEventListener('touchmove', touchmove, { passive: false })
    node.addEventListener('touchend', touchend)
    node.addEventListener('touchcancel', touchcancel)
  }
  function detach() {
    if (!el) return
    el.removeEventListener('touchstart', touchstart)
    el.removeEventListener('touchmove', touchmove)
    el.removeEventListener('touchend', touchend)
    el.removeEventListener('touchcancel', touchcancel)
    clear(); gesture = null; el = null
  }
  const stop = watch(() => unref(target), node => { detach(); if (node) attach(node) }, { flush: 'post', immediate: true })
  onScopeDispose(() => { stop(); detach() })
  return { cancel: () => { gesture = null; clear() } }
}
