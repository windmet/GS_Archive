import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { readCheckout } from '../lib/checkout_adapter.mjs'

const viewer = fileURLToPath(new URL('../..', import.meta.url))

test('[local-corpus] every SSR skill cut-in USM binds to its card', async () => {
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  const bound = Object.entries(product.cardContext).filter(([, context]) => context.skillMovie)
  assert.equal(bound.length, 124)
  for (const [resourceId, context] of bound) {
    assert.match(resourceId, /_ssr\d+$/)
    assert.equal(context.skillMovie.url, `/assets/card-skill-movies/${resourceId}.mp4`)
    assert.equal(context.skillMovie.poster, `/assets/card-skill-movies/${resourceId}.jpg`)
    assert.ok(context.skillMovie.bytes > 0 && context.skillMovie.durationMs > 0)
  }
  assert.ok(product.cardContext['001tom_ssr01'].skillMovie)
  assert.equal(product.cardContext['001tom_n01']?.skillMovie, undefined)
})
