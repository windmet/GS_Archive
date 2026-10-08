import { bindResourceNavigation } from './lib/resource-navigation-harness.mjs'
import { bindGashaNavigation } from './lib/gasha-navigation-harness.mjs'
import { bindCardNavigation } from './lib/card-navigation-harness.mjs'
import { bindUnitNavigation } from './lib/unit-navigation-harness.mjs'
import { bindIdolFixtureNavigation } from './lib/idol-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref, watch, nextTick, effectScope } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse } from '@babel/parser'
import { bindHomeNavigation, createHomeFixtureTransport } from './lib/home-navigation-harness.mjs'
import { bindEventNavigation } from './lib/event-navigation-harness.mjs'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'
import { bindLegacyAliasNavigation } from './lib/legacy-alias-navigation-harness.mjs'
import { bindMobileNavigation } from './lib/mobile-navigation-harness.mjs'
import { bindSongNavigation } from './lib/song-navigation-harness.mjs'
import { buildPortalReturnQuery, readHomeReturnRoute } from '../src/core/archiveRoute.js'
import { usePortalNavigation } from '../src/composables/usePortalNavigation.js'
import { isDirectScenarioEntry } from '../src/core/PlayerEntryRequest.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const script = parseSfc(app).descriptor.scriptSetup.content
const body = parse(script, { sourceType: 'module' }).program.body
const binding = body.flatMap(n => n.declarations || []).find(n => n.init?.callee?.name === 'useHomeNavigation')
const names = n => n.type === 'Identifier' ? [n.name] : n.type === 'ObjectPattern' ? n.properties.flatMap(p => names(p.value)) : []
const defined = new Map([['window', -1]])
for (const node of body) {
  if (node.type === 'ImportDeclaration') for (const s of node.specifiers) defined.set(s.local.name, -1)
  if (node.type === 'FunctionDeclaration') defined.set(node.id.name, -1)
  for (const d of node.declarations || []) for (const name of names(d.id)) defined.set(name, d.start)
}
for (const p of binding.init.arguments[0].properties) assert.ok(defined.get(p.value.name) < binding.start, `${p.key.name} initialized before Home factory`)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const flush = async () => { for (let i = 0; i < 30; i++) { await Promise.resolve(); await nextTick() } }
function fixture() {
  const transport = createHomeFixtureTransport(), calls = []
  const c = {
    archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    userPreferences: ref({ startupIdol: '002sht', preferredIdol: '003hok', startupPage: 'portal', homeMode: 'card' }),
    validArchiveHomeIdols: ref(transport.idols.map(idol => idol.id)),
    openIdolPicker: target => calls.push(['picker', target]),
    commitView: view => { c.view.value = view; c.navigation.invalidate(); calls.push(['view', view]) },
    captureActiveArchiveView: () => calls.push(['capture']),
    restoreRoute: async route => { calls.push(['restore', route]); c.view.value = route.view },
    syncArchiveRoute: () => calls.push(['sync']),
  }
  const api = bindHomeNavigation(app, c)
  c.view.value = 'portal'; c.portalScope.value = '001tom'; c.portalQuery.value = 'KEEP'
  return { ...api, c, calls, ...transport }
}
function restoreFixture() {
  const t = fixture(), c = t.c
  bindIdolFixtureNavigation(app, c)
  bindUnitNavigation(app, c); bindCardNavigation(app, c); bindGashaNavigation(app, c); bindResourceNavigation(app, c)
  bindStoryNavigation(app, c).stop(); bindStoryArchiveNavigation(app, c).stop(); bindEventNavigation(app, c).stop()
  bindLegacyAliasNavigation(app, c).stop(); bindMobileNavigation(app, c).stop(); bindSongNavigation(app, c).stop()
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
  {
    const t = fixture(), c = t.c
    const controller = new AbortController(), options = { signal: controller.signal, priority: 'background' }
    let profile
    await assert.doesNotReject(async () => { profile = await t.loadHomeIdol('001tom', options) }, 'App bindings support a valid Home load')
    assert.deepEqual(profile.cues.map(cue => cue.id), ['001tom:a', '001tom:b'])
    assert.equal(c.homeReadModelProfiles.value['001tom'].id, '001tom', 'App cache receives the hydrated profile')
    assert.deepEqual(t.loads.map(x => x.descriptor.url), ['home-index', 'home:001tom', 'cues:001tom'], 'shared cue page is read once')
    assert.ok(t.loads.every(x => x.options.signal === controller.signal && x.options.priority === 'background'))
    assert.equal(t.data.get('cues:001tom').rows.length, 2, 'hydration leaves cached transport bytes untouched')
    await t.loadHomeIdol('002sht'); await t.loadHomeIdol('003hok')
    const count = t.loads.length; await t.loadHomeIdol('001tom'); assert.equal(t.loads.length, count)
    await t.loadHomeIdol('005kao')
    assert.deepEqual(Object.keys(c.homeReadModelProfiles.value).sort(), ['001tom', '003hok', '005kao'], 'cache hit updates three-person LRU order')
    await assert.rejects(t.loadHomeIdol('missing'), /Unavailable/); t.stop()
  }
  for (const corrupt of [d => d.idols.pop(), d => d.idols.reverse(), d => d.stats = null, d => d.highlights = null]) {
    const t = fixture(); corrupt(t.data.get('home-index')); await assert.rejects(t.loadHomeIndex(), /bootstrap/)
    assert.equal(t.c.homeReadModelIndex.value, null); t.stop()
  }
  for (const corrupt of [t => t.data.get('home:001tom').id = 'bad', t => t.data.get('home:001tom').profile.id = 'bad',
    t => t.data.get('home:001tom').cueIndex = null, t => t.data.get('cues:001tom').rows = null,
    t => t.data.get('cues:001tom').rows.reverse(), t => delete t.data.get('cues:001tom').rows[0].previewStep,
    t => t.data.get('cues:001tom').rows.pop(), t => t.data.get('cues:001tom').rows.push({ id: 'extra' })]) {
    const t = fixture(); corrupt(t); await assert.rejects(t.loadHomeIdol('001tom'), /identity|incomplete|count/)
    assert.deepEqual(t.c.homeReadModelProfiles.value, {}); t.stop()
  }
  for (const key of ['home-index', 'cues:001tom']) {
    const t = fixture(), controller = new AbortController(), job = deferred(); t.jobs.set(key, job)
    const pending = t.loadHomeIdol('001tom', { signal: controller.signal }); await flush()
    controller.abort(); job.resolve(t.data.get(key)); await assert.rejects(pending, /abort/i)
    assert.deepEqual(t.c.homeReadModelProfiles.value, {})
    if (key === 'home-index') assert.equal(t.c.homeReadModelIndex.value, null)
    t.stop()
  }
  {
    const t = fixture(), c = t.c, preferences = JSON.stringify(c.userPreferences.value)
    c.portalFrom.value = buildPortalReturnQuery({ view: 'home', homeIdol: '001tom', homeCue: 'cue', homeCostume: 'costume' })
    await t.openGameHome('001tom')
    assert.equal(c.homeSelectedId.value, '001tom'); assert.equal(c.homeSelectedCue.value, 'cue'); assert.equal(c.homeSelectedCostume.value, 'costume')
    assert.equal(c.portalFrom.value, ''); assert.equal(c.detailSourceRoute.value, '')
    const source = readHomeReturnRoute(c.homeFrom.value); assert.equal(source.portalScope, '001tom'); assert.equal(source.portalQuery, 'KEEP')
    await t.closeHomeVisit(); assert.deepEqual(t.calls.slice(-3).map(x => x[0]), ['capture', 'restore', 'sync'])
    assert.equal(t.homeVisits.get('001tom').homeCue, 'cue')
    c.portalFrom.value = buildPortalReturnQuery({ view: 'home', homeIdol: '001tom', homeCue: 'older', homeCostume: 'older' })
    await t.openGameHome('001tom'); assert.equal(c.homeSelectedCue.value, 'cue', 'saved visit wins over portal carrier')
    c.homeSelectedCue.value = 'new-cue'; await t.openGameHome('003hok')
    assert.equal(t.homeVisits.get('001tom').homeCue, 'new-cue'); assert.equal(c.homeSelectedCue.value, '')
    assert.equal(c.homeSelectedCostume.value, ''); assert.equal(c.homeFrom.value, '', 'only Portal visits acquire a Home return carrier')
    assert.equal(JSON.stringify(c.userPreferences.value), preferences, 'temporary visits do not change preferences')
    const count = t.calls.length; await t.closeHomeVisit(); assert.equal(t.calls.length, count)
    await t.openGameHome('invalid'); assert.equal(c.homeSelectedId.value, '002sht', 'startup fallback')
    c.userPreferences.value.startupIdol = 'invalid'; await t.openGameHome(); assert.equal(c.homeSelectedId.value, '003hok', 'favorite fallback')
    c.validArchiveHomeIdols.value = []; await t.openGameHome(); assert.deepEqual(t.calls.at(-1), ['picker', 'home']); t.stop()
  }
  for (const outcome of ['newer', 'watcher', 'invalidate', 'revision', 'dispose']) for (const failed of [false, true]) {
    const t = fixture(), c = t.c, job = deferred(); t.jobs.set('cues:001tom', job)
    const old = t.openGameHome('001tom'); await flush()
    if (outcome === 'newer') await t.openGameHome('002sht')
    if (outcome === 'watcher') { c.view.value = 'home'; c.homeSelectedId.value = '002sht'; await t.handleHomeIdolChange('002sht', '') }
    if (outcome === 'invalidate') t.invalidateHomeNavigation()
    if (outcome === 'revision') c.navigation.invalidate()
    if (outcome === 'dispose') c.navigation.dispose()
    const expected = { status: c.homeEntryStatus.value, notice: c.userPreferenceNotice.value, id: c.homeSelectedId.value, calls: t.calls.length }
    failed ? job.reject(Error('stale failure')) : job.resolve(t.data.get('cues:001tom')); await old
    assert.deepEqual({ status: c.homeEntryStatus.value, notice: c.userPreferenceNotice.value, id: c.homeSelectedId.value, calls: t.calls.length }, expected, `${outcome} cannot be overwritten by old ${failed ? 'failure' : 'success'}`)
    t.stop()
  }
  {
    const t = fixture(), c = t.c
    t.data.get('home:001tom').id = 'broken'; await t.openGameHome('001tom')
    assert.equal(c.view.value, 'portal'); assert.match(c.homeEntryStatus.value, /重试/); assert.equal(c.userPreferenceNotice.value, c.homeEntryStatus.value)
    t.data.get('home:001tom').id = '001tom'; await t.openGameHome('001tom'); assert.equal(c.view.value, 'home'); assert.equal(c.homeEntryStatus.value, ''); t.stop()
  }
  // Portal and Home consume the same visit map through App's actual bindings.
  {
    const t = fixture(), c = t.c
    await t.openGameHome('001tom'); c.homeSelectedCue.value = 'portal-cue'; c.homeSelectedCostume.value = 'portal-costume'
    const portalBinding = body.flatMap(n => n.declarations || []).find(n => n.init?.callee?.name === 'usePortalNavigation')
    Object.assign(c, { usePortalNavigation, archiveShellVisible: ref(true), legacyEntryStatus: ref(''),
      applyArchiveRoute: async route => { t.calls.push(['apply-portal', route]); c.view.value = route.view },
    })
    for (const property of portalBinding.init.arguments[0].properties) {
      if (property.value.type !== 'Identifier') continue
      const name = property.value.name
      if (!(name in c)) c[name] = name.endsWith('Detail') ? ref(null) : () => assert.fail(`Unexpected Portal boundary: ${name}`)
    }
    const portal = vm.runInNewContext(script.slice(portalBinding.init.start, portalBinding.init.end), c)
    portal.openArchivePortal('003hok')
    assert.equal(t.homeVisits.get('001tom')?.homeCue, 'portal-cue', 'Portal writes the Home factory visit map')
    assert.equal(c.portalScope.value, '003hok')
    await portal.closeArchivePortal()
    assert.equal(t.calls.at(-2)[0], 'apply-portal'); assert.equal(t.calls.at(-2)[1].homeCostume, 'portal-costume')
    assert.equal(t.calls.at(-1)[0], 'sync'); t.stop()
  }
  // Execute the actual App watcher registration with real Vue reactivity.
  {
    const t = fixture(), c = t.c, scope = effectScope()
    c.view.value = 'home'; c.homeSelectedId.value = '001tom'; await t.loadHomeIdol('001tom')
    const watcher = body.find(n => n.expression?.callee?.name === 'watch' && n.expression.arguments[0]?.name === 'homeSelectedId')
    scope.run(() => vm.runInNewContext(script.slice(watcher.start, watcher.end), { ...c, watch }))
    const job = deferred(); t.jobs.set('cues:002sht', job)
    c.homeSelectedId.value = '002sht'; await flush(); assert.equal(c.loading.value, true); assert.match(c.homeEntryStatus.value, /准备/)
    job.reject(Error('fixture failure')); await flush()
    assert.equal(c.homeSelectedId.value, '001tom', 'failed switch rolls back to the cached previous idol')
    assert.equal(c.loading.value, false); assert.match(c.homeEntryStatus.value, /重试/)
    t.jobs.delete('cues:002sht'); c.homeSelectedId.value = '002sht'; await flush()
    assert.equal(c.homeReadModelProfiles.value['002sht'].id, '002sht'); assert.equal(c.homeEntryStatus.value, '')
    scope.stop(); t.stop()
  }
  for (const outcome of ['open', 'invalidate', 'unmount']) {
    const t = fixture(), c = t.c, job = deferred(); c.view.value = 'home'; c.homeSelectedId.value = '001tom'
    await t.loadHomeIdol('001tom'); t.jobs.set('cues:002sht', job)
    c.homeSelectedId.value = '002sht'; const old = t.handleHomeIdolChange('002sht', '001tom'); await flush()
    if (outcome === 'open') await t.openGameHome('003hok')
    if (outcome === 'invalidate') t.invalidateHomeNavigation()
    if (outcome === 'unmount') {
      const unmount = body.find(n => n.expression?.callee?.name === 'onBeforeUnmount').expression.arguments[0]
      Object.assign(c, { playbackController: { dispose: () => t.calls.push(['dispose-player']) }, removeArchivePopState: () => {}, removeSpineAnimationDebug: () => {} })
      c.readModelClient.dispose = () => t.calls.push(['dispose-client'])
      vm.runInNewContext('(' + script.slice(unmount.start, unmount.end) + ')()', c)
      assert.equal(c.navigation.isDisposed(), true)
    }
    const expected = [c.homeSelectedId.value, c.loading.value, c.homeEntryStatus.value]
    job.reject(Error('obsolete watcher failure')); await old
    assert.deepEqual([c.homeSelectedId.value, c.loading.value, c.homeEntryStatus.value], expected, 'old watcher cannot roll back or finish a newer owner')
    t.stop()
  }
  for (const kind of ['success', 'failure', 'stale', 'direct']) {
    const t = restoreFixture(), c = t.c, job = deferred()
    const route = kind === 'direct' ? { view: 'player', scenario: 'direct.json', homeIdol: '001tom', returnView: 'home' } : { view: 'home', homeIdol: '001tom', homeCue: 'cue', homeCostume: 'costume' }
    if (kind === 'failure') t.data.get('home:001tom').id = 'broken'
    if (kind === 'stale') t.jobs.set('cues:001tom', job)
    const pending = c.restoreRoute(route)
    if (kind === 'stale') { await flush(); c.navigation.invalidate(); job.resolve(t.data.get('cues:001tom')) }
    await pending
    const applied = t.calls.filter(x => x[0] === 'apply')
    assert.equal(applied.length, kind === 'stale' ? 0 : 1)
    if (applied.length) assert.equal(applied[0][1].view, kind === 'failure' ? 'welcome' : route.view)
    if (kind === 'success') { assert.equal(c.homeReadModelProfiles.value['001tom'].id, '001tom'); assert.equal(applied[0][1].homeCue, 'cue') }
    if (kind === 'stale') assert.deepEqual(c.homeReadModelProfiles.value, {})
    if (kind === 'direct') assert.equal(t.loads.length, 0)
    t.stop()
  }
} finally { console.error = originalError }
console.log('Home navigation: real App setup/watcher/unmount/restore, strict hydration, cancellation, LRU, shared races, preference isolation and visit return preservation passed')
