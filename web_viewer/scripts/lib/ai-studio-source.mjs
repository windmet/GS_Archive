import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createStoryTranslationDraft } from '../../src/localization/story/StoryTranslationDraft.js'
import { identityIssues } from '../audit-reading-diagnostics.mjs'
import {readingSourceByteVariants} from '../../shared/reading/ReadingSourceBytes.js'

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
export const sha256 = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
const HASH = /^sha256:[a-f0-9]{64}$/u
const FILE = /^[A-Za-z0-9._/-]+\.json$/u
const safeFile = (base, file) => {
  assert(FILE.test(file) && !file.split('/').includes('..'), `Unsafe corpus file: ${file}`)
  const resolved = path.resolve(projectRoot, base, file)
  assert(resolved.startsWith(path.resolve(projectRoot, base) + path.sep), `Escaped corpus path: ${file}`)
  return resolved
}
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'))

export async function loadStudioIndexes() {
  const reading = await readJson(path.join(projectRoot, 'public/data/reading/manifest.json'))
  const publication = await readJson(path.join(projectRoot, 'public/data/publication/manifest.json'))
  // 2807 since 2026-10-09: four combined birthday small-talk documents split into their ten parts.
  // 3113 since 2026-10-09: 306 seasonal campaign (Valentine / White Day) episodes became readable.
  assert.equal(reading.entries.length, 3113, 'Reader corpus size changed; audit the new baseline')
  return { reading, publication, releaseCache: new Map() }
}

async function releaseRawHash(entry, indexes, compiledHashes) {
  const owner = indexes.publication.by_logical_id[entry.logical_id]
    || indexes.publication.by_logical_id[`story:${entry.scenario_id}`]
  assert(owner, `No publication provenance: ${entry.document_id}`)
  const artifactPath = `web_viewer/public/data/compiled/${entry.source_file}`
  assert(owner.artifacts.some(item => item.path === artifactPath && compiledHashes.includes(`sha256:${item.sha256}`)),
    `Publication artifact drift: ${entry.document_id}`)
  let release = indexes.releaseCache.get(owner.release_id)
  if (!release) {
    release = await readJson(safeFile('public/data/publication/releases', `${owner.release_id}.json`))
    indexes.releaseCache.set(owner.release_id, release)
  }
  const record = release.entries.find(item => item.logical_id === entry.logical_id
    || item.logical_id === `story:${entry.scenario_id}`)
  const hash = record?.source?.sha256
  assert(/^[a-f0-9]{64}$/u.test(hash || ''), `No release RAW hash: ${entry.document_id}`)
  return `sha256:${hash}`
}

export async function loadStudioDocument(entry, indexes) {
  const readerBytes = await fs.readFile(safeFile('public/data/reading', entry.file))
  assert.equal(sha256(readerBytes), entry.sha256, `Reader drift: ${entry.document_id}`)
  const doc = JSON.parse(readerBytes)
  assert.equal(doc.document_id, entry.document_id)
  assert.equal(doc.logical_id, entry.logical_id)
  const compiledBytes = await fs.readFile(safeFile('public/data/compiled', entry.source_file))
  const compiledHashes = readingSourceByteVariants(compiledBytes).map(sha256)
  assert(compiledHashes.includes(entry.source_sha256), `Compiled source drift: ${entry.document_id}`)
  const compiledHash = entry.source_sha256 // Retain the original Studio receipt binding.
  const rawHashSource = doc.source?.raw_hash ? 'reader-source' : 'publication-release'
  const rawHash = doc.source?.raw_hash || await releaseRawHash(entry, indexes, compiledHashes)
  assert(HASH.test(rawHash), `Invalid RAW hash: ${entry.document_id}`)
  const scenarioId = doc.text_catalog_id || doc.scenario_id
  assert(typeof scenarioId === 'string' && scenarioId, `No translation catalogue: ${entry.document_id}`)
  const rows = doc.rows.filter(row => typeof row.source_text === 'string' && row.source_text.length)
  assert.equal(doc.rows.length, entry.row_count, `Reader row count drift: ${entry.document_id}`)
  const seen = new Set()
  for (const row of rows) {
    const issues = identityIssues(row.source_text, row.text_ref)
    assert.equal(issues.length, 0, `${entry.document_id}:${row.anchor?.row_id} ${issues.join(',')}`)
    assert(!seen.has(row.text_ref.unit_id), `Duplicate Reader unit: ${row.text_ref.unit_id}`)
    seen.add(row.text_ref.unit_id)
  }
  // scenario_id here is the overlay target. The unit ID and row.text_ref retain
  // their independent RAW aggregate/part coordinates for source verification.
  const evidence = { scenario_id: scenarioId, source_raw_hash: rawHash,
    text_units: rows.map(row => ({ scenario_id: scenarioId,
      unit_id: row.text_ref.unit_id, source_hash: row.text_ref.source_hash,
      source_text: row.source_text })) }
  const draft = createStoryTranslationDraft(evidence)
  assert.equal(Object.keys(draft.entries).length, rows.length)
  return { entry, doc, rows, evidence, draft, readerHash: entry.sha256, compiledHash, rawHashSource }
}
