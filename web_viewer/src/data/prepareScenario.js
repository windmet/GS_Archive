/** Prepare a scenario without owning page, route, queue or loading state. */
export async function prepareScenario(name, {
  isCurrent,
  loadPlayer,
  preloadAssets,
  onProgress,
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  readScenario = response => response.json(),
}) {
  const response = await fetchImpl(`/data/compiled/${name}?v=${now()}`, { cache: 'no-store' })
  if (!isCurrent()) return null
  if (!response.ok) throw new Error(`Failed to fetch scenario ${name}: HTTP ${response.status}`)
  const scenario = await readScenario(response)
  if (!isCurrent()) return null
  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps)) {
    throw new Error(`Invalid scenario ${name}: steps must be an array`)
  }
  await Promise.all([
    loadPlayer(),
    preloadAssets(scenario.steps, progress => {
      if (isCurrent()) onProgress?.(progress)
    }),
  ])
  return isCurrent() ? scenario : null
}
