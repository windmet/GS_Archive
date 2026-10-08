import { bindCardNavigation } from './lib/card-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindUnitNavigation, createUnitFixtureTransport, unitFixtureDetail, deferredUnit } from './lib/unit-navigation-harness.mjs'
import { bindIdolNavigation } from './lib/idol-navigation-harness.mjs'
import { bindHomeNavigation } from './lib/home-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { bindEventNavigation } from './lib/event-navigation-harness.mjs'
import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(node => node.declarations || []).find(node => node.init?.callee?.name === 'useUnitNavigation')
const names = node => node.type === 'Identifier' ? [node.name] : node.type === 'ObjectPattern' ? node.properties.flatMap(property => names(property.value)) : []
const defined = new Map()
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const specifier of node.specifiers) defined.set(specifier.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const declaration of node.declarations || []) for (const name of names(declaration.id)) defined.set(name, declaration.start)
}
for (const property of binding.init.arguments[0].properties) if (property.value.type === 'Identifier')
  assert.ok(defined.get(property.value.name) < binding.start, `${property.key.name} initialized before Unit factory`)
const settle = () => new Promise(resolve => setImmediate(resolve))
const originalError = console.error

function fixture() {
  const transport = createUnitFixtureTransport(), calls = [], errors = []
  const c = {
    archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    prepareArchivePage: (view, promise) => { calls.push(['prepare', view]); return promise },
    captureDetailSource: () => calls.push(['capture', c.view.value]),
    commitView: view => { c.view.value = view; c.loading.value = false; c.navigation.invalidate(); calls.push(['view', view]) },
    openIdolReadModel: (...args) => { calls.push(['idol', ...args]); return 'idol-result' },
    loadScenario: (...args) => { calls.push(['scenario', ...args]); return 'scenario-result' },
  }
  bindUnitNavigation(app, c); bindCardNavigation(app, c)
  console.error = (...args) => errors.push(args)
  const hold = id => { const job = deferredUnit(); transport.jobs.set(`unit:${id}`, job); return job }
  return { c, calls, errors, ...transport, hold }
}
function restoration() {
  const t = fixture(), c = t.c, applied = []
  bindIdolNavigation(app, c); bindHomeNavigation(app, c).stop()
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
try {
  {
    const t = fixture(), controller = new AbortController()
    const options = { signal: controller.signal, priority: 'visible' }
    await assert.doesNotReject(async () => assert.equal((await t.c.loadUnitDetail('unit-1', options)).id, '1'))
    assert.deepEqual(t.loads.map(item => item.descriptor.url), ['unit-index', 'unit-page', 'unit:1'])
    for (const { options: actual } of t.loads) { assert.equal(actual.signal, controller.signal); assert.equal(actual.priority, 'visible') }
    assert.equal((await t.c.loadUnitDetail('2')).id, '2')
    assert.equal(t.loads.filter(item => item.descriptor.url === 'unit-index').length, 1)
    await assert.rejects(t.c.loadUnitDetail('missing'), /Unavailable unit/)
    assert.equal(t.loads.length, 4)
  }
  for (const corrupt of [
    data => { data.get('unit-index').count++ },
    data => { data.get('unit-page').rows.reverse() },
    data => { data.get('unit-page').rows[0].catalog.unit.unit_id = 99 },
    data => { delete data.get('unit-page').rows[0].catalog.members },
    data => { delete data.get('unit-page').rows[0].catalog.cardStats },
    data => { delete data.get('unit-page').rows[0].detail },
  ]) {
    const t = fixture(); corrupt(t.data)
    await assert.rejects(t.c.loadUnitCatalog(), /does not match inline bootstrap/)
    assert.equal(t.c.unitReadModelCatalog.value, null)
  }
  for (const corrupt of [
    detail => { detail.view.entry.unit.unit_id = 2 },
    detail => { detail.view.entry.members = {} },
    detail => { delete detail.view.entry.cardStats },
    detail => { detail.view.stories = {} },
    detail => { detail.view.songs = null },
  ]) {
    const t = fixture(); corrupt(t.data.get('unit:1'))
    await assert.rejects(t.c.loadUnitDetail('unit-1'), /identity or shape mismatch/)
  }
  {
    const t = fixture(), job = deferredUnit(), controller = new AbortController()
    t.jobs.set('unit-page', job)
    const pending = t.c.loadUnitCatalog({ signal: controller.signal })
    await settle(); controller.abort(); job.resolve(structuredClone(t.data.get('unit-page')))
    await assert.rejects(pending, error => error.name === 'AbortError')
    assert.equal(t.c.unitReadModelCatalog.value, null)
  }
  {
    const t = fixture(), c = t.c
    c.view.value = 'song_detail'; c.currentCharacterId.value = 'old'; c.filterQuery.value = 'keep'
    c.currentEventId.value = 'event'; c.eventParentView.value = 'event_catalog'
    await c.openUnitFromIdol({ unit_code: 'unit-1' })
    assert.equal(c.currentArchiveUnitCode.value, 'unit-1'); assert.equal(c.currentCharacterId.value, '')
    assert.equal(c.currentCategoryId.value, 'idol'); assert.equal(c.filterQuery.value, 'keep')
    assert.equal(c.currentEventId.value, 'event'); assert.equal(c.eventParentView.value, 'event_catalog')
    assert.deepEqual(t.calls, [['prepare','unit_detail'], ['capture','song_detail'], ['view','unit_detail']])
    assert.equal(c.currentArchiveUnit.value.unit_id, 1); assert.equal(c.currentArchiveUnitMembers.value.length, 1)
    assert.equal(c.currentArchiveUnitStories.value.length, 1); assert.equal(c.currentArchiveUnitSongs.value.length, 1)
    c.currentArchiveUnitCode.value = 'unit-2'
    assert.equal(c.currentArchiveUnit.value.unit_id, 2, 'catalog fallback resolves another unit')
    assert.equal(c.currentArchiveUnitMembers.value[0].idol_code, 'idol-2')
    assert.equal(c.currentArchiveUnitStories.value.length, 0); assert.equal(c.currentArchiveUnitSongs.value.length, 0)
    c.currentArchiveUnitCode.value = 'missing'
    assert.equal(c.currentArchiveUnit.value, null); assert.equal(c.currentArchiveUnitEntry.value, null)
    await c.openArchiveUnit({ unit_id: 2 }, { clearEventContext: true })
    assert.equal(c.currentArchiveUnitCode.value, 'unit-2'); assert.equal(c.currentEventId.value, ''); assert.equal(c.eventParentView.value, '')
    assert.equal(c.openUnitMember({ idol_code: 'idol-2' }), 'idol-result')
    assert.deepEqual(t.calls.at(-1), ['idol','idol-2',{ captureSource:true,resetContext:true,clearUnit:true }])
    assert.equal(c.openUnitStory({ file:'ready.json',exists:true }), 'scenario-result')
    assert.deepEqual(t.calls.at(-1), ['scenario','ready.json','unit_detail'])
    const count = t.calls.length
    c.openUnitStory({ file:'missing.json',exists:false }); c.openUnitFromIdol({}); c.openArchiveUnit(null)
    assert.equal(t.calls.length, count)
    c.openEventDetail = (...args) => { t.calls.push(['event', ...args]); return 'event-result' }
    assert.equal(c.openUnitEvent({ event_id:'5' }), 'event-result', 'App callback resolves Event only at invocation')
    assert.deepEqual(t.calls.at(-1), ['event',{event_id:'5'},'unit_detail'])
  }
  for (const rejectOld of [false,true]) {
    const t = fixture(), first = t.hold('1'), second = t.hold('2')
    const old = t.c.openArchiveUnit({ unit_id:1 })
    await settle()
    const current = t.c.openArchiveUnit({ unit_code:'unit-2' })
    await settle(); second.resolve(unitFixtureDetail('2')); await current
    if (rejectOld) first.reject(new Error('old failure')); else first.resolve(unitFixtureDetail('1'))
    await old
    assert.equal(t.c.unitReadModelDetail.value.id, '2'); assert.equal(t.c.currentArchiveUnitCode.value, 'unit-2')
    assert.equal(t.c.unitReadModelStatus.value, ''); assert.equal(t.errors.length, 0)
    assert.deepEqual(t.calls.filter(call => call[0] === 'view'), [['view','unit_detail']])
  }
  for (const invalidate of [c=>c.navigation.invalidate(),c=>c.navigation.dispose(),c=>c.invalidateUnitNavigation()]) {
    const t = fixture(), job = t.hold('1'), pending = t.c.openArchiveUnit({unit_id:1})
    await settle(); invalidate(t.c); job.resolve(unitFixtureDetail('1')); await pending
    assert.equal(t.c.unitReadModelDetail.value, null)
    assert.equal(t.calls.some(call => call[0] === 'view'), false)
  }
  {
    const t = fixture(), job = t.hold('1'), pending = t.c.openArchiveUnit({unit_id:1})
    await settle(); job.reject(new Error('network')); await pending
    assert.match(t.c.unitReadModelStatus.value,/重试/); assert.equal(t.c.loading.value,false)
    t.jobs.delete('unit:1'); await t.c.openArchiveUnit({unit_id:1})
    assert.equal(t.c.unitReadModelDetail.value.id,'1'); assert.equal(t.c.unitReadModelStatus.value,'')
  }
  {
    const t = restoration()
    await t.c.restoreRoute({view:'unit_catalog'})
    assert.equal(t.c.unitCatalogEntries.value.length,2); assert.equal(t.applied.at(-1).view,'unit_catalog')
    await t.c.restoreRoute({view:'unit_detail',unit:'unit-1'})
    assert.equal(t.c.unitReadModelDetail.value.id,'1')
    await t.c.restoreRoute({view:'player',returnView:'unit_detail',unit:'2'})
    assert.equal(t.c.unitReadModelDetail.value.id,'2')
    await t.c.restoreRoute({view:'unit_detail',unit:'missing'})
    assert.equal(t.applied.at(-1).view,'idols'); assert.match(t.c.unitReadModelStatus.value,/重试/)
  }
  for (const rejectOld of [false,true]) {
    const t = restoration(), job = t.hold('1'), pending = t.c.restoreRoute({view:'unit_detail',unit:'1'})
    await settle(); await t.c.restoreRoute({view:'unit_detail',unit:'2'})
    if(rejectOld) job.reject(new Error('old restore')); else job.resolve(unitFixtureDetail('1'))
    await pending
    assert.equal(t.c.unitReadModelDetail.value.id,'2'); assert.equal(t.applied.length,1); assert.equal(t.errors.length,0)
  }
  {
    const t = restoration()
    await t.c.restoreRoute({view:'player',scenario:'episodes/direct.json',returnView:'unit_detail',unit:'1'})
    assert.equal(t.loads.length,0); assert.equal(t.applied.at(-1).view,'player')
  }
} finally { console.error = originalError }
console.log('Unit navigation: App bindings, dual identity, real loaders, cancellation, projections, relation entry points and restoration passed')
