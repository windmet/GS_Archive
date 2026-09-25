import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const open = app.match(/function openIdolStoryArchive\([^]*?\n\}/)?.[0]
const select = app.match(/function selectIdolStory\([^]*?\n\}/)?.[0]
assert.ok(open && select)
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0, picker = '', captures = 0
  const context = vm.createContext({
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    pendingIdolStoryNavigation: 0, idolStoryReadModelStatus: { value: '' },
    idolStoryReadModelDetail: { value: null }, loading: { value: false },
    filterQuery: { value: '' }, currentStoryDomain: { value: '' }, currentStoryMode: { value: '' },
    currentStorySection: { value: 'old' }, currentEpisodeId: { value: 'old' },
    currentCharacterId: { value: '' }, currentMobileScenarioId: { value: 'old' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadIdolStoryDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    openIdolPicker: target => { picker = target }, captureDetailSource: () => { captures++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { revision++; commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${open}\n${select}`, context)
  return { context, jobs, commits, errors, picker: () => picker, captures: () => captures, invalidate: () => revision++ }
}
const detail = id => ({ id, view: { page: { idol_code: id } } })
{
  const t = setup()
  t.context.openIdolStoryArchive()
  assert.equal(t.picker(), 'story')
  const old = t.context.openIdolStoryArchive('001tom')
  const current = t.context.openIdolStoryArchive('002sht')
  t.jobs.get('002sht').resolve(detail('002sht')); await current
  t.jobs.get('001tom').resolve(detail('001tom')); await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.captures(), 1)
  assert.deepEqual(t.commits, ['idol_story_archive'])
}
{
  const t = setup()
  const stale = t.context.openIdolStoryArchive('001tom')
  t.invalidate()
  t.jobs.get('001tom').resolve(detail('001tom')); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openIdolStoryArchive('001tom')
  t.jobs.get('001tom').resolve(detail('001tom')); await first
  const failed = t.context.selectIdolStory('002sht')
  t.jobs.get('002sht').reject(new Error('network')); await failed
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.match(t.context.idolStoryReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectIdolStory('002sht')
  t.jobs.get('002sht').resolve(detail('002sht')); await retry
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.deepEqual(t.commits, ['idol_story_archive', 'selection'])
}
console.log('Idol story read-model navigation: picker, latest selection, supersession and retry passed')
