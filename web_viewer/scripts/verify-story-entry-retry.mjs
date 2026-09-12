import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { Preloader } from '../src/utils/Preloader.js'

const scenario = { steps: Array.from({ length: 5 }, (_, index) => ({ step_id: index + 1,
  state: { bg: `bg${index}`, spines: [] } })) }
let broken = true, reads = 0, commits = 0
const requests = [], preparedEntries = [], returns = []
class RetryPreloader extends Preloader {
  static async _preloadImage(url) {
    requests.push(url)
    if (broken && url.includes('bg2')) throw Error('fixture image failure')
    return 'image-loaded'
  }
}
const state = Object.fromEntries(['view', 'loading', 'preloadProgress', 'currentScenarioFile',
  'currentScenarioStartStep', 'currentScenarioEndStep', 'currentScenarioInitialStep', 'currentPreviewCue', 'returnViewAfterPlayer']
  .map(key => [key, ref(key === 'view' ? 'reader' : null)]))
const navigation = createArchiveNavigationCoordinator()
const player = useStoryPlaybackController({ state, navigation,
  prepare: (name, options) => {
    preparedEntries.push(options.playbackEntry)
    return prepareScenario(name, { ...options, fetchImpl: async () => new Response(JSON.stringify(scenario)) })
  }, loadPlayer: async () => {}, preloadAssets: (...args) => RetryPreloader.preloadScenario(...args),
  syncRoute() {}, returnTo: destination => returns.push(destination), onError() {},
})
const options = { startStep: 2, initialStep: 3, endStep: 4,
  readScenario: async response => { reads++; return response.json() }, queueCommit: () => { commits++ } }
await navigation.run(intent => player.load('fixture.json', 'reader', { ...options, intent }))
assert.equal(player.canRetry.value, true)
assert.equal(player.currentScenario.value, null, 'critical failure cannot mount scenario')
assert.equal(player.preloadStatus.value.phase, 'blocked')
assert.deepEqual(requests, ['/assets/bg/bg2.png'], 'lower tiers do not start after critical failure')
assert.equal(commits, 0)
broken = false
assert.equal(await player.retry(), true, 'retry must acquire fresh intent rather than reuse failed inherited intent')
assert.equal(reads, 2, 'Reader source validator runs again')
assert.deepEqual(preparedEntries[1], preparedEntries[0])
assert.equal(state.currentScenarioInitialStep.value, 3)
assert.equal(state.currentScenarioStartStep.value, 2)
assert.equal(state.currentScenarioEndStep.value, 4)
assert.equal(commits, 1, 'queue commits only on success')
assert.equal(player.canRetry.value, false)
assert.equal(player.error.value, '')
broken = true
await player.load('fixture.json', 'reader', options)
player.close()
assert.equal(returns.at(-1), 'reader', 'failed entry owns return destination before publication')
assert.equal(await player.retry(), false, 'return clears retry')
await player.load('fixture.json', 'story_collection', options)
await navigation.run(() => {})
assert.equal(player.canRetry.value, false, 'unrelated navigation clears obsolete recovery')
assert.equal(player.error.value, '')
assert.equal(await player.retry(), false)
console.log('Entry retry verified: critical failure blocks mount/lower tiers, fresh intent, Reader validation, range preservation, queue commit and return/invalidation')
