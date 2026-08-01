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

const [index, catalog, musicCatalog] = await Promise.all([
  readJson('public/data/song_jacket_index.json'),
  readJson('public/data/song_catalog.json'),
  readJson('public/data/masterdata/music_catalog.json'),
])
assert.equal(index.schema_version, 1)
assert.equal(index.meta.entry_count, 61)
assert.equal(Object.keys(index.entries).length, 61)

const catalogCodes = new Set(Object.keys(musicCatalog.songs))
assert.deepEqual(
  new Set(Object.keys(index.entries)),
  catalogCodes,
  'jacket index must cover exactly the music_catalog songs',
)

let publishedBytes = 0
for (const [code, entry] of Object.entries(index.entries)) {
  const song = catalog.songs[code]
  assert.ok(song, `catalog must include song ${code}`)
  assert.equal(song.jacket_url, entry.url)
  assert.equal(song.choreography.has_jacket, true)

  const filename = path.join(root, 'public', entry.url.replace(/^\//, ''))
  const bytes = await readFile(filename)
  assert.equal(sha256(bytes), entry.sha256)
  assert.deepEqual(pngDimensions(bytes), { width: 365, height: 360 })
  assert.deepEqual(entry.raw_texture, { width: 730, height: 720 })
  assert.equal((await stat(filename)).size, entry.bytes)
  assert.equal(filename, path.join(root, `public/assets/songs/jacket_${code}.png`))
  publishedBytes += entry.bytes

  if (mounted) {
    const rawPath = path.join(repositoryRoot, 'RAW', entry.raw_bundle.relative_path)
    const rawBytes = await readFile(rawPath)
    assert.equal(sha256(rawBytes), entry.raw_bundle.sha256)
    assert.equal(entry.raw_bundle.relative_path, `asset/song_${code}.unity3d`)
  }
}
assert.equal(publishedBytes, index.meta.published_bytes)
assert.equal(catalog.summary.jacket_url_coverage, 61)

console.log(
  `Song jackets verified (${mounted ? 'mounted' : 'source-only'}): ` +
  `61 RAW covers / 61 PNG / ${(publishedBytes / 1e6).toFixed(1)}MB`,
)
