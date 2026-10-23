import reference from '../../config/song-track-reference.v1.json' with { type: 'json' }
import nativeGeometry from '../../config/song-track-native-geometry.v1.json' with { type: 'json' }
import nativeNotes from '../../config/song-track-native-note-geometry.v1.json' with { type: 'json' }
import { noteRendering, songNoteRole, songSimultaneousLinks, songHoldMiddleNodes } from './SongNotePresentation.js'
import { buildSongChartTiming } from './SongChartTiming.js'
import { songTrackNativePoint } from './SongTrackNativeProjection.js'
import { songTrackNoteReadTime, songTrackNoteTime } from './SongTrackNativeTiming.js'
import { buildNativeSongNoteQuad } from './SongTrackNativeNoteGeometry.js'
export { songTrackSpanForSpeed } from './SongTrackNativeTiming.js'

export const trackReference = reference
const estimate = reference.screenshotEstimates
const laneCount = reference.constants.LaneCount.value
const round = value => Number(value.toFixed(5))

// Adapt the native centered, positive-Y-up canvas coordinates to our SVG plane.
// This does not reproduce Unity's complete note/hold meshes or GPU pipeline.
export function projectTrackPoint(lane, fraction) {
  const point = songTrackNativePoint(lane, fraction, nativeGeometry.target)
  return { x: nativeGeometry.viewport.width / 2 + point.x,
    y: nativeGeometry.viewport.height / 2 - point.y,
    z: point.z, scale: point.scale }
}

export function laneAt(points, subtick) {
  for (let i = 1; i < points.length; i++) {
    if (subtick > points[i].subtick) continue
    const a = points[i - 1], b = points[i]
    return b.subtick === a.subtick ? b.posx : a.posx + (b.posx - a.posx) * (subtick - a.subtick) / (b.subtick - a.subtick)
  }
  return points.at(-1).posx
}

// A native note quad is a parallelogram apart from float32 rounding. One
// affine bitmap avoids a double-alpha seam along a two-triangle SVG clip.
// Clip to all four native vertices and retain the fractional atlas UV crop.
export function songTrackNoteImage(role, skin, lane, fraction) {
  const sprite = nativeNotes.skins[skin]?.[role]
  if (!sprite) throw new Error('Unknown native track sprite')
  const quad = buildNativeSongNoteQuad({ lane, fraction,
    textureWidth: sprite.textureWidth, textureHeight: sprite.textureHeight,
    noteType: nativeNotes.roleNoteTypes[role], drawScale: nativeNotes.defaultDrawScale,
    target: nativeGeometry.target })
  const vertices = quad.vertices.map(p => ({ x: nativeGeometry.viewport.width / 2 + p.x,
    y: nativeGeometry.viewport.height / 2 - p.y, z: p.z }))
  const [bottomLeft, topLeft, topRight] = vertices
  const { left, right, top, bottom } = sprite.uv
  const a = (topRight.x - topLeft.x) / (right - left)
  const b = (topRight.y - topLeft.y) / (right - left)
  const c = (bottomLeft.x - topLeft.x) / (bottom - top)
  const d = (bottomLeft.y - topLeft.y) / (bottom - top)
  const matrix = [a, b, c, d, topLeft.x - a * left - c * top, topLeft.y - b * left - d * top]
  const bounds = noteRendering.skins[skin][role].displayBounds
  return { url: sprite.url, pngWidth: sprite.pngWidth, pngHeight: sprite.pngHeight,
    matrix, transform: `matrix(${matrix.join(' ')})`, vertices, nativeVertices: quad.vertices,
    points: vertices.map(p => `${p.x},${p.y}`).join(' '),
    visibleWidth: quad.width * (bounds[2] - bounds[0]) / (right - left) }
}

// Map native 200px hold texture coordinates onto clipped triangle geometry.
// Keep the full hold's V coordinates when the preview window cuts either end.
export function songTextureTriangle(screen, uv) {
  const [p, q, r] = screen, [a, b, c] = uv
  const determinant = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
  if (Math.abs(determinant) < 1e-8) return null
  const axis = key => {
    const m = ((q[key] - p[key]) * (c.y - a.y) - (r[key] - p[key]) * (b.y - a.y)) / determinant
    const n = ((r[key] - p[key]) * (b.x - a.x) - (q[key] - p[key]) * (c.x - a.x)) / determinant
    return [m, n, p[key] - m * a.x - n * a.y]
  }
  const [m, n, tx] = axis('x'), [o, pY, ty] = axis('y')
  // Subpixel overlap prevents antialiased clip edges from cutting dark seams
  // through the continuous native strip. Texture UVs remain unchanged.
  const center = { x: screen.reduce((v, p) => v + p.x, 0) / 3, y: screen.reduce((v, p) => v + p.y, 0) / 3 }
  const clip = screen.map(p => {
    const length = Math.hypot(p.x - center.x, p.y - center.y) || 1
    return { x: p.x + (p.x - center.x) / length * .7, y: p.y + (p.y - center.y) / length * .7 }
  })
  return { points: clip.map(p => `${round(p.x)},${round(p.y)}`).join(' '),
    matrix: `matrix(${[m, o, n, pY, tx, ty].map(round).join(' ')})` }
}

export function buildSongTrackGeometry(chart, cursor = 0, span = 6000, skin = 'Note1SpriteAtlas') {
  if (!Number.isFinite(cursor) || cursor < 0 || !Number.isFinite(span) || span <= 0) throw new Error('Invalid track window')
  // Real charts use elapsed seconds, including across tempo changes. Small
  // geometry-only callers without tempos retain their unitless tick window.
  const timing = chart.tempos?.length ? buildSongChartTiming(chart) : null
  const startSeconds = timing ? timing.tickToSeconds(cursor) : cursor
  const duration = timing ? timing.tickToSeconds(cursor + span) - startSeconds : span
  const toSeconds = tick => timing ? timing.tickToSeconds(tick) : tick
  const endForSpeed = speed => timing
    ? timing.secondsToTick(startSeconds + songTrackNoteReadTime(duration, speed))
    : cursor + songTrackNoteReadTime(duration, speed)
  const project = (lane, tick, speed = 1) => {
    const fraction = -songTrackNoteTime(startSeconds, toSeconds(tick), duration, speed)
    return { ...projectTrackPoint(lane, fraction), fraction }
  }
  const glyphs = [], holds = []
  const glyph = (n, tick, lane, type, endpoint) => {
    const speed = n.speed ?? 1
    if (tick < cursor || tick > endForSpeed(speed)) return
    const p = project(lane, tick, speed)
    const role = songNoteRole(type), image = songTrackNoteImage(role, skin, lane, p.fraction)
    glyphs.push({ id: `${n.sourceIndex}-${endpoint}`, sourceIndex: n.sourceIndex, type,
      endpoint, tick, lane, speed, fraction: p.fraction, x: p.x, y: p.y,
      width: image.visibleWidth, image,
      special: type === 'SPECIAL',
      role })
  }
  for (const n of chart.notes) {
    const end = n.tick + n.duration
    const speed = n.speed ?? 1, windowEnd = endForSpeed(speed)
    if (end < cursor || n.tick > windowEnd) continue
    const points = n.poly?.length ? n.poly : [{ subtick: 0, posx: n.start }, { subtick: n.duration, posx: n.end }]
    glyph(n, n.tick, points[0].posx, n.type, 'head')
    if (!n.duration) continue
    glyph(n, end, points.at(-1).posx, n.endtype || 'END_NORMAL', 'tail')
    const from = Math.max(n.tick, cursor), to = Math.min(end, windowEnd)
    if (to <= from) continue
    const ticks = new Set([from, to])
    // Include every native bend before adding perspective tessellation points.
    for (const p of points) if (n.tick + p.subtick > from && n.tick + p.subtick < to) ticks.add(n.tick + p.subtick)
    // A hold within one lane already projects to a straight trapezoid. Avoid
    // unnecessary internal clip edges there; curved slides need subdivision.
    if (points.some(p => p.posx !== points[0].posx)) {
      for (let t = from + (windowEnd - cursor) / 32; t < to; t += (windowEnd - cursor) / 32) ticks.add(t)
    }
    const samples = [...ticks].sort((a, b) => a - b).map(tick => {
      const lane = laneAt(points, tick - n.tick), p = project(lane, tick, speed)
      const half = estimate.normalVisibleWidth * estimate.holdWidthRatio * p.scale / 2
      return { tick, lane, left: { x: p.x - half, y: p.y }, right: { x: p.x + half, y: p.y }, v: (tick - n.tick) / n.duration * 200 }
    })
    const triangles = []
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i]
      for (const mesh of [
        songTextureTriangle([a.left, a.right, b.left], [{ x: 0, y: a.v }, { x: 200, y: a.v }, { x: 0, y: b.v }]),
        songTextureTriangle([a.right, b.right, b.left], [{ x: 200, y: a.v }, { x: 200, y: b.v }, { x: 0, y: b.v }]),
      ]) if (mesh) triangles.push(mesh)
    }
    holds.push({ id: n.sourceIndex, from, to, samples, triangles })
  }
  const { width, height } = nativeGeometry.viewport
  const topY = projectTrackPoint(2, 1).y, judgeY = projectTrackPoint(2, 0).y
  const speeds = new Map(chart.notes.map(n => [n.sourceIndex, n.speed ?? 1]))
  // Native same-timing links also require equal note speeds. Keep this visual
  // grouping separate from the long chart's schematic tick-only grouping.
  const groups = new Map()
  for (const note of chart.notes) {
    const speed = Math.fround(note.speed ?? 1)
    if (!groups.has(speed)) groups.set(speed, [])
    groups.get(speed).push(note)
  }
  const links = [...groups.entries()].flatMap(([speed, notes]) => songSimultaneousLinks({ notes })
    .filter(l => l.tick >= cursor && l.tick <= endForSpeed(speed))
    .map(l => ({ ...l, id: `${l.tick}-${speed}`, speed,
      a: project(l.from, l.tick, speed), b: project(l.to, l.tick, speed) })))
  return { width, height, topY, judgeY, cursor, span, holds,
    middleNodes: songHoldMiddleNodes(chart).filter(n => n.tick >= cursor && n.tick <= endForSpeed(speeds.get(n.sourceIndex))).map(n => {
      const p = project(n.lane, n.tick, speeds.get(n.sourceIndex))
      const image = songTrackNoteImage('middle', skin, n.lane, p.fraction)
      return { ...n, x: p.x, y: p.y, width: image.visibleWidth, image }
    }),
    links,
    glyphs: glyphs.sort((a, b) => b.tick - a.tick),
    lanes: Array.from({ length: laneCount + 1 }, (_, i) => {
      const top = projectTrackPoint(i - .5, 1), judge = projectTrackPoint(i - .5, 0)
      return { topX: top.x, bottomX: top.x + (judge.x - top.x) * (height - topY) / (judgeY - topY) }
    }),
    judges: Array.from({ length: laneCount }, (_, i) => projectTrackPoint(i, 0)) }
}
