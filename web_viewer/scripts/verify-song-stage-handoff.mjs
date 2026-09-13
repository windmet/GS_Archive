import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createSongStageHandoff, resolveSongStageHandoff } from '../src/core/songStageHandoff.js'

const json = path => JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'))
const song = json('assets/live-chibi/choreography/index.json').songs.find(entry => entry.id === 'drvalv_live_effect')
const characters = json('assets/live-chibi/manifest.json').characters
const audioExperiment = json('data/song_experimental_audio.json').songs.drvalv
assert.ok(song && characters.length >= 5 && audioExperiment)
const idols = Object.keys(audioExperiment.solo_tracks).slice(0, 5)
const handoff = createSongStageHandoff({
  songCode: 'drvalv', arrangement: song, stageLineup: [idols[0], '', idols[2], idols[2], idols[4]],
  audioExperiment, vocalGain: 0.7, backingGain: 0.4, sourceTimeSeconds: 42.5,
})
assert.ok(handoff)
assert.equal(handoff.resumePolicy, 'restart-at-zero')
assert.deepEqual(handoff.positions.map(entry => [entry.performerSlot, entry.stagePosition]),
  [[1, 3], [2, 2], [3, 4], [4, 1], [5, 5]])
const resolved = resolveSongStageHandoff(handoff, song, characters)
assert.deepEqual(resolved.stageLineup, [idols[0], '', idols[2], idols[2], idols[4]])
assert.equal(resolved.sourceTimeSeconds, 42.5)
assert.equal(resolved.vocalGain, 0.7)
assert.equal(resolveSongStageHandoff({ ...handoff, choreographyId: 'other' }, song, characters), null)
assert.equal(resolveSongStageHandoff({ ...handoff, positions: handoff.positions.map((entry, index) => index === 0 ? { ...entry, stagePosition: 2 } : entry) }, song, characters), null)
assert.equal(createSongStageHandoff({ songCode: 'drvalv', arrangement: { ...song, stagePositionMap: [] }, stageLineup: idols, audioExperiment }), null)
assert.equal(createSongStageHandoff({ songCode: 'drvalv', arrangement: song, stageLineup: ['missing', ...idols.slice(1)], audioExperiment }), null)
assert.equal(createSongStageHandoff({ songCode: 'drvalv', arrangement: song, stageLineup: Array(5).fill(''), audioExperiment }), null)
console.log('Song stage handoff: five mapped performer slots, empty/duplicate idols, gains, restart and mismatch verified')
