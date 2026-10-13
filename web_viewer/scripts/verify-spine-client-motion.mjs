import assert from 'node:assert/strict'
import { motionTableQueries, playClientMotion } from '../src/core/spineClientMotion.js'

// 001tom IdolMotionSetting (public/data/idolsetting/motion/idol_motion_index.json).
const table = {
  wait_loop: { pose: '', back: '' },
  hello: { pose: '', back: '' },
  angry: { pose: 'angry_loop', back: '' },
  joy: { pose: 'joy_loop', back: '' },
  weight: { pose: 'weight_loop', back: 'back' },
}
const skeleton = ['wait_loop', 'hello', 'angry', 'angry_loop', 'joy', 'joy_loop', 'weight', 'weight_loop', 'back']

function fakeState(current = '') {
  const calls = []
  let track0 = current ? { animation: { name: current } } : null
  const entry = (kind, name, loop) => {
    const value = { kind, name, loop, mixDuration: null, animation: { name } }
    calls.push(value)
    return value
  }
  return {
    calls,
    getCurrent: index => (index === 0 ? track0 : null),
    setAnimation(index, name, loop) { assert.equal(index, 0); track0 = entry('set', name, loop); return track0 },
    addAnimation(index, name, loop, delay) { assert.equal(index, 0); assert.equal(delay, 0); return entry('add', name, loop) },
  }
}
const run = (current, name, back = true) => {
  const state = fakeState(current)
  const first = playClientMotion(state, skeleton, table, name, back)
  return { first, calls: state.calls.map(({ kind, name: n, loop, mixDuration }) => [kind, n, loop, mixDuration]) }
}

const q = motionTableQueries(table)
assert.equal(q.isMotion('wait_loop'), true, 'wait_loop is a motion key')
assert.equal(q.isPose('joy_loop'), true)
assert.equal(q.isLoop('wait_loop') && q.isLoop('angry_loop') && !q.isLoop('joy'), true)
assert.equal(q.motionOfPose('weight_loop'), 'weight')

// Not a motion: set directly, looping for poses, no chain.
assert.deepEqual(run('joy_loop', 'angry_loop').calls, [['set', 'angry_loop', true, null]])
// Motion after a motion without back animation: direct, then its pose.
assert.deepEqual(run('joy_loop', 'angry').calls, [['set', 'angry', false, null], ['add', 'angry_loop', true, null]])
// hello has no pose: nothing is queued after it.
assert.deepEqual(run('wait_loop', 'hello').calls, [['set', 'hello', false, null]])
// Leaving weight (back = "back"): back first with a 0.3 s mix, then the motion and its pose.
const fromWeight = run('weight_loop', 'joy')
assert.deepEqual(fromWeight.calls, [['set', 'back', false, 0.3], ['add', 'joy', false, null], ['add', 'joy_loop', true, null]])
assert.equal(fromWeight.first.name, 'back')
// idol_nobackanimation skips the back animation but still queues the pose.
assert.deepEqual(run('weight_loop', 'joy', false).calls, [['set', 'joy', false, null], ['add', 'joy_loop', true, null]])
// From an unknown animation (not motion/pose) the motion is set directly.
assert.deepEqual(run('special_pose', 'weight').calls, [['set', 'weight', false, null], ['add', 'weight_loop', true, null]])
// wait_loop is a motion that loops; wait_loop as the current motion never plays a back.
assert.deepEqual(run('', 'wait_loop').calls, [['set', 'wait_loop', true, null]])
console.log('Spine client motion: PlayMotionInternal motion/pose/back chain, nobackanimation and loop rules verified')
