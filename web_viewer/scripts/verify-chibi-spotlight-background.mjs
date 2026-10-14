import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spotlightBackgroundOrderAt } from '../src/core/chibiCharacterLayers.js'
import { spotlightBackgroundAt } from '../src/core/chibiSpotlightBackground.js'
import { createSpotlightSpriteStore } from '../src/core/chibiSpotlightSprites.js'

const source = fs.readFileSync(new URL('../src/components/ChibiStageViewer.vue', import.meta.url), 'utf8')
const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-timeline.json', import.meta.url), 'utf8'))
const native = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-spotlight-background.json', import.meta.url), 'utf8')).model
const song = { value: { spotlightEvents: fixture.songs.steqmg.events } }
const close = (a,b) => assert(Math.abs(a-b)<1e-9, `${a} != ${b}`)
const shared={spotlightEvents:[
 {time:0,id:1,environmentColor:'#000000',environmentOpacity:800,duration:10000},
 {time:100,id:2,environmentColor:'#0000ff',environmentOpacity:200},
 {time:300,id:1,hide:true,duration:400},
 {time:800,id:2,hide:true,duration:400},
]}
assert.equal(spotlightBackgroundAt(shared,0),null)
assert.equal(spotlightBackgroundAt(shared,250).color,'#0000ff')
close(spotlightBackgroundAt(shared,250).alpha,.6)
close(spotlightBackgroundAt(shared,500).alpha,.318)
close(spotlightBackgroundAt(shared,1000).alpha,.05)
assert.equal(spotlightBackgroundAt(shared,1200),null)
assert.equal(spotlightBackgroundAt(shared,1000,false),null)
close(spotlightBackgroundAt(shared,250).alpha,.6)
const invalid={spotlightEvents:[{time:-2000,id:1,environmentColor:'800',environmentOpacity:1000}]}
assert.deepEqual(spotlightBackgroundAt(invalid,0),{color:'#000000',alpha:.8,showingCount:1})
const ordered={spotlightEvents:[{time:0,id:1,environmentColor:'#000000',environmentOpacity:800}],
 pinspotlightEvents:[{time:0,id:1,environmentColor:'#ffffff',environmentOpacity:200,duration:500}],
 spotlightCommandOrder:[{family:'pinspotlight',index:0},{family:'spotlight',index:0}]}
close(spotlightBackgroundAt(ordered,250).alpha,.15)
assert.equal(spotlightBackgroundAt(ordered,250).showingCount,2)
assert.equal(spotlightBackgroundAt(ordered,250).color,'#000000')
ordered.spotlightCommandOrder.reverse()
close(spotlightBackgroundAt(ordered,250).alpha,.6)
assert.equal(spotlightBackgroundAt(ordered,250).color,'#ffffff')
// Actual renderer below uses a small explicit song; its lamp/mask states stay
// separate from the shared background state to exercise the consumer boundary.
song.value={spotlightEvents:[{time:-2000,id:1,environmentColor:'#221d23',environmentOpacity:500,depth:1800},
 {time:49000,id:1,hide:true,duration:300}]}
const pins=new Map()
const alpha = { value: 0 }, time = { value: 13700 }, lighting = { value: true }, environment = { value: 1 }
const sprite = { position: { set(...args) { this.value = args } }, scale: { set(...args) { this.value = args } } }
const store = { runtimes: new Map(), ensure() { return { sprite, layer: native.layers[0] } } }
const pinModel = JSON.parse(fs.readFileSync(new URL('./fixtures/chibi-pinspotlight-prefab.json', import.meta.url), 'utf8')).model
const maskCount = { value: 0 }, pinRuntimes = new Map()
const effects = { value: { spotlightBackground: native, pinspotlight: pinModel } }
const sync = new Function('spotlightBackgroundAlpha', 'spotlightBackgroundSprites', 'app', 'cameraContainer',
  'pinspotlightMaskCount', 'pinspotlightModelForAsset', 'pinspotlightRuntimes', 'PIXI',
  'spotlightBackgroundAt', 'pinspotlightStatesAt', 'stageTime', 'lightingEnabled',
  'stageEffectIndex', 'environmentScale', 'parseHexColor', 'spotlightBackgroundOrderAt', 'selectedSong',
  source.slice(source.indexOf('function syncSpotlightBackground('), source.indexOf('function spotlightStatesAt('))
    + '\nreturn syncSpotlightBackground')(alpha, store,
  { renderer: { width: 1280, height: 720, resolution: 1 } }, {}, maskCount,
  (model, assets, asset) => ({ layers: [{ asset }] }), pinRuntimes,
  {Rectangle: class { constructor(x,y,width,height) { Object.assign(this,{x,y,width,height}) } }}, spotlightBackgroundAt,
  () => pins, time, lighting, effects, environment,
  value => parseInt(value.slice(1), 16), spotlightBackgroundOrderAt, song)
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
song.value.pinspotlightEvents=[{time:32000,id:1,environmentColor:'#000000',environmentOpacity:700,depth:1850,duration:1}]
const maskRuntime = { maskSprite: { visible: true }, filter: {} }
pinRuntimes.set('1:pinspotlight', maskRuntime)
sync(); assert.equal(sprite.visible, true); assert.equal(alpha.value, 0.5)
assert.deepEqual(sprite.filters, [maskRuntime.filter]); assert.equal(maskCount.value, 1)
assert.deepEqual({...sprite.filterArea}, { x: 0, y: 0, width: 1280, height: 720 })
maskRuntime.maskSprite.visible = false
sync(); assert.equal(sprite.visible, false, 'Hidden masks must not be reused on backward seeks')
maskRuntime.maskSprite.visible = true
song.value.pinspotlightEvents.push({ time: 32500, id:1, depth: 3001 })
sync(); assert.equal(sprite.filters, null); assert.equal(maskCount.value, 0, 'Outside native sorting interval is unmasked')
song.value.pinspotlightEvents = []
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
