import assert from 'node:assert/strict'

// Minimal Image: loads on the next macrotask, or fails for URLs containing "missing".
globalThis.Image = class {
  set src(url) { this._src = url; setTimeout(() => (url.includes('missing') ? this.onerror?.() : this.onload?.()), 0) }
  get src() { return this._src }
}

const { preloadSongChartTrackAssets, songChartTrackAssets } = await import('../src/presentation/SongChartTrackAssets.js')
const { subscribeEffectTexture } = await import('../src/presentation/SongChartEffectTextures.js')
const total = songChartTrackAssets().length
assert.ok(total > 0, 'track asset list is not empty')

// Cold: every texture is fetched.
const cold = await preloadSongChartTrackAssets()
assert.deepEqual(cold, { total, failed: 0 }, 'cold preload resolves')

// Warm: effect textures are cache hits that call back synchronously (switching difficulty / reopening).
const progress = []
const warm = await preloadSongChartTrackAssets((done, count) => progress.push([done, count]))
assert.deepEqual(warm, { total, failed: 0 }, 'cached preload resolves instead of rejecting')
assert.equal(progress.length, total, 'each asset settles exactly once')
assert.deepEqual(progress.at(-1), [total, total])

// Subscriptions are released after settling, so later loads do not re-fire stale preload callbacks.
await new Promise(resolve => setTimeout(resolve, 0))
const effect = songChartTrackAssets().find(asset => asset.effect)
let calls = 0
const off = subscribeEffectTexture(effect.id, effect.url, () => calls++)
off()
assert.equal(calls, 1, 'fresh subscriber sees the cached entry once')

// A failed texture never blocks playback.
const failed = await new Promise(resolve => subscribeEffectTexture('missing-probe', 'missing.png', entry => entry.status !== 'pending' && resolve(entry.status)))
assert.equal(failed, 'failed')
console.log(`Chart track assets: cold and cached preload of ${total} textures resolve, settle once and release subscriptions`)
