// Term backfills (translation/studio/amendments/*-terms.json) change published translations after
// their editorial receipts were written. Like the spacing amendment, each edit is source-bound and
// logged with its before text, so receipt verifiers undo it to replay the historical bytes exactly.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'

const ROOT = new URL('../../', import.meta.url)
const FOLDER = new URL('translation/studio/amendments/', ROOT)
const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const serialize = value => `${JSON.stringify(value, null, 2)}\n`

let cached
/** All term amendment files, oldest first; a later file amends the bytes an earlier one produced. */
export function loadTermAmendments() {
  if (!cached) {
    const files = fs.existsSync(FOLDER) ? fs.readdirSync(FOLDER).filter(file => /-terms\.json$/u.test(file)).sort() : []
    cached = files.map(file => ({ file, ...JSON.parse(fs.readFileSync(new URL(file, FOLDER), 'utf8')) }))
    for (const amendment of cached) assert.equal(amendment.schema, 'GS-TERM-AMENDMENT-V1', amendment.file)
  }
  return cached
}

/** Story catalogue bytes as they were before every term amendment (newest undone first). */
export function catalogueBeforeTermAmendments(scenarioId, bytes, amendments = loadTermAmendments()) {
  let current = bytes
  for (const amendment of [...amendments].reverse()) {
    const record = amendment.story.find(item => item.scenario_id === scenarioId)
    if (!record) continue
    assert.equal(digest(current), record.amended_sha256, `Term-amended catalogue changed: ${scenarioId}`)
    const overlay = JSON.parse(current)
    for (const edit of record.edits) {
      const entry = overlay.entries[edit.unit_id]
      assert(entry, `Term edit names a missing unit: ${edit.unit_id}`)
      assert.equal(entry.source_hash, edit.source_hash, `Term edit source drift: ${edit.unit_id}`)
      assert.equal(entry.text, edit.after, `Term edit is not live: ${edit.unit_id}`)
      entry.text = edit.before
    }
    current = Buffer.from(serialize(overlay))
    assert.equal(digest(current), record.base_sha256, `Pre-amendment catalogue cannot be reconstructed: ${scenarioId}`)
  }
  return current
}

/** Reads a published story catalogue with term amendments undone. */
export function readCatalogueBeforeTermAmendments(scenarioId) {
  return catalogueBeforeTermAmendments(scenarioId, fs.readFileSync(new URL(`public/translations/zh-CN/scenarios/${scenarioId}.json`, ROOT)))
}

/** Translation memory (Map key → entry) with term amendments undone, for editorial replays. */
export function memoryBeforeTermAmendments(memory, amendments = loadTermAmendments()) {
  const result = new Map(memory)
  for (const amendment of [...amendments].reverse()) for (const edit of amendment.memory) {
    const entry = result.get(edit.key)
    assert(entry, `Term edit names a missing TM entry: ${edit.key}`)
    assert.equal(entry.source, edit.source, `Term edit source drift: ${edit.key}`)
    assert.equal(entry.translation, edit.after, `Term edit is not live: ${edit.key}`)
    result.set(edit.key, { ...entry, translation: edit.before })
  }
  return result
}

/** Published archive-general entries ({kind: {field: {source: text}}}) with term amendments undone. */
export function publishedBeforeTermAmendments(entries, amendments = loadTermAmendments()) {
  const result = structuredClone(entries)
  for (const amendment of [...amendments].reverse()) for (const edit of amendment.memory) {
    const field = result[edit.kind]?.[edit.field]
    if (!field || !(edit.source in field)) continue
    assert.equal(field[edit.source], edit.after, `Published term edit is not live: ${edit.key}`)
    field[edit.source] = edit.before
  }
  return result
}
