// Native texture/pivot/blend and RAW instance identities. Normal-show timing
// and coordinates remain a recording-guided preview, not native tween parity.
const clamp = x => Math.max(0, Math.min(1, x))
const number = (values, i, fallback = 0) => values[i] === '' || values[i] == null ? fallback : Number(values[i])

export function newSuspensionlightsAt(events = [], time = 0) {
  const instances = new Map()
  for (const event of events) {
    if (event.time > time) break
    const v = event.values
    if (event.erase) { instances.delete(event.id); continue }
    if (event.command === 'NewSuspensionlight_create') {
      // Create is a new generation: do not inherit an earlier show/tween for
      // the reused ID. Incomplete asset-less create rows never create a beam.
      instances.set(event.id, { id: event.id, asset: v[1], time: event.time,
        opacity: number(v, 2) / 1000, scaleX: number(v, 3) / 1000,
        scaleY: number(v, 4) / 1000, angle: number(v, 5), x: number(v, 6),
        y: number(v, 7), color: v[8], depth: number(v, 9, 1650), show: null })
    } else {
      const state = instances.get(event.id)
      if (!state) continue
      if (event.command === 'NewSuspensionlight_normal_show') {
        state.show = { time: event.time, delay: number(v, 1), rise: number(v, 2),
          hold: number(v, 3), fall: number(v, 4), repeats: number(v, 5) }
        // This does not restore a cancelled, unresolved motion/color command.
      } else {
        // Retain unknown RAW commands in the index; suppress the object rather
        // than falsely leaving a static beam after rotate/fade/color controls.
        state.unresolved = event.command
      }
    }
  }
  return [...instances.values()].map(state => {
    const show = state.show
    let alpha = 0
    if (show && !state.unresolved) {
      const elapsed = time - show.time - show.delay
      const period = show.rise + show.hold + show.fall
      if (elapsed >= 0 && period > 0 && Math.floor(elapsed / period) <= show.repeats) {
        const phase = elapsed % period
        alpha = phase < show.rise ? clamp(phase / Math.max(1, show.rise))
          : phase < show.rise + show.hold ? 1
            : 1 - clamp((phase - show.rise - show.hold) / Math.max(1, show.fall))
      }
    }
    return { ...state, alpha: alpha * clamp(state.opacity) }
  })
}

export function suspensionlightLayout(state, width, height, environmentScale = 1) {
  const fit = Math.min(width / 1280, height / 720) * environmentScale
  return { x: width / 2 + state.x * fit, y: height / 2 + (250 - state.y) * fit,
    scaleX: state.scaleX * fit, scaleY: state.scaleY * fit,
    rotation: -state.angle * Math.PI / 180 }
}
