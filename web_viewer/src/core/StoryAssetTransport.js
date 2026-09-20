/** Shared visual-resource bytes only; callers retain ownership of GPU objects. */
export function createStoryAssetTransport({
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  maxBytes = 32 * 1024 * 1024,
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

  async function load(url, signal, cache = 'default') {
    const cached = entries.get(url)
    if (cache === 'default' && cached && now() < cached.freshUntil) {
      entries.delete(url)
      entries.set(url, cached)
      return cached.bytes
    }
    forget(url)
    // The browser performs conditional GET when stale and uses fresh HTTP cache
    // entries directly. No HEAD round trip, timestamp URL or custom CORS header.
    const response = await fetchImpl(url, { signal, cache })
    signal.throwIfAborted()
    if (!response.ok) {
      await response.body?.cancel()
      throw Object.assign(new Error(`HTTP ${response.status}: ${url}`), { status: response.status })
    }
    const contentType = response.headers?.get?.('content-type') || ''
    const bytes = await response.arrayBuffer()
    signal.throwIfAborted()
    const prefix = new TextDecoder().decode(bytes.slice(0, 256)).trimStart()
    if (!bytes.byteLength) throw new Error(`Empty response: ${url}`)
    if (/(?:text\/html|application\/xhtml\+xml)/i.test(contentType) || /^<(?:!doctype\s+html|html)\b/i.test(prefix)) {
      throw new Error(`Unexpected HTML response: ${url} (${contentType})`)
    }
    if (cache === 'default') remember(url, response, bytes)
    return bytes
  }

  async function get(url, { signal, cache = 'default' } = {}) {
    signal?.throwIfAborted()
    const key = `${cache}:${url}`
    let flight = flights.get(key)
    if (flight?.controller.signal.aborted) {
      flights.delete(key)
      flight = null
    }
    if (!flight) {
      const controller = new AbortController()
      flight = { controller, consumers: 0, done: false, promise: null }
      const current = flight
      const timer = setTimeout(() => controller.abort(new Error(`Asset load timeout: ${url}`)), timeoutMs)
      current.promise = load(url, controller.signal, cache).finally(() => {
        current.done = true
        clearTimeout(timer)
        if (flights.get(key) === current) flights.delete(key)
      })
      flights.set(key, current)
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
      signal?.throwIfAborted()
      flight.controller.signal.throwIfAborted()
      return result.slice(0) // Callers may decode, mutate or transfer their own copy.
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort)
      flight.consumers -= 1
      if (!flight.consumers && !flight.done) flight.controller.abort(new Error('Asset load has no consumers'))
    }
  }

  function clear() {
    for (const flight of flights.values()) flight.controller.abort(new Error('Asset transport cleared'))
    flights.clear()
    entries.clear()
    retainedBytes = 0
  }

  return { getArrayBuffer: get,
    getText: async (url, options) => new TextDecoder().decode(await get(url, options)),
    getJson: async (url, options) => {
      try { return JSON.parse(new TextDecoder().decode(await get(url, options))) }
      catch (error) { forget(url); throw error }
    },
    clear, inspect: () => ({ entries: entries.size, bytes: retainedBytes, flights: flights.size }) }
}

export const storyAssetTransport = createStoryAssetTransport()
if (typeof window !== 'undefined') window.addEventListener('pagehide', () => storyAssetTransport.clear())
