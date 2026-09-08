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
  const tick = () => {
    if (cancelled || shouldStop()) return
    const elapsed = Math.max(0, nowMilliseconds() - startAt)
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
    if (state.rafId != null) {
      cancelAnimationFrame(state.rafId)
      state.rafId = null
    }
  }
  return state
}
