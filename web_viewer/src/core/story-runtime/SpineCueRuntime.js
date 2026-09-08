import { createPerformanceHandle } from './PerformanceRegistry.js'
import { getCachedMotionSetting } from '../../utils/IdolMotionSettingStore.js'

export function settleSpineNeckCue(manager, cue) {
  if (!manager || !cue?.target || !cue?.payload?.value) return false
  manager.playSpineNeckAnim?.(cue.target, cue.payload.value, cue.cue_id)
  const track = manager.spineInstances?.[cue.target]?.spine?.state?.getCurrent?.(3)
  if (!track) return false
  track.trackTime = track.animationEnd
  manager.flushSpinePose?.(cue.target, 0)
  return true
}

/** Executes Spine cues; owns readiness polling and neck completion resources.
 * The controller supplies the current stage and navigation generation, while
 * EffectScheduler remains the sole owner of cue timing.
 */
export function createSpineCueHandle(cue, { step } = {}, {
  getManager, getGeneration,
  motionSettingFor = getCachedMotionSetting,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  now = () => performance.now(),
  scheduleTimeout = (callback, delay) => setTimeout(callback, delay),
  cancelTimeout = id => clearTimeout(id),
}) {
  let operationToken = 0
  let releasePending = null
  let neckFallbackTimer = null
  let readinessFrame = null
  let releaseReadiness = null
  function invalidateOperation() {
    operationToken++
    if (readinessFrame != null) cancelFrame(readinessFrame)
    readinessFrame = null
    releaseReadiness?.(false)
    releaseReadiness = null
    releasePending?.()
  }
  const isTransient = cue.lifecycle.persistence === 'transient'
  const expectedSpineIds = new Set(
    (step?.entry_snapshot?.spines || [])
      .map(spine => spine?.id)
      .filter(Boolean),
  )
  const targetExpectedInEntry = expectedSpineIds.has(cue.target)
  const apply = (manager, duration, { settleNeck = false } = {}) => {
    const target = cue.target
    const payload = cue.payload || {}
    if (cue.action === 'spine.face.set') {
      manager.updateSpineFace?.(target, payload.value, {
        anim_flag: payload.anim_flag,
        blush_flag: payload.blush_flag,
        sweat_flag: payload.sweat_flag,
      })
    } else if (cue.action === 'spine.body.play') {
      const modelId = manager.spineInstances?.[target]?.modelId || ''
      const motionSetting = motionSettingFor(target, modelId, payload.value)
      manager.playSpineAnim?.(target, payload.value, false, !!payload.no_back, motionSetting, true, 0.3)
    } else if (cue.action === 'spine.neck.play') {
      if (settleNeck) {
        settleSpineNeckCue(manager, cue)
        releasePending?.()
        return
      }
      manager.playSpineNeckAnim?.(target, payload.value, cue.cue_id)
      const entry = manager.spineInstances?.[target]
      const track = entry?.spine?.state?.getCurrent?.(3)
      if (track) {
        return new Promise(resolve => {
          let completed = false
          const previousListener = track.listener
          const listener = { complete: () => finish() }
          const finish = () => {
            if (completed) return
            completed = true
            if (neckFallbackTimer != null) cancelTimeout(neckFallbackTimer)
            neckFallbackTimer = null
            releasePending = null
            if (track.listener === listener) track.listener = previousListener
            resolve()
          }
          releasePending = finish
          // Keep Track 3 clamped at its final pose. The step transition or an
          // explicit neck.stop cue owns clearing it.
          track.listener = listener
          const durationMs = Math.max(0, Number(track.animationEnd || 0) - Number(track.animationStart || 0)) * 1000
          neckFallbackTimer = scheduleTimeout(finish, durationMs + 250)
        })
      }
    } else if (cue.action === 'spine.neck.stop') {
      manager.stopSpineNeckAnim?.(target, cue.cue_id)
    } else if (cue.action === 'spine.visual.tint') {
      manager.setSpineColor?.(target, payload.value, duration, 0)
    }
  }
  const performWhenReady = (duration, options) => {
    invalidateOperation()
    const token = operationToken
    const expectedGeneration = getGeneration()
    if (!targetExpectedInEntry) {
      console.debug('[StoryRuntime] spine cue target absent from entry snapshot; skipped', cue.cue_id, cue.target)
      return Promise.resolve(false)
    }
    const deadline = now() + 5000
    return new Promise(resolve => {
      const finish = result => {
        if (releaseReadiness === finish) releaseReadiness = null
        resolve(result)
      }
      releaseReadiness = finish
      const attempt = () => {
        readinessFrame = null
        if (token !== operationToken || expectedGeneration !== getGeneration()) return finish(false)
        const manager = getManager()
        if (manager?.spineInstances?.[cue.target]) {
          Promise.resolve(apply(manager, duration, options)).then(() => finish(true), () => finish(false))
          return
        }
        if (now() >= deadline) {
          console.warn('[StoryRuntime] spine cue target unavailable', cue.cue_id, cue.target)
          return finish(false)
        }
        readinessFrame = requestFrame(attempt)
      }
      attempt()
    })
  }
  return createPerformanceHandle({
    id: cue.cue_id,
    channel: cue.channel,
    skippable: cue.lifecycle.skippable,
    blocksInput: cue.lifecycle.blocks_input,
    blocksAuto: cue.lifecycle.blocks_auto && targetExpectedInEntry,
    metadata: { action: cue.action, cue },
    onStart: () => {
      console.debug('[StoryRuntime] cue start', cue.cue_id)
      return performWhenReady(cue.duration)
    },
    onSettle: () => {
      invalidateOperation()
      if (isTransient) {
        if (cue.action === 'spine.neck.play') {
          return performWhenReady(0, { settleNeck: true })
        }
        releasePending?.()
        return
      }
      console.debug('[StoryRuntime] cue settle', cue.cue_id)
      return performWhenReady(0)
    },
    onCancel: reason => {
      invalidateOperation()
      const preservesAuthoredPose = reason === 'step-change' || reason === 'load-step'
      if (cue.action === 'spine.neck.play' && !preservesAuthoredPose) {
        getManager()?.stopSpineNeckAnim?.(cue.target, `${cue.cue_id}:cancel`)
      }
    },
  })
}
