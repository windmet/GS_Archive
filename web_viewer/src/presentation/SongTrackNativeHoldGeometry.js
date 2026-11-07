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
  // Runs for every visible hold on every frame: the subdivision loop allocates only its output.
  const far = (p, q) => Math.abs(f(p.x - q.x)) >= 2 || Math.abs(f(p.y - q.y)) >= 2 || Math.abs(f(p.z - q.z)) >= 2
  const lerp = (p, q, t) => ({ x: mix(p.x, q.x, t), y: mix(p.y, q.y, t), z: mix(p.z, q.z, t) })
  for (const part of parts) {
    const count = Math.ceil(f(Math.max(magnitude(f(part.b[0].x - part.a[0].x), f(part.b[0].y - part.a[0].y)),
      magnitude(f(part.b[1].x - part.a[1].x), f(part.b[1].y - part.a[1].y))) * 4 / .1))
    const a0 = project(part.a[0]), a1 = project(part.a[1]), b0 = project(part.b[0]), b1 = project(part.b[1])
    const n = vertices.length
    if (n < 2 || far(a0, vertices[n - 2]) || far(a1, vertices[n - 1])) append([a0, a1], part.v0)
    for (let i = 1; i <= count; i++) {
      const t = f(i / count)
      const index = vertices.length
      vertices.push(lerp(a0, b0, t), lerp(a1, b1, t))
      const v = mix(part.v0, part.v1, t)
      uv.push([0, v], [1, v])
      triangles.push(index - 2, index - 1, index, index - 1, index + 1, index)
    }
  }
  const maxY = project(first).y, minY = project(last).y
  for (const vertex of vertices) vertex.y = Math.max(minY, Math.min(maxY, vertex.y))
  return { vertices, uv, triangles }
}
