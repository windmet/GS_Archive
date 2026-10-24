import { songTrackNativePoint } from './SongTrackNativeProjection.js'

const f = Math.fround
const lerp = (a, b, t) => f(f(a) + f(f(f(b) - f(a)) * f(t)))

// NoteMesh.UpdateFromGameCreateMesh (0x20bd010). Texture dimensions are the
// native packed textureRect floats, not PNG dimensions or alpha bounds.
export function buildNativeSongNoteQuad({ lane, fraction, textureWidth, textureHeight, drawScale = 1, noteType = 0, target }) {
  if (![lane, fraction, textureWidth, textureHeight, drawScale].every(Number.isFinite) ||
      textureWidth <= 0 || textureHeight <= 0 || drawScale <= 0) throw new Error('Invalid native note geometry')
  lane = f(lane)
  textureWidth = f(textureWidth); textureHeight = f(textureHeight)
  const scaleRate = lerp(f(1.8), 1, Math.max(0, Math.min(1, f(1 - fraction))))
  const noteScale = f(f(noteType === 9 ? 1.8 : 1) * f(drawScale))
  const halfLane = f(textureWidth / 312) * .5 * noteScale * scaleRate
  const center = songTrackNativePoint(lane, fraction, target)
  const left = songTrackNativePoint(lane - halfLane, fraction, target)
  const right = songTrackNativePoint(lane + halfLane, fraction, target)
  const before = songTrackNativePoint(lane, fraction + .10000000149011612, target)
  const direction = ['x', 'y', 'z'].map(axis => f(center[axis] - before[axis]))
  const length = f(Math.sqrt(f(f(f(direction[0] * direction[0]) + f(direction[1] * direction[1])) + f(direction[2] * direction[2]))))
  const normal = direction.map(value => f(value / length))
  let amount = f(textureWidth / 192)
  amount = f(f(Math.abs(f(left.x - right.x))) * amount)
  amount = f(f(textureHeight / textureWidth) * amount)
  amount = f(amount * f(.8))
  amount = f(amount * .5)
  amount = f(amount / normal[1])
  const displacement = normal.map(value => f(value * amount))
  const vertex = (point, sign) => Object.fromEntries(['x', 'y', 'z'].map((axis, i) => [axis, f(point[axis] + sign * displacement[i])]))
  return { center, width: f(Math.abs(f(left.x - right.x))),
    vertices: [vertex(left, -1), vertex(left, 1), vertex(right, 1), vertex(right, -1)] }
}
