/**
 * AudioManager — SE, ambient, BGM playback for StoryViewer.
 *
 * Uses the StoryAudioSession shared by voice playback and Runtime SE.
 * Call ensureContext() on user gesture to comply with browser autoplay policy.
 * OGG format — compatible with Chrome/Firefox/Edge; Safari skips silently.
 */
import { getSeUrl, getAmbientUrl, getBgmUrl } from '../utils/AssetResolver.js'
import { StoryAudioSession } from './story-runtime/StoryAudioSession.js'

export class AudioManager {
  constructor({ audioSession = null } = {}) {
    this._audioSession = audioSession || new StoryAudioSession({
      busVolumes: { bgm: 0.7, ambient: 0.7, voice: 1, se: 0.7 },
    })
    this._ownsAudioSession = !audioSession
    /** @type {AudioContext|null} */
    this._ctx = null

    // BGM
    this._bgmSource = null
    this._bgmGain = null
    this._bgmRelease = null

    // Ambient
    this._ambientSource = null
    this._ambientGain = null
    this._ambientRelease = null

    // Cue cache: currently playing cue names (for dedup)
    this._currentBgmCue = null
    this._currentAmbientCue = null
    this._currentAmbientVolume = 0.4
    this._seBufferCache = new Map()
    this._cleanupTimers = new Set()
  }

  /** Create or resume AudioContext. Call on user gesture. */
  ensureContext() {
    this._ctx = this._audioSession.ensureContext()
    return this._ctx
  }

  _scheduleCleanup(callback, delayMs) {
    const timer = setTimeout(() => {
      this._cleanupTimers.delete(timer)
      callback()
    }, delayMs)
    this._cleanupTimers.add(timer)
    return timer
  }

  // ── SE (one-shot) ──

  async _loadSE(cueName) {
    const cached = this._seBufferCache.get(cueName)
    if (cached) return cached

    const load = (async () => {
      const resp = await fetch(getSeUrl(cueName))
      if (!resp.ok) throw new Error(`SE not found: ${cueName}`)
      const ab = await resp.arrayBuffer()
      return this._ctx.decodeAudioData(ab)
    })()
    this._seBufferCache.set(cueName, load)
    try {
      return await load
    } catch (error) {
      this._seBufferCache.delete(cueName)
      throw error
    }
  }

  /** Decode a delayed cue early so its authored timestamp stays precise. */
  preloadSE(cueName) {
    if (!cueName) return Promise.resolve(null)
    this.ensureContext()
    return this._loadSE(cueName).catch(() => null)
  }

  /** Play a one-shot SE. Multiple SE can overlap. */
  async playSE(cueName) {
    if (!cueName) return
    this.ensureContext()
    try {
      const audioBuf = await this._loadSE(cueName)
      const source = this._ctx.createBufferSource()
      source.buffer = audioBuf
      const gain = this._ctx.createGain()
      gain.gain.value = 0.6
      source.connect(gain).connect(this._audioSession.getBus('se'))
      const release = this._audioSession.registerSource(source)
      source.start(0)
      source.onended = () => { release(); source.disconnect(); gain.disconnect() }
    } catch (_) { /* unknown SE cue — silent skip */ }
  }

  // ── Environmental audio (looping) ──

  /**
   * Play looping ambient audio, cross-fading from previous ambient if any.
   * @param {string} cueName — e.g. "ambi_room", "ambi_tvshow_setting_t"
   * @param {number} [fadeTime=0.5] — crossfade duration in seconds
   * @param {number} [volume] — volume level 0.0-1.0; if omitted, uses default 0.4
   */
  async playAmbient(cueName, fadeTime = 0.5, volume = null) {
    if (!cueName || cueName === this._currentAmbientCue) return
    this.ensureContext()

    // Fade out current ambient
    if (this._ambientSource) {
      const oldGain = this._ambientGain
      const oldSource = this._ambientSource
      const oldRelease = this._ambientRelease
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
      this._scheduleCleanup(() => {
        try { oldSource.stop() } catch (_) {}
        oldSource.disconnect()
        oldGain.disconnect()
        oldRelease?.()
      }, fadeTime * 1000 + 200)
    }

    this._currentAmbientCue = cueName

    try {
      const url = getAmbientUrl(cueName)
      const resp = await fetch(url)
      if (!resp.ok) { this._currentAmbientCue = null; return }
      const ab = await resp.arrayBuffer()
      const audioBuf = await this._ctx.decodeAudioData(ab)

      const source = this._ctx.createBufferSource()
      source.loop = true
      source.buffer = audioBuf

      const gain = this._ctx.createGain()
      const targetVolume = (volume != null) ? volume : 0.4
      this._currentAmbientVolume = Math.max(0, Math.min(1, Number(targetVolume) || 0))
      gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(this._currentAmbientVolume, this._ctx.currentTime + fadeTime)

      source.connect(gain).connect(this._audioSession.getBus('ambient'))
      const release = this._audioSession.registerSource(source)
      source.start(0)

      this._ambientSource = source
      this._ambientGain = gain
      this._ambientRelease = release
    } catch (_) {
      this._currentAmbientCue = null
    }
  }

  setAmbientVolume(volume) {
    if (!this._ambientGain) return
    const vol = (volume != null && volume !== '') ? parseFloat(volume) : 0.4
    if (!isNaN(vol)) {
      this._currentAmbientVolume = Math.max(0, Math.min(1, vol))
      this._ambientGain.gain.linearRampToValueAtTime(
        this._currentAmbientVolume,
        this._ctx.currentTime + 0.3
      )
    }
  }

  /** Stop ambient with optional fade. */
  stopAmbient(fadeTime = 0.5) {
    if (!this._ambientSource) return
    this._currentAmbientCue = null
    const gain = this._ambientGain
    const source = this._ambientSource
    const release = this._ambientRelease
    gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
    this._scheduleCleanup(() => {
      try { source.stop() } catch (_) {}
      source.disconnect()
      gain.disconnect()
      release?.()
    }, fadeTime * 1000 + 200)
    this._ambientSource = null
    this._ambientGain = null
    this._ambientRelease = null
  }

  // ── BGM (looping) ──

  /**
   * Play looping BGM, cross-fading from previous BGM if any.
   * @param {string} bgmId
   * @param {number} [fadeTime=1.0]
   */
  async playBgm(bgmId, fadeTime = 1.0) {
    if (!bgmId || bgmId === this._currentBgmCue) return
    this.ensureContext()

    // Fade out current BGM
    if (this._bgmSource) {
      const oldGain = this._bgmGain
      const oldSource = this._bgmSource
      const oldRelease = this._bgmRelease
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
      this._scheduleCleanup(() => {
        try { oldSource.stop() } catch (_) {}
        oldSource.disconnect()
        oldGain.disconnect()
        oldRelease?.()
      }, fadeTime * 1000 + 200)
    }

    this._currentBgmCue = bgmId

    try {
      const url = getBgmUrl(bgmId)
      const resp = await fetch(url)
      if (!resp.ok) { this._currentBgmCue = null; return }
      const ab = await resp.arrayBuffer()
      const audioBuf = await this._ctx.decodeAudioData(ab)

      const source = this._ctx.createBufferSource()
      source.loop = true
      source.buffer = audioBuf

      const gain = this._ctx.createGain()
      gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(0.5, this._ctx.currentTime + fadeTime)

      source.connect(gain).connect(this._audioSession.getBus('bgm'))
      const release = this._audioSession.registerSource(source)
      source.start(0)

      this._bgmSource = source
      this._bgmGain = gain
      this._bgmRelease = release
    } catch (_) {
      this._currentBgmCue = null
    }
  }

  /** Stop BGM with optional fade. */
  stopBgm(fadeTime = 1.0) {
    if (!this._bgmSource) return
    this._currentBgmCue = null
    const fade = (fadeTime != null) ? fadeTime : 1.0
    const gain = this._bgmGain
    const source = this._bgmSource
    const release = this._bgmRelease
    gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fade)
    this._scheduleCleanup(() => {
      try { source.stop() } catch (_) {}
      source.disconnect()
      gain.disconnect()
      release?.()
    }, fade * 1000 + 200)
    this._bgmSource = null
    this._bgmGain = null
    this._bgmRelease = null
  }

  captureState() {
    return Object.freeze({
      bgm: this._currentBgmCue ? Object.freeze({ cue: this._currentBgmCue }) : null,
      ambient: this._currentAmbientCue
        ? Object.freeze({ cue: this._currentAmbientCue, volume: this._currentAmbientVolume })
        : null,
    })
  }

  async restoreState(snapshot = {}, { fadeTime = 0.1 } = {}) {
    const bgm = snapshot?.bgm
    const ambient = snapshot?.ambient
    if (bgm?.cue) await this.playBgm(bgm.cue, fadeTime)
    else this.stopBgm(fadeTime)
    if (ambient?.cue) await this.playAmbient(ambient.cue, fadeTime, ambient.volume)
    else this.stopAmbient(fadeTime)
    return this.captureState()
  }

  /** Dispose — stop all audio and close the AudioContext. */
  dispose() {
    this._currentBgmCue = null
    this._currentAmbientCue = null
    // Stop sources synchronously
    try { this._bgmSource?.stop() } catch (_) {}
    try { this._ambientSource?.stop() } catch (_) {}
    this._bgmRelease?.()
    this._ambientRelease?.()
    this._bgmSource?.disconnect()
    this._ambientSource?.disconnect()
    this._bgmGain?.disconnect()
    this._ambientGain?.disconnect()
    for (const timer of this._cleanupTimers) clearTimeout(timer)
    this._cleanupTimers.clear()
    this._bgmSource = null
    this._ambientSource = null
    this._bgmGain = null
    this._ambientGain = null
    this._bgmRelease = null
    this._ambientRelease = null
    this._seBufferCache.clear()
    this._ctx = null
    if (this._ownsAudioSession) this._audioSession.dispose().catch(() => {})
  }
}
