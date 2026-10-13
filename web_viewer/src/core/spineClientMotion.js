// Client IdolFigureSkeleton.PlayMotionInternal (2.6.10 decompile) over an
// IdolMotionSetting table {motionAnimationName: {pose, back}}:
// - a name that is not a motion (a pose or loop) is set directly, looping when it is
//   a pose or wait_loop;
// - a motion that follows a motion/pose first plays the current motion's back
//   animation (mix 0.3 s) when transitionWithBackMotion is on and the current motion
//   is not wait_loop; otherwise it is set directly;
// - the motion's pose is queued looping after it (also for idol_nobackanimation).

import { applySpineTrackTime } from './spineTracks.js'

const WAIT_LOOP = 'wait_loop'
const BACK_MIX = 0.3

export function motionTableQueries(table) {
  const motions = table && typeof table === 'object' ? table : {}
  const isMotion = name => !!name && Object.prototype.hasOwnProperty.call(motions, name)
  const isPose = name => !!name && Object.values(motions).some(info => info?.pose === name)
  return {
    isMotion,
    isPose,
    isLoop: name => isPose(name) || name === WAIT_LOOP,
    motionOfPose: name => Object.keys(motions).find(key => motions[key]?.pose === name) || '',
    pose: name => motions[name]?.pose || '',
    back: name => motions[name]?.back || '',
  }
}

/** Returns the first TrackEntry set on track 0 (back animation or the motion). */
export function playClientMotion(state, skeletonAnimations, table, name, transitionWithBackMotion = true, trackTime = 0) {
  const has = animation => !!animation && skeletonAnimations.includes(animation)
  const q = motionTableQueries(table)
  const loop = q.isLoop(name)
  if (!q.isMotion(name)) {
    const entry = state.setAnimation(0, name, loop)
    applySpineTrackTime(entry, trackTime)
    return entry
  }

  const current = state.getCurrent(0)?.animation?.name || ''
  const pose = q.pose(name)
  let first = null
  let motionEntry = null
  if (current && (q.isMotion(current) || q.isPose(current))) {
    const currentMotion = q.isMotion(current) ? current : q.motionOfPose(current)
    const back = q.back(currentMotion)
    if (currentMotion !== WAIT_LOOP && transitionWithBackMotion && has(back)) {
      first = state.setAnimation(0, back, false)
      first.mixDuration = BACK_MIX
      motionEntry = state.addAnimation(0, name, loop, 0)
    }
  }
  if (!motionEntry) motionEntry = first = state.setAnimation(0, name, loop)
  applySpineTrackTime(motionEntry, trackTime)
  if (has(pose)) state.addAnimation(0, pose, true, 0)
  return first
}
