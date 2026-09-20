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
console.log('Communication presentation: standalone, ADV/call/ADV, chat/choice/ADV, assets, Reader stamps and stale readiness passed')

