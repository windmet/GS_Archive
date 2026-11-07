// Every texture the perspective track can draw while playing, resolved from the same configs the renderers read.
// Playback waits only on what the current view and switches draw (songChartFirstBeatAssets), so no visible
// hit effect or Combo digit is fetched after the song starts and a disabled layer never delays it.
import hitEffectsConfig from '../../config/song-hit-effects.v1.json' with { type: 'json' }
import { songComboTiming } from './SongComboTiming.js'
import { subscribeEffectTexture } from './SongChartEffectTextures.js'

export function songChartTrackAssets({ effects: withEffects = true, combo: withCombo = true } = {}) {
  const effects = withEffects ? [...Object.values(hitEffectsConfig.assets), hitEffectsConfig.evaluation.sprite].map(asset => ({ id: asset.pathId, url: asset.url, effect: true })) : []
  const combo = withCombo ? [...Object.values(songComboTiming.sprites), ...Object.values(songComboTiming.special315?.assets || {})].filter(asset => asset?.url).map(asset => ({ id: asset.url, url: asset.url, effect: false })) : []
  const seen = new Set()
  return [...effects, ...combo].filter(asset => asset.url && !seen.has(asset.url) && seen.add(asset.url))
}

// What must be decoded before the first beat. The track, lanes, judgement line and note skin are
// first-screen images their renderers request on mount; effects and Combo are drawn only by the
// perspective track, and only while their switch is on. A layer switched on mid-song loads then
// (the renderers skip a texture until it is ready).
export function songChartFirstBeatAssets({ mode = 'perspective', demonstration = true, combo = true } = {}) {
  return mode === 'perspective' ? songChartTrackAssets({ effects: demonstration, combo }) : []
}

// Images the page keeps alive so a later <image href> or drawImage is a cache hit, not a request.
// A failure is forgotten, so the next preload (the next press of play) fetches it again.
const kept = new Map()
function keepImage(url) {
  let promise = kept.get(url)
  if (!promise) {
    const image = new Image()
    promise = new Promise(resolve => { image.onload = () => (image.decode ? image.decode().catch(() => {}) : Promise.resolve()).then(() => resolve(true)); image.onerror = () => { kept.delete(url); resolve(false) } })
    image.src = url
    kept.set(url, promise)
  }
  return promise
}

// Resolves { total, failed }; a failed texture never blocks playback (the renderers already skip a missing one).
export function preloadSongChartTrackAssets(onProgress = () => {}, assets = songChartTrackAssets()) {
  let done = 0, failed = 0
  const settle = ok => { done++; if (!ok) failed++; onProgress(done, assets.length) }
  return Promise.all(assets.map(asset => asset.effect
    // A cached texture calls back synchronously, before `off` is assigned, so unsubscribe lazily and settle once.
    ? new Promise(resolve => { let settled = false; const off = subscribeEffectTexture(asset.id, asset.url, entry => { if (entry.status === 'pending' || settled) return; settled = true; queueMicrotask(() => off()); settle(entry.status === 'ready'); resolve() }) })
    : keepImage(asset.url).then(settle)
  )).then(() => ({ total: assets.length, failed }))
}
