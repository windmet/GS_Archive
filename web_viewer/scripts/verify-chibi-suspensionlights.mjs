import assert from 'node:assert/strict'
import fs from 'node:fs'
import { newSuspensionlightsAt, suspensionlightLayout, constantSuspensionTempo, attachNativeSuspensionSprites, suspensionlightModelForAsset } from '../src/core/chibiSuspensionlights.js'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-suspensionlight-ending.json', import.meta.url)))
const spriteData = JSON.parse(fs.readFileSync(new URL('../public/data/stage-new-suspension-sprites.json',import.meta.url)))
// Exercise source binding and failure behavior without a local asset corpus.
const mockIndex = {assets:{},newSuspensionlight:{layers:[{asset:'new_suspension_light_sample',scaleX:1,scaleY:1}]}}
const bound = attachNativeSuspensionSprites(mockIndex,spriteData,spriteData.stageEffectIndexSha256)
assert.equal(suspensionlightModelForAsset(bound,'new_suspension_light_sample'),mockIndex.newSuspensionlight)
assert.equal(suspensionlightModelForAsset(bound,'unknown'),null)
assert.equal(suspensionlightModelForAsset(bound,'constructor'),null)
for (const [name,sprite] of Object.entries(spriteData.sprites)) {
  const model=suspensionlightModelForAsset(bound,name)
  assert.equal(model.layers[0].asset,name)
  assert.equal(model.layers[0].anchorX,sprite.source.geometry.pivot.x)
  assert.equal(model.layers[0].anchorY,sprite.source.geometry.pivot.y)
  const bytes=fs.readFileSync(new URL('../public'+sprite.file,import.meta.url))
  assert.equal(bytes.length,sprite.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sprite.pngSha256)
}
assert.throws(()=>attachNativeSuspensionSprites(mockIndex,spriteData,'0'.repeat(64)),/do not match/)
for (const mutation of [s=>s.anchorX=NaN,s=>s.pixelsToUnits=0,s=>s.file='/wrong.png',s=>s.source.spriteSha256='bad']) {
  const broken=structuredClone(spriteData);mutation(Object.values(broken.sprites)[0])
  assert.throws(()=>attachNativeSuspensionSprites(mockIndex,broken,spriteData.stageEffectIndexSha256),/Invalid/)
}
// Execute the actual SFC renderer branch: Create may reuse the same ID and
// switch texture. Old runtimes must hide; unknown names never use the default.
const sfc=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const render=sfc.match(/function syncSuspensionlights\([^]*?\n\}/)[0]
const runtimes=new Map(),installed=[]
const renderer={runtimes,ensure(key,model){
  if(!runtimes.has(key)){
    const sprite={position:{set(){}},scale:{set(x,y){sprite.xy=[x,y]}}}
    runtimes.set(key,{sprite});installed.push({key,asset:model.layers[0].asset})
  }
  return runtimes.get(key)
}}
const state={id:7,asset:'fx_in_inndgn_suspensionlight',alpha:1,color:'#ffffff',depth:1600}
const context={app:{renderer:{width:1280,height:720,resolution:1}},cameraContainer:{},
  selectedSong:{value:{id:'test'}},stageEffectIndex:{value:bound},suspensionTrackKey:'test:',
  suspensionTrack:{value:{events:[]}},suspensionTempo:{value:120},stageTime:{value:0},
  visibleSuspensionlightIds:{value:[]},beamEffectsEnabled:{value:true},environmentScale:{value:1},
  suspensionSprites:renderer,newSuspensionlightsAt:()=>[state],suspensionlightModelForAsset,
  suspensionlightLayout:()=>({x:0,y:0,scaleX:2,scaleY:3,rotation:0}),parseHexColor:()=>0xffffff}
vm.createContext(context);vm.runInContext(render,context);context.syncSuspensionlights()
state.asset='fx_in_stofft_suspensionlight';context.syncSuspensionlights()
assert.deepEqual(installed.map(x=>x.asset),['fx_in_inndgn_suspensionlight','fx_in_stofft_suspensionlight'])
assert.equal(runtimes.get(installed[0].key).sprite.visible,false)
assert.equal(runtimes.get(installed[1].key).sprite.visible,true)
assert.deepEqual(runtimes.get(installed[1].key).sprite.xy,[2,3])
state.asset='unknown';context.syncSuspensionlights()
assert.equal(installed.length,2)
assert.ok([...runtimes.values()].every(r=>!r.sprite.visible))
// Preload every authored Sprite for this song before seek/play, following
// native PreloadEffect rather than discovering a custom texture on its frame.
const prepared=[]
renderer.prepare=async model=>{prepared.push(model.layers[0].asset);return true}
Object.assign(context,{objectLayersEnabled:{value:false},lightingEnabled:{value:true},stageDisposed:false,prepareSmoke:async()=>true})
context.selectedSong.value={id:'cgtocc_live_effect'}
vm.runInContext(sfc.match(/async function prepareStageLighting\([^]*?\n\}/)[0],context)
assert.equal(await context.prepareStageLighting(),true)
assert.deepEqual(prepared,[...spriteData.songAssets.cgtocc_live_effect])
renderer.prepare=async()=>false
await assert.rejects(context.prepareStageLighting(),/资源尚未就绪/)
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
const withUnknown = [...base,event(111100,'NewSuspensionlight_unknown_variant',[])]
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
assert.equal(suspensionlightLayout({x:0,y:360,scaleX:1,scaleY:1,angle:0},1280,720).y,360)
assert.equal(narrow.x,wide.x/2)
assert.equal(narrow.y,wide.y/2)
assert.equal(narrow.scaleY,wide.scaleY/2)
const status = buildStageVfxCoverage({id:'ending',backmonitorEvents:[{rotation:1}]},
  {stageEffects:{newSuspensionlightSongs:{ending:{events:withUnknown}}}})
assert.equal(status.sourceEvents.newSuspensionlight,3)
assert.equal(status.newSuspensionlightUnimplementedCommands,1)
assert.equal(status.backmonitorLogoRequests,1)
assert.equal(status.status,'partial')
// Native ColorAnim/BeatShow method bodies, not parser-derived expectations:
// directed HSV, OutQuad virtual tweens, half-duration outward/return legs,
// palette advancement at SHOW completion (including waits), captured BPM.
const red = {...create, values:[...create.values]}
red.values[8] = '#ff0000'
const color = (time, mode, target, duration, direction=1, rest=[]) =>
  event(time,'NewSuspensionlight_coloranim',['10047',String(mode),target,String(duration),String(direction),...rest])
const colors = (events,t,tempo=120) => newSuspensionlightsAt(events,t,{tempo})[0]
assert.equal(colors([red,show,color(0,2,'#0000ff',1000)],500).color,'#00ffff')
assert.equal(colors([red,show,color(0,2,'#0000ff',1000,0)],500).color,'#8000ff')
assert.equal(colors([red,show,color(0,2,'#0000ff',1000)],1000).color,'#0000ff')
assert.equal(colors([red,show,color(0,1,'',1000)],500).color,'#8000ff')
assert.equal(colors([red,show,color(0,1,'',1000)],1000).color,'#ff0000')
const pingpong = [red,show,color(0,3,'#0000ff',2000)]
assert.equal(colors(pingpong,1000).color,'#0000ff')
assert.equal(colors(pingpong,1500).color,'#ff0080')
assert.equal(colors(pingpong,2000).color,'#ff0000')
const overlap = [red,show,color(0,2,'#0000ff',1000),color(500,2,'#ff0000',1000)]
assert.equal(colors(overlap,500).color,'#00ffff')
assert.equal(colors(overlap,1500).color,'#ff0000')
const pulse = event(0,'NewSuspensionlight_normal_show',['10047','0','100','100','100','100'])
const palette = color(0,4,'#00ff00',0,0,['','#0000ff',''])
const stepping = [red,pulse,palette]
assert.equal(colors(stepping,399).color,'#ff0000')
assert.equal(colors(stepping,400).color,'#00ff00')
assert.equal(colors(stepping,800).color,'#0000ff')
assert.equal(colors(stepping,1200).color,'#ff0000')
assert.equal(colors(stepping,1000000).color,'#00ff00') // seek skips thousands of callbacks
assert.equal(colors([red,pulse,{...palette,time:450}],799).color,'#ff0000')
assert.equal(colors([red,pulse,{...palette,time:450}],800).color,'#00ff00')
assert.equal(colors([...stepping,color(450,2,'#ffffff',0)],1200).color,'#ffffff')
const beat = event(0,'NewSuspensionlight_beat_show',['10047','1','500','500'])
const beats = [red,beat,palette]
close(colors(beats,125).alpha,.6)
assert.equal(colors(beats,750).alpha,0)
close(colors(beats,1125).alpha,.6)
assert.equal(colors(beats,1000).color,'#00ff00')
const delayedBeat = [red,{...beat,values:['10047','0','500','500']}]
assert.equal(colors(delayedBeat,499).alpha,0)
close(colors(delayedBeat,625).alpha,.6)
assert.equal(colors(beats,125,null).showUnresolved,'tempo_unavailable')
assert.equal(colors(beats,125,null).alpha,0)
assert.equal(colors([...beats,{...show,time:500}],750,null).alpha,.8) // a show replaces pending BPM
const captured = newSuspensionlightsAt([red,beat],1125,{tempoAt:t=>t===0?120:60})[0]
close(captured.alpha,.6)
assert.deepEqual(colors(beats,125),colors(beats,125))
const erasedBeat = [...beats,{...event(600,'NewSuspensionlight_create',[],true),extraValues:{value101:'1',value102:'100'}}]
assert.equal(newSuspensionlightsAt(erasedBeat,700,{tempo:120}).length,0)
assert.equal(constantSuspensionTempo({tempos:[{tempo:120},{tempo:120}]}),120)
assert.equal(constantSuspensionTempo({tempos:[{tempo:120},{tempo:132}]}),null)
assert.equal(constantSuspensionTempo({tempos:[{tempo:0}]}),null)
const beatCoverage = (tempo) => buildStageVfxCoverage({id:'beat'},
  {newSuspensionlightTrack:{events:beats},newSuspensionlightTempo:tempo})
assert.equal(beatCoverage(null).newSuspensionlightTempoPending,1)
assert.equal(beatCoverage(120).newSuspensionlightTempoPending,0)
assert.equal(beatCoverage(120).newSuspensionlightUnimplementedCommands,0)
assert.equal(buildStageVfxCoverage({id:'lazy'},{stageEffects:{newSuspensionlightSongs:{lazy:{eventCount:99,unimplementedCommands:8}}}}).newSuspensionlightUnimplementedCommands,null)
if (process.argv.includes('--published-assets')) {
  const indexText=fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url),'utf8')
  const index = attachNativeSuspensionSprites(JSON.parse(indexText),spriteData,createHash('sha256').update(indexText).digest('hex'))
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
  let corpusEvents = 0, colorCommands = 0, beatCommands = 0
  for (const [song, descriptor] of Object.entries(index.newSuspensionlightSongs)) {
    const track = JSON.parse(fs.readFileSync(new URL(`../public/assets/live-chibi/${descriptor.file}`,import.meta.url)))
    corpusEvents += track.events.length
    const trackBytes=fs.readFileSync(new URL(`../public/assets/live-chibi/${descriptor.file}`,import.meta.url))
    assert.equal(createHash('sha256').update(trackBytes).digest('hex'),spriteData.trackSha256[song])
    assert.deepEqual([...new Set(track.events.filter(e=>e.command==='NewSuspensionlight_create'&&!e.erase&&e.values[1]).map(e=>e.values[1]))],spriteData.songAssets[song])
    for(const event of track.events.filter(e=>e.command==='NewSuspensionlight_create'&&!e.erase&&e.values[1]))
      assert.ok(suspensionlightModelForAsset(index,event.values[1]),`${song}: unbound Sprite ${event.values[1]}`)
    if(song==='cgtocc_live_effect'){
      const lamps=newSuspensionlightsAt(track.events,26500)
      const custom=lamps.find(s=>s.id===1401),standard=lamps.find(s=>s.id===1403)
      assert.equal(custom.asset,'fx_in_inndgn_suspensionlight')
      assert.equal(custom.alpha,.35)
      assert.equal(standard.alpha,1)
    }
    const chart = JSON.parse(fs.readFileSync(new URL(`../public/data/song_charts/${song.split('_')[0]}-1.json`,import.meta.url)))
    const tempo = constantSuspensionTempo(chart)
    const colorEvents = track.events.filter(e=>e.command==='NewSuspensionlight_coloranim')
    const beatEvents = track.events.filter(e=>e.command==='NewSuspensionlight_beat_show')
    colorCommands += colorEvents.length
    beatCommands += beatEvents.length
    if (beatEvents.length) assert.ok(tempo>0,`${song} BeatShow lacks constant tempo`)
    const coverage = buildStageVfxCoverage({id:song},{newSuspensionlightTrack:track,newSuspensionlightTempo:tempo})
    assert.equal(coverage.newSuspensionlightUnimplementedCommands,0)
    assert.equal(coverage.newSuspensionlightTempoPending,0)
    for (const time of [0,6000,26500,112900,200000]) {
      for (const s of newSuspensionlightsAt(track.events,time,{tempo})) {
        for (const field of ['alpha','angle','scaleX','scaleY']) assert.ok(Number.isFinite(s[field]),`${song} ${s.id} ${field}`)
        assert.ok(s.alpha>=0 && s.alpha<=1)
        assert.match(s.color,/^#[\da-f]{6}$/i)
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
  assert.equal(colorCommands,2350)
  assert.equal(beatCommands,331)
}
console.log('PASS suspension: envelopes, rotate/scale/fade, directed HSV and palette, captured BPM/BeatShow, interruption, erase/reuse, seek and coverage')
