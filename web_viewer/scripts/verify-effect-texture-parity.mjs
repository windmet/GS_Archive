import assert from 'node:assert/strict'
import * as PIXI from 'pixi.js'
import { ScreenEffectManager } from '../src/core/ScreenEffectManager.js'
import { BackgroundEffectManager } from '../src/core/BackgroundEffectManager.js'
import { effectTextures, effectTextureUrl, knownEffectTextureIds } from '../shared/story/EffectTextures.js'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'

const source = { file: 'episodes/test.json', sha256: `sha256:${'a'.repeat(64)}` }
const savedRaf = globalThis.requestAnimationFrame
const savedCancel = globalThis.cancelAnimationFrame
const savedWarn = console.warn
const savedError = console.error
const diagnostics = []
const frames = new Map()
let frameId = 0
let now = 0
// Deterministic scheduler, with real PIXI display objects but no renderer/GPU.
globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId }
globalThis.cancelAnimationFrame = id => frames.delete(id)
console.warn = (...args) => { diagnostics.push(args); savedWarn(...args) }
console.error = (...args) => { diagnostics.push(args); savedError(...args) }
const drain = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
async function advance(milliseconds) {
  now += milliseconds
  const callbacks = [...frames.values()]
  frames.clear()
  for (const callback of callbacks) callback(now)
  await drain()
}

async function managerProbe(domain, effect) {
  const urls = [], textures = [], tickers = new Set()
  const stage = new PIXI.Container()
  const bgContainer = new PIXI.Container()
  stage.addChild(bgContainer)
  const app = { stage, ticker: { add: fn => tickers.add(fn), remove: fn => tickers.delete(fn) } }
  const loadTextureFromUrl = url => {
    urls.push(url)
    // Valid baseTexture/frame metadata is required by Sprite/TilingSprite.
    // Synthetic pixels prove object construction, never real image rendering.
    const texture = PIXI.Texture.fromBuffer(new Uint8Array(96 * 64 * 4), 96, 64)
    textures.push(texture)
    return Promise.resolve(texture)
  }
  const common = { app, getWidth: () => 1024, getHeight: () => 506, loadTextureFromUrl }
  const manager = domain === 'background'
    ? new BackgroundEffectManager({ ...common, bgEffectContainer: bgContainer })
    : new ScreenEffectManager({ ...common,
      overlay: { destroyed: false, alpha: 1, visible: false, width: 1024, height: 506, tint: 0xffffff },
      spineContainer: null })
  try {
    if (domain === 'background') manager.applyBgEffects([effect], null, () => now)
    else manager.playScreenEffects([effect], { nowMilliseconds: () => now })
    await advance(0)
    // Evidence 1: capture the requests independently from the plan mapping.
    const requested = urls.map(url => url.replace('/data/fx_extracted/unity_', '').replace('.png', ''))
    // Evidence 2: verify real PIXI object initialization and a lifecycle tick.
    // Counts come from each concrete handler, not from effectTextures().
    const backgroundCounts = { fx_adv_rain: 2, fx_adv_rain_heavy2: 3, fx_adv_sakura: 32, fx_adv_momiji: 28 }
    const screenCounts = { fx_adv_punch: 1, fx_adv_sakura: 30, fx_adv_momiji: 30, fx_adv_kamifubuki: 48 }
    const collectSprites = node => (node instanceof PIXI.Sprite ? 1 : 0)
      + (node.children || []).reduce((sum, child) => sum + collectSprites(child), 0)
    const expectedCount = (domain === 'background' ? backgroundCounts : screenCounts)[effect.id] || 0
    assert.equal(collectSprites(stage), expectedCount, `${domain}/${effect.id}: initialized display objects`)
    now += 50
    for (const tick of [...tickers]) tick()
    await advance(0)
    assert.equal(diagnostics.length, 0, 'unexpected manager warning/error must fail verification')
    return requested
  } finally {
    manager.destroy()
    assert.equal(tickers.size, 0, 'manager disposal removes every ticker')
    assert.equal(frames.size, 0, 'manager disposal cancels every frame')
    stage.destroy({ children: true })
    for (const texture of textures) texture.destroy(true)
  }
}
const backgroundRequests = id => managerProbe('background', { id })
const screenRequests = effect => managerProbe('screen', effect)

try {
// 1. The plan's mapping must equal what the managers really request. This is
//    the contract that keeps discovery and execution from drifting apart.
// Both probes take the authored effect object so a malformed id can never make
// a case pass vacuously.
const DOMAIN_PROBES = [
  { domain: 'bg_effects', probe: effect => backgroundRequests(effect.id) },
  { domain: 'screen_effects', probe: effect => screenRequests({ type: 'single', ...effect }) },
]
const PROBED_IDS = ['cameraflare', 'fx_adv_punch', 'fx_adv_rain', 'fx_adv_rain_heavy2',
  'fx_adv_sakura', 'fx_adv_momiji', 'fx_adv_snowflower', 'fx_adv_kamifubuki', 'fx_adv_star']

for (const { domain, probe } of DOMAIN_PROBES) {
  for (const id of PROBED_IDS) {
    const requested = await probe({ id })
    const planned = effectTextures({ id }, domain)
    // Unresolved effects and effects the runtime deliberately ignores must
    // genuinely request nothing; every other mapped effect must request
    // exactly the planned textures. A runtime-disabled effect stays
    // enumerated so its dependency and the reason it is unused both survive.
    const expected = (planned.reason || planned.runtimeDisabled) ? [] : planned.textures
    assert.deepEqual(requested, expected,
      `${domain} / ${id}: runtime requested ${JSON.stringify(requested)}, plan expects ${JSON.stringify(expected)}`)
  }
}

// 2. Verified handler behaviour that the mapping must keep reflecting.
assert.deepEqual(effectTextures({ id: 'fx_adv_sakura' }, 'bg_effects').textures, ['fx_adv_sakura'],
  'a background sakura effect does not pull the star texture')
assert.deepEqual(effectTextures({ id: 'fx_adv_kamifubuki' }, 'screen_effects').textures,
  ['fx_adv_sakura', 'fx_adv_star'], 'kamifubuki mixes sakura and star')
assert.deepEqual(effectTextures({ id: 'fx_adv_rain_heavy2' }, 'bg_effects').textures, ['fx_adv_rain'],
  'heavy rain reuses the single rain texture')
assert.equal(effectTextures({ id: 'cameraflare' }, 'bg_effects').runtimeDisabled,
  'cameraflare-re-authored-as-particles')
assert.deepEqual(await backgroundRequests('cameraflare'), [],
  'the runtime-disabled cameraflare must not request its texture at runtime')

// 3. Effects the codebase does not implement are reported, never assumed ready.
assert.equal(effectTextures({ id: 'fx_adv_snowflower' }, 'bg_effects').reason, 'unmapped-effect-texture',
  'snowflower has no handler in the archive runtime')
assert.equal(effectTextures({ id: 'fx_adv_punch' }, 'bg_effects').reason, 'effect-unhandled-in-domain',
  'an effect used in the wrong domain is a no-op, not a satisfied requirement')
assert.equal(effectTextures({ id: 'fx_adv_rain' }, 'screen_effects').reason, 'effect-unhandled-in-domain')
assert.equal(effectTextures({ id: 'fx_adv_star' }, 'screen_effects').reason, 'unmapped-effect-texture',
  'the star texture is only reachable as a kamifubuki part')
assert.deepEqual(effectTextures({ id: '' }, 'bg_effects'), { textures: [], reason: 'effect-without-id' })

// 4. Generated overlays carry no texture dependency in either domain.
for (const type of ['fadein', 'fadeout']) {
  assert.deepEqual(effectTextures({ type }, 'bg_effects'), { textures: [] })
  assert.deepEqual(effectTextures({ type }, 'screen_effects'), { textures: [] })
}
assert.deepEqual(await screenRequests({ type: 'fadein', color: '#FFFFFF' }), [],
  'a generated overlay requests no effect texture')

// 5. Every mapped texture resolves through one URL rule.
for (const id of knownEffectTextureIds()) {
  assert.equal(effectTextureUrl(id), `/data/fx_extracted/unity_${id}.png`, id)
}

// 6. Real corpus effects resolve in their own domain and stay open only when
//    the runtime cannot account for them.
const plan = createStoryAssetPlan({ schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [
  { step_id: 1, type: 'adv', entry_snapshot: { bg: 'room', spines: [],
    bg_effects: [{ id: 'fx_adv_rain_heavy2' }, { id: 'cameraflare' }],
    screen_effects: [{ type: 'single', id: 'fx_adv_punch' }, { type: 'fadein', color: '#FFF' }] },
  settled_snapshot: { bg: 'room', spines: [] } }] }, source)
assert.deepEqual(plan.assets.filter(a => a.kind === 'effect-texture').map(a => a.id),
  ['fx_adv_rain', 'fx_adv_flare_01', 'fx_adv_punch'],
  'every corpus effect resolves to its texture')
assert.deepEqual(plan.assets.filter(a => a.kind === 'effect-texture' && a.required).map(a => a.id),
  ['fx_adv_rain', 'fx_adv_punch'],
  'the probe set must not report a disabled texture as a download')
assert.equal(plan.dependenciesComplete, true, 'corpus effects are complete logical requirements')

const wrongDomain = structuredClone(plan.source) && createStoryAssetPlan({
  schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{ step_id: 1, type: 'adv',
    entry_snapshot: { bg: 'room', spines: [], bg_effects: [{ id: 'fx_adv_punch' }] },
    settled_snapshot: { bg: 'room', spines: [] } }] }, source)
assert.equal(wrongDomain.dependenciesComplete, false, 'a wrong-domain effect stays unresolved')
assert.ok(wrongDomain.unresolved.some(item => item.reason === 'effect-unhandled-in-domain'))


console.log('Effect request parity and synthetic PIXI object lifecycle verified; real texture decode/GPU rendering NOT verified')
} finally {
  globalThis.requestAnimationFrame = savedRaf
  globalThis.cancelAnimationFrame = savedCancel
  console.warn = savedWarn
  console.error = savedError
}
