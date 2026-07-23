import { createPerformanceHandle } from './PerformanceRegistry.js'

export function createSeCueHandle(cue, audioManager) {
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
    // A transient cue settled before its authored timestamp is suppressed.
    onSettle: () => console.debug('[StoryRuntime] cue suppress', cue.cue_id),
    onCancel: () => {},
  })
}
