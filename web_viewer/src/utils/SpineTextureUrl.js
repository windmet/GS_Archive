import { getSpineAtlasUrl } from './AssetResolver.js'

/** Same single-page fallback policy for stage loading and plan execution. */
export async function resolveSpineTextureUrl(modelId, page, { allowFallback = true, probe, onFallback = () => {}, signal }) {
  const atlas = getSpineAtlasUrl(modelId)
  const base = atlas.slice(0, atlas.lastIndexOf('/'))
  const primary = `${base}/${page}`
  signal?.throwIfAborted()
  // No alternative exists in these cases: one GET is the actual test.
  if (page === 'comu.png' || !allowFallback) return primary
  if (await probe(primary)) return primary
  if (allowFallback && page !== 'comu.png') {
    const fallback = `${base}/comu.png`
    signal?.throwIfAborted()
    if (await probe(fallback)) { onFallback(); return fallback }
  }
  return primary
}
