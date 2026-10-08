import { bindResourceNavigation } from './lib/resource-navigation-harness.mjs'
import { bindGashaNavigation } from './lib/gasha-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(node => node.declarations || []).find(node => node.init?.callee?.name === 'useCardNavigation')
const names = node => node.type === 'Identifier' ? [node.name] : node.type === 'ObjectPattern' ? node.properties.flatMap(property => names(property.value)) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) defined.set(specifier.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const declaration of node.declarations || []) for (const name of names(declaration.id)) defined.set(name, declaration.start)
}
for (const property of binding.init.arguments[0].properties) if (property.value.type === 'Identifier')
  assert.ok(defined.get(property.value.name) < binding.start, `${property.key.name} initialized before Card factory`)
const originalConsoleError = console.error
try {
const settle = () => new Promise(resolve => setImmediate(resolve))
function setup(source = app, overrides = {}) {
  const transport = createCardFixtureTransport(), commits = [], captures = [], errors = [], prepared = [], calls = []
  const context = { archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    view: { value: 'unit_detail' }, currentArchiveUnit: { value: { unit_id: 1 } },
    currentArchiveUnitCode: { value: '01jup' }, currentCharacterId: { value: '001tom' },
    currentCardId: { value: 'old' }, currentCategoryId: { value: 'idol' },
    currentEventId: { value: 'event' }, eventParentView: { value: 'unit_detail' },
    filterQuery: { value: 'old' }, currentCardRarity: { value: 'SSR' }, currentCardAttribute: { value: 'Mental' },
    currentCardAssetState: { value: 'missing_normal' }, currentCardRelationState: { value: 'unrelated' },
    prepareArchivePage: (view, pending) => { prepared.push(view); return pending },
    captureDetailSource: () => captures.push(context.view.value),
    commitView: view => { commits.push(view); context.view.value = view; context.loading.value = false; context.navigation.invalidate() },
    commitArchiveSelection: () => { commits.push('selection'); context.navigation.invalidate() },
    restoreDetailSource: fallback => { calls.push(['restore', context.currentCardId.value]); return fallback() },
    console: { error: (...args) => errors.push(args) },
    ...overrides,
  }
  for (const name of ['openIdolReadModel', 'loadScenario', 'openEventDetail', 'openGasha'])
    context[name] = (...args) => { calls.push([name, ...args]); return 'pending' }
  bindCardNavigation(source, context)
  console.error = context.console.error
  const hold = url => { const job = deferredCard(); transport.jobs.set(url, job); return job }
  return { context, transport, commits, captures, errors, prepared, calls, hold }
}
const equal = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message)
function restoration() {
  const t = setup(), c = t.context, applied = []
  bindGashaNavigation(app, c); bindResourceNavigation(app, c); bindIdolNavigation(app, c); bindUnitNavigation(app, c); bindHomeNavigation(app, c).stop()
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

{
  const t = setup(), controller = new AbortController()
  await t.context.loadCardDetail('first', { signal: controller.signal, priority: 'visible' })
  equal(t.transport.loads.map(row => row.descriptor.url), ['card-index', 'card-page-1', 'card-page-2', 'card:first'])
  for (const { options } of t.transport.loads) { assert.equal(options.signal, controller.signal); assert.equal(options.priority, 'visible') }
  await t.context.loadCardDetail('second')
  assert.equal(t.transport.loads.filter(row => row.descriptor.url === 'card-index').length, 1)
  await assert.rejects(t.context.loadCardDetail('missing'), /Unavailable card/)
  assert.equal(t.transport.loads.length, 5, 'missing identities do not request a leaf')
}
for (const corrupt of [
  t => t.transport.data.get('card-index').count++, t => t.transport.bootstrap.counts.canonical_cards++,
  t => t.transport.data.get('card-page-2').rows.pop(),
  t => { t.transport.data.get('card-page-2').rows[0] = structuredClone(t.transport.data.get('card-page-1').rows[0]) },
  ...['id', 'detail', 'ownerReference', 'home_voice_count', 'scenario_count'].map(key => t => {
    t.transport.data.get('card-page-1').rows[0][key] = null
  }),
]) {
  const t = setup(); corrupt(t)
  await assert.rejects(t.context.loadCardCatalog(), /Card catalog count or identity mismatch/)
  assert.equal(t.context.cardReadModelCatalog.value, null)
}
for (const corrupt of [
  data => { data.card.resource_id = 'wrong' }, data => { data.ownerReference = null },
  data => { data.card.home_voice_cues = {} }, data => { data.card.scenario_entries = null },
]) {
  const t = setup(); corrupt(t.transport.data.get('card:first'))
  await assert.rejects(t.context.loadCardDetail('first'), /Card detail identity or shape mismatch/)
}
{
  const t = setup(), job = t.hold('card-page-2'), controller = new AbortController()
  const pending = t.context.loadCardCatalog({ signal: controller.signal })
  await settle(); controller.abort(); job.resolve(t.transport.data.get('card-page-2'))
  await assert.rejects(pending, /abort/i); assert.equal(t.context.cardReadModelCatalog.value, null)
}

// Facets are optional, but only the matching release and leaf hash may supply attributes.
for (const mode of ['valid', 'wrong-release', 'wrong-hash', 'wrong-attribute', 'offline', 'http-error']) {
  const t = setup(), row = t.transport.data.get('card-page-1').rows[0]
  row.attribute = ''
  let requests = 0
  t.context.fetch = async url => {
    assert.equal(url, '/data/assets/portal_card_facets.json'); requests++
    if (mode === 'offline') throw Error('offline')
    return { ok: mode !== 'http-error', json: async () => ({
      release: mode === 'wrong-release' ? 'other' : t.transport.bootstrap.release,
      cards: { first: { detailSha256: mode === 'wrong-hash' ? 'wrong' : row.detail.sha256,
        attribute: mode === 'wrong-attribute' ? 'Other' : 'Intelligence' } },
    }) }
  }
  const rows = await t.context.loadCardCatalog()
  assert.equal(rows[0].attribute, mode === 'valid' ? 'Intelligence' : '')
  assert.equal(rows[1].attribute, 'Mental', 'existing inline attribute remains authoritative')
  assert.equal(requests, 1)
}
{
  const t = setup(), job = deferredCard(); let count = 0
  t.context.fetch = () => { count++; return job.promise }
  const first = t.context.loadCardFacets(), second = t.context.loadCardFacets()
  assert.equal(first, second); assert.equal(count, 1)
  job.reject(Error('offline')); await assert.rejects(first, /offline/)
  t.context.fetch = async () => { count++; return { ok: true, json: async () => ({ cards: {} }) } }
  await assert.doesNotReject(t.context.loadCardFacets(), 'failed facets request must be retryable')
  await t.context.loadCardFacets(); assert.equal(count, 2)
}
{
  const t = setup(), job = deferredCard(), controller = new AbortController()
  t.transport.data.get('card-page-1').rows[0].attribute = ''
  t.context.fetch = () => job.promise
  const pending = t.context.loadCardCatalog({ signal: controller.signal })
  await settle(); controller.abort(); job.resolve({ ok: true, json: async () => ({}) })
  await assert.rejects(pending, /abort/i); assert.equal(t.context.cardReadModelCatalog.value, null)
}
{
  const t = setup(), c = t.context
  await c.openPrimaryCards('002sht', { captureSource: true, rarity: 'SR', attribute: 'Physical' })
  equal(t.commits, ['cards']); equal(t.prepared, ['cards']); equal(t.captures, ['unit_detail'])
  assert.equal(c.currentCategoryId.value, 'cards'); assert.equal(c.currentCharacterId.value, '002sht')
  assert.equal(c.currentCardRarity.value, 'SR'); assert.equal(c.currentCardAttribute.value, 'Physical')
  assert.equal(c.filterQuery.value, ''); assert.equal(c.currentCardId.value, ''); assert.equal(c.currentGroup.value, null)
  assert.equal(c.currentCardAssetState.value, 'all'); assert.equal(c.currentCardRelationState.value, 'all')
  await c.openPrimaryCards('unknown', { rarity: 'unknown', attribute: 'unknown' })
  assert.equal(c.currentCharacterId.value, ''); assert.equal(c.currentCardRarity.value, 'all'); assert.equal(c.currentCardAttribute.value, 'all')
  assert.equal(t.captures.length, 1)
}
{
  const t = setup(), c = t.context
  await c.openUnitCards()
  equal(t.commits, ['idols']); equal(t.captures, ['unit_detail'])
  assert.equal(c.currentIdolUnitFilter.value, '1'); assert.equal(c.currentArchiveUnitCode.value, '')
  assert.equal(c.currentCharacterId.value, ''); assert.equal(c.currentCategoryId.value, 'cards')
  for (const name of ['currentCardRarity', 'currentCardAttribute', 'currentCardAssetState', 'currentCardRelationState']) assert.equal(c[name].value, 'all')
  c.currentArchiveUnit.value = null; assert.equal(c.openUnitCards(), undefined); assert.equal(t.commits.length, 1)
}
for (const reset of [false, true]) {
  const t = setup(), c = t.context
  await c.openCard({ resource_id: 'third', character_id: '002sht' }, { resetContext: reset, clearEventContext: reset })
  equal(t.commits, ['card_detail']); equal(t.prepared, ['card_detail']); equal(t.captures, ['unit_detail'])
  assert.equal(c.currentCardId.value, 'third'); assert.equal(c.currentCard.value.resource_id, 'third')
  assert.equal(c.currentCategoryId.value, reset ? 'cards' : 'idol'); assert.equal(c.currentCharacterId.value, reset ? '002sht' : '001tom')
  assert.equal(c.filterQuery.value, reset ? '' : 'old'); assert.equal(c.currentEventId.value, reset ? '' : 'event')
  assert.equal(c.eventParentView.value, reset ? '' : 'unit_detail')
  await c.openCard({ resource_id: 'second' }); assert.equal(t.captures.length, 1)
  await c.openCard({ resource_id: 'first' }, { captureSource: true }); assert.equal(t.captures.length, 2)
  assert.equal(c.openCard(null), undefined)
}

// Exercise all three entrances in both directions; delayed transports ignore abort on purpose.
const open = (c, kind) => kind === 'detail' ? c.openCard({ resource_id: 'first' })
  : kind === 'unit' ? c.openUnitCards() : c.openPrimaryCards('002sht')
for (const oldKind of ['detail', 'unit', 'list']) for (const newKind of ['detail', 'unit', 'list']) for (const fail of [false, true]) {
  const t = setup(), c = t.context
  const url = oldKind === 'detail' ? 'card:first' : 'card-page-2', job = t.hold(url)
  const old = open(c, oldKind); await settle()
  t.transport.jobs.delete(url)
  const current = newKind === 'detail' ? c.openCard({ resource_id: 'second' }) : open(c, newKind)
  await current
  const snapshot = JSON.stringify({ card: c.currentCardId.value, unit: c.currentIdolUnitFilter.value,
    view: c.view.value, status: c.cardReadModelStatus.value, unitStatus: c.unitReadModelStatus.value, detail: c.cardReadModelDetail.value })
  if (fail) job.reject(Error('old failure')); else job.resolve(structuredClone(t.transport.data.get(url)))
  await old
  assert.equal(JSON.stringify({ card: c.currentCardId.value, unit: c.currentIdolUnitFilter.value,
    view: c.view.value, status: c.cardReadModelStatus.value, unitStatus: c.unitReadModelStatus.value, detail: c.cardReadModelDetail.value }), snapshot)
  assert.equal(t.commits.length, 1, `${oldKind} -> ${newKind}: only current owner publishes`)
  assert.equal(t.errors.length, 0)
}
for (const action of ['invalidate', 'dispose']) for (const kind of ['detail', 'unit', 'list']) {
  const t = setup(), url = kind === 'detail' ? 'card:first' : 'card-page-2', job = t.hold(url), pending = open(t.context, kind)
  await settle(); t.context.navigation[action](); job.resolve(t.transport.data.get(url)); await pending
  equal(t.commits, []); assert.equal(t.context.cardReadModelDetail.value, null)
}
// Isolate the feature counter from the independent global revision guard.
for (const kind of ['detail', 'unit', 'list']) {
  const t = setup(), c = t.context
  c.navigation.invalidate = () => {}
  const job = t.hold('card:first'), old = c.openCard({ resource_id: 'first' })
  await settle(); await (kind === 'detail' ? c.openCard({ resource_id: 'second' }) : open(c, kind))
  job.resolve(t.transport.data.get('card:first')); await old
  assert.equal(t.commits.length, 1, `${kind} shares the feature counter with card detail`)
}
{
  const page = deferredCard()
  const t = setup(app, { prepareArchivePage: async (_view, pending) => { const data = await pending; await page.promise; return data } }), c = t.context
  const pending = c.openCard({ resource_id: 'first' }); await settle()
  assert.equal(t.commits.length, 0, 'loading data alone must not publish before the page is prepared')
  c.navigation.invalidate(); page.resolve(); await pending
  assert.equal(t.commits.length, 0, 'leaving during page preparation revokes publication')
}
for (const kind of ['detail', 'unit', 'list']) {
  const t = setup(), url = kind === 'detail' ? 'card:first' : 'card-page-2', job = t.hold(url)
  const pending = open(t.context, kind); await settle(); job.reject(Error('offline')); await pending
  equal(t.commits, []); assert.equal(t.context.loading.value, false); assert.equal(t.errors.length, 1)
  assert.match((kind === 'unit' ? t.context.unitReadModelStatus : t.context.cardReadModelStatus).value, /重试/)
  t.transport.jobs.delete(url); await open(t.context, kind); assert.equal(t.commits.length, 1)
}

{
  const t = setup(), c = t.context
  await c.openPrimaryCards('001tom'); await c.openCard({ resource_id: 'first' })
  equal(c.currentCards.value.map(row => row.id), ['first', 'second'])
  assert.equal(c.previousCard.value, null); assert.equal(c.nextCard.value.id, 'second')
  equal(c.currentSeriesCards.value.map(row => row.character_name), ['source:001tom', 'source:001tom', 'source:002sht'])
  assert.equal(c.currentCardOwnerReference.value.displayName, 'display:001tom')
  assert.equal(c.currentCardCharacterName.value, 'display:001tom')
  c.currentCardRarity.value = 'SR'; equal(c.filteredCards.value.map(row => row.id), ['second'])
  c.currentCardId.value = 'second'
  assert.equal(c.previousCard.value.id, 'first'); assert.equal(c.nextCard.value, null)
  for (const name of ['currentCard', 'currentCardOwnerReference', 'currentCardAssetStatus', 'currentCardEventRelation', 'currentCardGashaRelation', 'currentCardLimitbreakMaterial']) assert.equal(c[name].value, null, `${name} isolates stale detail`)
  equal(c.currentSeriesCards.value, [])
  c.selectCardIdol('unknown'); assert.equal(c.currentCharacterId.value, '001tom')
  c.selectCardIdol('002sht'); assert.equal(c.currentCharacterId.value, '002sht'); assert.equal(c.currentCardId.value, '')
  assert.equal(t.commits.at(-1), 'selection'); assert.equal(c.currentCardRarity.value, 'all')
  c.selectCardIdol(''); assert.equal(c.currentCardCharacterName.value, '全部卡片')
}
{
  const t = setup(), c = t.context
  await c.openCard({ resource_id: 'first' })
  assert.equal(c.openCardIdol('001tom'), 'pending'); c.openCardIdol('002sht'); c.openCardIdol('unknown')
  assert.equal(c.openCardScenario({ compiled_file: 'chapter.json' }), 'pending'); c.openCardScenario({})
  assert.equal(c.openCardEvent({ event_id: 'event' }), 'pending')
  c.openCardGasha({ announcement_id: 12 }); c.openCardGasha({})
  equal(t.calls, [['openIdolReadModel', '001tom', { captureSource: true, resetContext: true }],
    ['loadScenario', 'chapter.json', 'card_detail'], ['openEventDetail', { event_id: 'event' }, 'card_detail'], ['openGasha', { id: '12' }]])
  c.detailSourceRoute.value = '?view=unit_detail'
  c.goBackToCards(); equal(t.calls.at(-1), ['restore', '']); assert.equal(t.commits.at(-1), 'cards')
  c.detailSourceRoute.value = ''; const count = t.calls.length; c.goBackToCards(); assert.equal(t.calls.length, count)
}
{
  const t = setup(), c = t.context
  await c.openPrimaryCards('001tom')
  c.currentCardAttribute.value = 'Mental'; equal(c.filteredCards.value.map(row => row.id), ['second'])
  c.currentCardAttribute.value = 'all'; c.currentCardRelationState.value = 'card_story'
  equal(c.filteredCards.value.map(row => row.id), ['first'])
  c.currentCardRelationState.value = 'all'; c.filterQuery.value = 'title-second'
  equal(c.filteredCardRows.value.map(row => row.id), ['second'])
  assert.equal(c.filteredCardRows.value[0].ownerReference.idolCode, '001tom')
  c.filterQuery.value = ''; c.currentCardAssetState.value = 'has_large'
  equal(c.filteredCards.value, [])
  equal(c.cardRarityTabs.value.map(tab => [tab.id, tab.count]), [['all', 2], ['SSR', 1], ['SR', 1]])
  c.openRelatedCard({ resource_id: 'first' }); assert.equal(t.commits.length, 1)
  await c.openRelatedCard({ resource_id: 'third', character_id: '002sht' })
  assert.equal(c.currentCharacterId.value, '002sht'); assert.equal(t.captures.at(-1), 'cards')
  c.view.value = 'collection_catalog'
  await c.openCollectionCard({ resource_id: 'first', character_id: '001tom', target: { view: 'card_detail', card: 'wrong' } })
  assert.equal(c.view.value, 'collection_catalog')
  await c.openCollectionCard({ resource_id: 'first', character_id: '001tom', target: { view: 'card_detail', card: 'first' } })
  assert.equal(c.currentCardId.value, 'first'); assert.equal(c.currentEventId.value, ''); assert.equal(c.eventParentView.value, '')
  c.goBackFromCards(); assert.equal(c.view.value, 'idol_detail'); assert.equal(c.currentCategoryId.value, 'idol')
  assert.equal(c.currentCharacterId.value, '001tom'); assert.equal(c.currentCardId.value, '')
}
for (const route of [{ view: 'cards' }, { view: 'card_detail', card: 'first' }, { view: 'player', returnView: 'card_detail', card: 'first' }]) {
  const t = restoration(); await t.context.restoreRoute(route)
  equal(t.applied, [route]); assert.equal(t.context.cardReadModelStatus.value, '')
  if (route.view !== 'cards') assert.equal(t.context.cardReadModelDetail.value.id, 'first')
  assert.ok(t.transport.loads.some(row => row.descriptor.url === 'card-index'))
}
{
  const t = restoration(); await t.context.restoreRoute({ view: 'card_detail', card: 'missing' })
  equal(t.applied, [{ view: 'cards' }]); assert.match(t.context.cardReadModelStatus.value, /稍后重试/)
}
for (const fail of [false, true]) {
  const t = restoration(), job = t.hold('card:first')
  const old = t.context.restoreRoute({ view: 'card_detail', card: 'first' }); await settle()
  const next = { view: 'card_detail', card: 'second' }; await t.context.restoreRoute(next)
  if (fail) job.reject(Error('old')); else job.resolve(t.transport.data.get('card:first'))
  await old; equal(t.applied, [next]); assert.equal(t.context.cardReadModelDetail.value.id, 'second')
  assert.equal(t.errors.length, 0)
}
{
  const t = restoration(), route = { view: 'player', returnView: 'card_detail', card: 'first', scenario: 'direct.json' }
  await t.context.restoreRoute(route); equal(t.applied, [route]); assert.equal(t.transport.loads.length, 0)
}
{
  const t = setup(), job = t.hold('card:first'), pending = t.context.openCard({ resource_id: 'first' })
  await settle(); t.context.invalidateCardNavigation(); job.resolve(t.transport.data.get('card:first')); await pending
  assert.equal(t.commits.length, 0, 'private invalidation revokes pending Card work without changing the global revision')
}
{
  const mobile = body.flatMap(node => node.declarations || []).find(node => node.init?.callee?.name === 'useMobileNavigation')
  const property = mobile.init.arguments[0].properties.find(row => row.key.name === 'loadCardDetail')
  assert.equal(property.value.type, 'ArrowFunctionExpression', 'early Mobile factory defers the later Card binding')
  const c = {}, late = vm.runInNewContext(script.slice(property.value.start, property.value.end), c)
  c.loadCardDetail = (...args) => args; equal(late('first', { priority: 'visible' }), ['first', { priority: 'visible' }])
  const t = setup(); t.context.openEventDetail = (...args) => args
  equal(t.context.openCardEvent('event'), ['event', 'card_detail'], 'Card event entry defers the later Event binding')
}
console.log('Card loading boundary passed: real loaders, optional facets, identity, cancellation, shared navigation races, projections and actual App restoration')

} finally { console.error = originalConsoleError }
