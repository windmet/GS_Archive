import { StoryClock } from './StoryClock.js'
import { EffectScheduler } from './EffectScheduler.js'
import { createPerformanceHandle } from './PerformanceRegistry.js'
import { normalizeScenario } from './ScenarioNormalizer.js'
import { applyScreenEntrySnapshot, createScreenCueHandle } from './ScreenCueRuntime.js'
import { applyBackgroundEntrySnapshot, createBackgroundCueHandle } from './BackgroundCueRuntime.js'
import { applyCameraEntrySnapshot, createCameraCueHandle } from './CameraCueRuntime.js'
import { createSeCueHandle } from './SeCueRuntime.js'
import { createDebugSnapshotCue, createDebugSnapshotHandle } from './DebugSnapshotRuntime.js'
import { getCachedMotionSetting } from '../../utils/IdolMotionSettingStore.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function settleSpineNeckCue(manager, cue) {
  if (!manager || !cue?.target || !cue?.payload?.value) return false
  manager.playSpineNeckAnim?.(cue.target, cue.payload.value, cue.cue_id)
  const track = manager.spineInstances?.[cue.target]?.spine?.state?.getCurrent?.(3)
  if (!track) return false
  track.trackTime = track.animationEnd
  manager.flushSpinePose?.(cue.target, 0)
  return true
}

export function useStoryRuntimeCues({
  compiledData, currentStepIndex, spineStageRef, audioManager,
  debugSnapshotAt = null, debugSnapshotAction = null,
}) {
  const scheduler = new EffectScheduler({ clock: new StoryClock() })
  let normalizedSource = null
  let normalizedScenario = null
  let managerFrame = null
  let generation = 0
  let pendingRestore = null

  if (typeof window !== 'undefined') {
    window.__STORY_RUNTIME_CUES__ = scheduler
  }

  function getNormalizedStep(index = currentStepIndex.value) {
    if (normalizedSource !== compiledData.value) {
      normalizedSource = compiledData.value
      normalizedScenario = normalizedSource ? normalizeScenario(normalizedSource) : null
    }
    return normalizedScenario?.steps?.[index] || null
  }

  function getManager() {
    return spineStageRef.value?.manager || null
  }

  function applySnapshotWhenReady(snapshot, expectedGeneration) {
    const apply = () => {
      if (expectedGeneration !== generation) return
      const manager = getManager()
      if (!manager) {
        managerFrame = requestAnimationFrame(apply)
        return
      }
      managerFrame = null
      applyCameraEntrySnapshot(manager, snapshot?.camera_zoom)
      applyScreenEntrySnapshot(manager, snapshot?.screen_overlay)
      applyBackgroundEntrySnapshot(manager, snapshot?.bg)
    }
    apply()
  }

  function createSpineHandle(cue) {
    let operationToken = 0
    let activeNeckTrack = null
    let releasePending = null
    let neckFallbackTimer = null
    const isTransient = cue.lifecycle.persistence === 'transient'
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
        const motionSetting = getCachedMotionSetting(target, modelId, payload.value)
        manager.playSpineAnim?.(target, payload.value, false, !!payload.no_back, motionSetting, true, 0.3)
      } else if (cue.action === 'spine.neck.play') {
        if (settleNeck) {
          settleSpineNeckCue(manager, cue)
          activeNeckTrack = manager.spineInstances?.[target]?.spine?.state?.getCurrent?.(3) || null
          releasePending?.()
          return
        }
        manager.playSpineNeckAnim?.(target, payload.value, cue.cue_id)
        const entry = manager.spineInstances?.[target]
        const track = entry?.spine?.state?.getCurrent?.(3)
        activeNeckTrack = track || null
        if (track) {
          return new Promise(resolve => {
            let completed = false
            const finish = () => {
              if (completed) return
              completed = true
              if (neckFallbackTimer != null) clearTimeout(neckFallbackTimer)
              neckFallbackTimer = null
              releasePending = null
              resolve()
            }
            releasePending = finish
            // Keep Track 3 clamped at its final pose. The step transition or an
            // explicit neck.stop cue owns clearing it.
            track.listener = { complete: finish }
            const durationMs = Math.max(0, Number(track.animationEnd || 0) - Number(track.animationStart || 0)) * 1000
            neckFallbackTimer = setTimeout(finish, durationMs + 250)
          })
        }
      } else if (cue.action === 'spine.neck.stop') {
        manager.stopSpineNeckAnim?.(target, cue.cue_id)
      } else if (cue.action === 'spine.visual.tint') {
        manager.setSpineColor?.(target, payload.value, duration, 0)
      }
    }
    const performWhenReady = (duration, options) => {
      const token = ++operationToken
      const expectedGeneration = generation
      const deadline = performance.now() + 5000
      return new Promise(resolve => {
        const attempt = () => {
          if (token !== operationToken || expectedGeneration !== generation) return resolve(false)
          const manager = getManager()
          if (manager?.spineInstances?.[cue.target]) {
            Promise.resolve(apply(manager, duration, options)).then(() => resolve(true), () => resolve(false))
            return
          }
          if (performance.now() >= deadline) {
            console.warn('[StoryRuntime] spine cue target unavailable', cue.cue_id, cue.target)
            return resolve(false)
          }
          requestAnimationFrame(attempt)
        }
        attempt()
      })
    }
    return createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      skippable: cue.lifecycle.skippable,
      blocksInput: cue.lifecycle.blocks_input,
      blocksAuto: cue.lifecycle.blocks_auto,
      metadata: { action: cue.action, cue },
      onStart: () => {
        console.debug('[StoryRuntime] cue start', cue.cue_id)
        return performWhenReady(cue.duration)
      },
      onSettle: () => {
        operationToken++
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
        operationToken++
        releasePending?.()
        const preservesAuthoredPose = reason === 'step-change' || reason === 'load-step'
        if (cue.action === 'spine.neck.play' && !preservesAuthoredPose) {
          getManager()?.stopSpineNeckAnim?.(cue.target, `${cue.cue_id}:cancel`)
        }
      },
    })
  }

  const handlers = new Map()
  handlers.set('camera.transform', cue => createCameraCueHandle(cue, getManager))
  handlers.set('se.play', cue => createSeCueHandle(cue, audioManager))
  handlers.set('screen.directional_wipe', cue => createScreenCueHandle(cue, getManager))
  handlers.set('screen.fade', cue => createScreenCueHandle(cue, getManager))
  handlers.set('background.change', cue => createBackgroundCueHandle(cue, getManager))
  handlers.set('spine.face.set', createSpineHandle)
  handlers.set('spine.body.play', createSpineHandle)
  handlers.set('spine.neck.play', createSpineHandle)
  handlers.set('spine.neck.stop', createSpineHandle)
  handlers.set('spine.visual.tint', createSpineHandle)
  handlers.set('debug.snapshot.capture', cue => createDebugSnapshotHandle(cue, debugSnapshotAction))

  function handleStepChange() {
    generation++
    if (managerFrame != null) {
      cancelAnimationFrame(managerFrame)
      managerFrame = null
    }
    scheduler.cancelAll('step-change')
    const step = getNormalizedStep()
    if (!step) return
    const restore = pendingRestore?.stepIndex === currentStepIndex.value ? pendingRestore : null
    pendingRestore = null
    applySnapshotWhenReady(restore?.snapshot || step.entry_snapshot, generation)
    const cues = restore ? [] : step.cues.filter(cue => handlers.has(cue.action))
    const debugSnapshotCue = restore ? null : createDebugSnapshotCue(step, debugSnapshotAt)
    if (debugSnapshotCue) cues.push(debugSnapshotCue)
    scheduler.loadStep(cues, { handlers, context: { step } })
    scheduler.start()
    console.debug(restore ? '[StoryRuntime] restored' : '[StoryRuntime] scheduled', JSON.stringify(scheduler.inspect()))
  }

  function prepareRestore(stepIndex, snapshot) {
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || !snapshot) return false
    pendingRestore = { stepIndex, snapshot: clone(snapshot) }
    return true
  }

  function settleCurrentStep(reason = 'user-next') {
    if (!scheduler.hasUnsettledSkippable()) return false
    scheduler.settleSkippable(reason)
      .then(() => console.debug('[StoryRuntime] settled', reason, JSON.stringify(scheduler.inspect())))
      .catch(error => console.warn('[StoryRuntime] failed to settle cues:', error))
    return true
  }

  function cancelCurrentStep(reason = 'navigation') {
    generation++
    if (managerFrame != null) {
      cancelAnimationFrame(managerFrame)
      managerFrame = null
    }
    scheduler.cancelAll(reason).catch(error => {
      console.warn('[StoryRuntime] failed to cancel cues:', error)
    })
  }

  function cleanup() {
    cancelCurrentStep('cleanup')
    scheduler.dispose().catch(() => {})
    if (window.__STORY_RUNTIME_CUES__ === scheduler) delete window.__STORY_RUNTIME_CUES__
  }

  return {
    enabled: true,
    handleStepChange,
    settleCurrentStep,
    cancelCurrentStep,
    hasBlockingAuto: () => scheduler.hasBlockingAuto(),
    hasNonSkippable: () => scheduler.hasNonSkippable(),
    isSnapshotEnabled: () => true,
    getNormalizedStep: index => clone(getNormalizedStep(index)),
    prepareRestore,
    inspect: () => scheduler.inspect(),
    cleanup,
  }
}
