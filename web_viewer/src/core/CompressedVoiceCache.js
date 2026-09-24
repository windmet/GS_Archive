/** Bounded compressed bytes. Stable URLs let the browser honor HTTP validators.
 * Memory reuse is limited to explicitly fresh, cacheable audio responses.
 */
export function createCompressedVoiceCache({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  maxBytes = 16 * 1024 * 1024,
  maxEntries = 128,
  timeoutMs = 30000, // physical shared-flight safety ceiling; playback owns its shorter deadline
} = {}) {
  const entries = new Map()
  const flights = new Map()
  let retainedBytes = 0

  function forget(url) {
    const entry = entries.get(url)
    if (!entry) return
    retainedBytes -= entry.bytes.byteLength
    entries.delete(url)
  }

  function remember(url, response, bytes) {
    forget(url)
    const control = response.headers?.get?.('cache-control') || ''
    if (/(?:^|,)\s*(?:no-store|no-cache)\b/i.test(control)) return
    const maxAge = /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(control)
    if (!maxAge || bytes.byteLength > maxBytes || maxEntries < 1) return
    const age = Math.max(0, Number(response.headers?.get?.('age')) || 0)
    const date = Date.parse(response.headers?.get?.('date') || '')
    const apparentAge = Number.isFinite(date) ? Math.max(0, (now() - date) / 1000) : 0
    const remaining = Math.min(300, Number(maxAge[1]) - Math.max(age, apparentAge))
    if (!(remaining > 0)) return
    entries.set(url, { bytes, freshUntil: now() + remaining * 1000 })
    retainedBytes += bytes.byteLength
    while (retainedBytes > maxBytes || entries.size > maxEntries) {
      forget(entries.keys().next().value)
    }
  }

  async function load(url, signal) {
    const cached = entries.get(url)
    if (cached && now() < cached.freshUntil) {
      entries.delete(url)
      entries.set(url, cached)
      return cached.bytes
    }
    forget(url)
    // The browser performs conditional GET when stale and uses fresh HTTP cache
    // entries directly. No HEAD round trip, timestamp URL or custom CORS header.
    const response = await fetchImpl(url, { signal, cache: 'default' })
    signal.throwIfAborted()
    if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, code: `HTTP_${response.status}` })
    const contentType = response.headers?.get?.('content-type') || ''
    const bytes = await response.arrayBuffer()
    signal.throwIfAborted()
    if (bytes.byteLength < 1000 || /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)) {
      throw new Error(`Not an audio file: ${contentType} (${bytes.byteLength} bytes)`)
    }
    if (/^audio\//i.test(contentType)) remember(url, response, bytes)
    return bytes
  }

  async function get(url, { signal } = {}) {
    signal?.throwIfAborted()
    let flight = flights.get(url)
    if (flight?.controller.signal.aborted) {
      flights.delete(url)
      flight = null
    }
    if (!flight) {
      const controller = new AbortController()
      flight = { controller, consumers: 0, done: false, promise: null }
      const current = flight
      const timer = setTimeout(() => controller.abort(new Error(`Voice load timeout: ${url}`)), timeoutMs)
      current.promise = load(url, controller.signal).finally(() => {
        current.done = true
        clearTimeout(timer)
        if (flights.get(url) === current) flights.delete(url)
      })
      flights.set(url, current)
    }
    flight.consumers += 1
    let onAbort
    try {
      const result = await (signal
        ? Promise.race([flight.promise, new Promise((_, reject) => {
          onAbort = () => reject(signal.reason)
          signal.addEventListener('abort', onAbort, { once: true })
          if (signal.aborted) onAbort()
        })])
        : flight.promise)
      return result.slice(0) // decodeAudioData may detach the caller's copy.
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort)
      flight.consumers -= 1
      if (!flight.consumers && !flight.done) flight.controller.abort(new Error('Voice load has no consumers'))
    }
  }

  function clear() {
    for (const flight of flights.values()) flight.controller.abort(new Error('Voice cache cleared'))
    flights.clear()
    entries.clear()
    retainedBytes = 0
  }

  return { get, clear, inspect: () => ({ entries: entries.size, bytes: retainedBytes, flights: flights.size }) }
}

export const compressedVoiceCache = createCompressedVoiceCache()
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => compressedVoiceCache.clear())
