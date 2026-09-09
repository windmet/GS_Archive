import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createReadingDocument, readingAvatarEntity } from '../shared/reading/ReadingDocument.js'
import { validateReadingDocument, validateReadingManifest } from '../shared/reading/ReadingContract.js'

const read = async file => JSON.parse(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'))
const hash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const manifest = await read('public/data/reading/manifest.json')
validateReadingManifest(manifest)
assert.equal(manifest.schema_version, 1)
assert.equal(new Set(manifest.entries.map(e => e.document_id)).size, manifest.entries.length)
const selection = await read('config/reading-samples.v1.json')
const storyCatalog = await read('public/data/masterdata/story_catalog.json')
const expectedIds = new Set(selection.samples.map(sample => sample.document_id))
for (const sectionId of selection.main_collection_sections || []) {
  const collection = storyCatalog.collectionStructure.find(s => s.domain === 'main' && s.sectionId === sectionId)
  assert.ok(collection?.chapters.length, `selected main section ${sectionId} exists`)
  for (const chapter of collection.chapters) for (const episode of chapter.episodes) {
    expectedIds.add(episode.resourceId)
    const entry = manifest.entries.find(e => e.document_id === episode.resourceId)
    assert.ok(entry, `reading coverage: ${episode.resourceId}`)
    assert.equal(entry.title, chapter.title)
    assert.equal(entry.episode_label, episode.label)
  }
}
assert.deepEqual(new Set(manifest.entries.map(e => e.document_id)), expectedIds)
const documents = []
for (const entry of manifest.entries) {
  const bytes = await fs.readFile(new URL(`../public/data/reading/${entry.file}`, import.meta.url))
  assert.equal(hash(bytes), entry.sha256)
  const doc = JSON.parse(bytes)
  validateReadingDocument(doc, entry)
  assert.equal(doc.document_id, entry.document_id)
  assert.equal(doc.source.sha256, entry.source_sha256)
  assert.equal(doc.status, entry.status)
  assert.equal(doc.rows.length, entry.row_count)
  assert.equal(new Set(doc.rows.map(r => r.anchor.row_id)).size, doc.rows.length)
  for (const row of doc.rows) {
    assert.equal(typeof row.source_text, 'string')
    if (row.text_ref) assert.equal(hash(row.source_text), row.text_ref.source_hash)
    assert.ok(row.anchor.step_index >= 0 && row.anchor.step_index < doc.source.step_count)
    assert.equal(row.anchor.playback.target_step_index, row.anchor.step_index)
    assert.equal(row.anchor.playback.file, doc.source.file)
    assert.equal(row.anchor.playback.end_step_index, doc.source.step_count - 1)
    if (row.speaker.kind === 'unknown') assert.equal(readingAvatarEntity(row), null)
  }
  documents.push(doc)
}
const prologue = documents.find(d => d.document_id === '1_4_001_00_a')
assert.equal(prologue.status, 'ready')
assert.ok(prologue.rows.some(r => r.kind === 'synopsis'))
assert.ok(prologue.rows.some(r => readingAvatarEntity(r) === '001tom'))
assert.ok(prologue.rows.some(r => r.speaker.kind === 'unknown' && r.speaker.sourceName === '？？？'))
const strictChoice = documents.find(d => d.document_id === '1_4_001_01_a')
assert.equal(strictChoice.status, 'ready')
assert.ok(strictChoice.rows.some(r => r.kind === 'caption'))
assert.equal(strictChoice.controls.length, 2)
assert.ok(strictChoice.rows.some(r => r.kind === 'choice_detail' && r.source_text === 'appeal'))
assert.equal(documents.find(d => d.document_id === '1_4_001_02_a').status, 'ready')
const multi = documents.find(d => d.document_id === '1_4_001_03_h')
assert.equal(multi.status, 'unsupported')
assert.equal(multi.controls[0].options.length, 3)
assert.ok(multi.diagnostics.some(d => d.code === 'branch-exits-unavailable'))

// A non-contiguous source ID is not a zero-based playback offset.
const input = { scenario_id: 'test', steps: [
  { step_id: 7, type: 'adv', dialogue: { speaker: '？？？', text: 'original', text_cn: '译文' } },
  { step_id: 20, type: 'choice', options: [{ text: 'option', step_id: 80 }] },
  { step_id: 80, type: 'adv', dialogue: { text: 'end' } },
] }
const sourceBefore = JSON.stringify(input)
const args = { documentId: 'test', logicalId: 'story:test', file: 'test.json', sha256: hash(sourceBefore) }
const project = value => createReadingDocument(value, args)
const result = project(input)
assert.equal(JSON.stringify(input), sourceBefore)
assert.deepEqual(result, project(input))
assert.equal(result.status, 'ready')
assert.equal(result.rows[2].anchor.step_id, 80)
assert.equal(result.rows[2].anchor.step_index, 2)
assert.equal(result.controls[0].options[0].target_step_index, 2)
assert.equal(result.rows[0].text_ref, null)
assert.equal(result.rows[0].anchor.command_start, null)
assert.equal(result.rows[0].inline_translation.text, '译文')
assert.equal(readingAvatarEntity(result.rows[0]), null)
for (const target of [7, 999, null]) {
  const malformed = structuredClone(input)
  malformed.steps[1].options[0].step_id = target
  assert.equal(project(malformed).status, 'unsupported')
}
const duplicate = structuredClone(input)
duplicate.steps[2].step_id = 7
assert.throws(() => project(duplicate), /unique/)
assert.throws(() => project({ ...input, schema_version: 9 }), /Unsupported/)
assert.throws(() => project({ ...input, schema_version: 2, runtime_contract: 'unknown' }), /Unknown/)
assert.equal(project({ scenario_id: 'empty', steps: [] }).status, 'empty')
assert.equal(project({ scenario_id: 'unknown', steps: [{ step_id: 1, type: 'future_text' }] }).status, 'unsupported')
console.log(`Reading documents verified: ${documents.length} real samples, exact text hashes, anchors, compatibility and unsupported branches`)
