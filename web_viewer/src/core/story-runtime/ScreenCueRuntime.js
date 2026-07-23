import { createPerformanceHandle } from './PerformanceRegistry.js'

export function applyScreenEntrySnapshot(manager, overlay) {
  if (!manager) return
  manager.clearScreenFade?.()
  manager.clearScreenSlide?.()
  if (!overlay?.visible) return
  if (overlay.kind === 'directional-wipe') {
    manager.setScreenSlide?.('in', overlay.color, 0, 0, overlay.direction)
  } else if (overlay.kind === 'fade') {
    manager.setScreenFade?.('out', overlay.color, 0, 0, overlay.alpha ?? 1)
  }
}

export function createScreenCueHandle(cue, getManager) {
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
