import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-prefab.json', import.meta.url), 'utf8'))
const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const createSource = source.slice(source.indexOf('function createSpotlightRuntime('), source.indexOf('function syncSpotlights('))
const pair = () => ({ set(...values) { this.values = values } })
class Sprite { constructor(texture) { this.texture = texture; this.anchor = pair(); this.position = pair(); this.scale = pair() } }
class Container { constructor() { this.children = [] } addChild(sprite) { this.children.push(sprite) } }
const camera = new Container()
const factory = new Function('PIXI', 'markRaw', 'cameraContainer', createSource + '\nreturn createSpotlightRuntime')(
  { Container, Sprite, BLEND_MODES: { ADD: 'native-add' } }, value => value, camera)
const nativeTextures = [{ asset: 'Spotlight1' }, { asset: 'Spotlight2' }]
const actualRuntime = factory(20, fixture.model.layers, nativeTextures)
assert.equal(camera.children[0], actualRuntime.container)
assert.equal(actualRuntime.sprites.length, 2)
actualRuntime.sprites.forEach((sprite, index) => {
  const layer = fixture.model.layers[index]
  assert.equal(sprite.texture, nativeTextures[index])
  assert.deepEqual(sprite.position.values, [layer.x, layer.y])
  assert.deepEqual(sprite.scale.values, [layer.scaleX, layer.scaleY])
  assert.deepEqual(sprite.anchor.values, [layer.anchorX, layer.anchorY])
  assert.equal(sprite.blendMode, 'native-add')
})
assert.equal(source.includes('ensureSpotlightConeTexture'), false, 'Generated cone must not replace the native resource')

const model = { layers: [{ asset: 'Spotlight1' }, { asset: 'Spotlight2' }] }
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
store.ensure(2, model, assets)
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
