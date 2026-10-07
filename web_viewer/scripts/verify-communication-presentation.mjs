import assert from 'node:assert/strict'
import { resolveStoryPresentation } from '../shared/story/StoryPresentation.js'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { createStoryAssetPriority, assetPriority } from '../shared/story/StoryAssetPriority.js'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'
import { useStoryRuntimeCues } from '../src/core/story-runtime/useStoryRuntimeCues.js'

const step = (type, id) => ({ step_id: id, type, chara_id: '040ren',
  dialogue: { speaker: '牙崎 漣', text: `${type} source`, voice: type === 'call' ? 'authored_voice' : null },
  entry_snapshot: { bg: null, spines: [{ id: '040ren', model: 'fixture' }] },
  settled_snapshot: { bg: null, spines: [] }, cues: [] })
const scenario = types => ({ schema_version: 2, runtime_contract: 'story-runtime-v2', scenario_id: 'fixture', steps: types.map(step) })
const present = (s, i, historyStack = []) => resolveStoryPresentation({ step: s.steps[i], stepIndex: i, steps: s.steps, historyStack })
const call = scenario(['call', 'call'])
assert.equal(present(call, 0).needsStage, false)
const mixed = scenario(['adv', 'call', 'adv', 'choice'])
mixed.steps.forEach(s => { s.entry_snapshot.phone_mode = true })
assert.deepEqual(mixed.steps.map((_, i) => present(mixed, i).surface), ['stage', 'call', 'stage', 'stage'])
const chat = scenario(['adv', 'talk', 'choice', 'talk', 'adv'])
assert.equal(present(chat, 2, [0, 1]).surface, 'chat')
assert.equal(present(chat, 4, [0, 1, 2, 3]).surface, 'stage')
const intro = scenario(['fadeout', 'stage', 'call'])
intro.steps[0].entry_snapshot.spines = []; intro.steps[1].entry_snapshot.spines = []
assert.equal(present(intro, 0).needsStage, false)
assert.equal(present(intro, 1).needsStage, false)
const source = { knownIdolIds: new Set(['040ren']), file: 'fixture.json', sha256: `sha256:${'a'.repeat(64)}` }
const plan = createStoryAssetPlan(mixed, source)
const projection = createStoryAssetPriority(mixed, { initialStep: 2 })
assert.equal(assetPriority(plan.assets.find(a => a.kind === 'spine-skeleton'), projection), 'near')
const only = createStoryAssetPlan(call, source)
assert.equal(assetPriority(only.assets.find(a => a.kind === 'spine-skeleton'), createStoryAssetPriority(call)), 'deferred')
assert.ok(only.assets.some(a => a.kind === 'voice'), 'authored communication voice retained')
assert.equal(assetPriority(only.assets.find(a => a.kind === 'mobile-icon'), createStoryAssetPriority(call)), 'critical')

const readingSource = scenario(['adv', 'talk', 'talk_stamp', 'call', 'adv'])
readingSource.steps[2].stamp = { id: 'image_mobile_stamp_040ren_01', speaker: '牙崎 漣' }
const reading = createReadingDocument(readingSource, { ...source, documentId: 'fixture', logicalId: 'fixture' })
assert.equal(reading.status, 'ready')
assert.deepEqual(reading.rows.map(r => r.presentation || null), [null, 'talk', 'talk', 'call', null])
assert.equal(reading.rows[2].kind, 'stamp')
assert.equal(reading.rows[2].source_text, '')
assert.equal(reading.rows[2].anchor.step_index, 2)
assert.equal(reading.rows[2].media.id, readingSource.steps[2].stamp.id)
readingSource.steps.push({ step_id: 5, type: 'choice', options: [] })
assert.equal(createReadingDocument(readingSource, { ...source, documentId: 'fixture', logicalId: 'fixture' }).status, 'unsupported')

// Runtime readiness must not touch frozen actors; returning ADV must gate again.
globalThis.window = {}
let raf = 0; const pendingFrames = new Map()
globalThis.requestAnimationFrame = fn => { pendingFrames.set(++raf, fn); return raf }
globalThis.cancelAnimationFrame = id => pendingFrames.delete(id)
let checks = 0, projections = 0, warms = 0, audio = 0, last
const currentStepIndex = { value: 1 }
const manager = { clearBackground: () => projections++ }
const stage = { value: { manager, getSceneReadiness: () => { checks++; return { status: 'playable' } } } }
const runtime = useStoryRuntimeCues({ compiledData: { value: mixed }, currentStepIndex, spineStageRef: stage,
  needsStage: () => present(mixed, currentStepIndex.value).needsStage,
  prepareCommunication: async () => { warms++; return { status: 'ready' } },
  prepareStepAudio: async () => { audio++; return { status: 'ready' } },
  onReadinessChange: r => { last = r }, isPaused: () => true })
const settle = () => new Promise(resolve => setImmediate(resolve))
runtime.handleStepChange(); await settle()
assert.equal(last.status, 'playable'); assert.equal(checks, 0); assert.equal(projections, 0)
assert.equal(warms, 1); assert.equal(audio, 1)
currentStepIndex.value = 2; runtime.handleStepChange(); await settle()
assert.equal(last.status, 'playable'); assert.equal(checks, 1); assert.equal(projections, 1)
runtime.cleanup()
// A late image completion cannot publish readiness for a newer step.
let release, cancelledSignal
currentStepIndex.value = 1
const cancellation = useStoryRuntimeCues({ compiledData: { value: mixed }, currentStepIndex, spineStageRef: { value: null },
  needsStage: () => false, prepareCommunication: ({ signal }) => { cancelledSignal = signal; return new Promise(r => { release = r }) },
  onReadinessChange: r => { last = r }, isPaused: () => true })
cancellation.handleStepChange(); cancellation.cancelCurrentStep(); release({ status: 'ready' }); await settle()
assert.equal(cancelledSignal.aborted, true); assert.equal(last.status, 'waiting')
cancellation.cleanup()

// A one-to-one call or chat belongs to its owner's room. Others may speak in it (Haruna and
// Amehiko in Ren's card call 040ren_403_2_4_040_03_09_c), but background, theme and caller
// card stay the owner's; the guest is named on the line. The owner is read from the scenario
// id and must agree with the communication index for every one-to-one record.
{
  const { readFileSync } = await import('node:fs')
  const { communicationOwnerId, resolveCommunicationContext } = await import('../src/core/story-runtime/CommunicationPresentationContext.js')
  const mobile = JSON.parse(readFileSync(new URL('../public/data/masterdata/mobile_archive_index.json', import.meta.url), 'utf8'))
  const oneToOne = Object.values(mobile.scenarios).filter(row => ['idol_phone', 'idol_talk'].includes(row.kind))
  assert.ok(oneToOne.length > 1000, 'one-to-one communications are present')
  for (const row of oneToOne) assert.equal(communicationOwnerId(row.compiled_file), row.idol_code, `owner of ${row.compiled_file}`)
  const guestCall = { scenario_id: '040ren_403_2_4_040_03_09_c', steps: [
    { type: 'call', chara_id: '040ren', dialogue: { speaker: '牙崎 漣', text: 'a' } },
    { type: 'call', chara_id: '023har', dialogue: { speaker: '若里 春名', text: 'b' } }] }
  const context = resolveCommunicationContext({ step: guestCall.steps[1], stepIndex: 1, historyStack: [0], steps: guestCall.steps, scenarioId: guestCall.scenario_id })
  assert.equal(context.ownerCharaId, '040ren', 'a guest line keeps the call in the owner room')
  const callScene = readFileSync(new URL('../src/components/mobile/MobileCallScene.vue', import.meta.url), 'utf8')
  for (const marker of [
    'const roomCharaId = computed(() => context.value.ownerCharaId || charaId.value)',
    'const bgUrl = computed(() => (roomCharaId.value ? getMobileBgUrl(roomCharaId.value)',
    'getUnitCodeByCharaId(roomCharaId.value)',
    '<MobileCallProfile :chara-id="roomCharaId"',
    'v-if="guestSpeaker" class="dialogue-speaker"',
  ]) assert.ok(callScene.includes(marker), `call scene keeps the owner room: ${marker}`)
}
// Every chat sits on a unit's background, as in the game: a one-to-one chat on its owner's unit,
// a story chat among members of one unit on that unit, titled as the unit's group chat.
{
  const { readFileSync } = await import('node:fs')
  const { resolveCommunicationContext } = await import('../src/core/story-runtime/CommunicationPresentationContext.js')
  const chatContext = file => {
    const doc = JSON.parse(readFileSync(new URL(`../public/data/compiled/${file}`, import.meta.url), 'utf8'))
    const index = doc.steps.findIndex(step => step.type === 'talk')
    return resolveCommunicationContext({ step: doc.steps[index], stepIndex: index, historyStack: [], steps: doc.steps, scenarioId: doc.scenario_id })
  }
  const minori = chatContext('1_x_011min_1_8_011_01.json')
  assert.equal(minori.isGroup, false, 'a private chat is one-to-one')
  assert.equal(minori.unitCode, '04bei', 'Minori’s private chat sits on Beit’s background')
  const cfirst = chatContext('1_3_10001_01.json')
  assert.equal(cfirst.isGroup, true, 'Shu, Momohito and Eishin chatting in their event story is a group chat')
  assert.equal(cfirst.unitCode, '16cfi', 'their chat sits on C.FIRST’s background')
}

// The communication read model names who else is on a call, per call, from the story catalog.
{
  const { existsSync, readFileSync } = await import('node:fs')
  const read = path => JSON.parse(readFileSync(new URL('../public/data/' + path, import.meta.url), 'utf8'))
  // compiled/index.json is gitignored corpus and only supplies group titles; CI runs without it.
  const compiledIndex = () => existsSync(new URL('../public/data/compiled/index.json', import.meta.url)) ? read('compiled/index.json')
    : (console.log('compiled/index.json not mounted: group titles fall back to source names'), { characters: [], categories: [] })
  const { buildMobileRecords } = await import('../readmodels/lib/mobile_projection.mjs')
  const records = buildMobileRecords({ mobileArchive: read('masterdata/mobile_archive_index.json'),
    randomTalkPresentation: read('masterdata/random_talk_presentation_index.json'), compiledIndex: compiledIndex(),
    idolUnit: read('masterdata/idol_unit_dictionary.json'), archiveManifest: read('archive_manifest.json'),
    cardIndex: read('masterdata/card_index.json'), idolEpisode: read('masterdata/idol_episode_index.json'),
    storyCatalog: read('masterdata/story_catalog.json') }, await import('../src/data/idolCommunicationSelectors.js'))
  const phones = records.idolRecords.flatMap(record => record.view.phoneBundles.map(bundle => [record.id, bundle]))
  const shared = phones.filter(([, bundle]) => bundle.guests.length)
  assert.deepEqual(shared.map(([owner, bundle]) => [owner, bundle.file, bundle.guests]),
    [['040ren', '040ren_403_2_4_040_03_09_c.json', ['023har', '044ame']]], 'only Ren’s card call has others on the line')
  assert.ok(phones.every(([owner, bundle]) => !bundle.guests.includes(owner)), 'the owner is never listed as a guest')
}
console.log('Communication presentation: standalone, ADV/call/ADV, chat/choice/ADV, assets, Reader stamps and stale readiness passed; calls stay in the owner room')
