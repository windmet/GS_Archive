import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createPlaybackIntent} from '../src/core/PlaybackIntent.js'
import {withLoadDeadline} from '../src/core/AsyncLoadBoundary.js'
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
  const c={stageDisposed:false,playing:ref(false),stageStarting:ref(false),stageTime:ref(100),stageDuration:ref(120000),preloading:ref(false),playbackSpeed:ref(1),
    stageVocalEnabled:ref(boundary==='unlock'),stageVocalReady:ref(boundary==='unlock'),audioError:ref(''),stageIntent:createPlaybackIntent(()=>''),stageAudioOwners:new Map(),runtimes:new Map([[1,runtime]]),activePositions:ref([1]),activeSlots:ref([{}]),
    stageVocalSession:{error:ref(''),currentTime:ref(0),unlock:()=>gate.promise,pause(){},seek(){},play:async()=>true,setPlaybackRate(){}},
    preloadSongMotions:()=>boundary==='preload'?gate.promise:Promise.resolve(true),syncSlotAtTime:()=>boundary==='slots'?gate.promise:Promise.resolve(),resetEventIndices(){},syncBackmonitor(){},syncStagePlaybackTime(){},stagePlaybackAudios:()=>audios,
    withLoadDeadline:(load,options)=>withLoadDeadline(load,{...options,timeoutMs:25}),performance,animationFrame:0,playbackStartOffset:0,playbackStartedAt:0,
    requestAnimationFrame(){frames.add(1);return 1},cancelAnimationFrame(id){frames.delete(id)},updateStage(){},backmonitorVideo:null,backmonitorTransitionVideo:null,backmonitorTransitionAlphaVideo:null,
  }
  vm.createContext(c)
  for(const name of ['toggleStage','stopStage','applyPlaybackSpeed','syncMotionPlaybackSpeed'])vm.runInContext(source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0],c)
  return {c,gate,native,frames,audios,runtime}
}
let cases=0
{
  const c={};vm.createContext(c)
  for(const name of ['playLiveChibiMotion','seekLiveChibiMotion'])vm.runInContext(motionSource.match(new RegExp(`export function ${name}\\([^]*?\\n\\}(?=\\r?\\n)`))[0].replace('export ',''),c)
  function actor(){
    const data=new SkeletonData();data.bones.push(new BoneData(0,'root',null))
    for(const [name,a,b] of [['test_3dance',0,10],['test_4loop',20,40]]){
      const curve=new RotateTimeline(2);curve.boneIndex=0;curve.setFrame(0,0,a);curve.setFrame(1,1,b)
      data.animations.push(new Animation(name,[curve],1))
    }
    const skeleton=new Skeleton(data),state=new AnimationState(new AnimationStateData(data))
    const runtime={skeletonData:data,spine:{state,skeleton,update(dt){state.update(dt);state.apply(skeleton);skeleton.updateWorldTransform()}}}
    c.playLiveChibiMotion(runtime,data.animations.map(a=>a.name),{reset:true,paused:true})
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
for(const boundary of ['unlock','preload','slots']){
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
  const ctx={LIVE_CHIBI_BASE:'/assets/live-chibi',withLoadDeadline,fetch:()=>gate.promise.then(bytes=>({ok:true,arrayBuffer:async()=>bytes})),BinaryInput:class {readInt(){return 1}readString(){return 'motion'}},Uint8Array}
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
