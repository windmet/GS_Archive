import assert from 'node:assert/strict'
import { songChartFrameTime } from '../src/presentation/SongChartFrameClock.js'

for (const displayHz of [60, 90, 120, 144]) for (const targetHz of [30, 60]) {
  let previous = null, paints = 0
  for (let i = 0; i < displayHz * 10; i++) {
    // Alternate early/late callbacks around the nominal refresh boundary.
    const now = i * 1000 / displayHz + (i % 2 ? .15 : -.15)
    const next = songChartFrameTime(previous, now, targetHz)
    if (next !== null) { previous = next; paints++ }
  }
  assert.ok(Math.abs(paints - targetHz * 10) <= 1, `${displayHz} Hz display / ${targetHz} Hz target: ${paints}`)
}
assert.equal(songChartFrameTime(null, 5000, 60), 5000, 'resume paints immediately')
assert.equal(songChartFrameTime(0, 8, 60), null, '120 Hz callback is skipped')
const resumed = songChartFrameTime(0, 5010, 60)
assert.ok(resumed > 4990 && resumed <= 5010.5, 'late frame skips missed deadlines')
assert.equal(songChartFrameTime(resumed, 5011, 60), null, 'no catch-up burst')
console.log('Chart frame clock: 30/60 Hz cadence on 60/90/120/144 Hz displays, jitter, resume and stalls passed')
