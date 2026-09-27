import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const bootstrapContext = { EXTERNAL_STORY_RESOURCES_ENABLED: false }
vm.runInNewContext(app.match(/function isBootstrapRoute\([^]*?\n\}/)[0], bootstrapContext)
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'external_story_resources' }), true,
  'withdrawn external-resource page must not wait for the legacy archive batch')
bootstrapContext.EXTERNAL_STORY_RESOURCES_ENABLED = true
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'external_story_resources' }), false,
  'an enabled external-resource page still needs its publication data')
bootstrapContext.EXTERNAL_STORY_RESOURCES_ENABLED = false
for (const returnView of ['story_catalog', 'story_collection', 'story_detail',
  'event_detail', 'seasonal_campaign', 'work_archive', 'idol_story_archive', 'unit_detail', 'card_detail']) {
  assert.equal(bootstrapContext.isBootstrapRoute({ view: 'player', returnView }), true,
    `${returnView} player refresh must not wait for the legacy archive batch`)
}
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'idols', category: 'cards' }), true)
for (const category of ['', 'idol', 'cards', 'event', 'main_story', 'episode_zero', 'extra']) {
  assert.equal(bootstrapContext.isBootstrapRoute({ view: 'idols', category }), true,
    `idols/${category || 'default'} uses the inline idol directory and must not load the legacy archive batch`)
}
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'spine_lab' }), true,
  'Spine Lab owns its manifest and must not wait for the global archive batch')
assert.equal(bootstrapContext.isBootstrapRoute({ view: 'chibi_stage' }), true,
  'Chibi Stage must load its own stage resources and bounded song detail without the global archive batch')
const source = app.slice(app.indexOf('onMounted(async () => {'), app.indexOf('\nwatch([filterQuery', app.indexOf('onMounted(async () => {')))
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
for (const disposed of [false, true]) {
  const loading = deferred()
  const translations = deferred()
  let mount, popState, isDisposed = false
  const route = { view: 'cards', idol: '001tom' }
  const applied = [], written = []
  const context = {
    onMounted: callback => { mount = callback },
    localStorage: { getItem: () => null },
    window: { location: { href: 'http://localhost/' } },
    userPreferences: { value: {} },
    archiveBootstrap: { idols: [{ id: '002sht' }] },
    initialArchiveStartup: { route, source: 'test' }, pendingPreReadyRoute: null, localStorageValue: () => null,
    pendingHomeNavigation: 0, pendingSongNavigation: 0, pendingIdolNavigation: 0, pendingUnitNavigation: 0, pendingGashaNavigation: 0, pendingCardNavigation: 0, pendingEventNavigation: 0, pendingSeasonalNavigation: 0, pendingWorkNavigation: 0, pendingIdolStoryNavigation: 0, pendingMobileNavigation: 0, pendingLegacyAliasNavigation: 0, pendingCollectionNavigation: 0, pendingStoryDetailNavigation: 0, pendingResourceNavigation: 0, pendingLegacyNavigation: 0,
    isBootstrapRoute: () => false, ensureLegacyArchiveData: () => loading.promise,
    loadIdolDetail: async idolCode => ({ id: idolCode, view: { profile: { idol_code: idolCode } } }),
    loadIdolEntityTranslations: () => translations.promise,
    navigation: { isDisposed: () => isDisposed, getRevision: () => 0 },
    applyArchiveRoute: async value => { applied.push(value) },
    currentArchiveRoute: () => applied.at(-1),
    writeArchiveRoute: value => written.push(value),
    onArchivePopState: callback => { popState = callback; return () => {} },
    installSpineAnimationDebug: () => () => {},
    adoptArchiveViewContext: () => {},
    console, archiveRouteReady: false,
  }
  // Supply refs used by the actual startup callback; execute its production
  // control flow rather than reproducing the order of awaits in a fixture.
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  context.primeArchiveRouteComponent = () => {}
  vm.runInNewContext(source, context)
  const pending = mount()
  const latestRoute = { view: 'idol_detail', idol: '002sht' }
  popState(latestRoute)
  loading.resolve({ data: {}, errors: [] })
  isDisposed = disposed
  translations.resolve()
  await pending
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(applied.length, disposed ? 0 : 1)
  assert.equal(written.length, disposed ? 0 : 1)
  if (!disposed) {
    assert.deepEqual(applied[0], latestRoute, 'latest history route must own restoration after a shared load')
    assert.deepEqual(written[0], latestRoute)
  }
}
{
  const firstRestore = deferred()
  let mount, popState
  const navigation = createArchiveNavigationCoordinator()
  let route = { view: 'player', scenario: 'slow.json' }
  const applied = [], written = []
  const context = {
    onMounted: callback => { mount = callback }, localStorage: { getItem: () => null },
    window: { location: { href: 'http://localhost/' } }, userPreferences: { value: {} },
    initialArchiveStartup: { route: { ...route }, source: 'test' }, pendingPreReadyRoute: null, localStorageValue: () => null,
    pendingHomeNavigation: 0, pendingSongNavigation: 0, pendingIdolNavigation: 0, pendingUnitNavigation: 0, pendingGashaNavigation: 0, pendingCardNavigation: 0, pendingEventNavigation: 0, pendingSeasonalNavigation: 0, pendingWorkNavigation: 0, pendingIdolStoryNavigation: 0, pendingMobileNavigation: 0, pendingLegacyAliasNavigation: 0, pendingCollectionNavigation: 0, pendingStoryDetailNavigation: 0, pendingResourceNavigation: 0, pendingLegacyNavigation: 0,
    loadGashaCatalog: async () => ({ rows: [] }),
    isBootstrapRoute: () => false, ensureLegacyArchiveData: async () => {},
    loadIdolEntityTranslations: async () => {}, navigation,
    applyArchiveRoute: value => navigation.run(async () => { applied.push(value); if (value.view === 'player') await firstRestore.promise }, { restoring: true }),
    currentArchiveRoute: () => applied.at(-1), writeArchiveRoute: value => written.push(value),
    onArchivePopState: callback => { popState = callback; return () => {} },
    installSpineAnimationDebug: () => () => {}, adoptArchiveViewContext: () => {}, console, archiveRouteReady: false,
  }
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  context.primeArchiveRouteComponent = () => {}
  vm.runInNewContext(source, context)
  const pending = mount()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(applied.length, 1)
  assert.equal(typeof popState, 'function', 'history listener must be active during initial route restoration')
  route = { view: 'gashas' }
  popState(route)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(written.length, 1, 'latest completed restoration must finalize startup without waiting for obsolete load')
  assert.deepEqual(written[0], route)
  firstRestore.resolve()
  await pending
  assert.equal(written.length, 1, 'late initial restoration must not finalize startup twice')
}
// Page actions participate in the same startup ownership as history restores.
for (const asynchronous of [false, true]) {
  const initial = deferred(), next = deferred(), written = []
  let mount, page = 'home'
  const loading = { value: true }
  const navigation = createArchiveNavigationCoordinator({ onFinish: () => { loading.value = false } })
  const context = {
    onMounted: callback => { mount = callback }, localStorage: { getItem: () => null },
    window: { location: { href: 'http://localhost/' } }, userPreferences: { value: {} },
    initialArchiveStartup: { route: { view: 'player' }, source: 'test' }, pendingPreReadyRoute: null, localStorageValue: () => null,
    pendingHomeNavigation: 0, pendingSongNavigation: 0, pendingIdolNavigation: 0, pendingUnitNavigation: 0, pendingGashaNavigation: 0, pendingCardNavigation: 0, pendingEventNavigation: 0, pendingSeasonalNavigation: 0, pendingWorkNavigation: 0, pendingIdolStoryNavigation: 0, pendingMobileNavigation: 0, pendingLegacyAliasNavigation: 0, pendingCollectionNavigation: 0, pendingStoryDetailNavigation: 0, pendingResourceNavigation: 0, pendingLegacyNavigation: 0,
    isBootstrapRoute: () => false, ensureLegacyArchiveData: async () => {},
    loadIdolEntityTranslations: async () => {}, navigation,
    applyArchiveRoute: () => navigation.run(async intent => {
      await initial.promise
      if (intent.isCurrent()) page = 'player'
    }, { restoring: true }),
    currentArchiveRoute: () => ({ view: page }), writeArchiveRoute: value => written.push(value),
    onArchivePopState: () => () => {}, installSpineAnimationDebug: () => () => {},
    adoptArchiveViewContext: () => {}, console, archiveRouteReady: false,
  }
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  context.loading = loading
  const syncSource = app.slice(app.indexOf('function syncArchiveRoute('), app.indexOf('function commitView('))
  context.primeArchiveRouteComponent = () => {}
  vm.runInNewContext(source + '\n' + syncSource, context)
  const pending = mount()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(context.archiveRouteReady, true)
  context.syncArchiveRoute()
  assert.equal(written.length, 0, 'active restoration still suppresses route writes')
  let newer
  if (asynchronous) {
    newer = navigation.run(async () => {
      loading.value = true
      await next.promise
      page = 'cards'
      context.syncArchiveRoute()
    })
  } else {
    navigation.invalidate(); page = 'cards'; loading.value = false
    context.syncArchiveRoute()
  }
  initial.resolve(); await pending
  assert.equal(loading.value, asynchronous, 'obsolete startup must not finish the newer load')
  assert.equal(written.length, asynchronous ? 0 : 1, 'obsolete startup must not normalize a newer route')
  if (asynchronous) { next.resolve(); await newer }
  assert.equal(written.length, 1)
  assert.equal(written[0].view, 'cards')
}
// A missing bounded story leaf falls back to the migrated catalog without
// starting the retired global archive batch.
for (const route of [
  { view: 'story_collection', storyType: 'main', storySection: 'missing' },
  { view: 'story_detail', story: 'missing.json' },
]) {
  let mount, legacyLoads = 0
  const applied = []
  const context = {
    onMounted: callback => { mount = callback }, localStorage: { getItem: () => null },
    window: { location: { href: 'http://localhost/' } }, userPreferences: { value: {} },
    initialArchiveStartup: { route, source: 'test' }, pendingPreReadyRoute: null, localStorageValue: () => null,
    pendingHomeNavigation: 0, pendingSongNavigation: 0, pendingIdolNavigation: 0, pendingUnitNavigation: 0, pendingGashaNavigation: 0, pendingCardNavigation: 0, pendingEventNavigation: 0, pendingSeasonalNavigation: 0, pendingWorkNavigation: 0, pendingIdolStoryNavigation: 0, pendingMobileNavigation: 0, pendingLegacyAliasNavigation: 0, pendingCollectionNavigation: 0, pendingStoryDetailNavigation: 0, pendingResourceNavigation: 0, pendingLegacyNavigation: 0,
    isBootstrapRoute: () => true,
    ensureLegacyArchiveData: async () => { legacyLoads++ },
    loadCollectionDetail: async () => { throw new Error('missing leaf') },
    loadStoryReadModelDetail: async () => { throw new Error('missing leaf') },
    loadIdolEntityTranslations: async () => {},
    navigation: { isDisposed: () => false, getRevision: () => 0 },
    applyArchiveRoute: async value => { applied.push(value) },
    currentArchiveRoute: () => applied.at(-1), writeArchiveRoute: () => {},
    onArchivePopState: () => () => {}, installSpineAnimationDebug: () => () => {},
    adoptArchiveViewContext: () => {}, primeArchiveRouteComponent: () => {},
    console: { error: () => {} }, archiveRouteReady: false,
  }
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  vm.runInNewContext(source, context)
  await mount()
  assert.equal(legacyLoads, 0, `${route.view} failure must not load the global archive batch`)
  assert.equal(applied[0].view, 'story_catalog', `${route.view} failure must reach the migrated catalog`)
}
console.log('Archive startup: latest URL, history/page supersession, obsolete completion and disposal passed')
