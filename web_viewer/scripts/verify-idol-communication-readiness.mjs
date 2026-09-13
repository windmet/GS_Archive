import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createIdolCommunicationReadiness } from '../src/data/idolCommunicationReadiness.js'

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
assert.match(app, /watch\(\[view, currentCharacterId\],[\s\S]*?idolCommunicationReadiness\.enter\(idolCode\)/)
assert.match(app, /@retry-communication="retryIdolCommunication"/)
assert.doesNotMatch(app.match(/if \(\[([\s\S]*?)\]\.includes\(route\.view\)\)/)?.[1] || '', /'idol_detail'/,
  'idol detail route should render before communication indexes arrive')
console.log('Idol communication readiness: entry, cache, failure/retry, switch and exit races passed')
