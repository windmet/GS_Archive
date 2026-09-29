import test from 'node:test'
import assert from 'node:assert/strict'
import { waitForSignal, createLoadTimeout, attachOptionalResource } from '../src/core/AsyncLoadBoundary.js'
const sleep = ms => new Promise(r => setTimeout(r, ms))

test('caller cancellation wins even when work ignores AbortSignal', async () => {
  const c = new AbortController()
  const p = waitForSignal(new Promise(() => {}), c.signal)
  c.abort(createLoadTimeout('decode', 20))
  await assert.rejects(p, e => e.code === 'LOAD_TIMEOUT' && e.phase === 'decode')
})
test('an already aborted consumer still observes a late work rejection', async () => {
  const c = new AbortController(); c.abort(new Error('left'))
  await assert.rejects(waitForSignal(Promise.reject(new Error('late failure')), c.signal), /left/)
})
test('optional timeout does not reject its owner or apply data', async () => {
  let applied = 0, failed = 0
  const job = attachOptionalResource({ load: () => new Promise(() => {}), apply: () => applied++, onFailure: () => failed++, timeoutMs: 8 })
  await job.done
  assert.equal(applied, 0); assert.equal(failed, 1)
})
test('cancelled late optional result cannot mutate the next step', async () => {
  let release, applied = 0, failed = 0
  const job = attachOptionalResource({ load: () => new Promise(r => { release = r }), apply: () => applied++, onFailure: () => failed++ })
  await sleep(0); job.cancel(); release({ curve: 'old' }); await job.done
  assert.equal(applied, 0); assert.equal(failed, 0)
})
test('same-owner optional result attaches without recreating readiness', async () => {
  const seen = []
  const job = attachOptionalResource({ load: async () => 7, apply: value => seen.push(value), isCurrent: () => true })
  await job.done; assert.deepEqual(seen, [7])
})
test('changed ownership drops a successful optional result', async () => {
  const job = attachOptionalResource({ load: async () => 1, isCurrent: () => false, apply: () => assert.fail('old owner') })
  await job.done
})
