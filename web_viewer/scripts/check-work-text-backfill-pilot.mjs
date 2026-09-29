// Compare isolated strict-v2 Work candidates with the currently mounted Reader rows.
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'
import { compareAuthoritativeRuntimeProjection } from './lib/authoritative-scenario-compiler.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice('--output='.length)
  || path.join(root, '.analysis', 'translation-preflight', 'work-pilot.json')
const readJson = async file => JSON.parse(await readFile(file, 'utf8'))
const hash = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`
const ledger = await readJson(path.join(root, '.analysis/local-story-strict-v2-r2/ledger.json'))
const manifest = await readJson(path.join(root, 'public/data/reading/manifest.json'))
const idols = await readJson(path.join(root, 'public/data/masterdata/idol_unit_dictionary.json'))
const knownIdolIds = new Set(idols.idols.map(idol => idol.idol_code))
const candidates = new Map(ledger.entries.filter(entry => entry.status === 'strict-v2-candidate')
  .map(entry => [entry.candidate_scenario_id, entry]))
const entries = manifest.entries.filter(entry => entry.domain === 'work')
const results = []
for (const entry of entries) {
  const candidate = candidates.get(entry.scenario_id)
  const record = { document_id: entry.document_id, scenario_id: entry.scenario_id,
    source_file: entry.source_file, candidate: candidate?.candidate || null }
  results.push(record)
  if (!candidate) { record.status = 'candidate-missing'; continue }
  const candidateBytes = await readFile(path.join(root, '.analysis/local-story-strict-v2-r2/candidates', candidate.candidate))
  const strict = JSON.parse(candidateBytes)
  const mounted = await readJson(path.join(root, 'public/data/compiled', entry.source_file))
  const old = await readJson(path.join(root, 'public/data/reading', entry.file))
  const next = createReadingDocument(strict, { documentId: entry.document_id,
    logicalId: entry.logical_id, file: entry.source_file, sha256: hash(candidateBytes), knownIdolIds })
  const rows = doc => doc.rows.map(row => [row.kind, row.source_text])
  const oldRows = rows(old)
  const nextRows = rows(next)
  record.status = JSON.stringify(oldRows) === JSON.stringify(nextRows) ? 'row-parity' : 'row-drift'
  record.old_status = old.status
  record.next_status = next.status
  record.old_rows = oldRows.length
  record.next_rows = nextRows.length
  record.old_text_rows = oldRows.filter(([, text]) => text).length
  record.next_text_rows = nextRows.filter(([, text]) => text).length
  record.next_identified_rows = next.rows.filter(row => row.source_text && row.text_ref).length
  record.old_steps = mounted.steps.length
  record.next_steps = strict.steps.length
  const runtime = compareAuthoritativeRuntimeProjection(mounted, strict)
  record.runtime_parity = runtime.passed
  record.non_text_differences = runtime.differences.filter(difference =>
    !difference.startsWith('source.raw_') && !/^steps\[\d+\]\.text$/u.test(difference))
  if (!runtime.passed) record.runtime_differences = runtime.differences.slice(0, 10)
  if (record.status === 'row-drift') {
    const first = oldRows.findIndex((row, i) => JSON.stringify(row) !== JSON.stringify(nextRows[i]))
    record.first_drift_index = first < 0 ? Math.min(oldRows.length, nextRows.length) : first
    record.old_at_drift = oldRows[record.first_drift_index] || null
    record.next_at_drift = nextRows[record.first_drift_index] || null
  }
}
const summary = { documents: entries.length,
  by_status: Object.fromEntries([...new Set(results.map(row => row.status))].sort().map(status =>
    [status, results.filter(row => row.status === status).length])),
  old_text_rows: results.reduce((sum, row) => sum + (row.old_text_rows || 0), 0),
  next_text_rows: results.reduce((sum, row) => sum + (row.next_text_rows || 0), 0),
  next_identified_rows: results.reduce((sum, row) => sum + (row.next_identified_rows || 0), 0) }
summary.runtime_parity = results.filter(row => row.runtime_parity === true).length
summary.runtime_drift = results.filter(row => row.runtime_parity === false).length
summary.non_text_parity = results.filter(row => row.non_text_differences?.length === 0).length
summary.non_text_drift = results.filter(row => row.non_text_differences?.length > 0).length
await writeFile(output, `${JSON.stringify({ summary, results }, null, 2)}\n`)
console.log(JSON.stringify(summary, null, 2))
if (summary['by_status']['row-parity'] !== summary.documents
  || summary.next_identified_rows !== summary.old_text_rows
  || summary.non_text_drift !== 0) process.exitCode = 1
