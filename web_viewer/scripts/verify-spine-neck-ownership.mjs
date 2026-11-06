// Real-skeleton regression for the 2026-11-06 ADV runtime audit: a timed neck cue
// that leaves a held pose (neck_question → back → neck_yes) completes and settles
// on the authored neck, not on the back clip in front of it; timed body cues keep
// the costume's AnimationState mix (defaultMix 0) and only back animations mix 0.3 s;
// the neck reset a live body motion triggers fades (MOTION_NECK_RESET_MIX) so head and
// body change together, while skips and explicit neck stops stay instant.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SkeletonBinary, Skeleton, AnimationState, AnimationStateData, RegionAttachment, MeshAttachment, BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment } from '@pixi-spine/runtime-3.8'
import { SpineManager } from '../src/core/SpineManager.js'
import { installNativeFramePose } from '../src/core/spineFramePose.js'
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
  installNativeFramePose(spine)
  manager.flushSpinePose = (_, delta) => { state.update(delta); state.apply(skeleton); skeleton.updateWorldTransform() }
  const frame = () => manager.flushSpinePose(SID, FRAME)
  return { manager, state, skeleton, frame }
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
  const current = f.state.getCurrent(1)
  assert.equal(current?.animation.name, 'neck_yes', 'completion lands on the authored neck')
  assert.equal(current.trackTime, current.animationEnd, 'the renderer still clamps the target on completion')
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

// 5. 3_1_002_01 (翔太): neck_question held over wait_loop, then `weight` at 5 s with
//    no neck cue at that time. Live playback: no visible part jumps; skip: instant.
const motionEntries = JSON.parse(fs.readFileSync(path.join(webViewerRoot, 'public/data/idolsetting/motion/idol_motion_index.json'))).entries
const homeMotion = motionEntries[MODEL] || motionEntries[SID]
assert.deepEqual(homeMotion?.weight, { pose: 'weight_loop', back: 'back' }, 'motion table fixture for weight')
const visiblePositions = skeleton => new Map(skeleton.slots
  .filter(slot => slot.attachment && slot.color.a > 0.01)
  .map(slot => [slot.data.name, [slot.bone.worldX, slot.bone.worldY]]))
const maxMove = (before, after) => Math.max(...[...after].map(([name, [x, y]]) => {
  const [px, py] = before.get(name) || [x, y]
  return Math.hypot(x - px, y - py)
}))
async function weightAtFiveSeconds({ skip }) {
  const f = fixture()
  f.manager.playSpineAnim(SID, 'wait_loop', false, false, null, false, null, homeMotion)
  f.state.setAnimation(2, 'face_default', true)
  f.manager.playSpineNeckAnim(SID, 'neck_question', 'state:3:neck')
  for (let i = 0; i < 300; i++) f.frame()
  const cue = { ...bodyCue('weight', 'step-3:002:spine-body'), at: 5 }
  const step = { entry_snapshot: { spines: [{ id: SID }] }, cues: [cue] }
  const handle = createSpineCueHandle(cue, { step }, {
    getManager: () => f.manager, getGeneration: () => 1, now: () => 0,
    motionSettingFor: () => homeMotion.weight, motionTableFor: () => homeMotion,
    requestFrame: callback => setTimeout(callback, 0), cancelFrame: clearTimeout,
  })
  let previous = visiblePositions(f.skeleton)
  if (skip) await handle.settle('skip')
  else await handle.start()
  let worst = 0
  for (let i = 0; i < 36; i++) {
    f.frame()
    const now = visiblePositions(f.skeleton)
    worst = Math.max(worst, maxMove(previous, now))
    previous = now
    if (skip && i === 0) assert.equal(f.state.getCurrent(1), null, 'a skipped body cue drops the neck at once')
  }
  return worst
}
const liveWorst = await weightAtFiveSeconds({ skip: false })
assert.ok(liveWorst <= 10, `live weight at 5 s moved a visible part ${liveWorst.toFixed(1)} skeleton units in one frame (head snap)`)
await weightAtFiveSeconds({ skip: true })
{
  const f = fixture()
  f.manager.playSpineNeckAnim(SID, 'neck_question', 'held')
  for (let i = 0; i < 120; i++) f.frame()
  f.manager.stopSpineNeckAnim(SID, 'explicit-stop')
  assert.equal(f.state.getCurrent(1), null, 'an explicit neck stop is instant')
}

// 6. Office replay reprojects the same step id. The first play's event keys must not
//    swallow the entry neck_question or the 5 s reset of the replay.
{
  const f = fixture()
  const headAngle = () => f.skeleton.findBone('head').getWorldRotationX()
  const performances = []
  for (const pass of ['first play', 'replay']) {
    if (pass === 'replay') f.manager.beginSpinePerformance()
    f.manager.playSpineAnim(SID, 'wait_loop', false, false, null, false, null, homeMotion)
    f.manager.playSpineNeckAnim(SID, 'neck_question', 'state:3:neck:002sht:neck_question')
    for (let i = 0; i < 120; i++) f.frame()
    const neckAtTwo = f.state.getCurrent(1)?.animation.name || 'none'
    f.manager.stopSpineNeckAnim(SID, 'step-3:002:spine-body:motion-neck-reset')
    f.manager.playSpineAnim(SID, 'weight', false, false, null, true, null, homeMotion)
    const neckAfterReset = f.state.getCurrent(1)?.animation.name || 'none'
    for (let i = 0; i < 120; i++) f.frame()
    performances.push({ neckAtTwo, neckAfterReset, head: headAngle() })
  }
  for (const [index, pass] of ['first play', 'replay'].entries()) {
    assert.equal(performances[index].neckAtTwo, 'neck_question', `${pass}: the entry neck_question is applied`)
    assert.equal(performances[index].neckAfterReset, 'none', `${pass}: the 5 s body motion resets the neck`)
  }
  const homeSource = fs.readFileSync(path.join(webViewerRoot, 'src/components/archive/ArchiveImmersiveHome.vue'), 'utf8')
  for (const [label, start, reproject] of [
    ['replay button', 'async function toggleVoice()', 'performanceRevision.value++'],
    ['stage tap', "homeCueRuntime.cancelCurrentStep('home-next-cue')", "emit('update:selectedCue', next.cue)"],
  ]) {
    const from = homeSource.indexOf(start)
    const body = homeSource.slice(from, homeSource.indexOf(reproject, from))
    assert.ok(from >= 0 && body.includes('beginSpinePerformance'), `office ${label} starts a new Spine performance before reprojecting the step`)
  }
}

// 7. Office: switching lines before the 5 s reset. 3_1_002_02 enters with the same
//    wait_loop and no neck, so only a new-performance reset clears the old tilt.
{
  const f = fixture()
  f.manager.playSpineAnim(SID, 'wait_loop', false, false, null, false, null, homeMotion)
  f.manager.playSpineNeckAnim(SID, 'neck_question', 'state:3:neck:002sht:neck_question')
  for (let i = 0; i < 120; i++) f.frame()
  f.manager.beginSpinePerformance()
  f.manager.playSpineAnim(SID, 'wait_loop', false, false, null, false, null, homeMotion)
  f.frame()
  assert.equal(f.state.getCurrent(1), null, 'office line 02 does not inherit line 01 neck_question')
  const homeSource = fs.readFileSync(path.join(webViewerRoot, 'src/components/archive/ArchiveImmersiveHome.vue'), 'utf8')
  const watcher = homeSource.slice(homeSource.indexOf('watch(activeCue, () => {'))
  assert.ok(watcher.slice(0, watcher.indexOf('if (stageTapCommitPending.value) return')).includes('beginSpinePerformance'),
    'office line change starts a new Spine performance before any early return')
}

// 8. Story 1_1_001jup_02 185 → 186 → back to 185 before 186's 2.2 s neck cue:
//    SpineStage must forget event keys when the step changes, or 185's neck_lookup
//    is skipped on return.
{
  const f = fixture()
  const enter = (stepId, anim, neck) => {
    const started = f.manager.playSpineAnim(SID, anim, false, false, null, false, null, homeMotion)
    if (started && !neck) f.manager.stopSpineNeckAnim(SID, `state:${stepId}:motion-neck-reset:${SID}`, 0.3)
    if (neck) f.manager.playSpineNeckAnim(SID, neck, `state:${stepId}:neck:${SID}:${neck}`)
    for (let i = 0; i < 30; i++) f.frame()
  }
  enter(185, 'wait_loop', 'neck_lookup')
  f.manager.resetSpineEventKeys()
  enter(186, 'hello', null)
  f.manager.resetSpineEventKeys()
  enter(185, 'wait_loop', 'neck_lookup')
  assert.equal(f.state.getCurrent(1)?.animation.name, 'neck_lookup', 'returning to 185 re-applies its entry neck_lookup')
  const stageSource = fs.readFileSync(path.join(webViewerRoot, 'src/components/SpineStage.vue'), 'utf8')
  const stepWatch = stageSource.slice(stageSource.indexOf('watch(() => props.step, (step, oldStep) => {'))
  assert.ok(stepWatch.slice(0, stepWatch.indexOf('applyState(step, { resetScreenEffects })')).includes('resetSpineEventKeys'),
    'SpineStage clears Spine event keys when the step changes')
}

// 9. A neck cue whose authored entry is discarded (a body motion resets the neck
//    during its back clip) releases at once instead of holding Auto until fallback;
//    a missing clip resolves immediately; back selection reads the playing clip.
{
  const f = fixture()
  holdQuestion(f)
  const run = cueRunner(f.manager, neckCue('neck_yes', 'interrupted-yes'))
  let completedAt = null
  const started = run.handle.start().then(() => { completedAt = run.clock() })
  for (let i = 0; i < 15; i++) await run.tick(f.frame)
  const interruptedAt = run.clock()
  f.manager.stopSpineNeckAnim(SID, 'body-reset', 0.3)
  for (let i = 0; i < 3 && completedAt == null; i++) await run.tick(f.frame)
  assert.ok(completedAt != null && completedAt - interruptedAt <= FRAME * 3000,
    `interrupted neck cue released ${completedAt == null ? 'not within 3 frames' : ((completedAt - interruptedAt) / 1000).toFixed(3) + ' s'} after the reset`)
  await started

  const g = fixture()
  holdQuestion(g)
  const missing = cueRunner(g.manager, neckCue('neck_not_in_skeleton', 'missing'))
  let missingDone = false
  const missingStart = missing.handle.start().then(() => { missingDone = true })
  await missing.tick(g.frame)
  assert.equal(missingDone, true, 'a neck clip the skeleton lacks does not wait on the held neck')
  await missingStart
  await missing.handle.cancel('backlog-open')
  assert.equal(g.state.getCurrent(1)?.animation.name, 'neck_question', 'cancelling a missing cue leaves the held pose')

  g.manager.playSpineNeckAnim(SID, 'neck_yes', 'queued-yes')
  g.frame()
  const back = g.state.getCurrent(1)
  const backTime = back.trackTime
  const skippedMissing = cueRunner(g.manager, neckCue('neck_not_in_skeleton', 'skipped-missing'))
  await skippedMissing.handle.settle('skip')
  assert.equal(back.trackTime, backTime, 'skipping a missing cue leaves the unrelated back clip at its current time')

  const scheduled = cueRunner(g.manager, neckCue('neck_no', 'future-neck'))
  await scheduled.handle.cancel('backlog-open')
  assert.equal(g.state.getCurrent(1), back, 'cancelling a scheduled cue leaves the neck it never owned')

  const playing = fixture()
  const running = cueRunner(playing.manager, neckCue('neck_yes', 'playing-yes'))
  let released = false
  const playingStart = running.handle.start().then(() => { released = true })
  for (let i = 0; i < 15; i++) await running.tick(playing.frame)
  playing.manager.stopSpineNeckAnim(SID, 'fade-playing-yes', 0.3)
  await running.tick(playing.frame)
  assert.equal(released, true, 'the interrupted current clip releases while its visual fade is still running')
  assert.equal(playing.state.getCurrent(1)?.mixDuration, 0.3, 'releasing Auto keeps the visual fade')
  await playingStart

  const h = fixture()
  h.manager.playSpineNeckAnim(SID, 'neck_lookup', 'lookup')
  for (let i = 0; i < 120; i++) h.frame()
  h.manager.playSpineNeckAnim(SID, 'neck_question', 'question')
  h.frame()
  assert.notEqual(h.state.getCurrent(1).animation.name, 'neck_question', 'question is queued behind a back clip')
  h.manager.playSpineNeckAnim(SID, 'neck_yes', 'yes')
  assert.deepEqual(neckChain(h.state), ['neck_yes'],
    'PlayNeckInternal reads the playing back clip, not the queued neck_question: no second back')
}

console.log(`Spine neck ownership: held neck_question → back → neck_yes completes after ${backThenYes.toFixed(3)} s (listener and stalled fallback), skip settles neck_yes; timed body cues mix 0 direct / 0.3 back; 3_1_002_01 weight at 5 s moves visible parts ≤ ${liveWorst.toFixed(1)} skeleton units/frame; office replay re-applies the entry neck and its reset; line switch, story return, interrupted/missing neck cues and back selection verified`)
