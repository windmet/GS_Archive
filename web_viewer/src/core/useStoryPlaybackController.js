import { ref } from 'vue'
import { createStoryAssetPriority } from '../../shared/story/StoryAssetPriority.js'
import { useEpisodeQueue } from './useEpisodeQueue.js'
import { prepareScenario } from '../data/prepareScenario.js'
import { playerReturnRoute } from './PlayerEntryRequest.js'
import { tracePlayer } from './PlayerTrace.js'
import { withLoadDeadline } from './AsyncLoadBoundary.js'

const boundary = value => Number(value) > 0 ? Number(value) : null

/** Owns one playback entry and its background work. Navigation owns supersession;
 * URL context is a descriptor, never a requirement to hydrate the return page. */
export function useStoryPlaybackController({ state, navigation, loadPlayer, preloadAssets,
  syncRoute, returnTo, prepare = prepareScenario, queue = useEpisodeQueue(),
  resolveQueue = null, onError = error => console.error('Failed to load:', error),
}) {
  const currentScenario = state.currentScenario || ref(null)
  const currentScenarioInstance = state.currentScenarioInstance || ref(0)
  const currentScenarioInitialStep = state.currentScenarioInitialStep || ref(null)
  const error = ref(''), preloadStatus = ref(null), playbackBuffering = ref(false)
  const playbackReadiness = ref(null), canRetry = ref(false), pendingEntry = ref(null)
  const queueStatus = ref('ready'), queueError = ref('')
  const { view, loading, preloadProgress, currentScenarioFile, currentScenarioStartStep,
    currentScenarioEndStep, currentPreviewCue, returnViewAfterPlayer } = state
  let active = null, failedEntry = null
  function clearRetry() { failedEntry = null; canRetry.value = false }
  function retire() {
    if (!active) return
    const owner = active
    active = null
    owner.controller.abort()
    owner.warmup?.dispose?.()
    owner.intent.signal?.removeEventListener('abort', owner.onAbort)
  }
  function reset() {
    retire()
    pendingEntry.value = null
    clearRetry()
    preloadStatus.value = null
    playbackBuffering.value = false
    playbackReadiness.value = null
    currentScenario.value = null
    currentScenarioFile.value = ''
    currentScenarioStartStep.value = null
    currentScenarioInitialStep.value = null
    currentScenarioEndStep.value = null
    currentPreviewCue.value = ''
    if (state.playerEntryRoute) state.playerEntryRoute.value = null
    returnViewAfterPlayer.value = 'files'
    queue.clear()
    queueStatus.value = 'ready'
    queueError.value = ''
    error.value = ''
  }
  function captureReturn(destination, options) {
    return options.returnRoute || (active?.returnView === destination ? active.returnRoute : null) ||
      playerReturnRoute(state.currentArchiveRoute?.(), destination)
  }
  function begin(intent, name, returnView, options) {
    const returnRoute = captureReturn(returnView, options)
    retire()
    const controller = new AbortController()
    const owner = { intent, controller, name, returnView, returnRoute, options,
      warmup: null, published: false, firstPlayable: false, queueFlight: null }
    owner.current = () => active === owner && intent.isCurrent() && !controller.signal.aborted
    owner.onAbort = () => {
      controller.abort(intent.signal?.reason)
      owner.warmup?.dispose?.()
      if (active === owner) {
        preloadStatus.value = null
        clearRetry()
        error.value = ''
      }
    }
    intent.signal?.addEventListener('abort', owner.onAbort, { once: true })
    active = owner
    pendingEntry.value = { returnView, returnRoute, file: name }
    clearRetry()
    loading.value = true
    preloadProgress.value = 0
    preloadStatus.value = null
    queueError.value = ''
    error.value = ''
    tracePlayer('entry-start', { file: name, restoring: Boolean(intent.restoring), returnView })
    return owner
  }
  function publish(owner, scenario, options) {
    if (!owner.current()) return false
    pendingEntry.value = null
    playbackBuffering.value = true
    playbackReadiness.value = null
    currentScenario.value = scenario
    currentScenarioFile.value = owner.name
    currentScenarioStartStep.value = boundary(options.startStep)
    currentScenarioInitialStep.value = boundary(options.initialStep)
    currentScenarioEndStep.value = boundary(options.endStep)
    currentScenarioInstance.value += 1
    currentPreviewCue.value = options.previewCue || ''
    returnViewAfterPlayer.value = owner.returnView
    if (state.playerEntryRoute) state.playerEntryRoute.value = { ...owner.returnRoute }
    if (options.queueCommit) { queueStatus.value = 'ready'; options.queueCommit() }
    else if (!options.preserveQueue) {
      queue.clear()
      queueStatus.value = options.lazyQueue && resolveQueue ? 'idle' : 'ready'
    }
    owner.published = true
    owner.instance = currentScenarioInstance.value
    view.value = 'player'
    loading.value = false
    tracePlayer('player-published', { file: owner.name, instance: owner.instance })
    if (options.syncRoute !== false) syncRoute()
    return true
  }
  async function load(name, returnView = 'files', options = {}) {
    return navigation.run(async intent => {
      const owner = begin(intent, name, returnView, options)
      try {
        const scenario = await prepare(name, {
          isCurrent: owner.current, signal: owner.controller.signal, loadPlayer, preloadAssets,
          readScenario: options.readScenario,
          onBackgroundReady: (start, updatePriority, controls = {}) => {
            owner.warmup = { start, updatePriority, ...controls }
          },
          playbackEntry: { startStep: boundary(options.startStep), initialStep: boundary(options.initialStep), endStep: boundary(options.endStep) },
          onProgress: pct => { if (owner.current()) preloadProgress.value = pct },
          onStatus: status => { if (owner.current()) preloadStatus.value = status },
        })
        if (!scenario || !owner.current()) return false
        return publish(owner, scenario, options)
      } catch (failure) {
        if (!owner.current()) return false
        owner.controller.abort()
        owner.warmup?.dispose?.()
        error.value = failure.message
        const { intent: ignoredIntent, ...retryOptions } = options
        failedEntry = { name, returnView, options: { ...retryOptions, returnRoute: owner.returnRoute } }
        canRetry.value = true
        loading.value = false
        tracePlayer('entry-failed', { file: name, code: failure.code || failure.name, message: failure.message })
        onError(failure)
        return false
      }
    }, { intent: options.intent })
  }
  async function preview(makeScenario, cue, returnView, options = {}) {
    return navigation.run(async intent => {
      const owner = begin(intent, '', returnView, options)
      try {
        await withLoadDeadline(() => loadPlayer(), { signal: owner.controller.signal, timeoutMs: 25000, label: 'player-preview-module' })
        if (!owner.current()) return false
        return publish(owner, makeScenario(), { ...options, previewCue: cue })
      } catch (failure) {
        if (!owner.current()) return false
        error.value = failure.message
        loading.value = false
        onError(failure)
        return false
      }
    }, { intent: options.intent })
  }
  function startQueue(episodes, index, returnView) {
    const episode = episodes[index]
    if (!episode?.file) return
    return load(episode.file, returnView, { startStep: episode.startStep, endStep: episode.endStep,
      queueCommit: () => queue.start(episodes, index) })
  }
  function restore(name, returnView, range, episodes = [], intent, returnRoute) {
    return load(name, returnView, { ...range, intent, syncRoute: false, returnRoute,
      ...(episodes.length ? { queueCommit: () => queue.restore(episodes, name, range) } : { lazyQueue: true }) })
  }
  function ensureQueue({ retry = false } = {}) {
    const owner = active
    if (!owner?.current() || !owner.published || !resolveQueue ||
        queueStatus.value === 'ready' || (queueStatus.value === 'error' && !retry)) return Promise.resolve(false)
    if (owner.queueFlight) return owner.queueFlight
    queueStatus.value = 'loading'
    queueError.value = ''
    // Only called after the renderer's first playable report or an explicit retry.
    owner.queueFlight = Promise.resolve().then(() => resolveQueue(owner.returnRoute, {
      file: owner.name, startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value,
      signal: owner.controller.signal, priority: 'background',
    })).then(episodes => {
      if (!owner.current() || owner.instance !== currentScenarioInstance.value) return false
      queue.restore(episodes || [], owner.name, { startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value })
      queueStatus.value = 'ready'
      return true
    }).catch(failure => {
      if (owner.current()) { queueStatus.value = 'error'; queueError.value = failure.message }
      return false
    }).finally(() => { owner.queueFlight = null })
    return owner.queueFlight
  }
  function next() {
    if (loading.value) return false
    if (queueStatus.value === 'idle' || queueStatus.value === 'loading') {
      const owner = active
      return ensureQueue().then(() => owner?.current() ? next() : false)
    }
    const episode = queue.peekNext()
    if (!episode) return false
    return load(episode.file, returnViewAfterPlayer.value, {
      startStep: episode.startStep, endStep: episode.endStep,
      queueCommit: () => queue.next(),
    })
  }
  function retry() {
    if (!failedEntry || loading.value) return false
    const entry = failedEntry
    return load(entry.name, entry.returnView, entry.options)
  }
  function close() {
    const destination = pendingEntry.value?.returnView || failedEntry?.returnView || returnViewAfterPlayer.value || 'files'
    const returnRoute = pendingEntry.value?.returnRoute || failedEntry?.options.returnRoute || active?.returnRoute || null
    navigation.invalidate()
    reset()
    loading.value = false
    return returnTo(destination, returnRoute)
  }
  function ready() { if (!navigation.isPending()) loading.value = false }
  function readinessChanged(report) {
    if (!report || report.instance !== currentScenarioInstance.value || view.value !== 'player') return false
    playbackReadiness.value = { ...report }
    playbackBuffering.value = report.status === 'waiting'
    tracePlayer('renderer-readiness', { instance: report.instance, status: report.status, stepIndex: report.stepIndex })
    if (report.status === 'playable') {
      loading.value = false
      const owner = active
      if (owner?.current()) {
        owner.warmup?.setPaused?.(false)
        if (!owner.firstPlayable) {
          owner.firstPlayable = true
          void owner.warmup?.start?.()?.catch?.(() => {})
          void ensureQueue()
        }
      }
    } else active?.warmup?.setPaused?.(true)
    return true
  }
  function retryCurrentStep(stepIndex = playbackReadiness.value?.stepIndex) {
    if (!currentScenarioFile.value || loading.value || playbackBuffering.value) return false
    const initialStep = Number.isInteger(stepIndex) ? stepIndex + 1 : currentScenarioInitialStep.value
    return load(currentScenarioFile.value, returnViewAfterPlayer.value, {
      startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value,
      initialStep, preserveQueue: true,
      readScenario: active?.options.readScenario, returnRoute: active?.returnRoute,
    })
  }
  function stepChanged({ instance, stepIndex }) {
    const owner = active
    if (!owner?.current() || instance !== currentScenarioInstance.value || view.value !== 'player') return
    const scenario = currentScenario.value
    const startStep = currentScenarioStartStep.value || 1
    const endStep = currentScenarioEndStep.value || scenario?.steps?.length
    if (!Number.isInteger(stepIndex) || stepIndex < startStep - 1 || stepIndex >= endStep) return
    owner.warmup?.setPaused?.(true)
    owner.warmup?.updatePriority?.(createStoryAssetPriority(scenario, { startStep, endStep, initialStep: stepIndex + 1 }))
  }
  function dispose() { navigation.invalidate(); reset(); loading.value = false }
  return { currentScenario, currentScenarioInstance, currentScenarioInitialStep, error, preloadStatus,
    playbackBuffering, playbackReadiness, pendingEntry, canRetry, queue, hasNext: queue.hasNext,
    queueStatus, queueError, ensureQueue,
    inspect: () => ({ file: active?.name, firstPlayable: active?.firstPlayable, queueStatus: queueStatus.value,
      pending: Boolean(pendingEntry.value), readiness: playbackReadiness.value, error: error.value }),
    load, retry, retryCurrentStep, preview, startQueue, restore, next, close, ready, readinessChanged, stepChanged, reset, dispose }
}
