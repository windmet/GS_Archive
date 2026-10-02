const clamp = value => Math.max(0, Math.min(1, value))

function alphaAt(state, time) {
  if (!state.show) return 0
  const show = state.show
  const elapsed = time - show.time - show.delay
  let alpha = elapsed < 0 ? 0 : show.fadeIn && elapsed < show.fadeIn ? elapsed / show.fadeIn : 1
  const outStart = show.fadeIn + show.hold
  if (elapsed >= outStart) alpha = show.fadeOut ? clamp(1 - (elapsed - outStart) / show.fadeOut) : 0
  if (state.hide) alpha = state.hide.alpha * (state.hide.duration ? clamp(1 - (time - state.hide.time) / state.hide.duration) : 0)
  return clamp(alpha) * clamp(state.opacity / 1000)
}

// Rebuild identities from the source timeline, so seek/switch never rely on play history.
export function imageObjectsAt(events = [], time = 0) {
  const states = new Map()
  for (const event of events) {
    if (event.time > time) break
    if (event.type === 'create') states.set(event.id, { ...event })
    else {
      const state = states.get(event.id)
      if (!state || (event.asset && event.asset !== state.asset)) continue
      if (event.type === 'show') { state.show = event; state.hide = null }
      if (event.type === 'hide') {
        // Hide snapshot is phase alpha; source opacity is applied once below.
        const opacity = state.opacity
        state.opacity = 1000
        const alpha = alphaAt(state, event.time)
        state.opacity = opacity
        state.hide = { ...event, alpha }
      }
    }
  }
  return new Map([...states].map(([id, state]) => [id, { ...state, alpha: alphaAt(state, time) }]))
}

export function imageObjectLayout(state, width, height, environmentScale = 1) {
  const fit = Math.min(width / 1280, height / 720) * environmentScale
  return { x: width / 2 + state.x * fit, y: height / 2 + (360 - state.y) * fit,
    scaleX: state.scaleX / 1000 * fit, scaleY: state.scaleY / 1000 * fit,
    rotation: state.rotation * Math.PI / 180 }
}
