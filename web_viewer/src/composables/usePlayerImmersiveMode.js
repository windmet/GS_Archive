import { ref, onScopeDispose } from 'vue'

// Native promises cannot be cancelled. Reserve the document until an old
// request settles, so its cleanup cannot exit or unlock a newer session.
const leases = new WeakMap()
export function createPlayerImmersiveMode({ document: doc, orientation, viewport = globalThis.window, onChange = () => {} }) {
  const state = { active: false, pending: false, notice: '' }
  const token = {}
  let root = null, ownsLock = false, generation = 0, disposed = false
  const publish = patch => { Object.assign(state, patch); if (!disposed) onChange({ ...state }) }
  const owns = () => doc && leases.get(doc) === token
  const unlock = () => { if (ownsLock && owns()) { ownsLock = false; try { orientation?.unlock?.() } catch {} } }
  async function exitOwned() {
    if (owns() && root && doc.fullscreenElement === root) {
      try { await doc.exitFullscreen() } catch {}
    }
  }
  function resized() {
    if (state.notice === 'rotate' && viewport?.innerWidth > viewport?.innerHeight) publish({ notice: '' })
  }
  function changed() {
    const active = Boolean(owns() && root && doc.fullscreenElement === root)
    if (!active && state.active) { generation++; unlock() }
    publish({ active, ...(!active ? { notice: '' } : {}) })
  }
  doc?.addEventListener?.('fullscreenchange', changed)
  viewport?.addEventListener?.('resize', resized)
  orientation?.addEventListener?.('change', resized)
  async function enter(element) {
    if (disposed || state.pending || !element) return false
    if (!doc || (leases.has(doc) && !owns()) || (doc.fullscreenElement && doc.fullscreenElement !== element)) {
      publish({ active: false, notice: 'fullscreen-unavailable' }); return false
    }
    const run = ++generation
    root = element
    leases.set(doc, token)
    publish({ active: doc.fullscreenElement === root, pending: true, notice: '' })
    try {
      if (!doc.fullscreenElement) {
        if (!element.requestFullscreen || doc.fullscreenEnabled === false) {
          publish({ active: false, notice: 'fullscreen-unavailable' }); return false
        }
        // Preserve transient activation: invoke before the first await.
        try { await element.requestFullscreen({ navigationUI: 'hide' }) }
        catch { if (run === generation && !disposed) publish({ active: false, notice: 'fullscreen-denied' }); return false }
      }
      if (run !== generation || disposed) { await exitOwned(); return false }
      changed()
      if (!state.active) { publish({ notice: 'fullscreen-unavailable' }); return false }
      if (typeof orientation?.lock !== 'function') {
        publish({ notice: 'rotate' }); resized(); return true
      }
      try {
        await orientation.lock('landscape')
        ownsLock = true
        if (run !== generation || disposed) { unlock(); await exitOwned(); return false }
      } catch { if (run === generation && !disposed) { publish({ notice: 'rotate' }); resized() } }
      return true
    } finally {
      publish({ pending: false })
      if (owns() && doc.fullscreenElement !== root && !ownsLock) leases.delete(doc)
    }
  }
  async function leave() {
    generation++
    unlock()
    publish({ active: false, notice: '' })
    await exitOwned()
    if (owns() && !state.pending) leases.delete(doc)
  }
  function dispose() {
    disposed = true
    doc?.removeEventListener?.('fullscreenchange', changed)
    viewport?.removeEventListener?.('resize', resized)
    orientation?.removeEventListener?.('change', resized)
    return leave()
  }
  return { state, enter, leave, dispose, dismiss: () => publish({ notice: '' }) }
}

export function usePlayerImmersiveMode() {
  const active = ref(false), pending = ref(false), notice = ref('')
  const mode = createPlayerImmersiveMode({ document: globalThis.document, orientation: globalThis.screen?.orientation,
    onChange: state => { active.value = state.active; pending.value = state.pending; notice.value = state.notice } })
  onScopeDispose(() => { void mode.dispose() })
  return { active, pending, notice, enter: mode.enter, leave: mode.leave, dismiss: mode.dismiss }
}

export function createMobileViewingOffer() {
  let offered = false
  return () => { if (offered) return false; offered = true; return true }
}
// Compatibility export; the player shell creates one offer per watching session.
export const claimMobileViewingOffer = createMobileViewingOffer()
