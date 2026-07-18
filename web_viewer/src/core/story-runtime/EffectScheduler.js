import { PerformanceRegistry } from './PerformanceRegistry.js'

function defaultRequestFrame(callback) {
  return globalThis.requestAnimationFrame(callback)
}

function defaultCancelFrame(frameId) {
  globalThis.cancelAnimationFrame(frameId)
}

/** Schedules normalized cues against a StoryClock. */
export class EffectScheduler {
  constructor({
    clock,
    registry = new PerformanceRegistry(),
    requestFrame = defaultRequestFrame,
    cancelFrame = defaultCancelFrame,
  } = {}) {
    if (!clock || typeof clock.now !== 'function') throw new TypeError('EffectScheduler requires a StoryClock')
    this.clock = clock
    this.registry = registry
    this._requestFrame = requestFrame
    this._cancelFrame = cancelFrame
    this._entries = []
    this._frameId = null
    this._running = false
    this._generation = 0
  }

  loadStep(cues, { handlers, context = {} } = {}) {
    if (!Array.isArray(cues)) throw new TypeError('cues must be an array')
    if (!(handlers instanceof Map)) throw new TypeError('handlers must be a Map keyed by cue action')
    this.cancelAll('load-step')
    this._generation++
    this._entries = cues.map(cue => {
      const handler = handlers.get(cue.action)
      if (!handler) return { cue, handle: null, unsupported: true }
      const handle = handler(cue, context)
      this.registry.register(handle)
      return { cue, handle, unsupported: false, started: false, completed: false }
    })
    return {
      generation: this._generation,
      scheduled: this._entries.filter(entry => entry.handle).length,
      unsupported: this._entries.filter(entry => entry.unsupported).map(entry => entry.cue.action),
    }
  }

  start({ offset = 0, rate = 1 } = {}) {
    this.clock.start({ offset, rate })
    this._running = true
    this.tick()
    this._scheduleFrame()
  }

  tick() {
    if (!this._running) return
    const logicalTime = this.clock.now()
    for (const entry of this._entries) {
      if (!entry.handle || entry.completed) continue
      const endTime = entry.cue.at + entry.cue.duration
      if (!entry.started && logicalTime >= entry.cue.at) {
        entry.started = true
        Promise.resolve(entry.handle.start()).then(() => {
          if (entry.completed || !entry.handle.active) return
          if (entry.cue.duration <= 0 || this.clock.now() >= endTime) {
            entry.completed = true
            return entry.handle.complete('natural-completion')
          }
        }).catch(() => {})
      }
      if (entry.started && !entry.completed && logicalTime >= endTime && entry.handle.status === 'running') {
        entry.completed = true
        Promise.resolve(entry.handle.complete('natural-completion')).catch(() => {})
      }
    }
    if (!this.registry.hasUnsettled()) this._stopTicker()
  }

  pause() {
    this.clock.pause()
    this._stopTicker()
    return Promise.all(this.registry.getActive().map(handle => handle.pause()))
  }

  resume() {
    this.clock.resume()
    this._running = true
    const result = Promise.all(this.registry.getActive().map(handle => handle.resume()))
    this._scheduleFrame()
    return result
  }

  hasUnsettledSkippable() {
    return this.registry.getActive().some(handle => handle.skippable)
  }

  hasBlockingAuto() {
    return this.registry.hasBlockingAuto()
  }

  settleSkippable(reason = 'scheduler-settle') {
    this._entries.forEach(entry => {
      if (entry.handle?.skippable) entry.completed = true
    })
    const result = this.registry.settleSkippable(reason)
    this._stopTicker()
    return result
  }

  cancelAll(reason = 'scheduler-cancel') {
    this._generation++
    this._entries.forEach(entry => { entry.completed = true })
    this._stopTicker()
    this.clock.stop()
    return this.registry.cancelAll(reason)
  }

  inspect() {
    return {
      generation: this._generation,
      clock: this.clock.snapshot(),
      running: this._running,
      entries: this._entries.map(entry => ({
        cue_id: entry.cue.cue_id,
        action: entry.cue.action,
        at: entry.cue.at,
        duration: entry.cue.duration,
        status: entry.handle?.status || 'unsupported',
      })),
      active: this.registry.getActive().map(handle => ({
        id: handle.id,
        channel: handle.channel,
        status: handle.status,
        blocksInput: handle.blocksInput,
        blocksAuto: handle.blocksAuto,
      })),
    }
  }

  async dispose() {
    await this.cancelAll('scheduler-dispose')
    await this.registry.dispose()
    this._entries = []
    this.clock.dispose()
  }

  _scheduleFrame() {
    if (!this._running || this._frameId != null || !this.registry.hasUnsettled()) return
    this._frameId = this._requestFrame(() => {
      this._frameId = null
      this.tick()
      this._scheduleFrame()
    })
  }

  _stopTicker() {
    this._running = false
    if (this._frameId != null) {
      this._cancelFrame(this._frameId)
      this._frameId = null
    }
  }
}
