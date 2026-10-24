import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SkeletonBinary } from '@pixi-spine/runtime-3.8'
import { footUniformsAt, addressedFootUniformsAt, validateFootSoloData, NATIVE_SKELETON_SCALE as S } from '../src/core/chibiNativeFootColors.js'
import {withStageIndexTransport} from './lib/stage-index-harness.mjs'
import {createHash} from 'node:crypto'
import { localHeightRow } from '../src/core/chibiFootLighting.js'
const close = (a,b) => assert(Math.abs(a-b)<1e-9, `${a} != ${b}`)
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-native-skeleton-units.json',import.meta.url)))
assert(fixture.bodies.every(b=>b.scale===S))
assert.equal(new SkeletonBinary({}).scale,fixture.webSkeletonBinaryScale)
const events=[{time:0,color:'#000000',opacity:1000,duration:1000,cutoff:1000},
 {time:1000,color:'#ff0000',opacity:500,duration:1000,cutoff:2000},
 {time:2000,hide:true}]
const a=footUniformsAt(events,500);close(a.rgba[3],.75);close(a.rcpHeight,.875*S)
const b=footUniformsAt(events,1500);close(b.rgba[0],.75);close(b.rgba[3],.625);close(b.rcpHeight,.625*S)
assert.deepEqual(footUniformsAt(events,2000).rgba,[0,0,0,0])
close(footUniformsAt(events,2000).rcpHeight,.5*S)
assert.deepEqual(footUniformsAt(events,500),a)
// Short new tween ends first: the still-running old DOTween writer resumes.
const overlap=[{time:0,color:'#000000',opacity:1000,duration:1000,cutoff:1000},
 {time:100,color:'#ffffff',opacity:0,duration:100,cutoff:2000}]
close(footUniformsAt(overlap,200).rgba[3],0)
close(footUniformsAt(overlap,201).rgba[3],1-(1-.201)**2)
const cleared=[overlap[0],{time:100,hide:true}]
close(footUniformsAt(cleared,100).rgba[3],0)
close(footUniformsAt(cleared,101).rgba[3],1-(1-.101)**2)
for(const m of [{a:.3,b:0,c:0,d:.3,tx:500,ty:700},
 {a:0,b:.5,c:-.5,d:0,tx:200,ty:400},{a:-.6,b:.2,c:.1,d:.4,tx:0,ty:800}]){
 const row=localHeightRow(m),x=100,y=-150,wx=m.a*x+m.c*y+m.tx,wy=m.b*x+m.d*y+m.ty
 close((row[0]*wx+row[1]*wy+row[2])*S,150*S)
}
const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url)))
const growing=index.songs.find(s=>s.id==='grwsml_live_effect')
const light=footUniformsAt(growing.characterLightEvents,5200)
close(light.rcpHeight,S);close(light.rgba[3],1);close(light.rgba[1],42/255)
let erases=0
for(const song of index.songs)for(const event of song.characterLightEvents){
 const state=footUniformsAt(song.characterLightEvents,event.time)
 assert(state.rgba.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert(state.rcpHeight>0)
 if(event.hide){erases++;assert.equal(state.rgba[3],0)}
}
assert.equal(erases,26)
const soloData=JSON.parse(fs.readFileSync(new URL('../public/data/stage-foot-solo.json',import.meta.url)))
const sha=text=>createHash('sha256').update(text).digest('hex')
const choreography=fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url),'utf8')
validateFootSoloData(soloData,sha(choreography));assert.equal(soloData.soloEventCount,241)
assert.throws(()=>validateFootSoloData(soloData,'0'.repeat(64)),/mismatch/)
assert.throws(()=>validateFootSoloData({...soloData,eventCount:0},sha(choreography)),/count/)
const soloSong=index.songs.find(song=>song.id==='gofrit_live_effect'),track=soloData.songs[soloSong.id]
for(const e of track.events)for(const t of [e.time,e.time+e.duration/2,e.time+e.duration]) {
 const material=addressedFootUniformsAt(soloSong,soloData,t)
 assert.equal(material.size,5)
 for(const entry of soloSong.stagePositionMap) {
  const expected=footUniformsAt(track.events.filter(e=>!e.target||e.target===entry.performerSlot),t,entry.performerSlot)
  assert.deepEqual(material.get(entry.stagePosition),expected)
 }
}
assert.equal(addressedFootUniformsAt({...soloSong,source:'stale.csv'},soloData,0).size,0)
assert.equal(addressedFootUniformsAt(growing,soloData,0).size,0,'Other songs retain global controls')
// These writers share one material. Solo erase is a tween; global erase is immediate.
const mixed=[{time:0,target:0,sourceRow:1,color:'#ff0000',opacity:1000,duration:0,cutoff:1000},
 {time:100,target:1,sourceRow:2,solo:true,color:'#0000ff',opacity:500,duration:100,cutoff:2000},
 {time:300,target:1,sourceRow:3,solo:true,hide:true,color:'#ffffff',opacity:0,duration:100,cutoff:0}]
assert.deepEqual(footUniformsAt(mixed,200,2).rgba,[1,0,0,1])
assert.deepEqual(footUniformsAt(mixed,200,1).rgba,[0,0,1,.5])
close(footUniformsAt(mixed,350,1).rgba[3],.125)
close(footUniformsAt(mixed,350,1).rcpHeight,S*.125)
assert.deepEqual(footUniformsAt(mixed,400,1),{rgba:[1,1,1,0],rcpHeight:0})
assert.deepEqual(footUniformsAt(mixed,150,1),footUniformsAt(mixed.slice(0,2),150,1))
const loaderSource=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const loaderBody=loaderSource.match(/export async function fetchLiveChibiFootSolo\([^]*?\n\}/)[0]
const makeLoader=withStageIndexTransport(new Function('indexTransport','LIVE_CHIBI_BASE','validateFootSoloData',loaderBody.replace('export async function','async function')+';return fetchLiveChibiFootSolo'))
const fake='{}',bound={...soloData,choreographyIndexSha256:sha(fake)}
const load=makeLoader({async load(url){return url.startsWith('/data/')?JSON.stringify(bound):fake}},'/assets/live-chibi',validateFootSoloData)
assert.equal((await load('choreography/index.json')).soloEventCount,241)
const abort=new AbortController();abort.abort();await assert.rejects(load('index.json',{signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({async load(){throw Error('404')}},'',validateFootSoloData)('index.json'),/404/)
console.log('PASS native skeleton units, reciprocal cutoff tween, independent RGBA, concurrent writers, immediate erase, affine height and all 2161 source controls')
console.log('PASS solo foot: 241 RAW commands, mapped targets, shared writers, erase tween, loader identity/cancellation/failure')
