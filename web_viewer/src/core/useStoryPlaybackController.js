import { ref } from 'vue'
import { useEpisodeQueue } from './useEpisodeQueue.js'
import { prepareScenario } from '../data/prepareScenario.js'

const boundary = value => Number(value) > 0 ? Number(value) : null

/** Sole writer of playback entry, range, queue, preview, loading and return state.
 * URL refs are borrowed from navigation, never copied into another store. */
export function useStoryPlaybackController({ state, navigation, loadPlayer, preloadAssets,
  syncRoute, returnTo, prepare = prepareScenario, queue = useEpisodeQueue(),
  onError = error => console.error('Failed to load:', error),
}) {
  const currentScenario = state.currentScenario || ref(null)
  const currentScenarioInstance = state.currentScenarioInstance || ref(0)
  const error = ref('')
  const preloadStatus = ref(null)
  const currentScenarioInitialStep = state.currentScenarioInitialStep || ref(null)
  const { view, loading, preloadProgress, currentScenarioFile, currentScenarioStartStep,
    currentScenarioEndStep, currentPreviewCue, returnViewAfterPlayer } = state

  function reset() {
    preloadStatus.value = null
    currentScenario.value = null
    currentScenarioFile.value = ''
    currentScenarioStartStep.value = null
    currentScenarioInitialStep.value = null
    currentScenarioEndStep.value = null
    currentPreviewCue.value = ''
    returnViewAfterPlayer.value = 'files'
    queue.clear()
    error.value = ''
  }
  function publish(scenario, file, returnView, options = {}) {
    currentScenario.value = scenario
    currentScenarioFile.value = file
    currentScenarioStartStep.value = boundary(options.startStep)
    currentScenarioInitialStep.value = boundary(options.initialStep)
    currentScenarioEndStep.value = boundary(options.endStep)
    currentScenarioInstance.value += 1
    currentPreviewCue.value = options.previewCue || ''
    returnViewAfterPlayer.value = returnView
    if (options.queueCommit) options.queueCommit()
    else if (!options.preserveQueue) queue.clear()
    view.value = 'player'
    loading.value = false
    if (options.syncRoute !== false) syncRoute()
  }
  async function load(name, returnView = 'files', options = {}) {
    return navigation.run(async intent => {
      // Navigation revokes the previous intent synchronously before starting
      // its successor, so an abandoned warming report must leave with it.
      intent.signal?.addEventListener('abort', () => { preloadStatus.value = null }, { once: true })
      loading.value = true
      preloadProgress.value = 0
      preloadStatus.value = null
      error.value = ''
      try {
        const scenario = await prepare(name, {
          isCurrent: intent.isCurrent, signal: intent.signal, loadPlayer, preloadAssets, readScenario: options.readScenario,
          playbackEntry: { startStep: boundary(options.startStep), initialStep: boundary(options.initialStep), endStep: boundary(options.endStep) },
          onProgress: pct => { if (intent.isCurrent()) preloadProgress.value = pct },
          onStatus: status => { if (intent.isCurrent()) preloadStatus.value = status },
        })
        if (!scenario || !intent.isCurrent()) return false
        publish(scenario, name, returnView, options)
        return true
      } catch (failure) {
        if (!intent.isCurrent()) return false
        error.value = failure.message
        loading.value = false
        onError(failure)
        return false
      }
    }, { intent: options.intent })
  }
  async function preview(makeScenario, cue, returnView, options = {}) {
    return navigation.run(async intent => {
      loading.value = true
      preloadProgress.value = 100
      preloadStatus.value = null
      error.value = ''
      try {
        await loadPlayer()
        if (!intent.isCurrent()) return false
        publish(makeScenario(), '', returnView, { ...options, previewCue: cue })
        return true
      } catch (failure) {
        if (!intent.isCurrent()) return false
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
  function restore(name, returnView, range, episodes, intent) {
    return load(name, returnView, { ...range, intent, syncRoute: false,
      queueCommit: () => queue.restore(episodes, name, range) })
  }
  function next() {
    const episode = queue.peekNext()
    if (!episode) return
    return load(episode.file, returnViewAfterPlayer.value, {
      startStep: episode.startStep, endStep: episode.endStep,
      queueCommit: () => queue.next(),
    })
  }
  function close() {
    navigation.invalidate()
    const destination = returnViewAfterPlayer.value || 'files'
    reset()
    returnViewAfterPlayer.value = 'files'
    loading.value = false
    return returnTo(destination)
  }
  function ready() { if (!navigation.isPending()) loading.value = false }
  function dispose() { navigation.invalidate(); reset(); loading.value = false }
  return { currentScenario, currentScenarioInstance, currentScenarioInitialStep, error, preloadStatus, queue, hasNext: queue.hasNext,
    load, preview, startQueue, restore, next, close, ready, reset, dispose }
}
