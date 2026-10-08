import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { ref } from 'vue'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { bindStoryArchiveNavigation } from './lib/story-archive-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let captured = 0
  const navigation = createArchiveNavigationCoordinator()
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    seasonalReadModelStatus: { value: '' },
    seasonalReadModelDetail: { value: null }, loading: { value: false },
    currentStoryDomain: { value: '' }, currentStoryMode: { value: '' }, currentStorySection: { value: '' },
    navigation,
    seasonalReadModelCatalog: ref(['valentine_2022', 'valentine_2023', 'white_day_2023'].map(id => ({ id, detail: { url: id }, year: Number(id.slice(-4)), season: id.startsWith('white_day') ? 'white_day' : 'valentine', }))),
    readModelClient: { load: (descriptor, options) => {
      const job = deferred(); jobs.set(descriptor.url, job)
      return job.promise.then(detail => { options.validate(detail); return detail })
    } },
    captureDetailSource: () => { captured++ },
    commitView: view => { navigation.invalidate(); commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { navigation.invalidate(); commits.push('selection'); context.loading.value = false },
  })
  bindStoryArchiveNavigation(app, context).stop()
  return { context, jobs, commits, errors, captured: () => captured, invalidate: navigation.invalidate }
}
const detail = id => ({ id, view: { campaign: { id, year: Number(id.slice(-4)), season: id.startsWith('white_day') ? 'white_day' : 'valentine', participants: [] } } })
{
  const t = setup()
  const old = t.context.openSeasonalCampaign('valentine_2022')
  const current = t.context.openSeasonalCampaign('white_day_2023')
  await Promise.resolve()
  t.jobs.get('white_day_2023').resolve(detail('white_day_2023')); await current
  await Promise.resolve()
  t.jobs.get('valentine_2022').resolve(detail('valentine_2022')); await old
  assert.equal(t.context.currentStorySection.value, 'white_day_2023')
  assert.equal(t.captured(), 1)
  assert.deepEqual(t.commits, ['seasonal_campaign'])
}
{
  const t = setup()
  const old = t.context.openSeasonalCampaign('valentine_2022')
  t.invalidate()
  await Promise.resolve()
  t.jobs.get('valentine_2022').resolve(detail('valentine_2022')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openSeasonalCampaign()
  await Promise.resolve()
  t.jobs.get('valentine_2023').resolve(detail('valentine_2023')); await first
  const failed = t.context.selectSeasonalCampaign('white_day_2023')
  await Promise.resolve()
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('white_day_2023').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.equal(t.context.currentStorySection.value, 'valentine_2023')
  assert.match(t.context.seasonalReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectSeasonalCampaign('white_day_2023')
  await Promise.resolve()
  t.jobs.get('white_day_2023').resolve(detail('white_day_2023')); await retry
  assert.equal(t.context.currentStorySection.value, 'white_day_2023')
  assert.deepEqual(t.commits, ['seasonal_campaign', 'selection'])
}
{
  const rows = [{ id: 'valentine_2022', year: 2022, season: 'valentine', detail: {} },
    { id: 'valentine_2023', year: 2023, season: 'valentine', detail: {} }]
  const context = vm.createContext({ seasonalReadModelCatalog: ref(rows),
    readModelClient: { load: async (_descriptor, options) => {
      const result = { id: options.expectedId, view: { campaign: { id: options.expectedId,
        year: 2023, season: 'valentine', participants: [] } } }
      options.validate(result)
      return result
    } } })
  bindStoryArchiveNavigation(app, context).stop()
  assert.equal((await context.loadSeasonalDetail('missing')).id, 'valentine_2023')
}
console.log('Seasonal read-model navigation: latest selection, supersession, retry and default fallback passed')
