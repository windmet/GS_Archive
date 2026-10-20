/**
 * Client cut waits (data_pipeline/sidem_scenario/native_cuts.py).
 *
 * In StoryView a `wait` closes its cut, and a cut holding only a wait keeps the
 * screen as it is for that long (NextCutWaitCoroutine) before the next cut
 * plays. The compiler records those cuts as `post_wait` on the step before them,
 * or `pre_wait` on the step they lead into (a jump label or a part start).
 * A tap during the wait clears it (OnClickBackgroundPanel zeroes StoryView+0xe4),
 * and so does skip.
 */

const seconds = value => {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : 0
}

/** Seconds to hold between leaving `fromIndex` and entering `toIndex`. */
export function nativeWaitSeconds(steps, fromIndex, toIndex) {
  return seconds(steps?.[fromIndex]?.post_wait) + seconds(steps?.[toIndex]?.pre_wait)
}

/** One pending wait at a time, owned by the step it was started from. */
export function createNativeCutWait({ setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
  let pending = null
  function cancel() {
    if (!pending) return false
    clearTimer(pending.timer)
    pending = null
    onChange()
    return true
  }
  return {
    get pending() { return pending != null },
    get step() { return pending?.step ?? null },
    start(step, holdSeconds, resume) {
      cancel()
      const entry = { step, seconds: holdSeconds }
      entry.timer = setTimer(() => {
        pending = null
        onChange()
        resume()
      }, holdSeconds * 1000)
      pending = entry
      onChange()
    },
    cancel,
    inspect() { return pending ? { pending: true, seconds: pending.seconds } : { pending: false } },
  }
}
