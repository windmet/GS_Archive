import vm from 'node:vm'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { bindResourceNavigation, createResourceFixtureTransport, deferredResource } from './lib/resource-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const settle = () => new Promise(resolve => setImmediate(resolve))
const equal = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected)
function setup(overrides = {}) {
  const transport = createResourceFixtureTransport(), commits = [], errors = [], prepared = []
  const c = {
    archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    view: { value: 'portal' }, detailSourceRoute: { value: '?view=portal' }, filterQuery: { value: 'prior' },
    currentStoryDomain: { value: 'main' }, currentEventScope: { value: 'fixed_unit_event' },
    currentStoryAvailability: { value: 'playable' }, currentStorySort: { value: 'title' },
    prepareArchivePage: (view, pending) => { prepared.push(view); return pending },
    commitView: view => { commits.push(view); c.view.value = view; c.loading.value = false; c.navigation.invalidate() },
    console: { error: (...args) => errors.push(args) }, ...overrides,
  }
  console.error = c.console.error
  bindResourceNavigation(app, c)
  return { c, ...transport, commits, errors, prepared }
}
const originalConsoleError = console.error
try {
{
  const t = setup(), controller = new AbortController()
  equal(await t.c.loadResourceStatus({ signal: controller.signal, priority: 'visible' }), t.detail)
  equal(t.loads.map(row => row.descriptor.url), ['resource-index', 'resource-page', 'resource-detail'])
  for (const { options } of t.loads) { assert.equal(options.signal, controller.signal); assert.equal(options.priority, 'visible') }
  assert.equal(t.c.resourceReadModelDetail.value, null, 'loader does not publish')
  await t.c.loadResourceStatus(); assert.equal(t.loads.length, 6, 'existing loader does not cache')
}
for (const [corrupt, message] of [
  [t => t.data.get('resource-index').count++, /directory mismatch/],
  [t => t.data.get('resource-index').pages.push({ url: 'resource-page' }), /directory mismatch/],
  [t => delete t.data.get('resource-index').pages, /directory mismatch/],
  [t => t.data.get('resource-page').rows = [], /identity mismatch/],
  [t => t.data.get('resource-page').rows[0].id = 'wrong', /identity mismatch/],
  [t => delete t.data.get('resource-page').rows[0].detail, /identity mismatch/],
  ...[['manifest', 'coverage'], ['verification', 'scenarios'], ['uiAssets', 'meta']].map(([parent, key]) =>
    [t => delete t.data.get('resource-detail').view[parent][key], /shape mismatch/]),
]) {
  const t = setup(); corrupt(t)
  await assert.rejects(t.c.loadResourceStatus(), message)
  assert.equal(t.c.resourceReadModelDetail.value, null)
}
for (const view of ['portal', 'card_detail']) {
  const t = setup(); t.c.view.value = view
  await t.c.openArchiveStatus()
  equal(t.commits, ['archive_status']); equal(t.prepared, ['archive_status'])
  equal(t.c.resourceReadModelDetail.value, t.detail)
  assert.equal(t.c.detailSourceRoute.value, view === 'portal' ? '?view=portal' : '')
  for (const [key, value] of Object.entries({ filterQuery: '', currentStoryDomain: '', currentEventScope: 'all', currentStoryAvailability: 'all', currentStorySort: 'domain' })) assert.equal(t.c[key].value, value, key)
  assert.equal(t.c.resourceReadModelStatus.value, ''); assert.equal(t.c.loading.value, false)
}
// Deferred transport ignores cancellation on purpose: publication guards must
// still reject a response from a superseded selection.
for (const fail of [false, true]) {
  const t = setup(), oldJob = t.hold('resource-detail'), newJob = t.hold('resource-detail')
  const old = t.c.openArchiveStatus(); await settle()
  const current = t.c.openArchiveStatus(); await settle()
  newJob.resolve({ ...t.detail, marker: 'latest' }); await current
  if (fail) oldJob.reject(Error('late')); else oldJob.resolve({ ...t.detail, marker: 'old' })
  await old; equal(t.commits, ['archive_status']); assert.equal(t.c.resourceReadModelDetail.value.marker, 'latest')
  assert.equal(t.errors.length, 0)
}
for (const action of ['invalidate', 'dispose']) for (const fail of [false, true]) {
  const t = setup(), job = t.hold('resource-detail')
  const pending = t.c.openArchiveStatus(); await settle()
  const signal = t.loads[0].options.signal; assert.equal(signal.aborted, false)
  t.c.navigation[action](); assert.equal(signal.aborted, true)
  if (fail) job.reject(Error('late')); else job.resolve(t.detail)
  await pending; equal(t.commits, []); assert.equal(t.c.resourceReadModelDetail.value, null); assert.equal(t.errors.length, 0)
}
// Isolate the feature counter from the shared revision.
{
  const t = setup(), first = t.hold('resource-detail'), second = t.hold('resource-detail')
  t.c.navigation.invalidate = () => {}
  const old = t.c.openArchiveStatus(); await settle()
  const current = t.c.openArchiveStatus(); await settle()
  second.resolve({ ...t.detail, marker: 'current' }); await current
  first.resolve({ ...t.detail, marker: 'old' }); await old
  equal(t.commits, ['archive_status']); assert.equal(t.c.resourceReadModelDetail.value.marker, 'current')
}
for (const url of ['resource-index', 'resource-page', 'resource-detail']) {
  const t = setup(), job = t.hold(url)
  const pending = t.c.openArchiveStatus(); await settle()
  assert.equal(t.c.loading.value, true); assert.match(t.c.resourceReadModelStatus.value, /正在读取/)
  job.reject(Error('offline')); await pending
  equal(t.commits, []); assert.equal(t.c.view.value, 'portal'); assert.equal(t.c.filterQuery.value, 'prior')
  assert.equal(t.c.loading.value, false); assert.match(t.c.resourceReadModelStatus.value, /重试/); assert.equal(t.errors.length, 1)
  await t.c.openArchiveStatus(); equal(t.commits, ['archive_status']); assert.equal(t.c.resourceReadModelStatus.value, '')
}
for (const stale of [false, true]) {
  const ready = deferredResource(), t = setup({ prepareArchivePage: async (_view, pending) => { const detail = await pending; await ready.promise; return detail } })
  const pending = t.c.openArchiveStatus(); await settle()
  equal(t.commits, []); assert.equal(t.c.resourceReadModelDetail.value, null)
  if (stale) t.c.navigation.invalidate()
  ready.resolve(); await pending
  equal(t.commits, stale ? [] : ['archive_status'])
}
// Execute the resource branch in App's real apply path, retaining its await and
// intent guard. The encompassing route dispatcher remains App-owned.
const branch = app.match(/    if \(route.view === 'archive_status'\) \{[^]*?\n    \}/)?.[0]
assert.ok(branch)
for (const stale of [false, true]) {
  const t = setup(), job = t.hold('resource-detail'); let current = true
  Object.assign(t.c, { route: { view: 'archive_status' }, intent: { isCurrent: () => current } })
  const pending = vm.runInNewContext(`(async () => { ${branch} })()`, t.c)
  await settle(); if (stale) current = false
  job.resolve(t.detail); await pending
  equal(t.c.resourceReadModelDetail.value, stale ? null : t.detail)
}
{
  const t = setup(), job = t.hold('resource-detail')
  Object.assign(t.c, { route: { view: 'archive_status' }, intent: { isCurrent: () => true } })
  const pending = vm.runInNewContext(`(async () => { ${branch} })()`, t.c)
  const rejection = assert.rejects(pending, /offline/)
  job.reject(Error('offline')); await rejection
  assert.equal(t.c.resourceReadModelDetail.value, null)
}
{
  const t = setup(), job = t.hold('resource-detail')
  t.c.navigation.invalidate = () => {}
  const pending = t.c.openArchiveStatus(); await settle()
  t.c.invalidateResourceNavigation(); job.resolve(t.detail); await pending
  equal(t.commits, []); assert.equal(t.c.resourceReadModelDetail.value, null)
}
assert.match(app, /invalidateResourceNavigation\(\)/)
console.log('Resource navigation: real index/page/leaf validation, transport options, selection ownership, cancellation, retry, page readiness and source reset passed')

} finally { console.error = originalConsoleError }
