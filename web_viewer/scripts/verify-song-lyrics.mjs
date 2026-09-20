import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { authoredSongLyrics, activeSongLyric, sharesSongAudio } from '../src/utils/songLyrics.js'

const fixture = { songCode: 'fixture', timeUnit: 'ms', audioRef: { url: '/fixture.m4a' }, lyricEvents: [
  { time: 1000, duration: 10000, text: 'first' },
  { time: 2000, duration: 2000, text: 'second' },
  { time: 3000, duration: 500, text: '' },
  { time: 5000, duration: 500, text: 'last' },
] }
const lines = authoredSongLyrics(fixture, 'fixture')
for (const [time, expected] of [[0, null], [1, 0], [1.999, 0], [2, 1], [3, null], [5, 3], [5.5, null], [2.1, 1], [0, null]]) {
  assert.equal(activeSongLyric(lines, time), expected, `seek/clear/interval at ${time}`)
}
assert.equal(activeSongLyric(lines, NaN), null)
assert.deepEqual(authoredSongLyrics(fixture, 'another-song'), [])
assert.equal(sharesSongAudio(fixture, 'fixture', '/fixture.m4a'), true)
assert.equal(sharesSongAudio(fixture, 'fixture', '/external-release.m4a'), false)
assert.equal(sharesSongAudio(fixture, 'another-song', '/fixture.m4a'), false)

const manifest = JSON.parse(readFileSync(new URL('../public/data/song_timelines/manifest.json', import.meta.url)))
let songs = 0, count = 0
for (const [songCode, entries] of Object.entries(manifest.songs)) {
  const base = entries.find(entry => !entry.variant)
  if (!base) continue
  const timeline = JSON.parse(readFileSync(new URL(`../public${base.url}`, import.meta.url)))
  const actual = authoredSongLyrics(timeline, songCode)
  for (const line of actual) {
    assert.equal(line.time, timeline.lyricEvents[line.index].time, 'authored timestamps are unchanged')
    assert.ok(line.end >= line.time)
    assert.equal(sharesSongAudio(timeline, songCode, timeline.audioRef?.url), Boolean(timeline.audioRef?.url))
  }
  count += actual.length
  songs++
}
console.log(`Song lyrics: interval/seek/gap/audio identity and ${songs} authored song timelines (${count} lines) passed`)
