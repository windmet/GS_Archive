// Raw bytes are shared; cancellation belongs to each subscriber, never its sibling.
export function createBoundedTextTransport({fetchImpl = (...args) => fetch(...args),
  timeoutMs = 12000, maxBytes = 1024 * 1024, cacheBytes = 4 * 1024 * 1024, maxEntries = 32, binary = false} = {}) {
  const cache = new Map(), flights = new Map()
  let bytes = 0
  const aborted = () => new DOMException('Request cancelled', 'AbortError')
  function invalidate(key) {
    const old = cache.get(key)
    if (old) {bytes -= old.bytes; cache.delete(key)}
    const flight = flights.get(key)
    if (flight) {flights.delete(key); flight.controller.abort()}
  }
  async function load(key, {signal} = {}) {
    if (signal?.aborted) throw aborted()
    if (cache.has(key)) {
      const value = cache.get(key); cache.delete(key); cache.set(key,value)
      return value.text
    }
    let flight = flights.get(key)
    if (!flight) {
      flight = {controller:new AbortController(),subscribers:0}
      flights.set(key,flight)
      const request = (async () => {
        const response = await fetchImpl(key,{signal:flight.controller.signal})
        if (!response?.ok) {const error = Error(`HTTP ${response?.status ?? 'unknown'}`); error.status = response?.status; throw error}
        if (response.headers?.get?.('content-type')?.includes('text/html')) throw Error('Unexpected HTML response')
        if (Number(response.headers?.get?.('content-length')) > maxBytes) throw Error('Response byte budget exceeded')
        const text = binary ? new Uint8Array(await response.arrayBuffer()) : await response.text()
        const size = binary ? text.byteLength : new TextEncoder().encode(text).byteLength
        if (size > maxBytes) throw Error('Response byte budget exceeded')
        if (flight.controller.signal.aborted || flights.get(key) !== flight) throw aborted()
        cache.set(key,{text,bytes:size}); bytes += size
        while (bytes > cacheBytes || cache.size > maxEntries) {
          const oldest = cache.keys().next().value; bytes -= cache.get(oldest).bytes; cache.delete(oldest)
        }
        return text
      })()
      let timer
      const deadline = new Promise((_,reject) => {timer=setTimeout(() => {
        const error=Error('Response deadline exceeded'); error.name='TimeoutError'
        flight.controller.abort(error); reject(error)
      },timeoutMs)})
      // Promise.race observes late rejection even when an injected fetch ignores abort.
      let abortListener
      const abortWait = new Promise((_,reject) => {
        abortListener=()=>reject(flight.controller.signal.reason || aborted())
        flight.controller.signal.addEventListener('abort',abortListener,{once:true})
      })
      flight.promise = Promise.race([request,deadline,abortWait]).finally(() => {
        flight.controller.signal.removeEventListener('abort',abortListener)
        clearTimeout(timer); if (flights.get(key) === flight) flights.delete(key)
      })
    }
    flight.subscribers++
    return new Promise((resolve,reject) => {
      let settled=false
      const finish=(callback,value) => {
        if (settled) return
        settled=true; signal?.removeEventListener('abort',cancel); flight.subscribers--
        if (!flight.subscribers && flights.get(key) === flight) {flights.delete(key); flight.controller.abort()}
        callback(value)
      }
      const cancel=() => finish(reject,aborted())
      signal?.addEventListener('abort',cancel,{once:true})
      flight.promise.then(value=>finish(resolve,value),error=>finish(reject,error))
      if (signal?.aborted) cancel()
    })
  }
  return {load,invalidate,clear(){for(const key of new Set([...cache.keys(),...flights.keys()]))invalidate(key)},
    stats:()=>({entries:cache.size,bytes,flights:flights.size})}
}
