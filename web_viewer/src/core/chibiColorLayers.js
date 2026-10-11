const clamp = value => Math.max(0, Math.min(1, value))
const rgb = (value, fallback) => /^#[\da-f]{6}$/i.test(value || '') ? parseInt(value.slice(1), 16) : fallback
const mix = (a, b, t) => [16, 8, 0].reduce((result, shift) => result |
  (Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t) << shift), 0)

function sample(track, time) {
  const t = track.duration <= 0 ? 1 : clamp((time - track.start) / track.duration)
  return { color: mix(track.from.color, track.to.color, t),
    alpha: track.from.alpha + (track.to.alpha - track.from.alpha) * t,
    depth: track.to.depth, eventTime: track.start }
}

// Reconstruct by timeline on every seek; tracks are addressed by ID, not depth.
export function colorLayersAt(events = [], time = 0) {
  const tracks = new Map()
  for (const event of events) {
    if (event.time > time) break
    if (!Number.isInteger(event.id) || event.id <= 0) continue
    const previous = tracks.get(event.id)
    const from = previous ? sample(previous, event.time) : { color: 0, alpha: 0, depth: 1750 }
    const to = {
      color: event.hide ? from.color : rgb(event.color, from.color),
      alpha: event.hide ? 0 : event.opacity == null ? from.alpha : clamp(event.opacity / 1000),
      depth: event.depth ?? from.depth,
    }
    tracks.set(event.id, { from, to, start: event.time, duration: Math.max(0, event.duration || 0) })
  }
  return new Map([...tracks].map(([id, track]) => [id, { id, ...sample(track, time) }]))
}
