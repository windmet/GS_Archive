import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const openSource = app.match(/function openWorkArchive\([^]*?\n\}/)?.[0]
const selectSource = app.match(/function selectWorkIdol\([^]*?\n\}/)?.[0]
assert.ok(openSource && selectSource)
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0, captured = 0, picker = ''
  const context = vm.createContext({
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    pendingWorkNavigation: 0, workReadModelStatus: { value: '' }, workReadModelDetail: { value: null },
    currentCharacterId: { value: '' }, currentStoryDomain: { value: '' }, currentStoryFile: { value: 'old.json' },
    currentWorkMode: { value: 'lines' }, currentStoryMode: { value: '' }, currentStorySection: { value: '' },
    loading: { value: false },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadWorkDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => { captured++ }, openIdolPicker: target => { picker = target },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { revision++; commits.push('selection'); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(`${openSource}\n${selectSource}`, context)
  return { context, jobs, commits, errors, captured: () => captured, picker: () => picker, invalidate: () => revision++ }
}
const detail = id => ({ id, view: { idol: { idol_code: id } } })
{
  const t = setup()
  t.context.openWorkArchive()
  assert.equal(t.picker(), 'work')
  const old = t.context.openWorkArchive('001tom')
  const current = t.context.openWorkArchive('002sht')
  t.jobs.get('002sht').resolve(detail('002sht')); await current
  t.jobs.get('001tom').resolve(detail('001tom')); await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.currentWorkMode.value, 'stories')
  assert.equal(t.captured(), 1)
  assert.deepEqual(t.commits, ['work_archive'])
}
{
  const t = setup()
  const old = t.context.openWorkArchive('001tom')
  t.invalidate()
  t.jobs.get('001tom').resolve(detail('001tom')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openWorkArchive('001tom')
  t.jobs.get('001tom').resolve(detail('001tom')); await first
  t.context.currentWorkMode.value = 'lines'
  const failed = t.context.selectWorkIdol('002sht')
  t.jobs.get('002sht').reject(new Error('network')); await failed
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.match(t.context.workReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectWorkIdol('002sht')
  t.jobs.get('002sht').resolve(detail('002sht')); await retry
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.currentWorkMode.value, 'lines')
  assert.deepEqual(t.commits, ['work_archive', 'selection'])
}
console.log('Work read-model navigation: picker, latest selection, supersession, retry and mode preservation passed')
