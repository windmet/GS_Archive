import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createPlaybackIntent} from '../src/core/PlaybackIntent.js'
import {withLoadDeadline} from '../src/core/AsyncLoadBoundary.js'
import {nativeMotionSpeed,nativeMotionMixWindowMs} from '../src/core/chibiMotionClock.js'
import * as nativeClock from '../src/core/chibiMotionClock.js'
import {parseBatchBlobs,publicationGitSnapshot} from './lib/publication-git-snapshot.mjs'
import {execFileSync} from 'node:child_process'
import {SkeletonData, BoneData, Skeleton, Animation, RotateTimeline, AnimationState, AnimationStateData} from '@pixi-spine/runtime-3.8'
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const motionSource=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
const ref=value=>({value})
function fixture(boundary='audio'){
  const gate=deferred(),native=[],frames=new Set(),runtime={spine:{state:{}}},audios=[{paused:true,pauses:0,currentTime:0,play(){this.paused=false;const d=deferred();native.push(d);return d.promise},pause(){this.paused=true;this.pauses++}}]
  const c={app:null,lifetime:new AbortController(),stageDisposed:false,playing:ref(false),stageStarting:ref(false),stageTime:ref(100),stageDuration:ref(120000),preloading:ref(false),playbackSpeed:ref(1),
    ...nativeClock,motionClockTrack:ref({bgmOffsetSeconds:0}),stageClockAudio:()=>audios[0],
    stageAudioTailActive:false,lightingIncompleteFrames:ref(0),lightingLastIncompleteFrame:ref(''),
    prepareStageLighting:()=>boundary==='lighting'?gate.promise:Promise.resolve(true),
    stageVocalEnabled:ref(boundary==='unlock'),stageVocalReady:ref(boundary==='unlock'),audioError:ref(''),stageIntent:createPlaybackIntent(()=>''),stageAudioOwners:new Map(),runtimes:new Map([[1,runtime]]),activePositions:ref([1]),activeSlots:ref([{}]),
    stageVocalSession:{error:ref(''),currentTime:ref(0),duration:ref(120),unlock:()=>gate.promise,pause(){},seek(){},play:async()=>true,setPlaybackRate(){}},
    preloadSongMotions:()=>boundary==='preload'?gate.promise:Promise.resolve(true),syncSlotAtTime:()=>boundary==='slots'?gate.promise:Promise.resolve(),resetEventIndices(){},syncBackmonitor(){},syncStagePlaybackTime(){},stagePlaybackAudios:()=>audios,
    withLoadDeadline:(load,options)=>withLoadDeadline(load,{...options,timeoutMs:25}),performance,animationFrame:0,playbackStartOffset:0,playbackStartedAt:0,
    requestAnimationFrame(){frames.add(1);return 1},cancelAnimationFrame(id){frames.delete(id)},updateStage(){},backmonitorVideo:null,backmonitorTransitionVideo:null,backmonitorTransitionAlphaVideo:null,
  }
  vm.createContext(c)
  for(const name of ['toggleStage','stopStage','applyPlaybackSpeed','syncMotionPlaybackSpeed'])vm.runInContext(source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0],c)
  return {c,gate,native,frames,audios,runtime}
}
let cases=0
for(const vocal of [false,true]) {
  const f=fixture();f.c.stageTime.value=121000;f.c.stageDuration.value=150000
  f.audios[0].duration=120
  f.c.stageVocalEnabled.value=vocal;f.c.stageVocalReady.value=vocal
  let vocalPlays=0
  f.c.stageVocalSession.unlock=async()=>true
  f.c.stageVocalSession.play=async()=>{vocalPlays++;return true}
  await f.c.toggleStage()
  assert.equal(f.c.playing.value,true);assert.equal(f.c.stageAudioTailActive,true)
  assert.equal(f.native.length,0);assert.equal(vocalPlays,0,'Silent stage tail must not replay audio sample zero')
  f.c.stopStage();assert.equal(f.c.stageTime.value,121000)
  await f.c.toggleStage();assert.equal(f.c.stageAudioTailActive,true)
  f.c.stopStage();cases++
}
{
  // Actual SFC seek at an authored handoff must match the outgoing pose and
  // subsequent cross-fade seen during continuous playback, not setup pose.
  const events = [
    {time:0,motion:1,speed:1300,mode:3},
    {time:1000,motion:2,speed:750,mode:2},
    {time:1060,motion:3,speed:1000,mode:2},
    {time:1800,motion:4,speed:1000,mode:3},
  ]
  const unitClock={tempos:[{timeMs:0,bpm:160}]}
  function harness(eventList=events,clock=unitClock) {
    const data=new SkeletonData();data.bones.push(new BoneData(0,'root',null))
    for (let id=1;id<=4;id++) {
      const curve=new RotateTimeline(2);curve.boneIndex=0
      curve.setFrame(0,0,id*25);curve.setFrame(1,2,id*25+15)
      data.animations.push(new Animation(`motion${id}_3dance`,[curve],2))
      data.animations.push(new Animation(`motion${id}_4loop`,[curve],2))
    }
    const stateData=new AnimationStateData(data);stateData.defaultMix=0
    const skeleton=new Skeleton(data),state=new AnimationState(stateData)
    const runtime={skeletonData:data,spine:{state,skeleton,stateData,
      update(dt){state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform()}}}
    const slot={position:3,loadSequence:1,motionSequence:0}
    const c={lifetime:new AbortController(),runtimes:new Map([[3,runtime]]),stageIntent:createPlaybackIntent(),stageDisposed:false,
      playing:ref(false),playbackSpeed:ref(1),motionCatalog:ref(new Map(events.map(e=>[e.motion,{id:e.motion}]))),
      injectLiveChibiMotion:async(_runtime,motion)=>[`motion${motion.id}_3dance`,`motion${motion.id}_4loop`],
      layoutRuntime(){},eventsForPosition:()=>eventList,motionClockTrack:ref(clock),nativeMotionSpeed,nativeMotionMixWindowMs}
    vm.createContext(c)
    for(const name of ['playLiveChibiMotion','seekLiveChibiMotion'])
      vm.runInContext(motionSource.match(new RegExp(`export function ${name}\\([^]*?\\n\\}(?=\\r?\\n)`))[0].replace('export ',''),c)
    for(const name of ['playSlotEvent','syncSlotAtTime'])
      vm.runInContext(source.match(new RegExp(`async function ${name}\\([^]*?\\n\\}`))[0],c)
    return {c,slot,runtime}
  }
  async function continuous(target,clock=unitClock) {
    const f=harness(events,clock)
    for(let index=0;index<events.length&&events[index].time<=target;index++) {
      const event=events[index]
      await f.c.playSlotEvent(f.slot,event,{reset:index===0})
      const until=Math.min(target,events[index+1]?.time??target)
      let remaining=(until-event.time)/1000*nativeMotionSpeed(clock,event)
      f.runtime.spine.state.timeScale=1
      while(remaining>1e-9){const dt=Math.min(1/60,remaining);f.runtime.spine.update(dt);remaining-=dt}
      f.runtime.spine.state.timeScale=0
    }
    return f.runtime.spine.skeleton.bones[0].rotation
  }
  for (const target of [950,1000,1030,1060,1090,1190,1200,1800,1850]) {
    const f=harness();await f.c.syncSlotAtTime(f.slot,target,true)
    const expected=await continuous(target)
    assert(Math.abs(f.runtime.spine.skeleton.bones[0].rotation-expected)<.001,
      `Authored handoff at ${target} must retain playback pose`)
    assert.equal(f.runtime.spine.state.timeScale,0);cases++
  }
  // A .15 animation-second mix is longer than 150 song milliseconds at slow
  // BPM/speed. The previous fixed lookback discarded its outgoing pose.
  for(const clock of [{tempos:[{timeMs:0,bpm:80}]},
    {tempos:[{timeMs:0,bpm:80},{timeMs:1050,bpm:320}]}])for(const target of [1030,1090,1200,1300]) {
    const f=harness(events,clock);await f.c.syncSlotAtTime(f.slot,target,true)
    assert(Math.abs(f.runtime.spine.skeleton.bones[0].rotation-await continuous(target,clock))<.001,
      `Native BPM-latched handoff reconstruction must match playback at ${target}`)
    cases++
  }
  const old=harness();await old.c.playSlotEvent(old.slot,events[1],{reset:true,seekTime:1000})
  assert(Math.abs(old.runtime.spine.skeleton.bones[0].rotation-await continuous(1000))>10,
    'Witness must reproduce old setup-pose jump at the handoff')
  const backwards=harness()
  await backwards.c.syncSlotAtTime(backwards.slot,1850,true)
  await backwards.c.syncSlotAtTime(backwards.slot,1030,true)
  assert(Math.abs(backwards.runtime.spine.skeleton.bones[0].rotation-await continuous(1030))<.001);cases++
  const initialMode2=harness([{...events[0],mode:2}])
  await initialMode2.c.syncSlotAtTime(initialMode2.slot,0,true)
  assert.equal(initialMode2.runtime.spine.state.getCurrent(0).animation.name,'motion1_3dance','First mode-2 command needs no nonexistent predecessor');cases++
  for(const invalidation of ['intent','runtime','costume']) {
    const f=harness(),pending=deferred();let loads=0
    f.c.injectLiveChibiMotion=async(_runtime,motion)=>{loads++;await pending.promise;return [`motion${motion.id}_4loop`]}
    const seek=f.c.syncSlotAtTime(f.slot,1030,true);await flush()
    if(invalidation==='intent')f.c.stageIntent.cancel()
    if(invalidation==='runtime')f.c.runtimes.set(3,{})
    if(invalidation==='costume')f.slot.loadSequence++
    pending.resolve();await seek
    assert.equal(loads,1,'A cancelled seek must not load or replace the next motion');cases++
  }
}
{
  const c={};vm.createContext(c)
  for(const name of ['playLiveChibiMotion','seekLiveChibiMotion'])vm.runInContext(motionSource.match(new RegExp(`export function ${name}\\([^]*?\\n\\}(?=\\r?\\n)`))[0].replace('export ',''),c)
  function actor(options={}){
    const data=new SkeletonData();data.bones.push(new BoneData(0,'root',null))
    for(const [name,a,b] of [['test_3dance',0,10],['test_4loop',20,40],['test_2after',50,60],['test_1before',40,50]]){
      const curve=new RotateTimeline(2);curve.boneIndex=0;curve.setFrame(0,0,a);curve.setFrame(1,1,b)
      data.animations.push(new Animation(name,[curve],1))
    }
    const skeleton=new Skeleton(data),state=new AnimationState(new AnimationStateData(data))
    const runtime={skeletonData:data,spine:{state,skeleton,update(dt){state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform()}}}
    c.playLiveChibiMotion(runtime,data.animations.map(a=>a.name),{reset:true,paused:true,...options})
    return runtime
  }
  for(const time of [0,.2,.95,1.04,1.1,2.25,7.5]){
    const actual=actor(),reference=actor();reference.spine.state.timeScale=1
    let elapsed=0
    while(elapsed<time-1e-9){const dt=Math.min(1/120,time-elapsed);reference.spine.update(dt);elapsed+=dt}
    reference.spine.update(0);c.seekLiveChibiMotion(actual,time)
    assert.equal(actual.spine.state.getCurrent(0).animation.name,reference.spine.state.getCurrent(0).animation.name)
    assert(Math.abs(actual.spine.skeleton.bones[0].rotation-reference.spine.skeleton.bones[0].rotation)<(time>1&&time<1.08?2:.01),`Seek pose must match continuous main→loop playback at ${time}: ${actual.spine.skeleton.bones[0].rotation} vs ${reference.spine.skeleton.bones[0].rotation}`)
    assert.equal(actual.spine.state.timeScale,0);cases++
  }
  const old=actor();old.spine.state.timeScale=1;old.spine.update(2.25)
  assert.equal(old.spine.state.getCurrent(0).animation.name,'test_3dance','Witness must reproduce old queued-loop failure')
  assert.throws(()=>c.seekLiveChibiMotion(actor(),NaN),/Invalid motion/);cases++
  // Check normal and skip as independent paths, rather than equating isLoop
  // with immediate playback. Native callback 0x1bbe040 queues the loop.
  for (const options of [{mode:3},{mode:2,skip:true},{mode:1,skip:true},{mode:2}]) {
    for (const time of [0,.2,1.04,2.25,7.5]) {
      const actual=actor({...options,nativeCommand:true}),reference=actor({...options,nativeCommand:true})
      const track=actual.spine.state.getCurrent(0)
      const directLoop=options.mode===3 || options.mode===2&&Boolean(options.skip)
      assert.equal(track.animation.name,directLoop?'test_4loop':'test_3dance')
      assert.equal(track.loop,directLoop)
      if(options.mode===2&&!options.skip)assert.equal(track.next.animation.name,'test_4loop','Normal mode 2 queues loop after dance')
      else assert.equal(track.next ?? null,null)
      reference.spine.state.timeScale=1
      let elapsed=0
      while(elapsed<time-1e-9){const dt=Math.min(1/60,time-elapsed);reference.spine.update(dt);elapsed+=dt}
      c.seekLiveChibiMotion(actual,time)
      assert(Math.abs(actual.spine.skeleton.bones[0].rotation-reference.spine.skeleton.bones[0].rotation)<.001)
      assert.equal(actual.spine.state.timeScale,0);cases++
    }
  }
  const dance=actor({mode:1,nativeCommand:true})
  assert.equal(dance.spine.state.getCurrent(0).animation.name,'test_3dance')
  assert.equal(dance.spine.state.getCurrent(0).loop,false)
  assert.equal(dance.spine.state.getCurrent(0).next ?? null,null)
  c.playLiveChibiMotion(dance,['test_1before','test_2after','test_4loop'],{mode:2,nativeCommand:true})
  assert.equal(dance.spine.state.getCurrent(0).animation.name,'test_1before','Normal callback falls back to before -> after')
  assert.equal(dance.spine.state.getCurrent(0).next.animation.name,'test_2after')
  assert.equal(dance.spine.state.getCurrent(0).next.next.animation.name,'test_4loop')
  assert.equal(dance.spine.state.getCurrent(0).mixDuration,.15)
  c.playLiveChibiMotion(dance,['test_2after','test_4loop'],{mode:1,nativeCommand:true,skip:true})
  assert.equal(dance.spine.state.getCurrent(0).animation.name,'test_2after','Immediate non-loop falls back directly to after')
  assert.throws(()=>c.playLiveChibiMotion(dance,['test_3dance'],{mode:2,nativeCommand:true}),/no native fragment/)
  assert.equal(dance.spine.state.getCurrent(0).animation.name,'test_2after','Invalid fragment does not clear the current pose');cases++
}
{
  const f=fixture(),p=f.c.toggleStage();await flush();f.runtime.motionSpeedScale=0.5
  f.native[0].resolve();await p
  assert(f.c.playing.value);assert.equal(f.runtime.spine.state.timeScale,0.5)
  f.c.playbackSpeed.value=1.5;f.c.applyPlaybackSpeed();assert.equal(f.runtime.spine.state.timeScale,0.75)
  f.c.stopStage();assert.equal(f.runtime.spine.state.timeScale,0)
  f.c.playbackSpeed.value=2;f.c.applyPlaybackSpeed();assert.equal(f.runtime.spine.state.timeScale,0)
  const resume=f.c.toggleStage();await flush();f.native[1].resolve();await resume
  assert(f.c.playing.value);assert.equal(f.runtime.spine.state.timeScale,1)
  f.c.stopStage();assert.equal(f.runtime.spine.state.timeScale,0);cases++
}
for(const boundary of ['unlock','preload','lighting','slots']){
  const f=fixture(boundary),p=f.c.toggleStage();await flush();assert(f.c.stageStarting.value)
  f.c.stopStage();f.gate.resolve(true);await p
  assert(!f.c.playing.value&&!f.c.stageStarting.value);assert.equal(f.frames.size,0);assert.equal(f.native.length,0);cases++
}
{
  const f=fixture('slots'),p=f.c.toggleStage();await flush();f.c.runtimes.set(1,{})
  f.gate.resolve();await p;assert(!f.c.playing.value);assert.equal(f.native.length,0);cases++
}
{
  const f=fixture(),p=f.c.toggleStage();await flush();f.c.stopStage();f.native[0].resolve();await p
  assert(f.audios[0].paused&&!f.c.playing.value&&!f.frames.size);cases++
}
for(const outcome of ['resolve','reject']){
  const f=fixture(),old=f.c.toggleStage();await flush();f.c.stopStage();const next=f.c.toggleStage();await flush();
  f.native[1].resolve();await next;assert(f.c.playing.value)
  const pauses=f.audios[0].pauses
  f.native[0][outcome](outcome==='reject'?Error('stale play failure'):undefined);await old
  assert(f.c.playing.value&&!f.c.audioError.value);assert.equal(f.audios[0].pauses,pauses);assert.equal(f.frames.size,1)
  f.c.stopStage();cases++
}
{
  const f=fixture(),p=f.c.toggleStage();await flush();f.c.stageDisposed=true;f.c.stageIntent.dispose();f.c.stopStage();f.native[0].resolve();await p
  assert(f.audios[0].paused&&!f.c.playing.value&&!f.frames.size);cases++
}
{
  const f=fixture('preload'),p=f.c.toggleStage();await flush();f.c.applyPlaybackSpeed();f.gate.resolve(true);await p
  assert(!f.c.playing.value&&!f.c.stageStarting.value);cases++
}
{
  const f=fixture();await f.c.toggleStage();assert(f.c.audioError.value.includes('timeout'));assert(!f.c.playing.value&&!f.c.stageStarting.value);f.audios[0].paused=false;f.native[0].resolve();await flush();assert(f.audios[0].paused);cases++
}
for(const reason of ['dispose','cancel','current']){
  const gate=deferred(),intent=createPlaybackIntent(),token=intent.begin()
  const runtime={disposed:false,bodyType:1,setupStrings:[],skeletonData:{animations:[]},skeletonBinary:{readAnimation:()=>({name:'motion'})}}
  const ctx={LIVE_CHIBI_BASE:'/assets/live-chibi',fetchBuffer:()=>gate.promise,withLoadDeadline,fetch:()=>gate.promise.then(bytes=>({ok:true,arrayBuffer:async()=>bytes})),BinaryInput:class {readInt(){return 1}readString(){return 'motion'}},Uint8Array}
  vm.createContext(ctx);vm.runInContext(motionSource.match(/export async function injectLiveChibiMotion\([^]*?\n\}/)[0].replace('export ',''),ctx)
  const pending=ctx.injectLiveChibiMotion(runtime,{id:1,file:'motion_{bodyType}'},{isCurrent:token.current})
  if(reason==='dispose')runtime.disposed=true
  if(reason==='cancel')intent.cancel()
  gate.resolve(new ArrayBuffer(1));await pending
  assert.equal(runtime.skeletonData.animations.length,reason==='current'?1:0)
  assert.equal(Boolean(runtime.loadedMotions?.size),reason==='current');cases++
}
const protocol=Buffer.concat([Buffer.from('aaa blob 4\n'),Buffer.from([1,10,0,4]),Buffer.from('\nmissing missing\n')])
const blobs=parseBatchBlobs(protocol,['first','missing']);assert.deepEqual(blobs.get('first'),Buffer.from([1,10,0,4]));assert.equal(blobs.get('missing'),null)
assert.throws(()=>parseBatchBlobs(protocol.subarray(0,6),['first']),/Truncated/)
const cwd=new URL('../../',import.meta.url),path='web_viewer/package.json',snap=publicationGitSnapshot([path],cwd)(path)
assert.deepEqual(snap.indexBytes,execFileSync('git',['show',`:${path}`],{cwd}));assert.deepEqual(snap.headBytes,execFileSync('git',['show',`HEAD:${path}`],{cwd}));cases++
console.log(`Stage and motion source: ${cases} controlled timing/protocol cases passed; no browser or heap claim`)
