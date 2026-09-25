import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = app.match(/function openProjectedCollection\([^]*?\n\}/)?.[0]
assert.ok(source)
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0, captures = 0
  const context = vm.createContext({
    pendingCollectionNavigation: 0, collectionReadModelStatus: { value: '' },
    collectionReadModelDetail: { value: null }, loading: { value: false },
    currentStoryDomain: { value: '' }, currentStorySection: { value: '' },
    currentStoryMode: { value: '' }, currentStoryFile: { value: '' },
    storyCollectionParentView: { value: '' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadCollectionDetail: (domain, section) => {
      const job = deferred(); jobs.set(`${domain}:${section}`, job); return job.promise
    },
    captureDetailSource: () => { captures++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(source, context)
  return { context, jobs, commits, errors, captures: () => captures, invalidate: () => revision++ }
}
const detail = id => ({ id, view: { collection: { id } } })
{
  const t = setup()
  const old = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  const current = t.context.openProjectedCollection({ domain: 'extra', section: '60101',
    storyFile: 'selected.json', parent: 'song_detail' })
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
  t.invalidate()
  t.jobs.get('main:101').resolve(detail('main:101')); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  t.jobs.get('main:101').reject(new Error('network')); await failed
  assert.equal(t.context.currentStoryDomain.value, '')
  assert.match(t.context.collectionReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openProjectedCollection({ domain: 'main', section: '101' })
  t.jobs.get('main:101').resolve(detail('main:101')); await retry
  assert.equal(t.context.currentStorySection.value, '101')
  assert.deepEqual(t.commits, ['story_collection'])
}
console.log('Collection read-model navigation: latest selection, supersession, alias context and retry passed')
