import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const listSource = app.match(/function openPrimaryCards\([^]*?\n\}/)?.[0]
const detailSource = app.match(/function openCard\([^]*?\n\}/)?.[0]
assert.ok(listSource && detailSource)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0
  const context = vm.createContext({
    pendingCardNavigation: 0, cardReadModelStatus: { value: '' }, cardReadModelDetail: { value: null },
    loading: { value: false }, view: { value: 'cards' }, filterQuery: { value: 'old' },
    currentCategoryId: { value: '' }, currentCharacterId: { value: '' }, currentCardId: { value: '' },
    currentGroup: { value: null }, currentCardRarity: { value: 'SSR' },
    currentCardAssetState: { value: 'all' }, currentCardRelationState: { value: 'all' },
    archiveBootstrap: { idols: [{ id: '001tom' }] },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadCardCatalog: () => { const job = deferred(); jobs.set('catalog', job); return job.promise },
    loadCardDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => {},
    commitView: value => { revision++; commits.push(value); context.view.value = value; context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${listSource}\n${detailSource}`, context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}
const detail = id => ({ id, card: { resource_id: id } })

{
  const t = setup()
  const old = t.context.openCard({ resource_id: 'first' })
  const current = t.context.openCard({ resource_id: 'second' })
  t.jobs.get('second').resolve(detail('second')); await current
  t.jobs.get('first').resolve(detail('first')); await old
  assert.equal(t.context.currentCardId.value, 'second')
  assert.deepEqual(t.commits, ['card_detail'])
}
{
  const t = setup()
  const old = t.context.openCard({ resource_id: 'first' })
  t.invalidate()
  t.jobs.get('first').resolve(detail('first')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openCard({ resource_id: 'first' })
  t.jobs.get('first').reject(new Error('network')); await failed
  assert.match(t.context.cardReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openCard({ resource_id: 'first' })
  t.jobs.get('first').resolve(detail('first')); await retry
  assert.deepEqual(t.commits, ['card_detail'])
}
{
  const t = setup()
  const list = t.context.openPrimaryCards('001tom')
  t.jobs.get('catalog').resolve([]); await list
  assert.deepEqual(t.commits, ['cards'])
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.equal(t.context.currentCardRarity.value, 'all')
}
console.log('Card read-model navigation: latest selection, route supersession, retry and catalog passed')
