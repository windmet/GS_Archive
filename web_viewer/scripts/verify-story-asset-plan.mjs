import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'

const source = { file: 'episodes/test.json', sha256: `sha256:${'a'.repeat(64)}` }
const legacy = { scenario_id: 'test', steps: [{ step_id: 7, type: 'adv',
  state: { bg: 'start', spines: [{ id: '047shu', model: '047shu_005_00', visible: true }],
    bgm: 'song', environmental: { cue: 'rain' }, se_events: [{ cue: 'door', delay: 1 }],
    image_icon: { layer: 'stage', display_id: '047shu' }, bg_effects: [{ id: 'cameraflare' }] },
  dialogue: { voice: 'test.m4a', lip: { path: 'adxlip/test.json' } } },
  { step_id: 90, type: 'adv', state: { bg: 'end', spines: [], bg_transition: { delay: 1, duration: 1 } } }] }
const normalized = normalizeScenario(legacy)
const before = JSON.stringify(legacy)
const plan = createStoryAssetPlan(legacy, source)
assert.equal(JSON.stringify(legacy), before)
assert.deepEqual(plan, createStoryAssetPlan(normalized, source), 'legacy enters through the existing normalizer')
assert.deepEqual(plan, createStoryAssetPlan(legacy, source), 'deterministic plan')
const byKey = new Map(plan.assets.map(asset => [asset.key, asset]))
for (const key of ['background:start', 'background:end', 'voice:test.m4a', 'lipsync:adxlip/test.json',
  'bgm:song', 'ambient:rain', 'se:door', 'image-icon:047shu', 'effect-texture:fx_adv_flare_01']) assert.ok(byKey.has(key), key)
assert.equal(byKey.get('spine-bundle:047shu_005_00').dependencyState, 'pending')
assert.deepEqual(byKey.get('spine-bundle:047shu_005_00').dependencies, ['spine-skeleton:047shu_005_00', 'spine-atlas:047shu_005_00'])
assert.ok(byKey.get('background:end').uses.some(use => use.path.startsWith('cues[')), 'cue-only requirements carry provenance')
assert.ok(byKey.get('background:end').uses.some(use => use.stepIndex === 1 && use.stepId === 90))
assert.equal(plan.assets.filter(asset => asset.key === 'background:start').length, 1, 'shared requirements deduplicate')
assert.equal(plan.dependenciesComplete, false, 'skel/atlas identity is not a complete texture bundle')
const strict = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{ step_id: 20, type: 'adv',
  entry_snapshot: { bg: 'entry', spines: [] }, settled_snapshot: { bg: 'future', spines: [] },
  cues: [{ cue_id: 'only', action: 'se.play', payload: { cue: 'only-in-cue' } }] }] }
const strictPlan = createStoryAssetPlan(strict, source)
assert.deepEqual(strictPlan.assets.map(a => a.key), ['background:entry', 'background:future', 'se:only-in-cue'])
assert.equal(strictPlan.dependenciesComplete, true, 'complete logical dependencies does not mean downloaded')
const unknown = structuredClone(strict)
unknown.steps[0].entry_snapshot.new_resource_field = 'future'
unknown.steps[0].cues.push({ action: 'future.resource', payload: { uri: 'not-inferred' } })
const uncertain = createStoryAssetPlan(unknown, source)
assert.equal(uncertain.dependenciesComplete, false)
assert.ok(uncertain.unresolved.some(item => item.reason === 'unclassified-snapshot-field'))
assert.ok(uncertain.unresolved.some(item => item.reason === 'unclassified-cue:future.resource'))
assert.throws(() => createStoryAssetPlan(strict, { ...source, file: '../raw.json' }), /source file/)
assert.throws(() => createStoryAssetPlan({ ...strict, steps: [...strict.steps, ...strict.steps] }, source), /unique/)

// Effect textures resolve to the exact files the effect managers request:
// composite effects contribute every part, unique ones a single texture, and
// generated overlays no requirement at all.
const effects = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [{ step_id: 1, type: 'adv',
  entry_snapshot: { bg: 'room', spines: [], bg_effects: [{ id: 'fx_adv_rain_heavy2' }, { id: 'cameraflare' }],
    screen_effects: [{ type: 'single', id: 'fx_adv_kamifubuki' }, { type: 'fadein', color: '#FFF' }] },
  settled_snapshot: { bg: 'room', spines: [] } }] }
const effectPlan = createStoryAssetPlan(effects, source)
const effectTextures = effectPlan.assets.filter(asset => asset.kind === 'effect-texture').map(asset => asset.id)
assert.deepEqual(effectTextures, ['fx_adv_rain', 'fx_adv_flare_01', 'fx_adv_sakura', 'fx_adv_star'],
  'composite effects expand, heavy rain shares the rain texture and overlays add none')
assert.equal(effectPlan.dependenciesComplete, true, 'mapped effect textures are complete logical requirements')
const cameraflare = effectPlan.assets.find(asset => asset.id === 'fx_adv_flare_01')
assert.equal(cameraflare.runtimeDisabled, 'cameraflare-re-authored-as-particles')
assert.ok(cameraflare.uses.some(use => use.path === 'entry_snapshot.bg_effects[1]'), 'effect provenance is kept')
assert.equal(effectPlan.assets.find(asset => asset.id === 'fx_adv_rain').runtimeDisabled, undefined)
const unknownEffect = structuredClone(effects)
unknownEffect.steps[0].entry_snapshot.bg_effects = [{ id: 'fx_adv_unknown' }]
unknownEffect.steps[0].entry_snapshot.screen_effects = []
const unmapped = createStoryAssetPlan(unknownEffect, source)
assert.equal(unmapped.dependenciesComplete, false)
assert.ok(unmapped.unresolved.some(item => item.reason === 'unmapped-effect-texture'),
  'an effect with no texture mapping must stay explicitly unresolved')
assert.deepEqual(unmapped.assets.filter(asset => asset.kind === 'effect-texture'), [],
  'an unmapped effect must not be silently reported as satisfied')
console.log('Story asset plan verified: strict/compat, entry/settled/cues, deduplication, source provenance, effect textures and unresolved dependencies')

if (process.argv.includes('--local-sources')) {
  const manifest = JSON.parse(await fs.readFile(new URL('../public/data/reading/manifest.json', import.meta.url)))
  const totals = {}, unresolved = {}
  let open = 0
  for (const entry of manifest.entries) {
    const bytes = await fs.readFile(new URL(`../public/data/compiled/${entry.source_file}`, import.meta.url))
    const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    assert.equal(sha256, entry.source_sha256)
    const current = createStoryAssetPlan(JSON.parse(bytes), { file: entry.source_file, sha256 })
    if (!current.dependenciesComplete) open++
    for (const asset of current.assets) totals[asset.kind] = (totals[asset.kind] || 0) + 1
    for (const item of current.unresolved) unresolved[item.reason] = (unresolved[item.reason] || 0) + 1
  }
  console.log(JSON.stringify({ documents: manifest.entries.length, openDependencyPlans: open, perDocumentAssetTotals: totals, unresolved }, null, 2))
}
