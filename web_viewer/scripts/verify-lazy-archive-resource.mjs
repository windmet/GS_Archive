import assert from 'node:assert/strict'
import { createLazyArchiveResource } from '../src/data/lazyArchiveResource.js'

function setup() {
  let value = null, disposed = false
  const requests = [], errors = [], publications = []
  const ensure = createLazyArchiveResource({
    read: () => value,
    load: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    publish: data => { value = data; publications.push(data) },
    onError: error => errors.push(error),
    isDisposed: () => disposed,
  })
  return { ensure, requests, errors, publications, dispose: () => { disposed = true } }
}
{
  const t = setup(), other = setup()
  const a = t.ensure(), b = t.ensure(), c = other.ensure()
  await Promise.resolve()
  assert.equal(t.requests.length, 1)
  assert.equal(other.requests.length, 1)
  const data = { cards: [] }
  t.requests[0].resolve(data); other.requests[0].resolve({ separate: true })
  assert.equal(await a, data); assert.equal(await b, data); await c
  assert.deepEqual(t.publications, [data])
  assert.equal(await t.ensure(), data)
  assert.equal(t.requests.length, 1)
}
{
  const t = setup(), error = new Error('offline')
  const a = t.ensure(), b = t.ensure()
  await Promise.resolve(); t.requests[0].reject(error)
  assert.equal(await a, null); assert.equal(await b, null)
  assert.deepEqual(t.errors, [error]); assert.deepEqual(t.publications, [])
  const retry = t.ensure()
  await Promise.resolve(); assert.equal(t.requests.length, 2)
  const data = { recovered: true }; t.requests[1].resolve(data)
  assert.equal(await retry, data); assert.deepEqual(t.publications, [data])
}
for (const fail of [false, true]) {
  const t = setup(), pending = t.ensure()
  await Promise.resolve(); t.dispose()
  if (fail) t.requests[0].reject(new Error('late failure'))
  else t.requests[0].resolve({ late: true })
  assert.equal(await pending, null)
  assert.deepEqual(t.publications, []); assert.deepEqual(t.errors, [])
  assert.equal(await t.ensure(), null); assert.equal(t.requests.length, 1)
}
{
  const t = setup(); t.dispose()
  assert.equal(await t.ensure(), null); assert.equal(t.requests.length, 0)
  let errors = 0
  const ensure = createLazyArchiveResource({ read: () => null,
    load: () => { throw new Error('sync failure') }, publish: () => assert.fail('published'),
    onError: () => { errors++ } })
  assert.equal(await ensure(), null); assert.equal(await ensure(), null)
  assert.equal(errors, 2)
}
console.log('Lazy archive resource: sharing, isolation, cached reads, retry and disposed publication passed')
