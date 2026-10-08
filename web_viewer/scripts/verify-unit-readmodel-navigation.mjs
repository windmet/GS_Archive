import { bindUnitNavigation, createUnitFixtureTransport, unitFixtureDetail } from './lib/unit-navigation-harness.mjs'
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
  const transport = createUnitFixtureTransport()
  for (const [id, code] of [['1','first'],['2','second']]) {
    transport.data.get('unit-page').rows.find(row => row.id === id).catalog.unit.unit_code = code
    transport.data.get('unit:'+id).view.entry.unit.unit_code = code
  }
  const context = vm.createContext({
    archiveBootstrap: transport.bootstrap,
    prepareArchivePage: (_view, data) => data,
    unitReadModelStatus: { value: '' }, unitReadModelDetail: { value: null },
    loading: { value: false }, filterQuery: { value: 'old' }, currentCategoryId: { value: '' },
    currentCharacterId: { value: '001tom' }, currentArchiveUnitCode: { value: '' },
    navigation: { invalidate: () => revision++, getRevision: () => revision, isDisposed: () => false },
    readModelClient: { load(descriptor, options) {
      if (descriptor.url.startsWith('unit:')) { const id = descriptor.url.slice(5), code = id === '1' ? 'first' : 'second', job = deferred(); jobs.set(code, job); transport.jobs.set(descriptor.url, job) }
      return transport.client.load(descriptor, options)
    } },
    captureDetailSource: () => {},
    commitView: value => { revision++; commits.push(value); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  bindUnitNavigation(app, context)
  console.error = context.console.error
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}

const detail = unitFixtureDetail
{
  const t = setup()
  const old = t.context.openArchiveUnit({ unit_code: 'first' })
  const current = t.context.openArchiveUnit({ unit_code: 'second' })
  await flush()
  t.jobs.get('second').resolve(detail('2', 'second')); await current
  await flush()
  t.jobs.get('first').resolve(detail('1', 'first')); await old
  assert.equal(t.context.currentArchiveUnitCode.value, 'second')
  assert.equal(t.context.unitReadModelDetail.value.id, '2')
  assert.deepEqual(t.commits, ['unit_detail'])
}
{
  const t = setup()
  const old = t.context.openArchiveUnit({ unit_code: 'first' })
  t.invalidate()
  await flush()
  t.jobs.get('first').resolve(detail('1', 'first')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openArchiveUnit({ unit_code: 'first' })
  await flush()
  t.jobs.get('first').reject(new Error('network')); await failed
  assert.match(t.context.unitReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openArchiveUnit({ unit_code: 'first' })
  await flush()
  t.jobs.get('first').resolve(detail('1', 'first')); await retry
  assert.deepEqual(t.commits, ['unit_detail'])
}
assert.doesNotMatch(app, /function openUnitCatalog\(/, 'the unit catalog has no dedicated opener; it is reached by returning from unit detail')
console.error = originalError
console.log('Unit read-model navigation: latest selection, route supersession and retry passed')
