import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readCheckout } from '../lib/checkout_adapter.mjs'

const viewer = fileURLToPath(new URL('../..', import.meta.url))

test('[local-corpus] song leaves carry the same primary stage entry as the source manifest', async () => {
  const source = JSON.parse(await fs.readFile(new URL('../../public/data/song_timelines/manifest.json', import.meta.url), 'utf8'))
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  assert.equal(source.schemaVersion, 1)
  assert.equal(source.timeUnit, 'ms')
  for (const song of product.songs) {
    const expected = (source.songs[song.song_code] || [])
      .find(entry => !entry.variant && ['choreography_candidate', 'special_single'].includes(entry.stageKind)) || null
    const actual = product.songViews[song.song_code].stageCandidate
    assert.deepEqual(actual, expected ? { id: expected.id, stageKind: expected.stageKind } : null, song.song_code)
  }
  assert.equal(product.songViews.brndnf.stageCandidate?.id, 'brndnf_live_effect')
  assert.equal(product.songViews.drv999.stageCandidate?.stageKind, 'special_single')
})
