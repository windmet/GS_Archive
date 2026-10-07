import assert from 'node:assert/strict'
import { ref } from 'vue'
import { readFileSync } from 'node:fs'
import { buildIdolStoryPage } from '../src/data/idolCommunicationSelectors.js'
import { buildStoryCatalog } from '../src/data/archiveSelectors.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { queueEpisodeLabel, playerEpisodeLabel } from '../src/presentation/idolEpisodeLabel.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

function setup(overrides = {}) {
  const requests = [], writes = [], returns = [], errors = []
  const state = { ...useArchiveNavigationState(), loading: ref(false), preloadProgress: ref(0) }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false } })
  // The host (App.vue) formats queue labels with the same presenter.
  const controller = useStoryPlaybackController({ state, navigation, queue: useEpisodeQueue({ formatLabel: queueEpisodeLabel }),
    prepare: (file, options) => new Promise((resolve, reject) => requests.push({ file, options, resolve, reject })),
    loadPlayer: async () => {}, preloadAssets: async () => {},
    syncRoute: () => writes.push(state.currentArchiveRoute()),
    returnTo: destination => { state.view.value = destination; returns.push(destination) },
    onError: failure => errors.push(failure.message),
    ...overrides,
  })
  const reply = (index = requests.length - 1) => requests[index].resolve({ scenario_id: requests[index].file, steps: [{ step_id: 1 }] })
  return { state, navigation, controller, requests, writes, returns, errors, reply }
}
const pickerEpisodes = [{id:'one',file:'one.json',label:'エピソード1'}, {id:'two',file:'two.json',label:'エピソード2'}, {id:'three',file:'three.json',label:'エピソード3'}]
{
  const read = name => JSON.parse(readFileSync(new URL(`../public/data/masterdata/${name}.json`, import.meta.url), 'utf8'))
  const page = buildIdolStoryPage(read('idol_episode_index'), {},
    buildStoryCatalog(read('story_catalog'), read('story_presentation_index')), {}, '001tom')
  const episodes = page.sections.find(section => section.id === 20101).episodes.filter(episode => episode.exists && episode.file)
  assert.equal(episodes[1].id, 2010102)
  assert.equal(episodes[1].name, 'エピソード2')
  const t = setup()
  const initial = t.controller.startQueue(episodes, 0, 'idol_story_archive')
  t.reply(); await initial
  assert.equal(playerEpisodeLabel(t.controller.nextTarget.value.label), 'EP02', 'real personal-story next target uses its episode name, not numeric id')
  t.controller.reset()
  const queue = useEpisodeQueue({ formatLabel: queueEpisodeLabel })
  assert.ok(queue.restore(episodes, episodes[0].file, episodes[0]))
  assert.equal(playerEpisodeLabel(queue.peekNext().label), 'EP02', 'restored queue uses the same name fallback')
  queue.start([{ ...episodes[0], label: 'Explicit label' }], 0)
  assert.equal(queue.current.value.label, 'Explicit label', 'explicit labels retain priority over names')
}
{
  const t=setup()
  const initial=t.controller.startQueue(pickerEpisodes,0,'story_collection',{entryIntent:'chapter'})
  assert.equal(t.controller.continuationOverride.value,null,'entry intent only commits after successful entry')
  t.reply();await initial
  assert.equal(t.controller.continuationOverride.value,true)
  assert.equal(t.state.playMode.value,'chapter')
  const snapshot=t.controller.queue.snapshot.value, instance=t.controller.currentScenarioInstance.value
  const target=index=>({instance,queueRevision:snapshot.revision,entryKey:snapshot.entries[index].entryKey})
  const older=t.controller.selectEpisode(target(2))
  assert.equal(t.controller.selectEpisode(target(2)),older,'same target double click coalesces')
  const newer=t.controller.selectEpisode(target(1))
  assert.equal(t.requests[1].options.signal.aborted,true)
  t.reply(1);assert.equal(await older,false)
  t.reply(2);assert.equal(await newer,true)
  assert.equal(t.state.currentScenarioFile.value,'two.json')
  assert.equal(t.controller.queue.current.value.id,'two')
  assert.equal(t.controller.queue.current.value.label,'EPISODE 02')
  assert.equal(t.controller.continuationOverride.value,true,'selection retains session continuation')
  assert.equal(await t.controller.selectEpisode(target(0)),false,'old snapshot/instance cannot select into new scene')
  t.controller.close();assert.equal(t.controller.continuationOverride.value,null)
  const single=t.controller.startQueue(pickerEpisodes,1,'story_collection',{entryIntent:'segment'})
  t.reply();await single;assert.equal(t.controller.continuationOverride.value,false)
}
{
  const t=setup(), initial=t.controller.startQueue(pickerEpisodes,0,'story_collection')
  t.reply();await initial
  const instance=t.controller.currentScenarioInstance.value, snapshot=t.controller.queue.snapshot.value
  const target=index=>({instance,queueRevision:snapshot.revision,entryKey:snapshot.entries[index].entryKey})
  const pending=t.controller.selectEpisode(target(2))
  assert.equal(await t.controller.selectEpisode(target(0)),true,'newer current-segment choice cancels preparation without restarting')
  assert.equal(t.controller.currentScenarioInstance.value,instance)
  assert.equal(t.state.currentScenarioFile.value,'one.json')
  assert.equal(t.controller.queue.current.value.id,'one')
  const renewed=t.controller.selectEpisode(target(2))
  assert.notEqual(renewed,pending,'a new choice after cancellation cannot coalesce with the obsolete request')
  assert.equal(await t.controller.selectEpisode(target(0)),true)
  t.reply(2);assert.equal(await renewed,false)
  t.reply(1);assert.equal(await pending,false)
  assert.equal(t.state.currentScenarioFile.value,'one.json')
  const failure=t.controller.selectEpisode(target(1))
  t.requests[3].reject(Error('picker target HTTP503'));assert.equal(await failure,false)
  assert.equal(t.controller.queue.current.value.id,'one')
  const retry=t.controller.retry();t.reply(4);assert.equal(await retry,true)
  assert.equal(t.controller.queue.current.value.id,'two')
  t.controller.dispose()
}
console.log('Picker: transaction identity, same-target coalescing, newer intent, current-segment cancellation, failure/retry, cursor consistency and session-only intent passed')
{
  const t=setup()
  const restored=t.controller.restore('three.json','reader',{startStep:1,endStep:1,entryIntent:'segment'},[],undefined,{view:'reader',reading:'original-doc',readingScope:'chapter'})
  t.requests[0].reject(Error('restoration source guard rejection'));assert.equal(await restored,false)
  assert.equal(t.writes.length,0)
  const retry=t.controller.retry();t.reply(1);assert.equal(await retry,true)
  assert.equal(t.writes.length,1,'successful user retry publishes the current player URL')
  assert.equal(t.writes[0].view,'player');assert.equal(t.writes[0].scenario,'three.json')
  assert.equal(t.writes[0].reading,'original-doc');assert.equal(t.writes[0].readingScope,'chapter')
  t.controller.dispose()
}
const episodes = [{ id: 'a', file: 'shared.json', startStep: 2, endStep: 8 },
  { id: 'b', file: 'shared.json', startStep: 12, endStep: 20 }]
{
  const t = setup()
  const first = t.controller.startQueue(episodes, 0, 'story_collection')
  assert.equal(t.controller.queue.current.value, null, 'queue must not commit before preparation')
  t.reply(); assert.equal(await first, true)
  assert.equal(t.controller.playbackBuffering.value, true, 'published player waits for source-bound scene readiness')
  const firstInstance = t.controller.currentScenarioInstance.value
  assert.equal(t.controller.readinessChanged({ instance: firstInstance - 1, status: 'playable' }), false)
  assert.equal(t.controller.playbackBuffering.value, true, 'stale renderer cannot release current buffering')
  assert.equal(t.controller.readinessChanged({ instance: firstInstance, status: 'waiting', stepIndex: 1 }), true)
  assert.equal(t.controller.playbackBuffering.value, true)
  assert.equal(t.controller.readinessChanged({ instance: firstInstance, status: 'playable', stepIndex: 1 }), true)
  assert.equal(t.controller.playbackBuffering.value, false)
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
  const load = t.controller.load('render-retry.json', 'story_detail', { startStep: 2, endStep: 8 })
  t.reply(); await load
  const instance = t.controller.currentScenarioInstance.value
  t.controller.readinessChanged({ instance, status: 'blocked', stepIndex: 4, reason: 'background-renderable' })
  assert.equal(t.controller.playbackBuffering.value, false, 'blocked render reveals recovery UI instead of an endless overlay')
  const retry = t.controller.retryCurrentStep()
  assert.ok(retry instanceof Promise)
  assert.equal(t.requests[1].file, 'render-retry.json')
  t.reply(1); await retry
  assert.equal(t.state.currentScenarioStartStep.value, 2)
  assert.equal(t.state.currentScenarioEndStep.value, 8)
  assert.equal(t.state.currentScenarioInitialStep.value, 5, 'retry resumes at the blocked source index')
  assert.equal(t.controller.currentScenarioInstance.value, instance + 1)
  assert.equal(t.controller.playbackBuffering.value, true)
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

for (const destination of ['reader', 'card_detail', 'idol_story']) {
  const t = setup()
  const pending = t.controller.load('cancel-before-publish.json', destination)
  assert.equal(t.controller.pendingEntry.value.returnView, destination)
  t.controller.close()
  assert.equal(t.state.view.value, destination)
  assert.equal(t.requests[0].options.signal.aborted, true)
  t.reply()
  assert.equal(await pending, false)
  assert.equal(t.controller.currentScenario.value, null)
  assert.equal(t.state.loading.value, false)
  assert.equal(t.writes.length, 0)
}
console.log('Pending-entry cancellation returns to source and rejects stale publication')

{
  const t = setup()
  const initial = t.controller.startQueue([...episodes, { id: 'c', file: 'c.json' }], 0, 'story_collection')
  t.reply(); await initial
  const instance = t.controller.currentScenarioInstance.value
  const manual = t.controller.next(instance), automatic = t.controller.next(instance)
  assert.equal(manual, automatic, 'concurrent navigation requests share one flight')
  assert.equal(t.requests.length, 2)
  t.reply(); await manual
  assert.equal(t.controller.queue.current.value.id, 'b')
  assert.equal(t.controller.next(instance), false, 'late callback from old keyed viewer cannot skip another episode')
  const failed = t.controller.next(t.controller.currentScenarioInstance.value)
  t.requests[2].reject(Error('503')); await failed
  assert.equal(t.controller.queue.current.value.id, 'b')
  const retry = t.controller.retry(); t.reply(); await retry
  assert.equal(t.controller.queue.current.value.id, 'c')
}
{
  const t = setup()
  const initial = t.controller.startQueue([episodes[0]], 0, 'reader', { returnRoute: { view: 'reader', reading: 'source', readingRow: 'original-row' },
    continuation: { nextChapter: { id: 'next', label: '第6话', available: true, episodes: [episodes[1]] } } })
  t.reply(); await initial
  const instance = t.controller.currentScenarioInstance.value
  assert.equal(await t.controller.next(instance), false, 'continuous playback never crosses chapter boundary')
  const manual = t.controller.next(instance, { chapter: true }); t.reply(); await manual
  assert.equal(t.state.playerEntryRoute.value.readingRow, 'original-row', 'Reader return locator survives chapter navigation')
}
console.log('Navigation competition, failure/retry, manual canonical chapter and Reader return locator passed')

{
  let rejectSource = true
  const guard = () => {}
  const t = setup({ resolveReaderSource: async () => {
    if (rejectSource) throw Error('Reader source mismatch')
    return guard
  } })
  const initial = t.controller.startQueue(episodes, 0, 'reader', { readScenario: guard,
    returnRoute: { view: 'reader', reading: 'original', readingRow: 'kept' } })
  t.reply(); await initial
  assert.equal(await t.controller.next(), false)
  assert.equal(t.requests.length, 1, 'source validation rejects before media preparation')
  assert.equal(t.controller.queue.current.value.id, 'a')
  rejectSource = false
  const retry = t.controller.retry()
  await Promise.resolve(); await Promise.resolve()
  assert.equal(t.requests[1].options.readScenario, guard)
  t.reply(); await retry
  assert.equal(t.controller.queue.current.value.id, 'b')
  assert.equal(t.state.playerEntryRoute.value.readingRow, 'kept')
}
console.log('Reader continuation rejects source mismatch, retries with the guard and retains its original return anchor')
