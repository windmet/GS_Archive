import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual } from 'node:util'
import { importStoryTranslationDraft } from '../../src/localization/story/StoryTranslationDraft.js'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './ai-studio-source.mjs'
import { parseStudioResult, checkStudioRows, renderRepair, renderStudioInput, studioSchema } from './ai-studio-markdown.mjs'
import { loadStudioPolicy, projectDocumentContext, studioPolicyManifest, voiceRoster } from './ai-studio-projection.mjs'

export async function checkStudioBatch(folderArgument) {
  assert(typeof folderArgument === 'string' && folderArgument, 'Provide a batch folder')
  const folder = path.resolve(projectRoot, folderArgument)
  const base = path.resolve(projectRoot, '.analysis/translation-studio')
  assert(folder.startsWith(base + path.sep), 'Batch must stay under .analysis/translation-studio')
  const batch = JSON.parse(await fs.readFile(path.join(folder, 'batch-map.json'), 'utf8'))
  const input = await fs.readFile(path.join(folder, 'input.md'))
  const output = await fs.readFile(path.join(folder, 'output.md'), 'utf8')
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
  assert.equal(batch.schema, studioSchema)
  assert(batch.projection_version === undefined || batch.projection_version === 2, 'Unknown projection version')
  assert.equal(batch.source_commit, head, 'Source commit changed; regenerate batch before import')
  assert.equal(sha256(input), batch.input_sha256, 'Input Markdown changed')
  assert.equal(input.toString('utf8'), renderStudioInput(batch), 'Input Markdown no longer matches canonical batch projection')
  assert.equal(batch.rows.length, new Set(batch.rows.map(row => row.rid)).size, 'Repeated RID in map')
  assert.equal(batch.rows.length, new Set(batch.rows.map(row => row.unit_id)).size, 'Repeated unit ID in map')
  const indexes = await loadStudioIndexes()
  const policy = batch.projection_version === 2 ? await loadStudioPolicy() : null
  if (policy) {
    for (const [key, value] of Object.entries(studioPolicyManifest(policy)))
      assert.equal(batch[key], value, `Studio policy drift: ${key}`)
  }
  const live = new Map()
  for (const document of batch.documents) {
    const entry = indexes.reading.entries.find(item => item.document_id === document.document_id)
    assert(entry, `Reader document missing: ${document.document_id}`)
    const current = await loadStudioDocument(entry, indexes)
    assert.equal(document.scenario_id, current.evidence.scenario_id)
    assert.equal(document.reader_sha256, current.readerHash)
    assert.equal(document.compiled_sha256, current.compiledHash)
    assert.equal(document.raw_hash_source, current.rawHashSource)
    assert(isDeepStrictEqual(document.evidence, current.evidence), `Evidence drift: ${document.document_id}`)
    assert(isDeepStrictEqual(document.draft, current.draft), `Draft drift: ${document.document_id}`)
    live.set(document.document_id, current)
  }
  const expected = []
  for (const document of batch.documents) {
    const current = live.get(document.document_id)
    const contexts = policy ? projectDocumentContext(current.rows, policy) : null
    for (const [index, row] of current.rows.entries()) {
      const mapRow = batch.rows[expected.length]
      assert(mapRow && mapRow.document_id === document.document_id
        && mapRow.unit_id === row.text_ref.unit_id
        && mapRow.source_hash === row.text_ref.source_hash
        && mapRow.source_text === row.source_text
        && mapRow.protected_source === current.draft.entries[row.text_ref.unit_id].source
        && mapRow.kind === row.kind
        && mapRow.speaker === (row.speaker?.sourceName || '').replace(/●+/gu, 'Producer')
        && (!contexts || isDeepStrictEqual(mapRow.context, contexts[index])),
      `Batch row drift: ${document.document_id}:${row.anchor?.row_id}`)
      expected.push(mapRow.rid)
    }
  }
  assert.equal(expected.length, batch.rows.length, 'Batch row count drift')
  if (policy) {
    assert.equal(batch.context_sha256, sha256(JSON.stringify(batch.rows.map(row => row.context))), 'Context digest drift')
    assert(isDeepStrictEqual(batch.voice_roster, Object.fromEntries(voiceRoster(batch.rows, policy.voice))), 'Voice roster drift')
  }
  const parsed = parseStudioResult(output, expected)
  const qa = checkStudioRows(batch.rows, parsed.translations)
  const blocking = [...parsed.errors, ...qa.blocking]
  const completed = new Map(), overlays = new Map()
  if (!blocking.length) {
    for (const document of batch.documents) {
      const draft = structuredClone(document.draft)
      for (const row of batch.rows.filter(item => item.document_id === document.document_id))
        draft.entries[row.unit_id].translation = parsed.translations.get(row.rid)
      try {
        const overlay = importStoryTranslationDraft(live.get(document.document_id).evidence, draft)
        completed.set(document.document_id, draft)
        overlays.set(document.document_id, overlay)
      } catch (error) { blocking.push(`${document.document_id}: ${error.message}`) }
    }
  }
  const report = { schema: studioSchema, batch_id: batch.batch_id, source_commit: head,
    projection_version: batch.projection_version || 1, output_sha256: sha256(output),
    language_status: qa.review.length ? 'needs-review' : 'machine-check-only', human_status: 'unreviewed',
    expected: expected.length, parsed: parsed.translations.size, missing: parsed.missing,
    blocking, review: qa.review, structure: blocking.length ? 'FAIL' : 'PASS' }
  return { folder, batch, report, completed, overlays,
    repair: renderRepair(batch, parsed.missing) }
}
