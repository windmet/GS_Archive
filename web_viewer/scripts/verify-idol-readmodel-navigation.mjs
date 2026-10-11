import { bindIdolNavigation, createIdolFixtureTransport, idolFixtureDetail } from './lib/idol-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const originalError = console.error
const flush = () => new Promise(resolve => setImmediate(resolve))

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0
  const transport = createIdolFixtureTransport()
  const context = vm.createContext({
    archiveBootstrap: transport.bootstrap,
    pendingIdolNavigation: 0,
    idolReadModelStatus: { value: '' }, idolReadModelDetail: { value: null },
    loading: { value: false }, currentCategoryId: { value: '' }, currentGroup: { value: 'old' },
    currentCharacterId: { value: '' }, currentCardId: { value: 'old' }, filterQuery: { value: 'query' },
    view: { value: 'idols' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    readModelClient: { load(descriptor, options) {
      if (descriptor.url.startsWith('idol:')) { const id = descriptor.url.slice(5), job = deferred(); jobs.set(id, job); transport.jobs.set(descriptor.url, job) }
      return transport.client.load(descriptor, options)
    } },
    captureDetailSource: () => {},
    commitView: value => { context.view.value = value; revision++; commits.push(value); context.loading.value = false },
    commitArchiveSelection: () => { revision++; commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  bindIdolNavigation(app, context)
  console.error = context.console.error
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}

{
  const t = setup()
  const old = t.context.openIdolReadModel('001tom')
  const current = t.context.openIdolReadModel('002sht')
  await flush()
  t.jobs.get('002sht').resolve(idolFixtureDetail('002sht')); await current
  await flush()
  t.jobs.get('001tom').resolve(idolFixtureDetail('001tom')); await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.idolReadModelDetail.value.id, '002sht')
  assert.deepEqual(t.commits, ['idol_detail'])
}
{
  const t = setup()
  const old = t.context.openIdolReadModel('001tom')
  t.invalidate()
  await flush()
  t.jobs.get('001tom').resolve(idolFixtureDetail('001tom')); await old
  assert.equal(t.context.currentCharacterId.value, '')
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openIdolReadModel('001tom')
  await flush()
  t.jobs.get('001tom').reject(new Error('network')); await failed
  assert.match(t.context.idolReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openIdolReadModel('001tom')
  await flush()
  t.jobs.get('001tom').resolve(idolFixtureDetail('001tom')); await retry
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.equal(t.context.idolReadModelStatus.value, '')
}
{
  const t = setup()
  t.context.view.value = 'idol_detail'
  t.context.currentCharacterId.value = '001tom'
  t.context.watch = (_sources, callback) => { t.context.recoverIdol = callback }
  const watcherStart = app.indexOf('watch([view, currentCharacterId]')
  vm.runInContext(app.slice(watcherStart, app.indexOf('watch(cardLayout', watcherStart)), t.context)
  t.context.recoverIdol(['idol_detail', '001tom'])
  await flush()
  t.jobs.get('001tom').resolve(idolFixtureDetail('001tom'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(t.context.idolReadModelDetail.value.id, '001tom')
  assert.equal(t.context.idolReadModelStatus.value, '')
  t.context.idolReadModelDetail.value = null
  t.context.currentCharacterId.value = '002sht'
  t.context.recoverIdol(['idol_detail', '002sht'])
  t.invalidate()
  await flush()
  t.jobs.get('002sht').resolve(idolFixtureDetail('002sht'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(t.context.idolReadModelDetail.value, null, 'late detail must not replace a newer route')
}
{
  const context = vm.createContext({
    computed: fn => ({ get value() { return fn() } }),
    currentCharacterId: { value: '001tom' },
    idolReadModelDetail: { value: { id: '001tom', view: {
      profile: { display_name: '冬馬' }, stats: { chats: 20 }, events: [{ event_id: 1 }], songs: [{ song: { song_code: 'one' } }],
    } } },
  })
  bindIdolNavigation(app, context)
  const projections = [context.currentIdolProfile, context.currentIdolStats, context.currentIdolEvents, context.currentIdolSongs]
  assert.equal(projections[0].value.display_name, '冬馬')
  assert.equal(projections[1].value.chats, 20)
  assert.equal(projections[2].value.length, 1)
  assert.equal(projections[3].value.length, 1)
  context.currentCharacterId.value = '002sht'
  assert.equal(projections[0].value, null, 'previous idol profile must not appear while another leaf loads')
  assert.equal(projections[1].value.chats, undefined)
  assert.equal(projections[2].value.length, 0)
  assert.equal(projections[3].value.length, 0)
}
console.error = originalError
console.log('Idol read-model navigation: latest selection, route supersession, retry and leaf-only projection passed')
