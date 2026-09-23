import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { createHash } from 'node:crypto'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { communicationUiAssets } from '../shared/story/CommunicationUiAssets.js'
import { getMobileBgUrl, getMobileIconUrl, getUnitMobileBgUrl, getStampUrl, getEmojiUrl }
  from '../src/utils/AssetResolver.js'
import { getUnitCodeByCharaId } from '../src/utils/UnitNameMap.js'
import { IDOL_NAME_TO_ID, IDOL_ID_TO_NAME } from '../src/utils/IdolNameMap.js'
import { normalizeLegacyDialogue, createChoiceSelectionRecord } from '../src/localization/story/LegacyDialogueAdapter.js'
import { resolveStoryText } from '../src/localization/story/StoryTextResolver.js'
import { normalizeLocalizedDisplay } from '../src/localization/story/LocalizedDisplay.js'
import { SCREEN_EFFECT_HANDLER_IDS } from '../shared/story/EffectTextures.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { resolveCommunicationContext } from '../src/core/story-runtime/CommunicationPresentationContext.js'

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
const callerProjection = callScene.match(/const charaId = computed\(\(\) => \{([^]*?)\n\}\)/)
assert.ok(callerProjection, 'production caller projection must exist')
function actualCaller(step, context) {
  return runInNewContext(`(() => {${callerProjection[1]}\n})()`, {
    props: { step, dialogue: step.dialogue }, context: { value: context }, IDOL_NAME_TO_ID,
  })
}

// Execute the actual message projection and inline parser. Expected message
// URLs here do not call communicationUiAssets or its marker classifier.
const productionFunction = (text, name) => {
  const match = text.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))
  assert.ok(match, `production function ${name} must exist`)
  return match[0]
}
const consumer = {
  IDOL_NAME_TO_ID, IDOL_ID_TO_NAME,
  context: { value: { primaryCharaId: '001tom' } },
  localization: { resolveDialogue: dialogue => ({ text: dialogue.source_text || '', speaker: dialogue.speaker || '' }) },
}
function localizeDialogue(dialogue, mode) {
  const normalized = normalizeLegacyDialogue(dialogue)
  const view = resolveStoryText({ ...normalized, preferences: { story_content_mode: mode } })
  return { speaker: view.speaker.display, text: [view.primary?.text, view.secondary?.text].filter(Boolean).join('\n'), view }
}
runInNewContext(['isProducer', 'cleanSpeaker', 'stepToMessage']
  .map(name => productionFunction(chatScene, name)).join('\n')
  + '\n' + productionFunction(bubble, 'messageParts'), consumer)
function renderedMessageImages(message) {
  if (!message.isProducer && message.isStamp) return [getStampUrl(message.stampId)]
  if (!message.display) return []
  const display = normalizeLocalizedDisplay(message.display)
  return [display.primary, display.secondary].filter(Boolean).flatMap(block =>
    consumer.messageParts(block.text).filter(part => part.type === 'emoji').map(part => getEmojiUrl(part.id)))
}
const actorCases = [
  { name: 'call speaker name', type: 'call', dialogue: { speaker: '天ヶ瀬 冬馬', source_text: 'hello' } },
  { name: 'call direct id wins over context', type: 'call', chara_id: '004ter', presentation_context: { primary_chara_id: '001tom' }, dialogue: { source_text: 'hello' } },
  { name: 'chat name-only avatar', type: 'talk', dialogue: { speaker: '天ヶ瀬 冬馬', source_text: 'hello' } },
  { name: 'chat stamp actor wins over step actor', type: 'talk_stamp', chara_id: '001tom', stamp: { id: 'image_mobile_stamp_001', chara_id: '004ter' }, dialogue: { speaker: '天道 輝', source_text: '' } },
  { name: 'producer has no avatar', type: 'talk', chara_id: '001tom', dialogue: { speaker: '<P>', source_text: 'reply' } },
  { name: 'history-sensitive legacy actor', type: 'talk', chara_id: 'legacy-actor', scenario_id: '3_001tom', dialogue: { speaker: 'legacy', source_text: 'reply' } },
]
for (const fixture of actorCases) {
  const step = { ...fixture, step_id: 1, state: { spines: [] } }
  const input = { schema_version: 1, scenario_id: fixture.scenario_id, steps: [step] }
  const normalized = normalizeScenario(input)
  const context = resolveCommunicationContext({ step: normalized.steps[0], stepIndex: 0, historyStack: [], steps: normalized.steps, scenarioId: input.scenario_id })
  consumer.context.value = context
  const actor = fixture.type === 'call' ? actualCaller(step, context) : consumer.stepToMessage(step)
  const expectedIcon = typeof actor === 'string' ? actor : (actor.isProducer ? '' : actor.charaId)
  const plan = createStoryAssetPlan(input, source)
  assert.deepEqual(plan.assets.filter(a => a.kind === 'mobile-icon').map(a => a.id), expectedIcon ? [expectedIcon] : [], fixture.name)
  if (fixture.type === 'call') assert.deepEqual(plan.assets.filter(a => a.kind === 'idol-mobile-background').map(a => a.id), actor ? [actor] : [], fixture.name)
  if (fixture.name === 'history-sensitive legacy actor') assert.ok(plan.unresolved.some(item => item.reason === 'communication-history-avatar-pending'))
}
const sourceMessageCases = [
  { name: 'explicit stamp', stamp: { id: 'image_mobile_stamp_001', chara_id: '001tom' }, text: 'ignored <emoji>emoji_other</emoji>' },
  { name: 'whole-message stamp', text: '<emoji>image_mobile_stamp_001</emoji>' },
  { name: 'inline stamp-shaped emoji', text: 'hello <emoji>image_mobile_stamp_001</emoji> and <emoji>emoji_abc</emoji>' },
  { name: 'repeated emoji', text: '<emoji>emoji_abc</emoji><emoji>emoji_abc</emoji>' },
  { name: 'invalid inline marker stays text', text: 'hello <emoji>../invalid</emoji>' },
  { name: 'legacy source text', dialogue: { text: 'legacy <emoji>emoji_old</emoji>' } },
  { name: 'legacy Japanese and Chinese', dialogue: { text_jp: '<emoji>emoji_jp</emoji>', text_cn: '<emoji>emoji_cn</emoji>' } },
  { name: 'stamp changes to inline in bilingual', dialogue: { source_text: '<emoji>image_mobile_stamp_001</emoji>', text_cn: 'translated' } },
  { name: 'translation stamp', dialogue: { source_text: 'original', text_cn: '<emoji>image_mobile_stamp_002</emoji>' } },
]
for (const fixture of sourceMessageCases) {
  const step = { step_id: 1, type: fixture.stamp ? 'talk_stamp' : 'talk',
    state: { spines: [], talk_mode: true }, chara_id: '001tom', stamp: fixture.stamp,
    dialogue: { speaker: '天ヶ瀬 冬馬', ...(fixture.dialogue || { source_text: fixture.text }) } }
  const expectedUrls = new Set()
  for (const mode of ['original', 'translation', 'bilingual']) {
    consumer.localization.resolveDialogue = dialogue => localizeDialogue(dialogue, mode)
    const message = consumer.stepToMessage(step)
    for (const url of renderedMessageImages(message)) expectedUrls.add(url)
  }
  for (const schema_version of [1, 2]) {
    const input = schema_version === 1 ? { schema_version, steps: [step] }
      : { schema_version, runtime_contract: 'story-runtime-v2', steps: [{ ...step,
        entry_snapshot: step.state, settled_snapshot: step.state, cues: [] }] }
    const plan = createStoryAssetPlan(input, source)
    const plannedUrls = plan.assets.filter(asset => asset.kind === 'stamp' || asset.kind === 'emoji')
      .map(asset => asset.kind === 'stamp' ? getStampUrl(asset.id) : getEmojiUrl(asset.id))
    assert.deepEqual([...plannedUrls].sort(), [...expectedUrls].sort(), `${fixture.name} / v${schema_version}`)
  }
}
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
assert.ok(kinds.includes('emoji:image_mobile_stamp_001'), 'an inline stamp-shaped marker uses the emoji URL')
assert.ok(!kinds.includes('stamp:image_mobile_stamp_001'), 'mixed text is not a whole-message stamp')
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

// A list mixing a playable effect with an unsupported one is still partly a
// no-op. Reporting the field only when *nothing* in it is handled would let one
// playable entry hide its unsupported siblings from the diagnostics.
const mixedFields = effects => normalizeScenario({ schema_version: 1,
  steps: [{ step_id: 1, type: 'adv', state: { bg: 'room', spines: [], screen_effects: effects } }] })
  .steps[0].normalization.unmapped_legacy_fields
assert.deepEqual(mixedFields([{ type: 'single', id: 'fx_adv_punch' }]), [],
  'a fully handled list is not a gap')
for (const effects of [
  [{ type: 'single', id: 'fx_adv_punch' }, { type: 'single', id: 'fx_adv_unknown' }],
  [{ type: 'single', id: 'fx_adv_unknown' }, { type: 'single', id: 'fx_adv_punch' }],
]) {
  assert.ok(mixedFields(effects).includes('state.screen_effects'),
    `an unsupported effect must stay reported even beside a playable one (${JSON.stringify(effects)})`)
}
for (const effects of [
  [{ type: 'fadein', color: '#FFF' }, { type: 'single', id: 'fx_adv_punch' }],
  [{ type: 'fadeout', color: '#000' }],
]) {
  assert.deepEqual(mixedFields(effects), [], 'generated overlays are handled in their own right')
}

// 7. Branch history. Everywhere else this file drives the resolver and the
//    requirement helper together, which can only prove the plan called the
//    shared rule, never that the rule itself is right. These fixtures carry a
//    hand-written expectation instead, pinning the two properties the corpus
//    run cannot check:
//      - real history beats linear order, so one choice shows the scene the
//        reader actually arrived from;
//      - a boundary step stops inheritance rather than being passed through.
//    These fixtures cover their named surfaces only; they do not prove a
//    superset for arbitrary message histories or translated/choice markers.
const branchScenario = { schema_version: 1, scenario_id: '1_4_001_01_e', steps: [
  { step_id: 1, type: 'talk', state: { spines: [], talk_mode: true },
    dialogue: { speaker_identity: { entity_id: '001tom' }, source_text: 'hi' } },
  { step_id: 2, type: 'call', state: { spines: [], phone_mode: true },
    dialogue: { speaker_identity: { entity_id: '004ter' }, source_text: 'hello' } },
  { step_id: 3, type: 'choice', state: { spines: [] }, options: [{ step_id: 4 }], dialogue: {} },
] }
const branchSteps = normalizeScenario(branchScenario).steps
// A choice reached in a call may later be injected into chat history. Run the
// production historyMessages callback with the actual selection record.
const choiceScenario = structuredClone(branchScenario)
choiceScenario.steps[2].options = [
  { option_id: 'stamp-shaped', source_text: '<emoji>image_mobile_stamp_reply</emoji>' },
  { option_id: 'detail', detail_source_text: 'reply <emoji>emoji_detail</emoji>' },
  { option_id: 'external', source_text: 'source', text_ref: { unit_id: 'reply-unit', source_hash: 'source-hash' } },
]
const beforeChoiceScan = JSON.stringify(choiceScenario)
const choicePlan = createStoryAssetPlan(choiceScenario, source)
const historyProjection = chatScene.match(/const historyMessages = computed\(\(\) => \{([^]*?)\n\}\)/)
assert.ok(historyProjection, 'production history message projection must exist')
for (const [optionIndex, option] of choiceScenario.steps[2].options.entries()) {
  const selection = createChoiceSelectionRecord(option)
  const projected = runInNewContext(`(() => {${historyProjection[1]}\n})()`, {
    props: { historyStack: [], stepIndex: 2, choiceTexts: { 2: selection } },
    talkByIndex: { value: {} },
    localization: { resolveChoiceSelection: record => ({ text: record.source_text }) },
  })
  assert.equal(projected[0].isProducer, true)
  assert.equal(projected[0].isStamp, false)
  const expected = consumer.messageParts(projected[0].display.text).filter(part => part.type === 'emoji')
  for (const part of expected) {
    const asset = choicePlan.assets.find(asset => asset.kind === 'emoji' && asset.id === part.id)
    assert.ok(asset, 'selected replies use emoji URLs even for whole stamp-shaped markers')
    assert.ok(asset.uses.some(use => use.stepIndex === 2 && use.optionIndex === optionIndex), 'choice provenance')
  }
}
assert.equal(JSON.stringify(choiceScenario), beforeChoiceScan, 'discovery must not choose a branch or mutate source')
assert.ok(choicePlan.unresolved.some(item => item.reason === 'communication-history-dependent'))
assert.ok(choicePlan.unresolved.some(item => item.reason === 'communication-translation-overlay-pending' && item.optionIndex === 2))
const externalDialogue = structuredClone(unitScenario)
externalDialogue.steps[0].dialogue.text_ref = { unit_id: 'external-dialogue', source_hash: 'source-hash' }
const externalPlan = createStoryAssetPlan(externalDialogue, source)
assert.ok(externalPlan.unresolved.some(item => item.reason === 'communication-translation-overlay-pending' && item.stepIndex === 0))
assert.equal(externalPlan.dependenciesComplete, false, 'source inputs cannot prove unloaded translation images')
const resolveAt = (stepIndex, historyStack) => resolveCommunicationContext({
  step: branchSteps[stepIndex], stepIndex, historyStack, steps: branchSteps,
  scenarioId: branchScenario.scenario_id,
})
// Reached by reading straight through: the call step is the nearest predecessor.
const viaLinear = resolveAt(2, [])
assert.equal(viaLinear.mode, 'call', 'a choice with no history inherits the nearest predecessor')
assert.equal(viaLinear.primaryCharaId, '004ter')
// Reached on a branch that visited the talk step instead: real history wins over
// linear order, which is the whole reason the plan cannot simply assume one path.
const viaHistory = resolveAt(2, [0])
assert.equal(viaHistory.mode, 'talk', 'a choice inherits the scene on the real history path')
assert.equal(viaHistory.primaryCharaId, '001tom')
assert.notEqual(`${viaLinear.mode}/${viaLinear.primaryCharaId}`, `${viaHistory.mode}/${viaHistory.primaryCharaId}`,
  'the fixture is only meaningful while the two paths disagree')

const branchText = index => {
  const text = branchSteps[index]?.dialogue?.source_text
  return typeof text === 'string' && text ? [text] : []
}
const branchRequirements = (context, index) => communicationUiAssets({
  mode: context.mode, unitCode: context.unitCode || null,
  charaId: context.primaryCharaId || '', texts: branchText(index),
})
const plannedKeys = new Set()
const branchPlan = createStoryAssetPlan(branchScenario, source)
for (const asset of branchPlan.assets) {
  for (const use of asset.uses) if (use.path === 'communication') plannedKeys.add(`${asset.kind}|${asset.id}`)
}
for (const item of branchPlan.unresolved) {
  assert.equal(item.reason, 'communication-history-dependent', 'unverified history must remain explicit')
}
assert.equal(branchPlan.dependenciesComplete, false, 'named branch fixtures do not close arbitrary-history requirements')
assert.ok(branchPlan.unresolved.some(item => item.reason === 'communication-history-dependent'))
for (const [context, index] of [[viaLinear, 2], [viaHistory, 2]]) {
  for (const requirement of branchRequirements(context, index)) {
    assert.ok(plannedKeys.has(`${requirement.kind}|${requirement.id}`),
      `the plan must enumerate ${requirement.kind}:${requirement.id} from the ${context.mode} branch`)
  }
}

// An `adv` step between the conversation and the choice ends the inheritance:
// the reader has left the phone scene, so the choice must not keep showing one.
const boundaryScenario = { schema_version: 1, scenario_id: '1_4_001_01_e', steps: [
  { step_id: 1, type: 'talk', state: { spines: [], talk_mode: true },
    dialogue: { speaker_identity: { entity_id: '001tom' }, source_text: 'hi' } },
  { step_id: 2, type: 'adv', state: { spines: [] }, dialogue: {} },
  { step_id: 3, type: 'choice', state: { spines: [] }, options: [{ step_id: 4 }], dialogue: {} },
] }
const boundarySteps = normalizeScenario(boundaryScenario).steps
const boundaryAt = (stepIndex, historyStack) => resolveCommunicationContext({
  step: boundarySteps[stepIndex], stepIndex, historyStack, steps: boundarySteps,
  scenarioId: boundaryScenario.scenario_id,
})
assert.equal(boundaryAt(2, [0]).mode, 'talk', 'a conversation before the boundary is still inheritable')
assert.equal(boundaryAt(2, [0]).primaryCharaId, '001tom')
assert.equal(boundaryAt(2, [1]).mode, null, 'a boundary step ends inheritance instead of being passed through')
assert.equal(boundaryAt(2, []).mode, null, 'the linear fallback stops at the same boundary')

console.log('Communication source-message consumer fixtures verified (strict/compat); URL/surface consistency and tween coverage passed; arbitrary histories/translations remain outside this proof')

// The corpus run is a consistency walk using the same resolver/helper, not an
// independent consumer proof. The production-function fixtures above supply
// independent evidence for source message image selection.
if (process.argv.includes('--local-sources')) {
  const manifest = JSON.parse(await fs.readFile(new URL('../public/data/reading/manifest.json', import.meta.url)))
  const totals = {}, unresolved = {}, accounted = {}, divergence = [], recordedReasons = new Set()
  const consumerDivergence = []
  const actorDivergence = []
  let consumerImageChecks = 0
  let consumerActorChecks = 0
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

    // Consistency walk: every step asks the runtime resolver what scene it is
    // in, then asks the same helper what that scene loads. The walk runs on the
    // normalized scenario because that is what the runtime resolves against — a
    // v2 file keeps its mode in the entry snapshot, so reading the raw steps
    // would find nothing and the comparison would pass vacuously.
    const steps = normalizeScenario(raw).steps
    const scenarioId = raw.scenario_id
    const plannedMessageUrls = new Set(current.assets.filter(asset => ['stamp', 'emoji'].includes(asset.kind))
      .map(asset => asset.kind === 'stamp' ? getStampUrl(asset.id) : getEmojiUrl(asset.id)))
    const plannedActorKeys = new Set(current.assets.filter(asset => ['mobile-icon', 'idol-mobile-background'].includes(asset.kind))
      .map(asset => `${asset.kind}:${asset.id}`))
    const checkActor = (kind, id, stepIndex) => {
      if (!id) return
      consumerActorChecks++
      if (!plannedActorKeys.has(`${kind}:${id}`)) actorDivergence.push({ file: entry.source_file, stepIndex, kind, id })
    }
    for (const [stepIndex, step] of steps.entries()) {
      const context = resolveCommunicationContext({ step, stepIndex, historyStack: [], steps, scenarioId })
      if (context.mode === 'call') {
        const caller = actualCaller(step, context)
        checkActor('mobile-icon', caller, stepIndex)
        checkActor('idol-mobile-background', caller, stepIndex)
      }
      if (['talk', 'talk_stamp'].includes(step.type)) {
        consumer.context.value = context
        for (const mode of ['original', 'translation', 'bilingual']) {
          consumer.localization.resolveDialogue = dialogue => localizeDialogue(dialogue, mode)
          const message = consumer.stepToMessage(step)
          if (mode === 'original' && !message.isProducer) checkActor('mobile-icon', message.charaId, stepIndex)
          for (const url of renderedMessageImages(message)) {
            consumerImageChecks++
            if (!plannedMessageUrls.has(url)) consumerDivergence.push({ file: entry.source_file, stepIndex, mode, url })
          }
        }
      }
      if (!context.mode) continue
      scenes++
      const text = step?.stamp?.id ? null : step?.dialogue?.source_text
      const expected = communicationUiAssets({
        mode: context.mode, unitCode: context.unitCode || null, charaId: context.mode === 'call' ? actualCaller(step, context) : '',
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
    consumerImageChecks, consumerImageDivergence: consumerDivergence.length, sampleConsumerDivergence: consumerDivergence.slice(0, 10),
    consumerActorChecks, consumerActorDivergence: actorDivergence.length, sampleActorDivergence: actorDivergence.slice(0, 10),
    perDocumentAssetTotals: totals, unresolved, accountedFields: accounted }, null, 2))
  assert.equal(divergence.length, 0, 'linear consistency divergence must fail the verifier')
  assert.ok(consumerImageChecks > 0, 'independent source/inline message image check must not pass vacuously')
  assert.equal(consumerDivergence.length, 0, 'actual message image URLs must be represented in the plan')
  assert.ok(consumerActorChecks > 0, 'independent caller/avatar checks must not pass vacuously')
  assert.equal(actorDivergence.length, 0, 'actual caller backgrounds and message/profile avatars must be planned')
}
