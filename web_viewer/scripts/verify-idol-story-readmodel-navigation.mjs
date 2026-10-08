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
  let picker = '', captures = 0
  const navigation = createArchiveNavigationCoordinator()
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    archiveBootstrap: { idols: [{ id: '001tom' }, { id: '002sht' }] },
    idolStoryReadModelStatus: { value: '' },
    idolStoryReadModelDetail: { value: null }, loading: { value: false },
    filterQuery: { value: '' }, currentStoryDomain: { value: '' }, currentStoryMode: { value: '' },
    currentStorySection: { value: 'old' }, currentEpisodeId: { value: 'old' },
    currentCharacterId: { value: '' }, currentMobileScenarioId: { value: 'old' },
    navigation,
    idolStoryReadModelCatalog: ref(['001tom', '002sht'].map(id => ({ id, detail: { url: id }, }))),
    readModelClient: { load: (descriptor, options) => {
      const job = deferred(); jobs.set(descriptor.url, job)
      return job.promise.then(detail => { options.validate(detail); return detail })
    } },
    openIdolPicker: target => { picker = target }, captureDetailSource: () => { captures++ },
    commitView: view => { navigation.invalidate(); commits.push(view); context.loading.value = false },
    commitArchiveSelection: () => { navigation.invalidate(); commits.push('selection'); context.loading.value = false },
  })
  bindStoryArchiveNavigation(app, context).stop()
  return { context, jobs, commits, errors, picker: () => picker, captures: () => captures, invalidate: navigation.invalidate }
}
const detail = id => ({ id, view: { page: { idol_code: id, sections: [] }, readingEntries: [] } })
{
  const t = setup()
  t.context.openIdolStoryArchive()
  assert.equal(t.picker(), 'story')
  const old = t.context.openIdolStoryArchive('001tom')
  const current = t.context.openIdolStoryArchive('002sht')
  await Promise.resolve()
  t.jobs.get('002sht').resolve(detail('002sht')); await current
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom')); await old
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.equal(t.captures(), 1)
  assert.deepEqual(t.commits, ['idol_story_archive'])
}
{
  const t = setup()
  const stale = t.context.openIdolStoryArchive('001tom')
  t.invalidate()
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom')); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const first = t.context.openIdolStoryArchive('001tom')
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom')); await first
  const failed = t.context.selectIdolStory('002sht')
  await Promise.resolve()
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('002sht').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.equal(t.context.currentCharacterId.value, '001tom')
  assert.match(t.context.idolStoryReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.selectIdolStory('002sht')
  await Promise.resolve()
  t.jobs.get('002sht').resolve(detail('002sht')); await retry
  assert.equal(t.context.currentCharacterId.value, '002sht')
  assert.deepEqual(t.commits, ['idol_story_archive', 'selection'])
}
{
  const t = setup()
  t.context.currentStoryFile.value = 'old'
  t.context.storyCollectionParentView.value = 'old'
  const relation = { idolCode: '001tom', sectionId: 12, episodeId: 34 }
  const pending = t.context.openBirthdayIdolStory(relation)
  await Promise.resolve()
  t.jobs.get('001tom').resolve(detail('001tom'))
  await pending
  assert.deepEqual([...t.jobs.keys()], ['001tom'], 'birthday relation must request only its idol story leaf without old communication indexes')
  assert.equal(t.context.currentStorySection.value, '12')
  assert.equal(t.context.currentEpisodeId.value, '34')
  assert.deepEqual(t.commits, ['idol_story_archive'])
}
console.log('Idol story read-model navigation: picker, latest selection, supersession and retry passed')
