function defaultNowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now()
}
function assertFiniteNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative number`)
  }
}

function assertRate(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('rate must be a finite number greater than zero')
  }
}

/**
 * Monotonic logical clock for one story session.
 *
 * The clock owns time conversion only. It intentionally does not create a RAF
 * or timer; EffectScheduler will decide how often it needs to sample `now()`.
 */
export class StoryClock {
  constructor({ nowMilliseconds = defaultNowMilliseconds } = {}) {
    if (typeof nowMilliseconds !== 'function') {
      throw new TypeError('nowMilliseconds must be a function')
    }
    this._nowMilliseconds = nowMilliseconds
    this._state = 'idle'
    this._offsetSeconds = 0
    this._elapsedSeconds = 0
    this._startedAtMilliseconds = 0
    this._rate = 1
    this._listeners = new Set()
  }

  get state() {
    return this._state
  }

  get rate() {
    return this._rate
  }

  /** Exact origin conversion; avoids subtracting two separately sampled clocks. */
  get elapsedOffset() {
    return this._elapsedSeconds - this._offsetSeconds
  }

  start({ offset = 0, rate = 1 } = {}) {
    assertFiniteNonNegative(offset, 'offset')
    assertRate(rate)
    this._elapsedSeconds = this.elapsed()
    this._offsetSeconds = offset
    this._rate = rate
    this._startedAtMilliseconds = this._nowMilliseconds()
    this._state = 'running'
    this._emit('start')
    return this.now()
  }

  now() {
    if (this._state !== 'running') return this._offsetSeconds
    const elapsedMilliseconds = Math.max(0, this._nowMilliseconds() - this._startedAtMilliseconds)
    return this._offsetSeconds + (elapsedMilliseconds / 1000) * this._rate
  }

  /** Played time across step resets/seeks, using this clock's pause and rate. */
  elapsed() {
    if (this._state !== 'running') return this._elapsedSeconds
    return this._elapsedSeconds + Math.max(0, this._nowMilliseconds() - this._startedAtMilliseconds) / 1000 * this._rate
  }

  pause() {
    if (this._state !== 'running') return this.now()
    this._elapsedSeconds = this.elapsed()
    this._offsetSeconds = this.now()
    this._state = 'paused'
    this._emit('pause')
    return this._offsetSeconds
  }

  resume() {
    if (this._state !== 'paused') return this.now()
    this._startedAtMilliseconds = this._nowMilliseconds()
    this._state = 'running'
    this._emit('resume')
    return this._offsetSeconds
  }

  stop() {
    this._elapsedSeconds = this.elapsed()
    if (this._state === 'running') this._offsetSeconds = this.now()
    this._state = 'stopped'
    this._emit('stop')
    return this._offsetSeconds
  }

  seek(seconds) {
    assertFiniteNonNegative(seconds, 'seconds')
    this._elapsedSeconds = this.elapsed()
    this._offsetSeconds = seconds
    if (this._state === 'running') this._startedAtMilliseconds = this._nowMilliseconds()
    this._emit('seek')
    return this._offsetSeconds
  }

  setRate(rate) {
    assertRate(rate)
    this._elapsedSeconds = this.elapsed()
    if (this._state === 'running') {
      this._offsetSeconds = this.now()
      this._startedAtMilliseconds = this._nowMilliseconds()
    }
    this._rate = rate
    this._emit('rate')
    return this._rate
  }

  /** Map an authored logical time to the corresponding Web Audio time. */
  toAudioTime(logicalSeconds, audioContext) {
    assertFiniteNonNegative(logicalSeconds, 'logicalSeconds')
    const audioNow = Number(audioContext?.currentTime)
    if (!Number.isFinite(audioNow) || audioNow < 0) {
      throw new TypeError('audioContext.currentTime must be a finite non-negative number')
    }
    const logicalDelay = Math.max(0, logicalSeconds - this.now())
    return audioNow + logicalDelay / this._rate
  }

  snapshot() {
    return Object.freeze({
      state: this._state,
      time: this.now(),
      rate: this._rate,
    })
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function')
    this._listeners.add(listener)
    return () => this._listeners.delete(listener)
  }

  dispose() {
    this.stop()
    this._listeners.clear()
  }

  _emit(reason) {
    const event = Object.freeze({ reason, ...this.snapshot() })
    for (const listener of this._listeners) listener(event)
  }
}
