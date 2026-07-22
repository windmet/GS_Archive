import { createPerformanceHandle } from './PerformanceRegistry.js'

export function applyBackgroundEntrySnapshot(manager, bg) {
  if (!manager) return
  if (bg) manager.setBackground?.(bg, { duration: 0, delay: 0 })
  else manager.clearBackground?.()
}

export function createBackgroundCueHandle(cue, getManager) {
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
      return getManager()?.setBackground?.(cue.payload.bg, transition(cue.duration))
    },
    onSettle: () => {
      console.debug('[StoryRuntime] cue settle', cue.cue_id)
      const manager = getManager()
      if (!manager?.backgroundManager?.settleBackgroundTransition?.()) {
        // setBackground records currentBgId before its texture Promise resolves.
        // Clear first so an early settle cannot be mistaken for an already
        // installed same-background request and leave the entry sprite visible.
        manager?.clearBackground?.()
        return manager?.setBackground?.(cue.payload.bg, transition(0))
      }
    },
    onCancel: () => {
      getManager()?.backgroundManager?.cancelBackgroundTransition?.()
    },
  })
}
