export const tick = () => new Promise(resolve => setTimeout(resolve, 0))
export function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
export async function until(predicate, ms = 1000) {
  const end = Date.now() + ms
  while (!predicate()) {
    if (Date.now() >= end) throw new Error('Test condition timed out')
    await tick()
  }
}
export class FakeNode {
  constructor() { this.connections = []; this.playbackRate = { value: 1 }; this.gain = { value: 1, setValueAtTime(v) { this.value = v } }; this.stopped = false }
  connect(node) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true }
  start() { this.started = true }
  stop() { this.stopped = true }
}
export class FakeAudioContext extends EventTarget {
  constructor({ state = 'running', decode } = {}) {
    super(); this.state = state; this.currentTime = 0; this.destination = new FakeNode(); this.sources = []
    this.decode = decode; this.resumeCount = 0; this.suspendCount = 0; this.closeCount = 0; this.mediaSources = 0
  }
  setState(state) { this.state = state; this.dispatchEvent(new Event('statechange')) }
  createGain() { return new FakeNode() }
  createBuffer() { return {} }
  createBufferSource() { const node = new FakeNode(); this.sources.push(node); return node }
  createMediaElementSource() { this.mediaSources++; return new FakeNode() }
  async decodeAudioData(bytes) { return this.decode ? this.decode(bytes) : { duration: 2, length: 96000, numberOfChannels: 1, sampleRate: 48000 } }
  async resume() { this.resumeCount++; this.setState('running') }
  async suspend() { this.suspendCount++; this.setState('suspended') }
  async close() { this.closeCount++; this.setState('closed') }
}
export class FakeAudioElement extends EventTarget {
  constructor() { super(); this.paused = true; this.currentTime = 0; this.duration = 2; this.readyState = 4; this.networkState = 1; this.playCount = 0; this.volume = 1; this.muted = false; this.ended = false }
  async play() { this.playCount++; if (this.failure) throw this.failure; this.paused = false; this.dispatchEvent(new Event('playing')) }
  pause() { this.paused = true }
  removeAttribute(name) { if (name === 'src') { this.src = ''; this.currentTime = 0 } }
  load() {}
}
export const emptyLipStore = () => ({ load: async () => null, clear() {}, inspect: () => ({ entries: 0, samples: 0 }) })
export const fakeVoiceCache = () => ({ calls: 0, async get(url, { onDiagnostics }) {
  this.calls++; onDiagnostics?.({ url, status: 200, contentType: 'audio/mp4', bytes: 2048, cache: 'http' }); return new ArrayBuffer(2048)
}, inspect: () => ({ entries: 0, bytes: 0, flights: 0 }) })
