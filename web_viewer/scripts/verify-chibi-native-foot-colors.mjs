import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SkeletonBinary } from '@pixi-spine/runtime-3.8'
import { footUniformsAt, NATIVE_SKELETON_SCALE as S } from '../src/core/chibiNativeFootColors.js'
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
console.log('PASS native skeleton units, reciprocal cutoff tween, independent RGBA, concurrent writers, immediate erase, affine height and all 2161 source controls')
