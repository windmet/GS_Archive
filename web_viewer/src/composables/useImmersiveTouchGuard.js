import { onScopeDispose } from 'vue'

// While a full-window view owns the screen, touches must stay inside it. touch-action: none covers Chrome, but
// iOS Safari still pinch-zooms (its own gesture events), starts a text selection and its magnifier under several
// fingers or a long press, double-tap zooms, and rubber-bands the page behind a fixed layer. The guard closes each
// of those, locks the page scroll, and keeps the screen awake so a recorded or watched run is not cut by sleep.
const CONTROL = 'input, select, textarea'
const DOUBLE_TAP_MS = 300

export function createImmersiveTouchGuard({ document: doc = globalThis.document, window: win = globalThis.window, navigator: nav = globalThis.navigator } = {}) {
  let root = null, lastTouchEnd = 0, wakeLock = null, wakeRequest = null, scroll = null
  const inControl = event => Boolean(event.target?.closest?.(CONTROL))
  const prevent = event => { if (event.cancelable !== false) event.preventDefault() }
  const handlers = {
    // WebKit's pinch: touch-action does not stop it.
    gesturestart: prevent, gesturechange: prevent, gestureend: prevent,
    // A second finger starts selection, zoom or the magnifier; a slider keeps its single-finger drag.
    touchstart: event => { if (event.touches.length > 1) prevent(event) },
    touchmove: event => { if (event.touches.length > 1 || !inControl(event)) prevent(event) },
    touchend: event => {
      const now = event.timeStamp
      if (now - lastTouchEnd < DOUBLE_TAP_MS && !event.target?.closest?.(`button, a, ${CONTROL}`)) prevent(event)
      lastTouchEnd = now
    },
    contextmenu: prevent,
    selectstart: event => { if (!inControl(event)) prevent(event) },
    dblclick: prevent,
  }
  async function requestWakeLock() {
    if (!root || wakeLock || wakeRequest || !nav?.wakeLock?.request || doc.visibilityState === 'hidden') return
    // Refused when the page is hidden, by policy or on low battery; the view works without it.
    wakeRequest = nav.wakeLock.request('screen').then(lock => {
      if (!root) { void lock.release().catch(() => {}); return }
      wakeLock = lock
      lock.addEventListener?.('release', () => { if (wakeLock === lock) wakeLock = null })
    }, () => {}).finally(() => { wakeRequest = null })
    await wakeRequest
  }
  // The browser drops the lock whenever the page is hidden; take it again on return.
  const visibility = () => { if (doc.visibilityState === 'visible') void requestWakeLock() }

  function attach(element) {
    if (!element || root === element) return
    detach()
    root = element
    for (const [type, handler] of Object.entries(handlers)) root.addEventListener(type, handler, { passive: false })
    doc.addEventListener('visibilitychange', visibility)
    // Fix the body where it is, so nothing behind the view can scroll or bounce, and put it back on exit.
    const body = doc.body, html = doc.documentElement
    scroll = { y: win.scrollY, body: body.getAttribute('style'), html: html.getAttribute('style') }
    html.style.overflow = 'hidden'
    Object.assign(body.style, { position: 'fixed', top: `${-scroll.y}px`, left: '0', right: '0', overflow: 'hidden' })
    void requestWakeLock()
  }
  function detach() {
    if (!root) return
    for (const [type, handler] of Object.entries(handlers)) root.removeEventListener(type, handler, { passive: false })
    doc.removeEventListener('visibilitychange', visibility)
    root = null
    const restore = (element, style) => style === null ? element.removeAttribute('style') : element.setAttribute('style', style)
    restore(doc.body, scroll.body)
    restore(doc.documentElement, scroll.html)
    win.scrollTo(0, scroll.y)
    scroll = null
    if (wakeLock) { const lock = wakeLock; wakeLock = null; void lock.release().catch(() => {}) }
  }
  return { attach, detach, get attached() { return Boolean(root) }, get wakeLocked() { return Boolean(wakeLock) } }
}

export function useImmersiveTouchGuard() {
  const guard = createImmersiveTouchGuard()
  onScopeDispose(guard.detach)
  return guard
}
