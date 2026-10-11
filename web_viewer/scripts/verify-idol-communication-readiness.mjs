import { bindIdolNavigation, createIdolFixtureTransport, idolFixtureDetail } from './lib/idol-navigation-harness.mjs'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createIdolCommunicationReadiness } from '../src/data/idolCommunicationReadiness.js'
import vm from 'node:vm'
import { ref, watch, nextTick, effectScope } from 'vue'
import { createArchiveNavigationCoordinator } from '../src/core/ArchiveNavigationCoordinator.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}
let cached = false
const requests = []
const states = []
const readiness = createIdolCommunicationReadiness({
  ensure: () => {
    const request = deferred()
    requests.push(request)
    return request.promise
  },
  hasData: () => cached,
  publish: state => states.push(state),
})
const expectState = (status, idolCode) => assert.deepEqual(states.at(-1), { status, idolCode })

const first = readiness.enter('idol-a')
expectState('loading', 'idol-a')
const second = readiness.enter('idol-b')
expectState('loading', 'idol-b')
requests[0].resolve(null)
await first
expectState('loading', 'idol-b')
requests[1].resolve(null)
await second
expectState('error', 'idol-b')

const retry = readiness.enter('idol-b')
expectState('loading', 'idol-b')
cached = true
requests[2].resolve({})
await retry
expectState('ready', 'idol-b')
await readiness.enter('idol-c')
expectState('ready', 'idol-c')
assert.equal(requests.length, 3, 'cache hit must not trigger another request')

cached = false
const abandoned = readiness.enter('idol-d')
readiness.leave()
expectState('idle', '')
requests[3].resolve(null)
await abandoned
expectState('idle', '')

const app = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const bootstrap = { EXTERNAL_STORY_RESOURCES_ENABLED: false }
vm.runInNewContext(app.match(/function isBootstrapRoute\([^]*?\n\}/)[0], bootstrap)
assert.equal(bootstrap.isBootstrapRoute({ view: 'idol_detail', idol: '001tom' }), true,
  'idol detail must not wait for the legacy archive batch')

const start = app.indexOf('watch([view, currentCharacterId],')
const end = app.indexOf('\nwatch(cardLayout,', start)
assert.ok(start >= 0 && end > start, 'production idol-detail watcher must be available')
const scope = effectScope()
const loads = []
const errors = []
const transport = createIdolFixtureTransport()
const state = {
  archiveBootstrap: transport.bootstrap,
  ref, watch, view: ref('portal'), currentCharacterId: ref(''),
  idolReadModelDetail: ref(null), idolReadModelStatus: ref(''), pendingIdolNavigation: 0,
  navigation: createArchiveNavigationCoordinator(),
  readModelClient: { load(descriptor, options) {
    if (descriptor.url.startsWith('idol:')) {
      const id = descriptor.url.slice(5)
      let resolve, reject
      const promise = new Promise((yes, no) => { resolve = yes; reject = no })
      loads.push({ id, resolve, reject }); transport.jobs.set(descriptor.url, { promise })
    }
    return transport.client.load(descriptor, options)
  } },
  idolCommunicationReadiness: { enter: () => { throw Error('legacy communication fetch is forbidden') } },
  console: { error: (...args) => errors.push(args) },
}
bindIdolNavigation(app, state)
const originalError = console.error
console.error = state.console.error
const flush = async () => { await nextTick(); await new Promise(resolve => setImmediate(resolve)) }
const enter = async (id, view = 'idol_detail') => {
  state.currentCharacterId.value = id
  state.view.value = view
  await flush()
}
try {
  scope.run(() => vm.runInNewContext(app.slice(start, end), state))
  await enter('001tom', 'portal')
  assert.equal(loads.length, 0)
  await enter('001tom')
  assert.equal(loads.length, 1, 'entering idol detail requests its bounded leaf')
  assert.equal(loads[0].id, '001tom')
  assert.ok(state.idolReadModelStatus.value)
  await enter('002sht')
  loads[0].resolve(idolFixtureDetail('001tom'))
  await flush()
  assert.equal(state.idolReadModelDetail.value, null, 'stale detail must not publish')
  loads[1].resolve(idolFixtureDetail('002sht'))
  await flush()
  assert.equal(state.idolReadModelDetail.value?.id, '002sht')
  assert.equal(state.idolReadModelStatus.value, '')
  await enter('002sht', 'portal')
  await enter('002sht')
  assert.equal(loads.length, 2, 'matching cached leaf must not reload')
  await enter('001tom')
  loads[2].reject(Error('controlled read failure'))
  await flush()
  assert.equal(errors.length, 1)
  assert.match(state.idolReadModelStatus.value, /重试/)
  await enter('', 'portal')
  await enter('001tom')
  loads[3].resolve(idolFixtureDetail('001tom'))
  await flush()
  assert.equal(state.idolReadModelDetail.value?.id, '001tom', 'returning retries a failed leaf')
  for (const invalidate of [() => state.navigation.invalidate(), () => state.navigation.dispose()]) {
    await enter('002sht')
    invalidate()
    loads.at(-1).resolve(idolFixtureDetail('002sht'))
    await flush()
    assert.equal(state.idolReadModelDetail.value?.id, '001tom', 'invalidated navigation must not publish')
    await enter('', 'portal')
  }
} finally {
  scope.stop()
  console.error = originalError
}
console.log('Idol communication readiness utility races and production leaf cutover passed')
