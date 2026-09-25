import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = app.match(/function openStoryDetail\([^]*?\n\}/)?.[0]
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
    pendingStoryDetailNavigation: 0, storyReadModelStatus: { value: '' },
    storyReadModelDetail: { value: null }, loading: { value: false },
    currentStoryFile: { value: '' }, currentStoryDomain: { value: '' },
    currentStorySection: { value: '' }, storyDetailParentView: { value: '' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadStoryReadModelDetail: file => { const job = deferred(); jobs.set(file, job); return job.promise },
    captureDetailSource: () => { captures++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(source, context)
  return { context, jobs, commits, errors, captures: () => captures, invalidate: () => revision++ }
}
const detail = (file, domain = 'main', sectionId = '101') =>
  ({ story: { file, domain, sectionId }, view: { related: [], castReferences: [] } })
{
  const t = setup()
  const old = t.context.openStoryDetail({ file: 'old.json' })
  const current = t.context.openStoryDetail({ file: 'current.json' }, 'external_story_resources')
  t.jobs.get('current.json').resolve(detail('current.json', 'extra', '601')); await current
  t.jobs.get('old.json').resolve(detail('old.json')); await old
  assert.equal(t.context.currentStoryFile.value, 'current.json')
  assert.equal(t.context.currentStoryDomain.value, 'extra')
  assert.equal(t.context.currentStorySection.value, '601')
  assert.equal(t.context.storyDetailParentView.value, 'external_story_resources')
  assert.equal(t.captures(), 1)
  assert.deepEqual(t.commits, ['story_detail'])
}
{
  const t = setup()
  const stale = t.context.openStoryDetail({ file: 'old.json' })
  t.invalidate()
  t.jobs.get('old.json').resolve(detail('old.json')); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openStoryDetail({ file: 'retry.json' })
  t.jobs.get('retry.json').reject(new Error('network')); await failed
  assert.equal(t.context.currentStoryFile.value, '')
  assert.match(t.context.storyReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openStoryDetail({ file: 'retry.json' })
  t.jobs.get('retry.json').resolve(detail('retry.json')); await retry
  assert.equal(t.context.currentStoryFile.value, 'retry.json')
  assert.deepEqual(t.commits, ['story_detail'])
}
console.log('Story read-model navigation: latest selection, parent context, supersession and retry passed')
