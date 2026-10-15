// Center-line (Unit_serif oneshot) contract: manifest vs song catalog, trigger cursor
// semantics, and that the stage viewer drives the slot from its playback hooks.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ONESHOT_CENTER,
  ONESHOT_OFF,
  oneshotCursorAt,
  resolveOneshotIdol,
  validateOneshotManifest,
} from '../src/composables/useStageOneshotVoice.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = path => readFileSync(join(root, path), 'utf8')
const manifest = validateOneshotManifest(JSON.parse(read('public/data/song_oneshot_voices.json')))
const catalog = JSON.parse(read('public/data/song_catalog.json'))

const oneshotSongs = Object.entries(catalog.songs).filter(([, song]) => song.audio_form === 'oneshot').map(([code]) => code).sort()
assert.deepEqual(Object.keys(manifest.songs).sort(), oneshotSongs, 'manifest covers exactly the oneshot songs')
assert.equal(manifest.rule.selector, 'deck_slot')
assert.ok(manifest.rule.evidence.some(line => line.includes('0x19C6B28')), 'Unit_serif executor RVA recorded')

const expectedTriggers = { flslgt: 35550, pcuslv: 60000 }
for (const code of oneshotSongs) {
  const song = manifest.songs[code]
  const idols = catalog.songs[code].audio.oneshot_idol_codes
  assert.deepEqual(Object.keys(song.clips).sort(), [...idols].sort(), `${code}: one clip per catalogued idol`)
  assert.deepEqual(song.triggers.map(trigger => trigger.time_ms), [expectedTriggers[code]], `${code}: trigger time`)
  for (const trigger of song.triggers) {
    assert.equal(trigger.deck_slot, 1, `${code}: center card slot`)
    assert.equal(trigger.cue_prefix, `song3_${code}_oneshot_`)
  }
  for (const [idol, clip] of Object.entries(song.clips)) {
    assert.equal(clip.cue, `song3_${code}_oneshot_${idol}`)
    assert.equal(clip.url, `/assets/live-chibi/oneshot/${code}/${idol}.m4a`)
    assert.match(clip.sha256, /^[0-9a-f]{64}$/)
    assert.ok(clip.duration_seconds > 2 && clip.duration_seconds < 6, `${code}/${idol}: one short spoken line`)
    // Media is R2-deployed and ignored by git; check hashes only where a local copy exists.
    const local = join(root, 'public', clip.url)
    if (existsSync(local)) assert.equal(readFileSync(local).length, clip.bytes, `${code}/${idol}: local clip size`)
  }
}
assert.equal(manifest.songs.pcuslv.triggers[0].rows, 2, 'duplicate precious love CSV row collapses to one trigger')

const triggers = [{ time_ms: 35550 }]
assert.equal(oneshotCursorAt(triggers, 0, 4444), 0)
assert.equal(oneshotCursorAt(triggers, 37000, 4444), 0, 'seek into the line resumes it')
assert.equal(oneshotCursorAt(triggers, 40000, 4444), 1, 'seek past the line skips it')
assert.equal(oneshotCursorAt(triggers, 36000, 0), 1, 'nothing selected never fires')

const clips = { '001tom': {}, '048mom': {} }
assert.equal(resolveOneshotIdol(ONESHOT_CENTER, '048mom', clips), '048mom')
assert.equal(resolveOneshotIdol(ONESHOT_CENTER, '', clips), '')
assert.equal(resolveOneshotIdol(ONESHOT_CENTER, 'xxx', clips), '', 'center without a cue stays silent')
assert.equal(resolveOneshotIdol('001tom', '048mom', clips), '001tom')
assert.equal(resolveOneshotIdol(ONESHOT_OFF, '048mom', clips), '')

const viewer = read('src/components/ChibiStageViewer.vue')
for (const hook of [
  'stageOneshot.start(stageTime.value)',
  'stageOneshot.update(stageTime.value)',
  'stageOneshot.stop()',
  'stageOneshot.setPlaybackRate(playbackSpeed.value)',
  'stageOneshot.release()',
  'stagePositionForPerformerSlot(1)',
]) assert.ok(viewer.includes(hook), `stage viewer wires ${hook}`)
assert.match(viewer, /v-if="oneshotAvailable" class="lineup-oneshot"/)

console.log(`song oneshot voices: ${oneshotSongs.length} songs, ${oneshotSongs.reduce((n, code) => n + Object.keys(manifest.songs[code].clips).length, 0)} clips ok`)
