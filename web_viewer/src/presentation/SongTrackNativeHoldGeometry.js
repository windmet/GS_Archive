import { songTrackNativePoint } from './SongTrackNativeProjection.js'

const f = Math.fround
const mix = (a, b, t) => f(a + f(f(b - a) * t))
const magnitude = (x, y) => f(Math.sqrt(f(f(x * x) + f(y * y))))

// HoldMesh's drawing plane uses lane + modified normalized time. The points
// arrive in reverse note order, from the far end toward the judgement line.
// This is the mesh calculation, not the input/holding state machine.
export function buildNativeSongHoldMesh(points, target, metrics, drawScale = 1) {
  if (!Array.isArray(points) || points.length < 2 || ![metrics.radius, metrics.laneWidth, metrics.timeFactor, drawScale].every(n => Number.isFinite(n) && n > 0) ||
      points.some((p, i) => !Number.isFinite(p.x) || !Number.isFinite(p.y) || (i > 0 && p.y < points[i - 1].y))) throw new Error('Invalid native hold geometry')
  const width = f(f(f(metrics.radius / metrics.laneWidth) * 1.5) * f(drawScale))
  points = points.map(p => ({ x: f(p.x), y: f(p.y) }))
  const lengths = points.slice(1).map((p, i) => magnitude(f(p.x - points[i].x), f(p.y - points[i].y)))
  const total = lengths.reduce((sum, n) => sum + n, 0)
  const ratios = [0]
  let distance = 0
  for (const length of lengths) { distance += length; ratios.push(total > 0 ? f(distance / total) : 0) }
  const uvAt = i => f(f(ratios[i] * .5) + .25)
  const edge = p => [{ x: f(p.x - width), y: p.y }, { x: f(p.x + width), y: p.y }]
  const first = points[0], last = points.at(-1)
  const parts = []
  parts.push({ a: [{ x: first.x, y: f(first.y - width) }, { x: first.x, y: f(first.y - width) }], b: edge(first), v0: .25, v1: .25 })
  for (let i = 1; i < points.length; i++) parts.push({ a: edge(points[i - 1]), b: edge(points[i]), v0: uvAt(i - 1), v1: uvAt(i) })
  parts.push({ a: edge(last), b: [{ x: last.x, y: f(last.y + width) }, { x: last.x, y: f(last.y + width) }], v0: uvAt(points.length - 1), v1: uvAt(points.length - 1) })
  const project = p => {
    const native = songTrackNativePoint(p.x, -p.y / metrics.timeFactor, target)
    return { x: Math.max(-1280, Math.min(1280, native.x)), y: Math.max(-720, Math.min(720, native.y)), z: f(native.z + 500) }
  }
  const vertices = [], uv = [], triangles = []
  const append = (pair, v) => {
    for (let side = 0; side < 2; side++) { vertices.push(pair[side]); uv.push([side, v]) }
  }
  for (const part of parts) {
    const count = Math.ceil(f(Math.max(...[0, 1].map(i => magnitude(f(part.b[i].x - part.a[i].x), f(part.b[i].y - part.a[i].y)))) * 4 / .1))
    const a = part.a.map(project), b = part.b.map(project)
    const old = vertices.slice(-2)
    if (vertices.length < 2 || a.some((p, i) => ['x', 'y', 'z'].some(axis => Math.abs(f(p[axis] - old[i][axis])) >= 2))) append(a, part.v0)
    for (let i = 1; i <= count; i++) {
      const t = f(i / count)
      const index = vertices.length
      append(a.map((p, side) => Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, mix(p[axis], b[side][axis], t)]))), mix(part.v0, part.v1, t))
      triangles.push(index - 2, index - 1, index, index - 1, index + 1, index)
    }
  }
  const maxY = project(first).y, minY = project(last).y
  for (const vertex of vertices) vertex.y = Math.max(minY, Math.min(maxY, vertex.y))
  return { vertices, uv, triangles }
}
