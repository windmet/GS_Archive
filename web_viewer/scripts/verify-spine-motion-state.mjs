import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SpineManager } from '../src/core/SpineManager.js'
import { settleSpineNeckCue } from '../src/core/story-runtime/useStoryRuntimeCues.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function createHarness() {
  const calls = []
  const animations = [
    'wait_loop', 'angry', 'angry_loop', 'weight', 'weight_loop',
    'neck_lookup', 'neck_question',
  ].map(name => ({
    name,
    timelines: name.startsWith('neck_')
      ? [
          { boneIndex: 3 },
          { boneIndex: 7 },
          { slotIndex: 2, constructor: { name: 'DeformTimeline' } },
        ]
      : [],
  }))
  const state = {
    data: { skeletonData: { animations } },
    setAnimation(track, name, loop) {
      const entry = {
        track,
        name,
        loop,
        animation: animations.find(animation => animation.name === name),
        animationEnd: name.startsWith('neck_') ? 1.7 : 0,
        trackTime: 0,
        mixDuration: 99,
        listener: null,
      }
      calls.push(['set', track, name, loop, entry])
      return entry
    },
    addAnimation(track, name, loop, delay) {
      calls.push(['add', track, name, loop, delay])
      return { track, name, loop, delay }
    },
    clearTrack(track) {
      calls.push(['clear', track])
    },
  }
  const spine = { state, stateData: { defaultMix: 0 } }
  const manager = { spineInstances: { idol: { spine, modelId: 'idol_model' } } }
  return { spineManager: new SpineManager(manager), spine, calls }
}

function verifyBodyLifecycle() {
  const { spineManager, calls } = createHarness()

  spineManager.playSpineAnim('idol', 'angry', false, false, { pose: 'angry_loop' })
  assert.deepEqual(calls.slice(0, 2).map(call => call.slice(0, 5)), [
    ['set', 0, 'angry', false, calls[0][4]],
    ['add', 0, 'angry_loop', true, 0],
  ])

  spineManager.playSpineAnim('idol', 'angry', false, false, { pose: 'angry_loop' })
  assert.equal(calls.length, 2, 'cumulative state must not restart the current body action')

  spineManager.playSpineAnim('idol', 'angry', false, false, { pose: 'angry_loop' }, true)
  assert.equal(calls.filter(call => call[0] === 'set' && call[2] === 'angry').length, 2,
    'a distinct authored timeline event must be able to restart the same animation')

  spineManager.playSpineAnim('idol', 'wait_loop', false, false, null, true, 0.3)
  assert.equal(calls.at(-1)[4].mixDuration, 0.3,
    'authored timeline body changes must use the archive crossfade')

  const beforeNoBack = calls.length
  spineManager.playSpineAnim('idol', 'weight', false, true, { pose: 'weight_loop' }, true)
  assert.deepEqual(calls.slice(beforeNoBack).map(call => call.slice(0, 4)), [
    ['set', 0, 'weight', false],
  ], 'no-back animation must not queue a pose loop')

  spineManager.switchSpineAnim('idol', 'wait_loop')
  const switchEntry = calls.at(-1)[4]
  assert.equal(switchEntry.mixDuration, 0.3, 'legacy timeline switch path must preserve its crossfade')
}

function verifyNeckLifecycle() {
  const { spineManager, spine, calls } = createHarness()

  spineManager.playSpineNeckAnim('idol', 'neck_lookup', 'step:10:event:0')
  const firstEntry = calls.find(call => call[0] === 'set' && call[1] === 3)[4]
  assert.equal(firstEntry.mixBlend, 3, 'neck motion must add offsets without replacing the body pose at frame zero')
  assert.equal(firstEntry.mixDuration, 0)
  assert.deepEqual(spine._neckAdditiveTargets, {
    boneIndices: [3, 7],
    deformSlotIndices: [2],
  }, 'neck playback must record exactly which local pose values need a per-frame baseline reset')
  assert.equal(typeof firstEntry.listener?.complete, 'function')

  spineManager.playSpineNeckAnim('idol', 'neck_question', 'step:10:event:1')
  const neckSets = calls.filter(call => call[0] === 'set' && call[1] === 3)
  assert.equal(neckSets.length, 2)

  firstEntry.listener.complete()
  assert.equal(calls.filter(call => call[0] === 'clear' && call[1] === 3).length, 0,
    'completion from a replaced overlay must not clear the newer overlay')

  const secondEntry = neckSets[1][4]
  secondEntry.listener.complete()
  assert.equal(calls.filter(call => call[0] === 'clear' && call[1] === 3).length, 0,
    'natural completion must hold the authored final neck pose')
  assert.equal(spine._currentNeckAnim, 'neck_question')
  assert.equal(secondEntry.trackTime, secondEntry.animationEnd)

  spineManager.playSpineNeckAnim('idol', 'neck_question', 'step:10:event:1')
  assert.equal(calls.filter(call => call[0] === 'set' && call[1] === 3).length, 2,
    'reapplying the same step must not replay a completed neck cue')

  spineManager.playSpineNeckAnim('idol', 'neck_question', 'step:11:event:0')
  assert.equal(calls.filter(call => call[0] === 'set' && call[1] === 3).length, 3)
  spineManager.stopSpineNeckAnim('idol', 'step:11:event:1')
  assert.equal(calls.at(-1)[0], 'clear')
  assert.equal(calls.at(-1)[1], 3)
  assert.equal(spine._neckAdditiveCleanupPending, true,
    'an explicit stop must retain the reset targets for one final base-pose apply')
}

function verifyScheduledNeckSettle() {
  const track = { animationEnd: 2.1, trackTime: 0 }
  const calls = []
  const manager = {
    spineInstances: {
      idol: { spine: { state: { getCurrent: index => index === 3 ? track : null } } },
    },
    playSpineNeckAnim: (...args) => calls.push(['play', ...args]),
    flushSpinePose: (...args) => calls.push(['flush', ...args]),
  }
  const cue = {
    cue_id: 'step-12:001:spine-neck',
    target: 'idol',
    payload: { value: 'neck_question' },
  }

  assert.equal(settleSpineNeckCue(manager, cue), true)
  assert.equal(track.trackTime, track.animationEnd,
    'settling a not-yet-started neck cue must land on its authored final pose')
  assert.deepEqual(calls, [
    ['play', 'idol', 'neck_question', 'step-12:001:spine-neck'],
    ['flush', 'idol', 0],
  ])
}

function verifyCompiledAnchor() {
  const compiledPath = path.join(root, 'public', 'data', 'compiled', '1_1_013the_02_1_1_013_02.json')
  const scenario = JSON.parse(fs.readFileSync(compiledPath, 'utf8'))
  const byStep = new Map(scenario.steps.map(step => [step.step_id, step]))
  const ren = stepId => byStep.get(stepId)?.state?.spines?.find(spine => spine.id === '040ren') || {}
  const neckEvents = stepId => (byStep.get(stepId)?.timeline || []).filter(event => event.type.startsWith('spine_neck'))

  assert.equal(neckEvents(10)[0]?.value, 'neck_lookup')
  assert.equal(ren(11).neck_anim, undefined, 'delayed neck cue leaked into the next cumulative snapshot')
  assert.equal(ren(31).neck_anim, 'neck_question', 'immediate neck cue missing from its authored step')
  assert.equal(neckEvents(31)[0]?.type, 'spine_neck_stop')
  assert.equal(ren(32).neck_anim, undefined, 'immediate neck cue persisted beyond its authored step')
  assert.equal(ren(32).neck_anim_stop, undefined, 'neck stop persisted beyond its authored step')
}

verifyBodyLifecycle()
verifyNeckLifecycle()
verifyScheduledNeckSettle()
verifyCompiledAnchor()
console.log('Spine motion state verification passed.')
