// Every texture the perspective track can draw while playing, resolved from the same configs the renderers read.
// Playback waits on preloadSongChartTrackAssets, so no hit effect or Combo digit is fetched after the song starts.
import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }
import { songComboTiming } from './SongComboTiming.js'
import { subscribeEffectTexture } from './SongChartEffectTextures.js'

export function songChartTrackAssets() {
  const effects = [...Object.values(hitEffectsConfig.assets), hitEffectsConfig.evaluation.sprite].map(asset => ({ id: asset.pathId, url: asset.url, effect: true }))
  const combo = [...Object.values(songComboTiming.sprites), ...Object.values(songComboTiming.special315?.assets || {})].filter(asset => asset?.url).map(asset => ({ id: asset.url, url: asset.url, effect: false }))
  const seen = new Set()
  return [...effects, ...combo].filter(asset => asset.url && !seen.has(asset.url) && seen.add(asset.url))
}

// Images the page keeps alive so a later <image href> or drawImage is a cache hit, not a request.
const kept = new Map()
function keepImage(url) {
  let promise = kept.get(url)
  if (!promise) {
    const image = new Image()
    promise = new Promise(resolve => { image.onload = () => (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true)); image.onerror = () => resolve(false) })
    image.src = url
    kept.set(url, promise)
  }
  return promise
}

// Resolves { total, failed }; a failed texture never blocks playback (the renderers already skip a missing one).
export function preloadSongChartTrackAssets(onProgress = () => {}) {
  const assets = songChartTrackAssets()
  let done = 0, failed = 0
  const settle = ok => { done++; if (!ok) failed++; onProgress(done, assets.length) }
  return Promise.all(assets.map(asset => asset.effect
    ? new Promise(resolve => { const off = subscribeEffectTexture(asset.id, asset.url, entry => { if (entry.status === 'pending') return; queueMicrotask(off); settle(entry.status === 'ready'); resolve() }) })
    : keepImage(asset.url).then(settle)
  )).then(() => ({ total: assets.length, failed }))
}
