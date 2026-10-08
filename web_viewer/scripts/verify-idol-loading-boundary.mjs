import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { watch, nextTick, effectScope } from 'vue'
import { bindIdolNavigation, createIdolFixtureTransport, deferredIdol, idolFixtureDetail } from './lib/idol-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const settle = async () => { await nextTick(); await new Promise(resolve => setImmediate(resolve)) }
function setup(source = app) {
  const transport = createIdolFixtureTransport(), commits = [], errors = [], captures = [], picks = []
  const context = {
    archiveBootstrap: transport.bootstrap, readModelClient: transport.client,
    currentGroup: { value: 'old' }, currentCardId: { value: 'old' }, filterQuery: { value: 'query' },
    view: { value: 'idols' },
    captureDetailSource: () => captures.push(context.view.value),
    openIdolPicker: target => picks.push(target),
    commitView: value => { context.view.value = value; context.navigation.invalidate(); commits.push(value); context.loading.value = false },
    commitArchiveSelection: () => { context.navigation.invalidate(); commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  }
  bindIdolNavigation(source, context)
  const hold = id => { const job = deferredIdol(); transport.jobs.set(`idol:${id}`, job); return job }
  return { context, transport, commits, errors, captures, picks, hold }
}

{
  const t = setup(), controller = new AbortController()
  const detail = await t.context.loadIdolDetail('001tom', { signal: controller.signal, priority: 'visible' })
  assert.equal(detail.id, '001tom')
  assert.deepEqual(t.transport.loads.map(item => item.descriptor.url), ['idol-index', 'idol-page', 'idol:001tom'])
  for (const { options } of t.transport.loads) {
    assert.equal(options.signal, controller.signal); assert.equal(options.priority, 'visible')
  }
  await t.context.loadIdolDetail('002sht')
  assert.equal(t.transport.loads.filter(item => item.descriptor.url === 'idol-index').length, 1)
  await assert.rejects(t.context.loadIdolDetail('missing'), /Unavailable idol/)
  assert.equal(t.transport.loads.length, 4, 'unknown idol never requests a leaf')
}
for (const corrupt of [
  data => { data.get('idol-index').count++ },
  data => { data.get('idol-page').rows.reverse() },
  data => { data.get('idol-page').rows[0].name = 'wrong' },
  data => { delete data.get('idol-page').rows[0].detail },
  data => { data.get('idol-page').rows.pop() },
]) {
  const t = setup(); corrupt(t.transport.data)
  await assert.rejects(t.context.loadIdolCatalog(), /does not match inline bootstrap/)
  assert.equal(t.context.idolReadModelCatalog.value, null, 'invalid catalog must not enter cache')
}
for (const corrupt of [
  detail => { detail.view.profile.idol_code = '002sht' },
  detail => { delete detail.view.stats },
  detail => { detail.view.events = {} },
  detail => { detail.view.songs = null },
]) {
  const t = setup(); corrupt(t.transport.data.get('idol:001tom'))
  await assert.rejects(t.context.loadIdolDetail('001tom'), /identity or shape mismatch/)
}
{
  const t = setup(), controller = new AbortController(), page = deferredIdol()
  t.transport.jobs.set('idol-page', page)
  const pending = t.context.loadIdolCatalog({ signal: controller.signal })
  await settle(); controller.abort()
  page.resolve(structuredClone(t.transport.data.get('idol-page')))
  await assert.rejects(pending, error => error.name === 'AbortError')
  assert.equal(t.context.idolReadModelCatalog.value, null, 'cancelled catalog is never published')
}
for (const rejectOld of [false, true]) {
  const t = setup(), oldJob = t.hold('001tom'), newJob = t.hold('002sht')
  const old = t.context.openIdolReadModel('001tom'), current = t.context.openIdolReadModel('002sht')
  await settle()
  newJob.resolve(idolFixtureDetail('002sht')); await current
  if (rejectOld) oldJob.reject(new Error('late failure'))
  else oldJob.resolve(idolFixtureDetail('001tom'))
  await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.idolReadModelDetail.value.id, '002sht')
  assert.equal(t.context.idolReadModelStatus.value, '')
  assert.deepEqual(t.commits, ['idol_detail']); assert.equal(t.errors.length, 0)
}
for (const invalidate of [context => context.navigation.invalidate(), context => context.navigation.dispose()]) {
  const t = setup(), job = t.hold('001tom'), pending = t.context.openIdolReadModel('001tom')
  await settle(); invalidate(t.context)
  job.resolve(idolFixtureDetail('001tom')); await pending
  assert.equal(t.context.currentCharacterId.value, '')
  assert.equal(t.context.idolReadModelDetail.value, null); assert.deepEqual(t.commits, [])
}
{
  const t = setup(), job = t.hold('001tom'), pending = t.context.openIdolReadModel('001tom')
  await settle(); job.reject(new Error('network')); await pending
  assert.match(t.context.idolReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false); assert.equal(t.errors.length, 1)
  t.transport.jobs.delete('idol:001tom'); await t.context.openIdolReadModel('001tom')
  assert.equal(t.context.currentCharacterId.value, '001tom'); assert.equal(t.context.idolReadModelStatus.value, '')
}
{
  const t = setup(), c = t.context
  c.currentEventId.value = 'event'; c.eventParentView.value = 'event_catalog'; c.currentArchiveUnitCode.value = 'unit'
  await c.openIdolReadModel('001tom', { captureSource: true, resetContext: true, clearUnit: true, clearEventContext: true })
  assert.deepEqual(t.captures, ['idols'])
  for (const name of ['currentEventId', 'eventParentView', 'currentArchiveUnitCode', 'currentCardId', 'filterQuery']) assert.equal(c[name].value, '', name)
  assert.equal(c.currentCategoryId.value, 'idol'); assert.equal(c.currentGroup.value, null)
  await c.selectPrimaryIdol('002sht'); assert.deepEqual(t.commits, ['idol_detail', 'selection'])
  assert.equal(c.currentIdolProfile.value.idol_code, '002sht'); assert.equal(c.currentIdolDisplayName.value, '002sht')
  assert.equal(c.currentIdolStats.value.chats, 2)
  assert.equal(c.currentIdolEvents.value.length, 1); assert.equal(c.currentIdolSongs.value.length, 1)
  c.currentCharacterId.value = '001tom'
  assert.equal(c.currentIdolProfile.value, null); assert.equal(c.currentIdolDisplayName.value, '')
  assert.equal(c.currentIdolStats.value.chats, undefined)
  assert.equal(c.currentIdolEvents.value.length, 0); assert.equal(c.currentIdolSongs.value.length, 0)
  const loads = t.transport.loads.length
  await c.openPrimaryIdol('unknown'); await c.selectPrimaryIdol('unknown'); await c.openIdolReadModel('unknown')
  assert.deepEqual(t.picks, ['profile']); assert.equal(t.transport.loads.length, loads)
  c.currentIdolUnitFilter.value = 'unit'; c.openIdolDirectory()
  assert.equal(c.view.value, 'idols'); assert.equal(c.currentIdolUnitFilter.value, '')
  assert.equal(c.currentCharacterId.value, '')
}
{
  const t = setup(), c = t.context
  c.currentEventId.value = 'event'; c.eventParentView.value = 'event_catalog'
  c.currentArchiveUnitCode.value = 'unit'; c.currentCategoryId.value = 'cards'
  await c.selectPrimaryIdol('001tom')
  assert.deepEqual(t.commits, ['idol_detail'], 'selection outside detail performs a view transition')
  assert.equal(c.currentEventId.value, 'event'); assert.equal(c.eventParentView.value, 'event_catalog')
  assert.equal(c.currentArchiveUnitCode.value, 'unit'); assert.equal(c.currentCategoryId.value, 'cards')
  assert.equal(c.currentGroup.value, 'old'); assert.equal(t.captures.length, 0)
  await c.openPrimaryIdol('002sht')
  assert.equal(c.currentCategoryId.value, 'idol'); assert.equal(c.currentGroup.value, null)
  assert.equal(c.currentCharacterId.value, '002sht')
}
// Real watcher registration and loaders share App's counter with explicit entry.
for (const direction of ['watcher-to-open', 'open-to-watcher']) {
  const t = setup(), c = t.context, scope = effectScope()
  const start = app.indexOf('watch([view, currentCharacterId],'), end = app.indexOf('\nwatch(cardLayout,', start)
  assert.ok(start >= 0 && end > start); c.watch = watch
  try {
    scope.run(() => vm.runInNewContext(app.slice(start, end), c))
    const oldJob = t.hold('001tom'), newJob = t.hold('002sht')
    let old, current
    if (direction === 'watcher-to-open') {
      c.view.value = 'idol_detail'; c.currentCharacterId.value = '001tom'; await settle()
      current = c.openIdolReadModel('002sht')
    } else {
      old = c.openIdolReadModel('001tom'); await settle()
      c.view.value = 'idol_detail'; c.currentCharacterId.value = '002sht'; await settle()
    }
    await settle(); newJob.resolve(idolFixtureDetail('002sht')); await current; await settle()
    oldJob.resolve(idolFixtureDetail('001tom')); await old; await settle()
    assert.equal(c.idolReadModelDetail.value.id, '002sht'); assert.equal(c.currentCharacterId.value, '002sht')
    assert.equal(c.idolReadModelStatus.value, '')
    assert.deepEqual(t.commits, direction === 'watcher-to-open' ? ['idol_detail'] : [])
    assert.equal(t.errors.length, 0)
  } finally { scope.stop() }
}
console.log('Idol loading boundary: real catalog/leaf validation, cancellation, retry, selection, projections and watcher/entry ownership passed')
