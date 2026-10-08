import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { ref } from 'vue'
import { useArchiveNavigationState } from '../../src/core/useArchiveNavigationState.js'
import { useStoryPlaybackController } from '../../src/core/useStoryPlaybackController.js'
import { createArchiveNavigationCoordinator } from '../../src/core/ArchiveNavigationCoordinator.js'
import { readArchiveRoute, buildArchiveUrl } from '../../src/core/archiveRoute.js'
import { isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue } from '../../src/core/PlayerEntryRequest.js'
import { prepareScenario } from '../../src/data/prepareScenario.js'
import { Preloader } from '../../src/utils/Preloader.js'
import { deferred, tick, until } from './helpers.mjs'
import { bindSongNavigation } from '../lib/song-navigation-harness.mjs'
import { bindStoryNavigation } from '../lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from '../lib/story-archive-navigation-harness.mjs'
const scenario = { scenario_id: 'test', steps: Array.from({ length: 6 }, (_, i) => ({ step_id: i+1, type: 'adv', state: { bg: `bg${i}` } })) }
const href = 'https://archive.invalid/?view=player&story_type=main&story_section=101&story=1_4_001_00.json&scenario=episodes%2F1_4_001_00_a.json&start_step=2&end_step=27&return=story_collection&from=%3Fview%3Dstory_catalog'
function setup(options = {}) {
  const state = { ...useArchiveNavigationState(), loading: ref(false), preloadProgress: ref(0) }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false } })
  const returns = [], prepared = [], assetIO = []
  class Controlled extends Preloader {
    static async _preloadBinary(url) { assetIO.push(url); return 'fetched' }
    static async _preloadImage() { assert.fail('no image warm before publication') }
  }
  const controller = useStoryPlaybackController({ state, navigation, loadPlayer: async () => {}, syncRoute: () => {},
    returnTo: (destination, route) => returns.push({ destination, route }), onError: () => {},
    preloadAssets: (...args) => Controlled.preloadScenario(...args),
    prepare: (name, request) => { prepared.push({ name, request }); return prepareScenario(name, { ...request,
      fetchImpl: async () => new Response(JSON.stringify(scenario)) }) }, ...options })
  return { state, navigation, controller, returns, prepared, assetIO }
}
const ready = controller => controller.readinessChanged({ instance: controller.currentScenarioInstance.value, status: 'playable', stepIndex: 1, hasFrame: true })

test('normal click and raw deep link share source preparation; only renderer starts speculative work', async () => {
  const normal = setup(), direct = setup(), route = readArchiveRoute(href)
  await normal.controller.load(route.scenario, 'story_collection', { startStep: 2, endStep: 27, returnRoute: playerReturnRoute(route) })
  await direct.controller.restore(route.scenario, 'story_collection', { startStep: 2, endStep: 27 }, [], undefined, playerReturnRoute(route))
  assert.deepEqual(normal.prepared[0].request.playbackEntry, direct.prepared[0].request.playbackEntry)
  assert.equal(normal.prepared[0].name, direct.prepared[0].name)
  assert.equal(direct.assetIO.length, 0)
  assert.equal(direct.controller.playbackBuffering.value, true)
  assert.equal(direct.controller.readinessChanged({ instance: 999, status: 'playable' }), false)
  ready(direct.controller)
  await tick()
  assert.ok(direct.assetIO.length > 0)
  assert.equal(direct.controller.inspect().firstPlayable, true)
  normal.controller.dispose(); direct.controller.dispose()
})

test('return descriptor survives publication/close with full chapter and provenance, no scenario recursion', async () => {
  const t = setup(), route = readArchiveRoute(href)
  await t.controller.restore(route.scenario, route.returnView, { startStep: 2, endStep: 27 }, [], undefined, playerReturnRoute(route))
  const url = buildArchiveUrl('https://archive.invalid/', t.state.currentArchiveRoute())
  assert.equal(url.searchParams.get('scenario'), route.scenario)
  assert.equal(url.searchParams.get('story_section'), '101')
  assert.equal(url.searchParams.get('from'), '?view=story_catalog')
  t.controller.close()
  const destination = t.returns[0]
  assert.equal(destination.destination, 'story_collection')
  assert.equal(destination.route.story, '1_4_001_00.json')
  assert.equal(destination.route.storyType, 'main')
  assert.equal(destination.route.scenario, '')
  assert.equal(destination.route.sourceRoute, '?view=story_catalog')
  assert.equal(t.state.playerEntryRoute.value, null)
})

test('queue lookup is after first frame, failure is independent of frame, retry is chapter-scoped', async () => {
  let calls = 0, broken = true
  const groups = [{ episodes: [{ file: 'selected.json', startStep: 2, endStep: 5 }, { file: 'next.json', startStep: 1, endStep: 5 }] },
    { episodes: [{ file: 'unrelated.json', startStep: 1, endStep: 5 }] }]
  const t = setup({ resolveQueue: async (_route, request) => {
    calls++; if (broken) throw Error('parent unavailable')
    return selectPlayerQueue(groups, request.file, request)
  } })
  await t.controller.restore('selected.json', 'story_collection', { startStep: 2, endStep: 5 }, [], undefined,
    playerReturnRoute(readArchiveRoute(href)))
  assert.equal(calls, 0)
  ready(t.controller); await until(() => t.controller.queueStatus.value === 'error')
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.controller.error.value, '')
  assert.equal(t.controller.playbackBuffering.value, false)
  broken = false; assert.equal(await t.controller.ensureQueue({ retry: true }), true)
  assert.equal(t.controller.hasNext.value, true)
  await t.controller.next()
  assert.equal(t.state.currentScenarioFile.value, 'next.json')
  assert.equal(t.controller.hasNext.value, false, 'must not advance into unrelated chapter')
  t.controller.dispose()
})

test('late queue lookup cannot resurrect a closed player or trigger the next episode', async () => {
  const gate = deferred(); const t = setup({ resolveQueue: () => gate.promise })
  await t.controller.restore('a.json', 'story_collection', {}, [], undefined, playerReturnRoute(readArchiveRoute(href)))
  ready(t.controller); await tick()
  const next = t.controller.next()
  t.controller.close()
  gate.resolve([{ file: 'a.json' }, { file: 'b.json' }])
  assert.equal(await next, false)
  assert.equal(t.controller.queue.current.value, null)
  assert.equal(t.state.currentScenarioFile.value, '')
  assert.equal(t.prepared.length, 1)
})

test('source retry repeats Reader byte verifier, retains requested range, commits queue only on success', async () => {
  let broken = true, checks = 0, commits = 0
  const t = setup({ prepare: (name, request) => prepareScenario(name, { ...request, fetchImpl: async () => new Response(JSON.stringify(scenario)) }) })
  const options = { startStep: 2, initialStep: 3, endStep: 5, queueCommit: () => commits++,
    readScenario: async response => { checks++; if (broken) throw Error('Pinned Reader digest mismatch'); return response.json() } }
  assert.equal(await t.controller.load('reader.json', 'reader', options), false)
  assert.equal(t.controller.currentScenario.value, null)
  assert.equal(t.controller.canRetry.value, true)
  assert.equal(commits, 0)
  broken = false
  assert.equal(await t.controller.retry(), true)
  assert.equal(checks, 2)
  assert.equal(t.state.currentScenarioStartStep.value, 2)
  assert.equal(t.state.currentScenarioInitialStep.value, 3)
  assert.equal(t.state.currentScenarioEndStep.value, 5)
  assert.equal(commits, 1)
  t.controller.readinessChanged({ instance: t.controller.currentScenarioInstance.value, stepIndex: 3, status: 'blocked' })
  await t.controller.retryCurrentStep()
  assert.equal(t.state.currentScenarioInitialStep.value, 4)
  // Current-step retry must preserve the Reader verifier too (regression).
  assert.equal(checks, 3)
  t.controller.dispose()
})

test('cancel during body read settles promptly and never commits late scenario', async () => {
  const gate = deferred(); let signal
  const t = setup({ prepare: (name, request) => prepareScenario(name, { ...request, fetchImpl: (_url, options) => { signal = options.signal; return gate.promise } }) })
  const pending = t.controller.load('a.json')
  await until(() => Boolean(signal))
  t.controller.close()
  assert.equal(await pending, false)
  assert.equal(signal.aborted, true)
  gate.resolve(new Response(JSON.stringify(scenario))); await tick()
  assert.equal(t.controller.currentScenario.value, null)
  assert.equal(t.controller.canRetry.value, false)
})

const appSource = await readFile(new URL('../../src/App.vue', import.meta.url), 'utf8')
const applyCode = appSource.slice(appSource.indexOf('async function applyArchiveRoute('), appSource.indexOf('\nfunction goHome()', appSource.indexOf('async function applyArchiveRoute(')))
const restoreCode = appSource.slice(appSource.indexOf('let startupRouteNormalized = false'), appSource.indexOf('\nonMounted(async () => {', appSource.indexOf('let startupRouteNormalized = false')))
function appHarness(t, overrides = {}) {
  const writes = [], context = { ...t.state, playbackController: t.controller, navigation: t.navigation,
    loadingPurpose: ref('archive-data'), playbackError: t.controller.error,
    isDirectScenarioEntry, playerReturnRoute, tracePlayer() {}, primeArchiveRouteComponent() {}, captureActiveArchiveView() {}, adoptArchiveViewContext() {},
    writeArchiveRoute: (...args) => writes.push(args), legacyEntryStatus: ref(''), collectionReadModelDetail: ref(null), collectionReadModelStatus: ref('untouched'),
    collectionReadModelCatalog: ref([{ id: 'main:101', domain: 'main', sectionId: '101', title: 'Main', detail: { url: 'collection:main:101' } }]),
    readModelClient: { load: () => { throw Error('parent hydration must not occur before direct player') } }, console,
    ...overrides }
  for (const name of [...restoreCode.matchAll(/\+\+(pending\w+)/g)].map(match => match[1])) context[name] = 0
  // Exercise the real route invalidation/preparation methods; this fixture owns
  // player restoration rather than the song-view watcher lifecycle.
  bindStoryArchiveNavigation(appSource, context).stop()
  bindStoryNavigation(appSource, context).stop()
  bindSongNavigation(appSource, context).stop()
  vm.createContext(context)
  vm.runInContext(`${applyCode}\n${restoreCode}\nthis.restoreEntry = restoreRoute; this.applyEntry = applyArchiveRoute`, context)
  return { context, writes }
}

test('actual App.vue raw deep-link path executes without catalog/collection hydration and preserves failed URL', async () => {
  const t = setup(), h = appHarness(t), route = readArchiveRoute(href)
  await h.context.restoreEntry(route)
  assert.equal(t.state.view.value, 'player')
  assert.equal(t.assetIO.length, 0)
  assert.equal(h.writes[0][0].scenario, route.scenario)
  assert.equal(h.context.collectionReadModelDetail.value, null)
  t.controller.dispose()
  const failed = setup({ prepare: async () => { throw Error('source unavailable') } }), f = appHarness(failed)
  await f.context.restoreEntry(route)
  assert.equal(f.writes.length, 0, 'failed startup must not replace original deep link')
  assert.equal(failed.controller.canRetry.value, true)
  failed.controller.dispose()
})

test('actual App.vue establishes intent BEFORE awaited parent hydrate; stale success publishes nothing', async () => {
  const gate = deferred(), t = setup(); let seenPending = false
  const h = appHarness(t, { readModelClient: { load: (_descriptor, options) => {
    seenPending = t.navigation.isPending()
    return gate.promise.then(detail => { options.validate(detail); return detail })
  } } })
  const old = h.context.restoreEntry(playerReturnRoute(readArchiveRoute(href)))
  await tick(); assert.equal(seenPending, true)
  await t.controller.load('new.json')
  gate.resolve({ id: 'main:101', view: { collection: { domain: 'main', sectionId: '101', chapters: [] }, readingEntries: [] } })
  await old
  assert.equal(t.state.currentScenarioFile.value, 'new.json')
  assert.equal(h.context.collectionReadModelDetail.value, null)
  assert.equal(h.context.collectionReadModelStatus.value, 'untouched')
  assert.equal(h.writes.length, 0)
  t.controller.dispose()
})

test('Reader and synthetic preview are excluded from raw shortcut; existing revision proof is kept', () => {
  const route = readArchiveRoute(href)
  assert.equal(isDirectScenarioEntry({ ...route, returnView: 'reader' }), false)
  assert.equal(isDirectScenarioEntry({ view: 'player', card: '001tom_sr07', voice: 'touch01' }), false)
  assert.match(appSource, /route\.scenario !== target\.file/)
  assert.match(appSource, /route\.initialStep !== target\.initialStep/)
  assert.match(appSource, /readingPlaybackTarget\(readingState\.value\.document/)
})
