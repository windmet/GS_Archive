import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { loadStudioIndexes, loadStudioDocument, projectRoot, sha256 } from './lib/ai-studio-source.mjs'
import { renderStudioInput, studioSchema } from './lib/ai-studio-markdown.mjs'
import { loadStudioPolicy, projectDocumentContext, studioPolicyManifest, voiceRoster } from './lib/ai-studio-projection.mjs'

const args = process.argv.slice(2)
const option = name => { const at = args.indexOf(name); return at < 0 ? '' : args[at + 1] || '' }
// Targeted mode: one batch for named documents (a later wave), numbered after the published ones.
const selectedDocuments = option('--documents').split(',').filter(Boolean)
const targetBatch = option('--batch')
assert(args.length % 2 === 0 && args.every((value, index) => index % 2 || ['--out', '--documents', '--batch'].includes(value)),
  'Usage: node scripts/prepare-ai-studio-batches.mjs [--out .analysis/translation-studio/RUN] [--documents ID,ID --batch B035-name]')
assert(Boolean(selectedDocuments.length) === Boolean(targetBatch), '--documents and --batch go together')
assert(!targetBatch || /^B\d{3}-[a-z0-9-]+$/u.test(targetBatch), 'Batch id looks like B035-birthday-small-talk')
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
const base = path.resolve(projectRoot, '.analysis/translation-studio')
const out = path.resolve(projectRoot, option('--out') || `.analysis/translation-studio/run-${head.slice(0, 12)}`)
assert(out.startsWith(base + path.sep), 'Output must stay under .analysis/translation-studio')
await fs.mkdir(base, { recursive: true })
await fs.mkdir(out)

const order = ['main', 'unit_story', 'idol_story', 'event', 'birthday', 'extra', 'work', 'card_scenarios', 'seasonal']
const indexes = await loadStudioIndexes()
const policy = await loadStudioPolicy({ version: 3 })
const byDomain = new Map(order.map(domain => [domain, []]))
const known = new Set(indexes.reading.entries.map(entry => entry.document_id))
for (const id of selectedDocuments) assert(known.has(id), `Unknown reading document: ${id}`)
for (const entry of indexes.reading.entries) {
  assert(byDomain.has(entry.domain), `Unknown story domain: ${entry.domain}`)
  if (selectedDocuments.length && !selectedDocuments.includes(entry.document_id)) continue
  const loaded = await loadStudioDocument(entry, indexes)
  byDomain.get(entry.domain).push(loaded)
}

const softRows = 1000, softCharacters = 30000, hardRows = 1300, hardCharacters = 40000
const plan = { schema: studioSchema, projection_version: 3, ...studioPolicyManifest(policy), source_commit: head, soft_rows: softRows,
  soft_characters: softCharacters, hard_rows: hardRows, hard_characters: hardCharacters,
  documents: 0, units: 0, batches: [] }
let batchNumber = 0
async function writeBatch(domain, loaded) {
  const batchId = targetBatch || `B${String(++batchNumber).padStart(3, '0')}-${domain.replaceAll('_', '-')}`
  const folder = path.join(out, batchId)
  await fs.mkdir(folder)
  const batch = { schema: studioSchema, projection_version: 3,
    ...studioPolicyManifest(policy), batch_id: batchId, source_commit: head, domain,
    documents: [], rows: [] }
  batch.trial_policy = policy.trial
  batch.trial_prompt = policy.prompt
  let ordinal = 0
  for (const item of loaded) {
    const { entry, rows, evidence, draft } = item
    batch.documents.push({ document_id: entry.document_id, scenario_id: evidence.scenario_id,
      title: entry.title || '', episode_label: entry.episode_label || '',
      reader_sha256: entry.sha256, compiled_sha256: entry.source_sha256,
      raw_hash_source: item.rawHashSource, evidence, draft })
    const contexts = projectDocumentContext(rows, policy)
    for (const [index, row] of rows.entries()) {
      const unitId = row.text_ref.unit_id
      batch.rows.push({ rid: `T${String(++ordinal).padStart(6, '0')}`,
        document_id: entry.document_id, unit_id: unitId, source_hash: row.text_ref.source_hash,
        source_text: row.source_text, protected_source: draft.entries[unitId].source,
        kind: row.kind, speaker: (row.speaker?.sourceName || '').replace(/●+/gu, 'Producer'),
        context: contexts[index] })
    }
  }
  assert.equal(new Set(batch.rows.map(row => row.unit_id)).size, batch.rows.length,
    `Repeated unit ID within ${batchId}`)
  batch.voice_roster = Object.fromEntries(voiceRoster(batch.rows, policy.voice))
  batch.context_sha256 = sha256(JSON.stringify(batch.rows.map(row => row.context)))
  const input = renderStudioInput(batch)
  batch.input_sha256 = sha256(input)
  await fs.writeFile(path.join(folder, 'input.md'), input, { flag: 'wx' })
  await fs.writeFile(path.join(folder, 'batch-map.json'), JSON.stringify(batch, null, 2) + '\n', { flag: 'wx' })
  const chars = batch.rows.reduce((n, row) => n + Array.from(row.source_text).length, 0)
  plan.documents += batch.documents.length
  plan.units += batch.rows.length
  plan.batches.push({ batch_id: batchId, domain, documents: batch.documents.length,
    units: batch.rows.length, source_characters: chars, input_bytes: Buffer.byteLength(input),
    context_bytes: Buffer.byteLength(JSON.stringify(batch.rows.map(row => row.context))),
    context_sha256: batch.context_sha256, input_sha256: batch.input_sha256 })
}

if (targetBatch) {
  const loaded = order.flatMap(domain => byDomain.get(domain))
  const rows = loaded.reduce((n, doc) => n + doc.rows.length, 0)
  assert(rows <= hardRows, `${targetBatch} exceeds the hard row cap`)
  await writeBatch(loaded[0].entry.domain, loaded)
}
for (const domain of targetBatch ? [] : order) {
  let current = [], rows = 0, characters = 0
  for (const doc of byDomain.get(domain)) {
    const count = doc.rows.length
    const chars = doc.rows.reduce((n, row) => n + Array.from(row.source_text).length, 0)
    assert(count <= hardRows && chars <= hardCharacters, `Single document exceeds hard cap: ${doc.entry.document_id}`)
    if (current.length && (rows + count > softRows || characters + chars > softCharacters)) {
      await writeBatch(domain, current)
      current = []; rows = 0; characters = 0
    }
    current.push(doc); rows += count; characters += chars
  }
  if (current.length) await writeBatch(domain, current)
}
assert.equal(plan.documents, selectedDocuments.length || indexes.reading.entries.length)
// 32760 since 2026-10-09: the 306 seasonal campaign documents add exactly 2639 rows (as in verify-ai-studio-batches).
if (!targetBatch) assert.equal(plan.units, 32760, 'Text coverage changed; audit the new baseline')
assert(plan.batches.every(batch => batch.units <= hardRows && batch.source_characters <= hardCharacters))
await fs.writeFile(path.join(out, 'plan.json'), JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify({ out, documents: plan.documents, units: plan.units,
  batches: plan.batches.length, domains: Object.fromEntries(order.map(domain =>
    [domain, plan.batches.filter(batch => batch.domain === domain).length])) }, null, 2))
