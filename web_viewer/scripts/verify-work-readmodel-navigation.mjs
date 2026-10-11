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
  let captured = 0, picker = ''
  const navigation = createArchiveNavigationCoordinator()
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    workReadModelStatus: { value: '' }, workReadModelDetail: { value: null },
    currentCharacterId: { value: '' }, currentStoryDomain: { value: '' }, currentStoryFile: { value: 'old.json' },
    currentWorkMode: { value: 'lines' }, currentStoryMode: { value: '' }, currentStorySection: { value: '' },
    loading: { value: false },
    navigation,
    workReadModelCatalog: ref(['001tom', '002sht'].map(id => ({ id, detail: { url: id }, }))),
    readModelClient: { load: (descriptor, options) => {
      const job = deferred(); jobs.set(descriptor.url, job)
      return job.promise.then(detail => { options.validate(detail); return detail })
    } },
    captureDetailSource: () => { captured++ }, openIdolPicker: target => { picker = target },
    commitView: view => { navigation.invalidate(); commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { navigation.invalidate(); commits.push('selection'); context.loading.value = false },
  })
  bindStoryArchiveNavigation(app, context).stop()
  return { context, jobs, commits, errors, captured: () => captured, picker: () => picker, invalidate: navigation.invalidate }
}
const detail = id => ({ id, view: { idol: { idol_code: id, short_stories: [], scene_lines: [] }, sourceEvidence: { entries: [] }, readingEntries: [] } })
{
  const t = setup()
  t.context.openWorkArchive()
  assert.equal(t.picker(), 'work')
  const old = t.context.openWorkArchive('001tom')
  const current = t.context.openWorkArchive('002sht')
  await Promise.resolve()
  t.jobs.get('002sht').resolve(detail('002sht')); await current
  await Promise.resolve()
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
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openWorkArchive('001tom')
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom')); await first
  t.context.currentWorkMode.value = 'lines'
  const failed = t.context.selectWorkIdol('002sht')
  await Promise.resolve()
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('002sht').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.match(t.context.workReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectWorkIdol('002sht')
  await Promise.resolve()
  t.jobs.get('002sht').resolve(detail('002sht')); await retry
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.context.currentWorkMode.value, 'lines')
  assert.deepEqual(t.commits, ['work_archive', 'selection'])
}
console.log('Work read-model navigation: picker, latest selection, supersession, retry and mode preservation passed')
