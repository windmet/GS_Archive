import { withLoadDeadline } from '../core/AsyncLoadBoundary.js'
import { tracePlayer } from '../core/PlayerTrace.js'
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
  tracePlayer('scenario-request', { file: name })
  // Reader still supplies its pinned-byte verifier. Stable URLs keep HTTP validators.
  const [scenario, bytes] = await withLoadDeadline(async requestSignal => {
    const response = await fetchImpl(`/data/compiled/${name}`, { cache: 'no-cache', signal: requestSignal })
    tracePlayer('scenario-headers', { file: name, status: response.status })
    if (!response.ok) throw new Error(`Failed to fetch scenario ${name}: HTTP ${response.status}`)
    const sourceResponse = response.clone()
    return Promise.all([readScenario(response), sourceResponse.arrayBuffer()])
  }, { signal, timeoutMs: 25000, label: 'scenario-body' })
  tracePlayer('scenario-body', { file: name, bytes: bytes.byteLength })
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
    withLoadDeadline(() => loadPlayer(), { signal, timeoutMs: 25000, label: 'player-module' }),
    preloadAssets(plan, progress => {
      if (isCurrent() && !signal?.aborted) onProgress?.(progress)
    }, { signal, entryOnly: !!onBackgroundReady, runtimeOwned: !!onBackgroundReady, priority: createStoryAssetPriority(scenario, playbackEntry), onStatus: status => {
      if (isCurrent() && !signal?.aborted) onStatus?.(status)
    } }),
  ])
  const [, preloaded] = await awaitOwned(work)
  signal?.throwIfAborted()
  if (!onBackgroundReady && preloaded?.status?.phase === 'blocked') {
    throw new Error('当前入口的必要资源未能载入，请重试。')
  }
  if (isCurrent() && preloaded?.startBackground) onBackgroundReady?.(preloaded.startBackground, preloaded.updatePriority, preloaded)
  return isCurrent() ? scenario : null
}
