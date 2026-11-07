import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Minimal Image: loads on the next macrotask; a URL listed in `failing` errors (and is then removed, so a retry succeeds).
const failing = new Set(), requested = []
globalThis.Image = class {
  set src(url) {
    this._src = url; requested.push(url)
    setTimeout(() => { if (failing.delete(url) || url.includes('missing')) this.onerror?.(); else this.onload?.() }, 0)
  }
  get src() { return this._src }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0))

const { preloadSongChartTrackAssets, songChartTrackAssets, songChartFirstBeatAssets } = await import('../src/presentation/SongChartTrackAssets.js')
const { subscribeEffectTexture } = await import('../src/presentation/SongChartEffectTextures.js')
const all = songChartTrackAssets(), total = all.length
const effects = all.filter(asset => asset.effect), combo = all.filter(asset => !asset.effect)
assert.ok(effects.length > 0 && combo.length > 0, 'both effect and Combo textures are listed')

// Only what the current view and switches draw gates the first beat.
const urls = assets => assets.map(asset => asset.url).sort()
assert.deepEqual(songChartFirstBeatAssets({ mode: 'long', demonstration: true, combo: true }), [], 'long track waits for no track texture')
assert.deepEqual(songChartFirstBeatAssets({ mode: 'perspective', demonstration: false, combo: false }), [], 'both layers off: nothing to wait for')
assert.deepEqual(urls(songChartFirstBeatAssets({ mode: 'perspective', demonstration: true, combo: false })), urls(effects))
assert.deepEqual(urls(songChartFirstBeatAssets({ mode: 'perspective', demonstration: false, combo: true })), urls(combo))
assert.deepEqual(urls(songChartFirstBeatAssets({ mode: 'perspective', demonstration: true, combo: true })), urls(all))

// Cold: a failed texture never blocks playback (the renderers already skip a missing one).
failing.add(effects[0].url).add(combo[0].url)
const listened = []
subscribeEffectTexture(effects[0].id, effects[0].url, entry => listened.push(entry.status))
const cold = await preloadSongChartTrackAssets()
assert.deepEqual(cold, { total, failed: 2 }, 'cold preload resolves and reports failures')

// Warm: cached textures call back synchronously (switching difficulty / reopening); failures are fetched again.
requested.length = 0
const progress = []
const warm = await preloadSongChartTrackAssets((done, count) => progress.push([done, count]))
assert.deepEqual(warm, { total, failed: 0 }, 'cached preload resolves instead of rejecting, and retries what failed')
assert.deepEqual(requested.sort(), [effects[0].url, combo[0].url].sort(), 'only the failed textures are requested again')
assert.equal(progress.length, total, 'each asset settles exactly once')
assert.deepEqual(progress.at(-1), [total, total])
assert.deepEqual(listened, ['pending', 'failed', 'pending', 'ready'], 'an existing renderer subscription hears the retry succeed')

// Subscriptions are released after settling, so later loads do not re-fire stale preload callbacks.
await tick()
let calls = 0
const off = subscribeEffectTexture(effects[1].id, effects[1].url, () => calls++)
off()
assert.equal(calls, 1, 'fresh subscriber sees the cached entry once')
const failed = await new Promise(resolve => subscribeEffectTexture('missing-probe', 'missing.png', entry => entry.status !== 'pending' && resolve(entry.status)))
assert.equal(failed, 'failed')

// The viewer waits per press of play on the current view's first-beat set, and reloads it when the view changes.
const viewer = readFileSync(new URL('../src/components/archive/ArchiveSongChartPreview.vue', import.meta.url), 'utf8')
assert.match(viewer, /songChartFirstBeatAssets\(\{ mode: mode\.value, demonstration: demonstrationEnabled\.value, combo: comboEnabled\.value \}\)/)
assert.match(viewer, /async function togglePlayback\(\)[\s\S]*?await loadTrackAssets\(\)[\s\S]*?await element\.play\(\)/, 'play awaits the current first-beat set')
assert.match(viewer, /watch\(\[mode, demonstrationEnabled, comboEnabled\]/, 'view and switch changes reload the set')
assert.match(viewer, /sounds\.warm\(soundSet\.value\)/, 'hit sounds are fetched when the chart loads')
console.log(`Chart track assets: first-beat set follows view and switches, cold/cached preload of ${total} textures resolve once, failures retried`)
