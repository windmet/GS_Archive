import { createStoryAssetPriority } from '../../shared/story/StoryAssetPriority.js'

/** Prepare a scenario without owning page, route, queue or loading state. */
export async function prepareScenario(name, {
  isCurrent,
  signal,
  loadPlayer,
  preloadAssets,
  onProgress,
  onStatus,
  onBackgroundReady,
  playbackEntry,
  fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(),
  readScenario = response => response.json(),
}) {
  // Imports and digest work cannot themselves be cancelled, but navigation
  // must stop waiting and must not publish their eventual result.
  async function awaitOwned(work) {
    if (!signal) return work
    let onAbort
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        onAbort = () => reject(signal.reason)
        if (signal.aborted) onAbort()
        else signal.addEventListener('abort', onAbort, { once: true })
      })])
    } finally {
      if (onAbort) signal.removeEventListener('abort', onAbort)
    }
  }
  signal?.throwIfAborted()
  const response = await fetchImpl(`/data/compiled/${name}?v=${now()}`, { cache: 'no-store', ...(signal ? { signal } : {}) })
  if (!isCurrent()) return null
  if (!response.ok) throw new Error(`Failed to fetch scenario ${name}: HTTP ${response.status}`)
  const sourceResponse = response.clone()
  const [scenario, bytes] = await awaitOwned(Promise.all([readScenario(response), sourceResponse.arrayBuffer()]))
  if (!isCurrent()) return null
  if (!scenario || typeof scenario !== 'object' || !Array.isArray(scenario.steps)) {
    throw new Error(`Invalid scenario ${name}: steps must be an array`)
  }
  const [digest, { createStoryAssetPlan }] = await awaitOwned(Promise.all([
    crypto.subtle.digest('SHA-256', bytes), import('../../shared/story/StoryAssetPlan.js'),
  ]))
  const sha256 = `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
  if (!isCurrent()) return null
  signal?.throwIfAborted()
  const plan = createStoryAssetPlan(scenario, { file: name, sha256 })
  const work = Promise.all([
    loadPlayer(),
    preloadAssets(plan, progress => {
      if (isCurrent() && !signal?.aborted) onProgress?.(progress)
    }, { signal, entryOnly: !!onBackgroundReady, priority: createStoryAssetPriority(scenario, playbackEntry), onStatus: status => {
      if (isCurrent() && !signal?.aborted) onStatus?.(status)
    } }),
  ])
  const [, preloaded] = await awaitOwned(work)
  signal?.throwIfAborted()
  if (preloaded?.status?.phase === 'blocked') {
    throw new Error('当前入口的必要资源未能载入，请重试。')
  }
  if (isCurrent() && preloaded?.startBackground) onBackgroundReady?.(preloaded.startBackground)
  return isCurrent() ? scenario : null
}
