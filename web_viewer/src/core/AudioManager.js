/**
 * AudioManager — SE, ambient, BGM playback for StoryViewer.
 *
 * Uses a separate AudioContext from voice playback to avoid gain conflicts.
 * Call ensureContext() on user gesture to comply with browser autoplay policy.
 * OGG format — compatible with Chrome/Firefox/Edge; Safari skips silently.
 */
import { getSeUrl, getAmbientUrl, getBgmUrl } from '../utils/AssetResolver.js'

export class AudioManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null

    // Master gain — all non-voice audio flows through this
    this._masterGain = null

    // BGM
    this._bgmSource = null
    this._bgmGain = null

    // Ambient
    this._ambientSource = null
    this._ambientGain = null

    // Cue cache: currently playing cue names (for dedup)
    this._currentBgmCue = null
    this._currentAmbientCue = null
  }

  /** Create or resume AudioContext. Call on user gesture. */
  ensureContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)()
      this._masterGain = this._ctx.createGain()
      this._masterGain.gain.value = 0.7
      this._masterGain.connect(this._ctx.destination)
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume()
    }
  }

  // ── SE (one-shot) ──

  /** Play a one-shot SE. Multiple SE can overlap. */
  async playSE(cueName) {
    if (!cueName) return
    this.ensureContext()
    try {
      const resp = await fetch(getSeUrl(cueName))
      if (!resp.ok) return
      const ab = await resp.arrayBuffer()
      const audioBuf = await this._ctx.decodeAudioData(ab)
      const source = this._ctx.createBufferSource()
      source.buffer = audioBuf
      const gain = this._ctx.createGain()
      gain.gain.value = 0.6
      source.connect(gain).connect(this._masterGain)
      source.start(0)
      source.onended = () => { source.disconnect(); gain.disconnect() }
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
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
      setTimeout(() => {
        try { oldSource.stop() } catch (_) {}
        oldSource.disconnect()
        oldGain.disconnect()
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
      gain.gain.value = 0
      gain.gain.linearRampToValueAtTime(targetVolume, this._ctx.currentTime + fadeTime)

      source.connect(gain).connect(this._masterGain)
      source.start(0)

      this._ambientSource = source
      this._ambientGain = gain
    } catch (_) {
      this._currentAmbientCue = null
    }
  }

  setAmbientVolume(volume) {
    if (!this._ambientGain) return
    const vol = (volume != null && volume !== '') ? parseFloat(volume) : 0.4
    if (!isNaN(vol)) {
      this._ambientGain.gain.linearRampToValueAtTime(
        Math.max(0, Math.min(1, vol)),
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
    gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
    setTimeout(() => {
      try { source.stop() } catch (_) {}
      source.disconnect()
      gain.disconnect()
    }, fadeTime * 1000 + 200)
    this._ambientSource = null
    this._ambientGain = null
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
      oldGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fadeTime)
      setTimeout(() => {
        try { oldSource.stop() } catch (_) {}
        oldSource.disconnect()
        oldGain.disconnect()
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

      source.connect(gain).connect(this._masterGain)
      source.start(0)

      this._bgmSource = source
      this._bgmGain = gain
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
    gain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + fade)
    setTimeout(() => {
      try { source.stop() } catch (_) {}
      source.disconnect()
      gain.disconnect()
    }, fade * 1000 + 200)
    this._bgmSource = null
    this._bgmGain = null
  }

  /** Dispose — stop all audio and close the AudioContext. */
  dispose() {
    this._currentBgmCue = null
    this._currentAmbientCue = null
    // Stop sources synchronously
    try { this._bgmSource?.stop() } catch (_) {}
    try { this._ambientSource?.stop() } catch (_) {}
    this._bgmSource?.disconnect()
    this._ambientSource?.disconnect()
    this._bgmGain?.disconnect()
    this._ambientGain?.disconnect()
    this._masterGain?.disconnect()
    this._bgmSource = null
    this._ambientSource = null
    this._bgmGain = null
    this._ambientGain = null
    this._masterGain = null
    if (this._ctx) {
      this._ctx.close().catch(() => {})
      this._ctx = null
    }
  }
}
