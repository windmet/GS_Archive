import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import vm from 'node:vm'
import {validateSmokeData,smokeAt} from '../src/core/chibiSmoke.js'
import {SMOKE_BINDING,smokeMotionAt} from '../src/core/chibiSmokeMotion.js'
import {sampleObjectEmitter} from '../src/core/chibiObjectEmitters.js'
import {createSmokeRenderer} from '../src/core/chibiSmokeRenderer.js'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url)),sha=b=>crypto.createHash('sha256').update(b).digest('hex')
const bytes=read('public/data/stage-smoke.json'),data=JSON.parse(bytes),raw=JSON.parse(read('scripts/fixtures/chibi-smoke-source.json'))
assert.equal(sha(bytes),SMOKE_BINDING.dataSha256)
assert.equal(data.sourceSha256,sha(read('scripts/fixtures/chibi-smoke-source.json')))
assert.equal(validateSmokeData(data,raw.choreographyIndexSha256),data)
assert.throws(()=>validateSmokeData(data,'0'.repeat(64)),/binding/)
for(const [name,digest] of Object.entries(data.nativeProofs))assert.equal(digest,sha(read(`scripts/fixtures/chibi-smoke-${name}-native.json`)))
for(const texture of Object.values(data.textures)){
  const png=read('public'+texture.file)
  assert.equal(sha(png),texture.pngSha256);assert.equal(png.length,texture.bytes)
  assert.equal(png.readUInt32BE(16),texture.width);assert.equal(png.readUInt32BE(20),texture.height)
}
assert.deepEqual(data.groups,{'1':['48102','48919'],'2':['47934','47502','48326','49636']})
for(const system of data.systems){
  const source=raw.particles.find(p=>p.pathId===system.source.pathId)
  assert.equal(system.capacity,source.modules.InitialModule.maxNumParticles)
  assert.equal(system.looping,source.main.looping);assert.equal(system.rate,source.modules.EmissionModule.rateOverTime.scalar)
  assert.equal(system.lifetime.mode,source.modules.InitialModule.startLifetime.minMaxState)
  assert.equal(system.randomizeRotationDirection,source.modules.InitialModule.randomizeRotationDirection)
  const samples=sampleObjectEmitter(system,1500,0)
  assert.ok(samples.length>0,system.name)
  assert.deepEqual(sampleObjectEmitter(system,1500,0),samples,'warm seek must be deterministic')
  sampleObjectEmitter(system,8000,0)
  assert.deepEqual(sampleObjectEmitter(system,1500,0),samples,'rewind must reset motion grid')
  assert.deepEqual(sampleObjectEmitter(structuredClone(system),1500,0),samples,'cold seek')
  assert.equal(sampleObjectEmitter(system,22000,0,18000).length,0,'stopped particles retire')
  if(!system.looping)assert.equal(sampleObjectEmitter(system,20000,0).length,0,'side group does not loop')
  assert.throws(()=>sampleObjectEmitter({...system,source:{...system.source,parameterTreeSha256:'0'.repeat(64)}},1000,0),/Unbound Smoke/)
}
for(const id of data.groups[1]){
  const system=data.systems.find(s=>s.source.pathId===id)
  assert.equal(system.lifetime.minScalar,2.5);assert.equal(system.lifetime.scalar,3)
  const sample=sampleObjectEmitter(system,1500,0)[0]
  assert.equal(Math.hypot(sample.a,sample.b),2000)
  assert.equal(Math.hypot(sample.c,sample.d),system.sizeY.scalar*100)
  const clipped=sampleObjectEmitter(system,1500,0,Infinity,{height:.2})[0]
  assert.ok(Math.abs(Math.hypot(clipped.a,clipped.b)-1000)<1e-6)
  assert.ok(Math.abs(Math.hypot(clipped.c,clipped.d)-system.sizeY.scalar*50)<1e-6)
}
const quads=JSON.parse(read('scripts/fixtures/chibi-smoke-billboard-native.json'))
assert.equal(quads.consumerControls.length,36)
for(const control of quads.consumerControls){
  const source=data.systems.find(s=>s.source.pathId===control.source.pathId)
  assert.deepEqual(source.source,control.source)
  const system={...source,rate:0,bursts:[{time:0,count:1}],looping:false,capacity:1,
    rotation:{mode:0,scalar:control.angle},randomizeRotationDirection:0,angularVelocity:null,sizeOverLife:null,sizeOverLifeY:null}
  const sample=sampleObjectEmitter(system,100,0,Infinity,{height:control.viewHeight})[0]
  const center=[0,1].map(axis=>control.expected.reduce((sum,p)=>sum+p.position[axis],0)/4)
  for(const [corner,[u,v]] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].entries()){
    assert.ok(Math.abs(sample.a*u+sample.c*v-(control.expected[corner].position[0]-center[0])*100)<.001,'native Smoke world-quad X')
    assert.ok(Math.abs(sample.b*u+sample.d*v+(control.expected[corner].position[1]-center[1])*100)<.001,'native Smoke world-quad Y / PNG orientation')
  }
}
const sampleTrack=(track,time)=>{
  const state=smokeAt(track,time)
  return (data.groups[state.variant]||[]).flatMap(id=>state.epochs.flatMap(epoch=>sampleObjectEmitter(data.systems.find(s=>s.source.pathId===id),time,epoch.start,epoch.stop??Infinity)))
}
const short=data.songs.strclb_live_effect,long=data.songs.tnsdst_live_effect
assert.equal(sampleTrack(short,1000).length,0)
assert.ok(sampleTrack(short,3000).length>0)
assert.ok(sampleTrack(short,7100).length>0,'Erase value102=100 must not fade/disable particles')
assert.equal(sampleTrack(short,10000).length,0)
assert.ok(sampleTrack(long,0).length>0,'pre-zero Show contributes living history')
assert.ok(sampleTrack(long,18500).length>0,'Erase value102=1800 does not control life')
assert.equal(sampleTrack(long,22000).length,0)
assert.equal(sampleTrack(long,119900).length,0)
assert.ok(sampleTrack(long,121500).length>0,'later Show restarts emission')
assert.deepEqual(sampleTrack(long,0),sampleTrack(long,0),'cold/rewound lifecycle')
assert.equal(smokeAt(long,121500).epochs.length,2)
assert.equal(smokeAt(long,0).epochs.length,1)

class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height})}}
class Texture{constructor(baseTexture,frame){Object.assign(this,{baseTexture,frame})}destroy(){this.destroyed=true}}
class Sprite{constructor(texture){this.texture=texture;this.anchor={set(){}};this.transform={setFromMatrix(value){this.matrix=value}}}}
class Container{constructor(){this.children=[];this.position={set(){}};this.scale={set(){}}}addChild(child){child.parent=this;this.children.push(child)}removeFromParent(){this.parent=null}destroy(){this.destroyed=true}}
class Matrix{constructor(a,b,c,d,tx,ty){Object.assign(this,{a,b,c,d,tx,ty})}}
const PIXI={Rectangle,Texture,Sprite,Container,Matrix,BLEND_MODES:{NORMAL_NPM:0,ADD_NPM:1}}
const loaded=[]
const load=async file=>{const m=Object.values(data.textures).find(t=>t.file===file),texture={width:m.width,height:m.height,baseTexture:{},destroy(){this.destroyed=true}};loaded.push(texture);return texture}
const renderer=createSmokeRenderer(PIXI,load),parent=new Container()
await renderer.prepare(data,short)
const render=time=>renderer.update(short,time,parent,1280,720,1,0,7.2,true)
assert.ok(render(3000).count>0);assert.ok(render(7100).count>0);assert.equal(render(10000).count,0)
assert.equal(renderer.update(short,3000,parent,1280,720,1,0,7.2,false).count,0)
assert.ok(render(3000).count>0)
assert.equal(parent.children[0].zIndex,1500)
renderer.clear();assert.ok(loaded.every(t=>t.destroyed),'old textures released')
const sideTrack={events:[{time:0,variant:2,depth:1900,hide:false}]}
await renderer.prepare(data,sideTrack)
assert.ok(renderer.update(sideTrack,1500,parent,390,844,1,0,7.2,true).count>0,'all four side emitters use the same consumer')
assert.equal(renderer.update(sideTrack,20000,parent,390,844,1,0,7.2,true).count,0)
renderer.clear()
let resolveLate
const lateTexture={width:171,height:1024,baseTexture:{},destroy(){this.destroyed=true}}
const late=createSmokeRenderer(PIXI,()=>new Promise(resolve=>{resolveLate=resolve}))
const pending=late.prepare(data,short);late.clear();resolveLate(lateTexture);await pending
assert.equal(lateTexture.destroyed,true,'late asset ownership after scene clear')
assert.equal(late.update(short,3000,parent,1280,720,1,0,7.2,true).count,0)

const loaderSource=read('src/utils/liveChibiSpine.js').toString()
const loaderBody=loaderSource.match(/export async function fetchLiveChibiSmoke\([^]*?\n\}/)[0].replace('export ','')
const loaderContext={indexTransport:{load:async()=>({data,hash:async()=>SMOKE_BINDING.dataSha256})},LIVE_CHIBI_BASE:'/assets/live-chibi',
  validateChoreographyBinding:()=>({sha256:raw.choreographyIndexSha256}),SMOKE_BINDING,validateSmokeData,DOMException}
vm.createContext(loaderContext);vm.runInContext(loaderBody,loaderContext)
assert.equal(await loaderContext.fetchLiveChibiSmoke('choreography/index.json',{binding:{}}),data)
loaderContext.indexTransport.load=async()=>({data,hash:async()=>'0'.repeat(64)})
await assert.rejects(()=>loaderContext.fetchLiveChibiSmoke('choreography/index.json',{binding:{}}),/payload identity/)
await assert.rejects(()=>loaderContext.fetchLiveChibiSmoke('choreography/index.json',{binding:{},signal:{aborted:true}}),/cancelled/)

const viewer=read('src/components/ChibiStageViewer.vue').toString(),start=viewer.indexOf('async function prepareSmoke()'),end=viewer.indexOf('\nasync function prepareStageLighting()',start)
assert.ok(start>0&&end>start)
const song={id:'strclb_live_effect',songCode:short.songCode,source:short.source}
const context={selectedSong:{value:song},SMOKE_BINDING,smokeRenderer:{clear(){},async prepare(d,t){assert.equal(t,short)}},
  smokeStatus:{value:''},smokeData:{value:null},smokeFailedSong:'',objectLayersEnabled:{value:true},manifest:{value:{choreography:{index:'choreography/index.json'}}},
  lifetime:{signal:new AbortController().signal},choreography:{value:{}},stageDisposed:false,fetchLiveChibiSmoke:async()=>data,console}
vm.createContext(context);vm.runInContext(viewer.slice(start,end),context)
assert.equal(await context.prepareSmoke(),true);assert.equal(context.smokeStatus.value,'ready')
context.smokeData.value=null
context.fetchLiveChibiSmoke=async()=>{context.selectedSong.value={id:'another'};return data}
assert.equal(await context.prepareSmoke(),false,'late input must not bind to a different arrangement')
assert.equal(context.smokeData.value,null)
assert.match(viewer,/await prepareSmoke\(\)/)
assert.match(viewer,/smokeRenderer\.update\(/)
assert.equal((viewer.match(/smokeRenderer\.clear\(\)/g)||[]).length,3,'unmount, switch and no-track release')
console.log('PASS Smoke consumer: all 6 systems, all 5 source rows, stop tails/pre-zero/restart, cold/rewind, both groups, fractional frames, scene disposal and actual SFC prepare ownership; deterministic preview')
