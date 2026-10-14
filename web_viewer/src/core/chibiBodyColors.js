const clamp = value => Math.max(0, Math.min(1, value))
const mix = (a, b, t) => [16, 8, 0].reduce((result, shift) => result |
  (Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t) << shift), 0)
const sample = (track, time) => mix(track.from, track.to,
  track.duration <= 0 ? 1 : clamp((time - track.start) / track.duration))

// Rebuild independent performer tint tracks on every seek. Never fade Spine alpha.
export function addressedTintsAt(events = [], time = 0, key, valid) {
  const tracks = new Map()
  for (const event of events) {
    if (event.time > time) break
    if (event.unresolvedReason) continue
    const identity = event[key]
    if (!valid(identity)) continue
    const previous = tracks.get(identity)
    const from = previous ? sample(previous, event.time) : 0xffffff
    const to = event.hide ? 0xffffff : mix(0xffffff,
      parseInt(event.color.slice(1), 16), clamp(event.opacity / 1000))
    tracks.set(identity, { from, to, start: event.time,
      duration: Math.max(0, event.duration || 0) })
  }
  return new Map([...tracks].map(([position, track]) => [position, sample(track, time)]))
}

// Legacy RGB diagnostic projection; the character renderer uses bodyUniformsAt.
export function bodyColorsAt(events = [], time = 0) {
  return addressedTintsAt(events, time, 'stagePosition', value => Number.isInteger(value) && value > 0)
}

// Native _BodyColor is RGBA replacement, not a multiply tint. DOTween.To
// interpolates all four components using the configured default OutQuad.
export function bodyUniformsAt(events = [], time = 0) {
  const tracks = new Map()
  const sample = (track, t) => {
    const p = track.duration > 0 ? clamp((t - track.start) / track.duration) : 1
    const f = 1 - (1 - p) ** 2
    return track.from.map((v, i) => v + (track.to[i] - v) * f)
  }
  for (const event of events) {
    if (event.time > time) break
    const position = event.stagePosition
    if (event.unresolvedReason || !Number.isInteger(position) || position <= 0) continue
    const previous = tracks.get(position)
    const from = previous ? sample(previous, event.time) : [1, 1, 1, 0]
    const color = parseInt(event.color?.slice(1) || 'ffffff', 16)
    const to = event.hide ? [1, 1, 1, 0] : [16, 8, 0].map(s => ((color >> s) & 255) / 255)
      .concat(clamp(event.opacity / 1000))
    tracks.set(position, { from, to, start: event.time, duration: Math.max(0, event.duration || 0) })
  }
  return new Map([...tracks].map(([position, track]) => [position, sample(track, time)]))
}

export function multiplyBodyTint(base, body = 0xffffff) {
  return [16, 8, 0].reduce((result, shift) => result |
    (Math.round(((base >> shift) & 255) * ((body >> shift) & 255) / 255) << shift), 0)
}
