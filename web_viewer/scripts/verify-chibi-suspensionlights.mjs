import assert from 'node:assert/strict'
import fs from 'node:fs'
import { newSuspensionlightsAt, suspensionlightLayout } from '../src/core/chibiSuspensionlights.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-suspensionlight-ending.json', import.meta.url)))
const at = t => newSuspensionlightsAt(fixture.events, t)
const visible = t => at(t).filter(s => s.alpha > .001)
assert.equal(at(108349).length, 0)
assert.equal(visible(108350).length, 0)
assert.deepEqual(visible(110350).map(s => s.id), [10047,10049,10051,10053,10055])
assert.equal(at(109350)[0].alpha, .4)
assert.equal(at(111000)[0].alpha, .8)
assert.equal(at(115500)[0].alpha, .4)
assert.equal(visible(117000).length, 0) // End of first complete envelope.
assert.deepEqual(at(111000), at(111000)) // Pure clock sampling, no frame accumulation.
assert.equal(at(109350)[0].alpha, .4) // Backward seek after a later sample.
const event = (time, command, values, erase = false) => ({time,command,id:10047,values,erase})
const base = fixture.events.filter(e => e.id === 10047)
const withUnknown = [...base,event(111100,'NewSuspensionlight_rotateanim',[])]
assert.equal(newSuspensionlightsAt(withUnknown,111100)[0].alpha,0)
assert.equal(newSuspensionlightsAt([...base,event(111100,'NewSuspensionlight_create',[],true)],111100).length,0)
const recreated = [...withUnknown,event(111200,'NewSuspensionlight_create',base[0].values)]
assert.equal(newSuspensionlightsAt(recreated,111200)[0].alpha,0) // Reused ID needs a new show.
recreated.push(event(111300,'NewSuspensionlight_normal_show',base[1].values))
assert.equal(newSuspensionlightsAt(recreated,113300)[0].alpha,.8)
const wide = suspensionlightLayout(at(111000)[1],1280,720)
const narrow = suspensionlightLayout(at(111000)[1],640,360)
assert.equal(narrow.x,wide.x/2)
assert.equal(narrow.y,wide.y/2)
assert.equal(narrow.scaleY,wide.scaleY/2)
const status = buildStageVfxCoverage({id:'ending',backmonitorEvents:[{rotation:1}]},
  {stageEffects:{newSuspensionlightSongs:{ending:{events:withUnknown}}}})
assert.equal(status.sourceEvents.newSuspensionlight,3)
assert.equal(status.newSuspensionlightUnimplementedCommands,1)
assert.equal(status.backmonitorLogoRequests,1)
assert.equal(status.status,'partial')
if (process.argv.includes('--published-assets')) {
  const index = JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
  assert.equal(Object.keys(index.newSuspensionlightSongs).length,19)
  assert.equal(Object.values(index.newSuspensionlightSongs).reduce((n,s)=>n+s.eventCount,0),60358)
  assert.deepEqual(index.newSuspensionlightSongs.tkstp1_live_effect.source,fixture.source)
  for (const code of ['tkstp1','tkstp2']) {
    const descriptor = index.newSuspensionlightSongs[`${code}_live_effect`]
    const track = JSON.parse(fs.readFileSync(new URL(`../public/assets/live-chibi/${descriptor.file}`,import.meta.url)))
    assert.equal(track.events.length,descriptor.eventCount)
    if (code === 'tkstp1') assert.deepEqual(track.events.filter(e=>[10047,10049,10051,10053,10055].includes(e.id)),fixture.events)
    assert.equal(newSuspensionlightsAt(track.events,111000).filter(s=>s.id>=10047 && s.id<=10055 && s.alpha>.001).length,5)
    assert.equal(newSuspensionlightsAt(track.events,108300).filter(s=>s.id>=10047 && s.id<=10055 && s.alpha>.001).length,0)
  }
  assert.equal(index.newSuspensionlight.layers[0].texturePathId,'834')
  assert.equal(index.newSuspensionlight.layers[0].anchorY,0)
  assert.equal(index.assets.new_suspension_light_sample.width,1024)
}
console.log('PASS suspension ending: fades, seek, erase/reuse, unknown-control suppression, proportional projection, honest coverage')
