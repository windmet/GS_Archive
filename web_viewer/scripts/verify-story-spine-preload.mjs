import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { createStoryAssetPlan } from '../shared/story/StoryAssetPlan.js'
import { Preloader } from '../src/utils/Preloader.js'

const atlases = {
  multi: 'folder-a/page.png\nsize: 32,32\nfilter: Linear,Linear\n\nfolder-b/page.png\nsize: 32,32\nfilter: Linear,Linear\n',
  single: 'original.png\nsize: 32,32\nfilter: Linear,Linear\n',
  bad: '../escape.png\nsize: 32,32\n',
  slow: 'held.png\nsize: 32,32\n',
}
const requests = [], images = []
const server = http.createServer((request, response) => {
  requests.push({ method: request.method, url: request.url })
  const model = request.url.split('/')[3]
  if (request.url.endsWith('held.png')) return // keep native HEAD pending until aborted
  if (request.url.endsWith('comu.atlas')) { response.end(atlases[model]); return }
  if (request.url.endsWith('original.png') || request.url.endsWith('folder-b/page.png')) {
    response.writeHead(404); response.end(); return
  }
  response.setHeader('Content-Type', request.url.endsWith('.png') ? 'image/png' : 'application/octet-stream')
  response.end('fixture bytes')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const savedFetch = globalThis.fetch, savedImage = globalThis.Image
globalThis.fetch = (url, options) => savedFetch(new URL(url, base), options)
// Image events are controlled here; real page loads are checked in Browser.
globalThis.Image = class {
  set src(url) {
    images.push(url)
    queueMicrotask(() => url.endsWith('folder-b/page.png') ? this.onerror?.() : this.onload?.())
  }
  removeAttribute() {}
}
const makePlan = model => createStoryAssetPlan({ steps: [{ step_id: 7, state: { spines: [{ model }] } }] },
  { file: 'fixture.json', sha256: `sha256:${'a'.repeat(64)}` })
try {
  const original = makePlan('multi'), before = JSON.stringify(original), reports = []
  const multi = await Preloader.preloadScenario(original, undefined, { onStatus: value => reports.push(value) })
  assert.equal(JSON.stringify(original), before, 'dependency expansion must not mutate the source plan')
  assert.equal(multi.plan.assets.length, 5)
  assert.equal(multi.status.total, 5, 'short initial batch must still execute appended pages')
  assert.equal(multi.status.failed, 1)
  assert.equal(multi.status.succeeded, 3)
  assert.equal(multi.status.pending, 1, 'bundle awaits renderer even after dependency discovery')
  assert.equal(multi.status.dependenciesComplete, true, 'logical closure is independent of failed download')
  assert.equal(multi.status.tasks.find(task => task.key === 'spine-bundle:multi').state, 'deferred')
  const pages = multi.status.tasks.filter(task => task.kind === 'spine-texture')
  assert.deepEqual(pages.map(task => task.id), ['multi/folder-a/page.png', 'multi/folder-b/page.png'])
  assert.equal(pages[0].atlasSource.sha256, `sha256:${createHash('sha256').update(atlases.multi).digest('hex')}`)
  assert.equal(pages[0].uses[0].stepId, 7)
  assert.ok(pages.every(task => ['image-loaded', 'failed'].includes(task.state)))
  assert.ok(!requests.some(request => request.url === '/assets/spines/multi/comu.png'), 'multi-page cannot alias missing pages to comu.png')
  assert.equal(reports[0].total, 3)
  assert.equal(reports[0].tasks.find(task => task.kind === 'spine-bundle').dependencies.length, 2, 'earlier reports stay unchanged')

  const single = await Preloader.preloadScenario(makePlan('single'))
  const page = single.status.tasks.find(task => task.kind === 'spine-texture')
  assert.equal(page.atlasSource.page, 'original.png')
  assert.equal(page.url, '/assets/spines/single/comu.png', 'physical fallback URL retains logical page identity')
  assert.equal(page.state, 'image-loaded')
  assert.ok(requests.some(request => request.method === 'HEAD' && request.url.endsWith('single/comu.png')))

  const bad = await Preloader.preloadScenario(makePlan('bad'))
  assert.equal(bad.status.failed, 1)
  assert.equal(bad.status.dependenciesComplete, false)
  assert.equal(bad.plan.assets.length, 3)
  assert.match(bad.status.tasks.find(task => task.kind === 'spine-atlas').error, /Unsafe atlas page/)

  const silhouette = await Preloader.preloadScenario(makePlan('102sha_001_00'))
  assert.equal(silhouette.status.succeeded, 1)
  assert.equal(silhouette.status.excluded, 2)
  assert.equal(silhouette.status.pending, 1)
  assert.deepEqual(silhouette.plan.assets.find(task => task.kind === 'spine-bundle').dependencies, ['silhouette:102sha_001_00'])
  assert.ok(images.includes('/assets/silhouette/102sha_001_00.png'))
  assert.ok(!requests.some(request => request.url.includes('/spines/102sha_001_00/')))

  const controller = new AbortController(), cancelledReports = []
  const pending = Preloader.preloadScenario(makePlan('slow'), undefined,
    { signal: controller.signal, onStatus: value => cancelledReports.push(value) })
  const deadline = Date.now() + 3000
  while (!requests.some(request => request.url.endsWith('held.png'))) {
    assert.ok(Date.now() < deadline, 'newly discovered page must enter the native HEAD probe')
    await new Promise(resolve => setImmediate(resolve))
  }
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(cancelledReports.at(-1).cancelled, 1)
  assert.equal(cancelledReports.at(-1).failed, 0)
  assert.ok(!images.some(url => url.endsWith('held.png')), 'aborted page probe must not start an image load')
} finally {
  globalThis.fetch = savedFetch; globalThis.Image = savedImage
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
console.log('Spine preload verified: dynamic multi-page tasks, SHA/provenance, missing page, shared single-page fallback, malformed atlas and static silhouette')
