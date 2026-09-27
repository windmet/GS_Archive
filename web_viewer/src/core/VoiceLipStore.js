import { withLoadDeadline } from './AsyncLoadBoundary.js'
import { getLipSyncUrl } from '../utils/AssetResolver.js'
import { deriveMainLipPathFromVoice } from '../utils/LipSyncHelpers.js'

/** Small owner-local cache. Curves store source samples, not a playback clock. */
export function createVoiceLipStore({ fetchImpl = (...args) => fetch(...args), maxEntries = 48, maxSamples = 120000 } = {}) {
  const cache = new Map()
  let samples = 0
  async function load(step, { signal, timeoutMs = 8000 } = {}) {
    if (step?.lipSync === false) return null
    const paths = [...new Set([step?.dialogue?.lip?.path, deriveMainLipPathFromVoice(step?.dialogue?.voice)].filter(Boolean))]
    return withLoadDeadline(async taskSignal => {
      for (const path of paths) {
        taskSignal.throwIfAborted()
        if (cache.has(path)) {
          const value = cache.get(path); cache.delete(path); cache.set(path, value)
          return value
        }
        try {
          const response = await fetchImpl(getLipSyncUrl(path), { signal: taskSignal, cache: 'default' })
          if ([404, 410].includes(response.status)) continue
          if (!response.ok) throw new Error(`Lip HTTP ${response.status}`)
          if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('Lip returned HTML')
          const value = await response.json()
          taskSignal.throwIfAborted()
          if (!Array.isArray(value.scales) || !value.scales.length) return null
          const curve = { path, scales: value.scales, gain: 1 }
          if (curve.scales.length <= maxSamples) {
            if (cache.has(path)) samples -= cache.get(path).scales.length
            cache.set(path, curve); samples += curve.scales.length
            while (cache.size > maxEntries || samples > maxSamples) {
              const first = cache.keys().next().value
              samples -= cache.get(first).scales.length; cache.delete(first)
            }
          }
          return curve
        } catch (error) {
          if (taskSignal.aborted) throw error
          // Optional, but transient failures must not fan out across aliases.
          throw error
        }
      }
      return null
    }, { signal, timeoutMs, label: 'optional-lip' })
  }
  return { load, clear: () => { cache.clear(); samples = 0 }, inspect: () => ({ entries: cache.size, samples }) }
}
