import assert from 'node:assert/strict'
import { createStoryAssetTransport, storyAssetTransport } from '../src/core/StoryAssetTransport.js'
import { Preloader } from '../src/utils/Preloader.js'
import { loadAndCreateSpine } from '../src/core/spineSpawnPipeline.js'

let calls = 0, release, requestSignal
const transport = createStoryAssetTransport({ maxBytes: 16, maxEntries: 2, fetchImpl: async (_url, options) => {
  calls++; requestSignal = options.signal
  await new Promise(resolve => { release = resolve })
  return new Response('{"a":1}', { headers: { 'cache-control': 'max-age=60' } })
} })
const controller = new AbortController()
const cancelled = transport.getArrayBuffer('/shared', { signal: controller.signal })
const surviving = transport.getJson('/shared')
controller.abort(new Error('consumer left'))
await assert.rejects(cancelled, /consumer left/)
assert.equal(requestSignal.aborted, false)
release()
assert.deepEqual(await surviving, { a: 1 })
const bytes = await transport.getArrayBuffer('/shared')
new Uint8Array(bytes).fill(0)
assert.equal(await transport.getText('/shared'), '{"a":1}')
assert.equal(calls, 1, 'warm data is shared across representations without sharing mutable buffers')
transport.clear()
assert.deepEqual(transport.inspect(), { entries: 0, bytes: 0, flights: 0 })
for (const body of ['<!DOCTYPE html><html>', '']) {
  const invalid = createStoryAssetTransport({ fetchImpl: async () => new Response(body) })
  await assert.rejects(invalid.getArrayBuffer('/bad'))
  assert.equal(invalid.inspect().bytes, 0)
}
let uncachedCalls = 0
const uncached = createStoryAssetTransport({ fetchImpl: async () => {
  uncachedCalls++; return new Response('bytes', { headers: { 'cache-control': 'no-store' } })
} })
await uncached.getArrayBuffer('/no-store'); await uncached.getArrayBuffer('/no-store')
assert.equal(uncachedCalls, 2)
let now = 0, freshCalls = 0
const bounded = createStoryAssetTransport({ now: () => now, maxBytes: 8, maxEntries: 2,
  fetchImpl: async () => { freshCalls++; return new Response('12345', { headers: { 'cache-control': 'max-age=1' } }) },
})
await bounded.getArrayBuffer('/a'); await bounded.getArrayBuffer('/b')
assert.equal(bounded.inspect().entries, 1, 'byte cap evicts least recently used bytes')
await bounded.getArrayBuffer('/b'); assert.equal(freshCalls, 2)
now = 1001
await bounded.getArrayBuffer('/b'); assert.equal(freshCalls, 3, 'expired bytes must revalidate through HTTP')
const abandoning = createStoryAssetTransport({ fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
  signal.addEventListener('abort', () => reject(signal.reason), { once: true })
}) })
const abort = new AbortController()
const abandoned = abandoning.getArrayBuffer('/held', { signal: abort.signal })
abort.abort(new Error('leave'))
await assert.rejects(abandoned, /leave/)
await new Promise(resolve => setTimeout(resolve, 0))
assert.equal(abandoning.inspect().flights, 0)

// The actual preloader and spawn pipeline must share the singleton transport.
const originalFetch = globalThis.fetch
const urls = []
try {
  storyAssetTransport.clear()
  globalThis.fetch = async url => {
    urls.push(url)
    return new Response(url.endsWith('.atlas') ? 'comu.png\nsize: 8,8\n' : 'skeleton', { headers: { 'cache-control': 'max-age=60' } })
  }
  await Preloader._preloadAtlas('/warm.atlas')
  await Preloader._preloadBinary('/warm.skel', 'fixture')
  await assert.rejects(loadAndCreateSpine({ modelId: 'fixture', atlasUrl: '/warm.atlas', skelUrl: '/warm.skel',
    decodeAtlasText: bytes => new TextDecoder().decode(bytes), resolveTextureUrl: async () => { throw Error('bytes ready') },
  }), /bytes ready/)
  assert.deepEqual(urls, ['/warm.atlas', '/warm.skel'], 'spawn consumes warmed bytes before its separate GPU phase')
} finally { globalThis.fetch = originalFetch; storyAssetTransport.clear() }
console.log('Visual transport: shared warm bytes, consumer cancellation, copy ownership, no-store and error validation passed')
