import assert from 'node:assert/strict'
import { ScreenEffectManager } from '../src/core/ScreenEffectManager.js'
import { BackgroundEffectManager } from '../src/core/BackgroundEffectManager.js'
import { effectTextures, effectTextureUrl, knownEffectTextureIds } from '../shared/story/EffectTextures.js'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'

const source = { file: 'episodes/test.json', sha256: `sha256:${'a'.repeat(64)}` }

const savedRaf = globalThis.requestAnimationFrame
const savedCancel = globalThis.cancelAnimationFrame
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}
// PIXI needs a canvas for some display objects; texture URLs are recorded first.
process.on('unhandledRejection', () => {})

function stubApp() {
  return { stage: { addChild() {}, removeChild() {} }, ticker: { add() {}, remove() {} } }
}
const textureStub = () => ({ baseTexture: { valid: true }, width: 64, height: 64 })

/** URLs the real background manager requests through its own entry point. */
async function backgroundRequests(id) {
  const urls = []
  const manager = new BackgroundEffectManager({
    app: stubApp(), bgEffectContainer: { addChild() {}, removeChild() {} },
    getWidth: () => 1024, getHeight: () => 506,
    loadTextureFromUrl: url => { urls.push(url); return Promise.resolve(textureStub()) },
  })
  try { manager.applyBgEffects([{ id }]) } catch { /* only the requested URL matters */ }
  await new Promise(resolve => setTimeout(resolve, 20))
  try { manager.destroy() } catch {}
  return urls.map(url => url.replace('/data/fx_extracted/unity_', '').replace('.png', ''))
}

/** URLs the real screen manager requests for one authored effect. */
async function screenRequests(effect) {
  const urls = []
  const manager = new ScreenEffectManager({
    app: stubApp(),
    overlay: { destroyed: false, alpha: 1, visible: false, width: 1024, height: 506, tint: 0xffffff },
    spineContainer: null,
    getWidth: () => 1024, getHeight: () => 506,
    loadTextureFromUrl: url => { urls.push(url); return Promise.resolve(textureStub()) },
  })
  try { manager.playScreenEffects([effect]) } catch { /* only the requested URL matters */ }
  await new Promise(resolve => setTimeout(resolve, 20))
  try { manager.clearScreenEffects() } catch {}
  return urls.map(url => url.replace('/data/fx_extracted/unity_', '').replace('.png', ''))
}

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
assert.equal(plan.dependenciesComplete, true, 'corpus effects are complete logical requirements')

const wrongDomain = structuredClone(plan.source) && createStoryAssetPlan({
  schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{ step_id: 1, type: 'adv',
    entry_snapshot: { bg: 'room', spines: [], bg_effects: [{ id: 'fx_adv_punch' }] },
    settled_snapshot: { bg: 'room', spines: [] } }] }, source)
assert.equal(wrongDomain.dependenciesComplete, false, 'a wrong-domain effect stays unresolved')
assert.ok(wrongDomain.unresolved.some(item => item.reason === 'effect-unhandled-in-domain'))

globalThis.requestAnimationFrame = savedRaf
globalThis.cancelAnimationFrame = savedCancel
console.log('Effect texture parity verified: manager requests match the plan in both domains, disabled and unimplemented effects stay explicit')
