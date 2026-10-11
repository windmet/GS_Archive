// Native background state. Unity Show/Hide internals remain a separate gate.
export function sampleSpotlightBackground(spotlights, pinspotlights, enabled) {
  if (!enabled) return null
  const active = [...spotlights.values(), ...pinspotlights.values()]
    .filter(state => state.alpha > 0.001 && state.environmentColor)
  const latest = active.sort((a, b) => Number(a.time) - Number(b.time)).at(-1)
  if (!latest) return null
  const opacity = Number(latest.environmentOpacity) / 1000
  if (!Number.isFinite(opacity) || !Number.isFinite(latest.alpha)) return null
  return { color: latest.environmentColor, alpha: Math.max(0, Math.min(1, opacity)) * latest.alpha }
}
