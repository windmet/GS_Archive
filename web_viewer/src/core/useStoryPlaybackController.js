import { computed, ref } from 'vue'
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
  resolveQueue = null, resolveReaderSource = null, onError = error => console.error('Failed to load:', error),
}) {
  const currentScenario = state.currentScenario || ref(null)
  const currentScenarioInstance = state.currentScenarioInstance || ref(0)
  const currentScenarioInitialStep = state.currentScenarioInitialStep || ref(null)
  const error = ref(''), preloadStatus = ref(null), playbackBuffering = ref(false)
  const playbackReadiness = ref(null), canRetry = ref(false), pendingEntry = ref(null)
  const queueStatus = ref('ready'), queueError = ref('')
  const continuation = ref(null)
  const continuationOverride = ref(null)
  const nextTarget = computed(() => {
    const segment = queue.peekNext()
    return segment ? { kind: 'segment', label: segment.label || segment.id, available: segment.exists !== false && Boolean(segment.file), reason: '此段尚未收录，连播停在此处' }
      : (continuation.value?.nextChapter ? { kind: 'chapter', ...continuation.value.nextChapter } : null)
  })
  let nextFlight = null
  let selectionFlight = null
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
    nextFlight = null
    selectionFlight = null
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
    continuation.value = null
    continuationOverride.value = null
    if (state.playMode) state.playMode.value = ''
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
    if (options.entryIntent === 'chapter' || options.entryIntent === 'segment') {
      continuationOverride.value = options.entryIntent === 'chapter'
      if (state.playMode) state.playMode.value = options.entryIntent
    }
    if (options.queueCommit) { queueStatus.value = options.lazyQueue && resolveQueue ? 'idle' : 'ready'; options.queueCommit(); continuation.value = options.continuation ?? continuation.value }
    else if (!options.preserveQueue) {
      queue.clear()
      continuation.value = null
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
        const readScenario = options.readScenario || (returnView === 'reader' && resolveReaderSource
          ? await resolveReaderSource(name, owner.returnRoute) : undefined)
        if (!owner.current()) return false
        const scenario = await prepare(name, {
          isCurrent: owner.current, signal: owner.controller.signal, loadPlayer, preloadAssets,
          readScenario,
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
  function startQueue(episodes, index, returnView, options = {}) {
    const episode = episodes[index]
    if (!episode?.file || episode.exists === false) return false
    return load(episode.file, returnView, { ...options, startStep: episode.startStep, endStep: episode.endStep,
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
    })).then(result => {
      if (!owner.current() || owner.instance !== currentScenarioInstance.value) return false
      const episodes = Array.isArray(result) ? result : result?.episodes
      continuation.value = Array.isArray(result) ? null : result
      queue.restore(episodes || [], owner.name, { startStep: currentScenarioStartStep.value, endStep: currentScenarioEndStep.value, verifiedWholeFile:owner.returnView === 'reader' })
      queueStatus.value = 'ready'
      return true
    }).catch(failure => {
      if (owner.current()) { queueStatus.value = 'error'; queueError.value = failure.message }
      return false
    }).finally(() => { owner.queueFlight = null })
    return owner.queueFlight
  }
  function next(instance = currentScenarioInstance.value, { chapter = false } = {}) {
    if (instance !== currentScenarioInstance.value) return false
    if (nextFlight) return nextFlight
    if (loading.value) return false
    const owner = active
    const run = async () => {
    if (queueStatus.value === 'idle' || queueStatus.value === 'loading') {
      await ensureQueue()
    }
    if (instance !== currentScenarioInstance.value || active !== owner) return false
    if (failedEntry && canRetry.value) return retry()
    if (!owner?.current() || queueStatus.value !== 'ready') return false
    const episode = queue.peekNext()
    if (!episode) {
      const target = continuation.value?.nextChapter
      if (!chapter || !target?.available) return false
      return startQueue(target.episodes, 0, returnViewAfterPlayer.value, {
        returnRoute: owner.returnRoute, lazyQueue: true, continuation: null,
      })
    }
    if (episode.exists === false || !episode.file) return false
    return load(episode.file, returnViewAfterPlayer.value, {
      startStep: episode.startStep, endStep: episode.endStep,
      returnRoute: owner.returnRoute,
      queueCommit: () => queue.next(),
    })
    }
    const flight = run()
    nextFlight = flight
    const settled = () => { if (nextFlight === flight) nextFlight = null }
    void flight.then(settled, settled)
    return flight
  }
  function retry() {
    if (!failedEntry || loading.value) return false
    const entry = failedEntry
    // A failed restored Reader entry may have canonicalized back to Reader.
    // A user retry is a new successful entry and must publish its player URL.
    return load(entry.name, entry.returnView, { ...entry.options, syncRoute:true })
  }
  function selectEpisode({ instance, queueRevision, entryKey, restart = false }) {
    const snapshot = queue.snapshot.value
    if (instance !== currentScenarioInstance.value || queueRevision !== snapshot.revision || queueStatus.value !== 'ready') return Promise.resolve(false)
    const entry = snapshot.entries.find(item => item.entryKey === entryKey)
    if (!entry?.available) return Promise.resolve(false)
    if (selectionFlight?.key === entryKey && selectionFlight.revision === queueRevision && selectionFlight.instance === instance) return selectionFlight.promise
    const returnRoute = active?.returnRoute
    if (snapshot.currentKey === entryKey && !restart) {
      if (!loading.value) return Promise.resolve(true)
      selectionFlight = null
      // A newer click on the mounted segment cancels pending preparation without
      // resetting its step or replacing its already verified scene.
      return navigation.run(async intent => {
        const owner = begin(intent, currentScenarioFile.value, returnViewAfterPlayer.value, { returnRoute })
        owner.published = true; owner.firstPlayable = true; owner.instance = currentScenarioInstance.value
        pendingEntry.value = null; loading.value = false
        return true
      })
    }
    const promise = load(entry.file, returnViewAfterPlayer.value, { startStep: entry.startStep, endStep: entry.endStep,
      returnRoute, queueCommit: () => queue.select(entryKey, queueRevision) })
    const flight = { key: entryKey, revision: queueRevision, instance, promise }
    selectionFlight = flight
    const settled = () => { if (selectionFlight === flight) selectionFlight = null }
    void promise.then(settled, settled)
    return promise
  }
  function setContinuous(value) {
    continuationOverride.value = Boolean(value)
    if (state.playMode) state.playMode.value = value ? 'chapter' : 'segment'
    syncRoute()
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
    playbackBuffering, playbackReadiness, pendingEntry, canRetry, queue, hasNext: computed(() => nextTarget.value?.kind === 'segment' && nextTarget.value.available), continuationOverride, setContinuous, selectEpisode,
    queueStatus, queueError, ensureQueue, continuation, nextTarget,
    inspect: () => ({ file: active?.name, firstPlayable: active?.firstPlayable, queueStatus: queueStatus.value,
      pending: Boolean(pendingEntry.value), readiness: playbackReadiness.value, error: error.value }),
    load, retry, retryCurrentStep, preview, startQueue, restore, next, close, ready, readinessChanged, stepChanged, reset, dispose }
}
