import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const openSource = app.match(/function openSeasonalCampaign\([^]*?\n\}/)?.[0]
const selectSource = app.match(/function selectSeasonalCampaign\([^]*?\n\}/)?.[0]
const detailSource = app.match(/async function loadSeasonalDetail\([^]*?\n\}/)?.[0]
assert.ok(openSource && selectSource && detailSource)
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0, captured = 0
  const context = vm.createContext({
    pendingSeasonalNavigation: 0, seasonalReadModelStatus: { value: '' },
    seasonalReadModelDetail: { value: null }, loading: { value: false },
    currentStoryDomain: { value: '' }, currentStoryMode: { value: '' }, currentStorySection: { value: '' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadSeasonalDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => { captured++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { revision++; commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${openSource}\n${selectSource}`, context)
  return { context, jobs, commits, errors, captured: () => captured, invalidate: () => revision++ }
}
const detail = id => ({ id, view: { campaign: { id } } })
{
  const t = setup()
  const old = t.context.openSeasonalCampaign('valentine_2022')
  const current = t.context.openSeasonalCampaign('white_day_2023')
  t.jobs.get('white_day_2023').resolve(detail('white_day_2023')); await current
  t.jobs.get('valentine_2022').resolve(detail('valentine_2022')); await old
  assert.equal(t.context.currentStorySection.value, 'white_day_2023')
  assert.equal(t.captured(), 1)
  assert.deepEqual(t.commits, ['seasonal_campaign'])
}
{
  const t = setup()
  const old = t.context.openSeasonalCampaign('valentine_2022')
  t.invalidate()
  t.jobs.get('valentine_2022').resolve(detail('valentine_2022')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openSeasonalCampaign()
  t.jobs.get('valentine_2023').resolve(detail('valentine_2023')); await first
  const failed = t.context.selectSeasonalCampaign('white_day_2023')
  t.jobs.get('white_day_2023').reject(new Error('network')); await failed
  assert.equal(t.context.currentStorySection.value, 'valentine_2023')
  assert.match(t.context.seasonalReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectSeasonalCampaign('white_day_2023')
  t.jobs.get('white_day_2023').resolve(detail('white_day_2023')); await retry
  assert.equal(t.context.currentStorySection.value, 'white_day_2023')
  assert.deepEqual(t.commits, ['seasonal_campaign', 'selection'])
}
{
  const rows = [{ id: 'valentine_2022', year: 2022, season: 'valentine', detail: {} },
    { id: 'valentine_2023', year: 2023, season: 'valentine', detail: {} }]
  const context = vm.createContext({ loadSeasonalCatalog: async () => rows,
    readModelClient: { load: async (_descriptor, options) => {
      const result = { id: options.expectedId, view: { campaign: { id: options.expectedId,
        year: 2023, season: 'valentine', participants: [] } } }
      options.validate(result)
      return result
    } } })
  vm.runInContext(detailSource, context)
  assert.equal((await context.loadSeasonalDetail('missing')).id, 'valentine_2023')
}
console.log('Seasonal read-model navigation: latest selection, supersession, retry and default fallback passed')
