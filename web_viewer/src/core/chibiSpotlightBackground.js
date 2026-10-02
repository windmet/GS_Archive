// Native background without active Pinspotlight masks. Masked rendering and
// Unity Show/Hide internals remain separate acceptance requirements.
export function sampleSpotlightBackground(spotlights, pinspotlights, enabled) {
  if (!enabled) return null
  // Pinspotlight owns a mask-driven background. Do not stack an unmasked wash
  // over its existing renderer until that path is reconstructed.
  if ([...pinspotlights.values()].some(state => state.alpha > 0.001 && state.asset)) return null
  const active = [...spotlights.values()].filter(state => state.alpha > 0.001 && state.environmentColor)
  const latest = active.sort((a, b) => Number(a.time) - Number(b.time)).at(-1)
  if (!latest) return null
  const opacity = Number(latest.environmentOpacity) / 1000
  if (!Number.isFinite(opacity) || !Number.isFinite(latest.alpha)) return null
  return { color: latest.environmentColor, alpha: Math.max(0, Math.min(1, opacity)) * latest.alpha }
}
