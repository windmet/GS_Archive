import assert from 'node:assert/strict'
import { createCompressedVoiceCache } from '../src/core/CompressedVoiceCache.js'

const audio = (etag = null, length = 2000, control = 'max-age=60', age = '0') => new Response(new Uint8Array(length), {
  headers: { 'content-type': 'audio/mp4', 'cache-control': control, age, ...(etag ? { etag } : {}) },
})

{
  const calls = []
  let clock = 0
  const cache = createCompressedVoiceCache({ now: () => clock, fetchImpl: async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', cache: options.cache })
    return audio('v1')
  } })
  const first = await cache.get('/assets/voice/a.m4a')
  const second = await cache.get('/assets/voice/a.m4a')
  assert.deepEqual(calls, [{ url: '/assets/voice/a.m4a', method: 'GET', cache: 'default' }])
  assert.notEqual(first, second)
  new Uint8Array(first)[0] = 255
  assert.equal(new Uint8Array(second)[0], 0, 'decoder cannot mutate retained bytes')
  clock = 60001
  await cache.get('/assets/voice/a.m4a')
  assert.equal(calls.length, 2, 'stale memory delegates validation to browser HTTP cache')
  assert.deepEqual(calls[0], calls[1], 'stable GET without HEAD or cache-busting query')
  cache.clear()
  assert.deepEqual(cache.inspect(), { entries: 0, bytes: 0, flights: 0 })
}

for (const control of ['', 'no-store, max-age=600', 'max-age=60, no-cache']) {
  let gets = 0
  const cache = createCompressedVoiceCache({ fetchImpl: async () => { gets++; return audio('v1', 2000, control) } })
  await cache.get('/mutable.m4a'); await cache.get('/mutable.m4a')
  assert.equal(gets, 2, `no unvalidated memory reuse: ${control}`)
  assert.equal(cache.inspect().entries, 0)
}

{
  let gets = 0
  const cache = createCompressedVoiceCache({ fetchImpl: async () => { gets++; return audio('v1', 2000, 'max-age=60', '61') } })
  await cache.get('/aged.m4a'); await cache.get('/aged.m4a')
  assert.equal(gets, 2, 'Age header prevents extending server freshness')
}

{
  const gets = new Map()
  const cache = createCompressedVoiceCache({ maxBytes: 4000, maxEntries: 2, fetchImpl: async url => {
    gets.set(url, (gets.get(url) || 0) + 1)
    return audio('same')
  } })
  await cache.get('/a.m4a'); await cache.get('/b.m4a'); await cache.get('/a.m4a'); await cache.get('/c.m4a')
  assert.equal(cache.inspect().bytes, 4000)
  await cache.get('/b.m4a')
  assert.equal(gets.get('/b.m4a'), 2, 'LRU is bounded')
}

{
  let release
  let gets = 0
  const pending = new Promise(resolve => { release = resolve })
  const cache = createCompressedVoiceCache({ fetchImpl: async () => { gets++; await pending; return audio('v1') } })
  const firstController = new AbortController()
  const first = cache.get('/shared.m4a', { signal: firstController.signal })
  const second = cache.get('/shared.m4a')
  assert.equal(gets, 1, 'simultaneous owners share one network flight')
  firstController.abort()
  await assert.rejects(first)
  release()
  const result = await second
  assert.equal(result.byteLength, 2000, 'one cancelled owner does not abort another owner')
  assert.equal(cache.inspect().flights, 0)
}

{
  let underlyingAborted = false
  const cache = createCompressedVoiceCache({ fetchImpl: (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => { underlyingAborted = true; reject(signal.reason) }, { once: true })
  }) })
  const controller = new AbortController()
  const load = cache.get('/abandoned.m4a', { signal: controller.signal })
  controller.abort()
  await assert.rejects(load)
  assert.equal(underlyingAborted, true, 'last owner leaving aborts the shared request')
  assert.equal(cache.inspect().flights, 0)
}

{
  const cache = createCompressedVoiceCache({ fetchImpl: async () => new Response('<html>' + 'x'.repeat(2000), {
    headers: { 'content-type': 'text/html' },
  }) })
  await assert.rejects(cache.get('/fallback.m4a'), /Not an audio file/)
  assert.equal(cache.inspect().entries, 0, 'HTML fallback is never retained as voice')
}

console.log('Compressed voice cache: HTTP freshness, stable GET, copies, LRU budget, in-flight sharing, cancellation and HTML rejection passed')
