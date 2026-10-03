import assert from 'node:assert/strict'
import fs from 'node:fs'
import { stagelightStatesAt, sampleStagelight, createStagelightRuntime } from '../src/core/chibiStagelights.js'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-stagelight-events.json', import.meta.url)))
for (const [code, track] of Object.entries(fixture.songs)) {
  const state = t => stagelightStatesAt(track.events, t).get(17)
  assert.equal(sampleStagelight(state(22700), 22700).color, code === 'tkstp1' ? 0x00ccbb : 0xed8b00)
  assert.equal(sampleStagelight(state(26400), 26400).color, code === 'tkstp1' ? 0xff0000 : 0xff00cc)
  state(119000)
  assert.equal(sampleStagelight(state(22700), 22700).color, code === 'tkstp1' ? 0x00ccbb : 0xed8b00)
  assert.equal(stagelightStatesAt(track.events, -3000).size, 0)
}
const events = [{time:0,id:1,asset:'a',color:'#ff0000',colorMode:1},
  {time:100,id:1,asset:'a',color:'#0000ff',colorMode:2,period:100},
  {time:150,id:1,hide:true,fadeDuration:100}]
const sample = t => sampleStagelight(stagelightStatesAt(events,t).get(1),t)
assert.equal(sample(150).color, 0x800080)
assert.equal(sample(200).alpha, .5)
assert.equal(sample(250).alpha, 0)
// RAW front-row array: adjacent 450/225 lamps exchange brightness while the
// even/odd subsequences stay in phase. Verify fades both ways, including seeks.
const pulse = fixture.songs.tkstp1.events.find(e => e.time === 22150)
assert.equal(pulse.period,450); assert.equal(pulse.interval,225)
const lamps = t => Array.from({length:31},(_,i)=>sampleStagelight(pulse,t,i,31).alpha)
assert.deepEqual(lamps(22150).slice(0,4),[1,0,1,0])
assert.deepEqual(lamps(22375).slice(0,4),[0,1,0,1])
for (const delta of [1,55,112.5,224,226,337.5,449,900]) {
 const values=lamps(22150+delta)
 assert.ok(Math.abs(values[0]+values[1]-1)<1e-10)
 assert.equal(values[0],values[2]); assert.equal(values[1],values[3])
}
assert.ok(lamps(22200)[0]>lamps(22250)[0])
assert.ok(lamps(22400)[0]<lamps(22450)[0])
const hidden={...pulse,hideTime:22200,fadeDuration:100}
for(let i=0;i<31;i++) assert.ok(Math.abs(sampleStagelight(hidden,22250,i,31).alpha-lamps(22200)[i]*.5)<1e-10)
assert.deepEqual(lamps(22150).slice(0,4),[1,0,1,0])
const vector = () => ({set(...v){this.v=v}})
class Container {constructor(){this.children=[]} addChild(s){this.children.push(s)}}
class Sprite {constructor(texture){this.texture=texture;this.anchor=vector();this.position=vector();this.scale=vector()}}
const layers = [{asset:'a',x:30,y:-24,scaleX:.5,scaleY:.2,anchorX:.5,anchorY:.5},
  {asset:'a',x:-30,y:-24,scaleX:.5,scaleY:.2,anchorX:.5,anchorY:.5}]
const camera=new Container()
const runtime=createStagelightRuntime({Container,Sprite,BLEND_MODES:{ADD:'add'}},camera,layers,[1,1])
assert.deepEqual(runtime.sprites.map(s=>s.position.v),[[30,-24],[-30,-24]])
assert.deepEqual(runtime.sprites.map(s=>s.scale.v),[[.5,.2],[.5,.2]])
assert.ok(runtime.sprites.every(s=>s.blendMode==='add'))
let resolve, destroyed=0, created=0
const store=createSpotlightSpriteStore({layerCount:null,
 loadTexture:()=>new Promise(r=>{resolve=r}),createRuntime:()=>{created++;return{}},
 destroyRuntime(){},destroyTexture(){destroyed++},onReady(){},onError(e){throw e}})
store.ensure('song1:17:a',{layers},{a:{file:'a.png'}})
await Promise.resolve();store.release();resolve({});
for(let i=0;i<12;i++)await Promise.resolve()
assert.equal(created,0);assert.equal(destroyed,1)
if(process.argv.includes('--published-assets')) {
 const index=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
 for(const [code,track] of Object.entries(fixture.songs)) {
   assert.equal(index.stagelightSongs[code].events.length,track.allEvents)
   assert.deepEqual(index.stagelightSongs[code].events.filter(e=>e.id===17),track.events)
   assert.deepEqual(index.stagelightSongs[code].source,track.source)
 }
}
console.log('Take 01/02 colors, per-lamp interleaved fades, hide freeze, backward seek, ordered native geometry and stale texture disposal passed')
