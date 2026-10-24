import assert from 'node:assert/strict'
import { createSongChartPlaybackCadence } from '../src/presentation/SongChartPlaybackCadence.js'

for (const hz of [60, 90, 120, 144]) for (const perspective of [true, false]) {
  const track = [], controls = []
  const cadence = createSongChartPlaybackCadence({ track: x => track.push(x), controls: x => controls.push(x) })
  for (let i = 0; i < hz * 10; i++) cadence.paint(i * 1000 / hz, 12 + i / hz * 1.5, perspective)
  assert.ok(Math.abs(track.length - (perspective ? 600 : 300)) <= 1)
  assert.ok(Math.abs(controls.length - (perspective ? 100 : 300)) <= 1)
  assert.equal(track[0], 12)
  assert.ok(track.at(-1) > 26.9, 'samples actual 1.5x media time')
  cadence.sync(3.125)
  assert.equal(track.at(-1), 3.125, 'backward seek updates track immediately')
  assert.equal(controls.at(-1), 3.125, 'seek bypasses transport throttle')
  cadence.paint(11000, 3.125, perspective)
  assert.equal(track.at(-1), controls.at(-1), 'resume publishes frozen media position')
  cadence.paint(11001, 3.125, !perspective)
  assert.equal(track.at(-1), controls.at(-1), 'view change starts with a common position')
  cadence.sync(117.313)
  assert.equal(track.at(-1), controls.at(-1), 'exact final position reaches both consumers')
}
console.log('Playback cadence: track 60 / transport 10 Hz; long chart 30 Hz, seeks, pause/end sync, mode changes and media-rate sampling passed')
