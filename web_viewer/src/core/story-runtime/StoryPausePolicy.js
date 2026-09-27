/** Buffering freezes cue scheduling, while continuous BGM/ambient keep playing. */
export function setStoryRuntimePaused({ reasons, cues, audioSession }, reason, paused) {
  const wasPaused = reasons.size > 0
  if (paused) reasons.add(reason)
  else reasons.delete(reason)
  const isPaused = reasons.size > 0
  const schedulerTransition = !wasPaused && isPaused ? cues.pause()
    : wasPaused && !isPaused ? cues.resume() : null
  const audioTransition = reason === 'buffering' ? null
    : paused ? audioSession.pause(reason) : audioSession.resume(reason)
  return Promise.all([schedulerTransition, audioTransition])
}
