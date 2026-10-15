import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { stagelightStatesAt, sampleStagelight, createStagelightRuntime, applyNativeLampColor, validateStagelightData } from '../src/core/chibiStagelights.js'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'
const data=JSON.parse(fs.readFileSync(new URL('../public/data/stage-stagelight-commands.json',import.meta.url)))
const hash=process.argv.includes('--published-assets')?crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url))).digest('hex'):data.choreographyIndexSha256
validateStagelightData(data,hash)
assert.equal(Object.keys(data.songs).length,118);assert.equal(data.eventCount,29661)
assert.throws(()=>validateStagelightData(data,'0'.repeat(64)))
const events=data.songs.flslgt_live_effect.events
const state=(t,id=8)=>stagelightStatesAt(events,t).get(id)
const sample=(t,id=8)=>sampleStagelight(state(t,id),t)
assert.equal(state(85000).colorMode,1);assert.equal(state(85000).alphaMode,2)
assert.notEqual(sample(85000).color,sample(85500).color)
assert.equal(sample(85500).alpha,1)
assert.equal(state(93300),undefined)
assert.equal(sample(93400).alpha,0);assert.equal(sample(93425).alpha,.75)
assert.equal(sample(93450).alpha,1);assert.equal(sample(94000).color,0xff0000)
assert.equal(state(93450,9),undefined);assert.equal(sample(93550,9).color,0xff0000)
assert.equal(sample(100000).alpha,1);assert.equal(state(101600),undefined)
assert.deepEqual(sample(85500),sample(85500)) // sampling after ending never changes replay state
const base={time:0,id:1,asset:'a',color:'#ff0000',colorMode:0,alphaMode:1,period:100,interval:20}
assert.equal(sampleStagelight(base,25).alpha,.75)
assert.equal(sampleStagelight(base,75).alpha,.25)
assert.equal(sampleStagelight(base,110).alpha,0)
assert.equal(sampleStagelight({...base,alphaMode:5,interval:50},25,1,2).alpha,0)
assert.equal(sampleStagelight({...base,alphaMode:5,interval:50},75,1,2).alpha,.5)
assert.equal(sampleStagelight({...base,alphaMode:6,interval:100},150,1,3).alpha,1)
assert.equal(sampleStagelight({...base,alphaMode:7,interval:100},50,2,3).alpha,1)
assert.equal(sampleStagelight({...base,alphaMode:4,tempo:120},250).alpha,.5)
const gradient={...base,alphaMode:2,colorMode:1,colorPeriod:100,gradientColor:'#0000ff'}
assert.equal(sampleStagelight(gradient,50).color,0x800080)
assert.equal(sampleStagelight(gradient,150).color,0x800080)
assert.equal(sampleStagelight(gradient,200).color,0xff0000)
assert.equal(sampleStagelight({...base,colorMode:1,alphaMode:2,colorPeriod:600,direction:0},100).color,0xffff00)
assert.equal(sampleStagelight({...base,colorMode:1,alphaMode:2,colorPeriod:600,direction:1},100).color,0xff00ff)
const assigned=stagelightStatesAt([base,{...base,time:100,asset:'b',color:null,alphaMode:0}],200).get(1)
assert.equal(assigned.asset,'a');assert.equal(sampleStagelight(assigned,200).color,0xff0000)
const native={nativeColor:{r:0,g:.5,b:0,a:.2}}
assert.deepEqual(sampleStagelight({...base,color:null,alphaMode:0},0,0,1,native),{color:0x008000,alpha:.2})
assert.deepEqual(sampleStagelight({...base,alphaMode:0},0,0,1,native),{color:0xff0000,alpha:1})
for(const track of Object.values(data.songs))for(const e of track.events)if(!e.hide){
 if(e.alphaMode===4)assert.equal(track.tempo.values.length,1)
 for(let i=0;i<3;i++){
  const lamp=sampleStagelight({...e,tempo:track.tempo.values[0]},e.time+123,i,3)
  assert.ok(Number.isInteger(lamp.color)&&lamp.color>=0&&lamp.color<=0xffffff)
  assert.ok(Number.isFinite(lamp.alpha)&&lamp.alpha>=0&&lamp.alpha<=1)
 }
}
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
class Texture {constructor(baseTexture,rect){this.baseTexture=baseTexture;this.rect=rect}}
class Rectangle {constructor(...v){this.v=v}}
const atlas=createStagelightRuntime({Container,Sprite,Texture,Rectangle,BLEND_MODES:{ADD:'add'}},camera,
 [{...layers[0],crop:{x:256,y:0,width:128,height:128},rotation:.25}],[{baseTexture:'original atlas'}])
assert.deepEqual(atlas.frameTextures[0].rect.v,[256,0,128,128])
assert.equal(atlas.sprites[0].rotation,.25)
assert.deepEqual(applyNativeLampColor({color:0xffffff,alpha:.5},{nativeColor:{r:1,g:.5,b:0,a:.8}}),{color:0xffffff,alpha:.5})
assert.equal(sampleStagelight({previewSupported:false},3000).alpha,0)
let resolve, destroyed=0, created=0
const store=createSpotlightSpriteStore({layerCount:null,
 loadTexture:()=>new Promise(r=>{resolve=r}),createRuntime:()=>{created++;return{}},
 destroyRuntime(){},destroyTexture(){destroyed++},onReady(){},onError(e){throw e}})
store.ensure('song1:17:a',{layers},{a:{file:'a.png'}})
await Promise.resolve();store.release();resolve({});
for(let i=0;i<12;i++)await Promise.resolve()
assert.equal(created,0);assert.equal(destroyed,1)
console.log('29661 native Stagelight rows / 118 arrangements: HSV, gradients, alpha 0-7, immediate erase, FLASH LIGHT persistent red, geometry and stale loads passed')
