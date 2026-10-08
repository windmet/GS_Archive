import { bindResourceNavigation } from './lib/resource-navigation-harness.mjs'
import vm from 'node:vm'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindUnitNavigation } from './lib/unit-navigation-harness.mjs'
import { bindIdolNavigation } from './lib/idol-navigation-harness.mjs'
import { bindHomeNavigation } from './lib/home-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { bindEventNavigation } from './lib/event-navigation-harness.mjs'
import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'
import { bindCardNavigation, createCardFixtureTransport, deferredCard } from './lib/card-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { watch } from 'vue'
import { bindGashaNavigation, createGashaFixtureTransport, deferredGasha } from './lib/gasha-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(node => node.declarations || []).find(node => node.init?.callee?.name === 'useGashaNavigation')
const names = node => node.type === 'Identifier' ? [node.name] : node.type === 'ObjectPattern' ? node.properties.flatMap(property => names(property.value)) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) defined.set(specifier.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const declaration of node.declarations || []) for (const name of names(declaration.id)) defined.set(name, declaration.start)
}
for (const factory of body.flatMap(node => node.declarations || []).filter(node => ['useGashaNavigation', 'useCardNavigation'].includes(node.init?.callee?.name))) {
  for (const property of factory.init.arguments[0].properties) if (property.value.type === 'Identifier')
    assert.ok(defined.get(property.value.name) < factory.start, `${property.key.name} initialized before ${factory.init.callee.name}`)
}
const equal = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)
const settle = () => new Promise(resolve => setImmediate(resolve))
function setup(overrides = {}) {
  const transport = createGashaFixtureTransport(), commits = [], captures = [], errors = [], prepared = [], cards = []
  const c = {
    archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    view: { value: 'gashas' }, filterQuery: { value: 'existing query' }, detailSourceRoute: { value: '?view=portal' },
    currentGashaCategory: { value: 'growing_fes' }, currentGashaId: { value: 'old' },
    currentCategoryId: { value: 'cards' }, currentCharacterId: { value: '001tom' }, currentCardId: { value: 'card' },
    prepareArchivePage: (view, pending) => { prepared.push(view); return pending },
    captureDetailSource: () => captures.push(c.view.value),
    commitView: view => { commits.push(view); c.view.value = view; c.loading.value = false; c.navigation.invalidate() },
    openCard: (...args) => { cards.push(args); return 'card-result' },
    console: { error: (...args) => errors.push(args) }, ...overrides,
  }
  console.error = (...args) => errors.push(args)
  bindGashaNavigation(app, c)
  const hold = url => { const job = deferredGasha(); transport.jobs.set(url, job); return job }
  return { c, ...transport, commits, captures, errors, prepared, cards, hold }
}

function restoration() {
  const t = setup(), c = t.c, applied = []
  bindResourceNavigation(app, c)
  bindCardNavigation(app, c); bindIdolNavigation(app, c); bindUnitNavigation(app, c); bindHomeNavigation(app, c).stop()
  bindStoryNavigation(app, c).stop(); bindStoryArchiveNavigation(app, c).stop()
  bindEventNavigation(app, c).stop(); bindLegacyAliasNavigation(app, c).stop()
  bindMobileNavigation(app, c).stop(); bindSongNavigation(app, c).stop()
  Object.assign(c, { loadingPurpose: { value: '' }, playbackError: { value: '' }, isDirectScenarioEntry,
    primeArchiveRouteComponent() {}, tracePlayer() {}, adoptArchiveViewContext() {}, writeArchiveRoute() {},
    applyArchiveRoute: async route => { applied.push(route); c.view.value = route.view },
  })
  const node = body.find(node => node.id?.name === 'restoreRoute'), source = script.slice(node.start, node.end)
  for (const match of source.matchAll(/\+\+(pending\w+)/g)) c[match[1]] = 0
  vm.runInNewContext('let startupRouteNormalized = false; let restoreRequest = 0;\n' + source, c)
  return { ...t, applied }
}

const originalConsoleError = console.error
try {
{
  const t = setup(), controller = new AbortController()
  const detail = await t.c.loadGashaDetail(t.ids[0], { signal: controller.signal, priority: 'visible' })
  equal(t.loads.map(row => row.descriptor.url), ['gasha-index', 'gasha-page-1', 'gasha-page-2', `gasha:${t.ids[0]}`])
  for (const { options } of t.loads) { assert.equal(options.signal, controller.signal); assert.equal(options.priority, 'visible') }
  assert.ok(Array.isArray(detail.gasha.tickets), 'linked detail receives the real matching tickets')
  equal(detail.gasha.tickets.map(row => row.id), t.ticket.tickets.map(row => row.id))
  assert.equal(detail.gasha.ticket_evidence.source_name, t.ticket.source_name)
  await t.c.loadGashaDetail(t.ids[1]); assert.equal(t.loads.filter(row => row.descriptor.url === 'gasha-index').length, 1)
  const count = t.loads.length
  let supplemental
  await assert.doesNotReject(async () => { supplemental = await t.c.loadGashaDetail(t.supplement.id) })
  assert.equal(t.loads.length, count, 'supplemental item-masterdata detail does not request a nonexistent leaf')
  assert.equal(supplemental.id, t.supplement.id); assert.equal(supplemental.gasha.source_type, 'item-masterdata')
  equal(supplemental.gasha.tickets.map(row => row.id), t.supplement.tickets.map(row => row.id))
  await assert.rejects(t.c.loadGashaDetail('missing'), /Unavailable gasha/); assert.equal(t.loads.length, count)
}
for (const corrupt of [
  t => { t.data.get('gasha-index').count++ }, t => { t.bootstrap.counts.primary_gashas++ },
  t => { t.data.get('gasha-page-2').rows = [] },
  t => { t.data.get('gasha-page-2').rows[0].id = t.ids[0] },
  t => { t.data.get('gasha-page-1').rows[0].phase = 'reprint' },
  t => { delete t.data.get('gasha-page-1').rows[0].detail },
]) {
  const t = setup(); corrupt(t)
  await assert.rejects(t.c.loadGashaCatalog(), /Gasha catalog count or identity mismatch/)
  assert.equal(t.c.gashaReadModelCatalog.value, null); assert.equal(t.c.gashaCatalogFunctions.value, null)
}
for (const corrupt of [detail => { detail.gasha.id = 'wrong' }, detail => { detail.gasha.derived_pickup_cards = {} }]) {
  const t = setup(); corrupt(t.data.get(`gasha:${t.ids[0]}`))
  await assert.rejects(t.c.loadGashaDetail(t.ids[0]), /Gasha detail identity or shape mismatch/)
}
{
  const t = setup(); t.data.get(`gasha:${t.ids[0]}`).gasha.display_name = 'stale source name'
  const detail = await t.c.loadGashaDetail(t.ids[0])
  assert.equal(detail.gasha.tickets, undefined, 'ticket evidence must not attach by ID alone')
}
{
  const t = setup(), controller = new AbortController(), job = t.hold('gasha-page-2')
  const pending = t.c.loadGashaCatalog({ signal: controller.signal }); await settle()
  controller.abort(); job.resolve(t.data.get('gasha-page-2')); await assert.rejects(pending, /abort/i)
  assert.equal(t.c.gashaCatalogFunctions.value, null); assert.equal(t.c.gashaReadModelCatalog.value, null)
}
// The second cancellation check protects publication if invalidation occurs while the function ref is published.
{
  const t = setup(), controller = new AbortController()
  const stop = watch(t.c.gashaCatalogFunctions, () => controller.abort(), { flush: 'sync' })
  try {
    await assert.rejects(t.c.loadGashaCatalog({ signal: controller.signal }), /abort/i)
    assert.equal(t.c.gashaReadModelCatalog.value, null)
  } finally { stop() }
}
for (const preserveBrowse of [false, true]) for (const sourceView of ['portal', 'card_detail']) {
  const t = setup(); t.c.view.value = sourceView; t.c.gashaParentView.value = 'story_collection'
  await t.c.openGashaCatalog({ preserveBrowse })
  equal(t.commits, ['gashas']); equal(t.prepared, ['gashas']); equal(t.captures, [])
  assert.equal(t.c.filterQuery.value, preserveBrowse ? 'existing query' : '')
  assert.equal(t.c.currentGashaCategory.value, preserveBrowse ? 'growing_fes' : 'all')
  assert.equal(t.c.detailSourceRoute.value, preserveBrowse || sourceView === 'portal' ? '?view=portal' : '')
  for (const name of ['currentCategoryId', 'currentCharacterId', 'currentCardId', 'currentGashaId', 'gashaParentView']) assert.equal(t.c[name].value, '')
}
for (const sourceView of ['gashas', 'story_collection', 'card_detail']) {
  const t = setup(); t.c.view.value = sourceView; t.c.currentStoryDomain.value = 'extra'
  await t.c.openGasha({ id: Number(t.ids[0]) })
  equal(t.commits, ['gasha_detail']); equal(t.prepared, ['gasha_detail']); equal(t.captures, [sourceView])
  assert.equal(t.c.currentGashaId.value, t.ids[0]); assert.equal(t.c.currentGasha.value.id, t.ids[0])
  assert.equal(t.c.filterQuery.value, sourceView === 'gashas' ? 'existing query' : '')
  assert.equal(t.c.gashaParentView.value, sourceView === 'story_collection' ? 'story_collection' : '')
  for (const name of ['currentCategoryId', 'currentCharacterId', 'currentCardId']) assert.equal(t.c[name].value, '')
  t.c.currentGashaId.value = 'other'; assert.equal(t.c.currentGasha.value, null, 'stale detail stays hidden')
  t.c.currentStoryCollection.value = { id: 'collection' }; t.c.goBackFromGasha()
  assert.equal(t.commits.at(-1), sourceView === 'story_collection' ? 'story_collection' : 'gashas')
  assert.equal(t.c.gashaParentView.value, ''); assert.equal(t.c.currentGashaId.value, '')
}
{
  const t = setup(); t.c.gashaParentView.value = 'story_collection'; t.c.goBackFromGasha()
  equal(t.commits, ['gashas'], 'missing source collection falls back to catalog')
  assert.equal(t.c.openGasha(null), undefined)
}
{
  const t = setup(); t.c.view.value = 'story_collection'; t.c.currentStoryDomain.value = 'main'
  await t.c.openGasha({ id: t.ids[0] })
  assert.equal(t.c.gashaParentView.value, '', 'only extra collections supply the special return parent')
}
const open = (t, kind, id = t.ids[0]) => kind === 'detail' ? t.c.openGasha({ id }) : t.c.openGashaCatalog()
// Preload the actual catalog for leaf races; page races instead retain a pending page transport.
for (const oldKind of ['detail', 'catalog']) for (const newKind of ['detail', 'catalog']) for (const fail of [false, true]) {
  const t = setup()
  if (oldKind === 'detail') await t.c.loadGashaCatalog()
  const url = oldKind === 'detail' ? `gasha:${t.ids[0]}` : 'gasha-page-2', job = t.hold(url)
  const old = open(t, oldKind); await settle(); t.jobs.delete(url)
  await open(t, newKind, t.ids[1])
  const snapshot = JSON.stringify({ view: t.c.view.value, id: t.c.currentGashaId.value, detail: t.c.gashaReadModelDetail.value, status: t.c.gashaReadModelStatus.value })
  if (fail) job.reject(Error('old failure')); else job.resolve(t.data.get(url))
  await old
  assert.equal(JSON.stringify({ view: t.c.view.value, id: t.c.currentGashaId.value, detail: t.c.gashaReadModelDetail.value, status: t.c.gashaReadModelStatus.value }), snapshot)
  assert.equal(t.commits.length, 1); equal(t.errors, [])
}
for (const kind of ['detail', 'catalog']) for (const action of ['invalidate', 'dispose']) {
  const t = setup(); await t.c.loadGashaCatalog()
  if (kind === 'catalog') t.c.gashaReadModelCatalog.value = null
  const url = kind === 'detail' ? `gasha:${t.ids[0]}` : 'gasha-page-2', job = t.hold(url)
  const pending = open(t, kind); await settle(); t.c.navigation[action](); job.resolve(t.data.get(url)); await pending
  equal(t.commits, [])
}
for (const kind of ['detail', 'catalog']) {
  const t = setup(); await t.c.loadGashaCatalog(); t.c.navigation.invalidate = () => {}
  const job = t.hold(`gasha:${t.ids[0]}`), pending = open(t, 'detail'); await settle()
  await open(t, kind, t.ids[1]); job.resolve(t.data.get(`gasha:${t.ids[0]}`)); await pending
  assert.equal(t.commits.length, 1, `${kind} shares the feature request counter`)
}
for (const kind of ['detail', 'catalog']) {
  const t = setup(); await t.c.loadGashaCatalog()
  if (kind === 'catalog') t.c.gashaReadModelCatalog.value = null
  const url = kind === 'detail' ? `gasha:${t.ids[0]}` : 'gasha-page-2', job = t.hold(url)
  const pending = open(t, kind); await settle(); job.reject(Error('offline')); await pending
  assert.equal(t.c.loading.value, false); assert.match(t.c.gashaReadModelStatus.value, /重试/); assert.equal(t.errors.length, 1)
  t.jobs.delete(url); await open(t, kind); assert.equal(t.commits.length, 1)
}
{
  const ready = deferredGasha(), t = setup({ prepareArchivePage: async (_view, pending) => { const result = await pending; await ready.promise; return result } })
  const pending = open(t, 'detail'); await settle(); equal(t.commits, [])
  t.c.navigation.invalidate(); ready.resolve(); await pending; equal(t.commits, [])
}
{
  const t = setup(); await t.c.loadGashaCatalog()
  t.c.currentGashaCategory.value = 'ticket_named'; t.c.filterQuery.value = ''
  assert.ok(t.c.filteredGashas.value.length > 0)
  assert.ok(t.c.filteredGashas.value.every(row => row.source_type === 'item-masterdata'))
  const option = t.c.gashaCategoryOptions.value.find(row => row.value === 'ticket_named')
  assert.equal(option.count, t.c.filteredGashas.value.length)
  assert.equal(typeof t.ticket.translation, 'string'); assert.ok(t.ticket.translation.length)
  assert.notEqual(t.ticket.translation, t.ticket.source_name, 'fixture exercises a translated search term')
  t.c.currentGashaCategory.value = 'all'; t.c.filterQuery.value = t.ticket.translation
  assert.ok(t.c.filteredGashas.value.some(row => String(row.id) === t.ids[0]), 'translated gasha names remain searchable')
  t.c.filterQuery.value = 'idol:001tom'; equal(t.c.filteredGashas.value.map(row => String(row.id)), t.ids)
}
{
  const job = deferredGasha(), card = { resource_id: 'card', character_id: '001tom' }; let loads = 0
  const t = setup({ loadCardCatalog: async () => { loads++; await job.promise; t.c.cardReadModelCatalog.value = [card] } })
  const pending = t.c.openGashaCard({ card_resource_id: 'card' }); equal(t.cards, [])
  job.resolve(); assert.equal(await pending, 'card-result')
  equal(t.cards, [[card, { resetContext: true }]])
  await t.c.openGashaCard({ card_resource_id: 'missing' }); assert.equal(t.cards.length, 1); assert.equal(loads, 1)
}
// Restore through App's actual dispatcher as well as the feature preparation boundary.
for (const kind of ['gashas', 'gasha_detail']) {
  const t = restoration(), route = { view: kind, gasha: t.ids[0], query: 'keep', gashaCategory: 'ticket_named' }
  await t.c.restoreRoute(route)
  equal(t.applied, [route]); assert.equal(t.c.gashaReadModelStatus.value, '')
  if (kind === 'gasha_detail') assert.equal(t.c.gashaReadModelDetail.value.id, t.ids[0])
}
{
  const t = restoration(), route = { view: 'gasha_detail', gasha: 'missing', query: 'keep', sourceRoute: '?view=portal' }
  await t.c.restoreRoute(route)
  equal(t.applied, [{ ...route, view: 'gashas', gasha: '' }])
  assert.match(t.c.gashaReadModelStatus.value, /重试/)
}
for (const fails of [false, true]) {
  const t = restoration(), job = t.hold(`gasha:${t.ids[0]}`)
  const pending = t.c.restoreRoute({ view: 'gasha_detail', gasha: t.ids[0] }); await settle()
  await t.c.restoreRoute({ view: 'about' })
  if (fails) job.reject(Error('late')); else job.resolve(t.data.get(`gasha:${t.ids[0]}`))
  await pending; equal(t.applied, [{ view: 'about' }]); assert.equal(t.c.gashaReadModelDetail.value, null)
  assert.equal(t.errors.length, 0)
}
{
  const t = restoration(); await t.c.loadGashaCatalog()
  const job = t.hold(`gasha:${t.ids[0]}`), pending = t.c.openGasha({ id: t.ids[0] }); await settle()
  await t.c.restoreRoute({ view: 'about' })
  job.resolve(t.data.get(`gasha:${t.ids[0]}`)); await pending
  equal(t.commits, []); equal(t.applied, [{ view: 'about' }])
}
{
  const t = setup(), c = t.c
  bindCardNavigation(app, c) // Card captures App's deferred call to the later Gasha factory.
  bindGashaNavigation(app, c)
  c.currentCardId.value = 'card'
  c.cardReadModelDetail.value = { id: 'card', gashaRelation: { announcement_id: t.ids[0] } }
  const relation = c.currentCardGashaRelation.value
  assert.ok(relation)
  await c.loadGashaCatalog()
  c.openCardGasha(relation); await settle(); assert.equal(c.currentGashaId.value, t.ids[0])
  equal(t.commits, ['gasha_detail'])
}
console.log('Gasha loading boundary passed: real dynamic imports, ticket supplement and identity, shared races, cancellation, browsing and return sources')

} finally { console.error = originalConsoleError }
