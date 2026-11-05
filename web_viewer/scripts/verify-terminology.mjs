// Scans published translations against the term registry. For every approved term with forbidden
// renderings, a unit whose source has the term (said by an in-scope speaker) and whose translation
// uses a forbidden rendering is a violation; a unit that lacks the chosen rendering is "missing".
// Counts may only go down from config/terminology-baseline.json, so backfills ratchet it.
//   node scripts/verify-terminology.mjs [--report <file>] [--write-baseline]
// Story units need the local Reader corpus, so this runs locally (gate:source), not in CI.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { sourceUnits } from './lib/general-translation-batches.mjs'
import { readMemory } from './lib/translation-memory.mjs'
import { loadTermRegistry, matchable } from './lib/term-registry.mjs'

const root = process.cwd()
const args = process.argv.slice(2)
const option = name => { const at = args.indexOf(name); return at < 0 ? '' : args[at + 1] }
const baselinePath = path.join(root, 'config/terminology-baseline.json')
const registry = loadTermRegistry()
const compact = text => String(text).normalize('NFKC').replace(/\s+/gu, '')
const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'))

// One record per translated unit: where it lives, its speakers, source and translation.
const units = []
const tm = readMemory(root)
for (const unit of sourceUnits(root)) {
  const entry = tm.get(unit.key)
  if (entry?.translation && entry.decision !== 'keep-source')
    units.push({ domain: 'general', ref: unit.key, speakers: unit.references.map(ref => ref.speaker).filter(Boolean),
      source: unit.source, translation: entry.translation })
}
// Published archive-general also holds generated drafts (photo and metadata names) outside the TM.
const tmPairs = new Set(units.map(unit => `${unit.source}\u0001${unit.translation}`))
const general = ['public/translations/zh-CN/archive-general.json',
  ...fs.readdirSync(path.join(root, 'public/translations/zh-CN/archive-general')).filter(file => file.endsWith('.json'))
    .map(file => `public/translations/zh-CN/archive-general/${file}`)]
const walk = (value, file) => {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string' && /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(key) && !child.startsWith('sha256:')) {
      if (tmPairs.has(`${key}\u0001${child}`)) continue
      tmPairs.add(`${key}\u0001${child}`)
      units.push({ domain: 'published', ref: `${file}#${key}`, speakers: [], source: key, translation: child })
    } else walk(child, file)
  }
}
for (const file of general) walk(readJson(file), file)

const readingDir = path.join(root, 'public/data/reading'), scenarioDir = path.join(root, 'public/translations/zh-CN/scenarios')
assert(fs.existsSync(readingDir), 'Reader corpus missing: run in a checkout with public/data/reading')
const catalogues = new Map()
const catalogue = id => {
  if (!catalogues.has(id)) {
    const file = path.join(scenarioDir, `${id}.json`)
    catalogues.set(id, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).entries : {})
  }
  return catalogues.get(id)
}
const seen = new Set()
let readerDocuments = 0
for (const file of fs.readdirSync(readingDir)) {
  if (!file.endsWith('.json') || file === 'manifest.json') continue
  const document = JSON.parse(fs.readFileSync(path.join(readingDir, file), 'utf8'))
  if (!Array.isArray(document.rows)) continue
  readerDocuments++
  for (const row of document.rows) {
    const unitId = row.text_ref?.unit_id
    if (!unitId || seen.has(unitId) || !row.source_text) continue
    seen.add(unitId)
    const text = catalogue(unitId.split(':')[2])[unitId]?.text ?? catalogue(document.text_catalog_id)[unitId]?.text
    if (text) units.push({ domain: 'story', ref: unitId, document: document.document_id,
      speakers: [row.speaker?.entityId].filter(Boolean), source: row.source_text, translation: text })
  }
}
for (const file of fs.readdirSync(path.join(root, 'public/translations/zh-CN/reader-titles')))
  for (const entry of Object.values(readJson(`public/translations/zh-CN/reader-titles/${file}`).documents || {}))
    if (entry.record?.unit_id?.startsWith('metadata:') && !seen.has(entry.record.unit_id)) {
      seen.add(entry.record.unit_id)
      units.push({ domain: 'title', ref: entry.record.unit_id, speakers: [], source: entry.record.source, translation: entry.record.text })
    }
const count = domain => units.filter(unit => unit.domain === domain).length
assert(readerDocuments > 3000 && count('story') > 30000 && count('general') > 20000 && count('title') > 0,
  `Corpus looks incomplete: ${readerDocuments} documents, ${count('story')} story / ${count('general')} general / ${count('title')} title units`)

// Approved terms with forbidden renderings are enforced; each family form is its own check.
const checks = []
for (const entry of registry.terms.filter(entry => entry.status === 'approved'))
  for (const form of [entry, ...(entry.family || [])]) {
    const forbidden = [...(form.forbidden_zh || []), ...(form === entry ? [] : entry.forbidden_zh || [])]
    const src = form.src.filter(matchable)
    if (src.length && (forbidden.length || form !== entry || entry.forbidden_zh))
      checks.push({ id: form === entry ? entry.id : `${entry.id}:${src[0]}`, entry, src, zh: form.zh, forbidden: form === entry ? form.forbidden_zh || [] : forbidden })
  }
const exceptions = new Map(registry.terms.map(entry => [entry.id, new Set((entry.exceptions || []).map(item => item.ref))]))
const report = {}, hollow = []
for (const check of checks) {
  const result = report[check.id] = { sources: 0, forbidden: [], missing: [] }
  const speakers = check.entry.scope?.speakers
  for (const unit of units) {
    if (!check.src.some(src => compact(unit.source).includes(compact(src)))) continue
    if (speakers && !unit.speakers.some(id => speakers.includes(id))) continue
    if (exceptions.get(check.entry.id).has(unit.ref)) continue
    result.sources++
    const sample = { domain: unit.domain, ref: unit.ref, ...(unit.document ? { document: unit.document } : {}), source: unit.source, translation: unit.translation }
    const hit = check.forbidden.filter(bad => unit.translation.includes(bad))
    if (hit.length) result.forbidden.push({ ...sample, hit })
    else if (!unit.translation.includes(check.zh)) result.missing.push(sample)
  }
  if (!result.sources && check.id === check.entry.id) hollow.push(check.id)
}
// A term whose own source forms never occur in the corpus is a mistyped source form, not a pass.
assert.deepEqual(hollow, [], `Approved terms with no source occurrence:\n${hollow.join('\n')}`)

const counts = Object.fromEntries(Object.entries(report).map(([id, result]) =>
  [id, { sources: result.sources, forbidden: result.forbidden.length, missing: result.missing.length }]))
if (option('--report')) fs.writeFileSync(path.resolve(option('--report')), JSON.stringify({ counts, report }, null, 1))
if (args.includes('--write-baseline')) {
  fs.writeFileSync(baselinePath, JSON.stringify({ schema: 'GS-TERMINOLOGY-BASELINE-V1', registry_revision: registry.revision,
    note: 'Violation counts may only decrease. Regenerate with --write-baseline after a backfill lowers them.',
    terms: Object.fromEntries(Object.entries(counts).map(([id, value]) => [id, { forbidden: value.forbidden, missing: value.missing }])) }, null, 2) + '\n')
  console.log(`terminology baseline written for ${checks.length} checks`)
} else {
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8')).terms
  const worse = Object.entries(counts).flatMap(([id, value]) => ['forbidden', 'missing']
    .filter(kind => value[kind] > (baseline[id]?.[kind] ?? 0)).map(kind => `${id}: ${kind} ${baseline[id]?.[kind] ?? 0} → ${value[kind]}`))
  assert.deepEqual(worse, [], `Terminology regressed:\n${worse.join('\n')}`)
  const open = Object.values(counts).reduce((sum, value) => sum + value.forbidden, 0)
  console.log(`terminology ok: ${checks.length} checks over ${count('story')} story, ${count('general')} general, ${count('published')} published-only, ${count('title')} title units; ${open} forbidden renderings remain in the baseline`)
}
