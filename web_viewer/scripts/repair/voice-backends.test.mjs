import test from 'node:test'
import assert from 'node:assert/strict'
import { useVoicePlayer } from '../../src/core/useVoicePlayer.js'
import { StoryAudioSession } from '../../src/core/story-runtime/StoryAudioSession.js'
import { FakeAudioContext, FakeAudioElement, fakeVoiceCache, emptyLipStore, deferred, tick, until } from './helpers.mjs'
function setup({ decode, backendMode = 'auto', lipStore, createAudio } = {}) {
  const context = new FakeAudioContext({ decode }), element = new FakeAudioElement(), cache = fakeVoiceCache()
  const session = new StoryAudioSession({ contextFactory: () => context })
  const step = { value: { chara_id: '047shu', dialogue: { voice: 'one.m4a' } } }, index = { value: 0 }, playing = { value: false }
  const player = useVoicePlayer({ spineStageRef: { value: null }, currentStep: step, currentStepIndex: index,
    compiledData: { value: { scenario_id: 'fixture' } }, isPlaying: playing, audioSession: session,
    voiceCache: cache, backendMode, lipStore: lipStore || emptyLipStore(), createAudio: createAudio || (() => element),
    decodeTimeoutMs: 20, voiceTimeoutMs: 100, lipTimeoutMs: 20 })
  return { player, context, element, session, step, index, playing, cache, cleanup: async () => { player.dispose(); await session.dispose() } }
}
test('normal buffer path remains fast and decoded replay reuses PCM', async () => {
  const t = setup()
  assert.equal(await t.player.playVoice(), true)
  assert.equal(t.player.getDiagnostics().attempt.backend, 'webaudio')
  assert.equal(await t.player.retryVoice(), true)
  assert.equal(t.cache.calls, 1)
  assert.equal(t.session.inspect().active_sources, 1)
  await t.cleanup()
})
test('decoder error falls back to the same URL media backend', async () => {
  const t = setup({ decode: async () => { throw new DOMException('AAC decode failed', 'EncodingError') } })
  assert.equal(await t.player.playVoice(), true)
  assert.equal(t.player.getDiagnostics().attempt.backend, 'media')
  assert.equal(t.element.src, '/assets/voice/fixture_one.m4a')
  assert.equal(t.context.mediaSources, 1)
  assert.equal(t.session.inspect().active_sources, 1)
  await t.player.retryVoice()
  assert.equal(t.context.mediaSources, 1, 'element source is created once, not once per retry')
  await t.cleanup()
})
test('decoder timeout falls back; a late PCM buffer cannot start a second voice', async () => {
  const decoder = deferred(), t = setup({ decode: () => decoder.promise })
  assert.equal(await t.player.playVoice(), true)
  assert.equal(t.element.paused, false)
  decoder.resolve({ duration: 2, length: 96000, numberOfChannels: 1 }); await tick()
  assert.equal(t.context.sources.length, 0)
  assert.equal(t.session.inspect().active_sources, 1)
  await t.cleanup()
})
test('network error does not masquerade as a codec failure; manual compatibility is explicit', async () => {
  const t = setup(); t.cache.get = async () => { throw new TypeError('Failed to fetch') }
  assert.equal(await t.player.playVoice(), false)
  assert.equal(t.element.playCount, 0)
  assert.equal(t.player.getDiagnostics().lastFailure.phase, 'fetch-or-prepare')
  const result = t.player.retryVoice({ backend: 'media' })
  assert.equal(t.element.playCount, 1, 'native play is invoked synchronously in manual retry')
  assert.equal(await result, true)
  await t.cleanup()
})
test('NotAllowedError is actionable, not reported as playing or retried forever', async () => {
  const t = setup({ backendMode: 'media' }); t.element.failure = new DOMException('gesture required', 'NotAllowedError')
  assert.equal(await t.player.playVoice(), false)
  assert.equal(t.playing.value, false)
  assert.equal(t.player.getDiagnostics().lastFailure.code, 'VOICE_GESTURE_REQUIRED')
  assert.equal(t.element.playCount, 1)
  t.element.failure = null
  assert.equal(await t.player.retryVoice(), true)
  await t.cleanup()
})
test('stop while native play is pending suppresses the late result', async () => {
  const t = setup({ backendMode: 'media' }), native = deferred()
  t.element.play = () => native.promise
  const pending = t.player.playVoice(); await tick()
  t.player.stopCurrentVoice('next-step')
  native.resolve(); assert.equal(await pending, false)
  assert.equal(t.playing.value, false)
  assert.equal(t.session.inspect().active_sources, 0)
  await t.cleanup()
})
test('optional lip starts in parallel, never blocks sound, and is cancelled on stop', async () => {
  let lipStarted = false, aborted = false
  const lipStore = { ...emptyLipStore(), load: (_step, { signal }) => new Promise((resolve, reject) => {
    lipStarted = true; signal.addEventListener('abort', () => { aborted = true; reject(signal.reason) })
  }) }
  const t = setup({ lipStore }); assert.equal(await t.player.playVoice(), true)
  assert.equal(lipStarted, true); t.player.stopCurrentVoice(); await tick(); assert.equal(aborted, true)
  await t.cleanup()
})
test('media lip uses actual media time, not the separate audio-context logical clock', async () => {
  const t = setup({ backendMode: 'media', lipStore: { ...emptyLipStore(), load: async () => ({ scales: [{ y: 0 }, { y: 1 }], gain: 1 }) } })
  await t.player.playVoice(); await tick(); t.element.currentTime = 1; t.context.currentTime = 200
  assert.equal(t.player.getVoiceVolume(), 0.5)
  await t.cleanup()
})
test('backlog audition and closing it leave no source behind', async () => {
  const t = setup({ backendMode: 'media' })
  assert.equal(await t.player.replayVoiceDetached(t.step.value), true)
  t.player.stopCurrentVoice('backlog-close')
  assert.equal(t.session.inspect().active_sources, 0)
  assert.equal(t.element.paused, true)
  await t.cleanup()
})
test('owner disposed during decode discards both fallback and late PCM', async () => {
  const decode = deferred(), t = setup({ decode: () => decode.promise })
  const pending = t.player.prepareVoice(); await tick(); t.player.dispose()
  assert.equal(await pending, null)
  decode.resolve({ duration: 2 }); await tick(); assert.equal(t.element.playCount, 0)
  await t.session.dispose()
})
