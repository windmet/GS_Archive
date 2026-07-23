import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { StoryAudioSession } from '../src/core/story-runtime/StoryAudioSession.js'
import { useVoicePlayer } from '../src/core/useVoicePlayer.js'
import { AudioManager } from '../src/core/AudioManager.js'

class FakeAudioParam {
  constructor(value = 1) { this.value = value }
  setValueAtTime(value) { this.value = value }
  linearRampToValueAtTime(value) { this.value = value }
}

class FakeNode {
  constructor() {
    this.connections = []
    this.disconnected = false
  }
  connect(node) { this.connections.push(node); return node }
  disconnect() { this.disconnected = true }
}

class FakeGain extends FakeNode {
  constructor() { super(); this.gain = new FakeAudioParam() }
}

class FakeSource extends FakeNode {
  constructor() {
    super()
    this.playbackRate = new FakeAudioParam()
    this.started = false
    this.stopped = false
  }
  start() { this.started = true }
  stop() { this.stopped = true; this.onended?.() }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 0
    this.state = 'suspended'
    this.destination = new FakeNode()
    this.gains = []
    this.sources = []
    this.closeCount = 0
  }
  createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain }
  createBuffer() { return {} }
  createBufferSource() { const source = new FakeSource(); this.sources.push(source); return source }
  async decodeAudioData() { return {} }
  async resume() { this.state = 'running' }
  async suspend() { this.state = 'suspended' }
  async close() { this.state = 'closed'; this.closeCount++ }
}

let contextFactoryCalls = 0
const context = new FakeAudioContext()
const session = new StoryAudioSession({
  contextFactory: () => { contextFactoryCalls++; return context },
  masterVolume: 0.8,
  busVolumes: { bgm: 0.7, ambient: 0.6, voice: 1, se: 0.5 },
})

assert.equal(session.ensureContext(), context)
assert.equal(session.ensureContext(), context)
assert.equal(contextFactoryCalls, 1, 'one story session must create exactly one AudioContext')
assert.equal(context.gains.length, 5, 'master plus four named buses must be created')
assert.deepEqual(session.inspect().buses, { bgm: 0.7, ambient: 0.6, voice: 1, se: 0.5 })

session.unlockFromUserGesture()
await Promise.resolve()
assert.equal(context.state, 'running')
assert.equal(context.sources.length, 1, 'unlock must schedule one silent source')

const voiceSource = new FakeSource()
const seSource = new FakeSource()
const releaseVoice = session.registerSource(voiceSource, { bus: 'voice', kind: 'dialogue', cue: 'voice-a' })
session.registerSource(seSource, { bus: 'se', kind: 'one-shot', cue: 'cloth' })
assert.equal(session.inspect().active_sources, 2)
assert.deepEqual(session.inspect().sources.map(({ bus, kind, cue }) => ({ bus, kind, cue })), [
  { bus: 'voice', kind: 'dialogue', cue: 'voice-a' },
  { bus: 'se', kind: 'one-shot', cue: 'cloth' },
])

context.currentTime = 2
assert.equal(session.currentTime(), 2)
session.setRate(2)
context.currentTime = 3
assert.equal(session.currentTime(), 4, 'logical audio time must integrate the active rate')
assert.equal(voiceSource.playbackRate.value, 2)
assert.equal(seSource.playbackRate.value, 2)

await session.pause('overlay')
await session.pause('visibility')
assert.equal(context.state, 'suspended')
await session.resume('overlay')
assert.equal(context.state, 'suspended', 'remaining pause reasons must keep the context suspended')
await session.resume('visibility')
assert.equal(context.state, 'running')

releaseVoice()
releaseVoice()
assert.equal(session.inspect().active_sources, 1, 'source release must be idempotent')
assert.equal(session.setBusVolume('se', 0.25), 0.25)
assert.equal(session.inspect().buses.se, 0.25)

await session.dispose()
await session.dispose()
assert.equal(context.closeCount, 1, 'dispose must close the shared context exactly once')
assert.equal(session.inspect().disposed, true)

const voiceContext = new FakeAudioContext()
voiceContext.state = 'running'
const voiceSession = new StoryAudioSession({ contextFactory: () => voiceContext })
const playing = { value: false }
const voicePlayer = useVoicePlayer({
  spineStageRef: { value: null },
  currentStep: { value: {} },
  currentStepIndex: { value: 0 },
  compiledData: { value: {} },
  isPlaying: playing,
  audioSession: voiceSession,
})
const prepared = { voice: 'voice-a', audioBuffer: {}, step: { chara_id: null } }
voicePlayer.playPreparedVoice(prepared)
const firstVoiceSource = voiceContext.sources.at(-1)
voicePlayer.playPreparedVoice({ ...prepared, voice: 'voice-b' })
firstVoiceSource.onended?.()
assert.equal(voiceSession.inspect().active_sources, 1, 'an old onended callback must not release the new voice source')
assert.equal(playing.value, true, 'an old onended callback must not mark the new voice as ended')
await voicePlayer.playVoice()
assert.equal(voiceSession.inspect().active_sources, 0, 'entering a step without voice must stop the previous dialogue source')
assert.equal(voicePlayer.getVoiceState(), 'idle')
voicePlayer.dispose()
await voiceSession.dispose()

class FakeTimerQueue {
  constructor() { this.nextId = 1; this.callbacks = new Map() }
  set(callback) { const id = this.nextId++; this.callbacks.set(id, callback); return id }
  clear(id) { this.callbacks.delete(id) }
  flush() {
    const callbacks = [...this.callbacks.values()]
    this.callbacks.clear()
    for (const callback of callbacks) callback()
  }
}

const originalFetch = globalThis.fetch
globalThis.fetch = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
try {
  const soakContext = new FakeAudioContext()
  soakContext.state = 'running'
  const soakSession = new StoryAudioSession({ contextFactory: () => soakContext })
  const timers = new FakeTimerQueue()
  const audioManager = new AudioManager({
    audioSession: soakSession,
    setTimer: callback => timers.set(callback),
    clearTimer: timer => timers.clear(timer),
  })

  for (let index = 0; index < 100; index++) {
    await audioManager.playBgm(`bgm-${index % 3}`, 0.01)
    await audioManager.playAmbient(`ambient-${index % 4}`, 0.01, (index % 10) / 10)
    timers.flush()
    assert.ok(soakSession.inspect().active_sources <= 2, `cycle ${index}: steady-state sources must remain bounded`)
    assert.equal(audioManager.inspect().cleanup_timers, 0, `cycle ${index}: cleanup timers must settle`)

    if (index % 10 === 0) {
      const snapshot = audioManager.captureState()
      audioManager.stopBgm(0.01)
      audioManager.stopAmbient(0.01)
      await audioManager.restoreState(snapshot, { fadeTime: 0.01 })
      timers.flush()
      assert.deepEqual(audioManager.captureState(), snapshot, `cycle ${index}: capture/restore must be exact`)
      assert.ok(soakSession.inspect().active_sources <= 2, `cycle ${index}: restore sources must settle`)
    }

    await soakSession.pause('visibility')
    await soakSession.pause('overlay')
    await soakSession.resume('visibility')
    assert.equal(soakContext.state, 'suspended')
    await soakSession.resume('overlay')
    assert.equal(soakContext.state, 'running')
  }

  const raceContext = new FakeAudioContext()
  raceContext.state = 'running'
  const raceSession = new StoryAudioSession({ contextFactory: () => raceContext })
  const raceManager = new AudioManager({ audioSession: raceSession })
  const pendingResponses = []
  globalThis.fetch = () => new Promise(resolve => pendingResponses.push(resolve))
  const oldBgm = raceManager.playBgm('old-bgm', 0)
  const newBgm = raceManager.playBgm('new-bgm', 0)
  pendingResponses[1]({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  await newBgm
  pendingResponses[0]({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  await oldBgm
  assert.equal(raceManager.captureState().bgm.cue, 'new-bgm', 'late stale BGM load must not replace the newest cue')
  assert.equal(raceSession.inspect().active_sources, 1, 'stale BGM load must not create a source')

  const oldAmbient = raceManager.playAmbient('old-ambient', 0)
  const newAmbient = raceManager.playAmbient('new-ambient', 0)
  pendingResponses[3]({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  await newAmbient
  pendingResponses[2]({ ok: false })
  await oldAmbient
  assert.equal(raceManager.captureState().ambient.cue, 'new-ambient', 'late stale Ambient load must not replace the newest cue')
  assert.equal(raceSession.inspect().active_sources, 2, 'one BGM and one Ambient source must remain')

  audioManager.dispose()
  timers.flush()
  await soakSession.dispose()
  raceManager.dispose()
  await raceSession.dispose()
  assert.equal(soakSession.inspect().active_sources, 0)
  assert.equal(raceSession.inspect().active_sources, 0)
} finally {
  globalThis.fetch = originalFetch
}

const [viewerSource, voicePlayerSource, audioManagerSource] = await Promise.all([
  readFile(new URL('../src/core/StoryViewer.vue', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/useVoicePlayer.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/core/AudioManager.js', import.meta.url), 'utf8'),
])
assert.match(viewerSource, /new StoryAudioSession/)
assert.match(viewerSource, /new AudioManager\(\{ audioSession: storyAudioSession \}\)/)
assert.match(viewerSource, /audioSession: storyAudioSession/)
assert.doesNotMatch(voicePlayerSource, /new \(window\.AudioContext/)
assert.doesNotMatch(audioManagerSource, /new \(window\.AudioContext/)

console.log('Story audio session verification passed.')
console.log('  100-cycle BGM/Ambient crossfade, capture/restore, visibility/overlay pause, stale-load race, bounded sources and timer cleanup covered.')
