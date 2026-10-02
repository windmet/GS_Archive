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
pins.set(1, { asset: 'pinspotlight', alpha: 1 })
assert.equal(background(13700), null, 'Do not stack unmasked background over active masks')
pins.clear()
const shuffled = new Map([[2, { time: 20, environmentColor: '#abcdef', environmentOpacity: 600, alpha: 0.5 }],
  [1, { time: 10, environmentColor: '#ffffff', environmentOpacity: 200, alpha: 1 }]])
assert.deepEqual(sampleSpotlightBackground(shuffled, pins, true), { color: '#abcdef', alpha: 0.3 })

const alpha = { value: 0 }, time = { value: 13700 }, lighting = { value: true }, environment = { value: 1 }
const sprite = { position: { set(...args) { this.value = args } }, scale: { set(...args) { this.value = args } } }
const store = { runtimes: new Map(), ensure() { return { sprite, layer: native.layers[0] } } }
const sync = new Function('spotlightBackgroundAlpha', 'spotlightBackgroundSprites', 'app', 'cameraContainer',
  'sampleSpotlightBackground', 'spotlightStatesAt', 'pinspotlightStatesAt', 'stageTime', 'lightingEnabled',
  'stageEffectIndex', 'environmentScale', 'parseHexColor',
  source.slice(source.indexOf('function syncSpotlightBackground('), source.indexOf('function spotlightStatesAt('))
    + '\nreturn syncSpotlightBackground')(alpha, store,
  { renderer: { width: 1280, height: 720, resolution: 1 } }, {}, sampleSpotlightBackground, sample,
  () => pins, time, lighting, { value: { spotlightBackground: native } }, environment,
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

let resolve, destroyed = 0, ready = 0
const realStore = createSpotlightSpriteStore({ layerCount: 1,
  loadTexture: () => new Promise(r => { resolve = r }), createRuntime: () => ({ sprite }),
  destroyRuntime: () => {}, destroyTexture: () => { destroyed++ }, onReady: () => { ready++ }, onError: error => { throw error } })
realStore.ensure('background', native, { pinspotlight_back: { file: 'native.png' } })
await Promise.resolve(); realStore.release(); resolve({});
await new Promise(r => setImmediate(r))
assert.equal(destroyed, 1); assert.equal(ready, 0); assert.equal(realStore.runtimes.size, 0)
console.log('Real SFC background seek/hide/toggle, native size, mask exclusion and late release passed')
