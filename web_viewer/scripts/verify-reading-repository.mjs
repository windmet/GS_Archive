import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadingRepository } from '../src/data/ReadingRepository.js'
import { validateReadingDocument, validateReadingManifest } from '../shared/reading/ReadingContract.js'
const read = file => fs.readFile(new URL(`../public/data/reading/${file}`, import.meta.url), 'utf8')
const manifestText = await read('manifest.json')
const initial = JSON.parse(manifestText)
const entry = initial.entries.find(entry => entry.document_id === '1_4_001_00_a')
const entryIndex = initial.entries.indexOf(entry)
const text = await read(entry.file)
const digest = bytes => `sha256:${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`
const calls = []
let documentBody = text
let manifestBody = manifestText
let responseStatus = 200
const repo = createReadingRepository({ digest, fetchImpl: async url => {
  calls.push(url)
  return new Response(url.endsWith('manifest.json') ? manifestBody : documentBody,
    { status: url.endsWith('manifest.json') ? 200 : responseStatus, headers: { 'content-type': 'application/json' } })
} })
assert.equal(repo.peek(entry.document_id, entry), null, 'unverified bytes are never a synchronous hit')
await repo.manifest()
assert.deepEqual(calls, ['/data/reading/manifest.json'])
assert.equal((await repo.load('not_generated')).status, 'not-generated')
assert.equal(calls.length, 1)
const [a, b] = await Promise.all([repo.load(entry.document_id), repo.load(entry.document_id)])
assert.equal(a.document, b.document)
assert.equal(calls.length, 2)
assert.ok(Object.isFrozen(a.document.rows[0].anchor))
assert.equal(repo.peek(entry.document_id, {...entry}).document, a.document)
assert.equal(repo.peek(entry.document_id, {...entry,sha256:'sha256:new'}), null, 'cached evidence cannot satisfy a new revision')
assert.equal(repo.peek(entry.document_id, {...entry,source_file:'wrong.json'}), null, 'cached evidence cannot bypass changed locator identity')
assert.throws(() => { a.document.rows[0].source_text = 'changed' }, TypeError)
await assert.rejects(repo.load('../../RAW'), /Invalid/)

// A selected locator carries its segment siblings without fetching the full manifest.
const siblings = initial.entries.filter(candidate => candidate.logical_id === entry.logical_id)
const directCalls = []
const direct = createReadingRepository({ digest,
  locatorResolver: async documentId => ({ entry: structuredClone(siblings.find(candidate => candidate.document_id === documentId)), entries: structuredClone(siblings) }),
  fetchImpl: async url => { directCalls.push(url); return new Response(text, { headers: { 'content-type': 'application/json' } }) },
})
assert.deepEqual((await direct.locator(entry.document_id)).entries.map(candidate => candidate.document_id), siblings.map(candidate => candidate.document_id))
assert.equal((await direct.load(entry.document_id)).document.document_id, entry.document_id)
assert.deepEqual(directCalls, [`/data/reading/${entry.file}?rev=${entry.sha256.slice(7)}`])
const absent = createReadingRepository({ locatorResolver: async () => ({ entry: null, entries: [] }),
  fetchImpl: async () => { throw Error('Absent documents must not fetch a body') } })
assert.equal((await absent.locator('not_generated')).entry, null)
assert.equal((await absent.load('not_generated')).status, 'not-generated')

// Versioned bytes replace old cached content, while bad responses can be retried.
const updated = JSON.parse(text)
updated.source.publication.test_revision = 2
documentBody = JSON.stringify(updated)
const changed = structuredClone(initial)
changed.entries[entryIndex].sha256 = digest(new TextEncoder().encode(documentBody))
manifestBody = JSON.stringify(changed)
await repo.manifest({ fresh: true })
responseStatus = 503
await assert.rejects(repo.load(entry.document_id), /503/)
responseStatus = 200
const updatedBody = documentBody
documentBody = '{}'
await assert.rejects(repo.load(entry.document_id), /digest mismatch/)
documentBody = updatedBody
assert.equal((await repo.load(entry.document_id)).document.source.publication.test_revision, 2)
assert.notEqual((await repo.load(entry.document_id)).document, a.document)

// An old manifest failure must not clear a fresh successful manifest request.
let rejectOld
let count = 0
const race = createReadingRepository({ digest, fetchImpl: () => ++count === 1
  ? new Promise((_, reject) => { rejectOld = reject })
  : Promise.resolve(new Response(manifestText)) })
const old = race.manifest()
const oldFailure = assert.rejects(old, /obsolete|abort|cancel/i)
await race.manifest({ fresh: true })
rejectOld(Error('obsolete'))
await oldFailure
await race.manifest()
assert.equal(count, 2)

for (const mutate of [d => { d.schema_version = 1 }, d => { d.schema_version = 3 },
  d => { d.rows[0].visual.stepId = -1 }, d => { d.rows[0].visual.presence = 'guessed' },
  d => { delete d.rows[0].performance }, d => { d.rows[0].anchor.playback = {} }, d => { d.rows[0].anchor.step_index = -1 },
  d => { d.playback.file = '../../RAW/secret' }, d => { d.document_id = 'other' },
  d => { d.rows[0].text_ref.source_hash = 'bad' }, d => { d.rows.push(d.rows[0]) }]) {
  const invalid = JSON.parse(text)
  mutate(invalid)
  assert.throws(() => validateReadingDocument(invalid, entry), /Invalid reading/)
}
const retiredManifest = structuredClone(initial)
retiredManifest.entries[0].schema_version = 1
assert.throws(() => validateReadingManifest(retiredManifest), /v2 required/)
const invalidManifest = structuredClone(initial)
invalidManifest.entries[0].file = '../compiled/large.json'
assert.throws(() => validateReadingManifest(invalidManifest), /file/)
assert.ok(calls.every(url => url.startsWith('/data/reading/')))
console.log('Reading repository verified: discovery-only, single-document caching, integrity, versions, retries and manifest races')
