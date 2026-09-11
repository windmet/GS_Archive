import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { communicationUiAssets } from '../shared/story/CommunicationUiAssets.js'
import { getMobileBgUrl, getMobileIconUrl, getUnitMobileBgUrl, getStampUrl, getEmojiUrl }
  from '../src/utils/AssetResolver.js'
import { getUnitCodeByCharaId } from '../src/utils/UnitNameMap.js'
import { IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'
import { SCREEN_EFFECT_HANDLER_IDS } from '../shared/story/EffectTextures.js'

/**
 * The plan enumerates communication assets for a whole scenario statically; the
 * scenes request them one step at a time. Both have to agree, so this drives
 * the runtime's own inheritance rule and URL helpers over the real corpus and
 * compares the result against what the plan recorded.
 */

const source = { file: 'episodes/test.json', sha256: `sha256:${'a'.repeat(64)}` }

// 1. The URL helpers the plan shares with the scenes must be the ones the
//    scenes import, not a parallel copy that can drift.
const callScene = await fs.readFile(new URL('../src/components/mobile/MobileCallScene.vue', import.meta.url), 'utf8')
const chatScene = await fs.readFile(new URL('../src/components/mobile/MobileChatScene.vue', import.meta.url), 'utf8')
const bubble = await fs.readFile(new URL('../src/components/mobile/MobileMessageBubble.vue', import.meta.url), 'utf8')
const profile = await fs.readFile(new URL('../src/components/mobile/MobileCallProfile.vue', import.meta.url), 'utf8')
for (const [name, sourceText, helper] of [
  ['call scene background', callScene, 'getMobileBgUrl'],
  ['chat scene background', chatScene, 'getUnitMobileBgUrl'],
  ['message stamp/emoji', bubble, 'getStampUrl'],
  ['message stamp/emoji', bubble, 'getEmojiUrl'],
  ['message avatar', bubble, 'getMobileIconUrl'],
  ['call profile avatar', profile, 'getMobileIconUrl'],
]) {
  assert.match(sourceText, new RegExp(`\\b${helper}\\b`), `${name} must resolve through ${helper}`)
  assert.match(sourceText, /from '\.\.\/\.\.\/utils\/AssetResolver\.js'/,
    `${name} must take ${helper} from AssetResolver`)
}

// 2. A step's communication surface is decided by the step and its scene, never
//    by the scenario id alone: a call shows the character surface, a chat the
//    unit surface, and a chat with no resolvable unit shows neither.
const selfChara = '001tom'
assert.equal(getMobileBgUrl(selfChara), '/assets/idols/mobile_bg/image_chara_mobile_background_001tom.png')
assert.equal(getMobileIconUrl(selfChara), '/assets/idols/mobile_icons/image_chara_mobile_icon_001tom.png')
assert.equal(getUnitMobileBgUrl('01jup'), '/assets/units/mobile_bg/image_unit_mobile_background_01jup.png')
assert.equal(getStampUrl('image_mobile_stamp_001'), '/assets/stamps/image_mobile_stamp_001.png')
assert.equal(getEmojiUrl('emoji_001'), '/assets/emojis/emoji_001.png')
assert.equal(getUnitCodeByCharaId('047shu_001'), null,
  'a character with no unit must resolve no unit surface rather than guessing one')

// 3. Every requirement the plan records has to name an id a scene can actually
//    turn into a request; a requirement with no id would be unfetchable.
const unitScenario = { schema_version: 2, runtime_contract: 'story-runtime-v2', steps: [
  { step_id: 1, type: 'talk', entry_snapshot: { spines: [], talk_mode: true }, settled_snapshot: { spines: [], talk_mode: true },
    dialogue: { speaker_identity: { entity_id: '001tom' }, source_text: 'hi <emoji>image_mobile_stamp_001</emoji> and <emoji>emoji_abc</emoji>' },
    normalization: { unmapped_legacy_fields: [] } },
  { step_id: 2, type: 'call', entry_snapshot: { spines: [], phone_mode: true }, settled_snapshot: { spines: [], phone_mode: true },
    dialogue: { speaker_identity: { entity_id: '001tom' } }, normalization: { unmapped_legacy_fields: [] } },
  { step_id: 3, type: 'adv', entry_snapshot: { spines: [] }, settled_snapshot: { spines: [] },
    dialogue: { speaker_identity: { entity_id: '001tom' } }, normalization: { unmapped_legacy_fields: [] } },
] }
const unitPlan = createStoryAssetPlan(unitScenario, source)
const kinds = unitPlan.assets.map(asset => `${asset.kind}:${asset.id}`)
const unitCode = getUnitCodeByCharaId(selfChara)
assert.ok(unitCode, 'the fixture character must resolve a unit')
assert.ok(kinds.includes(`unit-mobile-background:${unitCode}`), kinds.join(','))
assert.ok(kinds.includes('mobile-icon:001tom'))
assert.ok(kinds.includes('stamp:image_mobile_stamp_001'), 'a stamp marker is a stamp requirement')
assert.ok(kinds.includes('emoji:emoji_abc'), 'a non-stamp marker is an emoji requirement')
assert.ok(kinds.includes('idol-mobile-background:001tom'), 'a call uses the character surface, not the unit one')
for (const asset of unitPlan.assets) assert.equal(typeof asset.id, 'string', `${asset.key} must carry an id`)
assert.deepEqual(unitPlan.unresolved, [], 'a fully determined conversation leaves nothing open')

// 4. `spine.fade` and `idol_color_transition` are tweened on a spine the plan
//    already enumerates, so accounting for them must not add a requirement and
//    must not leave a false gap.
const fadeScenario = { schema_version: 1, scenario_id: '8_2_x_001tom_001', steps: [
  { step_id: 1, type: 'adv', state: { bg: 'room',
    spines: [{ id: '001tom', model: '001tom_001_00', visible: true,
      fade: { type: 'in', duration: 0.5, delay: 0 }, idol_color_transition: { duration: 1, delay: 0 } }] } },
] }
const fadePlan = createStoryAssetPlan(fadeScenario, source)
assert.deepEqual(fadePlan.unresolved, [], 'tweened spine fields are accounted for, not open')
assert.deepEqual(fadePlan.assets.filter(asset => asset.kind.includes('fade')), [],
  'a tween on a loaded spine must not invent an asset requirement')
for (const handledBy of ['SpineStage:spine-alpha', 'SpineStage:spine-tint']) {
  assert.ok(fadePlan.accountedFields.some(field => field.handledBy === handledBy), handledBy)
}
// The handlers named in the coverage table have to exist in the stage that
// claims them, or the field is accounted for by nothing.
const spineStage = await fs.readFile(new URL('../src/components/SpineStage.vue', import.meta.url), 'utf8')
assert.match(spineStage, /animateSpineAlpha/, 'the claimed alpha handler must exist')
assert.match(spineStage, /setSpineColor/, 'the claimed tint handler must exist')
assert.match(spineStage, /spineState\.fade\?\.type/, 'the stage must actually branch on spine fade')

// 5. The screen effects the normalizer treats as animated must be exactly the
//    ones the effect managers implement. The normalizer keeps its own copy of
//    the ids to stay import-free, so the two are pinned together here.
const normalizerSource = await fs.readFile(new URL('../shared/story/ScenarioNormalizer.js', import.meta.url), 'utf8')
const declared = normalizerSource.match(/SCREEN_EFFECT_HANDLERS = new Set\(\[([^\]]*)\]\)/)
assert.ok(declared, 'the normalizer must declare its screen effect handler ids')
const normalizerIds = [...declared[1].matchAll(/'([^']+)'/g)].map(match => match[1]).sort()
assert.deepEqual(normalizerIds, [...SCREEN_EFFECT_HANDLER_IDS].sort(),
  'the normalizer must treat exactly the handlers the effect managers implement as animated')
assert.doesNotMatch(normalizerSource, /from\s+['"][^'"]*\.\.?\//,
  'shared normalization must stay free of repository-relative imports')

// 6. An unhandled screen effect is a real no-op, so it stays marked; a handled
//    one is a texture requirement and must not be marked.
const noopScenario = { schema_version: 1, steps: [{ step_id: 1, type: 'adv',
  state: { bg: 'room', spines: [], screen_effects: [{ type: 'single', id: 'fx_adv_unknown' }] } }] }
const noopPlan = createStoryAssetPlan(noopScenario, source)
assert.ok(noopPlan.unresolved.some(item => item.reason === 'unmapped-effect-texture'))
assert.ok(noopPlan.unresolved.some(item => item.reason === 'unmapped-legacy-field'))
assert.deepEqual(noopPlan.accountedFields.filter(field => field.field === 'state.screen_effects'), [],
  'an effect nothing animates is a gap, not an accounted field')

console.log('Communication asset parity verified: shared URL helpers, surface selection, tween coverage and no-op marking')

// The corpus run checks the plan against a second, independent walk of the
// scenes, exactly as the scenes themselves drive it: same requirement helper,
// same resolver, but the grouping recomputed from scratch.
if (process.argv.includes('--local-sources')) {
  const { resolveCommunicationContext } =
    await import('../src/core/story-runtime/CommunicationPresentationContext.js')
  const { normalizeScenario } = await import('../shared/story/ScenarioNormalizer.js')
  const manifest = JSON.parse(await fs.readFile(new URL('../public/data/reading/manifest.json', import.meta.url)))
  const totals = {}, unresolved = {}, accounted = {}, divergence = [], recordedReasons = new Set()
  const recordedCorpus = new Set()
  let open = 0, scenes = 0, plannedRequirements = 0
  for (const entry of manifest.entries) {
    const bytes = await fs.readFile(new URL(`../public/data/compiled/${entry.source_file}`, import.meta.url))
    const sha256 = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    assert.equal(sha256, entry.source_sha256)
    const raw = JSON.parse(bytes)
    const current = createStoryAssetPlan(raw, { file: entry.source_file, sha256 })
    if (!current.dependenciesComplete) open++
    for (const asset of current.assets) totals[asset.kind] = (totals[asset.kind] || 0) + 1
    for (const item of current.unresolved) unresolved[item.reason] = (unresolved[item.reason] || 0) + 1
    for (const field of current.accountedFields) accounted[field.handledBy] = (accounted[field.handledBy] || 0) + 1

    const recorded = new Set(current.unresolved.filter(item => item.path === 'communication')
      .map(item => { recordedReasons.add(item.reason); return `reason:${item.reason}` }))
    for (const asset of current.assets) {
      for (const use of asset.uses) if (use.path === 'communication') recorded.add(`${asset.kind}|${asset.id}`)
    }
    for (const key of recorded) recordedCorpus.add(key)

    // Independent walk: every step asks the runtime resolver what scene it is
    // in, then asks the same helper what that scene loads. The walk runs on the
    // normalized scenario because that is what the runtime resolves against — a
    // v2 file keeps its mode in the entry snapshot, so reading the raw steps
    // would find nothing and the comparison would pass vacuously.
    const steps = normalizeScenario(raw).steps
    const scenarioId = raw.scenario_id
    for (const [stepIndex, step] of steps.entries()) {
      const context = resolveCommunicationContext({ step, stepIndex, historyStack: [], steps, scenarioId })
      if (!context.mode) continue
      scenes++
      const text = step?.dialogue?.source_text
      const expected = communicationUiAssets({
        mode: context.mode, unitCode: context.unitCode || null, charaId: context.primaryCharaId || '',
        texts: typeof text === 'string' && text ? [text] : [],
      })
      for (const requirement of expected) {
        plannedRequirements++
        const key = requirement.reason ? `reason:${requirement.reason}` : `${requirement.kind}|${requirement.id}`
        if (!recorded.has(key)) divergence.push({ file: entry.source_file, stepIndex, key })
      }
    }
  }
  // A walk that finds no scenes proves nothing, so the corpus has to produce
  // resolved requirements of both kinds. A scene that keeps the phone on screen
  // without an identifiable character is a real outcome — the call scene falls
  // back to its neutral surface and loads no image — so it must not be the only
  // thing found, or the comparison would be describing nothing but fallbacks.
  assert.ok(scenes > 0, 'the corpus must yield communication steps')
  assert.ok(plannedRequirements > scenes, 'every communication step must yield a surface requirement')
  assert.ok([...recordedCorpus].some(key => key.startsWith('idol-mobile-background|')),
    'the corpus must contain a call scene that resolves its character')
  assert.ok([...recordedCorpus].some(key => key.startsWith('mobile-icon|')),
    'the corpus must contain a scene that resolves a character avatar')
  assert.ok([...recordedCorpus].some(key => key.startsWith('unit-mobile-background|')),
    'the corpus must contain a chat scene that resolves its unit')
  assert.ok(recordedReasons.has('communication-without-character'),
    'an unresolvable call character must stay stated rather than silently dropped')
  console.log(JSON.stringify({ documents: manifest.entries.length, openDependencyPlans: open, communicationSteps: scenes,
    plannedRequirements, runtimeDivergence: divergence.length, sampleDivergence: divergence.slice(0, 10),
    perDocumentAssetTotals: totals, unresolved, accountedFields: accounted }, null, 2))
}
