/** UI overlays and buffering stop story scheduling, not the shared audio clock. */
const SCHEDULER_ONLY = new Set(['buffering', 'backlog', 'menu', 'episode-complete', 'viewing-offer', 'recovery'])
export function transferOverlayPause(apply, states) {
  // Acquire new reasons before releasing old reasons; modal-to-modal transitions
  // cannot momentarily resume cues, even within one Vue watcher flush.
  for (const [reason, paused] of states.filter(([, value]) => value)) apply(reason, paused)
  for (const [reason, paused] of states.filter(([, value]) => !value)) apply(reason, paused)
}
export function setStoryRuntimePaused({ reasons, cues, audioSession }, reason, paused) {
  const wasPaused = reasons.size > 0
  if (paused) reasons.add(reason)
  else reasons.delete(reason)
  const isPaused = reasons.size > 0
  const schedulerTransition = !wasPaused && isPaused ? cues.pause()
    : wasPaused && !isPaused ? cues.resume() : null
  const audioTransition = SCHEDULER_ONLY.has(reason) ? null
    : paused ? audioSession.pause(reason) : audioSession.resume(reason)
  return Promise.all([schedulerTransition, audioTransition])
}
