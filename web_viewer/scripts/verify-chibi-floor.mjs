import assert from 'node:assert/strict'
import fs from 'node:fs'
import { attachChibiFloor,sampleFloorSystem,sampleFloorGradient,loadChibiFloor,updateChibiFloor } from '../src/core/chibiFloorParticles.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'
const model=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-floor-model.json',import.meta.url)))
const original={assets:{[model.asset]:{kind:'particle',bundle:model.bundle,particleCount:4}}}
assert.ok(attachChibiFloor(original,model).assets[model.asset].floorAnimation)
const coverage=buildStageVfxCoverage({id:'take',objectLayerEvents:[{asset:model.asset}]},
 {objectLayers:attachChibiFloor(original,model)})
assert.deepEqual(coverage.objectParticlePilots,[model.asset])
assert.deepEqual(coverage.objectParticleUnimplemented,[])
assert.equal(coverage.status,'partial')
for(const mutate of [m=>m.mask.texture='wrong',m=>m.systems[0].capacity=90000,
 m=>m.systems[0].source.pathId=7,m=>m.systems[0].rate=-1,m=>m.systems[0].texture='missing',
 m=>m.systems[0].alpha[1].time=0,m=>m.textures[m.mask.texture].file='../wrong.png']) {
 const bad=structuredClone(model);mutate(bad);assert.equal(attachChibiFloor(original,bad),original)
}
assert.equal(sampleFloorGradient([{time:0,value:0},{time:.25,value:1},{time:.75,value:1},{time:1,value:0}],.125),.5)
assert.equal(sampleFloorGradient([{time:0,value:0},{time:.25,value:1},{time:.75,value:1},{time:1,value:0}],.875),.5)
for(const s of model.systems) {
 assert.deepEqual(sampleFloorSystem(s,-2100,-2000),[])
 const a=sampleFloorSystem(s,5000,-2000),b=sampleFloorSystem(s,5100,-2000)
 assert.ok(a.length>0 && a.length<=s.capacity)
 assert.notDeepEqual(a,b)
 assert.deepEqual(sampleFloorSystem(s,5000,-2000),a)
 assert.ok(a.every(p=>p.alpha>=0 && p.alpha<=1 && p.size>0 && Number.isFinite(p.rotation)))
 assert.ok(new Set(a.map(p=>p.color)).size>1)
 const common=a.find(p=>b.some(q=>q.birth===p.birth));assert.ok(common)
 const next=b.find(p=>p.birth===common.birth);assert.equal(common.color,next.color)
 assert.notEqual(common.alpha,next.alpha)
}
const vector=()=>({set(...v){this.v=v}})
class Container {constructor(){this.children=[]}addChild(c){this.children.push(c)}destroy(){}}
class Sprite {constructor(t){this.texture=t;this.anchor=vector();this.position=vector()}}
class Texture {constructor(baseTexture,rect){this.baseTexture=baseTexture;this.rect=rect}destroy(){}}
class Rectangle {constructor(...v){this.v=v}}
const pixi={Container,Sprite,Texture,Rectangle,BLEND_MODES:{ADD:'add'}}
const runtime=await loadChibiFloor(pixi,model,async()=>({baseTexture:{},destroy(){}}))
assert.equal(runtime.floorEmitters.reduce((n,e)=>n+e.sprites.length,0),244)
assert.ok(runtime.container.children[0].mask)
assert.deepEqual(runtime.container.children[1].position.v,[model.mask.x,model.mask.y])
assert.deepEqual(runtime.frameTextures.map(t=>t.rect.v),[[512,256,256,256],[256,0,256,256]])
updateChibiFloor(runtime,5000,-2000);const signature=runtime.floorSignature
updateChibiFloor(runtime,5100,-2000);assert.notEqual(signature,runtime.floorSignature)
updateChibiFloor(runtime,5000,-2000);assert.equal(signature,runtime.floorSignature)
let disposed=0
await assert.rejects(loadChibiFloor(pixi,model,async path=>{
 if(path.includes('nebula'))throw new Error('missing texture')
 return {destroy(){disposed++}}
}))
assert.equal(disposed,2)
if(process.argv.includes('--published-assets')) {
 assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/floor-particles/index.json',import.meta.url))),model)
}
console.log('Take floor source guards, native gradient/alpha witnesses, bounded 244-sprite pools, masked atlas binding, seek/pause and failed texture cleanup passed')
