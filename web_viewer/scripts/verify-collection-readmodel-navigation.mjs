import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { parse, compileScript } from '@vue/compiler-sfc'
import { ref } from 'vue'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'
import { bindStoryNavigation } from './lib/story-navigation-harness.mjs'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(app, { filename: 'App.vue' })
assert.deepEqual(errors, [])
const setupScript = compileScript(descriptor, { id: 'collection-navigation-check' })
assert.ok(setupScript.scriptSetupAst.some(node => node.type === 'FunctionDeclaration' && node.id?.name === 'openCollectionCard'),
  'The item-to-card template handler must be declared in setup scope, not nested in another handler')
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let captures = 0
  const navigation = createArchiveNavigationCoordinator()
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    collectionReadModelStatus: { value: '' },
    collectionReadModelDetail: { value: null }, loading: { value: false },
    currentStoryDomain: { value: '' }, currentStorySection: { value: '' },
    currentStoryMode: { value: '' }, currentStoryFile: { value: '' },
    storyCollectionParentView: { value: '' },
    navigation,
    collectionReadModelCatalog: ref([
      { id: 'main:101', domain: 'main', sectionId: '101', title: 'Main', detail: { url: 'main:101' } },
      { id: 'extra:601', domain: 'extra', sectionId: '601', legacySectionIds: ['60101'], title: 'Extra', detail: { url: 'extra:60101' } },
    ]),
    readModelClient: { load: (descriptor, options) => {
      const job = deferred(); jobs.set(descriptor.url, job)
      return job.promise.then(detail => { options.validate(detail); return detail })
    } },
    captureDetailSource: () => { captures++ },
    commitView: view => { navigation.invalidate(); commits.push(view); context.loading.value = false },
  })
  bindStoryNavigation(app, context).stop()
  return { context, jobs, commits, errors, captures: () => captures, invalidate: navigation.invalidate }
}
const detail = id => ({ id, view: { collection: { id, domain: id.split(':')[0], sectionId: id.split(':')[1], chapters: [] }, readingEntries: [] } })
{
  const t = setup()
  const old = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  const current = t.context.openProjectedCollection({ domain: 'extra', section: '60101',
    storyFile: 'selected.json', parent: 'song_detail' })
  await Promise.resolve()
  t.jobs.get('extra:60101').resolve(detail('extra:601')); await current
  t.jobs.get('main:101').resolve(detail('main:101')); await old
  assert.equal(t.context.currentStoryDomain.value, 'extra')
  assert.equal(t.context.currentStorySection.value, '60101')
  assert.equal(t.context.currentStoryFile.value, 'selected.json')
  assert.equal(t.context.storyCollectionParentView.value, 'song_detail')
  assert.equal(t.captures(), 1)
  assert.deepEqual(t.commits, ['story_collection'])
}
{
  const t = setup()
  const stale = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  await Promise.resolve()
  t.invalidate()
  t.jobs.get('main:101').resolve(detail('main:101')); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  await Promise.resolve()
  const previousError = console.error
  try { console.error = (...args) => t.errors.push(args); t.jobs.get('main:101').reject(new Error('network')); await failed }
  finally { console.error = previousError }
  assert.equal(t.context.currentStoryDomain.value, '')
  assert.match(t.context.collectionReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  await Promise.resolve()
  t.jobs.get('main:101').resolve(detail('main:101')); await retry
  assert.equal(t.context.currentStorySection.value, '101')
  assert.deepEqual(t.commits, ['story_collection'])
}
console.log('Collection read-model navigation: latest selection, supersession, alias context and retry passed')
