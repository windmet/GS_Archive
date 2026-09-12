import assert from 'node:assert/strict'
import { ref } from 'vue'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

function setup() {
  const requests = [], writes = [], returns = [], errors = []
  const state = { ...useArchiveNavigationState(), loading: ref(false), preloadProgress: ref(0) }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false } })
  const controller = useStoryPlaybackController({ state, navigation,
    prepare: (file, options) => new Promise((resolve, reject) => requests.push({ file, options, resolve, reject })),
    loadPlayer: async () => {}, preloadAssets: async () => {},
    syncRoute: () => writes.push(state.currentArchiveRoute()),
    returnTo: destination => { state.view.value = destination; returns.push(destination) },
    onError: failure => errors.push(failure.message),
  })
  const reply = (index = requests.length - 1) => requests[index].resolve({ scenario_id: requests[index].file, steps: [{ step_id: 1 }] })
  return { state, navigation, controller, requests, writes, returns, errors, reply }
}
const episodes = [{ id: 'a', file: 'shared.json', startStep: 2, endStep: 8 },
  { id: 'b', file: 'shared.json', startStep: 12, endStep: 20 }]
{
  const t = setup()
  const first = t.controller.startQueue(episodes, 0, 'story_collection')
  assert.equal(t.controller.queue.current.value, null, 'queue must not commit before preparation')
  t.reply(); assert.equal(await first, true)
  const previousInstance = t.controller.currentScenarioInstance.value
  const next = t.controller.next()
  assert.equal(t.controller.queue.current.value.id, 'a')
  t.requests[1].reject(Error('failed next episode')); assert.equal(await next, false)
  assert.equal(t.controller.queue.current.value.id, 'a', 'failed next must not skip the episode on retry')
  assert.equal(t.state.currentScenarioStartStep.value, 2)
  assert.equal(t.controller.currentScenarioInstance.value, previousInstance)
  const retry = t.controller.next(); t.reply(); await retry
  assert.equal(t.controller.queue.current.value.id, 'b')
  assert.equal(t.state.currentScenarioStartStep.value, 12)
  assert.equal(t.state.currentScenarioEndStep.value, 20)
  assert.equal(t.controller.currentScenarioInstance.value, previousInstance + 1)
  assert.equal(t.controller.hasNext.value, false)
  t.controller.close()
  assert.equal(t.state.view.value, 'story_collection')
  assert.equal(t.controller.currentScenario.value, null)
  assert.equal(t.state.currentScenarioFile.value, '')
  assert.equal(t.controller.queue.current.value, null)
  assert.equal(t.controller.error.value, '')
}
{
  const t = setup()
  const old = t.controller.load('old.json', 'story_detail')
  t.controller.close()
  const current = t.controller.load('current.json', 'home')
  t.requests[0].options.onProgress(99)
  t.requests[0].options.onStatus({ phase: 'partial', failed: 7 })
  assert.equal(t.controller.preloadStatus.value, null, 'stale status cannot publish into new preparation')
  assert.equal(t.state.preloadProgress.value, 0)
  t.reply(0); await old
  assert.equal(t.controller.currentScenario.value, null)
  assert.equal(t.state.loading.value, true)
  t.requests[1].options.onStatus({ phase: 'partial', failed: 1 })
  t.reply(1); await current
  assert.equal(t.controller.preloadStatus.value.failed, 1, 'current report stays available after publish')
  assert.equal(t.state.currentScenarioFile.value, 'current.json')
  assert.equal(t.writes.length, 1)
  t.controller.close()
  assert.equal(t.controller.preloadStatus.value, null)
}
{
  const t = setup()
  const current = t.controller.load('current.json')
  t.requests[0].options.onStatus({ phase: 'warming', succeeded: 2 })
  t.reply(); await current
  await t.navigation.run(() => { t.state.view.value = 'home' })
  assert.equal(t.controller.preloadStatus.value, null, 'other navigation clears the previous report')
}
{
  const t = setup()
  await t.navigation.run(async intent => {
    const restore = t.controller.restore('shared.json', 'story_collection', { startStep: 12, endStep: 20 }, episodes, intent)
    t.reply(); await restore
  }, { restoring: true })
  assert.equal(t.controller.queue.current.value.id, 'b')
  assert.equal(t.writes.length, 0)
  const firstInstance = t.controller.currentScenarioInstance.value
  assert.equal(await t.controller.preview(() => ({ steps: [{ text: 'preview' }] }), 'voice', 'card_detail'), true)
  assert.equal(t.state.currentPreviewCue.value, 'voice')
  assert.equal(t.controller.currentScenarioInstance.value, firstInstance + 1)
  assert.equal(t.state.currentScenarioStartStep.value, null)
  assert.equal(t.controller.queue.current.value, null)
  t.controller.close()
  assert.equal(t.returns.at(-1), 'card_detail')
}
{
  const t = setup()
  assert.equal(await t.controller.preview(() => { throw Error('bad preview') }, 'voice', 'card_detail'), false)
  assert.equal(t.controller.error.value, 'bad preview')
  assert.equal(t.state.loading.value, false)
  const pending = t.controller.load('disposed.json')
  t.controller.dispose()
  t.navigation.dispose()
  t.requests[0].reject(Error('late failure'))
  await pending
  assert.equal(t.controller.currentScenario.value, null)
  assert.deepEqual(t.errors, ['bad preview'])
  assert.equal(t.state.loading.value, false)
}
console.log('Playback controller verified: atomic queue/cursor, retry, same-file ranges, restoration, preview, close and disposal')
