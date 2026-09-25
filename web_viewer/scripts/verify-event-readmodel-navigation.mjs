import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const source = app.match(/function openEventDetail\([^]*?\n\}/)?.[0]
assert.ok(source)

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  let revision = 0, captured = 0
  const context = vm.createContext({
    pendingEventNavigation: 0, eventReadModelStatus: { value: '' }, eventReadModelDetail: { value: null },
    currentEventId: { value: '' }, eventParentView: { value: '' }, loading: { value: false },
    navigation: { getRevision: () => revision, isDisposed: () => false },
    loadEventDetail: id => { const job = deferred(); jobs.set(id, job); return job.promise },
    captureDetailSource: () => { captured++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  vm.runInContext(source, context)
  return { context, jobs, commits, errors, captured: () => captured, invalidate: () => revision++ }
}
const detail = id => ({ id, view: { event: { event_id: id } } })

{
  const t = setup()
  const old = t.context.openEventDetail({ event_id: 410001 })
  const current = t.context.openEventDetail({ event_id: 410002 }, 'idol_detail')
  t.jobs.get('410002').resolve(detail('410002')); await current
  t.jobs.get('410001').resolve(detail('410001')); await old
  assert.equal(t.context.currentEventId.value, '410002')
  assert.equal(t.context.eventParentView.value, 'idol_detail')
  assert.equal(t.captured(), 1)
  assert.deepEqual(t.commits, ['event_detail'])
}
{
  const t = setup()
  const old = t.context.openEventDetail({ event_id: 410001 })
  t.invalidate()
  t.jobs.get('410001').resolve(detail('410001')); await old
  assert.deepEqual(t.commits, [])
}
{
  const t = setup()
  const failed = t.context.openEventDetail({ event_id: 410001 })
  t.jobs.get('410001').reject(new Error('network')); await failed
  assert.match(t.context.eventReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openEventDetail({ event_id: 410001 })
  t.jobs.get('410001').resolve(detail('410001')); await retry
  assert.deepEqual(t.commits, ['event_detail'])
}
console.log('Event read-model navigation: latest selection, route supersession and retry passed')
