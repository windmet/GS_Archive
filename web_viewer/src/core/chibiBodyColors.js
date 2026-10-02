const clamp = value => Math.max(0, Math.min(1, value))
const mix = (a, b, t) => [16, 8, 0].reduce((result, shift) => result |
  (Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t) << shift), 0)
const sample = (track, time) => mix(track.from, track.to,
  track.duration <= 0 ? 1 : clamp((time - track.start) / track.duration))

// Rebuild independent performer tint tracks on every seek. Never fade Spine alpha.
export function bodyColorsAt(events = [], time = 0) {
  const tracks = new Map()
  for (const event of events) {
    if (event.time > time) break
    if (!Number.isInteger(event.stagePosition) || event.stagePosition <= 0) continue
    const previous = tracks.get(event.stagePosition)
    const from = previous ? sample(previous, event.time) : 0xffffff
    const to = event.hide ? 0xffffff : mix(0xffffff,
      parseInt(event.color.slice(1), 16), clamp(event.opacity / 1000))
    tracks.set(event.stagePosition, { from, to, start: event.time,
      duration: Math.max(0, event.duration || 0) })
  }
  return new Map([...tracks].map(([position, track]) => [position, sample(track, time)]))
}

export function multiplyBodyTint(base, body = 0xffffff) {
  return [16, 8, 0].reduce((result, shift) => result |
    (Math.round(((base >> shift) & 255) * ((body >> shift) & 255) / 255) << shift), 0)
}
