import { bindEventNavigation, eventFixtureDetail, createEventFixtureTransport } from './lib/event-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')


function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup() {
  const jobs = new Map(), commits = [], errors = []
  const events = createEventFixtureTransport(['410001', '410002'])
  let revision = 0, captured = 0
  const context = vm.createContext({
    prepareArchivePage: (_view, data) => data,
    pendingEventNavigation: 0, eventReadModelStatus: { value: '' }, eventReadModelDetail: { value: null },
    currentEventId: { value: '' }, eventParentView: { value: '' }, loading: { value: false },
    navigation: { invalidate: () => revision++, getRevision: () => revision, isDisposed: () => false },
    eventReadModelCatalog: { value: events.rows },
    readModelClient: { async load(descriptor, options) { const value = await jobs.get(descriptor.expectedId).promise; options.validate(value); return value } },
    captureDetailSource: () => { captured++ },
    commitView: view => { revision++; commits.push(view); context.loading.value = false },
    console: { error: (...args) => errors.push(args) },
  })
  bindEventNavigation(app, context).stop()
  const open = context.openEventDetail
  context.openEventDetail = (...args) => { jobs.set(String(args[0].event_id), deferred()); return open(...args) }
  return { context, jobs, commits, errors, captured: () => captured, invalidate: () => revision++ }
}
const detail = eventFixtureDetail

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
  const originalError = console.error
  console.error = (...args) => t.errors.push(args)
  try {
    const failed = t.context.openEventDetail({ event_id: 410001 })
    t.jobs.get('410001').reject(new Error('network')); await failed
  } finally { console.error = originalError }
  assert.match(t.context.eventReadModelStatus.value, /重试/)
  assert.equal(t.context.loading.value, false)
  assert.equal(t.errors.length, 1)
  const retry = t.context.openEventDetail({ event_id: 410001 })
  t.jobs.get('410001').resolve(detail('410001')); await retry
  assert.deepEqual(t.commits, ['event_detail'])
}
console.log('Event read-model navigation: latest selection, route supersession and retry passed')
