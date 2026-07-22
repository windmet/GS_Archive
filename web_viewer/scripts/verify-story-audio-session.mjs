import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { StoryAudioSession } from '../src/core/story-runtime/StoryAudioSession.js'
import { useVoicePlayer } from '../src/core/useVoicePlayer.js'

class FakeAudioParam {
  constructor(value = 1) { this.value = value }
  setValueAtTime(value) { this.value = value }
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
  }
  start() { this.started = true }
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
const releaseVoice = session.registerSource(voiceSource)
session.registerSource(seSource)
assert.equal(session.inspect().active_sources, 2)

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
voicePlayer.dispose()
await voiceSession.dispose()

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
