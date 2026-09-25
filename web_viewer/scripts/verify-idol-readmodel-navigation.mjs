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
console.log('Idol read-model navigation: latest selection, route supersession and retry passed')
