import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { validateStoryTranslationOverlay } from '../src/localization/story/TranslationRepository.js'

if (process.argv.length !== 5) throw Error('Usage: node scripts/promote-studio-reviewed-batch.mjs BATCH PREVIEW REVIEW_ID')
const [batchArg, previewArg, reviewId] = process.argv.slice(2)
assert(/^[A-Za-z0-9._-]+$/u.test(reviewId), 'Unsafe review ID')
const within = (base, value) => {
  const root = path.resolve(projectRoot, base)
  const target = path.resolve(projectRoot, value)
  assert(target.startsWith(root + path.sep), `Path must be under ${base}`)
  return target
}
const batchDir = within('.analysis/translation-studio', batchArg)
const previewDir = within('.analysis/translation-preview', previewArg)
const reviewDir = path.join(projectRoot, 'translation/studio/reviews', reviewId)
const publicDir = path.join(projectRoot, 'public/translations/zh-CN/scenarios')
const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'))
const batch = await readJson(path.join(batchDir, 'batch-map.json'))
const report = await readJson(path.join(batchDir, 'check-report.json'))
const previewBytes = await fs.readFile(path.join(previewDir, 'manifest.json'))
const preview = JSON.parse(previewBytes)
const output = await fs.readFile(path.join(batchDir, 'output.md'))
assert.equal(batch.batch_id, 'B001-main')
assert.equal(batch.source_commit, report.source_commit)
assert.equal(report.structure, 'PASS')
assert.equal(report.expected, 993)
assert.equal(report.parsed, 993)
assert.equal(report.blocking.length, 0)
assert.equal(report.output_sha256, sha256(output))
assert.equal(preview.schema, 'GS-LOCAL-READER-TRIAL-V1')
assert.equal(preview.source_commit, batch.source_commit)
assert.equal(preview.output_sha256, report.output_sha256)
assert.equal(preview.documents, 52)
assert.equal(preview.catalogues, 42)
assert.equal(preview.units, 993)
assert.equal(preview.overlay_status, 'draft')
assert.equal(preview.human_status, 'unreviewed')
assert.equal(preview.files.length, 42)
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
execFileSync('git', ['merge-base', '--is-ancestor', batch.source_commit, head], { cwd: projectRoot })
const changedInputs = execFileSync('git', ['diff', '--name-only', batch.source_commit, head, '--',
  'web_viewer/public/data', 'web_viewer/src/localization/story', 'web_viewer/scripts/lib/ai-studio-source.mjs',
  'web_viewer/scripts/lib/ai-studio-markdown.mjs', 'web_viewer/translation/studio/policy'],
{ cwd: path.resolve(projectRoot, '..'), encoding: 'utf8' }).trim()
assert.equal(changedInputs, '', `Translation source or policy changed since batch: ${changedInputs}`)
const indexes = await loadStudioIndexes()
const expectedByCatalog = new Map()
for (const document of batch.documents) {
  const entry = indexes.reading.entries.find(item => item.document_id === document.document_id)
  assert(entry, `Reader document missing: ${document.document_id}`)
  const live = await loadStudioDocument(entry, indexes)
  assert.equal(document.reader_sha256, live.readerHash)
  assert.equal(document.compiled_sha256, live.compiledHash)
  assert(isDeepStrictEqual(document.evidence, live.evidence), `Source evidence drift: ${document.document_id}`)
  let target = expectedByCatalog.get(document.scenario_id)
  if (!target) {
    target = { rawHash: live.evidence.source_raw_hash, units: new Map() }
    expectedByCatalog.set(document.scenario_id, target)
  }
  assert.equal(target.rawHash, live.evidence.source_raw_hash)
  for (const unit of live.evidence.text_units) {
    assert(!target.units.has(unit.unit_id), `Duplicate source unit: ${unit.unit_id}`)
    target.units.set(unit.unit_id, unit.source_hash)
  }
}
assert.equal(expectedByCatalog.size, 42)
assert.equal([...expectedByCatalog.values()].reduce((sum, item) => sum + item.units.size, 0), 993)
const writes = [], replaced = []
for (const item of preview.files) {
  assert(/^[A-Za-z0-9._-]+$/u.test(item.scenario_id), 'Unsafe catalogue ID')
  assert.equal(item.path, `zh-CN/scenarios/${item.scenario_id}.json`)
  const draftBytes = await fs.readFile(path.join(previewDir, item.path))
  assert.equal(sha256(draftBytes), item.sha256, `Trial file changed: ${item.scenario_id}`)
  const draft = JSON.parse(draftBytes)
  const expected = expectedByCatalog.get(item.scenario_id)
  assert(expected, `Unexpected trial catalogue: ${item.scenario_id}`)
  assert.equal(draft.source_raw_hash, expected.rawHash)
  assert.equal(Object.keys(draft.entries).length, expected.units.size)
  assert.equal(Object.keys(draft.entries).length, item.entries)
  for (const [unitId, value] of Object.entries(draft.entries)) {
    assert.equal(value.source_hash, expected.units.get(unitId), `Source hash drift: ${unitId}`)
    assert.equal(value.status, 'draft', `Trial is not draft: ${unitId}`)
  }
  const reviewed = structuredClone(draft)
  for (const value of Object.values(reviewed.entries)) value.status = 'reviewed'
  assert.deepEqual(validateStoryTranslationOverlay(reviewed, { scenarioId: item.scenario_id, locale: 'zh-CN' }),
    { valid: true, errors: [] })
  const destination = path.join(publicDir, `${item.scenario_id}.json`)
  try {
    const previous = await readJson(destination)
    assert.equal(previous.source_raw_hash, reviewed.source_raw_hash, `Existing RAW hash conflict: ${item.scenario_id}`)
    for (const [unitId, value] of Object.entries(previous.entries)) {
      assert.equal(value.source_hash, reviewed.entries[unitId]?.source_hash, `Existing source conflict: ${unitId}`)
      assert.equal(value.status, 'draft', `Refusing to replace non-draft entry: ${unitId}`)
      if (value.text !== reviewed.entries[unitId].text) replaced.push(unitId)
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error }
  writes.push({ destination, bytes: JSON.stringify(reviewed, null, 2) + '\n', id: item.scenario_id })
  expectedByCatalog.delete(item.scenario_id)
}
assert.equal(expectedByCatalog.size, 0)
assert.equal(replaced.length, 3, 'Expected exactly three superseded draft texts')
await fs.mkdir(path.dirname(reviewDir), { recursive: true })
await fs.mkdir(reviewDir)
await fs.writeFile(path.join(reviewDir, 'output.md'), output, { flag: 'wx' })
const receipt = {
  schema: 'GS-STUDIO-HUMAN-REVIEW-V1', review_id: reviewId, batch_id: batch.batch_id,
  approval: 'User confirmed a complete read-through and approved reviewed text in this task on 2026-09-29.',
  status: 'reviewed', not_final: true, source_commit: batch.source_commit,
  promotion_commit_parent: head, output_sha256: report.output_sha256,
  preview_manifest_sha256: sha256(previewBytes), documents: 52, catalogues: 42, units: 993,
  machine_review_warnings: report.review, superseded_draft_units: replaced,
  files: writes.map(({ id, bytes }) => ({ scenario_id: id, sha256: sha256(bytes),
    entries: Object.keys(JSON.parse(bytes).entries).length })),
}
await fs.writeFile(path.join(reviewDir, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' })
for (const { destination, bytes } of writes) await fs.writeFile(destination, bytes)
console.log(JSON.stringify({ review_id: reviewId, documents: 52, catalogues: 42, units: 993,
  status: 'reviewed', warnings_recorded: report.review.length, superseded_drafts: replaced.length }, null, 2))
