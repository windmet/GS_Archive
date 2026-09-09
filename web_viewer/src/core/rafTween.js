export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

export function cancelRafTween(handle) {
  if (handle != null) {
    cancelAnimationFrame(handle)
  }
}

export function runRafTween({
  durationMs = 0,
  delayMs = 0,
  startValue = 0,
  endValue = 1,
  ease = easeOutCubic,
  onUpdate,
  onComplete,
  shouldStop = () => false,
  nowMilliseconds = () => performance.now(),
}) {
  const state = { rafId: null }
  let cancelled = false
  const startAt = nowMilliseconds()
  // Timing metadata for read-only shadow diagnostics; this handle remains the tween owner.
  state.startedAtMilliseconds = startAt
  state.cancelled = false
  const tick = () => {
    if (cancelled || shouldStop()) return
    const sampledAt = nowMilliseconds()
    state.sampledAtMilliseconds = sampledAt
    const elapsed = Math.max(0, sampledAt - startAt)
    if (elapsed < delayMs) {
      state.rafId = requestAnimationFrame(tick)
      return
    }
    const t = durationMs > 0 ? Math.min((elapsed - delayMs) / durationMs, 1) : 1
    const eased = ease(t)
    onUpdate(startValue + (endValue - startValue) * eased, t)
    if (t >= 1) {
      state.rafId = null
      onComplete?.()
      return
    }
    state.rafId = requestAnimationFrame(tick)
  }
  state.rafId = requestAnimationFrame(tick)
  state.cancel = () => {
    cancelled = true
    state.cancelled = true
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }
  }
  return state
}
