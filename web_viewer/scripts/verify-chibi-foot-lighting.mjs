import assert from 'node:assert/strict'
import fs from 'node:fs'
import { footLightingAt, localHeightRow, shadeFootPixel, syncFootLighting, releaseFootLighting } from '../src/core/chibiFootLighting.js'
const events=[{time:-2000,color:'#002a51',opacity:1000,duration:1},
 {time:6000,color:'#000000',opacity:0,duration:1000}]
const sampled=footLightingAt(events,5100),state={rgb:[0,42/255,81/255],height:600},pixel=[.8,.4,.2,1]
assert.equal(sampled.rate,1000)
assert.equal(sampled.height,0,'Unverified CSV rate must not enable a speculative gradient')
assert.deepEqual(shadeFootPixel(pixel,0,sampled),pixel,'Unresolved authored mapping retains the shoe texture')
assert.deepEqual(shadeFootPixel(pixel,1500,state),pixel,'Above the cutoff the face retains its texture')
assert.deepEqual(shadeFootPixel(pixel,0,state),[0,42/255,81/255,1],'Foot uses native replacement, not whole-body multiplication')
assert.deepEqual(shadeFootPixel([0,0,0,0],0,state),[0,0,0,0],'Transparent mesh remains transparent')
assert.equal(footLightingAt(events,6500).rate,500)
assert.equal(footLightingAt(events,7000).height,0)
assert.deepEqual(footLightingAt(events,5100),sampled,'Rewind cannot keep the later clear')
assert.deepEqual(footLightingAt([],5100),{rgb:[0,0,0],height:0,rate:0},'A song without foot controls clears the gradient')
// The same native-local point stays at the same gradient height after moving,
// resizing, reflecting or rotating the performer/camera; never use screen Y.
for (const m of [{a:.3,b:0,c:0,d:.3,tx:500,ty:700},
 {a:0,b:.5,c:-.5,d:0,tx:200,ty:400},{a:-.6,b:.2,c:.1,d:.4,tx:0,ty:800}]) {
 const row=localHeightRow(m),x=100,y=-600
 const wx=m.a*x+m.c*y+m.tx,wy=m.b*x+m.d*y+m.ty
 assert.ok(Math.abs(row[0]*wx+row[1]*wy+row[2]-600)<1e-8)
}
let destroyed=0
class Filter { constructor(vertex,fragment,uniforms) {this.uniforms=uniforms} destroy(){destroyed++} }
const other={},runtime={spine:{filters:[other],worldTransform:{a:1,b:0,c:0,d:1,tx:50,ty:300}}}
syncFootLighting({Filter},runtime,state,true)
const filter=runtime.footLightingFilter
filter.apply({applyFilter(){assert.deepEqual([...filter.uniforms.localHeight],[0,-1,300])}},null,null,null)
assert.equal(runtime.spine.filters[0],other)
syncFootLighting({Filter},runtime,state,false)
assert.deepEqual(runtime.spine.filters,[other],'Lighting toggle preserves unrelated filters')
syncFootLighting({Filter},runtime,state,true)
assert.equal(runtime.footLightingFilter,filter,'Seeks reuse the GPU filter')
releaseFootLighting(runtime);assert.equal(destroyed,1);assert.deepEqual(runtime.spine.filters,[other])
// Exercise the real SFC body branch: unbound environment lamps must not
// replace every face with their dark floor/environment color.
const source=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const body=source.slice(source.indexOf('  // Foot_Color is a local height replacement gradient.'),source.indexOf('\nfunction syncSpotlightBackground()'))
const bodyBranch=body.slice(0,body.lastIndexOf('\n}'))
const ref=value=>({value})
const bodyRuntimes=new Map([[2,{spine:{}}],[3,{spine:{}}]])
let spots=[],pins=[],gradientCalls=0
const tintControls=ref(new Map())
const applyBody=new Function('currentFootLighting','spotlightStatesAt','pinspotlightStatesAt','stageTime','parseHexColor','runtimes','mixRgb','currentBodyColors','multiplyBodyTint','syncFootLighting','PIXI','appliedBodyColors','activePositions','playing','inspectorOpen',`return () => {${bodyBranch}\n}`)(
 ref(state),()=>new Map(spots.map((s,i)=>[i,s])),()=>new Map(pins.map((s,i)=>[i,s])),ref(5200),
 c=>c?parseInt(c.slice(1),16):0x221d23,bodyRuntimes,
 (a,b,f)=>f===0?a:f===1?b:0x808080,tintControls,(a,b)=>b??a,
 ()=>{gradientCalls++},{},ref(''),ref([2,3]),ref(false),ref(false))
const environment={alpha:1,beamColor:'#ffffff',asset:'Pinspotlight',environmentColor:'#000000',environmentOpacity:1000}
spots=[environment];pins=[environment];applyBody()
assert.equal(bodyRuntimes.get(2).spine.tint,0xffffff,'Free/offstage environment does not black out the face')
assert.equal(bodyRuntimes.get(3).spine.tint,0xffffff)
pins=[{...environment,stagePosition:2}];applyBody()
assert.notEqual(bodyRuntimes.get(2).spine.tint,0,'Targeted Pin performer stays lit')
assert.equal(bodyRuntimes.get(3).spine.tint,0,'Other performers retain addressed Pin dimming')
pins=[];spots=[{...environment,stagePosition:3}];applyBody()
assert.equal(bodyRuntimes.get(2).spine.tint,0,'Other performers retain addressed Spotlight dimming')
assert.notEqual(bodyRuntimes.get(3).spine.tint,0)
spots=[];tintControls.value=new Map([[2,0x123456]]);applyBody()
assert.equal(bodyRuntimes.get(2).spine.tint,0x123456,'Explicit Body_Color remains independent')
assert.equal(bodyRuntimes.get(3).spine.tint,0xffffff,'Rewind/song change leaves no stale lamp dimming')
assert.equal(gradientCalls,8,'Foot gradient is wired to every performer independently of body tint')
if (process.argv.includes('--published-assets')) {
 const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url)))
 const growing=index.songs.find(s=>s.id==='grwsml_live_effect')
 assert.equal(footLightingAt(growing.characterLightEvents,5200).rate,1000)
 assert.equal(footLightingAt(growing.characterLightEvents,5200).height,0)
 assert.deepEqual(shadeFootPixel(pixel,1500,footLightingAt(growing.characterLightEvents,5200)),pixel)
 assert.equal(index.songs.filter(s=>s.characterLightEvents?.length).length,112)
}
console.log('PASS unresolved Foot mapping guard, native gradient interface, independent body controls, seek/clear and filter disposal')
