import { createPerformanceHandle } from './PerformanceRegistry.js'

export function createDebugSnapshotCue(step, at) {
  if (!Number.isFinite(at) || at < 0) return null
  return {
    cue_id: `step-${step?.step_id ?? 'unknown'}:debug-snapshot`,
    at,
    duration: 0,
    channel: 'debug:snapshot',
    action: 'debug.snapshot.capture',
    lifecycle: {
      persistence: 'transient', skippable: false,
      blocks_input: false, blocks_auto: false, restore_policy: 'suppress',
    },
  }
}

export function createDebugSnapshotHandle(cue, capture) {
  return createPerformanceHandle({
    id: cue.cue_id,
    channel: cue.channel,
    skippable: false,
    blocksInput: false,
    blocksAuto: false,
    metadata: { action: cue.action, cue },
    onStart: () => {
      console.debug('[StoryRuntime] cue start', cue.cue_id)
      const snapshot = capture?.()
      if (typeof window !== 'undefined') window.__SNAPSHOT__ = snapshot
      return snapshot
    },
    onSettle: () => {},
    onCancel: () => {},
  })
}
