import { bindCardNavigation } from './lib/card-navigation-harness.mjs'
import { bindUnitNavigation } from './lib/unit-navigation-harness.mjs'
import { bindIdolFixtureNavigation } from './lib/idol-navigation-harness.mjs'
import { bindHomeNavigation } from './lib/home-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindEventNavigation, eventFixtureDetail } from './lib/event-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(n => n.declarations || []).find(n => n.init?.callee?.name === 'useEventNavigation')
const names = n => n.type === 'Identifier' ? [n.name] : n.type === 'ObjectPattern' ? n.properties.flatMap(p => names(p.value)) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers) defined.set(s.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const d of node.declarations || []) for (const name of names(d.id)) defined.set(name, d.start)
}
for (const p of binding.init.arguments[0].properties) assert.ok(defined.get(p.value.name) < binding.start, `${p.key.name} initialized before event factory`)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 35; i++) await Promise.resolve() }
function fixture({ story = false } = {}) {
  const data = new Map(), jobs = new Map(), calls = [], loads = []
  const rows = ['410001', '410002'].map(id => ({ id, event_id: id, detail: { key: id } }))
  data.set('index', { count: 2, pages: [{ key: 'page' }] }); data.set('page', { rows })
  for (const { id } of rows) data.set(id, eventFixtureDetail(id))
  data.set('stories', { count: 0, pages: [], landing: { main: 'main', extra: 'extra', birthday: 'birthday' } })
  for (const id of ['main', 'extra', 'birthday']) data.set(id, { value: { collections: [] } })
  const c = {
    archiveBootstrap: { idols: [{ id: '001tom' }], domains: { events: { key: 'index' }, stories: 'stories' } },
    readModelClient: { async load(descriptor, options = {}) {
      const key = typeof descriptor === 'string' ? descriptor : descriptor.key
      loads.push({ key, descriptor, options })
      const value = jobs.has(key) ? await jobs.get(key).promise : structuredClone(data.get(key))
      assert.ok(value, `Unexpected descriptor ${key}`)
      if (options.expectedId) { assert.equal(descriptor.expectedId, options.expectedId); assert.equal(value.id, options.expectedId) }
      options.validate?.(value); return value
    } },
    prepareArchivePage: (_view, value) => value,
    captureDetailSource: () => calls.push(['capture']),
    commitView: view => { c.navigation.invalidate(); c.view.value = view; calls.push(['view', view]) },
    restoreDetailSource: fallback => { calls.push(['source', fallback]); c.detailSourceRoute.value = '' },
    openStoryCatalog: () => calls.push(['stories']),
    startEpisodeQueue: (...args) => calls.push(['queue', ...args]), loadScenario: (...args) => calls.push(['play', ...args]),
    loadCardCatalog: async () => { c.cardReadModelCatalog.value = [{ resource_id: 'card' }] },
    openCard: (...args) => calls.push(['card', ...args]), openIdolReadModel: (...args) => calls.push(['idol', ...args]),
    openArchiveUnit: (...args) => calls.push(['unit', ...args]),
  }
  if (story) {
    bindStoryNavigation(app, c).stop()
    // Remove the harness boundary before evaluating App's real late callback.
    delete c.openEventDetail
  }
  const api = bindEventNavigation(app, c)
  return { ...api, c, data, jobs, calls, loads }
}
function restoreFixture() {
  const t = fixture({ story: true }), c = t.c
  bindHomeNavigation(app, c).stop(); bindUnitNavigation(app, c); bindCardNavigation(app, c); bindIdolFixtureNavigation(app, c)
  bindStoryArchiveNavigation(app, c).stop(); bindLegacyAliasNavigation(app, c).stop()
  bindMobileNavigation(app, c).stop(); bindSongNavigation(app, c).stop()
  Object.assign(c, { loadingPurpose: ref(''), playbackError: ref(''), isDirectScenarioEntry,
    primeArchiveRouteComponent() {}, tracePlayer() {}, adoptArchiveViewContext() {}, writeArchiveRoute() {},
    applyArchiveRoute: async route => { t.calls.push(['apply', route]); c.view.value = route.view },
  })
  const node = body.find(n => n.id?.name === 'restoreRoute'), source = script.slice(node.start, node.end)
  for (const match of source.matchAll(/\+\+(pending\w+)/g)) c[match[1]] = 0
  vm.runInNewContext('let startupRouteNormalized = false; let restoreRequest = 0;\n' + source, c)
  return t
}
const originalError = console.error
console.error = () => {}
try {
  const t = fixture({ story: true }), c = t.c
  assert.doesNotThrow(() => c.openExternalStoryInternal({ target: { kind: 'event', event: { event_id: '410001' } } })); await flush()
  assert.equal(c.currentEventId.value, '410001', 'story-to-event callback resolves the later factory')
  assert.equal(c.eventParentView.value, 'external_story_resources')
  assert.equal(c.eventReadModelDetail.value?.id, '410001', 'publishes into the App-owned event payload')
  assert.equal(c.cardReadModelCatalog.value, null, 'event loading cannot overwrite card catalog')
  assert.equal(t.currentEvent.value.event_id, '410001')
  c.currentEventId.value = '410002'; assert.equal(t.currentEventProjection.value, null); assert.deepEqual(t.currentEventEpisodes.value, [])
  c.currentEventId.value = '410001'
  c.externalStoryResourcesData.value = { entries: [{ internal_mapping: { state: 'exact-event', event_id: 'event-410001' } }, { internal_mapping: { state: 'unmapped', event_id: 'event-410001' } }] }
  assert.equal(t.currentEventExternalResources.value.length, 1)
  c.eventReadModelDetail.value.view.episodes = [{ id: 'a', file: 'a.json' }, { id: 'missing' }, { id: 'b', file: 'b.json' }]
  t.playCurrentEvent(); assert.deepEqual(t.calls.at(-1), ['queue', [{ id: 'a', file: 'a.json' }, { id: 'b', file: 'b.json' }], 0, 'event_detail'])
  t.playCurrentEventEpisode({ id: 'b' }); assert.equal(t.calls.at(-1)[2], 1)
  const count = t.calls.length; t.playCurrentEventEpisode({ id: 'missing' }); assert.equal(t.calls.length, count)
  c.eventReadModelDetail.value.view.episodes = []
  Object.assign(c.eventReadModelDetail.value.view.story.entry, { file: 'single.json', exists: false })
  t.playCurrentEvent(); assert.equal(t.calls.length, count)
  c.eventReadModelDetail.value.view.story.entry.exists = true; t.playCurrentEvent(); assert.deepEqual(t.calls.at(-1), ['play', 'single.json', 'event_detail'])
  t.stop()

  for (const outcome of ['newer', 'invalidate', 'revision', 'dispose']) {
    const t = fixture(), c = t.c, job = deferred(); t.jobs.set('410001', job)
    const old = t.openEventDetail({ event_id: '410001' }); await flush()
    if (outcome === 'newer') await t.openEventDetail({ event_id: '410002' })
    if (outcome === 'invalidate') t.invalidateEventNavigation()
    if (outcome === 'revision') c.navigation.invalidate()
    if (outcome === 'dispose') c.navigation.dispose()
    job.resolve(eventFixtureDetail('410001')); await old
    assert.equal(c.eventReadModelDetail.value?.id || '', outcome === 'newer' ? '410002' : '')
    assert.equal(t.calls.filter(x => x[0] === 'capture').length, outcome === 'newer' ? 1 : 0)
    t.stop()
  }
  for (const corrupt of [t => t.data.get('index').count++, t => t.data.get('page').rows[1].id = '410001',
    t => t.data.get('page').rows[0].event_id = 'wrong', t => delete t.data.get('page').rows[0].detail]) {
    const t = fixture(); corrupt(t); await assert.rejects(t.loadEventCatalog(), /identity/); assert.equal(t.c.eventReadModelCatalog.value, null); t.stop()
  }
  {
    const t = fixture(), ctrl = new AbortController(); ctrl.abort()
    await assert.rejects(t.loadEventCatalog({ signal: ctrl.signal }), /abort/i); assert.equal(t.c.eventReadModelCatalog.value, null)
    await t.loadEventCatalog(); const count = t.loads.length; await t.loadEventCatalog(); assert.equal(t.loads.length, count); t.stop()
  }
  for (const corrupt of [v => v.castReferences.push({ idol_code: 'a', reference: { idolCode: 'a' } }),
    v => { v.cast = [{ idol_code: 'a' }]; v.castReferences = [{ idol_code: 'b', reference: { idolCode: 'b' } }] },
    v => { v.cast = [{ idol_code: 'a' }]; v.castReferences = [{ idol_code: 'a', reference: { idolCode: 'b' } }] }]) {
    const t = fixture(); corrupt(t.data.get('410001').view); await assert.rejects(t.loadEventDetail('410001'), /shape/); t.stop()
  }
  for (const exit of ['none', 'revision', 'view', 'event']) {
    const t = fixture(), c = t.c, job = deferred()
    // Rebind so the real factory captures the delayed cross-domain loader.
    c.loadCardCatalog = async () => { await job.promise; c.cardReadModelCatalog.value = [{ resource_id: 'card' }] }
    t.stop(); const api = bindEventNavigation(app, c)
    c.view.value = 'event_detail'; c.currentEventId.value = '410001'
    const pending = api.openEventCard({ card_resource_id: 'card' })
    if (exit === 'revision') c.navigation.invalidate()
    if (exit === 'view') c.view.value = 'home'
    if (exit === 'event') c.currentEventId.value = '410002'
    job.resolve(); await pending
    assert.equal(t.calls.length, exit === 'none' ? 1 : 0)
    if (exit === 'none') assert.deepEqual(t.calls[0], ['card', { resource_id: 'card' }, { resetContext: true, captureSource: true, clearEventContext: true }])
    api.openEventIdol({ idol_code: '001tom' }); assert.deepEqual(t.calls.at(-1), ['idol', '001tom', { captureSource: true, resetContext: true, clearUnit: true, clearEventContext: true }])
    api.openEventUnit({ unit_code: '01jup' }); assert.deepEqual(t.calls.at(-1), ['unit', { unit_code: '01jup' }, { clearEventContext: true }]); api.stop()
  }
  for (const parent of ['home', 'external_story_resources', 'card_detail', 'unit_detail', 'idol_detail', 'unknown', 'source']) {
    const t = fixture(), c = t.c
    c.currentEventId.value = '410001'; c.eventParentView.value = parent
    c.currentCard.value = {}; c.currentArchiveUnit.value = {}; c.currentCharacterId.value = '001tom'
    if (parent === 'source') c.detailSourceRoute.value = '?view=event_catalog&q=retained'
    const back = body.find(n => n.id?.name === 'goArchiveBack').body.body.find(n => n.declarations?.[0]?.id.name === 'backByView').declarations[0].init.properties.find(p => p.key.name === 'event_detail')
    vm.runInNewContext('(' + script.slice(back.value.start, back.value.end) + ')()', c)
    assert.equal(c.currentEventId.value, ''); assert.equal(c.eventParentView.value, '')
    assert.equal(t.calls.at(-1)[0], parent === 'source' ? 'source' : parent === 'unknown' ? 'stories' : 'view')
    if (!['source', 'unknown'].includes(parent)) assert.equal(t.calls.at(-1)[1], parent)
    t.stop()
  }
  for (const kind of ['success', 'failure', 'stale', 'direct']) {
    const t = restoreFixture(), c = t.c, job = deferred()
    const route = kind === 'direct' ? { view: 'player', scenario: 'direct.json', event: '410001', returnView: 'event_detail' } : { view: 'event_detail', event: '410001' }
    if (kind === 'failure') t.data.get('410001').view.schemaVersion = 1
    if (kind === 'stale') t.jobs.set('410001', job)
    const pending = c.restoreRoute(route)
    if (kind === 'stale') { await flush(); c.navigation.invalidate(); job.resolve(eventFixtureDetail('410001')) }
    await pending
    const applied = t.calls.filter(x => x[0] === 'apply')
    assert.equal(applied.length, kind === 'stale' ? 0 : 1)
    if (applied.length) assert.equal(applied[0][1].view, kind === 'failure' ? 'story_catalog' : route.view)
    if (kind === 'success') assert.equal(c.eventReadModelDetail.value.id, '410001')
    if (kind === 'stale') assert.equal(c.eventReadModelDetail.value, null, 'obsolete restore cannot publish payload')
    if (kind === 'direct') assert.equal(t.loads.length, 0, 'direct scenario does not hydrate parent event')
    t.stop()
  }
} finally { console.error = originalError }
console.log('Event navigation: real App wiring/order/restore, projection identity, queues, catalog validation/cancellation, races, source returns and relation guards passed')
