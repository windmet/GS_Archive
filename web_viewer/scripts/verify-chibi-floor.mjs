import assert from 'node:assert/strict'
import fs from 'node:fs'
import { attachChibiFloor,sampleFloorSystem,sampleFloorGradient,loadChibiFloor,updateChibiFloor,CHIBI_VOLUME_FLOOR_PROFILE } from '../src/core/chibiFloorParticles.js'
import { buildStageVfxCoverage } from '../src/core/stageVfxCoverage.js'
import { CHIBI_FIRE_PROFILE, sampleFireSystem } from '../src/core/chibiFireFlipbook.js'
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
const pixi={Container,Sprite,Texture,Rectangle,BLEND_MODES:{ADD:'add',NORMAL:'normal'}}
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
 const published=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/floor-particles/index.json',import.meta.url)))
 assert.deepEqual(published.schemaVersion===2 ? published.assets[model.asset] : published,model)
}
console.log('Take floor source guards, native gradient/alpha witnesses, bounded 244-sprite pools, masked atlas binding, seek/pause and failed texture cleanup passed')
const catalog=JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-floor-catalog.json',import.meta.url)))
const indexed={assets:Object.fromEntries(Object.values(catalog.assets).map(m=>[m.asset,{kind:'particle',bundle:m.bundle,particleCount:m.particleCount}]))}
const attached=attachChibiFloor(indexed,catalog)
assert.equal(Object.values(attached.assets).filter(a=>a.floorAnimation).length,20)
assert.equal(catalog.inventory.length,49)
assert.equal(catalog.inventory.filter(r=>r.status==='deferred').length,29)
assert.equal(catalog.inventory.filter(r=>r.status==='registered_continuous_volume_profile').length,12)
assert.equal(catalog.inventory.filter(r=>r.status==='registered_partial_fire_flipbook_profile').length,1)
const toy=structuredClone(catalog.assets.fx_in_mtples_panel_1.systems[0])
toy.rate=1;toy.lifetime={mode:0,scalar:2,minScalar:2,keys:[]};toy.prewarmSeconds=0
toy.color={colors:[{time:0,r:1,g:1,b:1},{time:1,r:1,g:1,b:1}],alphas:[{time:0,value:1},{time:1,value:1}]}
toy.colorOverLife={colors:[{time:0,r:1,g:0,b:0},{time:1,r:0,g:0,b:1}],alphas:[{time:0,value:0},{time:1,value:1}]}
toy.alpha=toy.colorOverLife.alphas
assert.equal(sampleFloorSystem(toy,500,0)[0].color,0xbf0040)
assert.equal(sampleFloorSystem(toy,500,0)[0].alpha,.25)
assert.ok(sampleFloorSystem(catalog.assets.fx_in_cgtocc_panel_3.systems[0],0,0).length>100)
for(const entry of Object.values(catalog.assets).filter(e=>e.asset!==model.asset && e.profile!==CHIBI_FIRE_PROFILE)) {
 assert.equal(attached.assets[entry.asset].floorAnimation,entry)
 assert.notEqual(entry.mask.texture,model.mask.texture)
 const rt=await loadChibiFloor(pixi,entry,async()=>({baseTexture:{},destroy(){}}))
 assert.ok(rt.floorEmitters.reduce((n,e)=>n+e.sprites.length,0)<=(entry.profile===CHIBI_VOLUME_FLOOR_PROFILE ? 2048 : 512))
 updateChibiFloor(rt,5000,0); const previous=rt.floorSignature
 updateChibiFloor(rt,5250,0);assert.notEqual(previous,rt.floorSignature)
 updateChibiFloor(rt,5000,0);assert.equal(previous,rt.floorSignature)
 for(const s of entry.systems) {
  assert.deepEqual(sampleFloorSystem(s,-1,0),[])
  const a=sampleFloorSystem(s,2000,0),b=sampleFloorSystem(s,2050,0)
  assert.ok(a.length && a.length<=s.capacity)
  assert.ok(a.every(p=>p.alpha>=0 && p.alpha<=1 && Number.isFinite(p.x) && Number.isFinite(p.y)))
  assert.notDeepEqual(a,b)
 }
 for(const mutate of [m=>m.mask.width=-1,m=>m.bundle='wrong',m=>m.systems[0].capacity=10000,
  m=>m.systems[0].noiseParameters={},m=>m.systems[0].speedParameters.scalar=20,
  m=>m.systems[0].colorOverLife.alphas[0].time=2,m=>m.textures[m.mask.texture].file='../wrong.png']) {
  const bad=structuredClone(entry);mutate(bad)
  const result=attachChibiFloor(indexed,{schemaVersion:2,assets:{[bad.asset]:bad}})
  assert.ok(!result.assets[bad.asset].floorAnimation)
 }
}
if(process.argv.includes('--published-assets')) assert.deepEqual(JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/floor-particles/index.json',import.meta.url))),catalog)
const fire=catalog.assets.fx_in_knwonl_panel
assert.equal(attached.assets[fire.asset].floorAnimation,fire)
const fireCoverage=buildStageVfxCoverage({id:'fire',objectLayerEvents:[{asset:fire.asset}]},{objectLayers:attached})
assert.deepEqual(fireCoverage.objectParticlePartial,[fire.asset])
assert.deepEqual(fireCoverage.objectParticleUnimplemented,[fire.asset])
const zero=fire.systems.find(s=>s.delay===0),delayed=fire.systems.find(s=>s.delay>0)
assert.equal(sampleFireSystem(delayed,90,0),null)
assert.deepEqual([0,260,510,760,1010].map(t=>sampleFireSystem(zero,t,0).frame),[0,1,2,3,0])
assert.notEqual(sampleFireSystem(zero,300,0).frame,sampleFireSystem(delayed,300,0).frame)
const flameRuntime=await loadChibiFloor(pixi,fire,async()=>({baseTexture:{},destroy(){}}))
assert.equal(flameRuntime.floorEmitters.reduce((n,e)=>n+e.sprites.length,0),2)
assert.equal(flameRuntime.frameTextures.length,16)
assert.deepEqual(flameRuntime.frameTextures[4].rect.v,[0,512,512,512])
assert.ok(flameRuntime.floorEmitters.every(e=>e.sprites[0].blendMode==='normal'))
updateChibiFloor(flameRuntime,300,0);const flameState=flameRuntime.floorSignature
updateChibiFloor(flameRuntime,800,0);assert.notEqual(flameRuntime.floorSignature,flameState)
updateChibiFloor(flameRuntime,300,0);assert.equal(flameRuntime.floorSignature,flameState)
for(const mutate of [m=>m.deferredSystems=[],m=>m.systems[0].blend='add',m=>m.systems[0].tilesY=4,
 m=>m.systems[0].uv.scalar=1,m=>m.textures[m.mask.texture].file='../wrong.png']) {
 const bad=structuredClone(fire);mutate(bad)
 assert.ok(!attachChibiFloor(indexed,{schemaVersion:2,assets:{[bad.asset]:bad}}).assets[bad.asset].floorAnimation)
}
const moon=catalog.assets.fx_in_montns_panel_1,cloud=moon.systems[0]
const a=sampleFloorSystem(cloud,5000,0),b=sampleFloorSystem(cloud,5050,0)
assert.ok(new Set(a.map(p=>p.frame)).size>1,'Random birth atlas frames must be used')
const retained=a.find(p=>b.some(q=>q.birth===p.birth)),next=b.find(p=>p.birth===retained.birth)
assert.equal(retained.frame,next.frame)
assert.ok(Math.hypot(next.x-retained.x,next.y-retained.y)>0,'A retained sphere particle must move')
assert.deepEqual(sampleFloorSystem(cloud,5000,0),a,'Backward seek must restore birth seed and motion')
const dense=catalog.assets.fx_in_montns_panel_3.systems[2]
assert.ok(sampleFloorSystem(dense,3000,0).length>600,'Native dense ring must not be capped at old box limit')
const moonRt=await loadChibiFloor(pixi,moon,async()=>({baseTexture:{},destroy(){}}))
assert.equal(moonRt.frameTextures.length,32)
updateChibiFloor(moonRt,5000,0)
assert.ok(new Set(moonRt.floorEmitters[0].sprites.filter(s=>s.visible).map(s=>s.texture.rect.v.join(','))).size>1)
console.log('49 floor objects classified; 19 complete native-input profiles plus partial flame, volume motion, per-birth atlas, seek and alpha blend passed')
