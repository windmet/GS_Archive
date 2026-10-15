import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import vm from 'node:vm'
import * as clock from '../src/core/chibiMotionClock.js'
import {validateMotionClock,motionClockForSong,nativeMotionTempoAt,nativeMotionSpeed,nativeMotionMixWindowMs} from '../src/core/chibiMotionClock.js'

const read=path=>fs.readFileSync(new URL(path,import.meta.url),'utf8')
const data=JSON.parse(read('../public/data/stage-motion-clock.json'))
const receipt=JSON.parse(read('fixtures/chibi-native-motion-clock.json'))
const hash=text=>createHash('sha256').update(text).digest('hex')
assert.equal(hash(read('../public/data/stage-motion-clock.json')),receipt.clockSha256)
assert.equal(receipt.constants.ticksPerBeat.value,480)
const songs=Object.entries(data.songs).map(([id,binding])=>({id,...binding}))
validateMotionClock(data,data.choreographyIndexSha256,songs)
assert.equal(songs.length,118);assert.equal(Object.keys(data.tracks).length,60)
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`)
const remasq=data.tracks.remasq,smlegg=data.tracks.smlegg
close(remasq.tempos[1].timeMs,27000)
close(remasq.tempos[2].timeMs,28836.73469387755)
close(smlegg.tempos[1].timeMs,1153.846153846154)
close(smlegg.tempos[2].timeMs,14487.17948717949)
assert.equal(smlegg.bgmOffsetSeconds,.025)
assert.equal(nativeMotionTempoAt(remasq,26999.999),160)
assert.equal(nativeMotionTempoAt(remasq,27000),196)
assert.equal(nativeMotionTempoAt(smlegg,-2000),156)
assert.equal(nativeMotionTempoAt(smlegg,smlegg.tempos[1].timeMs),90)
const drive=data.tracks.drvalv
assert.equal(nativeMotionTempoAt(drive,0),140)
assert.equal(nativeMotionSpeed(drive,{time:0,speed:1000}),.875)
assert.equal(nativeMotionSpeed({tempos:[{timeMs:0,bpm:80}]},{time:0,speed:1000}),.5)
assert.equal(nativeMotionSpeed(drive,{time:0,speed:0}),0,'Explicit zero cannot become speed=1')
assert.equal(nativeMotionMixWindowMs(drive,{time:0,speed:0,mode:2}),Infinity)
assert.equal(nativeMotionMixWindowMs(drive,{time:0,speed:1000,mode:3}),0)
close(nativeMotionMixWindowMs({tempos:[{timeMs:0,bpm:80}]},{time:0,speed:1000,mode:2}),300)
const old={time:26000,speed:1000}
assert.equal(nativeMotionSpeed(remasq,old),1,'A motion started before the BPM change keeps its latched scale')
assert.equal(nativeMotionSpeed(remasq,{...old,time:28000}),Math.fround(1.225))
assert.throws(()=>nativeMotionSpeed(null,old),/unavailable/)
assert.throws(()=>nativeMotionSpeed(drive,{time:0,speed:NaN}),/Invalid/)
assert.equal(motionClockForSong(data,{...songs[0],source:'foreign.csv'}),null)
assert.throws(()=>validateMotionClock(data,'a'.repeat(64),songs),/does not match/)
const bad=structuredClone(data);bad.tracks.drvalv.tempos[0].timeMs=25
assert.throws(()=>validateMotionClock(bad,data.choreographyIndexSha256,songs),/segment/)
const badBpm=structuredClone(data);badBpm.tracks.drvalv.tempos[0].bpm=0
assert.throws(()=>validateMotionClock(badBpm,data.choreographyIndexSha256,songs),/segment/)
const badTime=structuredClone(data);badTime.tracks.remasq.tempos[1].timeMs+=1
assert.throws(()=>validateMotionClock(badTime,data.choreographyIndexSha256,songs),/segment/)

const source=read('../src/utils/liveChibiSpine.js')
const body=source.match(/export async function fetchLiveChibiMotionClock\([^]*?\n\}/)[0]
const make=new Function('indexTransport','LIVE_CHIBI_BASE','validateMotionClock','crypto',
  body.replace('export async function','async function')+';return fetchLiveChibiMotionClock')
const choreographyText=JSON.stringify({songs}),fake={...data,choreographyIndexSha256:hash(choreographyText)}
const load=make({async load(url){return url.startsWith('/data/')?JSON.stringify(fake):choreographyText}},'/assets/live-chibi',validateMotionClock,globalThis.crypto)
assert.equal(Object.keys((await load('choreography/index.json')).tracks).length,60)
const abort=new AbortController();abort.abort()
await assert.rejects(load('index.json',{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(make({async load(){throw Error('HTTP 404')}},'',validateMotionClock,globalThis.crypto)('index.json'),/404/)
await assert.rejects(make({async load(url){return url.startsWith('/data/')?JSON.stringify(data):choreographyText}},'',validateMotionClock,globalThis.crypto)('index.json'),/does not match/)
assert.match(source,/spine\.stateData\.defaultMix = 0\b/,'Actual runtime must use the native empty mix table')
const sfc=read('../src/components/ChibiStageViewer.vue')
assert.ok(sfc.indexOf('motionClockData.value = await fetchLiveChibiMotionClock')<sfc.indexOf('    initializeLineup()'))
assert.match(sfc,/nativeMotionSpeed\(motionClockTrack.value,event\)/)
assert.match(sfc,/runtime.motionSpeedScale \?\? 1/)

// Execute the actual SFC transport functions with an independent native
// audio/live-clock witness. A +25ms source offset makes an action at 1s
// occur at media .975s, and audio sample zero represents native .025s.
const offsetTrack={bgmOffsetSeconds:.025},offsetMs=Math.fround(.025)*1000
close(clock.nativeStageTimeFromAudio(offsetTrack,1),1025.000000372529)
close(clock.nativeStageAudioTime(offsetTrack,1000),.974999999627471)
close(clock.nativeStageAudioStartTime(offsetTrack,0),25.00000037252903)
assert.equal(clock.nativeStageAudioTime(offsetTrack,0),0)
const gates=clock.nativeSingerEventsForAudio(offsetTrack,[{time:0,singers:[1]},{time:1000,singers:[2]}])
close(gates[0].time,-25.00000037252903);close(gates[1].time,974.999999627471)
assert.deepEqual(gates[0].singers,[1])
assert.throws(()=>clock.nativeStageAudioTime(null,1000),/unavailable/)
const ref=value=>({value}),audio={duration:10,currentTime:1,paused:false,pause(){this.paused=true}}
const c={...clock,motionClockTrack:ref(offsetTrack),stageVocalEnabled:ref(false),stageVocalReady:ref(false),
  stageTime:ref(0),stageDuration:ref(20000),playing:ref(true),stageStarting:ref(false),preloading:ref(false),
  stageVocalSession:{currentTime:ref(2),playing:ref(true),duration:ref(10),seek(s){this.currentTime.value=s},pause(){}},
  stageAudioTailActive:false,
  stagePlaybackAudios:()=>[audio],stageClockAudio:()=>audio,stageIntent:{cancel(){}},
  animationFrame:1,cancelAnimationFrame(){},syncMotionPlaybackSpeed(){},
  backmonitorVideo:null,backmonitorTransitionVideo:null,backmonitorTransitionAlphaVideo:null,
  frameCap:()=>0,lastStageFrame:0,performance:{now:()=>0},selectedSong:ref({}),
  playbackStartOffset:0,playbackStartedAt:0,playbackSpeed:ref(1),stageTransportReady:ref(false),
  activeSlots:ref([]),resetEventIndices(){},applyCurrentLipSync(){},syncStageVocalMix(){},
  syncStageBackground(){},syncSpotlights(){},syncLaserlights(){},syncPinspotlights(){},
  applyStageLighting(){},applyCameraTransform(){},syncBackmonitor(){},syncImageLayers(){},syncObjectLayers(){},app:null,
}
vm.createContext(c)
for(const name of ['syncStagePlaybackTime','updateStage','stopStage','seekStage'])
  vm.runInContext(sfc.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0],c)
c.syncStagePlaybackTime(1000);close(audio.currentTime,.974999999627471)
c.updateStage(500);close(c.stageTime.value,1000)
c.stopStage();close(c.stageTime.value,1000)
c.playing.value=true;c.stageVocalEnabled.value=true;c.stageVocalReady.value=true
c.stageVocalSession.currentTime.value=2;c.updateStage(1000);close(c.stageTime.value,2025.000000372529)
c.stageVocalSession.currentTime.value=10;c.stageVocalSession.playing.value=false
c.updateStage(2000);close(c.stageTime.value,10025.000000372529)
c.updateStage(2016);close(c.stageTime.value,10041.000000372529)
c.playbackSpeed.value=.5;c.updateStage(2032);close(c.stageTime.value,10049.000000372529)
c.stageVocalEnabled.value=false;audio.ended=true;audio.currentTime=10;c.stageAudioTailActive=false;c.stageTime.value=0
c.updateStage(3000);c.updateStage(3016);close(c.stageTime.value,10033.000000372529)
c.stopStage();close(c.stageTime.value,10033.000000372529)
c.playing.value=true;c.stageAudioTailActive=true;c.stageDuration.value=10050;c.stageTransportReady.value=true
c.syncPinspotlights=c.syncImageLayers=c.syncObjectLayers=()=>Promise.resolve()
c.updateStage(3050);assert.equal(c.playing.value,false);assert.equal(c.stageTime.value,10050)
c.stageDuration.value=20000;c.stageTransportReady.value=false
c.stageVocalEnabled.value=true
c.stageTime.value=7000;await c.seekStage();close(c.stageTime.value,7000)
close(c.stageVocalSession.currentTime.value,6.974999999627471)
c.stopStage(true);assert.equal(c.stageTime.value,0);assert.equal(c.stageVocalSession.currentTime.value,0)
c.playing.value=true;c.stageVocalSession.currentTime.value=30;c.stopStage();assert.equal(c.stageTime.value,20000)
c.stageVocalEnabled.value=false;c.stageVocalReady.value=false;c.playing.value=true;audio.currentTime=30
c.stopStage();assert.equal(c.stageTime.value,20000)
assert.match(sfc,/events: nativeSingerEventsForAudio\(motionClockTrack.value,/)
assert.match(sfc,/nativeStageAudioStartTime\(motionClockTrack.value,stageTime.value\)/)
const durationBody=sfc.match(/const stageDuration = computed\(\(\) => Math.max\([^]*?\n\)\)/)[0]
const durationAt=new Function('selectedSong','selectedSongAudio','selectedStageVocalExperiment','motionClockTrack','nativeStageAudioOffsetMs',
  'const computed=f=>f();'+durationBody+';return stageDuration')
close(durationAt(ref({duration:2000}),ref({duration:10000}),ref(null),ref(offsetTrack),clock.nativeStageAudioOffsetMs),10025.000000372529)
assert.equal(durationAt(ref({duration:20000}),ref({duration:10000}),ref(null),ref(offsetTrack),clock.nativeStageAudioOffsetMs),20000)
console.log('PASS native audio offset sign/float boundary, media seek/start, singer gates, actual SFC official/vocal frame/pause/seek/reset/end clamp')
if(process.argv.includes('--published-assets')) {
  const text=read('../public/assets/live-chibi/choreography/index.json'),corpus=JSON.parse(text).songs
  validateMotionClock(data,hash(text),corpus)
  let commands=0,changed=0
  for(const song of corpus)for(const event of song.events) {
    const track=motionClockForSong(data,song),speed=nativeMotionSpeed(track,event)
    assert.ok(Number.isFinite(speed)&&speed>=0)
    if(Math.abs(speed-event.speed/1000)>1e-6)changed++
    commands++
  }
  assert.equal(commands,21860)
  console.log(`Corpus native speed: ${commands} commands, ${changed} differ from the former speed-only scale`)
}
console.log('PASS RAW-bound conductor clocks, native 480 ticks, tempo boundary/prelude, latched float speeds, mix windows, zero speed, required loader hash/identity/abort/error and source wiring')
