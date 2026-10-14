// The shared native renderer is driven by command order, not lamp alpha.
export function spotlightCommands(song) {
  if (song?.spotlightCommandOrder) return song.spotlightCommandOrder.map(({ family, index }) =>
    ({ family, event: song[family + 'Events'][index] }))
  // Compatibility for old indexes and small synthetic fixtures. Published
  // indexes preserve RAW row order, including ties across the two families.
  return ['spotlight', 'pinspotlight'].flatMap(family =>
    (song?.[family + 'Events'] || []).map(event => ({ family, event })))
    .sort((a, b) => a.event.time - b.event.time)
}

const sample = (track, time) => {
  const t = track.duration <= 0 ? 1 : Math.max(0, Math.min(1, (time - track.start) / track.duration))
  return track.from + (track.to - track.from) * (1 - (1 - t) ** 2)
}

export function spotlightBackgroundAt(song, time = 0, enabled = true) {
  if (!enabled) return null
  let color = '#000000', targetAlpha = 0.8
  let track = { from: 0, to: 0, start: 0, duration: 0 }
  const visible = new Set()
  for (const { family, event } of spotlightCommands(song)) {
    if (event.time > time) break
    const alpha = sample(track, event.time)
    const key = `${family}:${event.id}`
    if (event.hide) visible.delete(key)
    else {
      // SetColor changes RGB and targetAlpha while preserving current alpha.
      // Invalid Unity HTML colors leave both properties unchanged.
      if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(event.environmentColor || '')
          && Number.isFinite(event.environmentOpacity)) {
        color = event.environmentColor.slice(0, 7)
        targetAlpha = event.environmentOpacity / 1000
      }
      visible.add(key)
    }
    // UpdateIfNeeded runs after the caller updates its visible flag. Count 1
    // calls Show even when caused by Hide; count >1 leaves the tween alone.
    if (visible.size <= 1) {
      const duration = event.hide || family === 'pinspotlight'
        ? Math.max(0, event.duration || 0) : 500
      track = { from: alpha, to: visible.size ? targetAlpha : 0, start: event.time, duration }
    }
  }
  const alpha = sample(track, time)
  return alpha > 0 ? { color, alpha, showingCount: visible.size } : null
}
