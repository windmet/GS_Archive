import assert from 'node:assert/strict'
import fs from 'node:fs'
import { sampleSpotlightBackground } from '../src/core/chibiSpotlightBackground.js'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'

const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-timeline.json', import.meta.url), 'utf8'))
const native = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-background.json', import.meta.url), 'utf8')).model
const song = { value: { spotlightEvents: fixture.songs.steqmg.events } }
const sample = new Function('selectedSong', source.slice(source.indexOf('function spotlightStatesAt('),
  source.indexOf('function createSpotlightRuntime(')) + '\nreturn spotlightStatesAt')(song)
const pins = new Map()
const background = t => sampleSpotlightBackground(sample(t), pins, true)
assert.deepEqual(background(13700), { color: '#221d23', alpha: 0.5 })
assert.deepEqual(background(32500), { color: '#221d23', alpha: 0.4 })
assert.equal(background(49301), null, 'Authored hide must clear background')
assert.equal(sampleSpotlightBackground(sample(32500), pins, false), null)
pins.set(1, { time: 20000, asset: 'pinspotlight', alpha: 1, environmentColor: '#000000', environmentOpacity: 700 })
assert.deepEqual(background(13700), {color: '#000000', alpha: 0.7}, 'One background combines latest environment state')
pins.clear()
const shuffled = new Map([[2, { time: 20, environmentColor: '#abcdef', environmentOpacity: 600, alpha: 0.5 }],
  [1, { time: 10, environmentColor: '#ffffff', environmentOpacity: 200, alpha: 1 }]])
assert.deepEqual(sampleSpotlightBackground(shuffled, pins, true), { color: '#abcdef', alpha: 0.3 })

const alpha = { value: 0 }, time = { value: 13700 }, lighting = { value: true }, environment = { value: 1 }
const sprite = { position: { set(...args) { this.value = args } }, scale: { set(...args) { this.value = args } } }
const store = { runtimes: new Map(), ensure() { return { sprite, layer: native.layers[0] } } }
const pinModel = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-pinspotlight-prefab.json', import.meta.url), 'utf8')).model
const maskCount = { value: 0 }, pinRuntimes = new Map()
const effects = { value: { spotlightBackground: native, pinspotlight: pinModel } }
const sync = new Function('spotlightBackgroundAlpha', 'spotlightBackgroundSprites', 'app', 'cameraContainer',
  'pinspotlightMaskCount', 'pinspotlightModelForAsset', 'pinspotlightRuntimes', 'PIXI',
  'sampleSpotlightBackground', 'spotlightStatesAt', 'pinspotlightStatesAt', 'stageTime', 'lightingEnabled',
  'stageEffectIndex', 'environmentScale', 'parseHexColor',
  source.slice(source.indexOf('function syncSpotlightBackground('), source.indexOf('function spotlightStatesAt('))
    + '\nreturn syncSpotlightBackground')(alpha, store,
  { renderer: { width: 1280, height: 720, resolution: 1 } }, {}, maskCount,
  (model, assets, asset) => ({ layers: [{ asset }] }), pinRuntimes,
  {Rectangle: class { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}) } }}, sampleSpotlightBackground, sample,
  () => pins, time, lighting, effects, environment,
  value => parseInt(value.slice(1), 16))
sync()
store.runtimes.set('background', { sprite })
assert.equal(alpha.value, 0.5)
assert.equal(sprite.tint, 0x221d23)
assert.deepEqual(sprite.scale.value, [20, 20])
assert.deepEqual(sprite.position.value, [640, 360])
lighting.value = false; sync()
assert.equal(sprite.visible, false)
assert.equal(alpha.value, 0)
lighting.value = true; time.value = 49301; sync()
assert.equal(sprite.visible, false)
time.value = 32500; sync(); assert.equal(sprite.visible, true)
pins.set(1, { id: 1, time: 33000, asset: 'pinspotlight', alpha: 1,
  environmentColor: '#000000', environmentOpacity: 700 })
sync(); assert.equal(sprite.visible, false, 'Pending masks must not publish a solid environment wash')
const maskRuntime = { maskSprite: { visible: true }, filter: {} }
pinRuntimes.set('1:pinspotlight', maskRuntime)
sync(); assert.equal(sprite.visible, true); assert.equal(alpha.value, 0.7)
assert.deepEqual(sprite.filters, [maskRuntime.filter]); assert.equal(maskCount.value, 1)
assert.deepEqual({...sprite.filterArea}, { x: 0, y: 0, width: 1280, height: 720 })
maskRuntime.maskSprite.visible = false
sync(); assert.equal(sprite.visible, false, 'Hidden masks must not be reused on backward seeks')
maskRuntime.maskSprite.visible = true
effects.value.spotlightBackground = { ...native, layers: [{ ...native.layers[0], sortingOrder: 3001 }] }
sync(); assert.equal(sprite.filters, null); assert.equal(maskCount.value, 0, 'Outside native sorting interval is unmasked')
effects.value.spotlightBackground = native
pins.clear(); sync(); assert.equal(sprite.filters, null); assert.equal(maskCount.value, 0, 'Switch back to Spotlight detaches Pin filters')

let resolve, destroyed = 0, ready = 0
const realStore = createSpotlightSpriteStore({ layerCount: 1,
  loadTexture: () => new Promise(r => { resolve = r }), createRuntime: () => ({ sprite }),
  destroyRuntime: () => {}, destroyTexture: () => { destroyed++ }, onReady: () => { ready++ }, onError: error => { throw error } })
realStore.ensure('background', native, { pinspotlight_back: { file: 'native.png' } })
await Promise.resolve(); realStore.release(); resolve({});
await new Promise(r => setImmediate(r))
assert.equal(destroyed, 1); assert.equal(ready, 0); assert.equal(realStore.runtimes.size, 0)
console.log('Real SFC background seek/hide/toggle, native size, shared environment state and late release passed')
