import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const start = app.indexOf('async function openIdolReadModel(')
const end = app.indexOf('\nfunction openIdolDirectory()', start)
assert.ok(start >= 0 && end > start)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0
  const context = vm.createContext({
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    pendingIdolNavigation: 0,
    idolReadModelStatus: { value: '' }, idolReadModelDetail: { value: null },
    loading: { value: false }, currentCategoryId: { value: '' }, currentGroup: { value: 'old' },
    currentCharacterId: { value: '' }, currentCardId: { value: 'old' }, filterQuery: { value: 'query' },
    view: { value: 'idols' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadIdolDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => {},
    commitView: value => { context.view.value = value; revision++; commits.push(value); context.loading.value = false },
    commitArchiveSelection: () => { revision++; commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(app.slice(start, end), context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}

{
  const t = setup()
  const old = t.context.openIdolReadModel('001tom')
  const current = t.context.openIdolReadModel('002sht')
  t.jobs.get('002sht').resolve({ id: '002sht' }); await current
  t.jobs.get('001tom').resolve({ id: '001tom' }); await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.idolReadModelDetail.value.id, '002sht')
  assert.deepEqual(t.commits, ['idol_detail'])
}
{
  const t = setup()
  const old = t.context.openIdolReadModel('001tom')
  t.invalidate()
  t.jobs.get('001tom').resolve({ id: '001tom' }); await old
  assert.equal(t.context.currentCharacterId.value, '')
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openIdolReadModel('001tom')
  t.jobs.get('001tom').reject(new Error('network')); await failed
  assert.match(t.context.idolReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openIdolReadModel('001tom')
  t.jobs.get('001tom').resolve({ id: '001tom' }); await retry
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
  t.jobs.get('001tom').resolve({ id: '001tom', view: { stats: { chats: 2, phones: 1 } } })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(t.context.idolReadModelDetail.value.id, '001tom')
  assert.equal(t.context.idolReadModelStatus.value, '')
  t.context.idolReadModelDetail.value = null
  t.context.currentCharacterId.value = '002sht'
  t.context.recoverIdol(['idol_detail', '002sht'])
  t.invalidate()
  t.jobs.get('002sht').resolve({ id: '002sht' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(t.context.idolReadModelDetail.value, null, 'late detail must not replace a newer route')
}
{
  const detailStart = app.indexOf('const currentIdolDetail = computed(')
  const detailEnd = app.indexOf('const readingState = ref(', detailStart)
  assert.ok(detailStart >= 0 && detailEnd > detailStart)
  const context = vm.createContext({
    computed: fn => ({ get value() { return fn() } }),
    currentCharacterId: { value: '001tom' },
    idolReadModelDetail: { value: { id: '001tom', view: {
      profile: { display_name: '冬馬' }, stats: { chats: 20 }, events: [{ event_id: 1 }], songs: [{ song: { song_code: 'one' } }],
    } } },
  })
  const projections = vm.runInContext(`${app.slice(detailStart, detailEnd)}\n;[currentIdolProfile, currentIdolStats, currentIdolEvents, currentIdolSongs]`, context)
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
console.log('Idol read-model navigation: latest selection, route supersession, retry and leaf-only projection passed')
