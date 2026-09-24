/** A caller owns its deadline; the underlying work may still finish after abort. */
export function waitForSignal(work, signal) {
  if (!signal) return Promise.resolve(work)
  let onAbort
  const failure = () => signal.reason ?? new DOMException('Aborted', 'AbortError')
  if (signal.aborted) {
    Promise.resolve(work).catch(() => {}) // observe even non-cancellable late rejection
    return Promise.reject(failure())
  }
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(failure())
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  // Register handlers on work even when already aborted: no late unhandled rejection.
  return Promise.race([Promise.resolve(work), aborted])
    .finally(() => signal.removeEventListener('abort', onAbort))
}

export function createLoadTimeout(label, timeoutMs) {
  return Object.assign(new Error(`${label} timeout (${timeoutMs}ms)`), {
    name: 'TimeoutError', code: 'LOAD_TIMEOUT', timeoutMs, phase: label,
  })
}

/** Optional resources must never gate the readiness of a required resource. */
export function attachOptionalResource({
  load, apply, isCurrent = () => true, timeoutMs = 8000,
  onFailure = () => {}, setTimer = setTimeout, clearTimer = clearTimeout,
}) {
  const controller = new AbortController()
  let cancelled = false
  const timer = setTimer(() => controller.abort(createLoadTimeout('optional-resource', timeoutMs)), timeoutMs)
  const done = waitForSignal(Promise.resolve().then(() => {
    if (controller.signal.aborted) throw controller.signal.reason
    return load(controller.signal)
  }), controller.signal).then(value => {
    if (!controller.signal.aborted && isCurrent() && value != null) apply(value)
  }).catch(error => {
    if (!cancelled && isCurrent()) {
      try { onFailure(error) } catch { /* diagnostics cannot break playback */ }
    }
  }).finally(() => clearTimer(timer))
  return {
    done,
    cancel(reason = 'owner-left') {
      cancelled = true
      controller.abort(new DOMException(reason, 'AbortError'))
    },
  }
}
