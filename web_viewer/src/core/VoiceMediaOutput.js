import { waitForSignal, createLoadTimeout } from './AsyncLoadBoundary.js'

const mediaFailure = (error, element) => Object.assign(new Error(
  error?.message || `Media playback failed (${element.error?.code || 'unknown'})`), {
  code: error?.name === 'NotAllowedError' ? 'VOICE_GESTURE_REQUIRED' : 'VOICE_MEDIA_ERROR',
  mediaCode: element.error?.code || null, cause: error,
})

/** One reusable element and one MediaElementSource per voice owner. No UA sniff,
 * no alternate codec corpus, and no source that can outlive its step. */
export class VoiceMediaOutput {
  constructor(session, { createAudio = () => new Audio(), timeoutMs = 20000 } = {}) {
    this.session = session
    this.createAudio = createAudio
    this.timeoutMs = timeoutMs
    this.element = null
    this.node = null
    this.active = null
  }
  ensureElement() {
    if (!this.element) {
      this.element = this.createAudio()
      this.element.crossOrigin = 'anonymous'
      this.element.preload = 'auto'
      this.element.playsInline = true
      this.node = this.session.ensureContext().createMediaElementSource(this.element)
      this.node.connect(this.session.getBus('voice'))
    }
    return this.element
  }
  start(url, { signal, cue, onEnded = () => {}, onFailure = () => {}, onState = () => {} } = {}) {
    this.stop()
    signal?.throwIfAborted()
    const element = this.ensureElement()
    const owner = { element, timer: null, cleanup: null, release: null }
    this.active = owner
    const current = () => this.active === owner && !signal?.aborted
    let rejectStart, resolveStart
    const ready = new Promise(resolve => { resolveStart = resolve })
    const failed = new Promise((_, reject) => { rejectStart = reject })
    const clearWatchdog = () => { clearTimeout(owner.timer); owner.timer = null }
    const fail = error => {
      if (!current()) return
      // A deliberate page/visibility pause may interrupt play(). It is not a
      // decoder failure, and the session will resume this same element later.
      if (error?.name === 'AbortError' && (this.session.paused || this.session.context?.state !== 'running')) return
      const failure = error?.code ? error : mediaFailure(error, element)
      rejectStart(failure)
      this.stop()
      onFailure(failure)
    }
    const watchdog = () => {
      clearWatchdog()
      if (this.session.paused || this.session.context?.state !== 'running') return
      owner.timer = setTimeout(() => fail(createLoadTimeout('voice-media-start-or-buffer', this.timeoutMs)), this.timeoutMs)
    }
    const ended = () => { if (!current()) return; this.stop(); onEnded() }
    const waiting = () => { if (current()) { onState('preparing'); if (owner.timer == null) watchdog() } }
    const playing = () => {
      if (!current()) return
      clearWatchdog()
      if (this.session.paused) element.pause()
      else { onState('playing'); resolveStart(true) }
    }
    const paused = () => { if (this.session.paused || this.session.context?.state !== 'running') clearWatchdog() }
    const resuming = () => { if (current() && owner.timer == null) watchdog() }
    const error = () => fail(mediaFailure(null, element))
    const abort = () => { if (this.active === owner) this.stop() }
    for (const [event, handler] of [['ended', ended], ['waiting', waiting], ['stalled', waiting], ['playing', playing], ['pause', paused], ['play', resuming], ['error', error]]) element.addEventListener(event, handler)
    signal?.addEventListener('abort', abort, { once: true })
    owner.cleanup = () => {
      clearWatchdog()
      signal?.removeEventListener('abort', abort)
      for (const [event, handler] of [['ended', ended], ['waiting', waiting], ['stalled', waiting], ['playing', playing], ['pause', paused], ['play', resuming], ['error', error]]) element.removeEventListener(event, handler)
      rejectStart(new DOMException('Voice source stopped', 'AbortError'))
    }
    owner.release = this.session.registerMediaElement(element, { cue, onFailure: fail })
    element.muted = false
    element.volume = 1
    element.loop = false
    element.src = url
    watchdog()
    let play
    // Keep the actual play() invocation synchronous with callers' retry gesture.
    try { play = element.play() } catch (failure) { play = Promise.reject(failure) }
    Promise.resolve(play).then(playing, fail)
    return waitForSignal(Promise.race([ready, failed]), signal).then(() => {
      if (!current()) return false
      clearWatchdog()
      if (this.session.paused || this.session.context?.state !== 'running') element.pause()
      return true
    }, failure => {
      if (current()) { this.stop(); throw failure?.code ? failure : mediaFailure(failure, element) }
      throw failure
    })
  }
  currentTime() { return this.active ? Number(this.element.currentTime) || 0 : 0 }
  duration() { return Number.isFinite(this.element?.duration) ? this.element.duration : null }
  stop() {
    const owner = this.active
    if (!owner) return
    this.active = null
    owner.cleanup?.()
    owner.release?.()
    owner.element.pause()
    owner.element.removeAttribute('src')
    owner.element.load()
  }
  inspect() {
    const element = this.element
    return element ? { active: Boolean(this.active), currentTime: element.currentTime, duration: this.duration(),
      readyState: element.readyState, networkState: element.networkState, paused: element.paused,
      muted: element.muted, volume: element.volume, mediaError: element.error?.code || null } : null
  }
  dispose() { this.stop(); this.node?.disconnect(); this.node = null; this.element = null }
}
