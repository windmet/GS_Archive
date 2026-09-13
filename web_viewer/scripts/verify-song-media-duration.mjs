import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const songs = JSON.parse(readFileSync(new URL('../public/data/song_playback_audio.json', import.meta.url), 'utf8')).songs
let largestDeltaSeconds = 0
for (const [code, song] of Object.entries(songs)) {
  const file = fileURLToPath(new URL(`../public/assets/live-chibi/music/${code}.m4a`, import.meta.url))
  assert.ok(existsSync(file), `${code}: derived M4A is missing`)
  const actual = Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', file,
  ], { encoding: 'utf8' }).trim())
  const sourceDuration = song.source.samples / song.source.sample_rate
  assert.ok(Number.isFinite(actual) && actual > 0, `${code}: invalid container duration`)
  assert.ok(Math.abs(sourceDuration - song.source.duration_seconds) < 0.002, `${code}: source duration metadata drifted`)
  const delta = Math.abs(actual - sourceDuration)
  largestDeltaSeconds = Math.max(largestDeltaSeconds, delta)
  assert.ok(delta < 0.02, `${code}: M4A container differs from source sample duration by ${delta}s`)
}
console.log(`Song media duration: ${Object.keys(songs).length} M4A containers readable; max source/sample delta ${(largestDeltaSeconds * 1000).toFixed(2)}ms (metadata only, not lyric sync)`)
