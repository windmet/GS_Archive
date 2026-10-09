const TYPES = new Set(['SMALL', 'LARGE', 'FLICK_LEFT', 'FLICK_UP', 'FLICK_RIGHT', 'HOLD', 'VARIABLE_HOLD', 'LARGE_HOLD', 'LARGE_VARIABLE_HOLD', 'SPECIAL'])
const END_TYPES = new Set(['END_NORMAL', 'END_FLICK_LEFT', 'END_FLICK_UP', 'END_FLICK_RIGHT'])
const arrow = type => type?.endsWith('LEFT') ? '←' : type?.endsWith('RIGHT') ? '→' : type?.endsWith('UP') ? '↑' : ''

export function validateSongChart(chart, songCode, difficultyType) {
  if (chart?.schemaVersion !== 1 || chart.songCode !== songCode || chart.difficultyType !== difficultyType
    || chart.timeUnit !== 'native_tick' || chart.laneCount !== 5 || !Array.isArray(chart.notes) || !Array.isArray(chart.tempos)
    || chart.notes.length !== chart.noteObjectCount || !Number.isSafeInteger(chart.maxTick) || chart.maxTick < 0) throw new Error('谱面标识或格式不匹配')
  let maxTick = 0
  const indexes = new Set()
  for (const n of chart.notes) {
    if (!TYPES.has(n.type) || !Number.isSafeInteger(n.tick) || n.tick < 0 || !Number.isSafeInteger(n.duration) || n.duration < 0
      || !Number.isInteger(n.track) || Math.floor((n.track - 1) / 5) + 1 !== difficultyType
      || n.start !== (n.track - 1) % 5 || !Number.isInteger(n.end) || n.end < 0 || n.end > 4
      || !Number.isSafeInteger(n.sourceIndex) || indexes.has(n.sourceIndex)
      || (n.endtype && !END_TYPES.has(n.endtype))) throw new Error('谱面含有无法识别的音符')
    indexes.add(n.sourceIndex)
    maxTick = Math.max(maxTick, n.tick + n.duration)
    if (n.poly) {
      let previous = -1
      if (!Array.isArray(n.poly) || !n.poly.length || n.poly[0].subtick !== 0 || n.poly.at(-1).subtick !== n.duration) throw new Error('滑条端点缺失')
      for (const p of n.poly) {
        if (!Number.isFinite(p.subtick) || p.subtick < previous || !Number.isFinite(p.posx) || p.posx < 0 || p.posx > 4) throw new Error('滑条控制点无效')
        previous = p.subtick
      }
    }
  }
  if (maxTick !== chart.maxTick || !chart.tempos.length || chart.tempos[0].tick !== 0) throw new Error('谱面长度或初始 BPM 缺失')
  let lastTempoTick = -1
  for (const t of chart.tempos) {
    if (!Number.isSafeInteger(t.tick) || t.tick < lastTempoTick || !Number.isFinite(t.tempo) || t.tempo <= 0) throw new Error('BPM 数据无效')
    lastTempoTick = t.tick
  }
  return chart
}

// Four source charts (tibeti/wathon Expert, ldyrdm Pro, mtples Expert) carry one or two notes
// minutes after the song ends; the game stops with the music, so they are never played.
// The viewer keeps the source file intact and hides only notes that start after the audio.
export function playableSongChart(chart, audioSeconds) {
  const limit = Number(audioSeconds)
  if (!(limit > 0)) return chart
  const timing = buildSongChartTiming(chart)
  const notes = chart.notes.filter(n => timing.tickToSeconds(n.tick) <= limit + 0.5)
  if (notes.length === chart.notes.length) return chart
  const maxTick = notes.reduce((value, n) => Math.max(value, n.tick + n.duration), 0)
  return { ...chart, notes, maxTick, hiddenAfterSongEnd: chart.notes.length - notes.length }
}

export function buildSongChartGeometry(chart, pixelsPerThousand = 90) {
  const x = lane => 105 + lane * 55
  const y = tick => 42 + tick * pixelsPerThousand / 1000
  const height = Math.ceil(y(chart.maxTick) + 42)
  return {
    width: 410, height,
    lanes: Array.from({ length: 6 }, (_, i) => 77.5 + i * 55),
    grid: Array.from({ length: Math.floor(chart.maxTick / 2000) + 1 }, (_, i) => ({ tick: i * 2000, y: y(i * 2000) })),
    tempos: chart.tempos.map(t => ({ ...t, y: y(t.tick) })),
    links: songSimultaneousLinks(chart).map(l => ({ ...l, x1: x(l.from), x2: x(l.to), y: y(l.tick) })),
    middleNodes: songHoldMiddleNodes(chart).map(n => ({ ...n, x: x(n.lane), y: y(n.tick) })),
    notes: chart.notes.map(n => {
      const points = n.poly?.length ? n.poly : [{ subtick: 0, posx: n.start }, { subtick: n.duration, posx: n.end }]
      const last = points.at(-1)
      const bodyTriangles = []
      for (let i = 1; n.duration > 0 && i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const leftA = { x: x(a.posx) - 5.5, y: y(n.tick + a.subtick) }, rightA = { x: x(a.posx) + 5.5, y: y(n.tick + a.subtick) }
        const leftB = { x: x(b.posx) - 5.5, y: y(n.tick + b.subtick) }, rightB = { x: x(b.posx) + 5.5, y: y(n.tick + b.subtick) }
        const va = a.subtick / n.duration * 200, vb = b.subtick / n.duration * 200
        for (const mesh of [songTextureTriangle([leftA, rightA, leftB], [{x:0,y:va},{x:200,y:va},{x:0,y:vb}]), songTextureTriangle([rightA, rightB, leftB], [{x:200,y:va},{x:200,y:vb},{x:0,y:vb}])]) if (mesh) bodyTriangles.push(mesh)
      }
      return {
        id: n.sourceIndex, type: n.type, x: x(n.start), y: y(n.tick), endX: x(last.posx), endY: y(n.tick + n.duration),
        path: points.map((p, i) => `${i ? 'L' : 'M'} ${x(p.posx)} ${y(n.tick + p.subtick)}`).join(' '),
        held: n.duration > 0, wide: n.type.startsWith('LARGE'), special: n.type === 'SPECIAL',
        flick: arrow(n.type), endFlick: arrow(n.endtype),
        role: songNoteRole(n.type), endRole: songNoteRole(n.endtype || 'END_NORMAL'), bodyTriangles,
      }
    }),
  }
}
import { songNoteRole, songSimultaneousLinks, songHoldMiddleNodes } from './SongNotePresentation.js'
import { songTextureTriangle } from './SongTrackPresentation.js'
import { buildSongChartTiming } from './SongChartTiming.js'

// Split equal time intervals, preserving tempo-dependent source tick bounds.
export function buildSongChartColumns(chart, pixelsPerThousand = 90, targetHeight = 620) {
  if (!Number.isFinite(pixelsPerThousand) || pixelsPerThousand <= 0 || !Number.isFinite(targetHeight) || targetHeight <= 100) throw new Error('Invalid chart column size')
  const timing = buildSongChartTiming(chart)
  const length = timing.duration - timing.offset
  const maxTicksPerSecond = Math.max(...timing.segments.map(s => 1 / s.secondsPerTick))
  const count = Math.max(1, Math.ceil(length * maxTicksPerSecond * pixelsPerThousand / 1000 / (targetHeight - 100)))
  return Array.from({ length: count }, (_, index) => {
    const fromSeconds = timing.offset + index * length / count, toSeconds = timing.offset + (index + 1) * length / count
    const from = timing.secondsToTick(fromSeconds), to = index === count - 1 ? chart.maxTick : timing.secondsToTick(toSeconds)
    return { index, from, to, fromSeconds, toSeconds, startY: 42 + from * pixelsPerThousand / 1000, height: (to - from) * pixelsPerThousand / 1000 }
  })
}

export function songChartColumnAt(columns, tick) {
  return columns.find(c => tick >= c.from && tick < c.to)?.index ?? columns.length - 1
}
