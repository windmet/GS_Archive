import {withStageIndexTransport} from './lib/stage-index-harness.mjs'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleStreamedCurve } from '../src/core/chibiNativeAnimation.js'
import { createHash,webcrypto } from 'node:crypto'
import { oldSuspensionlightsAt,oldSuspensionlightLayout,attachNativeOldSuspension,validateOldSuspensionTrack } from '../src/core/chibiOldSuspensionlights.js'
import { nativeLightCameraAt,nativeLightScreenLayout,nativeLightLocalLayout } from '../src/core/chibiNativeLightProjection.js'
const read = name => JSON.parse(fs.readFileSync(new URL(`./fixtures/${name}`,import.meta.url)))
const model=read('chibi-old-suspension-model.json'),moon=read('chibi-old-suspension-events.json')
const nativeCurve=model.styles.Suspensionlight.clips.angle60.curve
assert.ok(Number.isNaN(sampleStreamedCurve(nativeCurve,NaN)),
 'Invalid native time must not silently become the finite initial pose')
assert.equal(sampleStreamedCurve(nativeCurve,-1),nativeCurve.initialValue)
assert.equal(sampleStreamedCurve(nativeCurve,0),0)
assert.equal(sampleStreamedCurve(nativeCurve,1),60)
assert.equal(sampleStreamedCurve(nativeCurve,2),0)

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`)
const row=(time,command='Suspensionlight',changes={})=>({time,command,id:1,erase:false,
 values:['1','1','1','2000','right','1000','30','10','360','#33f170','1650','3000','0','0','0'].map((v,i)=>changes[i+1]??v),extraValues:{}})
const at=(events,time,tempo=140)=>oldSuspensionlightsAt(events,time,model,{referenceProjection:'stage-rig-v1',tempo})
const basic=[row(0)]
close(at(basic,600)[0].nativeAngle,38.88)
close(at(basic,600)[0].angle,128.88)
assert.equal(at(basic,600)[0].alpha,1)
assert.equal(at(basic,600)[0].mirrorY,false)
// A mid-flight speed change preserves Animator phase; inactive reactivation resets it.
const changed=[...basic,row(500,'Suspensionlight',{4:'4000'})]
close(at(changed,500)[0].phase,.5)
close(at(changed,1000)[0].phase,.75)
assert.notEqual(at(changed,1000)[0].phase,.25)
const erase={...row(1000),erase:true,extraValues:{value101:'1',value102:'2000'}}
const exiting=[...basic,erase]
close(at(exiting,1100)[0].alpha,.25)
assert.equal(at(exiting,1200).length,0) // Fixed native 0.2s, not generic value102.
close(at([...exiting,row(1300)],1400)[0].phase,.1)
close(at([...exiting,row(1100)],1200)[0].phase,1.2) // Cancelled exit keeps the active instance.
// value2/3 are not native Animator gates. Huge periods are slow, not frozen.
const slow=[row(0,'Suspensionlight',{2:'',3:'',4:'9999999'})]
assert.equal(at(slow,1000).length,1)
assert.ok(at(slow,1000)[0].phase>0)
// _5's hue direction does not stop rotation, and hue delay never delays Animator.
const chroma=[row(0,'Suspensionlight_5',{4:'5000',7:'120',5:'left'})]
const half=at(chroma,1500)[0]
assert.equal(half.color,'#f133b4')
assert.equal(half.alpha,1)
close(half.phase,.6)
close(half.nativeAngle,38.88)
close(half.angle,21.12)
assert.equal(half.mirrorY,true)
const hueDelay=[row(0,'Suspensionlight_5',{4:'5000',13:'1000'})]
assert.equal(at(hueDelay,500)[0].color,'#33f170')
assert.ok(at(hueDelay,500)[0].nativeAngle>0)
// _2 samples BPM at Show, then cycles three colors on each completed beat.
const pulse=[row(0,'Suspensionlight_2',{12:'1',13:'#ff0000',14:'#0000ff'})]
close(at(pulse,60000/140/2)[0].alpha,.25)
assert.equal(at(pulse,60000/140+10)[0].color,'#ff0000')
assert.equal(at(pulse,2*60000/140+10)[0].color,'#0000ff')
assert.equal(at(pulse,3*60000/140+10)[0].color,'#33f170')
assert.equal(at(pulse,100,null)[0].unresolved,'tempo_unavailable')
assert.equal(at(pulse,100,null)[0].alpha,0)
const waitingPulse=[row(0,'Suspensionlight_2',{12:'0',15:'1'})]
assert.equal(at(waitingPulse,100)[0].alpha,0)
close(at(waitingPulse,2*60000/140+60000/140/2)[0].alpha,.25)
const delayedPulse=[row(0,'Suspensionlight_3',{12:'1000',13:'500',14:'500'})]
assert.equal(at(delayedPulse,400)[0].alpha,0)
close(at(delayedPulse,750)[0].alpha,.5)
close(at(delayedPulse,1250)[0].alpha,.5)
assert.equal(at(delayedPulse,1750)[0].alpha,0)
assert.deepEqual(at(changed,600),at(changed,600))
// _4 is a native two-color RGBA Yoyo tween, not a hue or alpha pulse.
const colorCycle=[row(0,'Suspensionlight_4',{10:'#ff000080',12:'2000',13:'#0000ff00',14:'500',15:'0'})]
assert.equal(at(colorCycle,250)[0].color,'#ff0000')
close(at(colorCycle,250)[0].alpha,128/255)
assert.equal(at(colorCycle,1000)[0].color,'#800080')
close(at(colorCycle,1000)[0].alpha,64/255)
assert.equal(at(colorCycle,1500)[0].color,'#0000ff')
assert.equal(at(colorCycle,1500)[0].alpha,0)
assert.equal(at(colorCycle,2500)[0].color,'#ff0000')
const reverseCycle=[row(0,'Suspensionlight_4',{10:'#ff0000',12:'2000',13:'#0000ff',14:'500',15:'1'})]
assert.equal(at(reverseCycle,250)[0].color,'#0000ff')
assert.equal(at(reverseCycle,1500)[0].color,'#ff0000')
const fourthExit={...row(1200,'Suspensionlight_4'),erase:true,extraValues:{value101:'1'}}
const exitColor=at([...colorCycle,fourthExit],1300)[0]
assert.equal(exitColor.color,at(colorCycle,1200)[0].color)
close(exitColor.alpha,at(colorCycle,1200)[0].alpha*.25)
assert.equal(at([...colorCycle,fourthExit],1400).length,0)
assert.deepEqual(at(colorCycle,1000),at(colorCycle,1000))
const tempoHistory=t=>t<500?120:180
const tempoCommands=[row(0,'Suspensionlight_2',{12:'1'}),row(1000,'Suspensionlight_2',{12:'1'})]
close(oldSuspensionlightsAt(tempoCommands,250,model,{tempoAt:tempoHistory})[0].alpha,.25)
close(oldSuspensionlightsAt(tempoCommands,1000+60000/180/2,model,{tempoAt:tempoHistory})[0].alpha,.25)

// The native supplement, loader and MOON checks read the gitignored stage
// catalog. Without it the SFC lifecycle runs on a three-song index that keeps
// only the fields syncOldSuspensionlights reads.
const publishedAssets=process.argv.includes('--published-assets')
let nativeIndex={oldSuspensionlightSongs:{
 bnckgy_live_effect:{nativeCapability:'supported',file:'bnckgy.json'},
 infoct_live_effect:{nativeCapability:'supported',file:'infoct.json'},
 steqmg_live_effect:{nativeCapability:'partial',file:'steqmg.json'}}}
if(publishedAssets){
const base=new URL('../public/assets/live-chibi/',import.meta.url)
const indexText=fs.readFileSync(new URL('stage-effects/index.json',base),'utf8')
const supplement=JSON.parse(fs.readFileSync(new URL('../public/data/stage-old-suspension.json',import.meta.url),'utf8'))
const hash=text=>createHash('sha256').update(text).digest('hex')
nativeIndex=attachNativeOldSuspension(JSON.parse(indexText),supplement,hash(indexText))
assert.equal(Object.values(nativeIndex.oldSuspensionlightSongs).filter(d=>d.nativeCapability==='supported').length,96)
assert.equal(Object.values(nativeIndex.oldSuspensionlightSongs).filter(d=>d.nativeCapability==='partial').length,9)
assert.equal(nativeIndex.oldSuspensionlightSongs.steqmg_live_effect.nativeCapability,'partial')
assert.equal(nativeIndex.oldSuspensionlightSongs.steqmg_live_effect.reasons[0].reason,'nonpositive_animator_period')
assert.equal(nativeIndex.oldSuspensionlightSongs.bnckgy_live_effect.nativeCapability,'supported')
assert.throws(()=>attachNativeOldSuspension(JSON.parse(indexText),supplement,'0'.repeat(64)),/match/)
const broken=structuredClone(supplement);broken.songs.bnckgy_live_effect.eventCount++
assert.throws(()=>attachNativeOldSuspension(JSON.parse(indexText),broken,hash(indexText)),/capability/)
for(const descriptor of Object.values(nativeIndex.oldSuspensionlightSongs)) {
 const text=fs.readFileSync(new URL(descriptor.file,base),'utf8'),track=JSON.parse(text)
 if(['supported','partial'].includes(descriptor.nativeCapability)) {
  validateOldSuspensionTrack(track,descriptor,hash(text))
  const sampleTimes=new Set(track.events.flatMap(e=>[e.time,e.time+100,e.time+1500]))
  for(const t of sampleTimes)for(const state of oldSuspensionlightsAt(track.events,t,nativeIndex.oldSuspensionlight,{tempo:140}))
    if(state.unresolved)assert.equal(state.alpha,0)
    else for(const field of ['alpha','angle','scaleX','scaleY'])assert.ok(Number.isFinite(state[field]))
 }
}
const descriptor=nativeIndex.oldSuspensionlightSongs.bnckgy_live_effect
const trackText=fs.readFileSync(new URL(descriptor.file,base),'utf8')
assert.throws(()=>validateOldSuspensionTrack(JSON.parse(trackText),descriptor,'0'.repeat(64)),/mismatch/)
// Run actual bounded loaders with a controllable transport.
const spineSource=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const start=spineSource.indexOf('export async function fetchLiveChibiStageEffectIndex(')
const end=spineSource.indexOf('export ',spineSource.indexOf('export async function fetchLiveChibiOldSuspensionTrack(')+7)
const section=spineSource.slice(start,end).replaceAll('export ','')
const {attachNativeSuspensionSprites}=await import('../src/core/chibiSuspensionlights.js')
const spriteSupplement=JSON.parse(fs.readFileSync(new URL('../public/data/stage-new-suspension-sprites.json',import.meta.url),'utf8'))
const makeLoader=transport=>withStageIndexTransport(new Function('indexTransport','LIVE_CHIBI_BASE','crypto','attachNativeOldSuspension','validateOldSuspensionTrack','attachNativeSuspensionSprites',section+';return {index:fetchLiveChibiStageEffectIndex,track:fetchLiveChibiOldSuspensionTrack}'))(
 transport,'/assets/live-chibi',webcrypto,attachNativeOldSuspension,validateOldSuspensionTrack,attachNativeSuspensionSprites)
const transport={load:async path=>path==='/data/stage-new-suspension-sprites.json'?JSON.stringify(spriteSupplement):path==='/data/stage-old-suspension.json'?JSON.stringify(supplement):path.endsWith('/index.json')?indexText:trackText}
const loader=makeLoader(transport)
assert.equal((await loader.index()).oldSuspensionlightContract,'native-old-suspension-v1')
assert.equal((await loader.track(descriptor)).events.length,descriptor.eventCount)
const abort=new AbortController();abort.abort()
await assert.rejects(loader.track(descriptor,{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({load:async()=>{throw new Error('HTTP 404')}}).index(),/404/)
}
// Independent matrix oracle: root Rz * LeftRightBase Rx * fixed Rz60 *
// Animator Rz(a), with texture/screen Y reflection. Check corners, not angles
// alone, so a wrong reflection cannot pass by matching a beam's centre ray.
const rotate=(x,y,a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]
for(const side of ['left','right'])for(const angle of [-120,0,73,300])for(const t of [0,300,600,1700]){
 const s=at([row(0,'Suspensionlight',{5:side,7:String(angle)})],t)[0]
 const layout=oldSuspensionlightLayout(s,1280,720)
 for(const [x,y] of [[-1,0],[1,0],[-1,3],[1,3]]){
  let p=rotate(x,-y,(60+s.nativeAngle)*Math.PI/180)
  if(side==='left')p[1]=-p[1]
  p=rotate(...p,angle*Math.PI/180);p[1]=-p[1]
  const actual=rotate(x*layout.scaleX,y*layout.scaleY,layout.rotation)
  close(actual[0],p[0]);close(actual[1],p[1])
 }
}
const beam=at(basic,600)[0],large=oldSuspensionlightLayout(beam,1280,720),small=oldSuspensionlightLayout(beam,640,360)
close(large.x,small.x*2);close(large.y,small.y*2);close(large.scaleY,small.scaleY*2)
const cameraRow=(time,changes={})=>({time,zoom:1000,zoomDuration:0,x:0,y:360,moveDuration:0,rotation:0,rotationDuration:0,focusSlot:0,...changes})
const lens={cameraEvents:[cameraRow(0,{zoom:2000,zoomDuration:1000,x:100,y:460,moveDuration:1000,rotation:90,rotationDuration:1000})]}
const midpoint=nativeLightCameraAt(lens,500)
close(midpoint.orthoSize,3.125);close(midpoint.zoom,1.6);close(midpoint.x,75);close(midpoint.rotation,67.5)
const interruptedLens={cameraEvents:[...lens.cameraEvents,cameraRow(500)]}
close(nativeLightCameraAt(interruptedLens,500).zoom,1)
const focusSong={cameraEvents:[cameraRow(0,{focusSlot:1,zoomDuration:1000,moveDuration:100})],
 positionEvents:[{time:0,position:1,x:100,y:180},{time:700,position:1,x:200,y:220}]}
close(nativeLightCameraAt(focusSong,500).x,100)
close(nativeLightCameraAt(focusSong,1000).x,200)
close(nativeLightCameraAt(focusSong,1000).y,370)
assert.equal(nativeLightCameraAt({cameraEvents:[cameraRow(0,{focusSlot:1})]},10).verified,false)
assert.equal(nativeLightCameraAt({cameraEvents:[cameraRow(0,{focusSlot:1100,x:100})]},10).focusSlot,0)
close(nativeLightCameraAt({cameraEvents:[cameraRow(0,{focusSlot:1100,x:100})]},10).x,100)
// Matrix oracle includes LiveStage's Prepare scale, camera inverse and screen
// Y conversion. This checks the sign of camera rotation independently.
for(const rotation of [-90,0,30])for(const zoom of [1,2]){
 const cam={x:20,y:400,rotation,zoom}
 const projected=nativeLightScreenLayout(beam,1280,720,1,cam)
 const stageScale=1000/720,world=[beam.x*.01*stageScale,(beam.y-360)*.01*stageScale]
 const cameraWorld=[cam.x*stageScale/100,(cam.y-360)*stageScale/100]
 const view=rotate(world[0]-cameraWorld[0],world[1]-cameraWorld[1],-rotation*Math.PI/180)
 close(projected.x,640+view[0]*720/(10/zoom));close(projected.y,360-view[1]*720/(10/zoom))
 // The reference parent is intentionally different. Its .82 zoom, pivot and
 // rotation must cancel exactly rather than being applied a second time.
 const a=.82*Math.cos(.3),b=.82*Math.sin(.3),parent={a,b,c:-b,d:a,tx:83,ty:-41}
 const local=nativeLightLocalLayout(projected,parent)
 close(a*local.x-b*local.y+parent.tx,projected.x)
 close(b*local.x+a*local.y+parent.ty,projected.y)
 close(Math.cos(local.rotation+.3),Math.cos(projected.rotation))
 close(Math.sin(local.rotation+.3),Math.sin(projected.rotation))
 close(local.scaleX*.82,projected.scaleX)
}
for(const t of [0,6000,20000,105100])for(const s of at(moon,t))if(!s.unresolved)for(const key of ['alpha','angle','scaleX','scaleY'])assert.ok(Number.isFinite(s[key]))
if(process.argv.includes('--published-assets')){
 const base=new URL('../public/assets/live-chibi/',import.meta.url)
 const index=JSON.parse(fs.readFileSync(new URL('stage-effects/index.json',base)))
 assert.equal(Object.keys(index.oldSuspensionlightSongs).length,105)
 let count=0,driveVariants=0
 for(const [id,descriptor] of Object.entries(index.oldSuspensionlightSongs)){
  const events=JSON.parse(fs.readFileSync(new URL(descriptor.file,base))).events;count+=events.length
  if(id.startsWith('drvalv_live_effect')){
   driveVariants++
   const state=t=>at(events,t)
   assert.equal(state(19000).find(s=>s.key==='Suspensionlight_5:1').color,'#f133b4')
   close(state(19000).find(s=>s.key==='Suspensionlight_5:1').phase,.6)
   assert.ok(!state(28385).some(s=>s.key==='Suspensionlight:1'))
   const before=state(19999).find(s=>s.key==='Suspensionlight:1'),after=state(20000).find(s=>s.key==='Suspensionlight:1')
   assert.ok(after.phase>=before.phase && after.phase-before.phase<.000001)
  }
  for(const t of [6000,19000,28385,112900])for(const s of at(events,t))if(!s.unresolved)for(const k of ['alpha','angle','scaleX','scaleY'])assert.ok(Number.isFinite(s[k]),`${id} ${s.key} ${k}`)
 }
 const choreography=JSON.parse(fs.readFileSync(new URL('choreography/index.json',base)))
 for(const song of choreography.songs)for(const event of song.cameraEvents||[]){
  for(const t of [event.time,event.time+50,event.time+1000]){
   const camera=nativeLightCameraAt(song,t)
   assert.equal(camera.verified,true,`${song.id} unresolved focus ${t}`)
   for(const field of ['zoom','orthoSize','x','y','rotation'])assert.ok(Number.isFinite(camera[field]),`${song.id} ${field} ${t}`)
  }
 }
 assert.equal(count,88647);assert.equal(driveVariants,20)
}
console.log('PASS old suspension: native hue/BPM/linear pulse, fixed erase, active phase continuity, slow periods, independent hierarchy matrix, seek and corpus')

// Actual SFC load lifecycle: source-qualified track, stale result and guard.
const viewer=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const syncSection=viewer.slice(viewer.indexOf('function syncOldSuspensionlights()'),viewer.indexOf('function releaseSpotlights()'))
const pending=[];let releases=0,repaints=0
const selected={value:{id:'bnckgy_live_effect'}}
const resources={value:nativeIndex}
const requests=async descriptor=>new Promise(resolve=>pending.push({descriptor,resolve}))
const mockStore={runtimes:new Map(),release(){releases++},ensure(){return null}}
const syncFactory=new Function('selectedSong','stageEffectIndex','fetchLiveChibiOldSuspensionTrack','oldSuspensionSprites','oldSuspensionlightsAt','oldSuspensionlightLayout','nativeMotionTempoAt',`
 let oldSuspensionTrackKey='',oldSuspensionTrack=null,oldSuspensionAbort=null,stageDisposed=false;
 const app={renderer:{width:1280,height:720,resolution:1}},cameraContainer={},beamEffectsEnabled={value:true};
 const visibleOldSuspensionlightIds={value:[]},stageTime={value:12000},environmentScale={value:1},motionClockTrack={value:null};
 const unresolvedOldSuspensionlightIds={value:[]};
 const requestPausedSuspensionRender=()=>{},parseHexColor=()=>0;
 ${syncSection}
 return {sync:syncOldSuspensionlights,track:()=>oldSuspensionTrack};
`)
const actualSync=syncFactory(selected,resources,requests,mockStore,oldSuspensionlightsAt,oldSuspensionlightLayout,()=>140)
actualSync.sync();assert.equal(pending.length,1)
selected.value={id:'infoct_live_effect'};actualSync.sync();assert.equal(pending.length,2)
const settle=()=>new Promise(resolve=>setTimeout(resolve,0))
pending[0].resolve({events:[]});await settle()
assert.equal(actualSync.track(),null,'Prior song result cannot install after switch')
pending[1].resolve({events:[]});await settle()
assert.deepEqual(actualSync.track(),{events:[]})
selected.value={id:'steqmg_live_effect'};actualSync.sync()
assert.equal(actualSync.track(),null)
assert.equal(pending.length,3,'Partial tracks must load normal instances while guarding affected generations')
assert.equal(releases,3)
resources.value={oldSuspensionlightSongs:{unbound:{nativeCapability:'unsupported',file:'unbound.json'}}}
selected.value={id:'unbound'};actualSync.sync()
assert.equal(pending.length,3,'An unbound native profile cannot load')
console.log('PASS actual SFC native capability, track cancellation and stale-song completion')

// A malformed Show is an active-generation mutation, not a skipped command.
// Guard its later finite updates too; only completed deactivation resets it.
const guarded=[row(0),row(500,'Suspensionlight',{4:''}),row(1000),row(1500)]
guarded[3].erase=true
assert.equal(at(guarded,499)[0].unresolved,null)
assert.deepEqual(at(guarded,500),[{key:'Suspensionlight:1',alpha:0,unresolved:'nonfinite_animator_time'}])
assert.equal(at(guarded,1200)[0].unresolved,'nonfinite_animator_time')
assert.equal(at(guarded,1600)[0].unresolved,'nonfinite_animator_time')
assert.equal(at(guarded,1700).length,0)
const cancelled=[...guarded,row(1600)]
assert.equal(at(cancelled,1800)[0].unresolved,'nonfinite_animator_time','Show cancels pending Erase without resetting Animator')
const reset=[...guarded,row(1700)]
assert.equal(at(reset,1800)[0].unresolved,null,'Completed Erase creates a fresh finite generation')
const independent=[...guarded,{...row(500,'Suspensionlight',{1:'2'}),id:2}].sort((a,b)=>a.time-b.time)
assert.equal(at(independent,1200).find(s=>s.key==='Suspensionlight:2').unresolved,null)
assert.deepEqual(at(independent,499),at(guarded,499),'Backward seek restores pre-invalid generation')

if(publishedAssets){
const base=new URL('../public/assets/live-chibi/',import.meta.url)
const moonDescriptor=nativeIndex.oldSuspensionlightSongs.montns_live_effect
const moonTrack=JSON.parse(fs.readFileSync(new URL(moonDescriptor.file,base)))
assert.equal(moonDescriptor.nativeCapability,'partial')
for(const t of [1800,6000,20000,60000,80000,100000]){
 const states=at(moonTrack.events,t)
 assert.ok(states.some(s=>s.alpha>.001&&!s.unresolved),`MOON normal source lights must render at ${t}`)
 for(const s of states.filter(s=>!s.unresolved))for(const k of ['angle','scaleX','scaleY'])assert.ok(Number.isFinite(s[k]))
}
assert.ok(at(moonTrack.events,4300).some(s=>s.key==='Suspensionlight:301'&&s.unresolved==='nonfinite_animator_time'))
}
console.log(`PASS per-generation guard, cancelled/completed Erase, independent lamps and rewind${publishedAssets?', MOON source lights':''}`)
