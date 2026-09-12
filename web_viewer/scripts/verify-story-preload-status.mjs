import assert from 'node:assert/strict'
import http from 'node:http'
import { Preloader } from '../src/utils/Preloader.js'

// Real HTTP status/body semantics; the Image adapter is exercised with browser
// event stand-ins here, and with actual image requests in the page acceptance.
const server = http.createServer((request, response) => {
  if (request.url.includes('missing')) { response.writeHead(404); response.end('missing') }
  else if (request.url.includes('empty')) response.end()
  else response.end('skeleton fixture bytes')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const originalFetch = globalThis.fetch, originalImage = globalThis.Image
globalThis.fetch = (url, options) => originalFetch(new URL(url, base), options)
const images = []
globalThis.Image = class {
  constructor() { images.push(this) }
  set src(url) { queueMicrotask(() => url.includes('missing') ? this.onerror?.() : this.onload?.()) }
  removeAttribute() {}
}
try {
  const statuses = [], percentages = []
  const result = await Preloader.preloadScenario([
    { state: { bg: 'ok', spines: [{ model: 'ok' }, { model: 'missing' }, { model: 'empty' }] } },
    { state: { bg: 'missing', spines: [{ model: 'ok' }] } },
  ], value => percentages.push(value), { onStatus: value => statuses.push(value) })
  assert.equal(result.status.scope, 'legacy-cache-warm')
  assert.equal(result.status.dependenciesComplete, false)
  assert.equal(result.status.phase, 'partial')
  assert.equal(result.status.total, 5, 'same skeleton requested by two steps is one task')
  assert.equal(result.status.succeeded, 2)
  assert.equal(result.status.failed, 3)
  assert.equal(result.status.pending, 0)
  assert.equal(result.status.cancelled, 0)
  assert.equal(result.status.tasks.find(task => task.key === 'bg:ok').state, 'image-loaded')
  assert.equal(result.status.tasks.find(task => task.key === 'spine:ok').state, 'fetched')
  assert.match(result.status.tasks.find(task => task.key === 'spine:missing').error, /HTTP 404/)
  assert.match(result.status.tasks.find(task => task.key === 'spine:empty').error, /Empty response/)
  assert.match(result.status.tasks.find(task => task.key === 'bg:missing').error, /Image load failed/)
  assert.ok(percentages.every(value => value <= 40), 'failed tasks must not inflate successful warming')
  assert.ok(statuses[0].tasks.every(task => task.state === 'discovered'), 'reports must not mutate retrospectively')
  assert.ok(images.every(image => image.onload === null && image.onerror === null && image.onabort === null))
  const zero = await Preloader.preloadScenario([], () => assert.fail('zero tasks must not report 100%'))
  assert.equal(zero.status.total, 0)
  assert.equal(zero.status.dependenciesComplete, false)
  assert.equal(zero.status.succeeded, 0)
} finally {
  globalThis.fetch = originalFetch
  globalThis.Image = originalImage
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
console.log('Preload status verified: native HTTP 404/empty bodies, image error, separate outcomes, stable reports and zero-task semantics')
