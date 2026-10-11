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
// The ledger answers at once; campaign leaves are the deferred jobs each case resolves.
const ledgerData = ids => ({ 'ledger-index': { count: 1, pages: [{ url: 'ledger-page' }] },
  'ledger-page': { rows: [{ id: 'all', detail: { url: 'ledger-detail' } }] },
  'ledger-detail': { id: 'all', view: { ledger: { campaigns: ids.map(id => ({ id, introduction: [] })), participants: [] } } } })
const ledgerBootstrap = { idols: [], domains: { 'seasonal-ledger': { url: 'ledger-index' } }, counts: { catalog_story_entries: 0 } }
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
    archiveBootstrap: ledgerBootstrap,
    readModelClient: { load: (descriptor, options) => {
      const ledger = ledgerData(['valentine_2022', 'valentine_2023', 'white_day_2023'])[descriptor.url]
      if (ledger) return Promise.resolve(ledger).then(value => { options.validate?.(value); return value })
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
  // No campaign is the whole ledger: nothing beyond the ledger is requested.
  await t.context.openSeasonalCampaign()
  assert.equal(t.context.currentStorySection.value, '')
  assert.equal(t.jobs.size, 0)
  const failed = t.context.selectSeasonalCampaign('white_day_2023')
  await Promise.resolve()
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('white_day_2023').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.equal(t.context.currentStorySection.value, '')
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
  const context = vm.createContext({ seasonalReadModelCatalog: ref(rows), archiveBootstrap: ledgerBootstrap,
    readModelClient: { load: async (descriptor, options) => {
      const ledger = ledgerData(rows.map(row => row.id))[descriptor.url]
      if (ledger) { options.validate?.(ledger); return ledger }
      const result = { id: options.expectedId, view: { campaign: { id: options.expectedId,
        year: Number(options.expectedId.slice(-4)), season: 'valentine', participants: [] } } }
      options.validate(result)
      return result
    } } })
  bindStoryArchiveNavigation(app, context).stop()
  const whole = await context.loadSeasonalDetail('missing')
  assert.equal(whole.id, '')
  assert.equal(whole.view.campaign, null)
  assert.deepEqual(whole.view.ledger.campaigns.map(campaign => campaign.id), ['valentine_2022', 'valentine_2023'])
  assert.equal((await context.loadSeasonalDetail('valentine_2022')).view.campaign.id, 'valentine_2022')
}
{
  // A ledger that does not name the directory's campaigns is rejected.
  const rows = [{ id: 'valentine_2022', year: 2022, season: 'valentine', detail: {} }]
  const context = vm.createContext({ seasonalReadModelCatalog: ref(rows), archiveBootstrap: ledgerBootstrap,
    readModelClient: { load: async (descriptor, options) => {
      const value = ledgerData(['white_day_2022'])[descriptor.url]
      options.validate?.(value); return value
    } } })
  bindStoryArchiveNavigation(app, context).stop()
  await assert.rejects(context.loadSeasonalDetail(''), /campaign identity/)
}
console.log('Seasonal read-model navigation: latest selection, supersession, retry and whole-ledger default passed')
