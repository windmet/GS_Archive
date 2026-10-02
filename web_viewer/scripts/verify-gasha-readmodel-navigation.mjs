import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const catalogSource = app.match(/function openGashaCatalog\([^]*?\n\}/)?.[0]
const prepareSource = app.match(/function prepareArchivePage\([^]*?\n\}/)?.[0]
const detailSource = app.match(/function openGasha\(gasha\) \{[^]*?\n\}/)?.[0]
assert.ok(catalogSource && detailSource)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0
  const context = vm.createContext({
    archiveRouteLoaders: {}, prepareArchiveRoute: (_loaders, _view, data) => data,
    ...Object.fromEntries(['mobileReadModelStatus','songReadModelStatus','idolReadModelStatus','unitReadModelStatus','cardReadModelStatus','eventReadModelStatus','seasonalReadModelStatus','workReadModelStatus','idolStoryReadModelStatus','collectionReadModelStatus','storyReadModelStatus','resourceReadModelStatus'].map(name => [name, {value:''}])),
    pendingGashaNavigation: 0, gashaReadModelStatus: { value: '' }, gashaReadModelDetail: { value: null },
    loading: { value: false }, view: { value: 'gashas' }, detailSourceRoute: { value: '' },
    gashaParentView: { value: '' }, currentStoryDomain: { value: '' }, filterQuery: { value: 'card' },
    currentCategoryId: { value: '' }, currentCharacterId: { value: '' }, currentCardId: { value: '' },
    currentGashaId: { value: '' }, currentGashaCategory: { value: 'all' },
    navigation: { invalidate: () => revision++, getRevision: () => revision, isDisposed: () => false },
    loadGashaCatalog: () => { const job = deferred(); jobs.set('catalog', job); return job.promise },
    loadGashaDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => {},
    commitView: value => { revision++; commits.push(value); context.view.value = value; context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${prepareSource}\n${catalogSource}\n${detailSource}`, context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}
const detail = id => ({ id, gasha: { id } })

{
  const t = setup()
  const old = t.context.openGasha({ id: 1 })
  const current = t.context.openGasha({ id: 2 })
  t.jobs.get('2').resolve(detail('2')); await current
  t.jobs.get('1').resolve(detail('1')); await old
  assert.equal(t.context.currentGashaId.value, '2')
  assert.deepEqual(t.commits, ['gasha_detail'])
}
{
  const t = setup()
  const old = t.context.openGasha({ id: 1 })
  t.invalidate()
  t.jobs.get('1').resolve(detail('1')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openGasha({ id: 1 })
  t.jobs.get('1').reject(new Error('network')); await failed
  assert.match(t.context.gashaReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openGasha({ id: 1 })
  t.jobs.get('1').resolve(detail('1')); await retry
  assert.deepEqual(t.commits, ['gasha_detail'])
}
{
  const t = setup()
  t.context.view.value = 'portal'
  const failed = t.context.openGashaCatalog()
  assert.match(t.context.gashaReadModelStatus.value, /正在读取/)
  assert.equal(t.context.loading.value, true)
  t.jobs.get('catalog').reject(new Error('catalog network')); await failed
  assert.match(t.context.gashaReadModelStatus.value, /重试/)
  assert.equal(t.context.view.value, 'portal', 'catalog failure keeps its source portal')
  assert.equal(t.context.loading.value, false)
  assert.deepEqual(t.commits, [])
  const retry = t.context.openGashaCatalog()
  t.jobs.get('catalog').resolve({ rows: [] }); await retry
  assert.deepEqual(t.commits, ['gashas'])
  assert.equal(t.context.gashaReadModelStatus.value, '')
}
{
  const t = setup()
  const old = t.context.openGashaCatalog()
  t.invalidate(); t.context.view.value = 'photo_catalog'
  t.jobs.get('catalog').reject(new Error('late catalog failure')); await old
  assert.equal(t.context.view.value, 'photo_catalog')
  assert.deepEqual(t.commits, [], 'superseded catalog never navigates back')
  assert.equal(t.errors.length, 0)
}
{
  const t = setup()
  t.context.filterQuery.value = '6thLIVE TOUR'
  t.context.currentGashaCategory.value = 'ticket_named'
  t.context.detailSourceRoute.value = '?view=portal'
  const retry = t.context.openGashaCatalog({preserveBrowse:true})
  t.jobs.get('catalog').resolve({rows:[]}); await retry
  assert.equal(t.context.filterQuery.value, '6thLIVE TOUR')
  assert.equal(t.context.currentGashaCategory.value, 'ticket_named')
  assert.equal(t.context.detailSourceRoute.value, '?view=portal')
}
{
  const t = setup()
  const catalog = t.context.openGashaCatalog()
  t.jobs.get('catalog').resolve({ rows: [] }); await catalog
  assert.deepEqual(t.commits, ['gashas'])
  assert.equal(t.context.currentGashaId.value, '')
}
console.log('Gasha read-model navigation: latest selection, route supersession, retry and catalog passed')
