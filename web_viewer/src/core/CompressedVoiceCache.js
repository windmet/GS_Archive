/** Revalidated, bounded compressed bytes shared by story-player instances.
 * The source keeps its existing cache-busted GET until versioned URLs exist.
 * Only an audio response with an ETag may be reused after a matching HEAD.
 */
export function createCompressedVoiceCache({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  maxBytes = 16 * 1024 * 1024,
  maxEntries = 128,
  timeoutMs = 10000,
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

  function remember(url, etag, bytes) {
    forget(url)
    if (!etag || bytes.byteLength > maxBytes || maxEntries < 1) return
    entries.set(url, { etag, bytes })
    retainedBytes += bytes.byteLength
    while (retainedBytes > maxBytes || entries.size > maxEntries) {
      forget(entries.keys().next().value)
    }
  }

  async function load(url, signal) {
    const cached = entries.get(url)
    if (cached) {
      try {
        const head = await fetchImpl(url, { method: 'HEAD', cache: 'no-store', signal })
        signal.throwIfAborted()
        if (head.ok && head.headers?.get?.('etag') === cached.etag
          && /^audio\//i.test(head.headers?.get?.('content-type') || '')) {
          entries.delete(url)
          entries.set(url, cached)
          return cached.bytes
        }
      } catch (error) {
        signal.throwIfAborted()
        // A failed validator cannot authorize reuse. Fetch fresh bytes below.
      }
      forget(url)
    }

    const separator = url.includes('?') ? '&' : '?'
    const response = await fetchImpl(`${url}${separator}_=${now()}`, { signal })
    signal.throwIfAborted()
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers?.get?.('content-type') || ''
    const bytes = await response.arrayBuffer()
    signal.throwIfAborted()
    if (bytes.byteLength < 1000 || /(?:text\/html|application\/xhtml\+xml)/i.test(contentType)) {
      throw new Error(`Not an audio file: ${contentType} (${bytes.byteLength} bytes)`)
    }
    if (/^audio\//i.test(contentType)) remember(url, response.headers?.get?.('etag'), bytes)
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
