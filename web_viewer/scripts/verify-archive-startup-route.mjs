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
    console,
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
console.log('Archive startup: browser route changes during data/translation loads use latest URL; disposed startup publishes nothing')
