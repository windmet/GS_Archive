import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { buildCardVoicePreviewScenario } from '../src/data/cardVoicePreview.js'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const functionSource = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)))
const scenarioSource = functionSource('async function loadScenario(', 'onMounted(async () =>')
const flush = async (predicate = null) => {
  if (!predicate) { for (let i = 0; i < 20; i++) await Promise.resolve(); return }
  const deadline = Date.now() + 3000
  while (!predicate()) {
    assert.ok(Date.now() < deadline, 'preparation did not reach its expected boundary')
    await new Promise(resolve => setImmediate(resolve))
  }
}
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const requests = [], writes = [], errors = []
  const state = useArchiveNavigationState()
  const loading = { value: false }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { loading.value = false } })
  const context = vm.createContext({
    ...state, navigation, loading, preloadProgress: { value: 0 },
    buildCardVoicePreviewScenario, idolDisplayName: id => `speaker:${id}`,
    archiveRouteReady: true,
    archiveHomeIdols: { value: [] }, idolEpisodeData: { value: {} },
    mobileArchiveData: { value: {} }, idolUnitData: { value: {} },
    ensureCardDetailData: async () => {}, ensureIdolCommunicationData: async () => {},
    resolveRouteGroup: () => null, resolveRouteUnit: () => null, resolveRouteEpisode: () => null,
    currentStoryCollection: { value: null }, currentEventEpisodes: { value: [] }, currentIdolStoryPage: { value: null },
    spineViewerLoader: async () => {}, chibiStageViewerLoader: async () => {},
    captureDetailSource: () => {},
    currentScenario: { value: null }, currentScenarioInstance: { value: 0 },
    episodeQueue: useEpisodeQueue(),
    storyViewerLoader: async () => {},
    Preloader: { preloadScenario: async () => {} },
    fetch: () => { const request = deferred(); requests.push(request); return request.promise },
    writeArchiveRoute: route => writes.push(route),
    console: { error: (...args) => errors.push(args) },
  })
  context.prepareScenario = (name, options) => prepareScenario(name, { ...options, fetchImpl: (...args) => context.fetch(...args) })
  context.playbackController = useStoryPlaybackController({ state: context, navigation, queue: context.episodeQueue,
    loadPlayer: () => context.storyViewerLoader(), preloadAssets: (...args) => context.Preloader.preloadScenario(...args),
    prepare: (...args) => context.prepareScenario(...args), syncRoute: () => context.syncArchiveRoute(),
    returnTo: destination => context.commitView(destination), onError: (...args) => context.console.error(...args),
  })
  const production = vm.runInContext([
    functionSource('function syncArchiveRoute(', 'function groupsForRoute('),
    functionSource('async function applyArchiveRoute(', 'function goHome('),
    functionSource('function playbackEpisodes(', 'function openEventCard('),
    functionSource('async function openStoryCatalog(', 'function openExternalStoryResources('),
    functionSource('async function openSpineLab(', 'async function openChibiStage('),
    functionSource('async function openVoicePreview(', 'function openGroup('),
    functionSource('function onPlayerReady(', 'function formatFileName('),
    scenarioSource,
    '({ load: loadScenario, restore: applyArchiveRoute, commit: commitView, select: commitArchiveSelection, onPlayerReady, openStoryCatalog, openSpineLab, openVoicePreview, sync: syncArchiveRoute, filter: updateArchiveFilter })',
  ].join('\n'), context)
  const respond = (index, name) => requests[index].resolve(new Response(JSON.stringify({ name, steps: [] })))
  return { context, state, ...production, requests, respond, writes, errors }
}
{
  const t = setup()
  const old = t.load('old.json'), current = t.load('current.json')
  t.respond(1, 'current'); await current
  t.respond(0, 'old'); await old
  assert.equal(t.state.currentScenarioFile.value, 'current.json', 'late scenario replaced the current selection')
  assert.equal(t.writes.length, 1)
}
// A synchronous menu action supersedes a pending scenario request.
{
  const t = setup()
  const pending = t.load('old.json')
  t.commit('song_catalog')
  t.respond(0, 'old'); await pending
  assert.equal(t.state.view.value, 'song_catalog')
  assert.equal(t.state.currentScenarioFile.value, '')
  assert.equal(t.writes.length, 1)
  assert.equal(t.context.loading.value, false)
}
// Stale preloading must not change a newer load's progress or loading overlay.
{
  const t = setup(), preload = deferred()
  let progress
  t.context.Preloader.preloadScenario = (_steps, callback) => { progress = callback; return preload.promise }
  const old = t.load('old.json'); t.respond(0, 'old'); await flush(() => !!progress)
  const current = t.load('current.json')
  t.onPlayerReady()
  assert.equal(t.context.loading.value, true, 'old player ready cannot clear a pending navigation overlay')
  progress(99)
  assert.equal(t.context.preloadProgress.value, 0)
  preload.resolve(); await old
  assert.equal(t.context.loading.value, true)
  t.context.Preloader.preloadScenario = async () => {}
  t.respond(1, 'current'); await current
  assert.equal(t.state.currentScenarioFile.value, 'current.json')
}
{
  const t = setup()
  const old = t.load('old.json')
  t.state.currentCharacterId.value = '001tom'
  t.select()
  t.respond(0, 'old'); await old
  assert.equal(t.state.currentScenarioFile.value, '')
  assert.equal(t.writes.length, 1)
}
// Older history restore cannot write selections after its data dependency resolves.
{
  const t = setup(), data = deferred()
  t.context.ensureIdolCommunicationData = () => data.promise
  const old = t.restore({ view: 'story_catalog', query: 'old' })
  await t.restore({ view: 'home', query: 'current' })
  data.resolve(); await old
  assert.equal(t.state.view.value, 'home')
  assert.equal(t.state.filterQuery.value, 'current')
  assert.equal(t.writes.length, 0)
}
// Nested player loading belongs to its history restore. Old completion cannot
// release the new restore's history-write suppression.
{
  const t = setup(), data = deferred()
  t.context.ensureIdolCommunicationData = () => data.promise
  const old = t.restore({ view: 'story_catalog' })
  const current = t.restore({ view: 'player', scenario: 'current.json', startStep: 3, endStep: 9, returnView: 'story_collection' })
  data.resolve(); await old
  assert.equal(t.context.navigation.isRestoring(), true)
  t.sync({ replace: true }); assert.equal(t.writes.length, 0)
  t.respond(0, 'current'); await current
  assert.equal(t.context.navigation.isRestoring(), false)
  assert.equal(t.state.currentScenarioStartStep.value, 3)
  assert.equal(t.state.currentScenarioEndStep.value, 9)
  assert.equal(t.state.returnViewAfterPlayer.value, 'story_collection')
  assert.equal(t.writes.length, 0)
}
// Lazy feature openers also lose ownership when another view is selected.
{
  const t = setup()
  t.context.currentStoryCollection.value = { chapters: [{ episodes: [
    { id: 'first', file: 'shared.json', startStep: 2, endStep: 10 },
    { id: 'second', file: 'shared.json', startStep: 12, endStep: 20 },
  ] }] }
  const restored = t.restore({ view: 'player', scenario: 'shared.json', returnView: 'story_collection', startStep: 12, endStep: 20 })
  t.respond(0, 'shared'); await restored
  assert.equal(t.context.episodeQueue.current.value.id, 'second')
  assert.equal(t.context.episodeQueue.hasNext.value, false)
}
{
  const t = setup(), data = deferred()
  t.context.ensureIdolCommunicationData = () => data.promise
  const old = t.openStoryCatalog()
  t.commit('home'); data.resolve(); await old
  assert.equal(t.state.view.value, 'home')
  assert.equal(t.writes.length, 1)
}
{
  const t = setup(), module = deferred()
  t.context.spineViewerLoader = () => module.promise
  const old = t.openSpineLab()
  t.commit('home'); module.reject(new Error('late module failure')); await old
  assert.equal(t.state.view.value, 'home')
  assert.equal(t.context.loading.value, false)
}
// Current failures remain visible; disposal prevents late publication and new jobs.
{
  const t = setup()
  const failed = t.load('broken.json')
  t.requests[0].reject(new Error('network failed')); await failed
  assert.equal(t.errors.length, 1)
  assert.equal(t.context.loading.value, false)
  const old = t.load('old.json')
  t.context.navigation.dispose(); t.respond(1, 'old'); await old
  assert.equal(t.state.currentScenarioFile.value, '')
  await t.load('after-dispose.json')
  assert.equal(t.requests.length, 2)
  assert.equal(t.context.navigation.isPending(), false)
  assert.equal(t.context.navigation.isRestoring(), false)
}
{
  const t = setup(), module = deferred()
  t.context.storyViewerLoader = () => module.promise
  const old = t.openVoicePreview({ resource_id: '001tom_card', character_id: '001tom' }, 'old', 'cards')
  t.commit('home'); module.resolve(); await old
  assert.equal(t.context.currentScenario.value, null)
  t.state.currentCharacterId.value = '001tom'
  t.context.episodeQueue.start([{ file: 'old-a.json' }, { file: 'old-b.json' }], 0)
  await t.openVoicePreview({ resource_id: '002kao_card', character_id: '002kao' }, 'current', 'card_detail')
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.context.currentScenario.value.steps[0].dialogue.speaker, 'speaker:002kao')
  assert.equal(t.state.currentPreviewCue.value, 'current')
  assert.equal(t.state.returnViewAfterPlayer.value, 'card_detail')
  assert.equal(t.context.episodeQueue.hasNext.value, false)
}
{
  const t = setup(), detail = deferred()
  t.state.view.value = 'cards'
  t.context.ensureIdolCommunicationData = () => detail.promise
  const pending = t.restore({ view: 'idol_detail', query: 'old route' })
  await flush()
  t.filter('filterQuery', 'new search')
  assert.equal(t.context.navigation.isPending(), false, 'explicit user filtering supersedes pending route restoration')
  detail.resolve()
  await pending
  assert.equal(t.state.view.value, 'cards')
  assert.equal(t.state.filterQuery.value, 'new search')
  assert.equal(t.context.loading.value, false)
}
{
  const t = setup()
  const pending = t.load('keep.json')
  t.filter('filterQuery', t.state.filterQuery.value)
  assert.equal(t.context.navigation.isPending(), true, 'unchanged input must not cancel navigation')
  t.respond(0, 'keep'); await pending
  assert.equal(t.state.currentScenarioFile.value, 'keep.json')
}
for (const key of ['currentIdolUnitFilter', 'currentCardRarity', 'currentCardAssetState', 'currentCardRelationState', 'currentGashaCategory', 'currentSongScope', 'currentStorySection', 'currentEventScope', 'currentStoryAvailability', 'currentStorySort']) {
  const t = setup()
  t.state.view.value = 'cards'
  const pending = t.load('stale.json')
  t.filter(key, 'new-selection')
  t.respond(0, 'stale'); await pending
  assert.equal(t.state[key].value, 'new-selection')
  assert.equal(t.state.view.value, 'cards')
  assert.equal(t.state.currentScenarioFile.value, '')
}
for (const response of [
  { ok: false, status: 404, json: async () => ({ error: 'not found' }) },
  new Response(JSON.stringify({ error: 'invalid scenario' })),
  new Response(JSON.stringify({ steps: {} })),
  new Response('null'),
]) {
  const t = setup()
  t.state.view.value = 'cards'
  let preloads = 0
  t.context.Preloader.preloadScenario = async () => { preloads++ }
  const pending = t.load('invalid.json')
  t.requests[0].resolve(response)
  await pending
  assert.equal(t.state.view.value, 'cards', 'failed or malformed response must not enter player')
  assert.equal(t.state.currentScenarioFile.value, '')
  assert.equal(t.writes.length, 0)
  assert.equal(preloads, 0)
  assert.equal(t.errors.length, 1)
  assert.equal(t.context.loading.value, false)
}
{
  const t = setup()
  const pending = t.load('obsolete.json')
  t.commit('home')
  let parsed = false
  t.requests[0].resolve({ ok: false, status: 500, json: async () => { parsed = true; return {} } })
  await pending
  assert.equal(parsed, false, 'superseded response must not be parsed')
  assert.equal(t.errors.length, 0)
}
{
  const player = deferred(), assets = deferred()
  const scenario = { steps: [{ step_id: 1 }], title: 'fixture' }
  const requests = [], progress = []
  let report, ready = false, playerStarted = false, assetsStarted = false
  const pending = prepareScenario('episodes/fixture.json', {
    isCurrent: () => true, now: () => 123,
    fetchImpl: async (...args) => { requests.push(args); return new Response(JSON.stringify(scenario)) },
    loadPlayer: () => { playerStarted = true; return player.promise },
    readScenario: async response => { await response.json(); return scenario },
    preloadAssets: (plan, callback) => { assert.equal(plan.stepCount, scenario.steps.length); assetsStarted = true; report = callback; return assets.promise },
    onProgress: value => progress.push(value),
  }).then(value => { ready = true; return value })
  await flush(() => playerStarted && assetsStarted)
  assert.deepEqual(requests, [['/data/compiled/episodes/fixture.json?v=123', { cache: 'no-store' }]])
  assert.equal(playerStarted && assetsStarted, true)
  report(50)
  assert.deepEqual(progress, [50])
  assets.resolve()
  await flush()
  assert.equal(ready, false, 'asset completion alone must not publish an unready player')
  player.resolve()
  assert.equal(await pending, scenario, 'preparation preserves the decoded scenario object')
}
{
  const t = setup()
  const failedRestore = t.restore({ view: 'player', scenario: 'missing.json' })
  t.requests[0].resolve({ ok: false, status: 404 })
  await failedRestore
  assert.equal(t.state.view.value, 'story_catalog', 'failed direct player route must leave a usable page')
  assert.equal(t.context.currentScenario.value, null)
  assert.ok(t.context.playbackController.error.value)
  t.commit('home')
  assert.equal(t.context.playbackController.error.value, '')
}
console.log('Archive async navigation: preparation boundary, intent races, explicit filters, HTTP/shape failures and obsolete response suppression passed')
