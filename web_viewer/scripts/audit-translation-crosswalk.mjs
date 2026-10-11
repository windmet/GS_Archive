import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { isDeepStrictEqual as equal } from 'node:util'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { createReadingDocument } from '../shared/reading/ReadingDocument.js'
import { normalizeScenario } from '../shared/story/ScenarioNormalizer.js'
import { compareAuthoritativeRuntimeProjection } from './lib/authoritative-scenario-compiler.mjs'
import { bytesHash, identityIssues } from './audit-reading-diagnostics.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = async file => fs.readFile(path.resolve(root, file))
const json = async file => JSON.parse(await read(file))
const candidateRoot = '.analysis/local-story-strict-v2-r2'
const ledger = await json(`${candidateRoot}/ledger.json`)
const manifest = await json('public/data/reading/manifest.json')
const idols = await json('public/data/masterdata/idol_unit_dictionary.json')
const knownIdolIds = new Set(idols.idols.map(x => x.idol_code))
const ajv = new Ajv2020({ strict: true, allErrors: true }); addFormats(ajv)
const validate = ajv.compile(await json('schemas/compiled-scenario-v2-authoritative.schema.json'))
const candidates = ledger.entries.filter(x => x.candidate)
const byPart = new Map(), byId = new Map(), checkedBundles = new Set()
for (const c of candidates) {
  for (const [map, key] of [[byPart, c.part], [byId, c.candidate_scenario_id]]) {
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(c)
  }
}
const results = []
for (const entry of manifest.entries) {
  const readingBytes = await read(`public/data/reading/${entry.file}`)
  const old = JSON.parse(readingBytes)
  const missing = old.rows.filter(r => r.source_text && !r.text_ref).length
  if (!missing) continue
  const compiledBytes = await read(`public/data/compiled/${entry.source_file}`)
  if (bytesHash(readingBytes) !== entry.sha256 || bytesHash(compiledBytes) !== entry.source_sha256) throw Error(`Baseline changed: ${entry.document_id}`)
  const mounted = JSON.parse(compiledBytes)
  const part = path.basename(entry.source_file, '.json')
  let matches = entry.source_file.startsWith('episodes/') ? (byPart.get(part) || []) : (byId.get(mounted.scenario_id) || [])
  const ownershipMatches = matches.filter(c => {
    const owner = c.container_path.split('/').at(-2)
    return entry.parent_file === `${owner}_${c.part}.json` || entry.parent_file === `${owner}_${c.candidate_scenario_id}.json`
  })
  if (ownershipMatches.length) matches = ownershipMatches
  const record = { document_id: entry.document_id, logical_id: entry.logical_id, domain: entry.domain,
    source_file: entry.source_file, parent_file: entry.parent_file, source_sha256: entry.source_sha256,
    reading_sha256: entry.sha256, missing_rows: missing, reader_status: old.status,
    topology: entry.source_file.startsWith('episodes/') ? 'episode' : 'standalone', candidates: matches.map(c => c.candidate) }
  results.push(record)
  if (matches.length !== 1) { record.status = matches.length ? 'ambiguous-owner' : 'candidate-missing'; continue }
  const c = matches[0], bytes = await read(`${candidateRoot}/candidates/${c.candidate}`)
  if (bytesHash(bytes) !== c.candidate_sha256) throw Error(`Candidate drift: ${c.candidate}`)
  if (!checkedBundles.has(c.bundle)) {
    if (bytesHash(await fs.readFile(path.join(ledger.raw_root, 'asset', c.bundle))) !== c.bundle_sha256) throw Error(`RAW changed: ${c.bundle}`)
    checkedBundles.add(c.bundle)
  }
  record.candidate_sha256 = c.candidate_sha256
  record.source = { bundle: c.bundle, bundle_sha256: c.bundle_sha256, container_path: c.container_path, part: c.part, payload_sha256: c.payload_sha256 }
  const strict = JSON.parse(bytes)
  record.schema_valid = validate(strict)
  if (!record.schema_valid) record.schema_errors = structuredClone(validate.errors)
  const next = createReadingDocument(strict, { documentId: entry.document_id, logicalId: entry.logical_id,
    file: entry.source_file, sha256: bytesHash(bytes), knownIdolIds })
  const rows = doc => doc.rows.map(r => ({ kind: r.kind, text: r.source_text, speaker: r.speaker?.sourceName,
    step_id: r.anchor.step_id, step_index: r.anchor.step_index }))
  const a = rows(old), b = rows(next)
  record.old_rows = a.length; record.next_rows = b.length
  record.row_parity = equal(a, b)
  record.text_order_parity = equal(a.map(r => [r.kind,r.text]), b.map(r => [r.kind,r.text]))
  // Classification only: never trim candidate rows or promote a part compilation.
  // A duplicated synopsis must be proven against the actual parent, not suffixes.
  if (record.topology === 'episode' && b.length === a.length + 2 && strict.steps[0]?.type === 'synopsis') {
    const parentBytes = await read(`public/data/compiled/${entry.parent_file}`)
    record.parent_sha256 = bytesHash(parentBytes)
    const parent = JSON.parse(parentBytes)
    const synopsis = parent.steps[0]?.type==='synopsis' ? parent.steps[0].dialogue : null
    const content = rows => rows.map(r=>[r.kind,r.text,r.speaker])
    const title = synopsis?.speaker_source_text ?? synopsis?.speaker ?? synopsis?.speaker_identity?.sourceName
    const text = synopsis?.source_text ?? synopsis?.text
    record.duplicate_preplay_synopsis = b[0]?.kind === 'title' && b[1]?.kind === 'synopsis' &&
      b[0].text === title && b[1].text === text && equal(content(a),content(b.slice(2))) &&
      a.every((r,i)=>b[i+2].step_id===r.step_id+1 && b[i+2].step_index===r.step_index+1)
  }
  record.speaker_identity_changes = old.rows.flatMap((r,i) => !equal(r.speaker,next.rows[i]?.speaker) ? [{index:i,before:r.speaker,after:next.rows[i]?.speaker}] : [])
  // Enriching a legacy named speaker is distinct from replacing an existing identity.
  record.speaker_identity_conflicts = old.rows.flatMap((r,i) => r.speaker?.entityId && !equal(r.speaker,next.rows[i]?.speaker) ? [i] : [])
  record.identity_issues = next.rows.filter(r => r.source_text).flatMap(r => identityIssues(r.source_text, r.text_ref).map(issue => ({row_id:r.anchor.row_id, issue})))
  record.existing_identity_drift = old.rows.flatMap((r,i) => r.text_ref && !equal(r.text_ref,next.rows[i]?.text_ref) ? [r.anchor.row_id] : [])
  const runtime = compareAuthoritativeRuntimeProjection(mounted, strict)
  record.runtime_differences = runtime.differences.filter(d => !d.startsWith('source.raw_') && !/^steps\[\d+\]\.text$/.test(d))
  const normalized = normalizeScenario(mounted)
  record.runtime_difference_fields = record.runtime_differences.flatMap(d => {
    const match = /^steps\[(\d+)\]$/.exec(d)
    if(!match) return [d]
    const before=normalized.steps[Number(match[1])], after=strict.steps[Number(match[1])]
    const keys=['step_id','type','entry_snapshot','settled_snapshot','episode_index','episode_part','chara_id','auto_advance','duration','hide_dialogue','lipSync']
    const fields=keys.filter(k=>!equal(before?.[k],after?.[k])).map(k=>`${d}.${k}`)
    for(const k of ['advance','blocks_skip','choice_id']) if(!equal(before?.flow?.[k],after?.flow?.[k])) fields.push(`${d}.flow.${k}`)
    const cues=s=>(s?.cues||[]).map(({evidence,...cue})=>cue)
    if(!equal(cues(before),cues(after))) fields.push(`${d}.cues`)
    return fields
  })
  // The projection comparator groups audio under .text; check it independently.
  const audio = data => data.steps.map(s => [s.dialogue?.voice || null, s.dialogue?.lip || null, s.lipSync ?? null])
  record.audio_parity = equal(audio(mounted), audio(strict))
  const targets = data => data.steps.map(s => s.options?.map(o => o.target_step_id ?? o.step_id) ?? null)
  record.choice_target_parity = equal(targets(mounted), targets(strict))
  if (!record.row_parity) {
    const i = a.findIndex((r,i) => !equal(r,b[i])); const index = i < 0 ? Math.min(a.length,b.length) : i
    record.first_drift = {index, before:a[index], after:b[index]}
  }
  record.status = !record.schema_valid ? 'invalid-schema' : record.identity_issues.length ? 'invalid-identity'
    : !record.row_parity ? (record.duplicate_preplay_synopsis ? 'duplicate-preplay-synopsis-parity' : 'row-drift') : record.existing_identity_drift.length ? 'existing-identity-drift'
      : record.speaker_identity_conflicts.length ? 'speaker-identity-conflict'
      : record.runtime_differences.length && record.runtime_difference_fields.length && record.runtime_difference_fields.every(f=>f.endsWith('.flow.choice_id')) && record.audio_parity && record.choice_target_parity ? 'choice-identity-parity'
      : record.runtime_differences.length || !record.audio_parity || !record.choice_target_parity ? 'text-parity-runtime-drift' : 'exact-identity-parity'
}
const count = rows => ({documents: rows.length, missing_rows: rows.reduce((n,r)=>n+r.missing_rows,0)})
const groups = key => Object.fromEntries([...new Set(results.map(r=>r[key]))].sort().map(k=>[k,count(results.filter(r=>r[key]===k))]))
const report = { head: execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(), generated_at:new Date().toISOString(),
  manifest_sha256:bytesHash(await read('public/data/reading/manifest.json')), candidate_ledger_sha256:bytesHash(await read(`${candidateRoot}/ledger.json`)),
  policy:'Audit only. Exact includes row kind/text/order/speaker source name/step, source hashes, strict schema, identity, runtime and independent audio parity. Speaker identity enrichments are reported separately; existing entity identities cannot change. No inferred branch targets.',
  summary:{...count(results), checked_bundles:checkedBundles.size, by_status:groups('status'), by_domain:groups('domain')}, results }
const out=path.join(root,'.analysis/translation-identity-backfill')
await fs.mkdir(out,{recursive:true})
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n')
await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(report.summary,null,2)+'\n')
for(const status of Object.keys(report.summary.by_status)) await fs.writeFile(path.join(out,`${status}.json`),JSON.stringify(results.filter(r=>r.status===status),null,2)+'\n')
console.log(JSON.stringify(report.summary,null,2))
