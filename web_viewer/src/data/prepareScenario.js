/** Prepare a scenario without owning page, route, queue or loading state. */
export async function prepareScenario(name, {
  isCurrent,
  signal,
  loadPlayer,
  preloadAssets,
  onProgress,
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  readScenario = response => response.json(),
}) {
  signal?.throwIfAborted()
  const response = await fetchImpl(`/data/compiled/${name}?v=${now()}`, { cache: 'no-store', ...(signal ? { signal } : {}) })
  if (!isCurrent()) return null
  if (!response.ok) throw new Error(`Failed to fetch scenario ${name}: HTTP ${response.status}`)
  const scenario = await readScenario(response)
  if (!isCurrent()) return null
  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps)) {
    throw new Error(`Invalid scenario ${name}: steps must be an array`)
  }
  const work = Promise.all([
    loadPlayer(),
    preloadAssets(scenario.steps, progress => {
      if (isCurrent() && !signal?.aborted) onProgress?.(progress)
    }, { signal }),
  ])
  // Dynamic imports cannot be cancelled, but a cancelled navigation must not
  // keep waiting for one or publish when it eventually finishes.
  let onAbort
  try {
    if (!signal) await work
    else await Promise.race([work, new Promise((_, reject) => {
      onAbort = () => reject(signal.reason)
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    })])
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort)
  }
  signal?.throwIfAborted()
  return isCurrent() ? scenario : null
}
