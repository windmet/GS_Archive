import reference from '../../config/song-track-reference.v1.json' with { type: 'json' }

export const trackReference = reference
const estimate = reference.screenshotEstimates
const laneCount = reference.constants.LaneCount.value
const nearWidth = reference.constants.TargetLaneWidth.value
const farWidth = reference.constants.TopLaneWidth.value
const round = value => Number(value.toFixed(5))

// Native constants establish five lanes and the two widths. This interpolation
// is a screenshot reconstruction, not the unrecovered Unity camera matrix.
export function projectTrackPoint(lane, fraction) {
  const depth = (1 - fraction) / (1 + (estimate.depthRatio - 1) * fraction)
  const width = farWidth + (nearWidth - farWidth) * depth
  return { x: estimate.centerX + (lane - 2) * width / laneCount,
    y: estimate.topY + (estimate.judgeY - estimate.topY) * depth,
    scale: width / nearWidth }
}

export function laneAt(points, subtick) {
  for (let i = 1; i < points.length; i++) {
    if (subtick > points[i].subtick) continue
    const a = points[i - 1], b = points[i]
    return b.subtick === a.subtick ? b.posx : a.posx + (b.posx - a.posx) * (subtick - a.subtick) / (b.subtick - a.subtick)
  }
  return points.at(-1).posx
}

// Map native 200px hold texture coordinates onto clipped triangle geometry.
// Keep the full hold's V coordinates when the preview window cuts either end.
function triangle(screen, uv) {
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

export function buildSongTrackGeometry(chart, cursor = 0, span = 6000) {
  if (!Number.isFinite(cursor) || cursor < 0 || !Number.isFinite(span) || span <= 0) throw new Error('Invalid track window')
  const project = (lane, tick) => projectTrackPoint(lane, (tick - cursor) / span)
  const glyphs = [], holds = []
  const glyph = (n, tick, lane, type, endpoint) => {
    if (tick < cursor || tick > cursor + span) return
    const p = project(lane, tick)
    glyphs.push({ id: `${n.sourceIndex}-${endpoint}`, sourceIndex: n.sourceIndex, type,
      endpoint, tick, lane, x: p.x, y: p.y,
      width: estimate.normalVisibleWidth * p.scale * (n.type.startsWith('LARGE') ? 1.45 : 1),
      special: type === 'SPECIAL',
      role: type.endsWith('LEFT') ? 'swipe_left' : type.endsWith('RIGHT') ? 'swipe_right' : type.endsWith('UP') ? 'swipe_up' : 'normal' })
  }
  for (const n of chart.notes) {
    const end = n.tick + n.duration
    if (end < cursor || n.tick > cursor + span) continue
    const points = n.poly?.length ? n.poly : [{ subtick: 0, posx: n.start }, { subtick: n.duration, posx: n.end }]
    glyph(n, n.tick, points[0].posx, n.type, 'head')
    if (!n.duration) continue
    glyph(n, end, points.at(-1).posx, n.endtype || 'END_NORMAL', 'tail')
    const from = Math.max(n.tick, cursor), to = Math.min(end, cursor + span)
    if (to <= from) continue
    const ticks = new Set([from, to])
    // Include every native bend before adding perspective tessellation points.
    for (const p of points) if (n.tick + p.subtick > from && n.tick + p.subtick < to) ticks.add(n.tick + p.subtick)
    // A hold within one lane already projects to a straight trapezoid. Avoid
    // unnecessary internal clip edges there; curved slides need subdivision.
    if (points.some(p => p.posx !== points[0].posx)) {
      for (let t = from + span / 32; t < to; t += span / 32) ticks.add(t)
    }
    const samples = [...ticks].sort((a, b) => a - b).map(tick => {
      const lane = laneAt(points, tick - n.tick), p = project(lane, tick)
      const half = estimate.normalVisibleWidth * estimate.holdWidthRatio * p.scale / 2 * (n.type.startsWith('LARGE') ? 1.45 : 1)
      return { tick, lane, left: { x: p.x - half, y: p.y }, right: { x: p.x + half, y: p.y }, v: (tick - n.tick) / n.duration * 200 }
    })
    const triangles = []
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1], b = samples[i]
      for (const mesh of [
        triangle([a.left, a.right, b.left], [{ x: 0, y: a.v }, { x: 200, y: a.v }, { x: 0, y: b.v }]),
        triangle([a.right, b.right, b.left], [{ x: 200, y: a.v }, { x: 200, y: b.v }, { x: 0, y: b.v }]),
      ]) if (mesh) triangles.push(mesh)
    }
    holds.push({ id: n.sourceIndex, from, to, samples, triangles })
  }
  const bottomWidth = farWidth + (nearWidth - farWidth) * (720 - estimate.topY) / (estimate.judgeY - estimate.topY)
  return { width: 1280, height: 720, cursor, span, holds,
    glyphs: glyphs.sort((a, b) => b.tick - a.tick),
    lanes: Array.from({ length: laneCount + 1 }, (_, i) => ({
      topX: estimate.centerX + (i - laneCount / 2) * farWidth / laneCount,
      bottomX: estimate.centerX + (i - laneCount / 2) * bottomWidth / laneCount })),
    judges: Array.from({ length: laneCount }, (_, i) => projectTrackPoint(i, 0)) }
}
