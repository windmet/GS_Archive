import { ref, onScopeDispose } from 'vue'

// This session owns only fullscreen/lock requests it initiated. It never changes
// story content, playback state, viewport geometry or another element's fullscreen.
export function createPlayerImmersiveMode({ document: doc, orientation, onChange = () => {} }) {
  const state = { active: false, pending: false, notice: '' }
  let root = null, ownsFullscreen = false, ownsLock = false, generation = 0, disposed = false
  const publish = patch => { Object.assign(state, patch); if (!disposed) onChange({ ...state }) }
  const unlock = () => { if (ownsLock) { ownsLock = false; try { orientation?.unlock?.() } catch {} } }
  async function exitOwned(element) {
    if (element && doc?.fullscreenElement === element) {
      try { await doc.exitFullscreen() } catch {}
    }
  }
  function changed() {
    if (ownsFullscreen && doc?.fullscreenElement !== root) {
      generation++; ownsFullscreen = false; unlock()
      publish({ active: false, notice: '' })
    }
  }
  doc?.addEventListener?.('fullscreenchange', changed)
  async function enter(element) {
    if (disposed || state.pending || !element) return false
    const run = ++generation
    root = element
    publish({ active: true, pending: true, notice: '' })
    try {
      if (doc?.fullscreenElement && doc.fullscreenElement !== element) {
        publish({ active: false, notice: 'fullscreen-unavailable' })
        return false
      }
      if (!doc?.fullscreenElement) {
        if (!element.requestFullscreen || doc?.fullscreenEnabled === false) {
          publish({ notice: 'fullscreen-unavailable' })
          return false
        }
        // Invoked synchronously from the click, before awaiting anything else.
        try { await element.requestFullscreen({ navigationUI: 'hide' }) }
        catch { if (run === generation) publish({ notice: 'fullscreen-denied' }); return false }
        if (run !== generation || disposed) { await exitOwned(element); return false }
        ownsFullscreen = doc.fullscreenElement === element
      }
      if (!ownsFullscreen) { publish({ notice: 'fullscreen-unavailable' }); return false }
      if (typeof orientation?.lock !== 'function') { publish({ notice: 'rotate' }); return true }
      try {
        await orientation.lock('landscape')
        ownsLock = true
        if (run !== generation || disposed) { unlock(); return false }
      } catch { if (run === generation) publish({ notice: 'rotate' }) }
      return true
    } finally { publish({ pending: false }) }
  }
  async function leave() {
    generation++
    const element = ownsFullscreen ? root : null
    ownsFullscreen = false; unlock()
    publish({ active: false, notice: '' })
    await exitOwned(element)
  }
  function dispose() { disposed = true; doc?.removeEventListener?.('fullscreenchange', changed); return leave() }
  return { state, enter, leave, dispose }
}

export function usePlayerImmersiveMode() {
  const active = ref(false), pending = ref(false), notice = ref('')
  const mode = createPlayerImmersiveMode({ document: globalThis.document, orientation: globalThis.screen?.orientation,
    onChange: state => { active.value = state.active; pending.value = state.pending; notice.value = state.notice } })
  onScopeDispose(() => { void mode.dispose() })
  return { active, pending, notice, enter: mode.enter, leave: mode.leave }
}

// A declined one-time offer must not reappear at every episode remount.
let offeredThisSession = false
export function claimMobileViewingOffer() {
  if (offeredThisSession) return false
  offeredThisSession = true
  return true
}
