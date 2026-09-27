const MAX_EVENTS = 160
const events = []
const enabled = () => typeof window !== 'undefined' &&
  /(?:^|[?&])(?:playerTrace|runtimeDebug)=1(?:&|$)/.test(window.location?.search || '')
export function tracePlayer(phase, detail = {}) {
  if (!enabled()) return
  events.push({ at: Math.round(performance.now()), phase, ...detail })
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}
export function playerTraceSnapshot(extra = {}) {
  const resources = typeof performance?.getEntriesByType === 'function'
    ? performance.getEntriesByType('resource').filter(entry => {
      try { return new URL(entry.name).origin === globalThis.location?.origin } catch { return false }
    }).slice(-100).map(entry => ({
      // Same-origin paths only; no cookies, headers or external account URLs.
      path: (() => { try { return new URL(entry.name).pathname } catch { return '' } })(),
      start: Math.round(entry.startTime), duration: Math.round(entry.duration),
      responseStart: Math.round(entry.responseStart), responseEnd: Math.round(entry.responseEnd),
      transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize, initiatorType: entry.initiatorType,
    })) : []
  return { capturedAt: new Date().toISOString(), userAgent: globalThis.navigator?.userAgent,
    events: events.map(item => ({ ...item })), resources, ...extra }
}
