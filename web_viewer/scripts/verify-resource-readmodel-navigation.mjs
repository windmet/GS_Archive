import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = app.match(/function openArchiveStatus\([^]*?\n\}/)?.[0]
assert.ok(source)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = [], commits = [], errors = []
  let revision = 0
  const context = vm.createContext({
    pendingResourceNavigation: 0, resourceReadModelStatus: { value: '' },
    resourceReadModelDetail: { value: null }, loading: { value: false },
    view: { value: 'portal' }, detailSourceRoute: { value: '' }, filterQuery: { value: 'prior' },
    currentStoryDomain: { value: 'main' }, currentEventScope: { value: 'fixed_unit_event' },
    currentStoryAvailability: { value: 'playable' }, currentStorySort: { value: 'title' },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadResourceStatus: () => { const job = deferred(); jobs.push(job); return job.promise },
    commitView: next => { revision++; commits.push(next); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(source, context)
  return { context, jobs, commits, errors, invalidate: () => revision++ }
}

{
  const t = setup()
  const old = t.context.openArchiveStatus()
  const current = t.context.openArchiveStatus()
  t.jobs[1].resolve({ id: 'archive-status', view: { manifest: { coverage: {} } } }); await current
  t.jobs[0].resolve({ id: 'obsolete' }); await old
  assert.deepEqual(t.commits, ['archive_status'])
  assert.equal(t.context.resourceReadModelDetail.value.id, 'archive-status')
  assert.equal(t.context.filterQuery.value, '')
}
{
  const t = setup()
  const stale = t.context.openArchiveStatus()
  t.invalidate()
  t.jobs[0].resolve({ id: 'obsolete' }); await stale
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openArchiveStatus()
  t.jobs[0].reject(new Error('network')); await failed
  assert.match(t.context.resourceReadModelStatus.value, /重试/)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openArchiveStatus()
  t.jobs[1].resolve({ id: 'archive-status' }); await retry
  assert.deepEqual(t.commits, ['archive_status'])
}
console.log('Resource status navigation: latest request, supersession and retry passed')
