import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

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
    navigation: { isDisposed: () => isDisposed },
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
  let route = { view: 'player', scenario: 'slow.json' }
  const applied = [], written = []
  const context = {
    onMounted: callback => { mount = callback }, localStorage: { getItem: () => null },
    readArchiveRoute: () => ({ ...route }), loadArchiveData: async () => ({ data: {}, errors: [] }),
    loadIdolEntityTranslations: async () => {}, navigation: { isDisposed: () => false },
    applyArchiveRoute: async value => { applied.push(value); if (value.view === 'player') await firstRestore.promise },
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
console.log('Archive startup: latest URL after data loads, history during restore, obsolete completion and disposal passed')
