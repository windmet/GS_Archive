import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { effectScope, nextTick, ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { useStoryArchiveNavigation } from '../src/composables/useStoryArchiveNavigation.js'
import { usePortalNavigation } from '../src/composables/usePortalNavigation.js'
import { useArchiveNavigationState } from '../src/core/useArchiveNavigationState.js'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { buildPortalReturnQuery } from '../src/core/archiveRoute.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const declarations = body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations)
const factoryBinding = name => {
  const binding = declarations.find(node => node.init?.callee?.name === name)
  assert.ok(binding, `App initializes ${name}`)
  return binding
}
const binding = factoryBinding('useStoryArchiveNavigation')
const storyBinding = factoryBinding('useStoryNavigation'), portalBinding = factoryBinding('usePortalNavigation')
const shellBack = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'goArchiveBack')
assert.ok(shellBack, 'App keeps its actual shell Back dispatcher')
const restoreBinding = body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'restoreRoute')
assert.ok(restoreBinding, 'App keeps its actual restore coordinator')
assert.ok(binding.start < storyBinding.start && storyBinding.start < portalBinding.start, 'archive, generic story and portal factories retain real setup order')
const imported = body.find(node => node.type === 'ImportDeclaration' && node.specifiers.some(item => item.local.name === 'useStoryArchiveNavigation'))
assert.equal(imported?.source.value, './composables/useStoryArchiveNavigation.js')
const boundNames = pattern => pattern.type === 'Identifier' ? [pattern.name]
  : pattern.type === 'ObjectPattern' ? pattern.properties.flatMap(item => boundNames(item.value || item.argument))
    : pattern.type === 'ArrayPattern' ? pattern.elements.filter(Boolean).flatMap(boundNames) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const item of node.specifiers) defined.set(item.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  if (node.type === 'VariableDeclaration') for (const item of node.declarations) for (const name of boundNames(item.id)) defined.set(name, item.start)
}
for (const property of binding.init.arguments[0].properties) {
  if (property.value.type === 'Identifier') assert.ok(defined.get(property.value.name) < binding.start, `${property.key.name} exists before factory initialization`)
  else assert.ok(['openStoryCatalog', 'openProjectedCollection'].includes(property.key.name), 'only the two cyclic story entries need late callbacks')
}
function expose(actualBinding, context) {
  const result = vm.runInNewContext(script.slice(actualBinding.init.start, actualBinding.init.end), context)
  const exposed = {}
  for (const property of actualBinding.id.properties) {
    assert.ok(property.key.name in result, `production returns ${property.key.name}`)
    exposed[property.value.name] = result[property.key.name]
  }
  Object.assign(context, exposed)
  return exposed
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = async () => { await nextTick(); for (let i = 0; i < 16; i++) await Promise.resolve() }
const ids = ['001tom', '002sht']
const domains = [
  { kind: 'seasonal', prefix: 'seasonal', catalog: 'loadSeasonalCatalog', detail: 'loadSeasonalDetail', open: 'openSeasonalCampaign', select: 'selectSeasonalCampaign', id: 'valentine_2023', other: 'white_day_2023', view: 'seasonal_campaign', fallback: { view: 'portal' } },
  { kind: 'work', prefix: 'work', catalog: 'loadWorkCatalog', detail: 'loadWorkDetail', open: 'openWorkArchive', select: 'selectWorkIdol', id: ids[0], other: ids[1], view: 'work_archive', fallback: { view: 'idol_picker', pickTarget: 'work' } },
  { kind: 'idol-stories', prefix: 'idolStory', catalog: 'loadIdolStoryCatalog', detail: 'loadIdolStoryDetail', open: 'openIdolStoryArchive', select: 'selectIdolStory', id: ids[0], other: ids[1], view: 'idol_story_archive', fallback: { view: 'idol_picker', pickTarget: 'story' } },
]
const cleanups = []
function fixture({ cached = true } = {}) {
  const state = { ...useArchiveNavigationState(), loading: ref(false), mobileUnitReadModelDetail: ref(null), mobileIdolReadModelDetail: ref(null) }
  const calls = [], loads = [], jobs = new Map(), data = new Map()
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { state.loading.value = false } })
  for (const domain of domains) {
    const rows = [domain.id, domain.other].map((id, i) => domain.kind === 'seasonal'
      ? { id, name: id, year: 2023, season: i ? 'white_day' : 'valentine', detail: { key: domain.kind + ':' + id } }
      : domain.kind === 'work' ? { id, idol_code: id, display_name: id, work_type_name: 'work', detail: { key: domain.kind + ':' + id } }
        : { id, idolCode: id, idolName: id, sectionCount: 1, episodeCount: 2, detail: { key: domain.kind + ':' + id } })
    state[domain.prefix + 'ReadModelCatalog'] = ref(cached ? rows : null)
    state[domain.prefix + 'ReadModelDetail'] = ref(null)
    state[domain.prefix + 'ReadModelStatus'] = ref('')
    data.set(domain.kind + ':index', { count: 2, pages: [{ key: domain.kind + ':page' }] })
    data.set(domain.kind + ':page', { rows })
    for (const row of rows) data.set(row.detail.key, { id: row.id, view: domain.kind === 'seasonal'
      ? { campaign: { id: row.id, year: row.year, season: row.season, participants: [] } }
      : domain.kind === 'work' ? { idol: { idol_code: row.id, short_stories: [], scene_lines: [] }, sourceEvidence: { entries: [] }, readingEntries: [] }
        : { page: { idol_code: row.id, sections: [] }, readingEntries: [] } })
  }
  const collections = ids.map(id => ({ id: 'birthday:' + id, domain: 'birthday', sectionId: id, title: id, detail: { key: 'birthday:' + id } }))
  data.set('collections:index', { count: collections.length, pages: [{ key: 'collections:page' }] })
  data.set('collections:page', { rows: collections })
  for (const row of collections) data.set(row.detail.key, { id: row.id, view: { collection: { domain: row.domain, sectionId: row.sectionId, chapters: [] }, readingEntries: [] } })
  data.set('stories:index', { count: 0, pages: [], landing: Object.fromEntries(['main', 'extra', 'birthday'].map(key => [key, { key: 'landing:' + key }])) })
  for (const key of ['main', 'extra', 'birthday']) data.set('landing:' + key, { value: { collections: [] } })
  const context = { ...state, navigation, useStoryArchiveNavigation, usePortalNavigation,
    archiveBootstrap: { idols: ids.map(id => ({ id })), domains: Object.fromEntries([...domains.map(domain => domain.kind), 'stories', 'collections'].map(key => [key, { key: key + ':index' }])), counts: { catalog_story_entries: 0 } },
    readModelClient: { load: async (descriptor, options = {}) => {
      const key = descriptor?.key; loads.push({ key, descriptor, options })
      const value = jobs.has(key) ? await jobs.get(key).promise : data.get(key)
      assert.ok(value, 'Unexpected transport descriptor: ' + key)
      options.validate?.(value)
      return value
    } },
    prepareArchivePage: (_view, task) => task,
    captureDetailSource: () => calls.push(['capture']),
    commitView: view => { navigation.invalidate(); state.view.value = view; state.loading.value = false; calls.push(['commit', view]) },
    commitArchiveSelection: () => { navigation.invalidate(); state.loading.value = false; calls.push(['selection']) },
    openIdolPicker: target => calls.push(['picker', target]), loadScenario: (...args) => calls.push(['play', ...args]),
    startEpisodeQueue: (...args) => calls.push(['queue', ...args]),
  }
  // No placeholder for either cyclic callback: eager capture must fail like real App setup.
  assert.equal(Object.hasOwn(context, 'openStoryCatalog'), false)
  assert.equal(Object.hasOwn(context, 'openProjectedCollection'), false)
  bindMobileNavigation(app, context).stop()
  bindLegacyAliasNavigation(app, context).stop()
  const scope = effectScope(), api = scope.run(() => expose(binding, context))
  const story = bindStoryNavigation(app, context)
  const stop = () => { scope.stop(); story.stop() }; cleanups.push(stop)
  return { ...api, state, context, calls, loads, jobs, data, navigation, story, stop }
}
const routeFor = domain => domain.kind === 'seasonal' ? { view: domain.view, storySection: domain.id }
  : { view: domain.view, idol: domain.id }
function restoreFixture() {
  const t = fixture(), context = t.context, applied = [], writes = []
  let invalidations = 0, publishedRoute = null
  const invalidate = context.invalidateStoryArchiveNavigation
  context.invalidateStoryArchiveNavigation = (...args) => { invalidations++; return invalidate(...args) }
  Object.assign(context, { isDirectScenarioEntry, loadingPurpose: ref('archive-data'), legacyEntryStatus: ref(''), playbackError: ref(''),
    primeArchiveRouteComponent: () => {}, tracePlayer: () => {}, adoptArchiveViewContext: () => {},
    applyArchiveRoute: async (route, { intent }) => {
      assert.equal(intent.isCurrent(), true, 'App applies only the current restore intent')
      applied.push(route); publishedRoute = route; context.view.value = route.view
    }, currentArchiveRoute: () => publishedRoute, writeArchiveRoute: (...args) => writes.push(args),
  })
  for (const name of ['loadHomeIdol', 'loadLegacyAliasRoute', 'publishLegacyAliasRoute', 'loadMobileRoute', 'loadIdolDetail',
    'loadUnitCatalog', 'loadUnitDetail', 'loadGashaCatalog', 'loadGashaDetail', 'loadCardCatalog', 'loadCardDetail', 'loadEventDetail']) {
    context[name] = () => { assert.fail(`Unexpected restore domain boundary: ${name}`) }
  }
  bindSongNavigation(app, context).stop()
  const restoreSource = script.slice(restoreBinding.start, restoreBinding.end)
  for (const match of restoreSource.matchAll(/\+\+(pending\w+)/g)) context[match[1]] = 0
  const setup = ['startupRouteNormalized', 'restoreRequest'].map(name => {
    const node = body.find(node => node.type === 'VariableDeclaration' && node.declarations.some(item => item.id.name === name))
    assert.ok(node, `App initializes ${name}`)
    return script.slice(node.start, node.end)
  }).join('\n')
  vm.runInNewContext(setup + '\n' + restoreSource, context)
  return { ...t, applied, writes, restore: context.restoreRoute, invalidations: () => invalidations }
}
const originalError = console.error
console.error = () => {}
try {
  // Private invalidation revokes every domain without changing the shared revision.
  for (const domain of domains) for (const reject of [false, true]) {
    const t = fixture(), job = deferred(), key = domain.kind + ':' + domain.id
    t.jobs.set(key, job)
    const task = t[domain.open](domain.id); await flush()
    const revision = t.navigation.getRevision(); t.invalidateStoryArchiveNavigation()
    assert.equal(t.navigation.getRevision(), revision)
    if (reject) job.reject(Error('obsolete')); else job.resolve(t.data.get(key))
    await task
    assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value, null)
    assert.deepEqual(t.calls, []); assert.equal(t.state.loading.value, true, 'late work cannot finish a newer owner')
    t.stop()
  }
  // Each domain competes with the next one through the real coordinator.
  for (let i = 0; i < domains.length; i++) for (const reject of [false, true]) {
    const older = domains[i], newer = domains[(i + 1) % domains.length], t = fixture(), old = deferred(), next = deferred()
    const oldKey = older.kind + ':' + older.id, nextKey = newer.kind + ':' + newer.id
    t.jobs.set(oldKey, old); t.jobs.set(nextKey, next)
    const a = t[older.open](older.id); await flush(); const b = t[newer.open](newer.id); await flush()
    if (reject) old.reject(Error('stale')); else old.resolve(t.data.get(oldKey))
    await a; assert.equal(t.state[older.prefix + 'ReadModelDetail'].value, null); assert.equal(t.state.loading.value, true)
    next.resolve(t.data.get(nextKey)); await b
    assert.equal(t.state.view.value, newer.view); assert.deepEqual(t.calls, [['capture'], ['commit', newer.view]])
    t.stop()
  }
  for (const domain of domains) {
    const t = fixture(), key = domain.kind + ':' + domain.id, job = deferred(); t.jobs.set(key, job)
    const task = t[domain.open](domain.id); await flush(); job.reject(Error('network')); await task
    assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value, null); assert.match(t.state[domain.prefix + 'ReadModelStatus'].value, /重试/)
    assert.equal(t.state.loading.value, false); assert.deepEqual(t.calls, []); t.stop()
  }
  for (const domain of domains) {
    const t = fixture(), old = deferred(), next = deferred(), oldKey = domain.kind + ':' + domain.id, nextKey = domain.kind + ':' + domain.other
    t.jobs.set(oldKey, old); t.jobs.set(nextKey, next)
    const opening = t[domain.open](domain.id); await flush(); const switching = t[domain.select](domain.other); await flush()
    old.resolve(t.data.get(oldKey)); await opening
    assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value, null); assert.deepEqual(t.calls, [])
    next.resolve(t.data.get(nextKey)); await switching
    assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value.id, domain.other); assert.deepEqual(t.calls, [['selection']]); t.stop()
  }
  // Seasonal selection: requested identity, configured default, then first available row.
  {
    const t = fixture()
    t.state.seasonalReadModelCatalog.value = [...t.state.seasonalReadModelCatalog.value].reverse()
    assert.equal(t.state.seasonalReadModelCatalog.value[0].id, 'white_day_2023', 'default must not be the first row in this fallback fixture')
    assert.equal((await t.loadSeasonalDetail('white_day_2023')).id, 'white_day_2023')
    assert.equal((await t.loadSeasonalDetail('missing')).id, 'valentine_2023', 'configured default takes precedence over the first row')
    t.state.seasonalReadModelCatalog.value = t.state.seasonalReadModelCatalog.value.filter(row => row.id !== 'valentine_2023')
    assert.equal((await t.loadSeasonalDetail('missing')).id, 'white_day_2023')
    t.state.seasonalReadModelCatalog.value = []; await assert.rejects(t.loadSeasonalDetail(), /No seasonal campaigns/)
    t.stop()
  }
  {
    const t = fixture()
    t.state.currentWorkMode.value = 'lines'; t.state.currentStoryFile.value = 'old.json'
    await t.openWorkArchive(ids[0]); assert.equal(t.state.currentWorkMode.value, 'stories'); assert.equal(t.state.currentStoryFile.value, '')
    t.setWorkMode('lines'); t.state.currentStoryFile.value = 'selected.json'; await t.selectWorkIdol(ids[1])
    assert.equal(t.state.currentWorkMode.value, 'lines'); assert.equal(t.state.currentCharacterId.value, ids[1]); assert.equal(t.state.currentStoryFile.value, '')
    const count = t.calls.length; t.setWorkMode('lines'); t.setWorkMode('bad'); await t.selectWorkIdol('bad'); assert.equal(t.calls.length, count)
    await t.openWorkArchive('bad'); await t.openIdolStoryArchive('bad'); assert.deepEqual(t.calls.slice(-2), [['picker', 'work'], ['picker', 'story']])
    t.state.filterQuery.value = 'query'; await t.openIdolStoryArchive(ids[0]); assert.equal(t.state.filterQuery.value, '')
    for (const name of ['currentStorySection', 'currentEpisodeId', 'currentMobileScenarioId']) t.state[name].value = 'old'
    await t.selectIdolStory(ids[1]); assert.equal(t.state.currentCharacterId.value, ids[1])
    for (const name of ['currentStorySection', 'currentEpisodeId', 'currentMobileScenarioId']) assert.equal(t.state[name].value, '')
    await t.openSeasonalCampaign(); await t.selectSeasonalCampaign('white_day_2023')
    assert.equal(t.state.currentStorySection.value, 'white_day_2023'); assert.deepEqual(t.calls.at(-1), ['selection'])
    t.stop()
  }
  // Real generic story callbacks close the factory cycle and preserve birthday return ownership.
  {
    const t = fixture()
    await t.openBirthdayIdolStory({ idolCode: ids[1], sectionId: 7, episodeId: 701 })
    assert.equal(t.state.currentStorySection.value, '7'); assert.equal(t.state.currentEpisodeId.value, '701')
    await t.openIdolBirthdayArchive()
    assert.equal(t.state.view.value, 'story_collection'); assert.equal(t.state.currentStoryDomain.value, 'birthday')
    assert.equal(t.state.storyCollectionParentView.value, 'idol_story_archive')
    await t.story.goBackFromStoryCollection(); assert.equal(t.state.view.value, 'idol_story_archive'); assert.equal(t.state.currentCharacterId.value, ids[1])
    for (const [method, field] of [['goBackFromSeasonalCampaign', 'currentStorySection'], ['goBackFromWorkArchive', 'currentCharacterId'], ['goBackFromIdolStoryArchive', 'currentCharacterId']]) {
      t.state[field].value = 'clear-me'; await t[method](); assert.equal(t.state[field].value, ''); assert.equal(t.state.view.value, 'story_catalog')
    }
    assert.ok(t.loads.some(item => item.key === 'stories:index'), 'late catalog callback executes the real generic story loader')
    t.stop()
  }
  // The shell must select the correct domain handler. Inspect its synchronous clearing
  // before the real, asynchronous story catalog entry resets the shared route fields.
  for (const [view, expected] of [
    ['seasonal_campaign', ['', 'kept-idol', '']],
    ['work_archive', ['', '', 'kept-section']],
    ['idol_story_archive', ['kept-domain', '', 'kept-section']],
  ]) {
    const t = fixture(), context = t.context
    for (const name of ['goHome', 'goBackFromGroups', 'goBackToUnits', 'goBackToFiles', 'goBackFromCards',
      'goBackToCards', 'goBackFromGasha', 'goBackFromSong', 'goBackFromEvent', 'closeHomeVisit',
      'closeStoryReader', 'closeArchivePortal', 'cancelWelcomeOrPicker', 'restoreDetailSource']) {
      if (!(name in context)) context[name] = () => { assert.fail(`Unexpected shell Back boundary: ${name}`) }
    }
    context.view.value = view; context.detailSourceRoute.value = ''
    context.currentStoryDomain.value = 'kept-domain'; context.currentCharacterId.value = 'kept-idol'; context.currentStorySection.value = 'kept-section'
    vm.runInNewContext(script.slice(shellBack.start, shellBack.end), context)
    context.goArchiveBack()
    assert.deepEqual([context.currentStoryDomain.value, context.currentCharacterId.value, context.currentStorySection.value], expected,
      `${view} dispatch preserves its domain-specific clearing contract before catalog load`)
    await flush()
    assert.equal(context.view.value, 'story_catalog', `${view} Back reaches the real story catalog`)
    assert.ok(t.loads.some(load => load.key === 'stories:index'), `${view} Back uses the real late catalog callback`)
    assert.deepEqual(t.calls, [['commit', 'story_catalog']]); t.stop()
  }
  for (const mode of ['personal', 'unit']) {
    const t = fixture()
    t.state.currentMobileMode.value = mode
    t.state.mobileIdolReadModelDetail.value = { view: { episodeRefs: [{ id: 11, idolCode: ids[0], sectionId: 1 }] } }
    t.state.mobileUnitReadModelDetail.value = { view: { episodeRefs: [{ id: 11, idolCode: ids[1], sectionId: 2 }] } }
    t.state.currentMobileScenarioId.value = 'old'; await t.openMobileIdolStory('11')
    assert.equal(t.state.currentCharacterId.value, ids[mode === 'unit' ? 1 : 0]); assert.equal(t.state.currentStorySection.value, mode === 'unit' ? '2' : '1')
    assert.equal(t.state.currentEpisodeId.value, '11'); assert.equal(t.state.currentMobileScenarioId.value, '')
    const count = t.loads.length; await t.openMobileIdolStory('missing'); assert.equal(t.loads.length, count); t.stop()
  }
  for (const entry of ['birthday', 'mobile']) for (const reject of [false, true]) for (const disposed of [false, true]) {
    const t = fixture(), job = deferred(), key = 'idol-stories:' + ids[0]
    t.jobs.set(key, job)
    t.state.mobileIdolReadModelDetail.value = { view: { episodeRefs: [{ id: 11, idolCode: ids[0], sectionId: 1 }] } }
    const pending = entry === 'birthday' ? t.openBirthdayIdolStory({ idolCode: ids[0], sectionId: 1, episodeId: 11 }) : t.openMobileIdolStory(11)
    await flush(); if (disposed) t.navigation.dispose(); else t.navigation.invalidate()
    if (reject) job.reject(Error('obsolete relation')); else job.resolve(t.data.get(key))
    await pending
    assert.equal(t.state.idolStoryReadModelDetail.value, null); assert.equal(t.state.idolStoryReadModelStatus.value, '')
    assert.deepEqual(t.calls, []); t.stop()
  }
  // Computed projections cannot show a detail from a different identity.
  {
    const t = fixture()
    const projections = [['currentSeasonalCampaign', 'seasonal', 'currentStorySection', 'campaign'], ['currentWorkIdol', 'work', 'currentCharacterId', 'idol'], ['currentIdolStoryPage', 'idolStory', 'currentCharacterId', 'page']]
    for (const [name, prefix, selected, field] of projections) {
      t.state[prefix + 'ReadModelDetail'].value = { id: 'right', view: { [field]: { marker: name } } }
      t.state[selected].value = 'wrong'; assert.equal(t[name].value, null)
      t.state[selected].value = 'right'; assert.equal(t[name].value.marker, name)
    }
    assert.equal(t.idolStoryOptions.value, t.state.idolStoryReadModelCatalog.value)
    t.state.idolStoryReadModelCatalog.value = null; assert.deepEqual(t.idolStoryOptions.value, []); t.stop()
  }
  // Catalog guards validate switch fields, order/identity, count, cancellation and cache ownership.
  for (const domain of domains) {
    const required = domain.kind === 'seasonal' ? ['detail', 'name', 'year', 'season'] : domain.kind === 'work' ? ['detail', 'idol_code', 'display_name', 'work_type_name'] : ['detail', 'idolCode', 'idolName', 'sectionCount', 'episodeCount']
    for (const broken of ['count', 'duplicate', ...required, 'abort']) {
      const t = fixture({ cached: false }), page = t.data.get(domain.kind + ':page'), controller = new AbortController()
      if (broken === 'count') t.data.get(domain.kind + ':index').count++
      else if (broken === 'duplicate') page.rows = [page.rows[0], page.rows[0]]
      else if (broken === 'abort') controller.abort()
      else delete page.rows[0][broken]
      await assert.rejects(t[domain.catalog]({ signal: controller.signal }), /mismatch|abort/i, `${domain.kind}:${broken}`)
      assert.equal(t.state[domain.prefix + 'ReadModelCatalog'].value, null); t.stop()
    }
    const t = fixture({ cached: false }); await t[domain.catalog](); const count = t.loads.length
    await t[domain.catalog](); assert.equal(t.loads.length, count)
    const controller = new AbortController(), options = { signal: controller.signal, priority: 'background' }
    await t[domain.detail](domain.id, options)
    assert.equal(t.loads.at(-1).options.signal, controller.signal); assert.equal(t.loads.at(-1).options.priority, 'background')
    assert.equal(t.loads.at(-1).options.expectedId, domain.id); assert.equal(t.loads.at(-1).descriptor.expectedId, domain.id)
    // The actual detail loader must forward cancellation to the client even when its catalog is cached.
    const transport = t.context.readModelClient.load
    t.context.readModelClient.load = (descriptor, request) => { request.signal?.throwIfAborted(); return transport(descriptor, request) }
    controller.abort(); await assert.rejects(t[domain.detail](domain.id, options), /abort/i)
    t.stop()
  }
  const badDetails = { seasonal: [['campaign', 'id'], ['campaign', 'year'], ['campaign', 'season'], ['campaign', 'participants']], work: [['idol', 'idol_code'], ['idol', 'short_stories'], ['idol', 'scene_lines'], ['sourceEvidence', 'entries'], ['readingEntries']], 'idol-stories': [['page', 'idol_code'], ['page', 'sections'], ['readingEntries']] }
  for (const domain of domains) for (const path of badDetails[domain.kind]) {
    const t = fixture(), detail = t.data.get(domain.kind + ':' + domain.id)
    let parent = detail.view; for (const key of path.slice(0, -1)) parent = parent[key]; delete parent[path.at(-1)]
    await assert.rejects(t[domain.detail](domain.id), /identity or shape mismatch/); t.stop()
  }
  // Restoration hydrates only data; current failures fall back and stale results publish nothing.
  for (const domain of domains) {
    const t = fixture(), route = routeFor(domain)
    const result = await t.prepareStoryArchiveRoute(route, { isCurrent: () => true })
    assert.equal(result.view, route.view); assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value.id, domain.id)
    assert.deepEqual(t.calls, []); t.stop()
    for (const stale of [false, true]) for (const reject of [false, true]) {
      const f = fixture(), job = deferred(), key = domain.kind + ':' + domain.id; let current = true
      f.jobs.set(key, job)
      const pending = f.prepareStoryArchiveRoute({ ...route, view: 'player', returnView: route.view }, { isCurrent: () => current }); await flush()
      current = !stale
      if (reject) job.reject(Error('read failed')); else job.resolve(f.data.get(key))
      const restored = await pending
      if (stale) { assert.equal(restored, null); assert.equal(f.state[domain.prefix + 'ReadModelDetail'].value, null); assert.equal(f.state[domain.prefix + 'ReadModelStatus'].value, '') }
      else if (reject) { assert.deepEqual(restored, domain.fallback); assert.match(f.state[domain.prefix + 'ReadModelStatus'].value, /重试/); assert.equal(f.state[domain.prefix + 'ReadModelDetail'].value, null) }
      else assert.equal(restored.returnView, domain.view)
      assert.deepEqual(f.calls, []); f.stop()
    }
  }
  // Execute App's real restoreRoute as well as the domain preparer: both its call
  // and adoption of the returned route must remain connected at this boundary.
  for (const domain of domains) {
    const t = restoreFixture(), route = routeFor(domain)
    if (domain.kind === 'seasonal') route.storySection = 'missing'
    await t.restore(route)
    assert.equal(t.invalidations(), 1, 'every history restore revokes the three private domain counters')
    assert.ok(t.loads.some(load => load.key === domain.kind + ':' + domain.id), `${domain.kind} App restore calls the production preparer`)
    assert.equal(t.state[domain.prefix + 'ReadModelDetail'].value.id, domain.id)
    assert.equal(t.applied.length, 1); assert.equal(t.applied[0].view, domain.view)
    if (domain.kind === 'seasonal') assert.equal(t.applied[0].storySection, domain.id, 'App adopts the canonical seasonal route returned by preparation')
    t.stop()
    const failed = restoreFixture(), failure = deferred(), key = domain.kind + ':' + domain.id
    failed.jobs.set(key, failure)
    const failing = failed.restore(routeFor(domain)); await flush(); failure.reject(Error('current leaf unavailable')); await failing
    assert.deepEqual(failed.applied, [domain.fallback], 'App applies the domain fallback returned by preparation')
    assert.equal(failed.state[domain.prefix + 'ReadModelDetail'].value, null); failed.stop()
    for (const reject of [false, true]) {
      const stale = restoreFixture(), job = deferred(); stale.jobs.set(key, job)
      const old = stale.restore(routeFor(domain)); await flush(); await stale.restore({ view: 'portal' })
      if (reject) job.reject(Error('obsolete leaf')); else job.resolve(stale.data.get(key))
      await old
      assert.equal(stale.invalidations(), 2); assert.deepEqual(stale.applied, [{ view: 'portal' }])
      assert.equal(stale.state[domain.prefix + 'ReadModelDetail'].value, null)
      assert.equal(stale.state[domain.prefix + 'ReadModelStatus'].value, '')
      assert.equal(stale.writes.length, 1, 'obsolete App restoration cannot rewrite the completed route'); stale.stop()
    }
  }
  for (const domain of domains) {
    const t = restoreFixture(), route = { ...routeFor(domain), view: 'player', returnView: domain.view, scenario: 'direct.json' }
    await t.restore(route)
    assert.equal(t.invalidations(), 1, 'direct player also revokes the private family requests')
    assert.equal(t.loads.length, 0, 'direct player bypasses parent-domain hydration')
    assert.deepEqual(t.applied, [route]); t.stop()
  }
  {
    const t = fixture(), episodes = [{ id: 1, file: 'one.json', exists: true }, { id: 2, file: 'missing.json', exists: false }, { id: 3, exists: true }, { id: 4, file: 'four.json', exists: true }]
    t.playSeasonalCampaignStory('season.json'); t.playWorkStory('work.json')
    assert.deepEqual(t.calls.slice(0, 2), [['play', 'season.json', 'seasonal_campaign'], ['play', 'work.json', 'work_archive']])
    t.playIdolStorySection({ episodes }); assert.deepEqual(t.calls.at(-1), ['queue', [episodes[0], episodes[3]], 0, 'idol_story_archive'])
    t.playIdolStoryEpisode({ section: { episodes }, episode: episodes[3] }); assert.deepEqual(t.calls.at(-1), ['queue', [episodes[0], episodes[3]], 1, 'idol_story_archive'])
    const count = t.calls.length; t.playIdolStoryEpisode({ section: { episodes }, episode: episodes[1] }); t.playIdolStorySection({ episodes: [episodes[1], episodes[2]] }); assert.equal(t.calls.length, count); t.stop()
  }
  // Portal captures the actual archive loaders after initialization, not replacement test callbacks.
  for (const domain of domains) {
    const t = fixture(), applied = [], context = t.context
    context.view.value = 'portal'; context.portalFrom.value = buildPortalReturnQuery(routeFor(domain))
    Object.assign(context, { homeVisits: new Map(), archiveShellVisible: ref(true), legacyEntryStatus: ref(''),
      applyArchiveRoute: async route => { applied.push(route); context.view.value = route.view }, syncArchiveRoute: () => t.calls.push(['sync']) })
    for (const property of portalBinding.init.arguments[0].properties) {
      const name = property.value.name
      if (!(name in context)) context[name] = /^(load|ensure)/.test(name) ? () => { throw Error('Unexpected portal boundary: ' + name) } : ref(null)
    }
    for (const family of domains) assert.equal(context[family.detail], t[family.detail], 'portal receives the exported production loader')
    const portal = expose(portalBinding, context); await portal.closeArchivePortal()
    assert.equal(context[domain.prefix + 'ReadModelDetail'].value.id, domain.id)
    assert.ok(t.loads.some(load => load.key === domain.kind + ':' + domain.id)); assert.equal(applied.length, 1); assert.equal(applied[0].view, domain.view)
    assert.deepEqual(t.calls, [['sync']]); t.stop()
  }
  console.log('Story archive navigation: real App bindings, late callbacks, cancellation, catalog contracts, restoration, generic-story returns and portal hydration passed')
} finally { cleanups.forEach(stop => stop()); console.error = originalError }
