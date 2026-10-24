import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compileSongChartDemonstration, createSongChartDemonstration } from '../src/presentation/SongChartDemonstration.js'
import { buildSongChartTiming } from '../src/presentation/SongChartTiming.js'
import { playableSongChart } from '../src/presentation/SongChartPresentation.js'
import { nativeSongNoteIsHold } from '../src/presentation/SongTrackNativeNoteTypes.js'

const chart = { offset: 0, maxTick: 1920, tempos: [{ tick: 0, tempo: 120 }, { tick: 480, tempo: 60 }], notes: [
  { sourceIndex: 0, type: 'SMALL', tick: 0, start: 0, end: 0, duration: 0 },
  { sourceIndex: 1, type: 'VARIABLE_HOLD', tick: 0, start: 0, end: 4, duration: 1920,
    poly: [{ subtick: 0, posx: 0 }, { subtick: 960, posx: 2 }, { subtick: 960, posx: 3 }, { subtick: 1920, posx: 4 }] },
  { sourceIndex: 2, type: 'FLICK_UP', tick: 960, start: 1, end: 1, duration: 480 },
] }
const timeline = compileSongChartDemonstration(chart), scheduler = createSongChartDemonstration(timeline)
assert.equal(timeline.events.length, 6, 'non-hold duration has no tail; duplicate poly indices both count')
assert.equal(scheduler.advance(0).crossed[0].events.length, 2, 'tick zero/simultaneous head delivery')
assert.equal(scheduler.advance(0).crossed.length, 0, 'pause/repeated sample cannot duplicate events')
assert.equal(scheduler.advance(.5).holds[0].lane, 1, 'BPM boundary is an interpolation knot')
assert.equal(scheduler.advance(1).holds[0].lane, 1.5, 'lane interpolation follows new BPM')
const middle = scheduler.advance(1.5)
assert.equal(middle.crossed[0].events.length, 3, 'two middles and flick share a time group')
assert.equal(middle.holds[0].lane, 3, 'duplicate poly times choose the rightmost lane')
assert.equal(scheduler.advance(3.5).holds.length, 0, 'tail excludes hold at exact end')
const jumped = scheduler.seek(1)
assert.equal(jumped.crossed.length, 0, 'seek does not emit skipped events')
assert.equal(jumped.count, 2)
assert.equal(jumped.holds[0].lane, 1.5)
assert.equal(scheduler.seek(1.5).count, 5, 'exact seek counts boundary inclusively')
assert.equal(scheduler.advance(1.5).crossed.length, 0, 'resume at exact seek cannot replay boundary')
assert.equal(scheduler.advance(.5).crossed.length, 0, 'backward sample rebuilds without catch-up')
assert.ok(scheduler.seek(3.5).epoch > jumped.epoch)
assert.equal(scheduler.seek(0).holds.length, 1, 'head boundary is inclusive')
assert.throws(() => scheduler.advance(NaN), TypeError)
assert.throws(() => scheduler.seek(Infinity), TypeError)
assert.equal(createSongChartDemonstration(compileSongChartDemonstration({ ...chart, notes: [] })).advance(10).count, 0)

const root = new URL('../public/data/', import.meta.url)
const catalog = JSON.parse(readFileSync(new URL('song_catalog.json', root)))
const audio = JSON.parse(readFileSync(new URL('song_playback_audio.json', root)))
let charts = 0, events = 0, samples = 0, seekChecks = 0
const roles = new Set()
for (const song of Object.values(catalog.songs)) for (const difficulty of song.gameplay.difficulties) {
  const parsed = JSON.parse(readFileSync(new URL(difficulty.chart.url.replace('/data/', ''), root)))
  const playable = playableSongChart(parsed, audio.songs[parsed.songCode]?.source?.duration_seconds)
  const timing = buildSongChartTiming(playable), compiled = compileSongChartDemonstration(playable)
  const replay = createSongChartDemonstration(compiled), delivered = []
  assert.equal(compiled.events.length, difficulty.maxCombo, `${song.id}/${difficulty.type}: PB event count`)
  assert.equal(new Set(compiled.events.map(e => e.id)).size, compiled.events.length)
  for (const e of compiled.events) { roles.add(e.role); assert.equal(e.seconds, timing.tickToSeconds(e.tick)) }
  // Entire chart, variable 60/120Hz media samples and rate changes; no skipped
  // media intervals. Every original identity must be delivered exactly once.
  for (let seconds = 0; seconds <= timing.duration + .05; seconds += (samples % 2 ? 1 : 1.5) / 120) {
    const state = replay.advance(seconds)
    delivered.push(...state.crossed.flatMap(group => group.events.map(e => e.id)))
    samples++
  }
  const final = replay.advance(timing.duration + 1)
  delivered.push(...final.crossed.flatMap(group => group.events.map(e => e.id)))
  assert.deepEqual(delivered, compiled.events.map(e => e.id), 'full-song ordered delivery')
  assert.equal(final.count, difficulty.maxCombo)
  assert.equal(final.holds.length, 0)
  const sourceHolds = playable.notes.filter(n => nativeSongNoteIsHold(n) && n.duration > 0)
  // Compare random-access reconstruction with original note intervals, not the
  // compiler's own hold list; include every head and tail and reverse seeks.
  for (const seconds of [...new Set([0, timing.duration, ...sourceHolds.flatMap(n =>
    [n.tick, n.tick + n.duration / 2, n.tick + n.duration].map(tick => timing.tickToSeconds(tick)))])].reverse()) {
    const state = replay.seek(seconds)
    const expected = sourceHolds.filter(n => timing.tickToSeconds(n.tick) <= seconds && timing.tickToSeconds(n.tick + n.duration) > seconds)
    assert.deepEqual(state.holds.map(h => h.sourceIndex).sort((a,b) => a-b), expected.map(n => n.sourceIndex).sort((a,b) => a-b))
    assert.equal(state.count, compiled.events.filter(e => e.seconds <= seconds).length)
    assert.equal(state.crossed.length, 0)
    for (const hold of state.holds) {
      const note = expected.find(n => n.sourceIndex === hold.sourceIndex)
      const poly = note.poly || [{ subtick: 0, posx: note.start }, { subtick: note.duration, posx: note.end }]
      const tick = timing.secondsToTick(seconds) - note.tick
      // Inverse timing has floating-point noise at exact poly boundaries.
      const i = Math.max(0, poly.findLastIndex(p => p.subtick <= tick + 1e-7))
      const a = poly[i], b = poly[i + 1]
      const lane = b ? a.posx + (b.posx-a.posx) * (tick-a.subtick)/(b.subtick-a.subtick) : a.posx
      assert.ok(Math.abs(hold.lane - lane) < 1e-7, 'BPM/poly seek lane')
    }
    seekChecks++
  }
  charts++; events += compiled.events.length
}
assert.equal(charts, 244)
for (const role of ['normal', 'middle', 'swipe_left', 'swipe_right', 'swipe_up', 'sp', 'p_skill']) assert.ok(roles.has(role), `role ${role}`)
console.log(`Demonstration verified: ${charts} playable charts/${events} events, ${samples} full-song samples, ${seekChecks} interval/position seeks; BPM, duplicate poly, zero/exact boundaries and discontinuities passed.`)
