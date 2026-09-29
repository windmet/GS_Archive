import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseJsonStrict } from './lib/strict-json.mjs'
import { parseStoryTextUnitId, collectStoryTextEvidence } from '../src/localization/story/TranslationDiagnostics.js'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'

export const bytesHash = value => `sha256:${createHash('sha256').update(value).digest('hex')}`
export const sourceHash = value => bytesHash(value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC'))
export function identityIssues(text, ref) {
  if (!ref) return ['missing-text-ref']
  const problems = [], id = parseStoryTextUnitId(ref.unit_id)
  if (!id) problems.push('invalid-unit-id')
  if (ref.source_hash !== sourceHash(text)) problems.push('source-hash-mismatch')
  const s = ref.source
  if (!s || !s.file || /\\|^\/|^[A-Za-z]:|(?:^|\/)\.\.(?:\/|$)/.test(s.file)) problems.push('invalid-source-evidence')
  if (id && (!s || id.scenarioId !== s.scenario_id || id.partId !== s.part_id || id.commandIndex !== s.command_index || id.fieldKind !== s.field_kind || id.fieldOrdinal !== s.field_ordinal)) problems.push('identity-source-mismatch')
  return problems
}
const increment = (bucket, key, n = 1) => { bucket[key] = (bucket[key] || 0) + n }
const contained = (root, relative) => {
  const target = path.resolve(root, relative)
  if (!target.startsWith(path.resolve(root) + path.sep)) throw Error(`Path outside input root: ${relative}`)
  return target
}

export async function auditReading(root) {
  const load = async relative => {
    const bytes = await fs.readFile(contained(root, relative))
    return { bytes, hash: bytesHash(bytes), data: parseJsonStrict(bytes.toString('utf8'), relative) }
  }
  const manifest = await load('public/data/reading/manifest.json')
  const coverage = await load('public/data/reading/coverage.json')
  const idols = await load('public/data/masterdata/idol_unit_dictionary.json')
  const knownIdolIds = new Set(idols.data.idols.map(x => x.idol_code))
  const report = { schema_version: 1, scope: 'manifest-owned Reading corpus; not all RAW or all game text',
    provenance: { manifest_sha256: manifest.hash, coverage_sha256: coverage.hash },
    policy: 'Report-only. Eligible means current compiled identity/hash checks pass, not RAW completeness, translation quality or publication approval.',
    totals: { documents: 0, rows: 0, text_rows: 0, nontext_rows: 0, identity_verified_rows: 0, missing_text_ref_rows: 0 },
    by_status: {}, by_domain: {}, by_reason: {}, unsupported_combinations: {}, missing_by_kind: {},
    eligibility: {}, documents: [], row_issues: [], diagnostic_details: [], integrity_issues: [],
    compiled_evidence: { occurrences: 0, units_not_in_reading_rows: 0, omitted_field_kinds: {}, identity_issues: [] }, excluded: [] }
  const units = new Map(), compiledUnits = new Map(), seenDocs = new Set()
  const addUnit = (map, ref, text, location) => {
    if (!ref?.unit_id) return
    const list = map.get(ref.unit_id) || []
    list.push({ ...location, source_hash: ref.source_hash, actual_hash: sourceHash(text) })
    map.set(ref.unit_id, list)
  }
  for (const entry of manifest.data.entries) {
    if (seenDocs.has(entry.document_id)) throw Error(`Duplicate manifest document: ${entry.document_id}`)
    seenDocs.add(entry.document_id)
    const input = await load(`public/data/reading/${entry.file}`), doc = input.data
    if (input.hash !== entry.sha256) report.integrity_issues.push({ document_id: entry.document_id, code: 'document-hash-mismatch' })
    const item = { document_id: entry.document_id, domain: entry.domain, reading_status: doc.status,
      source_file: doc.source.file, source_sha256: doc.source.sha256, runtime_contract: doc.source.runtime_contract,
      text_rows: 0, valid_rows: 0, missing_rows: 0, invalid_rows: 0, unsupported_reasons: [] }
    let compiled
    try { compiled = await load(`public/data/compiled/${doc.source.file}`) }
    catch (error) { report.integrity_issues.push({ document_id: entry.document_id, code: 'compiled-unavailable', message: error.message }) }
    let integrity = input.hash === entry.sha256 && doc.document_id === entry.document_id && doc.status === entry.status && doc.rows.length === entry.row_count && doc.source.sha256 === entry.source_sha256 && doc.source.file === entry.source_file
    if (compiled) {
      integrity &&= compiled.hash === doc.source.sha256
      const rebuilt = createReadingDocument(compiled.data, { documentId: doc.document_id, logicalId: doc.logical_id, file: doc.source.file, sha256: compiled.hash, knownIdolIds })
      for (const key of ['rows', 'diagnostics', 'controls', 'status']) if (JSON.stringify(rebuilt[key]) !== JSON.stringify(doc[key])) {
        integrity = false; report.integrity_issues.push({ document_id: entry.document_id, code: `projection-drift:${key}` })
      }
      const rowIds = new Set(doc.rows.map(r => r.text_ref?.unit_id).filter(Boolean))
      const originalRefs = new Map(compiled.data.steps.flatMap(step => [step.dialogue?.speaker_text_ref,
        step.dialogue?.text_ref, step.text_time?.text_ref, ...(step.options || []).flatMap(o => [o.text_ref, o.detail_text_ref])])
        .filter(Boolean).map(ref => [ref.unit_id, ref]))
      for (const record of collectStoryTextEvidence(compiled.data).records) {
        report.compiled_evidence.occurrences++
        const ref = originalRefs.get(record.unitId)
        const problems = identityIssues(record.sourceText, ref)
        if (problems.length) report.compiled_evidence.identity_issues.push({ document_id: doc.document_id, unit_id: record.unitId, problems })
        addUnit(compiledUnits, ref, record.sourceText, { document_id: doc.document_id, field_kind: record.fieldKind })
        if (!rowIds.has(record.unitId)) { report.compiled_evidence.units_not_in_reading_rows++; increment(report.compiled_evidence.omitted_field_kinds, record.fieldKind) }
      }
    } else integrity = false
    if (!integrity) report.integrity_issues.push({ document_id: entry.document_id, code: 'source-or-manifest-integrity' })
    const reasons = new Set()
    for (const d of doc.diagnostics) {
      const k = `${d.severity}:${d.code}`
      const group = report.by_reason[k] ||= { documents: 0, occurrences: 0, domains: {}, representative_ids: [] }
      group.occurrences++
      if (!reasons.has(k)) { group.documents++; increment(group.domains, entry.domain); if (group.representative_ids.length < 5) group.representative_ids.push(doc.document_id) }
      reasons.add(k)
      if (d.severity === 'unsupported') {
        const step = compiled?.data.steps[d.step_index]
        report.diagnostic_details.push({ document_id: doc.document_id, ...d, step_id: step?.step_id, step_type: step?.type,
          has_text_container: Boolean(step?.dialogue || step?.text_time || step?.options?.length), options: step?.options?.map(o => ({ label: o.label, text: o.source_text ?? o.text, target: o.target_step_id ?? o.step_id })) })
      }
    }
    item.unsupported_reasons = [...new Set(doc.diagnostics.filter(d => d.severity === 'unsupported').map(d => d.code))].sort()
    if (item.unsupported_reasons.length) increment(report.unsupported_combinations, item.unsupported_reasons.join(' + '))
    for (const row of doc.rows) {
      report.totals.rows++
      if (!row.source_text) { report.totals.nontext_rows++; continue }
      report.totals.text_rows++; item.text_rows++
      const problems = identityIssues(row.source_text, row.text_ref)
      if (!integrity) problems.push('source-or-manifest-integrity')
      if (!row.text_ref) { item.missing_rows++; report.totals.missing_text_ref_rows++; increment(report.missing_by_kind, row.kind) }
      else if (problems.length) item.invalid_rows++
      else { item.valid_rows++; report.totals.identity_verified_rows++ }
      if (problems.length) report.row_issues.push({ document_id: doc.document_id, domain: entry.domain, kind: row.kind,
        anchor: row.anchor, source_text: row.source_text, text_ref: row.text_ref, problems })
      addUnit(units, row.text_ref, row.source_text, { document_id: doc.document_id, row_id: row.anchor.row_id })
    }
    item.translation_eligibility = !integrity || !item.valid_rows ? 'blocked' : item.valid_rows === item.text_rows ? 'eligible' : 'partial'
    item.context_dependent = item.unsupported_reasons.length > 0
    report.documents.push(item); report.totals.documents++
    increment(report.by_status, doc.status); increment(report.eligibility, item.translation_eligibility)
    const domain = report.by_domain[entry.domain] ||= { documents: 0, text_rows: 0, valid_rows: 0, missing_rows: 0, statuses: {}, eligibility: {} }
    domain.documents++; domain.text_rows += item.text_rows; domain.valid_rows += item.valid_rows; domain.missing_rows += item.missing_rows
    increment(domain.statuses, doc.status); increment(domain.eligibility, item.translation_eligibility)
  }
  const summarizeUnits = map => ({ unique_ids: map.size, repeated: [...map].filter(([, a]) => a.length > 1).map(([unit_id, locations]) => ({ unit_id, conflicting: new Set(locations.map(x => x.actual_hash + x.source_hash)).size > 1, locations })) })
  report.reading_units = summarizeUnits(units)
  report.compiled_units = summarizeUnits(compiledUnits)
  // Never leave a document eligible when global identity conflicts were found.
  const conflicts = new Set([...report.reading_units.repeated, ...report.compiled_units.repeated].filter(x => x.conflicting).flatMap(x => x.locations.map(y => y.document_id)))
  if (conflicts.size) {
    for (const doc of report.documents.filter(x => conflicts.has(x.document_id))) {
      increment(report.eligibility, doc.translation_eligibility, -1); increment(report.eligibility, 'blocked')
      increment(report.by_domain[doc.domain].eligibility, doc.translation_eligibility, -1); increment(report.by_domain[doc.domain].eligibility, 'blocked')
      doc.translation_eligibility = 'blocked'; doc.identity_conflict = true
    }
  }
  for (const x of coverage.data.excluded) {
    let exists = true
    try { await fs.access(contained(root, `public/data/compiled/${x.file}`)) } catch { exists = false }
    report.excluded.push({ ...x, currently_exists: exists })
  }
  return report
}

const root = fileURLToPath(new URL('../', import.meta.url))
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  if (args.length && (args.length !== 2 || args[0] !== '--out')) throw Error('Usage: node scripts/audit-reading-diagnostics.mjs [--out path]')
  const out = path.resolve(root, args[1] || '.analysis/translation-preflight/reading-diagnostics.json')
  if (out.startsWith(path.join(root, 'public') + path.sep)) throw Error('Audit output must remain outside public')
  const report = await auditReading(root)
  report.provenance.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  report.provenance.generated_at = new Date().toISOString()
  await fs.mkdir(path.dirname(out), { recursive: true }); await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ output: out, totals: report.totals, eligibility: report.eligibility, reasons: report.by_reason,
    compiled_evidence: report.compiled_evidence, unique_reading_units: report.reading_units.unique_ids, integrity_issues: report.integrity_issues.length }, null, 2))
}
