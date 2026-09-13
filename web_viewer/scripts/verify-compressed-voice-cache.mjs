import assert from 'node:assert/strict'
import { createCompressedVoiceCache } from '../src/core/CompressedVoiceCache.js'

const audio = (etag = null, length = 2000) => new Response(new Uint8Array(length), {
  headers: { 'content-type': 'audio/mp4', ...(etag ? { etag } : {}) },
})
const head = etag => new Response(null, {
  headers: { 'content-type': 'audio/mp4', etag },
})

{
  const calls = []
  let version = 'v1'
  const cache = createCompressedVoiceCache({ now: () => 123, fetchImpl: async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    return options.method === 'HEAD' ? head(version) : audio(version)
  } })
  const first = await cache.get('/assets/voice/a.m4a')
  const second = await cache.get('/assets/voice/a.m4a')
  assert.deepEqual(calls, [
    { url: '/assets/voice/a.m4a?_=123', method: 'GET' },
    { url: '/assets/voice/a.m4a', method: 'HEAD' },
  ], 'matching validator reuses compressed bytes without another GET')
  assert.notEqual(first, second, 'each decode owner receives an independent ArrayBuffer')
  new Uint8Array(first)[0] = 255
  assert.equal(new Uint8Array(second)[0], 0, 'a decoder must not mutate the retained copy')
  version = 'v2'
  await cache.get('/assets/voice/a.m4a')
  assert.deepEqual(calls.slice(-2).map(call => call.method), ['HEAD', 'GET'], 'changed validator fetches fresh bytes')
  assert.deepEqual(cache.inspect(), { entries: 1, bytes: 2000, flights: 0 })
  cache.clear()
  assert.deepEqual(cache.inspect(), { entries: 0, bytes: 0, flights: 0 })
}

{
  let gets = 0
  const cache = createCompressedVoiceCache({ fetchImpl: async () => { gets++; return audio() } })
  await cache.get('/assets/voice/no-etag.m4a')
  await cache.get('/assets/voice/no-etag.m4a')
  assert.equal(gets, 2, 'bytes without a validator cannot be reused')
  assert.equal(cache.inspect().entries, 0)
}

{
  const gets = new Map()
  const cache = createCompressedVoiceCache({ maxBytes: 4000, maxEntries: 2, fetchImpl: async (url, options = {}) => {
    if (options.method === 'HEAD') return head('same')
    const key = url.split('?')[0]
    gets.set(key, (gets.get(key) || 0) + 1)
    return audio('same')
  } })
  await cache.get('/a.m4a')
  await cache.get('/b.m4a')
  await cache.get('/a.m4a')
  await cache.get('/c.m4a')
  assert.equal(cache.inspect().entries, 2)
  assert.equal(cache.inspect().bytes, 4000)
  await cache.get('/b.m4a')
  assert.equal(gets.get('/b.m4a'), 2, 'least recently used entry is evicted by byte budget')
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

console.log('Compressed voice cache: validator, copies, LRU budget, in-flight sharing, cancellation and HTML rejection passed')
