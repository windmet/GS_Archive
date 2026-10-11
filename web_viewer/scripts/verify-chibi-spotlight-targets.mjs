import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectChibiGround } from '../src/core/chibiStageCoordinates.js'

// Execute the real SFC sampler/target resolver/synchronizer. The fixture binds
// exact RAW rows to parsed events, but does not claim native free-position math.
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-timeline.json', import.meta.url), 'utf8'))
for (const song of Object.values(fixture.songs)) {
  const fields = Object.fromEntries(song.header.map((name, index) => [name, index]))
  const rows = new Map(song.raw.map(row => [`${row[fields.time]}:${row[fields.value1]}`, row]))
  assert.equal(rows.size, song.events.length)
  for (const event of song.events) {
    const row = rows.get(`${event.time}:${event.id}`)
    assert.ok(row, 'Event must have an exact RAW time and lamp ID')
    assert.equal(event.hide, row[fields.value101] === '1')
    const duration = row[fields[event.hide ? 'value102' : 'value4']]
    assert.equal(event.duration, duration === '' ? 1 : Number(duration), 'Authored field must not be silently converted into free Y')
    assert.equal(event.stagePosition === null || event.stagePosition === undefined,
      event.targetSlot === null || event.targetSlot === 0)
  }
}
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const section = source.slice(source.indexOf('function spotlightStatesAt('), source.indexOf('function laserlightStatesAt('))
assert.ok(section.includes('function spotlightTargetAt('))
const ref = value => ({ value })
const selectedSong = ref({ songCode: 'steqmg', spotlightEvents: fixture.songs.steqmg.events })
const time = ref(0), enabled = ref(true), ids = ref([]), count = ref(0), unresolved = ref([])
const runtimes = new Map(), calls = []
const store = {
  ensure(id, model) {
    calls.push(id)
    if (!model) return null
    if (!runtimes.has(id)) runtimes.set(id, {
      container: { position: { set(x, y) { this.x = x; this.y = y } }, scale: { set(value) { this.value = value } } },
      sprites: [{}, {}],
    })
    return runtimes.get(id)
  },
  release() { runtimes.clear() },
}
const coordinates = new Map([[2, { x: -350, y: 270 }], [3, { x: 0, y: 140 }], [4, { x: 350, y: 230 }]])
const layout = position => coordinates.get(position)
const resources = ref({ spotlight: { layers: [] }, assets: {} })
const sampler = new Function('selectedSong', 'layoutCoordinatesForStage', 'app', 'cameraContainer',
  'stageTime', 'beamEffectsEnabled', 'visibleSpotlightIds', 'visibleSpotlightCount',
  'unresolvedSpotlightIds', 'spotlightRuntimes', 'spotlightSprites', 'stageEffectIndex',
  'projectChibiGround', 'parseHexColor', section + '\nreturn { sample: spotlightStatesAt, target: spotlightTargetAt, sync: syncSpotlights, release: releaseSpotlights }')(
  selectedSong, layout, { renderer: { width: 1280, height: 720, resolution: 1 } }, {},
  time, enabled, ids, count, unresolved, runtimes, store, resources, projectChibiGround,
  color => Number.parseInt(color.slice(1), 16))
function seek(milliseconds) { time.value = milliseconds; sampler.sync() }
seek(13700)
assert.deepEqual(ids.value, [20, 21, 22])
assert.deepEqual(unresolved.value, [])
assert.equal(count.value, 3)
seek(20500)
assert.deepEqual(ids.value, [2])
assert.deepEqual(unresolved.value, [1])
seek(32500)
assert.deepEqual(ids.value, [3], 'New right spotlight replaces the former bound lamp')
assert.deepEqual(unresolved.value, [1, 2], 'No invented centre or overlapping pool for unbound lamps')
assert.equal(runtimes.get(2).container.visible, false, 'A previously loaded bound sprite hides when its target is cleared')
assert.equal(runtimes.has(1), false, 'Unresolved geometry must not load a fabricated lamp')
assert.deepEqual(calls.includes(1), false)
const right = projectChibiGround('steqmg', coordinates.get(4), 1280, 720)
assert.equal(runtimes.get(3).container.position.x, right.x)
assert.equal(runtimes.get(3).container.position.y, right.y)
assert.equal(runtimes.get(3).sprites[0].tint, 0xf1e83d)
assert.equal(sampler.sample(32500).get(1).environmentOpacity, 400, 'Environment command survives the unresolved geometry')
for (const milliseconds of [13700, 32500, 20500, 32500]) {
  seek(milliseconds)
  assert.deepEqual(ids.value, milliseconds === 13700 ? [20, 21, 22] : milliseconds === 20500 ? [2] : [3])
}
enabled.value = false
seek(32500)
assert.deepEqual(ids.value, [])
assert.deepEqual(unresolved.value, [])
assert.ok([...runtimes.values()].every(runtime => !runtime.container.visible))
enabled.value = true
seek(32500)
assert.deepEqual(ids.value, [3])
seek(49301)
assert.equal(count.value, 0, 'Actual authored hide duration expires')
assert.deepEqual(unresolved.value, [])
resources.value.spotlight = null
seek(13700)
assert.equal(count.value, 0, 'Unavailable native resources are not counted as rendered sprites')
assert.ok([...runtimes.values()].every(runtime => !runtime.container.visible))
assert.equal(sampler.target({ stagePosition: 0, x: 350 }, 0), null)
assert.equal(sampler.target({ stagePosition: 99 }, 0), null)
coordinates.set(2, { x: NaN, y: 270 })
assert.equal(sampler.target({ stagePosition: 2 }, 0), null)
sampler.release()
assert.deepEqual(ids.value, [])
assert.deepEqual(unresolved.value, [])
assert.equal(runtimes.size, 0)
console.log('Exact RAW Spotlight identities, real SFC target clearing, Study handoffs, seek/toggle/hide and resource counts passed; free geometry remains unresolved')
