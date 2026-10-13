import assert from 'node:assert/strict'
import fs from 'node:fs'
import { Animation, SkeletonData, Skeleton, AnimationState, AnimationStateData, RotateTimeline, BoneData } from '@pixi-spine/runtime-3.8'
import { playClientMotion } from '../src/core/spineClientMotion.js'
import { SpineManager } from '../src/core/SpineManager.js'
import { SPINE_TRACK } from '../src/core/spineTracks.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { createSpineCueHandle } from '../src/core/story-runtime/SpineCueRuntime.js'

assert.deepEqual(SPINE_TRACK, { body: 0, neck: 1, face: 2, mouth: 3, eye: 4 })
// Real AnimationState: advancing from an offset must shorten the motion and
// reach its pose; queued offsets must survive the back -> motion transition.
const data = new SkeletonData()
data.bones = [new BoneData(0, 'root', null)]
const rotation = new RotateTimeline(2)
rotation.boneIndex = 0
rotation.setFrame(0, 0, 0)
rotation.setFrame(1, 2, 80)
data.animations = ['wait_loop', 'back', 'weight_loop', 'joy_loop', 'neck_lookup', 'neck_back', 'neck_yes']
  .map(name => new Animation(name, [], 1))
data.animations.push(new Animation('weight', [rotation], 2), new Animation('joy', [rotation], 2))
const names = data.animations.map(a => a.name)
const table = { wait_loop: { pose: '', back: '' }, weight: { pose: 'weight_loop', back: 'back' }, joy: { pose: 'joy_loop', back: '' } }
const skeleton = new Skeleton(data)
const state = new AnimationState(new AnimationStateData(data))
const tick = seconds => { state.update(seconds); state.apply(skeleton) }
playClientMotion(state, names, table, 'weight', true, .5)
assert.equal(state.getCurrent(0).trackTime, .5)
tick(0)
assert.equal(skeleton.bones[0].rotation, 20, 'offset is visible on the first applied frame')
tick(1.51); tick(0)
assert.equal(state.getCurrent(0).animation.name, 'weight_loop', 'pose starts after the remaining duration')
playClientMotion(state, names, table, 'joy', true, .75)
assert.equal(state.getCurrent(0).animation.name, 'back')
assert.equal(state.getCurrent(0).trackTime, 0, 'body back starts at zero')
assert.equal(state.getCurrent(0).next.trackTime, .75, 'offset belongs to the queued motion')
assert.equal(state.getCurrent(0).next.next.trackTime, 0, 'pose starts at zero')
tick(.51); tick(.51); tick(0)
assert.equal(state.getCurrent(0).animation.name, 'joy')
assert.ok(state.getCurrent(0).trackTime >= .75, 'queued offset survives activation')
playClientMotion(state, names, table, 'weight', false, 99)
assert.equal(state.getCurrent(0).trackTime, 2, 'offset clamps to duration')
playClientMotion(state, names, table, 'weight_loop', true, 99)
assert.equal(state.getCurrent(0).trackTime, 1, 'loops clamp too, as in the client')

const spine = { state }
const manager = new SpineManager({ spineInstances: { idol: { spine } } })
manager.playSpineAnim('idol', 'weight', false, false, null, true, null, table, .2)
assert.equal(manager.playSpineAnim('idol', 'weight', false, false, null, false, null, table, .2), false)
assert.equal(manager.playSpineAnim('idol', 'weight', false, true, null, false, null, table, .4), true,
  'a changed authored offset is not swallowed by the body cache')
assert.equal(state.getCurrent(0).trackTime, .4)
manager.playSpineNeckAnim('idol', 'neck_lookup', 'lookup', .4)
assert.equal(state.getCurrent(1).trackTime, .4)
manager.playSpineNeckAnim('idol', 'neck_yes', 'yes', .3)
assert.equal(state.getCurrent(1).animation.name, 'neck_back')
assert.equal(state.getCurrent(1).trackTime, .3, 'PlayNeckInternal offsets the back entry')
assert.equal(state.getCurrent(1).next.trackTime, 0, 'queued neck starts at zero')

const scenario = normalizeScenario({ steps: [{ step_id: 1, state: { spines: [{ id: 'idol', anim: 'weight', anim_track_time: .4 }] },
  timeline: [{ type: 'spine_anim', chara_id: 'idol', value: 'joy', time: 1, track_time: .75 },
    { type: 'spine_anim', chara_id: 'idol', value: 'wait_loop', time: 2 }] }] })
const step = scenario.steps[0]
assert.equal(step.entry_snapshot.spines[0].anim_track_time, .4)
assert.equal(step.cues[0].payload.track_time, .75)
assert.equal(step.settled_snapshot.spines[0].anim_track_time, undefined, 'zero offset clears the previous offset on restore')
let args
const handle = createSpineCueHandle(step.cues[0], { step }, {
  getManager: () => ({ spineInstances: { idol: { modelId: 'fixture' } }, playSpineAnim: (...value) => { args = value } }),
  getGeneration: () => 0, motionSettingFor: () => null, motionTableFor: () => table,
})
await handle.start()
assert.equal(args.at(-1), .75, 'cue passes the authored offset to the manager')
// Also protect the cumulative Vue-state path, independently of timed cues.
const stage = fs.readFileSync(new URL('../src/components/SpineStage.vue', import.meta.url), 'utf8')
assert.match(stage, /getCachedMotionTable\(sid, modelId\), spineState\.anim_track_time \?\? 0/)
console.log('Spine tracks/time: native order, first-frame pose, remaining duration, queued motion, clamps, cache and cue/state propagation passed')

const spawn = fs.readFileSync(new URL('../src/core/spineSpawnFinalize.js', import.meta.url), 'utf8')
assert.equal((spawn.match(/setAnimation\(SPINE_TRACK.face,/g) || []).length, 2, 'both default and fallback spawn expressions use the face track')
assert.doesNotMatch(spawn, /setAnimation\(1,/, 'spawning must leave the neck track free')
