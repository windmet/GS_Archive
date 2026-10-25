import { songNoteEndpoints, songHoldMiddleNodes } from './SongNotePresentation.js'
import { nativeSongNoteIsHold } from './SongTrackNativeNoteTypes.js'
import { buildSongChartTiming } from './SongChartTiming.js'

// First index whose key is strictly greater than time. Equal-time events are
// consumed together, including after an exact seek. No epsilon changes timing.
function upperBound(items, time, key = 'seconds') {
  let lo = 0, hi = items.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (items[mid][key] <= time) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function compileSongChartDemonstration(chart) {
  const timing = buildSongChartTiming(chart)
  const events = [...songNoteEndpoints(chart), ...songHoldMiddleNodes(chart)]
    .map(event => Object.freeze({ ...event, seconds: timing.tickToSeconds(event.tick) }))
    .sort((a, b) => a.seconds - b.seconds || a.lane - b.lane || a.sourceIndex - b.sourceIndex || a.id.localeCompare(b.id))
  const groups = []
  for (const event of events) {
    if (groups.at(-1)?.seconds !== event.seconds) groups.push({ seconds: event.seconds, events: [] })
    groups.at(-1).events.push(event)
  }
  for (const group of groups) { Object.freeze(group.events); Object.freeze(group) }
  const holds = chart.notes.filter(n => nativeSongNoteIsHold(n) && n.duration > 0).map(note => {
    const points = note.poly?.length ? note.poly : [{ subtick: 0, posx: note.start }, { subtick: note.duration, posx: note.end }]
    const knots = []
    for (let i = 0; i < points.length; i++) {
      const point = points[i], next = points[i + 1], tick = note.tick + point.subtick
      knots.push({ seconds: timing.tickToSeconds(tick), lane: point.posx })
      // Splitting at BPM changes keeps interpolation equivalent to the chart's
      // tick-linear poly while the scheduler itself works entirely in seconds.
      if (next) for (const tempo of chart.tempos) {
        const relative = tempo.tick - note.tick
        if (relative > point.subtick && relative < next.subtick) knots.push({
          seconds: timing.tickToSeconds(tempo.tick),
          lane: point.posx + (next.posx - point.posx) * (relative - point.subtick) / (next.subtick - point.subtick),
        })
      }
    }
    return Object.freeze({ sourceIndex: note.sourceIndex, start: timing.tickToSeconds(note.tick),
      end: timing.tickToSeconds(note.tick + note.duration), knots: Object.freeze(knots.map(Object.freeze)) })
  }).sort((a, b) => a.start - b.start || a.sourceIndex - b.sourceIndex)
  // Prefix maximum ends prune seek queries, including overlapping long holds.
  let end = -Infinity
  const maxEnds = holds.map(hold => (end = Math.max(end, hold.end)))
  return Object.freeze({ events: Object.freeze(events), groups: Object.freeze(groups), holds: Object.freeze(holds), maxEnds: Object.freeze(maxEnds) })
}

function holdPosition(hold, seconds) {
  const index = Math.max(0, upperBound(hold.knots, seconds) - 1)
  const a = hold.knots[index], b = hold.knots[index + 1]
  return { sourceIndex: hold.sourceIndex, lane: b ? a.lane + (b.lane - a.lane) * (seconds - a.seconds) / (b.seconds - a.seconds) : a.lane,
    age: seconds - hold.start, remaining: hold.end - seconds,
    startSeconds: hold.start, knots: hold.knots }
}

// This is a demonstration scheduler, not a touch judgement or scoring engine.
// advance is for continuous media samples; seek explicitly suppresses catch-up.
// Epoch changes let future effect consumers discard every pre-seek instance.
export function createSongChartDemonstration(timeline) {
  const bySource = new Map(timeline.holds.map(hold => [hold.sourceIndex, hold]))
  const active = new Map()
  let time = -Infinity, groupIndex = 0, count = 0, epoch = 0
  function snapshot(seconds, crossed = []) {
    return { seconds, epoch, count, total: timeline.events.length, crossed,
      holds: [...active.values()].map(hold => holdPosition(hold, seconds)) }
  }
  function seek(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('Media time must be finite')
    epoch++; time = seconds
    groupIndex = upperBound(timeline.groups, seconds)
    count = upperBound(timeline.events, seconds)
    active.clear()
    for (let i = upperBound(timeline.holds, seconds, 'start') - 1; i >= 0 && timeline.maxEnds[i] > seconds; i--) {
      const hold = timeline.holds[i]
      if (hold.end > seconds) active.set(hold.sourceIndex, hold)
    }
    return snapshot(seconds)
  }
  function advance(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('Media time must be finite')
    if (seconds < time) return seek(seconds)
    const crossed = []
    while (groupIndex < timeline.groups.length && timeline.groups[groupIndex].seconds <= seconds) {
      const group = timeline.groups[groupIndex++]
      crossed.push(group)
      for (const event of group.events) {
        count++
        const hold = bySource.get(event.sourceIndex)
        if (hold && event.endpoint === 'head') active.set(event.sourceIndex, hold)
        if (hold && event.endpoint === 'tail') active.delete(event.sourceIndex)
      }
    }
    time = seconds
    return snapshot(seconds, crossed)
  }
  return { advance, seek }
}
