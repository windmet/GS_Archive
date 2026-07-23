import { createPerformanceHandle } from './PerformanceRegistry.js'

export function immediateCamera(camera) {
  if (!camera) return null
  return { ...camera, duration: 0, delay: 0 }
}

export function applyCameraEntrySnapshot(manager, camera) {
  if (!manager) return
  const immediate = immediateCamera(camera)
  if (immediate) manager.setCameraZoom?.(immediate)
  else manager.resetCameraZoom?.()
}

export function createCameraCueHandle(cue, getManager) {
  return createPerformanceHandle({
    id: cue.cue_id,
    channel: cue.channel,
    skippable: cue.lifecycle.skippable,
    blocksInput: cue.lifecycle.blocks_input,
    blocksAuto: cue.lifecycle.blocks_auto,
    metadata: { action: cue.action, cue },
    onStart: () => {
      console.debug('[StoryRuntime] cue start', cue.cue_id)
      getManager()?.setCameraZoom?.({ ...cue.payload, duration: cue.duration, delay: 0 })
    },
    onSettle: () => {
      console.debug('[StoryRuntime] cue settle', cue.cue_id)
      getManager()?.setCameraZoom?.(immediateCamera(cue.payload))
    },
    onCancel: () => {
      getManager()?.cameraController?.cancelCameraTween?.()
    },
  })
}
