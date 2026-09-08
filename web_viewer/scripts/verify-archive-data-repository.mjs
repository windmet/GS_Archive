import assert from 'node:assert/strict'
import { createArchiveDataRepository, ARCHIVE_SOURCES, IDOL_COMMUNICATION_SOURCES } from '../src/data/ArchiveDataRepository.js'

function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const card = { cards_by_resource_id: {}, skills_by_id: {}, costumes_by_key: {} }
const response = (body = card, { ok = true, status = 200, type = 'application/json' } = {}) => ({ ok, status, headers: { get: () => type }, json: async () => body })
function setup() {
  const requests = []
  const repo = createArchiveDataRepository({ fetchImpl: (url, options) => {
    const pending = deferred(); requests.push({ ...pending, url, options }); return pending.promise
  } })
  return { repo, requests }
}

// Concurrent calls share one request; a fresh load replaces the cached request.
{
  const { repo, requests } = setup()
  const a = repo.loadCardDetailData(), b = repo.loadCardDetailData()
  assert.equal(requests.length, 1)
  requests[0].resolve(response())
  assert.equal(await a, card); assert.equal(await b, card)
  const fresh = repo.loadCardDetailData({ fresh: true })
  assert.equal(requests.length, 2)
  assert.equal(requests[1].options.cache, 'no-store')
  requests[1].resolve(response())
  await fresh
  await repo.loadCardDetailData()
  assert.equal(requests.length, 2)
}
// Older failure cannot evict a newer successful refresh.
{
  const { repo, requests } = setup()
  const old = repo.loadCardDetailData().catch(error => error)
  const fresh = repo.loadCardDetailData({ fresh: true })
  requests[1].resolve(response()); await fresh
  requests[0].reject(new Error('old connection failed')); await old
  const cached = repo.loadCardDetailData()
  assert.equal(requests.length, 2, 'stale failure evicted the refreshed cache')
  assert.equal(await cached, card)
}
// Clearing cache also prevents prior failures from evicting the next request.
{
  const { repo, requests } = setup()
  const old = repo.loadCardDetailData().catch(error => error)
  repo.clearArchiveDataCache()
  const current = repo.loadCardDetailData()
  requests[0].reject(new Error('old failure')); await old
  const concurrent = repo.loadCardDetailData()
  assert.equal(requests.length, 2)
  requests[1].resolve(response()); await Promise.all([current, concurrent])
}
// Failed HTTP, HTML fallback and invalid JSON contract remain retryable and contextual.
for (const bad of [response(null, { ok: false, status: 404 }), response(null, { type: 'text/html' }), response({}),
  { ...response(), json: async () => { throw new SyntaxError('invalid JSON') } },
]) {
  const { repo, requests } = setup()
  const failed = repo.loadCardDetailData()
  requests[0].resolve(bad)
  await assert.rejects(failed, /cardDetailIndex \(\/data\/masterdata\/card_detail_index.json\):/)
  const retried = repo.loadCardDetailData()
  assert.equal(requests.length, 2)
  requests[1].resolve(response()); await retried
}
// A partial archive load retains its successful products and per-key failures.
{
  const { repo, requests } = setup()
  const pending = repo.loadArchiveData()
  assert.equal(requests.length, Object.keys(ARCHIVE_SOURCES).length)
  for (const request of requests) request.resolve(request.url === ARCHIVE_SOURCES.compiledIndex
    ? response({ categories: [] }) : response(null, { ok: false, status: 503 }))
  const result = await pending
  assert.deepEqual(result.data.compiledIndex, { categories: [] })
  assert.equal(result.errors.length, requests.length - 1)
  assert.equal(result.data.storyCatalog, null)
  assert.ok(result.errors.some(item => item.key === 'storyCatalog'))
}
// Independent communication loads keep their fail-fast contract.
{
  const { repo, requests } = setup()
  const pending = repo.loadIdolCommunicationData()
  assert.deepEqual(requests.map(request => request.url), Object.values(IDOL_COMMUNICATION_SOURCES))
  requests.forEach(request => request.resolve(response(null, { ok: false, status: 404 })))
  await assert.rejects(pending, /HTTP 404/)
}
console.log('Archive data repository: request deduplication, refresh/clear races, retry, partial results and lazy load errors passed')
