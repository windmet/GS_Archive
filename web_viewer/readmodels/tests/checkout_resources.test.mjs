import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { readCheckout } from '../lib/checkout_adapter.mjs'
import { pick } from '../lib/common.mjs'

test('Resource status projection preserves displayed source fields without full inventories', async () => {
  const viewer = fileURLToPath(new URL('../..', import.meta.url))
  const { product } = await readCheckout(viewer, { dataRevision: 'test', mediaEpoch: 'test' })
  const record = product.extraDomains.resources.records[0]
  const publicRoot = new URL('../../public/', import.meta.url)
  const manifest = JSON.parse(await fs.readFile(new URL('data/archive_manifest.json', publicRoot), 'utf8'))
  const verification = JSON.parse(await fs.readFile(new URL('data/archive_verification.json', publicRoot), 'utf8'))
  const uiAssets = JSON.parse(await fs.readFile(new URL('data/assets/ui_asset_catalog.json', publicRoot), 'utf8'))
  assert.equal(record.id, 'archive-status')
  assert.deepEqual(record.view.manifest, pick(manifest,
    ['schema_version', 'generated_at', 'data_updated_at', 'counts', 'coverage']))
  assert.deepEqual(record.view.verification, pick(verification,
    ['generated_at', 'scenarios', 'dialogue_voices', 'card_home_voices', 'card_scenarios',
      'card_relations', 'card_details', 'gashas', 'unit_event_relations']))
  assert.deepEqual(record.view.uiAssets, { schema_version: uiAssets.schema_version,
    meta: uiAssets.meta, source: pick(uiAssets.source || {}, ['scope']) })
  assert.ok(Buffer.byteLength(JSON.stringify(record.view)) < 32 * 1024)
  assert.ok(!Object.hasOwn(record.view.manifest, 'unit_event_relations'))
  assert.ok(!Object.hasOwn(record.view.uiAssets, 'entries'))
})
