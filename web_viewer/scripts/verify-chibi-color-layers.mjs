import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { colorLayersAt } from '../src/core/chibiColorLayers.js'

const events = [
  {time:0,id:1,color:'#000000',opacity:1000,duration:100,depth:1500},
  {time:0,id:2,color:'#ffffff',opacity:500,duration:1,depth:1710},
  {time:50,id:1,color:'#ffffff',opacity:0,duration:100},
  {time:150,id:2,hide:true,duration:100},
  {time:300,id:1,color:'#FF0000',opacity:1000,duration:100,depth:1600},
]
const at100 = colorLayersAt(events, 100)
assert.equal(at100.size, 2)
assert.equal(at100.get(1).alpha, .25) // interrupted transition starts at .5
assert.equal(at100.get(1).color, 0x808080)
assert.equal(at100.get(1).depth, 1500)
assert.equal(at100.get(2).alpha, .5)
assert.equal(colorLayersAt(events, 200).get(2).alpha, .25)
assert.equal(colorLayersAt(events, 251).get(2).alpha, 0)
assert.equal(colorLayersAt(events, -1).size, 0)
assert.equal(colorLayersAt(events, 400).get(1).color, 0xff0000)
assert.equal(colorLayersAt(events, 400).get(1).depth, 1600)
assert.deepEqual(colorLayersAt(events, 100), at100) // backwards seek, independent of play history
assert.equal(colorLayersAt([]).size, 0) // older packages / switching to another song
assert.equal(colorLayersAt([{time:0,id:null,hide:true}], 0).size, 0) // do not guess unaddressed hides
assert.equal(colorLayersAt([{time:0,id:1,color:'#ffffff',opacity:0,duration:0}], 0).get(1).alpha, 0)
const fixture = JSON.parse(readFileSync(new URL('./fixtures/chibi-color-planes-anywhere.json', import.meta.url), 'utf8'))
assert.equal(fixture.source.songId, 'anwhre_live_effect')
assert.equal(fixture.events.length, 60)
assert.deepEqual([...colorLayersAt(fixture.events, 0)].map(([id, state]) => [id,state.depth,state.alpha]),
  [[1,1500,.7],[2,1600,.5],[3,1710,.3]])
assert.equal(colorLayersAt(fixture.events, 8600).get(1).alpha, .5)
assert.equal(colorLayersAt(fixture.events, 8600).get(3).alpha, .15)
assert.equal(colorLayersAt(fixture.events, 9400).get(3).alpha, 0)
if (process.argv.includes('--published-assets')) {
  const index = JSON.parse(readFileSync(new URL('../public/assets/live-chibi/choreography/index.json', import.meta.url), 'utf8'))
  assert.deepEqual(index.songs.find(song => song.id === fixture.source.songId).wholeScreenColorLayerEvents, fixture.events)
  const records = index.songs.flatMap(song => song.wholeScreenColorLayerEvents || [])
  assert.equal(records.length, index.stats.wholeScreenColorLayerEvents)
  assert.equal(records.length, 975)
  assert.equal(records.filter(event => event.unresolvedReason).length, 1)
  for (const song of index.songs) {
    const entries = song.wholeScreenColorLayerEvents || []
    assert.deepEqual(entries.map(e => e.time), [...entries].map(e => e.time).sort((a,b) => a-b))
    const forward = colorLayersAt(entries, song.duration || 100000)
    colorLayersAt(entries, 0)
    assert.deepEqual(colorLayersAt(entries, song.duration || 100000), forward)
  }
  console.log('Published color planes: 118 exact arrangements, 975 records, 1 unresolved identity retained')
}
console.log('Color planes: independent IDs/depths, interruption, hide fades, zero opacity and deterministic seeks passed')
