import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {attachBuiltInObjects,loadBuiltInObjectSprites} from '../src/core/chibiBuiltInObjects.js'
import {sampleObjectEmitter,attachObjectEmitters} from '../src/core/chibiObjectEmitters.js'
import {objectParticleCoverage} from '../src/core/stageVfxCoverage.js'
const read=name=>JSON.parse(fs.readFileSync(new URL('../'+name,import.meta.url),'utf8'))
const data=read('public/data/stage-built-in-objects.json')
const source=process.argv.includes('--published-assets')?read('public/assets/live-chibi/object-layers/index.json'):{assets:{},missing:Object.keys(data.assets)}
const indexHash=process.argv.includes('--published-assets')?crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/assets/live-chibi/object-layers/index.json',import.meta.url))).digest('hex'):data.objectIndexSha256
const index=attachBuiltInObjects(source,data,indexHash)
assert.equal(index.missing.length,0)
assert.equal(Object.keys(data.assets).length,4)
assert.equal(Object.keys(source.assets).some(name=>Object.hasOwn(data.assets,name)),false,'Cached source is immutable')
assert.throws(()=>attachBuiltInObjects(source,data,'0'.repeat(64)),/source mismatch/)
for(const mutate of [d=>Object.values(d.assets)[0].nativeSpriteShader.shaderSha256='bad',d=>Object.values(d.assets)[0].instances[0].alpha=NaN,d=>Object.values(d.assets)[0].textures[0].file='/wrong.png',d=>Object.values(d.emitters.assets)[0].systems=[]]) {
  const bad=structuredClone(data);mutate(bad);assert.throws(()=>attachBuiltInObjects(source,bad,indexHash))
}
for(const entry of Object.values(data.assets))for(const texture of entry.textures) {
 const bytes=fs.readFileSync(new URL('../public'+texture.file,import.meta.url))
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),texture.pngSha256)
}
let systems=0
for(const entry of Object.values(index.assets).filter(e=>e.bundle==='apk:resources.assets' && e.kind==='particle')){
 assert.equal(objectParticleCoverage(entry).consumer,'nativeParticleAnimation')
 assert.equal(entry.nativeParticleAnimation.deferred.length,0)
 const {masks,textures}=entry.nativeParticleAnimation
 for(const system of entry.nativeParticleAnimation.systems){
  systems++
  if(system.maskTexture)assert.equal(masks.filter(m=>m.texture===system.maskTexture).length,1)
  assert.ok([100,500,1000,2000,5000].some(t=>sampleObjectEmitter(system,t,0).length),'Actual emitter must produce particles')
  const sample=sampleObjectEmitter(system,2000,0)
  assert.deepEqual(sampleObjectEmitter(system,2000,0),sample,'Seek replay is deterministic')
  assert.ok(sample.every(p=>[p.x,p.y,p.alpha,p.a,p.d].every(Number.isFinite)))
  assert.equal(sampleObjectEmitter(system,1000000,0,0).length,0,'Stop must retire retained particles')
 }
 for(const texture of Object.values(textures)){
  const bytes=fs.readFileSync(new URL('../public'+texture.file,import.meta.url))
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),texture.pngSha256)
 }
}
assert.equal(systems,4)
const pair=()=>({set(...v){this.values=v}})
class Container{constructor(){this.children=[]}addChild(node){this.children.push(node)}destroy(){this.destroyed=true}}
class SimpleMesh{constructor(texture,vertices){this.texture=texture;this.vertices=vertices;this.position=pair();this.scale=pair();this.skew=pair()}}
class MeshMaterial{constructor(texture,options){this.texture=texture;this.uniforms=options.uniforms}destroy(){this.destroyed=true}}
const PIXI={Container,SimpleMesh,MeshMaterial,Program:{from:()=>({})},BLEND_MODES:{ADD_NPM:18}}
const restores=[],renderer={state:{blendModes:new Array(32)},gl:{SRC_ALPHA:770,ONE:1},runners:{contextChange:{add(c){restores.push(c)}}}}
const textureFor=metadata=>({width:metadata.width,height:metadata.height,baseTexture:{alphaMode:1},destroy(){this.destroyed=true}})
for(const entry of Object.values(data.assets).filter(e=>e.kind==='sprite')){
 const runtime=await loadBuiltInObjectSprites(PIXI,renderer,entry,async file=>textureFor(entry.textures.find(t=>t.file===file)))
 assert.equal(runtime.nativeBuiltInSprites.length,entry.spriteCount)
 for(const [i,mesh] of runtime.nativeBuiltInSprites.entries()){
  const instance=entry.instances[i],metadata=entry.textures.find(t=>t.id===instance.texture)
  assert.equal(mesh.nativeAnchorY,metadata.pivot.y)
  assert.equal(mesh.vertices[0],Math.fround(-metadata.width*metadata.pivot.x))
  assert.deepEqual(mesh.scale.values,[instance.scaleX*100/metadata.pixelsPerUnit,instance.scaleY*100/metadata.pixelsPerUnit])
  assert.equal(mesh.tint,instance.tint)
  assert.deepEqual(renderer.state.blendModes[mesh.blendMode],[770,1],'RGBA uses native factors, not separate alpha One/One')
 }
 const materials=runtime.nativeBuiltInSprites.map(s=>s.shader)
 const destroySource=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8').match(/function destroyObjectLayerRuntime\([^]*?\n\}/)[0]
 let releases=0
 runtime.container.removeFromParent=()=>{}
 const destroyActual=new Function('releaseObjectRendererPlanes',destroySource+';return destroyObjectLayerRuntime')(
   current=>{releases++;assert.ok(materials.every(m=>m.destroyed),'Materials release before planes destroy Mesh.shader');for(const mesh of current.nativeBuiltInSprites)mesh.shader=null})
 destroyActual(runtime);destroyActual(runtime)
 assert.equal(releases,1,'Runtime disposal is idempotent')
 assert.ok(runtime.textures.every(t=>t.destroyed))
}
assert.equal(restores.length,1,'One context listener per renderer')
renderer.state.blendModes=[];restores[0].contextChange();assert.deepEqual(renderer.state.blendModes[32],[770,1])
const sfc=fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue',import.meta.url),'utf8')
const loadActual=new Function('loadBuiltInObjectSprites','PIXI','app','loadImageLayerTexture',sfc.match(/async function loadObjectLayerRuntime\([^]*?\n\}/)[0]+';return loadObjectLayerRuntime')(
 async(p,r,e,l)=>({entry:e,renderer:r}),PIXI,{renderer},()=>{})
const entry=Object.values(data.assets).find(e=>e.kind==='sprite')
assert.equal((await loadActual(entry)).renderer,renderer,'Actual SFC selects native material consumer')
// Execute the actual index loader including late optional refinements. They
// must retain the APK entries and cancellation/failure must remain failures.
const spine=fs.readFileSync(new URL('../src/utils/liveChibiSpine.js',import.meta.url),'utf8')
const loaderBody=spine.match(/export async function fetchLiveChibiObjectLayerIndex\([^]*?\n\}/)[0].replace('export ','')
const mockSource={assets:{},missing:Object.keys(data.assets)},text=JSON.stringify(mockSource)
const mockHash=crypto.createHash('sha256').update(text).digest('hex')
const supplement=structuredClone(data);supplement.objectIndexSha256=mockHash;supplement.emitters.objectIndexSha256=mockHash
const transport={load:async path=>path==='/data/stage-built-in-objects.json'?JSON.stringify(supplement):
 path==='/data/stage-object-emitters.json'?JSON.stringify({schemaVersion:1,objectIndexSha256:mockHash,assets:{}}):
 path.endsWith('/object-layers/index.json')?text:'{}'}
const identity=index=>index
const makeLoader=transport=>new Function('liveJson','indexTransport','LIVE_CHIBI_BASE','crypto','attachObjectEmitters','attachBuiltInObjects',
 'attachChibiParticleLayers','attachChibiFloor','attachBloom','attachObjectSpriteGeometry',loaderBody+';return fetchLiveChibiObjectLayerIndex')(
 async path=>path==='object-layers/index.json'?structuredClone(mockSource):null,transport,'/assets/live-chibi',crypto.webcrypto,
 attachObjectEmitters,attachBuiltInObjects,identity,identity,identity,identity)
const refinements=[]
let optionalComplete
const optionalDone=new Promise(resolve=>{optionalComplete=resolve})
assert.equal((await makeLoader(transport)({onOptional:index=>{refinements.push(index);if(refinements.length===2)optionalComplete()}})).missing.length,0)
await optionalDone
assert.ok(refinements.length>0)
assert.ok(refinements.every(index=>Object.keys(data.assets).every(name=>index.assets[name])))
const abort=new AbortController();abort.abort()
await assert.rejects(makeLoader(transport)({signal:abort.signal}),{name:'AbortError'})
await assert.rejects(makeLoader({load:async()=>{throw Error('HTTP 404')}})({}),/404/)
console.log('Four APK entries: ten native Sprite meshes, four emitting particle systems, masks, source/hash guards, actual SFC and context restoration passed')
