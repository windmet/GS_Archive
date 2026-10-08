import { isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue } from '../src/core/PlayerEntryRequest.js'
import { ownsArchiveSource } from '../src/core/archiveRoute.js'
import { normalizeEventBrowseState } from '../src/core/EventCatalogRouteState.js'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { buildCardVoicePreviewScenario, findCardVoiceCue } from '../src/data/cardVoicePreview.js'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { prepareScenario } from '../src/data/prepareScenario.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { useStageNavigation } from '../src/composables/useStageNavigation.js'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseJavascript } from '@babel/parser'
import { ref } from 'vue'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const appScript = parseSfc(app).descriptor.scriptSetup.content
const stageBinding = parseJavascript(appScript, { sourceType: 'module' }).program.body
  .filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
  .find(node => node.init?.type === 'CallExpression' && node.init.callee.name === 'useStageNavigation')
assert.ok(stageBinding, 'App binds the stage navigation composable')
const functionSource = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)))
const scenarioSource = functionSource('async function loadScenario(', 'async function loadHomeIndex(')
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
  const loading = ref(false)
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { loading.value = false } })
  const storyIndex = { count: 0, pages: [], landing: { main: 'landing:main', extra: 'landing:extra', birthday: 'landing:birthday' } }
  const storyTransport = { index: async () => storyIndex, idolDetail: async () => { throw Error('Unexpected idol story hydration') } }
  const context = vm.createContext({
    isDirectScenarioEntry, playerReturnRoute,
    prepareArchivePage: (_view, data) => data,
    ...state, navigation, loading, loadingPurpose: { value: 'archive-data' }, preloadProgress: { value: 0 },
    EXTERNAL_STORY_RESOURCES_ENABLED: false,
    buildCardVoicePreviewScenario, findCardVoiceCue, idolDisplayName: id => `speaker:${id}`,
    cardReadModelDetail: { value: null },
    archiveRouteReady: true,
    archiveHomeIdols: { value: [] }, idolEpisodeData: { value: {} },
    archiveBootstrap: { idols: [{ id: '038tak' }], domains: { stories: 'story-index' }, counts: { catalog_story_entries: 0 } },
    userPreferences: {value:{portalDefaultScope:'all'}},
    mobileArchiveData: { value: {} }, idolUnitData: { value: {} },
    idolStoryReadModelDetail: ref(null),
    idolStoryReadModelCatalog: ref([{ id: '038tak', detail: { url: 'idol:038tak' } }]),
    readModelClient: { load: async (descriptor, options) => {
      if (descriptor?.url === 'idol:038tak') {
        const detail = await storyTransport.idolDetail(); options.validate(detail); return detail
      }
      if (descriptor === 'story-index') return storyTransport.index()
      assert.ok(['landing:main', 'landing:extra', 'landing:birthday'].includes(descriptor))
      return { value: { collections: [] } }
    } },
    loadLegacyAliasRoute: async () => null, publishLegacyAliasRoute: () => {},
    resolveRouteGroup: () => null, resolveRouteUnit: () => null, resolveRouteEpisode: () => null,
    currentStoryCollection: { value: null }, currentEventEpisodes: { value: [] },
    spineViewerLoader: async () => {}, chibiStageViewerLoader: async () => {},
    captureDetailSource: () => {}, ownsArchiveSource, normalizeEventBrowseState,
    currentScenario: { value: null }, currentScenarioInstance: { value: 0 },
    stageHandoff: { value: null },
    songReadModelDetail: { value: null },
    loadSongDetail: async id => ({ id }), ensureSongCatalog: async () => {},
    restoreDetailSource: fallback => fallback(), goHome: () => {},
    episodeQueue: useEpisodeQueue(),
    storyViewerLoader: async () => {},
    Preloader: { preloadScenario: async () => {} },
    fetch: () => { const request = deferred(); requests.push(request); return request.promise },
    writeArchiveRoute: route => writes.push(route),
    captureActiveArchiveView: () => {},
    primeArchiveRouteComponent: () => {},
    adoptArchiveViewContext: () => {},
    console: { error: (...args) => errors.push(args) },
  })
  context.currentCard = { get value() { return context.cardReadModelDetail.value?.card || null } }
  context.prepareScenario = (name, options) => prepareScenario(name, { ...options, fetchImpl: (...args) => context.fetch(...args) })
  context.playbackController = useStoryPlaybackController({ state: context, navigation, queue: context.episodeQueue,
    loadPlayer: () => context.storyViewerLoader(), preloadAssets: (...args) => context.Preloader.preloadScenario(...args),
    resolveQueue: async (route, request) => route.view === 'story_collection'
      ? selectPlayerQueue(context.currentStoryCollection.value?.chapters, request.file, request)
      : selectPlayerQueue(context.currentIdolStoryPage.value?.sections, request.file, request),
    prepare: (...args) => context.prepareScenario(...args), syncRoute: () => context.syncArchiveRoute(),
    returnTo: destination => context.commitView(destination), onError: (...args) => context.console.error(...args),
  })
  const production = vm.runInContext([
    functionSource('function syncArchiveRoute(', 'async function restoreVoicePreview('),
    functionSource('async function applyArchiveRoute(', 'function goHome('),
    functionSource('async function restoreVoicePreview(', 'async function applyArchiveRoute('),
    functionSource('function playbackEpisodes(', 'async function openEventCard('),
    functionSource('async function openVoicePreview(', 'async function openGroup('),
    functionSource('function onPlayerReady(', 'async function loadScenario('),
    scenarioSource,
    '({ load: loadScenario, restore: applyArchiveRoute, commit: commitView, select: commitArchiveSelection, onPlayerReady, openVoicePreview, sync: syncArchiveRoute, filter: updateArchiveFilter })',
  ].join('\n'), context)
  bindStoryArchiveNavigation(app, context).stop()
  bindStoryNavigation(app, context).stop()
  production.openStoryCatalog = context.openStoryCatalog
  // Keep transport replaceable after setup while exercising App's real dependency wiring.
  const stageContext = { ...context, useStageNavigation,
    spineViewerLoader: (...args) => context.spineViewerLoader(...args),
    chibiStageViewerLoader: (...args) => context.chibiStageViewerLoader(...args),
  }
  Object.assign(production, vm.runInNewContext(appScript.slice(stageBinding.init.start, stageBinding.init.end), stageContext))
  const respond = (index, name) => requests[index].resolve(new Response(JSON.stringify({ name, steps: [] })))
  return { context, state, ...production, requests, respond, writes, errors, storyTransport, storyIndex }
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
// A raw player deep link saves return identity without blocking on owner payloads.
{
  const t = setup(), data = deferred()
  let parentLoads = 0
  t.storyTransport.idolDetail = () => { parentLoads++; return data.promise }
  const pending = t.restore({ view: 'player', scenario: 'birthday-b.json', returnView: 'idol_story_archive', idol: '038tak' })
  await flush()
  assert.equal(t.requests.length, 1, 'scenario restoration must precede owner hydration')
  assert.equal(parentLoads, 0, 'raw player entry must not request its parent leaf')
  data.resolve({ id: '038tak', view: { page: { idol_code: '038tak', sections: [] }, readingEntries: [] } })
  await flush(() => t.requests.length === 1)
  t.respond(0, 'birthday'); await pending
  assert.equal(t.state.playerEntryRoute.value.idol, '038tak')
  assert.equal(t.state.returnViewAfterPlayer.value, 'idol_story_archive')
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.context.idolStoryReadModelDetail.value, null, 'return payload is not a first-frame dependency')
}
// Older history restore cannot write selections after its data dependency resolves.
{
  const t = setup(), data = deferred()
  t.storyTransport.index = () => data.promise
  const old = t.restore({ view: 'story_catalog', query: 'old' })
  await t.restore({ view: 'home', query: 'current' })
  data.resolve(t.storyIndex); await old
  assert.equal(t.state.view.value, 'home')
  assert.equal(t.state.filterQuery.value, 'current')
  assert.equal(t.writes.length, 0)
}
// Nested player loading belongs to its history restore. Old completion cannot
// release the new restore's history-write suppression.
{
  const t = setup(), data = deferred()
  t.storyTransport.index = () => data.promise
  const old = t.restore({ view: 'story_catalog' })
  const current = t.restore({ view: 'player', scenario: 'current.json', startStep: 3, endStep: 9, returnView: 'story_collection', storyType: 'main', storySection: '101' })
  data.resolve(t.storyIndex); await old
  assert.equal(t.context.navigation.isRestoring(), true)
  t.sync({ replace: true }); assert.equal(t.writes.length, 0)
  await flush(() => t.requests.length === 1)
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
  const restored = t.restore({ view: 'player', scenario: 'shared.json', returnView: 'story_collection', storyType: 'main', storySection: '101', startStep: 12, endStep: 20 })
  await flush(() => t.requests.length === 1)
  t.respond(0, 'shared'); await restored
  t.context.playbackController.readinessChanged({ instance: t.context.currentScenarioInstance.value, status: 'playable', stepIndex: 11 })
  await t.context.playbackController.ensureQueue()
  assert.equal(t.context.episodeQueue.current.value.id, 'second')
  assert.equal(t.context.episodeQueue.hasNext.value, false)
}
{
  const t = setup(), data = deferred()
  t.storyTransport.index = () => data.promise
  const old = t.openStoryCatalog()
  t.commit('home'); data.resolve(t.storyIndex); await old
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
const previewCard = (id, cue) => ({ resource_id: `${id}_card`, character_id: id,
  home_voice_cues: [{ cue, preview: { preview_step: { type: 'adv', dialogue: { speaker: `speaker:${id}`, text: 'Source line', voice: `${cue}.m4a` } } } }] })

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
  const old = t.openVoicePreview(previewCard('001tom', 'old'), 'old', 'cards')
  t.commit('home'); module.resolve(); await old
  assert.equal(t.context.currentScenario.value, null)
  t.state.currentCharacterId.value = '001tom'
  t.context.episodeQueue.start([{ file: 'old-a.json' }, { file: 'old-b.json' }], 0)
  await t.openVoicePreview(previewCard('002kao', 'current'), 'current', 'card_detail')
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.context.currentScenario.value.steps[0].dialogue.speaker, 'speaker:002kao')
  assert.equal(t.state.currentPreviewCue.value, 'current')
  assert.equal(t.state.returnViewAfterPlayer.value, 'card_detail')
  assert.equal(t.context.episodeQueue.hasNext.value, false)
}
{
  const t = setup(), detail = deferred()
  t.state.view.value = 'cards'
  t.storyTransport.index = () => detail.promise
  const pending = t.restore({ view: 'story_catalog', query: 'old route' })
  await flush()
  t.filter('filterQuery', 'new search')
  assert.equal(t.context.navigation.isPending(), false, 'explicit user filtering supersedes pending route restoration')
  detail.resolve(t.storyIndex)
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
    isCurrent: () => true,
    fetchImpl: async (...args) => { requests.push(args); return new Response(JSON.stringify(scenario)) },
    loadPlayer: () => { playerStarted = true; return player.promise },
    readScenario: async response => { await response.json(); return scenario },
    preloadAssets: (plan, callback) => { assert.equal(plan.stepCount, scenario.steps.length); assetsStarted = true; report = callback; return assets.promise },
    onProgress: value => progress.push(value),
  }).then(value => { ready = true; return value })
  await flush(() => playerStarted && assetsStarted)
  assert.equal(requests[0][0], '/data/compiled/episodes/fixture.json')
  assert.equal(requests[0][1].cache, 'no-cache')
  assert.ok(requests[0][1].signal instanceof AbortSignal)
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
  await flush(() => t.requests.length > 0)
  t.requests[0].resolve({ ok: false, status: 404 })
  await failedRestore
  assert.notEqual(t.state.view.value, 'player', 'failed direct entry must not publish a blank player')
  assert.equal(t.context.playbackController.canRetry.value, true, 'source failure keeps retry and return recovery')
  assert.equal(t.context.currentScenario.value, null)
  assert.ok(t.context.playbackController.error.value)
  t.commit('home')
  assert.equal(t.context.playbackController.error.value, '')
}
{
  const t = setup(), data = deferred()
  const cue = 'touch_001'
  t.context.loadCardDetail = id => { assert.equal(id, '001tom_n01'); return data.promise }
  const pending = t.restore({ view: 'player', card: '001tom_n01', voice: cue, returnView: 'card_detail' })
  data.resolve({ id: '001tom_n01', card: { resource_id: '001tom_n01', home_voice_cues: [
    { cue, preview: { preview_step: { dialogue: { text: 'source line', voice: `${cue}.m4a` } } } },
  ] } })
  await pending
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.state.currentPreviewCue.value, cue)
  assert.equal(t.context.currentScenario.value.steps[0].dialogue.text, 'source line')
  assert.equal(t.requests.length, 0, 'source-backed voice step is already in the selected card leaf')
}
// A card detail view owns its leaf. Raw scenario playback defers the return leaf;
// synthetic card voice previews still require it. Supersession revokes old reads.
{
  const t = setup(), leaf = deferred()
  t.context.loadCardDetail = id => { assert.equal(id, '001tom_n01'); return leaf.promise }
  const pending = t.restore({ view: 'card_detail', card: '001tom_n01', idol: '001tom' })
  await flush()
  assert.equal(t.state.view.value, '__boot__', 'card detail must wait for its leaf')
  leaf.resolve({ id: '001tom_n01', card: { resource_id: '001tom_n01' } })
  await pending
  assert.equal(t.state.view.value, 'card_detail')
  assert.equal(t.context.cardReadModelDetail.value.id, '001tom_n01')
}
{
  const t = setup(), leaf = deferred()
  t.context.loadCardDetail = () => leaf.promise
  const pending = t.restore({ view: 'player', scenario: 'card-story.json', returnView: 'card_detail', card: '001tom_n01' })
  await flush()
  assert.equal(t.requests.length, 1, 'raw scenario must not wait for its return card leaf')
  leaf.resolve({ id: '001tom_n01', card: { resource_id: '001tom_n01' } })
  await flush(() => t.requests.length === 1)
  t.respond(0, 'card-story'); await pending
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.state.returnViewAfterPlayer.value, 'card_detail')
  assert.equal(t.state.playerEntryRoute.value.card, '001tom_n01')
  assert.equal(t.context.cardReadModelDetail.value, null)
}
{
  const t = setup(), leaf = deferred()
  t.context.loadCardDetail = () => leaf.promise
  const stale = t.restore({ view: 'card_detail', card: '001tom_n01' })
  await t.restore({ view: 'portal' })
  leaf.resolve({ id: '001tom_n01', card: { resource_id: '001tom_n01' } })
  await stale
  assert.equal(t.state.view.value, 'portal')
  assert.equal(t.context.cardReadModelDetail.value, null)
}
{
  const t = setup(), data = deferred()
  t.context.loadCardDetail = () => data.promise
  const pending = t.restore({ view: 'player', card: 'old', voice: 'old', returnView: 'card_detail' })
  t.commit('portal')
  data.resolve({ id: 'old', card: {} }); await pending
  assert.equal(t.state.view.value, 'portal')
  assert.equal(t.context.cardReadModelDetail.value, null, 'late voice owner must not publish after navigation')
}
{
  const t = setup()
  await t.restore({ view: 'event_catalog', query: 'Cafe', eventBrowse: { kind: 'tour', sort: 'oldest', page: 2 } })
  assert.equal(t.state.view.value, 'event_catalog')
  assert.equal(t.state.filterQuery.value, 'Cafe')
  assert.deepEqual(t.state.currentEventBrowseState.value, { kind: 'tour', sort: 'oldest', page: 2 }, 'route hydration owns event kind/sort/page together')
  await t.restore({ view: 'event_catalog' })
  assert.deepEqual(t.state.currentEventBrowseState.value, { kind: '', sort: 'newest', page: 0 }, 'legacy event URL starts from defaults')
}
console.log('Archive async navigation: preparation, races, filters, failures, card voice leaf and independent event catalog browse restoration passed')
