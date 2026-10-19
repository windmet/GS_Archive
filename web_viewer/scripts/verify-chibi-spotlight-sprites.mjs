import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createNativeLightQuad } from '../src/core/chibiLightQuad.js'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-prefab.json', import.meta.url), 'utf8'))
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const createSource = source.slice(source.indexOf('function createSpotlightRuntime('), source.indexOf('function syncSpotlights('))
const pair = () => ({ set(...values) { this.values = values } })
class SimpleMesh { constructor(texture,vertices) { this.texture=texture; this.vertices=vertices; this.position=pair(); this.scale=pair() } }
class MeshMaterial { constructor(texture,options) { this.texture=texture; this.uniforms=options.uniforms } }
class Container { constructor() { this.children = [] } addChild(sprite) { this.children.push(sprite) } }
const camera = new Container()
const nativeRenderer={state:{blendModes:new Array(32)},gl:{SRC_ALPHA:770,ONE:1},runners:{contextChange:{add(){}}}}
const factory = new Function('PIXI', 'markRaw', 'cameraContainer', 'createNativeLightQuad','app', createSource + '\nreturn createSpotlightRuntime')(
  { Container, SimpleMesh, MeshMaterial, Program:{from:()=>({})}, BLEND_MODES: { ADD_NPM: 'native-add' } }, value => value, camera, createNativeLightQuad,{renderer:nativeRenderer})
const nativeTextures = [{ asset: 'Spotlight1',width:1024,height:1024 }, { asset: 'Spotlight2',width:512,height:512 }]
const actualRuntime = factory(20, fixture.model.layers, nativeTextures)
assert.equal(camera.children[0], actualRuntime.container)
assert.equal(actualRuntime.sprites.length, 2)
actualRuntime.sprites.forEach((sprite, index) => {
  const layer = fixture.model.layers[index]
  assert.equal(sprite.texture, nativeTextures[index])
  assert.deepEqual(sprite.position.values, [layer.x, layer.y])
  assert.deepEqual(sprite.scale.values, [layer.scaleX, layer.scaleY])
  assert.equal(sprite.vertices[0],-nativeTextures[index].width*layer.anchorX)
  assert.equal(sprite.vertices[1],-nativeTextures[index].height*layer.anchorY)
  assert.equal(sprite.shader.batchable,false)
  assert.equal(sprite.blendMode,32)
  assert.deepEqual(nativeRenderer.state.blendModes[sprite.blendMode],[770,1])
})
assert.equal(source.includes('ensureSpotlightConeTexture'), false, 'Generated cone must not replace the native resource')

const model = { layers: [{ asset: 'Spotlight1',width:1024,height:1024 }, { asset: 'Spotlight2',width:512,height:512 }] }
const assets = { Spotlight1: { file: 'cone.png' }, Spotlight2: { file: 'pool.png' } }
const deferred = () => {
  let resolve, reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const settle = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve() }
const loads = [], destroyedTextures = [], destroyedRuntimes = [], ready = [], errors = []
const store = createSpotlightSpriteStore({
  loadTexture: file => { const load = deferred(); loads.push({ file, ...load }); return load.promise },
  createRuntime: (id, layers, textures) => ({ id, layers, textures, visible: false }),
  destroyRuntime: runtime => destroyedRuntimes.push(runtime),
  destroyTexture: texture => destroyedTextures.push(texture),
  onReady: () => ready.push(store.runtimes.size),
  onError: error => errors.push(error),
})
assert.equal(store.ensure(1, null, assets), null)
assert.equal(store.ensure(1, model, {}), null)
await settle()
assert.equal(loads.length, 0)
store.ensure(1, model, assets)
store.ensure(1, model, assets)
store.ensure(2, model, assets)
await settle()
assert.equal(loads.length, 2, 'Both lamp IDs share a single texture request per native asset')
store.release()
store.ensure(1, model, assets)
await settle()
assert.equal(loads.length, 4)
loads[0].resolve({ old: 'cone' })
loads[1].resolve({ old: 'pool' })
await settle()
assert.equal(store.runtimes.size, 0, 'Released stage cannot install a late runtime')
assert.equal(destroyedTextures.length, 2, 'Late textures are disposed once')
assert.deepEqual(ready, [])
loads[2].resolve({ current: 'cone' })
loads[3].resolve({ current: 'pool' })
await settle()
assert.equal(store.runtimes.size, 1)
assert.equal(store.ensure(1, model, assets), store.runtimes.get(1))
assert.ok(store.ensure(2, model, assets),'A new lamp ID with loaded native textures must exist before this frame renders')
await settle()
assert.equal(loads.length, 4)
assert.equal(store.runtimes.size, 2)
assert.equal(store.runtimes.get(1).textures[0], store.runtimes.get(2).textures[0])
store.release()
store.release()
assert.equal(destroyedRuntimes.length, 2)
assert.equal(destroyedTextures.length, 4, 'Shared textures disposed once, after all sprites')
store.ensure(3, model, assets)
await settle()
loads[4].resolve({ sibling: 'cone' })
loads[5].reject(new Error('Missing pool'))
await settle()
assert.equal(errors.length, 1)
assert.equal(store.runtimes.size, 0, 'Failed lamp cannot install a partial cone')
store.ensure(3, model, assets)
await settle()
assert.equal(loads.length, 6, 'Failure does not trigger a request on every animation frame')
store.release()
assert.equal(destroyedTextures.length, 5, 'Successful sibling texture is released after a failed load')
console.log('Native Spotlight shared textures, late stage loads, duplicate IDs and partial failure disposal passed')

// Preload only native textures; never create an early visible lamp. A new ID
// must be ready in the very same stack as its Show, before any microtask.
const preparedLoads=[],preparedDestroyed=[]
let preparedReady=0
const prepared=createSpotlightSpriteStore({
 loadTexture:async file=>{preparedLoads.push(file);return {file}},
 createRuntime:(id,layers,textures)=>({id,layers,textures}),
 destroyRuntime:()=>{},destroyTexture:t=>preparedDestroyed.push(t),
 onReady:()=>preparedReady++,onError:error=>{throw error},
})
assert.equal(await prepared.prepare(null,assets),false)
assert.equal(await prepared.prepare(model,assets),true)
assert.equal(prepared.runtimes.size,0)
assert.deepEqual(preparedLoads,['cone.png','pool.png'])
for(const id of [1,2,7,20])assert.ok(prepared.ensure(id,model,assets),`Same-frame Show ${id}`)
assert.equal(preparedReady,0,'Synchronous install must not recursively re-enter the frame sync')
assert.deepEqual(prepared.pendingIds,[])
prepared.release();assert.equal(preparedDestroyed.length,2)
const pendingPrepare=prepared.prepare(model,assets);prepared.release()
assert.equal(await pendingPrepare,false,'Released preparation cannot qualify another stage generation')
assert.equal(prepared.runtimes.size,0)
console.log('PASS future-ID same-frame install, texture-only preparation and released-generation rejection')

// The full-corpus sweep needs the gitignored stage catalogs; CI runs the
// fixture checks above only.
if(process.argv.includes('--published-assets')){
const {pinspotlightModelForAsset}=await import('../src/core/chibiPinspotlightSprites.js')
const catalog=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/stage-effects/index.json',import.meta.url)))
const choreography=JSON.parse(fs.readFileSync(new URL('../public/assets/live-chibi/choreography/index.json',import.meta.url)))
const selected={value:null},effects={value:catalog},preparedCalls=[]
const prepareStore=family=>({prepare:async model=>{preparedCalls.push({family,model});return Boolean(model)}})
const prepareActual=new Function('lightingEnabled','beamEffectsEnabled','selectedSong','stageEffectIndex','stageDisposed',
 'fetchLiveChibiStageEffectIndex','lifetime','spotlightSprites','pinspotlightSprites','spotlightBackgroundSprites','pinspotlightModelForAsset','objectLayersEnabled','searchlightRenderer','choreography',
 source.match(/async function prepareStageLighting\([^]*?\n\}/)[0]+';return prepareStageLighting')(
 {value:true},{value:true},selected,effects,false,async()=>catalog,new AbortController(),
 prepareStore('spotlight'),prepareStore('pinspotlight'),prepareStore('background'),pinspotlightModelForAsset,
 {value:false},{prepare:async()=>true},{value:{searchlights:null}})
for(const song of choreography.songs){
 selected.value=song;preparedCalls.length=0
 assert.equal(await prepareActual(),true)
 const expectedPins=new Set(song.pinspotlightEvents.filter(e=>!e.hide).map(e=>e.asset)).size
 assert.equal(preparedCalls.filter(c=>c.family==='pinspotlight').length,expectedPins)
 assert.equal(preparedCalls.filter(c=>c.family==='spotlight').length,song.spotlightEvents.some(e=>!e.hide)?1:0)
 assert.equal(preparedCalls.filter(c=>c.family==='background').length,preparedCalls.length?1:0)
}
effects.value={...catalog,spotlight:null};selected.value=choreography.songs.find(s=>s.songCode==='byndtd')
await assert.rejects(prepareActual(),/资源尚未就绪/)
console.log('PASS actual SFC preparation for all 118 arrangements, future mask variants and missing-resource rejection')
}
