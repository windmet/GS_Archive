import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = path.resolve(root, '..')
const mounted = process.argv.includes('--mounted')
const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const readJson = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'))

function pngDimensions(buffer) {
  assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG')
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

const expected = {
  '601': '1010010',
  '604': '1010040',
  '605': '1010070',
  '606': '1010060',
  '607': '1010080',
  '608': '1010090',
  '609': '1010100',
}

const [index, relationCatalog] = await Promise.all([
  readJson('public/data/masterdata/extra_story_visual_index.json'),
  readJson('public/data/image_bundle_relation_catalog.json'),
])
assert.equal(index.schema_version, 1)
assert.equal(index.entries.length, 7)
assert.equal(index.meta.entry_count, 7)
assert.equal(index.meta.banner_count, 7)
assert.equal(index.meta.key_visual_count, 7)
assert.deepEqual(
  Object.fromEntries(Object.entries(index.by_chapter_id)
    .map(([chapterId, entryId]) => [
      chapterId,
      index.entries.find(entry => entry.extra_story_entry_id === entryId)?.resource_id,
    ])),
  expected,
)

const relationBytes = await readFile(path.join(root, 'public/data/image_bundle_relation_catalog.json'))
assert.equal(sha256(relationBytes), index.source.image_relation_catalog_sha256)
const relationById = new Map(relationCatalog.entries.map(entry => [entry.id, entry]))

let publishedBytes = 0
for (const entry of index.entries) {
  assert.equal(entry.source.table, 178)
  assert.equal(entry.resource_id, expected[entry.chapter_id])
  const relation = relationById.get(entry.raw_bundle.relation_id)
  assert.ok(relation, `missing relation ${entry.raw_bundle.relation_id}`)
  assert.equal(relation.raw.relative_path, entry.raw_bundle.relative_path)
  assert.equal(relation.raw.sha256, entry.raw_bundle.sha256)

  for (const [role, expectedDimensions] of Object.entries({
    banner: { width: 300, height: 150 },
    key_visual: { width: 1456, height: 548 },
  })) {
    const asset = entry.assets[role]
    const filename = path.join(root, 'public', asset.url.replace(/^\//, ''))
    const bytes = await readFile(filename)
    assert.equal(sha256(bytes), asset.sha256)
    assert.deepEqual(pngDimensions(bytes), expectedDimensions)
    assert.equal((await stat(filename)).size, asset.bytes)
    publishedBytes += asset.bytes

    const sourceObject = entry.source_objects[role]
    const matches = relation.unity.container_entries.filter(item =>
      item.type === 'Texture2D' &&
      String(item.path_id) === sourceObject.path_id &&
      item.path === sourceObject.path
    )
    assert.equal(matches.length, 1)
  }

  if (mounted) {
    const rawPath = path.join(repositoryRoot, 'RAW', entry.raw_bundle.relative_path)
    const rawBytes = await readFile(rawPath)
    assert.equal(sha256(rawBytes), entry.raw_bundle.sha256)
  }
}
assert.equal(publishedBytes, index.meta.published_bytes)

console.log(
  `Extra Story visuals verified (${mounted ? 'mounted' : 'source-only'}): ` +
  `7 table-178 relations / 14 PNG / ${publishedBytes} bytes`,
)
