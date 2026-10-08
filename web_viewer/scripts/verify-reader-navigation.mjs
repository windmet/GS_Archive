import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { computed, effectScope, nextTick, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useReaderNavigation } from '../src/composables/useReaderNavigation.js'
import { useStoryNavigation } from '../src/composables/useStoryNavigation.js'
import { useStoryPlaybackController } from '../src/core/useStoryPlaybackController.js'
import { useEpisodeQueue } from '../src/core/useEpisodeQueue.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { ReadModelClient, entityDescriptor } from '../readmodels/runtime/ReadModelClient.mjs'
import { withLoadDeadline } from '../src/core/AsyncLoadBoundary.js'
import { isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue, selectCollectionContinuation } from '../src/core/PlayerEntryRequest.js'
import { buildArchiveSourceQuery, readArchiveSourceRoute } from '../src/core/archiveRoute.js'
import { storyContentMode } from '../src/utils/LanguageStore.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const declarations = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const factory = name => {
  const node = declarations.find(node => node.init?.callee?.name === name)
  assert.ok(node, `App initializes ${name}`); return node
}
const readerBinding = factory('useReaderNavigation'), storyBinding = factory('useStoryNavigation'), playerBinding = factory('useStoryPlaybackController')
assert.ok(playerBinding.start < storyBinding.start && storyBinding.start < readerBinding.start, 'actual early controller/story bindings precede Reader initialization')
assert.equal(body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(item => item.local.name === 'useReaderNavigation'))?.source.value,
  './composables/useReaderNavigation.js')
const functionSource = name => {
  const node = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name)
  assert.ok(node, `App retains ${name}`); return script.slice(node.start, node.end)
}
const expose = (binding, context) => {
  const result = vm.runInNewContext(script.slice(binding.init.start, binding.init.end), context)
  if (binding.id.type === 'Identifier') { context[binding.id.name] = result; return result }
  const exposed = {}
  for (const property of binding.id.properties) {
    assert.ok(Object.hasOwn(result, property.key.name), `factory returns ${property.key.name}`)
    exposed[property.value.name] = result[property.key.name]
  }
  Object.assign(context, exposed); return exposed
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const allEntries = JSON.parse(readFileSync(new URL('../public/data/reading/manifest.json', import.meta.url), 'utf8')).entries
const entries = ['1_4_001_00_a', '1_4_001_00_b', '1_4_001_01_a', '1_4_001_02_a'].map(id => {
  const entry = allEntries.find(item => item.document_id === id); assert.ok(entry, id); return entry
})
const localSources = process.argv.includes('--local-sources')
const evidence = original => {
  const entry = structuredClone(original)
  const document = JSON.parse(readFileSync(new URL('../public/data/reading/' + entry.file, import.meta.url), 'utf8'))
  let compiled
  if (localSources) compiled = readFileSync(new URL('../public/data/compiled/' + entry.source_file, import.meta.url))
  else {
    // The source-only gate has no generated compiled tree. Keep full identity,
    // byte and step proofs while supplying explicitly synthetic media transport.
    const steps = Array.from({ length: document.source.step_count }, (_, index) => ({ step_id: index + 1, type: 'dialogue' }))
    for (const row of document.rows) if (Number.isInteger(row.anchor.step_index)) steps[row.anchor.step_index].step_id = row.anchor.step_id
    const dialogue = document.rows.find(row => row.kind === 'dialogue')
    if (dialogue) {
      steps[dialogue.anchor.step_index].step_id = 1007
      dialogue.anchor.step_id = 1007; dialogue.visual.stepId = 1007
    }
    compiled = Buffer.from(JSON.stringify({ steps }))
    document.source.sha256 = 'sha256:' + digest(compiled)
    entry.source_sha256 = document.source.sha256
  }
  const bytes = Buffer.from(JSON.stringify(document))
  entry.sha256 = 'sha256:' + digest(bytes)
  return { entry, document, bytes, compiled }
}
const samples = entries.map(evidence)
entries.splice(0, entries.length, ...samples.map(sample => sample.entry))
const documentBytes = samples.map(sample => sample.bytes), documents = samples.map(sample => sample.document)
const row = index => documents[index].rows.find(item => item.kind === 'dialogue').anchor
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const until = async (predicate, label) => {
  const deadline = Date.now() + 4000
  while (!predicate()) { assert.ok(Date.now() < deadline, label); await new Promise(resolve => setImmediate(resolve)) }
}
const flush = async () => { await nextTick(); for (let i = 0; i < 12; i++) await Promise.resolve() }
const originalFetch = globalThis.fetch, originalMedia = globalThis.matchMedia, originalError = console.error, originalMode = storyContentMode.value
const cleanups = []
let transport
globalThis.fetch = (...args) => { assert.ok(transport, 'fixture transport installed'); return transport(...args) }
console.error = () => {}

async function fixture({ badContinuationEvidence = false } = {}) {
  const release = 'a'.repeat(64), artifacts = new Map(), jobs = new Map(), statuses = new Map(), requests = [], syncs = [], destinations = [], media = []
  const selected = structuredClone(entries)
  const register = (kind, name, data) => {
    const url = `/_catalog/v/${release}/fixture/${name}.json`, bytes = JSON.stringify({ schema_version: 1, release, kind, data })
    artifacts.set(url, bytes); return { url, kind, sha256: digest(bytes) }
  }
  const locatorUrls = []
  const updateLocators = async () => {
    for (const entry of selected) {
      const descriptor = await entityDescriptor({ release }, 'reading-docs', entry.document_id, 'reading-docs.detail')
      locatorUrls.push(descriptor.url)
      artifacts.set(descriptor.url, JSON.stringify({ schema_version: 1, release, kind: descriptor.kind,
        data: { id: entry.document_id, view: { entry, entries: selected.filter(item => item.logical_id === entry.logical_id) } } }))
    }
  }
  await updateLocators()
  selected.forEach((entry, i) => {
    artifacts.set('/data/reading/' + entry.file, documentBytes[i])
    artifacts.set('/data/compiled/' + entry.source_file, samples[i].compiled)
  })
  const collection = { domain: 'main', sectionId: '101', chapters: [
    { id: 'one', label: '第1話', title: 'One', file: entries[0].parent_file, exists: true, episodes: selected.slice(0, 2).map((entry, i) => ({ id: String(i + 1), label: entry.episode_label, file: entry.source_file, exists: true })) },
    { id: 'two', label: '第2話', title: 'Two', file: entries[2].parent_file, exists: true, episodes: [{ id: '3', label: entries[2].episode_label, file: entries[2].source_file, exists: true }] },
    { id: 'three', label: '第3話', title: 'Three', file: entries[3].parent_file, exists: true, episodes: [{ id: '4', label: entries[3].episode_label, file: entries[3].source_file, exists: true }] },
  ] }
  const collectionEntries = structuredClone(selected)
  if (badContinuationEvidence) collectionEntries[2].source_sha256 = 'sha256:' + 'f'.repeat(64)
  const collectionData = { id: 'main:101', view: { collection, readingEntries: collectionEntries } }
  const collectionDescriptor = register('collections.detail', 'collection', collectionData)
  const remoteCollection = { domain: 'main', sectionId: '102', chapters: [{ ...collection.chapters[1], id: 'remote' }] }
  const remoteDescriptor = register('collections.detail', 'remote-collection', { id: 'main:102', view: { collection: remoteCollection, readingEntries: [selected[2]] } })
  const page = register('collections.page', 'collection-page', { rows: [
    { id: 'main:101', domain: 'main', sectionId: '101', title: 'Main', detail: collectionDescriptor },
    { id: 'main:102', domain: 'main', sectionId: '102', title: 'Remote', detail: remoteDescriptor },
  ] })
  const collectionIndex = register('collections.index', 'collection-index', { count: 2, pages: [page] })
  const landings = Object.fromEntries(['main', 'extra', 'birthday'].map(name => [name, register('stories.landing', name, { value: { collections: [] } })]))
  const storyIndex = register('stories.index', 'stories-index', { count: 0, pages: [], landing: landings })
  const state = { ...useArchiveNavigationState(), loading: ref(false), loadingPurpose: ref('archive-data'), preloadProgress: ref(0),
    collectionReadModelCatalog: ref(null), collectionReadModelDetail: ref(null), collectionReadModelStatus: ref(''),
    storyReadModelCatalog: ref(null), storyReadModelDetail: ref(null), storyReadModelStatus: ref(''), storyCatalogIndex: ref(null), storyCatalogLanding: ref(null),
    eventReadModelDetail: ref(null), workReadModelDetail: ref(null), idolStoryReadModelDetail: ref(null), storyVisibleLimit: ref(80),
    currentStoryCollection: ref(null), currentStory: ref(null), currentEventProjection: ref(null), currentWorkIdol: ref(null), currentIdolStoryPage: ref(null),
  }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false; state.loadingPurpose.value = 'archive-data' } })
  const readModelClient = new ReadModelClient({ release })
  // Delay delivery only after the real client has verified bytes and identity.
  // This tests a valid response already settled when its route is superseded.
  const publicationGates = new Map(), validated = []
  const realLoad = readModelClient.load.bind(readModelClient)
  readModelClient.load = async (descriptor, options) => {
    const result = await realLoad(descriptor, options)
    validated.push(descriptor.url)
    if (publicationGates.has(descriptor.url)) await publicationGates.get(descriptor.url).promise
    return result
  }
  transport = async (input, options = {}) => {
    const path = new URL(input, 'https://archive.invalid').pathname
    requests.push({ path, url: String(input), options })
    if (jobs.has(path)) await jobs.get(path).promise
    if (statuses.has(path)) return new Response('unavailable', { status: statuses.get(path), headers: { 'content-type': 'application/json' } })
    assert.ok(artifacts.has(path), 'Unexpected network request: ' + path)
    return new Response(artifacts.get(path), { headers: { 'content-type': 'application/json' } })
  }
  const context = { ...state, computed, navigation, readModelClient, useReaderNavigation, useStoryNavigation, useStoryPlaybackController, useEpisodeQueue,
    archiveBootstrap: { release, idols: [{ id: '001tom' }], domains: { collections: collectionIndex, stories: storyIndex }, counts: { catalog_story_entries: 0 } },
    isDirectScenarioEntry, playerReturnRoute, selectPlayerQueue, selectCollectionContinuation, withLoadDeadline,
    primeArchiveRouteComponent: () => {}, captureActiveArchiveView: () => {},
    syncArchiveRoute: options => syncs.push({ route: state.currentArchiveRoute(), options, pending: navigation.isPending() }),
    prepareArchivePage: (_view, task) => task,
    captureDetailSource: () => { state.detailSourceRoute.value = buildArchiveSourceQuery(state.currentArchiveRoute()) },
    commitView: view => { navigation.invalidate(); state.view.value = view; state.loading.value = false },
    commitArchiveSelection: () => navigation.invalidate(),
    storyViewerLoader: async () => { media.push('component') }, preloadScenario: async () => { media.push('preload-boundary'); return {} }, queueEpisodeLabel: episode => episode.label || episode.id,
    restoreDetailSource: async () => { destinations.push(readArchiveSourceRoute(state.detailSourceRoute.value)); state.view.value = destinations.at(-1).view },
  }
  for (const name of ['goHome', 'openEventDetail', 'openIdolStoryArchive', 'openStoryPhone', 'loadEventDetail', 'loadIdolStoryDetail', 'restoreRoute', 'loadLegacyAliasRoute']) {
    context[name] = () => { assert.fail('Unexpected feature boundary: ' + name) }
  }
  vm.runInNewContext(['applyArchiveRoute', 'loadPlayerQueue', 'restorePlaybackDestination'].map(functionSource).join('\n'), context)
  const appApply = context.applyArchiveRoute
  context.applyArchiveRoute = (route, options) => {
    if (route.view === 'reader' || route.view === 'player' && route.returnView === 'reader') return appApply(route, options)
    destinations.push(route); return navigation.run(() => { state.view.value = route.view })
  }
  assert.equal(Object.hasOwn(context, 'resolveReaderContinuationSource'), false)
  assert.equal(Object.hasOwn(context, 'openStoryReader'), false)
  const scope = effectScope()
  const controller = scope.run(() => expose(playerBinding, context))
  context.playbackError = controller.error
  context.loadScenario = (...args) => controller.load(...args)
  context.startEpisodeQueue = (...args) => controller.startQueue(...args)
  scope.run(() => expose(storyBinding, context))
  assert.equal(Object.hasOwn(context, 'openStoryReader'), false, 'story factory must not prebind a Reader placeholder')
  const api = scope.run(() => expose(readerBinding, context))
  for (const name of ['readingState', 'chapterReadingState', 'readingPlaybackNotice', 'readingCatalogEntries', 'readingChapterNavigation', 'chapterReadingSession',
    'loadSynopsisReadingDocument', 'openStoryReader', 'refreshStoryReader', 'openCollectionReader', 'selectReaderDocument', 'selectReaderChapter',
    'locateChapterReadingRow', 'playChapterReadingSegment', 'closeStoryReader', 'returnToReader', 'openEventReader', 'openIdolStoryReader',
    'openWorkReader', 'openReaderPlayback', 'updateReadingMode', 'locateReadingRow', 'resolveReaderContinuationSource', 'applyReaderRoute', 'loadReaderQueue']) {
    assert.ok(Object.hasOwn(api, name), `App exposes Reader binding ${name}`)
  }
  const stop = () => { api.chapterReadingSession.close(); controller.dispose(); readModelClient.dispose(); scope.stop() }
  cleanups.push(stop)
  const addReading = async original => {
    const sample = evidence(original)
    selected.push(sample.entry)
    artifacts.set('/data/reading/' + sample.entry.file, sample.bytes)
    artifacts.set('/data/compiled/' + sample.entry.source_file, sample.compiled)
    await updateLocators()
    return sample
  }
  return { ...api, context, state, controller, navigation, requests, syncs, destinations, media, artifacts, statuses, jobs,
    selected, collection, collectionData, collectionDescriptor, remoteDescriptor, locatorUrls, updateLocators, publicationGates, validated, addReading, stop,
    apply: context.applyArchiveRoute, queue: context.loadPlayerQueue }
}
const single = (i = 0, extra = {}) => ({ view: 'reader', reading: entries[i].document_id, ...extra })
const chapter = (i = 0) => single(i, { storyType: 'main', storySection: '101', story: entries[i].parent_file, readingScope: 'chapter' })

try {
  {
    const t = await fixture()
    assert.equal(t.requests.length, 0, 'constructing repository/sessions starts no network work')
    await t.apply(single(0, { readingMode: 'bilingual', readingRow: row(0).row_id, storyType: 'work', idol: '001tom', story: 'work.json', workMode: 'lines' }))
    assert.equal(t.state.view.value, 'reader'); assert.equal(t.readingState.value.status, 'ready')
    assert.equal(t.readingState.value.document.document_id, entries[0].document_id)
    assert.equal(t.state.currentWorkMode.value, 'lines'); assert.equal(t.state.readingMode.value, 'bilingual')
    assert.equal(t.state.readingRowId.value, row(0).row_id); assert.equal(t.media.length, 0)
    const bodyCalls = () => t.requests.filter(request => request.path.startsWith('/data/reading/')).length
    const count = bodyCalls(); await t.apply(single(0)); assert.equal(bodyCalls(), count, 'verified repository bytes are reused')
    assert.equal((await t.loadSynopsisReadingDocument(entries[0])).document.document_id, entries[0].document_id)
    t.locateReadingRow('wrong'); assert.equal(t.state.readingRowId.value, '')
    t.locateReadingRow(row(0).row_id); assert.equal(t.state.readingRowId.value, row(0).row_id)
    t.updateReadingMode('original'); assert.equal(t.state.readingMode.value, 'original'); assert.equal(storyContentMode.value, 'original')
    await t.apply(single(0, { readingRev: 'sha256:' + '0'.repeat(64) })); assert.match(t.readingPlaybackNotice.value, /版本已变化/)
    t.stop()
  }
  for (const reject of [false, true]) {
    const t = await fixture(), job = deferred(), path = '/data/reading/' + entries[0].file
    t.jobs.set(path, job); const old = t.apply(single(0)); await until(() => t.requests.some(request => request.path === path), 'old document request starts')
    await t.apply(single(2)); const latest = t.readingState.value
    if (reject) job.reject(Error('obsolete body')); else job.resolve()
    await old; assert.equal(t.readingState.value, latest); assert.equal(t.state.readingDocumentId.value, entries[2].document_id); t.stop()
  }
  {
    const t = await fixture(); t.statuses.set(t.collectionDescriptor.url, 503)
    await assert.doesNotReject(t.apply(single(0, { storyType: 'main', storySection: '101' })), 'optional directory failure must not reject a readable document')
    assert.equal(t.readingState.value.status, 'ready', 'optional directory failure cannot block verified single-document text')
    assert.equal(t.readingChapterNavigation.value, null); t.stop()
  }
  {
    const t = await fixture(), job = deferred(); t.publicationGates.set(t.collectionDescriptor.url, job)
    const old = t.apply(single(0, { storyType: 'main', storySection: '101' }))
    await until(() => t.readingState.value.status === 'ready', 'body renders independently of pending directory')
    await until(() => t.validated.includes(t.collectionDescriptor.url), 'old directory passed real client hash and identity validation')
    await t.apply(single(2)); job.resolve(); await old
    assert.equal(t.readingChapterNavigation.value, null, 'old optional directory cannot republish into a new Reader'); t.stop()
  }
  {
    const t = await fixture(); await t.apply(chapter(1))
    await until(() => t.chapterReadingState.value?.segments.every(item => item.status === 'ready'), 'focused second segment becomes ready')
    assert.equal(t.readingState.value.document?.document_id, entries[1].document_id, 'chapter publications follow the selected segment, even when it is not first')
    await t.apply({ ...chapter(2), storySection: '102' })
    assert.equal(t.readingState.value.document?.document_id, entries[2].document_id)
    assert.equal(t.chapterReadingState.value?.chapterId, 'remote', 'cross-collection route loads its own verified chapter membership')
    assert.ok(t.requests.some(request => request.path === t.remoteDescriptor.url)); t.stop()
  }
  {
    const t = await fixture(); await t.apply(chapter())
    await until(() => t.chapterReadingState.value?.segments.every(item => item.status === 'ready'), 'both chapter documents verify')
    assert.equal(t.chapterReadingState.value.chapterId, 'one'); assert.equal(t.readingChapterNavigation.value.chapterId, 'one')
    t.locateChapterReadingRow({ documentId: entries[1].document_id, rowId: row(1).row_id, revision: 'wrong' })
    assert.equal(t.state.readingDocumentId.value, entries[0].document_id)
    t.locateChapterReadingRow({ documentId: entries[1].document_id, rowId: row(1).row_id, revision: entries[1].sha256 })
    assert.equal(t.state.readingDocumentId.value, entries[1].document_id); assert.equal(t.state.readingRowId.value, row(1).row_id)
    const directoryLoads = t.requests.filter(request => request.path === t.collectionDescriptor.url).length
    t.state.detailSourceRoute.value = buildArchiveSourceQuery({ view: 'story_collection', storyType: 'main', storySection: '101', story: entries[0].parent_file })
    await t.selectReaderChapter('two')
    assert.equal(t.state.readingDocumentId.value, entries[2].document_id); assert.equal(t.state.currentStoryFile.value, entries[2].parent_file)
    assert.equal(readArchiveSourceRoute(t.state.detailSourceRoute.value).story, entries[2].parent_file)
    assert.equal(t.requests.filter(request => request.path === t.collectionDescriptor.url).length, directoryLoads, 'chapter switch reuses verified membership')
    assert.equal(t.chapterReadingState.value.chapterId, 'two'); t.stop()
  }
  {
    const t = await fixture(); globalThis.matchMedia = () => ({ matches: true })
    await t.apply(chapter(0)); assert.equal(t.chapterReadingState.value, null); assert.equal(t.state.readingScope.value, '')
    assert.equal(t.requests.filter(request => request.path.startsWith('/data/reading/')).length, 1, 'mobile reads only requested segment')
    globalThis.matchMedia = originalMedia; t.stop()
  }
  // Fresh locator publication changes the document revision; immutable cached text stays intact.
  {
    const t = await fixture(); await t.apply(single()); const old = t.readingState.value.document
    const updated = structuredClone(documents[0]); updated.source.publication = { ...updated.source.publication, test_revision: 2 }
    const bytes = JSON.stringify(updated); t.selected[0].sha256 = 'sha256:' + digest(bytes)
    t.artifacts.set('/data/reading/' + entries[0].file, bytes); await t.updateLocators()
    await t.refreshStoryReader(); assert.equal(t.readingState.value.document.source.publication.test_revision, 2)
    assert.notEqual(t.readingState.value.document, old); assert.equal(old.source.publication?.test_revision, undefined)
    assert.ok(t.requests.filter(request => request.path === t.locatorUrls[0]).length >= 2, 'fresh locator invalidates real read-model cache')
    t.statuses.set(t.locatorUrls[0], 503); await t.refreshStoryReader(); assert.match(t.readingPlaybackNotice.value, /正文刷新失败/); t.stop()
  }
  // Real App queue fallback delegates to the private Reader repository with exact siblings.
  {
    const t = await fixture()
    const queue = await t.queue(single(), { file: entries[0].source_file })
    assert.deepEqual(queue.map(item => item.id), entries.slice(0, 2).map(item => item.document_id))
    assert.deepEqual(queue.map(item => item.file), entries.slice(0, 2).map(item => item.source_file))
    assert.ok(queue.every(item => item.exists)); assert.equal(t.requests.some(request => request.path.startsWith('/data/reading/')), false)
    const formal = await t.queue(chapter(), { file: entries[0].source_file })
    assert.ok((Array.isArray(formal) ? formal : formal.episodes).some(item => item.file === entries[0].source_file)); t.stop()
  }
  // Entry adapters use the actual App bindings and projected domain memberships.
  for (const domain of ['collection', 'work', 'idol', 'event']) {
    const t = await fixture(); t.state.currentCharacterId.value = '001tom'
    if (domain === 'collection') {
      t.state.view.value = 'story_collection'; t.state.currentStoryDomain.value = 'main'; t.state.currentStorySection.value = '101'
      t.state.collectionReadModelDetail.value = t.collectionData; t.state.currentStoryCollection.value = t.collection
      assert.equal(t.readingCatalogEntries.value.length, 4)
      await t.openCollectionReader({ chapter: t.collection.chapters[0], documentId: entries[0].document_id })
      assert.equal(t.state.readingScope.value, 'chapter')
    } else if (domain === 'work') {
      t.state.view.value = 'work_archive'; t.state.currentWorkMode.value = 'lines'; t.state.currentWorkIdol.value = { idol_code: '001tom' }
      t.state.workReadModelDetail.value = { view: { readingEntries: [entries[0]] } }
      await t.openWorkReader(entries[0].source_file); assert.equal(t.state.currentWorkMode.value, 'lines')
      assert.equal(t.state.currentStoryDomain.value, 'work')
    } else if (domain === 'idol') {
      t.state.view.value = 'idol_story_archive'; t.state.currentIdolStoryPage.value = { idol_code: '001tom' }
      t.state.idolStoryReadModelDetail.value = { view: { readingEntries: [entries[0]] } }
      await t.openIdolStoryReader({ section: { id: 17 }, episode: { id: 18, file: entries[0].source_file, exists: true } })
      assert.equal(t.state.currentStorySection.value, '17'); assert.equal(t.state.currentEpisodeId.value, '18')
      assert.equal(readArchiveSourceRoute(t.state.detailSourceRoute.value).episode, '18')
    } else {
      t.state.view.value = 'event_detail'; t.state.currentEventId.value = '10001'; t.state.eventParentView.value = 'unit_detail'; t.state.currentArchiveUnitCode.value = '01jup'
      await t.openEventReader(entries[0].document_id); assert.equal(t.state.currentEventId.value, '10001'); assert.equal(t.state.currentArchiveUnitCode.value, '01jup')
    }
    await until(() => t.readingState.value.status === 'ready', 'cross-domain Reader body is ready')
    assert.equal(t.state.view.value, 'reader'); assert.equal(t.state.readingDocumentId.value, entries[0].document_id)
    assert.ok(t.syncs.some(sync => sync.pending), 'entry publishes URL while real session is loading')
    await t.closeStoryReader(); assert.equal(t.destinations.at(-1).view, ({ collection: 'story_collection', work: 'work_archive', idol: 'idol_story_archive', event: 'event_detail' })[domain]); t.stop()
  }
  {
    const t = await fixture()
    for (const [view, projection, detail] of [
      ['story_collection', 'currentStoryCollection', 'collectionReadModelDetail'], ['story_detail', 'currentStory', 'storyReadModelDetail'],
      ['event_detail', 'currentEventProjection', 'eventReadModelDetail'], ['work_archive', 'currentWorkIdol', 'workReadModelDetail'],
      ['idol_story_archive', 'currentIdolStoryPage', 'idolStoryReadModelDetail'],
    ]) {
      t.state.view.value = view; t.state[projection].value = {}; t.state[detail].value = { view: { readingEntries: [entries[1]] } }
      assert.equal(t.readingCatalogEntries.value, t.state[detail].value.view.readingEntries, view + ' retains actual projected catalog identity')
      t.state[projection].value = null; assert.equal(t.readingCatalogEntries.value.length, 0, view + ' without projection has no reader entries')
    }
    t.stop()
  }
  // A real catalog event entry calls the Reader callback registered before the
  // Reader factory exists; no placeholder implementation is installed.
  {
    const t = await fixture()
    const graph = JSON.parse(readFileSync(new URL('../public/data/editorial/event-resource-graph.json', import.meta.url), 'utf8'))
    const event = graph.events.find(item => item.firstReadingId && allEntries.some(entry => entry.document_id === item.firstReadingId))
    assert.ok(event, 'a real event has a Reader resource relation')
    await t.addReading(allEntries.find(entry => entry.document_id === event.firstReadingId))
    t.state.view.value = 'story_catalog'
    await t.context.openCatalogStory({ file: event.storyFile, sectionId: event.eventCode, eventRelation: { event_code: event.eventCode, event_id: event.id } })
    assert.equal(t.state.view.value, 'reader', 'actual generic story factory late callback reaches Reader')
    assert.equal(t.readingState.value.document?.document_id, event.firstReadingId)
    assert.equal(t.state.currentEventId.value, event.id); t.stop()
  }
  {
    const t = await fixture(); await t.apply(single(0, { storyType: 'work', idol: '001tom', story: 'work.json', workMode: 'lines' }))
    await t.closeStoryReader(); assert.equal(t.destinations.at(-1).view, 'work_archive'); assert.equal(t.destinations.at(-1).workMode, 'lines'); t.stop()
  }
  // The controller executes the actual compiled-byte proof, range and Reader return path.
  {
    const t = await fixture(); await t.apply(single(0, { readingMode: 'bilingual' }))
    await t.openReaderPlayback(row(0).row_id)
    assert.equal(t.state.view.value, 'player'); assert.equal(t.state.currentScenarioFile.value, entries[0].source_file)
    assert.equal(t.state.currentScenarioInitialStep.value, row(0).step_index + 1)
    assert.equal(t.state.currentScenarioStartStep.value, 1); assert.equal(t.state.currentScenarioEndStep.value, documents[0].source.step_count)
    assert.equal(t.state.readingRevision.value, entries[0].sha256); assert.equal(t.controller.error.value, '')
    t.controller.close(); await until(() => t.state.view.value === 'reader' && t.readingState.value.status === 'ready', 'real controller closes back to Reader')
    assert.equal(t.state.readingRowId.value, row(0).row_id); assert.equal(t.state.readingRevision.value, entries[0].sha256)
    assert.equal(t.destinations.length, 0, 'player return stayed inside the actual Reader route branch')
    t.stop()
  }
  {
    const t = await fixture(); await t.apply(chapter(1))
    await until(() => t.chapterReadingState.value?.segments.every(item => item.status === 'ready'), 'chapter is ready for full-segment playback')
    await t.playChapterReadingSegment({ documentId: entries[1].document_id, rowId: row(1).row_id })
    assert.equal(t.state.view.value, 'player'); assert.equal(t.state.currentScenarioInitialStep.value, 1)
    t.controller.close(); await until(() => t.state.view.value === 'reader' && t.readingState.value.status === 'ready', 'full segment returns through actual App Reader route')
    assert.equal(t.state.readingScope.value, 'chapter'); assert.equal(t.chapterReadingState.value?.chapterId, 'one'); t.stop()
  }
  for (const changedBytes of [false, true]) {
    const t = await fixture(); await t.apply(single()); await t.openReaderPlayback(row(0).row_id)
    const returnRoute = t.state.currentArchiveRoute()
    if (changedBytes) {
      const compiled = JSON.parse(t.artifacts.get('/data/compiled/' + entries[1].source_file))
      compiled.changed = true; t.artifacts.set('/data/compiled/' + entries[1].source_file, JSON.stringify(compiled))
    }
    // Omitting readScenario makes the actual controller invoke its captured,
    // late-bound App resolveReaderSource callback and real repository proof.
    const loaded = await t.controller.load(entries[1].source_file, 'reader', { startStep: 1, endStep: documents[1].source.step_count, initialStep: 1, returnRoute })
    assert.equal(loaded, !changedBytes, 'actual early controller callback verifies the continuation bytes')
    if (changedBytes) assert.match(t.controller.error.value, /来源已更新/)
    else assert.equal(t.state.currentScenarioFile.value, entries[1].source_file)
    t.stop()
  }
  for (const broken of ['revision', 'range', 'file', 'bytes']) {
    const t = await fixture()
    const route = { ...single(), view: 'player', returnView: 'reader', readingRow: row(0).row_id, readingRev: entries[0].sha256,
      scenario: entries[0].source_file, startStep: 1, endStep: documents[0].source.step_count, initialStep: row(0).step_index + 1 }
    if (broken === 'revision') route.readingRev = 'sha256:' + 'f'.repeat(64)
    if (broken === 'range') route.endStep--
    if (broken === 'file') route.scenario = entries[1].source_file
    if (broken === 'bytes') t.artifacts.set('/data/compiled/' + entries[0].source_file, JSON.stringify({ steps: [] }))
    await t.apply(route)
    assert.notEqual(t.state.view.value, 'player', broken + ' cannot publish an unverified player')
    assert.ok(t.readingPlaybackNotice.value, broken + ' remains visible to the Reader'); t.stop()
  }
  {
    const t = await fixture(); await t.apply(single())
    const readScenario = await t.resolveReaderContinuationSource(entries[1].source_file)
    assert.equal((await readScenario(new Response(t.artifacts.get('/data/compiled/' + entries[1].source_file)))).steps.length, documents[1].source.step_count)
    await assert.rejects(readScenario(new Response('{}')), /来源已更新/)
    await assert.rejects(t.resolveReaderContinuationSource('episodes/unrelated.json'), /唯一正文来源/)
    t.stop()
  }
  for (const mismatch of [false, true]) {
    const t = await fixture({ badContinuationEvidence: mismatch }); await t.apply(single())
    t.state.currentScenarioFile.value = entries[0].source_file
    const returnRoute = { reading: entries[0].document_id, storyType: 'main', storySection: '101' }
    await assert.rejects(t.resolveReaderContinuationSource(entries[3].source_file, returnRoute), /相邻话目/, 'formal collection membership alone cannot permit a nonadjacent jump')
    if (mismatch) await assert.rejects(t.resolveReaderContinuationSource(entries[2].source_file, returnRoute), /匹配正文来源/, 'directory and locator must bind the same source revision')
    else {
      const proof = await t.resolveReaderContinuationSource(entries[2].source_file, returnRoute)
      assert.equal((await proof(new Response(t.artifacts.get('/data/compiled/' + entries[2].source_file)))).steps.length, documents[2].source.step_count)
    }
    t.stop()
  }
  console.log(`Reader navigation: actual App/controller/story bindings, real repository/read-model/session transport, route/queue delegation, revision/range proof, cancellation, refresh and Reader return passed (${localSources ? 'local published compiled bytes' : 'source-only synthetic compiled bytes'})`)
} finally {
  cleanups.forEach(stop => stop()); globalThis.fetch = originalFetch; globalThis.matchMedia = originalMedia; console.error = originalError; storyContentMode.value = originalMode
}
