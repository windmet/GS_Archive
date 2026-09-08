import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = app.slice(app.indexOf('onMounted(async () => {'), app.indexOf('\nwatch([filterQuery', app.indexOf('onMounted(async () => {')))
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
for (const disposed of [false, true]) {
  const loading = deferred()
  const translations = deferred()
  let mount, isDisposed = false
  let route = { view: 'cards', idol: '001tom' }
  const applied = [], written = []
  const context = {
    onMounted: callback => { mount = callback },
    localStorage: { getItem: () => null },
    readArchiveRoute: () => ({ ...route }),
    loadArchiveData: () => loading.promise,
    loadIdolEntityTranslations: () => translations.promise,
    navigation: { isDisposed: () => isDisposed, getRevision: () => 0 },
    applyArchiveRoute: async value => { applied.push(value) },
    currentArchiveRoute: () => applied.at(-1),
    writeArchiveRoute: value => written.push(value),
    onArchivePopState: () => () => {},
    installSpineAnimationDebug: () => () => {},
    console, archiveRouteReady: false,
  }
  // Supply refs used by the actual startup callback; execute its production
  // control flow rather than reproducing the order of awaits in a fixture.
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  vm.runInNewContext(source, context)
  const pending = mount()
  route = { view: 'gashas' }
  loading.resolve({ data: {}, errors: [] })
  await Promise.resolve()
  route = { view: 'idol_detail', idol: '002sht' }
  isDisposed = disposed
  translations.resolve()
  await pending
  assert.equal(applied.length, disposed ? 0 : 1)
  assert.equal(written.length, disposed ? 0 : 1)
  if (!disposed) {
    assert.deepEqual(applied[0], route, 'startup must restore the latest browser route after all initial loads')
    assert.deepEqual(written[0], route)
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
    readArchiveRoute: () => ({ ...route }), loadArchiveData: async () => ({ data: {}, errors: [] }),
    loadIdolEntityTranslations: async () => {}, navigation,
    applyArchiveRoute: value => navigation.run(async () => { applied.push(value); if (value.view === 'player') await firstRestore.promise }, { restoring: true }),
    currentArchiveRoute: () => applied.at(-1), writeArchiveRoute: value => written.push(value),
    onArchivePopState: callback => { popState = callback; return () => {} },
    installSpineAnimationDebug: () => () => {}, console, archiveRouteReady: false,
  }
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
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
    readArchiveRoute: () => ({ view: 'player' }), loadArchiveData: async () => ({ data: {}, errors: [] }),
    loadIdolEntityTranslations: async () => {}, navigation,
    applyArchiveRoute: () => navigation.run(async intent => {
      await initial.promise
      if (intent.isCurrent()) page = 'player'
    }, { restoring: true }),
    currentArchiveRoute: () => ({ view: page }), writeArchiveRoute: value => written.push(value),
    onArchivePopState: () => () => {}, installSpineAnimationDebug: () => () => {},
    console, archiveRouteReady: false,
  }
  for (const match of source.matchAll(/\b(\w+)\.value\s*=/g)) context[match[1]] = { value: null }
  context.loading = loading
  const syncSource = app.slice(app.indexOf('function syncArchiveRoute('), app.indexOf('function commitView('))
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
console.log('Archive startup: latest URL, history/page supersession, obsolete completion and disposal passed')
