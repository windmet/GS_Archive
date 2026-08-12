import { storyReleaseProbe } from './StoryReleaseProbe.js'

const BUS_NAMES = Object.freeze(['bgm', 'ambient', 'voice', 'se'])
const DEFAULT_BUS_VOLUMES = Object.freeze({ bgm: 1, ambient: 1, voice: 1, se: 1 })

function clampVolume(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new RangeError('volume must be a finite number')
  return Math.max(0, Math.min(1, number))
}

function assertRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new RangeError('rate must be greater than zero')
  return number
}

function defaultContextFactory() {
  const AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContextCtor) throw new Error('Web Audio API is unavailable')
  return new AudioContextCtor()
}

export class StoryAudioSession {
  constructor({
    contextFactory = defaultContextFactory,
    masterVolume = 1,
    busVolumes = {},
    disabled = false,
    releaseOwner = null,
  } = {}) {
    this._contextFactory = contextFactory
    this._disabled = Boolean(disabled)
    this._masterVolume = clampVolume(masterVolume)
    this._busVolumes = { ...DEFAULT_BUS_VOLUMES }
    for (const bus of BUS_NAMES) {
      if (busVolumes[bus] != null) this._busVolumes[bus] = clampVolume(busVolumes[bus])
    }
    this._context = null
    this._masterGain = null
    this._buses = new Map()
    this._sources = new Map()
    this._pauseReasons = new Set()
    this._rate = 1
    this._logicalOffset = 0
    this._logicalEpoch = 0
    this._stateTransition = Promise.resolve()
    this._disposed = false
    this._releaseOwner = releaseOwner
    this._releaseSession = releaseOwner === 'story-player'
      ? storyReleaseProbe.registerAudioSession(this)
      : null
  }

  get context() {
    return this._context
  }

  get rate() {
    return this._rate
  }

  get disabled() {
    return this._disabled
  }

  ensureContext() {
    if (this._disposed) throw new Error('StoryAudioSession is disposed')
    if (this._disabled) return null
    if (!this._context) {
      this._context = this._contextFactory()
      if (this._releaseOwner === 'story-player') storyReleaseProbe.audioContextCreated()
      this._logicalEpoch = Number(this._context.currentTime) || 0
      this._masterGain = this._context.createGain()
      this._masterGain.gain.value = this._masterVolume
      this._masterGain.connect(this._context.destination)
      for (const bus of BUS_NAMES) {
        const gain = this._context.createGain()
        gain.gain.value = this._busVolumes[bus]
        gain.connect(this._masterGain)
        this._buses.set(bus, gain)
      }
    }
    return this._context
  }

  getBus(bus) {
    if (!BUS_NAMES.includes(bus)) throw new RangeError(`unknown audio bus: ${bus}`)
    this.ensureContext()
    return this._buses.get(bus)
  }

  setBusVolume(bus, value) {
    const gain = this.getBus(bus)
    const volume = clampVolume(value)
    this._busVolumes[bus] = volume
    gain.gain.setValueAtTime?.(volume, this._context.currentTime)
    gain.gain.value = volume
    return volume
  }

  unlockFromUserGesture() {
    if (this._disabled) return null
    const context = this.ensureContext()
    if (context.state === 'suspended' && this._pauseReasons.size === 0) {
      const resume = Promise.resolve(context.resume?.())
      this._stateTransition = this._stateTransition
        .catch(() => {})
        .then(() => resume)
        .then(() => this._syncContextState())
    }
    try {
      const buffer = context.createBuffer(1, 1, 22050)
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(this._masterGain)
      source.start(0)
      source.onended = () => { try { source.disconnect() } catch (_) {} }
    } catch (_) {}
    return context
  }

  async pause(reason = 'manual') {
    this._pauseReasons.add(reason)
    await this._queueContextStateSync()
    return this.inspect()
  }

  async resume(reason = 'manual') {
    this._pauseReasons.delete(reason)
    await this._queueContextStateSync()
    return this.inspect()
  }

  _queueContextStateSync() {
    this._stateTransition = this._stateTransition
      .catch(() => {})
      .then(() => this._syncContextState())
    return this._stateTransition
  }

  async _syncContextState() {
    if (!this._context || this._disposed) return
    if (this._pauseReasons.size > 0 && this._context.state === 'running') {
      await this._context.suspend?.()
    } else if (this._pauseReasons.size === 0 && this._context.state === 'suspended') {
      await this._context.resume?.()
    }
  }

  currentTime() {
    if (!this._context) return this._logicalOffset
    const audioNow = Number(this._context.currentTime) || 0
    return this._logicalOffset + Math.max(0, audioNow - this._logicalEpoch) * this._rate
  }

  setRate(value) {
    const rate = assertRate(value)
    if (this._context) {
      this._logicalOffset = this.currentTime()
      this._logicalEpoch = Number(this._context.currentTime) || 0
    }
    this._rate = rate
    for (const source of this._sources.keys()) {
      if (source.playbackRate) source.playbackRate.value = rate
    }
    return rate
  }

  registerSource(source, { bus = 'unknown', kind = 'source', cue = null } = {}) {
    if (!source || typeof source !== 'object') throw new TypeError('source is required')
    this.ensureContext()
    if (source.playbackRate) source.playbackRate.value = this._rate
    const registeredAt = this.currentTime()
    this._sources.set(source, Object.freeze({
      bus: BUS_NAMES.includes(bus) ? bus : 'unknown',
      kind: String(kind || 'source'),
      cue: cue == null ? null : String(cue),
      registered_at: registeredAt,
    }))
    let released = false
    return () => {
      if (released) return
      released = true
      this._sources.delete(source)
    }
  }

  inspect() {
    const now = this.currentTime()
    const sources = [...this._sources.values()].map(source => Object.freeze({
      ...source,
      age: Math.max(0, now - source.registered_at),
    }))
    return Object.freeze({
      context_state: this._context?.state || 'uninitialized',
      pause_reasons: [...this._pauseReasons],
      rate: this._rate,
      active_sources: this._sources.size,
      sources: Object.freeze(sources),
      buses: Object.freeze({ ...this._busVolumes }),
      disabled: this._disabled,
      disposed: this._disposed,
      release_owner: this._releaseOwner,
    })
  }

  async dispose() {
    if (this._disposed) return
    this._disposed = true
    this._sources.clear()
    this._pauseReasons.clear()
    for (const gain of this._buses.values()) {
      try { gain.disconnect() } catch (_) {}
    }
    this._buses.clear()
    try { this._masterGain?.disconnect() } catch (_) {}
    this._masterGain = null
    const context = this._context
    this._context = null
    await this._stateTransition.catch(() => {})
    try {
      if (context && context.state !== 'closed') await context.close?.()
      if (context && this._releaseOwner === 'story-player') storyReleaseProbe.audioContextClosed()
    } catch (error) {
      if (context && this._releaseOwner === 'story-player') storyReleaseProbe.audioContextCloseFailed()
      throw error
    } finally {
      this._releaseSession?.()
      this._releaseSession = null
    }
  }
}

export { BUS_NAMES as STORY_AUDIO_BUSES }
