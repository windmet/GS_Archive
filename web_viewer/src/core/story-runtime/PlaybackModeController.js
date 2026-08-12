const POLL_INTERVAL_MS = 50

export class PlaybackModeController {
  constructor({
    getStep,
    getVoiceState = () => 'idle',
    hasBlockingAuto = () => false,
    hasNonSkippable = () => false,
    isRead = () => false,
    onAdvance,
    onModeChange = () => {},
    autoDelayMs = 800,
    skipIntervalMs = 90,
    now = () => Date.now(),
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = timer => clearTimeout(timer),
  } = {}) {
    if (typeof getStep !== 'function') throw new TypeError('getStep is required')
    if (typeof onAdvance !== 'function') throw new TypeError('onAdvance is required')
    this.getStep = getStep
    this.getVoiceState = getVoiceState
    this.hasBlockingAuto = hasBlockingAuto
    this.hasNonSkippable = hasNonSkippable
    this.isRead = isRead
    this.onAdvance = onAdvance
    this.onModeChange = onModeChange
    this.autoDelayMs = Math.max(0, Number(autoDelayMs) || 0)
    this.skipIntervalMs = Math.max(30, Number(skipIntervalMs) || 90)
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.autoEnabled = false
    this.skipEnabled = false
    this.skipMode = 'readOnly'
    this.pausedReasons = new Set()
    this.timer = null
    this.autoReadyAt = null
  }

  setAuto(enabled) {
    this.autoEnabled = enabled === true
    if (this.autoEnabled) this.skipEnabled = false
    this.autoReadyAt = null
    this._changed('auto-toggle')
  }

  setSkip(enabled, mode = this.skipMode) {
    this.skipMode = mode === 'all' ? 'all' : 'readOnly'
    this.skipEnabled = enabled === true
    if (this.skipEnabled) this.autoEnabled = false
    this.autoReadyAt = null
    this._changed('skip-toggle')
  }

  setAutoDelay(delayMs) {
    this.autoDelayMs = Math.max(0, Math.min(10000, Number(delayMs) || 0))
    this.autoReadyAt = null
    this._schedule(0)
  }

  setPaused(reason, paused) {
    if (!reason) return
    if (paused) this.pausedReasons.add(reason)
    else this.pausedReasons.delete(reason)
    this.autoReadyAt = null
    this._schedule(0)
  }

  notifyStateChanged() {
    this.autoReadyAt = null
    this._schedule(0)
  }

  inspect() {
    return {
      auto_enabled: this.autoEnabled,
      skip_enabled: this.skipEnabled,
      skip_mode: this.skipMode,
      paused: [...this.pausedReasons],
      auto_ready_at: this.autoReadyAt,
      timer_pending: Number(this.timer != null),
    }
  }

  dispose() {
    if (this.timer != null) this.clearTimer(this.timer)
    this.timer = null
    this.autoEnabled = false
    this.skipEnabled = false
    this.pausedReasons.clear()
  }

  _changed(reason) {
    this.onModeChange(this.inspect(), reason)
    this._schedule(0)
  }

  _schedule(delay = POLL_INTERVAL_MS) {
    if (this.timer != null) this.clearTimer(this.timer)
    this.timer = null
    if (!this.autoEnabled && !this.skipEnabled) return
    this.timer = this.setTimer(() => {
      this.timer = null
      this._tick()
    }, delay)
  }

  _stopSkip(reason) {
    this.skipEnabled = false
    this.onModeChange(this.inspect(), reason)
  }

  _tick() {
    if (this.pausedReasons.size > 0) {
      this.autoReadyAt = null
      this._schedule()
      return
    }
    const step = this.getStep()
    if (!step) {
      this._schedule()
      return
    }
    if (this.skipEnabled) {
      if (step.type === 'choice' || step.unavailable === true || step.fatal === true) {
        this._stopSkip(step.type === 'choice' ? 'choice' : 'unavailable')
        return
      }
      if (this.skipMode === 'readOnly' && !this.isRead(step)) {
        this._stopSkip('unread')
        return
      }
      if (this.hasNonSkippable()) {
        this._stopSkip('non-skippable')
        return
      }
      const result = this.onAdvance('skip')
      this._schedule(result === 'settled' ? 0 : this.skipIntervalMs)
      return
    }
    if (!this.autoEnabled) return
    if (step.type === 'choice' || step.unavailable === true || step.fatal === true) {
      this.autoReadyAt = null
      this._schedule()
      return
    }
    const voiceState = this.getVoiceState()
    const waitingVoice = Boolean(step.dialogue?.voice) && (voiceState === 'preparing' || voiceState === 'playing')
    if (this.hasBlockingAuto() || waitingVoice) {
      this.autoReadyAt = null
      this._schedule()
      return
    }
    if (this.autoReadyAt == null) {
      this.autoReadyAt = this.now() + this.autoDelayMs
      this._schedule(Math.min(POLL_INTERVAL_MS, this.autoDelayMs))
      return
    }
    const remaining = this.autoReadyAt - this.now()
    if (remaining > 0) {
      this._schedule(Math.min(POLL_INTERVAL_MS, remaining))
      return
    }
    const result = this.onAdvance('auto')
    this.autoReadyAt = result === 'settled' ? this.now() : null
    this._schedule(result === 'settled' ? 0 : POLL_INTERVAL_MS)
  }
}
