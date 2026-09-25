import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const start = app.indexOf('function openUnitCatalog()')
const end = app.indexOf('\nfunction openUnitFromIdol(', start)
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
    pendingUnitNavigation: 0, unitReadModelStatus: { value: '' }, unitReadModelDetail: { value: null },
    loading: { value: false }, filterQuery: { value: 'old' }, currentCategoryId: { value: '' },
    currentCharacterId: { value: '001tom' }, currentArchiveUnitCode: { value: '' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadUnitCatalog: () => { const job = deferred(); jobs.set('catalog', job); return job.promise },
    loadUnitDetail: code => { const job = deferred(); jobs.set(code, job); return job.promise },
    captureDetailSource: () => {},
    commitView: value => { revision++; commits.push(value); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(app.slice(start, end), context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}

const detail = (id, code) => ({ id, view: { entry: { unit: { unit_id: id, unit_code: code } } } })
{
  const t = setup()
  const old = t.context.openArchiveUnit({ unit_code: 'first' })
  const current = t.context.openArchiveUnit({ unit_code: 'second' })
  t.jobs.get('second').resolve(detail('2', 'second')); await current
  t.jobs.get('first').resolve(detail('1', 'first')); await old
  assert.equal(t.context.currentArchiveUnitCode.value, 'second')
  assert.equal(t.context.unitReadModelDetail.value.id, '2')
  assert.deepEqual(t.commits, ['unit_detail'])
}
{
  const t = setup()
  const old = t.context.openArchiveUnit({ unit_code: 'first' })
  t.invalidate()
  t.jobs.get('first').resolve(detail('1', 'first')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openArchiveUnit({ unit_code: 'first' })
  t.jobs.get('first').reject(new Error('network')); await failed
  assert.match(t.context.unitReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openArchiveUnit({ unit_code: 'first' })
  t.jobs.get('first').resolve(detail('1', 'first')); await retry
  assert.deepEqual(t.commits, ['unit_detail'])
}
{
  const t = setup()
  const catalog = t.context.openUnitCatalog()
  t.jobs.get('catalog').resolve([]); await catalog
  assert.deepEqual(t.commits, ['unit_catalog'])
  assert.equal(t.context.currentCharacterId.value, '')
}
console.log('Unit read-model navigation: latest selection, route supersession, retry and catalog passed')
