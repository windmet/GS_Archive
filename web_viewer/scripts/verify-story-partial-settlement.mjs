import assert from 'node:assert/strict'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'

for (const paused of [false, true]) {
  let now = 0, id = 0
  const frames = new Map()
  const calls = []
  const scheduler = new EffectScheduler({
    clock: new StoryClock({ nowMilliseconds: () => now }),
    requestFrame: callback => { frames.set(++id, callback); return id },
    cancelFrame: key => frames.delete(key),
  })
  const cues = [
    { cue_id: 'visual', action: 'fixture', channel: 'camera', at: 0, duration: 10, skippable: true },
    { cue_id: 'snapshot', action: 'fixture', channel: 'debug', at: 2, duration: 1, skippable: false },
  ]
  scheduler.loadStep(cues, { handlers: new Map([['fixture', cue => createPerformanceHandle({
    id: cue.cue_id, channel: cue.channel, skippable: cue.skippable,
    onStart: () => calls.push(`start:${cue.cue_id}`),
    onSettle: () => calls.push(`settle:${cue.cue_id}`),
  })]]) })
  scheduler.start()
  await Promise.resolve()
  if (paused) await scheduler.pause()
  await scheduler.settleSkippable()
  assert.deepEqual(calls, ['start:visual', 'settle:visual'])
  assert.equal(scheduler.hasNonSkippable(), true)
  if (paused) {
    assert.equal(frames.size, 0, 'partial settlement must not resume a paused session')
    now = 10000
    assert.equal(scheduler.clock.now(), 0)
    await scheduler.resume()
  }
  assert.equal(frames.size, 1, 'non-skippable event must retain scheduled frames')
  const frame = async () => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback())
    await Promise.resolve()
    await Promise.resolve()
  }
  now += 2000
  await frame()
  assert.deepEqual(calls, ['start:visual', 'settle:visual', 'start:snapshot'])
  now += 1000
  await frame()
  await frame()
  assert.equal(scheduler.hasNonSkippable(), false)
  assert.equal(frames.size, 0)
  await scheduler.dispose()
}
console.log('Partial settlement: non-skippable delayed event survives Skip, pause is preserved and natural completion clears frames')
