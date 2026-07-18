import { StoryClock } from './StoryClock.js'
import { EffectScheduler } from './EffectScheduler.js'
import { createPerformanceHandle } from './PerformanceRegistry.js'
import { normalizeScenario } from './ScenarioNormalizer.js'
import { getRuntimeCueFeatureFlags } from './RuntimeFeatureFlags.js'

function immediateCamera(camera) {
  if (!camera) return null
  return { ...camera, duration: 0, delay: 0 }
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

export function useStoryRuntimeCues({ compiledData, currentStepIndex, spineStageRef, audioManager }) {
  const flags = getRuntimeCueFeatureFlags()
  const enabled = flags.camera || flags.se || flags.screen || flags.background || flags.snapshot
  const scheduler = new EffectScheduler({ clock: new StoryClock() })
  let normalizedSource = null
  let normalizedScenario = null
  let managerFrame = null
  let generation = 0
  let pendingRestore = null

  if (enabled && typeof window !== 'undefined') {
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

  function applyEntryScreen(manager, overlay) {
    manager.clearScreenFade?.()
    manager.clearScreenSlide?.()
    if (!overlay?.visible) return
    if (overlay.kind === 'directional-wipe') {
      manager.setScreenSlide?.('in', overlay.color, 0, 0, overlay.direction)
    } else if (overlay.kind === 'fade') {
      manager.setScreenFade?.('out', overlay.color, 0, 0, overlay.alpha ?? 1)
    }
  }

  function applySnapshotWhenReady(snapshot, expectedGeneration) {
    if (!flags.camera && !flags.screen && !flags.background) return
    const apply = () => {
      if (expectedGeneration !== generation) return
      const manager = getManager()
      if (!manager) {
        managerFrame = requestAnimationFrame(apply)
        return
      }
      managerFrame = null
      if (flags.camera) {
        const camera = immediateCamera(snapshot?.camera_zoom)
        if (camera) manager.setCameraZoom(camera)
        else manager.resetCameraZoom()
      }
      if (flags.screen) applyEntryScreen(manager, snapshot?.screen_overlay)
      if (flags.background) {
        const bg = snapshot?.bg
        if (bg) manager.setBackground?.(bg, { duration: 0, delay: 0 })
        else manager.clearBackground?.()
      }
    }
    apply()
  }

  function createCameraHandle(cue) {
    return createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      skippable: cue.lifecycle.skippable,
      blocksInput: cue.lifecycle.blocks_input,
      blocksAuto: cue.lifecycle.blocks_auto,
      metadata: { action: cue.action, cue },
      onStart: () => {
        console.debug('[StoryRuntime] cue start', cue.cue_id)
        getManager()?.setCameraZoom({ ...cue.payload, duration: cue.duration, delay: 0 })
      },
      onSettle: () => {
        console.debug('[StoryRuntime] cue settle', cue.cue_id)
        getManager()?.setCameraZoom(immediateCamera(cue.payload))
      },
      onCancel: () => {
        getManager()?.cameraController?.cancelCameraTween?.()
      },
    })
  }

  function createSeHandle(cue) {
    audioManager.preloadSE?.(cue.payload.cue)
    return createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      skippable: cue.lifecycle.skippable,
      blocksInput: cue.lifecycle.blocks_input,
      blocksAuto: cue.lifecycle.blocks_auto,
      metadata: { action: cue.action, cue },
      onStart: () => {
        console.debug('[StoryRuntime] cue start', cue.cue_id)
        audioManager.playSE(cue.payload.cue)
      },
      // Settling a scheduled transient cue suppresses it instead of playing it.
      onSettle: () => console.debug('[StoryRuntime] cue suppress', cue.cue_id),
      onCancel: () => {},
    })
  }

  function createScreenHandle(cue) {
    const isWipe = cue.action === 'screen.directional_wipe'
    const start = duration => {
      if (isWipe) {
        getManager()?.setScreenSlide?.(
          cue.payload.type,
          cue.payload.color,
          duration,
          0,
          cue.payload.direction,
        )
      } else {
        getManager()?.setScreenFade?.(
          cue.payload.type,
          cue.payload.color,
          duration,
          0,
          cue.payload.alpha ?? 1,
        )
      }
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
        start(cue.duration)
      },
      onSettle: () => {
        console.debug('[StoryRuntime] cue settle', cue.cue_id)
        start(0)
      },
      onCancel: () => {
        if (isWipe) getManager()?.clearScreenSlide?.()
        else getManager()?.clearScreenFade?.()
      },
    })
  }

  function createBackgroundHandle(cue) {
    const transition = duration => ({
      type: cue.payload.type,
      color: cue.payload.color,
      duration,
      delay: 0,
    })
    return createPerformanceHandle({
      id: cue.cue_id,
      channel: cue.channel,
      skippable: cue.lifecycle.skippable,
      blocksInput: cue.lifecycle.blocks_input,
      blocksAuto: cue.lifecycle.blocks_auto,
      metadata: { action: cue.action, cue },
      onStart: () => {
        console.debug('[StoryRuntime] cue start', cue.cue_id)
        getManager()?.setBackground?.(cue.payload.bg, transition(cue.duration))
      },
      onSettle: () => {
        console.debug('[StoryRuntime] cue settle', cue.cue_id)
        const manager = getManager()
        if (!manager?.backgroundManager?.settleBackgroundTransition?.()) {
          manager?.setBackground?.(cue.payload.bg, transition(0))
        }
      },
      onCancel: () => {
        getManager()?.backgroundManager?.cancelBackgroundTransition?.()
      },
    })
  }

  const handlers = new Map()
  if (flags.camera) handlers.set('camera.transform', createCameraHandle)
  if (flags.se) handlers.set('se.play', createSeHandle)
  if (flags.screen) {
    handlers.set('screen.directional_wipe', createScreenHandle)
    handlers.set('screen.fade', createScreenHandle)
  }
  if (flags.background) handlers.set('background.change', createBackgroundHandle)

  function handleStepChange() {
    if (!enabled) return
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
    scheduler.loadStep(cues, { handlers, context: { step } })
    scheduler.start()
    console.debug(restore ? '[StoryRuntime] restored' : '[StoryRuntime] scheduled', JSON.stringify(scheduler.inspect()))
  }

  function prepareRestore(stepIndex, snapshot) {
    if (!flags.snapshot) return false
    if (!Number.isInteger(stepIndex) || stepIndex < 0 || !snapshot) return false
    pendingRestore = { stepIndex, snapshot: clone(snapshot) }
    return true
  }

  function settleCurrentStep(reason = 'user-next') {
    if (!enabled || !scheduler.hasUnsettledSkippable()) return false
    scheduler.settleSkippable(reason)
      .then(() => console.debug('[StoryRuntime] settled', reason, JSON.stringify(scheduler.inspect())))
      .catch(error => console.warn('[StoryRuntime] failed to settle cues:', error))
    return true
  }

  function cancelCurrentStep(reason = 'navigation') {
    if (!enabled) return
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
    enabled,
    flags,
    handleStepChange,
    settleCurrentStep,
    cancelCurrentStep,
    hasBlockingAuto: () => enabled && scheduler.hasBlockingAuto(),
    hasNonSkippable: () => enabled && scheduler.hasNonSkippable(),
    isSnapshotEnabled: () => flags.snapshot,
    getNormalizedStep: index => clone(getNormalizedStep(index)),
    prepareRestore,
    inspect: () => scheduler.inspect(),
    cleanup,
  }
}
