import { storyReleaseProbe } from './StoryReleaseProbe.js'
import { withLoadDeadline } from '../AsyncLoadBoundary.js'

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

/** One context and four buses. Desired state is synchronous; browser promises are
 * observations, not a FIFO that can be blocked by an ungranted autoplay resume. */
export class StoryAudioSession {
  constructor({ contextFactory = defaultContextFactory, masterVolume = 1,
    busVolumes = {}, disabled = false, releaseOwner = null, closeTimeoutMs = 1500 } = {}) {
    this._contextFactory = contextFactory
    this._disabled = Boolean(disabled)
    this._masterVolume = clampVolume(masterVolume)
    this._busVolumes = { ...DEFAULT_BUS_VOLUMES }
    for (const bus of BUS_NAMES) if (busVolumes[bus] != null) this._busVolumes[bus] = clampVolume(busVolumes[bus])
    this._context = null
    this._masterGain = null
    this._buses = new Map()
    this._sources = new Map()
    this._media = new Map()
    this._pauseReasons = new Set()
    this._rate = 1
    this._logicalOffset = 0
    this._logicalEpoch = 0
    this._stateCommand = null
    this._stateError = null
    this._disposed = false
    this._releaseOwner = releaseOwner
    this._closeTimeoutMs = closeTimeoutMs
    this._releaseSession = releaseOwner === 'story-player' ? storyReleaseProbe.registerAudioSession(this) : null
    this._onStateChange = () => {
      this._syncMedia()
      if (this._pauseReasons.size && this._context?.state === 'running') this._requestContextState()
    }
  }
  get context() { return this._context }
  get rate() { return this._rate }
  get disabled() { return this._disabled }
  get paused() { return this._pauseReasons.size > 0 }
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
      this._context.addEventListener?.('statechange', this._onStateChange)
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
    if (this._disabled || this._disposed) return null
    const context = this.ensureContext()
    // Call resume synchronously in the gesture; never wait for a previous resume.
    if (!this.paused) this._requestContextState({ gesture: true })
    try {
      const source = context.createBufferSource()
      source.buffer = context.createBuffer(1, 1, 22050)
      source.connect(this._masterGain)
      source.onended = () => { try { source.disconnect() } catch {} }
      source.start(0)
    } catch {}
    return context
  }
  pause(reason = 'manual') {
    this._pauseReasons.add(reason)
    this._syncMedia()
    this._requestContextState()
    return Promise.resolve(this.inspect())
  }
  resume(reason = 'manual') {
    this._pauseReasons.delete(reason)
    this._requestContextState()
    this._syncMedia()
    return Promise.resolve(this.inspect())
  }
  _requestContextState({ gesture = false } = {}) {
    const context = this._context
    if (!context || this._disposed || context.state === 'closed') return
    const target = this.paused ? 'suspended' : 'running'
    const previous = this._stateCommand
    if (previous?.pending && previous.target === target && !gesture) return
    // A pending opposite command still needs supersession even when the public
    // state has not caught up with the audio rendering thread.
    if (context.state === target && !(previous?.pending && previous.target !== target)) return
    const command = { target, pending: true }
    this._stateCommand = command
    this._stateError = null
    let operation
    try { operation = target === 'running' ? context.resume() : context.suspend() }
    catch (error) { command.pending = false; this._stateError = error.message; return }
    Promise.resolve(operation).then(() => {
      command.pending = false
      if (this._disposed || this._context !== context) return
      this._syncMedia()
      // Reconcile a late OLD completion only. A rejected/denied resume must not
      // recurse into an automatic resume loop while waiting for user activation.
      if (command.target !== (this.paused ? 'suspended' : 'running')) this._requestContextState()
    }, error => {
      command.pending = false
      if (this._stateCommand === command) this._stateError = String(error?.message || error)
    })
  }
  async waitUntilRunning({ signal, timeoutMs = 1800 } = {}) {
    const context = this.ensureContext()
    if (!context) throw Object.assign(new Error('Audio disabled'), { code: 'AUDIO_DISABLED' })
    if (this.paused) throw Object.assign(new Error('Audio paused by an active view'), { code: 'AUDIO_PAUSED' })
    if (context.state === 'running') return context
    this._requestContextState()
    try {
      await withLoadDeadline(taskSignal => new Promise((resolve, reject) => {
        let timer
        const cleanup = () => { clearTimeout(timer); taskSignal.removeEventListener('abort', abort) }
        const abort = () => { cleanup(); reject(taskSignal.reason) }
        const check = () => {
          if (this._disposed || this.paused || context.state === 'closed') { cleanup(); reject(Object.assign(new Error('Audio owner unavailable'), { code: 'AUDIO_PAUSED' })); return }
          if (context.state === 'running') { cleanup(); resolve(); return }
          timer = setTimeout(check, 25)
        }
        taskSignal.addEventListener('abort', abort, { once: true })
        check()
      }), { signal, timeoutMs, label: 'audio-context-running' })
      return context
    } catch (error) {
      if (signal?.aborted || error.code === 'AUDIO_PAUSED') throw error
      throw Object.assign(new Error('请点击语音播放按钮以启用声音。'), { code: 'VOICE_GESTURE_REQUIRED', cause: error })
    }
  }
  currentTime() {
    if (!this._context) return this._logicalOffset
    return this._logicalOffset + Math.max(0, (Number(this._context.currentTime) || 0) - this._logicalEpoch) * this._rate
  }
  setRate(value) {
    const rate = assertRate(value)
    if (this._context) { this._logicalOffset = this.currentTime(); this._logicalEpoch = Number(this._context.currentTime) || 0 }
    this._rate = rate
    for (const source of this._sources.keys()) if (source.playbackRate) source.playbackRate.value = rate
    for (const record of this._media.values()) record.element.playbackRate = rate
    return rate
  }
  registerSource(source, { bus = 'unknown', kind = 'source', cue = null } = {}) {
    if (!source || typeof source !== 'object') throw new TypeError('source is required')
    this.ensureContext()
    if (source.playbackRate) source.playbackRate.value = this._rate
    this._sources.set(source, Object.freeze({ bus: BUS_NAMES.includes(bus) ? bus : 'unknown',
      kind: String(kind || 'source'), cue: cue == null ? null : String(cue), registered_at: this.currentTime() }))
    return () => this._sources.delete(source)
  }
  /** Media element time must be paused too: suspending only WebAudio mutes its
   * output but does not establish ownership of the element's playback clock. */
  registerMediaElement(element, { cue, onFailure = () => {} } = {}) {
    const record = { element, cue, onFailure, pausedBySession: false, resumePending: false, registered_at: this.currentTime() }
    element.playbackRate = this._rate
    this._media.set(element, record)
    this._syncMedia()
    return () => { this._media.delete(element); element.pause() }
  }
  _syncMedia() {
    for (const record of this._media.values()) {
      const { element } = record
      if (this._disposed || this.paused || this._context?.state !== 'running') {
        record.pausedBySession = true
        element.pause()
      } else if (record.pausedBySession && !record.resumePending && !element.ended) {
        record.pausedBySession = false
        record.resumePending = true
        let play
        try { play = element.play() } catch (error) { play = Promise.reject(error) }
        Promise.resolve(play).catch(error => {
          if (this._media.get(element) === record) record.onFailure(error)
        }).finally(() => {
          record.resumePending = false
          if (this._media.get(element) !== record) return
          if (this._disposed || this.paused || this._context?.state !== 'running') {
            record.pausedBySession = true
            element.pause()
          }
        })
      }
    }
  }
  inspect() {
    const now = this.currentTime()
    const sources = [...this._sources.values()].map(source => ({ ...source, age: Math.max(0, now - source.registered_at) }))
    for (const record of this._media.values()) sources.push({ bus: 'voice', kind: 'media', cue: record.cue,
      registered_at: record.registered_at, age: Math.max(0, now - record.registered_at) })
    return Object.freeze({ context_state: this._context?.state || 'uninitialized',
      pause_reasons: [...this._pauseReasons], rate: this._rate, active_sources: sources.length,
      sources: Object.freeze(sources), buses: Object.freeze({ ...this._busVolumes }),
      disabled: this._disabled, disposed: this._disposed, release_owner: this._releaseOwner,
      state_command: this._stateCommand && { ...this._stateCommand }, state_error: this._stateError })
  }
  async dispose() {
    if (this._disposed) return
    this._disposed = true
    for (const source of this._sources.keys()) { try { source.stop?.(); source.disconnect?.() } catch {} }
    for (const record of this._media.values()) { try { record.element.pause() } catch {} }
    this._media.clear()
    this._sources.clear()
    this._pauseReasons.clear()
    for (const gain of this._buses.values()) { try { gain.disconnect() } catch {} }
    this._buses.clear()
    try { this._masterGain?.disconnect() } catch {}
    this._masterGain = null
    const context = this._context
    this._context = null
    context?.removeEventListener?.('statechange', this._onStateChange)
    // Do NOT await a pending resume. close is a separate, bounded native operation.
    try {
      if (context && context.state !== 'closed') await withLoadDeadline(() => context.close(), {
        timeoutMs: this._closeTimeoutMs, label: 'audio-context-close',
      })
      if (context && this._releaseOwner === 'story-player') storyReleaseProbe.audioContextClosed()
    } catch (error) {
      if (context && this._releaseOwner === 'story-player') storyReleaseProbe.audioContextCloseFailed()
      throw error
    } finally { this._releaseSession?.(); this._releaseSession = null }
  }
}
export { BUS_NAMES as STORY_AUDIO_BUSES }
