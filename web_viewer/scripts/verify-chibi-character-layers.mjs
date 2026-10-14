import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spotlightSortOffsetsAt, spotlightBackgroundOrderAt } from '../src/core/chibiCharacterLayers.js'

const events = [
  { time: 10, id: 1, stagePosition: 2 },
  { time: 20, id: 1, stagePosition: 3 },
  { time: 30, id: 2, stagePosition: 3 },
  { time: 40, id: 1, hide: true, duration: 1000 },
  { time: 50, id: 2, stagePosition: 0 },
]
const at = t => spotlightSortOffsetsAt(events, t)
assert.equal(at(9).size, 0)
assert.equal(at(10).get(2), 250)
assert.equal(at(20).get(2), 0, 'Switching target resets the old idol')
assert.equal(at(20).get(3), 250)
assert.equal(at(40).get(3), 0, 'Hide resets immediately, even while fading or another lamp shares the idol')
assert.equal(at(50).get(3), 0)
assert.equal(at(50).has(0), false, 'Free targets must never lift an unrelated actor')
assert.equal(at(10).get(2), 250, 'Backward seek rebuilds offsets')

// Execute the actual renderer consumer, including base-order changes, shadow
// follow and the lighting toggle. Pinspotlight intentionally does not lift idols.
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const song = { value: { spotlightEvents: events, pinspotlightEvents: [{ time: 0, stagePosition: 4 }] } }
const time = { value: 20 }, enabled = { value: true }
const runtimes = new Map([2, 3, 4].map(p => [p, { spine: {}, groundShadow: {} }]))
let base = 1700
const sync = new Function('lightingEnabled', 'selectedSong', 'stageTime', 'spotlightSortOffsetsAt',
  'runtimes', 'layoutCoordinatesForStage', 'syncCharacterShadow',
  source.match(/function syncCharacterLayers\([^]*?\n\}/)[0] + '; return syncCharacterLayers')(
  enabled, song, time, spotlightSortOffsetsAt, runtimes, () => ({ sortingOrder: base }),
  r => { r.groundShadow.zIndex = r.spine.zIndex - 10 })
sync()
assert.equal(runtimes.get(2).spine.zIndex, 1700)
assert.equal(runtimes.get(3).spine.zIndex, 1950)
assert.equal(runtimes.get(3).groundShadow.zIndex, 1940)
assert.equal(runtimes.get(4).spine.zIndex, 1700, 'Pinspotlight relies on its mask, not +250')
base = 2600; sync(); assert.equal(runtimes.get(3).spine.zIndex, 2850)
enabled.value = false; sync(); assert.equal(runtimes.get(3).spine.zIndex, 2600)
enabled.value = true; time.value = 40; sync(); assert.equal(runtimes.get(3).spine.zIndex, 2600)
time.value = 10; sync(); assert.equal(runtimes.get(2).spine.zIndex, 2850)

// Published Study commands witness the same lifecycle without invented cues.
const index = JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json', import.meta.url)))
const study = index.songs.find(s => s.id === 'steqmg_live_effect')
const show = study.spotlightEvents.find(e => !e.hide && e.stagePosition > 0)
assert(show)
assert.equal(spotlightSortOffsetsAt(study.spotlightEvents, show.time).get(show.stagePosition), 250)
assert(source.includes('function applyStageLighting() {\n  syncCharacterLayers()'))
assert.equal(spotlightBackgroundOrderAt({}, 0),1900)
const depths={spotlightEvents:[{time:10,depth:0},{time:30,hide:true,depth:9999}],pinspotlightEvents:[{time:20,depth:2300}]}
assert.equal(spotlightBackgroundOrderAt(depths,10),0)
assert.equal(spotlightBackgroundOrderAt(depths,30),2300)
assert.equal(spotlightBackgroundOrderAt(depths,10),0)
console.log('PASS native Spotlight +250/reset lifecycle, shared-target writes, base order, shadows, toggle, seek and published Study witness')
