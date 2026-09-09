import { captureProjectorShadow } from './ProjectorShadow.js'
import { StoryClock } from './StoryClock.js'
import { EffectScheduler } from './EffectScheduler.js'
import { normalizeScenario } from './ScenarioNormalizer.js'
import { applyScreenEntrySnapshot, createScreenCueHandle } from './ScreenCueRuntime.js'
import { applyBackgroundEntrySnapshot, createBackgroundCueHandle } from './BackgroundCueRuntime.js'
import { applyCameraEntrySnapshot, createCameraCueHandle } from './CameraCueRuntime.js'
import { createSeCueHandle } from './SeCueRuntime.js'
import { createDebugSnapshotCue, createDebugSnapshotHandle } from './DebugSnapshotRuntime.js'
import { createSpineCueHandle } from './SpineCueRuntime.js'

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

// Keep the existing public helper import stable during the module migration.
export { settleSpineNeckCue } from './SpineCueRuntime.js'

export function useStoryRuntimeCues({
  compiledData, currentStepIndex, spineStageRef, audioManager,
  getStageStep = () => compiledData.value?.steps?.[currentStepIndex.value],
  debugSnapshotAt = null, debugSnapshotAction = null,
  isPaused = () => false,
}) {
  const scheduler = new EffectScheduler({ clock: new StoryClock() })
  let normalizedSource = null
  let normalizedScenario = null
  let managerFrame = null
  let generation = 0
  let pendingRestore = null
  let shadowBasis = null
  let shadowUnavailableReason = 'not-started'

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

  function applySnapshotWhenReady(snapshot, expectedGeneration, onReady) {
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
      onReady?.(manager)
    }
    apply()
  }

  const createSpineHandle = (cue, context) => {
    // The stage consumes a projected source step, not the normalizer's copy.
    // Capture its identity now so readiness cannot silently follow navigation.
    const expectedStep = getStageStep()
    return createSpineCueHandle(cue, context, {
      getManager, getGeneration: () => generation,
      nowMilliseconds: () => scheduler.clock.now() * 1000,
      isTargetReady: target => spineStageRef.value?.isSpineReady?.(target, expectedStep) ?? true,
    })
  }

  const handlers = new Map()
  handlers.set('camera.transform', cue => createCameraCueHandle(cue, getManager, {
    nowMilliseconds: () => scheduler.clock.now() * 1000,
  }))
  handlers.set('se.play', cue => createSeCueHandle(cue, audioManager))
  const createScreenHandle = cue => createScreenCueHandle(cue, getManager, {
    nowMilliseconds: () => scheduler.clock.now() * 1000,
  })
  handlers.set('screen.directional_wipe', createScreenHandle)
  handlers.set('screen.fade', createScreenHandle)
  handlers.set('background.change', cue => createBackgroundCueHandle(cue, getManager, {
    nowMilliseconds: () => scheduler.clock.now() * 1000,
  }))
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
    shadowBasis = { source: compiledData.value, stepIndex: currentStepIndex.value, context: restore ? { entrySnapshot: clone(restore.snapshot), historyId: `runtime-restore:${generation}`, cuePolicy: 'suppressed' } : {} }
    const cues = restore ? [] : step.cues.filter(cue => handlers.has(cue.action))
    const debugSnapshotCue = restore ? null : createDebugSnapshotCue(step, debugSnapshotAt)
    if (debugSnapshotCue) cues.push(debugSnapshotCue)
    applySnapshotWhenReady(restore?.snapshot || step.entry_snapshot, generation, manager => {
      shadowBasis.manager = manager
      scheduler.loadStep(cues, { handlers, context: { step } })
      scheduler.start({ paused: isPaused() })
      console.debug(restore ? '[StoryRuntime] restored' : '[StoryRuntime] scheduled', JSON.stringify(scheduler.inspect()))
    })
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

  function inspectProjectorShadow() {
    if (!shadowBasis) return { status: 'not-comparable', reason: shadowUnavailableReason }
    if (shadowBasis.source !== compiledData.value || shadowBasis.stepIndex !== currentStepIndex.value || managerFrame != null) return { status: 'not-comparable', reason: 'navigation-pending' }
    getNormalizedStep()
    const manager = getManager()
    const expectedStep = getStageStep()
    const report = captureProjectorShadow({ scenario: normalizedScenario, stepIndex: currentStepIndex.value, runtime: scheduler.inspect(), manager, context: shadowBasis.context,
      isSpineReady: id => spineStageRef.value?.isSpineReady?.(id, expectedStep) === true })
    return manager !== shadowBasis.manager
      ? { ...report, status: 'not-comparable', reason: 'stage-manager-replaced', observed_comparison: report.status } : report
  }

  function cancelCurrentStep(reason = 'navigation') {
    shadowBasis = null
    shadowUnavailableReason = reason
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
    nowMilliseconds: () => scheduler.clock.elapsed() * 1000,
    handleStepChange,
    settleCurrentStep,
    cancelCurrentStep,
    hasBlockingAuto: () => managerFrame != null || scheduler.hasBlockingAuto(),
    hasNonSkippable: () => scheduler.hasNonSkippable(),
    isSnapshotEnabled: () => true,
    getNormalizedStep: index => clone(getNormalizedStep(index)),
    prepareRestore,
    pause: () => scheduler.pause(),
    resume: () => scheduler.resume(),
    setRate: rate => scheduler.setRate(rate),
    inspect: () => scheduler.inspect(),
    inspectProjectorShadow,
    cleanup,
  }
}
