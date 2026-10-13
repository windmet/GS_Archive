import { waitForSignal, withLoadDeadline } from './AsyncLoadBoundary.js'
import { getLipSyncUrl } from '../utils/AssetResolver.js'
import { deriveMainLipPathFromVoice } from '../utils/LipSyncHelpers.js'

const MISSING = Symbol('missing-lip')

/** Small owner-local cache. Curves store source samples, not a playback clock.
 * One shared flight per path. A caller whose deadline passes is released but the download
 * continues, so a curve that arrives after a slow voice is still cached for playback. A
 * cancelled caller releases its share, and the last one to leave aborts the download.
 */
export function createVoiceLipStore({ fetchImpl = (...args) => fetch(...args), maxEntries = 48, maxSamples = 120000,
  flightTimeoutMs = 30000 } = {}) {
  const cache = new Map()
  const flights = new Map()
  let samples = 0
  function remember(curve) {
    if (curve.scales.length > maxSamples) return
    if (cache.has(curve.path)) samples -= cache.get(curve.path).scales.length
    cache.set(curve.path, curve); samples += curve.scales.length
    while (cache.size > maxEntries || samples > maxSamples) {
      const first = cache.keys().next().value
      samples -= cache.get(first).scales.length; cache.delete(first)
    }
  }
  function fly(path) {
    let flight = flights.get(path)
    if (flight) return flight
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new Error(`Lip load timeout: ${path}`)), flightTimeoutMs)
    flight = { controller, consumers: 0 }
    flight.promise = (async () => {
      const response = await fetchImpl(getLipSyncUrl(path), { signal: controller.signal, cache: 'default' })
      if ([404, 410].includes(response.status)) return MISSING
      if (!response.ok) throw new Error(`Lip HTTP ${response.status}`)
      if ((response.headers.get('content-type') || '').includes('text/html')) throw new Error('Lip returned HTML')
      const value = await response.json()
      if (!Array.isArray(value.scales) || !value.scales.length) return null
      const curve = { path, scales: value.scales, gain: 1 }
      remember(curve)
      return curve
    })().finally(() => { clearTimeout(timer); if (flights.get(path) === flight) flights.delete(path) })
    flight.promise.catch(() => {})
    flights.set(path, flight)
    return flight
  }
  async function join(path, taskSignal, callerSignal) {
    const flight = fly(path)
    flight.consumers++
    let released = false
    // Synchronous with the abort, so a cancelled line stops its download at once.
    const release = () => {
      if (released) return
      released = true
      flight.consumers--
      if (!flight.consumers && callerSignal?.aborted && flights.get(path) === flight) {
        flight.controller.abort(callerSignal.reason)
      }
    }
    taskSignal.addEventListener('abort', release, { once: true })
    try {
      return await waitForSignal(flight.promise, taskSignal)
    } finally {
      taskSignal.removeEventListener('abort', release)
      release()
    }
  }
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
        // Optional, but transient failures must not fan out across aliases.
        const value = await join(path, taskSignal, signal)
        taskSignal.throwIfAborted()
        if (value === MISSING) continue
        return value
      }
      return null
    }, { signal, timeoutMs, label: 'optional-lip' })
  }
  function clear() {
    for (const flight of flights.values()) flight.controller.abort(new Error('Lip cache cleared'))
    flights.clear(); cache.clear(); samples = 0
  }
  return { load, clear, inspect: () => ({ entries: cache.size, samples, flights: flights.size }) }
}
