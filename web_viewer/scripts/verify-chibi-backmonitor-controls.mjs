import assert from 'node:assert/strict'
import fs from 'node:fs'
import { chibiBackmonitorStateAt } from '../src/core/chibiBackmonitorCoordinates.js'
const fixtures=JSON.parse(fs.readFileSync(new URL('fixtures/chibi-backmonitor-apertures.json',import.meta.url),'utf8'))
for (const fixture of fixtures) {
  for (const event of fixture.events) {
    const state=chibiBackmonitorStateAt(fixture.events,event.time)
    assert.equal(state.movie,event.movie)
    assert.equal(state.rawValue7,event.rawValue7)
  }
}

const events = [
  {time:-2000,movie:'first',x:-100,y:270,scale:1800,rawValue6:0,rawValue7:0},
  {time:6000,movie:'second',transition:'blackout',rawValue7:1100},
  {time:8800,movie:'third',rawValue7:null},
]
assert.equal(chibiBackmonitorStateAt(events,1000).rawValue7,0)
assert.equal(chibiBackmonitorStateAt(events,7000).rawValue7,1100)
assert.equal(chibiBackmonitorStateAt(events,9000).rawValue7,1100)
assert.equal(chibiBackmonitorStateAt(events,9000).transition,null)
assert.equal(chibiBackmonitorStateAt(events,1000).movie,'first')
assert.equal(chibiBackmonitorStateAt([{time:0,movie:'legacy',opacity:0,rotation:1}],0).rawValue7,0)
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
assert.ok(source.includes('backmonitorSprite.alpha = 1'))
assert.ok(!source.includes('state.opacity / 1000'))
assert.ok(source.includes('v-if="!hasAuthoredStage" class="stage-backdrop"'))
if (process.argv.includes('--published-assets')) {
  const songs=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')).songs
  const chance=songs.find(s=>s.songCode==='cgtocc')
  assert.equal(chance.backmonitorEvents.length,14)
  for (const event of chance.backmonitorEvents) {
    const state=chibiBackmonitorStateAt(chance.backmonitorEvents,event.time)
    assert.ok(state.movie);assert.equal(state.rawValue7,0)
  }
}
console.log('Backmonitor zero controls, legacy indexes, rewind, transition reset and authored-stage fallback passed')
