import assert from 'node:assert/strict'
import { PerformanceRegistry, createPerformanceHandle } from '../src/core/story-runtime/PerformanceRegistry.js'
import { EffectScheduler } from '../src/core/story-runtime/EffectScheduler.js'
import { StoryClock } from '../src/core/story-runtime/StoryClock.js'

const registry = new PerformanceRegistry()
let finishCancel
const old = createPerformanceHandle({ id: 'same-cue', channel: 'camera', blocksAuto: true,
  onCancel: () => new Promise(resolve => { finishCancel = resolve }),
})
registry.register(old)
await old.start()
const cancelling = registry.cancelAll('step-change')
assert.equal(registry.hasBlockingAuto(), false, 'retired step must stop blocking immediately')
const next = createPerformanceHandle({ id: 'same-cue', channel: 'camera', blocksAuto: false })
registry.register(next)
assert.equal(registry.get('same-cue'), next)
finishCancel()
await cancelling
await Promise.resolve()
assert.equal(registry.get('same-cue'), next, 'old completion must not remove new same-ID cue')
assert.equal(registry.getCompleted().filter(item => item.id === 'same-cue').length, 1)
await registry.dispose()

const pendingRegistry = new PerformanceRegistry()
let releaseCleanup
pendingRegistry.register(createPerformanceHandle({ id: 'pending', channel: 'screen',
  onCancel: () => new Promise(resolve => { releaseCleanup = resolve }),
}))
const pending = pendingRegistry.cancelAll()
let disposed = false
const disposal = pendingRegistry.dispose().then(() => { disposed = true })
await Promise.resolve()
assert.equal(disposed, false, 'dispose must wait for detached cleanup')
releaseCleanup()
await Promise.all([pending, disposal])
assert.equal(disposed, true)

const failingRegistry = new PerformanceRegistry()
let releaseOther
failingRegistry.register(createPerformanceHandle({ id: 'failure', channel: 'screen', onCancel: () => { throw new Error('cleanup failed') } }))
failingRegistry.register(createPerformanceHandle({ id: 'other', channel: 'camera', onCancel: () => new Promise(resolve => { releaseOther = resolve }) }))
let cancellationDone = false
const failure = assert.rejects(failingRegistry.cancelAll(), AggregateError).then(() => { cancellationDone = true })
await Promise.resolve()
await Promise.resolve()
assert.equal(cancellationDone, false, 'one failed cleanup must not abandon another pending cleanup')
releaseOther()
await failure
assert.equal(failingRegistry.getActive().length, 0)
await failingRegistry.dispose()

const scheduler = new EffectScheduler({ clock: new StoryClock({ nowMilliseconds: () => 0 }),
  requestFrame: () => 1, cancelFrame: () => {},
})
const cue = { cue_id: 'repeat', channel: 'camera', action: 'camera.transform', at: 0, duration: 10 }
const handlers = new Map([['camera.transform', item => createPerformanceHandle({ id: item.cue_id, channel: item.channel })]])
for (let index = 0; index < 3; index++) {
  scheduler.loadStep([cue], { handlers })
  scheduler.start()
}
await Promise.resolve()
assert.equal(scheduler.registry.getActive().length, 1)
await scheduler.dispose()
console.log('Registry handoff: immediate retirement, same-ID reload, late completion isolation and pending cleanup disposal passed')
