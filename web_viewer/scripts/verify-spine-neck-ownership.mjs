// Real-skeleton regression for the 2026-11-06 ADV runtime audit: a timed neck cue
// that leaves a held pose (neck_question → back → neck_yes) completes and settles
// on the authored neck, not on the back clip in front of it; timed body cues keep
// the costume's AnimationState mix (defaultMix 0) and only back animations mix 0.3 s.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SkeletonBinary, Skeleton, AnimationState, AnimationStateData, RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8'
import { SpineManager } from '../src/core/SpineManager.js'
import { createSpineCueHandle } from '../src/core/story-runtime/SpineCueRuntime.js'
import { mainCheckoutRoot } from './lib/archive-sources.mjs'

class DiagnosticAttachmentLoader {
  newRegionAttachment(_skin, name) { return new RegionAttachment(name) }
  newMeshAttachment(_skin, name) { return new MeshAttachment(name) }
  newBoundingBoxAttachment(_skin, name) { return new BoundingBoxAttachment(name) }
  newPathAttachment(_skin, name) { return new PathAttachment(name) }
  newPointAttachment(_skin, name) { return new PointAttachment(name) }
  newClippingAttachment(_skin, name) { return new ClippingAttachment(name) }
}

const SID = '002sht'
const MODEL = '002sht_002_00'
const FRAME = 1 / 60
const webViewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const skelPath = [webViewerRoot, path.join(mainCheckoutRoot(), 'web_viewer')]
  .map(root => path.join(root, 'public/assets/spines', MODEL, 'comu.skel'))
  .find(candidate => fs.existsSync(candidate))
assert.ok(skelPath, `${MODEL}/comu.skel is in the local corpus`)
const bytes = fs.readFileSync(skelPath)
const len = bytes.readUInt32LE(0)
const offset = 4 + len + ((4 - (4 + len) % 4) % 4) + 4
const data = new SkeletonBinary(new DiagnosticAttachmentLoader()).readSkeletonData(new Uint8Array(bytes.subarray(offset)))
const duration = name => data.findAnimation(name)?.duration ?? NaN
for (const name of ['neck_question', 'neck_back_question', 'neck_yes', 'wait_loop', 'weight', 'weight_loop', 'back']) {
  assert.ok(data.findAnimation(name), `fixture skeleton has ${name}`)
}

function fixture() {
  const skeleton = new Skeleton(data)
  const state = new AnimationState(new AnimationStateData(data))
  state.data.defaultMix = 0
  const spine = { state, skeleton }
  const stage = { spineInstances: { [SID]: { modelId: MODEL, spine } } }
  const manager = new SpineManager(stage)
  manager.spineInstances = stage.spineInstances
  manager.flushSpinePose = (_, delta) => { state.update(delta); state.apply(skeleton) }
  const frame = () => { state.update(FRAME); state.apply(skeleton) }
  return { manager, state, frame }
}

function cueRunner(manager, cue) {
  let clock = 0
  let nextFrame = 0
  const frames = new Map()
  const step = { entry_snapshot: { spines: [{ id: SID }] }, cues: [cue] }
  const handle = createSpineCueHandle(cue, { step }, {
    getManager: () => manager,
    getGeneration: () => 1,
    now: () => clock,
    requestFrame: callback => { frames.set(++nextFrame, callback); return nextFrame },
    cancelFrame: id => frames.delete(id),
  })
  const tick = async advanceSkeleton => {
    clock += FRAME * 1000
    advanceSkeleton?.()
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback())
    for (let i = 0; i < 6; i++) await Promise.resolve()
  }
  return { handle, tick, clock: () => clock }
}

const neckCue = (value, id) => ({
  cue_id: id, channel: `spine:${SID}:neck`, target: SID, action: 'spine.neck.play', at: 0,
  payload: { value },
  lifecycle: { persistence: 'transient', skippable: true, blocks_input: false, blocks_auto: true },
})
const bodyCue = (value, id) => ({
  cue_id: id, channel: `spine:${SID}:body`, target: SID, action: 'spine.body.play', at: 0,
  payload: { value },
  lifecycle: { persistence: 'stateful', skippable: true, blocks_input: false, blocks_auto: true },
})
const neckChain = state => {
  const out = []
  for (let entry = state.getCurrent(1); entry; entry = entry.next) out.push(entry.animation.name)
  return out
}
const holdQuestion = ({ manager, frame }) => {
  manager.playSpineNeckAnim(SID, 'neck_question', 'entry:neck_question')
  for (let i = 0; i < 120; i++) frame()
}
const backThenYes = duration('neck_back_question') + duration('neck_yes')

// 1. Completion waits for the queued neck_yes, not the back clip in front of it.
{
  const f = fixture()
  holdQuestion(f)
  const run = cueRunner(f.manager, neckCue('neck_yes', 'timed-yes'))
  let completedAt = null
  const started = run.handle.start().then(() => { completedAt = run.clock() })
  for (let i = 0; i < 300 && completedAt == null; i++) await run.tick(f.frame)
  await started
  assert.ok(completedAt != null, 'neck cue completes')
  assert.ok(completedAt / 1000 >= backThenYes - FRAME * 2,
    `neck cue completed at ${(completedAt / 1000).toFixed(3)} s, before back + neck_yes (${backThenYes.toFixed(3)} s)`)
  assert.equal(f.state.getCurrent(1)?.animation.name, 'neck_yes', 'completion lands on the authored neck')
}

// 2. With the skeleton stalled, the fallback deadline still covers back + target.
{
  const f = fixture()
  holdQuestion(f)
  const run = cueRunner(f.manager, neckCue('neck_yes', 'stalled-yes'))
  let completedAt = null
  const started = run.handle.start().then(() => { completedAt = run.clock() })
  for (let i = 0; i < 400 && completedAt == null; i++) await run.tick()
  await started
  assert.ok(completedAt / 1000 >= backThenYes,
    `fallback released at ${(completedAt / 1000).toFixed(3)} s, before back + neck_yes (${backThenYes.toFixed(3)} s)`)
}

// 3. Skip before and during the back clip settles neck_yes at its final frame.
for (const [label, framesBeforeSkip] of [['before start', null], ['during back', 12]]) {
  const f = fixture()
  holdQuestion(f)
  const run = cueRunner(f.manager, neckCue('neck_yes', `skip-${label}`))
  if (framesBeforeSkip != null) {
    run.handle.start()
    for (let i = 0; i < framesBeforeSkip; i++) await run.tick(f.frame)
    assert.equal(f.state.getCurrent(1)?.animation.name, 'neck_back_question', 'back clip plays first')
  }
  const settled = run.handle.settle('skip')
  for (let i = 0; i < 4; i++) await run.tick()
  await settled
  const current = f.state.getCurrent(1)
  assert.deepEqual(neckChain(f.state), ['neck_yes'], `skip ${label}: no back clip left in front of neck_yes`)
  assert.ok(current.trackTime >= current.animationEnd, `skip ${label}: neck_yes rests on its final frame`)
}

// 4. Timed body cues: direct sets keep the costume mix (0); a back animation mixes 0.3 s.
{
  const f = fixture()
  f.state.setAnimation(0, 'wait_loop', true)
  f.frame()
  const motionTable = { weight: { pose: 'weight_loop', back: 'back' } }
  const runBody = async (value, id) => {
    const cue = bodyCue(value, id)
    const step = { entry_snapshot: { spines: [{ id: SID }] }, cues: [cue] }
    const handle = createSpineCueHandle(cue, { step }, {
      getManager: () => f.manager, getGeneration: () => 1, now: () => 0,
      motionSettingFor: () => motionTable[value] || null, motionTableFor: () => motionTable,
      requestFrame: callback => setTimeout(callback, 0), cancelFrame: clearTimeout,
    })
    await handle.start()
  }
  await runBody('weight', 'direct-weight')
  assert.equal(f.state.getCurrent(0).animation.name, 'weight')
  assert.equal(f.state.getCurrent(0).mixDuration, 0, 'wait_loop → weight is a direct set under defaultMix 0')
  for (let i = 0; i < 120; i++) f.frame()
  assert.equal(f.state.getCurrent(0).animation.name, 'weight_loop')
  await runBody('weight', 'back-weight')
  assert.equal(f.state.getCurrent(0).animation.name, 'back')
  assert.equal(f.state.getCurrent(0).mixDuration, 0.3, 'leaving weight_loop plays back with its 0.3 s mix')
}

console.log(`Spine neck ownership: held neck_question → back → neck_yes completes after ${backThenYes.toFixed(3)} s (listener and stalled fallback), skip settles neck_yes; timed body cues mix 0 direct / 0.3 back`)
