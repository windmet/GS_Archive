import assert from 'node:assert/strict'
import fs from 'node:fs'
import { newSuspensionlightsAt, suspensionlightLayout } from '../src/core/chibiSuspensionlights.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-suspensionlight-ending.json', import.meta.url)))
const at = t => newSuspensionlightsAt(fixture.events, t)
const visible = t => at(t).filter(s => s.alpha > .001)
const close = (actual, expected) => assert.ok(Math.abs(actual-expected)<1e-10, `${actual} != ${expected}`)
assert.equal(at(108349).length, 0)
assert.equal(visible(108350).length, 0)
assert.deepEqual(visible(110350).map(s => s.id), [10047,10049,10051,10053,10055])
close(at(109350)[0].alpha, .6)
assert.equal(at(111000)[0].alpha, .8)
close(at(115500)[0].alpha, .2)
assert.equal(visible(117000).length, 0) // End of first complete envelope.
assert.deepEqual(at(111000), at(111000)) // Pure clock sampling, no frame accumulation.
close(at(109350)[0].alpha, .6) // Backward seek after a later sample.
assert.equal(at(118000)[0].alpha, 0) // value6=99999 is the OFF wait, not a repeat count.
close(at(217999)[0].alpha, .6) // Infinite repeat includes the full OFF wait.
const event = (time, command, values, erase = false) => ({time,command,id:10047,values,erase})
const base = fixture.events.filter(e => e.id === 10047)
const withUnknown = [...base,event(111100,'NewSuspensionlight_coloranim',[])]
assert.equal(newSuspensionlightsAt(withUnknown,111100)[0].alpha,0)
assert.equal(newSuspensionlightsAt([...base,event(111100,'NewSuspensionlight_create',[],true)],111100).length,0)
const recreated = [...withUnknown,event(111200,'NewSuspensionlight_create',base[0].values)]
assert.equal(newSuspensionlightsAt(recreated,111200)[0].alpha,0) // Reused ID needs a new show.
recreated.push(event(111300,'NewSuspensionlight_normal_show',base[1].values))
assert.equal(newSuspensionlightsAt(recreated,113300)[0].alpha,.8)
// Native channels run concurrently; a later control captures the in-flight
// value and kills only its own predecessor, never the whole beam.
const create = event(0,'NewSuspensionlight_create',['10047','new_suspension_light_sample','800','1000','2000','10','0','0','#ffffff','1650'])
const show = event(0,'NewSuspensionlight_normal_show',['10047','0','0','10000','1000','3000'])
const rotate = event(0,'NewSuspensionlight_rotateanim',['10047','3','90','1000','500','1000','500','0'])
const scale = event(0,'NewSuspensionlight_scaleanim',['10047','2000','4000','1000','0','1000','0','2'])
const fade = event(0,'NewSuspensionlight_fade',['10047','400','1000','0','1000','0','2'])
const controls = [create,show,rotate,scale,fade]
const sample = (t, events=controls) => newSuspensionlightsAt(events,t)[0]
assert.equal(sample(500).angle,50)
assert.equal(sample(500).scaleX,1.75)
assert.equal(sample(500).scaleY,3.5)
assert.ok(Math.abs(sample(500).alpha-.5)<1e-12)
assert.equal(sample(2000).angle,50) // Return leg, including the first hold.
assert.equal(sample(3000).angle,10) // Restart after both waits.
const interrupted = [...controls,event(500,'NewSuspensionlight_rotateanim',['10047','1','130','1000','0','0','0','1'])]
assert.ok(Math.abs(sample(1000,interrupted).angle-90)<1e-10) // InOutSine midpoint from captured 50.
assert.equal(sample(1000,interrupted).scaleX,2)
assert.ok(sample(1000,interrupted).alpha>0)
// A completed one-shot fade kills show; a subsequent show can restart it.
const stop = [create,show,event(500,'NewSuspensionlight_fade',['10047','400','1000','0','0','0','1'])]
assert.equal(sample(12000,stop).alpha,.4)
const delayed = [...stop,event(12000,'NewSuspensionlight_normal_show',['10047','1000','1000','1000','1000','1000'])]
assert.equal(sample(12500,delayed).alpha,.4) // DelayedCall retains the frozen multiplier.
assert.equal(sample(13000,delayed).alpha,0)
assert.ok(Math.abs(sample(13500,delayed).alpha-.3)<1e-12)
const erasing = [...controls,{...event(500,'NewSuspensionlight_create',[],true),extraValues:{value101:'1',value102:'1000'}}]
assert.ok(sample(1000,erasing).alpha>0)
assert.equal(newSuspensionlightsAt(erasing,1500).length,0)
const reuse = [...erasing,{...create,time:1100}, {...show,time:1100}]
assert.equal(sample(1600,reuse).alpha,.8) // Old erase callback cannot delete a new generation.
const cancelledErase = [...erasing,event(1000,'NewSuspensionlight_fade',['10047','800','1000','0','0','0','1'])]
assert.equal(newSuspensionlightsAt(cancelledErase,2000).length,1)
assert.equal(newSuspensionlightsAt([create,rotate],500)[0].alpha,0) // Rotate does not activate.
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
  let corpusEvents = 0
  for (const [song, descriptor] of Object.entries(index.newSuspensionlightSongs)) {
    const track = JSON.parse(fs.readFileSync(new URL(`../public/assets/live-chibi/${descriptor.file}`,import.meta.url)))
    corpusEvents += track.events.length
    for (const time of [0,6000,26500,112900,200000]) {
      for (const s of newSuspensionlightsAt(track.events,time)) {
        for (const field of ['alpha','angle','scaleX','scaleY']) assert.ok(Number.isFinite(s[field]),`${song} ${s.id} ${field}`)
        assert.ok(s.alpha>=0 && s.alpha<=1)
      }
    }
    if (song === 'gofrit_live_effect') {
      const s = newSuspensionlightsAt(track.events,6000).find(s=>s.id===410)
      close(s.angle,50-60*(1-Math.cos(Math.PI*500/2250))/2)
      assert.equal(s.alpha,1)
    }
    if (song === 'plmask_live_effect') {
      const s = newSuspensionlightsAt(track.events,112400).find(s=>s.id===70001)
      close(s.scaleX,1.192)
      assert.equal(s.alpha,1)
      assert.ok(!newSuspensionlightsAt(track.events,114600).some(s=>s.id===70001))
    }
  }
  assert.equal(corpusEvents,60358)
}
console.log('PASS suspension: native envelopes/off waits, concurrent rotate/scale/fade, interruption, delayed show, erase/reuse, seek and coverage')
