import test from 'node:test'
import assert from 'node:assert/strict'
import { StoryAudioSession } from '../../src/core/story-runtime/StoryAudioSession.js'
import { setStoryRuntimePaused } from '../../src/core/story-runtime/StoryPausePolicy.js'
import { FakeAudioContext, FakeAudioElement, deferred, tick } from './helpers.mjs'

test('pending autoplay resume cannot block pause or disposal', async () => {
  const context = new FakeAudioContext({ state: 'suspended' }), grant = deferred()
  context.resume = () => { context.resumeCount++; return grant.promise }
  const session = new StoryAudioSession({ contextFactory: () => context })
  session.ensureContext()
  await session.resume('visibility') // Must return without waiting for browser permission.
  await session.pause('visibility')
  assert.equal(context.suspendCount, 1)
  await session.dispose()
  assert.equal(context.closeCount, 1)
  grant.resolve(); await tick()
  assert.equal(context.state, 'closed')
})
test('late old resume is reconciled to the latest paused intent', async () => {
  const context = new FakeAudioContext({ state: 'suspended' }), grant = deferred()
  context.resume = () => grant.promise.then(() => context.setState('running'))
  const session = new StoryAudioSession({ contextFactory: () => context })
  session.ensureContext(); session.resume('visibility'); session.pause('visibility')
  grant.resolve(); await tick()
  assert.equal(context.state, 'suspended')
  await session.dispose()
})
test('backlog/menu/buffering freeze scheduler but permit audible replay and BGM', async () => {
  const context = new FakeAudioContext(), session = new StoryAudioSession({ contextFactory: () => context })
  session.ensureContext()
  const reasons = new Set(), calls = []
  const cues = { pause: () => calls.push('pause'), resume: () => calls.push('resume') }
  for (const reason of ['buffering', 'backlog', 'menu', 'viewing-offer', 'episode-complete']) await setStoryRuntimePaused({ reasons, cues, audioSession: session }, reason, true)
  assert.equal(context.suspendCount, 0)
  assert.deepEqual(calls, ['pause'])
  await setStoryRuntimePaused({ reasons, cues, audioSession: session }, 'visibility', true)
  assert.equal(context.state, 'suspended')
  await session.dispose()
})
test('media clock pauses, rate updates, and released media never resumes', async () => {
  const context = new FakeAudioContext(), element = new FakeAudioElement()
  const session = new StoryAudioSession({ contextFactory: () => context })
  session.ensureContext()
  const release = session.registerMediaElement(element, { cue: 'test' })
  await element.play(); await session.pause('visibility')
  assert.equal(element.paused, true)
  session.setRate(1.5); assert.equal(element.playbackRate, 1.5)
  await session.resume('visibility'); await tick(); assert.equal(element.paused, false)
  release(); const count = element.playCount
  await session.pause('visibility'); await session.resume('visibility'); await tick()
  assert.equal(element.playCount, count)
  assert.equal(session.inspect().active_sources, 0)
  await session.dispose()
})
test('a never-resolving close has a finite failure, not fabricated success', async () => {
  const context = new FakeAudioContext(); context.close = () => new Promise(() => {})
  const session = new StoryAudioSession({ contextFactory: () => context, closeTimeoutMs: 10 })
  session.ensureContext()
  await assert.rejects(session.dispose(), { code: 'LOAD_TIMEOUT' })
  assert.equal(session.inspect().disposed, true)
})
