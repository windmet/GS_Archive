import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import vm from 'node:vm'
import { computed, effectScope, nextTick, ref } from 'vue'
import { parse } from '@vue/compiler-sfc'
import { parse as parseScript } from '@babel/parser'
import { useStoryNavigation } from '../src/composables/useStoryNavigation.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const script = parse(readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')).descriptor.scriptSetup.content
const body = parseScript(script, { sourceType: 'module' }).program.body
const declarations = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const binding = declarations.find(node => node.init?.callee?.name === 'useStoryNavigation')
assert.ok(binding, 'App binds the production story navigation module')
const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(item => item.local.name === 'useStoryNavigation'))
assert.equal(imported?.source.value, './composables/useStoryNavigation.js')
const call = script.slice(binding.init.start, binding.init.end)
const currentStory = declarations.find(node => node.id.name === 'currentStory')
assert.ok(currentStory.start < binding.start, 'currentStory is ready before the factory reads it')
const songBinding = declarations.find(node => node.init?.callee?.name === 'useSongNavigation')
assert.ok(binding.start < songBinding.start, 'song navigation receives the initialized story entry')

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const flush = async () => { await nextTick(); for (let i = 0; i < 16; i++) await Promise.resolve() }
const storyDetail = (file, domain = 'main', sectionId = '101') => ({ id: file,
  story: { file, domain, sectionId, exists: true },
  view: { related: [], castReferences: [], readingEntries: [], promotedVisualUrl: '' },
})
const collectionDetail = (domain, sectionId) => ({ id: domain + ':' + sectionId,
  view: { collection: { domain, sectionId, chapters: [] }, readingEntries: [] },
})
const storyRows = ['alpha.json', 'beta.json'].map(file => ({ id: file, file, title: file, detail: { key: file } }))
const collectionRows = [
  { id: 'main:101', domain: 'main', sectionId: '101', title: 'Chapter', detail: { key: 'main:101' } },
  { id: 'extra:601', domain: 'extra', sectionId: '601', legacySectionIds: ['60101'], title: 'Extra', detail: { key: 'extra:601' } },
]
const scopes = [], errors = [], originalError = console.error
console.error = (...args) => errors.push(args)

function fixture({ cached = true, initialView = '__boot__' } = {}) {
  const state = { ...useArchiveNavigationState(), loading: ref(false), storyVisibleLimit: ref(80),
    collectionReadModelCatalog: ref(cached ? collectionRows : null), collectionReadModelDetail: ref(null), collectionReadModelStatus: ref(''),
    storyReadModelCatalog: ref(cached ? storyRows : null), storyReadModelDetail: ref(null), storyReadModelStatus: ref(''),
    storyCatalogIndex: ref(null), storyCatalogLanding: ref(null),
  }
  state.view.value = initialView
  const calls = [], loads = [], requests = new Map(), data = new Map()
  const navigation = createArchiveNavigationCoordinator()
  data.set('collection-index', { count: 2, pages: [{ key: 'collection-page' }] })
  data.set('collection-page', { rows: collectionRows })
  data.set('story-index', { count: 2, pages: [{ key: 'story-page' }],
    landing: Object.fromEntries(['main', 'extra', 'birthday'].map(key => [key, { key: 'landing:' + key }])),
    detailLocatorShards: Object.fromEntries(Array.from({ length: 32 }, (_, i) =>
      [i.toString(16).padStart(2, '0'), { key: 'locator', sha256: 'fixture-digest' }])),
  })
  data.set('story-page', { rows: storyRows }); data.set('locator', { rows: storyRows })
  for (const domain of ['main', 'extra', 'birthday']) data.set('landing:' + domain, { value: { collections: [domain] } })
  for (const row of storyRows) data.set(row.file, storyDetail(row.file))
  for (const row of collectionRows) data.set(row.id, collectionDetail(row.domain, row.sectionId))
  const context = { ...state, computed, useStoryNavigation, navigation,
    archiveBootstrap: { domains: { collections: { key: 'collection-index' }, stories: { key: 'story-index' } }, counts: { catalog_story_entries: 2 } },
    readModelClient: { load: async (descriptor, options = {}) => {
      const key = descriptor.key; loads.push({ key, descriptor, options })
      const value = requests.has(key) ? await requests.get(key).promise : data.get(key)
      assert.ok(value, 'Unexpected transport descriptor: ' + key)
      options.validate?.(value)
      return value
    } },
    prepareArchivePage: (_view, task) => task,
    captureDetailSource: () => calls.push(['capture', state.view.value]),
    commitView: view => { navigation.invalidate(); state.view.value = view; state.loading.value = false; calls.push(['commit', view]) },
    commitArchiveSelection: () => calls.push(['selection']), goHome: () => calls.push(['home']),
  }
  for (const name of ['openEventDetail', 'openIdolStoryArchive', 'openStoryPhone', 'openStoryReader', 'loadScenario', 'startEpisodeQueue']) {
    context[name] = (...args) => calls.push([name, ...args])
  }
  context.currentStory = vm.runInNewContext(script.slice(currentStory.init.start, currentStory.init.end), context)
  const scope = effectScope(); scopes.push(scope)
  const api = scope.run(() => vm.runInNewContext(call, context))
  const exposed = Object.fromEntries(binding.id.properties.map(property => {
    assert.equal(property.type, 'ObjectProperty')
    assert.equal(property.value.type, 'Identifier')
    assert.ok(Object.hasOwn(api, property.key.name), 'App binds an available story handler')
    return [property.value.name, api[property.key.name]]
  }))
  return { ...exposed, state, calls, loads, requests, data, navigation, scope }
}

try {
  // Collection and detail requests share the real coordinator, with separate private cancellation counters.
  for (const kind of ['collection', 'detail']) {
    const t = fixture(), pending = deferred(), key = kind === 'collection' ? 'main:101' : 'alpha.json'
    t.requests.set(key, pending)
    const task = kind === 'collection' ? t.openProjectedCollection({ domain: 'main', section: '101' }) : t.openStoryDetail({ file: key })
    await flush(); const revision = t.navigation.getRevision()
    t.invalidateStoryNavigation()
    assert.equal(t.navigation.getRevision(), revision, 'domain cancellation does not own global revision')
    pending.resolve(t.data.get(key)); await task
    assert.equal(t.state.collectionReadModelDetail.value, null)
    assert.equal(t.state.storyReadModelDetail.value, null)
    assert.deepEqual(t.calls, [], 'invalidated request cannot capture a source or publish a view')
    t.scope.stop()
  }
  for (const rejectOld of [false, true]) {
    const t = fixture(), old = deferred(), newest = deferred()
    t.requests.set('alpha.json', old); t.requests.set('extra:601', newest)
    const first = t.openStoryDetail({ file: 'alpha.json' }); await flush()
    const second = t.openProjectedCollection({ domain: 'extra', section: '60101', storyFile: 'beta.json', parent: 'song_detail' }); await flush()
    if (rejectOld) old.reject(Error('obsolete failure')); else old.resolve(storyDetail('alpha.json'))
    await first
    assert.equal(t.state.storyReadModelDetail.value, null)
    assert.equal(t.state.collectionReadModelStatus.value, '正在读取故事章节…')
    newest.resolve(collectionDetail('extra', '601')); await second
    assert.equal(t.state.currentStorySection.value, '60101', 'legacy section is kept as URL context')
    assert.equal(t.state.currentStoryFile.value, 'beta.json')
    assert.equal(t.state.storyCollectionParentView.value, 'song_detail')
    assert.deepEqual(t.calls, [['capture', '__boot__'], ['commit', 'story_collection']])
    t.scope.stop()
  }
  // Preparation owns data only; normalization, fallback, and stale success/failure preserve route semantics.
  {
    const t = fixture()
    for (const route of [{ view: 'story_collection' }, { view: 'story_collection', storyType: 'main' }, { view: 'story_detail' }]) {
      assert.deepEqual(t.normalizeStoryRoute(route), { view: 'story_catalog' })
    }
    const direct = { view: 'player', returnView: 'story_detail', scenario: 'raw.json' }
    assert.equal(t.normalizeStoryRoute(direct), direct)
    const restored = await t.prepareStoryRoute({ view: 'story_detail', story: 'alpha.json', from: 'preserved' }, { isCurrent: () => true })
    assert.equal(restored.storyType, 'main'); assert.equal(restored.storySection, '101'); assert.equal(restored.from, 'preserved')
    assert.deepEqual(t.calls, []); assert.equal(t.state.view.value, '__boot__')
    t.scope.stop()
  }
  for (const kind of ['collection', 'detail']) for (const failure of [false, true]) {
    const t = fixture(), job = deferred(); let current = true
    const key = kind === 'collection' ? 'main:101' : 'alpha.json'
    const route = kind === 'collection' ? { view: 'story_collection', storyType: 'main', storySection: '101' } : { view: 'story_detail', story: 'alpha.json' }
    t.requests.set(key, job)
    const task = t.prepareStoryRoute(route, { isCurrent: () => current }); await flush(); current = false
    if (failure) job.reject(Error('stale')); else job.resolve(t.data.get(key))
    assert.equal(await task, null)
    assert.equal(t.state.collectionReadModelDetail.value, null); assert.equal(t.state.storyReadModelDetail.value, null)
    assert.equal(t.state.collectionReadModelStatus.value, ''); assert.equal(t.state.storyReadModelStatus.value, '')
    t.scope.stop()
  }
  for (const kind of ['collection', 'detail']) {
    const t = fixture(), job = deferred(), key = kind === 'collection' ? 'main:101' : 'alpha.json'
    t.requests.set(key, job)
    const route = kind === 'collection' ? { view: 'player', returnView: 'story_collection', storyType: 'main', storySection: '101' }
      : { view: 'player', returnView: 'story_detail', story: 'alpha.json' }
    const task = t.prepareStoryRoute(route, { isCurrent: () => true }); job.reject(Error('current failure'))
    assert.deepEqual(await task, { view: 'story_catalog' })
    assert.match(kind === 'collection' ? t.state.collectionReadModelStatus.value : t.state.storyReadModelStatus.value, /重试/)
    t.scope.stop()
  }
  // Catalog assembly rejects incorrect counts/identities before publishing and checks abort after transport.
  for (const kind of ['collection', 'story']) {
    const indexKey = kind + '-index', pageKey = kind + '-page', rows = kind === 'collection' ? collectionRows : storyRows
    for (const broken of ['count', 'duplicate', 'identity', 'abort']) {
      const t = fixture({ cached: false }), controller = new AbortController()
      if (broken === 'count') t.data.get(indexKey).count++
      if (broken === 'duplicate') t.data.set(pageKey, { rows: [rows[0], rows[0]] })
      if (broken === 'identity') t.data.set(pageKey, { rows: [{ ...rows[0], id: 'wrong' }, rows[1]] })
      if (broken === 'abort') controller.abort()
      const task = kind === 'collection' ? t.loadCollectionCatalog({ signal: controller.signal }) : t.loadStoryReadModelCatalog({ signal: controller.signal })
      await assert.rejects(task, /mismatch|abort/i)
      assert.equal(kind === 'collection' ? t.state.collectionReadModelCatalog.value : t.state.storyReadModelCatalog.value, null)
      t.scope.stop()
    }
  }
  {
    const t = fixture({ cached: false })
    await t.loadCollectionCatalog(); await t.loadStoryReadModelCatalog(); const count = t.loads.length
    await t.loadCollectionCatalog(); await t.loadStoryReadModelCatalog(); assert.equal(t.loads.length, count)
    t.state.storyReadModelCatalog.value = null
    await t.loadStoryReadModelDetail('alpha.json')
    const locatorKey = (parseInt(createHash('sha256').update('alpha.json').digest('hex').slice(0, 2), 16) % 32).toString(16).padStart(2, '0')
    assert.equal(t.loads.at(-2).descriptor, t.data.get('story-index').detailLocatorShards[locatorKey])
    assert.equal(t.loads.at(-1).options.expectedId, 'alpha.json')
    t.data.set('alpha.json', storyDetail('beta.json'))
    await assert.rejects(t.loadStoryReadModelDetail('alpha.json'), /identity or shape mismatch/)
    t.data.set('main:101', collectionDetail('extra', '101'))
    await assert.rejects(t.loadCollectionDetail('main', '101'), /identity or shape mismatch/)
    t.data.get('story-index').detailLocatorShards = {}
    await assert.rejects(t.loadStoryReadModelDetail('alpha.json'), /locator missing/)
    t.scope.stop()
  }
  // The directory watcher remains non-immediate, and domain landings avoid full directory transport.
  {
    const t = fixture({ cached: false, initialView: 'story_catalog' })
    await flush(); assert.equal(t.loads.length, 0, 'factory registration must not start the existing non-immediate watcher')
    t.scope.stop()
  }
  for (const [mode, domain, idol, expected] of [['portal', '', '', true], ['search', 'event', '', true],
    ['portal', 'main', '001tom', true], ['portal', 'main', '', false], ['portal', 'extra', '', false], ['portal', 'birthday', '', false]]) {
    const t = fixture({ cached: false })
    t.state.currentStoryMode.value = mode; t.state.currentStoryDomain.value = domain; t.state.currentCharacterId.value = idol
    t.state.view.value = 'story_catalog'; await flush()
    assert.equal(t.loads.some(load => load.key === 'story-page'), expected)
    t.state.storyVisibleLimit.value = 240; t.state.filterQuery.value = 'changed'; await flush()
    assert.equal(t.state.storyVisibleLimit.value, 80)
    t.scope.stop()
  }
  // Returning from a collection retains the proper parent and clears only its chapter context.
  for (const [parent, expected] of [['idol_story_archive', 'idol_story_archive'], ['song_detail', 'song_detail'],
    ['external_story_resources', 'external_story_resources'], ['', 'story_catalog']]) {
    const t = fixture()
    t.state.currentCharacterId.value = '001tom'; t.state.currentSongId.value = 'brndnf'
    t.state.currentStoryDomain.value = 'extra'; t.state.currentStorySection.value = '60101'; t.state.currentStoryFile.value = 'beta.json'
    t.state.storyCollectionParentView.value = parent
    await t.goBackFromStoryCollection(); await flush()
    assert.equal(t.state.view.value, expected); assert.equal(t.state.currentStoryFile.value, '')
    assert.equal(t.state.storyCollectionParentView.value, '')
    if (!parent) assert.equal(t.state.currentStoryDomain.value, 'extra')
    t.scope.stop()
  }
  // External links and catalog entries delegate across domains without manufacturing playback state.
  {
    const t = fixture()
    t.openExternalStoryInternal({ target: { kind: 'event', event: { id: '17' } } })
    t.openExternalStoryInternal({ target: { kind: 'idol-story', idolCode: '001tom' } })
    t.openCatalogStory({ file: 'phone.json', domain: 'card_scenarios' })
    assert.deepEqual(t.calls.slice(0, 3), [['openEventDetail', { id: '17' }, 'external_story_resources'],
      ['openIdolStoryArchive', '001tom'], ['openStoryPhone', { file: 'phone.json', domain: 'card_scenarios' }]])
    const graph = JSON.parse(readFileSync(new URL('../public/data/editorial/event-resource-graph.json', import.meta.url), 'utf8'))
    const event = graph.events.find(row => row.firstReadingId && row.storyFile)
    assert.ok(event)
    t.openCatalogStory({ file: event.storyFile, sectionId: event.eventCode, eventRelation: { event_code: event.eventCode, event_id: event.id } })
    assert.deepEqual(t.calls.at(-1), ['openStoryReader', event.firstReadingId,
      { event: event.id, parentView: 'story_catalog', storyType: 'event', story: event.storyFile }])
    t.openExternalStoryInternal({ target: { kind: 'story', story: { file: 'alpha.json' } } }); await flush()
    assert.equal(t.state.storyDetailParentView.value, 'external_story_resources')
    t.openExternalStoryInternal({ target: { kind: 'collection', domain: 'extra', section: '60101', storyFile: 'beta.json' } }); await flush()
    assert.equal(t.state.storyCollectionParentView.value, 'external_story_resources')
    assert.equal(t.state.currentStoryFile.value, 'beta.json')
    t.scope.stop()
  }
  // Selection/history and chapter/segment queue intent remain owned by the existing player boundary.
  {
    const t = fixture(), episodes = [{ id: '01', file: 'one.json', exists: true }, { id: '02', file: 'two.json', exists: true }]
    const chapter = { story: { file: 'chapter.json' }, episodes }
    t.selectStoryCollectionChapter(chapter); t.selectStoryCollectionChapter(chapter)
    assert.deepEqual(t.calls, [['selection']])
    t.playStoryCollectionChapter(chapter)
    assert.deepEqual(t.calls.at(-1), ['startEpisodeQueue', episodes, 0, 'story_collection', { entryIntent: 'chapter' }])
    t.playStoryCollectionEpisode({ chapter, episode: episodes[1] })
    assert.deepEqual(t.calls.at(-1), ['startEpisodeQueue', episodes, 1, 'story_collection', { entryIntent: 'segment' }])
    const count = t.calls.length
    t.playStoryCollectionEpisode({ chapter, episode: { id: 'missing' } }); assert.equal(t.calls.length, count)
    t.playStoryCollectionChapter({ file: 'single.json', exists: true })
    assert.deepEqual(t.calls.at(-1), ['loadScenario', 'single.json', 'story_collection', { entryIntent: 'chapter' }])
    t.scope.stop()
  }
  console.log('Story navigation: real App wiring, competing entries, route restoration, identity, aliases, watcher ownership, parent returns and playback boundaries passed')
} finally {
  scopes.forEach(scope => scope.stop()); console.error = originalError
}
